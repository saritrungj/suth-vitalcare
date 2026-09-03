import express from "express";
import { pool } from "../mysql.js";
import { decrypt } from "../lib/crypto.js";
import { logAudit } from "../lib/audit.js";
import { getIO, EVENTS } from "../lib/realtime.js";
import crypto from "node:crypto";

const router = express.Router();

// Generate a random 6-character room code
const generateRoomCode = () =>
  crypto.randomBytes(6).toString("base64url").slice(0, 8).toUpperCase();

/**
 * Join/join-by-code/leave accept a `userId` in the body because admins move
 * *other* users between teams (useAdminOverview.ts, useAdminTeam.ts) — so we
 * can't just force userId = x-user-id like the create-team route. Instead,
 * require the caller to either BE that user or be an admin. Previously there
 * was no check at all: any request could move an arbitrary victim into/out of
 * any team by supplying their id in the body.
 */
// Returns null when authorized, or a { status, error } to send back otherwise.
// (Not a discriminated union — this repo doesn't set `strict` in
// tsconfig.json, and without strictNullChecks TS fails to narrow a boolean
// literal discriminant here, so a nullable return keeps this simple.)
async function authorizeActingOnUser(
  req: express.Request,
  targetUserId: unknown,
): Promise<{ status: number; error: string } | null> {
  const requesterId = req.headers["x-user-id"];
  if (!requesterId) return { status: 401, error: "Unauthorized" };
  if (String(requesterId) === String(targetUserId)) return null;

  const [rows]: any = await pool.query("SELECT role FROM users WHERE id = ?", [
    requesterId,
  ]);
  if (rows[0]?.role === "admin") return null;
  return { status: 403, error: "คุณไม่มีสิทธิ์ทำรายการนี้ให้ผู้ใช้อื่น" };
}

router.get("/ping", (req, res) => res.send("pong"));

// Get all teams (for searching)
router.get("/", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [teams]: any = await connection.query(
      "SELECT * FROM teams ORDER BY id DESC",
    );
    const [users]: any = await connection.query(
      "SELECT id, team_id, fname_th, nickname, picture_url FROM users WHERE team_id IS NOT NULL",
    );

    // Identify empty teams
    const emptyTeamIds: number[] = [];
    const validTeams = teams.filter((team: any) => {
      const teamMembers = users.filter((u: any) => u.team_id === team.id);
      if (teamMembers.length === 0) {
        emptyTeamIds.push(team.id);
        return false;
      }
      return true;
    });

    // Delete empty teams from DB
    if (emptyTeamIds.length > 0) {
      console.log(`[Cleanup] Deleting empty teams: ${emptyTeamIds.join(", ")}`);
      await connection.query("DELETE FROM teams WHERE id IN (?)", [
        emptyTeamIds,
      ]);
      await connection.commit();

      // Emit realtime events for deleted teams
      for (const id of emptyTeamIds) {
        getIO().emit(EVENTS.TEAM_DELETED, { id });
      }
    } else {
      await connection.rollback();
    }

    // Transform data to match Room type in frontend
    const transformed = validTeams.map((team: any) => {
      const teamMembers = users.filter((u: any) => u.team_id === team.id);
      return {
        id: team.id,
        code: team.code,
        name: team.name,
        maxMembers: team.max_members || 6,
        isPrivate: !!team.is_private,
        hostId: team.host_id,
        members: teamMembers.map((u: any) => ({
          id: u.id,
          fname_th: decrypt(u.fname_th) || u.fname_th,
          nickname: decrypt(u.nickname) || u.nickname,
          avatar: u.picture_url,
        })),
        autoJoinActivity: !!team.auto_join_activity,
      };
    });

    res.json(transformed);
  } catch (error: any) {
    await connection.rollback();
    console.error("Fetch teams error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    connection.release();
  }
});

