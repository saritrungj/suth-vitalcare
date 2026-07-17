import { ref } from "vue";
import { authStore } from "../store/auth";
import { abortableJson } from "../lib/http";

// ── Config shapes (mirror server/lib/scoring.ts) ─────────────────────────────
export interface StreakTier {
  minStreak: number;
  bonus: number;
}
export interface DailyMissionCfg {
  basePoints: number;
  streakTiers: StreakTier[];
}
export interface ScoreBand {
  minScore: number;
  maxScore: number;
  points: number;
}
export interface AssessmentCfg {
  bands: ScoreBand[];
  improvementBonus: number;
}
export interface MetricRule {
  pointsPerUnitDecrease?: number;
  pointsPerUnitIncrease?: number;
  maxPoints?: number;
}
export type BodyCompCfg = Record<string, MetricRule>;

const DEFAULT_DAILY: DailyMissionCfg = {
  basePoints: 5,
  streakTiers: [
    { minStreak: 3, bonus: 5 },
    { minStreak: 7, bonus: 15 },
    { minStreak: 30, bonus: 50 },
  ],
};
const DEFAULT_ASSESSMENT: AssessmentCfg = {
  bands: [
    { minScore: 0, maxScore: 49, points: 5 },
    { minScore: 50, maxScore: 79, points: 10 },
    { minScore: 80, maxScore: 100, points: 20 },
  ],
  improvementBonus: 15,
};
const DEFAULT_BODYCOMP: BodyCompCfg = {
  fat_pc: { pointsPerUnitDecrease: 10, maxPoints: 50 },
  visceral_fat: { pointsPerUnitDecrease: 10, maxPoints: 30 },
  weight: { pointsPerUnitDecrease: 5, maxPoints: 50 },
  muscle_mass: { pointsPerUnitIncrease: 10, maxPoints: 50 },
};

/** Metrics rewarded for a decrease vs an increase (drives the form labels). */
export const BODYCOMP_METRICS: {
  key: string;
  label: string;
  direction: "decrease" | "increase";
}[] = [
  { key: "fat_pc", label: "% ไขมัน (Fat %)", direction: "decrease" },
  {
    key: "visceral_fat",
    label: "ไขมันช่องท้อง (Visceral)",
    direction: "decrease",
  },
  { key: "weight", label: "น้ำหนัก (Weight)", direction: "decrease" },
  {
    key: "muscle_mass",
    label: "มวลกล้ามเนื้อ (Muscle)",
    direction: "increase",
  },
];

export function useAdminScoringSettings() {
  const loading = ref(false);
  const saving = ref(false);
  const error = ref("");

  const daily = ref<DailyMissionCfg>(structuredClone(DEFAULT_DAILY));
  const assessment = ref<AssessmentCfg>(structuredClone(DEFAULT_ASSESSMENT));
  const bodyComp = ref<BodyCompCfg>(structuredClone(DEFAULT_BODYCOMP));

  const parseMeta = (raw: any) => {
    if (!raw) return null;
    try {
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return null;
    }
  };

  const load = async () => {
    loading.value = true;
    error.value = "";
    try {
      const rows: any[] = await abortableJson("/api/master/scoring");
      for (const r of rows) {
        const meta = parseMeta(r.metadata);
        if (!meta) continue;
        if (r.key_name === "daily_mission")
          daily.value = { ...DEFAULT_DAILY, ...meta };
        else if (r.key_name === "assessment")
          assessment.value = { ...DEFAULT_ASSESSMENT, ...meta };
        else if (r.key_name === "body_composition")
          bodyComp.value = { ...DEFAULT_BODYCOMP, ...meta };
      }
    } catch (e: any) {
      error.value = e?.message || "โหลดการตั้งค่าไม่สำเร็จ";
    } finally {
      loading.value = false;
    }
  };

  const save = async () => {
    saving.value = true;
    error.value = "";
    try {
      const payload = [
        {
          category: "scoring",
          key_name: "daily_mission",
          display_label: "คะแนนภารกิจรายวัน",
          metadata: daily.value,
          sort_order: 1,
          is_active: true,
        },
        {
          category: "scoring",
          key_name: "assessment",
          display_label: "คะแนนแบบประเมิน 3อ2ส",
          metadata: assessment.value,
          sort_order: 2,
          is_active: true,
        },
        {
          category: "scoring",
          key_name: "body_composition",
          display_label: "คะแนนพัฒนาการองค์ประกอบร่างกาย",
          metadata: bodyComp.value,
          sort_order: 3,
          is_active: true,
        },
      ];
      const res = await fetch("/api/master", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(authStore.user?.id || ""),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "บันทึกไม่สำเร็จ");
      }
      return true;
    } catch (e: any) {
      error.value = e?.message || "บันทึกไม่สำเร็จ";
      return false;
    } finally {
      saving.value = false;
    }
  };

  const addStreakTier = () =>
    daily.value.streakTiers.push({ minStreak: 0, bonus: 0 });
  const removeStreakTier = (i: number) => daily.value.streakTiers.splice(i, 1);
  const addBand = () =>
    assessment.value.bands.push({ minScore: 0, maxScore: 0, points: 0 });
  const removeBand = (i: number) => assessment.value.bands.splice(i, 1);

  return {
    loading,
    saving,
    error,
    daily,
    assessment,
    bodyComp,
    load,
    save,
    addStreakTier,
    removeStreakTier,
    addBand,
    removeBand,
  };
}
