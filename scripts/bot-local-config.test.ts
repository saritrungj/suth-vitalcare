import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--eval", "import('./server/routes/bot.ts')"],
  {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "development",
      LINE_CHANNEL_SECRET: "",
      LINE_CHANNEL_ACCESS_TOKEN: "",
      AES_SECRET_KEY: "0".repeat(64),
    },
  },
);

assert.equal(
  result.status,
  0,
  `bot route must load without LINE credentials in local development:\n${result.stderr}`,
);
assert.doesNotMatch(result.stderr, /no channel secret/i);

console.log("bot-local-config.test.ts passed");
