import express from "express";
import { pool } from "../mysql.js";
import { decrypt } from "../lib/crypto.js";
import { getIO, EVENTS } from "../lib/realtime.js";
import { logAudit } from "../lib/audit.js";
import { awardDailyMission } from "../lib/scoring.js";
import { requireAdmin } from "../middleware/auth.js";
import { toMysqlDateTime, dayOf } from "../lib/adminSubmission.js";

const router = express.Router();

router.post("/submit", async (req, res) => {
  const requesterId = req.headers["x-user-id"];
  const {
    userId,
    taskId,
    value,
    imageUrl,
    textResponse,
    activity_type,
    proof_type,
    device_id,
  } = req.body;

  // ── Bug #3 fix: ตรวจสอบ Authentication ──
  // ต้องมี x-user-id header (แสดงว่า login อยู่)
  if (!requesterId) {
    return res.status(401).json({ error: "กรุณาเข้าสู่ระบบก่อนส่งผลงาน" });
  }

  // ตรวจสอบว่า submit ให้ตัวเองหรือไม่ (admin ข้ามได้)
  try {
    const [reqRows]: any = await pool.query(
      "SELECT role FROM users WHERE id = ?",
      [requesterId],
    );
    const reqRole = reqRows[0]?.role;
    const isAdmin = reqRole === "admin";
    if (!isAdmin && String(requesterId) !== String(userId)) {
      return res
        .status(403)
        .json({ error: "คุณไม่มีสิทธิ์ส่งผลงานในนามผู้ใช้อื่น" });
    }
  } catch (authErr: any) {
    return res.status(500).json({ error: "ไม่สามารถตรวจสอบสิทธิ์ได้" });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // --- Idempotency Check: Prevent duplicate submissions for the same task today ---
    // (Useful for slow internet / double-clicks)
    const [existingSub]: any = await connection.query(
      `SELECT id FROM submissions 
       WHERE user_id = ? AND task_id = ? AND DATE(created_at) = CURDATE() 
       LIMIT 1`,
      [userId, taskId],
    );

    if (existingSub.length > 0) {
      // If a submission already exists for today, we just return that one
      // instead of creating a duplicate. (Idempotent response)
      await connection.commit();
      return res.json({
        success: true,
        submissionId: existingSub[0].id,
        alreadyExists: true,
      });
    }

    const [result]: any = await connection.query(
      `INSERT INTO submissions (user_id, task_id, value, img_url, text_response, status, activity_type, proof_type, device_id, approved_at)
       VALUES (?, ?, ?, ?, ?, 'approved', ?, ?, ?, NOW())`,
      [
        userId || null,
        taskId || null,
        value || 0,
        imageUrl || null,
        textResponse || null,
        activity_type || "exercise",
        proof_type || "manual",
        device_id || null,
      ],
    );

    const insertId = result.insertId;

    // Fetch task info
    const [taskRows]: any = await connection.query(
      "SELECT points, event_id FROM tasks WHERE id = ?",
      [taskId],
    );
    const task = taskRows.length > 0 ? taskRows[0] : null;

    if (task) {
      // Award tracking points to user
      if (task.points) {
        // Safety check: Has the user already a submission for this task today that is approved?
        // (Simple idempotency check to avoid double awards if request retries)
        const [existingApproved]: any = await connection.query(
          'SELECT id FROM submissions WHERE user_id = ? AND task_id = ? AND status = "approved" AND id != ? LIMIT 1',
          [userId, taskId, insertId],
        );

        if (existingApproved.length > 0) {
          console.log(
            `[Points] User ${userId} already has an approved submission for task ${taskId}. Skipping point award.`,
          );
        } else {
          console.log(
            `[Points] Awarding ${task.points} to user ${userId} for task ${taskId}. SubID: ${insertId}`,
          );
          await connection.query(
            "UPDATE users SET points = points + ?, total_score = total_score + ? WHERE id = ?",
            [task.points, task.points, userId],
          );
        }
      }

      // Track in event_leaderboards
      if (task.event_id) {
        const eventId = task.event_id;
        const scoreToAdd = task.points || 0;

        // Use the SAME approved check as above for points to keep logic consistent
        const [alreadyCounted]: any = await connection.query(
          'SELECT id FROM submissions WHERE user_id = ? AND task_id = ? AND status = "approved" AND id != ? LIMIT 1',
          [userId, taskId, insertId],
        );

        if (alreadyCounted.length === 0) {
          const [lbRows]: any = await connection.query(
            "SELECT id FROM event_leaderboards WHERE event_id = ? AND user_id = ?",
            [eventId, userId],
          );

          if (lbRows.length > 0) {
            await connection.query(
              "UPDATE event_leaderboards SET score = score + ? WHERE id = ?",
              [scoreToAdd, lbRows[0].id],
            );
          } else {
            await connection.query(
              "INSERT INTO event_leaderboards (event_id, user_id, score, `rank`) VALUES (?, ?, ?, 0)",
              [eventId, userId, scoreToAdd],
            );
          }
        }
      }
    }

    await connection.commit();

    // Configurable daily-mission scoring (base + streak bonus, once/day/user).
    if (userId) {
      const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD (local)
      awardDailyMission(Number(userId), todayStr).catch(() => {});
    }

    // Fetch inserted record with event_id
    const [rows]: any = await pool.query(
      `SELECT s.*, t.event_id as activity_id
       FROM submissions s
       JOIN tasks t ON s.task_id = t.id
       WHERE s.id = ?`,
      [insertId],
    );

    // Trigger Realtime Event
    getIO().emit(EVENTS.SUBMISSION_CREATED, rows[0]);

    res.json({ success: true, submissionId: insertId });
  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error("[Mission Submit Error]", {
      userId,
      taskId,
      value,
      error: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage,
    });
    res
      .status(400)
      .json({ error: error.message || "Unknown submission error" });
  } finally {
    if (connection) connection.release();
  }
});

