<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import {
  Scale,
  Activity,
  Flame,
  Dumbbell,
  Target,
  TrendingUp,
  LineChart as LineChartIcon,
  AlertCircle,
  Loader2,
} from "lucide-vue-next";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "vue-chartjs";
import { langStore } from "../../store/lang";
import { useHealthOverview } from "../../composables/useHealthOverview";
import {
  formatDelta,
  trendLabel,
  trendBadgeClass,
  getRecordMetric,
} from "../../lib/healthMetrics";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const props = defineProps<{
  userId?: number | string | null;
  mainGoal?: string | null;
}>();

const userIdRef = computed(() => props.userId);
const mainGoalRef = computed(() => props.mainGoal);

const {
  recordCount,
  hasTrendData,
  isLoading,
  fetchHistory,
  invalidate,
  latestRecord,
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
} = useHealthOverview(userIdRef, mainGoalRef);

const locale = computed(() => langStore.locale as "th" | "en");

const t = (th: string, en: string) => (locale.value === "th" ? th : en);

onMounted(() => fetchHistory(true));

defineExpose({ refresh: () => fetchHistory(true), invalidate });

watch(
  () => props.userId,
  () => fetchHistory(true),
);

const lineChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: "bottom" as const,
      labels: { boxWidth: 10, font: { size: 11 } },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { maxRotation: 45, minRotation: 0, font: { size: 10 } },
    },
    y: { grid: { color: "#f1f5f9" }, ticks: { font: { size: 10 } } },
  },
};

const dualAxisChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: "bottom" as const,
      labels: { boxWidth: 10, font: { size: 11 } },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { maxRotation: 45, minRotation: 0, font: { size: 10 } },
    },
    y: {
      type: "linear" as const,
      position: "left" as const,
      grid: { color: "#f1f5f9" },
      ticks: { font: { size: 10 } },
      title: { display: true, text: "%", font: { size: 10 } },
    },
    y1: {
      type: "linear" as const,
      position: "right" as const,
      grid: { drawOnChartArea: false },
      ticks: { font: { size: 10 } },
      title: { display: true, text: "kg", font: { size: 10 } },
    },
  },
};

const kpiCards = computed(() => [
  {
    key: "weight",
    icon: Scale,
    iconClass: "kpi-blue",
    label: t("น้ำหนักปัจจุบัน", "Current Weight"),
    value: getRecordMetric(latestRecord.value, "weight"),
    unit: "kg",
    delta: weightDelta.value,
    trend: weightTrend.value,
  },
  {
    key: "bmi",
    icon: Activity,
    iconClass: "kpi-green",
    label: "BMI",
    value: latestBmi.value,
    unit: "",
    status: bmiStatus.value,
    delta: bmiDelta.value,
    trend: bmiTrend.value,
  },
  {
    key: "bodyFat",
    icon: Flame,
    iconClass: "kpi-orange",
    label: t("ไขมันในร่างกาย", "Body Fat"),
    value: getRecordMetric(latestRecord.value, "bodyFat"),
    unit: "%",
    delta: bodyFatDelta.value,
    trend: bodyFatTrend.value,
  },
  {
    key: "muscle",
    icon: Dumbbell,
    iconClass: "kpi-red",
    label: t("มวลกล้ามเนื้อ", "Muscle Mass"),
    value: getRecordMetric(latestRecord.value, "muscleMass"),
    unit: "kg",
    delta: muscleMassDelta.value,
    trend: muscleMassTrend.value,
  },
]);

const hasBmiChartData = computed(() =>
  bmiChartData.value.datasets[0]?.data?.some((v) => v !== null),
);
</script>

