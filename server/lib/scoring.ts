// Central, config-driven scoring engine.
// All point values come from master_configs (category='scoring'); nothing is
// hardcoded here except safe fallbacks. Awards are idempotent via score_events
// (UNIQUE user_id+source+ref_key), so the same day / assessment / measurement is
// never double-credited.
import { pool } from "../mysql.js";
import { decryptFields, TANITA_ENCRYPTED_FIELDS } from "./crypto.js";

type Source = "daily_mission" | "assessment" | "body_comp";

interface DailyMissionCfg {
  basePoints: number;
  streakTiers: { minStreak: number; bonus: number }[];
}
interface AssessmentCfg {
  bands: { minScore: number; maxScore: number; points: number }[];
  improvementBonus: number;
}
interface MetricRule {
  pointsPerUnitDecrease?: number;
  pointsPerUnitIncrease?: number;
  maxPoints?: number;
}
type BodyCompCfg = Record<string, MetricRule>;

const DEFAULTS = {
  daily_mission: {
    basePoints: 5,
    streakTiers: [
      { minStreak: 3, bonus: 5 },
      { minStreak: 7, bonus: 15 },
      { minStreak: 30, bonus: 50 },
    ],
  } as DailyMissionCfg,
  assessment: {
    bands: [
      { minScore: 0, maxScore: 49, points: 5 },
      { minScore: 50, maxScore: 79, points: 10 },
      { minScore: 80, maxScore: 100, points: 20 },
    ],
    improvementBonus: 15,
  } as AssessmentCfg,
  body_composition: {
    fat_pc: { pointsPerUnitDecrease: 10, maxPoints: 50 },
    visceral_fat: { pointsPerUnitDecrease: 10, maxPoints: 30 },
    weight: { pointsPerUnitDecrease: 5, maxPoints: 50 },
    muscle_mass: { pointsPerUnitIncrease: 10, maxPoints: 50 },
  } as BodyCompCfg,
};

// ── Config loading (cached ~60s) ─────────────────────────────────────────────
let cache: { at: number; map: Record<string, any> } | null = null;
const CACHE_MS = 60_000;

async function loadScoringConfig(): Promise<Record<string, any>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.map;
  const map: Record<string, any> = {};
  try {
    const [rows]: any = await pool.query(
      "SELECT key_name, metadata FROM master_configs WHERE category = 'scoring' AND is_active = true",
    );
    for (const r of rows) {
      try {
        map[r.key_name] =
          typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata;
      } catch {
        /* ignore malformed row, fall back to default below */
      }
    }
  } catch {
    /* table/db unavailable — use defaults */
  }
  cache = { at: Date.now(), map };
  return map;
}

function cfg<T>(map: Record<string, any>, key: keyof typeof DEFAULTS): T {
  return (map[key] ?? DEFAULTS[key]) as T;
}

/** Force-refresh the config cache (call after admin saves new rules). */
export function invalidateScoringCache() {
  cache = null;
}

// ── Idempotent credit ────────────────────────────────────────────────────────
// Inserts a score_events row and, only if it was newly inserted, credits the
// user. Returns the points actually awarded (0 if duplicate or non-positive).
async function credit(
  userId: number,
  source: Source,
  refKey: string,
  points: number,
  detail: string,
): Promise<number> {
  const pts = Math.max(0, Math.round(points || 0));
  if (!userId || pts <= 0) return 0;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [ins]: any = await connection.query(
      "INSERT IGNORE INTO score_events (user_id, source, ref_key, points, detail) VALUES (?, ?, ?, ?, ?)",
      [userId, source, refKey, pts, detail.slice(0, 255)],
    );
    if (ins.affectedRows === 0) {
      // Duplicate (already awarded) — no credit.
      await connection.rollback();
      return 0;
    }
    await connection.query(
      "UPDATE users SET points = points + ?, total_score = total_score + ? WHERE id = ?",
      [pts, pts, userId],
    );
    await connection.commit();
    return pts;
  } catch (err) {
    await connection.rollback();
    console.error("[scoring.credit]", err);
    return 0;
  } finally {
    connection.release();
  }
}

