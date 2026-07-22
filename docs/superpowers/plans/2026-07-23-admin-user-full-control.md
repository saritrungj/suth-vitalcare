# Admin user full-control detail page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give admins a dedicated page (`/admin/users/:id`) to edit everything for one member — profile, points (direct set), missions (incl. backdated submissions), full body-composition CRUD + history — and to view assessment/test scores.

**Architecture:** New admin-only route + view `AdminUserDetail.vue` composed of six tab components, driven by one composable `useAdminUserDetail.ts`. Backend gains a few admin endpoints (set points, backdated mission submit, tanita delete) and extends the existing `full-profile` payload with assessments. A pure date helper makes the backdate/idempotency logic unit-testable.

**Tech Stack:** Node + Express + mysql2 (backend), Vue 3 `<script setup>` + composable + SweetAlert helpers (frontend), pure `tsx` + `node:assert/strict` tests.

**Reference spec:** `docs/superpowers/specs/2026-07-23-admin-user-full-control-design.md`

**Testing note:** This repo has **no** DB/component test harness — only pure-function tests run via `tsx`. So: the pure date helper gets real unit tests; everything else is verified with `npm run lint` (vue-tsc) + browser preview (local MySQL via `docker compose up -d db`, dev server via the `vitalcare-dev` preview). Do not invent a test runner.

---

## File Structure

- **Create** `server/lib/adminSubmission.ts` — pure: `toMysqlDateTime()`, `dayOf()`, `sameCalendarDay()`.
- **Create** `scripts/admin-submission.test.ts` — pure unit tests.
- **Modify** `server/routes/user.ts` — extend `GET /:id/full-profile` (assessments); add `PATCH /:id/points`.
- **Modify** `server/routes/mission.ts` — add `POST /admin/submit` (backdated); extend `PATCH /submission/:id` to accept `created_at`.
- **Modify** `server/routes/tanita.ts` — add `DELETE /:id`; add admin/self permission check to `POST /`.
- **Modify** `src/router/index.ts` — add `/admin/users/:id` route.
- **Create** `src/composables/useAdminUserDetail.ts` — page state + all API calls.
- **Create** `src/views/AdminUserDetail.vue` — header + tab bar + `<component :is>`.
- **Create** `src/components/admin/user-detail/ProfileTab.vue`
- **Create** `src/components/admin/user-detail/PointsTab.vue`
- **Create** `src/components/admin/user-detail/MissionsTab.vue`
- **Create** `src/components/admin/user-detail/BodyCompTab.vue`
- **Create** `src/components/admin/user-detail/AssessmentsTab.vue`
- **Create** `src/components/admin/user-detail/ActivitiesTab.vue`
- **Modify** `src/components/admin/AdminUsers.vue` — add "จัดการข้อมูลทั้งหมด" menu entry linking to the page.

---

## Task 1: Pure admin-submission date helpers

**Files:**

- Create: `server/lib/adminSubmission.ts`
- Test: `scripts/admin-submission.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/admin-submission.test.ts`:

```ts
import assert from "node:assert/strict";
import {
  toMysqlDateTime,
  dayOf,
  sameCalendarDay,
} from "../server/lib/adminSubmission";

// Date-only input → local noon (avoids timezone day-rollover), MySQL format.
assert.equal(toMysqlDateTime("2026-07-10"), "2026-07-10 12:00:00");

// Full datetime input is preserved.
assert.equal(toMysqlDateTime("2026-07-10 08:30:15"), "2026-07-10 08:30:15");

// Output always matches the MySQL DATETIME shape.
const re = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
assert.match(toMysqlDateTime(), re, "no input → now, valid format");
assert.match(toMysqlDateTime("not-a-date"), re, "invalid → now, valid format");

// dayOf extracts the calendar day.
assert.equal(dayOf("2026-07-10 08:30:15"), "2026-07-10");
assert.equal(dayOf("2026-07-10"), "2026-07-10");

// sameCalendarDay compares only the day part.
assert.equal(
  sameCalendarDay("2026-07-10 01:00:00", "2026-07-10 23:00:00"),
  true,
);
assert.equal(
  sameCalendarDay("2026-07-10 01:00:00", "2026-07-11 01:00:00"),
  false,
);

console.log("admin-submission.test.ts OK");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx scripts/admin-submission.test.ts`
Expected: FAIL — `Cannot find module '../server/lib/adminSubmission'`.

- [ ] **Step 3: Write the implementation**

Create `server/lib/adminSubmission.ts`:

```ts
// Pure date helpers for admin (possibly backdated) mission submissions.
// NO database imports — unit-tested via scripts/admin-submission.test.ts.

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Normalise an input into a MySQL DATETIME string "YYYY-MM-DD HH:mm:ss" in
 * local wall-clock. A bare "YYYY-MM-DD" is anchored at local noon so timezone
 * offsets can't roll it to the previous/next day. Invalid input falls back to now.
 */
export function toMysqlDateTime(input?: string | Date): string {
  let d: Date;
  if (!input) d = new Date();
  else if (input instanceof Date) d = input;
  else if (/^\d{4}-\d{2}-\d{2}$/.test(input)) d = new Date(`${input}T12:00:00`);
  else d = new Date(input);
  if (isNaN(d.getTime())) d = new Date();
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/** Calendar-day portion ("YYYY-MM-DD") of a datetime or date string. */
export function dayOf(value: string): string {
  return String(value).slice(0, 10);
}

/** True when two datetime/date strings fall on the same calendar day. */
export function sameCalendarDay(a: string, b: string): boolean {
  return dayOf(a) === dayOf(b);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx scripts/admin-submission.test.ts`
Expected: PASS — prints `admin-submission.test.ts OK`.

- [ ] **Step 5: Commit**

```bash
git add server/lib/adminSubmission.ts scripts/admin-submission.test.ts
git commit -m "feat(admin): add pure date helpers for backdated submissions"
```

---

## Task 2: Extend `full-profile` with assessments

**Files:**

- Modify: `server/routes/user.ts`

- [ ] **Step 1: Add assessment queries to `GET /:id/full-profile`**

In `server/routes/user.ts`, in `router.get("/:id/full-profile", requireAdmin, ...)`, after the registrations query (section D, the `regRows` block) and before `res.json({ ... })`, add:

```ts
// E. Health assessments (self-assessments) — newest first
let assessments: any[] = [];
try {
  const [aRows]: any = await pool.query(
    `SELECT id, user_id, total_score, overall_level, admin_comment,
                commented_at, commented_by, created_at, summary_json
           FROM health_assessments
          WHERE user_id = ?
          ORDER BY created_at DESC`,
    [id],
  );
  assessments = aRows;
} catch (e: any) {
  if (e.code !== "ER_NO_SUCH_TABLE") throw e;
}

// F. Event pre/post test scores, joined to event titles
let assessmentSubmissions: any[] = [];
try {
  const [asRows]: any = await pool.query(
    `SELECT asub.id, asub.event_id, asub.test_type, asub.total_score,
                asub.submitted_at, e.title AS event_title
           FROM assessment_submissions asub
           LEFT JOIN events e ON asub.event_id = e.id
          WHERE asub.user_id = ?
          ORDER BY asub.submitted_at DESC`,
    [id],
  );
  assessmentSubmissions = asRows;
} catch (e: any) {
  if (e.code !== "ER_NO_SUCH_TABLE") throw e;
}
```

- [ ] **Step 2: Include them in the response**

Change the existing `res.json({ user, submissions: subRows, healthHistory: healthDecrypted, registrations: regRows });` to:

```ts
res.json({
  user,
  submissions: subRows,
  healthHistory: healthDecrypted,
  registrations: regRows,
  assessments,
  assessmentSubmissions,
});
```

- [ ] **Step 3: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/routes/user.ts
git commit -m "feat(user): include assessments in admin full-profile payload"
```

---

## Task 3: `PATCH /api/users/:id/points`

**Files:**

- Modify: `server/routes/user.ts`

- [ ] **Step 1: Add the endpoint**

In `server/routes/user.ts`, add this route next to the other admin user routes (e.g. right after the `router.patch("/:id/ban", ...)` block). It must appear **before** the generic `router.patch("/:id", ...)` handlers is not required (path is distinct), but keep it with the admin group:

```ts
// Admin: directly set a user's points / total_score (manual override).
router.patch("/:id/points", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const adminId = req.headers["x-user-id"] as string;
  const { points, total_score } = req.body;

  const toNonNegInt = (v: any) => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = Math.round(Number(v));
    return isNaN(n) ? undefined : Math.max(0, n);
  };
  const p = toNonNegInt(points);
  const ts = toNonNegInt(total_score);
  if (p === undefined && ts === undefined) {
    return res.status(400).json({ error: "No valid points values provided" });
  }

  try {
    const [rows]: any = await pool.query(
      "SELECT points, total_score FROM users WHERE id = ?",
      [id],
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "User not found" });
    const before = { points: rows[0].points, total_score: rows[0].total_score };

    const sets: string[] = [];
    const vals: any[] = [];
    if (p !== undefined) {
      sets.push("points = ?");
      vals.push(p);
    }
    if (ts !== undefined) {
      sets.push("total_score = ?");
      vals.push(ts);
    }
    await pool.query(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, [
      ...vals,
      id,
    ]);

    await logAudit({
      req,
      userId: adminId,
      action: "admin_set_points",
      targetType: "user",
      targetId: id,
      description: `แอดมินปรับคะแนนผู้ใช้ ID: ${id}`,
      metadata: { before, after: { points: p, total_score: ts } },
    });

    getIO().emit(EVENTS.USER_UPDATED, {
      id: Number(id),
      ...(p !== undefined ? { points: p } : {}),
      ...(ts !== undefined ? { total_score: ts } : {}),
    });

    res.json({ success: true, points: p, total_score: ts });
  } catch (error: any) {
    console.error("[admin set points] error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
```

> `logAudit`, `getIO`, `EVENTS`, and `requireAdmin` are already imported at the top of `server/routes/user.ts`.

- [ ] **Step 2: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add server/routes/user.ts
git commit -m "feat(user): admin endpoint to set points/total_score directly"
```

---

## Task 4: Backdated admin mission submit + editable date

**Files:**

- Modify: `server/routes/mission.ts`

- [ ] **Step 1: Import helpers + admin middleware**

At the top of `server/routes/mission.ts`, add:

```ts
import { requireAdmin } from "../middleware/auth.js";
import { toMysqlDateTime, dayOf } from "../lib/adminSubmission.js";
```

- [ ] **Step 2: Add the backdated admin submit endpoint**

Add this route (place it before `export default router;`):

```ts
// Admin: create a submission on behalf of a user, optionally backdated.
router.post("/admin/submit", requireAdmin, async (req, res) => {
  const adminId = req.headers["x-user-id"] as string;
  const {
    userId,
    taskId,
    value,
    imageUrl,
    textResponse,
    activity_type,
    proof_type,
    status,
    created_at,
  } = req.body;

  if (!userId || !taskId) {
    return res.status(400).json({ error: "userId and taskId are required" });
  }
  const finalStatus = ["approved", "pending", "rejected"].includes(status)
    ? status
    : "approved";
  const mysqlDate = toMysqlDateTime(created_at);
  const day = dayOf(mysqlDate);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Idempotency by calendar day of the (possibly backdated) submission.
    const [existing]: any = await connection.query(
      `SELECT id FROM submissions WHERE user_id = ? AND task_id = ? AND DATE(created_at) = ? LIMIT 1`,
      [userId, taskId, day],
    );
    if (existing.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        error: "มีการส่งภารกิจนี้ในวันดังกล่าวแล้ว",
        submissionId: existing[0].id,
      });
    }

    const approvedAt = finalStatus === "approved" ? mysqlDate : null;
    const approvedBy = finalStatus === "approved" ? adminId : null;
    const [result]: any = await connection.query(
      `INSERT INTO submissions
        (user_id, task_id, value, img_url, text_response, status,
         activity_type, proof_type, approved_by, approved_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        taskId,
        value || 0,
        imageUrl || null,
        textResponse || null,
        finalStatus,
        activity_type || "exercise",
        proof_type || "manual",
        approvedBy,
        approvedAt,
        mysqlDate,
      ],
    );
    const insertId = result.insertId;

    const [taskRows]: any = await connection.query(
      "SELECT points, event_id FROM tasks WHERE id = ?",
      [taskId],
    );
    const task = taskRows[0] || null;

    if (finalStatus === "approved" && task?.points) {
      await connection.query(
        "UPDATE users SET points = points + ?, total_score = total_score + ? WHERE id = ?",
        [task.points, task.points, userId],
      );
      if (task.event_id) {
        const [lb]: any = await connection.query(
          "SELECT id FROM event_leaderboards WHERE event_id = ? AND user_id = ?",
          [task.event_id, userId],
        );
        if (lb.length > 0) {
          await connection.query(
            "UPDATE event_leaderboards SET score = score + ? WHERE id = ?",
            [task.points, lb[0].id],
          );
        } else {
          await connection.query(
            "INSERT INTO event_leaderboards (event_id, user_id, score, `rank`) VALUES (?, ?, ?, 0)",
            [task.event_id, userId, task.points],
          );
        }
      }
    }

    await connection.commit();

    // Config-driven daily-mission scoring keyed on the chosen day (idempotent).
    if (finalStatus === "approved") {
      awardDailyMission(Number(userId), day).catch(() => {});
    }

    await logAudit({
      req,
      userId: adminId,
      action: "admin_backdate_submission",
      targetType: "submission",
      targetId: insertId,
      description: `แอดมินเพิ่มภารกิจ (task ${taskId}) ให้ผู้ใช้ ${userId} วันที่ ${day}`,
      metadata: {
        userId,
        taskId,
        value,
        status: finalStatus,
        created_at: mysqlDate,
      },
    });

    const [rows]: any = await pool.query(
      `SELECT s.*, t.event_id as activity_id FROM submissions s JOIN tasks t ON s.task_id = t.id WHERE s.id = ?`,
      [insertId],
    );
    getIO().emit(EVENTS.SUBMISSION_CREATED, rows[0]);

    res.json({ success: true, submissionId: insertId });
  } catch (error: any) {
    await connection.rollback();
    console.error("[admin submit] error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    connection.release();
  }
});
```

- [ ] **Step 3: Allow editing a submission's `created_at`**

In the existing `router.patch("/submission/:id", ...)`, replace the body-destructure line:

```ts
const { value, imageUrl, textResponse, note, activity_type } = req.body;
```

with:

```ts
const { value, imageUrl, textResponse, note, activity_type, created_at } =
  req.body;
