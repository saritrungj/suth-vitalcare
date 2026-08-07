import assert from "node:assert/strict";
import {
  isTurnstileEnabled,
  shouldRequireTurnstile,
  verifyTurnstileToken,
} from "../server/lib/turnstile";

assert.equal(
  isTurnstileEnabled({ NODE_ENV: "development", TURNSTILE_ENABLED: "false" }),
  false,
);
assert.equal(
  isTurnstileEnabled({ NODE_ENV: "production", TURNSTILE_ENABLED: "false" }),
  true,
);
assert.equal(shouldRequireTurnstile({ noCreate: true }), false);
assert.equal(shouldRequireTurnstile({ noCreate: false }), true);
assert.equal(shouldRequireTurnstile({ isRegister: true }), true);

let capturedBody = "";
const ok = await verifyTurnstileToken(
  "captcha-token",
  "203.0.113.9",
  { TURNSTILE_SECRET_KEY: "secret" },
  async (_url, body) => {
    capturedBody = String(body);
    return { data: { success: true } };
  },
);

assert.equal(ok.success, true);
assert.match(capturedBody, /secret=secret/);
assert.match(capturedBody, /response=captcha-token/);
assert.match(capturedBody, /remoteip=203\.0\.113\.9/);

const missing = await verifyTurnstileToken(
  "",
  undefined,
  { TURNSTILE_SECRET_KEY: "secret" },
  async () => {
    throw new Error("verify should not be called without a token");
  },
);
assert.equal(missing.success, false);
assert.equal(missing.status, 400);
assert.equal(missing.code, "missing-token");

// ── remoteip must only be sent when it is a real public client address ───────
// Behind the IIS reverse proxy `req.ip` can resolve to loopback or a private
// LAN address. Cloudflare rejects a token whose remoteip does not match the IP
// that solved the challenge, so a wrong remoteip fails logins at random
// depending on the network path. Omitting it is explicitly allowed.
for (const privateIp of [
  "127.0.0.1",
  "::1",
  "::ffff:127.0.0.1",
  "10.1.2.3",
  "192.168.1.50",
  "172.16.0.9",
  "unknown",
]) {
  let body = "";
  await verifyTurnstileToken(
    "tok",
    privateIp,
    { TURNSTILE_SECRET_KEY: "secret" },
    async (_url, b) => {
      body = String(b);
      return { data: { success: true } };
    },
  );
  assert.equal(
    /remoteip/.test(body),
    false,
    `remoteip must be omitted for ${privateIp}`,
  );
}

// ── An expired/replayed token is recoverable — say so distinctly ─────────────
// Turnstile tokens live 300s and are single-use; the LINE OAuth round-trip
// routinely outlives that. This must not read like "wrong password".
const expired = await verifyTurnstileToken(
  "stale-token",
  undefined,
  { TURNSTILE_SECRET_KEY: "secret" },
  async () => ({
    data: { success: false, "error-codes": ["timeout-or-duplicate"] },
  }),
);
assert.equal(expired.success, false);
assert.equal(expired.status, 400);
assert.equal(expired.code, "captcha-expired");
assert.match(expired.error!, /หมดอายุ/);

const badToken = await verifyTurnstileToken(
  "bogus",
  undefined,
  { TURNSTILE_SECRET_KEY: "secret" },
  async () => ({
    data: { success: false, "error-codes": ["invalid-input-response"] },
  }),
);
assert.equal(badToken.success, false);
assert.equal(badToken.code, "captcha-failed");

// ── Cloudflare unreachable → 503, distinct from a bad token ──────────────────
const down = await verifyTurnstileToken(
  "tok",
  undefined,
  { TURNSTILE_SECRET_KEY: "secret" },
  async () => {
    throw new Error("ETIMEDOUT");
  },
);
assert.equal(down.success, false);
assert.equal(down.status, 503);
assert.equal(down.code, "captcha-unavailable");

console.log("turnstile.test.ts passed");
