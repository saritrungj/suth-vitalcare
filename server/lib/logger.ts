import { pool } from "../mysql.js";
import { Request } from "express";
import { getClientIp } from "./clientIp.js";

export interface LogOptions {
  userId?: number | string;
  action: string;
  targetType?: string;
  targetId?: string | number;
  description?: string;
  metadata?: any;
}

/**
 * Masks sensitive information in a string or object.
 * @param data The data to mask
 */
export function maskSensitiveData(data: any): any {
  if (!data) return data;

  if (typeof data === "string") {
    // Mask Phone: 08x-xxx-1234
    const phoneRegex = /^(\d{2})(\d+)(\d{4})$/;
    if (phoneRegex.test(data)) {
      return data.replace(phoneRegex, "$1x-xxx-$3");
    }

    // Mask Thai ID: x-xxxx-xxxxx-xx-x
    const idRegex = /^\d{13}$/;
    if (idRegex.test(data)) {
      return (
        data.substring(0, 1) +
        "-xxxx-xxxxx-" +
        data.substring(11, 13) +
        "-" +
        data.substring(13)
      );
    }

    // Mask Email: u***@domain.com
    const emailRegex = /^(.{1})(.*)(@.*)$/;
    if (emailRegex.test(data)) {
      return data.replace(emailRegex, "$1***$3");
    }

    return data;
  }

  if (typeof data === "object") {
    const masked: any = Array.isArray(data) ? [] : {};
    for (const key in data) {
      const lowerKey = key.toLowerCase();

      // Fields to hide completely
      if (
        [
          "password",
          "token",
          "access_token",
          "refresh_token",
          "credit_card",
          "cvv",
          "card_number",
        ].some((k) => lowerKey.includes(k))
      ) {
        masked[key] = "[HIDDEN]";
        continue;
      }

      // Fields to mask
      if (["phone", "tel", "mobile"].some((k) => lowerKey.includes(k))) {
        masked[key] = maskSensitiveData(data[key]);
        continue;
      }

      if (["email"].some((k) => lowerKey.includes(k))) {
        masked[key] = maskSensitiveData(data[key]);
        continue;
      }

      if (["id_code", "citizen_id"].some((k) => lowerKey.includes(k))) {
        masked[key] = maskSensitiveData(data[key]);
        continue;
      }

      // Recursively mask nested objects
      if (typeof data[key] === "object") {
        masked[key] = maskSensitiveData(data[key]);
      } else {
        masked[key] = data[key];
      }
    }
    return masked;
  }

  return data;
}

/**
 * Logs an action to the audit_logs table.
 */
export async function logAction(req: Request | null, options: LogOptions) {
  const { userId, action, targetType, targetId, description, metadata } =
    options;

  const ipAddress = req ? getClientIp(req) || null : "SYSTEM";
  const userAgent = req ? req.headers["user-agent"] || null : "SYSTEM";

  // Mask metadata before storing
  const maskedMetadata = metadata
    ? JSON.stringify(maskSensitiveData(metadata))
    : null;
  const maskedDescription = description ? maskSensitiveData(description) : null;

  try {
    const query = `
      INSERT INTO audit_logs (user_id, action, target_type, target_id, description, metadata, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await pool.query(query, [
      userId || null,
      action,
      targetType || null,
      targetId || null,
      maskedDescription,
      maskedMetadata,
      ipAddress,
      userAgent,
    ]);
  } catch (error) {
    console.error("[LOGGER ERROR]", error);
  }
}
