import express from "express";
import { logAction } from "../lib/logger.js";

const router = express.Router();

/**
 * รับ diagnostic จากฝั่ง client (login flow) — โดยเฉพาะเคส LINE login ล้มเหลว
 * บน iOS Safari ที่ token หายหลัง OAuth round-trip
 *
 * เป็น endpoint สาธารณะ (ยังไม่มี user id ตอน login) แต่:
 *  - รับเฉพาะ event ที่รู้จัก (allow-list) กัน log spam
 *  - จำกัดขนาด detail
 *  - เก็บลง audit_logs (มี masking ในตัว) พร้อม user-agent จาก header
 */

const ALLOWED_EVENTS = new Set([
  "liff_init_ok",
  "liff_init_failed",
  "liff_return_success",
  "liff_return_failed",
  "liff_login_blocked",
  "backend_login_failed",
]);

router.post("/", async (req, res) => {
  try {
    const { event, detail, ua, url } = req.body || {};

    if (typeof event !== "string" || !ALLOWED_EVENTS.has(event)) {
      // ตอบ 204 เสมอเพื่อไม่ให้ client ต้อง handle error (fire-and-forget)
      return res.status(204).end();
    }

    // จำกัดขนาด detail กัน payload บวม
    let safeDetail: any = {};
    if (detail && typeof detail === "object") {
      const raw = JSON.stringify(detail);
      safeDetail = raw.length > 2000 ? { truncated: true } : detail;
    }

    await logAction(req, {
      action: `client_${event}`,
      targetType: "client_diag",
      description: `[client-diag] ${event}${url ? ` @ ${url}` : ""}`,
      metadata: {
        ...safeDetail,
        client_ua: typeof ua === "string" ? ua.slice(0, 300) : undefined,
      },
    });

    return res.status(204).end();
  } catch {
    // ไม่ให้ diagnostic endpoint ล้มแล้วกระทบอะไร
    return res.status(204).end();
  }
});

export default router;
