import { ref, computed, watch, type Ref } from "vue";
import {
  type TanitaRecord,
  type TrendDirection,
  sortRecordsByDate,
  getLatestAndPrevious,
  computeDelta,
  mapMainGoalToType,
  evaluateTrend,
  getBmiStatus,
  computeGoalProgress,
  computeHealthScore,
  generateHealthInsights,
  getRecordMetric,
  parseMetricValue,
} from "../lib/healthMetrics";

export function useHealthOverview(
  userId: Ref<number | string | undefined | null>,
  mainGoal: Ref<string | null | undefined>,
) {
  const records = ref<TanitaRecord[]>([]);
  const isLoading = ref(false);
  const isLoaded = ref(false);
  const loadError = ref<string | null>(null);

  async function fetchHistory(force = false) {
    const id = userId.value;
    if (!id) return;
    if (isLoaded.value && !force) return;

    isLoading.value = true;
    loadError.value = null;
    try {
      const res = await fetch(`/api/tanita/user/${id}`, {
        headers: { "x-user-id": String(id) },
      });
      if (!res.ok) throw new Error("Failed to fetch body composition history");
      const data = await res.json();
      records.value = Array.isArray(data) ? data : [];
      isLoaded.value = true;
    } catch (err: unknown) {
      loadError.value =
        err instanceof Error ? err.message : "Failed to load health data";
      records.value = [];
    } finally {
      isLoading.value = false;
    }
  }

  function invalidate() {
    isLoaded.value = false;
  }

  watch(userId, () => {
    invalidate();
    fetchHistory(true);
  });

  const sortedRecords = computed(() => sortRecordsByDate(records.value));
  const recordCount = computed(() => sortedRecords.value.length);
  const hasTrendData = computed(() => recordCount.value >= 2);

  const latestRecord = computed(
    () => getLatestAndPrevious(sortedRecords.value).latest,
  );
  const previousRecord = computed(
    () => getLatestAndPrevious(sortedRecords.value).previous,
  );

  const goalType = computed(() => mapMainGoalToType(mainGoal.value));

  const weightDelta = computed(() =>
    computeDelta(
      getRecordMetric(latestRecord.value, "weight"),
      getRecordMetric(previousRecord.value, "weight"),
    ),
  );
  const bmiDelta = computed(() =>
    computeDelta(
      getRecordMetric(latestRecord.value, "bmi"),
      getRecordMetric(previousRecord.value, "bmi"),
    ),
  );
  const bodyFatDelta = computed(() =>
    computeDelta(
      getRecordMetric(latestRecord.value, "bodyFat"),
      getRecordMetric(previousRecord.value, "bodyFat"),
    ),
  );
  const muscleMassDelta = computed(() =>
    computeDelta(
      getRecordMetric(latestRecord.value, "muscleMass"),
      getRecordMetric(previousRecord.value, "muscleMass"),
    ),
  );

  const weightTrend = computed((): TrendDirection =>
    evaluateTrend("weight", weightDelta.value, goalType.value),
  );
  const bmiTrend = computed((): TrendDirection =>
    evaluateTrend(
      "bmi",
      bmiDelta.value,
      goalType.value,
      getRecordMetric(latestRecord.value, "bmi"),
      getRecordMetric(previousRecord.value, "bmi"),
    ),
  );
  const bodyFatTrend = computed((): TrendDirection =>
    evaluateTrend("bodyFat", bodyFatDelta.value, goalType.value),
  );
  const muscleMassTrend = computed((): TrendDirection =>
    evaluateTrend("muscleMass", muscleMassDelta.value, goalType.value),
  );

  const latestBmi = computed(() => getRecordMetric(latestRecord.value, "bmi"));
  const bmiStatus = computed(() => getBmiStatus(latestBmi.value, "th"));

  const goalProgress = computed(() =>
    computeGoalProgress(sortedRecords.value, goalType.value, "th"),
  );

  const healthScore = computed(() =>
    computeHealthScore(
      [
        weightTrend.value,
        bmiTrend.value,
        bodyFatTrend.value,
        muscleMassTrend.value,
      ],
      recordCount.value,
    ),
  );

  const insights = computed(() =>
    generateHealthInsights(sortedRecords.value, goalType.value, "th"),
  );

  const chartLabels = computed(() =>
    sortedRecords.value.map((r) =>
      new Intl.DateTimeFormat("th-TH", {
        day: "numeric",
        month: "short",
      }).format(new Date(r.recorded_at)),
    ),
  );

  const weightChartData = computed(() => ({
    labels: chartLabels.value,
    datasets: [
      {
        label: "น้ำหนัก (kg)",
        data: sortedRecords.value.map((r) => parseMetricValue(r.weight)),
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59, 130, 246, 0.08)",
        borderWidth: 2.5,
        pointRadius: 3,
        fill: true,
        tension: 0.35,
      },
    ],
  }));

  const compositionChartData = computed(() => ({
    labels: chartLabels.value,
    datasets: [
      {
        label: "ไขมัน (%)",
        data: sortedRecords.value.map((r) => parseMetricValue(r.fat_pc)),
        borderColor: "#f97316",
        backgroundColor: "transparent",
        borderWidth: 2.5,
        pointRadius: 3,
        tension: 0.35,
        yAxisID: "y",
      },
      {
        label: "กล้ามเนื้อ (kg)",
        data: sortedRecords.value.map((r) => parseMetricValue(r.muscle_mass)),
        borderColor: "#ef4444",
        backgroundColor: "transparent",
        borderWidth: 2.5,
        pointRadius: 3,
        tension: 0.35,
        yAxisID: "y1",
      },
    ],
  }));

  const bmiChartData = computed(() => ({
    labels: chartLabels.value,
    datasets: [
      {
        label: "BMI",
        data: sortedRecords.value.map((r) => parseMetricValue(r.bmi)),
        borderColor: "#10b981",
        backgroundColor: "rgba(16, 185, 129, 0.08)",
        borderWidth: 2.5,
        pointRadius: 3,
        fill: true,
        tension: 0.35,
      },
    ],
  }));

  return {
    records,
    sortedRecords,
    recordCount,
    hasTrendData,
    isLoading,
    isLoaded,
    loadError,
    fetchHistory,
    invalidate,
    latestRecord,
    previousRecord,
    goalType,
    weightDelta,
    bmiDelta,
    bodyFatDelta,
    muscleMassDelta,
    weightTrend,
    bmiTrend,
    bodyFatTrend,
    muscleMassTrend,
    latestBmi,
    bmiStatus,
    goalProgress,
    healthScore,
    insights,
    weightChartData,
    compositionChartData,
    bmiChartData,
  };
}
