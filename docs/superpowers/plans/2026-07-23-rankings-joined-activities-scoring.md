# Rankings joined-activities + per-activity streak scoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the Rankings page, list only the user's joined activities (no "overall"), fold the config-driven streak bonus into each user's per-activity score, show the activity goal in the same row, and make submission-history rows open a full-image lightbox.

**Architecture:** A pure helper module (`streakScoring.ts`) holds the streak-length and tier-bonus math so it is unit-testable without a DB. `scoring.ts` exposes `getStreakBonus()` on top of it. `stats.ts` gains one `computeActivityLeaderboard()` helper that both the list and the rank endpoints derive from, guaranteeing the displayed combined score and the computed rank agree. The frontend swaps its activity source to the user's registrations and renders goal + score together.

**Tech Stack:** Node + Express + mysql2 (backend), Vue 3 `<script setup>` + composables (frontend), plain `tsx` + `node:assert/strict` tests (matching `scripts/*.test.ts`).

**Reference spec:** `docs/superpowers/specs/2026-07-23-rankings-joined-activities-scoring-design.md`

**Testing note:** This repo has **no** DB-backed or component test harness — existing tests (`scripts/*.test.ts`) only cover pure library functions, run via `tsx`. Therefore: pure helpers get real unit tests; DB-integration and UI changes are verified with `npm run lint` (vue-tsc typecheck) plus the browser preview. Do not invent a test runner.

---

## File Structure

- **Create** `server/lib/streakScoring.ts` — pure: `pickStreakBonus(tiers, streak)`, `computeStreakFromDates(dates, now?)`, `DAILY_MISSION_DEFAULT_TIERS`.
- **Create** `scripts/streak-scoring.test.ts` — pure unit tests for the above.
- **Modify** `server/lib/scoring.ts` — import defaults + `pickStreakBonus`/`computeStreakFromDates` from `streakScoring`; add exported `getStreakBonus(streak)`; refactor `computeStreak` to reuse `computeStreakFromDates`.
- **Modify** `server/routes/stats.ts` — add `computeActivityLeaderboard()`; wire `/rankings/individual`, `/rankings/team`, `/individual/rank/:id`, `/team/rank/:teamId` (activity branch) to it; add per-row `target`/`target_type`/`achieved`/`reached`.
- **Modify** `server/routes/user.ts` — add `r.created_at AS joined_at` to `/:userId/registrations`.
- **Modify** `src/composables/useRankings.ts` — joined-activities source, remove overall, default-select newest join, expose target helpers + `hasJoinedActivities`.
- **Modify** `src/views/Rankings.vue` — remove overall dropdown item, add goal-in-row, empty state.
- **Modify** `src/components/SubmissionModal.vue` — clickable rows → image lightbox.
- **Modify** `src/store/lang.ts` — add `rank_goal_col`, `rank_no_joined`, `rank_no_joined_cta`, `goal_reached` (TH + EN).

---

## Task 1: Pure streak-scoring helpers

**Files:**

- Create: `server/lib/streakScoring.ts`
- Test: `scripts/streak-scoring.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/streak-scoring.test.ts`:

```ts
import assert from "node:assert/strict";
import {
  pickStreakBonus,
  computeStreakFromDates,
  DAILY_MISSION_DEFAULT_TIERS,
} from "../server/lib/streakScoring";

// ── pickStreakBonus ──────────────────────────────────────────────
const tiers = [
  { minStreak: 3, bonus: 5 },
  { minStreak: 7, bonus: 15 },
  { minStreak: 30, bonus: 50 },
];
assert.equal(pickStreakBonus(tiers, 0), 0, "below lowest tier → 0");
assert.equal(pickStreakBonus(tiers, 2), 0, "just below lowest tier → 0");
assert.equal(pickStreakBonus(tiers, 3), 5, "at lowest tier");
assert.equal(pickStreakBonus(tiers, 6), 5, "between tiers takes lower");
assert.equal(pickStreakBonus(tiers, 7), 15, "at middle tier");
assert.equal(pickStreakBonus(tiers, 100), 50, "above highest → highest");
assert.equal(pickStreakBonus([], 10), 0, "no tiers → 0");
assert.equal(
  pickStreakBonus(DAILY_MISSION_DEFAULT_TIERS, 7),
  15,
  "defaults expose the standard tiers",
);

// ── computeStreakFromDates ───────────────────────────────────────
const now = new Date("2026-07-23T10:00:00");
// Anchored today, 3 consecutive days.
assert.equal(
  computeStreakFromDates(["2026-07-23", "2026-07-22", "2026-07-21"], now),
  3,
);
// Anchored yesterday still counts.
assert.equal(computeStreakFromDates(["2026-07-22", "2026-07-21"], now), 2);
// Gap breaks the streak.
assert.equal(
  computeStreakFromDates(["2026-07-23", "2026-07-21", "2026-07-20"], now),
  1,
);
// Latest older than yesterday → 0.
assert.equal(computeStreakFromDates(["2026-07-20"], now), 0);
// Empty → 0.
assert.equal(computeStreakFromDates([], now), 0);
// Unsorted input is handled (sorts internally).
assert.equal(
  computeStreakFromDates(["2026-07-21", "2026-07-23", "2026-07-22"], now),
  3,
);
// Duplicate dates don't inflate the streak.
assert.equal(
  computeStreakFromDates(["2026-07-23", "2026-07-23", "2026-07-22"], now),
  2,
);

console.log("streak-scoring.test.ts OK");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx scripts/streak-scoring.test.ts`
Expected: FAIL — `Cannot find module '../server/lib/streakScoring'`.

- [ ] **Step 3: Write the implementation**

Create `server/lib/streakScoring.ts`:

```ts
// Pure streak-scoring math. NO database imports — kept dependency-free so it is
// unit-testable via tsx (see scripts/streak-scoring.test.ts) and shared by
// scoring.ts (awarding) and stats.ts (leaderboard display).

export interface StreakTier {
  minStreak: number;
  bonus: number;
}

// Mirrors DEFAULTS.daily_mission.streakTiers in scoring.ts; single source here.
export const DAILY_MISSION_DEFAULT_TIERS: StreakTier[] = [
  { minStreak: 3, bonus: 5 },
  { minStreak: 7, bonus: 15 },
  { minStreak: 30, bonus: 50 },
];

/** Highest tier bonus whose minStreak <= streak, else 0. */
export function pickStreakBonus(tiers: StreakTier[], streak: number): number {
  let bonus = 0;
  for (const tier of tiers || []) {
    if (streak >= tier.minStreak) bonus = Math.max(bonus, tier.bonus);
  }
  return bonus;
}

/**
 * Length of the run of consecutive calendar days ending today or yesterday.
 * `dates` are 'YYYY-MM-DD' strings (any order, duplicates tolerated).
 */
export function computeStreakFromDates(
  dates: string[],
  now: Date = new Date(),
): number {
  const uniq = Array.from(new Set(dates.filter(Boolean)));
  if (uniq.length === 0) return 0;
  // Newest first.
  uniq.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const atMidnight = (s: string) => {
    const d = new Date(s);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  let latest = atMidnight(uniq[0]);
  if (
    latest.getTime() !== today.getTime() &&
    latest.getTime() !== yesterday.getTime()
  ) {
    return 0;
  }

  let streak = 1;
  let current = latest;
  for (let i = 1; i < uniq.length; i++) {
    const next = atMidnight(uniq[i]);
    const diff = Math.round((current.getTime() - next.getTime()) / 86400000);
    if (diff === 1) {
      streak++;
      current = next;
    } else if (diff === 0) {
      continue;
    } else {
      break;
    }
  }
  return streak;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx scripts/streak-scoring.test.ts`
Expected: PASS — prints `streak-scoring.test.ts OK`.

- [ ] **Step 5: Commit**

```bash
git add server/lib/streakScoring.ts scripts/streak-scoring.test.ts
git commit -m "feat(scoring): add pure streak-scoring helpers with tests"
```

---

## Task 2: `getStreakBonus` + refactor `scoring.ts` onto shared helpers

**Files:**

- Modify: `server/lib/scoring.ts`

This task has no new unit test (it depends on `loadScoringConfig()`, which hits the DB). Correctness of the math is already covered by Task 1; here we only wire it up. Verification is via typecheck.