```

Then replace the `UPDATE submissions ...` query and params with a version that conditionally sets `created_at`:

```ts
if (created_at) {
  await connection.query(
    `UPDATE submissions SET value = ?, img_url = ?, text_response = ?, comment = ?, activity_type = ?, created_at = ? WHERE id = ?`,
    [
      value,
      imageUrl,
      textResponse || null,
      note,
      activity_type || "exercise",
      toMysqlDateTime(created_at),
      id,
    ],
  );
} else {
  await connection.query(
    `UPDATE submissions SET value = ?, img_url = ?, text_response = ?, comment = ?, activity_type = ? WHERE id = ?`,
    [
      value,
      imageUrl,
      textResponse || null,
      note,
      activity_type || "exercise",
      id,
    ],
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routes/mission.ts
git commit -m "feat(missions): admin backdated submit + editable submission date"
```

---

## Task 5: Tanita delete + POST permission

**Files:**

- Modify: `server/routes/tanita.ts`

- [ ] **Step 1: Add admin/self permission to `POST /`**

At the very start of `router.post("/", ...)`'s `try` block (before `const p = req.body;`), add a guard:

```ts
const requesterId = req.headers["x-user-id"];
if (!requesterId) return res.status(401).json({ error: "Unauthorized" });
const [reqRows]: any = await pool.query("SELECT role FROM users WHERE id = ?", [
  requesterId,
]);
const requesterRole = reqRows[0]?.role;
const isAdmin = requesterRole === "admin";
if (!isAdmin && String(requesterId) !== String(req.body.user_id)) {
  return res
    .status(403)
    .json({ error: "Forbidden: cannot create record for another user" });
}
```

- [ ] **Step 2: Add `DELETE /:id`**

Add before `export default router;`:

```ts
// Admin/self: delete a tanita record.
router.delete("/:id", async (req, res) => {
  const requesterId = req.headers["x-user-id"];
  const { id } = req.params;
  if (!requesterId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const [reqRows]: any = await pool.query(
      "SELECT role FROM users WHERE id = ?",
      [requesterId],
    );
    const requesterRole = reqRows[0]?.role;
    const [targetRows]: any = await pool.query(
      "SELECT user_id FROM tanita WHERE id = ?",
      [id],
    );
    if (targetRows.length === 0)
      return res.status(404).json({ error: "Record not found" });

    const ownerId = targetRows[0].user_id;
    if (String(requesterId) !== String(ownerId) && requesterRole !== "admin") {
      return res
        .status(403)
        .json({ error: "Forbidden: You cannot delete this record" });
    }

    await pool.query("DELETE FROM tanita WHERE id = ?", [id]);
    res.json({ success: true, message: "Tanita record deleted" });
  } catch (error) {
    console.error("Delete Tanita error:", error);
    res.status(500).json({ error: "Failed to delete Tanita data" });
  }
});
```

- [ ] **Step 3: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/routes/tanita.ts
git commit -m "feat(tanita): admin/self delete + guard record creation"
```

---

## Task 6: Route + composable + page shell + entry link

**Files:**

- Modify: `src/router/index.ts`
- Create: `src/composables/useAdminUserDetail.ts`
- Create: `src/views/AdminUserDetail.vue`
- Modify: `src/components/admin/AdminUsers.vue`

- [ ] **Step 1: Add the route**

In `src/router/index.ts`, add to the `routes` array (after the `/admin` entry):

```ts
  {
    path: "/admin/users/:id",
    name: "AdminUserDetail",
    component: () => import("../views/AdminUserDetail.vue"),
    meta: {
      title: "จัดการข้อมูลสมาชิก",
      hideNavbar: true,
      requiresAdmin: true,
    },
  },
```

- [ ] **Step 2: Create the composable**

Create `src/composables/useAdminUserDetail.ts`:

```ts
import { ref, computed } from "vue";
import { authStore } from "../store/auth";
import { showSuccess, showError, showConfirm } from "../lib/swal";

const API = import.meta.env.VITE_API_URL || "/api";

function headers(json = true): Record<string, string> {
  const h: Record<string, string> = {
    "x-user-id": String(authStore.user?.id || ""),
  };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

export function useAdminUserDetail(userId: number) {
  const loading = ref(true);
  const submitting = ref(false);
  const user = ref<any>(null);
  const submissions = ref<any[]>([]);
  const tanita = ref<any[]>([]);
  const registrations = ref<any[]>([]);
  const assessments = ref<any[]>([]);
  const assessmentSubmissions = ref<any[]>([]);

  const displayName = computed(() =>
    user.value
      ? `${user.value.fname_th || ""} ${user.value.lname_th || ""}`.trim() ||
        user.value.nickname ||
        `#${user.value.id}`
      : "",
  );

  const load = async () => {
    loading.value = true;
    try {
      const r = await fetch(`${API}/users/${userId}/full-profile`, {
        headers: headers(false),
      });
      if (!r.ok) throw new Error("โหลดข้อมูลผู้ใช้ไม่สำเร็จ");
      const d = await r.json();
      user.value = d.user;
      submissions.value = d.submissions || [];
      tanita.value = d.healthHistory || [];
      registrations.value = d.registrations || [];
      assessments.value = d.assessments || [];
      assessmentSubmissions.value = d.assessmentSubmissions || [];
    } catch (e: any) {
      showError(e.message || "เกิดข้อผิดพลาด");
    } finally {
      loading.value = false;
    }
  };

  // ── Profile ────────────────────────────────────────────────
  const saveProfile = async (form: any) => {
    submitting.value = true;
    try {
      const r = await fetch(`${API}/users/${userId}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify(form),
      });
      if (!r.ok)
        throw new Error(
          (await r.json().catch(() => ({}))).error || "บันทึกไม่สำเร็จ",
        );
      showSuccess("บันทึกโปรไฟล์สำเร็จ");
      await load();
    } catch (e: any) {
      showError(e.message);
    } finally {
      submitting.value = false;
    }
  };

  // ── Points ─────────────────────────────────────────────────
  const savePoints = async (points: number, total_score: number) => {
    submitting.value = true;
    try {
      const r = await fetch(`${API}/users/${userId}/points`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ points, total_score }),
      });
      if (!r.ok)
        throw new Error(
          (await r.json().catch(() => ({}))).error || "บันทึกคะแนนไม่สำเร็จ",
        );
      showSuccess("ปรับคะแนนสำเร็จ");
      await load();
    } catch (e: any) {
      showError(e.message);
    } finally {
      submitting.value = false;
    }
  };

  // ── Missions ───────────────────────────────────────────────
  const backdateSubmit = async (payload: any) => {
    submitting.value = true;
    try {
      const r = await fetch(`${API}/missions/admin/submit`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ ...payload, userId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "เพิ่มภารกิจไม่สำเร็จ");
      showSuccess("เพิ่มภารกิจสำเร็จ");
      await load();
    } catch (e: any) {
      showError(e.message);
    } finally {
      submitting.value = false;
    }
  };

  const editSubmission = async (id: number, payload: any) => {
    submitting.value = true;
    try {
      const r = await fetch(`${API}/missions/submission/${id}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("แก้ไขไม่สำเร็จ");
      showSuccess("แก้ไขภารกิจสำเร็จ");
      await load();
    } catch (e: any) {
      showError(e.message);
    } finally {
      submitting.value = false;
    }
  };

  const setSubmissionStatus = async (id: number, status: string, note = "") => {
    submitting.value = true;
    try {
      const r = await fetch(`${API}/missions/${id}/status`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ status, note }),
      });
      if (!r.ok) throw new Error("อัปเดตสถานะไม่สำเร็จ");
      showSuccess(status === "approved" ? "อนุมัติแล้ว" : "ปฏิเสธแล้ว");
      await load();
    } catch (e: any) {
      showError(e.message);
    } finally {
      submitting.value = false;
    }
  };

  const deleteSubmission = async (id: number) => {
    const ok = await showConfirm(
      "ลบการส่งภารกิจนี้ใช่หรือไม่?",
      undefined,
      "ยืนยันลบ",
      "warning",
      true,
    );
    if (!ok) return;
    submitting.value = true;
    try {
      const r = await fetch(`${API}/missions/submission/${id}`, {
        method: "DELETE",
        headers: headers(false),
      });
      if (!r.ok) throw new Error("ลบไม่สำเร็จ");
      showSuccess("ลบภารกิจสำเร็จ");
      await load();
    } catch (e: any) {
      showError(e.message);
    } finally {
      submitting.value = false;
    }
  };

  // ── Body composition (tanita) ──────────────────────────────
  const saveTanita = async (record: any) => {
    submitting.value = true;
    try {
      const isEdit = !!record.id;
      const url = isEdit ? `${API}/tanita/${record.id}` : `${API}/tanita`;
      const r = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: headers(),
        body: JSON.stringify({ ...record, user_id: userId }),
      });
      if (!r.ok) throw new Error("บันทึกค่าร่างกายไม่สำเร็จ");
      showSuccess("บันทึกค่าร่างกายสำเร็จ");
      await load();
    } catch (e: any) {
      showError(e.message);
    } finally {
      submitting.value = false;
    }
  };

  const deleteTanita = async (id: number) => {
    const ok = await showConfirm(
      "ลบข้อมูลค่าร่างกายนี้ใช่หรือไม่?",
      undefined,
      "ยืนยันลบ",
      "warning",
      true,
    );
    if (!ok) return;
    submitting.value = true;
    try {
      const r = await fetch(`${API}/tanita/${id}`, {
        method: "DELETE",
        headers: headers(false),
      });
      if (!r.ok) throw new Error("ลบไม่สำเร็จ");
      showSuccess("ลบค่าร่างกายสำเร็จ");
      await load();
    } catch (e: any) {
      showError(e.message);
    } finally {
      submitting.value = false;
    }
  };

  // ── Activities ─────────────────────────────────────────────
  const enroll = async (eventId: number) => {
    submitting.value = true;
    try {
      const r = await fetch(`${API}/activities/admin/enroll`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ userId, eventId }),
      });
      if (!r.ok)
        throw new Error(
          (await r.json().catch(() => ({}))).error || "ลงทะเบียนไม่สำเร็จ",
        );
      showSuccess("เพิ่มเข้ากิจกรรมสำเร็จ");
      await load();
    } catch (e: any) {
      showError(e.message);
    } finally {
      submitting.value = false;
    }
  };

  const kick = async (eventId: number, title: string) => {
    const ok = await showConfirm(
      `คัดออกจาก "${title}" ใช่หรือไม่?`,
      undefined,
      "ยืนยัน",
      "warning",
      true,
    );
    if (!ok) return;
    submitting.value = true;
    try {
      const r = await fetch(`${API}/activities/admin/kick`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ userId, eventId }),
      });
      if (!r.ok) throw new Error("คัดออกไม่สำเร็จ");
      showSuccess("คัดออกสำเร็จ");
      await load();
    } catch (e: any) {
      showError(e.message);
    } finally {
      submitting.value = false;
    }
  };

  return {
    loading,
    submitting,
    user,
    submissions,
    tanita,
    registrations,
    assessments,
    assessmentSubmissions,
    displayName,
    load,
    saveProfile,
    savePoints,
    backdateSubmit,
    editSubmission,
    setSubmissionStatus,
    deleteSubmission,
    saveTanita,
    deleteTanita,
    enroll,
    kick,
  };
}
```

- [ ] **Step 3: Create the page shell**

Create `src/views/AdminUserDetail.vue`:

```vue
<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, Loader2 } from "lucide-vue-next";
import { useAdminUserDetail } from "../composables/useAdminUserDetail";
import ProfileTab from "../components/admin/user-detail/ProfileTab.vue";
import PointsTab from "../components/admin/user-detail/PointsTab.vue";
import MissionsTab from "../components/admin/user-detail/MissionsTab.vue";
import BodyCompTab from "../components/admin/user-detail/BodyCompTab.vue";
import AssessmentsTab from "../components/admin/user-detail/AssessmentsTab.vue";
import ActivitiesTab from "../components/admin/user-detail/ActivitiesTab.vue";