// ── Streak (consecutive days with an approved submission, incl. today) ────────
async function computeStreak(userId: number): Promise<number> {
  const [rows]: any = await pool.query(
    `SELECT DATE(created_at) AS d FROM submissions
      WHERE user_id = ? AND status = 'approved'
      GROUP BY DATE(created_at) ORDER BY d DESC LIMIT 400`,
    [userId],
  );
  const dates: string[] = rows.map((r: any) => String(r.d));
  if (dates.length === 0) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  let latest = new Date(dates[0]);
  latest.setHours(0, 0, 0, 0);
  if (
    latest.getTime() !== today.getTime() &&
    latest.getTime() !== yesterday.getTime()
  )
    return 0;
  let streak = 1;
  let current = latest;
  for (let i = 1; i < dates.length; i++) {
    const next = new Date(dates[i]);
    next.setHours(0, 0, 0, 0);
    const diff = Math.round((current.getTime() - next.getTime()) / 86400000);
    if (diff === 1) {
      streak++;
      current = next;
    } else if (diff === 0) {
      continue;
    } else break;
  }
  return streak;
}

// ── Public award functions ───────────────────────────────────────────────────

/** Award daily participation + streak bonus, once per user per calendar day. */
export async function awardDailyMission(
  userId: number,
  dateStr: string,
): Promise<number> {
  try {
    const map = await loadScoringConfig();
    const c = cfg<DailyMissionCfg>(map, "daily_mission");
    const streak = await computeStreak(userId);
    let bonus = 0;
    for (const tier of c.streakTiers || []) {
      if (streak >= tier.minStreak) bonus = Math.max(bonus, tier.bonus);
    }
    const total = (c.basePoints || 0) + bonus;
    return await credit(
      userId,
      "daily_mission",
      dateStr,
      total,
      `daily mission (streak ${streak})`,
    );
  } catch (err) {
    console.error("[scoring.awardDailyMission]", err);
    return 0;
  }
}

/**
 * Award points for a 3อ2ส assessment by score band, plus an improvement bonus
 * when a post_test beats the user's latest prior pre_test for the same activity.
 */
export async function awardAssessment(
  userId: number,
  assessment: {
    healthAssessmentId: number;
    totalScore: number;
    assessmentType?: string;
    activityId?: number | null;
  },
): Promise<number> {
  try {
    const map = await loadScoringConfig();
    const c = cfg<AssessmentCfg>(map, "assessment");
    const score = Number(assessment.totalScore) || 0;
    let points = 0;
    for (const b of c.bands || []) {
      if (score >= b.minScore && score <= b.maxScore) {
        points = b.points;
        break;
      }
    }
    // Improvement bonus: post_test higher than the most recent earlier pre_test.
    if (
      assessment.assessmentType === "post_test" &&
      assessment.activityId &&
      c.improvementBonus
    ) {
      const [prev]: any = await pool.query(
        `SELECT total_score FROM assessment_submissions
          WHERE event_id = ? AND user_id = ? AND test_type = 'pre_test'
          ORDER BY id DESC LIMIT 1`,
        [assessment.activityId, userId],
      );
      if (prev.length > 0 && score > Number(prev[0].total_score)) {
        points += c.improvementBonus;
      }
    }
    return await credit(
      userId,
      "assessment",
      String(assessment.healthAssessmentId),
      points,
      `assessment score ${score}`,
    );
  } catch (err) {
    console.error("[scoring.awardAssessment]", err);
    return 0;
  }
}

/**
 * Award points for body-composition improvement between the newest tanita
 * record and the immediately previous one. Idempotent per new record id.
 */
export async function awardBodyComposition(
  userId: number,
  newRecordId: number,
): Promise<number> {
  try {
    const map = await loadScoringConfig();
    const rules = cfg<BodyCompCfg>(map, "body_composition");
    const [rows]: any = await pool.query(
      "SELECT * FROM tanita WHERE user_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 2",
      [userId],
    );
    if (rows.length < 2) return 0;
    const [latest, prev] = rows.map((r: any) =>
      decryptFields(r, TANITA_ENCRYPTED_FIELDS),
    );
    const num = (v: any) => {
      const n = parseFloat(v);
      return isNaN(n) ? null : n;
    };
    let points = 0;
    for (const [metric, rule] of Object.entries(rules)) {
      const cur = num(latest[metric]);
      const before = num(prev[metric]);
      if (cur === null || before === null) continue;
      let gained = 0;
      if (rule.pointsPerUnitDecrease && before > cur) {
        gained = (before - cur) * rule.pointsPerUnitDecrease;
      } else if (rule.pointsPerUnitIncrease && cur > before) {
        gained = (cur - before) * rule.pointsPerUnitIncrease;
      }
      if (rule.maxPoints) gained = Math.min(gained, rule.maxPoints);
      points += gained;
    }
    return await credit(
      userId,
      "body_comp",
      String(newRecordId),
      points,
      "body composition improvement",
    );
  } catch (err) {
    console.error("[scoring.awardBodyComposition]", err);
    return 0;
  }
}
