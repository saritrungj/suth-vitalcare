import express from "express";
import { pool } from "../mysql.js";
import { EVENTS, getIO } from "../lib/realtime.js";
import sharp from "sharp";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { decrypt } from "../lib/crypto.js";
import { fetchRemoteImage, safeMediaRedirect } from "../lib/safeUrl.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to robustly parse double-escaped JSON goal_config
function parseGoalConfig(gc: any) {
  if (!gc) return {};
  if (typeof gc === "object") return gc;
  let result = String(gc).trim();
  while (
    typeof result === "string" &&
    (result.startsWith("{") || result.startsWith('"') || result.startsWith("["))
  ) {
    try {
      const parsed = JSON.parse(result);
      if (parsed === result) break;
      result = parsed;
      if (typeof result === "object") break;
    } catch {
      if (result.startsWith('"') && result.endsWith('"')) {
        result = result.substring(1, result.length - 1);
        continue;
      }
      break;
    }
  }
  return typeof result === "object" ? result : {};
}

// Helper to normalize units for matching
function normalizeUnit(u: string): string {
  if (!u) return "";
  const s = u.toLowerCase().trim();
  if (
    s === "km" ||
    s === "กม" ||
    s === "กม." ||
    s === "กม้." ||
    s === "กิโลเมตร"
  )
    return "km";
  if (s === "kcal" || s === "แคล" || s === "แคลอรี่" || s === "calories")
    return "kcal";
  if (s === "points" || s === "pts" || s === "แต้ม" || s === "คะแนน")
    return "points";
  return s;
}

const router = express.Router();