const route = useRoute();
const router = useRouter();
const userId = Number(route.params.id);
const ctx = useAdminUserDetail(userId);

const tabs = [
  { key: "profile", label: "โปรไฟล์", comp: ProfileTab },
  { key: "points", label: "คะแนน", comp: PointsTab },
  { key: "missions", label: "ภารกิจ", comp: MissionsTab },
  { key: "body", label: "ค่าร่างกาย", comp: BodyCompTab },
  { key: "assess", label: "ผลประเมิน", comp: AssessmentsTab },
  { key: "activities", label: "กิจกรรม", comp: ActivitiesTab },
] as const;
const active = ref<(typeof tabs)[number]["key"]>("profile");
const currentComp = () => tabs.find((t) => t.key === active.value)!.comp;

onMounted(() => ctx.load());
</script>

<template>
  <div class="font-sarabun bg-white min-h-screen w-full">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <button
        @click="router.back()"
        class="flex items-center gap-2 text-slate-500 hover:text-orange-600 font-bold text-sm mb-6"
      >
        <ArrowLeft :size="18" /> กลับ
      </button>

      <div
        v-if="ctx.loading.value"
        class="py-24 flex justify-center text-slate-400"
      >
        <Loader2 :size="32" class="animate-spin" />
      </div>

      <template v-else-if="ctx.user.value">
        <div class="flex items-center gap-4 mb-6">
          <div class="min-w-0">
            <h1 class="text-2xl font-black text-slate-900 truncate">
              {{ ctx.displayName.value }}
            </h1>
            <p class="text-sm text-slate-400 font-bold">
              #{{ ctx.user.value.id }} · {{ ctx.user.value.role }}
            </p>
          </div>
        </div>

        <div
          class="flex gap-2 border-b border-slate-200 mb-8 overflow-x-auto no-scrollbar"
        >
          <button
            v-for="t in tabs"
            :key="t.key"
            @click="active = t.key"
            class="px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 -mb-px transition-colors"
            :class="
              active === t.key
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            "
          >
            {{ t.label }}
          </button>
        </div>

        <component :is="currentComp()" :ctx="ctx" />
      </template>

      <div v-else class="py-24 text-center text-slate-400 font-bold">
        ไม่พบข้อมูลผู้ใช้
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Add the entry link in AdminUsers**

