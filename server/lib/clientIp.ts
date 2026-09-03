import type { Request } from "express";

const firstHeaderValue = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value || "").split(",")[0].trim();

/** Normalize proxy IP headers to one address suitable for logs and Turnstile. */
export function normalizeClientIp(value: string | undefined): string | undefined {
  if (!value) return undefined;
  let ip = value.trim();
  if (!ip) return undefined;

  // IIS/ARR can append the source port. Keep IPv6 intact, but remove [v6]:port
  // and the unambiguous IPv4:port form.
  const bracketed = ip.match(/^\[([^\]]+)](?::\d+)?$/);
  if (bracketed) ip = bracketed[1];
  else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) {
    ip = ip.slice(0, ip.lastIndexOf(":"));
  }

  ip = ip.replace(/^::ffff:/i, "");
  return ip.slice(0, 45) || undefined;
}

/**
 * Cloudflare overwrites CF-Connecting-IP with the visitor address. Fall back
 * to the first X-Forwarded-For hop, then Express' proxy-aware req.ip.
 */
export function getClientIp(req: Request): string | undefined {
  const raw =
    firstHeaderValue(req.headers["cf-connecting-ip"]) ||
    firstHeaderValue(req.headers["x-forwarded-for"]) ||
    req.ip ||
    req.socket.remoteAddress;
  return normalizeClientIp(raw);
}
