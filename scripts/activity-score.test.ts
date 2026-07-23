import assert from "node:assert/strict";
import { combineActivityScore, sumTotal } from "../server/lib/activityScore";

// base + streak bonus + adjustment
assert.equal(
  combineActivityScore({ base: 10, streakBonus: 5, adjustment: 3 }),
  18,
);
// missing parts default to 0
assert.equal(combineActivityScore({ base: 10 }), 10);
assert.equal(combineActivityScore({}), 0);
// negative adjustment can reduce, but score never goes below 0
assert.equal(combineActivityScore({ base: 10, adjustment: -4 }), 6);
assert.equal(combineActivityScore({ base: 10, adjustment: -50 }), 0);
// rounding (defensive; inputs are ints in practice)
assert.equal(combineActivityScore({ base: 10.4, streakBonus: 0.4 }), 11);

// sumTotal
assert.equal(sumTotal([18, 0, 5]), 23);
assert.equal(sumTotal([]), 0);
assert.equal(sumTotal([10, undefined as any, 5]), 15);

console.log("activity-score.test.ts OK");