In `src/components/admin/AdminUsers.vue`, inside the Teleport 3-dots menu (the "จัดการข้อมูล" group, right after the "แก้ไขข้อมูล" button that calls `openModal('edit', ...)`), add a navigation button. First ensure the router is available — add near the other imports in `<script setup>`:

```ts
import { useRouter } from "vue-router";
const router = useRouter();
```

Then add this menu button after the existing "ดูรายละเอียด" button:

```html
<button
  @click="
                router.push('/admin/users/' + activeMenuUser.id);
                localActiveMenuId = null;
              "
  class="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-orange-50 hover:text-orange-600 transition-colors flex items-center gap-3"
>
  <div class="p-1.5 bg-slate-50 rounded-lg text-slate-500">
    <Pencil :size="16" />
  </div>
  จัดการข้อมูลทั้งหมด
</button>
```

- [ ] **Step 5: Create placeholder tab components so the shell compiles**

Create each of these six files with a minimal shell (they are fully implemented in Tasks 7–12). For now each just declares the `ctx` prop and renders its title so `npm run lint` passes:

`src/components/admin/user-detail/ProfileTab.vue`:

```vue
<script setup lang="ts">
defineProps<{ ctx: any }>();
</script>
<template>
  <div class="text-slate-400 text-sm">โปรไฟล์ (กำลังพัฒนา)</div>
</template>
```

Create `PointsTab.vue`, `MissionsTab.vue`, `BodyCompTab.vue`, `AssessmentsTab.vue`, `ActivitiesTab.vue` identically, changing only the placeholder label text (คะแนน / ภารกิจ / ค่าร่างกาย / ผลประเมิน / กิจกรรม).

- [ ] **Step 6: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/router/index.ts src/composables/useAdminUserDetail.ts src/views/AdminUserDetail.vue src/components/admin/user-detail src/components/admin/AdminUsers.vue
git commit -m "feat(admin): add user-detail route, composable, page shell + entry link"
```

---

## Task 7: Profile tab

**Files:**

- Modify: `src/components/admin/user-detail/ProfileTab.vue`

- [ ] **Step 1: Implement the tab**

Replace the file contents:

```vue
<script setup lang="ts">
import { reactive, watch } from "vue";
import { Save, Loader2 } from "lucide-vue-next";
const props = defineProps<{ ctx: any }>();

