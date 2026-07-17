import liff from "@line/liff";
import { authStore } from "../store/auth";
import { writeStoredUser } from "../store/authSession";
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
    await liff.init({ liffId: LIFF_ID });
    // 3. ถ้าไม่มีข้อมูลใน Local แต่ Login ผ่าน LINE → Auto Login (Silent)
    if (!hadSavedUser && liff.isLoggedIn()) {
      try {
        const userData = await backendLoginWithCaptcha("", false, true);
        if (userData) {
          localStorage.setItem("vitalcare_user", JSON.stringify(userData));
        }
      } catch (err: any) {
        // Silent background auto-login failed (e.g. user not provisioned yet).
        // Don't surface a toast — the user didn't initiate this. Log for debug.
        console.warn("[liff] silent auto-login skipped:", err?.message || err);
      }
    }
  } catch (error) {
    // liff.init ล้มเหลว (เช่นเปิดในเบราว์เซอร์ปกติ) — session ที่ restore ไว้ยังคงอยู่
  } finally {
    authStore.loading = false;
  }
};
/**
 * Performs backend login with CAPTCHA verification
 * This ensures only human users can access the registration/authenticated parts
 */
export const backendLoginWithCaptcha = async (
  captchaToken: string,
  isRegister: boolean = false,
  noCreate: boolean = false,
) => {
  if (!liff.isLoggedIn()) {
    liff.login();
    return;
  }
  try {
    const profile = await liff.getProfile();
    const decodedToken = liff.getDecodedIDToken() as any;
    const response = await fetch(`${API_URL}/users/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        line_id: profile.userId,
        fname_th: profile.displayName,
        picture_url: profile.pictureUrl,
        email: decodedToken?.email || null,
        captchaToken: captchaToken,
        isRegister: isRegister,
        noCreate: noCreate,
      }),
    });
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "Login failed");
    }
    const userData = await response.json();
    authStore.setUser(userData);
    return userData;
  } catch (apiError: any) {
    throw apiError;
  }
};
export const logoutLiff = () => {
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
  if (!liff.isLoggedIn()) {
    liff.login();
  }
};
