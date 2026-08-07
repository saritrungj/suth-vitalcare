import dotenv from "dotenv";

/**
 * ── Environment loader ──────────────────────────────────────────────────────
 *
 * โหลด environment จากไฟล์ `.env` เพียงไฟล์เดียว ใช้เหมือนกันทั้ง dev / build /
 * production (ไม่มีการ override ด้วย `.env.local` อีกต่อไป)
 *
 * ต้อง import โมดูลนี้ก่อน import อื่น ๆ ที่อ่าน process.env ตอน import
 * (เช่น ./mysql.js ที่สร้าง connection pool ทันที) เพื่อให้ env พร้อมก่อน
 */
dotenv.config();
