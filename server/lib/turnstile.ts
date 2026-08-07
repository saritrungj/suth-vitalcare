import axios from "axios";

type EnvLike = Partial<
  Pick<
    NodeJS.ProcessEnv,
    "NODE_ENV" | "TURNSTILE_ENABLED" | "TURNSTILE_SECRET_KEY"
  >
>;

type TurnstileHttpClient = (
  url: string,
  body: URLSearchParams,
  options: {
    headers: Record<string, string>;
    timeout: number;
  },
) => Promise<{ data: { success?: boolean; "error-codes"?: string[] } }>;

export const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * รหัสผลลัพธ์ เพื่อให้ผู้เรียกแยกได้ว่า "ลองใหม่ได้" หรือ "ผิดจริง"
 * - captcha-expired      : token หมดอายุ/ถูกใช้ไปแล้ว → ให้ผู้ใช้ยืนยันใหม่
 * - captcha-failed       : token ไม่ถูกต้อง
 * - captcha-unavailable  : เรียก Cloudflare ไม่ได้ (ปัญหาฝั่งเรา ไม่ใช่ผู้ใช้)
 */
export type TurnstileResultCode =
  | "ok"
  | "missing-token"
  | "missing-secret"
  | "captcha-expired"
  | "captcha-failed"
  | "captcha-unavailable";

export interface TurnstileResult {
  success: boolean;
  status: number;
  code: TurnstileResultCode;
  error?: string;
}

export function isTurnstileEnabled(env: EnvLike = process.env) {
  if (env.NODE_ENV !== "production" && env.TURNSTILE_ENABLED === "false") {
    return false;
  }
  return true;
}

export function shouldRequireTurnstile(input: {
  isRegister?: boolean;
  noCreate?: boolean;
}) {
  if (input.noCreate) return false;
  return true;
}

/**
 * `remoteip` เป็น optional ของ Cloudflare — แต่ถ้าส่งไป มันต้องตรงกับ IP ที่
 * ผู้ใช้ไขปริศนามาจริง ๆ ไม่งั้น token จะถูกปฏิเสธ
 *
 * หลัง IIS reverse proxy ค่า `req.ip` อาจกลายเป็น loopback หรือ IP วง LAN
 * (เมื่อ X-Forwarded-For ไม่ถูกส่งต่อ) ซึ่งจะทำให้ login ล้มเหลวแบบสุ่มตาม
 * เส้นทางเน็ตของผู้ใช้ — กรณีแบบนั้นให้ "ไม่ส่ง" ดีกว่าส่งค่าผิด
 */
export function isPublicClientIp(ip: string | undefined): boolean {
  if (!ip) return false;
  // Express อาจให้มาเป็น IPv4-mapped IPv6 เช่น ::ffff:127.0.0.1
  const value = ip.trim().replace(/^::ffff:/i, "");
  if (!value) return false;
  if (value === "::1" || value === "unknown") return false;

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) {
    const [a, b] = value.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 192 && b === 168) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 169 && b === 254) return false;
    return true;
  }

  // IPv6: unique-local (fc00::/7) และ link-local (fe80::/10)
  const lower = value.toLowerCase();
  if (/^f[cd]/.test(lower)) return false;
  if (/^fe[89ab]/.test(lower)) return false;
  return lower.includes(":");
}

export async function verifyTurnstileToken(
  token: string | undefined,
  remoteIp: string | undefined,
  env: EnvLike = process.env,
  post: TurnstileHttpClient = axios.post,
): Promise<TurnstileResult> {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return {
      success: false,
      error: "Captcha service is not configured",
      status: 500,
      code: "missing-secret",
    };
  }

  if (!token) {
    return {
      success: false,
      error: "Captcha verification is required",
      status: 400,
      code: "missing-token",
    };
  }

  const body = new URLSearchParams({
    secret,
    response: token,
  });
  if (isPublicClientIp(remoteIp)) body.set("remoteip", remoteIp as string);

  try {
    const verifyRes = await post(TURNSTILE_VERIFY_URL, body, {
      headers: { "content-type": "application/x-www-form-urlencoded" },
      timeout: 8000,
    });

    if (!verifyRes.data?.success) {
      const codes = verifyRes.data?.["error-codes"] || [];
      // token หมดอายุ (300 วิ) หรือถูกใช้ซ้ำ — ผู้ใช้แค่ยืนยันใหม่ก็ผ่าน
      if (codes.includes("timeout-or-duplicate")) {
        return {
          success: false,
          error:
            "การยืนยันตัวตน (Captcha) หมดอายุ กรุณายืนยันใหม่แล้วลองอีกครั้ง",
          status: 400,
          code: "captcha-expired",
        };
      }
      return {
        success: false,
        error: "Captcha verification failed",
        status: 400,
        code: "captcha-failed",
      };
    }

    return { success: true, status: 200, code: "ok" };
  } catch (error) {
    console.error("Turnstile verification error:", error);
    return {
      success: false,
      error: "Security check service unavailable",
      status: 503,
      code: "captcha-unavailable",
    };
  }
}
