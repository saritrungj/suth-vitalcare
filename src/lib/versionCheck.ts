/**
 * ── Auto version check ─────────────────────────────────────────────────────
 *
 * เทียบ build id ที่ฝังใน bundle (`__APP_VERSION__`) กับ `/version.json` ที่
 * generate ตอน build (ดู vite.config.ts) ถ้าไม่ตรง = มี deploy ใหม่ → เรียก
 * onUpdate ให้ UI แจ้งผู้ใช้กดโหลดใหม่
 *
 * ตรวจตอนเปิดแอป, ทุก 5 นาที และตอนสลับกลับมาที่แท็บ
 * - dev ไม่มี /version.json (fetch 404) → เงียบ ไม่ทำงาน
 * - แจ้งครั้งเดียว (กันเด้งซ้ำ)
 */

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export const startVersionWatch = (onUpdate: () => void): (() => void) => {
  const current = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "";
  let notified = false;

  const check = async () => {
    if (notified) return;
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      const latest = data?.buildId;
      if (latest && current && latest !== current) {
        notified = true;
        onUpdate();
      }
    } catch {
      // เงียบไว้ — network หลุด/ไม่มีไฟล์ ไม่ควรรบกวนผู้ใช้
    }
  };

  check();
  const timer = window.setInterval(check, CHECK_INTERVAL_MS);
  const onVisible = () => {
    if (document.visibilityState === "visible") check();
  };
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
};
