import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

/**
 * ── Environment loader ──────────────────────────────────────────────────────
 *
 * Development loads `.env.local`; production loads `.env.production`.
 * Local production smoke tests opt back into `.env.local` with
 * VITALCARE_LOCAL_RUNTIME=true. Values provided by the shell/PM2 always win.
 *
 * ต้อง import โมดูลนี้ก่อน import อื่น ๆ ที่อ่าน process.env ตอน import
 * (เช่น ./mysql.js ที่สร้าง connection pool ทันที) เพื่อให้ env พร้อมก่อน
 */
type EnvLike = Partial<
  Pick<NodeJS.ProcessEnv, "NODE_ENV" | "VITALCARE_LOCAL_RUNTIME">
>;

export function resolveRuntimeEnvFile(
  env: EnvLike = process.env,
  argv: string[] = process.argv,
) {
  const productionRequested =
    env.NODE_ENV === "production" || argv.includes("--prod");
  const useLocalRuntime = env.VITALCARE_LOCAL_RUNTIME === "true";
  return productionRequested && !useLocalRuntime
    ? ".env.production"
    : ".env.local";
}

if (process.argv.includes("--prod")) {
  process.env.NODE_ENV = "production";
}

const runtimeEnvFile = resolveRuntimeEnvFile();
const runtimeEnvPath = path.resolve(process.cwd(), runtimeEnvFile);

if (!fs.existsSync(runtimeEnvPath)) {
  throw new Error(
    `Missing ${runtimeEnvFile}. Copy ${runtimeEnvFile}.example and fill the required values.`,
  );
}

const loadResult = dotenv.config({
  path: runtimeEnvPath,
  override: false,
  quiet: true,
});
if (loadResult.error) throw loadResult.error;

export const loadedRuntimeEnvFile = runtimeEnvFile;
