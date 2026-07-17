import express from "express";
import { pool } from "../mysql.js";
import {
  decryptFields,
  TANITA_ENCRYPTED_FIELDS,
  USER_ENCRYPTED_FIELDS,
} from "../lib/crypto.js";
import { logAudit } from "../lib/audit.js";
import ExcelJS from "exceljs";

const router = express.Router();

// ─── Auth Middleware ───────────────────────────────────────────────────────────
async function checkManageAccess(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const userId = req.headers["x-user-id"];
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const [rows]: any = await pool.query(
      "SELECT role FROM users WHERE id = ?",
      [userId],
    );
    if (rows.length === 0 || !["admin", "host"].includes(rows[0].role))
      return res.status(403).json({ error: "Forbidden" });
    next();
  } catch (error: any) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TANITA_METADATA = [
  { key: "weight", label: "น้ำหนัก (kg)", direction: "down" },
  { key: "height", label: "ส่วนสูง (cm)", direction: "none" },
  { key: "waist_cm", label: "รอบเอว (cm)", direction: "down" },
  { key: "bmi", label: "BMI", direction: "down" },
  { key: "fat_pc", label: "% Fat", direction: "down" },
  { key: "visceral_fat", label: "VF", direction: "down" },
  { key: "muscle_mass", label: "กล้ามเนื้อ (kg)", direction: "up" },
  { key: "fat_mass", label: "มวลไขมัน (kg)", direction: "down" },
  { key: "tbw_mass", label: "น้ำในตัว (kg)", direction: "up" },
  { key: "tbw_pc", label: "% น้ำ", direction: "up" },
  { key: "bone_mass", label: "กระดูก (kg)", direction: "up" },
  { key: "bmr_kcal", label: "BMR (kcal)", direction: "up" },
  { key: "metabolic_age", label: "อายุกาย (ปี)", direction: "down" },
  { key: "ideal_weight", label: "น.น. มาตรฐาน (kg)", direction: "none" },
  { key: "obesity_degree", label: "ความอ้วน (%)", direction: "down" },
];

const TASK_COLORS = [
  { bg: "FFE0E7FF", text: "FF4338CA" },
  { bg: "FFFEE2E2", text: "FFB91C1C" },
  { bg: "FFFEF3C7", text: "FFB45309" },
  { bg: "FFECFDF5", text: "FF047857" },
  { bg: "FFF3E8FF", text: "FF7E22CE" },
  { bg: "FFE0F2FE", text: "FF0369A1" },
];

const COLORS = {
  headerBg: "FFF1F5F9",
  greenSummary: "FFECFDF5",
  redSummary: "FFFFF1F2",
  indigoSummary: "FFEEF2FF",
  border: "FFCBD5E1",
  checkMark: "FF059669",
  xMark: "FFE11D48",
};

const MONTH_NAMES = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ensureDate = (val: any): Date | null => {
  if (!val) return null;
  if (val instanceof Date) return val;
  return new Date(val);
};

const toYMD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** Convert column index (1-based) to Excel letters (A, B, C...) */
const colName = (n: number) => {
  let res = "";
  while (n > 0) {
    let m = (n - 1) % 26;
    res = String.fromCharCode(65 + m) + res;
    n = Math.floor((n - m) / 26);
  }
  return res;
};

/** Build O(1) lookup key: userId|taskId|dateStr */
const submissionKey = (userId: any, taskId: any, dateStr: string) =>
  `${userId}|${taskId}|${dateStr}`;

/** Convert Team ID or Hex/CSS color to ARGB for ExcelJS */
const toARGB = (val: string | number | null) => {
  if (val === null || val === undefined) return null;

  if (typeof val === "number") {
    const colors = [
      "FFDBEAFE", // Blue 100
      "FFF3E8FF", // Purple 100
      "FFFEF3C7", // Amber 100
      "FFFFEDD5", // Orange 100
      "FFFEE2E2", // Red 100
      "FFDCFCE7", // Green 100
      "FFCFFAFE", // Cyan 100
      "FFFCE7F3", // Pink 100
    ];
    return colors[val % colors.length];
  }

  const color = String(val);
  if (color.startsWith("#")) {
    let hex = color.substring(1);
    if (hex.length === 3)
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    return "FF" + hex.toUpperCase();
  }
  const names: Record<string, string> = {
    red: "FFFF0000",
    blue: "FF0000FF",
    green: "FF008000",
    yellow: "FFFFFF00",
    orange: "FFFFA500",
    purple: "FF800080",
    pink: "FFFFC0CB",
    gray: "FF808080",
  };
  return names[color.toLowerCase()] || null;
};

