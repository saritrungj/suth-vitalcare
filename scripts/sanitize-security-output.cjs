const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function walk(dir, exts, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        ["node_modules", "dist", "playwright-report", ".git"].includes(
          entry.name,
        )
      )
        continue;
      walk(full, exts, files);
    } else if (exts.includes(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function removeConsoleCalls(content) {
  let s = content;
  const re = /console\.(error|warn|log|debug|info)\(/g;
  while (true) {
    const m = re.exec(s);
    if (!m) break;
    let i = m.index;
    let k = re.lastIndex;
    let depth = 1;
    let inStr = null;
    let esc = false;

    while (k < s.length) {
      const ch = s[k];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === inStr) inStr = null;
      } else {
        if (ch === '"' || ch === "'" || ch === "`") inStr = ch;
        else if (ch === "(") depth++;
        else if (ch === ")") {
          depth--;
          if (depth === 0) {
            k++;
            while (k < s.length && /[ \t]/.test(s[k])) k++;
            if (s[k] === ";") k++;
            break;
          }
        }
      }
      k++;
    }

    s = s.slice(0, i) + s.slice(k);
    re.lastIndex = i;
  }

  s = s.replace(/^\s*$/gm, "");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s;
}

function sanitizeServerErrors(content) {
  let s = content;

  s = s.replace(
    /status\(500\)\.json\(\{\s*error\s*:\s*(err|error)\.message\s*\}\)/g,
    'status(500).json({ error: "Internal Server Error" })',
  );
  s = s.replace(
    /status\(500\)\.json\(\{\s*error\s*:\s*(err|error)\.message\s*\|\|\s*[^}]+\}\)/g,
    'status(500).json({ error: "Internal Server Error" })',
  );
  s = s.replace(
    /status\(500\)\.send\((err|error)\.message\)/g,
    'status(500).send("Internal Server Error")',
  );

  s = s.replace(
    /status\(400\)\.json\(\{\s*error\s*:\s*(err|error)\.message\s*\}\)/g,
    'status(400).json({ error: "Bad Request" })',
  );
  s = s.replace(
    /status\(400\)\.json\(\{\s*error\s*:\s*(err|error)\.message\s*\|\|\s*[^}]+\}\)/g,
    'status(400).json({ error: "Bad Request" })',
  );

  s = s.replace(
    /\{\s*error:\s*"Internal Server Error"\s*,\s*message:\s*error\.message\s*,?\s*code:\s*error\.code\s*\}/g,
    '{ error: "Internal Server Error" }',
  );
  s = s.replace(
    /\{\s*error:\s*"Internal Server Error: Rank calculation failed"\s*,\s*message:\s*error\.message\s*\}/g,
    '{ error: "Internal Server Error" }',
  );
  s = s.replace(
    /\{\s*error:\s*"Internal Server Error: Team rank calculation failed"\s*,\s*message:\s*error\.message\s*,\s*sqlState:\s*error\.sqlState\s*\}/g,
    '{ error: "Internal Server Error" }',
  );

  return s;
}

let changed = [];

const srcFiles = walk(path.join(root, "src"), [".ts", ".vue", ".js", ".tsx"]);
for (const file of srcFiles) {
  const old = fs.readFileSync(file, "utf8");
  const next = removeConsoleCalls(old);
  if (old !== next) {
    fs.writeFileSync(file, next, "utf8");
    changed.push(path.relative(root, file));
  }
}

const serverFiles = walk(path.join(root, "server"), [".ts", ".js"]);
for (const file of serverFiles) {
  const old = fs.readFileSync(file, "utf8");
  const next = sanitizeServerErrors(old);
  if (old !== next) {
    fs.writeFileSync(file, next, "utf8");
    changed.push(path.relative(root, file));
  }
}

console.log(changed.join("\n"));
