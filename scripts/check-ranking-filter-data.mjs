import "dotenv/config";
import mysql from "mysql2/promise";

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const [rows] = await connection.query(`
  SELECT
    COUNT(*) AS total,
    SUM(role_detail_1 IS NOT NULL AND TRIM(role_detail_1) <> '') AS orgs,
    SUM(role_detail_2 IS NOT NULL AND TRIM(role_detail_2) <> '') AS depts,
    SUM(role_type IS NOT NULL AND TRIM(role_type) <> '') AS role_types
  FROM users
`);

console.log(JSON.stringify(rows[0]));
await connection.end();
