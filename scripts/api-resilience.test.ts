import assert from "node:assert/strict";
import fs from "node:fs";

const appEntry = fs.readFileSync(
  new URL("../src/main.ts", import.meta.url),
  "utf8",
);
assert.match(appEntry, /x-client-silent-errors/);
assert.match(appEntry, /body\.ok === false/);
assert.match(appEntry, /new Response\(JSON\.stringify\(normalizedPayload\)/);

const iisConfig = fs.readFileSync(
  new URL("../web.config", import.meta.url),
  "utf8",
);
assert.match(
  iisConfig,
  /<match url="\^health\(\?:\/\.\*\)\?\$"\s*\/>/,
  "IIS must proxy /health and readiness subpaths to Node",
);

console.log("api-resilience.test.ts passed");
