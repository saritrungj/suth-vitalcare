import express from "express";
import crypto from "crypto";
import { pool } from "../mysql.js";
import { decrypt } from "../lib/crypto.js";
import { awardAssessment } from "../lib/scoring.js";
import { logAudit } from "../lib/audit.js";
import { requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// Helper to structure forms and questions together
async function getFormsWithQuestions(formId?: string) {
  let query = 'SELECT * FROM forms WHERE category = "health"';
  let params: any[] = [];

  if (formId) {
    query += " AND id = ?";
    params.push(formId);
  }
  query += " ORDER BY created_at DESC";

  const [forms]: any = await pool.query(query, params);

  if (forms.length === 0) return [];

  const formIds = forms.map((f: any) => f.id);
  const placeholders = formIds.map(() => "?").join(",");
  const [questions]: any = await pool.query(
    `SELECT * FROM form_questions WHERE form_id IN (${placeholders}) ORDER BY order_index ASC`,
    formIds,
  );

  return forms.map((f: any) => {
    // Ensure settings object is parsed if MySQL returns it as string depending on library support
    let settings = f.settings;
    if (typeof settings === "string") {
      try {
        settings = JSON.parse(settings);
      } catch (e) {}
    }

    // Same for questions options
    const qList = questions
      .filter((q: any) => q.form_id === f.id)
      .map((q: any) => {
        let opts = q.options;
        if (typeof opts === "string") {
          try {
            opts = JSON.parse(opts);
          } catch (e) {}
        }
        return { ...q, options: opts };
      });

    return { ...f, settings, health_questions: qList }; // Keeps health_questions alias mapped for frontend
  });
}

// 1. Get all health forms
router.get("/forms", async (req, res) => {
  console.log("Fetching health forms (MySQL)...");
  try {
    const data = await getFormsWithQuestions();
    console.log(`Found ${data.length} forms`);
    res.json(data);
  } catch (error: any) {
    console.error("MySQL error fetching forms:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 2. Get single health form
router.get("/forms/:id", async (req, res) => {
  try {
    const data = await getFormsWithQuestions(req.params.id);
    if (data.length === 0)
      return res.status(404).json({ error: "Form Not Found" });
    res.json(data[0]);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 3. Create or Update health form
// No frontend caller currently, but still mounted and reachable — previously
// unauthenticated, letting anyone create/edit health forms over raw HTTP.
router.post("/forms", requireAdmin, async (req, res) => {
  // NOTE: This mirrors the front-end logic acting specifically for health forms,
  // keeping the "category='health'" flag behind the scenes.
  const { id, title, description, form_image, questions } = req.body;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let targetFormId = id;

    if (id) {
      // Update
      await connection.query(
        "UPDATE forms SET title = ?, description = ?, form_image = ? WHERE id = ?",
        [title, description, form_image, id],
      );

      // Delete old questions before inserting new ones
      await connection.query("DELETE FROM form_questions WHERE form_id = ?", [
        id,
      ]);
    } else {
      // Insert
      targetFormId = crypto.randomUUID(); // Node 19+ supports this native

      await connection.query(
        "INSERT INTO forms (id, title, description, form_image, category) VALUES (?, ?, ?, ?, ?)",
        [targetFormId, title, description, form_image, "health"],
      );
    }

    if (questions && Array.isArray(questions) && questions.length > 0) {
      const qValues: any[] = [];
      const placeholders: string[] = [];

      questions.forEach((q: any, idx: number) => {
        const qId = crypto.randomUUID();
        const opts = JSON.stringify(q.options || []);
        placeholders.push("(?, ?, ?, ?, ?, ?)");
        qValues.push(
          qId,
          targetFormId,
          q.title || q.question_text,
          q.type || q.question_type,
          opts,
          idx,
        );
      });

      await connection.query(
        `INSERT INTO form_questions (id, form_id, question_text, question_type, options, order_index) VALUES ${placeholders.join(", ")}`,
        qValues,
      );
    }

    await connection.commit();
    res.json({ success: true, id: targetFormId });
  } catch (error: any) {
    await connection.rollback();
    res.status(400).json({ error: "Bad Request" });
  } finally {
    connection.release();
  }
});

// 4. Submit form response
// No frontend caller currently (Health.vue posts to /save-assessment
// instead), but still mounted and reachable — previously unauthenticated.
router.post("/submissions", async (req, res) => {
  const { form_id, user_id, answers } = req.body;
  const requesterId = req.headers["x-user-id"];
  if (!requesterId) return res.status(401).json({ error: "Unauthorized" });
  if (String(requesterId) !== String(user_id)) {
    const [reqRows]: any = await pool.query(
      "SELECT role FROM users WHERE id = ?",
      [requesterId],
    );
    if (reqRows[0]?.role !== "admin") {
      return res
        .status(403)
        .json({ error: "คุณไม่มีสิทธิ์ส่งคำตอบในนามผู้ใช้อื่น" });
    }
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Create submission record
    const [subRes]: any = await connection.query(
      "INSERT INTO form_submissions (form_id, user_id) VALUES (?, ?)",
      [form_id, user_id],
    );
    const submissionId = subRes.insertId;

    // 2. Insert answers mapping object entries
    const answerEntries = Object.entries(answers || {});
    if (answerEntries.length > 0) {
      const aValues: any[] = [];
      const placeholders: string[] = [];

      answerEntries.forEach(([qId, val]) => {
        let answer_text: string | null = null;
        let answer_json: string | null = null;

        if (Array.isArray(val)) {
          answer_json = JSON.stringify(val);
        } else if (typeof val === "string") {
          answer_text = val;
        } else {
          answer_text = String(val);
        }

        placeholders.push("(?, ?, ?, ?)");
        aValues.push(submissionId, qId, answer_text, answer_json);
      });

      await connection.query(
        `INSERT INTO form_answers (submission_id, question_id, answer_text, answer_json) VALUES ${placeholders.join(", ")}`,
        aValues,
      );
    }

    await connection.commit();
    res.json({ success: true, submission_id: submissionId });
  } catch (error: any) {
    await connection.rollback();
    console.error("Submission failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    connection.release();
  }
});

// 5. Basic Health Assessment (3อ. 2ส.)
router.post("/save-assessment", async (req, res) => {
  const {
    userId,
    totalScore,
    overallLevel,
    sectionScores,
    granularAnswers,
    activityId,
    assessmentType,
  } = req.body;

  // This is the live endpoint Health.vue submits the 3อ2ส assessment to, and
  // it also awards points (awardAssessment below). Previously userId came
  // straight from the body with no check at all, so anyone could post a fake
  // assessment — and farm points — for an arbitrary victim account.
  const requesterId = req.headers["x-user-id"];
  if (!requesterId) return res.status(401).json({ error: "Unauthorized" });
  if (String(requesterId) !== String(userId)) {
    const [reqRows]: any = await pool.query(
      "SELECT role FROM users WHERE id = ?",
      [requesterId],
    );
    if (reqRows[0]?.role !== "admin") {
      return res
        .status(403)
        .json({ error: "คุณไม่มีสิทธิ์บันทึกแบบประเมินในนามผู้ใช้อื่น" });
    }
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Ensure tables exist or are updated as needed
    // ... (skipping CREATE TABLE check if already done)

    // 1. Insert main assessment record (Global History)
    const [globalResult]: any = await connection.query(
      "INSERT INTO health_assessments (user_id, total_score, overall_level, summary_json) VALUES (?, ?, ?, ?)",
      [userId, totalScore, overallLevel, JSON.stringify(sectionScores)],
    );
    const healthAssessmentId = globalResult.insertId;

    // 2. If linked to an activity, also record in assessment_submissions
    let eventSubmissionId: number | null = null;
    if (activityId) {
      const [eventResult]: any = await connection.query(
        "INSERT INTO assessment_submissions (event_id, user_id, test_type, total_score) VALUES (?, ?, ?, ?)",
        [activityId, userId, assessmentType || "pre_test", totalScore],
      );
      eventSubmissionId = eventResult.insertId;
    }

    // 3. Insert granular answers into assessment_answers if provided
    if (
      granularAnswers &&
      Array.isArray(granularAnswers) &&
      granularAnswers.length > 0
    ) {
      const aValues: any[] = [];
      const placeholders: string[] = [];

      granularAnswers.forEach((ans: any) => {
        placeholders.push("(?, ?, ?, ?, ?)");
        aValues.push(
          eventSubmissionId,
          healthAssessmentId,
          ans.question_text,
          ans.answer_text,
          ans.score,
        );
      });

      await connection.query(
        `INSERT INTO assessment_answers (submission_id, health_assessment_id, question_text, answer_text, score) VALUES ${placeholders.join(", ")}`,
        aValues,
      );
    }

    await connection.commit();

    // Configurable assessment scoring (band points + improvement bonus).
    if (userId) {
      awardAssessment(Number(userId), {
        healthAssessmentId,
        totalScore: Number(totalScore) || 0,
        assessmentType,
        activityId: activityId || null,
      }).catch(() => {});
    }

    res.json({
      success: true,
      id: healthAssessmentId,
      submissionId: eventSubmissionId,
    });
  } catch (e: any) {
    await connection.rollback();
    console.error("Save assessment error:", e);
    res.status(500).json({ error: e.message });
  } finally {
    connection.release();
  }
});

router.get("/check-submission/:eventId/:userId/:type", async (req, res) => {
  try {
    const { eventId, userId, type } = req.params;
    const [rows]: any = await pool.query(
      "SELECT id, submitted_at, total_score FROM assessment_submissions WHERE event_id = ? AND user_id = ? AND test_type = ? LIMIT 1",
      [eventId, userId, type],
    );
    res.json({ completed: rows.length > 0, submission: rows[0] || null });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/my-assessments/:userId", async (req, res) => {
  try {
    const [rows]: any = await pool.query(
      "SELECT * FROM health_assessments WHERE user_id = ? ORDER BY created_at DESC",
      [req.params.userId],
    );
    res.json(rows);
  } catch (e: any) {
    if (e.code === "ER_NO_SUCH_TABLE") return res.json([]);
    res.status(500).json({ error: e.message });
  }
});

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

// 6. Get pending activity tests for a user
router.get("/pending-activity-tests/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // 1. Get all events the user is registered for
    const [registrations]: any = await pool.query(
      `
      SELECT e.id, e.title, e.assessment_config, e.end_date, e.status
      FROM event_registrations er
      JOIN events e ON er.event_id = e.id
      WHERE er.user_id = ? AND (e.status = 'open' OR e.status = 'ongoing')
    `,
      [userId],
    );

    if (registrations.length === 0) return res.json([]);

    // 2. Get all existing assessment submissions for this user
    const [submissions]: any = await pool.query(
      "SELECT event_id, test_type FROM assessment_submissions WHERE user_id = ?",
      [userId],
    );

    const pending: any[] = [];

    registrations.forEach((reg: any) => {
      let config = reg.assessment_config;
      if (typeof config === "string") {
        try {
          config = JSON.parse(config);
        } catch {
          config = null;
        }
      }

      if (!config) return;

      // Check Pre-test
      if (config.pre_test?.enabled) {
        const done = submissions.some(
          (s: any) => s.event_id === reg.id && s.test_type === "pre_test",
        );
        if (!done) {
          pending.push({
            eventId: reg.id,
            eventTitle: reg.title,
            type: "pre_test",
            label: "แบบทดสอบก่อนเข้าร่วม (Pre-test)",
            description:
              config.pre_test.title || "กรุณาทำแบบทดสอบก่อนเริ่มกิจกรรม",
          });
        }
      }

      // Check Post-test logic
      if (config.post_test?.enabled) {
        const done = submissions.some(
          (s: any) => s.event_id === reg.id && s.test_type === "post_test",
        );
        if (!done) {
          // Post-test and is usually near the end of the event
          let shouldShowPostTest = true;

          // If not continuous and has end_date, check if it's within 3 days of end or past end
          if (reg.end_date) {
            const endDate = new Date(reg.end_date);
            endDate.setHours(23, 59, 59, 999);
            const today = new Date();
            const diffTime = endDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Only show post test if it's within 3 days before or after the event ends
            if (diffDays > 3) shouldShowPostTest = false;
          }

          if (shouldShowPostTest) {
            pending.push({
              eventId: reg.id,
              eventTitle: reg.title,
              type: "post_test",
              label: "แบบประเมินหลังจบ (Post-test)",
              description:
                config.post_test.title || "กรุณาทำแบบประเมินหลังจากจบกิจกรรม",
            });
          }
        }
      }
    });

    res.json(pending);
  } catch (error: any) {
    console.error("Pending tests error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 7. Admin: Get all health assessments (all users) with user info
router.get("/all-assessments", async (req, res) => {
  try {
    const [rows]: any = await pool.query(`
      SELECT 
        ha.id, ha.user_id, ha.total_score, ha.overall_level,
        ha.admin_comment, ha.commented_at, ha.commented_by,
        ha.created_at, ha.summary_json,
        u.fname_th, u.lname_th, u.picture_url, u.role_type,
        t.name AS team_name,
        cb.fname_th AS commenter_name
      FROM health_assessments ha
      JOIN users u ON ha.user_id = u.id
      LEFT JOIN teams t ON u.team_id = t.id
      LEFT JOIN users cb ON ha.commented_by = cb.id
      ORDER BY ha.created_at DESC
    `);

    const result = rows.map((r: any) => {
      let fname = r.fname_th || "";
      let lname = r.lname_th || "";
      let commenterName = r.commenter_name || "";
      try {
        fname = decrypt(fname);
      } catch {}
      try {
        lname = decrypt(lname);
      } catch {}
      try {
        commenterName = decrypt(commenterName);
      } catch {}

      let sectionScores = r.summary_json;
      if (typeof sectionScores === "string") {
        try {
          sectionScores = JSON.parse(sectionScores);
        } catch {
          sectionScores = [];
        }
      }

      // Determine risk sections
      const atRiskSections: string[] = [];
      if (Array.isArray(sectionScores)) {
        sectionScores.forEach((s: any) => {
          if (s.level === "ควรปรับปรุง" || s.level === "พอใช้") {
            const sectionNames: Record<string, string> = {
              food: "อาหาร",
              exercise: "ออกกำลังกาย",
              emotion: "อารมณ์",
              smoke: "บุหรี่",
              alcohol: "สุรา",
            };
            atRiskSections.push(
              sectionNames[s.sectionId || s.section_id] ||
                s.sectionId ||
                s.section_id,
            );
          }
        });
      }

      return {
        id: r.id,
        user_id: r.user_id,
        fname_th: fname,
        lname_th: lname,
        picture_url: r.picture_url,
        role_type: r.role_type,
        team_name: r.team_name,
        total_score: r.total_score,
        overall_level: r.overall_level,
        section_scores: sectionScores,
        at_risk_sections: atRiskSections,
        admin_comment: r.admin_comment,
        commented_at: r.commented_at,
        commenter_name: commenterName,
        created_at: r.created_at,
      };
    });

    res.json(result);
  } catch (e: any) {
    if (e.code === "ER_NO_SUCH_TABLE") return res.json([]);
    res.status(500).json({ error: e.message });
  }
});

// 8. Admin: Post comment on a health assessment
router.post("/assessments/:id/comment", async (req, res) => {
  const { id } = req.params;
  const { comment, adminId } = req.body;

  if (!comment || !adminId) {
    return res.status(400).json({ error: "comment and adminId are required" });
  }

  try {
    await pool.query(
      `UPDATE health_assessments SET admin_comment = ?, commented_at = NOW(), commented_by = ? WHERE id = ?`,
      [comment.trim(), adminId, id],
    );
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
