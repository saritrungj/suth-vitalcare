import express from "express";
import { pool } from "../mysql.js";
import { cleanupLogs } from "../lib/audit.js";
import { decryptFields, USER_ENCRYPTED_FIELDS } from "../lib/crypto.js";

const router = express.Router();

import { requireAdmin } from "../middleware/auth.js";

router.get("/", requireAdmin, async (req, res) => {
  const {
    page = 1,
    limit = 50,
    action,
    userId,
    search,
    startDate,
    endDate,
  } = req.query;

  const offset = (Number(page) - 1) * Number(limit);
  const params: any[] = [];
  let whereClauses = [];

  if (action) {
    whereClauses.push("l.action = ?");
    params.push(action);
  }

  if (userId) {
    whereClauses.push("l.user_id = ?");
    params.push(userId);
  }

  if (search) {
    whereClauses.push(
      "(l.description LIKE ? OR l.target_type LIKE ? OR l.target_id LIKE ?)",
    );
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (startDate) {
    whereClauses.push("l.created_at >= ?");
    params.push(startDate);
  }

  if (endDate) {
    whereClauses.push("l.created_at <= ?");
    params.push(`${endDate} 23:59:59`);
  }

  const whereStr =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  try {
    // Select logs with user info if available
    const query = `
      SELECT l.*, u.fname_th, u.lname_th, u.picture_url, u.line_id, u.role as user_role
      FROM audit_logs l
      LEFT JOIN users u ON l.user_id = u.id
      ${whereStr}
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [rows]: any = await pool.query(query, [
      ...params,
      Number(limit),
      offset,
    ]);

    const [total]: any = await pool.query(
      `SELECT COUNT(*) as count FROM audit_logs l ${whereStr}`,
      params,
    );

    // Decrypt user fields for PDPA compliant display in Admin UI
    const decryptedRows = rows.map((r: any) => {
      if (r.user_id) {
        return decryptFields(r, ["fname_th", "lname_th", "line_id", "email"]);
      }
      return r;
    });

    res.json({
      data: decryptedRows,
      total: total[0].count,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Stats for dashboard
router.get("/stats", requireAdmin, async (req, res) => {
  try {
    const [actionStats]: any = await pool.query(`
            SELECT action, COUNT(*) as count 
            FROM audit_logs 
            WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY action 
            ORDER BY count DESC 
            LIMIT 10
        `);

    const [dailyStats]: any = await pool.query(`
            SELECT DATE(created_at) as date, COUNT(*) as count 
            FROM audit_logs 
            WHERE created_at > DATE_SUB(NOW(), INTERVAL 14 DAY)
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `);

    res.json({
      actions: actionStats,
      daily: dailyStats,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Purge old logs (Log Retention)
router.post("/cleanup", requireAdmin, async (req, res) => {
  const { days = 90 } = req.body;
  try {
    const removed = await cleanupLogs(Number(days));
    res.json({
      success: true,
      removed,
      message: `ลบข้อมูล log ที่เก่ากว่า ${days} วัน เรียบร้อยแล้ว (${removed} รายการ)`,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
