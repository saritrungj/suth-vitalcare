import liff from "@line/liff";
import { authStore } from "../store/auth";
import { writeStoredUser } from "../store/authSession";
import {
  markLineLoginAttempt,
  noteLineLoginReturn,
  recordLineLoginSuccess,
} from "./lineLoginGuard";
import { clientLog } from "./clientLog";

/**
 * จุดเดียวที่เรียก liff.login() — ตั้ง sentinel ของ circuit-breaker ก่อนเสมอ
 * เพื่อให้รู้ว่าการโหลดหน้าครั้งหน้าคือ "การกลับมาจาก LINE" จริง (ดู
 * lineLoginGuard.ts). ห้ามเรียก liff.login() ตรงๆ ที่อื่นอีก
 */
export const startLineLogin = () => {
  markLineLoginAttempt();
  liff.login();
};

/** อ่าน liff.isLoggedIn() แบบปลอดภัย — มัน throw ได้ถ้า init ยังไม่สำเร็จ */
const safeIsLoggedIn = (): boolean => {
  try {
    return liff.isLoggedIn();
  } catch {
    return false;
  }
};
const LIFF_ID = (import.meta as any).env.VITE_LIFF_ID || "";
const API_URL = (import.meta as any).env.VITE_API_URL || "/api";

/**
 * Minimal runtime guard for the restored session object. A corrupt/forged
 * `vitalcare_user` (e.g. tampered localStorage) must not seed an authenticated
 * state — we require at least a plausible `id`.
 */
const isValidStoredUser = (
  value: unknown,
): value is { id: number | string } => {
  if (!value || typeof value !== "object") return false;
  const id = (value as any).id;
  return (
    (typeof id === "number" && Number.isFinite(id)) ||
    (typeof id === "string" && id.length > 0)
  );
};
// ─── Session Validator ────────────────────────────────────────────────────────────────────
/**
 * เช็คผู้ใช้ที่ล็อกอินอยู่ว่ายังมีอยู่ใน Server หรือไม่ (สำหรับใช้โปรส ผู้ใช้ email)
 */
export const validateSessionWithServer = async (): Promise<boolean> => {
  const user = authStore.user;
  if (!user?.id) return false;
  try {
    const response = await fetch(`${API_URL}/users/${user.id}/profile`, {
      headers: { "x-user-id": String(user.id) },
      signal: AbortSignal.timeout(8000),
    });
    if (
      response.status === 401 ||
      response.status === 403 ||
      response.status === 404
    ) {
      forceLogout();
      return false;
    }
    if (response.ok) {
      const freshUser = await response.json();
      // อัปเดต is_suspended ไว้ในหน่วยความจำเผื่อให้ kick logic ใน App.vue ทำงานได้
      if (freshUser.is_suspended) {
        forceLogout();
        return false;
      }
    }
    return true;
  } catch {
    // Network timeout — ไม่ล็อกออต เผื่อไม่ปิดแอปเมื่อเน็ตหลุดชั่วคราว
    return true;
  }
};
/** ล้าง Local State และ Redirect ไปหน้า Login */
export const forceLogout = () => {
  fetch(`${API_URL}/users/logout`, { method: "POST", keepalive: true }).catch(
    () => {},
  );
  writeStoredUser(null);
  authStore.user = null;
  authStore.loading = false;
  try {
    if (liff.isLoggedIn()) liff.logout();
  } catch {}
  // หน่วยความจำ path ที่ /login โดยไม่ต้องนำเข้า router
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
};
/** liff.init() ไม่มี timeout ในตัว — ถ้าค้าง (เช่นตอน bounce-back จาก LINE OAuth
 *  บนเน็ตช้า) authStore.loading จะไม่มีวันเป็น false และ router guard จะค้างทั้งแอป */
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("liff.init timed out")), ms),
    ),
  ]);
};

/**
 * Initialize LIFF framework
 */
