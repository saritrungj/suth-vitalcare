<template>
  <div class="profile-dashboard font-sans p-2 md:p-6 bg-slate-50 min-h-screen">
    <div
      class="dashboard-header mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4"
    >
      <div>
        <h2 class="text-3xl font-black text-slate-800 tracking-tight">
          สรุปผลสุขภาพและกิจกรรม
        </h2>
        <p class="text-slate-500 mt-2 font-medium">
          ข้อมูลสรุปการเข้าร่วมกิจกรรมและผลประเมินรายบุคคล
        </p>
      </div>
      <button
        @click="fetchData"
        class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm"
      >
        <RefreshCcw :class="{ 'animate-spin': isLoading }" :size="18" />
        อัปเดตข้อมูล
      </button>
    </div>

    <div
      v-if="isLoading && assessments.length === 0"
      class="animate-pulse space-y-6"
    >
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div
          v-for="i in 4"
          :key="i"
          class="h-32 bg-slate-200 rounded-2xl"
        ></div>
      </div>
      <div class="h-80 bg-slate-200 rounded-2xl"></div>
    </div>

    <div v-else>
      <!-- Summary Grid -->
      <div class="dashboard-summary-grid mb-8">
        <div class="summary-card glass blue">
          <div class="card-icon"><MapPin :size="22" /></div>
          <div class="card-info">
            <div class="card-label">ระยะทางสะสม</div>
            <div class="card-value">
              {{ totalDistance.toFixed(2) }} <small>กม.</small>
            </div>
          </div>
        </div>

        <div class="summary-card glass orange">
          <div class="card-icon"><Activity :size="22" /></div>
          <div class="card-info">
            <div class="card-label">จำนวนก้าวสะสม</div>
            <div class="card-value">
              {{ totalSteps.toLocaleString() }} <small>ก้าว</small>
            </div>
          </div>
        </div>

        <div class="summary-card glass purple">
          <div class="card-icon"><Award :size="22" /></div>
          <div class="card-info">
            <div class="card-label">คะแนน VitalCare</div>
            <div class="card-value">
              {{ points.toLocaleString() }} <small>แต้ม</small>
            </div>
          </div>
        </div>

        <div class="summary-card glass teal">
          <div class="card-icon"><Droplets :size="22" /></div>
          <div class="card-info">
            <div class="card-label">ดื่มน้ำสะสม</div>
            <div class="card-value">{{ totalWater }} <small>ลิตร</small></div>
          </div>
        </div>
      </div>

      <!-- New-activity notifications -->
      <div v-if="recentActivityNotifs.length" class="content-card mb-8">
        <div class="flex items-center gap-2 mb-3">
          <Bell :size="18" class="text-indigo-500" />
          <h3 class="text-lg font-bold text-slate-800">กิจกรรมใหม่</h3>
        </div>
        <ul class="na-list">
          <li
            v-for="n in recentActivityNotifs"
            :key="n.id"
            class="na-item"
            :class="{ 'na-unread': !n.is_read }"
          >
            <router-link v-if="n.link_url" :to="n.link_url" class="na-link">
              <div class="na-title">{{ n.title }}</div>
              <div class="na-msg">{{ n.message }}</div>
            </router-link>
            <div v-else>
              <div class="na-title">{{ n.title }}</div>
              <div class="na-msg">{{ n.message }}</div>
            </div>
          </li>
        </ul>
      </div>

      <!-- Charts Row -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div class="content-card lg:col-span-2 flex flex-col">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-bold text-slate-800">
              แนวโน้มคะแนนประเมินสุขภาพ
            </h3>
            <div
              class="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full"
            >
              เฉลี่ย {{ avgAssessmentScore }} คะแนน
            </div>
          </div>
          <div class="flex-1 relative min-h-[300px]">
            <Line
              v-if="assessmentChartData.labels.length > 0"
              :data="assessmentChartData"
              :options="lineChartOptions"
            />
            <div
              v-else
              class="absolute inset-0 flex flex-col items-center justify-center text-slate-400 font-medium"
            >
              <FileText :size="48" class="opacity-20 mb-2" />
              ไม่พบประวัติการประเมิน
            </div>
          </div>
        </div>

        <div class="content-card flex flex-col">
          <h3 class="text-lg font-bold text-slate-800 mb-4">
            สถานะภารกิจทั้งหมด
          </h3>
          <div
            class="flex-1 relative min-h-[300px] flex items-center justify-center"
          >
            <Doughnut
              v-if="totalMissions > 0"
              :data="missionStatusData"
              :options="doughnutChartOptions"
            />
            <div
              v-else
              class="absolute inset-0 flex flex-col items-center justify-center text-slate-400 font-medium"
            >
              <ClipboardList :size="48" class="opacity-20 mb-2" />
              ยังไม่มีการส่งภารกิจ
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Data Row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Missions Summary -->
        <div class="content-card">
          <h3 class="text-lg font-bold text-slate-800 mb-5">
            สรุปกิจกรรมล่าสุด
          </h3>
          <div
            class="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar"
          >
            <div
              v-if="submissions.length === 0"
              class="py-12 text-center text-slate-400"
            >
              ไม่มีประวัติกิจกรรมล่าสุด
            </div>
            <div
              v-for="sub in submissions.slice(0, 10)"
              :key="sub.id"
              class="p-4 rounded-xl border border-slate-100 flex items-center gap-4 bg-slate-50/50 hover:bg-white hover:shadow-sm transition-all"
            >
              <div
                class="w-10 h-10 rounded-lg flex items-center justify-center"
                :class="
                  sub.status === 'approved'
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-amber-50 text-amber-600'
                "
              >
                <CheckCircle2 v-if="sub.status === 'approved'" :size="20" />
                <Clock v-else :size="20" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-bold text-sm text-slate-900 truncate">
                  {{ sub.tasks?.note || "ภารกิจกิจกรรม" }}
                </div>
                <div class="text-xs text-slate-500 mt-0.5 truncate">
                  {{ sub.value }} {{ sub.tasks?.metric_unit || "" }}
                </div>
              </div>
              <div class="text-right">
                <div class="text-xs font-bold text-slate-400">
                  {{ formatDate(sub.created_at) }}
                </div>
                <div
                  class="text-[10px] font-black uppercase mt-1"
                  :class="
                    sub.status === 'approved'
                      ? 'text-emerald-600'
                      : 'text-amber-600'
                  "
                >
                  {{ sub.status === "approved" ? "สำเร็จ" : "รอตรวจสอบ" }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Health Assessments -->
        <div class="content-card">
          <h3 class="text-lg font-bold text-slate-800 mb-5">
            ประวัติการทำแบบประเมิน
          </h3>
          <div
            class="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar"
          >
            <div
              v-if="assessments.length === 0"
              class="py-12 text-center text-slate-400"
            >
              ไม่มีประวัติแบบประเมิน
            </div>
            <div
              v-for="assessment in assessments"
              :key="assessment.id"
              class="p-4 rounded-xl border border-slate-100 flex justify-between items-center bg-slate-50/50 hover:bg-white hover:shadow-sm transition-all"
            >
              <div class="flex items-center gap-4">
                <div
                  class="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0"
                >
                  <FileText :size="22" />
                </div>
                <div>
                  <div class="font-bold text-sm text-slate-900">
                    แบบประเมินสุขภาพทั่วไป
                  </div>
                  <div class="text-xs text-slate-500 mt-1 font-medium">
                    {{ assessment.overall_level || "ระดับปกติ" }}
                  </div>
                </div>
              </div>
              <div class="text-right">
                <div class="text-2xl font-black text-slate-800">
                  {{ assessment.total_score }}
                </div>
                <div class="text-xs font-bold text-slate-400 mt-1">
                  {{ formatDate(assessment.created_at) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import {
  HeartPulse,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  ClipboardList,
  RefreshCcw,
  MapPin,
  Droplets,
  Award,
  TrendingUp,
  Bell,
} from "lucide-vue-next";

// Chart.js Imports
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Doughnut, Bar } from "vue-chartjs";
import { useNotifications } from "../composables/useNotifications";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const props = defineProps({
  user: Object,
  registrations: Array,
  submissions: Array,
  streak: Number,
  points: Number,
});

// ---------------- State Variables ----------------
const isLoading = ref(true);
const assessments = ref([]);

// New-activity notifications surfaced on the dashboard
const { items: appNotifications, fetchNotifications } = useNotifications();
const recentActivityNotifs = computed(() =>
  appNotifications.value
    .filter((n) => n.type === "activity_created")
    .slice(0, 4),
);
onMounted(() => fetchNotifications());

// ---------------- Computed Stats ----------------
const totalDistance = computed(() => {
  return props.submissions
    .filter(
      (s) =>
        s.status === "approved" &&
        (s.tasks?.metric_unit === "km" || s.tasks?.metric_unit === "distance"),
    )
    .reduce((sum, s) => sum + Number(s.value || 0), 0);
});

const totalSteps = computed(() => {
  return props.submissions
    .filter(
      (s) =>
        s.status === "approved" &&
        (s.tasks?.metric_unit === "steps" || s.tasks?.metric_unit === "step"),
    )
    .reduce((sum, s) => sum + Number(s.value || 0), 0);
});

const totalWater = computed(() => {
  return props.submissions
    .filter(
      (s) =>
        s.status === "approved" &&
        (s.tasks?.metric_unit === "glass" || s.tasks?.metric_unit === "water"),
    )
    .reduce((sum, s) => sum + Number(s.value || 0), 0);
});

const approvedCount = computed(
  () => props.submissions.filter((s) => s.status === "approved").length,
);
const pendingCount = computed(
  () => props.submissions.filter((s) => s.status === "pending").length,
);
const totalMissions = computed(() => props.submissions.length);

const avgAssessmentScore = computed(() => {
  if (assessments.value.length === 0) return 0;
  const sum = assessments.value.reduce(
    (acc, curr) => acc + (curr.total_score || 0),
    0,
  );
  return (sum / assessments.value.length).toFixed(1);
});

// ---------------- Chart Data ----------------
const assessmentChartData = computed(() => {
  if (assessments.value.length === 0) return { labels: [], datasets: [] };

  const sorted = [...assessments.value].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at),
  );
  const labels = sorted.map((a) =>
    new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" }).format(
      new Date(a.created_at),
    ),
  );
  const scores = sorted.map((a) => a.total_score);

  return {
    labels: labels,
    datasets: [
      {
        label: "คะแนนประเมินสุขภาพ",
        data: scores,
        borderColor: "#4f46e5",
        backgroundColor: "rgba(79, 70, 229, 0.1)",
        borderWidth: 3,
        pointBackgroundColor: "#ffffff",
        pointBorderColor: "#4f46e5",
        pointBorderWidth: 2,
        pointRadius: 4,
        fill: true,
        tension: 0.4,
      },
    ],
  };
});