// Update an existing submission (for editing within the same day)
// Note: This does NOT add points again to prevent duplication.
//
// Callers: a user editing their own pending submission (useMissions.ts) AND
// admins editing any submission (useAdminActivityDashboard.ts,
// useAdminUserDetail.ts) — so this needs an ownership-OR-admin check, not a
// blanket requireAdmin. Previously had NO auth check at all: any client could
// PATCH any submission id and rewrite its value/image/text/date.
router.patch("/submission/:id", async (req, res) => {
  const { id } = req.params;
  const requesterId = req.headers["x-user-id"];
  const { value, imageUrl, textResponse, note, activity_type, created_at } =
    req.body;

  if (!requesterId) {
    return res.status(401).json({ error: "กรุณาเข้าสู่ระบบก่อน" });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [subRows]: any = await connection.query(
      "SELECT user_id, task_id, value, status FROM submissions WHERE id = ?",
      [id],
    );
    const oldSub = subRows[0];

    if (!oldSub) {
      await connection.rollback();
      return res.status(404).json({ error: "ไม่พบข้อมูลการส่งงาน" });
    }

    const [reqRows]: any = await connection.query(
      "SELECT role FROM users WHERE id = ?",
      [requesterId],
    );
    const requesterRole = reqRows[0]?.role;
    const isPrivileged = requesterRole === "admin" || requesterRole === "host";
    if (!isPrivileged && String(oldSub.user_id) !== String(requesterId)) {
      await connection.rollback();
      return res.status(403).json({ error: "คุณไม่มีสิทธิ์แก้ไขการส่งงานนี้" });
    }

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

    // Editing a submission no longer updates points to prevent accidental additions/subtractions on points
    // if value changes. Points are fixed per task.
    /*
    if (oldSub && oldSub.status === 'approved') {
       const diff = (Number(value) || 0) - (Number(oldSub.value) || 0);
       ...
    }
    */

    await connection.commit();

    const [rows]: any = await pool.query(
      `SELECT s.*, t.event_id as activity_id 
       FROM submissions s
       JOIN tasks t ON s.task_id = t.id
       WHERE s.id = ?`,
      [id],
    );
    getIO().emit(EVENTS.SUBMISSION_UPDATED, rows[0]);
    res.json({ success: true, submission: rows[0] });
  } catch (error: any) {
    if (connection) await connection.rollback();
    res.status(400).json({ error: "Bad Request" });
  } finally {
    if (connection) connection.release();
  }
});

