// ต้องมาก่อน import อื่น ๆ เพื่อโหลด env ตาม runtime ก่อนโมดูลที่อ่าน process.env
// ตอน import (เช่น ./mysql.js สร้าง pool ทันที)
import "./loadEnv.js";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import rateLimit from "express-rate-limit";
import compression from "compression";
import http from "http";
import crypto from "node:crypto";
import { pool } from "./mysql.js";

// ── CORS for production (IIS reverse proxy / cross-domain) ──────────────────
import cors from "cors";

// Allow testing production mode via flag
if (process.argv.includes("--prod")) {
  process.env.NODE_ENV = "production";
}
// env ถูกโหลดแล้วใน ./loadEnv.js (import ไว้บนสุด)

// Route Imports
import userRouter from "./routes/user.js";
import activityRouter from "./routes/activity.js";
import aiRouter from "./routes/ai.js";
import missionRouter from "./routes/mission.js";
import itemRouter from "./routes/item.js";
import botRouter from "./routes/bot.js";
import teamRouter from "./routes/team.js";
import formsRouter from "./routes/forms.js";
import masterRouter from "./routes/master.js";
import statsRouter from "./routes/stats.js";
import tanitaRouter from "./routes/tanita.js";
import bannersRouter from "./routes/banners.js";
import certificateRouter from "./routes/certificate.js";
import healthRouter from "./routes/health.js";
import logsRouter from "./routes/logs.js";
import clientLogsRouter from "./routes/clientLogs.js";
import exportRouter from "./routes/export.js";
import notificationsRouter from "./routes/notifications.js";
import registrationRouter from "./routes/registration.js";
import { initRealtime } from "./lib/realtime.js";
import {
  assertSessionConfiguration,
  attachVerifiedIdentity,
  requireSession,
} from "./lib/session.js";
import { safeMediaRedirect } from "./lib/safeUrl.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Setup Multer — temp folder (files moved after sharp processing)
import fs from "fs";
// Store uploads under public/uploads for static serving in deployment
const uploadDir = path.join(__dirname, "../public/uploads");
const tempDir = path.join(uploadDir, "temp");
const uploadLogDir = path.join(process.cwd(), "logs", "upload");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
if (!fs.existsSync(uploadLogDir))
  fs.mkdirSync(uploadLogDir, { recursive: true });
// Ensure sub-folders exist
["activity", "profile", "banners", "submissions"].forEach((sub) =>
  fs.mkdirSync(path.join(uploadDir, sub), { recursive: true }),
);
console.log("[upload:init]", {
  cwd: process.cwd(),
  dirname: __dirname,
  uploadDir,
  tempDir,
  uploadLogDir,
  uploadDirExists: fs.existsSync(uploadDir),
  tempDirExists: fs.existsSync(tempDir),
  uploadLogDirExists: fs.existsSync(uploadLogDir),
});

function getBangkokDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function appendDailyUploadError(
  event: string,
  payload: Record<string, any>,
) {
  try {
    await fs.promises.mkdir(uploadLogDir, { recursive: true });
    const now = new Date();
    const logPath = path.join(uploadLogDir, `${getBangkokDateString(now)}.log`);
    const line =
      JSON.stringify({
        ts: now.toISOString(),
        event,
        ...payload,
      }) + "\n";
    await fs.promises.appendFile(logPath, line, "utf8");
  } catch (logError: any) {
    console.error("[upload:daily-log-error]", logError?.message || logError);
  }
}

function getImageExtension(mimetype = "") {
  if (mimetype === "image/jpeg" || mimetype === "image/jpg") return "jpg";
  if (mimetype === "image/png") return "png";
  if (mimetype === "image/webp") return "webp";
  if (mimetype === "image/gif") return "gif";
  return "bin";
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

fs.promises
  .access(uploadDir, fs.constants.W_OK)
  .then(() => console.log("[upload:init] uploadDir is writable"))
  .catch((error: any) => {
    console.error("[upload:init] uploadDir is NOT writable:", error.message);
    appendDailyUploadError("uploadDir-not-writable", {
      message: error.message,
      uploadDir,
    });
  });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
    fields: 8,
    parts: 10,
    fieldNameSize: 100,
    fieldSize: 16 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
    const accepted = allowed.has(file.mimetype);
    callback(null, accepted);
  },
});