export const initLiff = async () => {
  // 1. โหลดจาก LocalStorage ก่อนเสมอ (fast path) — ทำก่อน LIFF init เพื่อให้
  //    ผู้ใช้ email/Google และเบราว์เซอร์ที่ไม่มี LIFF ยังคง Login ค้างไว้ได้
  const savedUser = localStorage.getItem("vitalcare_user");
  let hadSavedUser = false;
  if (savedUser) {
    try {
      const parsed = JSON.parse(savedUser);
      if (isValidStoredUser(parsed)) {
        authStore.setUser(parsed);
        authStore.loading = false;
        hadSavedUser = true;
        // 2. Background validate: เช็คกับ Server แบบสงบเงียบหลังจาก UI เรนเดอร์แล้ว
        validateSessionWithServer().catch(() => {});
      } else {
        // Corrupt/forged session — drop it and continue unauthenticated.
        localStorage.removeItem("vitalcare_user");
      }
    } catch (e) {
      localStorage.removeItem("vitalcare_user");
    }
  }
  // ไม่มี LIFF ก็จบได้เลย (session ถูก restore แล้วถ้ามี)
  if (!LIFF_ID) {
    authStore.loading = false;
    return;
  }
  try {
    // Timeout ป้องกัน liff.init() ค้างไม่รู้จบตอน bounce-back จาก LINE OAuth
    // บนเน็ตช้า — ถ้าค้างเกิน 8s จะตกไป catch ด้านล่างและปลด loading ทันที
    await withTimeout(liff.init({ liffId: LIFF_ID }), 8000);

    // ── Circuit-breaker: ประเมินผลการกลับมาจาก LINE OAuth ─────────────────
    // ถ้าเพิ่งกดปุ่ม LINE แล้วกลับมา (มี sentinel) แต่ isLoggedIn ยังเป็น false
    // แปลว่า LIFF token ไม่ persist บนเครื่องนี้ (มัก iOS Safari + ITP) — นับ fail
    // เพื่อให้ UI หยุด loop เมื่อครบเกณฑ์ (ดู Login.vue)
    const loggedIn = liff.isLoggedIn();
    const ret = noteLineLoginReturn(loggedIn);
    if (ret.returned) {
      if (ret.failed) {
        clientLog("liff_return_failed", { failures: ret.failures });
      } else {
        clientLog("liff_return_success", {});
      }
    }
    clientLog("liff_init_ok", { loggedIn });

    // 3. ถ้าไม่มีข้อมูลใน Local แต่ Login ผ่าน LINE → Auto Login (Silent)
    //    เช็ค authStore.user อีกครั้ง (ไม่ใช่แค่ hadSavedUser) เพราะระหว่างรอ
    //    liff.init() ผู้ใช้อาจ login สำเร็จผ่านทางอื่น (เช่น email) ไปแล้ว —
    //    ป้องกันไม่ให้ auto-login เงียบๆ นี้ไปทับ session ที่เพิ่งตั้งไว้
    if (!hadSavedUser && !authStore.user && loggedIn) {
      try {
        await backendLoginWithCaptcha("", false, true, /* silent */ true);
      } catch (err: any) {
        // Silent background auto-login failed (e.g. user not provisioned yet).
        // Don't surface a toast — the user didn't initiate this. Log for debug.
        console.warn("[liff] silent auto-login skipped:", err?.message || err);
      }
    }
  } catch (error: any) {
    // liff.init ล้มเหลวหรือ timeout (เช่นเปิดในเบราว์เซอร์ปกติ) — session ที่ restore ไว้ยังคงอยู่
    // ถ้าเพิ่งกลับมาจาก LINE แล้ว init พัง ก็ถือเป็น round-trip ที่ล้มเหลวด้วย
    const ret = noteLineLoginReturn(false);
    clientLog("liff_init_failed", {
      message: error?.message || String(error),
      failures: ret.returned ? ret.failures : undefined,
    });
  } finally {
    authStore.loading = false;
  }
};
// Single-flight lock: initLiff()'s silent auto-login and a user-initiated
// login (e.g. Login.vue) can otherwise race and fire two concurrent POSTs
// to /api/users/login, each independently overwriting authStore.user with
// whichever response lands last.
let loginRequestInFlight: Promise<any> | null = null;

/**
 * Performs backend login with CAPTCHA verification
 * This ensures only human users can access the registration/authenticated parts
 *
 * @param silent - true only for initLiff()'s background auto-login. Skips
 *   applying the result if the user already got authenticated through
 *   another path (e.g. email login) while this request was in flight.
 */
export const backendLoginWithCaptcha = async (
  captchaToken: string,
  isRegister: boolean = false,
  noCreate: boolean = false,
  silent: boolean = false,
) => {
  if (!liff.isLoggedIn()) {
    startLineLogin();
    return;
  }
  if (loginRequestInFlight) return loginRequestInFlight;
  loginRequestInFlight = (async () => {
    try {
      const accessToken = liff.getAccessToken();
      if (!accessToken) throw new Error("LINE access token is unavailable");
      const response = await fetch(`${API_URL}/users/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessToken,
          captchaToken: captchaToken,
          isRegister: isRegister,
          noCreate: noCreate,
        }),
      });
      if (!response.ok) {
        const errData = await response.json();
        if (!silent) {
          clientLog("backend_login_failed", {
            status: response.status,
            message: errData?.error || "Login failed",
          });
        }
        throw new Error(errData.error || "Login failed");
      }
      const userData = await response.json();
      if (!silent || !authStore.user) {
        authStore.setUser(userData);
      }
      // login สำเร็จจริง — ล้าง circuit-breaker (reset ตัวนับ fail)
      recordLineLoginSuccess();
      return userData;
    } finally {
      loginRequestInFlight = null;
    }
  })();
  return loginRequestInFlight;
};
export const logoutLiff = () => {
  fetch(`${API_URL}/users/logout`, { method: "POST", keepalive: true }).catch(
    () => {},
  );
  writeStoredUser(null);
  if (liff.isLoggedIn()) {
    try {
      liff.logout();
    } catch {}
  }
  authStore.user = null;
  authStore.loading = false;
};
export const loginLiff = () => {
  if (!safeIsLoggedIn()) {
    startLineLogin();
  }
};
