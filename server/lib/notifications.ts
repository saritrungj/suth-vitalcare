// Persistent per-user notifications + realtime fan-out.
import { pool } from "../mysql.js";
import { getIO, EVENTS } from "./realtime.js";

interface NotifyInput {
  type?: string;
  title: string;
  message?: string | null;
  linkUrl?: string | null;
  refId?: number | null;
}

/**
 * Insert one notification row per eligible (active, non-suspended) user, then
 * broadcast a realtime event so connected clients update their bell live.
 * Best-effort: never throws into the caller.
 */
export async function notifyAllUsers(input: NotifyInput): Promise<void> {
  const {
    type = "activity_created",
    title,
    message = null,
    linkUrl = null,
    refId = null,
  } = input;
  try {
    await pool.query(
      `INSERT INTO user_notifications (user_id, type, title, message, link_url, ref_id)
       SELECT id, ?, ?, ?, ?, ? FROM users WHERE is_suspended = 0`,
      [type, title, message, linkUrl, refId],
    );
    try {
      getIO().emit(EVENTS.NOTIFICATION_CREATED, {
        type,
        title,
        message,
        link_url: linkUrl,
        ref_id: refId,
        created_at: new Date().toISOString(),
      });
    } catch {
      /* socket not ready — DB row still persisted */
    }
  } catch (err) {
    console.error("[notifications.notifyAllUsers]", err);
  }
}
