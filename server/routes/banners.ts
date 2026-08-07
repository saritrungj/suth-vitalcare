import express from "express";
import fs from "fs";
import path from "path";
import { pool } from "../mysql.js";
import { logAudit } from "../lib/audit.js";
import { getIO, EVENTS } from "../lib/realtime.js";
import { requireAdmin } from "../middleware/auth.js";

const router = express.Router();

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

/**
 * Deletes a `/uploads/...`-relative file, resolving the path and verifying it
 * stays inside UPLOADS_ROOT before unlinking. `relativeOldPath.split("/")`
 * alone does not strip ".." segments (they're truthy, so `.filter(Boolean)`
 * lets them through) — without this check, a banner whose `image_url` was set
 * to `/uploads/../../../whatever` would let delete/update unlink an arbitrary
 * file on disk.
 */
async function safeDeleteUpload(imageUrl: string, logPrefix: string) {
  if (!imageUrl || !imageUrl.startsWith("/uploads/")) return;
  const relativeOldPath = imageUrl.substring("/uploads/".length);
  const filePath = path.resolve(
    UPLOADS_ROOT,
    ...relativeOldPath.split("/").filter(Boolean),
  );
  if (
    filePath !== UPLOADS_ROOT &&
    !filePath.startsWith(UPLOADS_ROOT + path.sep)
  ) {
    console.warn(`${logPrefix} refused to delete outside uploads dir:`, {
      imageUrl,
      filePath,
    });
    return;
  }
  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      console.log(`${logPrefix} deleted ${filePath}`);
    }
  } catch (err: any) {
    console.warn(`${logPrefix} failed to delete ${imageUrl}:`, err.message);
  }
}

// Get all banners
router.get("/", async (req, res) => {
  try {
    const { active, position } = req.query;
    let query =
      "SELECT * FROM banners ORDER BY sort_order ASC, created_at DESC";

    if (active === "true") {
      query =
        "SELECT * FROM banners WHERE is_active = TRUE AND (start_date IS NULL OR start_date <= CURDATE()) AND (end_date IS NULL OR end_date >= CURDATE()) ORDER BY sort_order ASC, created_at DESC";
    }

    const [rows]: any = await pool.query(query);

    // Parse positions JSON and optionally filter by position
    const parsed = rows.map((r: any) => ({
      ...r,
      positions:
        typeof r.positions === "string"
          ? JSON.parse(r.positions)
          : r.positions || ["hero"],
    }));

    if (position && active === "true") {
      return res.json(
        parsed.filter((b: any) => b.positions.includes(position)),
      );
    }

    res.json(parsed);
  } catch (error) {
    console.error("Fetch banners error:", error);
    res.status(500).json({ error: "Failed to fetch banners" });
  }
});

// Toggle active status — MUST be before /:id to avoid conflict
router.patch("/:id/toggle", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      "UPDATE banners SET is_active = NOT is_active WHERE id = ?",
      [id],
    );

    // Log the action
    await logAudit({
      userId: req.headers["x-user-id"] as string,
      action: "toggle_banner",
      targetType: "banner",
      targetId: id,
      description: `เปลี่ยนสถานะการใช้งานแบนเนอร์ ID: ${id}`,
      req,
    });

    // ✅ Emit realtime event
    getIO().emit(EVENTS.BANNER_CREATED, { id });

    res.json({ message: "Banner status toggled" });
  } catch (error) {
    console.error("Toggle banner error:", error);
    res.status(500).json({ error: "Failed to toggle banner status" });
  }
});

