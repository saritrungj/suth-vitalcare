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

export async function verifyTurnstileToken(
  token: string | undefined,
  remoteIp: string | undefined,
  env: EnvLike = process.env,
  post: TurnstileHttpClient = axios.post,
) {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return {
      success: false,
      error: "Captcha service is not configured",
      status: 500,
    };
  }

  if (!token) {
    return {
      success: false,
      error: "Captcha verification is required",
      status: 400,
    };
  }

  const body = new URLSearchParams({
    secret,
    response: token,
  });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const verifyRes = await post(TURNSTILE_VERIFY_URL, body, {
      headers: { "content-type": "application/x-www-form-urlencoded" },
      timeout: 8000,
    });

    if (!verifyRes.data?.success) {
      return {
        success: false,
        error: "Captcha verification failed",
        status: 400,
      };
    }

    return { success: true, status: 200 };
  } catch (error) {
    console.error("Turnstile verification error:", error);
    return {
      success: false,
      error: "Security check service unavailable",
      status: 503,
    };
  }
}
