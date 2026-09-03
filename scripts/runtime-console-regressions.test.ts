import assert from "node:assert/strict";
import fs from "node:fs";
import { CONTENT_SECURITY_POLICY } from "../server/lib/securityHeaders";

assert.match(
  CONTENT_SECURITY_POLICY,
  /script-src[^;]*https:\/\/static\.cloudflareinsights\.com/,
);
assert.match(
  CONTENT_SECURITY_POLICY,
  /connect-src[^;]*https:\/\/cloudflareinsights\.com/,
);

const iisConfig = fs.readFileSync(
  new URL("../web.config", import.meta.url),
  "utf8",
);
assert.match(
  iisConfig,
  /script-src[^&]*https:\/\/static\.cloudflareinsights\.com/,
);
assert.match(
  iisConfig,
  /connect-src[^&]*https:\/\/cloudflareinsights\.com/,
);

const pwaInstall = fs.readFileSync(
  new URL("../src/composables/usePwaInstall.ts", import.meta.url),
  "utf8",
);
const installHandler = pwaInstall.slice(
  pwaInstall.indexOf('window.addEventListener("beforeinstallprompt"'),
  pwaInstall.indexOf('window.addEventListener("appinstalled"'),
);
assert.match(installHandler, /e\.preventDefault\(\)/);
assert.doesNotMatch(installHandler, /isMobileOrTabletDevice/);

const adminUsers = fs.readFileSync(
  new URL("../src/composables/useAdminUsers.ts", import.meta.url),
  "utf8",
);
const avatarHelper = adminUsers.slice(
  adminUsers.indexOf("const avatar ="),
  adminUsers.indexOf("const getInitialsAvatar ="),
);
assert.ok(
  avatarHelper.indexOf("u.line_picture_url") < avatarHelper.indexOf("u.picture_url"),
  "src_old parity requires the LINE profile URL to be preferred",
);

console.log("runtime-console-regressions.test.ts passed");