- [ ] **Step 1: Import the shared helpers**

At the top of `server/lib/scoring.ts`, below the existing imports, add:

```ts
import {
  pickStreakBonus,
  computeStreakFromDates,
  DAILY_MISSION_DEFAULT_TIERS,
} from "./streakScoring.js";
```

- [ ] **Step 2: Use the shared default tiers in DEFAULTS**

In the `DEFAULTS` object, replace the inline `daily_mission.streakTiers` array with the shared constant so there is one source of truth:

```ts
  daily_mission: {
    basePoints: 5,
    streakTiers: DAILY_MISSION_DEFAULT_TIERS,
  } as DailyMissionCfg,
```

- [ ] **Step 3: Refactor `computeStreak` to reuse the pure helper**

Replace the body of the existing `async function computeStreak(userId: number)` so it only does the DB fetch and delegates the date math:

```ts
async function computeStreak(userId: number): Promise<number> {
  const [rows]: any = await pool.query(
    `SELECT DATE(created_at) AS d FROM submissions
      WHERE user_id = ? AND status = 'approved'
      GROUP BY DATE(created_at) ORDER BY d DESC LIMIT 400`,
    [userId],
  );
  const dates: string[] = rows.map((r: any) => String(r.d));
  return computeStreakFromDates(dates);
}
```

- [ ] **Step 4: Add the exported `getStreakBonus`**

After `invalidateScoringCache()` (near the top-level exports), add:

```ts
/**
 * Highest daily_mission streak-tier bonus for a given streak length, using the
 * admin-configured tiers (master_configs) with a safe fallback to DEFAULTS.
 * Used by the rankings leaderboard to display a per-activity streak bonus.
 */
export async function getStreakBonus(streak: number): Promise<number> {
  try {
    const map = await loadScoringConfig();
    const c = cfg<DailyMissionCfg>(map, "daily_mission");
    return pickStreakBonus(
      c.streakTiers || DAILY_MISSION_DEFAULT_TIERS,
      streak,
    );
  } catch {
    return pickStreakBonus(DAILY_MISSION_DEFAULT_TIERS, streak);
  }
}
```

- [ ] **Step 5: Update `awardDailyMission` to reuse `pickStreakBonus`**

In `awardDailyMission`, replace the manual tier loop:

```ts
let bonus = 0;
for (const tier of c.streakTiers || []) {
  if (streak >= tier.minStreak) bonus = Math.max(bonus, tier.bonus);
}
```

with:

```ts
const bonus = pickStreakBonus(c.streakTiers || [], streak);
```

- [ ] **Step 6: Typecheck**

Run: `npm run lint`
Expected: PASS (no new TypeScript errors from `server/lib/scoring.ts`).

- [ ] **Step 7: Commit**

```bash
git add server/lib/scoring.ts
git commit -m "refactor(scoring): expose getStreakBonus and share streak math"
```

---

## Task 3: `computeActivityLeaderboard` helper in `stats.ts`

**Files:**

- Modify: `server/routes/stats.ts`

Adds the centralized per-activity leaderboard computation. No unit test (DB-dependent); verified by typecheck here and by the endpoint behavior in Tasks 4–5 (manual/browser).

- [ ] **Step 1: Import the streak helper and getStreakBonus**

At the top of `server/routes/stats.ts`, add to the imports:

```ts
import { computeStreakFromDates } from "../lib/streakScoring.js";
import { getStreakBonus } from "../lib/scoring.js";
```

- [ ] **Step 2: Add the helper**

Add this function near the other module-scope helpers (after `checkManageAccess`), before the routes:

```ts
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
```

- [ ] **Step 3: Typecheck**

Run: `npm run lint`
Expected: PASS (no new errors). If `express` isn't already imported as a namespace in this file it is — the file already uses `express.Request` types.

- [ ] **Step 4: Commit**

```bash
git add server/routes/stats.ts
git commit -m "feat(stats): add computeActivityLeaderboard helper"
```

---

## Task 4: Wire the individual list + rank endpoints to the helper

**Files:**

- Modify: `server/routes/stats.ts`

