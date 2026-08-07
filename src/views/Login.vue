<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import liff from "@line/liff";
import Swal from "sweetalert2";
import MainFooter from "../components/MainFooter.vue";
import LanguageMenu from "../components/common/LanguageMenu.vue";
import { authStore } from "../store/auth";
import { backendLoginWithCaptcha, startLineLogin } from "../lib/liff";
import { isLineLoginBlocked, resetLineLoginGuard } from "../lib/lineLoginGuard";
import { clientLog } from "../lib/clientLog";
import { HttpError, parseJsonResponse } from "../lib/http";
import { consumeSafeRedirect } from "../lib/redirect";
import { langStore } from "../store/lang";
const toast = {
  error: (msg: string) =>
    Swal.fire({
      icon: "error",
      title: langStore.t("error_title"),
      text: msg,
      confirmButtonColor: "#F05A23",
    }),
  success: (msg: string) => {
    /* Success toast removed per user request */
  },
};
const router = useRouter();
const isTurnstileEnabled = import.meta.env.VITE_TURNSTILE_ENABLED !== "false";
// fallback "1x00000000000000000000AA" = Cloudflare test key (ผ่านเสมอ ใช้ระหว่าง dev)
const siteKey =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string) ||
  "1x00000000000000000000AA";
const email = ref("");
const password = ref("");
const showPassword = ref(false);
const turnstileToken = ref("");
const turnstileWidgetId = ref<string | null>(null);
const isAutoLoggingIn = ref(false);
// เมื่อ circuit-breaker ทำงาน (LINE login วนลูปบน iOS Safari) จะเผยฟอร์ม
// อีเมล/รหัสผ่านเป็นทางเลือกสำรอง (ปกติซ่อนไว้)
const showEmailFallback = ref(false);
const LINE_CAPTCHA_STORAGE_KEY = "vitalcare_line_captcha_token";
// Turnstile tokens are single-use and expire 300s after they are issued. The
// LINE OAuth round-trip (switch to the LINE app, approve, come back) regularly
// takes longer than that, so a token minted before the redirect is often
// already dead when we return — siteverify then answers timeout-or-duplicate
// and the login fails for no reason the user can see. Anything older than this
// margin is discarded in favour of a fresh token from the widget.
const LINE_CAPTCHA_MAX_AGE_MS = 240_000;

/**
 * แสดงข้อความช่วยเหลือเมื่อ LINE login ล้มเหลวซ้ำ (token หายบน iOS Safari)
 * พร้อมเผยฟอร์มอีเมลเป็นทางเลือกสำรอง และปุ่มลองใหม่ (รีเซ็ต breaker)
 */