const fields = [
  { key: "fname_th", label: "ชื่อ" },
  { key: "lname_th", label: "นามสกุล" },
  { key: "nickname", label: "ชื่อเล่น" },
  { key: "email", label: "อีเมล" },
  { key: "phone", label: "โทรศัพท์" },
  { key: "id_code", label: "รหัสประจำตัว" },
  { key: "address", label: "ที่อยู่" },
  { key: "role_type", label: "ประเภทผู้ใช้" },
  { key: "role_detail_1", label: "รายละเอียด 1" },
  { key: "role_detail_2", label: "รายละเอียด 2" },
  { key: "main_goal", label: "เป้าหมายหลัก" },
  { key: "underlying_disease", label: "โรคประจำตัว" },
  { key: "weight", label: "น้ำหนัก (กก.)" },
  { key: "height", label: "ส่วนสูง (ซม.)" },
  { key: "birth_date", label: "วันเกิด (YYYY-MM-DD)" },
];

const form = reactive<Record<string, any>>({});
const sync = () => {
  const u = props.ctx.user.value || {};
  fields.forEach((f) => (form[f.key] = u[f.key] ?? ""));
  form.gender = u.gender ?? "";
  form.role = u.role ?? "user";
};
watch(() => props.ctx.user.value, sync, { immediate: true });

const save = () => props.ctx.saveProfile({ ...form });
</script>

<template>
  <div class="max-w-3xl">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <label v-for="f in fields" :key="f.key" class="flex flex-col gap-1">
        <span class="text-xs font-bold text-slate-500">{{ f.label }}</span>
        <input
          v-model="form[f.key]"
          class="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-500"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs font-bold text-slate-500">เพศ</span>
        <select
          v-model="form.gender"
          class="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-500"
        >
          <option value="">ไม่ระบุ</option>
          <option value="male">ชาย</option>
          <option value="female">หญิง</option>
        </select>
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs font-bold text-slate-500">สิทธิ์</span>
        <select
          v-model="form.role"
          class="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-500"
        >
          <option value="user">user</option>
          <option value="host">host</option>
          <option value="admin">admin</option>
        </select>
      </label>
    </div>
    <button
      @click="save"
      :disabled="ctx.submitting.value"
      class="mt-6 bg-orange-500 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-orange-600 disabled:opacity-50"
    >
      <Loader2 v-if="ctx.submitting.value" :size="18" class="animate-spin" />
      <Save v-else :size="18" /> บันทึกโปรไฟล์
    </button>
  </div>
</template>
```

> Note: `PATCH /api/users/:id` whitelists `role` for admins (see `server/routes/user.ts`), so the role select is honored when the requester is admin.

- [ ] **Step 2: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/user-detail/ProfileTab.vue
git commit -m "feat(admin): profile tab in user-detail page"
```

---

## Task 8: Points tab

**Files:**

- Modify: `src/components/admin/user-detail/PointsTab.vue`

- [ ] **Step 1: Implement the tab**

Replace the file contents:

```vue
<script setup lang="ts">
import { ref, watch } from "vue";
import { Save, Loader2, Coins } from "lucide-vue-next";
const props = defineProps<{ ctx: any }>();

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

const save = () =>
  props.ctx.savePoints(
    Math.max(0, points.value),
    Math.max(0, totalScore.value),
  );
</script>

<template>
  <div class="max-w-lg">
    <div class="flex items-center gap-2 mb-6 text-slate-500">
      <Coins :size="18" class="text-orange-500" />
      <span class="text-sm font-bold"
        >ปรับคะแนนโดยตรง (ค่าปัจจุบันจะถูกเขียนทับ)</span
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
      @click="save"
      :disabled="ctx.submitting.value"
      class="mt-6 bg-orange-500 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-orange-600 disabled:opacity-50"
    >
      <Loader2 v-if="ctx.submitting.value" :size="18" class="animate-spin" />
      <Save v-else :size="18" /> บันทึกคะแนน
    </button>
  </div>
</template>
```

- [ ] **Step 2: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/user-detail/PointsTab.vue
git commit -m "feat(admin): points tab in user-detail page"
```

---

## Task 9: Missions tab (list + actions + backdated create)

**Files:**

- Modify: `src/components/admin/user-detail/MissionsTab.vue`

- [ ] **Step 1: Implement the tab**

Replace the file contents:

```vue
<script setup lang="ts">
import { ref, computed } from "vue";
import { Check, X, Trash2, Plus, Loader2 } from "lucide-vue-next";
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

// Group submissions by activity title for readability.
const grouped = computed(() => {
  const map: Record<string, any[]> = {};
  for (const s of props.ctx.submissions.value) {
    const key = s.tasks?.event_id ? `กิจกรรม #${s.tasks.event_id}` : "อื่น ๆ";
    (map[key] ||= []).push(s);
  }
  return map;
});