- [ ] **Step 1: Use the helper in `/rankings/:type` for the individual + activity branch**

In `router.get("/rankings/:type", ...)`, at the very top of the handler (after reading `page`/`limit`/`offset`), add an early path for the activity+individual case so it derives from the helper:

```ts
const activityId = req.query.activity_id;
if (activityId && type === "individual") {
  const { rows, isPoints, metricUnit } = await computeActivityLeaderboard(
    activityId,
    req,
  );
  // Goal target for per-row display.
  const [evRows]: any = await pool.query(
    "SELECT goal_config FROM events WHERE id = ?",
    [activityId],
  );
  const gc = evRows.length ? parseGoalConfig(evRows[0].goal_config) : {};
  const target = Number(gc?.target_value) || 0;
  const targetType = normalizeUnit(gc?.target_type || "points");
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;
  const slice = rows.slice(offset, offset + limit).map((r) => {
    const achieved = isPoints ? r.total_points : r.total_unit_value;
    return {
      ...r,
      target,
      target_type: targetType,
      metric_unit: metricUnit,
      achieved,
      reached: target > 0 && achieved >= target,
    };
  });
  return res.json(slice);
}
```

> Note: this sits above the existing `try { let query = ""; ... }` block, which continues to serve the team branch and the no-activity branch unchanged. Remove the now-duplicate `const activityId = req.query.activity_id;` line inside the old `try` block if it causes a redeclare error — keep the one you just added by moving it out, or rename. Simplest: delete the inner `const activityId = req.query.activity_id;` and rely on the outer one (widen its scope by declaring it before the `if`).

- [ ] **Step 2: Rewrite `/individual/rank/:id` activity branch to derive from the helper**

In `router.get("/individual/rank/:id", ...)`, replace the entire `if (eventId) { ... }` block body with a derivation from the same ordered list:

```ts
if (eventId) {
  const { rows, isPoints } = await computeActivityLeaderboard(eventId, req);
  const idx = rows.findIndex((r) => String(r.id) === String(id));
  if (idx === -1) {
    return res.json({ rank: 0, score: 0, points: 0 });
  }
  const row = rows[idx];
  return res.json({
    rank: idx + 1,
    score: isPoints ? row.total_points : row.total_unit_value,
    points: row.total_points,
  });
}
```

Leave the `else` (global rank) branch unchanged.

- [ ] **Step 3: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Manual verification (DB required)**

Start the app preview (dev server `name` from `.claude/launch.json`, or create one running `npm run dev` on port 5001). With a logged-in user who has joined a point-based activity and has an active streak:

- `GET /api/stats/rankings/individual?activity_id=<id>` → each row's `total_points` equals `base_points + streak_bonus`; `streak_bonus > 0` only when streak ≥ lowest configured tier.
- `GET /api/stats/individual/rank/<userId>?activity_id=<id>` → `rank` equals that user's 1-based position in the list above (consistency invariant).
- For a unit-based activity (e.g. กม.): `streak_bonus` is 0 and ordering follows `total_unit_value`.

Record the two payloads in the task notes as evidence.

- [ ] **Step 5: Commit**

```bash
git add server/routes/stats.ts
git commit -m "feat(stats): individual list+rank derive from combined leaderboard"
```

---

## Task 5: Team endpoints use combined per-member scores

**Files:**

- Modify: `server/routes/stats.ts`

Team combined score = Σ members' combined per-activity scores, derived from the same helper.

- [ ] **Step 1: Add a team aggregation helper**

Below `computeActivityLeaderboard`, add:

```ts
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
```

- [ ] **Step 2: Serve the team+activity list from the aggregation**

In `router.get("/rankings/:type", ...)`, add a second early path (next to the individual one from Task 4), for `activityId && type === "team"`:

```ts
if (activityId && type === "team") {
  const { rows, isPoints } = await computeActivityLeaderboard(activityId, req);
  const teams = aggregateTeams(rows, isPoints);
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;
  const slice = teams.slice(offset, offset + limit);
  if (slice.length === 0) return res.json([]);
  const ids = slice.map((t) => t.id);
  const [teamMeta]: any = await pool.query(
    `SELECT id, name, code, image FROM teams WHERE id IN (?)`,
    [ids],
  );
  const metaById: Record<number, any> = {};
  for (const m of teamMeta) metaById[m.id] = m;
  return res.json(
    slice.map((t) => ({
      id: t.id,
      name: metaById[t.id]?.name,
      code: metaById[t.id]?.code,
      image: metaById[t.id]?.image,
      total_points: t.total,
      total_unit_value: t.total,
    })),
  );
}
```

- [ ] **Step 3: Rewrite `/team/rank/:teamId` activity branch to derive from the aggregation**

In `router.get("/team/rank/:teamId", ...)`, replace the `if (eventId) { ... }` block body with:

```ts
if (eventId) {
  const { rows, isPoints } = await computeActivityLeaderboard(eventId, req);
  const teams = aggregateTeams(rows, isPoints);
  const idx = teams.findIndex((t) => String(t.id) === String(teamId));
  if (idx === -1) return res.json({ rank: 0, score: 0, points: 0 });
  return res.json({
    rank: idx + 1,
    score: teams[idx].total,
    points: teams[idx].total,
  });
}
```

Leave the global `else` branch unchanged.

- [ ] **Step 4: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 5: Manual verification (DB required)**

With a logged-in user, for a point-based activity that has team members:

- `GET /api/stats/rankings/team?activity_id=<id>` → each team's `total_points` equals the sum of its members' combined scores from the individual list.
- `GET /api/stats/team/rank/<teamId>?activity_id=<id>` → `rank` matches the team's position in that list.

- [ ] **Step 6: Commit**

```bash
git add server/routes/stats.ts
git commit -m "feat(stats): team rankings sum combined per-member scores"
```

---

## Task 6: `joined_at` on registrations

**Files:**

- Modify: `server/routes/user.ts`

- [ ] **Step 1: Add `joined_at` to the query**

In `router.get("/:userId/registrations", ...)`, in the big SELECT, add `r.created_at as joined_at` to the `registrations r` columns (first line of the select list):

```ts
        SELECT
            r.id as registration_id, r.user_id, r.created_at as joined_at,
            e.id as event_id, e.title as event_title, e.poster as event_poster,
```

- [ ] **Step 2: Expose it on the grouped event object**

In the `eventMap.set(row.event_id, { ... })` object, add `joined_at: row.joined_at,` at the top level (next to `id`, `score`, `rank`):

```ts
        eventMap.set(row.event_id, {
          id: row.registration_id,
          joined_at: row.joined_at,
          score: row.leaderboard_score,
          rank: row.leaderboard_rank,
```

- [ ] **Step 3: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/routes/user.ts
git commit -m "feat(user): include joined_at in registrations response"
```

---

## Task 7: i18n keys

**Files:**

- Modify: `src/store/lang.ts`

- [ ] **Step 1: Add Thai keys**

In the Thai block, right after `rank_no_data: "ยังไม่มีข้อมูลในกิจกรรมนี้",` (line ~305), add:

```ts
    rank_goal_col: "คะแนน / เป้าหมาย",
    goal_reached: "ถึงเป้าหมายแล้ว",
    rank_no_joined: "คุณยังไม่ได้เข้าร่วมกิจกรรมใด",
    rank_no_joined_cta: "ไปหน้ากิจกรรม",
```

- [ ] **Step 2: Add English keys**

In the English block, right after `rank_no_data: "No data for this activity yet",` (line ~679), add:

```ts
    rank_goal_col: "Score / Goal",
    goal_reached: "Goal reached",
    rank_no_joined: "You haven't joined any activity yet",
    rank_no_joined_cta: "Go to activities",
```

- [ ] **Step 3: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/store/lang.ts
git commit -m "feat(i18n): add rankings goal + empty-state strings"
```

---

## Task 8: `useRankings` — joined-activities source, remove overall, targets

**Files:**

- Modify: `src/composables/useRankings.ts`

- [ ] **Step 1: Replace `fetchActivities` with joined-activities loading**

Replace the body of `fetchActivities` so it reads the current user's registrations and maps them to the activity shape, sorted newest-join first:

```ts
const fetchActivities = async () => {
  const uid = authStore.user?.id;
  if (!uid) {
    allActivities.value = [];
    return;
  }
  try {
    const regs = await abortableJson<any[]>(`/api/users/${uid}/registrations`);
    allActivities.value = (regs || [])
      .filter((r) => r.event?.id)
      .map((r) => ({
        id: r.event.id,
        title: r.event.title,
        goal_config: r.event.goal_config,
        joined_at: r.joined_at,
      }))
      .sort(
        (a, b) =>
          new Date(b.joined_at || 0).getTime() -
          new Date(a.joined_at || 0).getTime(),
      );
  } catch (err) {
    if (!isAbortError(err)) {
      uiStore.toast(
        "error",
        "โหลดรายการกิจกรรมไม่สำเร็จ",
        "ไม่สามารถดึงรายการกิจกรรมได้ในขณะนี้",
        { actionLabel: "ลองใหม่", onAction: () => fetchActivities() },
      );
    }
  }
};
```

- [ ] **Step 2: Add `hasJoinedActivities` computed**

Near the other computed activity state (after `visibleActivities`), add:

```ts
const hasJoinedActivities = computed(() => allActivities.value.length > 0);
```

- [ ] **Step 3: Add target row helpers**

Near the other row helpers (after `getDistance`), add:

```ts
const getTarget = (item: any) => Number(item.target) || 0;
const isReached = (item: any) => item.reached === true;
```

- [ ] **Step 4: Default-select the newest joined activity on mount**

In `onMounted`, replace the existing block that reads `route.query.eventId` / sets `selectedActivityId` with logic that defaults to the newest joined activity when no valid `eventId` is present:

```ts
onMounted(async () => {
  await Promise.all([fetchActivities(), fetchFilterOptions()]);
  const eid = route.query.eventId || route.query.activity_id;
  const joinedIds = allActivities.value.map((a) => String(a.id));
  let chosen: string | null = null;
  if (eid && joinedIds.includes(String(eid))) {
    chosen = String(eid);
  } else if (allActivities.value.length > 0) {
    chosen = String(allActivities.value[0].id);
  }
  selectedActivityId.value = chosen;
  if (chosen) {
    const act = allActivities.value.find(
      (a) => String(a.id) === String(chosen),
    );
    if (act) {
      eventData.value = act;
      const config = act.goal_config || {};
      const unit =
        config.target_unit ||
        config.unit ||
        (config.target_type !== "points" ? config.target_type : "");
      if (unit && unit !== "points") eventDefaultUnit.value = unit;
      else eventDefaultUnit.value = "แต้ม";
    }
    updateUrlQuery(false);
  }
  await fetchRankings();
  await fetchUserRanks();
});
```

- [ ] **Step 5: Remove the null/overall path from `selectActivity`**

`selectActivity` currently handles `id` being null (overall). Keep the signature but treat a falsy id as a no-op guard (the UI will no longer pass null after Task 9):

```ts
const selectActivity = (id: any) => {
  if (!id) return;
  selectedActivityId.value = String(id);
  updateUrlQuery(true);
  showSidebar.value = false;
  fetchRankings();
  fetchUserRanks();
  const act = allActivities.value.find((a) => String(a.id) === String(id));
  if (act) {
    eventData.value = act;
    const config = act.goal_config || {};
    const unit =
      config.target_unit ||
      config.unit ||
      (config.target_type !== "points" ? config.target_type : "");
    if (unit && unit !== "points") eventDefaultUnit.value = unit;
    else eventDefaultUnit.value = "แต้ม";
  }
};
```

- [ ] **Step 6: Export the new members**

Add `hasJoinedActivities`, `getTarget`, `isReached` to the returned object at the end of the composable (place near `getDistance` / computed exports):

```ts
    hasJoinedActivities,
    getTarget,
    isReached,
```

