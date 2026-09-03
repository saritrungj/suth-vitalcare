import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import { build } from "vite";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const envPath = path.join(repositoryRoot, ".env.build.production");

if (!fs.existsSync(envPath)) {
  throw new Error(
    "Missing .env.build.production. Copy .env.build.production.example and fill the public production values.",
  );
}

const values = dotenv.parse(fs.readFileSync(envPath));
const invalidKeys = Object.keys(values).filter((key) => !key.startsWith("VITE_"));
if (invalidKeys.length > 0) {
  throw new Error(
    `.env.build.production may contain public VITE_* values only. Invalid: ${invalidKeys.join(", ")}`,
  );
}

for (const required of [
  "VITE_API_URL",
  "VITE_TURNSTILE_ENABLED",
  "VITE_ENABLE_CLIENT_CONSOLE",
]) {
  if (!values[required]?.trim()) {
    throw new Error(`Missing required production build value: ${required}`);
  }
}

if (
  values.VITE_TURNSTILE_ENABLED === "true" &&
  !values.VITE_TURNSTILE_SITE_KEY?.trim()
) {
  throw new Error(
    "VITE_TURNSTILE_SITE_KEY is required when production Turnstile is enabled.",
  );
}

for (const [key, value] of Object.entries(values)) {
  process.env[key] = value;
}

process.env.NODE_ENV = "production";
process.chdir(repositoryRoot);
await build({ mode: "production" });
