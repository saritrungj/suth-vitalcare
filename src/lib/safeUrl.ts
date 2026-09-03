/**
 * Guard for API-/user-provided image URLs rendered into `:src`.
 *
 * Returns the URL only if it uses a safe scheme (http/https), is root-relative
 * (`/uploads/...`), or is protocol-relative to the current host. Anything else
 * — most importantly `javascript:` and `data:` URIs — yields an empty string so
 * the template can fall back to a placeholder/initial. Cosmetic fallback only;
 * never throws.
 */
export const safeImageUrl = (url: unknown): string => {
  if (typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  // Root-relative paths are safe (served by our own origin).
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;

  try {
    // Resolve against current origin so relative paths are accepted too.
    const parsed = new URL(
      trimmed,
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost",
    );
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return trimmed;
    }
  } catch {
    // Malformed URL — reject.
  }
  return "";
};

const DEFAULT_EXTERNAL_HOSTS = new Set([
  "suth.go.th",
  "www.suth.go.th",
  "ptpioneer.com",
  "www.ptpioneer.com",
  "ironman.com",
  "www.ironman.com",
]);

export const safeLinkUrl = (url: unknown): string => {
  if (typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" && DEFAULT_EXTERNAL_HOSTS.has(parsed.hostname.toLowerCase())
      ? parsed.toString()
      : "";
  } catch {
    return "";
  }
};

export const safeInternalPath = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const path = value.trim();
  return path.startsWith("/") && !path.startsWith("//") && !/[\u0000-\u001f]/.test(path)
    ? path
    : "";
};

export const openSafeExternalUrl = (url: unknown): boolean => {
  const safe = safeLinkUrl(url);
  if (!safe || safe.startsWith("/")) return false;
  window.open(safe, "_blank", "noopener,noreferrer");
  return true;
};
