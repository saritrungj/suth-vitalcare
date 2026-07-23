# Score transparency + admin mission/assessment editing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every score surface explain itself (clickable breakdown showing where points came from), show a person's activity score in the Rankings detail modal, let admins fully edit missions (image + value, and add via activity→task pickers with any date), and make 3อ2ส assessments editable per section with recomputed scores.

**Architecture:** One `?detail=1` extension to the existing activity-scores endpoint feeds a shared `PointsBreakdownModal` used on three surfaces. Rankings reuses the leaderboard row it already has (no new endpoint). Two pure modules are extracted so admin and user flows score identically: `src/lib/missionValue.ts` (mission value encoding) and `src/lib/healthAssessment.ts` (the 3อ2ส definition + scoring, lifted out of `Health.vue`).

**Tech Stack:** Node + Express + mysql2 (backend), Vue 3 `<script setup>` + composables (frontend), pure `tsx` + `node:assert/strict` tests.

**Reference spec:** `docs/superpowers/specs/2026-07-23-score-transparency-and-admin-editing-design.md`

**Testing note:** Repo has no DB/component harness — only pure `tsx` tests. Pure modules get real unit tests; everything else is `npm run lint` (vue-tsc) + browser verification (local MySQL via `docker compose up -d db`, `vitalcare-dev` preview). Two harness gotchas seen before: (a) the Admin panel's tab transition doesn't composite in the preview pane — navigate directly to `/admin/users/:id`; (b) after changing **server/** files, restart the preview server or new routes 404.

---

## File Structure

- **Modify** `server/routes/stats.ts` — `?detail=1` on `/user/:userId/activity-scores`.
- **Create** `src/components/common/PointsBreakdownModal.vue` — shared drill-down UI.
- **Modify** `src/components/admin/AdminUsers.vue` — canonical total + clickable breakdown in the `view` modal.
- **Modify** `src/composables/useAdminUsers.ts` — fetch canonical total for the view modal.
- **Modify** `src/components/admin/user-detail/PointsTab.vue` — expandable per-activity detail.
- **Modify** `src/views/Profile.vue` — clickable total → breakdown.
- **Modify** `src/components/SubmissionModal.vue` — `scoreRow` prop + score header.
- **Modify** `src/views/Rankings.vue` — pass the clicked leaderboard row through.
- **Modify** `src/composables/useRankings.ts` — keep the clicked row for the modal.
- **Create** `src/lib/missionValue.ts` + `scripts/mission-value.test.ts` — value encoding.
- **Modify** `src/composables/useAdminUserDetail.ts` — task loading, image upload, submission edit.
- **Modify** `src/components/admin/user-detail/MissionsTab.vue` — edit row + activity/task pickers.
- **Create** `src/lib/healthAssessment.ts` + `scripts/health-assessment.test.ts` — 3อ2ส definition + scoring.
- **Modify** `src/views/Health.vue` — import the extracted module.
- **Modify** `server/routes/health.ts` — GET answers + PUT update endpoints.
- **Modify** `src/components/admin/user-detail/AssessmentsTab.vue` — per-section editor.

---

## Task 1: `?detail=1` on activity-scores

**Files:**

- Modify: `server/routes/stats.ts`

- [ ] **Step 1: Extend the per-user helper to optionally include detail**

In `server/routes/stats.ts`, change the `UserActivityScore` interface to add the optional detail arrays:

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
  missions?: {
    submission_id: number;
    task_name: string;
    date: string;
    points: number;
  }[];
  adjustments?: {
    id: number;
    points: number;
    reason: string | null;
    created_at: string;
  }[];
}
```

- [ ] **Step 2: Accept a `detail` flag and gather the contributing rows**

Change the signature of `computeUserActivityScores` to accept a flag:

```ts
async function computeUserActivityScores(
  userId: string | number,
  detail = false,
): Promise<{ total: number; activities: UserActivityScore[] }> {
```

Then, immediately after the existing `bonusByEvent` block inside that function, add:

```ts
// Optional drill-down data: the rows that make up base_points and adjustment.
const missionsByEvent: Record<number, any[]> = {};
const adjustmentsByEvent: Record<number, any[]> = {};
if (detail) {
  const [mrows]: any = await pool.query(
    `SELECT s.id AS submission_id, t.event_id AS event_id,
              COALESCE(NULLIF(t.note, ''), t.type, 'ภารกิจ') AS task_name,
              DATE(s.created_at) AS date, t.points AS points
         FROM submissions s JOIN tasks t ON s.task_id = t.id
        WHERE s.user_id = ? AND t.event_id IN (?) AND s.status = 'approved'
        ORDER BY s.created_at DESC`,
    [userId, eventIds],
  );
  for (const m of mrows) {
    (missionsByEvent[m.event_id] ||= []).push({
      submission_id: m.submission_id,
      task_name: m.task_name,
      date: String(m.date),
      points: Number(m.points) || 0,
    });
  }
  try {
    const [arows]: any = await pool.query(
      `SELECT id, event_id, points, reason, created_at
           FROM bonus_points
          WHERE user_id = ? AND event_id IN (?)
          ORDER BY created_at DESC`,
      [userId, eventIds],
    );
    for (const a of arows) {
      (adjustmentsByEvent[a.event_id] ||= []).push({
        id: a.id,
        points: Number(a.points) || 0,
        reason: a.reason,
        created_at: String(a.created_at),
      });
    }
  } catch (e: any) {
    if (e.code !== "ER_NO_SUCH_TABLE") throw e;
  }
}
```

- [ ] **Step 3: Attach the detail to each activity**

Inside the same function, in the `activities.push({ ... })` call, add the two optional fields at the end of the object (after `is_points`):

```ts
      is_points: isPoints,
      ...(detail
        ? {
            missions: missionsByEvent[reg.event_id] || [],
            adjustments: adjustmentsByEvent[reg.event_id] || [],
          }
        : {}),
```

- [ ] **Step 4: Pass the flag from the route**

In the `router.get("/user/:userId/activity-scores", ...)` handler, replace:

```ts
const data = await computeUserActivityScores(userId);
```

with:

```ts
const detail = req.query.detail === "1" || req.query.detail === "true";
const data = await computeUserActivityScores(userId, detail);
```

- [ ] **Step 5: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/routes/stats.ts
git commit -m "feat(stats): optional detail breakdown on activity-scores"
```

---

## Task 2: Shared PointsBreakdownModal

**Files:**

- Create: `src/components/common/PointsBreakdownModal.vue`

- [ ] **Step 1: Create the component**

```vue
<script setup lang="ts">
import { ref, watch } from "vue";
import { X, ChevronDown, Loader2 } from "lucide-vue-next";
import { authStore } from "../../store/auth";

const props = defineProps<{
  open: boolean;
  userId: number | string | null;
  title?: string;
}>();
defineEmits<{ (e: "close"): void }>();

const API = import.meta.env.VITE_API_URL || "/api";
const loading = ref(false);
const total = ref(0);
const activities = ref<any[]>([]);
const expanded = ref<Record<number, boolean>>({});

const toggle = (id: number) => {
  expanded.value[id] = !expanded.value[id];
};

const fmtDate = (d: string) =>
  d
    ? new Date(d).toLocaleDateString("th-TH", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      })
    : "—";

const load = async () => {
  if (!props.userId) return;
  loading.value = true;
  try {
    const r = await fetch(
      `${API}/stats/user/${props.userId}/activity-scores?detail=1`,
      { headers: { "x-user-id": String(authStore.user?.id || "") } },
    );
    if (r.ok) {
      const d = await r.json();
      total.value = d.total || 0;
      activities.value = d.activities || [];
    }
  } catch {
    /* silent */
  } finally {
    loading.value = false;
  }
};

watch(
  () => [props.open, props.userId],
  ([isOpen]) => {
    if (isOpen) load();
  },
  { immediate: true },
);
</script>