const missionStatusData = computed(() => {
  return {
    labels: ["สำเร็จ", "รอตรวจสอบ", "อื่น ๆ"],
    datasets: [
      {
        data: [
          approvedCount.value,
          pendingCount.value,
          totalMissions.value - approvedCount.value - pendingCount.value,
        ],
        backgroundColor: ["#10b981", "#f59e0b", "#ef4444"],
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  };
});

// ---------------- Chart Options ----------------
const lineChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#1e293b",
      padding: 12,
      titleFont: { size: 14 },
      bodyFont: { size: 14, weight: "bold" },
    },
  },
  scales: {
    y: { beginAtZero: true, grid: { color: "#f1f5f9" } },
    x: { grid: { display: false } },
  },
};

const doughnutChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: "70%",
  plugins: {
    legend: {
      position: "bottom",
      labels: { usePointStyle: true, padding: 20, font: { weight: "bold" } },
    },
  },
};

// ---------------- Data Fetching ----------------
const fetchData = async () => {
  if (!props.user?.id) return;
  isLoading.value = true;
  try {
    const res = await fetch(`/api/health/my-assessments/${props.user.id}`);
    if (res.ok) {
      assessments.value = await res.json();
    }
  } catch (error) {
    console.error("Error fetching assessments:", error);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  fetchData();
});

