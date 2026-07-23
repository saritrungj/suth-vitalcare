# Unified per-activity scoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make per-activity scores (`task points + streak bonus + admin bonus/adjustment`) consistent across Rankings, Profile, AdminUserDetail, and CSV export, with a total = sum of per-activity scores, and per-activity adjustments editable by admin.

**Architecture:** One canonical formula `combineActivityScore(base, streakBonus, adjustment)` (pure, tested). A per-user helper `computeUserActivityScores(userId)` and a bulk `computeAllUsersActivityScores()` in `stats.ts` reuse it, plus `computeActivityLeaderboard` folds in `bonus_points`. Adjustments reuse the existing `bonus_points` table + endpoints. Profile/Admin/Export all read the canonical numbers.

**Tech Stack:** Node + Express + mysql2 (backend), Vue 3 `<script setup>` + composables (frontend), pure `tsx` + `node:assert/strict` tests.

**Reference spec:** `docs/superpowers/specs/2026-07-23-unified-activity-scoring-design.md`

**Testing note:** Repo has no DB/component harness — only pure `tsx` tests. So the formula gets a real unit test; everything else is `npm run lint` (vue-tsc) + browser verification (local MySQL via `docker compose up -d db`, dev server via the `vitalcare-dev` preview). Note: the Admin panel's tab transition doesn't composite in the preview pane — navigate directly to routes like `/admin/users/:id` when verifying.

---

## File Structure

- **Create** `server/lib/activityScore.ts` — pure `combineActivityScore()`, `sumTotal()`.
- **Create** `scripts/activity-score.test.ts` — pure unit tests.
- **Modify** `server/routes/stats.ts` — add `computeUserActivityScores`, `computeAllUsersActivityScores`, `GET /user/:userId/activity-scores`, `GET /scores/export`; fold `bonus_points` into `computeActivityLeaderboard`.
- **Modify** `src/composables/useProfileEvents.ts` — fetch canonical scores; repoint `liveTotalPoints` + `getEventScore`.
- **Modify** `src/views/Profile.vue` — add a read-only "คะแนนของฉัน" total card in the events tab.
- **Modify** `src/composables/useAdminUserDetail.ts` — add `activityScores` state + `loadActivityScores()` + `addAdjustment()` / `removeAdjustment()`.
- **Modify** `src/components/admin/user-detail/PointsTab.vue` — per-activity adjustment editor + keep global editor.
- **Modify** `src/composables/useAdminUsers.ts` — `exportCSV` uses the export endpoint (total + per-activity columns).

---

## Task 1: Pure canonical score helper

**Files:**

- Create: `server/lib/activityScore.ts`
- Test: `scripts/activity-score.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/activity-score.test.ts`:

```ts
import assert from "node:assert/strict";
import { combineActivityScore, sumTotal } from "../server/lib/activityScore";

// base + streak bonus + adjustment
assert.equal(
  combineActivityScore({ base: 10, streakBonus: 5, adjustment: 3 }),
  18,
);
// missing parts default to 0
assert.equal(combineActivityScore({ base: 10 }), 10);
assert.equal(combineActivityScore({}), 0);
// negative adjustment can reduce, but score never goes below 0
assert.equal(combineActivityScore({ base: 10, adjustment: -4 }), 6);
assert.equal(combineActivityScore({ base: 10, adjustment: -50 }), 0);
// rounding (defensive; inputs are ints in practice)
assert.equal(combineActivityScore({ base: 10.4, streakBonus: 0.4 }), 11);

// sumTotal
assert.equal(sumTotal([18, 0, 5]), 23);
assert.equal(sumTotal([]), 0);
assert.equal(sumTotal([10, undefined as any, 5]), 15);

console.log("activity-score.test.ts OK");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx scripts/activity-score.test.ts`
Expected: FAIL — `Cannot find module '../server/lib/activityScore'`.

- [ ] **Step 3: Write the implementation**

Create `server/lib/activityScore.ts`:

