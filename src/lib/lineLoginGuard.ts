/**
 * ── LINE Login Circuit-Breaker ─────────────────────────────────────────────
 *
 * บาง iOS/Safari (โดยเฉพาะเมื่อเปิด "Prevent Cross-Site Tracking" หรือมี
 * Website Data ค้างอยู่) จะทำให้ LIFF SDK เก็บ/อ่าน access token ไม่ได้หลัง
 * กลับมาจาก LINE OAuth → `liff.isLoggedIn()` คืนค่า false ทั้งๆ ที่เพิ่ง
 * authenticate สำเร็จ → ผู้ใช้เห็นหน้า login ซ้ำ แล้วกดใหม่วนไม่จบ (infinite loop).
 *
 * โมดูลนี้เป็น state machine ล้วนๆ (pure) เก็บสถานะใน sessionStorage:
 *   - PENDING_KEY : sentinel ที่ตั้งไว้ *ก่อน* เรียก liff.login() เพื่อรู้ว่า
 *                   การโหลดหน้าถัดไปคือ "การกลับมาจาก LINE" จริง
 *   - FAILURE_KEY : ตัวนับจำนวนครั้งที่กลับมาแล้ว isLoggedIn ยังเป็น false ติดกัน
 *
 * เมื่อ fail ติดกันถึง MAX_LINE_LOGIN_FAILURES จะถือว่า "blocked" —
 * ให้ฝั่ง UI หยุด auto-retry แล้วแจ้งผู้ใช้แทน (ดู Login.vue).
 *
 * แยกเป็น pure module + inject storage ได้ เพื่อให้ unit test ง่าย
 * (ดู lineLoginGuard.test.ts).
 */

const PENDING_KEY = "line_login_pending";
const FAILURE_KEY = "line_login_failures";

/** fail ติดกันกี่ครั้งจึงจะหยุด loop และแจ้งผู้ใช้ */
export const MAX_LINE_LOGIN_FAILURES = 2;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const getStore = (storage?: StorageLike | null): StorageLike | null => {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    // sessionStorage อาจ throw ใน Private Mode บางเวอร์ชัน
    return null;
  }
};

const readCount = (store: StorageLike): number => {
  const raw = store.getItem(FAILURE_KEY);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * ตั้ง sentinel ก่อนเรียก liff.login() — บอกว่าการโหลดหน้าครั้งหน้าคือการ
 * กลับมาจาก LINE OAuth ที่เราเป็นคนเริ่ม
 */
export const markLineLoginAttempt = (storage?: StorageLike | null): void => {
  const store = getStore(storage);
  if (!store) return;
  store.setItem(PENDING_KEY, String(Date.now()));
};

export interface LineLoginReturnResult {
  /** หน้านี้คือการกลับมาจาก LINE OAuth ที่เราเริ่มไว้จริงหรือไม่ */
  returned: boolean;
  /** กลับมาแล้วแต่ isLoggedIn ยังเป็น false (คือ round-trip ล้มเหลว) */
  failed: boolean;
  /** จำนวน fail ติดกันล่าสุด */
  failures: number;
}

/**
 * เรียก *ครั้งเดียว* หลัง liff.init() เสร็จในทุกครั้งที่โหลดหน้า
 * ประเมินว่าการกลับมาจาก LINE สำเร็จหรือไม่ แล้วอัปเดตตัวนับ
 */
export const noteLineLoginReturn = (
  isLoggedIn: boolean,
  storage?: StorageLike | null,
): LineLoginReturnResult => {
  const store = getStore(storage);
  if (!store) {
    return { returned: false, failed: false, failures: 0 };
  }

  const pending = store.getItem(PENDING_KEY);
  if (!pending) {
    // ไม่ใช่การกลับมาจาก login ที่เราเริ่ม — ไม่แตะตัวนับ
    return { returned: false, failed: false, failures: readCount(store) };
  }

  // consume sentinel ทันที เพื่อไม่ให้ reload ธรรมดานับซ้ำ
  store.removeItem(PENDING_KEY);

  if (isLoggedIn) {
    // round-trip สำเร็จ — LIFF token ใช้งานได้ → รีเซ็ตตัวนับ
    store.removeItem(FAILURE_KEY);
    return { returned: true, failed: false, failures: 0 };
  }

  // กลับมาแล้วแต่ token หาย → นับ fail
  const failures = readCount(store) + 1;
  store.setItem(FAILURE_KEY, String(failures));
  return { returned: true, failed: true, failures };
};

/** login สำเร็จจริง (backend คืน user แล้ว) — ล้างสถานะทั้งหมด */
export const recordLineLoginSuccess = (storage?: StorageLike | null): void => {
  const store = getStore(storage);
  if (!store) return;
  store.removeItem(PENDING_KEY);
  store.removeItem(FAILURE_KEY);
};

export const getLineLoginFailures = (storage?: StorageLike | null): number => {
  const store = getStore(storage);
  return store ? readCount(store) : 0;
};

/** fail ติดกันถึงเกณฑ์แล้วหรือยัง — UI ควรหยุด auto-retry เมื่อ true */
export const isLineLoginBlocked = (storage?: StorageLike | null): boolean => {
  return getLineLoginFailures(storage) >= MAX_LINE_LOGIN_FAILURES;
};

/** ล้างสถานะเพื่อให้ผู้ใช้ลองใหม่ได้ (ปุ่ม "ลองอีกครั้ง") */
export const resetLineLoginGuard = (storage?: StorageLike | null): void => {
  recordLineLoginSuccess(storage);
};