// Create a new team
router.post("/", async (req, res) => {
  const { name, maxMembers, isPrivate, password, code: customCode } = req.body;
  // Host is always the creator — take it from the auth header, not the body.
  // The frontend only ever sends its own id here (CreateTeams.vue), so this
  // is a drop-in fix; trusting req.body.hostId would let anyone create a team
  // "hosted" by an arbitrary victim, silently promoting that victim to
  // role='host' and moving them into the new team.
  const hostId = req.headers["x-user-id"];
  if (!hostId) return res.status(401).json({ error: "Unauthorized" });
  let code = (customCode || "").trim().toUpperCase();

  // Only generate a random code if it's private and no code is provided
  if (isPrivate && !code) {
    code = generateRoomCode();
  } else if (!isPrivate && !code) {
    // For public teams, if no code provided, it can be null or empty
    code = null;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Check if name already exists
    const [existingName]: any = await connection.query(
      "SELECT id FROM teams WHERE name = ?",
      [name],
    );
    if (existingName.length > 0) {
      await connection.rollback();
      return res
        .status(400)
        .json({ error: "ชื่อทีมนี้ถูกใช้แล้ว กรุณาตั้งชื่อใหม่" });
    }

    const [result]: any = await connection.query(
      `INSERT INTO teams (name, max_members, is_private, host_id, code)
         VALUES (?, ?, ?, ?, ?)`,
      [name, maxMembers, isPrivate ? 1 : 0, hostId, code],
    );
    const newTeamId = result.insertId;

    // Update creator's team_id AND role to 'host' (if not admin)
    const [userRows]: any = await connection.query(
      "SELECT role FROM users WHERE id = ?",
      [hostId],
    );
    const currentRole = userRows[0]?.role || "user";
    const newRole = currentRole === "admin" ? "admin" : "host";

    await connection.query(
      "UPDATE users SET team_id = ?, role = ? WHERE id = ?",
      [newTeamId, newRole, hostId],
    );

    await connection.commit();

    // ✅ Emit realtime events
    getIO().emit(EVENTS.TEAM_CREATED, { id: newTeamId, hostId });
    getIO().emit(EVENTS.USER_UPDATED, {
      id: hostId,
      team_id: newTeamId,
      role: newRole,
    });

    res.json({ success: true, teamId: newTeamId });
  } catch (error: any) {
    await connection.rollback();
    res.status(400).json({ error: "Bad Request" });
  } finally {
    connection.release();
  }
});

// Join a team
router.post("/join", async (req, res) => {
  const { teamId, userId } = req.body;

  try {
    const auth = await authorizeActingOnUser(req, userId);
    if (auth) return res.status(auth.status).json({ error: auth.error });

    // 1. Check if team exists
    const [teamRows]: any = await pool.query(
      "SELECT * FROM teams WHERE id = ?",
      [teamId],
    );
    if (teamRows.length === 0)
      return res.status(404).json({ error: "Team not found" });
    const team = teamRows[0];

    // 2. Check if full
    const [userCountRows]: any = await pool.query(
      "SELECT COUNT(*) as count FROM users WHERE team_id = ?",
      [teamId],
    );
    const memberCount = userCountRows[0].count || 0;

    if (memberCount >= (team.max_members || 6)) {
      return res.status(400).json({ error: "Team is full" });
    }

    // 3. Update user's team_id
    await pool.query("UPDATE users SET team_id = ? WHERE id = ?", [
      teamId,
      userId,
    ]);

    // ✅ Emit realtime events
    getIO().emit(EVENTS.TEAM_JOINED, { teamId, userId });
    getIO().emit(EVENTS.USER_UPDATED, { id: userId, team_id: teamId });

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: "Bad Request" });
  }
});

// Join by code
router.post("/join-by-code", async (req, res) => {
  const { code, userId } = req.body;

  try {
    const auth = await authorizeActingOnUser(req, userId);
    if (auth) return res.status(auth.status).json({ error: auth.error });

    const [teamRows]: any = await pool.query(
      "SELECT * FROM teams WHERE code = ?",
      [code?.toUpperCase()],
    );
    if (teamRows.length === 0)
      return res.status(404).json({ error: "Team not found" });
    const team = teamRows[0];

    const [userCountRows]: any = await pool.query(
      "SELECT COUNT(*) as count FROM users WHERE team_id = ?",
      [team.id],
    );
    const memberCount = userCountRows[0].count || 0;

    if (memberCount >= (team.max_members || 6)) {
      return res.status(400).json({ error: "Team is full" });
    }

    await pool.query("UPDATE users SET team_id = ? WHERE id = ?", [
      team.id,
      userId,
    ]);

    // ✅ Emit realtime events
    getIO().emit(EVENTS.TEAM_JOINED, { teamId: team.id, userId });
    getIO().emit(EVENTS.USER_UPDATED, { id: userId, team_id: team.id });

    res.json({ success: true, teamId: team.id });
  } catch (error: any) {
    res.status(400).json({ error: "Bad Request" });
  }
});