// Backdated create form — the task list comes from the user's registrations
// is not enough (need task ids); admin enters a task id + date directly.
const showAdd = ref(false);
const addForm = ref<any>({
  taskId: "",
  value: 0,
  status: "approved",
  created_at: "",
  textResponse: "",
});
const submitAdd = async () => {
  if (!addForm.value.taskId) return;
  await props.ctx.backdateSubmit({
    taskId: Number(addForm.value.taskId),
    value: Number(addForm.value.value) || 0,
    status: addForm.value.status,
    created_at: addForm.value.created_at || undefined,
    textResponse: addForm.value.textResponse || undefined,
  });
  showAdd.value = false;
  addForm.value = {
    taskId: "",
    value: 0,
    status: "approved",
    created_at: "",
    textResponse: "",
  };
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
        <Plus :size="16" /> เพิ่มภารกิจย้อนหลัง
      </button>
    </div>

    <div
      v-if="showAdd"
      class="border border-slate-200 rounded-2xl p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3"
    >
      <label class="flex flex-col gap-1">
        <span class="text-xs font-bold text-slate-500">Task ID</span>
        <input
          v-model="addForm.taskId"
          type="number"
          class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs font-bold text-slate-500">ค่า (value)</span>
        <input
          v-model="addForm.value"
          type="number"
          class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs font-bold text-slate-500"
          >วันที่ (ย้อนหลังได้)</span
        >
        <input
          v-model="addForm.created_at"
          type="date"
          class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
        />
      </label>
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
      <label class="flex flex-col gap-1 sm:col-span-2">
        <span class="text-xs font-bold text-slate-500">หมายเหตุ/ข้อความ</span>
        <input
          v-model="addForm.textResponse"
          class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
        />
      </label>
      <div class="sm:col-span-2 flex justify-end">
        <button
          @click="submitAdd"
          :disabled="ctx.submitting.value || !addForm.taskId"
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
    </div>

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
          class="border border-slate-100 rounded-2xl p-3 flex items-center gap-3"
        >
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold text-slate-700 truncate">
              {{ s.tasks?.note || s.tasks?.type || "ภารกิจ" }}
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
git commit -m "feat(admin): missions tab with backdated submit + approve/reject/delete"
```

---

## Task 10: Body composition tab (CRUD + history)

**Files:**

- Modify: `src/components/admin/user-detail/BodyCompTab.vue`

- [ ] **Step 1: Implement the tab**

Replace the file contents:

```vue
<script setup lang="ts">
import { ref } from "vue";
import { Plus, Pencil, Trash2, Save, X, Loader2 } from "lucide-vue-next";
const props = defineProps<{ ctx: any }>();

const numFields = [
  { key: "weight", label: "น้ำหนัก" },
  { key: "height", label: "ส่วนสูง" },
  { key: "bmi", label: "BMI" },
  { key: "fat_pc", label: "ไขมัน %" },
  { key: "fat_mass", label: "มวลไขมัน" },
  { key: "muscle_mass", label: "มวลกล้ามเนื้อ" },
  { key: "visceral_fat", label: "ไขมันช่องท้อง" },
  { key: "metabolic_age", label: "อายุเมตาบอลิก" },
  { key: "bone_mass", label: "มวลกระดูก" },
  { key: "waist_cm", label: "รอบเอว (ซม.)" },
];

const editing = ref<any | null>(null);
const startNew = () => {
  editing.value = { recorded_at: "" };
  numFields.forEach((f) => (editing.value[f.key] = ""));
};
const startEdit = (r: any) => {
  editing.value = { ...r, recorded_at: (r.recorded_at || "").slice(0, 10) };
};
const cancel = () => (editing.value = null);
const save = async () => {
  await props.ctx.saveTanita({ ...editing.value });
  editing.value = null;
};
const fmt = (d: string) =>
  d
    ? new Date(d).toLocaleDateString("th-TH", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      })
    : "—";
</script>

<template>
  <div>
    <div class="flex justify-between items-center mb-4">
      <p class="text-sm font-bold text-slate-500">
        ประวัติ {{ ctx.tanita.value.length }} รายการ
      </p>
      <button
        @click="startNew"
        class="bg-orange-500 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-orange-600"
      >
        <Plus :size="16" /> เพิ่มค่าร่างกาย
      </button>
    </div>

    <div v-if="editing" class="border border-slate-200 rounded-2xl p-4 mb-6">
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <label class="flex flex-col gap-1">
          <span class="text-xs font-bold text-slate-500">วันที่บันทึก</span>
          <input
            v-model="editing.recorded_at"
            type="date"
            class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
          />
        </label>
        <label v-for="f in numFields" :key="f.key" class="flex flex-col gap-1">
          <span class="text-xs font-bold text-slate-500">{{ f.label }}</span>
          <input
            v-model="editing[f.key]"
            class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
          />
        </label>
      </div>
      <div class="flex justify-end gap-2 mt-4">
        <button
          @click="cancel"
          class="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 bg-slate-100"
        >
          <X :size="16" class="inline" /> ยกเลิก
        </button>
        <button
          @click="save"
          :disabled="ctx.submitting.value"
          class="bg-orange-500 text-white px-5 py-2 rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50"
        >
          <Loader2
            v-if="ctx.submitting.value"
            :size="16"
            class="animate-spin"
          />
          <Save v-else :size="16" /> บันทึก
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <div
        v-for="r in ctx.tanita.value"
        :key="r.id"
        class="border border-slate-100 rounded-2xl p-3 flex items-center gap-3"
      >
        <div class="flex-1 min-w-0">
          <p class="text-sm font-bold text-slate-700">
            {{ fmt(r.recorded_at) }}
          </p>
          <p class="text-xs text-slate-400">
            น้ำหนัก {{ r.weight || "—" }} · BMI {{ r.bmi || "—" }} · ไขมัน
            {{ r.fat_pc || "—" }}%
          </p>
        </div>
        <button
          @click="startEdit(r)"
          class="p-2 text-slate-500 hover:bg-slate-50 rounded-lg"
          title="แก้ไข"
        >
          <Pencil :size="16" />
        </button>
        <button
          @click="ctx.deleteTanita(r.id)"
          class="p-2 text-rose-600 hover:bg-rose-50 rounded-lg"
          title="ลบ"
        >
          <Trash2 :size="16" />
        </button>
      </div>
    </div>

    <div
      v-if="ctx.tanita.value.length === 0 && !editing"
      class="text-slate-400 text-sm py-8 text-center"
    >
      ยังไม่มีข้อมูลค่าร่างกาย
    </div>
  </div>
</template>
```

> Note: `POST /api/tanita` maps `recorded_at` → the record date; passing a date-only string is fine (the route runs it through `new Date(...)`). Editing sends `PATCH /api/tanita/:id`, which does not currently update `recorded_at`; that is acceptable for this iteration (date edits happen by delete + re-add). If date-edit-in-place is later required, extend the tanita PATCH.

- [ ] **Step 2: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/user-detail/BodyCompTab.vue
git commit -m "feat(admin): body composition CRUD + history tab"
```

---

## Task 11: Assessments tab (read-only)

**Files:**

- Modify: `src/components/admin/user-detail/AssessmentsTab.vue`

- [ ] **Step 1: Implement the tab**

Replace the file contents:

```vue
<script setup lang="ts">
defineProps<{ ctx: any }>();
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
</script>

<template>
  <div class="flex flex-col gap-8 max-w-3xl">
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
          class="border border-slate-100 rounded-2xl p-3 flex items-center justify-between"
        >
          <div>
            <p class="text-sm font-bold text-slate-700">
              คะแนน {{ a.total_score ?? "—" }} · {{ a.overall_level || "—" }}
            </p>
            <p class="text-xs text-slate-400">{{ fmt(a.created_at) }}</p>
          </div>
        </div>
      </div>
      <p v-else class="text-slate-400 text-sm">ยังไม่มีผลประเมิน</p>
    </section>

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
git commit -m "feat(admin): read-only assessments tab"
```

---

## Task 12: Activities tab

**Files:**

- Modify: `src/components/admin/user-detail/ActivitiesTab.vue`

- [ ] **Step 1: Implement the tab**