- [ ] **Step 7: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/composables/useRankings.ts
git commit -m "feat(rankings): source joined activities, default newest, expose targets"
```

---

## Task 9: `Rankings.vue` — remove overall, goal-in-row, empty state

**Files:**

- Modify: `src/views/Rankings.vue`

- [ ] **Step 1: Remove the "overall" dropdown item**

Delete the entire first `dropdown-item` block that binds to `handleSelectActivity(null)` (the one showing `rank_overall` / "VitalCare System", lines ~41–52). The `v-for` over `visibleActivities` remains.

- [ ] **Step 2: Pull the new helpers from the composable**

In the destructuring from `useRankings()`, add `hasJoinedActivities`, `getTarget`, `isReached`, and `langStore` is already imported. Add to the list:

```ts
  hasJoinedActivities,
  getTarget,
  isReached,
```

- [ ] **Step 3: Update the score column header**

Replace the `col-score` header content:

```html
<div class="col-score">{{ langStore.t("rank_goal_col") }}</div>
```

- [ ] **Step 4: Render goal beside score in each row**

Replace the existing `<div class="col-score"> ... </div>` inside the `list-row` `v-for` with score-over-target markup:

```html
<div class="col-score">
  <div class="score-line">
    <span class="score-val">{{ formatDist(getDistance(item)) }}</span>
    <span class="score-unit"
      >{{ isPoints ? langStore.t("points") : rankingUnitShort }}</span
    >
  </div>
  <div v-if="getTarget(item) > 0" class="goal-line">
    <Check v-if="isReached(item)" :size="12" class="goal-check" />
    <span class="goal-target"
      >/ {{ formatDist(getTarget(item)) }} {{ isPoints ? langStore.t("points") :
      rankingUnitShort }}</span
    >
  </div>
</div>
```

- [ ] **Step 5: Import the `Check` icon**

In the `lucide-vue-next` import line, add `Check`:

```ts
import {
  ChevronRight,
  ChevronDown,
  Search,
  X,
  Flame,
  Check,
} from "lucide-vue-next";
```

- [ ] **Step 6: Add the empty state for no joined activities**

Wrap the `main-content` leaderboard so that when `!hasJoinedActivities`, an empty state shows instead. Add this block immediately after the opening of `<main class="main-content">`… simplest: place it right before `<div class="leaderboard-card">` and guard the card + tabs + filter with `v-if="hasJoinedActivities"`. Concretely, add:

```html
<div v-if="!hasJoinedActivities" class="empty-state no-joined">
  <div class="empty-icon">
    <Inbox :size="48" />
  </div>
  <p>{{ langStore.t("rank_no_joined") }}</p>
  <router-link to="/activities" class="retry-btn">
    {{ langStore.t("rank_no_joined_cta") }}
  </router-link>