async function startServer() {
  assertSessionConfiguration();
  const app = express();
  app.disable("x-powered-by");

  // Process readiness must not depend on MySQL. IIS/PM2 and deployment smoke
  // tests use this endpoint to distinguish a running Node process from backend
  // feature health, which is reported by the API routes themselves.
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      environment: process.env.NODE_ENV || "development",
    });
  });

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src 'self' 'sha256-9id4XSTjrDD2LbxNYwrV/rqUPxJsa5tFaWgrwtHQvCI=' https://static.line-scdn.net https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https://api.line.me https://liffsdk.line-scdn.net https://challenges.cloudflare.com https://api.opentyphoon.ai wss:; frame-src https://challenges.cloudflare.com; upgrade-insecure-requests",
    );
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });

  // ── CORS (รองรับ IIS reverse proxy และ cross-domain) ───────────────────────
  const configuredOrigins = String(
    process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || "",
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (
          configuredOrigins.includes(origin) ||
          (process.env.NODE_ENV !== "production" &&
            /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
        ) {
          return callback(null, true);
        }
        return callback(new Error("Origin is not allowed"));
      },
      methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-Client-Silent-Errors"],
    }),
  );

  // ── Gzip Compression (ลด Response Size ได้ 60-80%) ────────────────────────────
  app.use(compression());

  // ── In-Memory Cache (ลด DB Query ซ้ำ ─────────────────────────────────────
  const cache = new Map<string, { data: any; expiry: number }>();

  function getCache(key: string) {
    const entry = cache.get(key);
    if (entry && Date.now() < entry.expiry) return entry.data;
    cache.delete(key);
    return null;
  }

  function setCache(key: string, data: any, ttlMs: number) {
    cache.set(key, { data, expiry: Date.now() + ttlMs });
  }

  // แนบ Cache Middleware: cache GET responses ตาม TTL ที่กำหนด
  function cacheMiddleware(ttlMs: number) {
    return (req: any, res: any, next: any) => {
      // Only cache GET requests
      if (req.method !== "GET") return next();

      const userId = req.headers["x-user-id"] || "guest";
      const key = `${req.originalUrl}|${userId}`;
      const cached = getCache(key);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        return res.json(cached);
      }
      const originalJson = res.json.bind(res);
      res.json = (body: any) => {
        if (res.statusCode === 200) setCache(key, body, ttlMs);
        res.setHeader("X-Cache", "MISS");
        return originalJson(body);
      };
      next();
    };
  }

  // Skip logging for assets (reduce noise)
  app.use((req, res, next) => {
    if (req.originalUrl.includes("webhook")) {
      console.log(`[WEBHOOK] ${req.method} ${req.originalUrl}`);
    }
    next();
  });

  // ── Silent API Errors for Browser clients ──────────────────────────────────
  // If client sends x-client-silent-errors: 1, all API error responses (4xx/5xx)
  // are normalized to HTTP 200 with envelope:
  // { ok: false, status: <original>, error: <message>, data: <original body> }
  // This prevents browser DevTools from showing red failed requests, while
  // allowing frontend code to reconstruct original status if needed.
  app.use("/api", (req: any, res: any, next: any) => {
    const silentHeader = req.headers["x-client-silent-errors"];
    const shouldSilence = silentHeader === "1" || req.query?.silent === "1";
    if (!shouldSilence) return next();

    const originalStatus = res.status.bind(res);
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    let pendingStatusCode = 200;

    res.status = (code: number) => {
      pendingStatusCode = code;
      return res;
    };

    const sendSilentEnvelope = (statusCode: number, message: string) => {
      originalStatus(200);
      res.setHeader("content-type", "application/json; charset=utf-8");
      return originalSend(
        JSON.stringify({
          ok: false,
          status: statusCode,
          error: message || "Request failed",
        }),
      );
    };

    res.json = (body: any) => {
      if (pendingStatusCode >= 400) {
        const message =
          (body && (body.error || body.message)) || "Request failed";
        return sendSilentEnvelope(pendingStatusCode, message);
      }
      originalStatus(pendingStatusCode || 200);
      return originalJson(body);
    };

    res.send = (body: any) => {
      if (pendingStatusCode >= 400) {
        const message = typeof body === "string" ? body : "Request failed";
        return sendSilentEnvelope(pendingStatusCode, message);
      }
      originalStatus(pendingStatusCode || 200);
      return originalSend(body);
    };

    next();
  });

  const PORT = process.env.PORT || 3000;

  // Handle proxy headers (e.g. ngrok, cloudflare)
  app.set("trust proxy", 1);

  // A browser-supplied identity header is never authoritative. Existing route
  // handlers may keep reading x-user-id because this middleware replaces it
  // with the user ID from a signed, HttpOnly session cookie.
  app.use("/api", attachVerifiedIdentity);

  // Bot Route ABOVE express.json
  app.use("/api/bot", botRouter);

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 2000,
    message: { error: "Too many requests" },
    standardHeaders: true,
    legacyHeaders: false,
  });
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    message: { error: "Too many authentication attempts" },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api", apiLimiter);
  app.use(
    [
      "/api/users/login",
      "/api/users/login-email",
      "/api/users/register-email",
      "/api/users/forgot-password",
      "/api/users/reset-password",
    ],
    authLimiter,
  );

  /*
  // Global Rate Limiting — ตั้งสูงพอสำหรับ Production จริง
  // (1,000 req/15min เดิมโดน block ง่ายมาก เมื่อ user เยอะ)
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50000,  // 50k req / 15 min / IP — เพียงพอสำหรับ user จริง
    message: { error: "Too many requests" },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // ไม่ Rate Limit สำหรับ Read-Only APIs ที่ Cache อยู่แล้ว
      const readOnlyPaths = ['/api/activities', '/api/banners'];
      return req.method === 'GET' && readOnlyPaths.some(p => req.path.startsWith(p));
    }
  });
  app.use("/api/", apiLimiter);
  */

  // แคช Invalidation: ลบ Cache เมื่อมีการอับเดต (POST/PATCH/PUT/DELETE)
  // ต้องวางไว้ **ก่อน** Router เสมอ เพื่อให้มันทำงานก่อนที่ Router จะส่ง Response กลับไป
  app.use("/api", (req: any, res: any, next: any) => {
    if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) {
      cache.clear();
    }
    next();
  });

  app.use(express.json({ limit: "20mb" }));
  app.use((err: any, req: any, res: any, next: any) => {
    if (err?.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Invalid JSON request body" });
    }
    return next(err);
  });

  const publicMutationPaths = new Set([
    "/users/login",
    "/users/login-email",
    "/users/login-google",
    "/users/register-email",
    "/users/forgot-password",
    "/users/reset-password",
    "/users/logout",
    "/client-logs",
  ]);
  app.use("/api", (req, res, next) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
    if (publicMutationPaths.has(req.path)) return next();
    return requireSession(req, res, next);
  });

  app.use("/api/users", userRouter);
  app.use("/api/user", userRouter);
  app.use("/api/registrations", registrationRouter);
  // ค้ะ Activities, Banners (30วิ), Fav Status (10วิ)
  app.use("/api/activities", cacheMiddleware(30_000), activityRouter);
  app.use("/api/banners", cacheMiddleware(30_000), bannersRouter);
  app.use("/api/fav-status", cacheMiddleware(10_000)); // Add cache to fav-status
  app.use("/api/ai", aiRouter);
  // ค้ะ Mission GET (15วิ) — POST/PATCH ยัง query DB ตามปกติ
  app.use("/api/mission", cacheMiddleware(15_000), missionRouter);
  app.use("/api/missions", cacheMiddleware(15_000), missionRouter);
  app.use("/api/items", itemRouter);
  app.use("/api/teams", teamRouter);
  app.use("/api/forms", formsRouter);
  app.use("/api/master", masterRouter);
  app.use("/api/tanita", tanitaRouter);
  // ค้ะ Stats/Rankings (60วิ) — query หนักที่สุด
  app.use("/api/stats", cacheMiddleware(60_000), statsRouter);
  app.use("/api/certificates", certificateRouter);
  app.use("/api/health", healthRouter);
  app.use("/api/logs", logsRouter);
  app.use("/api/client-logs", clientLogsRouter);
  app.use("/api/export", exportRouter);
  app.use("/api/notifications", notificationsRouter);

  // ── Local File Upload Endpoint ─────────────────────────────────────────────
  // POST /api/upload?type=activity&name=ชื่อกิจกรรม
  // POST /api/upload?type=profile&name=username
  // Returns: { url: "/uploads/activity/ชื่อ-20260505.png" }
  app.post(
    "/api/upload",
    async (req, res, next) => {
      const userId = req.headers["x-user-id"];
      const uploadType = String(req.query.type || "");
      if (!["activity", "profile", "banners", "submissions"].includes(uploadType)) {
        return res.status(400).json({ error: "Invalid upload type" });
      }
      const [rows]: any = await pool.query("SELECT role FROM users WHERE id = ?", [userId]);
      const role = rows[0]?.role;
      if (uploadType === "banners" && role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      if (uploadType === "activity" && role !== "admin" && role !== "host") {
        return res.status(403).json({ error: "Admin or host access required" });
      }
      return next();
    },
    (req, res, next) => {
      console.log("[upload:start]", {
        method: req.method,
        url: req.originalUrl,
        contentType: req.headers["content-type"],
        contentLength: req.headers["content-length"],
        userId: req.headers["x-user-id"],
        query: req.query,
      });

      upload.single("image")(req, res, (error: any) => {
        if (!error) return next();

        console.error("[upload:multer-error]", {
          message: error.message,
          code: error.code,
          field: error.field,
          storageErrors: error.storageErrors,
        });
        appendDailyUploadError("multer-error", {
          message: error.message,
          code: error.code,
          field: error.field,
          storageErrors: error.storageErrors,
          url: req.originalUrl,
          contentType: req.headers["content-type"],
          contentLength: req.headers["content-length"],
          userId: req.headers["x-user-id"],
          query: req.query,
        });

        return res.status(400).json({
          error:
            error.code === "LIMIT_FILE_SIZE"
              ? "Image is larger than 10MB"
              : error.message || "Upload failed before processing",
        });
      });
    },
    async (req, res) => {
      const file = (req as any).file;
      if (!file) {
        console.warn("[upload:no-file]", {
          bodyKeys: Object.keys(req.body || {}),
          query: req.query,
          contentType: req.headers["content-type"],
        });
        appendDailyUploadError("no-file", {
          bodyKeys: Object.keys(req.body || {}),
          query: req.query,
          contentType: req.headers["content-type"],
          contentLength: req.headers["content-length"],
          userId: req.headers["x-user-id"],
        });
        return res.status(400).json({ error: "No image provided" });
      }

      try {
        // Determine sub-folder and filename from query params
        const uploadType = String(req.query.type || "activity"); // "activity" | "profile" | "banners" | "submissions"
        const rawName = String(req.query.name || "image");

        // Sanitize: keep Thai letters, remove illegal filename chars, collapse spaces
        const dateStr = getBangkokDateString(); // e.g. 2026-05-05
        const uniqueSuffix = crypto.randomBytes(6).toString("hex");
        const safeName = rawName
          .replace(/[\\/:*?"<>|]/g, "") // remove illegal filename chars
          .replace(/\s+/g, "-") // spaces → dash
          .slice(0, 60); // max 60 chars before date
        const filenameBase = `${safeName || "image"}-${dateStr}-${uniqueSuffix}`;

        // Map uploadType → subfolder (default to "activity" for unknown types)
        const VALID_FOLDERS = [
          "activity",
          "profile",
          "banners",
          "submissions",
        ] as const;
        const subFolder = VALID_FOLDERS.includes(uploadType as any)
          ? uploadType
          : "activity";
        console.log("[upload:file-received]", {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          storage: "memory",
          bufferBytes: file.buffer?.length,
          uploadType,
          subFolder,
          filenameBase,
        });

        let outputBuffer = file.buffer;
        let outputExt = getImageExtension(file.mimetype);

        try {
          const sharp = (await import("sharp")).default;
          console.log("[upload:sharp-start]", {
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
          });

          const sharpPromise = sharp(file.buffer)
            .resize(1280, 1280, { fit: "inside", withoutEnlargement: true })
            .png({ compressionLevel: 9, adaptiveFiltering: true })
            .toBuffer();

          outputBuffer = await withTimeout(
            sharpPromise,
            15_000,
            "sharp image processing",
          );
          outputExt = "png";
          const meta = await sharp(outputBuffer).metadata();
          console.log(
            `[upload] ${subFolder}/${filenameBase}.${outputExt} | ${meta.width}x${meta.height}px | ${(outputBuffer.length / 1024).toFixed(0)} KB`,
          );
        } catch (sharpError: any) {
          console.error("[upload:sharp-rejected]", {
            message: sharpError?.message,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
          });
          appendDailyUploadError("sharp-processing-rejected", {
            message: sharpError?.message,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            uploadType,
            subFolder,
          });
          return res.status(422).json({ error: "Invalid or unsupported image" });
        }

        const filename = `${filenameBase}.${outputExt}`;
        const destPath = path.join(uploadDir, subFolder, filename);
        await fs.promises.mkdir(path.dirname(destPath), { recursive: true });

        // Only re-encoded image bytes are persisted. Never serve the original
        // upload when decoding fails because its claimed MIME type is untrusted.
        await fs.promises.writeFile(destPath, outputBuffer);
        const writtenStat = await fs.promises.stat(destPath);

        // Client-directed old-file deletion is disabled until upload ownership
        // is persisted. A URL alone is not proof that the caller owns a file.

        // Return a root-relative URL so Vite dev server & Express serve it correctly
        console.log("[upload:success]", {
          url: `/uploads/${subFolder}/${filename}`,
          destPath,
          bytesWritten: writtenStat.size,
          fileExists: fs.existsSync(destPath),
        });
        res.json({ url: `/uploads/${subFolder}/${filename}` });
      } catch (error: any) {
        console.error("[upload:error]", {
          message: error?.message,
          code: error?.code,
          stack: error?.stack,
          file: {
            originalname: file?.originalname,
            mimetype: file?.mimetype,
            size: file?.size,
          },
          uploadDir,
        });
        appendDailyUploadError("processing-error", {
          message: error?.message,
          code: error?.code,
          stack: error?.stack,
          file: {
            originalname: file?.originalname,
            mimetype: file?.mimetype,
            size: file?.size,
          },
          query: req.query,
          uploadDir,
        });
        res.status(500).json({ error: "Failed to process image" });
      }
    },
  );

  // DELETE /api/upload — specifically to clean up intermediate uploads if form is cancelled
  app.delete("/api/upload", async (req, res) => {
    return res.status(403).json({
      error: "Client-directed file deletion is disabled; ownership must be verified",
    });
    /* istanbul ignore next -- retained temporarily for migration reference */
    try {
      const { oldUrl } = req.body;
      if (!oldUrl || !oldUrl.startsWith("/uploads/")) {
        return res.status(400).json({ error: "Invalid url" });
      }

      const relativeOldPath = oldUrl.substring("/uploads/".length);
      const oldFilePath = path.join(
        uploadDir,
        ...relativeOldPath.split("/").filter(Boolean),
      );

      if (oldFilePath.startsWith(uploadDir) && fs.existsSync(oldFilePath)) {
        await fs.promises.unlink(oldFilePath);
        console.log("[upload:cleanup:cancelled]", { deletedUrl: oldUrl });
        return res.json({
          success: true,
          message: "Cleaned up cancelled upload",
        });
      }

      res.json({ success: true, message: "File not found or already deleted" });
    } catch (err: any) {
      console.warn("[upload:cleanup:cancelled:failed]", { error: err.message });
      res.status(500).json({ error: "Cleanup failed" });
    }
  });

  // POST /api/upload-cleanup — สำหรับ navigator.sendBeacon (เมื่อ user ปิด/refresh หน้า)
  // sendBeacon ส่งเป็น POST เสมอ (ไม่สามารถใช้ DELETE ได้)
  // sendBeacon จะส่ง Content-Type: text/plain → ต้องใช้ express.text() ก่อน
  app.post(
    "/api/upload-cleanup",
    express.text({ type: "*/*" }),
    async (req, res) => {
      // A beacon containing a public URL is not proof of ownership. Ignore the
      // cleanup request instead of allowing cross-user file deletion.
      return res.status(204).send();
      /* istanbul ignore next -- retained temporarily for migration reference */
      try {
        // parse body (อาจเป็น string หรือ object ขึ้นอยู่กับ middleware ที่รับ)
        let oldUrl: string | undefined;
        if (typeof req.body === "object" && req.body?.oldUrl) {
          oldUrl = req.body.oldUrl;
        } else if (typeof req.body === "string") {
          try {
            oldUrl = JSON.parse(req.body)?.oldUrl;
          } catch {}
        }

        if (!oldUrl || !oldUrl.startsWith("/uploads/submissions/")) {
          // จำกัดเฉพาะ /uploads/submissions/ เพื่อความปลอดภัย
          return res.status(204).send(); // No Content (sendBeacon ignores response)
        }

        const relativeOldPath = oldUrl.substring("/uploads/".length);
        const oldFilePath = path.join(
          uploadDir,
          ...relativeOldPath.split("/").filter(Boolean),
        );

        if (oldFilePath.startsWith(uploadDir) && fs.existsSync(oldFilePath)) {
          await fs.promises.unlink(oldFilePath);
          console.log("[upload:cleanup:beacon]", { deletedUrl: oldUrl });
        }

        res.status(204).send(); // sendBeacon ไม่อ่าน response body
      } catch (err: any) {
        console.warn("[upload:cleanup:beacon:failed]", { error: err.message });
        res.status(204).send(); // ส่ง 204 เสมอ (sendBeacon ignores errors)
      }
    },
  );

  // Serve images from users.pending_bot_result for LINE preview
  app.get("/api/bot/image-preview/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
      const [rows]: any = await pool.query(
        "SELECT pending_bot_result FROM users WHERE id = ?",
        [userId],
      );
      if (rows.length === 0 || !rows[0].pending_bot_result)
        return res.status(404).send("Not found");

      const pending =
        typeof rows[0].pending_bot_result === "string"
          ? JSON.parse(rows[0].pending_bot_result)
          : rows[0].pending_bot_result;
      const b64 = pending.imageData || pending.publicUrl;

      if (b64 && b64.startsWith("data:image/")) {
        const parts = b64.split(",");
        const mime = parts[0].match(/:(image\/(?:png|jpeg|webp|gif));/)?.[1];
        if (!mime || !parts[1]) return res.status(400).send("Invalid image data");
        const data = Buffer.from(parts[1], "base64");
        res.setHeader("Content-Type", mime);
        res.setHeader("Cache-Control", "no-cache");
        return res.send(data);
      } else if (b64 && b64.startsWith("/uploads/")) {
        const publicRoot = path.resolve(__dirname, "../public");
        const filePath = path.resolve(publicRoot, `.${b64}`);
        if (!filePath.startsWith(publicRoot + path.sep)) {
          return res.status(400).send("Invalid image path");
        }
        return res.sendFile(filePath);
      }
      res.status(400).send("Invalid image data format");
    } catch (err: any) {
      res.status(500).send("Internal Server Error");
    }
  });

  // Serve images from submissions table
  app.get("/api/media/submission/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const [rows]: any = await pool.query(
        "SELECT img_url FROM submissions WHERE id = ?",
        [id],
      );
      if (rows.length === 0 || !rows[0].img_url)
        return res.status(404).send("Not found");

      const b64 = rows[0].img_url;
      if (b64 && b64.startsWith("data:image/")) {
        const parts = b64.split(",");
        const mime = parts[0].match(/:(image\/(?:png|jpeg|webp|gif));/)?.[1];
        if (!mime || !parts[1]) return res.status(400).send("Invalid image data");
        const data = Buffer.from(parts[1], "base64");
        res.setHeader("Content-Type", mime);
        res.setHeader("Cache-Control", "public, max-age=31536000"); // Cache permanently for saved submissions
        return res.send(data);
      }
      // If it's a legacy URL (not base64), redirect or handle accordingly
      const redirectUrl = safeMediaRedirect(b64);
      if (redirectUrl) {
        return res.redirect(302, redirectUrl);
      }
      res.status(400).send("Invalid image data");
    } catch (err: any) {
      res.status(500).send("Internal Server Error");
    }
  });

  // Uploaded media is stored outside dist; IIS must proxy /uploads/* here.
  app.use(
    "/uploads",
    express.static(uploadDir, {
      fallthrough: false,
      immutable: true,
      maxAge: "30d",
    }),
  );

  // --- END TEMPORARY MIGRATION ---

  // ── Favorite System (Direct Mounting for maximum reliability) ──
  app.get("/api/fav-status/:id", async (req, res) => {
    const { id } = req.params;
    const userId = req.headers["x-user-id"];
    try {
      const [countRows]: any = await pool.query(
        "SELECT COUNT(*) as count FROM event_favorites WHERE event_id = ?",
        [id],
      );
      let isFavorited = false;
      if (userId && userId !== "undefined") {
        const [favRows]: any = await pool.query(
          "SELECT id FROM event_favorites WHERE event_id = ? AND user_id = ? LIMIT 1",
          [id, userId],
        );
        isFavorited = favRows.length > 0;
      }
      res.json({ count: countRows[0].count, isFavorited });
    } catch (err: any) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // ── Bulk Kick (Direct Mounting) ──
  app.post("/api/activities/admin/kick-bulk", async (req, res) => {
    const { userId, eventIds } = req.body;
    const adminId = req.headers["x-user-id"];
    const { logAudit } = await import("./lib/audit.js");

    if (!userId || !eventIds || !Array.isArray(eventIds)) {
      return res
        .status(400)
        .json({ error: "Missing parameters or invalid eventIds" });
    }

    try {
      // 1. Verify admin
      const [adminRows]: any = await pool.query(
        "SELECT role FROM users WHERE id = ?",
        [adminId],
      );
      if (adminRows[0]?.role !== "admin")
        return res.status(403).json({ error: "Unauthorized" });

      // 2. Perform bulk removal
      const placeholders = eventIds.map(() => "?").join(",");

      // Remove registrations
      await pool.query(
        `DELETE FROM registrations WHERE user_id = ? AND event_id IN (${placeholders})`,
        [userId, ...eventIds],
      );

      // Cleanup team memberships
      try {
        await pool.query(
          `DELETE FROM team_members WHERE user_id = ? AND team_id IN (SELECT id FROM teams WHERE event_id IN (${placeholders}))`,
          [userId, ...eventIds],
        );
      } catch (e) {
        try {
          await pool.query(
            `DELETE FROM team_members WHERE user_id = ? AND team_id IN (SELECT id FROM teams WHERE activity_id IN (${placeholders}))`,
            [userId, ...eventIds],
          );
        } catch (e2) {}
      }

      await logAudit({
        userId: Number(adminId),
        action: "BULK_KICK_USER",
        description: `Admin removed user ${userId} from ${eventIds.length} events`,
        targetType: "user",
        targetId: Number(userId),
      });

      return res.json({
        message: `Removed from ${eventIds.length} activities successfully`,
      });
    } catch (error: any) {
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.post("/api/fav-toggle/:id", async (req, res) => {
    const { id } = req.params;
    let userId = req.headers["x-user-id"] || req.body.userId;
    const { pool } = await import("./mysql.js");

    if (userId === "undefined") userId = null;
    if (!userId)
      return res.status(401).json({ error: "โปรดเข้าสู่ระบบก่อนดำเนินการ" });

    try {
      const [favRows]: any = await pool.query(
        "SELECT id FROM event_favorites WHERE event_id = ? AND user_id = ? LIMIT 1",
        [id, userId],
      );
      if (favRows.length > 0) {
        await pool.query("DELETE FROM event_favorites WHERE id = ?", [
          favRows[0].id,
        ]);
        res.json({ action: "removed", isFavorited: false });
      } else {
        await pool.query(
          "INSERT INTO event_favorites (event_id, user_id) VALUES (?, ?)",
          [id, userId],
        );
        res.json({ action: "added", isFavorited: true });
      }
    } catch (err: any) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get("/api/fav-user/:userId", async (req, res) => {
    const { userId } = req.params;
    const { pool } = await import("./mysql.js");
    try {
      const [favRows]: any = await pool.query(
        "SELECT event_id FROM event_favorites WHERE user_id = ?",
        [userId],
      );
      res.json(favRows);
    } catch (err: any) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Fallback for missing API routes
  app.use("/api/*", (req, res) => {
    console.log(`[404] API Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: "API Route not found" });
  });

  const server = http.createServer(app);
  initRealtime(server);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    // Vite is a devDependency and must not be required by a production-only
    // install. Keep the import inside the development branch.
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      root: path.resolve(__dirname, "../"),
      server: { middlewareMode: true, allowedHosts: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "../dist")));
    app.get("*", (req, res) => {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.sendFile(path.join(__dirname, "../dist/index.html"));
    });
  }

  // --- Automated Orphan Cleanup Job ---
  // Runs every 1 hour to clean up files older than 2 hours that are not in the database
  setInterval(
    async () => {
      try {
        const submissionsDir = path.join(uploadDir, "submissions");
        if (!fs.existsSync(submissionsDir)) return;

        const files = await fs.promises.readdir(submissionsDir);
        if (files.length <= 1) return;

        const { pool } = await import("./mysql.js");
        const [rows]: any = await pool.query(
          "SELECT img_url FROM submissions WHERE img_url IS NOT NULL",
        );
        const dbUrls = new Set(rows.map((r: any) => r.img_url));

        const now = Date.now();
        const TWO_HOURS = 2 * 60 * 60 * 1000; // ไฟล์เก่ากว่า 2 ชั่วโมง
        let deletedCount = 0;

        for (const file of files) {
          if (file.startsWith(".gitkeep")) continue;
          const filePath = path.join(submissionsDir, file);

          let stats;
          try {
            stats = await fs.promises.stat(filePath);
          } catch (e: any) {
            if (e.code === "ENOENT") continue; // File was already deleted
            throw e;
          }

          if (now - stats.mtimeMs > TWO_HOURS) {
            const url = `/uploads/submissions/${file}`;
            if (!dbUrls.has(url)) {
              try {
                await fs.promises.unlink(filePath);
                deletedCount++;
              } catch (e: any) {
                if (e.code !== "ENOENT")
                  console.error(
                    `[cleanup:orphan] Failed to delete ${file}:`,
                    e,
                  );
              }
            }
          }
        }

        if (deletedCount > 0) {
          console.log(
            `[cleanup:orphan] Automatically deleted ${deletedCount} orphaned files.`,
          );
        }
      } catch (err) {
        console.error("[cleanup:orphan] Error running cleanup job:", err);
      }
    },
    60 * 60 * 1000,
  ); // ทำงานทุก 1 ชั่วโมง

  server.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
