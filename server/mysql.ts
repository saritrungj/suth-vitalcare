import mysql from "mysql2/promise";
// โหลด env ตาม runtime (.env.local หรือ .env.production) ก่อนสร้าง pool
import "./loadEnv.js";

// Create a connection pool instead of a single connection for better performance and concurrency
export const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "banana",
  waitForConnections: true,
  connectionLimit: 20, // ลดจาก 300 → 20 (เหมาะกับ MySQL 5.7 ทั่วไป)
  queueLimit: 50,
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS) || 30000,
  dateStrings: true,
});
