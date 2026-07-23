# Score transparency + admin editing of missions & assessments

Date: 2026-07-23
Status: Approved (design) — pending plan review

## Problem

Four gaps remain after the unified-scoring work:

1. **Rankings** shows a score per row, but clicking a person (SubmissionModal) shows
   only their recent submissions — not their score in the currently open activity
   or how it was made up.
2. **`รายละเอียดผู้ใช้งาน` modal** (`AdminUsers.vue`, the `view` modal) still shows the
   raw DB fields `total_score` / `points`, which disagree with the canonical
   activity-based total. Neither is clickable, so there is no way to see _where_
   the points came from or _how_ they were computed.
3. **AdminUserDetail → ภารกิจ**: existing submissions can only be
   approved/rejected/deleted — the uploaded **image** and the numeric **value**
   cannot be edited. The "เพิ่มภารกิจย้อนหลัง" form asks for a raw **Task ID** and a
   bare value, instead of letting the admin pick the activity → task and fill in
   the same fields a user fills when submitting.
4. **AdminUserDetail → ผลประเมิน** is read-only. Assessments should be editable
   the same way the user takes them (per section, per question), with per-section
   scores recomputed and a total shown.

## Decisions (from brainstorming Q&A)

- **Rankings:** the person's activity score is shown **in the SubmissionModal**
  (when clicking a row), not as a separate "my score" card.
- **Displayed total:** use the **canonical** activity total
  (`Σ per-activity (task points + streak bonus + adjustment)`) in place of raw
  `total_score`; `users.points` stays but is labelled explicitly as shop currency.
- **Assessment editing:** admin **re-answers each question** per section (same as
  the user flow); the system recomputes per-section scores, level, and total.
- **Breakdown drill-down** available on: the AdminUsers `รายละเอียดผู้ใช้งาน` modal,
  the AdminUserDetail **คะแนน** tab, and the user's own **Profile**.

## Canonical formula (unchanged, from the previous spec)

```
score(U,E) = base(U,E) + streak_bonus(U,E) + adjustment(U,E)      // points, clamped >= 0
total(U)   = Σ_E score(U,E)   over U's joined activities
```

`base` = Σ `task.points` of approved submissions in E; `streak_bonus` from
`master_configs` tiers (points-metric activities only); `adjustment` =
`SUM(bonus_points.points)` for (U,E).

## Architecture

### 1. Breakdown data (backend)

Extend `GET /api/stats/user/:userId/activity-scores` with an optional
`?detail=1`. When set, each activity in the response also carries:

```ts
missions: Array<{
  submission_id: number;
  task_name: string;
  date: string;
  points: number;
}>;
adjustments: Array<{
  id: number;
  points: number;
  reason: string | null;
  created_at: string;
}>;
```

- `missions` = the approved submissions that make up `base_points` (task note as
  `task_name`), newest first.
- `adjustments` = the `bonus_points` rows that make up `adjustment`.
- Permission unchanged: self OR admin/host.

This makes the response self-explanatory: `base_points` is the sum of `missions`,
`streak_bonus` is derived from `streak` via the config tiers, and `adjustment` is
the sum of `adjustments`.

### 2. Shared breakdown UI

New `src/components/common/PointsBreakdownModal.vue`:

- Props: `open`, `userId`, optional `title`.
- Fetches `/api/stats/user/:userId/activity-scores?detail=1` when opened.
- Renders: the **total**, then one expandable card per activity showing the
  formula line (`ภารกิจ X + streak Y + ปรับ Z = score`), the contributing mission
  list (task name · date · points), and the adjustment list (points · reason · date).
- Used by AdminUsers modal, AdminUserDetail คะแนน tab, and Profile.

### 3. Surfaces

- **AdminUsers `view` modal** (`AdminUsers.vue`): the two score entries move out of
  the generic field loop into a dedicated block:
  - `คะแนนสะสมรวม (กิจกรรม)` → canonical total, **clickable** → PointsBreakdownModal.
  - `แต้ม (Points) — ใช้ในร้านค้า` → `users.points`, unchanged value, relabelled.
    The canonical total is fetched via the activity-scores endpoint when the modal opens.
- **AdminUserDetail → คะแนน**: existing per-activity list gains an expandable
  detail (missions + adjustments) using the same `detail=1` payload.
- **Profile**: the existing "คะแนนของฉัน" card total becomes clickable → PointsBreakdownModal.
- **Rankings → SubmissionModal**: `Rankings.vue` already has the full leaderboard
  row (`base_points`, `streak`, `streak_bonus`, `adjustment`, `total_points`) from
  `computeActivityLeaderboard`. Pass that row in as a new `scoreRow` prop and render
  a score header (score + formula breakdown) for the open activity. **No new
  endpoint and no permission concern** — the row is already public in the leaderboard.

### 4. Missions tab — edit + proper backdate form

`MissionsTab.vue` is rewritten around the real submit flow:

- **Edit an existing submission** (new inline editor per row):
  - numeric **value**, **text response**, **note**, **date** (`created_at`), and
    **image** (upload a replacement, or clear).
  - Saves via the existing `PATCH /api/missions/submission/:id` (already accepts
    `value`, `imageUrl`, `textResponse`, `note`, `activity_type`, `created_at`).
- **Add (backdated or future) submission**:
  - **Activity** dropdown ← the user's `registrations`.
  - **Task** dropdown ← `GET /api/activities/:eventId` → `tasks[]` (id, note, type,
    points, metric_type, metric_unit, submission_type).
  - Fields mirror the user submit flow, driven by the selected task:
    - value input adapts to the metric (`steps` → integer; time → h/m/s converted
      to seconds; otherwise decimal), matching `useMissions.submitTask()`.
    - **image upload** via `POST /api/upload?type=submissions&name=<task>` (FormData
      `image`, header `x-user-id`) → `{ url }` — the same endpoint the user flow uses.
    - **text response** when `submission_type` is `text`/`both`.
    - **status** (approved / pending / rejected) and **date** — a plain date input
      with no min/max, so past _or_ future dates are allowed.
  - Saves via the existing `POST /api/missions/admin/submit`.

Shared value-encoding helper extracted to `src/lib/missionValue.ts`
(`encodeMissionValue({ mode, num, steps, h, m, s })` + `metricModeForTask(task)`)
so the admin form and the user flow agree; unit-tested.

### 5. Assessments tab — editable, per section

- **Extract** the 3อ2ส definition out of `Health.vue` into
  `src/lib/healthAssessment.ts`: the `sections` array (id, label, shortLabel,
  maxScore, layout, gridHeaders, scoringRanges, questions[{id, text, options[{text,
  shortLabel, score}]}]) plus pure helpers `scoreSection(section, answers)`,
  `levelForSection(section, score)`, `overallLevelFromSectionLevels(levels)`.
  Note: the overall level is the **worst** section level
  (ควรปรับปรุง > พอใช้ > ดี > ดีมาก), not a function of the total score —
  this mirrors `Health.vue`'s existing `overallLevel` computed. `Health.vue` imports
  from it (no behavior change); the admin editor imports the same module so both
  score identically.
- **Backend**:
  - `GET /api/health/assessments/:id/answers` (admin/host or self) → the
    `assessment_answers` rows (`question_text`, `answer_text`, `score`) for that
    `health_assessment_id`, so the editor can prefill.
  - `PUT /api/health/assessments/:id` (admin) → body `{ totalScore, overallLevel,
sectionScores, granularAnswers }`; updates `health_assessments`
    (`total_score`, `overall_level`, `summary_json`) and **replaces** that
    assessment's `assessment_answers` rows in one transaction; writes `audit_logs`.
- **`AssessmentsTab.vue`**: each assessment row gets an **แก้ไข** action opening an
  editor that renders every section with its questions and options (prefilled from
  the stored answers, matched by `question_text`), shows a live **per-section score
  - level** and a **grand total** at the top, and saves via the PUT above. The
    existing read-only list also gains the total per record.

> Answer matching note: `assessment_answers` stores `question_text` (not a question
> id). The editor matches stored answers to the definition by exact `question_text`,
> falling back to unanswered if a question's text has since changed. This is
> recorded as a known limitation rather than a schema migration.

## Security

- `?detail=1` reuses the existing self-or-admin/host guard on activity-scores.
- Assessment write endpoint is admin-only (`requireAdmin`); the answers read is
  self-or-admin/host.
- Mission edit/add continue to use the existing admin-guarded endpoints.
- The Rankings breakdown uses data already present in the public leaderboard payload.

## Error handling

- Backend keeps the existing try/catch + JSON error shape; the assessment PUT is
  transactional (rollback on failure).
- Frontend keeps `showSuccess`/`showError`/`showConfirm` and disables controls
  while `submitting`. Image upload failures surface an error and leave the form
  intact.

## Testing

Repo has no DB/component harness (only pure `tsx` tests), so:

- **Pure unit tests:** `encodeMissionValue`/`metricModeForTask`
  (`src/lib/missionValue.ts`) and
  `scoreSection`/`levelForSection`/`overallLevelFromSectionLevels`
  (`src/lib/healthAssessment.ts`) — including boundary scores at each
  `scoringRanges` edge.
- **Typecheck:** `npm run lint` after each task.
- **Browser verification:** breakdown modal totals match the คะแนน tab and Rankings;
  edit a submission's value+image and confirm it persists and the score updates;
  add a backdated submission via the activity→task pickers; edit an assessment and
  confirm per-section scores, level, and total recompute and persist.

## Out of scope

- Changing how points are _awarded_ (`score_events`, `awardDailyMission`).
- Migrating `assessment_answers` to store question ids.
- Editing `assessment_submissions` (event pre/post test rows) — only
  `health_assessments` become editable.
- Reconciling `users.points` (shop currency) with the canonical activity total.
