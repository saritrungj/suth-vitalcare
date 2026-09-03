import express from "express";
import { pool } from "../mysql.js";
import {
  encryptFields,
  decryptFields,
  USER_ENCRYPTED_FIELDS,
  TANITA_ENCRYPTED_FIELDS,
} from "../lib/crypto.js";
import { logAudit } from "../lib/audit.js";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { getIO, EVENTS } from "../lib/realtime.js";
import {
  isTurnstileEnabled,
  shouldRequireTurnstile,
  verifyTurnstileToken,
} from "../lib/turnstile.js";
import {
  normalizeLoginIdentifier,
  userMatchesLoginIdentifier,
} from "../lib/loginAuth.js";

import { requireAdmin, requireAdminOrHost } from "../middleware/auth.js";
import { clearSessionCookie, setSessionCookie } from "../lib/session.js";
import { verifyLineAccessToken } from "../lib/lineAuth.js";
import { getClientIp } from "../lib/clientIp.js";

const router = express.Router();

const publicUser = (row: any) => {
  const user = decryptFields(row, USER_ENCRYPTED_FIELDS);
  const {
    password_hash: _passwordHash,
    reset_token: _resetToken,
    reset_token_expiry: _resetTokenExpiry,
    ...safe
  } = user;
  return safe;
};

const sendAuthenticatedUser = (res: express.Response, row: any, status = 200) => {
  setSessionCookie(res, row.id);
  return res.status(status).json(publicUser(row));
};

const hashResetToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

const isDatabaseConnectionError = (error: any) =>
  ["ECONNREFUSED", "PROTOCOL_CONNECTION_LOST", "ETIMEDOUT"].includes(
    error?.code,
  );

const sendLoginError = (res: any, error: any) => {
  if (isDatabaseConnectionError(error)) {
    return res.status(503).json({
      error: "Database connection unavailable. Please check MySQL service.",
    });
  }
  return res.status(500).json({ error: "Internal Server Error" });
};

// ── LOGIN / REGISTER via LINE ──
router.post("/login", async (req, res) => {
  const {
    accessToken,
    captchaToken,
    isRegister,
    noCreate,
  } = req.body;
  if (!accessToken)
    return res.status(400).json({ error: "LINE access token is required" });

  // 1. Verify Cloudflare Turnstile for user-initiated LINE login/register.
  // Silent noCreate checks are allowed for background session validation.
  if (
    isTurnstileEnabled() &&
    shouldRequireTurnstile({ isRegister, noCreate })
  ) {
    const captcha = await verifyTurnstileToken(captchaToken, getClientIp(req));
    if (!captcha.success) {
      return res.status(captcha.status).json({ error: captcha.error });
    }
  }

  try {
    // Identity must come from LINE, never from browser-supplied profile fields.
    const lineProfile = await verifyLineAccessToken(accessToken);
    const line_id = lineProfile.userId;
    const fname_th = lineProfile.displayName;
    const picture_url = lineProfile.pictureUrl;
    // 2. Check if user already exists by line_id
    const [existing]: any = await pool.query(
      `
      SELECT u.*, tm.name as team_name,
        EXISTS(SELECT 1 FROM teams t2 WHERE t2.host_id = u.id) as is_team_host
      FROM users u 
      LEFT JOIN teams tm ON u.team_id = tm.id 
      WHERE u.line_id = ?
    `,
      [line_id],
    );

    if (existing.length > 0) {
      // (Update picture logic remains the same)
      const currentPic = existing[0].picture_url || "";
      const isManualUpload =
        currentPic.includes("/uploads/") ||
        currentPic.startsWith("data:image/");

      if (picture_url && !isManualUpload && picture_url !== currentPic) {
        await pool.query("UPDATE users SET picture_url = ? WHERE id = ?", [
          picture_url,
          existing[0].id,
        ]);
        existing[0].picture_url = picture_url;
      }

      if (existing[0].is_suspended) {
        return res.status(403).json({
          error:
            existing[0].is_suspended === 2
              ? "บัญชีของคุณถูกแบนถาวร"
              : "บัญชีของคุณถูกระงับการใช้งานชั่วคราว",
        });
      }

      await logAudit({
        req,
        userId: existing[0].id,
        action: "login_line",
        description: `ผู้ใช้ล็อกอินผ่าน LINE (ID: ${existing[0].id})`,
      });

      return sendAuthenticatedUser(res, existing[0]);
    }

    // If noCreate is true, don't insert a new record
    if (noCreate) {
      return res
        .status(404)
        .json({ error: "User not found and noCreate is active" });
    }

    // 3. New user → insert
    const newUser: any = { line_id, picture_url: picture_url || null };
    if (fname_th) newUser.fname_th = fname_th;

    const encryptedUser = encryptFields(newUser, USER_ENCRYPTED_FIELDS);
    const keys = Object.keys(encryptedUser);
    const values = Object.values(encryptedUser);
    const placeholders = keys.map(() => "?").join(", ");

    const [result]: any = await pool.query(
      `INSERT INTO users (${keys.join(", ")}) VALUES (${placeholders})`,
      values,
    );

    const [rows]: any = await pool.query("SELECT * FROM users WHERE id = ?", [
      result.insertId,
    ]);
    return sendAuthenticatedUser(res, rows[0], 201);
  } catch (error: any) {
    console.error("Login/Register error:", error?.message || error);
    if (String(error?.message || "").startsWith("LINE")) {
      return res.status(401).json({ error: "LINE authentication failed" });
    }
    sendLoginError(res, error);
  }
});

// ── LOGIN via Google ──
router.post("/login-google", (_req, res) => {
  return res.status(501).json({
    error: "Google login is disabled until server-side ID-token verification is configured",
  });
});

