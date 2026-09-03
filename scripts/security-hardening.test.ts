import assert from "node:assert/strict";
import fs from "node:fs";

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "test-only-session-secret-with-at-least-32-characters";

const { createSessionToken, verifySessionToken } = await import(
  "../server/lib/session"
);
const { safeExternalLink, safeMediaRedirect } = await import(
  "../server/lib/safeUrl"
);
const { CONTENT_SECURITY_POLICY } = await import("../server/lib/securityHeaders");

const token = createSessionToken(42);
assert.equal(verifySessionToken(token), "42");
assert.equal(verifySessionToken(`${token.slice(0, -1)}x`), null);
assert.equal(verifySessionToken("not-a-token"), null);

assert.equal(safeExternalLink("javascript:alert(1)"), null);
assert.equal(safeExternalLink("//evil.example/phish"), null);
assert.equal(safeExternalLink("https://evil.example/phish"), null);
assert.equal(safeExternalLink("/activities/1"), "/activities/1");
assert.equal(safeExternalLink("https://www.suth.go.th/news")?.startsWith("https://www.suth.go.th/"), true);

assert.equal(safeMediaRedirect("http://res.cloudinary.com/demo/image.png"), null);
assert.equal(safeMediaRedirect("https://127.0.0.1/private"), null);
assert.equal(safeMediaRedirect("/uploads/profile/photo.png"), "/uploads/profile/photo.png");
assert.equal(
  safeMediaRedirect("https://res.cloudinary.com/demo/image/upload/sample.jpg")?.startsWith(
    "https://res.cloudinary.com/",
  ),
  true,
);

// LIFF's SDK dynamically requests these hosts.  If either is omitted, CSP
// blocks LIFF initialization before the login flow can run.
assert.match(CONTENT_SECURITY_POLICY, /script-src[^;]*https:\/\/static\.line-scdn\.net/);
assert.match(CONTENT_SECURITY_POLICY, /connect-src[^;]*https:\/\/liffsdk\.line-scdn\.net/);

// Production's SPA is served by IIS, so its independent CSP must remain in
// sync with Express's policy.
const iisConfig = fs.readFileSync(new URL("../web.config", import.meta.url), "utf8");
assert.match(iisConfig, /script-src[^&]*https:\/\/static\.line-scdn\.net/);
assert.match(iisConfig, /connect-src[^&]*https:\/\/liffsdk\.line-scdn\.net/);

console.log("security-hardening.test.ts passed");
