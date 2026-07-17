import express from "express";
import { pool } from "../mysql.js";

/**
 * Middleware to ensure the requesting user is an Admin.
 * Verifies the role directly against the database to prevent unauthorized access
 * even if the user's local session still claims they are an admin.
 */
export async function requireAdmin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const userId = req.headers["x-user-id"];
  if (!userId || userId === "undefined") {
    return res.status(401).json({ error: "Unauthorized: No User ID provided" });
  }

  try {
    const [rows]: any = await pool.query(
      "SELECT role FROM users WHERE id = ?",
      [userId],
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: "Unauthorized: User not found" });
    }

    if (rows[0].role !== "admin") {
      return res
        .status(403)
        .json({ error: "Forbidden: Admin access required" });
    }

    next();
  } catch (error: any) {
    console.error("[Auth Middleware] requireAdmin error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

/**
 * Middleware to ensure the requesting user is an Admin OR a Host.
 * Useful for routes that both roles share (e.g. creating activities).
 */
export async function requireAdminOrHost(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const userId = req.headers["x-user-id"];
  if (!userId || userId === "undefined") {
    return res.status(401).json({ error: "Unauthorized: No User ID provided" });
  }

  try {
    const [rows]: any = await pool.query(
      "SELECT role FROM users WHERE id = ?",
      [userId],
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: "Unauthorized: User not found" });
    }

    const role = rows[0].role;
    if (role !== "admin" && role !== "host") {
      return res
        .status(403)
        .json({ error: "Forbidden: Admin or Host access required" });
    }

    next();
  } catch (error: any) {
    console.error("[Auth Middleware] requireAdminOrHost error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