// Create banner
router.post("/", requireAdmin, async (req, res) => {
  try {
    const {
      title,
      subtitle,
      image_url,
      link_url,
      link_type,
      link_activity_id,
      position,
      positions,
      sort_order,
      is_active,
      start_date,
      end_date,
    } = req.body;
    const finalPositions = positions || (position ? [position] : ["hero"]);
    const query = `
      INSERT INTO banners (title, subtitle, image_url, link_url, link_type, link_activity_id, positions, sort_order, is_active, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result]: any = await pool.query(query, [
      title,
      subtitle || null,
      image_url,
      link_url || null,
      link_type || "none",
      link_activity_id || null,
      JSON.stringify(finalPositions),
      sort_order || 0,
      is_active !== false,
      start_date || null,
      end_date || null,
    ]);

    // Log the action
    await logAudit({
      userId: req.headers["x-user-id"] as string,
      action: "create_banner",
      targetType: "banner",
      targetId: result.insertId,
      description: `สร้างแบนเนอร์: ${title}`,
      metadata: { title },
      req,
    });

    // ✅ Emit realtime event
    getIO().emit(EVENTS.BANNER_CREATED, { id: result.insertId });

    res.json({ id: result.insertId, message: "Banner created" });
  } catch (error) {
    console.error("Create banner error:", error);
    res.status(500).json({ error: "Failed to create banner" });
  }
});

// Update banner
router
  .route("/:id")
  .patch(requireAdmin, async (req, res) => {
    updateHandler(req, res);
  })
  .put(requireAdmin, async (req, res) => {
    updateHandler(req, res);
  });

async function updateHandler(req: any, res: any) {
  console.log(
    `[DEBUG] Update /api/banners/${req.params.id} body:`,
    JSON.stringify(req.body),
  );
  try {
    const { id } = req.params;
    const updates = req.body;
    const allowedFields = [
      "title",
      "subtitle",
      "image_url",
      "link_url",
      "link_type",
      "link_activity_id",
      "positions",
      "sort_order",
      "is_active",
      "start_date",
      "end_date",
    ];

    const filteredUpdates: Record<string, any> = {};

    // Map position to positions if present
    if (updates.position && !updates.positions) {
      updates.positions = [updates.position];
    }

    for (const key of allowedFields) {
      if (key in updates) {
        if (key === "positions") {
          filteredUpdates[key] = JSON.stringify(updates[key]);
        } else {
          filteredUpdates[key] = updates[key];
        }
      }
    }

    const keys = Object.keys(filteredUpdates);
    if (keys.length === 0)
      return res.status(400).json({ error: "No valid updates provided" });

    // Handle physical file deletion if image_url is changing
    if ("image_url" in filteredUpdates) {
      const [rows]: any = await pool.query(
        "SELECT image_url FROM banners WHERE id = ?",
        [id],
      );
      if (rows.length > 0) {
        const oldImageUrl = rows[0].image_url;
        if (oldImageUrl && oldImageUrl !== filteredUpdates.image_url) {
          await safeDeleteUpload(oldImageUrl, "[banner update]");
        }
      }
    }

    const fields = keys.map((k) => `${k} = ?`).join(", ");
    const values = [...Object.values(filteredUpdates), id];

    await pool.query(`UPDATE banners SET ${fields} WHERE id = ?`, values);

    // Log the action
    await logAudit({
      userId: req.headers["x-user-id"] as string,
      action: "edit_banner",
      targetType: "banner",
      targetId: id,
      description: `แก้ไขแบนเนอร์ ID: ${id}`,
      metadata: { updates: Object.keys(filteredUpdates) },
      req,
    });

    // ✅ Emit realtime event
    getIO().emit(EVENTS.BANNER_CREATED, { id });

    res.json({ message: "Banner updated" });
  } catch (error) {
    console.error("Update banner error:", error);
    res.status(500).json({ error: "Failed to update banner" });
  }
}

// Delete banner
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Get image_url first to delete file from disk
    const [rows]: any = await pool.query(
      "SELECT image_url FROM banners WHERE id = ?",
      [id],
    );
    if (rows.length > 0) {
      await safeDeleteUpload(rows[0].image_url, "[banner delete]");
    }

    // 2. Delete from database
    await pool.query("DELETE FROM banners WHERE id = ?", [id]);

    // Log the action
    await logAudit({
      userId: req.headers["x-user-id"] as string,
      action: "delete_banner",
      targetType: "banner",
      targetId: id,
      description: `ลบแบนเนอร์ ID: ${id}`,
      req,
    });

    // ✅ Emit realtime event
    getIO().emit(EVENTS.BANNER_DELETED, { id });

    res.json({ message: "Banner deleted" });
  } catch (error) {
    console.error("Delete banner error:", error);
    res.status(500).json({ error: "Failed to delete banner" });
  }
});

export default router;
