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
assert.deepEqual(missing, {
  success: false,
  error: "Captcha verification is required",
  status: 400,
});