```ts
// Canonical per-activity score formula, shared by rankings, profile, admin, export.
// Pure — unit-tested via scripts/activity-score.test.ts.

export interface ActivityScoreParts {
  base?: number;
  streakBonus?: number;
  adjustment?: number;
}

/** Points score for one activity: base + streak bonus + adjustment, clamped >= 0. */
export function combineActivityScore(p: ActivityScoreParts): number {
  const raw =
    (Number(p.base) || 0) +
    (Number(p.streakBonus) || 0) +
    (Number(p.adjustment) || 0);
  return Math.max(0, Math.round(raw));
}

/** Sum a list of per-activity scores into a total. */
export function sumTotal(scores: number[]): number {
  return scores.reduce((s, n) => s + (Number(n) || 0), 0);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx scripts/activity-score.test.ts`
Expected: PASS — prints `activity-score.test.ts OK`.

- [ ] **Step 5: Commit**

```bash
git add server/lib/activityScore.ts scripts/activity-score.test.ts
git commit -m "feat(scoring): add canonical activity-score formula with tests"
```

---

## Task 2: Fold bonus_points into `computeActivityLeaderboard`

**Files:**

- Modify: `server/routes/stats.ts`

- [ ] **Step 1: Import the formula**

At the top of `server/routes/stats.ts`, add to the imports (next to the existing `getStreakBonus` / `computeStreakFromDates` imports):

```ts
import { combineActivityScore, sumTotal } from "../lib/activityScore.js";
```

- [ ] **Step 2: Add `adjustment` to `LeaderboardRow`**

In the `LeaderboardRow` interface, add the field after `streak_bonus`:

```ts
streak_bonus: number;
adjustment: number;
```

- [ ] **Step 3: Fetch net bonus_points per user for the activity**

In `computeActivityLeaderboard`, right after the `subs` query + its aggregation loop (after the `for (const s of subs) { ... }` block, before `// 4. Build rows`), add:

```ts
// 3b. Net admin adjustments (bonus_points) per user for this activity.
const bonusByUser: Record<number, number> = {};
try {
  const [bonusRows]: any = await pool.query(
    `SELECT user_id, COALESCE(SUM(points), 0) AS net
         FROM bonus_points WHERE event_id = ? AND user_id IN (?) GROUP BY user_id`,
    [activityId, ids],
  );
  for (const b of bonusRows) bonusByUser[b.user_id] = Number(b.net) || 0;
} catch (e: any) {
  if (e.code !== "ER_NO_SUCH_TABLE") throw e;
}
```

- [ ] **Step 4: Include the adjustment in each row's points score**

Replace the row-build block:

```ts
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
```

with:

```ts
for (const p of participants) {
  const a = agg[p.id];
  const streak = computeStreakFromDates(Array.from(a.dates));
  const streak_bonus = isPoints ? await getStreakBonus(streak) : 0;
  const adjustment = bonusByUser[p.id] || 0;
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
    adjustment,
    total_points: combineActivityScore({
      base: a.base,
      streakBonus: streak_bonus,
      adjustment,
    }),
  });
}
```

> Unit-metric ranking still uses `total_unit_value` (unchanged); the adjustment only affects the points score `total_points`.

- [ ] **Step 5: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/routes/stats.ts
git commit -m "feat(rankings): fold admin bonus_points into leaderboard scores"
```

---

## Task 3: Per-user activity-scores helper + endpoint

**Files:**

- Modify: `server/routes/stats.ts`

- [ ] **Step 1: Add the per-user helper**

Add this after `computeActivityLeaderboard` (and its `aggregateTeams`) in `server/routes/stats.ts`:

```ts
export interface UserActivityScore {
  event_id: number;
  title: string;
  base_points: number;
  streak: number;
  streak_bonus: number;
  adjustment: number;
  score: number;
  is_points: boolean;
}

