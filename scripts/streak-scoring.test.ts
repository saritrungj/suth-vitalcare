import assert from "node:assert/strict";
import {
  pickStreakBonus,
  computeStreakFromDates,
  DAILY_MISSION_DEFAULT_TIERS,
} from "../server/lib/streakScoring";

// ── pickStreakBonus ──────────────────────────────────────────────
const tiers = [
  { minStreak: 3, bonus: 5 },
  { minStreak: 7, bonus: 15 },
  { minStreak: 30, bonus: 50 },
];
assert.equal(pickStreakBonus(tiers, 0), 0, "below lowest tier → 0");
assert.equal(pickStreakBonus(tiers, 2), 0, "just below lowest tier → 0");
assert.equal(pickStreakBonus(tiers, 3), 5, "at lowest tier");
assert.equal(pickStreakBonus(tiers, 6), 5, "between tiers takes lower");
assert.equal(pickStreakBonus(tiers, 7), 15, "at middle tier");
assert.equal(pickStreakBonus(tiers, 100), 50, "above highest → highest");
assert.equal(pickStreakBonus([], 10), 0, "no tiers → 0");
assert.equal(
  pickStreakBonus(DAILY_MISSION_DEFAULT_TIERS, 7),
  15,
  "defaults expose the standard tiers",
);

// ── computeStreakFromDates ───────────────────────────────────────
const now = new Date("2026-07-23T10:00:00");
// Anchored today, 3 consecutive days.
assert.equal(
  computeStreakFromDates(["2026-07-23", "2026-07-22", "2026-07-21"], now),
  3,
);
// Anchored yesterday still counts.
assert.equal(computeStreakFromDates(["2026-07-22", "2026-07-21"], now), 2);
// Gap breaks the streak.
assert.equal(
  computeStreakFromDates(["2026-07-23", "2026-07-21", "2026-07-20"], now),
  1,
);
// Latest older than yesterday → 0.
assert.equal(computeStreakFromDates(["2026-07-20"], now), 0);
// Empty → 0.
assert.equal(computeStreakFromDates([], now), 0);
// Unsorted input is handled (sorts internally).
assert.equal(
  computeStreakFromDates(["2026-07-21", "2026-07-23", "2026-07-22"], now),
  3,
);
// Duplicate dates don't inflate the streak.
assert.equal(
  computeStreakFromDates(["2026-07-23", "2026-07-23", "2026-07-22"], now),
  2,
);

console.log("streak-scoring.test.ts OK");
