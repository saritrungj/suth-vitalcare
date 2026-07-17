import { Router } from "express";
import { pool } from "../mysql.js";

const router = Router();

function getUserId(req: any): string | null {
  const id = req.headers["x-user-id"];
  if (!id || id === "undefined") return null;
  return String(id);
}

// GET /api/notifications — recent notifications + unread count for the user.
router.get("/", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const [rows]: any = await pool.query(
      `SELECT id, type, title, message, link_url, ref_id, is_read, created_at
       FROM user_notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 30`,
      [userId],
    );
    const [countRows]: any = await pool.query(
      "SELECT COUNT(*) AS unread FROM user_notifications WHERE user_id = ? AND is_read = 0",
      [userId],
    );
    res.json({ items: rows, unread: countRows[0]?.unread || 0 });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PATCH /api/notifications/:id/read — mark one as read.
router.patch("/:id/read", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    await pool.query(
      "UPDATE user_notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND user_id = ?",
      [req.params.id, userId],
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PATCH /api/notifications/read-all — mark all as read.
router.patch("/read-all", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    await pool.query(
      "UPDATE user_notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0",
      [userId],
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
