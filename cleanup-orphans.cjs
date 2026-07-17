const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config();

async function cleanup() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME,
  });

  const [rows] = await conn.execute(
    "SELECT img_url FROM submissions WHERE img_url IS NOT NULL",
  );
  const dbUrls = new Set(rows.map((r) => r.img_url));

  const dir = path.join(__dirname, "public", "uploads", "submissions");
  if (!fs.existsSync(dir)) {
    console.log("Directory not found:", dir);
    return;
  }

  const files = fs.readdirSync(dir);
  let deletedCount = 0;

  for (const file of files) {
    if (file === ".gitkeep" || file === ".gitkeep.jpg") continue;

    const url = `/uploads/submissions/${file}`;
    if (!dbUrls.has(url)) {
      console.log("Deleting orphan:", file);
      fs.unlinkSync(path.join(dir, file));
      deletedCount++;
    }
  }

  console.log(`Cleanup complete. Deleted ${deletedCount} orphan files.`);
  await conn.end();
}
cleanup().catch(console.error);