const showLineLoginHelp = () => {
  showEmailFallback.value = true;
  clientLog("liff_login_blocked", {});
  Swal.fire({
    icon: "warning",
    title: "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ",
    html: `
      <div style="text-align:left;font-size:14px;line-height:1.7;color:#475569;font-family:'Sarabun',sans-serif;">
        <p style="margin-bottom:10px;">อุปกรณ์นี้อาจบล็อกข้อมูลการเข้าสู่ระบบของ LINE ไว้ กรุณาลองวิธีใดวิธีหนึ่ง:</p>
        <ul style="margin:0 0 4px;padding-left:20px;list-style:disc;">
          <li style="margin-bottom:6px;">ลบข้อมูลเว็บไซต์ใน <b>Settings &gt; Safari &gt; Advanced &gt; Website Data</b> แล้วลองใหม่</li>
          <li style="margin-bottom:6px;">ปิด <b>Prevent Cross-Site Tracking</b> ใน Settings &gt; Safari ชั่วคราว</li>
          <li>หรือเข้าสู่ระบบด้วย <b>อีเมล/รหัสผ่าน</b> ด้านล่างแทน</li>
        </ul>
      </div>
    `,
    confirmButtonText: "ลองอีกครั้ง",
    confirmButtonColor: "#F05A23",
    showCancelButton: true,
    cancelButtonText: "ปิด",
  }).then((result) => {
    if (result.isConfirmed) {
      // รีเซ็ตตัวนับแล้วโหลดหน้าใหม่เพื่อเริ่มรอบใหม่แบบสะอาด
      resetLineLoginGuard();
      window.location.reload();
    }
  });
};
// ── PDPA Consent ──────────────────────────────────────────────────────────────
const acceptAll = ref(false);
const acceptTerms = ref(false);
const acceptPrivacy = ref(false);
const pdpaAccepted = computed(() => acceptTerms.value && acceptPrivacy.value);
watch(acceptAll, (val) => {
  acceptTerms.value = val;
  acceptPrivacy.value = val;
});
watch([acceptTerms, acceptPrivacy], ([terms, privacy]) => {
  acceptAll.value = terms && privacy;
});
const showPrivacyPolicy = (e?: Event) => {
  if (e) e.stopPropagation();
  const w = window.innerWidth;
  Swal.fire({
    title: "นโยบายความเป็นส่วนตัว (PDPA)",
    width: w < 480 ? "95vw" : w < 768 ? "90vw" : "560px",
    html: `
      <div style="text-align:left;font-size:${w < 480 ? "12px" : w < 768 ? "13px" : "15px"};line-height:1.7;color:#475569;font-family:'Sarabun',sans-serif;max-height:55vh;overflow-y:auto;padding-right:4px;">
        <p style="margin-bottom:10px;">เพื่อความปลอดภัยและการจัดการระบบที่มีประสิทธิภาพ ระบบจะมีการเก็บรวบรวมข้อมูลดังต่อไปนี้เมื่อท่านเข้าสู่ระบบ:</p>
        <ul style="margin:10px 0;padding-left:20px;list-style-type:disc;">
          <li style="margin-bottom:6px;"><b>ข้อมูลส่วนบุคคล:</b> ชื่อ, นามสกุล และรหัสประจำตัว</li>
          <li style="margin-bottom:6px;"><b>ข้อมูลจราจรคอมพิวเตอร์:</b> IP Address, รุ่นเบราว์เซอร์ และระบบปฏิบัติการ</li>
          <li style="margin-bottom:6px;"><b>ประวัติการใช้งาน:</b> Audit Logs การทำรายการทั้งหมดภายในระบบ</li>
        </ul>
        <p>ข้อมูลเหล่านี้จะถูกบันทึกเพื่อใช้ในการตรวจสอบย้อนหลัง (Security Audit) โดยจะอนุญาตให้เข้าถึงได้เฉพาะผู้ดูแลระบบระดับสูงเท่านั้น</p>
      </div>
    `,
    icon: "info",
    confirmButtonText: "รับทราบและยอมรับ",
    confirmButtonColor: "#F05A23",
    customClass: {
      title: "swal-mobile-title",
      confirmButton: "swal-mobile-btn",
      popup: "swal-responsive-popup",
    },
  }).then((result) => {
    if (result.isConfirmed) acceptPrivacy.value = true;
  });
};
const showTerms = (e?: Event) => {
  if (e) e.stopPropagation();
  const w = window.innerWidth;
  Swal.fire({
    title: "เงื่อนไขการให้บริการ",
    width: w < 480 ? "95vw" : w < 768 ? "90vw" : "560px",
    html: `
      <div style="text-align:left;font-size:${w < 480 ? "12px" : w < 768 ? "13px" : "15px"};line-height:1.7;color:#475569;font-family:'Sarabun',sans-serif;max-height:55vh;overflow-y:auto;padding-right:4px;">
        <p style="margin-bottom:8px;">1. ผู้ใช้ตกลงที่จะปฏิบัติตามกฎระเบียบขององค์กรและเงื่อนไขการใช้งานระบบ</p>
        <p style="margin-bottom:8px;">2. ข้อมูลที่นำเข้าสู่ระบบต้องเป็นข้อมูลจริงและไม่ละเมิดสิทธิของผู้อื่น</p>
        <p style="margin-bottom:8px;">3. ระบบขอสงวนสิทธิ์ในการระงับการใช้งานหากพบพฤติกรรมที่ไม่เหมาะสม</p>
        <p>4. ผู้ใช้รับทราบว่าข้อมูลการใช้งานอาจถูกบันทึกเพื่อวัตถุประสงค์ด้านความปลอดภัย</p>
      </div>
    `,
    icon: "info",
    confirmButtonText: "รับทราบและยอมรับ",
    confirmButtonColor: "#F05A23",
    customClass: {
      title: "swal-mobile-title",
      confirmButton: "swal-mobile-btn",
      popup: "swal-responsive-popup",
    },
  }).then((result) => {
    if (result.isConfirmed) acceptTerms.value = true;
  });
};
function renderTurnstile() {
  if (!isTurnstileEnabled) return;
  const el = document.getElementById("turnstile-container");
  if (!el || !(window as any).turnstile) return;
  if (turnstileWidgetId.value !== null) {
    try {
      (window as any).turnstile.remove(turnstileWidgetId.value);
    } catch {}
    turnstileWidgetId.value = null;
  }
  turnstileWidgetId.value = (window as any).turnstile.render(
    "#turnstile-container",
    {
      sitekey: siteKey,
      theme: "light",
      size: "normal",
      callback: (token: string) => {
        turnstileToken.value = token;
      },
      "expired-callback": () => {
        turnstileToken.value = "";
      },
      "error-callback": () => {
        turnstileToken.value = "";
      },
    },
  );
}

