const DEFAULT_EXTERNAL_HOSTS = ["suth.go.th"];

function configuredHosts(name: string, defaults: string[]): string[] {
  const configured = String(process.env[name] || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  return configured.length ? configured : defaults;
}

function hostAllowed(hostname: string, allowed: string[]) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return allowed.some((entry) => host === entry || host.endsWith(`.${entry}`));
}

export function safeExternalLink(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  try {
    const url = new URL(trimmed);
    const allowed = configuredHosts("ALLOWED_EXTERNAL_LINK_HOSTS", DEFAULT_EXTERNAL_HOSTS);
    return url.protocol === "https:" && hostAllowed(url.hostname, allowed)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function safeMediaRedirect(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.startsWith("/uploads/") && !trimmed.startsWith("//")) return trimmed;
  try {
    const url = new URL(trimmed);
    const allowed = configuredHosts("ALLOWED_MEDIA_HOSTS", [
      "res.cloudinary.com",
      "profile.line-scdn.net",
      "lh3.googleusercontent.com",
    ]);
    return url.protocol === "https:" && hostAllowed(url.hostname, allowed)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export async function fetchRemoteImage(value: unknown): Promise<Buffer> {
  let current = safeMediaRedirect(value);
  if (!current || current.startsWith("/")) throw new Error("Remote image URL is not allowed");

  for (let redirect = 0; redirect <= 3; redirect++) {
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: { accept: "image/png,image/jpeg,image/webp,image/gif" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      current = safeMediaRedirect(location ? new URL(location, current).toString() : null);
      if (!current || current.startsWith("/")) throw new Error("Image redirect is not allowed");
      continue;
    }
    if (!response.ok) throw new Error(`Remote image returned ${response.status}`);
    const contentType = (response.headers.get("content-type") || "").split(";")[0];
    if (!new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]).has(contentType)) {
      throw new Error("Remote response is not a supported image");
    }
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > 12 * 1024 * 1024) throw new Error("Remote image is too large");

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Remote image body is unavailable");
    const chunks: Buffer[] = [];
    let total = 0;
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      total += chunk.byteLength;
      if (total > 12 * 1024 * 1024) {
        await reader.cancel();
        throw new Error("Remote image is too large");
      }
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  throw new Error("Too many image redirects");
}