Replace the file contents:

```vue
<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { authStore } from "../../../store/auth";
import { Plus, LogOut, Search, Loader2 } from "lucide-vue-next";
const props = defineProps<{ ctx: any }>();

const API = import.meta.env.VITE_API_URL || "/api";
const allActivities = ref<any[]>([]);
const search = ref("");

onMounted(async () => {
  try {
    const r = await fetch(`${API}/activities?manage=true`, {
      headers: { "x-user-id": String(authStore.user?.id) },
    });
    if (r.ok) allActivities.value = await r.json();
  } catch {
    /* silent */
  }
});

const joinedIds = computed(
  () =>
    new Set(props.ctx.registrations.value.map((r: any) => r.id ?? r.event_id)),
);
const available = computed(() => {
  const q = search.value.toLowerCase().trim();
  return allActivities.value.filter(
    (a) =>
      !joinedIds.value.has(a.id) && (!q || a.title.toLowerCase().includes(q)),
  );
});
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
    <section>
      <h3
        class="text-xs font-black text-slate-400 uppercase tracking-widest mb-3"
      >
        กิจกรรมที่เข้าร่วม ({{ ctx.registrations.value.length }})
      </h3>
      <div class="flex flex-col gap-2">
        <div
          v-for="r in ctx.registrations.value"
          :key="r.id ?? r.event_id"
          class="border border-slate-100 rounded-2xl p-3 flex items-center justify-between gap-2"
        >
          <span class="text-sm font-bold text-slate-700 truncate">{{
            r.title
          }}</span>
          <button
            @click="ctx.kick(r.id ?? r.event_id, r.title)"
            class="p-2 text-rose-600 hover:bg-rose-50 rounded-lg shrink-0"
            title="คัดออก"
          >
            <LogOut :size="16" />
          </button>
        </div>
        <p
          v-if="ctx.registrations.value.length === 0"
          class="text-slate-400 text-sm"
        >
          ยังไม่ได้เข้าร่วมกิจกรรม
        </p>
      </div>
    </section>

    <section>
      <h3
        class="text-xs font-black text-slate-400 uppercase tracking-widest mb-3"
      >
        เพิ่มเข้ากิจกรรม
      </h3>
      <div class="relative mb-3">
        <Search
          :size="14"
          class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          v-model="search"
          placeholder="ค้นห่ากิจกรรม..."
          class="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500"
        />
      </div>
      <div class="flex flex-col gap-2 max-h-96 overflow-y-auto">
        <div
          v-for="a in available"
          :key="a.id"
          class="border border-slate-100 rounded-2xl p-3 flex items-center justify-between gap-2"
        >
          <span class="text-sm font-bold text-slate-700 truncate">{{
            a.title
          }}</span>
          <button
            @click="ctx.enroll(a.id)"
            :disabled="ctx.submitting.value"
            class="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg shrink-0 disabled:opacity-50"
            title="เพิ่ม"
          >
            <Loader2
              v-if="ctx.submitting.value"
              :size="16"
              class="animate-spin"
            />
            <Plus v-else :size="16" />
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
```

> Note: `GET /api/activities/user/:userId/registered` returns rows keyed by `event_id`; the `full-profile` registrations use `event.id`. The template reads `r.id ?? r.event_id` and `r.title` defensively. If `registrations` from full-profile lacks a flat `title`/`id`, verify the shape during browser testing (Task 13) and adjust the accessor.

- [ ] **Step 2: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/user-detail/ActivitiesTab.vue
git commit -m "feat(admin): activities enroll/kick tab"
```

---

## Task 13: Final verification pass

- [ ] **Step 1: Full typecheck + unit test**

Run: `npm run lint`
Expected: PASS.
Run: `npx tsx scripts/admin-submission.test.ts`
Expected: PASS.

- [ ] **Step 2: Browser smoke test (local DB + dev server)**

Ensure DB is up (`docker compose up -d db`) and start the `vitalcare-dev` preview. Log in as admin, open the member table, use "จัดการข้อมูลทั้งหมด" on a user → `/admin/users/:id`. Verify each tab:

- **Profile:** edit a field, save, confirm it persists after reload.
- **Points:** set points/total_score; confirm the value shows in the user row and on rankings.
- **Missions:** create a backdated approved submission (pick a real Task ID from an activity the user joined and a past date) → confirm it appears with that date, the user's points increase, and the leaderboard reflects it; approve/reject/delete an entry.
- **Body composition:** add a record (backdated `recorded_at`), edit it, delete it; confirm the history list updates.
- **Assessments:** confirm health assessments + pre/post test scores render read-only.
- **Activities:** enroll into an activity and kick from one; confirm the joined list updates.

Check `read_console_messages` (no errors) and `read_network_requests` (all 2xx) during the pass. Capture a screenshot as evidence.

- [ ] **Step 3: Verify the `registrations` shape assumption**

During Task 13 testing, inspect the `full-profile` response `registrations[]` shape. The `ActivitiesTab` kick/list uses `r.id ?? r.event_id` and `r.title`. `full-profile` builds registrations as `{ id, user_id, event_id, created_at, title, ... }` (see `server/routes/user.ts` section D), so `r.id` is the registration id and `r.event_id` is the event id. **Confirm `ctx.kick` receives the EVENT id** — if the list passes the registration id by mistake, change the ActivitiesTab kick call to pass `r.event_id` explicitly. Fix inline if needed and re-commit.

---

## Self-review notes

- **Spec coverage:** dedicated page + route (T6); edit-everything profile (T7); direct points (T3/T8); backdated missions + approve/reject/delete (T4/T9); body-composition CRUD + history (T5/T10); read-only assessments (T2/T11); activities (T12). All spec sections map to tasks.
- **Type/endpoint consistency:** composable method names (`saveProfile`, `savePoints`, `backdateSubmit`, `editSubmission`, `setSubmissionStatus`, `deleteSubmission`, `saveTanita`, `deleteTanita`, `enroll`, `kick`) defined in T6 and consumed verbatim in T7–T12. Endpoints referenced match those added in T2–T5 and existing routes.
- **Known follow-ups flagged inline:** tanita PATCH doesn't update `recorded_at` (date edits via delete+re-add); `registrations` id/event_id shape verified in T13.
- **Testing honesty:** only the pure date helper is unit-tested (repo has no DB/component harness); the rest is typecheck + browser-verified.
