import express from "express";
import { pool } from "../mysql.js";
import {
  decrypt,
  decryptFields,
  TANITA_ENCRYPTED_FIELDS,
} from "../lib/crypto.js";
import {
  buildUserFilter,
  collectRankingFilterOptions,
} from "../lib/rankingFilters.js";
import { computeStreakFromDates } from "../lib/streakScoring.js";
import { getStreakBonus } from "../lib/scoring.js";

const router = express.Router();

// Helper to robustly parse double-escaped JSON goal_config
function parseGoalConfig(gc: any) {
  if (!gc) return {};
  if (typeof gc === "object") return gc;
  let result = String(gc).trim();
  while (
    typeof result === "string" &&
    (result.startsWith("{") || result.startsWith('"') || result.startsWith("["))
  ) {
    try {
      const parsed = JSON.parse(result);
      if (parsed === result) break;
      result = parsed;
      if (typeof result === "object") break;
    } catch {
      // If purely a string that looks like JSON but fails, try stripping surrounding quotes manually
      if (result.startsWith('"') && result.endsWith('"')) {
        result = result.substring(1, result.length - 1);
        continue;
      }
      break;
    }
  }
  return typeof result === "object" ? result : {};
}

// Helper to normalize units for matching
function normalizeUnit(u: string): string {
  if (!u) return "";
  const s = u.toLowerCase().trim();
  if (
    s === "km" ||
    s === "กม" ||
    s === "กม." ||
    s === "กม้." ||
    s === "กิโลเมตร"
  )
    return "km";
  if (s === "kcal" || s === "แคล" || s === "แคลอรี่" || s === "calories")
    return "kcal";
  if (s === "points" || s === "pts" || s === "แต้ม" || s === "คะแนน")
    return "points";
  return s;
}

