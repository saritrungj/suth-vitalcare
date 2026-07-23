import assert from "node:assert/strict";
import { metricModeForTask, encodeMissionValue } from "../src/lib/missionValue";

// metricModeForTask
assert.equal(metricModeForTask({ submission_type: "time" } as any), "time");
assert.equal(metricModeForTask({ metric_type: "steps" } as any), "steps");
assert.equal(metricModeForTask({ metric_type: "distance" } as any), "number");
assert.equal(metricModeForTask({} as any), "number");
assert.equal(metricModeForTask(null as any), "number");

// encodeMissionValue — time is h*3600 + m*60 + s
assert.equal(
  encodeMissionValue({ mode: "time", h: "1", m: "2", s: "3" }),
  3723,
);
assert.equal(encodeMissionValue({ mode: "time" }), 0);
// steps -> integer
assert.equal(encodeMissionValue({ mode: "steps", steps: "1200" }), 1200);
assert.equal(encodeMissionValue({ mode: "steps", steps: "12.9" }), 12);
assert.equal(encodeMissionValue({ mode: "steps" }), 0);
// number -> float
assert.equal(encodeMissionValue({ mode: "number", num: "5.5" }), 5.5);
assert.equal(encodeMissionValue({ mode: "number", num: "" }), 0);
assert.equal(encodeMissionValue({ mode: "number", num: "abc" }), 0);

console.log("mission-value.test.ts OK");