<template>
  <section class="health-overview">
    <div class="ho-header">
      <div class="section-title-wrap">
        <TrendingUp :size="16" class="text-orange-500" />
        <h3 class="section-title">
          {{ t("ภาพรวมสุขภาพ", "Health Overview") }}
        </h3>
      </div>
      <span v-if="recordCount > 0" class="ho-record-count">
        {{ recordCount }} {{ t("ครั้งที่บันทึก", "records") }}
      </span>
    </div>

    <div v-if="isLoading && recordCount === 0" class="ho-loading">
      <Loader2 :size="24" class="spin" />
      <span>{{ t("กำลังโหลดข้อมูล...", "Loading...") }}</span>
    </div>

    <template v-else-if="recordCount === 0">
      <div class="ho-empty">
        <AlertCircle :size="32" class="text-slate-300" />
        <p>
          {{
            t("ยังไม่มีข้อมูลองค์ประกอบร่างกาย", "No body composition data yet")
          }}
        </p>
      </div>
    </template>

    <template v-else>
      <!-- KPI Grid -->
      <div class="ho-kpi-grid">
        <div v-for="card in kpiCards" :key="card.key" class="ho-kpi-card">
          <div class="ho-kpi-top">
            <div class="ho-kpi-icon" :class="card.iconClass">
              <component :is="card.icon" :size="16" />
            </div>
            <span
              v-if="card.trend !== 'insufficient_data'"
              class="ho-trend-badge"
              :class="trendBadgeClass(card.trend)"
            >
              {{ trendLabel(card.trend, locale) }}
            </span>
          </div>
          <div class="ho-kpi-label">{{ card.label }}</div>
          <div class="ho-kpi-value">
            <template v-if="card.value !== null">
              {{ card.value }}<small v-if="card.unit">{{ card.unit }}</small>
            </template>
            <template v-else>–</template>
          </div>
          <div v-if="card.status" class="ho-kpi-status">{{ card.status }}</div>
          <div class="ho-kpi-delta">
            {{ formatDelta(card.delta, card.unit || "", locale) }}
          </div>
        </div>

        <!-- Health Score -->
        <div class="ho-kpi-card ho-score-card">
          <div class="ho-kpi-top">
            <div class="ho-kpi-icon kpi-purple">
              <LineChartIcon :size="16" />
            </div>
          </div>
          <div class="ho-kpi-label">
            {{ t("คะแนนความคืบหน้า", "Body Progress Score") }}
          </div>
          <div class="ho-kpi-value">
            <template v-if="healthScore !== null">{{ healthScore }}</template>
            <template v-else>
              <span class="ho-score-pending">{{
                t("รอข้อมูลเพิ่มเติม", "Awaiting more data")
              }}</span>
            </template>
          </div>
          <div class="ho-kpi-delta text-slate-400">
            {{
              hasTrendData
                ? t("จากแนวโน้มล่าสุด", "Based on recent trends")
                : t("ต้องการข้อมูล 2 ครั้งขึ้นไป", "Needs 2+ records")
            }}
          </div>
        </div>
      </div>

      <!-- Goal Progress -->
      <div class="ho-goal-card">
        <div class="ho-goal-header">
          <Target :size="15" class="text-slate-500" />
          <span>{{ t("ความคืบหน้าเป้าหมาย", "Goal Progress") }}</span>
        </div>
        <template v-if="goalProgress.hasGoal && goalProgress.progress !== null">
          <div class="ho-goal-label">{{ goalProgress.label }}</div>
          <div class="ho-progress-track">
            <div
              class="ho-progress-fill"
              :style="{ width: `${goalProgress.progress}%` }"
            />
          </div>
          <div class="ho-progress-meta">
            <span>{{ Math.round(goalProgress.progress) }}%</span>
            <span
              v-if="
                goalProgress.remaining !== null && goalProgress.remaining > 0
              "
            >
              {{
                t(
                  `เหลืออีก ${goalProgress.remaining} ${goalProgress.unit} ถึงเป้าหมาย`,
                  `${goalProgress.remaining} ${goalProgress.unit} remaining`,
                )
              }}
            </span>
            <span v-else>{{ t("ถึงเป้าหมายแล้ว", "Goal reached") }}</span>
          </div>
        </template>
        <p v-else class="ho-goal-empty">{{ goalProgress.label }}</p>
      </div>

      <!-- Insights -->
      <div v-if="insights.length" class="ho-insights">
        <div v-for="(line, idx) in insights" :key="idx" class="ho-insight-item">
          {{ line }}
        </div>
      </div>

      <!-- Charts -->
      <div class="ho-charts-grid">
        <div class="ho-chart-card">
          <h4>{{ t("แนวโน้มน้ำหนัก", "Weight Trend") }}</h4>
          <div class="ho-chart-body">
            <Line
              v-if="hasTrendData"
              :data="weightChartData"
              :options="lineChartOptions"
            />
            <div v-else class="ho-chart-empty">
              {{
                t(
                  "เพิ่มข้อมูลอย่างน้อย 2 ครั้งเพื่อดูแนวโน้มสุขภาพ",
                  "Add at least 2 records to view health trends",
                )
              }}
            </div>
          </div>
        </div>

        <div class="ho-chart-card">
          <h4>{{ t("องค์ประกอบร่างกาย", "Body Composition Trend") }}</h4>
          <div class="ho-chart-body">
            <Line
              v-if="hasTrendData"
              :data="compositionChartData"
              :options="dualAxisChartOptions"
            />
            <div v-else class="ho-chart-empty">
              {{
                t(
                  "เพิ่มข้อมูลอย่างน้อย 2 ครั้งเพื่อดูแนวโน้มสุขภาพ",
                  "Add at least 2 records to view health trends",
                )
              }}
            </div>
          </div>
        </div>

        <div class="ho-chart-card">
          <h4>{{ t("แนวโน้ม BMI", "BMI Trend") }}</h4>
          <div class="ho-chart-body">
            <Line
              v-if="hasTrendData && hasBmiChartData"
              :data="bmiChartData"
              :options="lineChartOptions"
            />
            <div v-else class="ho-chart-empty">
              {{
                hasTrendData
                  ? t("ไม่มีข้อมูล BMI เพียงพอ", "Insufficient BMI data")
                  : t(
                      "เพิ่มข้อมูลอย่างน้อย 2 ครั้งเพื่อดูแนวโน้มสุขภาพ",
                      "Add at least 2 records to view health trends",
                    )
              }}
            </div>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.health-overview {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  margin-bottom: 8px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f1f5f9;
}

