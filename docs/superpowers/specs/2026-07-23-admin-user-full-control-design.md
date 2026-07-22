# Admin user full-control: edit everything for a member from a dedicated page

Date: 2026-07-23
Status: Approved (design) — pending plan review

## Problem

Today the admin "จัดการสมาชิก" screen (`src/components/admin/AdminUsers.vue` +
`src/composables/useAdminUsers.ts`) can only: edit a small set of profile fields,
edit/create **one** tanita (body-composition) row (weight/height focus),
ban/unban, kick, delete, and enroll/kick activities. It cannot:

1. Edit **all** body-composition values, or manage the user's full tanita **history**.
2. Adjust the **points** a user has.
3. Manage the user's **submitted missions** — and crucially, submit on the user's
   behalf **backdated** to a chosen date (the current `/api/missions/submit`
   defaults `created_at` to `NOW()` and blocks a second submission for the same
   task via a `CURDATE()` idempotency check).
4. **View** the user's assessment/test scores.

We want a place where an admin can act on behalf of a user and edit _everything_
that belongs to that user, correctly and completely.

## Decisions (from brainstorming Q&A)

- **UI:** a **dedicated full page** at route `/admin/users/:id` (admin-only), not
  an expanded modal. The existing AdminUsers table gets a menu entry that
  navigates here. The existing quick-edit modal stays for light edits.
- **Points:** admin can **directly set** the user's `points` and `total_score`
  (absolute values), written with an `audit_logs` entry and a realtime
  `USER_UPDATED` emit. (Direct override is intentional; see "Points integrity".)
- **Missions:** full management — create (including **backdated** to a chosen
  date), edit (value/image/text/note/date), approve/reject, delete — with points
  flowing correctly to `users` and `event_leaderboards`.
- **Body composition:** full **CRUD with history** — list all tanita records, add
  (backdated `recorded_at`), edit any field of any record, delete.
- **Assessments:** **read-only** view of the user's health assessments
  (`health_assessments`) and event pre/post test scores
  (`assessment_submissions`). No editing of assessment content in this iteration.

## Existing building blocks (reused, not rebuilt)

- `GET /api/users/:id/full-profile` (requireAdmin) → `{ user, submissions,
healthHistory (tanita), registrations }`. Extended here (see below).
- `PATCH /api/users/:id` (self/admin) — profile fields (encrypted where needed).
- Missions: `PATCH /api/missions/:id/status` (approve/reject + points),
  `PATCH /api/missions/submission/:id` (edit value/img/text/note),
  `DELETE /api/missions/submission/:id` (delete + point reversal).
- Tanita: `POST /api/tanita`, `PATCH /api/tanita/:id`, `GET /api/tanita/user/:userId`.
- Assessments: `GET /api/health/my-assessments/:userId` (health_assessments).
- Activity enrollment: `POST /api/activities/admin/enroll`, `.../admin/kick`,
  `.../admin/kick-bulk`, `GET /api/activities/user/:userId/registered`.

## Architecture

### Route + views (frontend)

- New route in `src/router/index.ts`:
  `{ path: "/admin/users/:id", name: "AdminUserDetail",
 component: () => import("../views/AdminUserDetail.vue"),
 meta: { title: "จัดการข้อมูลสมาชิก", hideNavbar: true, requiresAdmin: true } }`.
- New view `src/views/AdminUserDetail.vue` — header (avatar, name, role/status,
  back button) + a tab bar. Tabs:
  1. **โปรไฟล์** — all editable profile fields (reuses `PATCH /api/users/:id`).
  2. **คะแนน** — show current `points`/`total_score`; set new absolute values.
  3. **ภารกิจ** — table of the user's submissions grouped by activity; row actions
     approve/reject/edit/delete; "เพิ่มภารกิจย้อนหลัง" to create a backdated
     submission for a chosen task + date + value + proof + status.
  4. **ค่าร่างกาย** — list of tanita records (history); add/edit/delete with all fields.
  5. **ผลประเมิน** — read-only health assessments + pre/post test scores.
  6. **กิจกรรม** — enroll / remove activities (reuses admin enroll/kick).
- New composable `src/composables/useAdminUserDetail.ts` — owns all state + API
  calls for the page (keeps the view thin, mirrors the `useAdminUsers` pattern).
- Entry point: in `AdminUsers.vue` 3-dots menu add "จัดการข้อมูลทั้งหมด" →
  `router.push('/admin/users/' + user.id)`.

### Backend endpoints

New/extended, all admin-guarded with the existing `requireAdmin` middleware
(`server/middleware/auth.ts`) unless noted:

1. **Extend** `GET /api/users/:id/full-profile` — also return:
   - `assessments`: rows from `health_assessments` (newest first).
   - `assessmentSubmissions`: rows from `assessment_submissions` joined to event
     titles (pre/post test scores).
   - (User row already carries `points` + `total_score`.)

2. **`PATCH /api/users/:id/points`** (requireAdmin) — body `{ points?, total_score? }`,
   non-negative integers. Updates the user row, writes `audit_logs`
   (`action: "admin_set_points"`, metadata with old/new), emits `USER_UPDATED`.

3. **`POST /api/missions/admin/submit`** (admin) — body `{ userId, taskId, value,
imageUrl?, textResponse?, activity_type?, proof_type?, status?, created_at }`.
   - Inserts a submission with the given `created_at` (backdate allowed) and
     `status` (default `approved`).
   - Idempotency keyed on `DATE(created_at)` (not `CURDATE()`), so past dates work
     and duplicates for the same task+day are prevented.
   - If final status is `approved` and the task has points: award `task.points`
     to `users.points`/`total_score` and to `event_leaderboards` (same logic as
     the existing submit path), plus `awardDailyMission(userId, dateStr)` keyed on
     the chosen date (idempotent via `score_events`).
   - Audit + `SUBMISSION_CREATED` emit.

4. **Extend** `PATCH /api/missions/submission/:id` — accept an optional
   `created_at` (admin) so an existing submission's date can be corrected. Value/
   image/text/note behavior unchanged; no point change on edit (as today).

5. **`DELETE /api/tanita/:id`** (admin/self) — permission check mirrors the
   existing `PATCH /api/tanita/:id`; deletes the record. (POST/PATCH already exist;
   POST will get an explicit admin/self permission check to match.)

6. Assessments stay **read-only** — served by the extended full-profile payload;
   no write endpoints.

### Data flow

```
AdminUsers table ──(row menu)──▶ /admin/users/:id (AdminUserDetail.vue)
                                     │ useAdminUserDetail.ts
   load ─────────────────────────▶ GET /api/users/:id/full-profile
                                     (user, submissions, tanita, registrations,
                                      assessments, assessmentSubmissions)
   Profile save ────────────────▶ PATCH /api/users/:id
   Points save ─────────────────▶ PATCH /api/users/:id/points
   Backdated mission ───────────▶ POST /api/missions/admin/submit
   Mission edit/approve/delete ─▶ PATCH /api/missions/submission/:id,
                                   PATCH /api/missions/:id/status,
                                   DELETE /api/missions/submission/:id
   Body comp add/edit/delete ───▶ POST /api/tanita, PATCH /api/tanita/:id,
                                   DELETE /api/tanita/:id
   Activities ──────────────────▶ POST /api/activities/admin/enroll | kick
```

## Points integrity (explicit)

`users.points`/`total_score` are the aggregate the UI ranks on. The config-driven
engine (`score_events`) and `event_leaderboards` are separate ledgers. This
feature's **direct points set** intentionally overrides the aggregate without
rewriting those ledgers — it is an admin escape hatch, logged in `audit_logs`.
Mission approve/reject/delete continue to keep `users` and `event_leaderboards`
in sync as they do today. We do **not** attempt to reconcile `score_events` on a
manual set (out of scope; documented so future readers understand the divergence).

## Security

- Every write endpoint here requires `role === 'admin'` (via `requireAdmin`), the
  same gate used across `server/routes/user.ts` admin actions.
- Admin cannot set negative points; values are coerced to `>= 0` integers.
- All mutations write `audit_logs` with the acting admin id and target user id.

## Error handling

- Backend keeps the existing try/catch + JSON error shape; transactional routes
  (missions) keep their `beginTransaction`/`rollback`.
- Frontend uses the existing `showSuccess`/`showError`/`showConfirm` (SweetAlert)
  helpers and disables buttons while `submitting`.

## Testing

Repo has **no** DB/component test harness (only pure-function `scripts/*.test.ts`
run via `tsx`), so:

- **Pure unit test:** a small date/idempotency helper for the backdated-submit
  path (e.g. `toMysqlDateTime(input)` and "same calendar day" comparison)
  extracted to a pure module and tested with `node:assert`.
- **Typecheck:** `npm run lint` (vue-tsc) after every task.
- **Browser verification** (local MySQL + dev server): open `/admin/users/:id`,
  exercise each tab — set points and confirm it reflects in the row + rankings;
  create a backdated approved mission and confirm points + leaderboard update and
  the submission shows the chosen date; add/edit/delete a tanita record; confirm
  assessments render read-only.

## Out of scope

- Editing assessment/test answers or scores (view only this iteration).
- Reconciling `score_events` when points are set manually.
- Bulk cross-user operations from the detail page (bulk stays in the table view).
- Any change to how normal (non-admin) users submit missions.