<template>
  <transition name="pb-fade">
    <div
      v-if="open"
      class="fixed inset-0 z-[300] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 font-sarabun"
      @click.self="$emit('close')"
    >
      <div
        class="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
      >
        <header
          class="flex items-center justify-between px-6 py-4 border-b border-slate-100"
        >
          <h3 class="font-bold text-slate-900">
            {{ title || "ที่มาของคะแนน" }}
          </h3>
          <button
            @click="$emit('close')"
            class="p-2 text-slate-400 hover:text-slate-700 rounded-full"
          >
            <X :size="20" />
          </button>
        </header>

        <div class="px-6 py-4 border-b border-slate-100">
          <p class="text-xs font-bold text-slate-400">คะแนนรวมจากกิจกรรม</p>
          <p class="text-3xl font-black text-orange-600">
            {{ total.toLocaleString() }}
          </p>
          <p class="text-[11px] text-slate-400 mt-1">
            = ผลรวมของ (คะแนนภารกิจ + โบนัส streak + คะแนนที่ปรับ) ทุกกิจกรรม
          </p>
        </div>

        <div class="flex-1 overflow-y-auto px-6 py-4">
          <div v-if="loading" class="py-10 flex justify-center text-slate-400">
            <Loader2 :size="28" class="animate-spin" />
          </div>
          <div
            v-else-if="activities.length === 0"
            class="text-slate-400 text-sm py-8 text-center"
          >
            ยังไม่มีข้อมูลคะแนน
          </div>
          <div v-else class="flex flex-col gap-3">
            <div
              v-for="a in activities"
              :key="a.event_id"
              class="border border-slate-100 rounded-2xl overflow-hidden"
            >
              <button
                @click="toggle(a.event_id)"
                class="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-slate-50"
              >
                <div class="min-w-0">
                  <p class="text-sm font-bold text-slate-700 truncate">
                    {{ a.title }}
                  </p>
                  <p class="text-xs text-slate-400">
                    ภารกิจ {{ a.base_points }} + streak {{ a.streak_bonus }} +
                    ปรับ {{ a.adjustment }}
                  </p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-sm font-black text-slate-900">{{
                    a.score.toLocaleString()
                  }}</span>
                  <ChevronDown
                    :size="16"
                    class="text-slate-400 transition-transform"
                    :class="{ 'rotate-180': expanded[a.event_id] }"
                  />
                </div>
              </button>

              <div
                v-if="expanded[a.event_id]"
                class="px-3 pb-3 border-t border-slate-100 pt-3 flex flex-col gap-3"
              >
                <div>
                  <p class="text-[11px] font-bold text-slate-400 mb-1">
                    ภารกิจที่อนุมัติ ({{ (a.missions || []).length }}) — รวม
                    {{ a.base_points }} คะแนน
                  </p>
                  <div
                    v-for="m in a.missions || []"
                    :key="m.submission_id"
                    class="flex justify-between text-xs text-slate-600 py-0.5"
                  >
                    <span class="truncate mr-2"
                      >{{ m.task_name }} · {{ fmtDate(m.date) }}</span
                    >
                    <span class="font-bold shrink-0">+{{ m.points }}</span>
                  </div>
                  <p
                    v-if="(a.missions || []).length === 0"
                    class="text-xs text-slate-300 italic"
                  >
                    ไม่มี
                  </p>
                </div>

                <div>
                  <p class="text-[11px] font-bold text-slate-400 mb-1">
                    โบนัส streak — ต่อเนื่อง {{ a.streak }} วัน →
                    {{ a.streak_bonus }} คะแนน
                  </p>
                </div>

                <div>
                  <p class="text-[11px] font-bold text-slate-400 mb-1">
                    คะแนนที่ปรับโดยแอดมิน ({{ (a.adjustments || []).length }}) —
                    รวม {{ a.adjustment }} คะแนน
                  </p>
                  <div
                    v-for="adj in a.adjustments || []"
                    :key="adj.id"
                    class="flex justify-between text-xs text-slate-600 py-0.5"
                  >
                    <span class="truncate mr-2"
                      >{{ adj.reason || "ไม่ระบุเหตุผล" }} ·
                      {{ fmtDate(adj.created_at) }}</span
                    >
                    <span class="font-bold shrink-0"
                      >{{ adj.points > 0 ? "+" : "" }}{{ adj.points }}</span
                    >
                  </div>
                  <p
                    v-if="(a.adjustments || []).length === 0"
                    class="text-xs text-slate-300 italic"
                  >
                    ไม่มี
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.pb-fade-enter-active,
.pb-fade-leave-active {
  transition: opacity 0.2s ease;
}
.pb-fade-enter-from,
.pb-fade-leave-to {
  opacity: 0;
}
</style>
```

- [ ] **Step 2: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/common/PointsBreakdownModal.vue
git commit -m "feat(common): shared points breakdown modal"
```

---

## Task 3: Wire breakdown into the three surfaces

**Files:**

- Modify: `src/composables/useAdminUsers.ts`
- Modify: `src/components/admin/AdminUsers.vue`
- Modify: `src/components/admin/user-detail/PointsTab.vue`
- Modify: `src/views/Profile.vue`

- [ ] **Step 1: Fetch the canonical total for the AdminUsers view modal**

In `src/composables/useAdminUsers.ts`, add state next to the other modal refs (after `const viewTanita = ref<any>({});`):

```ts
const viewScoreTotal = ref(0);
const showBreakdown = ref(false);
```

Add a loader function (place it right before `const openModal = ...`):

```ts
const loadViewScoreTotal = async (userId: number) => {
  viewScoreTotal.value = 0;
  try {
    const r = await fetch(`/api/stats/user/${userId}/activity-scores`, {
      headers: { "x-user-id": String(authStore.user?.id) },
    });
    if (r.ok) {
      const d = await r.json();
      viewScoreTotal.value = d.total || 0;
    }
  } catch {
    /* silent */
  }
};
```

In `setupModalData`, inside the existing `if (type === "view" || type === "edit") {` block, add as its first line:

```ts
if (type === "view") loadViewScoreTotal(user.id);
```

Export the new members in the composable's `return { ... }` (next to `viewTanita`):

```ts
    viewScoreTotal,
    showBreakdown,
```

- [ ] **Step 2: Replace the raw score fields in the AdminUsers view modal**

In `src/components/admin/AdminUsers.vue`, in the `view` modal's inline field array, delete these two entries:

```ts
                      {
                        label: 'คะแนนสะสมรวม',
                        val: target.total_score || '0.00',
                      },
                      { label: 'แต้ม (Points)', val: target.points || '0' },
```

Then, immediately after the closing `</div>` of that `v-for` field grid, add a dedicated score block:

```html
<div class="sm:col-span-2 flex flex-wrap items-baseline gap-x-8 gap-y-3 pt-2">
  <div class="flex items-baseline gap-2">
    <span class="text-slate-700 text-[13px] font-bold"
      >คะแนนสะสมรวม (กิจกรรม):</span
    >
    <button
      @click="showBreakdown = true"
      class="text-orange-600 text-base font-bold underline decoration-dotted underline-offset-4 hover:text-orange-700"
    >
      {{ viewScoreTotal.toLocaleString() }}
    </button>
  </div>
  <div class="flex items-baseline gap-2">
    <span class="text-slate-700 text-[13px] font-bold"
      >แต้ม (Points) — ใช้ในร้านค้า:</span
    >
    <span class="text-slate-800 text-base">{{ target.points || 0 }}</span>
  </div>
</div>
```

Add the modal at the end of the template, just before the final closing `</div>` of the root element:

```html
<PointsBreakdownModal
  :open="showBreakdown"
  :user-id="target?.id ?? null"
  @close="showBreakdown = false"
/>
```

Add the import in `<script setup>` (next to the other component imports):