/** Per-activity points breakdown for one user across their joined activities. */
async function computeUserActivityScores(
  userId: string | number,
): Promise<{ total: number; activities: UserActivityScore[] }> {
  const [regs]: any = await pool.query(
    `SELECT e.id AS event_id, e.title, e.goal_config
       FROM registrations r JOIN events e ON r.event_id = e.id
       WHERE r.user_id = ?
       ORDER BY r.created_at DESC`,
    [userId],
  );
  if (regs.length === 0) return { total: 0, activities: [] };
  const eventIds = regs.map((r: any) => r.event_id);

  const [subs]: any = await pool.query(
    `SELECT t.event_id AS event_id, DATE(s.created_at) AS d, t.points AS points
       FROM submissions s JOIN tasks t ON s.task_id = t.id
       WHERE s.user_id = ? AND t.event_id IN (?) AND s.status = 'approved'`,
    [userId, eventIds],
  );

  const bonusByEvent: Record<number, number> = {};
  try {
    const [bonusRows]: any = await pool.query(
      `SELECT event_id, COALESCE(SUM(points), 0) AS net
         FROM bonus_points WHERE user_id = ? AND event_id IN (?) GROUP BY event_id`,
      [userId, eventIds],
    );
    for (const b of bonusRows) bonusByEvent[b.event_id] = Number(b.net) || 0;
  } catch (e: any) {
    if (e.code !== "ER_NO_SUCH_TABLE") throw e;
  }

  const agg: Record<number, { base: number; dates: Set<string> }> = {};
  for (const id of eventIds) agg[id] = { base: 0, dates: new Set() };
  for (const s of subs) {
    const a = agg[s.event_id];
    if (!a) continue;
    a.base += Number(s.points) || 0;
    a.dates.add(String(s.d));
  }

  const activities: UserActivityScore[] = [];
  for (const reg of regs) {
    const gc = parseGoalConfig(reg.goal_config);
    const targetType = normalizeUnit(gc?.target_type || "points");
    const metricUnit = normalizeUnit(
      gc?.target_unit ||
        gc?.unit ||
        (targetType !== "points" ? targetType : ""),
    );
    const isPoints = !metricUnit || metricUnit === "points";
    const a = agg[reg.event_id];
    const streak = computeStreakFromDates(Array.from(a.dates));
    const streakBonus = isPoints ? await getStreakBonus(streak) : 0;
    const adjustment = bonusByEvent[reg.event_id] || 0;
    const score = combineActivityScore({
      base: a.base,
      streakBonus,
      adjustment,
    });
    activities.push({
      event_id: reg.event_id,
      title: reg.title,
      base_points: a.base,
      streak,
      streak_bonus: streakBonus,
      adjustment,
      score,
      is_points: isPoints,
    });
  }
  const total = sumTotal(activities.map((x) => x.score));
  return { total, activities };
}
```

- [ ] **Step 2: Add the endpoint (self OR admin/host)**

Add this route (place it near the other `/user`-ish stats routes, e.g. right before `router.get("/rankings/filters", ...)`):

```ts
// Per-user activity score breakdown (self or admin/host).
router.get("/user/:userId/activity-scores", async (req, res) => {
  const requesterId = req.headers["x-user-id"];
  const { userId } = req.params;
  if (!requesterId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const [reqRows]: any = await pool.query(
      "SELECT role FROM users WHERE id = ?",
      [requesterId],
    );
    const role = reqRows[0]?.role;
    const isSelf = String(requesterId) === String(userId);
    if (!isSelf && role !== "admin" && role !== "host") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const data = await computeUserActivityScores(userId);
    res.json(data);
  } catch (error: any) {
    console.error("[activity-scores] error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
```

- [ ] **Step 3: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/routes/stats.ts
git commit -m "feat(stats): per-user activity-scores helper + endpoint"
```

---

## Task 4: Bulk export helper + endpoint

**Files:**

- Modify: `server/routes/stats.ts`

- [ ] **Step 1: Add the bulk helper**

Add after `computeUserActivityScores`:

```ts
/** Per-user, per-activity points for every user (for CSV export). */
async function computeAllUsersActivityScores(): Promise<{
  activities: { event_id: number; title: string }[];
  users: { user_id: number; total: number; scores: Record<number, number> }[];
}> {
  const [evRows]: any = await pool.query(
    `SELECT DISTINCT e.id AS event_id, e.title, e.goal_config
       FROM events e JOIN registrations r ON r.event_id = e.id
       ORDER BY e.id ASC`,
  );
  const eventMeta: Record<number, { isPoints: boolean }> = {};
  for (const e of evRows) {
    const gc = parseGoalConfig(e.goal_config);
    const tt = normalizeUnit(gc?.target_type || "points");
    const mu = normalizeUnit(
      gc?.target_unit || gc?.unit || (tt !== "points" ? tt : ""),
    );
    eventMeta[e.event_id] = { isPoints: !mu || mu === "points" };
  }

  const [regs]: any = await pool.query(
    `SELECT user_id, event_id FROM registrations`,
  );
  const [subs]: any = await pool.query(
    `SELECT s.user_id, t.event_id, DATE(s.created_at) AS d, t.points AS points
       FROM submissions s JOIN tasks t ON s.task_id = t.id
       WHERE s.status = 'approved'`,
  );
  let bonus: any[] = [];
  try {
    const [b]: any = await pool.query(
      `SELECT user_id, event_id, COALESCE(SUM(points), 0) AS net
         FROM bonus_points GROUP BY user_id, event_id`,
    );
    bonus = b;
  } catch (e: any) {
    if (e.code !== "ER_NO_SUCH_TABLE") throw e;
  }

  const key = (u: number, e: number) => `${u}_${e}`;
  const baseMap: Record<string, { base: number; dates: Set<string> }> = {};
  for (const r of regs)
    baseMap[key(r.user_id, r.event_id)] = { base: 0, dates: new Set() };
  for (const s of subs) {
    const m = baseMap[key(s.user_id, s.event_id)];
    if (!m) continue;
    m.base += Number(s.points) || 0;
    m.dates.add(String(s.d));
  }
  const bonusMap: Record<string, number> = {};
  for (const b of bonus)
    bonusMap[key(b.user_id, b.event_id)] = Number(b.net) || 0;

  const users: Record<
    number,
    { total: number; scores: Record<number, number> }
  > = {};
  for (const r of regs) {
    const k = key(r.user_id, r.event_id);
    const m = baseMap[k];
    const meta = eventMeta[r.event_id];
    const streak = computeStreakFromDates(Array.from(m.dates));
    const streakBonus = meta?.isPoints ? await getStreakBonus(streak) : 0;
    const adjustment = bonusMap[k] || 0;
    const score = combineActivityScore({
      base: m.base,
      streakBonus,
      adjustment,
    });
    if (!users[r.user_id]) users[r.user_id] = { total: 0, scores: {} };
    users[r.user_id].scores[r.event_id] = score;
    users[r.user_id].total += score;
  }

  return {
    activities: evRows.map((e: any) => ({
      event_id: e.event_id,
      title: e.title,
    })),
    users: Object.entries(users).map(([uid, v]) => ({
      user_id: Number(uid),
      total: v.total,
      scores: v.scores,
    })),
  };
}
```

> `getStreakBonus` caches its config (~60s), so calling it per (user,activity) here is cheap.

- [ ] **Step 2: Add the endpoint (admin only)**

Add this route near the other admin stats routes (e.g. right after the `/user/:userId/activity-scores` route). `requireAdmin` is not imported in this file yet — add the import at top: `import { requireAdmin } from "../middleware/auth.js";` (only if not already present), then:

```ts
// Bulk per-activity scores for CSV export (admin only).
router.get("/scores/export", requireAdmin, async (_req, res) => {
  try {
    const data = await computeAllUsersActivityScores();
    res.json(data);
  } catch (error: any) {
    console.error("[scores/export] error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
```

> Check the top of `server/routes/stats.ts` first — if `requireAdmin` is already imported, do not duplicate the import.

- [ ] **Step 3: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/routes/stats.ts
git commit -m "feat(stats): bulk activity-scores export endpoint"
```

---

## Task 5: Profile — canonical scores + total card

**Files:**

- Modify: `src/composables/useProfileEvents.ts`
- Modify: `src/views/Profile.vue`

- [ ] **Step 1: Add canonical score state + fetch to the composable**

In `src/composables/useProfileEvents.ts`, add near the top state (after `const userSubmissions = ref([]);`):

```ts
const activityScores = ref([]);
const scoreTotal = ref(0);
```

Add a fetch function (place it next to `fetchEventsData`):

```ts
async function fetchActivityScores() {
  if (!user.value?.id) return;
  try {
    const r = await fetch(`/api/stats/user/${user.value.id}/activity-scores`, {
      headers: { "x-user-id": String(user.value.id) },
    });
    if (r.ok) {
      const d = await r.json();
      activityScores.value = d.activities || [];
      scoreTotal.value = d.total || 0;
    }
  } catch {}
}
```

Call it at the end of `fetchEventsData`'s `try` (after `isEventsLoaded.value = true;`):

```ts
isEventsLoaded.value = true;
fetchActivityScores();
```

- [ ] **Step 2: Repoint `liveTotalPoints` to the canonical total**

Replace the existing `liveTotalPoints` computed:

```ts
const liveTotalPoints = computed(() => {
  return userSubmissions.value
    .filter((s) => s.status === "approved")
    .reduce((sum, s) => sum + (s.tasks?.points || 0), 0);
});
```

with:

```ts
// Canonical total = sum of per-activity scores (base + streak bonus + adjustment).
const liveTotalPoints = computed(() => scoreTotal.value);
```

- [ ] **Step 3: Repoint `getEventScore` to the canonical per-activity score**

Replace the existing `getEventScore`:

```ts
function getEventScore(eventId) {
  return userSubmissions.value
    .filter((s) => {
      const subEvId = s.tasks?.event_id || s.event_id || s.activity_id;
      return Number(subEvId) === Number(eventId) && s.status === "approved";
    })
    .reduce((sum, s) => sum + (s.tasks?.points || 0), 0);
}
```

with:

```ts
function getEventScore(eventId) {
  const found = activityScores.value.find(
    (a) => Number(a.event_id) === Number(eventId),
  );
  return found ? found.score : 0;
}
```

- [ ] **Step 4: Export the new state**

In the `return { ... }` object of `useProfileEvents`, add `activityScores`, `scoreTotal`, and `fetchActivityScores` (next to `liveTotalPoints`):

```ts
    liveTotalPoints,
    activityScores,
    scoreTotal,
    fetchActivityScores,
```

- [ ] **Step 5: Surface the new state in Profile.vue**

In `src/views/Profile.vue`, in the destructure from `useProfileEvents(...)` (the block that already lists `liveTotalPoints`, `getEventScore`), add:

```ts
  liveTotalPoints,
  activityScores,
  scoreTotal,
```

- [ ] **Step 6: Add a read-only total card in the events tab**

In `src/views/Profile.vue`, find `<div v-if="activeTab === 'events'" class="tab-content">` (around line 1046) and insert this card right after that opening tag:

```html
<div class="my-scores-card">
  <div class="my-scores-head">
    <span class="my-scores-label">{{ langStore.t("points_label") }}</span>
    <span class="my-scores-total"
      >{{ scoreTotal.toLocaleString() }} {{ langStore.t("points") }}</span
    >
  </div>
  <div class="my-scores-list">
    <div v-for="a in activityScores" :key="a.event_id" class="my-scores-row">
      <span class="my-scores-name">{{ a.title }}</span>
      <span class="my-scores-val">{{ a.score.toLocaleString() }}</span>
    </div>
  </div>
</div>
```

Then add these styles inside the component's `<style>` block (append near the end, before the closing `</style>`):

```css
.my-scores-card {
  border: 1px solid #eef0f3;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 16px;
  background: #fff;
}
.my-scores-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
}
.my-scores-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: #94a3b8;
}
.my-scores-total {
  font-size: 1.25rem;
  font-weight: 800;
  color: #f05a23;
}
.my-scores-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.my-scores-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: #475569;
}
.my-scores-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 12px;
}
.my-scores-val {
  font-weight: 700;
  flex-shrink: 0;
}
```

- [ ] **Step 7: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/composables/useProfileEvents.ts src/views/Profile.vue
git commit -m "feat(profile): show canonical activity scores + total"
```

