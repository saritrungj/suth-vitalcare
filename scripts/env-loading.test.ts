import assert from "node:assert/strict";
import {
  loadedRuntimeEnvFile,
  resolveRuntimeEnvFile,
} from "../server/loadEnv";

assert.equal(resolveRuntimeEnvFile({ NODE_ENV: "development" }, []), ".env.local");
assert.equal(resolveRuntimeEnvFile({ NODE_ENV: "production" }, []), ".env.production");
assert.equal(
  resolveRuntimeEnvFile(
    { NODE_ENV: "production", VITALCARE_LOCAL_RUNTIME: "true" },
    [],
  ),
  ".env.local",
);
assert.equal(
  resolveRuntimeEnvFile({}, ["node", "server/index.ts", "--prod"]),
  ".env.production",
);
assert.equal(loadedRuntimeEnvFile, ".env.local");

console.log("env-loading.test.ts passed");
