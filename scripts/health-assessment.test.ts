import assert from "node:assert/strict";
import {
  sections,
  scoreSection,
  levelForSection,
  overallLevelFromSectionLevels,
  totalScore,
} from "../src/lib/healthAssessment";

// The definition survived the move intact.
assert.ok(sections.length >= 5, "expected at least 5 sections (3อ2ส)");
const food = sections.find((s) => s.id === "food")!;
assert.ok(food, "food section exists");
assert.equal(food.maxScore, 40);

// scoreSection sums the chosen options.
const firstQ = food.questions[0];
const topOpt = firstQ.options[0];
const answers: Record<string, string> = { [firstQ.id]: topOpt.text };
assert.equal(scoreSection(food, answers), topOpt.score);
// unanswered -> 0
assert.equal(scoreSection(food, {}), 0);

// levelForSection resolves each range boundary.
for (const r of food.scoringRanges) {
  assert.equal(levelForSection(food, r.min).level, r.level, `min ${r.min}`);
  assert.equal(levelForSection(food, r.max).level, r.level, `max ${r.max}`);
}

// overall level = worst present
assert.equal(overallLevelFromSectionLevels(["ดีมาก", "ดี"]), "ดี");
assert.equal(overallLevelFromSectionLevels(["ดีมาก", "พอใช้", "ดี"]), "พอใช้");
assert.equal(
  overallLevelFromSectionLevels(["ดี", "ควรปรับปรุง", "พอใช้"]),
  "ควรปรับปรุง",
);
assert.equal(overallLevelFromSectionLevels(["ดีมาก"]), "ดีมาก");
assert.equal(overallLevelFromSectionLevels([]), "ดีมาก");

// totalScore sums across sections
assert.equal(totalScore({}), 0);
assert.equal(totalScore(answers), topOpt.score);

console.log("health-assessment.test.ts OK");
