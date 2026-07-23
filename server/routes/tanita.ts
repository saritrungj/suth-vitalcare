import express from "express";
import { pool } from "../mysql.js";
import {
  encryptFields,
  decryptFields,
  TANITA_ENCRYPTED_FIELDS,
} from "../lib/crypto.js";
import { awardBodyComposition } from "../lib/scoring.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const requesterId = req.headers["x-user-id"];
    if (!requesterId) return res.status(401).json({ error: "Unauthorized" });
    const [reqRows]: any = await pool.query(
      "SELECT role FROM users WHERE id = ?",
      [requesterId],
    );
    const requesterRole = reqRows[0]?.role;
    const isAdmin = requesterRole === "admin";
    if (!isAdmin && String(requesterId) !== String(req.body.user_id)) {
      return res
        .status(403)
        .json({ error: "Forbidden: cannot create record for another user" });
    }

    const p = req.body;

    // 1. Helpers for robust data handling
    const toNum = (v: any) => {
      const n = parseFloat(v);
      return isNaN(n) ? null : n;
    };

    const clamp = (v: any, min: number, max: number) => {
      const n = toNum(v);
      if (n === null) return null;
      return Math.min(Math.max(n, min), max);
    };

    // 2. Date formatting (MySQL friendly)
    const rawDate = p.recorded_at || new Date().toISOString();
    const mysqlDate = new Date(rawDate)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    // 3. Separate fields by DB type (matched to schema.sql)
    // TEXT fields (Safe to encrypt)
    const textData = {
      gender: p.gender || null,
      weight: p.weight || null,
      fat_pc: p.fat_pc || null,
      fat_mass: p.fat_mass || null,
      muscle_mass: p.muscle_mass || null,
      metabolic_age: p.metabolic_age || null,
      visceral_fat: p.visceral_fat || null,
      bmi: p.bmi || null,
    };
    const encryptedText = encryptFields(textData, Object.keys(textData));

    // 4. Construct final sanitised values
    const values = [
      p.user_id || null,
      p.submission_id || null,
      mysqlDate,
      p.body_type || null,
      encryptedText.gender,
      toNum(p.age),
      clamp(p.height, 0, 999.99),
      clamp(p.clothes_weight, 0, 999.99),
      encryptedText.weight,
      encryptedText.fat_pc,
      encryptedText.fat_mass,
      clamp(p.ffm, 0, 999.99),
      encryptedText.muscle_mass,
      clamp(p.tbw_mass, 0, 999.99),
      clamp(p.tbw_pc, 0, 999.99),
      clamp(p.bone_mass, 0, 999.99),
      toNum(p.bmr_kj),
      toNum(p.bmr_kcal),
      encryptedText.metabolic_age,
      encryptedText.visceral_fat,
      encryptedText.bmi,
      clamp(p.ideal_weight, 0, 999.99),
      clamp(p.obesity_degree, 0, 999.99),
      p.physique_rating || null,
      clamp(p.waist_cm, 0, 999.99),
      p.event_id || null, // New field
      p.session_label || null, // New field
    ];

    const query = `
      INSERT INTO tanita (
        user_id, submission_id, recorded_at,
        body_type, gender, age, height, clothes_weight, weight,
        fat_pc, fat_mass, ffm, muscle_mass, tbw_mass, tbw_pc,
        bone_mass, bmr_kj, bmr_kcal, metabolic_age, visceral_fat,
        bmi, ideal_weight, obesity_degree, physique_rating, waist_cm,
        event_id, session_label
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result]: any = await pool.query(query, values);

    // Configurable body-composition scoring (improvement vs previous record).
    if (p.user_id && result?.insertId) {
      awardBodyComposition(Number(p.user_id), result.insertId).catch(() => {});
    }

    res.json({ success: true, message: "Tanita data saved" });
  } catch (error) {
    console.error("Save Tanita error:", error);
    res.status(500).json({ error: "Failed to save Tanita data" });
  }
});

// 2. GET /user/:userId - Fetch recent history for a user (Authenticated)
router.get("/user/:userId", async (req, res) => {
  const requesterId = req.headers["x-user-id"];
  const { userId } = req.params;
  const { eventId } = req.query;

  if (!requesterId) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Permission Check (Self OR Admin OR Host)
    const [reqUserRows]: any = await pool.query(
      "SELECT role FROM users WHERE id = ?",
      [requesterId],
    );
    const requesterRole = reqUserRows[0]?.role;

    const isSelf = String(requesterId) === String(userId);
    const isAdmin = requesterRole === "admin";
    const isHost = requesterRole === "host";

    if (!isSelf && !isAdmin && !isHost) {
      return res.status(403).json({
        error: "Forbidden: You cannot access this user's health data",
      });
    }

    let query = "SELECT * FROM tanita WHERE user_id = ?";
    let params: any[] = [userId];

    if (eventId) {
      query += " AND event_id = ?";
      params.push(eventId);
    }

    query += " ORDER BY recorded_at DESC";

    const [rows]: any = await pool.query(query, params);

    // Decrypt fields for each record
    const decrypted = rows.map((r: any) =>
      decryptFields(r, TANITA_ENCRYPTED_FIELDS),
    );
    res.json(decrypted);
  } catch (error: any) {
    console.error("Fetch Tanita error:", error);
    res.status(500).json({ error: "Failed to fetch Tanita data" });
  }
});

// 3. Admin/Self: Update an existing Tanita record
router.patch("/:id", async (req, res) => {
  try {
    const requesterId = req.headers["x-user-id"];
    const { id } = req.params;

    if (!requesterId) return res.status(401).json({ error: "Unauthorized" });

    // Check permissions
    const [reqUserRows]: any = await pool.query(
      "SELECT role FROM users WHERE id = ?",
      [requesterId],
    );
    const requesterRole = reqUserRows[0]?.role;
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
        .json({ error: "Forbidden: You cannot update this record" });
    }

    const p = req.body;
    const toNum = (v: any) => {
      const n = parseFloat(v);
      return isNaN(n) ? null : n;
    };
    const clamp = (v: any, min: number, max: number) => {
      const n = toNum(v);
      if (n === null) return null;
      return Math.min(Math.max(n, min), max);
    };

    // Encrypt fields
    const textData = {
      gender: p.gender || null,
      weight: p.weight || null,
      fat_pc: p.fat_pc || null,
      fat_mass: p.fat_mass || null,
      muscle_mass: p.muscle_mass || null,
      metabolic_age: p.metabolic_age || null,
      visceral_fat: p.visceral_fat || null,
      bmi: p.bmi || null,
    };
    const encryptedText = encryptFields(textData, Object.keys(textData));

    const updates: Record<string, any> = {
      body_type: p.body_type || null,
      age: toNum(p.age),
      height: clamp(p.height, 0, 999.99),
      clothes_weight: clamp(p.clothes_weight, 0, 999.99),
      ffm: clamp(p.ffm, 0, 999.99),
      tbw_mass: clamp(p.tbw_mass, 0, 999.99),
      tbw_pc: clamp(p.tbw_pc, 0, 999.99),
      bone_mass: clamp(p.bone_mass, 0, 999.99),
      bmr_kj: toNum(p.bmr_kj),
      bmr_kcal: toNum(p.bmr_kcal),
      ideal_weight: clamp(p.ideal_weight, 0, 999.99),
      obesity_degree: clamp(p.obesity_degree, 0, 999.99),
      waist_cm: clamp(p.waist_cm, 0, 999.99),
      physique_rating: p.physique_rating || null,
      ...encryptedText,
    };

    const updateKeys = Object.keys(updates);
    const updateValues = Object.values(updates);
    const setClause = updateKeys.map((k) => `${k} = ?`).join(", ");

    if (updateKeys.length > 0) {
      await pool.query(`UPDATE tanita SET ${setClause} WHERE id = ?`, [
        ...updateValues,
        id,
      ]);
    }
    res.json({ success: true, message: "Tanita data updated" });
  } catch (error) {
    console.error("Update Tanita error:", error);
    res.status(500).json({ error: "Failed to update Tanita data" });
  }
});

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

export default router;