---

## Task 6: AdminUserDetail — per-activity adjustment editor

**Files:**

- Modify: `src/composables/useAdminUserDetail.ts`
- Modify: `src/components/admin/user-detail/PointsTab.vue`

- [ ] **Step 1: Add activity-scores state + actions to the composable**

In `src/composables/useAdminUserDetail.ts`, add state near the other refs (after `const registrations = ref<any[]>([]);`):

```ts
const activityScores = ref<any[]>([]);
const scoreTotal = ref(0);
```

Add a loader (place after the `load` function):

```ts
const loadActivityScores = async () => {
  try {
    const r = await fetch(`${API}/stats/user/${userId}/activity-scores`, {
      headers: headers(false),
    });
    if (r.ok) {
      const d = await r.json();
      activityScores.value = d.activities || [];
      scoreTotal.value = d.total || 0;
    }
  } catch {
    /* silent */
  }
};
```

Add adjustment write actions (place after `savePoints`):

```ts
const addAdjustment = async (
  eventId: number,
  points: number,
  reason: string,
) => {
  if (!points) return;
  submitting.value = true;
  try {
    const r = await fetch(`${API}/activities/${eventId}/bonus-points`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ user_id: userId, points, reason }),
    });
    if (!r.ok)
      throw new Error(
        (await r.json().catch(() => ({}))).error || "ปรับคะแนนไม่สำเร็จ",
      );
    showSuccess("ปรับคะแนนรายกิจกรรมสำเร็จ");
    await loadActivityScores();
    await load();
  } catch (e: any) {
    showError(e.message);
  } finally {
    submitting.value = false;
  }
};
```