```ts
import PointsBreakdownModal from "../common/PointsBreakdownModal.vue";
```

And pull the new state from the composable destructure (next to `viewTanita`):

```ts
  viewScoreTotal,
  showBreakdown,
```

- [ ] **Step 3: Add breakdown to the AdminUserDetail คะแนน tab**

In `src/components/admin/user-detail/PointsTab.vue`, add the import and state at the end of `<script setup>`:

```ts
import PointsBreakdownModal from "../../common/PointsBreakdownModal.vue";
import { useRoute } from "vue-router";
const route = useRoute();
const showBreakdown = ref(false);
```

Make the total clickable — replace:

```html
<div class="text-sm font-black text-orange-600">
  รวม {{ ctx.scoreTotal.value.toLocaleString() }} คะแนน
</div>
```

with:

```html
<button
  @click="showBreakdown = true"
  class="text-sm font-black text-orange-600 underline decoration-dotted underline-offset-4 hover:text-orange-700"
>
  รวม {{ ctx.scoreTotal.value.toLocaleString() }} คะแนน
</button>
```

Add the modal just before the final closing `</div>` of the template:

```html
<PointsBreakdownModal
  :open="showBreakdown"
  :user-id="Number(route.params.id)"
  @close="showBreakdown = false"
/>
```

- [ ] **Step 4: Make the Profile total clickable**

In `src/views/Profile.vue`, replace the total span in the `my-scores-card`:

```html
<span class="my-scores-total"
  >{{ scoreTotal.toLocaleString() }} {{ langStore.t("points") }}</span
>
```

with a button:

```html
<button
  class="my-scores-total my-scores-total-btn"
  @click="showBreakdown = true"
>
  {{ scoreTotal.toLocaleString() }} {{ langStore.t("points") }}
</button>
```

Add the import + state in `<script setup>` (next to the other imports):

```ts
import PointsBreakdownModal from "../components/common/PointsBreakdownModal.vue";
const showBreakdown = ref(false);
```

Add the modal just before the final closing `</div>` of the template:

```html
<PointsBreakdownModal
  :open="showBreakdown"
  :user-id="user?.id ?? null"
  @close="showBreakdown = false"
/>
```

Add the button style in the first (scoped) `<style>` block, next to `.my-scores-total`:

```css
.my-scores-total-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-decoration: underline dotted;
  text-underline-offset: 4px;
  font-family: inherit;
}
```

- [ ] **Step 5: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/composables/useAdminUsers.ts src/components/admin/AdminUsers.vue src/components/admin/user-detail/PointsTab.vue src/views/Profile.vue
git commit -m "feat(scores): clickable points breakdown on admin, detail, and profile"
```

---

## Task 4: Rankings — show the person's activity score in the modal

**Files:**

- Modify: `src/composables/useRankings.ts`
- Modify: `src/views/Rankings.vue`
- Modify: `src/components/SubmissionModal.vue`

- [ ] **Step 1: Keep the clicked leaderboard row**

In `src/composables/useRankings.ts`, the `openSubmissionModal(user)` function already stores `selectedUser`. That object _is_ the leaderboard row (it carries `base_points`, `streak`, `streak_bonus`, `adjustment`, `total_points`), so no new state is needed. Confirm the function reads:

```ts
const openSubmissionModal = (user: any) => {
  selectedUser.value = user;
  showSubmissionModal.value = true;
};
```

No change required in this file — this step is a verification only.

- [ ] **Step 2: Pass the row and unit into SubmissionModal**

In `src/views/Rankings.vue`, extend the `<SubmissionModal>` usage:

```html
<SubmissionModal
  :open="showSubmissionModal"
  :user="selectedUser"
  :score-row="activeTab === 'individual' ? selectedUser : null"
  :is-points="isPoints"
  :activity-id="selectedActivityId"
  :unit-short="rankingUnitShort"
  @close="closeSubmissionModal"
/>
```

- [ ] **Step 3: Render the score header in SubmissionModal**

In `src/components/SubmissionModal.vue`, extend the props:

```ts
const props = defineProps<{
  open: boolean;
  user: any;
  activityId: string | null;
  unitShort?: string;
  scoreRow?: any;
  isPoints?: boolean;
}>();
```

Add a score block right after the closing `</header>` of `sm-card` and before `<div class="sm-body">`:

```html
<div v-if="scoreRow" class="sm-score">
  <div class="sm-score-top">
    <span class="sm-score-label">คะแนนในกิจกรรมนี้</span>
    <span class="sm-score-val">
      {{ Number( isPoints ? (scoreRow.total_points ?? 0) :
      (scoreRow.total_unit_value ?? 0), ).toLocaleString() }}
      <span class="sm-score-unit">{{ isPoints ? "คะแนน" : unitShort }}</span>
    </span>
  </div>
  <p v-if="isPoints" class="sm-score-formula">
    ภารกิจ {{ scoreRow.base_points ?? 0 }} + streak {{ scoreRow.streak_bonus ??
    0 }} ({{ scoreRow.streak ?? 0 }} วัน) + ปรับ {{ scoreRow.adjustment ?? 0 }}
  </p>
