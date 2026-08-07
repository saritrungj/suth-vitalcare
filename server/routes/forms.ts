import express from "express";
import { pool } from "../mysql.js";
import { requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// 1. Get all forms (or by category)
router.get("/", async (req, res) => {
  const { category } = req.query;

  try {
    let queryStr = "SELECT * FROM forms";
    let params: any[] = [];

    if (category) {
      queryStr += " WHERE category = ?";
      params.push(category);
    }

    queryStr += " ORDER BY created_at DESC";

    const [forms]: any = await pool.query(queryStr, params);

    if (forms.length === 0) return res.json([]);

    const formIds = forms.map((f: any) => f.id);
    const placeholders = formIds.map(() => "?").join(",");

    const [questions]: any = await pool.query(
      `SELECT * FROM form_questions WHERE form_id IN (${placeholders}) ORDER BY order_index ASC`,
      formIds,
    );

    const transformed = forms.map((form: any) => ({
      ...form,
      settings:
        typeof form.settings === "string"
          ? JSON.parse(form.settings)
          : form.settings,
      form_questions: questions
        .filter((q: any) => q.form_id === form.id)
        .map((q: any) => ({
          ...q,
          options:
            typeof q.options === "string" ? JSON.parse(q.options) : q.options,
          section_logic:
            typeof q.section_logic === "string"
              ? JSON.parse(q.section_logic)
              : q.section_logic,
        })),
    }));

    res.json(transformed);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 2. Get single form
router.get("/:id", async (req, res) => {
  try {
    const [formRows]: any = await pool.query(
      "SELECT * FROM forms WHERE id = ?",
      [req.params.id],
    );
    if (formRows.length === 0)
      return res.status(404).json({ error: "Form not found" });
    const form = formRows[0];

    const [questions]: any = await pool.query(
      "SELECT * FROM form_questions WHERE form_id = ? ORDER BY order_index ASC",
      [req.params.id],
    );

    res.json({
      ...form,
      settings:
        typeof form.settings === "string"
          ? JSON.parse(form.settings)
          : form.settings,
      form_questions: questions.map((q: any) => ({
        ...q,
        options:
          typeof q.options === "string" ? JSON.parse(q.options) : q.options,
        section_logic:
          typeof q.section_logic === "string"
            ? JSON.parse(q.section_logic)
            : q.section_logic,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 3. Create or Update form
// This router currently has no frontend callers (superseded by health.ts's
// equivalent, properly-gated routes) but is still mounted and reachable —
// previously every route here, including this one and DELETE /:id, had no
// auth check at all, letting anyone create/delete forms over raw HTTP.
router.post("/", requireAdmin, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const {
      id,
      title,
      description,
      form_image,
      category,
      questions,
      settings,
    } = req.body;
    let formId = id;

    console.log(
      `[Form Save] Request received. ID type: ${typeof id}, Value: ${id}`,
    );

    // Robust ID check
    const isEditing = id && id !== null && id !== "null" && id !== "";
    const settingsStr = JSON.stringify(settings || {});

    if (isEditing) {
      console.log(`[Form Save] Updating existing form: ${id}`);
      await connection.query(
        `UPDATE forms SET title = ?, description = ?, form_image = ?, category = ?, settings = ? WHERE id = ?`,
        [
          title || "ฟอร์มไม่มีชื่อ",
          description || "",
          form_image || null,
          category || "health",
          settingsStr,
          id,
        ],
      );

      // Clear old questions
      await connection.query("DELETE FROM form_questions WHERE form_id = ?", [
        id,
      ]);
    } else {
      console.log("[Form Save] Creating new form");
      const [result]: any = await connection.query(
        `INSERT INTO forms (title, description, form_image, category, settings) VALUES (?, ?, ?, ?, ?)`,
        [
          title || "ฟอร์มไม่มีชื่อ",
          description || "",
          form_image || null,
          category || "health",
          settingsStr,
        ],
      );
      formId = result.insertId;
    }

    if (questions && Array.isArray(questions) && questions.length > 0) {
      console.log(
        `[Form Save] Inserting ${questions.length} questions for form ${formId}`,
      );

      const qValues: any[] = [];
      const placeholders: string[] = [];

      questions.forEach((q: any, idx: number) => {
        placeholders.push("(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        qValues.push(
          formId,
          q.title || q.question_text || "คำถาม",
          q.type || q.question_type || "text",
          q.description || "",
          JSON.stringify(q.options || []),
          idx,
          q.required === true || q.is_required === true,
          q.min_value || 1,
          q.max_value || 5,
          q.min_label || "",
          q.max_label || "",
          q.media || null,
          q.show_score !== false,
          q.show_logic === true,
          JSON.stringify(q.section_logic || null),
          q.logic_id || q.id || q.temp_id || String(Date.now() + idx),
        );
      });

      if (placeholders.length > 0) {
        await connection.query(
          `INSERT INTO form_questions (
                  form_id, question_text, question_type, description, options, order_index, is_required, 
                  min_value, max_value, min_label, max_label, media, show_score, show_logic, section_logic, logic_id
               ) VALUES ${placeholders.join(", ")}`,
          qValues,
        );
      }
    }

    await connection.commit();
    res.json({ success: true, id: formId });
  } catch (err: any) {
    await connection.rollback();
    console.error("[Form Save] Critical Backend Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    connection.release();
  }
});

// 4. Submit response
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
    console.log(`[Submission] From user ${user_id} for form ${form_id}`);

    await connection.beginTransaction();

    // Calculate Score & Risk Level
    // 1. Fetch form settings and questions
    const [formRows]: any = await connection.query(
      "SELECT settings FROM forms WHERE id = ?",
      [form_id],
    );
    if (formRows.length === 0) throw new Error("Form not found");
    const formSettings =
      typeof formRows[0].settings === "string"
        ? JSON.parse(formRows[0].settings)
        : formRows[0].settings;

    const [questions]: any = await connection.query(
      "SELECT * FROM form_questions WHERE form_id = ?",
      [form_id],
    );

    let totalScore = 0;

    // Calculate score based on answers
    Object.entries(answers).forEach(([qId, val]) => {
      // Find question by its UUID or its logic_id
      const question = questions.find(
        (q: any) => String(q.id) === qId || String(q.logic_id) === qId,
      );

      if (question && question.options) {
        const parsedOptions =
          typeof question.options === "string"
            ? JSON.parse(question.options)
            : question.options;

        if (Array.isArray(val)) {
          // Checkbox (multiple)
          val.forEach((v: any) => {
            const opt = parsedOptions.find((o: any) => o.text === v);
            if (opt && typeof opt.score === "number") totalScore += opt.score;
          });
        } else {
          // Radio / Dropdown
          const opt = parsedOptions.find((o: any) => o.text === val);
          if (opt && typeof opt.score === "number") totalScore += opt.score;
        }
      }
    });

    // Find Risk Label
    let riskLabel = "ไม่ระบุ";
    const riskLevels = formSettings?.risk_levels || [];
    if (riskLevels.length > 0) {
      const level = riskLevels.find(
        (l: any) => totalScore >= l.min && totalScore <= l.max,
      );
      if (level) riskLabel = level.label;
    }

    const [subResult]: any = await connection.query(
      "INSERT INTO form_submissions (form_id, user_id, total_score, risk_label) VALUES (?, ?, ?, ?)",
      [form_id, user_id, totalScore, riskLabel],
    );
    const submissionId = subResult.insertId;

    const aValues: any[] = [];
    const placeholders: string[] = [];

    Object.entries(answers).forEach(([key, val]) => {
      // Find the real question ID if 'key' is actually a logic_id or temporary ID
      const question = questions.find(
        (fq: any) => String(fq.id) === key || String(fq.logic_id) === key,
      );

      if (!question) return; // Skip if question not found

      placeholders.push("(?, ?, ?, ?)");
      aValues.push(
        submissionId,
        question.id,
        Array.isArray(val) ? null : String(val),
        Array.isArray(val) ? JSON.stringify(val) : null,
      );
    });

    if (placeholders.length > 0) {
      await connection.query(
        `INSERT INTO form_answers (submission_id, question_id, answer_text, answer_json) VALUES ${placeholders.join(", ")}`,
        aValues,
      );
    }

    await connection.commit();

    res.json({
      success: true,
      submission_id: submissionId,
      total_score: totalScore,
      risk_label: riskLabel,
    });
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    connection.release();
  }
});

// 4.5 Get current user's submissions
router.get("/my-submissions/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const [submissions]: any = await pool.query(
      "SELECT * FROM form_submissions WHERE user_id = ? ORDER BY created_at DESC",
      [userId],
    );

    if (submissions.length === 0) return res.json([]);

    const formIds = [...new Set(submissions.map((s: any) => s.form_id))];
    const subIds = submissions.map((s: any) => s.id);

    const fPlaceholders = formIds.map(() => "?").join(",");
    const sPlaceholders = subIds.map(() => "?").join(",");

    const [forms]: any = await pool.query(
      `SELECT * FROM forms WHERE id IN (${fPlaceholders})`,
      formIds,
    );
    const [questions]: any = await pool.query(
      `SELECT * FROM form_questions WHERE form_id IN (${fPlaceholders})`,
      formIds,
    );
    const [answers]: any = await pool.query(
      `SELECT * FROM form_answers WHERE submission_id IN (${sPlaceholders})`,
      subIds,
    );

    const transformed = submissions.map((sub: any) => {
      const form = forms.find((f: any) => f.id === sub.form_id);
      const formQs = questions
        .filter((q: any) => q.form_id === sub.form_id)
        .map((q: any) => ({
          ...q,
          options:
            typeof q.options === "string" ? JSON.parse(q.options) : q.options,
          section_logic:
            typeof q.section_logic === "string"
              ? JSON.parse(q.section_logic)
              : q.section_logic,
        }));
      const subAnswers = answers
        .filter((a: any) => a.submission_id === sub.id)
        .map((a: any) => {
          const q = formQs.find((fq: any) => fq.id === a.question_id);
          return {
            ...a,
            answer_json:
              typeof a.answer_json === "string"
                ? JSON.parse(a.answer_json)
                : a.answer_json,
            form_questions: q || null,
          };
        });

      return {
        ...sub,
        forms: form
          ? {
              ...form,
              settings:
                typeof form.settings === "string"
                  ? JSON.parse(form.settings)
                  : form.settings,
              form_questions: formQs,
            }
          : null,
        form_answers: subAnswers,
      };
    });

    res.json(transformed);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 5. Get submissions for a form
router.get("/:id/submissions", async (req, res) => {
  try {
    const formId = req.params.id;
    const [submissions]: any = await pool.query(
      "SELECT * FROM form_submissions WHERE form_id = ? ORDER BY created_at DESC",
      [formId],
    );

    if (submissions.length === 0) return res.json([]);

    const subIds = submissions.map((s: any) => s.id);
    const userIds = [...new Set(submissions.map((s: any) => s.user_id))];

    const sPlaceholders = subIds.map(() => "?").join(",");
    const uPlaceholders = userIds.map(() => "?").join(",");

    const [users]: any = await pool.query(
      `SELECT id, fname_th, lname_th, picture_url FROM users WHERE id IN (${uPlaceholders})`,
      userIds,
    );

    const [answers]: any = await pool.query(
      `
          SELECT fa.*, fq.question_text 
          FROM form_answers fa
          JOIN form_questions fq ON fa.question_id = fq.id
          WHERE fa.submission_id IN (${sPlaceholders})
      `,
      subIds,
    );

    const transformed = submissions.map((sub: any) => {
      const user = users.find((u: any) => u.id === sub.user_id);
      const subAnswers = answers
        .filter((a: any) => a.submission_id === sub.id)
        .map((a: any) => ({
          ...a,
          answer_json:
            typeof a.answer_json === "string"
              ? JSON.parse(a.answer_json)
              : a.answer_json,
          form_questions: { question_text: a.question_text },
        }));

      return {
        ...sub,
        users: user || null,
        form_answers: subAnswers,
      };
    });

    res.json(transformed);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 6. Delete form
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    // Cascading takes care of form_questions and submissions
    await pool.query("DELETE FROM forms WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