// Leave team — ออกจากทีม
router.post("/leave", async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  const auth = await authorizeActingOnUser(req, userId);
  if (auth) return res.status(auth.status).json({ error: auth.error });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [userRows]: any = await connection.query(
      "SELECT role, team_id FROM users WHERE id = ?",
      [userId],
    );
    const user = userRows[0];
    if (!user) {
      await connection.rollback();
      return res.status(404).json({ error: "ไม่พบผู้ใช้" });
    }

    const oldTeamId = user.team_id;

    if (oldTeamId) {
      const [teamRows]: any = await connection.query(
        "SELECT host_id FROM teams WHERE id = ?",
        [oldTeamId],
      );

      if (
        teamRows.length > 0 &&
        String(teamRows[0].host_id) === String(userId)
      ) {
        await connection.query(
          "UPDATE users SET team_id = NULL, role = IF(role = 'host', 'user', role) WHERE team_id = ? AND role != 'admin'",
          [oldTeamId],
        );
        await connection.query(
          "UPDATE users SET team_id = NULL WHERE team_id = ? AND role = 'admin'",
          [oldTeamId],
        );
        await connection.query("DELETE FROM teams WHERE id = ?", [oldTeamId]);
        await logAudit({
          userId: userId as string,
          action: "dissolve_team",
          targetType: "team",
          targetId: oldTeamId,
          description: `ยุบทีม ID ${oldTeamId} เนื่องจาก Host ออกจากทีม`,
        });
      } else {
        await connection.query(
          "UPDATE users SET team_id = NULL, role = IF(role = 'host', 'user', role) WHERE id = ?",
          [userId],
        );

        // Check if team became empty (rare but possible if host is missing)
        const [memberCountRows]: any = await connection.query(
          "SELECT COUNT(*) as count FROM users WHERE team_id = ?",
          [oldTeamId],
        );
        const memberCount = memberCountRows[0].count || 0;

        if (memberCount === 0) {
          console.log(
            `[Cleanup] Deleting empty team ${oldTeamId} after member left.`,
          );
          await connection.query("DELETE FROM teams WHERE id = ?", [oldTeamId]);
          getIO().emit(EVENTS.TEAM_DELETED, { id: oldTeamId });
        }
      }
    }

    await connection.commit();

    // ✅ Emit realtime events
    if (oldTeamId) {
      getIO().emit(EVENTS.TEAM_LEFT, { teamId: oldTeamId, userId });
      getIO().emit(EVENTS.USER_UPDATED, { id: userId, team_id: null });
    }

    res.json({ success: true });
  } catch (error: any) {
    await connection.rollback();
    res.status(400).json({ error: "Bad Request" });
  } finally {
    connection.release();
  }
});

// Kick member (Host only)
router.post("/kick", async (req, res) => {
  const { hostId, userId, teamId } = req.body;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const currentUserId = req.headers["x-user-id"];
    const [userRows]: any = await connection.query(
      "SELECT role FROM users WHERE id = ?",
      [currentUserId],
    );
    const isSystemAdmin = userRows[0]?.role === "admin";

    const [teamRows]: any = await connection.query(
      "SELECT host_id FROM teams WHERE id = ?",
      [teamId],
    );

    const isTeamHost =
      teamRows.length > 0 &&
      String(teamRows[0].host_id) === String(currentUserId);

    if (!isSystemAdmin && !isTeamHost) {
      await connection.rollback();
      return res.status(403).json({ error: "ไม่มีสิทธิ์ในการคัดสมาชิกออก" });
    }

    await connection.query(
      "UPDATE users SET team_id = NULL WHERE id = ? AND team_id = ?",
      [userId, teamId],
    );

    await logAudit({
      userId: currentUserId as string,
      action: "kick_member",
      targetType: "team",
      targetId: teamId,
      description: `เตะสมาชิก ID: ${userId} ออกจากทีม ID: ${teamId}`,
    });

    // Check if team is empty after kick
    const [memberCountRows]: any = await connection.query(
      "SELECT COUNT(*) as count FROM users WHERE team_id = ?",
      [teamId],
    );
    const memberCount = memberCountRows[0].count || 0;

    if (memberCount === 0) {
      console.log(`[Cleanup] Deleting empty team ${teamId} after kick.`);
      await connection.query("DELETE FROM teams WHERE id = ?", [teamId]);
      getIO().emit(EVENTS.TEAM_DELETED, { id: teamId });
    }

    await connection.commit();

    // ✅ Emit realtime events
    getIO().emit(EVENTS.TEAM_KICKED, { teamId, userId });
    getIO().emit(EVENTS.USER_UPDATED, { id: userId, team_id: null });

    res.json({ success: true });
  } catch (error: any) {
    await connection.rollback();
    res.status(400).json({ error: "Bad Request" });
  } finally {
    connection.release();
  }
});