</div>
```

Add the styles in `<style scoped>` (next to `.sm-header`):

```css
.sm-score {
  padding: 0.75rem 1.25rem;
  background: #fff7ed;
  border-bottom: 1px solid #ffedd5;
}
.sm-score-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}
.sm-score-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #9a3412;
}
.sm-score-val {
  font-size: 1.25rem;
  font-weight: 800;
  color: #ea580c;
}
.sm-score-unit {
  font-size: 0.75rem;
  font-weight: 600;
  color: #c2410c;
}
.sm-score-formula {
  margin: 0.25rem 0 0;
  font-size: 0.7rem;
  color: #b45309;
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/views/Rankings.vue src/components/SubmissionModal.vue
git commit -m "feat(rankings): show activity score breakdown in submission modal"
```

---

## Task 5: Pure mission-value helpers

**Files:**

- Create: `src/lib/missionValue.ts`
- Test: `scripts/mission-value.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/mission-value.test.ts`:

```ts
import assert from "node:assert/strict";
import { metricModeForTask, encodeMissionValue } from "../src/lib/missionValue";

// metricModeForTask
assert.equal(metricModeForTask({ submission_type: "time" } as any), "time");
assert.equal(metricModeForTask({ metric_type: "steps" } as any), "steps");
assert.equal(metricModeForTask({ metric_type: "distance" } as any), "number");
assert.equal(metricModeForTask({} as any), "number");
assert.equal(metricModeForTask(null as any), "number");

// encodeMissionValue — time is h*3600 + m*60 + s
assert.equal(
  encodeMissionValue({ mode: "time", h: "1", m: "2", s: "3" }),
  3723,
);
assert.equal(encodeMissionValue({ mode: "time" }), 0);
// steps -> integer
assert.equal(encodeMissionValue({ mode: "steps", steps: "1200" }), 1200);
assert.equal(encodeMissionValue({ mode: "steps", steps: "12.9" }), 12);
assert.equal(encodeMissionValue({ mode: "steps" }), 0);
// number -> float
assert.equal(encodeMissionValue({ mode: "number", num: "5.5" }), 5.5);
assert.equal(encodeMissionValue({ mode: "number", num: "" }), 0);
assert.equal(encodeMissionValue({ mode: "number", num: "abc" }), 0);

console.log("mission-value.test.ts OK");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx scripts/mission-value.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/missionValue'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/missionValue.ts`:

```ts
// Mission value encoding shared by the user submit flow and the admin editor,
// so both produce the same stored `submissions.value`.
// Pure — unit-tested via scripts/mission-value.test.ts.

export type MetricMode = "time" | "steps" | "number";

export interface TaskLike {
  submission_type?: string | null;
  metric_type?: string | null;
  metric_unit?: string | null;
}

/** Which input widget/encoding a task needs. Mirrors useMissions' metricMode. */
export function metricModeForTask(
  task: TaskLike | null | undefined,
): MetricMode {
  if (!task) return "number";
  if ((task.submission_type || "").toLowerCase() === "time") return "time";
  if ((task.metric_type || "").toLowerCase() === "steps") return "steps";
  return "number";
}

export interface MissionValueInput {
  mode: MetricMode;
  num?: string | number;
  steps?: string | number;
  h?: string | number;
  m?: string | number;
  s?: string | number;
}

/** Encode the entered value into the numeric `submissions.value`. */
export function encodeMissionValue(input: MissionValueInput): number {
  const int = (v: any) => parseInt(String(v ?? ""), 10) || 0;
  if (input.mode === "time") {
    return int(input.h) * 3600 + int(input.m) * 60 + int(input.s);
  }
  if (input.mode === "steps") return int(input.steps);
  const n = parseFloat(String(input.num ?? ""));
  return isNaN(n) ? 0 : n;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx scripts/mission-value.test.ts`
Expected: PASS — prints `mission-value.test.ts OK`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/missionValue.ts scripts/mission-value.test.ts
git commit -m "feat(missions): pure mission value encoding helpers with tests"
```

---

## Task 6: Composable support for mission editing

**Files:**

- Modify: `src/composables/useAdminUserDetail.ts`

- [ ] **Step 1: Add task loading and image upload**

In `src/composables/useAdminUserDetail.ts`, add these functions right after `loadActivityScores`:

```ts
/** Tasks of one activity, for the add-mission task picker. */
const fetchActivityTasks = async (eventId: number): Promise<any[]> => {
  try {
    const r = await fetch(`${API}/activities/${eventId}`, {
      headers: headers(false),
    });
    if (!r.ok) return [];
    const d = await r.json();
    return d.tasks || [];
  } catch {
    return [];
  }
};

/** Upload a proof image; returns the stored URL (same endpoint the user flow uses). */
const uploadProofImage = async (
  file: File,
  taskLabel = "mission",
): Promise<string | null> => {
  try {
    const params = new URLSearchParams({
      type: "submissions",
      name: taskLabel,
    });
    const formData = new FormData();
    formData.append("image", file);
    const r = await fetch(`${API.replace(/\/api$/, "")}/api/upload?${params}`, {
      method: "POST",
      headers: { "x-user-id": String(authStore.user?.id || "") },
      body: formData,
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error || "อัปโหลดรูปไม่สำเร็จ");
    }
    const d = await r.json();
    return d.url || null;
  } catch (e: any) {
    showError(e.message || "อัปโหลดรูปไม่สำเร็จ");
    return null;
  }
};
```

> The `API.replace(...)` keeps the upload path correct whether `VITE_API_URL` is
> `/api` (dev) or a full origin — `/api/upload` is mounted outside the API router prefix.

- [ ] **Step 2: Refresh scores after a submission edit**

The existing `editSubmission`, `setSubmissionStatus`, and `deleteSubmission` already call `load()`, and `load()` now calls `loadActivityScores()` — so score refresh is already covered. No change needed; this step is verification only.

- [ ] **Step 3: Export the new helpers**

Add to the composable's `return { ... }` (next to `backdateSubmit`):

```ts
    fetchActivityTasks,
    uploadProofImage,
```

- [ ] **Step 4: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/composables/useAdminUserDetail.ts
git commit -m "feat(admin): activity task loading + proof image upload helpers"
```

---

## Task 7: Missions tab — edit row + activity/task pickers

**Files:**

- Modify: `src/components/admin/user-detail/MissionsTab.vue`

- [ ] **Step 1: Replace the component**

Replace the entire contents of `src/components/admin/user-detail/MissionsTab.vue`:

```vue
<script setup lang="ts">
import { ref, computed, watch } from "vue";
import {
  Check,
  X,
  Trash2,
  Plus,
  Loader2,
  Pencil,
  Upload,
} from "lucide-vue-next";
import { safeImageUrl } from "../../../lib/safeUrl";
import {
  metricModeForTask,
  encodeMissionValue,
} from "../../../lib/missionValue";
const props = defineProps<{ ctx: any }>();

const statusLabel = (s: string) =>
  s === "approved" ? "อนุมัติ" : s === "rejected" ? "ปฏิเสธ" : "รอตรวจ";
const statusClass = (s: string) =>
  s === "approved"
    ? "bg-emerald-100 text-emerald-700"
    : s === "rejected"
      ? "bg-rose-100 text-rose-700"
      : "bg-amber-100 text-amber-700";
const fmt = (d: string) =>
  d
    ? new Date(d).toLocaleDateString("th-TH", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      })
    : "—";
const toDateInput = (d: string) => (d ? String(d).slice(0, 10) : "");

const grouped = computed(() => {
  const map: Record<string, any[]> = {};
  for (const s of props.ctx.submissions.value) {
    const key = s.event_title || "อื่น ๆ";
    (map[key] ||= []).push(s);
  }
  return map;
});

// ── Edit an existing submission ───────────────────────────────
const editingId = ref<number | null>(null);
const editForm = ref<any>({
  value: 0,
  textResponse: "",
  note: "",
  created_at: "",
  imageUrl: "",
});
const editUploading = ref(false);

const startEdit = (s: any) => {
  editingId.value = s.id;
  editForm.value = {
    value: Number(s.value) || 0,
    textResponse: s.text_response || "",
    note: s.comment || "",
    created_at: toDateInput(s.created_at),
    imageUrl: s.img_url || "",
  };
};
const cancelEdit = () => {
  editingId.value = null;
};
const onEditFile = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  editUploading.value = true;
  const url = await props.ctx.uploadProofImage(file, "admin-edit");
  editUploading.value = false;
  if (url) editForm.value.imageUrl = url;
};
const saveEdit = async () => {
  if (editingId.value == null) return;
  await props.ctx.editSubmission(editingId.value, {
    value: Number(editForm.value.value) || 0,
    imageUrl: editForm.value.imageUrl || null,
    textResponse: editForm.value.textResponse || null,
    note: editForm.value.note || null,
    created_at: editForm.value.created_at || undefined,
  });
  editingId.value = null;
};

// ── Add a submission (any date) ───────────────────────────────
const showAdd = ref(false);
const addEventId = ref<number | null>(null);
const tasks = ref<any[]>([]);
const addTaskId = ref<number | null>(null);
const addForm = ref<any>({
  num: "",
  steps: "",
  h: "",
  m: "",
  s: "",
  textResponse: "",
  status: "approved",
  created_at: "",
  imageUrl: "",
});
const addUploading = ref(false);

const selectedTask = computed(
  () =>
    tasks.value.find((t) => Number(t.id) === Number(addTaskId.value)) || null,
);
const mode = computed(() => metricModeForTask(selectedTask.value));
const submissionType = computed(() =>
  (selectedTask.value?.submission_type || "manual").toLowerCase(),
);
const needsText = computed(
  () => submissionType.value === "text" || submissionType.value === "both",
);
const needsPhoto = computed(
  () => submissionType.value === "photo" || submissionType.value === "both",
);

watch(addEventId, async (id) => {
  addTaskId.value = null;
  tasks.value = id ? await props.ctx.fetchActivityTasks(Number(id)) : [];
});

const onAddFile = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  addUploading.value = true;
  const url = await props.ctx.uploadProofImage(
    file,
    selectedTask.value?.note || "mission",
  );
  addUploading.value = false;
  if (url) addForm.value.imageUrl = url;
};

const resetAdd = () => {
  addEventId.value = null;
  addTaskId.value = null;
  tasks.value = [];
  addForm.value = {
    num: "",
    steps: "",
    h: "",
    m: "",
    s: "",
    textResponse: "",
    status: "approved",
    created_at: "",
    imageUrl: "",
  };
};

const submitAdd = async () => {
  if (!addTaskId.value) return;
  const value = encodeMissionValue({
    mode: mode.value,
    num: addForm.value.num,
    steps: addForm.value.steps,
    h: addForm.value.h,
    m: addForm.value.m,
    s: addForm.value.s,
  });
  await props.ctx.backdateSubmit({
    taskId: Number(addTaskId.value),
    value,
    imageUrl: addForm.value.imageUrl || undefined,
    textResponse: addForm.value.textResponse || undefined,
    activity_type: selectedTask.value?.type || undefined,
    proof_type: selectedTask.value?.submission_type || undefined,
    status: addForm.value.status,
    created_at: addForm.value.created_at || undefined,
  });
  showAdd.value = false;
  resetAdd();
};
</script>

<template>
  <div>
    <div class="flex justify-between items-center mb-4">
      <p class="text-sm font-bold text-slate-500">
        ทั้งหมด {{ ctx.submissions.value.length }} รายการ
      </p>
      <button
        @click="showAdd = !showAdd"
        class="bg-orange-500 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-orange-600"
      >
        <Plus :size="16" /> เพิ่มภารกิจ
      </button>
    </div>

    <!-- Add form -->
    <div
      v-if="showAdd"
      class="border border-slate-200 rounded-2xl p-4 mb-6 flex flex-col gap-3"
    >
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label class="flex flex-col gap-1">
          <span class="text-xs font-bold text-slate-500">กิจกรรม</span>
          <select
            v-model="addEventId"
            class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
          >
            <option :value="null">— เลือกกิจกรรม —</option>
            <option
              v-for="r in ctx.registrations.value"
              :key="r.event_id"
              :value="r.event_id"
            >
              {{ r.title }}
            </option>
          </select>
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs font-bold text-slate-500">ภารกิจ</span>
          <select
            v-model="addTaskId"
            :disabled="!addEventId"
            class="border border-slate-200 rounded-xl px-3 py-2 text-sm disabled:bg-slate-50"
          >
            <option :value="null">— เลือกภารกิจ —</option>
            <option v-for="t in tasks" :key="t.id" :value="t.id">
              {{ t.note || t.type }} ({{ t.points }} คะแนน)
            </option>
          </select>
        </label>
      </div>

      <template v-if="selectedTask">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <!-- value input adapts to the task metric -->
          <div v-if="mode === 'time'" class="flex flex-col gap-1">
            <span class="text-xs font-bold text-slate-500"
              >เวลา (ชม./นาที/วินาที)</span
            >
            <div class="flex gap-2">
              <input
                v-model="addForm.h"
                type="number"
                min="0"
                placeholder="ชม."
                class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
              <input
                v-model="addForm.m"
                type="number"
                min="0"
                placeholder="นาที"
                class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
              <input
                v-model="addForm.s"
                type="number"
                min="0"
                placeholder="วินาที"
                class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>
          <label v-else-if="mode === 'steps'" class="flex flex-col gap-1">
            <span class="text-xs font-bold text-slate-500">จำนวนก้าว</span>
            <input
              v-model="addForm.steps"
              type="number"
              min="0"
              class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
          </label>
          <label v-else class="flex flex-col gap-1">
            <span class="text-xs font-bold text-slate-500"
              >ค่า
              {{
                selectedTask.metric_unit
                  ? "(" + selectedTask.metric_unit + ")"
                  : ""
              }}</span
            >
            <input
              v-model="addForm.num"
              type="number"
              step="0.01"
              class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
          </label>

          <label class="flex flex-col gap-1">
            <span class="text-xs font-bold text-slate-500"
              >วันที่บันทึก (ย้อนหลัง/อนาคตได้)</span
            >
            <input
              v-model="addForm.created_at"
              type="date"
              class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
          </label>

          <label v-if="needsText" class="flex flex-col gap-1 sm:col-span-2">
            <span class="text-xs font-bold text-slate-500">ข้อความตอบกลับ</span>
            <textarea
              v-model="addForm.textResponse"
              rows="2"
              class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
            ></textarea>
          </label>

          <div class="flex flex-col gap-1 sm:col-span-2">
            <span class="text-xs font-bold text-slate-500">
              รูปหลักฐาน {{ needsPhoto ? "(จำเป็น)" : "(ถ้ามี)" }}
            </span>
            <div class="flex items-center gap-3">
              <label
                class="cursor-pointer inline-flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 text-sm"
              >
                <Loader2 v-if="addUploading" :size="14" class="animate-spin" />
                <Upload v-else :size="14" />
                เลือกรูป
                <input
                  type="file"
                  accept="image/*"
                  class="hidden"
                  @change="onAddFile"
                />
              </label>
              <img
                v-if="safeImageUrl(addForm.imageUrl)"
                :src="safeImageUrl(addForm.imageUrl)"
                class="w-14 h-14 rounded-lg object-cover border border-slate-200"
              />
            </div>
          </div>

          <label class="flex flex-col gap-1">
            <span class="text-xs font-bold text-slate-500">สถานะ</span>
            <select
              v-model="addForm.status"
              class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
            >
              <option value="approved">อนุมัติ</option>
              <option value="pending">รอตรวจ</option>
              <option value="rejected">ปฏิเสธ</option>
            </select>
          </label>
        </div>

        <div class="flex justify-end gap-2">
          <button
            @click="
              showAdd = false;
              resetAdd();
            "
            class="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 bg-slate-100"
          >
            ยกเลิก
          </button>
          <button
            @click="submitAdd"
            :disabled="ctx.submitting.value || !addTaskId"
            class="bg-orange-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Loader2
              v-if="ctx.submitting.value"
              :size="16"
              class="animate-spin"
            />
            <Check v-else :size="16" /> บันทึก
          </button>
        </div>
      </template>
    </div>

    <!-- Existing submissions -->
    <div v-for="(list, group) in grouped" :key="group" class="mb-6">
      <h3
        class="text-xs font-black text-slate-400 uppercase tracking-widest mb-2"
      >
        {{ group }}
      </h3>
      <div class="flex flex-col gap-2">
        <div
          v-for="s in list"
          :key="s.id"
          class="border border-slate-100 rounded-2xl p-3"
        >
          <div class="flex items-center gap-3">
            <img
              v-if="safeImageUrl(s.img_url)"
              :src="safeImageUrl(s.img_url)"
              class="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0"
            />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-bold text-slate-700 truncate">
                {{ s.task_name || "ภารกิจ" }}
              </p>
              <p class="text-xs text-slate-400">
                {{ fmt(s.created_at) }} · ค่า {{ s.value }}
              </p>
            </div>
            <span
              class="text-[10px] font-bold px-2 py-1 rounded-md"
              :class="statusClass(s.status)"
            >
              {{ statusLabel(s.status) }}
            </span>
            <button
              @click="startEdit(s)"
              class="p-2 text-slate-500 hover:bg-slate-50 rounded-lg"
              title="แก้ไข"
            >
              <Pencil :size="16" />
            </button>
            <button
              v-if="s.status !== 'approved'"
              @click="ctx.setSubmissionStatus(s.id, 'approved')"
              class="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg"
              title="อนุมัติ"
            >
              <Check :size="16" />
            </button>
            <button
              v-if="s.status !== 'rejected'"
              @click="ctx.setSubmissionStatus(s.id, 'rejected')"
              class="p-2 text-amber-600 hover:bg-amber-50 rounded-lg"
              title="ปฏิเสธ"
            >
              <X :size="16" />
            </button>
            <button
              @click="ctx.deleteSubmission(s.id)"
              class="p-2 text-rose-600 hover:bg-rose-50 rounded-lg"
              title="ลบ"
            >
              <Trash2 :size="16" />
            </button>
          </div>

          <!-- Inline editor -->
          <div
            v-if="editingId === s.id"
            class="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            <label class="flex flex-col gap-1">
              <span class="text-xs font-bold text-slate-500">ค่า</span>
              <input
                v-model="editForm.value"
                type="number"
                step="0.01"
                class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs font-bold text-slate-500">วันที่บันทึก</span>
              <input
                v-model="editForm.created_at"
                type="date"
                class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
            </label>
            <label class="flex flex-col gap-1 sm:col-span-2">
              <span class="text-xs font-bold text-slate-500"
                >ข้อความตอบกลับ</span
              >
              <textarea
                v-model="editForm.textResponse"
                rows="2"
                class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
              ></textarea>
            </label>
            <label class="flex flex-col gap-1 sm:col-span-2">
              <span class="text-xs font-bold text-slate-500">หมายเหตุ</span>
              <input
                v-model="editForm.note"
                class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
            </label>
            <div class="flex flex-col gap-1 sm:col-span-2">
              <span class="text-xs font-bold text-slate-500">รูปหลักฐาน</span>
              <div class="flex items-center gap-3">
                <label
                  class="cursor-pointer inline-flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 text-sm"
                >
                  <Loader2
                    v-if="editUploading"
                    :size="14"
                    class="animate-spin"
                  />
                  <Upload v-else :size="14" />
                  เปลี่ยนรูป
                  <input
                    type="file"
                    accept="image/*"
                    class="hidden"
                    @change="onEditFile"
                  />
                </label>
                <img
                  v-if="safeImageUrl(editForm.imageUrl)"
                  :src="safeImageUrl(editForm.imageUrl)"
                  class="w-14 h-14 rounded-lg object-cover border border-slate-200"
                />
                <button
                  v-if="editForm.imageUrl"
                  @click="editForm.imageUrl = ''"
                  class="text-xs font-bold text-rose-600"
                >
                  ลบรูป
                </button>
              </div>
            </div>
            <div class="sm:col-span-2 flex justify-end gap-2">
              <button
                @click="cancelEdit"
                class="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 bg-slate-100"
              >
                ยกเลิก
              </button>
              <button
                @click="saveEdit"
                :disabled="ctx.submitting.value"
                class="bg-orange-500 text-white px-5 py-2 rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50"
              >
                <Loader2
                  v-if="ctx.submitting.value"
                  :size="16"
                  class="animate-spin"
                />
                <Check v-else :size="16" /> บันทึก
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="ctx.submissions.value.length === 0"
      class="text-slate-400 text-sm py-8 text-center"
    >
      ยังไม่มีภารกิจที่ส่ง
    </div>
  </div>
</template>
```

- [ ] **Step 2: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/user-detail/MissionsTab.vue
git commit -m "feat(admin): edit submission image/value + activity-task mission picker"
```

---

## Task 8: Extract the 3อ2ส assessment module

**Files:**

- Create: `src/lib/healthAssessment.ts`
- Test: `scripts/health-assessment.test.ts`
- Modify: `src/views/Health.vue`

- [ ] **Step 1: Create the module by moving the definition out of Health.vue**

Create `src/lib/healthAssessment.ts`. Move the type declarations (`Option`, `Question`, `ScoringRange`, `Section`) and the **entire `sections` array verbatim** from `src/views/Health.vue` lines 75–555 (`const sections: Section[] = [ ... ];`), exporting both, then add the pure scoring helpers:

```ts
export interface Option {
  text: string;
  shortLabel: string;
  score: number;
}
export interface Question {
  id: string;
  text: string;
  options: Option[];
}
export interface ScoringRange {
  min: number;
  max: number;
  level: string;
  desc: string;
  advice: string;
}
export interface Section {
  id: string;
  label: string;
  shortLabel: string;
  questions: Question[];
  maxScore: number;
  scoringRanges: ScoringRange[];
  layout: "grid" | "list";
  gridHeaders?: string[];
}

// ─── ข้อมูลแบบประเมินอิงตามไฟล์ PDF ───
export const sections: Section[] = [
  /* ← paste the existing array from Health.vue lines 75–555 unchanged */
];

/** Sum the scores of the selected options for one section. */
export function scoreSection(
  section: Section,
  answers: Record<string, string>,
): number {
  let score = 0;
  for (const q of section.questions) {
    const opt = q.options.find((o) => o.text === answers[q.id]);
    if (opt) score += opt.score;
  }
  return score;
}

/** The scoring range a section score falls into (last range as fallback). */
export function levelForSection(section: Section, score: number): ScoringRange {
  return (
    section.scoringRanges.find((r) => score >= r.min && score <= r.max) ||
    section.scoringRanges[section.scoringRanges.length - 1]
  );
}

/** Overall level = the worst section level present. Mirrors Health.vue. */
export function overallLevelFromSectionLevels(levels: string[]): string {
  if (levels.includes("ควรปรับปรุง")) return "ควรปรับปรุง";
  if (levels.includes("พอใช้")) return "พอใช้";
  if (levels.includes("ดี")) return "ดี";
  return "ดีมาก";
}

/** Total across all sections. */
export function totalScore(answers: Record<string, string>): number {
  return sections.reduce((t, s) => t + scoreSection(s, answers), 0);
}
```

- [ ] **Step 2: Write the test**

Create `scripts/health-assessment.test.ts`:

```ts
import assert from "node:assert/strict";
import {
  sections,
  scoreSection,
  levelForSection,
  overallLevelFromSectionLevels,
  totalScore,
} from "../src/lib/healthAssessment";

// The definition survived the move intact.
assert.ok(sections.length >= 5, "expected at least 5 sections (3อ2ส)");
const food = sections.find((s) => s.id === "food")!;
assert.ok(food, "food section exists");
assert.equal(food.maxScore, 40);

// scoreSection sums the chosen options.
const firstQ = food.questions[0];
const topOpt = firstQ.options[0];
const answers: Record<string, string> = { [firstQ.id]: topOpt.text };
assert.equal(scoreSection(food, answers), topOpt.score);
// unanswered -> 0
assert.equal(scoreSection(food, {}), 0);

// levelForSection resolves each range boundary.
for (const r of food.scoringRanges) {
  assert.equal(levelForSection(food, r.min).level, r.level, `min ${r.min}`);
  assert.equal(levelForSection(food, r.max).level, r.level, `max ${r.max}`);
}

// overall level = worst present
assert.equal(overallLevelFromSectionLevels(["ดีมาก", "ดี"]), "ดี");
assert.equal(overallLevelFromSectionLevels(["ดีมาก", "พอใช้", "ดี"]), "พอใช้");
assert.equal(
  overallLevelFromSectionLevels(["ดี", "ควรปรับปรุง", "พอใช้"]),
  "ควรปรับปรุง",
);
assert.equal(overallLevelFromSectionLevels(["ดีมาก"]), "ดีมาก");
assert.equal(overallLevelFromSectionLevels([]), "ดีมาก");

// totalScore sums across sections
assert.equal(totalScore({}), 0);
assert.equal(totalScore(answers), topOpt.score);

console.log("health-assessment.test.ts OK");
```

- [ ] **Step 3: Run the test**

Run: `npx tsx scripts/health-assessment.test.ts`
Expected: PASS — prints `health-assessment.test.ts OK`.

- [ ] **Step 4: Make Health.vue import the module**

In `src/views/Health.vue`, delete the local type declarations and the `const sections: Section[] = [...]` block (lines 75–555 region), and add to the imports at the top of `<script setup>`:

```ts
import {
  sections,
  type Section,
  type Question,
  type Option,
  type ScoringRange,
} from "../lib/healthAssessment";
```

Leave every other computed in `Health.vue` untouched — `sectionScores` and `overallLevel` keep working because they only reference `sections`.

- [ ] **Step 5: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 6: Verify Health page still works**

Start the preview and open `/health`. Confirm the assessment renders all 5 sections and the result page shows section scores + overall level as before.

- [ ] **Step 7: Commit**

```bash
git add src/lib/healthAssessment.ts scripts/health-assessment.test.ts src/views/Health.vue
git commit -m "refactor(health): extract 3อ2ส definition + scoring into shared module"
```

---

## Task 9: Assessment read/update endpoints

**Files:**

- Modify: `server/routes/health.ts`

- [ ] **Step 1: Add the answers read endpoint**

In `server/routes/health.ts`, add this route right after the existing `router.get("/my-assessments/:userId", ...)` handler:

```ts
// Granular answers for one health assessment (self or admin/host).
router.get("/assessments/:id/answers", async (req, res) => {
  const requesterId = req.headers["x-user-id"];
  const { id } = req.params;
  if (!requesterId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const [ownerRows]: any = await pool.query(
      "SELECT user_id FROM health_assessments WHERE id = ?",
      [id],
    );
    if (ownerRows.length === 0)
      return res.status(404).json({ error: "Assessment not found" });

    const [reqRows]: any = await pool.query(
      "SELECT role FROM users WHERE id = ?",
      [requesterId],
    );
    const role = reqRows[0]?.role;
    const isSelf = String(requesterId) === String(ownerRows[0].user_id);
    if (!isSelf && role !== "admin" && role !== "host") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const [rows]: any = await pool.query(
      "SELECT id, question_text, answer_text, score FROM assessment_answers WHERE health_assessment_id = ?",
      [id],
    );
    res.json(rows);
  } catch (e: any) {
    if (e.code === "ER_NO_SUCH_TABLE") return res.json([]);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
```

- [ ] **Step 2: Add the admin update endpoint**

Add this route immediately after the one above:

```ts
// Admin: update a health assessment (scores + granular answers).
router.put("/assessments/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const adminId = req.headers["x-user-id"] as string;
  const { totalScore, overallLevel, sectionScores, granularAnswers } = req.body;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [exists]: any = await connection.query(
      "SELECT id, user_id FROM health_assessments WHERE id = ? FOR UPDATE",
      [id],
    );
    if (exists.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Assessment not found" });
    }

    await connection.query(
      "UPDATE health_assessments SET total_score = ?, overall_level = ?, summary_json = ? WHERE id = ?",
      [
        Number(totalScore) || 0,
        overallLevel || null,
        JSON.stringify(sectionScores || []),
        id,
      ],
    );

    if (Array.isArray(granularAnswers)) {
      await connection.query(
        "DELETE FROM assessment_answers WHERE health_assessment_id = ?",
        [id],
      );
      if (granularAnswers.length > 0) {
        const placeholders: string[] = [];
        const values: any[] = [];
        for (const a of granularAnswers) {
          placeholders.push("(?, ?, ?, ?)");
          values.push(
            id,
            a.question_text || "",
            a.answer_text || "",
            Number(a.score) || 0,
          );
        }
        await connection.query(
          `INSERT INTO assessment_answers (health_assessment_id, question_text, answer_text, score) VALUES ${placeholders.join(", ")}`,
          values,
        );
      }
    }

    await connection.commit();

    await logAudit({
      req,
      userId: adminId,
      action: "admin_update_assessment",
      targetType: "health_assessment",
      targetId: id,
      description: `แอดมินแก้ไขผลประเมินสุขภาพ ID: ${id} (ผู้ใช้ ${exists[0].user_id})`,
      metadata: { totalScore, overallLevel },
    });

    res.json({ success: true });
  } catch (error: any) {
    await connection.rollback();
    console.error("[update assessment] error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    connection.release();
  }
});
```

- [ ] **Step 3: Ensure the imports exist**

At the top of `server/routes/health.ts`, confirm `logAudit` and `requireAdmin` are imported; if either is missing, add:

```ts
import { logAudit } from "../lib/audit.js";
import { requireAdmin } from "../middleware/auth.js";
```

- [ ] **Step 4: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routes/health.ts
git commit -m "feat(health): assessment answers read + admin update endpoints"
```

---

## Task 10: Editable AssessmentsTab

**Files:**

- Modify: `src/components/admin/user-detail/AssessmentsTab.vue`

- [ ] **Step 1: Replace the component**

Replace the entire contents of `src/components/admin/user-detail/AssessmentsTab.vue`:

```vue
<script setup lang="ts">
import { ref, computed } from "vue";
import { Pencil, Save, X, Loader2 } from "lucide-vue-next";
import { authStore } from "../../../store/auth";
import { showSuccess, showError } from "../../../lib/swal";
import {
  sections,
  scoreSection,
  levelForSection,
  overallLevelFromSectionLevels,
} from "../../../lib/healthAssessment";
const props = defineProps<{ ctx: any }>();

const API = import.meta.env.VITE_API_URL || "/api";
const fmt = (d: string) =>
  d
    ? new Date(d).toLocaleDateString("th-TH", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      })
    : "—";
const testLabel = (t: string) =>
  t === "pre_test" ? "ก่อนเข้าร่วม" : t === "post_test" ? "หลังจบ" : t;

// ── Editor state ──────────────────────────────────────────────
const editingId = ref<number | null>(null);
const answers = ref<Record<string, string>>({});
const loadingAnswers = ref(false);
const saving = ref(false);

const liveSections = computed(() =>
  sections.map((s) => {
    const score = scoreSection(s, answers.value);
    const range = levelForSection(s, score);
    return { section: s, score, level: range.level, maxScore: s.maxScore };
  }),
);
const liveTotal = computed(() =>
  liveSections.value.reduce((t, s) => t + s.score, 0),
);
const liveOverall = computed(() =>
  overallLevelFromSectionLevels(liveSections.value.map((s) => s.level)),
);

const startEdit = async (a: any) => {
  editingId.value = a.id;
  answers.value = {};
  loadingAnswers.value = true;
  try {
    const r = await fetch(`${API}/health/assessments/${a.id}/answers`, {
      headers: { "x-user-id": String(authStore.user?.id || "") },
    });
    if (r.ok) {
      const rows = await r.json();
      // Stored answers key on question_text; match back to the definition.
      for (const row of rows) {
        for (const s of sections) {
          const q = s.questions.find((q) => q.text === row.question_text);
          if (q) {
            answers.value[q.id] = row.answer_text;
            break;
          }
        }
      }
    }
  } catch {
    /* silent */
  } finally {
    loadingAnswers.value = false;
  }
};
const cancelEdit = () => {
  editingId.value = null;
  answers.value = {};
};

const save = async () => {
  if (editingId.value == null) return;
  saving.value = true;
  try {
    const granularAnswers: any[] = [];
    for (const s of sections) {
      for (const q of s.questions) {
        const val = answers.value[q.id];
        if (!val) continue;
        const opt = q.options.find((o) => o.text === val);
        granularAnswers.push({
          question_text: q.text,
          answer_text: val,
          score: opt?.score || 0,
        });
      }
    }
    const r = await fetch(`${API}/health/assessments/${editingId.value}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": String(authStore.user?.id || ""),
      },
      body: JSON.stringify({
        totalScore: liveTotal.value,
        overallLevel: liveOverall.value,
        sectionScores: liveSections.value.map((s) => ({
          sectionId: s.section.id,
          score: s.score,
          level: s.level,
        })),
        granularAnswers,
      }),
    });
    if (!r.ok)
      throw new Error(
        (await r.json().catch(() => ({}))).error || "บันทึกไม่สำเร็จ",
      );
    showSuccess("บันทึกผลประเมินสำเร็จ");
    cancelEdit();
    await props.ctx.load();
  } catch (e: any) {
    showError(e.message);
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div class="flex flex-col gap-8 max-w-3xl">
    <!-- Editor -->
    <section
      v-if="editingId !== null"
      class="border border-orange-200 rounded-2xl p-4"
    >
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-black text-slate-700">แก้ไขผลประเมิน</h3>
        <div class="text-right">
          <p class="text-xs font-bold text-slate-400">คะแนนรวม</p>
          <p class="text-2xl font-black text-orange-600">
            {{ liveTotal }} <span class="text-sm">({{ liveOverall }})</span>
          </p>
        </div>
      </div>

      <div
        v-if="loadingAnswers"
        class="py-8 flex justify-center text-slate-400"
      >
        <Loader2 :size="24" class="animate-spin" />
      </div>

      <div v-else class="flex flex-col gap-6">
        <div
          v-for="ls in liveSections"
          :key="ls.section.id"
          class="border border-slate-100 rounded-2xl p-3"
        >
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-sm font-bold text-slate-700">
              {{ ls.section.label }}
            </h4>
            <span class="text-xs font-black text-slate-900 shrink-0">
              {{ ls.score }}/{{ ls.maxScore }} · {{ ls.level }}
            </span>
          </div>
          <div class="flex flex-col gap-3">
            <div v-for="q in ls.section.questions" :key="q.id">
              <p class="text-xs text-slate-600 mb-1">{{ q.text }}</p>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="o in q.options"
                  :key="o.text"
                  @click="answers[q.id] = o.text"
                  class="px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors"
                  :class="
                    answers[q.id] === o.text
                      ? 'bg-orange-500 border-orange-500 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-orange-300'
                  "
                >
                  {{ o.shortLabel || o.text }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2 mt-4">
        <button
          @click="cancelEdit"
          class="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 bg-slate-100"
        >
          <X :size="16" class="inline" /> ยกเลิก
        </button>
        <button
          @click="save"
          :disabled="saving"
          class="bg-orange-500 text-white px-5 py-2 rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50"
        >
          <Loader2 v-if="saving" :size="16" class="animate-spin" />
          <Save v-else :size="16" /> บันทึก
        </button>
      </div>
    </section>

    <!-- List -->
    <section>
      <h3
        class="text-xs font-black text-slate-400 uppercase tracking-widest mb-3"
      >
        แบบประเมินสุขภาพ (3อ2ส)
      </h3>
      <div v-if="ctx.assessments.value.length" class="flex flex-col gap-2">
        <div
          v-for="a in ctx.assessments.value"
          :key="a.id"
          class="border border-slate-100 rounded-2xl p-3 flex items-center justify-between gap-2"
        >
          <div class="min-w-0">
            <p class="text-sm font-bold text-slate-700">
              คะแนนรวม {{ a.total_score ?? "—" }} · {{ a.overall_level || "—" }}
            </p>
            <p class="text-xs text-slate-400">{{ fmt(a.created_at) }}</p>
          </div>
          <button
            @click="startEdit(a)"
            class="p-2 text-slate-500 hover:bg-slate-50 rounded-lg shrink-0"
            title="แก้ไข"
          >
            <Pencil :size="16" />
          </button>
        </div>
      </div>
      <p v-else class="text-slate-400 text-sm">ยังไม่มีผลประเมิน</p>
    </section>

    <!-- Event pre/post tests (read-only) -->
    <section>
      <h3
        class="text-xs font-black text-slate-400 uppercase tracking-widest mb-3"
      >
        คะแนนทดสอบก่อน/หลังกิจกรรม
      </h3>
      <div
        v-if="ctx.assessmentSubmissions.value.length"
        class="flex flex-col gap-2"
      >
        <div
          v-for="s in ctx.assessmentSubmissions.value"
          :key="s.id"
          class="border border-slate-100 rounded-2xl p-3 flex items-center justify-between"
        >
          <div>
            <p class="text-sm font-bold text-slate-700">
              {{ s.event_title || "กิจกรรม #" + s.event_id }} ·
              {{ testLabel(s.test_type) }}
            </p>
            <p class="text-xs text-slate-400">{{ fmt(s.submitted_at) }}</p>
          </div>
          <span class="text-sm font-black text-orange-600">{{
            s.total_score ?? "—"
          }}</span>
        </div>
      </div>
      <p v-else class="text-slate-400 text-sm">ยังไม่มีคะแนนทดสอบ</p>
    </section>
  </div>
</template>
```

- [ ] **Step 2: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/user-detail/AssessmentsTab.vue
git commit -m "feat(admin): editable per-section assessment with live scoring"
```

---

## Task 11: Final verification pass

- [ ] **Step 1: Full typecheck + all unit tests**

Run: `npm run lint`
Expected: PASS.
Run: `npx tsx scripts/mission-value.test.ts && npx tsx scripts/health-assessment.test.ts`
Expected: PASS.
Run: `npx tsx scripts/activity-score.test.ts && npx tsx scripts/admin-submission.test.ts && npx tsx scripts/streak-scoring.test.ts`
Expected: PASS (no regressions).

- [ ] **Step 2: Restart the preview server**

Backend files changed, so restart the `vitalcare-dev` preview (stop + start) before browser testing, or the new routes will 404.

- [ ] **Step 3: Browser verification**

With DB up (`docker compose up -d db`), logged in as admin:

- **Breakdown consistency:** open `/admin/users/:id` → คะแนน, click the total → the modal's total matches the tab total; expand an activity and confirm the mission list sums to `base_points` and the adjustment list sums to `adjustment`.
- **AdminUsers modal:** open the `รายละเอียดผู้ใช้งาน` modal for the same user → `คะแนนสะสมรวม (กิจกรรม)` equals the number above and opens the same breakdown; `แต้ม (Points)` shows the shop value.
- **Profile:** open `/profile` → events tab → the total is clickable and matches.
- **Rankings:** open `/rankings?eventId=<id>`, click a person → the modal header shows their score for that activity with the `ภารกิจ + streak + ปรับ` line, matching the row.
- **Missions edit:** in `/admin/users/:id` → ภารกิจ, edit a submission's value and upload a replacement image; confirm both persist after reload and the คะแนน tab total reflects any change.
- **Missions add:** use เพิ่มภารกิจ → pick activity → pick task → fill value/image/date (use a **future** date once and a **past** date once) → confirm both save and appear with the chosen dates.
- **Assessments:** in ผลประเมิน, click แก้ไข on a record, change answers in two different sections, confirm the per-section score/level and the grand total update live, save, and confirm the list row shows the new total after reload.

Check `read_console_messages` (no errors) and `read_network_requests` (all 2xx) throughout. Capture a screenshot as evidence.

- [ ] **Step 4: Confirm Health.vue is unaffected**

Open `/health` as a normal user and run through one section to confirm the extraction in Task 8 didn't change user-facing scoring.

---

## Self-review notes

- **Spec coverage:** detail endpoint (T1); shared breakdown UI (T2); three surfaces incl. canonical total replacing raw `total_score` (T3); Rankings modal score (T4); mission value helpers (T5); task loading + upload (T6); mission edit image/value + activity→task picker with past/future dates (T7); assessment module extraction (T8); assessment endpoints (T9); per-section editable assessments with per-section + total scoring (T10). All spec sections map to tasks.
- **Type/name consistency:** `metricModeForTask`/`encodeMissionValue` (T5) used in T7. `scoreSection`/`levelForSection`/`overallLevelFromSectionLevels`/`sections` (T8) used in T10. `fetchActivityTasks`/`uploadProofImage` (T6) called in T7. `PointsBreakdownModal` props (`open`, `userId`, `title`) defined in T2 and used identically in T3.
- **Reuse over new:** mission edit uses the existing `PATCH /api/missions/submission/:id` (already accepts `created_at`); add uses the existing `POST /api/missions/admin/submit`; image upload uses the existing `/api/upload`; Rankings needs no endpoint (row already carries the breakdown).
- **Known limitation (documented in spec):** `assessment_answers` stores `question_text`, so the editor matches answers by exact text; a question whose wording changed will come back unanswered rather than mismatched.
- **Testing honesty:** only the two pure modules are unit-tested (repo has no DB/component harness); everything else is typecheck + browser-verified.
