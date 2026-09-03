import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const COOKIE_NAME = "vitalcare_session";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const devSecret = crypto.randomBytes(32).toString("hex");

function getSecret(): string {
  const sessionSecret = process.env.SESSION_SECRET || "";
  if (sessionSecret.length >= 32) return sessionSecret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  const developmentFallback = process.env.AES_SECRET_KEY || "";
  if (developmentFallback.length >= 32) return developmentFallback;
  return devSecret;
}

export function assertSessionConfiguration() {
  getSecret();
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("base64url");
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return header.split(";").reduce<Record<string, string>>((cookies, part) => {
    const separator = part.indexOf("=");
    if (separator < 1) return cookies;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      // Ignore malformed cookie values.
    }
    return cookies;
  }, {});
}

export function createSessionToken(userId: string | number): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({ uid: String(userId), iat: now, exp: now + SESSION_TTL_SECONDS }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): string | null {
  if (!token || token.length > 4096) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;

  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    if (!parsed?.uid || !Number.isFinite(parsed.exp) || parsed.exp <= now) return null;
    return String(parsed.uid);
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, userId: string | number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const token = createSessionToken(userId);
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`,
  );
}

export function clearSessionCookie(res: Response) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
  );
}

/**
 * Never trust an identity header supplied by the browser. A verified session
 * is the only source of x-user-id; existing routes can keep reading the header
 * while receiving a server-controlled value.
 */
export function attachVerifiedIdentity(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  delete req.headers["x-user-id"];
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  const userId = verifySessionToken(token);
  if (userId) req.headers["x-user-id"] = userId;
  next();
}

export function requireSession(req: Request, res: Response, next: NextFunction) {
  if (!req.headers["x-user-id"]) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}