function resetTurnstile() {
  turnstileToken.value = "";
  if (!isTurnstileEnabled || !(window as any).turnstile) return;
  if (turnstileWidgetId.value !== null) {
    try {
      (window as any).turnstile.reset(turnstileWidgetId.value);
    } catch {}
  }
}

/** เก็บ captcha token ไว้ข้ามรอบ redirect ไป LINE พร้อมเวลาที่ออก token */
function storeLineCaptchaToken(token: string) {
  try {
    sessionStorage.setItem(
      LINE_CAPTCHA_STORAGE_KEY,
      JSON.stringify({ token, ts: Date.now() }),
    );
  } catch {}
}

/**
 * อ่าน token ที่เก็บไว้ก่อน redirect (ใช้ได้ครั้งเดียว) — คืน "" ถ้าหมดอายุแล้ว
 * เพื่อให้ผู้เรียกไปขอ token ใหม่จาก widget แทนการยิงคำขอที่ล้มเหลวแน่นอน
 */
function getStoredLineCaptchaToken() {
  const raw = sessionStorage.getItem(LINE_CAPTCHA_STORAGE_KEY) || "";
  if (!raw) return "";
  sessionStorage.removeItem(LINE_CAPTCHA_STORAGE_KEY);
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.token) return "";
    if (Date.now() - Number(parsed.ts) > LINE_CAPTCHA_MAX_AGE_MS) return "";
    return String(parsed.token);
  } catch {
    // รูปแบบเก่า (เก็บเป็น string ล้วน ไม่มีเวลา) — ถือว่าหมดอายุ
    return "";
  }
}

/** โหลดสคริปต์ Turnstile แล้ว render widget (idempotent) */
function loadTurnstile() {
  if (!isTurnstileEnabled) return;
  if (!document.getElementById("cf-turnstile-script")) {
    const script = document.createElement("script");
    script.id = "cf-turnstile-script";
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    script.onload = () => renderTurnstile();
    document.head.appendChild(script);
  } else if ((window as any).turnstile) {
    renderTurnstile();
  } else {
    setTimeout(renderTurnstile, 300);
  }
}

/** รอจน widget ออก token ใหม่ให้ (คืน "" ถ้ารอเกินเวลา) */
function waitForTurnstileToken(timeoutMs = 20000): Promise<string> {
  if (turnstileToken.value) return Promise.resolve(turnstileToken.value);
  return new Promise((resolve) => {
    const stop = watch(turnstileToken, (token) => {
      if (!token) return;
      stop();
      clearTimeout(timer);
      resolve(token);
    });
    const timer = setTimeout(() => {
      stop();
      resolve("");
    }, timeoutMs);
  });
}

function requireTurnstileToken() {
  if (!isTurnstileEnabled || siteKey === "1x00000000000000000000AA") {
    return "";
  }
  if (!turnstileToken.value) {
    toast.error(langStore.t("captcha_required"));
    return null;
  }
  return turnstileToken.value;
}

