import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { defineConfig, loadEnv } from "vite";
import { visualizer } from "rollup-plugin-visualizer";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Build info (สำหรับ version.json + ตรวจเวอร์ชันอัตโนมัติ) ─────────────────
// buildId เปลี่ยนทุกครั้งที่ build → ใช้เทียบว่ามี deploy ใหม่หรือยัง
const resolveBuildInfo = () => {
  let version = "0.0.0";
  try {
    version = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "package.json"), "utf-8"),
    ).version;
  } catch {}
  let commit = "nogit";
  try {
    // execFileSync (no shell) with a fixed arg list — no injection surface
    commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {}
  const buildTime = new Date().toISOString();
  return {
    version,
    commit,
    buildTime,
    buildId: `${version}+${commit}.${Date.now()}`,
  };
};
const buildInfo = resolveBuildInfo();

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [
      vue(),
      tailwindcss(),
      // เขียน dist/version.json ตอน build เสร็จ เพื่อให้ client fetch มาเทียบ
      {
        name: "emit-version-json",
        closeBundle() {
          const target = path.resolve(__dirname, "dist", "version.json");
          if (fs.existsSync(path.dirname(target))) {
            fs.writeFileSync(target, JSON.stringify(buildInfo, null, 2));
          }
        },
      },
      {
        name: "copy-iis-web-config",
        closeBundle() {
          const source = path.resolve(__dirname, "web.config");
          const target = path.resolve(__dirname, "dist", "web.config");
          if (fs.existsSync(source) && fs.existsSync(path.dirname(target))) {
            fs.copyFileSync(source, target);
          }
        },
      },
      // ใช้ visualizer เฉพาะตอน production
      mode === "production" &&
        (visualizer({
          filename: "dist/stats.html",
          open: false,
          gzipSize: true,
        }) as any),
    ].filter(Boolean),
    define: {
      "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY),
      // baked-in build id ของ bundle นี้ — เทียบกับ /version.json ตอน runtime
      __APP_VERSION__: JSON.stringify(buildInfo.buildId),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      allowedHosts: true,
      port: 5001,
      strictPort: true,
      hmr:
        process.env.DISABLE_HMR !== "true"
          ? {
              clientPort: 443,
            }
          : false,
      // ลด timeout และเพิ่ม performance
      watch: {
        usePolling: false,
        interval: 100,
      },
    },
    // เพิ่ม build optimization
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["vue", "vue-router"],
            utils: ["axios", "moment", "lucide-vue-next"],
          },
        },
      },
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: false,
          drop_debugger: true,
        },
      },
      sourcemap: false,
    },
  };
});