// Update team info
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const {
    name,
    maxMembers,
    isPrivate,
    password,
    hostId,
    code: customCode,
  } = req.body;

  const currentUserId = req.headers["x-user-id"];
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existingName]: any = await connection.query(
      "SELECT id FROM teams WHERE name = ? AND id != ?",
      [name, id],
    );
    if (existingName.length > 0) {
      await connection.rollback();
      return res
        .status(400)
        .json({ error: "ชื่อทีมนี้ถูกใช้แล้ว กรุณาตั้งชื่อใหม่" });
    }

    const [uRows]: any = await connection.query(
      "SELECT role FROM users WHERE id = ?",
      [currentUserId],
    );
    const isSystemAdmin = uRows[0]?.role === "admin";

    const [teamRows]: any = await connection.query(
      "SELECT host_id, code FROM teams WHERE id = ?",
      [id],
    );

    const isTeamHost =
      teamRows.length > 0 &&
      String(teamRows[0].host_id) === String(currentUserId);

    if (teamRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "ไม่พบทีม" });
    }

    if (!isSystemAdmin && !isTeamHost) {
      await connection.rollback();
      return res.status(403).json({ error: "ไม่มีสิทธิ์ในการแก้ไขข้อมูลทีม" });
    }

    const currentHostId = teamRows[0].host_id;
    let code = customCode ? customCode.trim().toUpperCase() : teamRows[0].code;

    if (isPrivate && !code) {
      code = generateRoomCode();
    } else if (!isPrivate && !customCode) {
      code = null;
    }

    await connection.query(
      "UPDATE teams SET name = ?, max_members = ?, is_private = ?, code = ?, host_id = ? WHERE id = ?",
      [name, maxMembers, isPrivate ? 1 : 0, code, hostId, id],
    );

    if (String(currentHostId) !== String(hostId)) {
      await connection.query(
        "UPDATE users SET role = 'user' WHERE id = ? AND role = 'host'",
        [currentHostId],
      );
      await connection.query(
        "UPDATE users SET role = 'host' WHERE id = ? AND role = 'user'",
        [hostId],
      );
    }

    await connection.commit();

    // ✅ Emit realtime events
    getIO().emit(EVENTS.TEAM_UPDATED, { id, hostId });
    if (String(currentHostId) !== String(hostId)) {
      getIO().emit(EVENTS.USER_UPDATED, { id: currentHostId, role: "user" });
      getIO().emit(EVENTS.USER_UPDATED, { id: hostId, role: "host" });
    }

    res.json({ success: true });
  } catch (error: any) {
    await connection.rollback();
    res.status(400).json({ error: "Bad Request" });
  } finally {
    connection.release();
  }
});

// Get single team details
router.get("/:id", async (req, res) => {
  try {
    const teamId = Number(req.params.id);
    const [teamRows]: any = await pool.query(
      "SELECT * FROM teams WHERE id = ?",
      [teamId],
    );
    if (teamRows.length === 0)
      return res.status(404).json({ error: "Team not found" });
    const team = teamRows[0];

    const [members]: any = await pool.query(
      "SELECT id, fname_th, nickname, picture_url FROM users WHERE team_id = ?",
      [teamId],
    );

    res.json({
      id: team.id,
      code: team.code,
      name: team.name,
      maxMembers: team.max_members || 6,
      isPrivate: !!team.is_private,
      hostId: team.host_id,
      members: members.map((u: any) => ({
        id: u.id,
        fname_th: decrypt(u.fname_th) || u.fname_th,
        nickname: decrypt(u.nickname) || u.nickname,
        avatar: u.picture_url,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete team
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const currentUserId = req.headers["x-user-id"];

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [teamRows]: any = await connection.query(
      "SELECT host_id, name FROM teams WHERE id = ?",
      [id],
    );
    if (teamRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "ไม่พบทีมที่ต้องการลบ" });
    }

    const team = teamRows[0];
    const [uRows]: any = await connection.query(
      "SELECT role FROM users WHERE id = ?",
      [currentUserId],
    );
    const isAdmin = uRows[0]?.role === "admin";
    const isHost = String(team.host_id) === String(currentUserId);

    if (!isAdmin && !isHost) {
      await connection.rollback();
      return res.status(403).json({ error: "ไม่มีสิทธิ์ในการลบทีมนี้" });
    }

    await connection.query(
      "UPDATE users SET team_id = NULL, role = IF(role = 'host', 'user', role) WHERE team_id = ? AND role != 'admin'",
      [id],
    );
    await connection.query(
      "UPDATE users SET team_id = NULL WHERE team_id = ? AND role = 'admin'",
      [id],
    );
    await connection.query("DELETE FROM teams WHERE id = ?", [id]);

    await logAudit({
      userId: currentUserId as string,
      action: "delete_team",
      targetType: "team",
      targetId: id,
      description: `ลบทีม: ${team.name} (ID: ${id})`,
    });

    await connection.commit();

    // ✅ Emit realtime event
    getIO().emit(EVENTS.TEAM_DELETED, { id });

    res.json({ success: true });
  } catch (error: any) {
    await connection.rollback();
    res.status(400).json({ error: "Bad Request" });
  } finally {
    connection.release();
  }
});

export default router;