</div>
```

and add `v-if="hasJoinedActivities"` to the `<div class="tabs-container">`, `<div class="filter-bar">`, and `<div class="leaderboard-card">` wrappers (or wrap all three in a single `<template v-if="hasJoinedActivities">`). Import `Inbox` from `lucide-vue-next` in the same import line.

- [ ] **Step 7: Add styles for the goal line**

In the `<style scoped>` block, near `.col-score` / `.score-val`, add:

```css
.col-score {
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}
.score-line {
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.goal-line {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 0.75rem;
  color: var(--text-muted);
}
.goal-check {
  color: #16a34a;
}
.no-joined .empty-icon {
  color: #cbd5e1;
}
```

> Note: the existing `.col-score` rule sets `flex-direction: row`-style baseline alignment; overriding to `column` here is intended. Verify in the browser that the score still right-aligns.

- [ ] **Step 8: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 9: Browser verification**

Open the preview, log in as a user with joined activities, go to the Rankings page:

- Dropdown lists only joined activities; no "overall" item; newest-joined preselected.
- Each row shows score and, when the activity has a target, `/ <target> <unit>` with a green ✓ when reached.
- Log in (or simulate) a user with no joined activities → empty state with the CTA appears instead of the table.

Capture a screenshot as evidence.

- [ ] **Step 10: Commit**

```bash
git add src/views/Rankings.vue
git commit -m "feat(rankings): remove overall, show goal in row, add empty state"
```

---

## Task 10: `SubmissionModal.vue` — clickable rows → image lightbox

**Files:**

- Modify: `src/components/SubmissionModal.vue`

- [ ] **Step 1: Make image rows clickable**

On the `<li class="sm-item">` element, bind a click that opens the lightbox only when the submission has a resolvable image:

```html
<li
  v-for="sub in filteredSubmissions"
  :key="sub.id"
  class="sm-item"
  :class="{ 'sm-item--clickable': !!safeImageUrl(sub.img_url) }"
  @click="openLightbox(sub)"
></li>
```

- [ ] **Step 2: Add the lightbox overlay markup**

Immediately before the closing `</transition>` at the end of the template (after the main `sm-overlay` div), add a second transition-wrapped overlay:

```html
<transition name="sm-fade">
  <div v-if="lightboxSrc" class="sm-lightbox" @click.self="lightboxSrc = null">
    <button
      class="sm-lightbox-close"
      @click="lightboxSrc = null"
      :aria-label="langStore.t('close')"
    >
      <X :size="22" />
    </button>
    <img
      :src="lightboxSrc"
      class="sm-lightbox-img"
      :alt="langStore.t('proof_image')"
    />
  </div>
</transition>
```

- [ ] **Step 3: Add lightbox state + handlers in the script**

After `const submissions = ref<any[]>([]);`, add:

```ts
const lightboxSrc = ref<string | null>(null);

const openLightbox = (sub: any) => {
  const src = safeImageUrl(sub.img_url);
  if (src) lightboxSrc.value = src;
};
```

- [ ] **Step 4: Close the lightbox on Escape and when the modal closes**

Extend the existing `watch` on `[props.open, props.user?.id]` so closing the modal also clears the lightbox — add inside the watcher callback:

```ts
if (!isOpen) lightboxSrc.value = null;
```

- [ ] **Step 5: Add lightbox styles**

In `<style scoped>`, add:

```css
.sm-item--clickable {
  cursor: pointer;
  transition: background 0.15s;
}
.sm-item--clickable:hover {
  background: #f8fafc;
}
.sm-lightbox {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(6px);
}
.sm-lightbox-img {
  max-width: 100%;
  max-height: 90vh;
  border-radius: 12px;
  object-fit: contain;
}
.sm-lightbox-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  cursor: pointer;
}
.sm-lightbox-close:hover {
  background: rgba(255, 255, 255, 0.28);
}
```

- [ ] **Step 6: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 7: Browser verification**

Open the Rankings page, click a user row to open the submission modal, then click a submission that has a proof image → full-image lightbox opens; backdrop/close button dismisses it. A submission without an image does not open the lightbox and shows no pointer cursor.

- [ ] **Step 8: Commit**

```bash
git add src/components/SubmissionModal.vue
git commit -m "feat(submissions): open full proof image in a lightbox on click"
```

---

## Task 11: Final verification pass

- [ ] **Step 1: Full typecheck**

Run: `npm run lint`
Expected: PASS with no errors.

- [ ] **Step 2: Re-run the pure unit test**

Run: `npx tsx scripts/streak-scoring.test.ts`
Expected: PASS.

- [ ] **Step 3: End-to-end smoke in the browser**

With a real DB + logged-in user:

- Rankings shows only joined activities, newest preselected, no "overall".
- Individual scores = task points + streak bonus (point activity); rank matches list position.
- Goal shows in each row; ✓ when reached.
- Team tab totals = sum of member combined scores.
- Submission modal image click opens the lightbox.

- [ ] **Step 4: Confirm no stray references to removed behavior**

Run: `git grep -n "rank_overall" src/` — expected: only the key definitions in `src/store/lang.ts` remain (the dropdown item is gone). Leaving the unused i18n key is fine.

---

## Self-review notes

- **Spec coverage:** joined-only dropdown (T8/T9), remove overall (T8/T9), combined per-activity score (T1–T5), goal in row (T7/T9), clickable submissions (T10), `joined_at` (T6), scoring helper export (T2). All spec sections map to a task.
- **Type consistency:** `LeaderboardRow` / `computeActivityLeaderboard` / `aggregateTeams` signatures are defined in T3 and reused verbatim in T4/T5. Frontend `getTarget`/`isReached`/`hasJoinedActivities` defined in T8, consumed in T9.
- **Testing honesty:** only the pure module is unit-tested (repo has no DB/component test harness); everything else is typecheck + browser-verified, called out explicitly.