Then extend the existing `load()` to also refresh scores — at the end of `load()`'s `try` (after the assignments), add:

```ts
await loadActivityScores();
```

- [ ] **Step 2: Export the new members**

In the composable's `return { ... }`, add (next to `savePoints`):

```ts
    activityScores,
    scoreTotal,
    loadActivityScores,
    addAdjustment,
```

- [ ] **Step 3: Rewrite PointsTab with a per-activity section**

Replace the entire contents of `src/components/admin/user-detail/PointsTab.vue`:

```vue
<script setup lang="ts">
import { ref, watch, reactive } from "vue";
import { Save, Loader2, Coins, Plus } from "lucide-vue-next";
const props = defineProps<{ ctx: any }>();

// Global (shop/legacy) points override — unchanged behavior.
const points = ref(0);
const totalScore = ref(0);
watch(
  () => props.ctx.user.value,
  (u) => {
    points.value = Number(u?.points || 0);
    totalScore.value = Number(u?.total_score || 0);
  },
  { immediate: true },
);
const saveGlobal = () =>
  props.ctx.savePoints(
    Math.max(0, points.value),
    Math.max(0, totalScore.value),
  );

// Per-activity adjustment inputs, keyed by event_id.
const adjInput = reactive<
  Record<number, { delta: number | null; reason: string }>
>({});
const ensureRow = (id: number) => {
  if (!adjInput[id]) adjInput[id] = { delta: null, reason: "" };
  return adjInput[id];
};
const applyAdjustment = async (eventId: number) => {
  const row = ensureRow(eventId);
  const delta = Number(row.delta);
  if (!delta) return;
  await props.ctx.addAdjustment(eventId, delta, row.reason || "");
  row.delta = null;
  row.reason = "";
};
</script>

<template>
  <div class="max-w-2xl flex flex-col gap-10">
    <!-- Per-activity scores + adjustment -->
    <div>
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2 text-slate-500">
          <Coins :size="18" class="text-orange-500" />
          <span class="text-sm font-bold">คะแนนรายกิจกรรม</span>
        </div>
        <div class="text-sm font-black text-orange-600">
          รวม {{ ctx.scoreTotal.value.toLocaleString() }} คะแนน
        </div>
      </div>

      <div v-if="ctx.activityScores.value.length" class="flex flex-col gap-3">
        <div
          v-for="a in ctx.activityScores.value"
          :key="a.event_id"
          class="border border-slate-100 rounded-2xl p-3"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-bold text-slate-700 truncate">{{
              a.title
            }}</span>
            <span class="text-sm font-black text-slate-900 shrink-0">{{
              a.score.toLocaleString()
            }}</span>
          </div>
          <div class="text-xs text-slate-400 mt-1">
            ภารกิจ {{ a.base_points }} · streak +{{ a.streak_bonus }} · ปรับ
            {{ a.adjustment }}
          </div>
          <div class="flex items-center gap-2 mt-3">
            <input
              v-model.number="ensureRow(a.event_id).delta"
              type="number"
              placeholder="+/- คะแนน"
              class="w-28 border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
            <input
              v-model="ensureRow(a.event_id).reason"
              placeholder="เหตุผล"
              class="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
            <button
              @click="applyAdjustment(a.event_id)"
              :disabled="ctx.submitting.value || !ensureRow(a.event_id).delta"
              class="bg-orange-500 text-white px-3 py-2 rounded-xl text-sm font-bold flex items-center gap-1 disabled:opacity-50 shrink-0"
            >
              <Loader2
                v-if="ctx.submitting.value"
                :size="14"
                class="animate-spin"
              />
              <Plus v-else :size="14" /> ปรับ
            </button>
          </div>
        </div>
      </div>
      <p v-else class="text-slate-400 text-sm">ยังไม่ได้เข้าร่วมกิจกรรม</p>
    </div>

    <!-- Global (shop/legacy) override -->
    <div>
      <div class="flex items-center gap-2 mb-4 text-slate-500">
        <Coins :size="18" class="text-slate-400" />
        <span class="text-sm font-bold"
          >คะแนนระบบ (ร้านค้า/รวมสะสม) — เขียนทับโดยตรง</span
        >
      </div>
      <div class="flex flex-col gap-4">
        <label class="flex flex-col gap-1">
          <span class="text-xs font-bold text-slate-500">คะแนน (points)</span>
          <input
            v-model.number="points"
            type="number"
            min="0"
            class="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-500"
          />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs font-bold text-slate-500"
            >คะแนนสะสม (total_score)</span
          >
          <input
            v-model.number="totalScore"
            type="number"
            min="0"
            class="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-500"
          />
        </label>
      </div>
      <button
        @click="saveGlobal"
        :disabled="ctx.submitting.value"
        class="mt-6 bg-slate-700 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-slate-800 disabled:opacity-50"
      >
        <Loader2 v-if="ctx.submitting.value" :size="18" class="animate-spin" />
        <Save v-else :size="18" /> บันทึกคะแนนระบบ
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/composables/useAdminUserDetail.ts src/components/admin/user-detail/PointsTab.vue
git commit -m "feat(admin): per-activity score view + adjustment editor"
```