// ── REGISTER via Email & Password ──
router.post("/register-email", async (req, res) => {
  const { email, username, password, fname_th, captchaToken } = req.body;
  // Username OR email is acceptable as the login identifier; password required.
  if (!password || (!email && !username))
    return res
      .status(400)
      .json({ error: "Username (or email) and password are required" });
  if (typeof password !== "string" || password.length < 8 || password.length > 20) {
    return res.status(400).json({ error: "Password must be 8-20 characters" });
  }

  // Username format (plaintext, unique). Validated before any DB work.
  let normalizedUsername: string | null = null;
  if (username !== undefined && username !== null && String(username) !== "") {
    normalizedUsername = String(username).trim();
    if (!/^[a-zA-Z0-9._-]{4,30}$/.test(normalizedUsername)) {
      return res.status(400).json({
        error: "ชื่อผู้ใช้ต้องมี 4-30 ตัวอักษร (a-z, A-Z, 0-9, . _ - เท่านั้น)",
      });
    }
  }

  // 1. Verify Cloudflare Turnstile (Captcha). A token is required whenever
  // Turnstile is enabled.
  // Uses the same verifier as login so both paths agree on what a valid token
  // is (form encoding, remoteip handling, expiry classification).
  if (isTurnstileEnabled()) {
    const captcha = await verifyTurnstileToken(captchaToken, getClientIp(req));
    // Never block registration because the verification service itself is down.
    if (!captcha.success && captcha.code !== "captcha-unavailable") {
      return res.status(captcha.status).json({ error: captcha.error });
    }
  }

  try {
    // 2a. Username uniqueness — plaintext column with a real UNIQUE index,
    // matched case-insensitively by the collation.
    if (normalizedUsername) {
      const [dupUser]: any = await pool.query(
        "SELECT id FROM users WHERE username = ?",
        [normalizedUsername],
      );
      if (dupUser.length > 0) {
        return res.status(400).json({ error: "ชื่อผู้ใช้นี้ถูกใช้งานแล้ว" });
      }
    }

    // 2b. Email uniqueness (only when an email is supplied).
    // Emails are encrypted with random IVs, so we decrypt-and-compare in app.
    if (email) {
      const [candidates]: any = await pool.query("SELECT id, email FROM users");
      const { decrypt } = await import("../lib/crypto.js");

      const isDuplicate = candidates.some((u: any) => {
        const decryptedEmail = decrypt(u.email);
        return (
          decryptedEmail && decryptedEmail.toLowerCase() === email.toLowerCase()
        );
      });

      if (isDuplicate) {
        return res.status(400).json({ error: "อีเมลนี้ถูกใช้งานแล้ว" });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Normal user registration. `username` stays plaintext (not in
    // USER_ENCRYPTED_FIELDS); email (when present) gets encrypted.
    const newUser: any = { password_hash, line_id: null, role: "user" };
    if (email) newUser.email = email;
    if (normalizedUsername) newUser.username = normalizedUsername;
    if (fname_th) newUser.fname_th = fname_th;

    const encryptedUser = encryptFields(newUser, USER_ENCRYPTED_FIELDS);
    const keys = Object.keys(encryptedUser);
    const values = Object.values(encryptedUser);
    const placeholders = keys.map(() => "?").join(", ");

    const [result]: any = await pool.query(
      `INSERT INTO users (${keys.join(", ")}) VALUES (${placeholders})`,
      values,
    );

    const [rows]: any = await pool.query("SELECT * FROM users WHERE id = ?", [
      result.insertId,
    ]);

    await logAudit({
      req,
      userId: result.insertId,
      action: "register_email",
      description: `ผู้ใช้สมัครสมาชิกใหม่: ${normalizedUsername || email}`,
    });

    return sendAuthenticatedUser(res, rows[0], 201);
  } catch (error: any) {
    console.error("Email Register error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ── LOGIN via Email & Password ──
router.post("/login-email", async (req, res) => {
  const { email, password, captchaToken } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required" });
  if (typeof password !== "string" || password.length > 128) {
    return res.status(400).json({ error: "Invalid credentials" });
  }

  if (isTurnstileEnabled()) {
    const captcha = await verifyTurnstileToken(captchaToken, getClientIp(req));
    if (!captcha.success) {
      return res.status(captcha.status).json({ error: captcha.error });
    }
  }

  try {
    const searchTarget = normalizeLoginIdentifier(email);

    const USER_SELECT = `
      SELECT u.*, tm.name as team_name,
        EXISTS(SELECT 1 FROM teams t2 WHERE t2.host_id = u.id) as is_team_host
      FROM users u
      LEFT JOIN teams tm ON u.team_id = tm.id
    `;

    // 1a. Fast path — `username` is plaintext with a UNIQUE index and a
    // case-insensitive collation, so it resolves in one indexed lookup.
    // The slow path below loads every user row, which under concurrent logins
    // exhausts the connection pool (connectionLimit 20 / queueLimit 50) and
    // makes logins fail at random.
    const [byUsername]: any = await pool.query(
      `${USER_SELECT} WHERE u.username = ? LIMIT 1`,
      [searchTarget],
    );
    let userMatch: any = byUsername[0] || null;

    // 1b. Slow path — email/phone/id_code are AES-encrypted with random IVs so
    // they cannot be matched in SQL; decrypt and compare in app.
    if (!userMatch) {
      const [allUsers]: any = await pool.query(USER_SELECT);
      userMatch =
        allUsers.find((u: any) =>
          userMatchesLoginIdentifier(u, searchTarget),
        ) || null;
    }

    if (!userMatch) {
      return res
        .status(400)
        .json({ error: "ไม่พบบัญชีผู้ใช้นี้ หรือรหัสผ่านไม่ถูกต้อง" });
    }

    if (!userMatch.password_hash) {
      return res.status(400).json({
        error: "บัญชีนี้เปิดใช้งานด้วยช่องทางอื่น กรุณาล็อกอินผ่านช่องทางนั้น",
      });
    }

    const isMatch = await bcrypt.compare(password, userMatch.password_hash);
    if (!isMatch) {
      return res
        .status(400)
        .json({ error: "ไม่พบบัญชีผู้ใช้นี้ หรือรหัสผ่านไม่ถูกต้อง" });
    }

    if (userMatch.is_suspended) {
      return res.status(403).json({
        error:
          userMatch.is_suspended === 2
            ? "บัญชีของคุณถูกแบนถาวร"
            : "บัญชีของคุณถูกระงับการใช้งานชั่วคราว",
      });
    }

    await logAudit({
      req,
      userId: userMatch.id,
      action: "login_email",
      description: `ผู้ใช้ล็อกอินด้วยอีเมล/ไอดี: ${email}`,
    });

    return sendAuthenticatedUser(res, userMatch);
  } catch (error: any) {
    console.error("Email Login error:", error);
    sendLoginError(res, error);
  }
});

// ── FORGOT PASSWORD ──
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    const [existing]: any = await pool.query(
      "SELECT id FROM users WHERE email = ? OR phone = ? OR id_code = ?",
      [email, email, email],
    );
    if (existing.length === 0) {
      // Don't reveal if email exists for security, or just return success
      return res.json({
        message:
          "หากอีเมลนี้อยู่ในระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้คุณ (จำลอง)",
      });
    }

    const userId = existing[0].id;
    // Generate simple token for demo/MVP purposes
    const token = crypto.randomBytes(32).toString("base64url");
    const expiry = new Date(Date.now() + 3600000); // 1 hour

    await pool.query(
      "UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?",
      [hashResetToken(token), expiry, userId],
    );

    // In a real app, you'd send an email here. For now, we return the token (insecure but works for testing/MVP)
    // or just return success and log the token to console.
    if (process.env.NODE_ENV !== "production") {
      console.log(`[PASSWORD RESET] Development token created for user ${userId}`);
    }

    await logAudit({
      req,
      userId: userId,
      action: "forgot_password_request",
      description: `ผู้ใช้ขอรีเซ็ตรหัสผ่านสำหรับอีเมล: ${email}`,
    });

    res.json({
      message: "ดำเนินการสร้างลิงก์รีเซ็ตรหัสผ่านเรียบร้อย",
    });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  return res.status(204).send();
});

// ── RESET PASSWORD ──
router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword)
    return res
      .status(400)
      .json({ error: "Token and new password are required" });
  if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 20) {
    return res.status(400).json({ error: "Password must be 8-20 characters" });
  }

  try {
    const [existing]: any = await pool.query(
      "SELECT id FROM users WHERE reset_token = ? AND reset_token_expiry > NOW()",
      [hashResetToken(String(token))],
    );

    if (existing.length === 0) {
      return res.status(400).json({ error: "Token ไม่ถูกต้องหรือหมดอายุแล้ว" });
    }

    const userId = existing[0].id;
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(newPassword, salt);

    await pool.query(
      "UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?",
      [password_hash, userId],
    );

    await logAudit({
      req,
      userId: userId,
      action: "reset_password_success",
      description: `ผู้ใช้รีเซ็ตรหัสผ่านใหม่สำเร็จ (User ID: ${userId})`,
    });

    res.json({ message: "เปลี่ยนรหัสผ่านใหม่เรียบร้อยแล้ว" });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 1. Get Rankings
router.get("/rankings/individual", async (req, res) => {
  try {
    const [rows]: any = await pool.query(
      "SELECT id, fname_th, lname_th, nickname, picture_url, total_score as total_distance FROM users ORDER BY total_score DESC LIMIT 20",
    );

    // Decrypt names for leaderboard
    const decryptedRows = rows.map((r: any) =>
      decryptFields(r, ["fname_th", "lname_th", "nickname"]),
    );
    res.json(decryptedRows);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/rankings/teams", async (req, res) => {
  try {
    const [teamRows]: any = await pool.query("SELECT * FROM teams");
    const [userRows]: any = await pool.query(
      "SELECT team_id, total_score as total_distance FROM users WHERE team_id IS NOT NULL",
    );

    const transformed = teamRows.map((team: any) => {
      const teamUsers = userRows.filter((u: any) => u.team_id === team.id);
      const calculatedDist = teamUsers.reduce(
        (acc: number, user: any) => acc + (Number(user.total_distance) || 0),
        0,
      );

      return {
        ...team,
        users: teamUsers,
        total_dist: calculatedDist,
      };
    });

    transformed.sort((a: any, b: any) => b.total_dist - a.total_dist);
    res.json(transformed.slice(0, 10));
  } catch (error: any) {
    console.error("Fetch team rankings error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 2. User Registrations (Specific routes BEFORE generic :id)
router.get("/:userId/registrations", async (req, res) => {
  const requesterId = req.headers["x-user-id"];
  const { userId } = req.params;

  if (!requesterId) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Check Permission (Self OR Admin OR Host)
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
        error: "Forbidden: You cannot access this user's registrations",
      });
    }

    // Join registrations, events, tasks, and leaderboards
    const [rows]: any = await pool.query(
      `
        SELECT
            r.id as registration_id, r.user_id, r.created_at as joined_at,
            e.id as event_id, e.title as event_title, e.poster as event_poster,
            e.start_date, e.end_date, e.location_name,
            e.goal_config, e.team_mode, e.status as event_status,
            l.score as leaderboard_score, l.rank as leaderboard_rank,
            (SELECT COUNT(*) FROM registrations WHERE event_id = e.id) as total_participants,
            t.id as task_id, t.type as task_type, t.note as task_note, 
            t.points as task_points, t.allowed_days as task_allowed_days, t.metric_type
        FROM registrations r
        JOIN events e ON r.event_id = e.id
        LEFT JOIN event_leaderboards l ON e.id = l.event_id AND r.user_id = l.user_id
        LEFT JOIN tasks t ON e.id = t.event_id
        WHERE r.user_id = ?
    `,
      [userId],
    );

    // Grouping by event
    const eventMap = new Map();
    for (const row of rows) {
      if (!eventMap.has(row.event_id)) {
        const goalConfig =
          typeof row.goal_config === "string"
            ? JSON.parse(row.goal_config || "{}")
            : row.goal_config || {};
        eventMap.set(row.event_id, {
          id: row.registration_id,
          joined_at: row.joined_at,
          score: row.leaderboard_score,
          rank: row.leaderboard_rank,
          totalParticipants: row.total_participants,
          event: {
            id: row.event_id,
            title: row.event_title,
            poster: row.event_poster,
            start_date: row.start_date,
            end_date: row.end_date,
            location: row.location_name,
            status: row.event_status || "open",
            team_mode: row.team_mode,
            goal_config: goalConfig,
          },
          tasks: [],
        });
      }

      if (row.task_id) {
        const ev = eventMap.get(row.event_id);
        const allowedDays =
          typeof row.task_allowed_days === "string"
            ? JSON.parse(row.task_allowed_days)
            : row.task_allowed_days || [0, 1, 2, 3, 4, 5, 6];

        ev.tasks.push({
          id: row.task_id,
          type: row.task_type,
          note: row.task_note,
          points: row.task_points,
          allowed_days: allowedDays,
          metric_type: row.metric_type,
        });
      }
    }

    res.json(Array.from(eventMap.values()));
  } catch (error: any) {
    console.error("[ERROR] Fetch Regs Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:userId/activities/:activityId/missions", async (req, res) => {
  try {
    const [rows]: any = await pool.query(
      `
          SELECT s.*, t.* 
          FROM submissions s
          INNER JOIN tasks t ON s.task_id = t.id
          WHERE s.user_id = ? AND t.event_id = ?
      `,
      [req.params.userId, req.params.activityId],
    );

    // We simulate Supabase nesting here
    const nested = rows.map((r: any) => {
      // extract task specific fields to a nested object
      const taskObj = {
        id: r.task_id,
        event_id: r.event_id,
        task_date: r.task_date,
        type: r.type,
        note: r.note,
        points: r.points,
        allowed_days: r.allowed_days,
        is_active: r.is_active,
        metric_type: r.metric_type,
        metric_unit: r.metric_unit,
        goal_type: r.goal_type,
        goal_value: r.goal_value,
        submission_type: r.submission_type,
      };
      return { ...r, tasks: taskObj };
    });
    res.json(nested);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 3. Admin: Get all users
router.get("/", requireAdmin, async (req, res) => {
  try {
    const [rows]: any = await pool.query(`
        SELECT u.*, 
          (SELECT COUNT(*) FROM registrations WHERE user_id = u.id) as registrations_count
        FROM users u 
        ORDER BY u.id ASC
     `);
    const decryptedRows = rows.map((r: any) => publicUser(r));
    res.json(decryptedRows);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ── Admin: Ban/Unban ──
router.patch("/:id/ban", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_suspended, ban_reason } = req.body;
    const adminId = req.headers["x-user-id"] as string;

    const [userRows]: any = await pool.query(
      "SELECT * FROM users WHERE id = ?",
      [id],
    );
    if (userRows.length === 0)
      return res.status(404).json({ error: "ไม่พบผู้ใช้งาน" });

    const user = publicUser(userRows[0]);
    const displayName =
      `${user.fname_th || ""} ${user.lname_th || ""}`.trim() ||
      user.nickname ||
      id;

    await pool.query("UPDATE users SET is_suspended = ? WHERE id = ?", [
      is_suspended,
      id,
    ]);

    // Kick user in realtime if suspended or banned
    if (is_suspended) {
      getIO().emit(EVENTS.USER_KICKED, { id: Number(id) });
    }
    getIO().emit(EVENTS.USER_UPDATED, { id: Number(id), is_suspended });

    await logAudit({
      userId: adminId,
      action: is_suspended === 2 ? "admin_ban_user" : "admin_suspend_user",
      description: `แอดมิน ${is_suspended === 2 ? "แบน" : "ระงับ"} ผู้ใช้งาน: ${displayName}`,
      targetType: "user",
      targetId: id,
      metadata: { is_suspended, ban_reason },
      req,
    });

    res.json({ success: true, message: "ดำเนินการสำเร็จ" });
  } catch (error: any) {
    console.error(`[BAN ERROR] User ID: ${req.params.id}`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/:id/unban", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.headers["x-user-id"] as string;

    const [userRows]: any = await pool.query(
      "SELECT * FROM users WHERE id = ?",
      [id],
    );
    if (userRows.length === 0)
      return res.status(404).json({ error: "ไม่พบผู้ใช้งาน" });

    const user = publicUser(userRows[0]);
    const displayName =
      `${user.fname_th || ""} ${user.lname_th || ""}`.trim() ||
      user.nickname ||
      id;

    await pool.query("UPDATE users SET is_suspended = 0 WHERE id = ?", [id]);

    // Emit update so UI refreshes for other admins
    getIO().emit(EVENTS.USER_UPDATED, { id: Number(id), is_suspended: 0 });

    await logAudit({
      userId: adminId,
      action: "admin_unban_user",
      description: `แอดมินยกเลิกการแบนผู้ใช้งาน: ${displayName}`,
      targetType: "user",
      targetId: id,
      metadata: { target_user_id: id },
      req,
    });

    res.json({ success: true, message: "ยกเลิกการแบนสำเร็จ" });
  } catch (error: any) {
    console.error(`[UNBAN ERROR] User ID: ${req.params.id}`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

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

// 3.1 Admin: Get Full User Profile for Dashboard
router.get("/:id/full-profile", requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    // A. User row (decrypted)
    const [userRows]: any = await pool.query(
      "SELECT * FROM users WHERE id = ?",
      [id],
    );
    if (!userRows.length)
      return res.status(404).json({ error: "User not found" });
    const user = publicUser(userRows[0]);

    // B. Submissions & Progress — tasks has no 'title', so use note as task_name
    const [subRows]: any = await pool.query(
      `
      SELECT s.id, s.user_id, s.task_id, s.img_url, s.value, s.status,
             s.comment, s.activity_type, s.proof_type, s.created_at,
             t.type as task_type, t.note as task_name,
             t.metric_type, t.metric_unit, t.submission_type,
             e.title as event_title
      FROM submissions s
      LEFT JOIN tasks t ON s.task_id = t.id
      LEFT JOIN events e ON t.event_id = e.id
      WHERE s.user_id = ?
      ORDER BY s.created_at DESC
    `,
      [id],
    );

    // C. Tanita records — decrypt encrypted fields, ORDER BY recorded_at DESC (newest first)
    const [healthRows]: any = await pool.query(
      "SELECT * FROM tanita WHERE user_id = ? ORDER BY recorded_at DESC",
      [id],
    );
    const healthDecrypted = healthRows.map((r: any) =>
      decryptFields(r, TANITA_ENCRYPTED_FIELDS),
    );

    // D. Registered Events (join with event details)
    const [regRows]: any = await pool.query(
      `
      SELECT r.id, r.user_id, r.event_id, r.created_at,
             e.title, e.start_date, e.end_date, e.poster, e.status as event_status
      FROM registrations r
      JOIN events e ON r.event_id = e.id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `,
      [id],
    );

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

    res.json({
      user,
      submissions: subRows,
      healthHistory: healthDecrypted,
      registrations: regRows,
      assessments,
      assessmentSubmissions,
    });
  } catch (error: any) {
    console.error("[full-profile error]", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 3.2 GET /:id/profile — Decrypted user profile (self or admin/host)
router.get("/:id/profile", async (req, res) => {
  const { id } = req.params;
  const requesterId = req.headers["x-user-id"];

  if (!requesterId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const [reqUserRows]: any = await pool.query(
      "SELECT role FROM users WHERE id = ?",
      [requesterId],
    );
    const requesterRole = reqUserRows[0]?.role;
    const isSelf = String(requesterId) === String(id);
    const isAdmin = requesterRole === "admin";
    const isHost = requesterRole === "host";
    if (!isSelf && !isAdmin && !isHost) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const [rows]: any = await pool.query("SELECT * FROM users WHERE id = ?", [
      id,
    ]);
    if (!rows.length) return res.status(404).json({ error: "User not found" });
    res.json(publicUser(rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 4. Update Profile (Authenticated check)
router.patch("/:id/profile", async (req, res) => {
  const { id } = req.params;
  const requesterId = req.headers["x-user-id"];

  if (!requesterId) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Ownership check (Self OR Admin)
    const [reqUserRows]: any = await pool.query(
      "SELECT role FROM users WHERE id = ?",
      [requesterId],
    );
    const requesterRole = reqUserRows[0]?.role;

    if (String(requesterId) !== String(id) && requesterRole !== "admin") {
      return res
        .status(403)
        .json({ error: "Forbidden: You cannot update this profile" });
    }

    const updates = req.body;
    if ("picture_url" in updates) {
      console.log("[profile:update-picture:start]", {
        targetUserId: id,
        requesterId,
        picture_url: updates.picture_url,
      });
    }

    // Whitelist safe fields for users
    const allowedFields = [
      "fname_th",
      "lname_th",
      "nickname",
      "gender",
      "birth_date",
      "phone",
      "id_code",
      "address",
      "role_type",
      "role_detail_1",
      "role_detail_2",
      "weight",
      "height",
      "underlying_disease",
      "main_goal",
      "picture_url",
      "activity_level",
      "email",
    ];

    const filteredUpdates: any = {};
    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    if (Object.keys(filteredUpdates).length === 0) {
      return res
        .status(400)
        .json({ error: "No valid fields provided for profile update" });
    }

    const encUpdates = encryptFields(filteredUpdates, USER_ENCRYPTED_FIELDS);
    const updateKeys = Object.keys(encUpdates);
    const updateValues = Object.values(encUpdates);
    const setClause = updateKeys.map((k) => `${k} = ?`).join(", ");

    const [result]: any = await pool.query(
      `UPDATE users SET ${setClause} WHERE id = ?`,
      [...updateValues, id],
    );
    if ("picture_url" in filteredUpdates) {
      console.log("[profile:update-picture:db-result]", {
        targetUserId: id,
        affectedRows: result?.affectedRows,
        changedRows: result?.changedRows,
        picture_url: filteredUpdates.picture_url,
      });
    }

    const [rows]: any = await pool.query("SELECT * FROM users WHERE id = ?", [
      id,
    ]);

    await logAudit({
      req,
      userId: id,
      action: "profile_update",
      description: `ผู้ใช้แก้ไขข้อมูลส่วนตัว`,
      metadata: { updates: Object.keys(filteredUpdates) },
    });

    // ✅ Emit realtime event
    getIO().emit(EVENTS.USER_UPDATED, { id: Number(id), ...filteredUpdates });

    res.json(publicUser(rows[0]) || {});
  } catch (error: any) {
    console.error("[PATCH PROFILE] Error:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 5. Admin: Update user fields (role, status, etc.)
router.post("/bulk-suspend", requireAdmin, async (req, res) => {
  const { user_ids, is_suspended } = req.body;
  if (!Array.isArray(user_ids) || user_ids.length === 0) {
    return res.status(400).json({ error: "No user IDs provided" });
  }

  try {
    const placeholders = user_ids.map(() => "?").join(",");
    await pool.query(
      `UPDATE users SET is_suspended = ? WHERE id IN (${placeholders})`,
      [is_suspended ? 1 : 0, ...user_ids],
    );

    // Kick users if suspended
    if (is_suspended) {
      user_ids.forEach((id) => {
        getIO().emit(EVENTS.USER_KICKED, { id: Number(id) });
      });
    }

    // ✅ Emit realtime event for all users
    user_ids.forEach((id) => {
      getIO().emit(EVENTS.USER_UPDATED, { id: Number(id), is_suspended });
    });

    // Log the action
    await logAudit({
      req,
      userId: req.headers["x-user-id"] as string,
      action: is_suspended ? "bulk_suspend_users" : "bulk_unsuspend_users",
      targetType: "user_bulk",
      description: `${is_suspended ? "ระงับการใช้งาน" : "ยกเลิกการระงับ"} ผู้ใช้หลายราย ID: ${user_ids.join(", ")}`,
      metadata: { user_ids, is_suspended },
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:id/audit-logs", requireAdmin, async (req, res) => {
  try {
    const [rows]: any = await pool.query(
      "SELECT * FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
      [req.params.id],
    );
    res.json(rows);
  } catch (error: any) {
    if (error.code === "ER_NO_SUCH_TABLE") return res.json([]);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/:id/impersonate", requireAdmin, async (req, res) => {
  try {
    const adminId = req.headers["x-user-id"] as string;
    await logAudit({
      userId: adminId,
      action: "impersonate_start",
      targetType: "user",
      targetId: req.params.id,
      description: `แอดมินเริ่มสวมสิทธิ์ผู้ใช้ ID: ${req.params.id}`,
    });
    res.json({ success: true, message: "Impersonation started" });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/:id/impersonate/stop", requireAdmin, async (req, res) => {
  try {
    const adminId = req.headers["x-user-id"] as string;
    await logAudit({
      userId: adminId,
      action: "impersonate_stop",
      targetType: "user",
      targetId: req.params.id,
      description: `แอดมินหยุดสวมสิทธิ์ผู้ใช้ ID: ${req.params.id}`,
    });
    res.json({ success: true, message: "Impersonation stopped" });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/:id/force-logout", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.headers["x-user-id"] as string;

    // Kick user in realtime
    getIO().emit(EVENTS.USER_KICKED, { id: Number(id) });

    await logAudit({
      userId: adminId,
      action: "force_logout",
      targetType: "user",
      targetId: id,
      description: `บังคับให้ออกจากระบบสำหรับผู้ใช้ ID: ${id}`,
    });
    res.json({ success: true, message: "Forced logout triggered" });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Admin: Delete user
router.delete("/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const adminId = req.headers["x-user-id"] as string;

  if (id === adminId) {
    return res.status(400).json({ error: "คุณไม่สามารถลบบัญชีของตัวเองได้" });
  }

  try {
    const [rows]: any = await pool.query(
      "SELECT role FROM users WHERE id = ?",
      [id],
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "User not found" });

    // Kick user in realtime before deletion
    getIO().emit(EVENTS.USER_KICKED, { id: Number(id) });

    await pool.query("DELETE FROM users WHERE id = ?", [id]);
    await logAudit({
      req,
      userId: adminId,
      action: "admin_delete_user",
      targetType: "user",
      targetId: id,
      description: `แอดมินลบบัญชีผู้ใช้ ID: ${id}`,
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Admin: Update user fields
router.patch("/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Whitelist fields that can be updated by admin
  const allowedFields = [
    "role",
    "is_suspended",
    "fname_th",
    "lname_th",
    "nickname",
    "email",
    "phone",
    "gender",
    "role_type",
    "role_detail_1",
    "role_detail_2",
    "address",
    "weight",
    "height",
    "birth_date",
    "main_goal",
    "underlying_disease",
    "id_code",
  ];
  const filteredUpdates: Record<string, any> = {};

  Object.keys(updates).forEach((key) => {
    if (allowedFields.includes(key)) {
      filteredUpdates[key] = updates[key];
    }
  });

  if (Object.keys(filteredUpdates).length === 0) {
    return res
      .status(400)
      .json({ error: "No valid fields provided for update" });
  }

  // Encrypt what needs encrypting from the allowed fields
  const encUpdates = encryptFields(filteredUpdates, USER_ENCRYPTED_FIELDS);

  const updateKeys = Object.keys(encUpdates);
  const updateValues = Object.values(encUpdates);

  if (updateKeys.length === 0)
    return res.status(400).json({ error: "Empty update" });

  const setClause = updateKeys.map((k) => `${k} = ?`).join(", ");

  try {
    await pool.query(`UPDATE users SET ${setClause} WHERE id = ?`, [
      ...updateValues,
      id,
    ]);

    // Log the action
    await logAudit({
      userId: req.headers["x-user-id"] as string,
      action: "admin_update_user",
      targetType: "user",
      targetId: id,
      description: `แอดมินแก้ไขข้อมูลผู้ใช้ ID: ${id}`,
      metadata: { updates: Object.keys(filteredUpdates) },
    });

    const [rows]: any = await pool.query("SELECT * FROM users WHERE id = ?", [
      id,
    ]);
    const updatedUser = publicUser(rows[0]) || {};

    // Emit Realtime Update
    getIO().emit(EVENTS.USER_UPDATED, { id: Number(id), ...updatedUser });
    res.json(updatedUser);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Admin: Reset password to the user's ID code followed by "@Suth"
router.post("/:id/reset-password", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { mode = "default", password } = req.body || {};

  try {
    const [rows]: any = await pool.query(
      "SELECT id, id_code FROM users WHERE id = ?",
      [id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    let newPassword = "";
    if (mode === "default") {
      const user = decryptFields(rows[0], USER_ENCRYPTED_FIELDS);
      const idCode = String(user.id_code || "").trim();
      if (!idCode) {
        return res.status(400).json({
          error: "ไม่สามารถใช้รหัสผ่านเริ่มต้นได้ เนื่องจากผู้ใช้ยังไม่มีรหัสประจำตัว",
        });
      }
      newPassword = `${idCode}@Suth`;
    } else if (mode === "custom") {
      if (typeof password !== "string" || password.length < 8 || password.length > 20) {
        return res.status(400).json({
          error: "รหัสผ่านที่กำหนดเองต้องมีความยาว 8-20 ตัวอักษร",
        });
      }
      newPassword = password;
    } else {
      return res.status(400).json({ error: "Invalid password reset mode" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      "UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?",
      [passwordHash, id],
    );

    await logAudit({
      req,
      userId: req.headers["x-user-id"] as string,
      action: "admin_reset_user_password",
      targetType: "user",
      targetId: id,
      description: `แอดมินรีเซ็ตรหัสผ่านผู้ใช้ ID: ${id}`,
      metadata: { mode },
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Deprecated role-specific endpoint - keeping for compatibility but forwarding to generic one
router.patch("/:id/role", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  try {
    await pool.query("UPDATE users SET role = ? WHERE id = ?", [role, id]);
    const [rows]: any = await pool.query("SELECT * FROM users WHERE id = ?", [
      id,
    ]);
    const updatedUser = publicUser(rows[0]) || {};

    // Emit Realtime Update
    getIO().emit(EVENTS.USER_UPDATED, { id: Number(id), ...updatedUser });

    res.json(updatedUser);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 5. User Basic Info (Generic :id last)
router.get("/:id", async (req, res) => {
  const requesterId = req.headers["x-user-id"];
  const { id } = req.params;

  if (!requesterId) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Permission Check (Self OR Admin OR Host)
    const [reqUserRows]: any = await pool.query(
      "SELECT role FROM users WHERE id = ?",
      [requesterId],
    );
    const requesterRole = reqUserRows[0]?.role;

    if (
      String(requesterId) !== String(id) &&
      requesterRole !== "admin" &&
      requesterRole !== "host"
    ) {
      return res
        .status(403)
        .json({ error: "Forbidden: You cannot access this user's data" });
    }

    const [rows]: any = await pool.query(
      `
        SELECT u.*, tm.name as team_name 
        FROM users u 
        LEFT JOIN teams tm ON u.team_id = tm.id 
        WHERE u.id = ?
     `,
      [id],
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "User not found" });
    res.json(publicUser(rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/line/:lineId", requireAdmin, async (req, res) => {
  try {
    const [rows]: any = await pool.query(
      "SELECT * FROM users WHERE line_id = ?",
      [req.params.lineId],
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "User not found" });
    res.json(publicUser(rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PATCH endpoint for suspending/unsuspending user
router.patch("/:id/suspend", async (req, res) => {
  const requesterId = req.headers["x-user-id"];
  const { id } = req.params;
  const { is_suspended } = req.body;

  if (!requesterId) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Only admin can suspend users
    const [reqUserRows]: any = await pool.query(
      "SELECT role FROM users WHERE id = ?",
      [requesterId],
    );
    const requesterRole = reqUserRows[0]?.role;

    if (requesterRole !== "admin") {
      return res
        .status(403)
        .json({ error: "Forbidden: Only admins can suspend users" });
    }

    // Cannot suspend yourself
    if (String(requesterId) === String(id)) {
      return res.status(400).json({ error: "Cannot suspend yourself" });
    }

    const [result] = (await pool.query(
      "UPDATE users SET is_suspended = ? WHERE id = ?",
      [is_suspended ? 1 : 0, id],
    )) as any;

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const description = `${is_suspended ? "แบน" : "เลิกแบน"}ผู้ใช้ ID: ${id}`;
    await logAudit({
      req,
      userId: Array.isArray(requesterId)
        ? parseInt(requesterId[0])
        : parseInt(requesterId),
      action: is_suspended ? "suspend_user" : "unsuspend_user",
      targetId: parseInt(id),
      description,
    });

    res.json({
      message: `User ${is_suspended ? "suspended" : "unsuspended"} successfully`,
    });
  } catch (error: any) {
    console.error("Suspend user error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Admin: Verify email manually
// NOTE: `email_verified` is not a real column on `users` (confirmed via a
// live query against the dev DB — ER_BAD_FIELD_ERROR). This route has no
// frontend caller and will 500 if ever invoked. Left as-is rather than
// guessing at a schema fix — flag to product/DB owner before relying on it.
router.post("/:id/verify-email", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.headers["x-user-id"] as string;

    const [userRows]: any = await pool.query(
      "SELECT * FROM users WHERE id = ?",
      [id],
    );
    if (userRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    await pool.query("UPDATE users SET email_verified = 1 WHERE id = ?", [id]);

    await logAudit({
      userId: adminId,
      action: "admin_email_verify",
      description: `Admin manually verified email for user ${userRows[0].fname_th} ${userRows[0].lname_th}`,
      targetType: "user",
      targetId: parseInt(id),
      metadata: { target_user_id: id },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.json({ message: "Email verified successfully" });
  } catch (error: any) {
    console.error("Email verification error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Admin: Unlink LINE account
router.post("/:id/unlink-line", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.headers["x-user-id"] as string;

    const [userRows]: any = await pool.query(
      "SELECT * FROM users WHERE id = ?",
      [id],
    );
    if (userRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    await pool.query(
      "UPDATE users SET line_id = NULL, line_display_name = NULL, line_picture_url = NULL WHERE id = ?",
      [id],
    );

    await logAudit({
      userId: adminId,
      action: "admin_unlink_line",
      description: `Admin unlinked LINE account for user ${userRows[0].fname_th} ${userRows[0].lname_th}`,
      targetType: "user",
      targetId: parseInt(id),
      metadata: { target_user_id: id },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.json({ message: "LINE account unlinked successfully" });
  } catch (error: any) {
    console.error("LINE unlink error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Self-service: link a LINE account to the current (username/email) user.
// Blocks with 409 if the LINE account is already linked to a different user.
router.post("/:id/link-line", async (req, res) => {
  const { id } = req.params;
  const requesterId = req.headers["x-user-id"];
  if (!requesterId) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Ownership check (Self OR Admin) — same pattern as /:id/profile
    const [reqUserRows]: any = await pool.query(
      "SELECT role FROM users WHERE id = ?",
      [requesterId],
    );
    const requesterRole = reqUserRows[0]?.role;
    if (String(requesterId) !== String(id) && requesterRole !== "admin") {
      return res
        .status(403)
        .json({ error: "Forbidden: You cannot link this account" });
    }

    const lineProfile = await verifyLineAccessToken(req.body?.accessToken);
    const line_id = lineProfile.userId;
    const display_name = lineProfile.displayName;
    const picture_url = lineProfile.pictureUrl;

    const [userRows]: any = await pool.query(
      "SELECT id FROM users WHERE id = ?",
      [id],
    );
    if (userRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Conflict: this LINE account already belongs to another user
    const [existingLine]: any = await pool.query(
      "SELECT id FROM users WHERE line_id = ? AND id <> ?",
      [line_id, id],
    );
    if (existingLine.length > 0) {
      return res.status(409).json({
        error: "บัญชี LINE นี้ถูกใช้เชื่อมกับผู้ใช้อื่นแล้ว",
      });
    }

    await pool.query(
      "UPDATE users SET line_id = ?, line_display_name = ?, line_picture_url = ? WHERE id = ?",
      [line_id, display_name || null, picture_url || null, id],
    );

    await logAudit({
      req,
      userId: id,
      action: "link_line_self",
      description: `ผู้ใช้เชื่อมบัญชี LINE เข้ากับบัญชีตนเอง (ID: ${id})`,
    });

    const [updated]: any = await pool.query(
      `
      SELECT u.*, tm.name as team_name,
        EXISTS(SELECT 1 FROM teams t2 WHERE t2.host_id = u.id) as is_team_host
      FROM users u
      LEFT JOIN teams tm ON u.team_id = tm.id
      WHERE u.id = ?
    `,
      [id],
    );
    return res.json(publicUser(updated[0]));
  } catch (error: any) {
    console.error("LINE link error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Admin: Revoke all sessions (force logout)
router.post("/:id/revoke-sessions", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.headers["x-user-id"] as string;

    const [userRows]: any = await pool.query(
      "SELECT * FROM users WHERE id = ?",
      [id],
    );
    if (userRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Clear all tokens for this user
    await pool.query(
      "UPDATE users SET reset_token = NULL, reset_token_expiry = NULL WHERE id = ?",
      [id],
    );

    // TODO: Clear any session tokens from your session store
    // This depends on your session management system

    await logAudit({
      userId: adminId,
      action: "admin_revoke_sessions",
      description: `Admin revoked all sessions for user ${userRows[0].fname_th} ${userRows[0].lname_th}`,
      targetType: "user",
      targetId: parseInt(id),
      metadata: { target_user_id: id },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.json({ message: "All sessions revoked successfully" });
  } catch (error: any) {
    console.error("Session revocation error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Admin: Create new user
router.post("/", requireAdmin, async (req, res) => {
  try {
    const adminId = req.headers["x-user-id"] as string;
    const { email, fname_th, lname_th, phone, role, password, send_email } =
      req.body;

    if (!email || !fname_th || !lname_th) {
      return res
        .status(400)
        .json({ error: "Email, first name, and last name are required" });
    }

    // Check if email already exists
    const [existingUsers]: any = await pool.query(
      "SELECT id FROM users WHERE email = ?",
      [email],
    );
    if (existingUsers.length > 0) {
      return res.status(400).json({ error: "Email already exists" });
    }

    // Generate password if not provided
    const finalPassword =
      password ||
      crypto.randomBytes(18).toString("base64url");
    const hashedPassword = await bcrypt.hash(finalPassword, 10);

    const encryptedBody = encryptFields(
      {
        email,
        fname_th,
        lname_th,
        phone: phone || "",
        role: role || "user",
        password_hash: hashedPassword,
        // `email_verified` is not a real column on `users` (no migration ever
        // added it — confirmed by a live INSERT against the dev DB, which
        // failed with ER_BAD_FIELD_ERROR). This handler was unreachable until
        // the duplicate-route fix above, so this was never caught before.
        created_at: new Date(),
      },
      USER_ENCRYPTED_FIELDS,
    );

    const [result]: any = await pool.query(
      "INSERT INTO users SET ?",
      encryptedBody,
    );
    const userId = result.insertId;

    await logAudit({
      userId: adminId,
      action: "admin_create_user",
      description: `Admin created user ${fname_th} ${lname_th}`,
      targetType: "user",
      targetId: userId,
      metadata: {
        created_user_id: userId,
        email,
        role: role || "user",
        send_email,
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    // TODO: Send welcome email with password if send_email is true
    if (send_email) {
      console.log(
        `Welcome email should be sent to ${email} with password: ${finalPassword}`,
      );
    }

    res.json({
      message: "User created successfully",
      user_id: userId,
      password: send_email ? null : finalPassword, // Only return password if not sending email
    });
  } catch (error: any) {
    console.error("Create user error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
