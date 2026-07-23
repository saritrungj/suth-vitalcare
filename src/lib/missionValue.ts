// Mission value encoding shared by the user submit flow and the admin editor,
// so both produce the same stored `submissions.value`.
// Pure — unit-tested via scripts/mission-value.test.ts.

export type MetricMode = "time" | "steps" | "number";

export interface TaskLike {
  submission_type?: string | null;
  metric_type?: string | null;
  metric_unit?: string | null;
}

/** Which input widget/encoding a task needs. Mirrors useMissions' metricMode. */
export function metricModeForTask(
  task: TaskLike | null | undefined,
): MetricMode {
  if (!task) return "number";
  if ((task.submission_type || "").toLowerCase() === "time") return "time";
  if ((task.metric_type || "").toLowerCase() === "steps") return "steps";
  return "number";
}

export interface MissionValueInput {
  mode: MetricMode;
  num?: string | number;
  steps?: string | number;
  h?: string | number;
  m?: string | number;
  s?: string | number;
}

/** Encode the entered value into the numeric `submissions.value`. */
export function encodeMissionValue(input: MissionValueInput): number {
  const int = (v: any) => parseInt(String(v ?? ""), 10) || 0;
  if (input.mode === "time") {
    return int(input.h) * 3600 + int(input.m) * 60 + int(input.s);
  }
  if (input.mode === "steps") return int(input.steps);
  const n = parseFloat(String(input.num ?? ""));
  return isNaN(n) ? 0 : n;
}