---

## Task 7: Export — total + per-activity columns

**Files:**

- Modify: `src/composables/useAdminUsers.ts`

- [ ] **Step 1: Rewrite `exportCSV` to use the canonical export endpoint**

In `src/composables/useAdminUsers.ts`, replace the entire `exportCSV` function with:

```ts
const exportCSV = async () => {
  const selected =
    selectedIds.value.length > 0
      ? filtered.value.filter((u: any) => selectedIds.value.includes(u.id))
      : filtered.value;

  // Canonical per-activity scores (total + per-activity), keyed by user id.
  let activities: { event_id: number; title: string }[] = [];
  const scoreByUser: Record<
    number,
    { total: number; scores: Record<number, number> }
  > = {};
  try {
    const r = await fetch("/api/stats/scores/export", {
      headers: { "x-user-id": String(authStore.user?.id) },
    });
    if (r.ok) {
      const d = await r.json();
      activities = d.activities || [];
      for (const u of d.users || []) scoreByUser[u.user_id] = u;
    }
  } catch {
    /* fall back to no score columns */
  }

  const header = [
    "ID",
    "ชื่อ",
    "อีเมล",
    "โทรศัพท์",
    "สิทธิ์",
    "สถานะ",
    "วันสมัคร",
    "คะแนนรวม (กิจกรรม)",
    ...activities.map((a) => a.title),
  ];
  const rows = selected.map((u) => {
    const s = scoreByUser[u.id];
    return [
      u.id,
      displayName(u),
      u.email || "",
      u.phone || "",
      u.role,
      statusLabel(u),
      fmtDate(u.created_at),
      s ? s.total : 0,
      ...activities.map((a) => (s ? s.scores[a.event_id] || 0 : 0)),
    ];
  });
  const esc = (v: any) => {
    const str = String(v ?? "");
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `users_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showSuccess(`Export ${selected.length} รายการสำเร็จ`);
};
```

> Note: activity titles are used as column headers; the `esc` helper quotes any title containing commas/quotes so the CSV stays valid.

- [ ] **Step 2: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/composables/useAdminUsers.ts
git commit -m "feat(admin): export CSV with total + per-activity score columns"
```

