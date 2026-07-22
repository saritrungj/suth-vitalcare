// Pure streak-scoring math. NO database imports — kept dependency-free so it is
// unit-testable via tsx (see scripts/streak-scoring.test.ts) and shared by
// scoring.ts (awarding) and stats.ts (leaderboard display).

export interface StreakTier {
  minStreak: number;
  bonus: number;
}

// Mirrors DEFAULTS.daily_mission.streakTiers in scoring.ts; single source here.
export const DAILY_MISSION_DEFAULT_TIERS: StreakTier[] = [
  { minStreak: 3, bonus: 5 },
  { minStreak: 7, bonus: 15 },
  { minStreak: 30, bonus: 50 },
];

/** Highest tier bonus whose minStreak <= streak, else 0. */
export function pickStreakBonus(tiers: StreakTier[], streak: number): number {
  let bonus = 0;
  for (const tier of tiers || []) {
    if (streak >= tier.minStreak) bonus = Math.max(bonus, tier.bonus);
  }
  return bonus;
}

/**
 * Length of the run of consecutive calendar days ending today or yesterday.
 * `dates` are 'YYYY-MM-DD' strings (any order, duplicates tolerated).
 */
export function computeStreakFromDates(
  dates: string[],
  now: Date = new Date(),
): number {
  const uniq = Array.from(new Set(dates.filter(Boolean)));
  if (uniq.length === 0) return 0;
  // Newest first.
  uniq.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const atMidnight = (s: string) => {
    const d = new Date(s);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  let latest = atMidnight(uniq[0]);
  if (
    latest.getTime() !== today.getTime() &&
    latest.getTime() !== yesterday.getTime()
  ) {
    return 0;
  }

  let streak = 1;
  let current = latest;
  for (let i = 1; i < uniq.length; i++) {
    const next = atMidnight(uniq[i]);
    const diff = Math.round((current.getTime() - next.getTime()) / 86400000);
    if (diff === 1) {
      streak++;
      current = next;
    } else if (diff === 0) {
      continue;
    } else {
      break;
    }
  }
  return streak;
}
