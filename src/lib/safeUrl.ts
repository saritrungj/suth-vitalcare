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
      typeof window !== "undefined" ? window.location.origin : "http://localhost",
    );
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return trimmed;
    }
  } catch {
    // Malformed URL — reject.
  }
  return "";
};