// 1. Get Template by Event ID
router.get("/templates/:eventId", async (req, res) => {
  try {
    const [rows]: any = await pool.query(
      "SELECT * FROM certificate_templates WHERE event_id = ?",
      [req.params.eventId],
    );
    res.json(rows[0] || null);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 2. Create or Update Template
router.post("/templates", async (req, res) => {
  const {
    event_id,
    name,
    background_url,
    canvas_json,
    width,
    height,
    issue_mode,
  } = req.body;

  console.log("[Cert] Saving template for event:", event_id);

  try {
    if (!event_id) {
      return res.status(400).json({ error: "Missing event_id" });
    }

    // 1. Save or Update Template
    const [existing]: any = await pool.query(
      "SELECT id FROM certificate_templates WHERE event_id = ?",
      [event_id],
    );

    if (existing.length > 0) {
      await pool.query(
        `UPDATE certificate_templates
         SET name = ?, background_url = ?, canvas_json = ?, width = ?, height = ?, issue_mode = ?, updated_at = CURRENT_TIMESTAMP
         WHERE event_id = ?`,
        [
          name || "เกียรติบัตร",
          background_url || null,
          canvas_json || "{}",
          isNaN(Number(width)) ? 1754 : Number(width),
          isNaN(Number(height)) ? 1240 : Number(height),
          issue_mode || "event_end",
          event_id,
        ],
      );
    } else {
      await pool.query(
        `INSERT INTO certificate_templates (event_id, name, background_url, canvas_json, width, height, issue_mode)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          event_id,
          name || "เกียรติบัตร",
          background_url || null,
          canvas_json || "{}",
          isNaN(Number(width)) ? 1754 : Number(width),
          isNaN(Number(height)) ? 1240 : Number(height),
          issue_mode || "event_end",
        ],
      );
    }

    // 2. Sync with events table
    const [eventRows]: any = await pool.query(
      "SELECT certificate_config FROM events WHERE id = ?",
      [event_id],
    );

    if (eventRows.length > 0) {
      let currentConfig: any = {
        enabled: true,
        issue_mode: issue_mode || "event_end",
      };

      const rawConfig = eventRows[0].certificate_config;
      if (rawConfig) {
        try {
          const parsed =
            typeof rawConfig === "string" ? JSON.parse(rawConfig) : rawConfig;
          if (parsed && typeof parsed === "object") {
            currentConfig = {
              ...parsed,
              enabled: true,
              issue_mode: issue_mode || parsed.issue_mode || "event_end",
            };
          }
        } catch (e) {
          console.warn("[Cert] Failed to parse existing cert config:", e);
        }
      }

      await pool.query(
        "UPDATE events SET certificate_config = ? WHERE id = ?",
        [JSON.stringify(currentConfig), event_id],
      );
    }

    res.status(200).json({ message: "Template saved successfully" });
  } catch (error: any) {
    console.error("[Cert] Save Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 3. Check Eligibility
router.get("/check/:eventId/:userId", async (req, res) => {
  const { eventId, userId } = req.params;

  try {
    // 1. Check if event has a template
    const [templateRows]: any = await pool.query(
      "SELECT * FROM certificate_templates WHERE event_id = ?",
      [eventId],
    );
    if (templateRows.length === 0) {
      return res.json({
        eligible: false,
        reason: "กิจกรรมนี้ยังไม่มีเกียรติบัตร",
      });
    }
    const template = templateRows[0];

    // 2. Check if already issued
    const [issuedRows]: any = await pool.query(
      "SELECT * FROM user_certificates WHERE event_id = ? AND user_id = ?",
      [eventId, userId],
    );
    if (issuedRows.length > 0) {
      return res.json({
        eligible: true,
        issued: true,
        certificate: issuedRows[0],
      });
    }

    // 3. Logic based on issue_mode
    const [eventRows]: any = await pool.query(
      "SELECT * FROM events WHERE id = ?",
      [eventId],
    );
    const event = eventRows[0];

    let issueMode = template.issue_mode;
    try {
      const certConfig =
        typeof event.certificate_config === "string"
          ? JSON.parse(event.certificate_config)
          : event.certificate_config;
      if (certConfig && certConfig.issue_mode) {
        issueMode = certConfig.issue_mode;
      }
    } catch (e) {}

    const assessmentConfig =
      typeof event.assessment_config === "string"
        ? JSON.parse(event.assessment_config)
        : event.assessment_config;
    const goalConfig = parseGoalConfig(event.goal_config);

    const isPreTestRequired = assessmentConfig?.pre_test?.enabled === true;
    const isPostTestRequired = assessmentConfig?.post_test?.enabled === true;
    const isGoalRequired = goalConfig?.enabled === true;

    // 4. PREPARE CRITERIA DETAILS
    const criteriaDetails: any = {};
    const criteriaStatus = {
      registered: true,
      preTest: !isPreTestRequired,
      postTest: !isPostTestRequired,
      goal: !isGoalRequired,
      eventEnded: true,
    };

    // A. Check Pre-test
    if (isPreTestRequired) {
      const [preRows]: any = await pool.query(
        "SELECT id FROM assessment_submissions WHERE event_id = ? AND user_id = ? AND test_type = 'pre_test'",
        [eventId, userId],
      );
      criteriaStatus.preTest = preRows.length > 0;
      criteriaDetails.preTest = {
        label: "แบบทดสอบก่อนเริ่ม",
        completed: criteriaStatus.preTest,
      };
    }

    // B. Check Post-test
    if (isPostTestRequired) {
      const [postRows]: any = await pool.query(
        "SELECT id FROM assessment_submissions WHERE event_id = ? AND user_id = ? AND test_type = 'post_test'",
        [eventId, userId],
      );
      criteriaStatus.postTest = postRows.length > 0;
      criteriaDetails.postTest = {
        label: "แบบประเมินหลังจบ",
        completed: criteriaStatus.postTest,
      };
    }

    // C. Check Goal
    if (isGoalRequired) {
      const targetType = normalizeUnit(goalConfig.target_type || "points");
      const targetValue = Number(goalConfig.target_value) || 0;
      const isTeamGoal = goalConfig.mode === "team";
      let userValue = 0;

      const unitLabels: any = {
        points: "คะแนน",
        km: "กม.",
        steps: "ก้าว",
        cal: "แคลอรี่",
        min: "นาที",
        meal: "มื้อ",
      };

      if (targetType === "points") {
        if (isTeamGoal) {
          const [teamRows]: any = await pool.query(
            `SELECT COALESCE(SUM(t.points), 0) as val 
             FROM submissions s 
             JOIN tasks t ON s.task_id = t.id 
             JOIN users u ON s.user_id = u.id
             WHERE t.event_id = ? AND s.status = 'approved'
             AND u.team_id = (SELECT team_id FROM users WHERE id = ?)`,
            [eventId, userId],
          );
          userValue = teamRows[0]?.val || 0;
        } else {
          const [scoreRows]: any = await pool.query(
            `SELECT COALESCE(SUM(t.points), 0) as val 
             FROM submissions s 
             JOIN tasks t ON s.task_id = t.id 
             WHERE t.event_id = ? AND s.user_id = ? AND s.status = 'approved'`,
            [eventId, userId],
          );
          userValue = scoreRows[0]?.val || 0;
        }
      } else if (targetType === "submissions") {
        if (isTeamGoal) {
          const [subRows]: any = await pool.query(
            `SELECT COUNT(*) as val 
             FROM submissions s 
             JOIN tasks t ON s.task_id = t.id 
             JOIN users u ON s.user_id = u.id
             WHERE t.event_id = ? AND s.status = 'approved'
             AND u.team_id = (SELECT team_id FROM users WHERE id = ?)`,
            [eventId, userId],
          );
          userValue = subRows[0]?.val || 0;
        } else {
          const [subRows]: any = await pool.query(
            "SELECT COUNT(*) as val FROM submissions s JOIN tasks t ON s.task_id = t.id WHERE t.event_id = ? AND s.user_id = ? AND s.status = 'approved'",
            [eventId, userId],
          );
          userValue = subRows[0]?.val || 0;
        }
      } else {
        if (isTeamGoal) {
          const [unitRows]: any = await pool.query(
            `
            SELECT COALESCE(SUM(s.value), 0) as val
            FROM submissions s
            JOIN tasks t ON s.task_id = t.id
            JOIN users u ON s.user_id = u.id
            WHERE t.event_id = ? AND s.status = 'approved'
            AND t.metric_unit = ?
            AND u.team_id = (SELECT team_id FROM users WHERE id = ?)
          `,
            [eventId, targetType, userId],
          );
          userValue = unitRows[0]?.val || 0;
        } else {
          const [unitRows]: any = await pool.query(
            `
            SELECT COALESCE(SUM(s.value), 0) as val
            FROM submissions s
            JOIN tasks t ON s.task_id = t.id
            WHERE t.event_id = ? AND s.user_id = ? AND s.status = 'approved'
            AND t.metric_unit = ?
          `,
            [eventId, userId, targetType],
          );
          userValue = unitRows[0]?.val || 0;
        }
      }

      criteriaStatus.goal = Number(userValue) >= targetValue;
      criteriaDetails.goal = {
        label: isTeamGoal ? "เป้าหมายทีม" : "เป้าหมายสะสม",
        current: Number(userValue),
        target: targetValue,
        unit: unitLabels[targetType] || targetType,
        completed: criteriaStatus.goal,
      };
    }

    // D. Check Event End
    if (issueMode === "event_end") {
      const now = new Date();
      const endDate = event.end_date ? new Date(event.end_date) : null;
      criteriaStatus.eventEnded = endDate ? now >= endDate : true;
      criteriaDetails.eventEnded = {
        label: "กิจกรรมสิ้นสุดลงแล้ว",
        completed: criteriaStatus.eventEnded,
      };
    }

    // 5. EVALUATE ELIGIBILITY BY MODE
    let eligible = false;
    let reason = "";

    if (issueMode === "immediately") {
      eligible = true;
    } else if (issueMode === "event_end") {
      if (!criteriaStatus.eventEnded) {
        reason = "รอรับได้เมื่อสิ้นสุดกิจกรรม";
      } else if (!criteriaStatus.preTest) {
        reason = "กรุณาทำแบบทดสอบก่อนเริ่ม";
      } else if (!criteriaStatus.goal) {
        reason = `คะแนนเป้าหมายยังไม่ครบ (ขาด ${Math.max(0, criteriaDetails.goal.target - criteriaDetails.goal.current)} ${criteriaDetails.goal.unit})`;
      } else if (!criteriaStatus.postTest) {
        reason = "กรุณาทำแบบประเมินหลังจบ";
      } else {
        eligible = true;
      }
    } else if (issueMode === "goal_complete") {
      if (!criteriaStatus.preTest) {
        reason = "กรุณาทำแบบทดสอบก่อนเริ่ม";
      } else if (!criteriaStatus.goal) {
        reason = `ทำเป้าหมายยังไม่สำเร็จ (${criteriaDetails.goal.current}/${criteriaDetails.goal.target} ${criteriaDetails.goal.unit})`;
      } else if (!criteriaStatus.postTest) {
        reason = "กรุณาทำแบบประเมินหลังจบ";
      } else {
        eligible = true;
      }
    } else if (issueMode === "manual") {
      const [statusRows]: any = await pool.query(
        "SELECT status FROM certificate_status WHERE event_id = ? AND user_id = ?",
        [eventId, userId],
      );
      eligible = statusRows.length > 0 && statusRows[0].status === "issued";
      reason = eligible ? "" : "รอแอดมินพิจารณาออกเกียรติบัตรให้";
    }

    return res.json({
      eligible,
      reason,
      criteria: criteriaDetails,
      debug: {
        issueMode,
        isGoalRequired,
        isPreTestRequired,
        isPostTestRequired,
        criteriaStatus,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Helper: Render Certificate
async function renderCertificate(template: any, userData: any) {
  const { background_url, canvas_json, width, height } = template;
  const canvas =
    typeof canvas_json === "string" ? JSON.parse(canvas_json) : canvas_json;

  // 1. Get background
  // If background_url is relative, we might need to resolve it
  let bgBuffer: Buffer;
  if (background_url.startsWith("http")) {
    bgBuffer = await fetchRemoteImage(background_url);
  } else {
    // Assume local path in public folder
    const publicRoot = path.resolve(process.cwd(), "public");
    const fullPath = path.resolve(publicRoot, background_url.replace(/^\//, ""));
    if (!fullPath.startsWith(publicRoot + path.sep)) throw new Error("Invalid background path");
    bgBuffer = fs.readFileSync(fullPath);
  }

  const overlays: any[] = [];

  for (const obj of canvas.objects) {
    if (obj.type === "i-text" || obj.type === "text") {
      let text = obj.text || "";
      const fieldId = obj.data?.field;

      const fName = decrypt(userData.fname_th) || "";
      const lName = decrypt(userData.lname_th) || "";
      const fullName = (fName + " " + lName).trim() || "ผู้เข้าร่วม";

      text = text.replace(/\{\{user_fullname\}\}/g, fullName);
      text = text.replace(/\{\{user_nickname\}\}/g, userData.nickname || "");
      text = text.replace(/\{\{user_team\}\}/g, userData.team_name || "");
      text = text.replace(/\{\{event_title\}\}/g, userData.event_title || "");
      text = text.replace(
        /\{\{event_date\}\}/g,
        userData.event_date || userData.current_date,
      );
      text = text.replace(
        /\{\{user_score\}\}/g,
        String(userData.event_score || 0),
      );
      text = text.replace(
        /\{\{user_rank\}\}/g,
        String(userData.event_rank || 0),
      );
      text = text.replace(/\{\{issued_date\}\}/g, userData.current_date);

      // Legacy fallback
      if (fieldId === "user_fullname") text = fullName;
      else if (fieldId === "user_nickname") text = userData.nickname || "";
      else if (fieldId === "user_team") text = userData.team_name || "";
      else if (fieldId === "event_title") text = userData.event_title;
      else if (fieldId === "event_date")
        text = userData.event_date || userData.current_date;
      else if (fieldId === "user_score")
        text = String(userData.total_score || "0");
      else if (fieldId === "issued_date") text = userData.current_date;
      else if (fieldId === "name") text = fullName;
      else if (fieldId === "date") text = userData.current_date;

      // Escape SVG characters
      const escapedText = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

      // Calculate x based on alignment
      let x = obj.left;
      let textAnchor = "start";
      if (obj.textAlign === "center") {
        x = obj.left + (obj.width * obj.scaleX) / 2;
        textAnchor = "middle";
      } else if (obj.textAlign === "right") {
        x = obj.left + obj.width * obj.scaleX;
        textAnchor = "end";
      }

      // We use a simplified SVG overlay for each text element. MUST contain xmlns!
      const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <text
            x="${x}"
            y="${obj.top + obj.fontSize * obj.scaleY * 0.85}"
            font-family="Kanit, sans-serif"
            font-size="${obj.fontSize * obj.scaleY}px"
            fill="${obj.fill}"
            text-anchor="${textAnchor}"
            font-weight="${obj.fontWeight || "normal"}"
          >${escapedText}</text>
        </svg>
      `;

      overlays.push({ input: Buffer.from(svg), top: 0, left: 0 });
    } else if (
      (obj.type === "image" || obj.type === "circle" || obj.type === "rect") &&
      obj.data?.field === "user_picture"
    ) {
      // Handle Profile Picture
      const picUrl = userData.picture_url || userData.pictureUrl; // Fallback for various naming
      if (picUrl) {
        try {
          let picBuffer: Buffer;
          if (picUrl.startsWith("data:image/")) {
            const base64Data = picUrl.split(",")[1];
            picBuffer = Buffer.from(base64Data, "base64");
          } else if (picUrl.startsWith("http")) {
            picBuffer = await fetchRemoteImage(picUrl);
          } else {
            const publicRoot = path.resolve(process.cwd(), "public");
            const fullPath = path.resolve(publicRoot, picUrl.replace(/^\//, ""));
            if (!fullPath.startsWith(publicRoot + path.sep)) continue;
            if (fs.existsSync(fullPath)) {
              picBuffer = fs.readFileSync(fullPath);
            } else {
              continue; // Skip if file not found
            }
          }

          const targetW = Math.round(obj.width * obj.scaleX);
          const targetH = Math.round(obj.height * obj.scaleY);
          const radius = Math.min(targetW, targetH) / 2;

          // Create circular mask string
          const maskSvg = Buffer.from(`
            <svg width="${targetW}" height="${targetH}">
              <circle cx="${targetW / 2}" cy="${targetH / 2}" r="${radius}" fill="white" />
            </svg>
          `);

          const processedPic = await sharp(picBuffer)
            .resize(targetW, targetH, { fit: "cover" })
            .composite([
              {
                input: maskSvg,
                blend: "dest-in",
              },
            ])
            .png()
            .toBuffer();

          overlays.push({
            input: processedPic,
            top: Math.round(obj.top),
            left: Math.round(obj.left),
          });
        } catch (err) {
          console.error("Error processing profile pic:", err);
        }
      }
    } else if (obj.type === "image") {
      // Handle General Image
      if (obj.src) {
        try {
          let imgBuffer: Buffer;
          if (obj.src.startsWith("http")) {
            imgBuffer = await fetchRemoteImage(obj.src);
          } else {
            const publicRoot = path.resolve(process.cwd(), "public");
            const fullPath = path.resolve(publicRoot, obj.src.replace(/^\//, ""));
            if (!fullPath.startsWith(publicRoot + path.sep)) continue;
            if (fs.existsSync(fullPath)) imgBuffer = fs.readFileSync(fullPath);
            else continue;
          }

          const targetW = Math.round(obj.width * obj.scaleX);
          const targetH = Math.round(obj.height * obj.scaleY);

          const processed = await sharp(imgBuffer)
            .resize(targetW, targetH)
            .png()
            .toBuffer();

          overlays.push({
            input: processed,
            top: Math.round(obj.top),
            left: Math.round(obj.left),
          });
        } catch (err) {
          console.error("Error processing image:", err);
        }
      }
    } else if (obj.type === "rect" || obj.type === "circle") {
      // Handle Basic Shapes
      const targetW = Math.round(obj.width * obj.scaleX);
      const targetH = Math.round(obj.height * obj.scaleY);
      const fill = obj.fill || "transparent";

      const svg =
        obj.type === "rect"
          ? `<svg width="${targetW}" height="${targetH}"><rect width="${targetW}" height="${targetH}" fill="${fill}" opacity="${obj.opacity || 1}" /></svg>`
          : `<svg width="${targetW}" height="${targetH}"><circle cx="${targetW / 2}" cy="${targetH / 2}" r="${targetW / 2}" fill="${fill}" opacity="${obj.opacity || 1}" /></svg>`;

      overlays.push({
        input: Buffer.from(svg),
        top: Math.round(obj.top),
        left: Math.round(obj.left),
      });
    }
  }

  return await sharp(bgBuffer)
    .resize(width, height)
    .composite(overlays)
    .png()
    .toBuffer();
}

// 4. Generate Certificate
router.post("/generate", async (req, res) => {
  const { event_id, user_id } = req.body;
  const requesterId = req.headers["x-user-id"];

  if (!requesterId) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Check if requester has permission (Self OR Admin OR Host of this event)
    const [reqUserRows]: any = await pool.query(
      "SELECT role FROM users WHERE id = ?",
      [requesterId],
    );
    const requesterRole = reqUserRows[0]?.role;

    const isSelf = String(requesterId) === String(user_id);
    const isAdmin = requesterRole === "admin";
    let isHost = false;

    if (requesterRole === "host") {
      const [eventCheck]: any = await pool.query(
        "SELECT created_by FROM events WHERE id = ?",
        [event_id],
      );
      if (
        eventCheck.length > 0 &&
        String(eventCheck[0].created_by) === String(requesterId)
      ) {
        isHost = true;
      }
    }

    if (!isSelf && !isAdmin && !isHost) {
      return res.status(403).json({
        error: "Forbidden: You cannot generate certificates for this user",
      });
    }

    // 1. Check template
    const [templateRows]: any = await pool.query(
      "SELECT * FROM certificate_templates WHERE event_id = ?",
      [event_id],
    );
    if (templateRows.length === 0)
      return res.status(404).json({ error: "Template not found" });
    const template = templateRows[0];

    // 2. Get User & Event Info
    const [userRows]: any = await pool.query(
      `
      SELECT u.*, t.name as team_name
      FROM users u
      LEFT JOIN teams t ON u.team_id = t.id
      WHERE u.id = ?
    `,
      [user_id],
    );
    const [eventRows]: any = await pool.query(
      "SELECT title FROM events WHERE id = ?",
      [event_id],
    );
    if (userRows.length === 0)
      return res.status(404).json({ error: "User not found" });

    const user = userRows[0];
    const event = eventRows[0];

    // 3. New: Calculate Event-Specific Score & Rank
    const [scoreRows]: any = await pool.query(
      `
      SELECT COALESCE(SUM(IFNULL(s.value, 0) + IF(IFNULL(s.value, 0) = 0, IFNULL(t.points, 0), 0)), 0) as score
      FROM submissions s
      JOIN tasks t ON s.task_id = t.id
      WHERE s.user_id = ? AND t.event_id = ? AND s.status = 'approved'
    `,
      [user_id, event_id],
    );
    const eventScore = scoreRows[0]?.score || 0;

    const [rankRows]: any = await pool.query(
      `
      SELECT COUNT(*) + 1 as rank
      FROM (
        SELECT u.id as user_id,
          (SELECT COALESCE(SUM(IFNULL(s.value, 0) + IF(IFNULL(s.value, 0) = 0, IFNULL(t.points, 0), 0)), 0)
           FROM submissions s JOIN tasks t ON s.task_id = t.id WHERE s.user_id = u.id AND t.event_id = ? AND s.status = 'approved') as score
        FROM registrations r JOIN users u ON r.user_id = u.id
        WHERE r.event_id = ?
      ) as leader
      WHERE score > ?
    `,
      [event_id, event_id, eventScore],
    );
    const eventRank = rankRows[0]?.rank || 0;

    const userData = {
      ...user,
      event_title: event.title,
      event_score: eventScore,
      event_rank: eventRank,
      current_date: new Date().toLocaleDateString("th-TH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    };

    // 3. Render
    const buffer = await renderCertificate(template, userData);

    // 4. Save to file
    const fileName = `cert_${event_id}_${user_id}_${Date.now()}.png`;
    const dir = path.join(process.cwd(), "public", "uploads", "certificates");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/certificates/${fileName}`;

    // 5. Save/Update user_certificates record
    await pool.query(
      `INSERT INTO user_certificates (template_id, user_id, event_id, image_url)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE image_url = ?, issued_at = CURRENT_TIMESTAMP`,
      [template.id, user_id, event_id, publicUrl, publicUrl],
    );

    // 6. Notify user's frontend to refresh cert availability dot
    getIO().emit(EVENTS.USER_UPDATED, { id: user_id });

    res.status(201).json({ success: true, url: publicUrl });
  } catch (error: any) {
    console.error("Generate Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 6. Download/View Certificate
router.get("/download/:eventId/:userId", async (req, res) => {
  const { eventId, userId } = req.params;
  const requesterId = req.headers["x-user-id"];

  if (!requesterId) return res.status(401).send("Unauthorized");

  try {
    // Check if requester has permission (Self OR Admin OR Host of this event)
    const [reqUserRows]: any = await pool.query(
      "SELECT role FROM users WHERE id = ?",
      [requesterId],
    );
    const requesterRole = reqUserRows[0]?.role;

    const isSelf = String(requesterId) === String(userId);
    const isAdmin = requesterRole === "admin";
    let isHost = false;

    if (requesterRole === "host") {
      const [eventCheck]: any = await pool.query(
        "SELECT created_by FROM events WHERE id = ?",
        [eventId],
      );
      if (
        eventCheck.length > 0 &&
        String(eventCheck[0].created_by) === String(requesterId)
      ) {
        isHost = true;
      }
    }

    if (!isSelf && !isAdmin && !isHost) {
      return res
        .status(403)
        .send("Forbidden: You cannot access this certificate");
    }

    const [rows]: any = await pool.query(
      "SELECT image_url FROM user_certificates WHERE event_id = ? AND user_id = ?",
      [eventId, userId],
    );

    if (rows.length === 0 || !rows[0].image_url) {
      return res
        .status(404)
        .send("Certificate not found or not yet generated.");
    }

    const publicUrl = rows[0].image_url;
    const safeUrl = safeMediaRedirect(publicUrl);
    if (!safeUrl) return res.status(400).send("Certificate URL is not allowed");
    res.redirect(302, safeUrl);
  } catch (error: any) {
    res.status(500).send("Internal Server Error");
  }
});

// 5. Get available certificates for orange dot notification
router.get("/available/:userId", async (req, res) => {
  const requesterId = req.headers["x-user-id"];
  const { userId } = req.params;

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
    const isHost = requesterRole === "host"; // Note: This 'isHost' check is simplified and doesn't verify event ownership for this route.

    if (!isSelf && !isAdmin && !isHost) {
      return res.status(403).json({
        error: "Forbidden: You cannot check availability for this user",
      });
    }

    // Find events where user is registered and has a template but NO certificate record yet
    const [rows]: any = await pool.query(
      `
      SELECT e.id
      FROM events e
      JOIN registrations r ON e.id = r.event_id
      JOIN certificate_templates ct ON e.id = ct.event_id
      LEFT JOIN user_certificates uc ON (e.id = uc.event_id AND uc.user_id = ?)
      WHERE r.user_id = ? AND uc.id IS NULL
    `,
      [userId, userId],
    );

    // Note: This is an simplified eligibility check.
    // In a production app, we'd filter further based on issue_mode logic.
    // For simplicity, we return IDs where a template exists but hasn't been claimed.
    res.json(rows.map((r: any) => r.id));
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