---

## Task 8: Final verification pass

- [ ] **Step 1: Full typecheck + unit tests**

Run: `npm run lint`
Expected: PASS.
Run: `npx tsx scripts/activity-score.test.ts`
Expected: PASS.
Run: `npx tsx scripts/admin-submission.test.ts && npx tsx scripts/streak-scoring.test.ts`
Expected: PASS (no regressions in earlier pure tests).

- [ ] **Step 2: Browser smoke test (local DB + dev server)**

Ensure DB is up (`docker compose up -d db`) and start the `vitalcare-dev` preview. Log in as admin.

- **Consistency:** pick a user joined to a point activity. Open the Rankings for that activity and note the user's score. Open the user's Profile (or `/admin/users/:id` → คะแนน) and confirm the same per-activity score + that the total = sum of per-activity scores.
- **Adjustment moves everything:** in `/admin/users/:id` → คะแนน, add `+10` with a reason to one activity. Reload and confirm: the activity score and total rose by 10 there, the Rankings row for that activity rose by 10, and the Profile total/score rose by 10.
- **Export:** trigger the AdminUsers CSV export; open it and confirm there's a `คะแนนรวม (กิจกรรม)` column plus one column per activity, and the numbers match the UI for that user.

Check `read_console_messages` (no errors) and `read_network_requests` (all 2xx) during the pass. Capture a screenshot as evidence.