.ho-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.ho-record-count {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  background: #f8fafc;
  padding: 4px 10px;
  border-radius: 99px;
}

.ho-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 32px;
  color: #64748b;
  font-size: 14px;
}

.ho-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px;
  text-align: center;
  color: #64748b;
  font-size: 14px;
  background: #f8fafc;
  border-radius: 16px;
  border: 1.5px dashed #e2e8f0;
}

.ho-kpi-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

@media (min-width: 640px) {
  .ho-kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .ho-kpi-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1280px) {
  .ho-kpi-grid {
    grid-template-columns: repeat(5, 1fr);
  }
}

.ho-kpi-card {
  background: #fff;
  border: 1.5px solid #f1f5f9;
  border-radius: 16px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.015);
  transition: all 0.2s ease;
}

.ho-kpi-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.04);
}

.ho-kpi-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 6px;
}

.ho-kpi-icon {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.kpi-blue {
  background: #eff6ff;
  color: #3b82f6;
}
.kpi-green {
  background: #ecfdf5;
  color: #10b981;
}
.kpi-orange {
  background: #fff7ed;
  color: #f97316;
}
.kpi-red {
  background: #fef2f2;
  color: #ef4444;
}
.kpi-purple {
  background: #f5f3ff;
  color: #8b5cf6;
}

.ho-kpi-label {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  margin-top: 4px;
}

.ho-kpi-value {
  font-size: 22px;
  font-weight: 800;
  color: #1e293b;
  line-height: 1.2;
}

.ho-kpi-value small {
  font-size: 13px;
  font-weight: 600;
  color: #94a3b8;
  margin-left: 2px;
}

.ho-score-pending {
  font-size: 13px;
  font-weight: 600;
  color: #94a3b8;
}

.ho-kpi-status {
  font-size: 11px;
  font-weight: 700;
  color: #10b981;
}

.ho-kpi-delta {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
}

.ho-trend-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 99px;
  white-space: nowrap;
}

.trend-success {
  background: #dcfce7;
  color: #166534;
}
.trend-danger {
  background: #fee2e2;
  color: #991b1b;
}
.trend-neutral {
  background: #f1f5f9;
  color: #475569;
}
.trend-muted {
  background: #f8fafc;
  color: #94a3b8;
}

.ho-goal-card {
  background: #fff;
  border: 1.5px solid #f1f5f9;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.015);
}

.ho-goal-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: #334155;
  margin-bottom: 10px;
}

.ho-goal-label {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 8px;
}

.ho-progress-track {
  height: 10px;
  background: #f1f5f9;
  border-radius: 99px;
  overflow: hidden;
}

.ho-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #f05a23, #06c755);
  border-radius: 99px;
  transition: width 0.4s ease;
  min-width: 2%;
}

.ho-progress-meta {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  flex-wrap: wrap;
  gap: 4px;
}

.ho-goal-empty {
  font-size: 13px;
  color: #94a3b8;
  margin: 0;
}

.ho-insights {
  background: #f0f7f7;
  border: 1px solid rgba(53, 103, 104, 0.12);
  border-radius: 14px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ho-insight-item {
  font-size: 13px;
  color: #356768;
  line-height: 1.5;
  padding-left: 12px;
  position: relative;
}

.ho-insight-item::before {
  content: "•";
  position: absolute;
  left: 0;
  color: #f05a23;
  font-weight: 700;
}

.ho-charts-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

@media (min-width: 768px) {
  .ho-charts-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1280px) {
  .ho-charts-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.ho-chart-card {
  background: #fff;
  border: 1.5px solid #f1f5f9;
  border-radius: 16px;
  padding: 14px;
  min-width: 0;
  overflow: hidden;
}

.ho-chart-card h4 {
  font-size: 13px;
  font-weight: 700;
  color: #334155;
  margin: 0 0 10px;
}

.ho-chart-body {
  position: relative;
  height: 220px;
  width: 100%;
  min-width: 0;
}

.ho-chart-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 16px;
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  background: #f8fafc;
  border-radius: 12px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}

.section-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title {
  font-size: 15px;
  font-weight: 700;
  color: #111;
  margin: 0;
  font-family: "Sarabun", sans-serif !important;
}

@media (min-width: 768px) {
  .section-title {
    font-size: 18px;
  }
}
</style>
