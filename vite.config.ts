import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { defineConfig } from "vite";
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
  return {
    // Production values are injected exclusively by scripts/build-production.mjs.
    // This prevents .env.local or .env from leaking into a production bundle.
    envDir: mode === "production" ? false : ".",
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
      {
        name: "exclude-runtime-uploads",
        closeBundle() {
          // Vite copies public/ into dist. User-generated uploads are mutable
          // runtime data and must be preserved separately, never baked into a
          // release archive.
          const generatedUploads = path.resolve(__dirname, "dist", "uploads");
          if (fs.existsSync(generatedUploads)) {
            fs.rmSync(generatedUploads, { recursive: true, force: true });
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
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            if (/node_modules[\\/](vue|vue-router)[\\/]/.test(id)) return "vendor";
            if (/node_modules[\\/](axios|moment|lucide-vue-next)[\\/]/.test(id)) {
              return "utils";
            }
            return undefined;
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
