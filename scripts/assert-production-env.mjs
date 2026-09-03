import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const productionEnv = path.resolve(process.cwd(), ".env.production");
const productionBuildEnv = path.resolve(process.cwd(), ".env.build.production");

if (!fs.existsSync(productionEnv)) {
  console.error(
    "Missing .env.production. Run `pnpm env:production:init` once or copy .env.production.example before building for production.",
  );
  process.exit(1);
}

if (!fs.existsSync(productionBuildEnv)) {
  console.error(
    "Missing .env.build.production. Copy .env.build.production.example and fill public VITE_* values before building.",
  );
  process.exit(1);
}

const runtime = dotenv.parse(fs.readFileSync(productionEnv));
const build = dotenv.parse(fs.readFileSync(productionBuildEnv));
const errors = [];

for (const key of ["PORT", "DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"]) {
  if (!runtime[key]?.trim()) errors.push(`Missing runtime value: ${key}`);
}
if (!/^[a-f0-9]{64}$/i.test(runtime.AES_SECRET_KEY || "")) {
  errors.push("AES_SECRET_KEY must contain exactly 64 hexadecimal characters");
}
if ((runtime.SESSION_SECRET || "").length < 32) {
  errors.push("SESSION_SECRET must contain at least 32 characters");
}
for (const key of ["VITE_API_URL", "VITE_TURNSTILE_ENABLED", "VITE_ENABLE_CLIENT_CONSOLE"]) {
  if (!build[key]?.trim()) errors.push(`Missing build value: ${key}`);
}
for (const key of Object.keys(build)) {
  if (!key.startsWith("VITE_")) errors.push(`Build env contains a non-public key: ${key}`);
  if (/PASSWORD|SECRET|TOKEN|PRIVATE|DATABASE/i.test(key)) {
    errors.push(`Build env contains a secret-like key: ${key}`);
  }
}
if (build.VITE_TURNSTILE_ENABLED === "true") {
  if (!build.VITE_TURNSTILE_SITE_KEY?.trim()) {
    errors.push("Turnstile is enabled but VITE_TURNSTILE_SITE_KEY is empty");
  }
  if (!runtime.TURNSTILE_SECRET_KEY?.trim()) {
    errors.push("Turnstile is enabled but runtime TURNSTILE_SECRET_KEY is empty");
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Production runtime and build environment files are valid.");