router.get("/user/:userId", async (req, res) => {
  try {
    const [rows]: any = await pool.query(
      `
        SELECT s.*, t.id as t_id, t.event_id, t.task_date, t.type as t_type, t.note as t_note,
               t.points, t.allowed_days, t.is_active, t.metric_type, t.metric_unit,
               t.goal_type, t.goal_value, t.submission_type, t.use_ocr
        FROM submissions s
        LEFT JOIN tasks t ON s.task_id = t.id
        WHERE s.user_id = ?
    `,
      [req.params.userId],
    );

    const transformed = rows.map((r: any) => {
      const taskObj = r.t_id
        ? {
            id: r.t_id,
            event_id: r.event_id,
            task_date: r.task_date,
            type: r.t_type,
            note: r.t_note,
            points: r.points,
            allowed_days: r.allowed_days,
            is_active: r.is_active,
            metric_type: r.metric_type,
            metric_unit: r.metric_unit,
            goal_type: r.goal_type,
            goal_value: r.goal_value,
            submission_type: r.submission_type,
            use_ocr: r.use_ocr === 1 || r.use_ocr === true,
          }
        : null;

      return {
        id: r.id,
        user_id: r.user_id,
        task_id: r.task_id,
        img_url: r.img_url,
        text_response: r.text_response,
        value: r.value,
        status: r.status,
        comment: r.comment,
        activity_type: r.activity_type,
        proof_type: r.proof_type,
        device_id: r.device_id,
        approved_by: r.approved_by,
        approved_at: r.approved_at,
        created_at: r.created_at,
        tasks: taskObj,
      };
    });

    res.json(transformed);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Admin Route: Get all submissions
router.get("/all", async (req, res) => {
  const userId = req.headers["x-user-id"];

  try {
    const [userRows]: any = await pool.query(
      "SELECT role FROM users WHERE id = ?",
      [userId],
    );
    const user = userRows[0];

    const isAdmin = user?.role === "admin";
    const isHost = user?.role === "host";

    if (!isAdmin && !isHost)
      return res.status(403).json({ error: "Forbidden" });

    // Build massive JOIN query to simulate Supabase Deep Join
    const query = `
        SELECT
           s.*,
           u.fname_th, u.lname_th, u.nickname, u.picture_url,
           t.id as t_id, t.points, t.event_id,
           e.title as event_title, e.created_by as event_created_by
        FROM submissions s
        LEFT JOIN users u ON s.user_id = u.id
        LEFT JOIN tasks t ON s.task_id = t.id
        LEFT JOIN events e ON t.event_id = e.id
        ORDER BY s.created_at DESC
    `;

    const [rows]: any = await pool.query(query);

    const transformed = rows.map((r: any) => ({
      id: r.id,
      user_id: r.user_id,
      task_id: r.task_id,
      img_url: r.img_url,
      text_response: r.text_response,
      value: r.value,
      status: r.status,
      comment: r.comment,
      activity_type: r.activity_type,
      proof_type: r.proof_type,
      device_id: r.device_id,
      approved_by: r.approved_by,
      approved_at: r.approved_at,
      created_at: r.created_at,
      user: {
        fname_th: decrypt(r.fname_th) || r.fname_th,
        lname_th: decrypt(r.lname_th) || r.lname_th,
        nickname: decrypt(r.nickname) || r.nickname,
        picture_url: r.picture_url,
      },
      task: r.t_id
        ? {
            id: r.t_id,
            points: r.points,
            event: { title: r.event_title, created_by: r.event_created_by },
          }
        : null,
    }));

    // Filter for Host: only see submissions for their own events
    if (isHost && !isAdmin) {
      const filtered = transformed.filter(
        (s: any) => s.task?.event?.created_by === Number(userId),
      );
      return res.json(filtered);
    }

    res.json(transformed);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Admin Route: Bulk update status
router.patch("/bulk-status", requireAdmin, async (req, res) => {
  const adminId = req.headers["x-user-id"];
  const { ids, status, note } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0 || !status) {
    return res.status(400).json({ error: "Invalid request payload" });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const id of ids) {
      const [subRows]: any = await connection.query(
        `SELECT s.*, t.points, t.event_id FROM submissions s LEFT JOIN tasks t ON s.task_id = t.id WHERE s.id = ? FOR UPDATE`,
        [id],
      );
      if (subRows.length === 0) continue;
      const submission = subRows[0];

      // Update status
      await connection.query(
        "UPDATE submissions SET status = ?, comment = ?, approved_by = ?, approved_at = NOW() WHERE id = ?",
        [status, note || "", adminId, id],
      );

      // Points management
      if (submission.points) {
        if (status === "approved" && submission.status !== "approved") {
          await connection.query(
            "UPDATE users SET points = points + ?, total_score = total_score + ? WHERE id = ?",
            [submission.points, submission.points, submission.user_id],
          );
          if (submission.event_id) {
            const [lbRows]: any = await connection.query(
              "SELECT id FROM event_leaderboards WHERE event_id = ? AND user_id = ?",
              [submission.event_id, submission.user_id],
            );
            if (lbRows.length > 0) {
              await connection.query(
                "UPDATE event_leaderboards SET score = score + ? WHERE id = ?",
                [submission.points, lbRows[0].id],
              );
            } else {
              await connection.query(
                "INSERT INTO event_leaderboards (event_id, user_id, score, rank) VALUES (?, ?, ?, 0)",
                [submission.event_id, submission.user_id, submission.points],
              );
            }
          }
        } else if (status === "rejected" && submission.status === "approved") {
          await connection.query(
            "UPDATE users SET points = GREATEST(0, points - ?), total_score = GREATEST(0, total_score - ?) WHERE id = ?",
            [submission.points, submission.points, submission.user_id],
          );
          if (submission.event_id) {
            await connection.query(
              "UPDATE event_leaderboards SET score = GREATEST(0, score - ?) WHERE event_id = ? AND user_id = ?",
              [submission.points, submission.event_id, submission.user_id],
            );
          }
        }
      }
      const [rows]: any = await pool.query(
        `SELECT s.*, t.event_id as activity_id 
         FROM submissions s
         JOIN tasks t ON s.task_id = t.id
         WHERE s.id = ?`,
        [id],
      );
      getIO().emit(EVENTS.SUBMISSION_UPDATED, rows[0]);
    }

    await connection.commit();
    await logAudit({
      userId: adminId as string,
      action: "bulk_update_submission_status",
      targetType: "submission_bulk",
      description: `อัปเดตสถานะการส่งงานจำนวน ${ids.length} รายการ เป็น ${status}`,
      metadata: { ids, status, note },
    });
    res.json({ success: true });
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    connection.release();
  }
});

// Admin Route: Update status (Approve/Reject)
router.patch("/:id/status", requireAdmin, async (req, res) => {
  const adminId = req.headers["x-user-id"];
  const { status, note } = req.body; // status: 'approved' | 'rejected'
  const { id } = req.params;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [subRows]: any = await connection.query(
      `
        SELECT s.*, t.points
        FROM submissions s
        LEFT JOIN tasks t ON s.task_id = t.id
        WHERE s.id = ? FOR UPDATE
    `,
      [id],
    );

    if (subRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Submission not found" });
    }

    const submission = subRows[0];

    // Update status
    await connection.query(
      "UPDATE submissions SET status = ?, comment = ?, approved_by = ?, approved_at = NOW() WHERE id = ?",
      [status, note, adminId, id],
    );

    // Points management logic
    if (submission.points) {
      // CASE 1: Status becomes 'approved' (and it wasn't approved before)
      if (status === "approved" && submission.status !== "approved") {
        console.log(
          `[Points] PATCH approving submission ${id}. Awarding ${submission.points} to user ${submission.user_id}`,
        );
        await connection.query(
          "UPDATE users SET points = points + ?, total_score = total_score + ? WHERE id = ?",
          [submission.points, submission.points, submission.user_id],
        );

        // Track in event_leaderboards
        if (submission.task_id) {
          const [taskRows]: any = await connection.query(
            "SELECT event_id FROM tasks WHERE id = ?",
            [submission.task_id],
          );
          if (taskRows.length > 0 && taskRows[0].event_id) {
            const eventId = taskRows[0].event_id;
            const [lbRows]: any = await connection.query(
              "SELECT id FROM event_leaderboards WHERE event_id = ? AND user_id = ?",
              [eventId, submission.user_id],
            );

            if (lbRows.length > 0) {
              await connection.query(
                "UPDATE event_leaderboards SET score = score + ? WHERE id = ?",
                [submission.points, lbRows[0].id],
              );
            } else {
              await connection.query(
                "INSERT INTO event_leaderboards (event_id, user_id, score, rank) VALUES (?, ?, ?, 0)",
                [eventId, submission.user_id, submission.points],
              );
            }
          }
        }
      }
      // CASE 2: Status becomes 'rejected' (and it was approved before)
      else if (status === "rejected" && submission.status === "approved") {
        console.log(
          `[Points] PATCH rejecting previously approved submission ${id}. Deducting ${submission.points} from user ${submission.user_id}`,
        );
        await connection.query(
          "UPDATE users SET points = GREATEST(0, points - ?), total_score = GREATEST(0, total_score - ?) WHERE id = ?",
          [submission.points, submission.points, submission.user_id],
        );

        // Also deduct from event_leaderboards
        if (submission.task_id) {
          const [taskRows]: any = await connection.query(
            "SELECT event_id FROM tasks WHERE id = ?",
            [submission.task_id],
          );
          if (taskRows.length > 0 && taskRows[0].event_id) {
            const eventId = taskRows[0].event_id;
            await connection.query(
              "UPDATE event_leaderboards SET score = GREATEST(0, score - ?) WHERE event_id = ? AND user_id = ?",
              [submission.points, eventId, submission.user_id],
            );
          }
        }
      }
    }

    await connection.commit();

    // Log the action
    await logAudit({
      userId: adminId as string,
      action:
        status === "approved" ? "approve_submission" : "reject_submission",
      targetType: "submission",
      targetId: id,
      description: `${status === "approved" ? "อนุมัติ" : "ปฏิเสธ"}การส่งงาน ID: ${id} สำหรับผู้ใช้ ID: ${submission.user_id}`,
      metadata: { status, note, points: submission.points },
    });

    // Fetch inserted record with event_id
    const [rows]: any = await pool.query(
      `SELECT s.*, t.event_id as activity_id 
       FROM submissions s
       JOIN tasks t ON s.task_id = t.id
       WHERE s.id = ?`,
      [id],
    );

    // Trigger Realtime Event
    getIO().emit(EVENTS.SUBMISSION_UPDATED, rows[0]);

    res.json({ success: true });
  } catch (error: any) {
    await connection.rollback();
    res.status(400).json({ error: "Bad Request" });
  } finally {
    connection.release();
  }
});

// Admin Route: Delete a submission (Requested: specifically for rejected ones)
router.delete("/submission/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const adminId = req.headers["x-user-id"];

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [subRows]: any = await connection.query(
      "SELECT s.*, t.points, t.event_id FROM submissions s LEFT JOIN tasks t ON s.task_id = t.id WHERE s.id = ? FOR UPDATE",
      [id],
    );
    if (subRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "ไม่พบข้อมูลการส่งงาน" });
    }

    const submission = subRows[0];

    // Deduct points if it was approved
    if (submission.status === "approved" && submission.points) {
      console.log(
        `[Points] Deleting approved submission ${id}. Deducting ${submission.points} from user ${submission.user_id}`,
      );

      await connection.query(
        "UPDATE users SET points = GREATEST(0, points - ?), total_score = GREATEST(0, total_score - ?) WHERE id = ?",
        [submission.points, submission.points, submission.user_id],
      );

      if (submission.event_id) {
        await connection.query(
          "UPDATE event_leaderboards SET score = GREATEST(0, score - ?) WHERE event_id = ? AND user_id = ?",
          [submission.points, submission.event_id, submission.user_id],
        );
      }
    }

    await connection.query("DELETE FROM submissions WHERE id = ?", [id]);

    // Log the action
    await logAudit({
      userId: adminId as string,
      action: "delete_submission",
      targetType: "submission",
      targetId: id,
      description: `ลบการส่งงาน ID: ${id} ของผู้ใช้ ${submission.user_id} (สถานะก่อนหน้า: ${submission.status})`,
    });

    await connection.commit();

    // Trigger Realtime Event
    getIO().emit(EVENTS.SUBMISSION_DELETED, { id });

    res.json({ success: true });
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    connection.release();
  }
});

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

export default router;