onMounted(async () => {
  // Circuit-breaker: ถ้า LINE login ล้มเหลวติดกันถึงเกณฑ์ (มัก iOS Safari
  // token หายหลัง OAuth) ให้หยุด auto-retry ทันที แล้วแจ้งผู้ใช้ + เผยฟอร์ม
  // อีเมลแทน — กัน infinite loop เด้งเปิด LINE ไม่จบ (ยัง render turnstile
  // ต่อด้านล่าง เพื่อให้ทางเลือกอีเมลใช้งานได้)
  const blocked = isLineLoginBlocked();
  if (blocked) {
    showLineLoginHelp();
  }

  // Turnstile ต้อง render *ก่อน* auto-login: token ที่เก็บไว้ก่อน redirect ไป
  // LINE มักหมดอายุ (300 วิ) ระหว่างทางกลับ ทำให้ login ล้มเหลวแบบสุ่ม —
  // ต้องมี widget พร้อมออก token ใหม่ให้ fallback ได้
  loadTurnstile();

  let alreadyLoggedIn = false;
  try {
    alreadyLoggedIn = !blocked && !!(liff.isLoggedIn && liff.isLoggedIn());
  } catch {
    alreadyLoggedIn = false;
  }
  if (!alreadyLoggedIn) return;

  try {
    let captchaToken = "";
    if (isTurnstileEnabled) {
      captchaToken = turnstileToken.value || getStoredLineCaptchaToken();
      // token เก่าหมดอายุ/ไม่มี — รอ widget ออกใบใหม่ ดีกว่ายิงคำขอที่ล้มเหลวแน่นอน
      if (!captchaToken) captchaToken = await waitForTurnstileToken();
      // widget ไม่ตอบสนอง — ปล่อยให้ผู้ใช้กดปุ่ม LINE เองเมื่อ captcha พร้อม
      if (!captchaToken) return;
    }
    isAutoLoggingIn.value = true;
    const userData = await backendLoginWithCaptcha(captchaToken, false, false);
    if (userData) {
      authStore.setUser(userData);
      const redirectTo = consumeSafeRedirect();
      sessionStorage.setItem("allow_signup", "true");
      if (!userData.fname_th || !userData.phone)
        return (window.location.href = "/register");
      return (window.location.href = redirectTo);
    }
  } catch (err: any) {
    resetTurnstile();
    if (err?.message?.includes("not found") || err?.message?.includes("404")) {
      sessionStorage.setItem("allow_signup", "true");
      return router.replace("/register");
    }
    // Auto-login ผ่าน LINE ล้มเหลวด้วยสาเหตุอื่น (backend error, captcha
    // หมดอายุ, เน็ตหลุด ฯลฯ) — ต้องแจ้งผู้ใช้ ไม่งั้นจะเห็นแค่ฟอร์ม login
    // เฉยๆ โดยไม่รู้ว่าทำไม LINE login อัตโนมัติถึงไม่ทำงาน
    toast.error(
      err?.message || "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    );
  } finally {
    isAutoLoggingIn.value = false;
  }
});
const loginWithLine = async () => {
  if (!pdpaAccepted.value) {
    toast.error(langStore.t("pdpa_must_accept"));
    return;
  }
  if (!liff) {
    toast.error("LIFF SDK ไม่พร้อมใช้งาน");
    return;
  }
  // Circuit-breaker: ล้มเหลวติดกันถึงเกณฑ์แล้ว — อย่าเด้งเปิด LINE ซ้ำอีก
  // ให้แจ้งวิธีแก้ + ใช้อีเมลแทน (กัน loop)
  if (isLineLoginBlocked()) {
    showLineLoginHelp();
    return;
  }
  // liff.isLoggedIn() throws if liff.init() hasn't finished successfully
  // (e.g. it timed out or errored — see src/lib/liff.ts). Previously
  // unguarded here, so a slow/failed LIFF init made this button do nothing
  // with zero feedback to the user.
  let alreadyLoggedIn: boolean;
  try {
    alreadyLoggedIn = liff.isLoggedIn();
  } catch (err: any) {
    toast.error("ระบบ LINE ยังไม่พร้อมใช้งาน กรุณาปิดแอปแล้วเปิดใหม่อีกครั้ง");
    return;
  }
  if (!alreadyLoggedIn) {
    const captchaToken = requireTurnstileToken();
    if (captchaToken === null) return;
    if (captchaToken) {
      storeLineCaptchaToken(captchaToken);
    }
    // ผ่าน startLineLogin() เพื่อตั้ง sentinel ของ circuit-breaker ก่อน redirect
    startLineLogin();
  } else {
    try {
      const captchaToken = requireTurnstileToken();
      if (captchaToken === null) return;
      isAutoLoggingIn.value = true;
      const userData = await backendLoginWithCaptcha(
        captchaToken,
        false,
        false,
      );
      authStore.setUser(userData);
      const redirectTo = consumeSafeRedirect();
      sessionStorage.setItem("allow_signup", "true");
      if (!userData.fname_th || !userData.phone)
        window.location.href = "/register";
      else window.location.href = redirectTo;
    } catch (err: any) {
      isAutoLoggingIn.value = false;
      resetTurnstile();
      toast.error(err.message || "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ");
    }
  }
};
const togglePassword = () => {
  showPassword.value = !showPassword.value;
};
// ไปหน้าสมัครสมาชิก (Signup wizard Step 1) — ตั้ง allow_signup ให้ผ่าน guard
// ใน Signup.vue ที่กันไม่ให้เข้าหน้านี้ตรงๆ โดยไม่ผ่าน Login
const goToRegister = () => {
  sessionStorage.setItem("allow_signup", "true");
  router.push("/register");
};
// ลืมรหัสผ่าน: ไม่ให้ผู้ใช้รีเซ็ตเอง — แจ้งให้ติดต่อแผนกไอที
const showContactIt = () => {
  Swal.fire({
    icon: "info",
    title: langStore.t("forgot_password"),
    text: langStore.t("contact_it_reset"),
    confirmButtonColor: "#F05A23",
    confirmButtonText: langStore.locale === "th" ? "รับทราบ" : "OK",
  });
};
const handleLogin = async (e: Event) => {
  e.preventDefault();
  if (!pdpaAccepted.value) {
    toast.error(langStore.t("pdpa_must_accept"));
    return;
  }
  if (
    isTurnstileEnabled &&
    !turnstileToken.value &&
    siteKey !== "1x00000000000000000000AA"
  ) {
    toast.error(langStore.t("captcha_required"));
    return;
  }
  try {
    const API_URL = import.meta.env.VITE_API_URL || "/api";
    const res = await fetch(`${API_URL}/users/login-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.value,
        password: password.value,
        captchaToken: isTurnstileEnabled ? turnstileToken.value || "" : "",
      }),
    });
    // parseJsonResponse โยน HttpError เมื่อ !res.ok (พร้อมข้อความจริงจาก server)
    const data = await parseJsonResponse(res);
    const userData = data.user || data;
    if (userData && (userData.id || userData._id)) {
      authStore.setUser(userData);
    }
    window.location.href = consumeSafeRedirect();
  } catch (err: any) {
    resetTurnstile();
    // ต้องแสดงเหตุผลจริงจาก server (captcha หมดอายุ / บัญชีถูกระงับ /
    // รหัสผ่านไม่ถูกต้อง) — ไม่งั้นผู้ใช้เห็นแต่ "เชื่อมต่อไม่ได้" ทุกกรณี
    if (err instanceof HttpError) {
      toast.error(err.message);
    } else {
      toast.error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง");
    }
  }
};
</script>
<template>
  <!-- Loading overlay สำหรับ LIFF auto-login -->
  <div
    v-if="isAutoLoggingIn"
    style="
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      gap: 1rem;
    "
  >
    <img src="/logo.png" alt="Logo" style="width: 72px; border-radius: 16px" />
    <p style="font-size: 1.1rem; font-weight: 600; color: #356768; margin: 0">
      {{ langStore.t("login_loading") }}
    </p>
    <div class="liff-spinner"></div>
  </div>
  <div class="split-layout" v-show="!isAutoLoggingIn">
    <header class="desktop-header">
      <div class="header-inner">
        <div class="brand">
          <img src="/logo.png" alt="Logo" class="mini-logo" />
          <span class="header-title">{{ langStore.t("login") }}</span>
        </div>
      </div>
    </header>
    <div class="main-content">
      <div class="left-hero">
        <div class="hero-content">
          <img src="/logo.png" alt="Logo" class="hero-logo" />
          <h1 class="hero-title">VitalCare</h1>
          <p class="hero-desc">
            {{ langStore.t("hero_desc").split("\n")[0] }}<br />{{
              langStore.t("hero_desc").split("\n")[1]
            }}
          </p>
        </div>
      </div>
      <div class="login-wrapper">
        <div class="login-container">
          <!-- ตัวเลือกภาษา — อยู่มุมขวาบนภายในกล่อง login -->
          <div class="login-lang-switch">
            <LanguageMenu />
          </div>
          <div class="login-content-inner">
            <div class="logo-container mobile-only">
              <img src="/logo.png" alt="Logo" class="logo" />
            </div>
            <div class="form-intro">
              <h1 class="form-title">{{ langStore.t("login") }}</h1>
              <p class="form-subtitle">{{ langStore.t("login_welcome") }}</p>
            </div>
            <form @submit="handleLogin" class="form-content">
              <div class="input-group">
                <div class="input-wrapper">
                  <svg
                    class="input-icon"
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  <input
                    id="email"
                    type="text"
                    v-model="email"
                    :placeholder="langStore.t('username')"
                    required
                  />
                </div>
              </div>
              <div class="input-group">
                <div class="input-wrapper">
                  <svg
                    class="input-icon"
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input
                    id="password"
                    :type="showPassword ? 'text' : 'password'"
                    v-model="password"
                    :placeholder="langStore.t('password')"
                    required
                  />
                  <button
                    type="button"
                    class="btn-toggle-password"
                    @click="togglePassword"
                    :aria-label="showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'"
                  >
                    <svg
                      v-if="showPassword"
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path
                        d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"
                      />
                      <path
                        d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"
                      />
                      <line x1="2" x2="22" y1="2" y2="22" />
                    </svg>
                    <svg
                      v-else
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
              </div>
              <div class="form-aux">
                <a
                  href="#"
                  @click.prevent="showContactIt"
                  class="forgot-link"
                  >{{ langStore.t("forgot_password") }}</a
                >
              </div>
              <button
                type="submit"
                class="btn-primary"
                :class="{ 'btn-disabled': !pdpaAccepted }"
                :disabled="!pdpaAccepted"
              >
                {{ langStore.t("login") }}
              </button>
              <button
                type="button"
                class="btn-register-link"
                @click="goToRegister"
              >
                {{ langStore.t("no_account_register") }}
              </button>
            </form>
            <div class="divider">
              <span>{{ langStore.t("or") }}</span>
            </div>
            <div class="social-login">
              <button
                type="button"
                class="btn-line-custom"
                :class="{ 'btn-disabled': !pdpaAccepted }"
                :disabled="!pdpaAccepted"
                @click="loginWithLine"
              >
                <svg
                  class="social-icon"
                  viewBox="0 0 24 24"
                  fill="#00C300"
                  width="20"
                  height="20"
                >
                  <path
                    d="M22 10.4c0-4.3-4.5-7.8-10-7.8S2 6.1 2 10.4c0 3.8 3.5 7.1 8 7.7.3.1.8.2.9.5.1.2.1.6 0 1l-.3 1.8c0 .1-.1.4.3.6.4.2.9-.1 1.2-.3 1.1-.9 6.2-3.8 8.1-6.1.8-1 1.8-2.6 1.8-5.2zM8.3 12.6H5.9c-.3 0-.6-.3-.6-.6V8.6c0-.3.3-.6.6-.6s.6.3.6.6v2.8h1.8c.3 0 .6.3.6.6s-.3.6-.6.6zm3.3 0h-1.2c-.3 0-.6-.3-.6-.6V8.6c0-.3.3-.6.6-.6s.6.3.6.6v3.4c0 .3-.3.6-.6.6zm4.8 0h-1.2l-1.9-2.7v2.2c0 .3-.3.6-.6.6s-.6-.3-.6-.6V8.6c0-.3.3-.6.6-.6h1.2l1.9 2.7V8.6c0-.3.3-.6.6-.6s.6.3.6.6v3.4c0 .3-.2.6-.6.6z"
                  />
                </svg>
                <span>{{ langStore.t("login_with_line") }}</span>
              </button>
            </div>
            <!-- Cloudflare Turnstile — ใต้ปุ่ม LINE -->
            <div v-if="isTurnstileEnabled" class="cf-turnstile-wrapper">
              <div
                id="turnstile-container"
                :data-sitekey="siteKey"
                data-theme="light"
                data-size="normal"
              ></div>
            </div>
            <!-- PDPA Consent Checkboxes -->
            <div class="pdpa-consent">
              <!-- Accept All -->
              <label class="pdpa-row pdpa-accept-all" @click.stop>
                <span class="pdpa-checkbox-wrap">
                  <input type="checkbox" id="acceptAll" v-model="acceptAll" />
                  <span class="pdpa-custom-box" :class="{ checked: acceptAll }">
                    <svg
                      v-if="acceptAll"
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      stroke-width="3.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                </span>
                <span class="pdpa-label-text pdpa-label-bold">{{
                  langStore.t("accept_all")
                }}</span>
              </label>
              <div class="pdpa-divider"></div>
              <!-- Accept Terms -->
              <label class="pdpa-row" @click.stop>
                <span class="pdpa-checkbox-wrap">
                  <input
                    type="checkbox"
                    id="acceptTerms"
                    v-model="acceptTerms"
                  />
                  <span
                    class="pdpa-custom-box"
                    :class="{ checked: acceptTerms }"
                  >
                    <svg
                      v-if="acceptTerms"
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      stroke-width="3.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                </span>
                <span class="pdpa-label-text"
                  >{{ langStore.t("accept") }}
                  <button
                    type="button"
                    class="pdpa-link"
                    @click.stop="showTerms()"
                  >
                    {{ langStore.t("accept_terms") }}
                  </button></span
                >
              </label>
              <!-- Accept Privacy -->
              <label class="pdpa-row" @click.stop>
                <span class="pdpa-checkbox-wrap">
                  <input
                    type="checkbox"
                    id="acceptPrivacy"
                    v-model="acceptPrivacy"
                  />
                  <span
                    class="pdpa-custom-box"
                    :class="{ checked: acceptPrivacy }"
                  >
                    <svg
                      v-if="acceptPrivacy"
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      stroke-width="3.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                </span>
                <span class="pdpa-label-text"
                  >{{ langStore.t("accept") }}
                  <button
                    type="button"
                    class="pdpa-link"
                    @click.stop="showPrivacyPolicy()"
                  >
                    {{ langStore.t("accept_privacy") }}
                  </button></span
                >
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
    <MainFooter />
  </div>
</template>
<style scoped>
.liff-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e2e8f0;
  border-top-color: #356768;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
:deep(.swal-mobile-title) {
  font-size: 1.2rem !important;
  padding-top: 1rem !important;
}
:deep(.swal-mobile-btn) {
  padding: 8px 24px !important;
  font-size: 0.9rem !important;
}
@media (max-width: 768px) {
  :deep(.swal2-popup) {
    padding: 1rem !important;
    border-radius: 16px !important;
  }
}
:deep(.swal-responsive-popup) {
  border-radius: 16px !important;
  padding: clamp(12px, 4vw, 32px) !important;
}
/* ── Disabled Button ──────────────────────────────────────────────────────── */
.btn-disabled {
  opacity: 0.45 !important;
  cursor: not-allowed !important;
  pointer-events: none;
}
/* ── PDPA Consent Block ───────────────────────────────────────────────────── */
.pdpa-consent {
  margin-top: 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pdpa-divider {
  height: 1px;
  background: #e2e8f0;
  margin: 2px 0;
}
.pdpa-row {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  padding: 2px 0;
}
.pdpa-accept-all {
  padding-bottom: 2px;
}
.pdpa-checkbox-wrap {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}
.pdpa-checkbox-wrap input[type="checkbox"] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}
.pdpa-custom-box {
  width: 20px;
  height: 20px;
  border: 2px solid #cbd5e1;
  border-radius: 5px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.18s ease;
  flex-shrink: 0;
}
.pdpa-custom-box.checked {
  background: #f05a23;
  border-color: #f05a23;
}
.pdpa-row:hover .pdpa-custom-box:not(.checked) {
  border-color: #f05a23;
  background: #fff5f2;
}
.pdpa-label-text {
  font-size: 13px;
  color: #475569;
  line-height: 1.4;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.pdpa-label-bold {
  font-weight: 700;
  color: #1e293b;
  font-size: 13.5px;
}
.pdpa-link {
  background: none;
  border: none;
  padding: 0;
  color: #f05a23;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  text-decoration: underline;
  font-family: inherit;
  line-height: inherit;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.split-layout {
  --bg-color: #ffffff;
  --surface-color-light: #ffffff;
  --border-color: #e2e8f0;
  --primary-color: #f05a23;
  --primary-color-hover: #d94d1a;
  --accent-color: #356768;
  --text-main: #1e293b;
  --text-muted: #64748b;
  --border-radius-sm: 6px;
  --border-radius-lg: 16px;
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  font-family: "Sarabun", sans-serif;
  background-color: var(--bg-color);
  overflow: hidden;
}
.login-lang-switch {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 5;
}
.desktop-header {
  display: none;
}
.main-content {
  flex: 1;
  display: flex;
}
.left-hero {
  display: none;
}
.login-wrapper {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-x: hidden;
  box-sizing: border-box;
}
.login-container {
  position: relative;
  width: 100%;
  min-height: 100svh;
  background: #ffffff;
  border: none;
  padding: 10vh 24px 12vh;
  box-sizing: border-box;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
.login-content-inner {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
}
.desktop-only {
  display: none;
}
.logo-container.mobile-only {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}
.logo {
  height: 100px;
  object-fit: contain;
  margin-top: 10px;
}
.form-intro {
  margin-bottom: 22px;
  text-align: center;
}
.form-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-main);
  margin: 0 0 6px;
  letter-spacing: -0.01em;
}
.form-subtitle {
  font-size: 14.5px;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.5;
}
.form-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.input-group {
  display: flex;
  flex-direction: column;
}
.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}
.input-icon {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
  pointer-events: none;
}
.input-wrapper input {
  width: 100%;
  background: var(--surface-color-light);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 12px 16px 12px 44px;
  color: var(--text-main);
  font-size: 16px;
  outline: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
  font-family: inherit;
  height: 56px;
  box-sizing: border-box;
}
/* Placeholder needs 4.5:1 contrast — the browser default (~50% ink) fails it */
.input-wrapper input::placeholder {
  color: #64748b;
  opacity: 1;
}
.input-wrapper input:hover {
  border-color: #cbd5e1;
}
.input-wrapper input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(240, 90, 35, 0.15);
}
#password {
  padding-right: 46px;
}
.btn-toggle-password {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    color 0.15s ease,
    background-color 0.15s ease;
}
.btn-toggle-password:hover {
  color: var(--text-main);
  background: #f1f5f9;
}
.btn-toggle-password:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 1px;
}
.form-aux {
  display: flex;
  justify-content: flex-end;
  margin-top: -4px;
}
.forgot-link {
  font-size: 14px;
  font-weight: 600;
  color: var(--accent-color);
  text-decoration: none;
  border-radius: 4px;
}
.forgot-link:hover {
  color: var(--primary-color);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.forgot-link:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}
.btn-primary {
  width: 100%;
  padding: 12px;
  height: 56px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-primary:hover {
  background: var(--primary-color-hover);
}
.btn-primary:active {
  transform: scale(0.98);
  background: var(--primary-color-hover);
}
.btn-primary:focus-visible,
.btn-line-custom:focus-visible,
.btn-register-link:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}
.btn-line-custom:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}
.btn-register-link {
  width: 100%;
  background: none;
  border: none;
  color: var(--accent-color);
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  padding: 6px;
  margin-top: 2px;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.btn-register-link:hover {
  color: var(--primary-color);
}
.divider {
  display: flex;
  align-items: center;
  text-align: center;
  margin: 16px 0;
}
.divider::before,
.divider::after {
  content: "";
  flex: 1;
  border-bottom: 1px solid var(--border-color);
}
.divider span {
  padding: 0 12px;
  color: #94a3b8;
  font-size: 13px;
}
.social-login {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.btn-line-custom {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  padding: 12px 20px;
  background: var(--surface-color-light);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-main);
  cursor: pointer;
  min-height: 56px;
  transition: all 0.2s;
  font-family: inherit;
  line-height: 1.2;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}
.btn-line-custom:active {
  background-color: #f8fafc;
}
.btn-social {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  background: var(--surface-color-light);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  font-size: 14px;
  font-weight: 500;
  color: var(--text-main);
  cursor: pointer;
  min-height: 44px;
  transition: background-color 0.2s;
  font-family: inherit;
  line-height: 1.2;
}
.btn-social:active {
  background-color: #f8fafc;
}
.social-icon {
  flex-shrink: 0;
}
.legal-text {
  text-align: center;
  margin-top: 16px;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}
.legal-text a {
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 600;
}
.cf-turnstile-wrapper {
  overflow: hidden;
  display: flex;
  justify-content: center;
  height: 65px;
  margin: 12px 0;
}
#turnstile-container {
  height: 65px;
  display: flex;
  align-items: center;
  justify-content: center;
}
@media (min-width: 768px) {
  .split-layout {
    background-color: var(--primary-color);
  }
  .desktop-header {
    display: block;
    background: white;
    height: 84px;
    padding: 0 40px;
  }
  .header-inner {
    max-width: 1200px;
    margin: 0 auto;
    height: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .mini-logo {
    height: 44px;
    object-fit: contain;
  }
  .header-title {
    font-size: 24px;
    font-weight: 500;
    color: #222;
  }
  .main-content {
    max-width: 1100px;
    margin: 0 auto;
    width: 100%;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 40px;
    padding: 40px 32px;
  }
  .left-hero {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    flex: 1;
    padding: 20px;
    color: white;
  }
  .hero-content {
    max-width: 400px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .hero-logo {
    height: 180px;
    object-fit: contain;
    margin-bottom: 24px;
    filter: drop-shadow(0px 0px 30px rgba(255, 255, 255, 0.9))
      drop-shadow(0px 0px 60px rgba(255, 255, 255, 0.6));
  }
  .hero-title {
    font-size: 42px;
    font-weight: 700;
    margin: 0 0 12px 0;
    color: #ffffff;
  }
  .hero-desc {
    font-size: 20px;
    line-height: 1.4;
    margin: 0;
    font-weight: 300;
  }
  .login-wrapper {
    width: 400px;
    flex: none;
    background: transparent;
    padding: 0;
  }
  .mobile-only {
    display: none !important;
  }
  .desktop-only {
    display: block;
  }
  .form-header {
    margin-bottom: 24px;
  }
  .form-header h2 {
    font-size: 20px;
    font-weight: 500;
    color: #222;
    margin: 0;
  }
  .login-container {
    background: white;
    min-height: auto;
    height: auto;
    border-radius: 20px;
    padding: 48px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);
    justify-content: center;
  }
  .social-login {
    flex-direction: column;
    gap: 12px;
  }
}
@media (min-width: 1024px) {
  .main-content {
    gap: 80px;
  }
  .login-wrapper {
    width: 440px;
  }
}
</style>
