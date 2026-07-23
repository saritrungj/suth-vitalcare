// Canonical per-activity score formula, shared by rankings, profile, admin, export.
// Pure — unit-tested via scripts/activity-score.test.ts.

export interface ActivityScoreParts {
  base?: number;
  streakBonus?: number;
  adjustment?: number;
}

/** Points score for one activity: base + streak bonus + adjustment, clamped >= 0. */
export function combineActivityScore(p: ActivityScoreParts): number {
  const raw =
    (Number(p.base) || 0) +
    (Number(p.streakBonus) || 0) +
    (Number(p.adjustment) || 0);
  return Math.max(0, Math.round(raw));
}

/** Sum a list of per-activity scores into a total. */
export function sumTotal(scores: number[]): number {
  return scores.reduce((s, n) => s + (Number(n) || 0), 0);
}
