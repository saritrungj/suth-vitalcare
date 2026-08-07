/**
 * ── Client-side diagnostics ────────────────────────────────────────────────
 *
 * main.ts เขียนทับ console.* ทั้งหมดเป็น no-op ใน production (เพื่อไม่ให้ log
 * รั่วใน F12) — ดังนั้น console.error ที่ callback step จะ"เงียบ"สนิทในโปรดักชัน
 * โมดูลนี้จึงส่ง diagnostic เข้าเซิร์ฟเวอร์ (/api/client-logs) แบบ fire-and-forget
 * เพื่อ capture สาเหตุจริงเวลา LINE login ล้มเหลว (เช่น token หายบน iOS Safari)
 *
 * - ปลอดภัยเสมอ: ไม่ throw, ไม่ block flow ของ login
 * - เก็บ userAgent ไว้ diagnose ปัญหาเฉพาะรุ่น/เบราว์เซอร์
 * - ไม่ส่งข้อมูลอ่อนไหว (token/profile) — ส่งแค่ event + detail สั้นๆ
 */

const ENDPOINT = "/api/client-logs";

export type ClientLogEvent =
  | "liff_init_ok"
  | "liff_init_failed"
  | "liff_return_success"
  | "liff_return_failed"
  | "liff_login_blocked"
  | "backend_login_failed";

export const clientLog = (
  event: ClientLogEvent,
  detail?: Record<string, unknown>,
): void => {
  try {
    const payload = JSON.stringify({
      event,
      detail: detail ?? {},
      ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
      url: typeof location !== "undefined" ? location.pathname : "",
      ts: Date.now(),
    });

    // sendBeacon อยู่รอดแม้หน้ากำลัง unload/redirect (เช่นตอน liff.login())
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon(ENDPOINT, blob);
      return;
    }

    // fallback: fetch แบบ keepalive
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // diagnostics ต้องไม่ทำให้ login พัง — กลืน error ทุกกรณี
  }
};
