import express from "express";
import { pool } from "../mysql.js";
import { requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// GET all rewards
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM rewards ORDER BY created_at DESC",
    );
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET single reward
router.get("/:id", async (req, res) => {
  try {
    const [rows]: any = await pool.query("SELECT * FROM rewards WHERE id = ?", [
      req.params.id,
    ]);

    if (rows.length === 0) return res.status(404).json({ error: "Not Found" });
    res.json(rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST create reward (admin)
router.post("/", requireAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      image_url,
      points_required,
      stock,
      is_active,
      reward_type,
      category,
    } = req.body;

    const [result]: any = await pool.query(
      `INSERT INTO rewards (name, description, image_url, points_required, stock, is_active, reward_type, category) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        description,
        image_url,
        points_required || 0,
        stock || 0,
        is_active !== false,
        reward_type || "item",
        category || "ทั่วไป",
      ],
    );

    const [rows]: any = await pool.query("SELECT * FROM rewards WHERE id = ?", [
      result.insertId,
    ]);
    res.status(201).json(rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PATCH update reward (admin)
router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const {
      name,
      description,
      image_url,
      points_required,
      stock,
      is_active,
      reward_type,
      category,
    } = req.body;

    // Dynamically build the update query based on provided fields (since undefined fields shouldn't overwrite)
    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push("name = ?");
      values.push(name);
    }
    if (description !== undefined) {
      updates.push("description = ?");
      values.push(description);
    }
    if (image_url !== undefined) {
      updates.push("image_url = ?");
      values.push(image_url);
    }
    if (points_required !== undefined) {
      updates.push("points_required = ?");
      values.push(points_required);
    }
    if (stock !== undefined) {
      updates.push("stock = ?");
      values.push(stock);
    }
    if (is_active !== undefined) {
      updates.push("is_active = ?");
      values.push(is_active);
    }
    if (reward_type !== undefined) {
      updates.push("reward_type = ?");
      values.push(reward_type);
    }
    if (category !== undefined) {
      updates.push("category = ?");
      values.push(category);
    }

    if (updates.length > 0) {
      values.push(id);
      await pool.query(
        `UPDATE rewards SET ${updates.join(", ")} WHERE id = ?`,
        values,
      );
    }

    const [rows]: any = await pool.query("SELECT * FROM rewards WHERE id = ?", [
      id,
    ]);
    res.json(rows[0] || {});
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// DELETE reward (admin)
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM rewards WHERE id = ?", [req.params.id]);
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST redeem reward
router.post("/redeem", async (req, res) => {
  const { reward_id } = req.body;
  // Redemption always debits the caller's own points — take the identity
  // from the auth header, not req.body.user_id. Previously user_id came
  // straight from the body, so anyone could redeem (and drain the points of)
  // any other account by supplying that account's id.
  const user_id = req.headers["x-user-id"];

  if (!user_id || !reward_id) {
    return res.status(400).json({ error: "Missing user_id or reward_id" });
  }

  // Use a transaction to ensure atomicity for point deduction & stock reduction
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Fetch user and reward
    let userQuery = "SELECT id, points FROM users WHERE id = ?";
    let queryVal = user_id;

    if (typeof user_id === "string" && isNaN(Number(user_id))) {
      userQuery = "SELECT id, points FROM users WHERE line_id = ?";
    }

    const [userRows]: any = await connection.query(userQuery, [queryVal]);
    if (userRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "User not found" });
    }
    const user = userRows[0];

    // Must use FOR UPDATE to lock the row and prevent race conditions on stock
    const [rewardRows]: any = await connection.query(
      "SELECT stock, points_required, name, reward_type, is_active FROM rewards WHERE id = ? FOR UPDATE",
      [reward_id],
    );

    if (rewardRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Reward not found" });
    }
    const reward = rewardRows[0];

    if (!reward.is_active) {
      await connection.rollback();
      return res.status(400).json({ error: "ของรางวัลนี้ยังไม่เปิดให้แลก" });
    }

    if (user.points < reward.points_required) {
      await connection.rollback();
      return res
        .status(400)
        .json({ error: "แต้มของคุณไม่เพียงพอสำหรับการแลกของรางวัลนี้" });
    }

    if (reward.stock <= 0) {
      await connection.rollback();
      return res.status(400).json({ error: "ของรางวัลนี้หมดแล้ว" });
    }

    // 2. Record redemption
    const status = reward.reward_type === "frame" ? "completed" : "pending";

    const [insertResult]: any = await connection.query(
      "INSERT INTO reward_redemptions (user_id, reward_id, status) VALUES (?, ?, ?)",
      [user.id, reward_id, status],
    );

    // 3. Deduct points and decrement stock
    await connection.query(
      "UPDATE users SET points = points - ? WHERE id = ?",
      [reward.points_required, user.id],
    );

    await connection.query(
      "UPDATE rewards SET stock = stock - 1 WHERE id = ?",
      [reward_id],
    );

    // Fetch the stored redemption record mapped object
    const [redemptionRows]: any = await connection.query(
      "SELECT * FROM reward_redemptions WHERE id = ?",
      [insertResult.insertId],
    );

    await connection.commit();

    res.status(201).json({
      message: "Redemption successful",
      redemption: redemptionRows[0],
      new_points: user.points - reward.points_required,
    });
  } catch (error: any) {
    await connection.rollback();
    console.error("[REDEEM] Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    connection.release();
  }
});

// ── ADMIN: redemption queue ──────────────────────────────────────────────────
// GET /api/items/admin/redemptions?status=pending
router.get("/admin/redemptions", requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT rr.*, r.name AS reward_name, r.image_url, r.points_required,
             u.fname_th, u.lname_th, u.picture_url
      FROM reward_redemptions rr
      JOIN rewards r ON rr.reward_id = r.id
      JOIN users u ON rr.user_id = u.id
    `;
    const params: any[] = [];
    if (status && typeof status === "string") {
      query += " WHERE rr.status = ?";
      params.push(status);
    }
    query += " ORDER BY rr.created_at DESC";
    const [rows]: any = await pool.query(query, params);
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PATCH /api/items/admin/redemptions/:id/status — fulfill or reject
// Rejecting/cancelling a pending redemption refunds points and restores stock.
router.patch(
  "/admin/redemptions/:id/status",
  requireAdmin,
  async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const adminId = req.headers["x-user-id"];
    const allowed = ["completed", "rejected", "cancelled"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows]: any = await connection.query(
        "SELECT * FROM reward_redemptions WHERE id = ? FOR UPDATE",
        [id],
      );
      if (rows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: "Redemption not found" });
      }
      const redemption = rows[0];

      if (redemption.status !== "pending") {
        await connection.rollback();
        return res.status(400).json({ error: "รายการนี้ถูกดำเนินการไปแล้ว" });
      }

      // Refund + restore stock when not completing.
      if (status === "rejected" || status === "cancelled") {
        const [rewardRows]: any = await connection.query(
          "SELECT points_required FROM rewards WHERE id = ? FOR UPDATE",
          [redemption.reward_id],
        );
        const refund = rewardRows[0]?.points_required || 0;
        await connection.query(
          "UPDATE users SET points = points + ? WHERE id = ?",
          [refund, redemption.user_id],
        );
        await connection.query(
          "UPDATE rewards SET stock = stock + 1 WHERE id = ?",
          [redemption.reward_id],
        );
      }

      await connection.query(
        "UPDATE reward_redemptions SET status = ?, fulfilled_by = ?, fulfilled_at = NOW() WHERE id = ?",
        [status, adminId || null, id],
      );

      await connection.commit();
      res.json({ success: true, status });
    } catch (error: any) {
      await connection.rollback();
      console.error("[REDEMPTION STATUS] Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    } finally {
      connection.release();
    }
  },
);

// GET user redemptions history
router.get("/redeemed/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const query = `
      SELECT rr.*, r.name, r.image_url, r.points_required as reward_points
      FROM reward_redemptions rr
      JOIN rewards r ON rr.reward_id = r.id
      WHERE rr.user_id = ?
      ORDER BY rr.created_at DESC
    `;
    const [rows]: any = await pool.query(query, [userId]);
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
