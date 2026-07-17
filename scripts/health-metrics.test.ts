import assert from "node:assert/strict";
import {
  sortRecordsByDate,
  getLatestAndPrevious,
  computeDelta,
  evaluateTrend,
  mapMainGoalToType,
  computeGoalProgress,
  computeHealthScore,
  generateHealthInsights,
  clampProgress,
} from "../src/lib/healthMetrics";

const mk = (date: string, overrides: Record<string, number> = {}) => ({
  recorded_at: date,
  weight: 70,
  bmi: 24,
  fat_pc: 25,
  muscle_mass: 30,
  ideal_weight: 65,
  ...overrides,
});

// Unsorted dates should sort correctly
const unsorted = [
  mk("2026-03-01", { weight: 72 }),
  mk("2026-01-01", { weight: 75 }),
  mk("2026-02-01", { weight: 73 }),
];
const sorted = sortRecordsByDate(unsorted);
assert.equal(sorted[0].weight, 75);
assert.equal(sorted[2].weight, 72);

const { latest, previous } = getLatestAndPrevious(sorted);
assert.equal(latest?.weight, 72);
assert.equal(previous?.weight, 73);

assert.equal(computeDelta(70, 71.2), -1.2);
assert.equal(computeDelta(null, 70), null);

assert.equal(mapMainGoalToType("ลดน้ำหนัก"), "weight_loss");
assert.equal(mapMainGoalToType("เพิ่มกล้ามเนื้อ"), "muscle_gain");
assert.equal(mapMainGoalToType(""), null);

assert.equal(evaluateTrend("weight", -1.2, "weight_loss"), "improved");
assert.equal(evaluateTrend("weight", 0.5, "weight_loss"), "declined");
assert.equal(evaluateTrend("muscleMass", 0.4, "muscle_gain"), "improved");
assert.equal(evaluateTrend("bodyFat", -0.5, "weight_loss"), "improved");
assert.equal(evaluateTrend("weight", null, "weight_loss"), "insufficient_data");

const weightLossRecords = [
  mk("2026-01-01", { weight: 82, ideal_weight: 75 }),
  mk("2026-02-01", { weight: 78.5, ideal_weight: 75 }),
];
const progress = computeGoalProgress(weightLossRecords, "weight_loss", "th");
assert.equal(progress.hasGoal, true);
assert.equal(progress.progress, clampProgress(((82 - 78.5) / (82 - 75)) * 100));
assert.equal(progress.remaining, 3.5);

const noGoal = computeGoalProgress(weightLossRecords, null, "th");
assert.equal(noGoal.hasGoal, false);

const singleRecord = [mk("2026-01-01")];
const insightsSingle = generateHealthInsights(
  singleRecord,
  "weight_loss",
  "th",
);
assert.ok(
  insightsSingle[0].includes("2 ครั้ง") ||
    insightsSingle[0].includes("2 records"),
);

const score = computeHealthScore(["improved", "neutral", "declined"], 3);
assert.equal(score, 70);

console.log("health-metrics.test.ts: all assertions passed");
