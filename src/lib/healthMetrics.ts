export type TrendDirection =
  "improved" | "declined" | "neutral" | "insufficient_data";

export type GoalType =
  | "weight_loss"
  | "weight_gain"
  | "muscle_gain"
  | "fat_loss"
  | "maintenance"
  | null;

export type TanitaRecord = {
  id?: number | string;
  user_id?: number | string;
  recorded_at: string;
  weight?: string | number | null;
  height?: string | number | null;
  fat_pc?: string | number | null;
  fat_mass?: string | number | null;
  muscle_mass?: string | number | null;
  ffm?: string | number | null;
  tbw_pc?: string | number | null;
  bone_mass?: string | number | null;
  bmr_kcal?: string | number | null;
  visceral_fat?: string | number | null;
  bmi?: string | number | null;
  ideal_weight?: string | number | null;
  waist_cm?: string | number | null;
};

export type MetricKey = "weight" | "bmi" | "bodyFat" | "muscleMass";

const BMI_NORMAL_MIN = 18.5;
const BMI_NORMAL_MAX = 22.9;

export function parseMetricValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

export function sortRecordsByDate(records: TanitaRecord[]): TanitaRecord[] {
  return [...records].sort(
    (a, b) =>
      new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
  );
}

export function getLatestAndPrevious(records: TanitaRecord[]): {
  latest: TanitaRecord | null;
  previous: TanitaRecord | null;
} {
  if (!records.length) return { latest: null, previous: null };
  const sorted = sortRecordsByDate(records);
  const latest = sorted[sorted.length - 1] ?? null;
  const previous =
    sorted.length >= 2 ? (sorted[sorted.length - 2] ?? null) : null;
  return { latest, previous };
}

export function computeDelta(
  current: number | null,
  previous: number | null,
): number | null {
  if (current === null || previous === null) return null;
  return Math.round((current - previous) * 10) / 10;
}

export function mapMainGoalToType(
  mainGoal: string | null | undefined,
): GoalType {
  const g = (mainGoal || "").trim();
  if (!g) return null;
  if (g.includes("ลดน้ำหนัก")) return "weight_loss";
  if (g.includes("เพิ่มกล้าม")) return "muscle_gain";
  if (g.includes("เพิ่ม")) return "weight_gain";
  if (g.includes("รักษา")) return "maintenance";
  return "maintenance";
}

function distanceToNormalBmi(bmi: number): number {
  if (bmi < BMI_NORMAL_MIN) return BMI_NORMAL_MIN - bmi;
  if (bmi > BMI_NORMAL_MAX) return bmi - BMI_NORMAL_MAX;
  return 0;
}

export function evaluateTrend(
  metric: MetricKey,
  delta: number | null,
  goalType: GoalType,
  currentBmi?: number | null,
  previousBmi?: number | null,
): TrendDirection {
  if (delta === null) return "insufficient_data";

  if (Math.abs(delta) < 0.05) return "neutral";

  if (metric === "bodyFat") {
    if (delta < 0)
      return goalType === "fat_loss" || goalType === "weight_loss"
        ? "improved"
        : goalType === "muscle_gain" || goalType === "weight_gain"
          ? "declined"
          : "improved";
    if (delta > 0)
      return goalType === "muscle_gain" || goalType === "weight_gain"
        ? "neutral"
        : "declined";
    return "neutral";
  }

  if (metric === "muscleMass") {
    if (delta > 0)
      return goalType === "muscle_gain" || goalType === "weight_gain"
        ? "improved"
        : goalType === "weight_loss"
          ? "neutral"
          : "improved";
    if (delta < 0) return goalType === "muscle_gain" ? "declined" : "neutral";
    return "neutral";
  }

  if (metric === "weight") {
    if (goalType === "weight_loss")
      return delta < 0 ? "improved" : delta > 0 ? "declined" : "neutral";
    if (goalType === "weight_gain" || goalType === "muscle_gain")
      return delta > 0 ? "improved" : delta < 0 ? "declined" : "neutral";
    return "neutral";
  }

  if (metric === "bmi") {
    if (currentBmi != null && previousBmi != null) {
      const currDist = distanceToNormalBmi(currentBmi);
      const prevDist = distanceToNormalBmi(previousBmi);
      if (currDist < prevDist - 0.05) return "improved";
      if (currDist > prevDist + 0.05) return "declined";
      return "neutral";
    }
    return "neutral";
  }

  return "neutral";
}

export function getBmiStatus(
  bmi: number | null,
  locale: "th" | "en" = "th",
): string {
  if (bmi === null) return locale === "th" ? "ไม่มีข้อมูล" : "No data";
  if (bmi < 18.5) return locale === "th" ? "ต่ำกว่าเกณฑ์" : "Underweight";
  if (bmi <= 22.9) return locale === "th" ? "ปกติ" : "Normal";
  if (bmi < 25) return locale === "th" ? "น้ำหนักเกิน" : "Overweight";
  return locale === "th" ? "อ้วน" : "Obese";
}