// ─── Route ────────────────────────────────────────────────────────────────────
router.get(
  "/activities/:id/monthly-report",
  checkManageAccess,
  async (req, res) => {
    const { id } = req.params;

    try {
      // 1. Event Info
      const [eventRows]: any = await pool.query(
        "SELECT * FROM events WHERE id = ?",
        [id],
      );
      if (eventRows.length === 0)
        return res.status(404).json({ error: "Event not found" });
      const event = eventRows[0];

      const reqStartDate = req.query.start_date
        ? new Date(String(req.query.start_date))
        : null;
      const reqEndDate = req.query.end_date
        ? new Date(String(req.query.end_date))
        : null;

      const eventStart =
        ensureDate(event.start_date) ||
        ensureDate(event.created_at) ||
        new Date();
      let startDT = reqStartDate || eventStart;
      if (startDT < eventStart) startDT = eventStart;

      const startYMD = toYMD(startDT);
      const endDT = reqEndDate || ensureDate(event.end_date) || new Date();
      const endYMD = toYMD(endDT);
      const todayStr = toYMD(new Date());

      // 2. Participants → Map<userId, info>
      const [participantRows]: any = await pool.query(
        `
      SELECT r.id as reg_id, u.id as user_id, u.fname_th, u.lname_th, u.id_code, u.gender,
             TIMESTAMPDIFF(YEAR, u.birth_date, CURDATE()) as age,
             t.name as team_name, t.id as team_id,
             r.created_at as joined_at
      FROM registrations r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN teams t ON u.team_id = t.id
      WHERE r.event_id = ?
      ORDER BY r.id ASC
    `,
        [id],
      );

      const usersMap = new Map<number, any>();
      for (const raw of participantRows) {
        const p = decryptFields(raw, USER_ENCRYPTED_FIELDS);
        usersMap.set(p.user_id, {
          userId: p.user_id,
          idCode: p.id_code || "",
          name: `${p.fname_th || ""} ${p.lname_th || ""}`.trim(),
          team: p.team_name || "ไม่มีทีม",
          teamId: p.team_id || 99999,
          gender: p.gender || "",
          age: p.age && p.age < 150 ? p.age : "-",
        });
      }

      const sortedUsers = Array.from(usersMap.values()).sort(
        (a, b) => a.teamId - b.teamId,
      );

      // 3. Tasks
      const [tasks]: any = await pool.query(
        "SELECT id, type, note as title, points, allowed_days, task_date FROM tasks WHERE event_id = ? ORDER BY id ASC",
        [id],
      );

      // 4. Submissions → Set of "userId|taskId|dateStr" for O(1) lookup
      const [submissionRows]: any = await pool.query(
        `
      SELECT s.user_id, s.task_id, s.created_at
      FROM submissions s
      JOIN tasks t ON s.task_id = t.id
      WHERE t.event_id = ? AND s.status = 'approved'
    `,
        [id],
      );

      const submissionSet = new Set<string>();
      // userTaskUniqueDays: Map<userId, Map<taskId, Set<dateStr>>>
      const userTaskUniqueDays = new Map<number, Map<number, Set<string>>>();

      for (const s of submissionRows) {
        const dt = ensureDate(s.created_at);
        if (dt) {
          const dStr = toYMD(dt);
          submissionSet.add(submissionKey(s.user_id, s.task_id, dStr));

          if (!userTaskUniqueDays.has(s.user_id))
            userTaskUniqueDays.set(s.user_id, new Map());
          const taskMap = userTaskUniqueDays.get(s.user_id)!;
          if (!taskMap.has(s.task_id)) taskMap.set(s.task_id, new Set());
          taskMap.get(s.task_id)!.add(dStr);
        }
      }
      // Free original array immediately
      submissionRows.length = 0;

      // 5. Tanita → Map<userId, sorted[]>
      // Fix: Match dashboard logic (inclusive history for registered users)
      const [tanitaRaw]: any = await pool.query(
        `
      SELECT * FROM tanita
      WHERE user_id IN (SELECT user_id FROM registrations WHERE event_id = ?)
      ORDER BY recorded_at ASC
    `,
        [id],
      );

      const tanitaByUser = new Map<number, any[]>();
      for (const raw of tanitaRaw) {
        const t = decryptFields(raw, [...TANITA_ENCRYPTED_FIELDS, "waist_cm"]);
        t._recordedAt = ensureDate(t.recorded_at);
        if (!tanitaByUser.has(t.user_id)) tanitaByUser.set(t.user_id, []);
        tanitaByUser.get(t.user_id)!.push(t);
      }
      tanitaRaw.length = 0;

      // ─── Build month list ────────────────────────────────────────────────────
      // Fix: Show until the official end date of the activity, even if it's in the future
      const effectiveEnd = endYMD;
      const monthsKeys: Array<{ year: number; month: number }> = [];
      let cur = new Date(startDT.getFullYear(), startDT.getMonth(), 1);
      const lastMonth = new Date(
        new Date(endYMD).getFullYear(),
        new Date(endYMD).getMonth(),
        1,
      );
      while (cur <= lastMonth) {
        monthsKeys.push({ year: cur.getFullYear(), month: cur.getMonth() });
        cur.setMonth(cur.getMonth() + 1);
      }

      // ─── Helper: columns for a month ────────────────────────────────────────
      const getMonthColumns = (year: number, month: number) => {
        const cols: Array<{ date: Date; dStr: string; task: any }> = [];
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
          const d = new Date(year, month, i);
          const dStr = toYMD(d);
          if (dStr < startYMD || dStr > effectiveEnd) continue;
          const dow = d.getDay();
          for (const task of tasks) {
            const tDate = ensureDate(task.task_date);
            if (tDate) {
              if (toYMD(tDate) === dStr) cols.push({ date: d, dStr, task });
            } else {
              let allowed = task.allowed_days;
              if (typeof allowed === "string")
                try {
                  allowed = JSON.parse(allowed);
                } catch {
                  allowed = null;
                }
              if (
                Array.isArray(allowed) &&
                allowed.some((day: any) => Number(day) === dow)
              )
                cols.push({ date: d, dStr, task });
            }
          }
        }
        return cols;
      };

      // ─── Stream workbook to response ─────────────────────────────────────────
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="Tracking_Report_${id}.xlsx"`,
      );

      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
        stream: res,
        useStyles: true,
        useSharedStrings: false,
      });

      // ─── Monthly Tracking Sheets ─────────────────────────────────────────────
      const taskMonthlySummaryCols = new Map<
        number,
        Array<{ sheetName: string; colLetter: string }>
      >();
      const monthTotalOkCols: Array<{ sheetName: string; colLetter: string }> =
        [];
      let grandTotalPossibleSubmissions = 0;

      for (const { year, month } of monthsKeys) {
        const monthColumns = getMonthColumns(year, month);
        if (monthColumns.length === 0) continue;
        grandTotalPossibleSubmissions += monthColumns.length;

        const taskGroups: Array<{
          id: any;
          task: any;
          cols: typeof monthColumns;
        }> = [];
        const seenTaskIds = new Set<any>();
        for (const c of monthColumns) {
          if (!seenTaskIds.has(c.task.id)) {
            seenTaskIds.add(c.task.id);
            taskGroups.push({ id: c.task.id, task: c.task, cols: [] });
          }
          taskGroups.find((g) => g.id === c.task.id)!.cols.push(c);
        }

        const totalWidth = 4 + monthColumns.length + taskGroups.length + 3;

        const sheetName = `${MONTH_NAMES[month]} ${year + 543}`.substring(
          0,
          31,
        );
        const sheet = workbook.addWorksheet(sheetName, {
          views: [{ state: "frozen", xSplit: 4, ySplit: 3 }],
          properties: {
            outlineProperties: { summaryBelow: false, summaryRight: true },
          },
        });

        // Track columns for Score Summary & Participation Summary
        let currentTrackCol = 5;
        taskGroups.forEach((g) => {
          const sumTaskColLetter = colName(currentTrackCol + g.cols.length);
          if (!taskMonthlySummaryCols.has(g.id))
            taskMonthlySummaryCols.set(g.id, []);
          taskMonthlySummaryCols
            .get(g.id)!
            .push({ sheetName, colLetter: sumTaskColLetter });
          currentTrackCol += g.cols.length + 1;
        });
        monthTotalOkCols.push({
          sheetName,
          colLetter: colName(currentTrackCol),
        });

        // Pre-set column widths for streaming
        sheet.columns = Array.from({ length: totalWidth }, (_, i) => ({
          width: i < 4 ? [8, 15, 20, 25][i] : 12,
        }));

        // Row 1 — Title
        const titleRow = sheet.addRow([
          `โครงการ: ${event.title} (${MONTH_NAMES[month]} ${year + 543})`,
        ]);
        (titleRow as any).font = { bold: true, size: 14 };
        (titleRow as any).height = 35;
        sheet.mergeCells(1, 1, 1, totalWidth);
        sheet.getCell(1, 1).alignment = {
          horizontal: "center",
          vertical: "middle",
        };

        // Rows 2-3 — Headers
        const hTaskNames: any[] = ["", "", "", ""];
        const hDates: any[] = ["ลำดับ", "รหัสพนักงาน", "ชื่อทีม", "ชื่อผู้ใช้"];

        taskGroups.forEach((g) => {
          g.cols.forEach((c) => {
            hTaskNames.push(g.task.title || g.task.type);
            hDates.push(`วันที่ ${c.date.getDate()}`);
          });
          hTaskNames.push(g.task.title || g.task.type);
          hDates.push("สรุป");
        });
        hTaskNames.push("สรุปความสำเร็จรวม", "", "");
        hDates.push("☑ ส่งแล้ว", "☐ ขาดส่ง", "🎯 สำเร็จ (%)");

        const row2 = sheet.addRow(hTaskNames);
        (row2 as any).height = 28;
        const row3 = sheet.addRow(hDates);
        (row3 as any).height = 28;

        const hStyle = {
          font: { bold: true, size: 10 },
          fill: {
            type: "pattern" as const,
            pattern: "solid" as const,
            fgColor: { argb: COLORS.headerBg },
          },
          border: {
            top: { style: "thin" as const },
            left: { style: "thin" as const },
            bottom: { style: "thin" as const },
            right: { style: "thin" as const },
          },
          alignment: {
            horizontal: "center" as const,
            vertical: "middle" as const,
            wrapText: true,
          },
        };

        for (let i = 1; i <= 4; i++) {
          sheet.mergeCells(2, i, 3, i);
          Object.assign(sheet.getCell(2, i), hStyle);
          sheet.getCell(2, i).value = hDates[i - 1];
        }

        let col = 5;
        taskGroups.forEach((g, tIdx) => {
          const color = TASK_COLORS[tIdx % TASK_COLORS.length];
          g.cols.forEach(() => {
            [2, 3].forEach((r) => {
              Object.assign(sheet.getCell(r, col), hStyle);
              sheet.getCell(r, col).fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: color.bg },
              };
            });
            sheet.getColumn(col).outlineLevel = 1;
            col++;
          });
          [2, 3].forEach((r) => {
            Object.assign(sheet.getCell(r, col), hStyle);
          });
          sheet.getCell(2, col).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: color.bg },
          };
          sheet.getCell(3, col).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF1F5F9" },
          };
          col++;
        });

        const sumColStart = col;
        sheet.mergeCells(2, sumColStart, 2, sumColStart + 2);
        Object.assign(sheet.getCell(2, sumColStart), hStyle);
        ["FFECFDF5", "FFFFF1F2", "FFEEF2FF"].forEach((bg, i) => {
          Object.assign(sheet.getCell(3, sumColStart + i), hStyle);
          sheet.getCell(3, sumColStart + i).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: bg },
          };
        });

        // Data rows
        let seq = 1;
        for (const u of sortedUsers) {
          const rowData: any[] = [seq++, u.idCode, u.team, u.name];

          let totalOkCount = 0;
          let totalItems = 0;

          taskGroups.forEach((g) => {
            let taskOkCount = 0;
            g.cols.forEach((c) => {
              const ok = submissionSet.has(
                submissionKey(u.userId, c.task.id, c.dStr),
              );
              rowData.push(ok ? "☑" : "☐");
              if (ok) taskOkCount++;
              totalItems++;
            });
            totalOkCount += taskOkCount;

            // Add Task Summary Formula with initial result
            const rIdx = seq + 2; // Row 1: Title, 2: Task, 3: Date -> User 1 is Row 4
            const startTaskCol = rowData.length - g.cols.length + 1;
            const endTaskCol = rowData.length;
            rowData.push({
              formula: `COUNTIF(${colName(startTaskCol)}${rIdx}:${colName(endTaskCol)}${rIdx}, "☑")`,
              result: taskOkCount,
            });
          });

          // Overall Summary Formulas
          const rIdx = seq + 2;
          const totalPossible = totalItems;
          const totalMissed = totalPossible - totalOkCount;
          const percent =
            totalPossible > 0
              ? Math.round((totalOkCount / totalPossible) * 100)
              : 0;

          // Total OK
          rowData.push({
            formula: `COUNTIF(${colName(5)}${rIdx}:${colName(sumColStart - 1)}${rIdx}, "☑")`,
            result: totalOkCount,
          });
          // Total Missed
          rowData.push({
            formula: `COUNTIF(${colName(5)}${rIdx}:${colName(sumColStart - 1)}${rIdx}, "☐")`,
            result: totalMissed,
          });
          // Total %
          rowData.push({
            formula: `IFERROR(ROUND(${colName(sumColStart)}${rIdx}/(${colName(sumColStart)}${rIdx}+${colName(sumColStart + 1)}${rIdx})*100, 0) & "%", "0%")`,
            result: `${percent}%`,
          });

          const dataRow = sheet.addRow(rowData);
          (dataRow as any).height = 25;

          // Cell styles
          (dataRow as any).eachCell((cell: any, colNum: number) => {
            cell.border = {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
            };

            if (colNum === 3 && u.teamId) {
              const argb = toARGB(u.teamId);
              if (argb)
                cell.fill = {
                  type: "pattern",
                  pattern: "solid",
                  fgColor: { argb },
                };
            }

            if (colNum >= 5 && colNum < sumColStart) {
              cell.alignment = { horizontal: "center", vertical: "middle" };
              cell.font = { size: 12, bold: true };

              const isSum = hDates[colNum - 1] === "สรุป";
              if (isSum) {
                cell.fill = {
                  type: "pattern",
                  pattern: "solid",
                  fgColor: { argb: "FFF1F5F9" },
                };
              } else {
                let cIdx = 5,
                  foundBg = "FFFFFFFF";
                taskGroups.forEach((g, ti) => {
                  if (colNum >= cIdx && colNum < cIdx + g.cols.length)
                    foundBg = TASK_COLORS[ti % TASK_COLORS.length].bg;
                  cIdx += g.cols.length + 1;
                });
                cell.fill = {
                  type: "pattern",
                  pattern: "solid",
                  fgColor: { argb: foundBg },
                };
                cell.dataValidation = {
                  type: "list",
                  allowBlank: true,
                  formulae: ['"☑,☐"'],
                };
              }
            }
            if (colNum >= sumColStart) {
              cell.font = { bold: true };
              cell.alignment = { horizontal: "center", vertical: "middle" };
            }
          });

          await (dataRow as any).commit();
        }

        await (sheet as any).commit();
      }

      // ─── Health Changes Sheet ─────────────────────────────────────────────────
      const healthSheet = workbook.addWorksheet("การเปลี่ยนแปลงร่างกาย", {
        views: [{ state: "frozen", ySplit: 2 }],
      });

      let selectedFields = [
        "weight",
        "waist_cm",
        "bmi",
        "fat_pc",
        "visceral_fat",
      ];
      let scoreConfig: Record<string, number> = {
        weight: 0,
        waist_cm: 500,
        bmi: 500,
        fat_pc: 500,
        visceral_fat: 500,
      };
      let comparisonOps: Record<string, string> = {};

      if (event.health_config) {
        try {
          const hcfg =
            typeof event.health_config === "string"
              ? JSON.parse(event.health_config)
              : event.health_config;
          if (hcfg.selectedTanitaFields)
            selectedFields = hcfg.selectedTanitaFields.filter(
              (f: string) => f !== "height",
            );
          if (hcfg.tanitaScoreConfig) scoreConfig = hcfg.tanitaScoreConfig;
          if (hcfg.tanitaComparisonOps)
            comparisonOps = hcfg.tanitaComparisonOps;
        } catch {}
      }

      const fixedN = 5;
      const dynN = selectedFields.length;

      healthSheet.columns = Array.from(
        { length: fixedN + dynN * 4 + 2 },
        (_, i) => ({
          width:
            i === 0
              ? 8
              : i === 1
                ? 15
                : i === 2
                  ? 20
                  : i === fixedN + dynN * 4 + 1
                    ? 25
                    : 12,
        }),
      );

      const hr1Data = ["ลำดับ", "รหัสพนักงาน", "ชื่อทีม", "อายุ (ปี)", "เพศ"];
      selectedFields.forEach(() => hr1Data.push("มวลร่างกาย (ก่อน)"));
      selectedFields.forEach(() => hr1Data.push("มวลร่างกาย (หลัง)"));
      selectedFields.forEach(() => hr1Data.push("เปลี่ยนแปลง"));
      selectedFields.forEach(() => hr1Data.push("คะแนนที่ได้"));
      hr1Data.push("คะแนนรวม", "วิเคราะห์ผล (Insight)");

      const hr2Data = ["", "", "", "", ""];
      for (let rep = 0; rep < 4; rep++) {
        selectedFields.forEach((f) => {
          const meta = TANITA_METADATA.find((m) => m.key === f);
          hr2Data.push(meta ? meta.label : f);
        });
      }
      hr2Data.push("", "");

      const hr1 = healthSheet.addRow(hr1Data);
      (hr1 as any).font = { bold: true };
      (hr1 as any).height = 25;
      const hr2 = healthSheet.addRow(hr2Data);
      (hr2 as any).font = { bold: true };
      (hr2 as any).height = 25;

      // Merges
      healthSheet.mergeCells(1, 1, 2, 1);
      healthSheet.mergeCells(1, 2, 2, 2);
      healthSheet.mergeCells(1, 3, 2, 3);
      healthSheet.mergeCells(1, 4, 2, 4);
      healthSheet.mergeCells(1, 5, 2, 5);
      healthSheet.mergeCells(1, fixedN + 1, 1, fixedN + dynN);
      healthSheet.mergeCells(1, fixedN + dynN + 1, 1, fixedN + dynN * 2);
      healthSheet.mergeCells(1, fixedN + dynN * 2 + 1, 1, fixedN + dynN * 3);
      healthSheet.mergeCells(1, fixedN + dynN * 3 + 1, 1, fixedN + dynN * 4);
      healthSheet.mergeCells(
        1,
        fixedN + dynN * 4 + 1,
        2,
        fixedN + dynN * 4 + 1,
      );
      healthSheet.mergeCells(
        1,
        fixedN + dynN * 4 + 2,
        2,
        fixedN + dynN * 4 + 2,
      );

      const applyHStyle = (start: number, end: number, argb: string) => {
        for (let i = start; i <= end; i++) {
          [hr1, hr2].forEach((row: any) => {
            const c = row.getCell(i);
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
            c.alignment = { vertical: "middle", horizontal: "center" };
            c.border = {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
            };
          });
        }
      };
      applyHStyle(1, fixedN, "FFF1F5F9");
      applyHStyle(fixedN + 1, fixedN + dynN, "FFECFDF5");
      applyHStyle(fixedN + dynN + 1, fixedN + dynN * 2, "FFFFFBEB");
      applyHStyle(fixedN + dynN * 2 + 1, fixedN + dynN * 3, "FFDBEAFE");
      applyHStyle(fixedN + dynN * 3 + 1, fixedN + dynN * 4, "FFECFEFF");
      applyHStyle(fixedN + dynN * 4 + 1, fixedN + dynN * 4 + 2, "FFF1F5F9");

      const getColLetter = (col: number) => {
        let l = "";
        while (col > 0) {
          const mod = (col - 1) % 26;
          l = String.fromCharCode(65 + mod) + l;
          col = Math.floor((col - mod) / 26);
        }
        return l;
      };

      let hSeq = 1;
      for (const u of sortedUsers) {
        const uTanitas = tanitaByUser.get(u.userId) || [];
        // Pick first and last correctly (Match Dashboard logic)
        const first = uTanitas.length > 0 ? uTanitas[0] : null;
        const last = uTanitas.length > 1 ? uTanitas[uTanitas.length - 1] : null;
        const rowNum = hSeq + 2;

        const getNum = (val: any) => {
          if (val == null || val === "") return "";
          const n = parseFloat(val);
          return isNaN(n) ? "" : n;
        };

        const rowValues: any[] = [hSeq++, u.idCode, u.team, u.age, u.gender];
        selectedFields.forEach((f) =>
          rowValues.push(first ? getNum(first[f]) : ""),
        );
        selectedFields.forEach((f) =>
          rowValues.push(last ? getNum(last[f]) : ""),
        );

        selectedFields.forEach((f, i) => {
          const c1 = getColLetter(fixedN + 1 + i);
          const c2 = getColLetter(fixedN + dynN + 1 + i);
          rowValues.push({
            formula: `IF(COUNT(${c1}${rowNum},${c2}${rowNum})=2, ${c2}${rowNum}-${c1}${rowNum}, "")`,
          });
        });

        const ptsCols: string[] = [];
        selectedFields.forEach((f, i) => {
          const c1 = getColLetter(fixedN + 1 + i);
          const c2 = getColLetter(fixedN + dynN + 1 + i);
          const op =
            comparisonOps[f] ||
            TANITA_METADATA.find((m) => m.key === f)?.direction;
          const pts = scoreConfig[f] || 0;

          let condition = "FALSE";
          if (op === "down") condition = `${c2}${rowNum}<${c1}${rowNum}`;
          else if (op === "up") condition = `${c2}${rowNum}>${c1}${rowNum}`;
          else if (op === "lte") condition = `${c2}${rowNum}<=${c1}${rowNum}`;
          else if (op === "gte") condition = `${c2}${rowNum}>=${c1}${rowNum}`;
          else condition = "TRUE";

          rowValues.push({
            formula: `IF(COUNT(${c1}${rowNum},${c2}${rowNum})=2, IF(${condition}, ${pts}, 0), "")`,
          });
          ptsCols.push(`${getColLetter(fixedN + dynN * 3 + 1 + i)}${rowNum}`);
        });

        if (ptsCols.length > 0) {
          rowValues.push({ formula: `SUM(${ptsCols.join(",")})` });
        } else {
          rowValues.push(0);
        }

        let insight = "-";
        if (first && last) {
          const fd =
            parseFloat(last.fat_pc || 0) - parseFloat(first.fat_pc || 0);
          const md =
            parseFloat(last.muscle_mass || 0) -
            parseFloat(first.muscle_mass || 0);
          if (fd <= 0 && md > 0) insight = "🔥 Lean & Build";
          else if (fd < 0) insight = "✨ Fat Loss";
          else if (md > 0) insight = "💪 Muscle Gain";
          else insight = "🏃 Maintained";
        }
        rowValues.push(insight);

        const dataRow = healthSheet.addRow(rowValues);
        (dataRow as any).eachCell((c: any, colNum: number) => {
          c.alignment = { vertical: "middle", horizontal: "center" };
          c.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };

          if (colNum > fixedN + dynN * 2 && colNum <= fixedN + dynN * 3) {
            c.numFmt = "+0.##;-0.##;0;@";
          }

          // Team Color for column 3
          if (colNum === 3 && u.teamId) {
            const argb = toARGB(u.teamId);
            if (argb)
              c.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
          }
        });
        await (dataRow as any).commit();
      }

      await (healthSheet as any).commit();

      // ─── Score Summary Sheet ────────────────────────────────────────────────
      const scoreSheet = workbook.addWorksheet("สรุปคะแนน", {
        views: [{ state: "frozen", ySplit: 1 }],
      });

      // Calculate Total Possible Points for each task
      const taskTotalPossible = new Map<number, number>();
      let grandTotalPossible = 0;
      for (const t of tasks) {
        let count = 0;
        let curD = new Date(startDT);
        const limitD = endDT || new Date();
        while (curD <= limitD) {
          const dStr = toYMD(curD);
          const dow = curD.getDay();
          const tDate = ensureDate(t.task_date);

          if (tDate) {
            if (toYMD(tDate) === dStr) count++;
          } else {
            let allowed = t.allowed_days;
            if (typeof allowed === "string")
              try {
                allowed = JSON.parse(allowed);
              } catch {
                allowed = null;
              }
            if (
              Array.isArray(allowed) &&
              allowed.some((day: any) => Number(day) === dow)
            )
              count++;
          }
          curD.setDate(curD.getDate() + 1);
        }
        const pts = count * (t.points || 0);
        taskTotalPossible.set(t.id, pts);
        grandTotalPossible += pts;
      }

      const sFixedN = 4;
      const sTasksN = tasks.length;
      scoreSheet.columns = Array.from(
        { length: sFixedN + sTasksN + 3 },
        (_, i) => ({
          width: i < 4 ? [8, 15, 20, 25][i] : i >= sFixedN + sTasksN ? 25 : 22,
        }),
      );

      const sh1Data = ["ลำดับ", "รหัสพนักงาน", "ชื่อทีม", "ชื่อผู้ใช้"];
      tasks.forEach((t: any) => {
        const total = taskTotalPossible.get(t.id) || 0;
        sh1Data.push(
          `${t.title || t.type} (${t.points} แต้ม/ครั้ง)\nTotal ${total} แต้ม`,
        );
      });
      sh1Data.push(`คะแนนรวมกิจกรรม\n(เต็ม ${grandTotalPossible} แต้ม)`);
      sh1Data.push(`คะแนนการเปลี่ยนแปลงร่างกาย`);
      sh1Data.push(`คะแนนรวมทั้งหมด`);

      const sh1 = scoreSheet.addRow(sh1Data);
      (sh1 as any).height = 45;
      (sh1 as any).eachCell((c: any, i: number) => {
        c.font = { bold: true, size: 11 };
        c.alignment = {
          vertical: "middle",
          horizontal: "center",
          wrapText: true,
        };
        c.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
        if (i <= sFixedN)
          c.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF1F5F9" },
          };
        else if (i <= sFixedN + sTasksN)
          c.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF00FF00" },
          };
        else if (i === sFixedN + sTasksN + 1)
          c.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFD1FAE5" },
          };
        else if (i === sFixedN + sTasksN + 2)
          c.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFDBEAFE" },
          };
        else
          c.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFEDD5" },
          };
      });

      let sSeq = 1;
      for (const u of sortedUsers) {
        const taskMap = userTaskUniqueDays.get(u.userId) || new Map();
        const rowData: any[] = [sSeq++, u.idCode, u.team, u.name];

        let grandInitialTotal = 0;
        tasks.forEach((t: any) => {
          const sources = taskMonthlySummaryCols.get(t.id) || [];
          const uniqueDaysSet = taskMap.get(t.id);
          const count = uniqueDaysSet ? uniqueDaysSet.size : 0;
          const initialPts = count * (t.points || 0);
          grandInitialTotal += initialPts;

          // Current Score Sheet Row index (1-indexed)
          const scoreRow = sSeq; // sSeq is already incremented above (e.g. 2 for first user)
          const targetMonthlyRow = scoreRow + 2; // Row 2 in Score maps to Row 4 in Monthly

          if (sources.length > 0) {
            const sumFormula = sources
              .map((s) => `'${s.sheetName}'!${s.colLetter}${targetMonthlyRow}`)
              .join("+");
            rowData.push({
              formula: `(${sumFormula})*${t.points || 0}`,
              result: initialPts,
            });
          } else {
            rowData.push(0);
          }
        });

        const startCol = colName(sFixedN + 1);
        const endCol = colName(sFixedN + sTasksN);
        rowData.push({
          formula: `SUM(${startCol}${sSeq}:${endCol}${sSeq})`,
          result: grandInitialTotal,
        });

        const healthRow = sSeq + 1;
        const healthTotalColIdx = fixedN + dynN * 4 + 1;
        const healthTotalColStr = colName(healthTotalColIdx);
        rowData.push({
          formula: `IFERROR('การเปลี่ยนแปลงร่างกาย'!${healthTotalColStr}${healthRow}, 0)`,
        });

        const activityTotalCol = colName(sFixedN + sTasksN + 1);
        const healthScoreCol = colName(sFixedN + sTasksN + 2);
        rowData.push({
          formula: `SUM(${activityTotalCol}${sSeq}, ${healthScoreCol}${sSeq})`,
        });

        const sRow = scoreSheet.addRow(rowData);
        (sRow as any).height = 25;
        (sRow as any).eachCell((c: any, colNum: number) => {
          c.alignment = { vertical: "middle", horizontal: "center" };
          c.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
          if (colNum === 3 && u.teamId) {
            const argb = toARGB(u.teamId);
            if (argb)
              c.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
          }
          if (colNum > sFixedN + sTasksN) c.font = { bold: true };
        });
        await (sRow as any).commit();
      }

      await (scoreSheet as any).commit();

      // ─── Participation Summary Sheet ─────────────────────────────────────────
      const partSheet = workbook.addWorksheet("สรุปการมีส่วนร่วม", {
        views: [{ state: "frozen", xSplit: 4, ySplit: 1 }],
      });

      // Pre-calculate and sort users by participation
      const userParticipation = sortedUsers.map((u) => {
        let mCounts: number[] = [];
        let totalOk = 0;
        monthTotalOkCols.forEach((m) => {
          let mCount = 0;
          const [mName, mYearBE] = m.sheetName.split(" ");
          const monthIdx = MONTH_NAMES.indexOf(mName);
          const year = parseInt(mYearBE) - 543;
          const monthCols = getMonthColumns(year, monthIdx);
          monthCols.forEach((c) => {
            if (submissionSet.has(submissionKey(u.userId, c.task.id, c.dStr)))
              mCount++;
          });
          mCounts.push(mCount);
          totalOk += mCount;
        });
        const percent =
          grandTotalPossibleSubmissions > 0
            ? (totalOk / grandTotalPossibleSubmissions) * 100
            : 0;
        return { ...u, mCounts, totalOk, percent };
      });

      const rankedUsers = userParticipation.sort(
        (a, b) => b.percent - a.percent,
      );

      const pFixedN = 4;
      const pMonthsN = monthTotalOkCols.length;
      partSheet.columns = Array.from(
        { length: pFixedN + pMonthsN + 4 },
        (_, i) => ({
          width: i < 4 ? [8, 15, 20, 25][i] : 20,
        }),
      );

      const phData = ["ลำดับ", "รหัสพนักงาน", "ชื่อทีม", "ชื่อผู้ใช้"];
      monthTotalOkCols.forEach((m) => phData.push(m.sheetName));
      phData.push(
        "รวมจำนวนที่ส่ง",
        "จำนวนทั้งหมด",
        "ร้อยละการเข้าร่วม",
        "ผลการประเมิน (80%)",
      );

      const phRow = partSheet.addRow(phData);
      (phRow as any).height = 35;
      (phRow as any).eachCell((c: any, i: number) => {
        c.font = { bold: true, size: 11 };
        c.alignment = {
          vertical: "middle",
          horizontal: "center",
          wrapText: true,
        };
        c.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
        if (i <= pFixedN)
          c.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF1F5F9" },
          };
        else if (i <= pFixedN + pMonthsN)
          c.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFDF2F8" },
          };
        else
          c.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFECFDF5" },
          };
      });

      let pSeq = 1;
      for (const u of rankedUsers) {
        const rowData: any[] = [pSeq++, u.idCode, u.team, u.name];
        const rIdx = pSeq; // Current row in Excel (Row 1 is header)

        u.mCounts.forEach((mCount, mIdx) => {
          const mInfo = monthTotalOkCols[mIdx];
          const targetRowInMonth = rIdx + 2; // User 1 (Row 2 here) is Row 4 in Monthly
          rowData.push({
            formula: `'${mInfo.sheetName}'!${mInfo.colLetter}${targetRowInMonth}`,
            result: mCount,
          });
        });

        // Total Submissions
        const startCol = colName(pFixedN + 1);
        const endCol = colName(pFixedN + pMonthsN);
        rowData.push({
          formula: `SUM(${startCol}${rIdx}:${endCol}${rIdx})`,
          result: u.totalOk,
        });

        // Total Possible
        rowData.push(grandTotalPossibleSubmissions);

        // Percentage
        const sumCol = colName(pFixedN + pMonthsN + 1);
        const possibleCol = colName(pFixedN + pMonthsN + 2);
        rowData.push({
          formula: `IFERROR(ROUND(${sumCol}${rIdx}/${possibleCol}${rIdx}*100, 2), 0)`,
          result: u.percent,
        });

        // Status (Pass >= 80%)
        const percentCol = colName(pFixedN + pMonthsN + 3);
        rowData.push({
          formula: `IF(${percentCol}${rIdx}>=80, "ผ่าน", "ไม่ผ่าน")`,
          result: u.percent >= 80 ? "ผ่าน" : "ไม่ผ่าน",
        });

        const pRow = partSheet.addRow(rowData);
        (pRow as any).height = 25;

        const isPass = u.percent >= 80;
        const rowBg = isPass ? "FFCFFAFE" : "FFFFFFFF"; // Cyan pastel if passed

        (pRow as any).eachCell((c: any, colNum: number) => {
          c.alignment = { vertical: "middle", horizontal: "center" };
          c.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
          c.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: rowBg },
          };

          if (colNum === 3 && u.teamId && !isPass) {
            const argb = toARGB(u.teamId);
            if (argb)
              c.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
          }
          if (colNum > pFixedN + pMonthsN) c.font = { bold: true };
        });
        await (pRow as any).commit();
      }

      await (partSheet as any).commit();
      await workbook.commit();
      res.end();

      await logAudit({
        userId: req.headers["x-user-id"] as string,
        action: "EXPORT",
        description: `ผู้ใช้ส่งออกรายงานกิจกรรมแบบรายเดือน (${event.title})`,
        targetType: "events",
        targetId: id,
        req,
      });
    } catch (error: any) {
      console.error("Export Excel error:", error);
      if (!res.headersSent)
        res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

router.get(
  "/activities/:id/participants-export",
  checkManageAccess,
  async (req, res) => {
    const { id } = req.params;

    try {
      // 1. Fetch Event Info for the filename
      const [eventRows]: any = await pool.query(
        "SELECT title FROM events WHERE id = ?",
        [id],
      );
      const eventTitle = eventRows[0]?.title || "Activity";

      // 2. Fetch Participants
      const [registrants]: any = await pool.query(
        `
      SELECT 
        r.id as reg_id, 
        r.created_at, 
        u.id, 
        u.id_code,
        u.fname_th, 
        u.lname_th, 
        u.email, 
        u.phone, 
        u.role_type, 
        u.role_detail_1,
        u.role_detail_2,
        tm.name as team_name,
        (SELECT COUNT(*) FROM submissions s 
         JOIN tasks t ON s.task_id = t.id 
         WHERE s.user_id = u.id AND t.event_id = ? AND s.status = 'approved') as approved_count
      FROM registrations r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN teams tm ON u.team_id = tm.id
      WHERE r.event_id = ?
      ORDER BY r.created_at ASC
    `,
        [id, id],
      );

      // Helper: map role_type to column labels (matches Profile.vue logic)
      const getRoleLabels = (roleType: string) => {
        switch (roleType) {
          case "นักเรียน":
            return { detail1: "ชื่อโรงเรียน", detail2: "ระดับชั้น" };
          case "นักศึกษา":
            return { detail1: "มหาวิทยาลัย", detail2: "คณะ-ชั้นปี" };
          case "บุคลากรโรงพยาบาล":
            return { detail1: "แผนก/สังกัด", detail2: "วิชาชีพ" };
          case "บุคลากรมหาวิทยาลัย":
            return { detail1: "หน่วยงาน/สำนักวิชา", detail2: "ตำแหน่ง" };
          default:
            return { detail1: "รายละเอียดที่ 1", detail2: "รายละเอียดที่ 2" };
        }
      };

      const data = registrants.map((r: any) => {
        const p = decryptFields(r, USER_ENCRYPTED_FIELDS);
        return {
          ...p,
          is_passed: p.approved_count > 0,
        };
      });

      // 3. Create Excel
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Participants");

      sheet.columns = [
        { header: "ลำดับ", key: "no", width: 8 },
        { header: "รหัสพนักงาน", key: "id_code", width: 16 },
        { header: "ชื่อ", key: "fname_th", width: 18 },
        { header: "นามสกุล", key: "lname_th", width: 18 },
        { header: "ทีม", key: "team_name", width: 18 },
        { header: "อีเมล", key: "email", width: 30 },
        { header: "โทรศัพท์", key: "phone", width: 16 },
        { header: "ประเภทผู้ใช้", key: "role_type", width: 20 },
        { header: "สถาบัน/แผนก", key: "detail1", width: 28 },
        { header: "ชั้น/ตำแหน่ง", key: "detail2", width: 22 },
        { header: "วันที่สมัคร", key: "joined_at", width: 22 },
        { header: "สถานะ", key: "status", width: 12 },
      ];

      // Styling Header
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4F46E5" }, // Indigo 600
      };
      headerRow.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };
      headerRow.height = 36;

      // Add Data
      data.forEach((p, idx) => {
        const labels = getRoleLabels(p.role_type);
        const isPass = p.is_passed;

        const row = sheet.addRow({
          no: idx + 1,
          id_code: p.id_code || "-",
          fname_th: p.fname_th || "-",
          lname_th: p.lname_th || "-",
          team_name: p.team_name || "ไม่มีทีม",
          email: p.email || "-",
          phone: p.phone || "-",
          role_type: p.role_type || "บุคคลทั่วไป",
          detail1: p.role_detail_1 || "-",
          detail2: p.role_detail_2 || "-",
          joined_at: new Date(p.created_at).toLocaleDateString("th-TH", {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
          status: isPass ? "สำเร็จ" : "เข้าร่วม",
        });

        // Force text format so phone/id_code never shows as scientific notation
        row.getCell("id_code").numFmt = "@";
        row.getCell("phone").numFmt = "@";
        row.height = 22;
        row.alignment = { vertical: "middle", horizontal: "left" };

        // Row color: light cyan for passed, white otherwise
        const rowBg = isPass ? "FFE0F2FE" : "FFFFFFFF";
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: rowBg },
          };
          cell.border = {
            top: { style: "thin", color: { argb: "FFCBD5E1" } },
            left: { style: "thin", color: { argb: "FFCBD5E1" } },
            bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
            right: { style: "thin", color: { argb: "FFCBD5E1" } },
          };
        });

        // Status cell color
        const statusCell = row.getCell("status");
        statusCell.font = {
          bold: true,
          color: { argb: isPass ? "FF059669" : "FF6B7280" },
        };
      });

      // Final Setup
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=participants_${id}.xlsx`,
      );

      await workbook.xlsx.write(res);
      res.end();

      await logAudit({
        userId: req.headers["x-user-id"] as string,
        action: "EXPORT",
        description: `ผู้ใช้ส่งออกรายชื่อผู้เข้าร่วมกิจกรรม (${eventTitle})`,
        targetType: "events",
        targetId: id,
        req,
      });
    } catch (error: any) {
      console.error("Export Participants Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

export default router;