// Middleware to check if user is admin or host
async function checkManageAccess(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const userId = req.headers["x-user-id"];
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const [rows]: any = await pool.query(
      "SELECT role FROM users WHERE id = ?",
      [userId],
    );

    if (rows.length === 0 || !["admin", "host"].includes(rows[0].role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  } catch (error: any) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

export interface LeaderboardRow {
  id: number;
  fname_th: string;
  nickname: string;
  picture_url: string | null;
  role_type: string | null;
  team_id: number | null;
  base_points: number;
  total_unit_value: number;
  streak: number;
  streak_bonus: number;
  total_points: number; // combined score used for ordering + display
}

/**
 * Full ranked participant list for one activity. Point-metric activities fold in
 * the config-driven streak bonus (see spec); unit-metric activities rank by the
 * raw unit value with no bonus. Both the paginated list endpoint and the
 * per-user rank endpoint derive from this so score and rank always agree.
 */
async function computeActivityLeaderboard(
  activityId: string | number,
  req: express.Request,
): Promise<{ rows: LeaderboardRow[]; isPoints: boolean; metricUnit: string }> {
  // 1. Resolve the activity's official metric.
  const [eventRows]: any = await pool.query(
    "SELECT goal_config FROM events WHERE id = ?",
    [activityId],
  );
  const gc = eventRows.length ? parseGoalConfig(eventRows[0].goal_config) : {};
  const targetType = normalizeUnit(gc?.target_type || "points");
  const metricUnit = normalizeUnit(
    gc?.target_unit || gc?.unit || (targetType !== "points" ? targetType : ""),
  );
  const isPoints = !metricUnit || metricUnit === "points";

  // 2. Participants (respecting role_type filters).
  const uf = buildUserFilter(req, "u");
  const [participants]: any = await pool.query(
    `SELECT u.id, u.fname_th, u.nickname, u.picture_url, u.role_type, u.team_id
       FROM registrations r JOIN users u ON r.user_id = u.id
       WHERE r.event_id = ?${uf.sql}`,
    [activityId, ...uf.p],
  );
  if (participants.length === 0) {
    return { rows: [], isPoints, metricUnit };
  }
  const ids = participants.map((p: any) => p.id);

  // 3. Approved submissions for those participants, scoped to the activity.
  const [subs]: any = await pool.query(
    `SELECT s.user_id, DATE(s.created_at) AS d,
            t.points AS points,
            CASE WHEN t.submission_type != 'text'
                 AND (t.metric_unit = ? OR ? = '') THEN s.value ELSE 0 END AS unit_value
       FROM submissions s
       JOIN tasks t ON s.task_id = t.id
       WHERE s.user_id IN (?) AND t.event_id = ? AND s.status = 'approved'`,
    [metricUnit, metricUnit, ids, activityId],
  );

  const agg: Record<
    number,
    { base: number; unit: number; dates: Set<string> }
  > = {};
  for (const id of ids) agg[id] = { base: 0, unit: 0, dates: new Set() };
  for (const s of subs) {
    const a = agg[s.user_id];
    if (!a) continue;
    a.base += Number(s.points) || 0;
    a.unit += Number(s.unit_value) || 0;
    a.dates.add(String(s.d));
  }

  // 4. Build rows with streak + bonus.
  const rows: LeaderboardRow[] = [];
  for (const p of participants) {
    const a = agg[p.id];
    const streak = computeStreakFromDates(Array.from(a.dates));
    const streak_bonus = isPoints ? await getStreakBonus(streak) : 0;
    rows.push({
      id: p.id,
      fname_th: decrypt(p.fname_th),
      nickname: decrypt(p.nickname),
      picture_url: p.picture_url,
      role_type: p.role_type,
      team_id: p.team_id,
      base_points: a.base,
      total_unit_value: a.unit,
      streak,
      streak_bonus,
      total_points: a.base + streak_bonus,
    });
  }

  // 5. Sort: point metrics by combined score, unit metrics by unit value.
  rows.sort((x, y) => {
    const xv = isPoints ? x.total_points : x.total_unit_value;
    const yv = isPoints ? y.total_points : y.total_unit_value;
    if (yv !== xv) return yv - xv;
    return x.id - y.id;
  });

  return { rows, isPoints, metricUnit };
}

interface TeamRow {
  id: number;
  total: number;
}

/** Aggregate the per-user leaderboard into per-team totals, sorted desc. */
function aggregateTeams(rows: LeaderboardRow[], isPoints: boolean): TeamRow[] {
  const byTeam: Record<number, number> = {};
  for (const r of rows) {
    if (r.team_id == null) continue;
    const v = isPoints ? r.total_points : r.total_unit_value;
    byTeam[r.team_id] = (byTeam[r.team_id] || 0) + v;
  }
  return Object.entries(byTeam)
    .map(([id, total]) => ({ id: Number(id), total }))
    .sort((a, b) => (b.total !== a.total ? b.total - a.total : a.id - b.id));
}

router.get("/summary", checkManageAccess, async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  let totalHealthRecords = 0;
  let healthStats = {
    underweight: 0,
    normal: 0,
    overweight: 0,
    obese: 0,
    extreme_obese: 0,
  };
  let submissionStats = { total: 0, approved: 0, pending: 0, rejected: 0 };
  let pendingRequests = 0;
  let pendingRedemptions = 0;

  try {
    const [userRows]: any = await pool.query(
      "SELECT role FROM users WHERE id = ?",
      [userId],
    );
    const isAdmin = userRows[0]?.role === "admin";

    // ─── 1. Total Users ────────────────────────────────────────────
    const [userCountRows]: any = await pool.query(
      "SELECT COUNT(*) as count FROM users",
    );
    const totalUsers = userCountRows[0].count;

    // ─── 2. Active Activities ──────────────────────────────────────
    let activeEvents = 0;
    if (isAdmin) {
      const [r]: any = await pool.query(
        "SELECT COUNT(*) as count FROM events WHERE (status = 'open' OR status IS NULL) AND (DATE(end_date) >= CURDATE() OR is_continuous_event = 1 OR end_date IS NULL)",
      );
      activeEvents = r[0].count;
    } else {
      const [r]: any = await pool.query(
        "SELECT COUNT(*) as count FROM events WHERE created_by = ? AND (status = 'open' OR status IS NULL) AND (DATE(end_date) >= CURDATE() OR is_continuous_event = 1 OR end_date IS NULL)",
        [userId],
      );
      activeEvents = r[0].count;
    }

    // ─── 3. Pending Submissions + Recent Submissions ───────────────
    let pendingCount = 0;
    let filteredRecent: any[] = [];

    // Helper: get event IDs for host
    let hostEventIds: number[] = [];
    if (!isAdmin) {
      const [myEvents]: any = await pool.query(
        "SELECT id FROM events WHERE created_by = ?",
        [userId],
      );
      hostEventIds = myEvents.map((e: any) => e.id);
    }

    try {
      if (isAdmin) {
        const [pendingRows]: any = await pool.query(
          "SELECT COUNT(*) as count FROM submissions WHERE status = 'pending'",
        );
        pendingCount = pendingRows[0].count;

        const [recentRows]: any = await pool.query(`
            SELECT s.*, u.fname_th, u.picture_url, t.event_id, t.note 
            FROM submissions s
            LEFT JOIN users u ON s.user_id = u.id
            LEFT JOIN tasks t ON s.task_id = t.id
            ORDER BY s.created_at DESC
            LIMIT 10
        `);
        filteredRecent = recentRows.map((r: any) => ({
          ...r,
          fname_th: decrypt(r.fname_th) || r.fname_th,
        }));
      } else if (hostEventIds.length > 0) {
        const ph = hostEventIds.map(() => "?").join(",");

        const [pendingRows]: any = await pool.query(
          `SELECT COUNT(s.id) as count FROM submissions s JOIN tasks t ON s.task_id = t.id WHERE s.status = 'pending' AND t.event_id IN (${ph})`,
          hostEventIds,
        );
        pendingCount = pendingRows[0].count;

        const [recentRows]: any = await pool.query(
          `
            SELECT s.*, u.fname_th, u.picture_url, t.event_id, t.note 
            FROM submissions s
            LEFT JOIN users u ON s.user_id = u.id
            LEFT JOIN tasks t ON s.task_id = t.id
            WHERE t.event_id IN (${ph})
            ORDER BY s.created_at DESC
            LIMIT 10
        `,
          hostEventIds,
        );
        filteredRecent = recentRows.map((r: any) => ({
          ...r,
          fname_th: decrypt(r.fname_th),
        }));
      }
    } catch (e) {
      console.error("Stats: submissions error", e);
    }

    try {
      // ─── 4. Health Records (Tanita) ────────────────────────────────
      const [tanitaCountRows]: any = await pool.query(
        "SELECT COUNT(*) as count FROM tanita",
      );
      totalHealthRecords = tanitaCountRows[0].count;

      // ─── 5. BMI Distribution (Latest record per user) ────────────────
      const [healthData]: any = await pool.query(
        "SELECT bmi FROM tanita WHERE id IN (SELECT MAX(id) FROM tanita GROUP BY user_id)",
      );
      healthData.forEach((r: any) => {
        let bmiVal = r.bmi;
        if (typeof bmiVal === "string" && bmiVal.length > 10) {
          try {
            bmiVal = parseFloat(decrypt(bmiVal));
          } catch {
            bmiVal = parseFloat(bmiVal) || 0;
          }
        } else {
          bmiVal = parseFloat(bmiVal) || 0;
        }
        if (bmiVal < 18.5) healthStats.underweight++;
        else if (bmiVal < 23) healthStats.normal++;
        else if (bmiVal < 25) healthStats.overweight++;
        else if (bmiVal < 30) healthStats.obese++;
        else healthStats.extreme_obese++;
      });
    } catch (e) {
      console.error("Stats: health error", e);
    }

    // ─── 6. User Growth (Daily - Last 30 Days) ─────────────────────
    const [growthRows]: any = await pool.query(`
        SELECT DATE(created_at) as date, COUNT(*) as count 
        FROM users 
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY date 
        ORDER BY date ASC
    `);
    const userGrowth = growthRows.map((r: any) => ({
      month: new Date(r.date).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
      }),
      count: r.count,
    }));

    // ─── 7. Top 5 Users ────────────────────────────────────────────
    const [topUserRows]: any = await pool.query(`
        SELECT * FROM users 
        ORDER BY total_score DESC 
        LIMIT 5
    `);
    const decryptedTopUsers = topUserRows.map((u: any) => ({
      ...u,
      fname_th: decrypt(u.fname_th) || u.fname_th,
      nickname: decrypt(u.nickname) || u.nickname,
    }));

    try {
      const [statusRows]: any = await pool.query(
        `SELECT status, COUNT(*) as count FROM submissions GROUP BY status`,
      );
      submissionStats.total = statusRows.reduce(
        (acc: number, r: any) => acc + r.count,
        0,
      );
      submissionStats.approved =
        statusRows.find((r: any) => r.status === "approved")?.count || 0;
      submissionStats.pending =
        statusRows.find((r: any) => r.status === "pending")?.count || 0;
      submissionStats.rejected =
        statusRows.find((r: any) => r.status === "rejected")?.count || 0;
    } catch (e) {
      console.error("Stats: statusRows error", e);
    }

    // ─── 9. Teams count ────────────────────────────────────────────
    const [teamCountRows]: any = await pool.query(
      "SELECT COUNT(*) as count FROM teams",
    );
    const totalTeams = teamCountRows[0].count;

    // ─── 10. Total points across system ────────────────────────────
    const [totalPointsRows]: any = await pool.query(
      "SELECT COALESCE(SUM(total_score), 0) as total FROM users",
    );
    const totalPoints = Math.round(totalPointsRows[0].total);

    try {
      // Activity requests are no longer used
      pendingRequests = 0;
    } catch (e) {
      console.error("Stats: actReq error", e);
    }

    // ─── 13. Role distribution ─────────────────────────────────────
    const [roleRows]: any = await pool.query(
      "SELECT role, COUNT(*) as count FROM users GROUP BY role",
    );
    const roleColors: Record<string, string> = {
      user: "#5b5fc7",
      host: "#22c55e",
      admin: "#f59e0b",
      doctor: "#f43f5e",
    };
    const roleDistribution = roleRows.map((r: any) => ({
      role: r.role,
      count: r.count,
      color: roleColors[r.role] || "#999",
    }));

    // ─── 14. Top 5 Teams ───────────────────────────────────────────
    const [topTeamRows]: any = await pool.query(`
        SELECT t.id, t.name, t.code,
          (SELECT COALESCE(SUM(u.total_score), 0) FROM users u WHERE u.team_id = t.id) as team_total_score,
          (SELECT COUNT(*) FROM users u WHERE u.team_id = t.id) as member_count
        FROM teams t
        ORDER BY team_total_score DESC
        LIMIT 5
    `);

    // ─── 15. Submission Timeline (last 30 days) ────────────────────
    let submissionTimeline: any[] = [];
    if (isAdmin) {
      const [tlRows]: any = await pool.query(`
          SELECT DATE(created_at) as date, COUNT(*) as count
          FROM submissions
          WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
          GROUP BY date ORDER BY date ASC
      `);
      submissionTimeline = tlRows.map((r: any) => ({
        date: new Date(r.date).toLocaleDateString("th-TH", {
          day: "numeric",
          month: "short",
        }),
        count: r.count,
      }));
    } else if (hostEventIds.length > 0) {
      const ph = hostEventIds.map(() => "?").join(",");
      const [tlRows]: any = await pool.query(
        `
          SELECT DATE(s.created_at) as date, COUNT(*) as count
          FROM submissions s JOIN tasks t ON s.task_id = t.id
          WHERE t.event_id IN (${ph}) AND s.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
          GROUP BY date ORDER BY date ASC
      `,
        hostEventIds,
      );
      submissionTimeline = tlRows.map((r: any) => ({
        date: new Date(r.date).toLocaleDateString("th-TH", {
          day: "numeric",
          month: "short",
        }),
        count: r.count,
      }));
    }

    // ─── 16. Activity Breakdown (with tasks) ───────────────────────
    let activityBreakdown: any[] = [];
    const eventFilter = isAdmin
      ? ""
      : ` WHERE e.created_by = ${pool.escape(userId)}`;
    const [eventRows]: any = await pool.query(`
        SELECT 
          e.id, e.title, e.poster, e.start_date, e.end_date, e.status, e.max_slots, e.goal_config, e.is_continuous_event,
          (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id) as participant_count,
          (SELECT COUNT(*) FROM tasks t WHERE t.event_id = e.id) as task_count,
          (SELECT COUNT(*) FROM submissions s JOIN tasks t ON s.task_id = t.id WHERE t.event_id = e.id) as total_submissions,
          (SELECT COUNT(*) FROM submissions s JOIN tasks t ON s.task_id = t.id WHERE t.event_id = e.id AND s.status = 'approved') as approved_submissions,
          (SELECT COUNT(*) FROM submissions s JOIN tasks t ON s.task_id = t.id WHERE t.event_id = e.id AND s.status = 'pending') as pending_submissions,
          (SELECT COUNT(*) FROM submissions s JOIN tasks t ON s.task_id = t.id WHERE t.event_id = e.id AND s.status = 'rejected') as rejected_submissions
        FROM events e
        ${eventFilter}
        ORDER BY e.start_date DESC
    `);

    for (const evt of eventRows) {
      const gc = parseGoalConfig(evt.goal_config);
      const targetType = normalizeUnit(gc?.target_type || "points");
      const targetUnit = normalizeUnit(
        gc?.target_unit ||
          gc?.unit ||
          (targetType !== "points" ? targetType : ""),
      );
      const targetValue = Number(gc?.target_value) || 0;

      let achievedCount = 0;
      if (targetValue > 0) {
        try {
          const [achievedRows]: any = await pool.query(
            `
            SELECT COUNT(*) as count FROM (
              SELECT r.user_id
              FROM registrations r
              JOIN tasks t2 ON t2.event_id = r.event_id
              JOIN submissions s2 ON s2.task_id = t2.id AND s2.user_id = r.user_id
              WHERE r.event_id = ? AND s2.status = 'approved'
              GROUP BY r.user_id
              HAVING 
                CASE 
                  WHEN ? = 'points' THEN SUM(t2.points)
                  ELSE SUM(CASE WHEN (t2.metric_unit = ? OR ? = '') AND t2.submission_type != 'text' THEN s2.value ELSE 0 END)
                END >= ?
            ) as achieved_users
          `,
            [evt.id, targetType, targetUnit, targetUnit, targetValue],
          );
          achievedCount = achievedRows[0].count;
        } catch (e) {
          console.error("Achieved count error:", e);
        }
      }

      const [taskRows]: any = await pool.query(
        `
          SELECT 
            t.id as task_id,
            t.note as task_name,
            t.type,
            t.metric_type,
            t.metric_unit,
            t.points,
            (SELECT COUNT(*) FROM submissions s WHERE s.task_id = t.id) as total_submissions,
            (SELECT COUNT(*) FROM submissions s WHERE s.task_id = t.id AND s.status = 'approved') as approved,
            (SELECT COUNT(*) FROM submissions s WHERE s.task_id = t.id AND s.status = 'pending') as pending,
            (SELECT COUNT(*) FROM submissions s WHERE s.task_id = t.id AND s.status = 'rejected') as rejected,
            (SELECT ROUND(AVG(CASE WHEN t.submission_type != 'text' THEN s.value ELSE NULL END), 1) FROM submissions s WHERE s.task_id = t.id AND s.status = 'approved') as avg_value,
            (SELECT MAX(CASE WHEN t.submission_type != 'text' THEN s.value ELSE NULL END) FROM submissions s WHERE s.task_id = t.id AND s.status = 'approved') as max_value,
            (SELECT COUNT(DISTINCT s.user_id) FROM submissions s WHERE s.task_id = t.id) as unique_users
          FROM tasks t
          WHERE t.event_id = ?
          ORDER BY t.id ASC
      `,
        [evt.id],
      );

      activityBreakdown.push({
        ...evt,
        achieved_count: achievedCount,
        tasks: taskRows.map((t: any) => ({
          ...t,
          task_name: t.task_name || t.type || "ภารกิจ",
          avg_value: t.avg_value || 0,
          max_value: t.max_value || 0,
        })),
      });
    }

    // ─── 18. Health Assessment (form submissions) ──────────────────
    let healthAssessment: any[] = [];
    try {
      const [haRows]: any = await pool.query(`
          SELECT 
            f.title as form_title,
            COUNT(fs.id) as total_responses,
            ROUND(AVG(fs.total_score), 1) as avg_score,
            COUNT(CASE WHEN fs.risk_label = 'ปกติ' OR fs.risk_label IS NULL THEN 1 END) as normal_count,
            COUNT(CASE WHEN fs.risk_label IS NOT NULL AND fs.risk_label != 'ปกติ' THEN 1 END) as at_risk_count
          FROM form_submissions fs
          JOIN forms f ON fs.form_id = f.id
          GROUP BY f.id, f.title
      `);
      healthAssessment = haRows;
    } catch {
      /* forms table may not have data yet */
    }

    // ─── 19. Today's Pulse ─────────────────────────────────────────
    let todayActiveUsers = 0;
    let todaySubmissions = 0;
    try {
      const [tauRows]: any = await pool.query(
        "SELECT COUNT(DISTINCT user_id) as count FROM submissions WHERE DATE(created_at) = CURDATE()",
      );
      todayActiveUsers = tauRows[0].count;
      const [tsRows]: any = await pool.query(
        "SELECT COUNT(*) as count FROM submissions WHERE DATE(created_at) = CURDATE()",
      );
      todaySubmissions = tsRows[0].count;
    } catch (e) {
      console.error("Stats: pulse error", e);
    }

    // ─── 20. Trending Activity ─────────────────────────────────────
    let trendingActivity = null;
    try {
      const [trendRows]: any = await pool.query(`
        SELECT e.id, e.title, COUNT(s.id) as sub_count
        FROM events e
        JOIN tasks t ON t.event_id = e.id
        JOIN submissions s ON s.task_id = t.id
        WHERE s.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        GROUP BY e.id
        ORDER BY sub_count DESC
        LIMIT 1
      `);
      if (trendRows.length > 0) trendingActivity = trendRows[0];
    } catch (e) {
      console.error("Stats: trending error", e);
    }

    // ─── Build response ────────────────────────────────────────────
    const approvalPct = submissionStats.total
      ? Math.round((submissionStats.approved / submissionStats.total) * 100)
      : 0;

    res.json({
      pulse: {
        activeToday: todayActiveUsers,
        submissionsToday: todaySubmissions,
        trending: trendingActivity,
      },
      stats: [
        {
          label: "สมาชิกทั้งหมด",
          value: totalUsers || 0,
          icon: "Users",
          color: "text-blue-500",
        },
        {
          label: "กิจกรรมที่ดำเนินการ",
          value: activeEvents || 0,
          icon: "Activity",
          color: "text-emerald-500",
        },
        {
          label: "จำนวนทีม",
          value: totalTeams || 0,
          icon: "UserGroup",
          color: "text-cyan-500",
        },
        {
          label: "คำขอรออนุมัติ",
          value: pendingRequests || 0,
          icon: "FileText",
          color: "text-purple-500",
        },
      ],
      recentActivities: filteredRecent.slice(0, 6).map((s: any) => {
        let name = s.fname_th || "";
        let nickname = s.nickname || "";
        try {
          name = decrypt(name) || name;
        } catch {
          /* already plain */
        }
        try {
          nickname = decrypt(nickname) || nickname;
        } catch {
          /* already plain */
        }
        const timeDiff = Date.now() - new Date(s.created_at).getTime();
        const mins = Math.floor(timeDiff / 60000);
        let timeStr = "";
        if (mins < 1) timeStr = "เมื่อสักครู่";
        else if (mins < 60) timeStr = `${mins} นาทีที่แล้ว`;
        else if (mins < 1440) timeStr = `${Math.floor(mins / 60)} ชม.ที่แล้ว`;
        else timeStr = `${Math.floor(mins / 1440)} วันที่แล้ว`;
        return {
          id: s.id,
          user: {
            fname_th: name,
            nickname: nickname,
            picture_url: s.picture_url,
          },
          action: `ส่งหลักฐาน: ${s.note || "ภารกิจ"}`,
          status: s.status,
          time: timeStr,
        };
      }),
      healthDistribution: [
        { name: "ผอม", value: healthStats.underweight, color: "#38bdf8" },
        { name: "ปกติ", value: healthStats.normal, color: "#10b981" },
        { name: "ท้วม", value: healthStats.overweight, color: "#fbbf24" },
        { name: "อ้วน", value: healthStats.obese, color: "#f43f5e" },
        { name: "อ้วนมาก", value: healthStats.extreme_obese, color: "#881337" },
      ],
      userGrowth,
      submissionStats,
      submissionTimeline,
      roleDistribution,
      topUsers: topUserRows.map((u: any) => {
        let name = u.fname_th || "";
        let nickname = u.nickname || "";
        try {
          name = decrypt(name) || name;
        } catch {
          /* already plain */
        }
        try {
          nickname = decrypt(nickname) || nickname;
        } catch {
          /* already plain */
        }
        return { ...u, fname_th: name, nickname: nickname };
      }),
      topTeams: topTeamRows,
      activityBreakdown,
      healthAssessment,
    });
  } catch (error: any) {
    console.error("Stats summary error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get(
  "/activity/:id/participants",
  checkManageAccess,
  async (req, res) => {
    const { id } = req.params;
    console.log(`[DEBUG] Fetching participants for activity ID: ${id}`);
    try {
      const [eventRows]: any = await pool.query(
        "SELECT title, goal_config FROM events WHERE id = ?",
        [id],
      );
      if (eventRows.length === 0) {
        console.warn(`[DEBUG] Event ${id} not found`);
        return res.status(404).json({ error: "Event not found" });
      }

      let gc = eventRows[0].goal_config;
      if (typeof gc === "string")
        try {
          gc = JSON.parse(gc);
        } catch {
          gc = {};
        }
      const targetUnit = gc?.target_unit || "";
      const targetValue = Number(gc?.target_value) || 0;
      const targetType = gc?.target_type || "points";
      console.log(
        `[DEBUG] Event: ${eventRows[0].title}, Type: ${targetType}, Target: ${targetValue} ${targetUnit}`,
      );

      const [rows]: any = await pool.query(
        `
          SELECT 
            u.id, u.fname_th, u.lname_th, u.picture_url, u.nickname, u.role_type,
            r.created_at as joined_at,
            (
              SELECT COALESCE(
                 CASE 
                   WHEN ? = 'points' THEN SUM(t.points)
                   ELSE SUM(CASE WHEN t.submission_type != 'text' THEN s.value ELSE 0 END)
                 END, 0)
              FROM submissions s
              JOIN tasks t ON s.task_id = t.id
              WHERE s.user_id = u.id AND t.event_id = ? AND s.status = 'approved'
              AND (
                 ? = 'points' OR
                 t.metric_unit = ? OR ? = ''
              )
            ) as achieved_value,
            (
              SELECT COALESCE(SUM(t.points), 0)
              FROM submissions s
              JOIN tasks t ON s.task_id = t.id
              WHERE s.user_id = u.id AND t.event_id = ? AND s.status = 'approved'
            ) as points
          FROM registrations r
          JOIN users u ON r.user_id = u.id
          WHERE r.event_id = ?
          ORDER BY achieved_value DESC, joined_at ASC
      `,
        [targetType, id, targetType, targetUnit, targetUnit, id, id],
      );

      console.log(`[DEBUG] Found ${rows.length} participants`);

      const decrypted = rows.map((r: any) => ({
        ...r,
        fname_th: decrypt(r.fname_th),
        lname_th: decrypt(r.lname_th),
        nickname: decrypt(r.nickname),
        target: targetValue,
        is_achieved: targetValue > 0 && Number(r.achieved_value) >= targetValue,
      }));

      res.json(decrypted);
    } catch (error: any) {
      console.error(`[DEBUG] Error for activity ${id}:`, error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// ─── 19. Rankings (Leaderboard) ──────────────────────────────
// ─── Ranking Filter Options ─────────────────────────────────
// Distinct user types used by the leaderboard filter.
router.get("/rankings/filters", async (_req, res) => {
  try {
    const [rows]: any = await pool.query(`
      SELECT DISTINCT role_type
      FROM users
      WHERE role_type IS NOT NULL AND TRIM(role_type) != ''
    `);
    res.json(collectRankingFilterOptions(rows));
  } catch (error: any) {
    console.error("Ranking filters error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/rankings/:type", async (req, res) => {
  const { type } = req.params; // 'individual' or 'team'
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  try {
    let query = "";
    let params: any[] = [];
    const activityId = req.query.activity_id;
    let requestedUnit = req.query.unit as string;

    // Optional role_type filters scoped to the `u` users alias used across the
    // ranking queries.
    const uf = buildUserFilter(req, "u");
    const teamScoreUf = buildUserFilter(req, "u2");

    if (activityId) {
      // Fetch event goal_config to get the official unit
      const [eventRows]: any = await pool.query(
        "SELECT goal_config FROM events WHERE id = ?",
        [activityId],
      );
      let officialUnit = "";
      if (eventRows.length > 0) {
        let gc = eventRows[0].goal_config;
        if (typeof gc === "string") {
          try {
            gc = JSON.parse(gc);
          } catch {
            gc = {};
          }
        }
        gc = gc || {};
        officialUnit =
          gc.target_unit ||
          gc.unit ||
          (gc.target_type !== "points" ? gc.target_type : "");
      }

      // If requested unit is points/empty, but event has an official unit, use it for total_unit_value calculation
      if (
        !requestedUnit ||
        requestedUnit === "pts" ||
        requestedUnit === "แต้ม"
      ) {
        requestedUnit = officialUnit;
      }

      const orderBy =
        requestedUnit && requestedUnit !== "pts" && requestedUnit !== "แต้ม"
          ? "total_unit_value"
          : "total_points";

      // We use the official unit from the event if it exists, otherwise fallback to requested unit or empty
      const queryUnit = officialUnit || requestedUnit || "";

      if (type === "individual") {
        if (queryUnit) {
          query = `SELECT u.id, u.fname_th, u.picture_url, u.nickname, u.role_type,
                   (SELECT COALESCE(SUM(t.points), 0) FROM submissions s JOIN tasks t ON s.task_id = t.id WHERE s.user_id = u.id AND t.event_id = ? AND s.status = 'approved') as total_points,
                   (SELECT COALESCE(SUM(CASE WHEN t.submission_type != 'text' THEN s.value ELSE 0 END), 0) FROM submissions s JOIN tasks t ON s.task_id = t.id WHERE s.user_id = u.id AND t.event_id = ? AND s.status = 'approved' AND t.metric_unit = ?) as total_unit_value
                   FROM registrations r
                   JOIN users u ON r.user_id = u.id
                   WHERE r.event_id = ?${uf.sql}
                   ORDER BY ${orderBy} DESC, u.id ASC LIMIT ? OFFSET ?`;
          params = [
            activityId,
            activityId,
            queryUnit,
            activityId,
            ...uf.p,
            limit,
            offset,
          ];
        } else {
          query = `SELECT u.id, u.fname_th, u.picture_url, u.nickname, u.role_type,
                   (SELECT COALESCE(SUM(t.points), 0) FROM submissions s JOIN tasks t ON s.task_id = t.id WHERE s.user_id = u.id AND t.event_id = ? AND s.status = 'approved') as total_points,
                   0 as total_unit_value
                   FROM registrations r
                   JOIN users u ON r.user_id = u.id
                   WHERE r.event_id = ?${uf.sql}
                   ORDER BY total_points DESC, u.id ASC LIMIT ? OFFSET ?`;
          params = [activityId, activityId, ...uf.p, limit, offset];
        }
      } else {
        if (queryUnit) {
          query = `SELECT tm.id, tm.name, tm.code, tm.image, 
                   (SELECT COALESCE(SUM(t.points), 0)
                    FROM submissions s
                    JOIN tasks t ON s.task_id = t.id
                    JOIN users u2 ON s.user_id = u2.id
                    WHERE u2.team_id = tm.id AND t.event_id = ? AND s.status = 'approved'${teamScoreUf.sql}
                   ) as total_points,
                   (SELECT COALESCE(SUM(CASE WHEN t.submission_type != 'text' THEN s.value ELSE 0 END), 0)
                    FROM submissions s
                    JOIN tasks t ON s.task_id = t.id
                    JOIN users u2 ON s.user_id = u2.id
                    WHERE u2.team_id = tm.id AND t.event_id = ? AND s.status = 'approved' AND t.metric_unit = ?${teamScoreUf.sql}
                   ) as total_unit_value
                   FROM teams tm
                   WHERE tm.id IN (SELECT DISTINCT u.team_id FROM registrations r JOIN users u ON r.user_id = u.id WHERE r.event_id = ?${uf.sql} AND u.team_id IS NOT NULL)
                   ORDER BY ${orderBy} DESC, tm.id ASC LIMIT ? OFFSET ?`;
          params = [
            activityId,
            ...teamScoreUf.p,
            activityId,
            queryUnit,
            ...teamScoreUf.p,
            activityId,
            ...uf.p,
            limit,
            offset,
          ];
        } else {
          query = `SELECT tm.id, tm.name, tm.code, tm.image, 
                   (SELECT COALESCE(SUM(t.points), 0)
                    FROM submissions s
                    JOIN tasks t ON s.task_id = t.id
                    JOIN users u2 ON s.user_id = u2.id
                    WHERE u2.team_id = tm.id AND t.event_id = ? AND s.status = 'approved'${teamScoreUf.sql}
                   ) as total_points,
                   0 as total_unit_value
                   FROM teams tm
                   WHERE tm.id IN (SELECT DISTINCT u.team_id FROM registrations r JOIN users u ON r.user_id = u.id WHERE r.event_id = ?${uf.sql} AND u.team_id IS NOT NULL)
                   ORDER BY total_points DESC, tm.id ASC LIMIT ? OFFSET ?`;
          params = [
            activityId,
            ...teamScoreUf.p,
            activityId,
            ...uf.p,
            limit,
            offset,
          ];
        }
      }
    } else {
      if (type === "individual") {
        query = `SELECT u.id, u.fname_th, u.picture_url, u.nickname, u.role_type,
                 (SELECT COALESCE(SUM(t.points), 0) FROM submissions s JOIN tasks t ON s.task_id = t.id WHERE s.user_id = u.id AND s.status = 'approved') as total_points,
                 0 as total_unit_value
                 FROM users u
                 WHERE 1=1${uf.sql}
                 ORDER BY total_points DESC, u.id ASC LIMIT ? OFFSET ?`;
        params = [...uf.p, limit, offset];
      } else {
        // When ranking filters are present, restrict to teams that have at
        // least one member matching the filter.
        const teamMembershipFilter = uf.sql
          ? ` WHERE tm.id IN (SELECT DISTINCT u.team_id FROM users u WHERE u.team_id IS NOT NULL${uf.sql})`
          : "";
        query = `SELECT tm.id, tm.name, tm.code, tm.image,
                 (SELECT COALESCE(SUM(t.points), 0) FROM submissions s JOIN tasks t ON s.task_id = t.id JOIN users u2 ON s.user_id = u2.id WHERE u2.team_id = tm.id AND s.status = 'approved'${teamScoreUf.sql}) as total_points,
                 0 as total_unit_value
                 FROM teams tm
                 ${teamMembershipFilter}
                 ORDER BY total_points DESC, tm.id ASC LIMIT ? OFFSET ?`;
        params = [...teamScoreUf.p, ...uf.p, limit, offset];
      }
    }
    const [rows]: any = await pool.query(query, params);

    // Decrypt names for individuals & calculate streak
    if (type === "individual") {
      const userIds = rows.map((r: any) => r.id);

      // -- Streak Calculation Setup --
      let userSubs: Record<number, string[]> = {};
      if (userIds.length > 0) {
        try {
          let subQuery = `
             SELECT s.user_id, DATE(s.created_at) as date
             FROM submissions s
             WHERE s.user_id IN (?) AND s.status = 'approved'
             GROUP BY s.user_id, date
             ORDER BY date DESC
           `;
          let subParams = [userIds];
          if (activityId) {
            subQuery = `
               SELECT s.user_id, DATE(s.created_at) as date
               FROM submissions s
               JOIN tasks t ON s.task_id = t.id
               WHERE s.user_id IN (?) AND t.event_id = ? AND s.status = 'approved'
               GROUP BY s.user_id, date
               ORDER BY date DESC
             `;
            subParams.push(activityId);
          }
          const [subRows]: any = await pool.query(subQuery, subParams);

          subRows.forEach((r: any) => {
            if (!userSubs[r.user_id]) userSubs[r.user_id] = [];
            userSubs[r.user_id].push(r.date);
          });
        } catch (e) {
          console.error("Streak calc error:", e);
        }
      }

      rows.forEach((r: any) => {
        r.fname_th = decrypt(r.fname_th);
        r.nickname = decrypt(r.nickname);
        r.id_code = decrypt(r.id_code);

        // Calculate Streak
        let streak = 0;
        const dates = userSubs[r.id] || [];
        if (dates.length > 0) {
          let today = new Date();
          today.setHours(0, 0, 0, 0);
          let yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);

          let latest = new Date(dates[0]);
          latest.setHours(0, 0, 0, 0);

          if (
            latest.getTime() === today.getTime() ||
            latest.getTime() === yesterday.getTime()
          ) {
            streak = 1;
            let current = latest;
            for (let i = 1; i < dates.length; i++) {
              let next = new Date(dates[i]);
              next.setHours(0, 0, 0, 0);
              let diff = Math.round(
                (current.getTime() - next.getTime()) / 86400000,
              );
              if (diff === 1) {
                streak++;
                current = next;
              } else {
                break;
              }
            }
          }
        }
        r.streak = streak;
      });
    }

    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── 20. Get Individual Rank ────────────────────────────────
router.get("/individual/rank/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const eventId = req.query.activity_id || req.query.event_id;
    const unit = req.query.unit as string;

    if (!id || id === "undefined" || isNaN(Number(id))) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    if (eventId) {
      // Fetch event goal_config to get the official unit
      const [eventRows]: any = await pool.query(
        "SELECT goal_config FROM events WHERE id = ?",
        [eventId],
      );
      let officialUnit = "";
      if (eventRows.length > 0) {
        let gc = parseGoalConfig(eventRows[0].goal_config);
        officialUnit = normalizeUnit(
          gc.target_unit ||
            gc.unit ||
            (gc.target_type !== "points" ? gc.target_type : ""),
        );
      }

      let requestedUnit = normalizeUnit(unit);
      if (!requestedUnit || requestedUnit === "points") {
        requestedUnit = officialUnit;
      }
      const queryUnit = officialUnit || requestedUnit || "points";
      const isPoints = queryUnit === "points";

      // 1. Get user score
      const scoreParams = isPoints
        ? [id, eventId]
        : [id, eventId, queryUnit, queryUnit];
      const normalizedQueryUnit =
        queryUnit === "km" ? "km" : queryUnit === "kcal" ? "kcal" : queryUnit;

      const scoreQuery = isPoints
        ? `SELECT SUM(t.points) as score FROM submissions s JOIN tasks t ON s.task_id = t.id WHERE s.user_id = ? AND t.event_id = ? AND s.status = 'approved'`
        : `SELECT SUM(CASE WHEN t.submission_type != 'text' THEN s.value ELSE 0 END) as score FROM submissions s JOIN tasks t ON s.task_id = t.id WHERE s.user_id = ? AND t.event_id = ? AND s.status = 'approved' AND (t.metric_unit = ? OR t.metric_unit = 'km' AND ? = 'km' OR t.metric_unit = 'kcal' AND ? = 'kcal' OR ? = '')`;

      const [scoreRows]: any = await pool.query(
        scoreQuery,
        isPoints
          ? [id, eventId]
          : [id, eventId, queryUnit, queryUnit, queryUnit, queryUnit],
      );
      const userScore = Number(scoreRows[0]?.score) || 0;

      // 2. Count winners deterministically to match frontend index
      const uf = buildUserFilter(req, "u");
      const rankQuery = isPoints
        ? `SELECT COUNT(*) + 1 as \`rank\` FROM (
            SELECT u.id, (SELECT COALESCE(SUM(t.points), 0) FROM submissions s JOIN tasks t ON s.task_id = t.id WHERE s.user_id = u.id AND t.event_id = ? AND s.status = 'approved') as total
            FROM registrations r JOIN users u ON r.user_id = u.id WHERE r.event_id = ?${uf.sql}
          ) as winners WHERE total > ? OR (total = ? AND id < ?)`
        : `SELECT COUNT(*) + 1 as \`rank\` FROM (
            SELECT u.id, (SELECT COALESCE(SUM(CASE WHEN t.submission_type != 'text' THEN s.value ELSE 0 END), 0) FROM submissions s JOIN tasks t ON s.task_id = t.id WHERE s.user_id = u.id AND t.event_id = ? AND s.status = 'approved' AND (t.metric_unit = ? OR ? = '')) as total
            FROM registrations r JOIN users u ON r.user_id = u.id WHERE r.event_id = ?${uf.sql}
          ) as winners WHERE total > ? OR (total = ? AND id < ?)`;

      const rankParams = isPoints
        ? [eventId, eventId, ...uf.p, userScore, userScore, id]
        : [
            eventId,
            queryUnit,
            queryUnit,
            eventId,
            ...uf.p,
            userScore,
            userScore,
            id,
          ];
      const [rankRows]: any = await pool.query(rankQuery, rankParams);

      // 3. Get total points if we are ranking by a non-point unit
      let userPoints = userScore;
      if (!isPoints) {
        const [ptsRows]: any = await pool.query(
          `SELECT SUM(t.points) as tp FROM submissions s JOIN tasks t ON s.task_id = t.id WHERE s.user_id = ? AND t.event_id = ? AND s.status = 'approved'`,
          [id, eventId],
        );
        userPoints = Number(ptsRows[0]?.tp) || 0;
      }

      res.json({
        rank: rankRows[0]?.rank || 1,
        score: userScore,
        points: userPoints,
      });
    } else {
      // Global Rank (Live Sum)
      const scoreQuery = `SELECT COALESCE(SUM(t.points), 0) as score FROM submissions s JOIN tasks t ON s.task_id = t.id WHERE s.user_id = ? AND s.status = 'approved'`;
      const [scoreRows]: any = await pool.query(scoreQuery, [id]);
      const userScore = Number(scoreRows[0].score) || 0;

      const uf = buildUserFilter(req, "u");
      const rankQuery = `SELECT COUNT(*) + 1 as \`rank\` FROM (
          SELECT u.id, (SELECT COALESCE(SUM(t.points), 0) FROM submissions s JOIN tasks t ON s.task_id = t.id WHERE s.user_id = u.id AND s.status = 'approved') as total
          FROM users u
          WHERE 1=1${uf.sql}
        ) as winners WHERE total > ? OR (total = ? AND id < ?)`;
      const [rankRows]: any = await pool.query(rankQuery, [
        ...uf.p,
        userScore,
        userScore,
        id,
      ]);

      res.json({ rank: rankRows[0].rank || 1, score: userScore });
    }
  } catch (error: any) {
    console.error(`Individual Rank Error Details:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── 21. Get Team Rank ──────────────────────────────────────
router.get("/team/rank/:teamId", async (req, res) => {
  try {
    const { teamId } = req.params;
    const eventId = req.query.activity_id || req.query.event_id;
    const unit = req.query.unit as string;

    if (!teamId || teamId === "undefined" || isNaN(Number(teamId))) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    if (eventId) {
      // Fetch event goal_config to get the official unit
      const [eventRows]: any = await pool.query(
        "SELECT goal_config FROM events WHERE id = ?",
        [eventId],
      );
      let officialUnit = "";
      if (eventRows.length > 0) {
        let gc = parseGoalConfig(eventRows[0].goal_config);
        officialUnit = normalizeUnit(
          gc.target_unit ||
            gc.unit ||
            (gc.target_type !== "points" ? gc.target_type : ""),
        );
      }

      let requestedUnit = normalizeUnit(unit);
      if (!requestedUnit || requestedUnit === "points") {
        requestedUnit = officialUnit;
      }
      const queryUnit = officialUnit || requestedUnit || "points";
      const isPoints = queryUnit === "points";

      // 1. Get team score, scoped to the same member filters used by the list.
      const teamScoreUf = buildUserFilter(req, "u");
      const scoreQuery = isPoints
        ? `SELECT SUM(t.points) as score FROM submissions s JOIN tasks t ON s.task_id = t.id JOIN users u ON s.user_id = u.id WHERE u.team_id = ? AND t.event_id = ? AND s.status = 'approved'${teamScoreUf.sql}`
        : `SELECT SUM(s.value) as score FROM submissions s JOIN tasks t ON s.task_id = t.id JOIN users u ON s.user_id = u.id WHERE u.team_id = ? AND t.event_id = ? AND s.status = 'approved' AND (t.metric_unit = ? OR t.metric_unit = 'km' AND ? = 'km' OR t.metric_unit = 'kcal' AND ? = 'kcal' OR ? = '')${teamScoreUf.sql}`;

      const [scoreRows]: any = await pool.query(
        scoreQuery,
        isPoints
          ? [teamId, eventId, ...teamScoreUf.p]
          : [
              teamId,
              eventId,
              queryUnit,
              queryUnit,
              queryUnit,
              queryUnit,
              ...teamScoreUf.p,
            ],
      );
      const teamScore = Number(scoreRows[0]?.score) || 0;

      // 2. Count teams deterministically to match frontend index
      const uf = buildUserFilter(req, "u");
      const rankScoreUf = buildUserFilter(req, "u2");
      const rankQuery = isPoints
        ? `SELECT COUNT(*) + 1 as \`rank\` FROM (
            SELECT tm.id, (SELECT COALESCE(SUM(t.points), 0) FROM submissions s JOIN tasks t ON s.task_id = t.id JOIN users u2 ON s.user_id = u2.id WHERE u2.team_id = tm.id AND t.event_id = ? AND s.status = 'approved'${rankScoreUf.sql}) as total
            FROM teams tm WHERE tm.id IN (SELECT DISTINCT u.team_id FROM registrations r JOIN users u ON r.user_id = u.id WHERE r.event_id = ?${uf.sql} AND u.team_id IS NOT NULL)
          ) as winners WHERE total > ? OR (total = ? AND id < ?)`
        : `SELECT COUNT(*) + 1 as \`rank\` FROM (
            SELECT tm.id, (SELECT COALESCE(SUM(s.value), 0) FROM submissions s JOIN tasks t ON s.task_id = t.id JOIN users u2 ON s.user_id = u2.id WHERE u2.team_id = tm.id AND t.event_id = ? AND s.status = 'approved' AND (t.metric_unit = ? OR ? = '')${rankScoreUf.sql}) as total
            FROM teams tm WHERE tm.id IN (SELECT DISTINCT u.team_id FROM registrations r JOIN users u ON r.user_id = u.id WHERE r.event_id = ?${uf.sql} AND u.team_id IS NOT NULL)
          ) as winners WHERE total > ? OR (total = ? AND id < ?)`;

      const rankParams = isPoints
        ? [
            eventId,
            ...rankScoreUf.p,
            eventId,
            ...uf.p,
            teamScore,
            teamScore,
            teamId,
          ]
        : [
            eventId,
            queryUnit,
            queryUnit,
            ...rankScoreUf.p,
            eventId,
            ...uf.p,
            teamScore,
            teamScore,
            teamId,
          ];
      const [rankRows]: any = await pool.query(rankQuery, rankParams);

      let teamPoints = teamScore;
      if (!isPoints) {
        const [ptsRows]: any = await pool.query(
          `SELECT SUM(t.points) as tp FROM submissions s JOIN tasks t ON s.task_id = t.id JOIN users u ON s.user_id = u.id WHERE u.team_id = ? AND t.event_id = ? AND s.status = 'approved'`,
          [teamId, eventId],
        );
        teamPoints = Number(ptsRows[0]?.tp) || 0;
      }

      res.json({
        rank: rankRows[0]?.rank || 1,
        score: teamScore,
        points: teamPoints,
      });
    } else {
      // Global Team Rank (Live Sum)
      const teamScoreUf = buildUserFilter(req, "u");
      const scoreQuery = `SELECT COALESCE(SUM(t.points), 0) as score FROM submissions s JOIN tasks t ON s.task_id = t.id JOIN users u ON s.user_id = u.id WHERE u.team_id = ? AND s.status = 'approved'${teamScoreUf.sql}`;
      const [scoreRows]: any = await pool.query(scoreQuery, [
        teamId,
        ...teamScoreUf.p,
      ]);
      const teamScore = Number(scoreRows[0].score) || 0;

      const uf = buildUserFilter(req, "u");
      const rankScoreUf = buildUserFilter(req, "u2");
      const teamMembershipFilter = uf.sql
        ? ` WHERE tm.id IN (SELECT DISTINCT u.team_id FROM users u WHERE u.team_id IS NOT NULL${uf.sql})`
        : "";
      const rankQuery = `SELECT COUNT(*) + 1 as \`rank\` FROM (
          SELECT tm.id, (SELECT COALESCE(SUM(t.points), 0) FROM submissions s JOIN tasks t ON s.task_id = t.id JOIN users u2 ON s.user_id = u2.id WHERE u2.team_id = tm.id AND s.status = 'approved'${rankScoreUf.sql}) as total
          FROM teams tm${teamMembershipFilter}
        ) as winners WHERE total > ? OR (total = ? AND id < ?)`;
      const [rankRows]: any = await pool.query(rankQuery, [
        ...rankScoreUf.p,
        ...uf.p,
        teamScore,
        teamScore,
        teamId,
      ]);

      res.json({ rank: rankRows[0].rank || 1, score: teamScore });
    }
  } catch (error: any) {
    console.error(
      `Team Rank Error Details (ID:${req.params.teamId}, Act:${req.query.activity_id}):`,
      error,
    );
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── 22. Goal Progress (เป้าหมาย) ──────────────────────────────
router.get("/goal-progress/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;
    const type = (req.query.type as string) || "individual"; // 'individual' or 'team'

    // Get event with goal_config
    const [eventRows]: any = await pool.query(
      "SELECT goal_config, team_mode FROM events WHERE id = ?",
      [eventId],
    );
    if (eventRows.length === 0)
      return res.status(404).json({ error: "Event not found" });

    const goalConfig = parseGoalConfig(eventRows[0].goal_config);
    const targetValue = Number(goalConfig.target_value) || 0;
    const targetType = normalizeUnit(goalConfig.target_type || "points");
    const isPoints = targetType === "points";

    if (type === "individual") {
      const userId = req.query.user_id as string;
      const unit = normalizeUnit(
        goalConfig.target_unit ||
          goalConfig.unit ||
          (goalConfig.target_type !== "points" ? goalConfig.target_type : ""),
      );

      const isPoints = targetType === "points";
      let sql = `
        SELECT u.id, u.fname_th, u.picture_url, u.nickname,
          (SELECT COALESCE(SUM(${isPoints ? "t.points" : "s.value"}), 0)
           FROM submissions s 
           JOIN tasks t ON s.task_id = t.id
           WHERE s.user_id = u.id 
           AND t.event_id = ? 
           AND s.status = 'approved'
           ${isPoints ? "" : "AND (t.metric_unit = ? OR t.metric_unit = 'km' AND ? = 'km' OR t.metric_unit = 'kcal' AND ? = 'kcal' OR ? = '')"}
          ) as achieved,
          (SELECT COALESCE(SUM(t.points), 0)
           FROM submissions s 
           JOIN tasks t ON s.task_id = t.id
           WHERE s.user_id = u.id 
           AND t.event_id = ? 
           AND s.status = 'approved'
          ) as points_achieved
        FROM registrations r
        JOIN users u ON r.user_id = u.id
        WHERE r.event_id = ?
      `;
      let sqlParams = isPoints
        ? [eventId, eventId, eventId]
        : [eventId, unit, unit, unit, unit, eventId, eventId];

      if (userId) {
        sql += ` AND u.id = ?`;
        sqlParams.push(userId);
      }

      sql += ` ORDER BY achieved DESC`;
      const [rows]: any = await pool.query(sql, sqlParams);

      rows.forEach((r: any) => {
        try {
          r.fname_th = decrypt(r.fname_th);
        } catch {}
        try {
          r.nickname = decrypt(r.nickname);
        } catch {}
        r.target = targetValue;
        r.target_type = targetType;
        r.achieved = Number(r.achieved) || 0;
        r.percent =
          targetValue > 0
            ? Math.min(100, Math.round((r.achieved / targetValue) * 100))
            : 0;
        r.reached = r.achieved >= targetValue && targetValue > 0;
      });

      if (userId && rows.length > 0) {
        res.json({
          goal_config: goalConfig,
          progress: rows[0].achieved,
          data: rows[0],
        });
      } else {
        res.json({ goal_config: goalConfig, data: rows });
      }
    } else {
      // Team goal progress
      const teamId = req.query.team_id as string;
      const unit =
        goalConfig.target_unit ||
        goalConfig.unit ||
        (goalConfig.target_type !== "points" ? goalConfig.target_type : "");

      const isPoints = targetType === "points";
      let sql = `
        SELECT tm.id, tm.name, tm.code, tm.image,
          (SELECT COALESCE(SUM(${isPoints ? "t.points" : "s.value"}), 0)
           FROM submissions s 
           JOIN tasks t ON s.task_id = t.id 
           JOIN users u2 ON s.user_id = u2.id
           WHERE u2.team_id = tm.id 
           AND t.event_id = ? 
           AND s.status = 'approved'
           ${isPoints ? "" : "AND (t.metric_unit = ? OR t.metric_unit = 'km' AND ? = 'km' OR t.metric_unit = 'kcal' AND ? = 'kcal' OR ? = '')"}
          ) as achieved,
          (SELECT COALESCE(SUM(t.points), 0)
           FROM submissions s 
           JOIN tasks t ON s.task_id = t.id 
           JOIN users u2 ON s.user_id = u2.id
           WHERE u2.team_id = tm.id 
           AND t.event_id = ? 
           AND s.status = 'approved'
          ) as points_achieved
        FROM teams tm
        WHERE tm.id IN (SELECT DISTINCT u.team_id FROM registrations r JOIN users u ON r.user_id = u.id WHERE r.event_id = ? AND u.team_id IS NOT NULL)
      `;
      let sqlParams = isPoints
        ? [eventId, eventId, eventId]
        : [eventId, unit, unit, unit, unit, eventId, eventId];

      if (teamId) {
        sql += ` AND tm.id = ?`;
        sqlParams.push(teamId);
      }

      sql += ` ORDER BY achieved DESC`;
      const [rows]: any = await pool.query(sql, sqlParams);

      rows.forEach((r: any) => {
        r.target = targetValue;
        r.target_type = targetType;
        r.achieved = Number(r.achieved) || 0;
        r.percent =
          targetValue > 0
            ? Math.min(100, Math.round((r.achieved / targetValue) * 100))
            : 0;
        r.reached = r.achieved >= targetValue && targetValue > 0;
      });

      if (teamId && rows.length > 0) {
        res.json({
          goal_config: goalConfig,
          progress: rows[0].achieved,
          data: rows[0],
        });
      } else {
        res.json({ goal_config: goalConfig, data: rows });
      }
    }
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── 23. Deep Insights (Advanced Analytics) ────────────────────
router.get("/deep-insights", checkManageAccess, async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  try {
    const [userRows]: any = await pool.query(
      "SELECT role FROM users WHERE id = ?",
      [userId],
    );
    const isAdmin = userRows[0]?.role === "admin";

    // 1. Today's Registrations (Filtered for Host)
    let todayRegQuery = `
      SELECT r.id, u.fname_th, e.title as event_title, r.created_at, u.picture_url
      FROM registrations r
      JOIN users u ON r.user_id = u.id
      JOIN events e ON r.event_id = e.id
      WHERE DATE(r.created_at) = CURDATE()
    `;
    let todayRegParams: any[] = [];

    if (!isAdmin) {
      todayRegQuery += " AND e.created_by = ?";
      todayRegParams.push(userId);
    }

    todayRegQuery += " ORDER BY r.created_at DESC";

    const [todayRegRows]: any = await pool.query(todayRegQuery, todayRegParams);
    const todayRegistrations = todayRegRows.map((r: any) => {
      let name = r.fname_th;
      try {
        name = decrypt(name);
      } catch {}
      return { ...r, fname_th: name };
    });

    // 2. Low Engagement Analysis (Inactive Users) (Filtered for Host)
    let lowEngQuery = `
      SELECT u.id, u.fname_th, u.role, u.birth_date,
        (SELECT COUNT(*) FROM submissions s WHERE s.user_id = u.id AND s.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as sub_count,
        (SELECT bmi FROM tanita WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as latest_bmi
      FROM users u
      WHERE u.role = 'user'
    `;
    let lowEngParams: any[] = [];

    if (!isAdmin) {
      lowEngQuery +=
        " AND u.id IN (SELECT user_id FROM registrations r JOIN events e ON r.event_id = e.id WHERE e.created_by = ?)";
      lowEngParams.push(userId);
    }

    lowEngQuery += " HAVING sub_count < 3 ORDER BY sub_count ASC LIMIT 100";

    const [lowEngRows]: any = await pool.query(lowEngQuery, lowEngParams);

    // Process Low Engagement data for aggregation
    const inactiveBreakdown = {
      byRole: {} as Record<string, number>,
      byAge: {
        "18-24": 0,
        "25-34": 0,
        "35-44": 0,
        "45-54": 0,
        "55+": 0,
      } as Record<string, number>,
      byBmi: { ผอม: 0, ปกติ: 0, ท้วม: 0, อ้วน: 0, อ้วนมาก: 0 } as Record<
        string,
        number
      >,
    };

    lowEngRows.forEach((u: any) => {
      // Role
      inactiveBreakdown.byRole[u.role] =
        (inactiveBreakdown.byRole[u.role] || 0) + 1;

      // Age
      if (u.birth_date) {
        const age =
          new Date().getFullYear() - new Date(u.birth_date).getFullYear();
        if (age < 25) inactiveBreakdown.byAge["18-24"]++;
        else if (age < 35) inactiveBreakdown.byAge["25-34"]++;
        else if (age < 45) inactiveBreakdown.byAge["35-44"]++;
        else if (age < 55) inactiveBreakdown.byAge["45-54"]++;
        else inactiveBreakdown.byAge["55+"]++;
      }

      // BMI
      let bmiVal = u.latest_bmi;
      if (bmiVal) {
        if (typeof bmiVal === "string" && bmiVal.length > 10) {
          try {
            bmiVal = parseFloat(decrypt(bmiVal));
          } catch {}
        } else bmiVal = parseFloat(bmiVal);

        if (bmiVal < 18.5) inactiveBreakdown.byBmi["ผอม"]++;
        else if (bmiVal < 23) inactiveBreakdown.byBmi["ปกติ"]++;
        else if (bmiVal < 25) inactiveBreakdown.byBmi["ท้วม"]++;
        else if (bmiVal < 30) inactiveBreakdown.byBmi["อ้วน"]++;
        else inactiveBreakdown.byBmi["อ้วนมาก"]++;
      }
    });

    // 3. Activity Winners & Goal Achievers (Filtered for Host)
    let eventWinnersQuery =
      "SELECT id, title, goal_config FROM events WHERE (status = 'open' OR end_date >= DATE_SUB(NOW(), INTERVAL 7 DAY))";
    let eventWinnersParams: any[] = [];

    if (!isAdmin) {
      eventWinnersQuery += " AND created_by = ?";
      eventWinnersParams.push(userId);
    }

    const [eventWinnersRows]: any = await pool.query(
      eventWinnersQuery,
      eventWinnersParams,
    );

    const activityWinners = [];
    for (const ev of eventWinnersRows) {
      const gcfg = parseGoalConfig(ev.goal_config);
      const target = Number(gcfg?.target_value) || 0;

      const [winners]: any = await pool.query(
        `
         SELECT u.fname_th, u.picture_url, 
          (SELECT COALESCE(SUM(IFNULL(s.value, 0) + IF(IFNULL(s.value, 0) = 0, IFNULL(t.points, 0), 0)), 0)
           FROM submissions s JOIN tasks t ON s.task_id = t.id 
           WHERE s.user_id = u.id AND t.event_id = ? AND s.status = 'approved') as score
         FROM registrations r JOIN users u ON r.user_id = u.id
         WHERE r.event_id = ?
         ORDER BY score DESC LIMIT 3
      `,
        [ev.id, ev.id],
      );

      const [achievedCount]: any = await pool.query(
        `
        SELECT COUNT(*) as count FROM (
          SELECT u.id, 
            (SELECT COALESCE(SUM(IFNULL(s.value, 0) + IF(IFNULL(s.value, 0) = 0, IFNULL(t.points, 0), 0)), 0)
             FROM submissions s JOIN tasks t ON s.task_id = t.id 
             WHERE s.user_id = u.id AND t.event_id = ? AND s.status = 'approved') as score
          FROM registrations r JOIN users u ON r.user_id = u.id
          WHERE r.event_id = ?
        ) as t WHERE score >= ?
      `,
        [ev.id, ev.id, target],
      );

      activityWinners.push({
        id: ev.id,
        title: ev.title,
        winners: winners.map((w: any) => {
          try {
            w.fname_th = decrypt(w.fname_th);
          } catch {}
          return w;
        }),
        achieved: achievedCount[0].count,
        target: target,
      });
    }

    // 4. Health Breakdown by Age Matrix
    const [healthMatrixRows]: any = await pool.query(`
      SELECT u.birth_date, 
        (SELECT bmi FROM tanita WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as bmi
      FROM users u
      WHERE u.role = 'user'
    `);

    const healthByAge = {
      "วัยรุ่น (<20)": { ผอม: 0, ปกติ: 0, ท้วม: 0, อ้วน: 0, อ้วนมาก: 0 },
      "วัยทำงาน (20-40)": { ผอม: 0, ปกติ: 0, ท้วม: 0, อ้วน: 0, อ้วนมาก: 0 },
      "วัยกลางคน (40-60)": { ผอม: 0, ปกติ: 0, ท้วม: 0, อ้วน: 0, อ้วนมาก: 0 },
      "ผู้สูงอายุ (60+)": { ผอม: 0, ปกติ: 0, ท้วม: 0, อ้วน: 0, อ้วนมาก: 0 },
    } as Record<string, any>;

    healthMatrixRows.forEach((r: any) => {
      if (!r.birth_date || !r.bmi) return;
      const age =
        new Date().getFullYear() - new Date(r.birth_date).getFullYear();
      let group = "ผู้สูงอายุ (60+)";
      if (age < 20) group = "วัยรุ่น (<20)";
      else if (age <= 40) group = "วัยทำงาน (20-40)";
      else if (age <= 60) group = "วัยกลางคน (40-60)";

      let b = r.bmi;
      if (typeof b === "string" && b.length > 10)
        try {
          b = parseFloat(decrypt(b));
        } catch {}
      else b = parseFloat(b);

      if (b < 18.5) healthByAge[group]["ผอม"]++;
      else if (b < 23) healthByAge[group]["ปกติ"]++;
      else if (b < 25) healthByAge[group]["ท้วม"]++;
      else if (b < 30) healthByAge[group]["อ้วน"]++;
      else healthByAge[group]["อ้วนมาก"]++;
    });

    res.json({
      todayRegistrations,
      inactiveAnalysis: inactiveBreakdown,
      activityWinners,
      healthByAge,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── 24. All Users with full profile (User Insights tab) ───────
router.get("/users/all", checkManageAccess, async (req, res) => {
  try {
    // 1. Fetch ALL users with profile fields + team info + activity count (no activity filtering)
    const [userRows]: any = await pool.query(`
      SELECT
        u.id, u.fname_th, u.lname_th, u.gender, u.birth_date, u.role_type,
        u.role_detail_1, u.role_detail_2, u.id_code, u.main_goal,
        u.weight, u.height, u.picture_url, 
        COALESCE(SUM(CASE WHEN s.status = 'approved' THEN t.points ELSE 0 END), 0) AS total_score,
        u.created_at,
        u.team_id AS raw_team_id,
        tm.id AS team_id, tm.name AS team_name, tm.code AS team_code,
        COALESCE(COUNT(DISTINCT r.event_id), 0) AS activity_count,
        COALESCE(COUNT(DISTINCT s.id), 0) AS submission_count
      FROM users u
      LEFT JOIN teams tm ON u.team_id = tm.id
      LEFT JOIN registrations r ON r.user_id = u.id
      LEFT JOIN submissions s ON s.user_id = u.id
      LEFT JOIN tasks t ON s.task_id = t.id
      WHERE u.role IN ('user', 'admin', 'doctor', 'host') 
        AND u.id IS NOT NULL
      GROUP BY u.id, u.team_id, tm.id, tm.name, tm.code
      ORDER BY total_score DESC, u.id ASC
    `);

    // 2. For each user, get their registered activities + submissions
    const userIds: number[] = userRows.map((u: any) => u.id);

    // Batch-fetch registered activities for all users
    let registrationsMap: Record<number, any[]> = {};
    let submissionsMap: Record<number, any[]> = {};
    let monthlyArrayMap: Record<number, any[]> = {};

    if (userIds.length > 0) {
      const [regRows]: any = await pool.query(
        `
        SELECT
          r.user_id,
          e.id AS event_id, e.title AS event_title, e.start_date, e.end_date,
          u.team_id,
          tm.name AS team_name
        FROM registrations r
        JOIN events e ON r.event_id = e.id
        JOIN users u ON r.user_id = u.id
        LEFT JOIN teams tm ON u.team_id = tm.id
        WHERE r.user_id IN (?)
        ORDER BY e.start_date DESC
      `,
        [userIds],
      );

      regRows.forEach((row: any) => {
        if (!registrationsMap[row.user_id]) registrationsMap[row.user_id] = [];
        registrationsMap[row.user_id].push({
          id: row.event_id,
          title: row.event_title,
          start_date: row.start_date,
          end_date: row.end_date,
          team_id: row.team_id,
          team_name: row.team_name,
          registration_type: row.team_id ? "team" : "individual",
        });
      });

      // Batch-fetch submissions (last 100 per user to avoid huge response)
      const [subRows]: any = await pool.query(
        `
        SELECT
          s.user_id, s.id AS sub_id, s.task_id, s.status,
          s.value, s.created_at,
          t.note AS task_name, t.metric_unit, t.points, t.type AS task_type,
          e.title AS activity_title, e.id AS event_id
        FROM submissions s
        JOIN tasks t ON s.task_id = t.id
        JOIN events e ON t.event_id = e.id
        WHERE s.user_id IN (?)
        ORDER BY s.created_at DESC
      `,
        [userIds],
      );

      // Group submissions by user_id, then by date and also by month
      const subByUserDate: Record<number, Record<string, any[]>> = {};
      const monthlySummaryMap: Record<number, Record<string, any>> = {};

      subRows.forEach((s: any) => {
        if (!subByUserDate[s.user_id]) subByUserDate[s.user_id] = {};
        if (!monthlySummaryMap[s.user_id]) monthlySummaryMap[s.user_id] = {};

        const dDate = new Date(s.created_at);
        const dateKey = dDate.toISOString().slice(0, 10);

        // Month key (e.g. มีนาคม 2567)
        const dMonth = dDate.toLocaleDateString("th-TH", { month: "long" });
        const dYear = dDate.getFullYear() + 543;
        const monthKey = `${dMonth} ${dYear}`;

        // Daily Progress
        if (!subByUserDate[s.user_id][dateKey])
          subByUserDate[s.user_id][dateKey] = [];
        subByUserDate[s.user_id][dateKey].push({
          sub_id: s.sub_id,
          task_id: s.task_id,
          task_name: s.task_name || s.task_type || "ภารกิจ",
          task_type: s.task_type,
          metric_unit: s.metric_unit,
          points: s.points,
          status: s.status,
          value: s.value,
          time: dDate.toLocaleTimeString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          created_at: s.created_at,
          activity_title: s.activity_title,
          event_id: s.event_id,
        });

        // Monthly Summary
        if (!monthlySummaryMap[s.user_id][monthKey]) {
          monthlySummaryMap[s.user_id][monthKey] = {
            month: monthKey,
            rawDate: dDate, // for sorting
            total_submissions: 0,
            approved_submissions: 0,
            participation_percent: 0, // Mocked dynamically later if needed
            activitiesMap: {},
          };
        }
        const ms = monthlySummaryMap[s.user_id][monthKey];
        ms.total_submissions++;
        if (s.status === "approved") ms.approved_submissions++;

        const aTitle = s.activity_title || "ภารกิจทั่วไป";
        if (!ms.activitiesMap[aTitle])
          ms.activitiesMap[aTitle] = { title: aTitle, count: 0 };
        ms.activitiesMap[aTitle].count++;
      });

      // Convert to array
      Object.keys(subByUserDate).forEach((userId: any) => {
        submissionsMap[userId] = Object.entries(subByUserDate[userId])
          .map(([date, submissions]) => ({ date, submissions }))
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 30); // last 30 days

        if (monthlySummaryMap[userId]) {
          monthlyArrayMap[userId] = Object.values(monthlySummaryMap[userId])
            .sort((a: any, b: any) => b.rawDate.getTime() - a.rawDate.getTime())
            .map((m: any) => ({
              month: m.month,
              total_submissions: m.total_submissions,
              approved_submissions: m.approved_submissions,
              // calculate participation as approved/total * 100
              participation_percent:
                m.total_submissions > 0
                  ? Math.round(
                      (m.approved_submissions / m.total_submissions) * 100,
                    )
                  : 0,
              activities: Object.values(m.activitiesMap),
            }));
        }
      });
    }

    // Fetch latest Tanita BMI for these users
    let tanitaBmiMap: Record<number, number> = {};
    if (userIds.length > 0) {
      const [latestTanita]: any = await pool.query(
        `
        SELECT t1.user_id, t1.bmi 
        FROM tanita t1
        INNER JOIN (
          SELECT user_id, MAX(id) as max_id FROM tanita GROUP BY user_id
        ) t2 ON t1.id = t2.max_id
        WHERE t1.user_id IN (?)
      `,
        [userIds],
      );

      latestTanita.forEach((r: any) => {
        let b = r.bmi;
        if (typeof b === "string" && b.length > 10) {
          try {
            b = parseFloat(decrypt(b));
          } catch {}
        } else {
          b = parseFloat(b);
        }
        tanitaBmiMap[r.user_id] = b;
      });
    }

    // 3. Decrypt & compute derived fields
    const result = userRows.map((u: any) => {
      let fname = u.fname_th || "";
      let lname = u.lname_th || "";
      let idCode = u.id_code || "";
      let weight = u.weight || "";
      let height = u.height || "";
      let roleDetail1 = u.role_detail_1 || "";
      let mainGoal = u.main_goal || "";
      let gender = u.gender || "";
      let birthDate = u.birth_date || "";

      try {
        fname = decrypt(fname) || fname;
      } catch {}
      try {
        lname = decrypt(lname) || lname;
      } catch {}
      try {
        idCode = decrypt(idCode) || idCode;
      } catch {}
      try {
        weight = decrypt(weight) || weight;
      } catch {}
      try {
        height = decrypt(height) || height;
      } catch {}
      try {
        roleDetail1 = decrypt(roleDetail1) || roleDetail1;
      } catch {}
      try {
        mainGoal = decrypt(mainGoal) || mainGoal;
      } catch {}
      try {
        gender = decrypt(gender) || gender;
      } catch {}
      try {
        birthDate = decrypt(birthDate) || birthDate;
      } catch {}

      // Calculate age
      let age: number | null = null;
      if (birthDate) {
        const bd = new Date(birthDate);
        if (!isNaN(bd.getTime())) {
          const today = new Date();
          age = today.getFullYear() - bd.getFullYear();
          const m = today.getMonth() - bd.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
        }
      }

      // Calculate BMI
      let bmi: number | null = null;
      let bmi_category: string | null = null;

      const tbmi = tanitaBmiMap[u.id];
      if (tbmi && tbmi > 0) {
        bmi = Math.round(tbmi * 10) / 10;
      } else {
        const w = parseFloat(weight);
        const h = parseFloat(height) / 100;
        if (w > 0 && h > 0) {
          bmi = Math.round((w / (h * h)) * 10) / 10;
        }
      }

      if (bmi) {
        if (bmi < 18.5) bmi_category = "ผอม";
        else if (bmi < 23) bmi_category = "ปกติ";
        else if (bmi < 25) bmi_category = "ท้วม";
        else if (bmi < 30) bmi_category = "อ้วน";
        else bmi_category = "อ้วนมาก";
      }

      // Age group
      let age_group: string | null = null;
      if (age !== null) {
        if (age < 18) age_group = "ต่ำกว่า 18";
        else if (age < 25) age_group = "18–24";
        else if (age < 35) age_group = "25–34";
        else if (age < 45) age_group = "35–44";
        else if (age < 60) age_group = "45–59";
        else age_group = "60+";
      }

      const registered_activities = registrationsMap[u.id] || [];
      const daily_progress = submissionsMap[u.id] || [];
      const monthly_summary = monthlyArrayMap[u.id] || [];

      // Determine primary registration_type: if in any team activity → 'team' else 'individual'
      const hasTeamReg = registered_activities.some(
        (a: any) => a.registration_type === "team",
      );

      return {
        id: u.id,
        fname_th: fname,
        lname_th: lname,
        gender: gender,
        birth_date: birthDate,
        created_at: u.created_at,
        age,
        age_group,
        role: u.role_type || "บุคคลทั่วไป",
        role_detail_1: roleDetail1,
        role_detail_2: u.role_detail_2,
        id_code: idCode,
        main_goal: mainGoal,
        weight: weight,
        height: height,
        bmi,
        bmi_category,
        picture_url: u.picture_url,
        points: u.total_score || 0,
        team_id: u.raw_team_id || u.team_id || null,
        team_name: u.team_name,
        team_code: u.team_code,
        activity_count: Number(u.activity_count),
        submission_count: Number(u.submission_count),
        registration_type: hasTeamReg ? "team" : "individual",
        registered_activities,
        daily_progress,
        monthly_summary,
      };
    });

    res.json(result);
  } catch (error: any) {
    console.error("Stats users/all error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── 25. Activities overview with team/individual breakdown ─────
router.get("/activities/overview", checkManageAccess, async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  try {
    const [userRows]: any = await pool.query(
      "SELECT role FROM users WHERE id = ?",
      [userId],
    );
    const isAdmin = userRows[0]?.role === "admin";

    const eventFilter = isAdmin
      ? ""
      : `WHERE e.created_by = ${pool.escape(userId)}`;

    const [events]: any = await pool.query(`
      SELECT e.id, e.title, e.start_date, e.end_date, e.status,
        COUNT(DISTINCT r.user_id) AS total_participants
      FROM events e
      LEFT JOIN registrations r ON r.event_id = e.id
      ${eventFilter}
      GROUP BY e.id
      ORDER BY e.start_date DESC
    `);

    const result = [];

    for (const evt of events) {
      // Individual registrations (users not in any team for this event)
      const [individualRows]: any = await pool.query(
        `
        SELECT u.id, u.fname_th, u.lname_th, u.picture_url, u.gender, u.role_type,
          u.birth_date, u.weight, u.height,
          COALESCE(SUM(CASE WHEN s.status = 'approved' THEN 1 ELSE 0 END), 0) AS approved_count,
          COALESCE(SUM(CASE WHEN s.status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_count,
          COALESCE(SUM(CASE WHEN s.status = 'rejected' THEN 1 ELSE 0 END), 0) AS rejected_count,
          COALESCE(SUM(CASE WHEN s.status = 'approved' THEN t.points ELSE 0 END), 0) AS points
        FROM registrations r
        JOIN users u ON r.user_id = u.id
        LEFT JOIN submissions s ON s.user_id = u.id AND s.task_id IN (SELECT id FROM tasks WHERE event_id = ?)
        LEFT JOIN tasks t ON s.task_id = t.id
        WHERE r.event_id = ? AND u.team_id IS NULL
        GROUP BY u.id
        ORDER BY approved_count DESC
      `,
        [evt.id, evt.id],
      );

      // Teams registered to this event (via members)
      const [teamRows]: any = await pool.query(
        `
        SELECT DISTINCT tm.id, tm.name, tm.code, tm.image,
          COUNT(DISTINCT u.id) AS member_count
        FROM registrations r
        JOIN users u ON r.user_id = u.id
        JOIN teams tm ON u.team_id = tm.id
        WHERE r.event_id = ?
        GROUP BY tm.id
        ORDER BY tm.name ASC
      `,
        [evt.id],
      );

      // For each team, get members with submission stats
      const teamsWithMembers = [];
      for (const tm of teamRows) {
        const [members]: any = await pool.query(
          `
          SELECT u.id, u.fname_th, u.lname_th, u.picture_url, u.gender, u.role_type,
            COALESCE(SUM(CASE WHEN s.status = 'approved' THEN 1 ELSE 0 END), 0) AS approved_count,
            COALESCE(SUM(CASE WHEN s.status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_count,
            COALESCE(SUM(CASE WHEN s.status = 'rejected' THEN 1 ELSE 0 END), 0) AS rejected_count,
            COALESCE(SUM(CASE WHEN s.status = 'approved' THEN t.points ELSE 0 END), 0) AS points
          FROM users u
          JOIN registrations r ON r.user_id = u.id AND r.event_id = ?
          LEFT JOIN submissions s ON s.user_id = u.id AND s.task_id IN (SELECT id FROM tasks WHERE event_id = ?)
          LEFT JOIN tasks t ON s.task_id = t.id
          WHERE u.team_id = ?
          GROUP BY u.id
          ORDER BY approved_count DESC
        `,
          [evt.id, evt.id, tm.id],
        );

        // Get per-member submission details
        const membersDecrypted = [];
        for (const m of members) {
          let fname = m.fname_th || "";
          let lname = m.lname_th || "";
          try {
            fname = decrypt(fname);
          } catch {}
          try {
            lname = decrypt(lname);
          } catch {}

          const [subs]: any = await pool.query(
            `
            SELECT s.id, s.status, s.value, s.created_at,
              t.note AS task_name, t.metric_unit, t.points, t.type AS task_type
            FROM submissions s
            JOIN tasks t ON s.task_id = t.id
            WHERE s.user_id = ? AND t.event_id = ?
            ORDER BY s.created_at DESC
          `,
            [m.id, evt.id],
          );

          membersDecrypted.push({
            ...m,
            fname_th: fname,
            lname_th: lname,
            submissions: subs.map((s: any) => ({
              ...s,
              task_name: s.task_name || s.task_type || "ภารกิจ",
              time: new Date(s.created_at).toLocaleTimeString("th-TH", {
                hour: "2-digit",
                minute: "2-digit",
              }),
              date: new Date(s.created_at).toISOString().slice(0, 10),
            })),
          });
        }

        // Team total points & submission counts
        const teamTotalPoints = membersDecrypted.reduce(
          (a: number, m: any) => a + (m.points || 0),
          0,
        );
        const teamTotalApproved = membersDecrypted.reduce(
          (a: number, m: any) => a + (m.approved_count || 0),
          0,
        );

        teamsWithMembers.push({
          id: tm.id,
          name: tm.name,
          code: tm.code,
          image: tm.image,
          member_count: membersDecrypted.length,
          total_points: teamTotalPoints,
          total_approved: teamTotalApproved,
          members: membersDecrypted,
        });
      }

      // Decrypt individual list
      const individualsDecrypted = individualRows.map((u: any) => {
        let fname = u.fname_th || "";
        let lname = u.lname_th || "";
        try {
          fname = decrypt(fname);
        } catch {}
        try {
          lname = decrypt(lname);
        } catch {}
        return { ...u, fname_th: fname, lname_th: lname };
      });

      result.push({
        id: evt.id,
        title: evt.title,
        start_date: evt.start_date,
        end_date: evt.end_date,
        status: evt.status,
        total_participants: evt.total_participants,
        individual_count: individualsDecrypted.length,
        team_count: teamsWithMembers.length,
        individuals: individualsDecrypted,
        teams: teamsWithMembers,
      });
    }

    res.json(result);
  } catch (error: any) {
    console.error("Stats activities/overview error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── 26. Tanita Insights ──────────────────────────────────────────
router.get("/tanita-insights", checkManageAccess, async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  try {
    const [userRows]: any = await pool.query(
      "SELECT role FROM users WHERE id = ?",
      [userId],
    );
    const isAdmin = userRows[0]?.role === "admin";

    // Get all users
    const [users]: any = await pool.query(`
      SELECT u.id, u.fname_th, u.lname_th, u.nickname, u.picture_url, u.role_type, u.gender, u.birth_date, t.name as team_name
      FROM users u
      LEFT JOIN teams t ON u.team_id = t.id
      WHERE u.role IN ('user', 'admin', 'doctor', 'host')
    `);

    // Get event duration for each event a user is registered for (min start to max end)
    const [eventDaysRows]: any = await pool.query(`
      SELECT r.user_id, 
             DATEDIFF(LEAST(CURDATE(), MAX(DATE(e.end_date))), MIN(DATE(e.start_date))) + 1 as total_event_days
      FROM registrations r
      JOIN events e ON r.event_id = e.id
      WHERE e.start_date IS NOT NULL AND e.end_date IS NOT NULL
      GROUP BY r.user_id
    `);
    const eventDaysMap = Object.fromEntries(
      eventDaysRows.map((r: any) => [r.user_id, Number(r.total_event_days)]),
    );

    // Get active days (number of distinct days with an approved submission)
    const [activeDaysRows]: any = await pool.query(`
      SELECT user_id, COUNT(DISTINCT DATE(created_at)) as active_days
      FROM submissions
      WHERE status = 'approved'
      GROUP BY user_id
    `);
    const activeDaysMap = Object.fromEntries(
      activeDaysRows.map((r: any) => [r.user_id, Number(r.active_days)]),
    );

    // Get all tanita records ordered by recorded_at
    const [allTanita]: any = await pool.query(
      `SELECT * FROM tanita ORDER BY recorded_at ASC`,
    );

    // Group tanita by user
    const tanitaMap = new Map<number, any[]>();
    for (const record of allTanita) {
      const uId = record.user_id;
      if (!tanitaMap.has(uId)) tanitaMap.set(uId, []);
      tanitaMap.get(uId)!.push(record);
    }

    const result = users.map((u: any) => {
      let fname = u.fname_th || "";
      let lname = u.lname_th || "";
      try {
        fname = decrypt(fname);
      } catch {}
      try {
        lname = decrypt(lname);
      } catch {}

      const userTanita = tanitaMap.get(u.id) || [];
      let firstTanita = null;
      let latestTanita = null;

      if (userTanita.length > 0) {
        firstTanita = decryptFields(userTanita[0], TANITA_ENCRYPTED_FIELDS);
        latestTanita = decryptFields(
          userTanita[userTanita.length - 1],
          TANITA_ENCRYPTED_FIELDS,
        );
      }

      const totalDays = eventDaysMap[u.id] || 0;
      const activeDays = activeDaysMap[u.id] || 0;
      let participationPct = 0;
      if (totalDays > 0) {
        participationPct = Math.min(
          100,
          Math.round((activeDays / Math.max(1, totalDays)) * 100),
        );
      } else if (activeDays > 0) {
        participationPct = 100;
      }

      return {
        id: u.id,
        fname_th: fname,
        lname_th: lname,
        nickname: u.nickname,
        picture_url: u.picture_url,
        role_type: u.role_type || "ทั่วไป",
        gender: u.gender,
        birth_date: u.birth_date,
        team_name: u.team_name,
        participation_pct: participationPct,
        active_days: activeDays,
        total_event_days: totalDays,
        first_tanita: firstTanita,
        latest_tanita: latestTanita,
        has_tanita_change: userTanita.length > 1,
      };
    });

    res.json(result);
  } catch (error: any) {
    console.error("Stats tanita-insights error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── 27. Inactive Streak — users who missed N consecutive days ─────
router.get("/users/inactive-streak", checkManageAccess, async (req, res) => {
  const days = Math.max(1, parseInt(req.query.days as string) || 3);
  try {
    // Get all users who have registered for at least 1 event
    const [regUsers]: any = await pool.query(`
      SELECT DISTINCT u.id, u.fname_th, u.lname_th, u.picture_url, u.role_type, u.created_at,
        t.name AS team_name,
        (SELECT MAX(s.created_at) FROM submissions s WHERE s.user_id = u.id) AS last_submission_at,
        (SELECT COUNT(DISTINCT e2.id) FROM registrations r2 JOIN events e2 ON r2.event_id = e2.id 
         WHERE r2.user_id = u.id AND (e2.status = 'open' OR e2.status IS NULL) AND (DATE(e2.end_date) >= CURDATE() OR e2.is_continuous_event = 1 OR e2.end_date IS NULL)) AS active_event_count
      FROM users u
      JOIN registrations r ON r.user_id = u.id
      JOIN events e ON r.event_id = e.id
      LEFT JOIN teams t ON u.team_id = t.id
      WHERE u.role = 'user'
        AND (e.status = 'open' OR e.status IS NULL)
        AND (DATE(e.end_date) >= CURDATE() OR e.is_continuous_event = 1 OR e.end_date IS NULL)
      GROUP BY u.id
    `);

    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - days);

    const result = regUsers
      .filter((u: any) => {
        // Use last_submission_at if available, otherwise fallback to created_at
        const referenceDate = u.last_submission_at
          ? new Date(u.last_submission_at)
          : new Date(u.created_at);
        return referenceDate < cutoff;
      })
      .map((u: any) => {
        let fname = u.fname_th || "";
        let lname = u.lname_th || "";
        try {
          fname = decrypt(fname);
        } catch {}
        try {
          lname = decrypt(lname);
        } catch {}

        const referenceDate = u.last_submission_at
          ? new Date(u.last_submission_at)
          : new Date(u.created_at);
        const today = new Date();
        const missedDays = Math.max(
          0,
          Math.floor((today.getTime() - referenceDate.getTime()) / 86400000),
        );

        return {
          id: u.id,
          fname_th: fname,
          lname_th: lname,
          picture_url: u.picture_url,
          role_type: u.role_type,
          team_name: u.team_name,
          last_submission_at: u.last_submission_at,
          missed_days: Math.min(missedDays, 999),
          active_event_count: Number(u.active_event_count),
        };
      })
      .sort((a: any, b: any) => b.missed_days - a.missed_days)
      .slice(0, 100);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
