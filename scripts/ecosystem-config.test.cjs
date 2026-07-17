const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const config = require("../ecosystem.config.cjs");
const app = config.apps.find((candidate) => candidate.name === "vitalcare");

assert.ok(app, "vitalcare PM2 application must be defined");
assert.equal(
  app.cwd,
  projectRoot,
  "PM2 must run the checkout containing ecosystem.config.cjs",
);
assert.equal(app.error_file, path.join(projectRoot, "logs", "err.log"));
assert.equal(app.out_file, path.join(projectRoot, "logs", "out.log"));
assert.ok(
  fs.existsSync(path.join(projectRoot, "logs")),
  "log directory must exist",
);