- [ ] **Step 3: Confirm no negative/NaN leakage**

In the browser, set an adjustment that would drive an activity below zero (e.g. `-99999`) and confirm the displayed score clamps at 0 (per `combineActivityScore`) and no `NaN` appears. Then remove that adjustment (delete via the bonus history is out of scope here; re-add the inverse `+99999`) to restore state.

---

## Self-review notes

- **Spec coverage:** canonical formula (T1); rankings include bonus (T2); per-user endpoint (T3); bulk export endpoint (T4); Profile total + per-activity, consistent with rankings (T5); admin per-activity adjustment edit reusing bonus_points (T6); export with total + per-activity columns (T7). All spec sections map to tasks.
- **Type/name consistency:** `combineActivityScore`/`sumTotal` (T1) used verbatim in T2–T4. `computeUserActivityScores` shape (T3) consumed by Profile (T5) and Admin (T6). `/api/stats/user/:id/activity-scores` and `/api/stats/scores/export` referenced consistently across frontend tasks. `addAdjustment(eventId, points, reason)` defined in T6 composable, called in T6 PointsTab.
- **Reuse over new:** adjustments use the existing `bonus_points` table + `/api/activities/:id/bonus-points` endpoints — no new table, matching the spec.
- **Known boundary:** `users.points`/`total_score` (shop/legacy) stay editable via the global override and are intentionally separate from the activity total; documented in the PointsTab label.
- **Testing honesty:** only the pure formula is unit-tested (repo has no DB/component harness); the rest is typecheck + browser-verified.
