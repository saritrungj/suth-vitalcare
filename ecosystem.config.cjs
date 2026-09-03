const fs = require("node:fs");
const path = require("node:path");

const projectRoot = __dirname;
const logDir = path.join(projectRoot, "logs");
fs.mkdirSync(logDir, { recursive: true });

/**
 * PM2 Ecosystem Config for IIS Reverse Proxy Deployment
 *
 * IIS Setup:
 * 1. Install IIS + URL Rewrite Module + Application Request Routing (ARR)
 * 2. Enable proxy in ARR: Server > ARR Cache > Server Proxy Settings > Enable proxy
 * 3. Create IIS Site pointing to this project's dist directory
 * 4. Run: npm install && npm run build
 * 5. Run: pm2 start ecosystem.config.cjs
 * 6. Run: pm2 save && pm2 startup windows
 *
 * IIS receives :80/:443 → URL Rewrite → localhost:5001 → PM2/Node.js
 */
module.exports = {
  apps: [
    {
      name: "vitalcare",
      // Use node with tsx ESM import for faster startup than npx
      script: "server/index.ts",
      interpreter: "node",
      interpreter_args: "--import tsx",
      // Always run the same checkout as this config file. This prevents PM2
      // from silently starting a stale/missing deployment on another machine.
      cwd: projectRoot,
      instances: 1,
      exec_mode: "fork", // Windows: must use fork mode (cluster mode is unreliable)
      env_production: {
        NODE_ENV: "production",
        PORT: 5001,
      },
      // Logging
      error_file: path.join(logDir, "err.log"),
      out_file: path.join(logDir, "out.log"),
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      // Process management
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      min_uptime: "10s",
      listen_timeout: 15000,
      kill_timeout: 8000,
      max_memory_restart: "512M",
      // Ensure IIS can reach the app before marking as ready
      wait_ready: false,
    },
  ],
};