// ---------------- UI Utilities ----------------
const formatDate = (dateString) => {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(dateString));
};

const formatTimeOnly = (dateString) => {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
};
</script>

<style scoped>
/* New-activity notifications list */
.na-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.na-item {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 10px 14px;
  transition: background-color 0.15s ease;
}
.na-item.na-unread {
  background: #eef2ff;
  border-color: #c7d2fe;
}
.na-link {
  text-decoration: none;
  display: block;
}
.na-title {
  font-weight: 700;
  font-size: 0.9rem;
  color: #1e293b;
}
.na-msg {
  font-size: 0.82rem;
  color: #64748b;
  margin-top: 2px;
}

/* Grid สำหรับ Summary Cards */
.dashboard-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
@media (min-width: 768px) {
  .dashboard-summary-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
  }
}

/* Card สไตล์ Glassmorphism เรียบหรู */
.summary-card {
  padding: 16px;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: #ffffff;
  border: 1px solid #f1f5f9;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.02);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}
@media (min-width: 1024px) {
  .summary-card {
    padding: 20px;
    border-radius: 20px;
  }
}

.summary-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
}

.summary-card.blue {
  border-bottom: 4px solid #3b82f6;
}
.summary-card.orange {
  border-bottom: 4px solid #f59e0b;
}
.summary-card.teal {
  border-bottom: 4px solid #14b8a6;
}
.summary-card.purple {
  border-bottom: 4px solid #8b5cf6;
}

.card-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.summary-card.blue .card-icon {
  background: #eff6ff;
  color: #3b82f6;
}
.summary-card.orange .card-icon {
  background: #fff7ed;
  color: #f59e0b;
}
.summary-card.teal .card-icon {
  background: #f0fdfa;
  color: #14b8a6;
}
.summary-card.purple .card-icon {
  background: #f5f3ff;
  color: #8b5cf6;
}

.card-label {
  font-size: 0.8rem;
  color: #64748b;
  font-weight: 700;
  margin-bottom: 4px;
}

.card-value {
  font-size: 1.55rem;
  font-weight: 900;
  color: #0f172a;
  line-height: 1.1;
  word-break: break-word;
}
@media (min-width: 1024px) {
  .card-value {
    font-size: 1.9rem;
  }
}

.card-value small {
  font-size: 0.85rem;
  font-weight: 600;
  color: #94a3b8;
  margin-left: 2px;
}

/* Card หลักสำหรับคอนเทนต์ */
.content-card {
  background: #ffffff;
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.02);
  border: 1px solid #f1f5f9;
}

/* Scrollbar สวยๆ */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
</style>