export function clampProgress(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export type GoalProgressResult = {
  progress: number | null;
  remaining: number | null;
  unit: string;
  hasGoal: boolean;
  label: string;
};

export function computeGoalProgress(
  records: TanitaRecord[],
  goalType: GoalType,
  locale: "th" | "en" = "th",
): GoalProgressResult {
  const empty: GoalProgressResult = {
    progress: null,
    remaining: null,
    unit: "kg",
    hasGoal: false,
    label: locale === "th" ? "ยังไม่ได้ตั้งเป้าหมาย" : "No goal set",
  };

  if (!goalType || !records.length) return empty;

  const sorted = sortRecordsByDate(records);
  const latest = sorted[sorted.length - 1];
  const oldest = sorted[0];

  if (goalType === "weight_loss") {
    const start = parseMetricValue(oldest?.weight);
    const current = parseMetricValue(latest?.weight);
    const target = parseMetricValue(latest?.ideal_weight);
    if (start === null || current === null || target === null) return empty;
    if (start <= target) return empty;
    const denom = start - target;
    if (denom === 0) return empty;
    const progress = clampProgress(((start - current) / denom) * 100);
    const remaining = Math.max(0, Math.round((current - target) * 10) / 10);
    return {
      progress,
      remaining,
      unit: "kg",
      hasGoal: true,
      label:
        locale === "th"
          ? `เป้าหมายลดน้ำหนักจาก ${start} ไป ${target} กก.`
          : `Weight goal: ${start} → ${target} kg`,
    };
  }

  if (goalType === "weight_gain" || goalType === "muscle_gain") {
    const start = parseMetricValue(oldest?.weight);
    const current = parseMetricValue(latest?.weight);
    const target = parseMetricValue(latest?.ideal_weight);
    if (start === null || current === null || target === null) return empty;
    if (target <= start) return empty;
    const denom = target - start;
    if (denom === 0) return empty;
    const progress = clampProgress(((current - start) / denom) * 100);
    const remaining = Math.max(0, Math.round((target - current) * 10) / 10);
    return {
      progress,
      remaining,
      unit: "kg",
      hasGoal: true,
      label:
        locale === "th"
          ? `เป้าหมายเพิ่มน้ำหนักจาก ${start} ไป ${target} กก.`
          : `Weight goal: ${start} → ${target} kg`,
    };
  }

  if (goalType === "fat_loss") {
    const start = parseMetricValue(oldest?.fat_pc);
    const current = parseMetricValue(latest?.fat_pc);
    if (start === null || current === null) return empty;
    const target = Math.max(start - 5, 10);
    if (start <= target) return empty;
    const denom = start - target;
    const progress = clampProgress(((start - current) / denom) * 100);
    const remaining = Math.max(0, Math.round((current - target) * 10) / 10);
    return {
      progress,
      remaining,
      unit: "%",
      hasGoal: true,
      label:
        locale === "th"
          ? `เป้าหมายลดไขมันจาก ${start}%`
          : `Fat loss goal from ${start}%`,
    };
  }

  return empty;
}

export function computeHealthScore(
  trends: TrendDirection[],
  recordCount: number,
): number | null {
  if (recordCount < 2) return null;
  const scored = trends.filter((t) => t !== "insufficient_data");
  if (!scored.length) return null;
  const points = scored.map((t) => {
    if (t === "improved") return 100;
    if (t === "neutral") return 70;
    if (t === "declined") return 40;
    return 50;
  });
  return Math.round(points.reduce((a, b) => a + b, 0) / points.length);
}

export function formatDelta(
  delta: number | null,
  unit: string,
  locale: "th" | "en" = "th",
): string {
  if (delta === null)
    return locale === "th" ? "ไม่มีข้อมูลเปรียบเทียบ" : "No comparison";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta} ${unit}`;
}

export function trendLabel(
  trend: TrendDirection,
  locale: "th" | "en" = "th",
): string {
  const map: Record<TrendDirection, { th: string; en: string }> = {
    improved: { th: "ดีขึ้น", en: "Improved" },
    declined: { th: "ควรติดตาม", en: "Watch" },
    neutral: { th: "คงที่", en: "Stable" },
    insufficient_data: { th: "ข้อมูลไม่พอ", en: "Insufficient data" },
  };
  return map[trend][locale];
}

export function trendBadgeClass(trend: TrendDirection): string {
  switch (trend) {
    case "improved":
      return "trend-success";
    case "declined":
      return "trend-danger";
    case "neutral":
      return "trend-neutral";
    default:
      return "trend-muted";
  }
}

export function generateHealthInsights(
  records: TanitaRecord[],
  goalType: GoalType,
  locale: "th" | "en" = "th",
): string[] {
  const insights: string[] = [];
  const { latest, previous } = getLatestAndPrevious(records);

  if (!latest) {
    return [
      locale === "th"
        ? "ยังไม่มีข้อมูลองค์ประกอบร่างกาย กรุณาบันทึกข้อมูลเพื่อเริ่มติดตามแนวโน้ม"
        : "No body composition data yet. Please add a record to start tracking.",
    ];
  }

  if (records.length < 2) {
    insights.push(
      locale === "th"
        ? "ยังไม่มีข้อมูลเพียงพอสำหรับวิเคราะห์แนวโน้ม กรุณาอัปเดตข้อมูลองค์ประกอบร่างกายอย่างน้อย 2 ครั้ง"
        : "Not enough data for trend analysis. Please add at least 2 body composition records.",
    );
    return insights;
  }

  const wCurr = parseMetricValue(latest.weight);
  const wPrev = parseMetricValue(previous?.weight);
  const wDelta = computeDelta(wCurr, wPrev);
  if (wDelta !== null) {
    const trend = evaluateTrend("weight", wDelta, goalType);
    if (wDelta < 0) {
      insights.push(
        locale === "th"
          ? `น้ำหนักลดลง ${Math.abs(wDelta)} กก. จากครั้งก่อน`
          : `Weight decreased by ${Math.abs(wDelta)} kg since last record`,
      );
    } else if (wDelta > 0) {
      insights.push(
        locale === "th"
          ? `น้ำหนักเพิ่มขึ้น ${wDelta} กก. จากครั้งก่อน`
          : `Weight increased by ${wDelta} kg since last record`,
      );
    }
    if (trend === "improved") {
      insights.push(
        locale === "th"
          ? "แนวโน้มน้ำหนักสอดคล้องกับเป้าหมายของคุณ"
          : "Weight trend aligns with your goal",
      );
    } else if (trend === "declined") {
      insights.push(
        locale === "th"
          ? "แนวโน้มน้ำหนักอาจไม่สอดคล้องกับเป้าหมาย ควรติดตามต่อ"
          : "Weight trend may not align with your goal — worth monitoring",
      );
    }
  }

  const fatCurr = parseMetricValue(latest.fat_pc);
  const fatPrev = parseMetricValue(previous?.fat_pc);
  const fatDelta = computeDelta(fatCurr, fatPrev);
  if (fatDelta !== null && fatDelta < 0) {
    insights.push(
      locale === "th"
        ? "เปอร์เซ็นต์ไขมันลดลงเล็กน้อย ถือว่าเป็นแนวโน้มที่ดี"
        : "Body fat percentage decreased slightly — a positive trend",
    );
  } else if (fatDelta !== null && fatDelta > 0) {
    insights.push(
      locale === "th"
        ? "เปอร์เซ็นต์ไขมันเพิ่มขึ้นเล็กน้อย ควรติดตามต่อ"
        : "Body fat percentage increased slightly — worth monitoring",
    );
  }

  const musCurr = parseMetricValue(latest.muscle_mass);
  const musPrev = parseMetricValue(previous?.muscle_mass);
  const musDelta = computeDelta(musCurr, musPrev);
  if (musDelta !== null && musDelta > 0) {
    insights.push(
      locale === "th"
        ? `มวลกล้ามเนื้อเพิ่มขึ้น ${musDelta} กก.`
        : `Muscle mass increased by ${musDelta} kg`,
    );
  }

  const goalProgress = computeGoalProgress(records, goalType, locale);
  if (goalProgress.hasGoal && goalProgress.progress !== null) {
    insights.push(
      locale === "th"
        ? `คุณทำเป้าหมายไปแล้ว ${Math.round(goalProgress.progress)}%`
        : `You are ${Math.round(goalProgress.progress)}% toward your goal`,
    );
    if (goalProgress.remaining !== null && goalProgress.remaining > 0) {
      insights.push(
        locale === "th"
          ? `เหลืออีก ${goalProgress.remaining} ${goalProgress.unit} ถึงเป้าหมาย`
          : `${goalProgress.remaining} ${goalProgress.unit} remaining to goal`,
      );
    }
  }

  const bmi = parseMetricValue(latest.bmi);
  if (bmi !== null && (bmi < 16 || bmi > 35)) {
    insights.push(
      locale === "th"
        ? "ค่า BMI อยู่นอกช่วงทั่วไป ควรปรึกษาผู้เชี่ยวชาญเพื่อประเมินเพิ่มเติม"
        : "BMI is outside typical ranges — consider consulting a health professional",
    );
  }

  return insights.slice(0, 5);
}

export function getRecordMetric(
  record: TanitaRecord | null | undefined,
  key: MetricKey,
): number | null {
  if (!record) return null;
  switch (key) {
    case "weight":
      return parseMetricValue(record.weight);
    case "bmi":
      return parseMetricValue(record.bmi);
    case "bodyFat":
      return parseMetricValue(record.fat_pc);
    case "muscleMass":
      return parseMetricValue(record.muscle_mass);
    default:
      return null;
  }
}
