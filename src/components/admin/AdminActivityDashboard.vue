<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { authStore } from "../../store/auth";
import {
  Download,
  Plus,
  MapPin,
  X,
  XCircle,
  Trash2,
  UploadCloud,
  Search,
  CheckCircle,
  Check,
  Save,
  Mail,
  Briefcase,
  Users,
  User,
  CalendarOff,
  BarChart2,
  Phone,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Settings,
  Target,
  Calendar,
  Award,
  AlertTriangle,
  CheckCircle2,
  Trophy,
  Clock,
  Info,
  UserX,
  MoreVertical,
  ChevronDown,
  Inbox,
  Activity,
  TrendingUp,
} from "lucide-vue-next";
import AppPagination from "../common/AppPagination.vue";
import { Doughnut, Line, Bar } from "vue-chartjs";
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  BarElement,
} from "chart.js";
ChartJS.register(
  Title,
  Tooltip,
  Legend,
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  BarElement,
);
import { swal } from "../../lib/swal";
import { safeImageUrl } from "../../lib/safeUrl";

const props = defineProps<{
  activityId: number;
  activityTitle: string;
}>();
const emit = defineEmits<{
  (e: "back"): void;
}>();
import { useAdminActivityDashboard } from "../../composables/useAdminActivityDashboard";
const {
  loading,
  registrants,
  teams,
  eventInfo,
  eventTasks,
  submissions,
  selectedUserIds,
  selectedSubmissionIds,
  isAssigningTeam,
  selectedTeamToAssign,
  activeTab,
  updatingId,
  searchQuery,
  selectedTaskIds,
  participantCols,
  submissionCols,
  rankingCols,
  viewOption,
  filteredRegistrants,
  filteredSubmissions,
  rankingsIndividual,
  rankingsTeam,
  rankingsTab,
  rankingsLoading,
  currentRankingList,
  filteredRankings,
  rankingTableData,
  fetchStats,
  fetchRankings,
  updateSubStatus,
  bulkUpdateSubmissionStatus,
  deleteSubmission,
  bulkDeleteSubmissions,
  assignTeam,
  removeParticipants,
  addParticipantPoints,
  toggleTaskFilter,
  totalParticipants,
  totalSubmissions,
  daysActive,
  registrationTimes,
  ageRanges,
  userTypes,
  genderStats,
  trackingDates,
  selectedYear,
  selectedMonth,
  yearOptions,
  monthOptions,
  goToMonth,
  goToToday,
  currentMonthColumns,
  currentMonthDates,
  visibleTasks,
  isTaskExpectedOnDate,
  userTrackingSheet,
  trackingMonthOptions,
  participationExpected,
  goalDisplay,
  userParticipationSheet,
  showMissedModal,
  selectedMissedUser,
  missedDetailsList,
  openMissedModal,
  showUserProfileModal,
  selectedUserProfile,
  selectedUserSubmissions,
  selectedUserRegistrations,
  profileLoading,
  openUserProfile,
  taskColors,
  calculateAge,
  formatDate,
  getTeamName,
  rankingUnitLong,
  isPoints,
  formatDist,
  teamColors,
  getYMD,
  todayStr,
  todayMonthKey,
  thaiMonthLong,
  exportTrackingSheet,
  exportingTracking,
  exportMonthlyExcel,
  isExportingExcel,
  tanitaChanges,
  assessmentComparison,
  assessmentPartStats,
  filteredTanitaChanges,
  filteredAssessmentComparison,
  loadingComparison,
  fetchComparisonData,
  advancedStats,
  updateSubmissionValue,
} = useAdminActivityDashboard(props.activityId, props.activityTitle);

const showBulkSubMenu = ref(false);
const activeMenuId = ref<number | string | null>(null);

const showPointsModal = ref(false);
const pointsParticipant = ref<any>(null);
const pointsTarget = ref<"shop" | "ranking">("ranking");
const pointsAmount = ref<number | null>(null);
const pointsReason = ref("");
const rankingScoreByUserId = computed(
  () =>
    new Map(
      rankingsIndividual.value.map((row: any) => [
        Number(row.id),
        Number(row.total_points) || 0,
      ]),
    ),
);
const getParticipantRankingScore = (participant: any) =>
  rankingScoreByUserId.value.get(Number(participant.user_id)) || 0;
const openPointsModal = (participant: any) => {
  pointsParticipant.value = participant;
  pointsTarget.value = "ranking";
  pointsAmount.value = null;
  pointsReason.value = "";
  showPointsModal.value = true;
};
const closePointsModal = () => {
  if (updatingId.value) return;
  showPointsModal.value = false;
  pointsParticipant.value = null;
};
const submitParticipantPoints = async () => {
  const participant = pointsParticipant.value;
  const amount = Number(pointsAmount.value);
  if (!participant || !Number.isSafeInteger(amount) || amount <= 0) {
    await swal.fire({
      icon: "warning",
      title: "กรุณาระบุคะแนน",
      text: "คะแนนต้องเป็นจำนวนเต็มมากกว่า 0",
    });
    return;
  }
  const saved = await addParticipantPoints(
    Number(participant.user_id),
    amount,
    pointsTarget.value,
    pointsReason.value.trim(),
  );
  if (saved) closePointsModal();
};

// Health Assessment Result Modal
const showAssessmentModal = ref(false);
const selectedAssessmentUser = ref<any>(null);
const assessmentModalLoading = ref(false);
const assessmentModalRecords = ref<any[]>([]);
const selectedAssessmentRecord = ref<any>(null);
const assessmentModalView = ref<"list" | "detail">("list");
const healthSectionIds = ["food", "exercise", "emotion", "smoke", "alcohol"];
const healthSectionLabels: Record<string, string> = {
  food: "1. พฤติกรรมการบริโภคอาหาร",
  exercise: "2. พฤติกรรมการออกกำลังกาย",
  emotion: "3. พฤติกรรมการจัดการอารมณ์",
  smoke: "4. พฤติกรรมการไม่สูบบุหรี่",
  alcohol: "5. พฤติกรรมการไม่ดื่มเครื่องดื่มที่มีแอลกอฮอล์",
};
const healthLevelMeta = (lvl: string) => {
  if (lvl === "ดีมาก")
    return {
      color: "#16a34a",
      bg: "#f0fdf4",
      badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    };
  if (lvl === "ดี")
    return {
      color: "#22c55e",
      bg: "#f0fdf4",
      badge: "bg-green-100 text-green-700 border-green-200",
    };
  if (lvl === "พอใช้")
    return {
      color: "#eab308",
      bg: "#fefce8",
      badge: "bg-yellow-100 text-yellow-700 border-yellow-200",
    };
  return {
    color: "#ef4444",
    bg: "#fef2f2",
    badge: "bg-rose-100 text-rose-700 border-rose-200",
  };
};
const openAssessmentModal = async (user: any) => {
  selectedAssessmentUser.value = user;
  assessmentModalView.value = "list";
  selectedAssessmentRecord.value = null;
  showAssessmentModal.value = true;
  assessmentModalLoading.value = true;
  assessmentModalRecords.value = [];
  try {
    const res = await fetch(`/api/activities/${props.activityId}/assessments`, {
      headers: { "x-user-id": String(authStore.user?.id || "") },
    });
    if (res.ok) {
      const all = await res.json();
      assessmentModalRecords.value = all.filter(
        (r: any) => r.user_id === user.user_id,
      );
    } else {
      const found = assessmentComparison.value.find(
        (a: any) => a.user_id === user.user_id,
      );
      if (found) {
        const recs = [];
        if (found.pre_score != null)
          recs.push({
            ...found,
            test_type: "pre_test",
            total_score: found.pre_score,
            created_at: found.pre_date,
            summary_json: found.section_scores,
          });
        if (found.post_score != null)
          recs.push({
            ...found,
            test_type: "post_test",
            total_score: found.post_score,
            created_at: found.post_date,
            summary_json: found.section_scores,
          });
        assessmentModalRecords.value = recs;
      }
    }
  } catch {
    const found = assessmentComparison.value.find(
      (a: any) => a.user_id === user.user_id,
    );
    if (found) {
      const recs = [];
      if (found.pre_score != null)
        recs.push({
          ...found,
          test_type: "pre_test",
          total_score: found.pre_score,
          created_at: found.pre_date,
        });
      if (found.post_score != null)
        recs.push({
          ...found,
          test_type: "post_test",
          total_score: found.post_score,
          created_at: found.post_date,
        });
      assessmentModalRecords.value = recs;
    }
  } finally {
    assessmentModalLoading.value = false;
  }
};
const parseSectionScores = (record: any) => {
  let raw =
    record?.summary_json ||
    record?.section_scores ||
    record?.sectionScores ||
    [];
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = [];
    }
  }
  return Array.isArray(raw) ? raw : [];
};
const activeMenuType = ref<"submission" | "participant" | null>(null);
const menuPos = ref({ top: 0, right: 0, transform: "" });
const toggleRowMenu = (
  id: number | string,
  event: MouseEvent,
  type: "submission" | "participant" = "submission",
) => {
  if (activeMenuId.value === id && activeMenuType.value === type) {
    activeMenuId.value = null;
    activeMenuType.value = null;
    return;
  }
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  menuPos.value = {
    top: rect.bottom + window.scrollY,
    right: window.innerWidth - rect.right,
    transform: "translateY(8px)",
  };
  activeMenuId.value = id;
  activeMenuType.value = type;
};
const showGenderModal = ref(false);
const pendingSubmissionsCount = computed(
  () => submissions.value.filter((s) => s.status === "pending").length,
);
const completedGoalCount = computed(
  () => registrants.value.filter((r) => r.goal_reached).length,
);
const inactiveCount = computed(
  () => registrants.value.filter((r) => r.submission_count === 0).length,
);
const daysRemainingText = computed(() => {
  if (!eventInfo.value) return "-";
  if (eventInfo.value.is_continuous_event) return "ต่อเนื่อง";
  if (!eventInfo.value.end_date) return "-";
  const now = new Date();
  const end = new Date(eventInfo.value.end_date);
  if (now > end) return "จบกิจกรรมแล้ว";
  const diffTime = Math.abs(end.getTime() - now.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return `${diffDays} วัน`;
});
const completionRate = computed(() => {
  if (totalParticipants.value === 0) return 0;
  return Math.round((completedGoalCount.value / totalParticipants.value) * 100);
});
const nestedUserTypes = computed(() => {
  const map = new Map<string, Record<string, number>>();
  registrants.value.forEach((r) => {
    const type = r.role_type || r.role || "อื่นๆ";
    const sub = r.role_detail_1 || "ไม่ระบุ";
    if (!map.has(type)) map.set(type, {});
    const subs = map.get(type)!;
    subs[sub] = (subs[sub] || 0) + 1;
  });
  return Array.from(map.entries()).sort((a, b) => {
    const sumA = Object.values(a[1]).reduce((s, c) => s + c, 0);
    const sumB = Object.values(b[1]).reduce((s, c) => s + c, 0);
    return sumB - sumA;
  });
});
const monthYearLabel = computed(() => {
  return `${thaiMonthLong[selectedMonth.value]} ${selectedYear.value}`;
});
const monthInput = computed({
  get() {
    const y = selectedYear.value;
    const m = String(selectedMonth.value + 1).padStart(2, "0");
    return `${y}-${m}`;
  },
  set(val) {
    if (val) {
      const [y, m] = val.split("-");
      selectedYear.value = parseInt(y, 10);
      selectedMonth.value = parseInt(m, 10) - 1;
    }
  },
});
const genderChartData = computed(() => ({
  labels: genderStats.value.map(([g]) => g),
  datasets: [
    {
      data: genderStats.value.map(([, c]) => c),
      backgroundColor: genderStats.value.map(([g]) =>
        g === "ชาย" ? "#60a5fa" : g === "หญิง" ? "#f472b6" : "#94a3b8",
      ),
      borderWidth: 0,
      hoverOffset: 8,
    },
  ],
}));
const registrationChartData = computed(() => ({
  labels: registrationTimes.value.map(([t]) => t.split(" ")[0]),
  datasets: [
    {
      label: "สมัคร",
      data: registrationTimes.value.map(([, c]) => Number(c)),
      backgroundColor: "rgba(249,115,22,0.08)",
      borderColor: "#f97316",
      borderWidth: 2.5,
      fill: true,
      tension: 0.4,
      pointBackgroundColor: "#f97316",
      pointBorderColor: "white",
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 7,
    },
  ],
}));
const donutOpts: any = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: "75%",
  plugins: {
    legend: { display: false },
    tooltip: {
      enabled: true,
      cornerRadius: 8,
      font: { family: "'Sarabun', sans-serif" },
    },
  },
};
const lineOpts: any = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      cornerRadius: 10,
      padding: 10,
      titleFont: { family: "'Sarabun',sans-serif", weight: "bold" },
      bodyFont: { family: "'Sarabun',sans-serif" },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: {
        font: { family: "'Sarabun',sans-serif", size: 10 },
        color: "#94a3b8",
        maxRotation: 40,
      },
      border: { display: false },
    },
    y: {
      grid: { color: "#f1f5f9" },
      ticks: {
        font: { family: "'Sarabun',sans-serif", size: 10 },
        color: "#94a3b8",
        precision: 0,
      },
      border: { display: false },
    },
  },
};
const barOpts: any = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      cornerRadius: 10,
      padding: 10,
      titleFont: { family: "'Sarabun',sans-serif", weight: "bold" },
      bodyFont: { family: "'Sarabun',sans-serif" },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: {
        font: { family: "'Sarabun',sans-serif", size: 10 },
        color: "#94a3b8",
      },
      border: { display: false },
    },
    y: {
      grid: { color: "#f1f5f9" },
      ticks: {
        font: { family: "'Sarabun',sans-serif", size: 10 },
        color: "#94a3b8",
        precision: 0,
      },
      border: { display: false },
    },
  },
};

const ageChartData = computed(() => ({
  labels: ageRanges.value.map(([range]) => range),
  datasets: [
    {
      label: "จำนวนคน",
      data: ageRanges.value.map(([, count]) => count),
      backgroundColor: "rgba(99,102,241,0.85)",
      hoverBackgroundColor: "#4f46e5",
      borderRadius: 6,
    },
  ],
}));

// กราฟสัดส่วน BMI แทนที่กราฟเวลา
const bmiChartData = computed(() => ({
  labels: [
    "ผอม (<18.5)",
    "ปกติ (18.5-22.9)",
    "ท้วม (23-24.9)",
    "อ้วน (25-29.9)",
    "อ้วนมาก (≥30)",
  ],
  datasets: [
    {
      label: "คน",
      data: advancedStats.value.bmiStats || [0, 0, 0, 0, 0],
      backgroundColor: ["#60a5fa", "#34d399", "#fbbf24", "#f87171", "#dc2626"],
      hoverBackgroundColor: [
        "#3b82f6",
        "#10b981",
        "#f59e0b",
        "#ef4444",
        "#b91c1c",
      ],
      borderRadius: 8,
    },
  ],
}));

const complianceChartData = computed(() => ({
  labels: ["ทำทันเวลา", "ส่งช้า/ไม่ส่ง"],
  datasets: [
    {
      data: [
        advancedStats.value.compliance.onTime,
        advancedStats.value.compliance.missed,
      ],
      backgroundColor: ["#10b981", "#f43f5e"],
      borderWidth: 0,
      hoverOffset: 8,
    },
  ],
}));

const showTeamDropdown = ref(false);
const isAllParticipantsSelected = computed(() => {
  return (
    filteredRegistrants.value.length > 0 &&
    selectedUserIds.value.length === filteredRegistrants.value.length
  );
});
const toggleSelectAllParticipants = () => {
  if (isAllParticipantsSelected.value) {
    selectedUserIds.value = [];
  } else {
    selectedUserIds.value = filteredRegistrants.value.map((r) => r.user_id);
  }
};
const toggleParticipantSelect = (id: number | string) => {
  const numId = Number(id);
  const index = selectedUserIds.value.indexOf(numId);
  if (index === -1) {
    selectedUserIds.value.push(numId);
  } else {
    selectedUserIds.value.splice(index, 1);
  }
};
const isAllSubmissionsSelected = computed(() => {
  return (
    filteredSubmissions.value.length > 0 &&
    selectedSubmissionIds.value.length === filteredSubmissions.value.length
  );
});
const toggleSelectAllSubmissions = () => {
  if (isAllSubmissionsSelected.value) {
    selectedSubmissionIds.value = [];
  } else {
    selectedSubmissionIds.value = filteredSubmissions.value.map((s) => s.id);
  }
};
const toggleSubmissionSelect = (id: number) => {
  const index = selectedSubmissionIds.value.indexOf(id);
  if (index === -1) {
    selectedSubmissionIds.value.push(id);
  } else {
    selectedSubmissionIds.value.splice(index, 1);
  }
};
const bulkUpdateSubStatus = async (status: "approved" | "rejected") => {
  for (const id of selectedSubmissionIds.value) {
    await updateSubStatus(id, status);
  }
  selectedSubmissionIds.value = [];
};
const perPageLimit = 10;
const registrantsPage = ref(1);
const trackingPage = ref(1);
const participationPage = ref(1);
const submissionsPage = ref(1);
const rankingsPage = ref(1);
const paginatedRegistrants = computed(() => {
  const start = (registrantsPage.value - 1) * perPageLimit;
  return filteredRegistrants.value.slice(start, start + perPageLimit);
});
const paginatedTrackingSheet = computed(() => {
  const start = (trackingPage.value - 1) * perPageLimit;
  return userTrackingSheet.value.slice(start, start + perPageLimit);
});
const paginatedParticipationSheet = computed(() => {
  const start = (participationPage.value - 1) * perPageLimit;
  return userParticipationSheet.value.slice(start, start + perPageLimit);
});
const paginatedSubmissions = computed(() => {
  const start = (submissionsPage.value - 1) * perPageLimit;
  return filteredSubmissions.value.slice(start, start + perPageLimit);
});
const paginatedRankings = computed(() => {
  const start = (rankingsPage.value - 1) * perPageLimit;
  return (filteredRankings.value || []).slice(start, start + perPageLimit);
});
watch([searchQuery, activeTab, selectedYear, selectedMonth], () => {
  registrantsPage.value = 1;
  trackingPage.value = 1;
  participationPage.value = 1;
  submissionsPage.value = 1;
  rankingsPage.value = 1;
  selectedUserIds.value = [];
  selectedSubmissionIds.value = [];
});
const kpiThemes = [
  {
    wrapper: "bg-gradient-to-br from-blue-50/80 to-white border-blue-200/60",
    iconBox: "bg-blue-100 text-blue-600",
    label: "text-blue-600/90",
    value: "text-blue-900",
    arrow: "text-blue-400 group-hover:text-blue-600",
  },
  {
    wrapper:
      "bg-gradient-to-br from-emerald-50/80 to-white border-emerald-200/60",
    iconBox: "bg-emerald-100 text-emerald-600",
    label: "text-emerald-600/90",
    value: "text-emerald-900",
    arrow: "text-emerald-400 group-hover:text-emerald-600",
  },
  {
    wrapper:
      "bg-gradient-to-br from-purple-50/80 to-white border-purple-200/60",
    iconBox: "bg-purple-100 text-purple-600",
    label: "text-purple-600/90",
    value: "text-purple-900",
    arrow: "text-purple-400 group-hover:text-purple-600",
  },
  {
    wrapper:
      "bg-gradient-to-br from-orange-50/80 to-white border-orange-200/60",
    iconBox: "bg-orange-100 text-orange-600",
    label: "text-orange-600/90",
    value: "text-orange-900",
    arrow: "text-orange-400 group-hover:text-orange-600",
  },
];
const handleEditTracking = async (sub: any) => {
  if (!sub) return;
  const unit = sub.metric_unit || sub.metric_type || "";
  const { value: newVal } = await swal.fire({
    title: "แก้ไขค่าที่ส่ง",
    text: `กรุณาระบุค่าใหม่ (${unit})`,
    input: "text",
    inputValue: sub.value,
    showCancelButton: true,
    confirmButtonText: "บันทึก",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#f97316",
    inputValidator: (value) => {
      if (!value && value !== "0") return "กรุณาระบุค่า";
      return null;
    },
  });
  if (newVal !== undefined) {
    await updateSubmissionValue(sub.id, newVal);
  }
};
</script>

<template>
  <div
    class="px-3 sm:px-6 md:px-8 py-4 sm:py-6 mb-8 space-y-4 sm:space-y-6 bg-white min-h-screen relative"
    style="font-family: &quot;Sarabun&quot;, sans-serif"
  >
    <div v-if="loading" class="space-y-6">
      <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <div
          v-for="i in 6"
          :key="i"
          class="rounded-2xl overflow-hidden animate-pulse"
          style="
            min-height: 150px;
            background: linear-gradient(135deg, #e2e8f0, #f1f5f9);
          "
        >
          <div class="h-full p-5 flex flex-col justify-between">
            <div class="w-10 h-10 rounded-xl bg-white/60"></div>
            <div class="space-y-2">
              <div class="h-8 w-16 bg-white/60 rounded-lg"></div>
              <div class="h-2 w-24 bg-white/40 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div
          v-for="i in 3"
          :key="'p' + i"
          class="h-64 rounded-2xl animate-pulse bg-slate-100"
        ></div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div
          v-for="i in 2"
          :key="'q' + i"
          class="h-52 rounded-2xl animate-pulse bg-slate-100"
        ></div>
      </div>
      <div class="flex items-center justify-center py-8 gap-3">
        <div
          class="w-6 h-6 border-4 border-orange-400 border-t-transparent rounded-full animate-spin"
        ></div>
        <span
          class="text-slate-400 font-bold text-sm"
          style="font-family: &quot;Sarabun&quot;, sans-serif"
          >กำลังโหลดข้อมูลกิจกรรม...</span
        >
      </div>
    </div>
    <template v-else>
      <div class="mb-4">
        <h1
          class="flex items-center gap-3 text-2xl sm:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-500"
        >
          <span>{{ eventInfo?.title || activityTitle }}</span>
        </h1>
        <p
          class="text-[10px] sm:text-xs font-bold text-slate-400 mt-0.5 uppercase tracking-wider"
        >
          จัดการข้อมูลและสถิติภาพรวมกิจกรรม #{{ activityId }}
        </p>
      </div>
      <div
        class="flex gap-2 overflow-x-auto whitespace-nowrap hide-scrollbar pb-2 mb-2 snap-x touch-pan-x"
      >
        <button
          @click="activeTab = 'overview'"
          class="snap-start shrink-0 px-5 py-2.5 rounded-full font-bold text-xs sm:text-sm transition-all duration-300 focus:outline-none shadow-sm"
          :class="
            activeTab === 'overview'
              ? 'bg-orange-500 text-white'
              : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
          "
        >
          ภาพรวม
        </button>
        <button
          @click="activeTab = 'participants'"
          class="snap-start shrink-0 px-5 py-2.5 rounded-full font-bold text-xs sm:text-sm transition-all duration-300 flex items-center gap-2 focus:outline-none shadow-sm"
          :class="
            activeTab === 'participants'
              ? 'bg-orange-500 text-white'
              : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
          "
        >
          รายชื่อผู้เข้าร่วม
        </button>
        <button
          @click="activeTab = 'submissions'"
          class="snap-start shrink-0 px-5 py-2.5 rounded-full font-bold text-xs sm:text-sm transition-all duration-300 focus:outline-none shadow-sm"
          :class="
            activeTab === 'submissions'
              ? 'bg-orange-500 text-white'
              : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
          "
        >
          การส่งภารกิจ
        </button>
        <button
          v-if="trackingDates && trackingDates.length > 0"
          @click="activeTab = 'tracking'"
          class="snap-start shrink-0 px-5 py-2.5 rounded-full font-bold text-xs sm:text-sm transition-all duration-300 focus:outline-none shadow-sm"
          :class="
            activeTab === 'tracking'
              ? 'bg-orange-500 text-white'
              : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
          "
        >
          ติดตามการส่งภารกิจ
        </button>
        <button
          v-if="trackingDates && trackingDates.length > 0"
          @click="activeTab = 'participation'"
          class="snap-start shrink-0 px-5 py-2.5 rounded-full font-bold text-xs sm:text-sm transition-all duration-300 focus:outline-none shadow-sm"
          :class="
            activeTab === 'participation'
              ? 'bg-orange-500 text-white'
              : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
          "
        >
          ร้อยละการเข้าร่วม
        </button>
        <button
          @click="
            activeTab = 'rankings';
            fetchRankings();
          "
          class="snap-start shrink-0 px-5 py-2.5 rounded-full font-bold text-xs sm:text-sm transition-all duration-300 focus:outline-none shadow-sm"
          :class="
            activeTab === 'rankings'
              ? 'bg-orange-500 text-white'
              : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
          "
        >
          อันดับ
        </button>
        <button
          @click="
            activeTab = 'changes';
            fetchComparisonData();
          "
          class="snap-start shrink-0 px-5 py-2.5 rounded-full font-bold text-xs sm:text-sm transition-all duration-300 focus:outline-none shadow-sm"
          :class="
            activeTab === 'changes'
              ? 'bg-orange-500 text-white'
              : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
          "
        >
          เปรียบเทียบค่าร่างกาย
        </button>
        <button
          @click="
            activeTab = 'responses';
            fetchComparisonData();
          "
          class="snap-start shrink-0 px-5 py-2.5 rounded-full font-bold text-xs sm:text-sm transition-all duration-300 focus:outline-none shadow-sm"
          :class="
            activeTab === 'responses'
              ? 'bg-orange-500 text-white'
              : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
          "
        >
          เปรียบเทียบผลทดสอบ
        </button>
      </div>
      <div v-if="activeTab === 'overview'" class="space-y-6">
        <div
          class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4"
        >
          <div
            :class="[
              'ov-card group relative overflow-hidden soft-shadow transition-all duration-300 hover:-translate-y-1',
              kpiThemes[0].wrapper,
            ]"
          >
            <div
              class="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-40 blur-2xl transition-all duration-500 group-hover:scale-150 bg-blue-200"
            ></div>
            <div
              class="flex flex-col h-full justify-between gap-3 relative z-10"
            >
              <div>
                <div
                  :class="[
                    'w-10 h-10 flex items-center justify-center rounded-xl mb-2',
                    kpiThemes[0].iconBox,
                  ]"
                >
                  <Users :size="20" />
                </div>
                <div
                  :class="[
                    'text-[10px] sm:text-[11px] font-bold uppercase tracking-widest',
                    kpiThemes[0].label,
                  ]"
                >
                  สมาชิกทั้งหมด
                </div>
              </div>
              <div>
                <div class="flex items-baseline gap-1">
                  <span
                    :class="[
                      'text-3xl sm:text-4xl font-black tracking-tight',
                      kpiThemes[0].value,
                    ]"
                    >{{ totalParticipants }}</span
                  >
                  <span :class="['text-xs font-bold', kpiThemes[0].label]"
                    >คน</span
                  >
                </div>
                <p
                  class="text-[10px] mt-1.5 font-bold"
                  :class="kpiThemes[0].label"
                >
                  <span
                    class="bg-blue-100/50 px-2 py-0.5 rounded-lg text-blue-700"
                    >{{ advancedStats.activeParticipants.percentage }}%</span
                  >
                  มีส่วนร่วม
                </p>
              </div>
            </div>
          </div>
          <div
            @click="activeTab = 'submissions'"
            :class="[
              'ov-card group cursor-pointer relative overflow-hidden soft-shadow transition-all duration-300 hover:-translate-y-1',
              kpiThemes[1].wrapper,
            ]"
          >
            <div
              class="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-40 blur-2xl transition-all duration-500 group-hover:scale-150 bg-emerald-200"
            ></div>
            <div
              class="flex flex-col h-full justify-between gap-3 relative z-10"
            >
              <div>
                <div
                  :class="[
                    'w-10 h-10 flex items-center justify-center rounded-xl mb-2',
                    kpiThemes[1].iconBox,
                  ]"
                >
                  <Activity :size="20" />
                </div>
                <div
                  :class="[
                    'text-[10px] sm:text-[11px] font-bold uppercase tracking-widest',
                    kpiThemes[1].label,
                  ]"
                >
                  ส่งภารกิจ
                </div>
              </div>
              <div>
                <div class="flex items-baseline gap-1">
                  <span
                    :class="[
                      'text-3xl sm:text-4xl font-black tracking-tight',
                      kpiThemes[1].value,
                    ]"
                    >{{ totalSubmissions }}</span
                  >
                  <span :class="['text-xs font-bold', kpiThemes[1].label]"
                    >รายการ</span
                  >
                </div>
                <p
                  class="text-[10px] mt-1.5 font-bold"
                  :class="kpiThemes[1].label"
                >
                  <span
                    class="bg-emerald-100/50 px-2 py-0.5 rounded-lg text-emerald-700"
                    >ตรงเวลา
                    {{ advancedStats.compliance.onTimePercentage }}%</span
                  >
                  พลาด {{ advancedStats.compliance.missed }}
                </p>
              </div>
            </div>
          </div>
          <div
            :class="[
              'ov-card group relative overflow-hidden soft-shadow transition-all duration-300 hover:-translate-y-1',
              kpiThemes[2].wrapper,
            ]"
          >
            <div
              class="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-40 blur-2xl transition-all duration-500 group-hover:scale-150 bg-purple-200"
            ></div>
            <div
              class="flex flex-col h-full justify-between gap-3 relative z-10"
            >
              <div>
                <div
                  :class="[
                    'w-10 h-10 flex items-center justify-center rounded-xl mb-2',
                    kpiThemes[2].iconBox,
                  ]"
                >
                  <Target :size="20" />
                </div>
                <div
                  :class="[
                    'text-[10px] sm:text-[11px] font-bold uppercase tracking-widest',
                    kpiThemes[2].label,
                  ]"
                >
                  ถึงเป้าหมาย
                </div>
                <div
                  v-if="goalDisplay"
                  :class="[
                    'text-[9px] font-bold mt-0.5 leading-snug',
                    kpiThemes[2].label,
                  ]"
                >
                  {{ goalDisplay.label }}: {{ goalDisplay.value }}
                  {{ goalDisplay.unit }}
                </div>
              </div>
              <div>
                <div class="flex items-baseline gap-1">
                  <span
                    :class="[
                      'text-3xl sm:text-4xl font-black tracking-tight',
                      kpiThemes[2].value,
                    ]"
                    >{{ advancedStats.goals.reached }}</span
                  >
                  <span :class="['text-xs font-bold', kpiThemes[2].label]"
                    >/ {{ advancedStats.goals.total }} คน</span
                  >
                </div>
                <div
                  class="mt-2 w-full h-1.5 bg-purple-100 rounded-full overflow-hidden"
                >
                  <div
                    class="h-full bg-purple-500 rounded-full transition-all duration-1000"
                    :style="{ width: advancedStats.goals.completionRate + '%' }"
                  ></div>
                </div>
                <p
                  class="text-[10px] mt-1 font-bold"
                  :class="kpiThemes[2].label"
                >
                  {{ advancedStats.goals.completionRate }}% บรรลุเป้าหมาย
                </p>
              </div>
            </div>
          </div>
          <div
            :class="[
              'ov-card group relative overflow-hidden soft-shadow transition-all duration-300 hover:-translate-y-1',
              kpiThemes[3].wrapper,
            ]"
          >
            <div
              class="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-40 blur-2xl transition-all duration-500 group-hover:scale-150 bg-orange-200"
            ></div>
            <div
              class="flex flex-col h-full justify-between gap-3 relative z-10"
            >
              <div>
                <div
                  :class="[
                    'w-10 h-10 flex items-center justify-center rounded-xl mb-2',
                    kpiThemes[3].iconBox,
                  ]"
                >
                  <Clock :size="20" />
                </div>
                <div
                  :class="[
                    'text-[10px] sm:text-[11px] font-bold uppercase tracking-widest',
                    kpiThemes[3].label,
                  ]"
                >
                  เวลาที่เหลือ
                </div>
              </div>
              <div>
                <div
                  :class="[
                    'text-2xl sm:text-3xl font-black tracking-tight',
                    kpiThemes[3].value,
                  ]"
                >
                  {{ daysRemainingText }}
                </div>
                <p :class="['text-[10px] mt-1 font-bold', kpiThemes[3].label]">
                  {{
                    eventInfo?.is_continuous_event
                      ? "ต่อเนื่อง"
                      : eventInfo?.end_date
                        ? new Date(eventInfo.end_date).toLocaleDateString(
                            "th-TH",
                            { day: "numeric", month: "short", year: "numeric" },
                          )
                        : "-"
                  }}
                </p>
              </div>
            </div>
          </div>
          <div
            @click="
              activeTab = 'rankings';
              fetchRankings();
            "
            :class="[
              'ov-card group cursor-pointer col-span-2 xl:col-span-2 relative overflow-hidden soft-shadow transition-all duration-300 hover:-translate-y-1',
              kpiThemes[0].wrapper,
            ]"
          >
            <div
              class="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-30 blur-2xl transition-all duration-500 group-hover:scale-150 bg-blue-200"
            ></div>
            <div
              class="flex flex-col h-full justify-between gap-3 relative z-10"
            >
              <div class="flex items-start justify-between">
                <div>
                  <div
                    :class="[
                      'w-10 h-10 flex items-center justify-center rounded-xl mb-2',
                      kpiThemes[0].iconBox,
                    ]"
                  >
                    <Trophy :size="20" />
                  </div>
                  <div
                    :class="[
                      'text-[10px] sm:text-[11px] font-bold uppercase tracking-widest',
                      kpiThemes[0].label,
                    ]"
                  >
                    อันดับคะแนน
                  </div>
                </div>
                <div class="flex flex-col gap-0.5 text-right shrink-0">
                  <div :class="['text-[10px] font-bold', kpiThemes[0].label]">
                    สูง
                    <span :class="['font-black', kpiThemes[0].value]">{{
                      advancedStats.rankings.max
                    }}</span>
                  </div>
                  <div :class="['text-[10px] font-bold', kpiThemes[0].label]">
                    เฉลี่ย
                    <span :class="['font-black', kpiThemes[0].value]">{{
                      advancedStats.rankings.avg
                    }}</span>
                  </div>
                  <div :class="['text-[10px] font-bold', kpiThemes[0].label]">
                    ต่ำ
                    <span :class="['font-black', kpiThemes[0].value]">{{
                      advancedStats.rankings.min
                    }}</span>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <div
                  v-for="(user, idx) in advancedStats.rankings.top3"
                  :key="idx"
                  class="flex-1 flex items-center gap-1.5 bg-white/60 p-2 rounded-xl border border-blue-200/50 min-w-0 soft-shadow-sm"
                >
                  <div
                    class="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center font-black text-xs text-white shrink-0 shadow-lg"
                  >
                    {{ idx + 1 }}
                  </div>
                  <div class="flex flex-col min-w-0">
                    <span
                      :class="[
                        'text-[11px] font-bold truncate',
                        kpiThemes[0].value,
                      ]"
                      >{{ user.fname_th }}</span
                    >
                    <span
                      :class="['text-[10px] font-black', kpiThemes[0].label]"
                      >{{ user.total_points || user.score }}
                      <span class="font-normal opacity-70">pts</span></span
                    >
                  </div>
                </div>
                <div
                  v-if="!advancedStats.rankings.top3?.length"
                  :class="['text-xs font-bold py-2', kpiThemes[0].label]"
                >
                  กำลังรวบรวบคะแนน...
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
          <div class="ov-panel flex flex-col min-h-[350px]">
            <div class="ov-panel-header shrink-0">
              <div class="flex items-center gap-2">
                <Users :size="16" class="text-blue-500" />
                <span class="text-sm">สัดส่วนเพศ</span>
              </div>
            </div>

            <div class="flex-1 flex flex-col items-center justify-between py-6">
              <div
                v-if="genderStats.length > 0"
                class="relative w-full max-w-[180px] aspect-square shrink-0"
              >
                <Doughnut :data="genderChartData" :options="donutOpts" />
                <div
                  class="absolute inset-0 flex items-center justify-center pointer-events-none"
                >
                  <div class="text-center translate-y-[-2px]">
                    <div
                      class="text-3xl font-black text-slate-800 leading-none"
                    >
                      {{ totalParticipants }}
                    </div>
                    <div class="text-[12px] text-slate-400 font-bold mt-1">
                      คน
                    </div>
                  </div>
                </div>
              </div>
              <div
                v-else
                class="flex flex-col items-center justify-center w-full h-full text-slate-300 gap-3"
              >
                <Inbox :size="24" class="text-slate-300" />
                <span class="text-[11px] font-bold text-slate-400"
                  >ไม่มีข้อมูล</span
                >
              </div>

              <div v-if="genderStats.length > 0" class="w-full mt-6 px-2">
                <div class="flex flex-wrap justify-center gap-x-4 gap-y-2">
                  <div
                    v-for="[label, count] in genderStats"
                    :key="label"
                    class="flex items-center gap-2"
                  >
                    <span
                      class="w-2.5 h-2.5 rounded-full shrink-0"
                      :style="{
                        backgroundColor:
                          label === 'ชาย'
                            ? '#60a5fa'
                            : label === 'หญิง'
                              ? '#f472b6'
                              : '#94a3b8',
                      }"
                    >
                    </span>
                    <span class="text-[11px] font-bold text-slate-600"
                      >{{ label }} {{ count }} คน</span
                    >
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="ov-panel flex flex-col">
            <div class="ov-panel-header shrink-0">
              <div class="flex items-center gap-2">
                <User :size="16" class="text-indigo-500" />
                <span class="text-sm">สัดส่วนอายุ</span>
              </div>
            </div>
            <div class="flex-1 relative flex flex-col justify-center py-4">
              <div v-if="ageRanges.length > 0" class="w-full h-[200px]">
                <Bar :data="ageChartData" :options="barOpts" />
              </div>
              <div
                v-else
                class="flex flex-col items-center justify-center w-full h-full text-slate-300 gap-3"
              >
                <Inbox :size="24" class="text-slate-300" />
                <span class="text-[11px] font-bold text-slate-400"
                  >ไม่มีข้อมูล</span
                >
              </div>
            </div>
          </div>

          <div class="ov-panel flex flex-col">
            <div class="ov-panel-header shrink-0">
              <div class="flex items-center gap-2">
                <Briefcase :size="16" class="text-orange-500" />
                <span class="text-sm">ประเภทและสถานะผู้เข้าร่วม</span>
              </div>
            </div>
            <div
              class="flex-1 overflow-y-auto custom-scroll pr-1 relative mt-2 space-y-4 max-h-[260px]"
            >
              <div v-if="Object.keys(advancedStats.userTypes).length > 0">
                <div
                  class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2"
                >
                  ประเภท
                </div>
                <div class="space-y-2">
                  <div
                    v-for="(count, type) in advancedStats.userTypes"
                    :key="type"
                    class="flex items-center gap-2"
                  >
                    <span
                      class="text-[12px] font-bold text-slate-700 w-24 shrink-0 truncate"
                      >{{ type }}</span
                    >
                    <div
                      class="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"
                    >
                      <div
                        class="h-full bg-orange-400 rounded-full"
                        :style="{
                          width: (count / (totalParticipants || 1)) * 100 + '%',
                        }"
                      ></div>
                    </div>
                    <span
                      class="text-[11px] font-black text-slate-500 shrink-0 w-12 text-right"
                      >{{ count }} คน ({{
                        ((count / (totalParticipants || 1)) * 100).toFixed(0)
                      }}%)</span
                    >
                  </div>
                </div>
              </div>
              <div v-if="Object.keys(advancedStats.userYears).length > 0">
                <div
                  class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2"
                >
                  ชั้นปี / ระดับ
                </div>
                <div class="space-y-2">
                  <div
                    v-for="(count, year) in advancedStats.userYears"
                    :key="year"
                    class="flex items-center gap-2"
                  >
                    <span
                      class="text-[12px] font-bold text-slate-700 w-24 shrink-0 truncate"
                      >{{ year }}</span
                    >
                    <div
                      class="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"
                    >
                      <div
                        class="h-full bg-indigo-400 rounded-full"
                        :style="{
                          width: (count / (totalParticipants || 1)) * 100 + '%',
                        }"
                      ></div>
                    </div>
                    <span
                      class="text-[11px] font-black text-slate-500 shrink-0 w-12 text-right"
                      >{{ count }} คน ({{
                        ((count / (totalParticipants || 1)) * 100).toFixed(0)
                      }}%)</span
                    >
                  </div>
                </div>
              </div>
              <div v-if="Object.keys(advancedStats.userRoles).length > 0">
                <div
                  class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2"
                >
                  คณะ / หน่วยงาน
                </div>
                <div class="space-y-2">
                  <div
                    v-for="(count, faculty) in advancedStats.userRoles"
                    :key="faculty"
                    class="flex items-center gap-2"
                  >
                    <span
                      class="text-[12px] font-bold text-slate-700 w-24 shrink-0 truncate"
                      >{{ faculty }}</span
                    >
                    <div
                      class="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"
                    >
                      <div
                        class="h-full bg-teal-400 rounded-full"
                        :style="{
                          width: (count / (totalParticipants || 1)) * 100 + '%',
                        }"
                      ></div>
                    </div>
                    <span
                      class="text-[11px] font-black text-slate-500 shrink-0 w-12 text-right"
                      >{{ count }} คน ({{
                        ((count / (totalParticipants || 1)) * 100).toFixed(0)
                      }}%)</span
                    >
                  </div>
                </div>
              </div>
              <div v-if="Object.keys(advancedStats.mainGoals).length > 0">
                <div
                  class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2"
                >
                  เป้าหมายของผู้เข้าร่วม
                </div>
                <div class="space-y-2">
                  <div
                    v-for="(count, goal) in advancedStats.mainGoals"
                    :key="goal"
                    class="flex items-center gap-2"
                  >
                    <span
                      class="text-[12px] font-bold text-slate-700 w-24 shrink-0 truncate"
                      >{{ goal }}</span
                    >
                    <div
                      class="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"
                    >
                      <div
                        class="h-full bg-emerald-400 rounded-full"
                        :style="{
                          width: (count / (totalParticipants || 1)) * 100 + '%',
                        }"
                      ></div>
                    </div>
                    <span
                      class="text-[11px] font-black text-slate-500 shrink-0 w-12 text-right"
                      >{{ count }} คน ({{
                        ((count / (totalParticipants || 1)) * 100).toFixed(0)
                      }}%)</span
                    >
                  </div>
                </div>
              </div>
              <div
                v-if="Object.keys(advancedStats.userTypes).length === 0"
                class="flex flex-col items-center justify-center absolute inset-0 text-slate-300 gap-3"
              >
                <Inbox :size="24" class="text-slate-300" />
                <span class="text-[11px] font-bold text-slate-400"
                  >ไม่มีข้อมูล</span
                >
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
          <div class="ov-panel flex flex-col min-h-[350px]">
            <div class="ov-panel-header shrink-0">
              <div class="flex items-center gap-2">
                <CalendarDays :size="16" class="text-emerald-500" />
                <span class="text-sm">การส่งตรงเวลา</span>
              </div>
            </div>

            <div class="flex-1 flex flex-col items-center justify-between py-6">
              <div
                v-if="
                  advancedStats.compliance.onTime > 0 ||
                  advancedStats.compliance.missed > 0
                "
                class="relative w-full max-w-[180px] aspect-square shrink-0"
              >
                <Doughnut :data="complianceChartData" :options="donutOpts" />
                <div
                  class="absolute inset-0 flex items-center justify-center pointer-events-none"
                >
                  <div class="text-center translate-y-[-2px]">
                    <div
                      class="text-3xl font-black text-emerald-500 leading-none"
                    >
                      {{ advancedStats.compliance.onTimePercentage }}%
                    </div>
                    <div class="text-[11px] text-slate-400 font-bold mt-1">
                      ตรงเวลา
                    </div>
                  </div>
                </div>
              </div>
              <div
                v-else
                class="flex flex-col items-center justify-center w-full h-full text-slate-300 gap-3"
              >
                <Inbox :size="24" class="text-slate-300" />
                <span class="text-[11px] font-bold text-slate-400"
                  >ยังไม่มีข้อมูลการส่ง</span
                >
              </div>

              <div
                v-if="
                  advancedStats.compliance.onTime > 0 ||
                  advancedStats.compliance.missed > 0
                "
                class="w-full mt-6 px-2"
              >
                <div class="flex flex-wrap justify-center gap-x-4 gap-y-2">
                  <div class="flex items-center gap-2">
                    <span
                      class="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"
                    ></span>
                    <span class="text-[11px] font-bold text-slate-600"
                      >ตรงเวลา {{ advancedStats.compliance.onTime }}</span
                    >
                  </div>
                  <div class="flex items-center gap-2">
                    <span
                      class="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"
                    ></span>
                    <span class="text-[11px] font-bold text-slate-600"
                      >ช้า/ไม่ส่ง {{ advancedStats.compliance.missed }}</span
                    >
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="ov-panel flex flex-col">
            <div class="ov-panel-header shrink-0">
              <div class="flex items-center gap-2">
                <Activity :size="16" class="text-blue-500" />
                <span class="text-sm">สัดส่วน BMI ของผู้เข้าร่วม</span>
              </div>
            </div>
            <div class="flex-1 relative flex flex-col justify-center py-4">
              <div
                v-if="
                  advancedStats.bmiStats &&
                  advancedStats.bmiStats.some((v) => v > 0)
                "
                class="w-full h-[200px]"
              >
                <Bar :data="bmiChartData" :options="barOpts" />
              </div>
              <div
                v-else
                class="flex flex-col items-center justify-center w-full h-full text-slate-300 gap-3"
              >
                <Inbox :size="24" class="text-slate-300" />
                <span class="text-[11px] font-bold text-slate-400"
                  >ยังไม่มีข้อมูล BMI จากการบันทึกค่าร่างกาย</span
                >
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
          <div
            class="ov-panel flex flex-col"
            @click="
              activeTab = 'changes';
              fetchComparisonData();
            "
          >
            <div
              class="ov-panel-header shrink-0 cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <div class="flex items-center gap-2">
                <span
                  class="w-8 h-8 shrink-0 rounded-xl bg-rose-50 flex items-center justify-center border border-rose-100"
                  ><Activity :size="16" class="text-rose-500"
                /></span>
                <span class="text-sm">ภาพรวมค่าองค์ประกอบร่างกาย</span>
              </div>
              <ChevronRight :size="16" class="text-slate-400 shrink-0" />
            </div>
            <div class="flex-1 p-4">
              <div v-if="advancedStats.tanita.total > 0" class="space-y-4">
                <div
                  class="flex flex-wrap sm:flex-nowrap items-center justify-between bg-emerald-50 p-3 rounded-2xl border border-emerald-100 gap-2"
                >
                  <div class="flex items-center gap-2 shrink-0">
                    <TrendingUp :size="20" class="text-emerald-500 shrink-0" />
                    <span class="font-bold text-emerald-700 text-sm"
                      >น้ำหนักลดลง / ทรงตัว</span
                    >
                  </div>
                  <span class="text-lg font-black text-emerald-600 shrink-0"
                    >{{ advancedStats.tanita.improvedPercentage }}%</span
                  >
                </div>

                <div class="grid grid-cols-1 gap-3">
                  <div
                    v-for="(data, gender) in advancedStats.tanita.byGender"
                    :key="gender"
                    class="bg-slate-50 p-3 rounded-xl border border-slate-100"
                  >
                    <div
                      class="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3 border-b border-slate-200/50 pb-1.5"
                    >
                      {{ gender }}
                    </div>

                    <div
                      class="flex items-center justify-center sm:justify-around gap-2 flex-wrap sm:flex-nowrap"
                    >
                      <div
                        class="flex flex-col items-center flex-1 min-w-[70px]"
                      >
                        <div
                          class="w-12 h-12 shrink-0 rounded-full bg-emerald-100 flex items-center justify-center border border-emerald-200 mb-1.5 shadow-sm"
                        >
                          <span class="text-lg font-black text-emerald-600">{{
                            data.improved
                          }}</span>
                        </div>
                        <span
                          class="text-[10px] sm:text-xs font-bold text-slate-500"
                          >ดีขึ้น</span
                        >
                      </div>

                      <div
                        class="flex flex-col items-center flex-1 min-w-[70px]"
                      >
                        <div
                          class="w-12 h-12 shrink-0 rounded-full bg-blue-100 flex items-center justify-center border border-blue-200 mb-1.5 shadow-sm"
                        >
                          <span class="text-lg font-black text-blue-600">{{
                            data.stable
                          }}</span>
                        </div>
                        <span
                          class="text-[10px] sm:text-xs font-bold text-slate-500"
                          >คงที่</span
                        >
                      </div>

                      <div
                        class="flex flex-col items-center flex-1 min-w-[70px]"
                      >
                        <div
                          class="w-12 h-12 shrink-0 rounded-full bg-rose-100 flex items-center justify-center border border-rose-200 mb-1.5 shadow-sm"
                        >
                          <span class="text-lg font-black text-rose-600">{{
                            data.warning
                          }}</span>
                        </div>
                        <span
                          class="text-[10px] sm:text-xs font-bold text-slate-500"
                          >เฝ้าระวัง</span
                        >
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div
                v-else
                class="flex flex-col items-center justify-center h-full text-slate-300 py-6 gap-3"
              >
                <Inbox :size="24" class="text-slate-300 shrink-0" />
                <span class="text-[11px] font-bold text-slate-400"
                  >ยังไม่มีข้อมูลเปรียบเทียบ</span
                >
              </div>
            </div>
          </div>
          <div
            class="ov-panel flex flex-col"
            @click="
              activeTab = 'responses';
              fetchComparisonData();
            "
          >
            <div
              class="ov-panel-header shrink-0 cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <div class="flex items-center gap-2">
                <span
                  class="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center border border-purple-100"
                  ><FileText :size="16" class="text-purple-500"
                /></span>
                <span class="text-sm">คะแนนแบบทดสอบสุขภาพ</span>
              </div>
              <ChevronRight :size="16" class="text-slate-400" />
            </div>
            <div class="flex-1 p-4">
              <div v-if="advancedStats.assessment.total > 0" class="space-y-4">
                <div class="flex items-center justify-center gap-6">
                  <div class="flex flex-col items-center text-center">
                    <span
                      class="w-11 h-11 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 text-base font-black text-slate-400"
                      >{{ advancedStats.assessment.min }}</span
                    >
                    <span
                      class="text-[10px] font-bold text-slate-400 mt-1.5 uppercase tracking-widest"
                      >ต่ำสุด</span
                    >
                  </div>
                  <div class="flex flex-col items-center text-center">
                    <span
                      class="w-14 h-14 rounded-full bg-purple-50 flex items-center justify-center border-2 border-purple-200 text-xl font-black text-purple-600 shadow-sm"
                      >{{ advancedStats.assessment.avg }}</span
                    >
                    <span
                      class="text-[11px] font-bold text-purple-600 mt-1.5 uppercase tracking-widest"
                      >เฉลี่ย</span
                    >
                  </div>
                  <div class="flex flex-col items-center text-center">
                    <span
                      class="w-11 h-11 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100 text-base font-black text-emerald-500"
                      >{{ advancedStats.assessment.max }}</span
                    >
                    <span
                      class="text-[10px] font-bold text-slate-400 mt-1.5 uppercase tracking-widest"
                      >สูงสุด</span
                    >
                  </div>
                </div>
                <div
                  v-if="
                    assessmentPartStats.partStats &&
                    assessmentPartStats.partStats.length > 0
                  "
                  class="space-y-1.5"
                >
                  <div
                    class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1"
                  >
                    คะแนนแยกตามหมวด
                  </div>
                  <div
                    v-for="part in assessmentPartStats.partStats.slice(0, 4)"
                    :key="part.part_id || part.part_name"
                    class="flex items-center gap-2"
                  >
                    <span
                      class="text-[11px] font-bold text-slate-600 w-20 shrink-0 truncate"
                      :title="part.part_name"
                      >{{ part.part_name || "หมวด " + part.part_id }}</span
                    >
                    <div
                      class="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden"
                    >
                      <div
                        class="h-full bg-purple-400 rounded-full"
                        :style="{
                          width:
                            (part.avg_score /
                              (part.max_possible || part.max_score || 100)) *
                              100 +
                            '%',
                        }"
                      ></div>
                    </div>
                    <span class="text-[10px] font-black text-slate-500 shrink-0"
                      >เฉลี่ย {{ Number(part.avg_score).toFixed(1) }}</span
                    >
                  </div>
                </div>
                <p class="text-[11px] font-medium text-slate-400 text-center">
                  จาก
                  <span class="font-bold text-slate-600">{{
                    advancedStats.assessment.total
                  }}</span>
                  รายการ
                </p>
              </div>
              <div
                v-else
                class="flex flex-col items-center justify-center h-full text-slate-300 py-6 gap-3"
              >
                <Inbox :size="24" class="text-slate-300" />
                <span class="text-[11px] font-bold text-slate-400"
                  >ยังไม่มีข้อมูลทดสอบ</span
                >
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-else-if="activeTab === 'participants'" class="space-y-5">
        <div class="flex items-center justify-between">
          <div class="search-pill-container">
            <Search :size="18" class="search-icon" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="ค้นหาชื่อ นามสกุล หรือทีม..."
            />
          </div>
          <div class="hidden md:block">
            <span
              class="text-[11px] font-bold text-slate-400 uppercase tracking-wider"
            >
              ผู้เข้าร่วมทั้งหมด {{ filteredRegistrants.length }} รายการ
            </span>
          </div>
        </div>
        <div
          class="overflow-x-auto custom-scroll w-full border border-slate-200 rounded-2xl bg-white relative custom-table-wrapper"
        >
          <table
            class="w-full text-left border-separate border-spacing-0 whitespace-nowrap text-sm"
          >
            <thead
              class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200"
            >
              <tr>
                <th
                  class="p-4 w-[52px] min-w-[52px] max-w-[52px] text-center border-r border-slate-100 sticky left-0 bg-slate-50 z-20"
                >
                  <div
                    @click="toggleSelectAllParticipants"
                    class="w-5 h-5 mx-auto rounded-full border-2 flex items-center justify-center cursor-pointer transition-all"
                    :class="
                      isAllParticipantsSelected
                        ? 'bg-indigo-600 border-indigo-600'
                        : 'bg-white border-slate-300'
                    "
                  >
                    <Check
                      v-if="isAllParticipantsSelected"
                      :size="12"
                      class="text-white"
                      stroke-width="4"
                    />
                  </div>
                </th>
                <th
                  class="p-4 text-sm font-bold text-slate-700 bg-slate-50 border-r border-slate-100 sticky left-[52px] z-20 whitespace-nowrap min-w-[200px]"
                >
                  ชื่อ-นามสกุล
                </th>
                <th
                  class="p-4 text-sm font-bold text-slate-700 bg-slate-50 border-r border-slate-100 whitespace-nowrap min-w-[120px]"
                >
                  ประเภท
                </th>
                <th
                  class="p-4 text-sm font-bold text-slate-700 bg-slate-50 border-r border-slate-100 whitespace-nowrap min-w-[140px]"
                >
                  สังกัด/แผนก
                </th>
                <th
                  class="p-4 text-sm font-bold text-slate-700 bg-slate-50 border-r border-slate-100 whitespace-nowrap min-w-[160px]"
                >
                  อีเมล
                </th>
                <th
                  class="p-4 text-sm font-bold text-slate-700 bg-slate-50 border-r border-slate-100 whitespace-nowrap min-w-[120px]"
                >
                  📞 เบอร์โทร
                </th>
                <th
                  class="p-4 text-sm font-bold text-slate-700 bg-slate-50 border-r border-slate-100 whitespace-nowrap min-w-[120px]"
                >
                  รหัส
                </th>
                <th
                  class="p-4 text-sm font-bold text-slate-700 bg-slate-50 border-r border-slate-100 whitespace-nowrap min-w-[100px] text-center"
                >
                  อายุ(ปี)
                </th>
                <th
                  class="p-4 text-sm font-bold text-slate-700 bg-slate-50 border-r border-slate-100 whitespace-nowrap min-w-[100px] text-center"
                >
                  ส่งภารกิจ
                </th>
                <th
                  class="p-4 text-sm font-bold text-slate-700 bg-slate-50 border-r border-slate-100 whitespace-nowrap min-w-[110px] text-center"
                >
                  คะแนนร้าน
                </th>
                <th
                  class="p-4 text-sm font-bold text-slate-700 bg-slate-50 border-r border-slate-100 whitespace-nowrap min-w-[170px] text-center"
                >
                  <span class="inline-flex items-center gap-1 justify-center">
                    <Trophy :size="15" />คะแนนอันดับ
                  </span>
                </th>
                <th
                  class="p-4 text-sm font-bold text-slate-700 bg-slate-50 border-r border-slate-100 whitespace-nowrap min-w-[150px]"
                >
                  <span class="inline-flex items-center gap-1">
                    <Target :size="15" />เป้าหมาย
                  </span>
                </th>
                <th
                  class="p-4 text-sm font-bold text-slate-700 bg-slate-50 border-r border-slate-100 whitespace-nowrap min-w-[120px] text-center"
                >
                  วันที่เข้าร่วม
                </th>
                <th
                  class="p-4 text-sm font-bold text-slate-700 bg-slate-50 border-r border-slate-100 whitespace-nowrap min-w-[100px] text-center"
                >
                  ทีม
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="item in paginatedRegistrants"
                :key="item.user_id"
                class="transition-colors"
                :class="{
                  'bg-slate-50': selectedUserIds.includes(item.user_id),
                }"
              >
                <td
                  class="p-4 w-[52px] min-w-[52px] max-w-[52px] text-center border-r border-slate-50 sticky left-0 z-10"
                  :class="
                    selectedUserIds.includes(item.user_id)
                      ? 'bg-slate-50'
                      : 'bg-white'
                  "
                >
                  <div
                    @click.stop="toggleParticipantSelect(item.user_id)"
                    class="w-5 h-5 mx-auto rounded-full border-2 flex items-center justify-center cursor-pointer transition-all"
                    :class="
                      selectedUserIds.includes(item.user_id)
                        ? 'bg-indigo-600 border-indigo-600'
                        : 'bg-white border-slate-300'
                    "
                  >
                    <Check
                      v-if="selectedUserIds.includes(item.user_id)"
                      :size="12"
                      class="text-white"
                      stroke-width="4"
                    />
                  </div>
                </td>
                <td
                  class="p-4 min-w-[200px] sticky left-[52px] z-10 border-r border-slate-50"
                  :class="
                    selectedUserIds.includes(item.user_id)
                      ? 'bg-slate-50'
                      : 'bg-white'
                  "
                >
                  <div class="flex items-center gap-3 min-w-[180px]">
                    <img
                      v-if="item.picture_url"
                      :src="item.picture_url"
                      class="w-8 h-8 rounded-full border border-slate-200 object-cover shrink-0"
                    />
                    <div
                      v-else
                      class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs shrink-0"
                    >
                      {{ (item.fname_th || item.name || "?")[0] }}
                    </div>
                    <div class="flex flex-col">
                      <span
                        class="font-bold text-slate-800 text-sm whitespace-nowrap"
                        >{{ item.fname_th || item.name }}
                        {{ item.lname_th || "" }}</span
                      >
                      <div class="flex items-center gap-1.5 leading-tight">
                        <span
                          v-if="item.nickname"
                          class="text-[10px] text-slate-400 font-medium"
                          >{{ item.nickname }}</span
                        >
                        <span
                          v-if="item.nickname && item.team_id"
                          class="text-[10px] text-slate-300"
                          >|</span
                        >
                        <span
                          v-if="item.team_id"
                          class="text-[10px] text-slate-400 font-medium"
                          >{{ getTeamName(item.team_id) }}</span
                        >
                      </div>
                    </div>
                  </div>
                </td>
                <td class="p-4">
                  <span class="text-slate-600 font-medium text-xs sm:text-sm">{{
                    item.role_type || item.role || "-"
                  }}</span>
                </td>
                <td class="p-4">
                  <span class="text-slate-600 text-xs sm:text-sm font-medium">{{
                    item.role_detail_1 || "-"
                  }}</span>
                </td>
                <td class="p-4 text-slate-500 text-xs sm:text-sm font-medium">
                  {{ item.email || "-" }}
                </td>
                <td class="p-4 text-slate-500 text-xs sm:text-sm font-medium">
                  {{ item.phone || "-" }}
                </td>
                <td class="p-4 text-slate-400 text-xs sm:text-sm font-medium">
                  {{ item.id_code || "-" }}
                </td>
                <td class="p-4 text-center">
                  <span class="text-slate-600 font-medium text-xs sm:text-sm">{{
                    calculateAge(item.birth_date)
                  }}</span>
                </td>
                <td class="p-4 text-center">
                  <span
                    class="text-xs sm:text-sm whitespace-nowrap font-bold"
                    :class="
                      item.submission_count > 0
                        ? 'text-blue-600'
                        : 'text-slate-400'
                    "
                  >
                    {{ item.submission_count }}
                  </span>
                </td>
                <td class="p-4 text-center">
                  <span
                    class="text-xs sm:text-sm whitespace-nowrap font-bold text-orange-500"
                  >
                    {{ Number(item.shop_points || 0).toLocaleString() }}
                  </span>
                </td>
                <td class="p-4 text-center">
                  <div class="inline-flex items-center gap-2">
                    <span
                      class="text-xs sm:text-sm whitespace-nowrap font-bold text-indigo-600"
                    >
                      {{ getParticipantRankingScore(item).toLocaleString() }}
                    </span>
                    <button
                      v-if="authStore.user?.role === 'admin'"
                      type="button"
                      class="inline-flex items-center gap-1 rounded-lg bg-orange-50 px-2.5 py-1.5 text-xs font-bold text-orange-600 transition-colors hover:bg-orange-100 disabled:opacity-50"
                      :disabled="updatingId === item.user_id"
                      title="เพิ่มคะแนนร้านหรือคะแนนอันดับ"
                      @click="openPointsModal(item)"
                    >
                      <Plus :size="14" /> เพิ่มคะแนน
                    </button>
                  </div>
                </td>
                <td class="p-4">
                  <div
                    v-if="item.goal_target > 0"
                    class="flex flex-col gap-2 w-24"
                  >
                    <div
                      class="flex justify-between text-[10px] text-slate-500 font-bold"
                    >
                      <span
                        >{{
                          Number(item.goal_achieved || 0).toLocaleString()
                        }}/{{
                          Number(item.goal_target || 0).toLocaleString()
                        }}</span
                      >
                      <span v-if="item.goal_reached" class="text-emerald-600"
                        >DONE</span
                      >
                    </div>
                    <div
                      class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"
                    >
                      <div
                        class="h-full bg-orange-400 rounded-full transition-all"
                        :style="{
                          width: Math.min(100, item.goal_percent || 0) + '%',
                        }"
                      ></div>
                    </div>
                  </div>
                  <div
                    v-else
                    class="text-slate-300 text-xs sm:text-sm font-bold"
                  >
                    -
                  </div>
                </td>
                <td class="p-4 text-center">
                  <div class="flex flex-col items-center leading-tight">
                    <span
                      class="text-xs font-bold text-slate-600 whitespace-nowrap"
                    >
                      {{
                        formatDate(
                          item.created_at ||
                            item.registered_at ||
                            new Date().toISOString(),
                        )
                          .split(" ")
                          .slice(0, 3)
                          .join(" ")
                      }}
                    </span>
                    <span class="text-[10px] text-slate-400 font-medium">
                      {{
                        formatDate(
                          item.created_at ||
                            item.registered_at ||
                            new Date().toISOString(),
                        )
                          .split(" ")
                          .slice(3)
                          .join(" ")
                      }}
                      น.
                    </span>
                  </div>
                </td>
                <td class="p-4 text-center">
                  <span
                    class="text-xs sm:text-sm font-bold whitespace-nowrap"
                    :class="item.team_id ? 'text-slate-600' : 'text-slate-300'"
                  >
                    {{ getTeamName(item.team_id) || "ไม่มีทีม" }}
                  </span>
                </td>
              </tr>
              <tr v-if="filteredRegistrants.length === 0">
                <td
                  colspan="14"
                  class="p-10 text-center text-slate-400 font-bold"
                >
                  ไม่พบรายชื่อผู้เข้าร่วมที่ค้นหา
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <AppPagination
          :currentPage="registrantsPage"
          :totalPages="Math.ceil(filteredRegistrants.length / perPageLimit)"
          @change="registrantsPage = $event"
        />
        <Transition name="slide-up">
          <div
            v-if="selectedUserIds.length > 0"
            class="fixed bottom-0 right-0 z-[100] flex items-center p-4 sm:p-6 pointer-events-none"
            :style="{ left: 'var(--sidebar-width, 0)' }"
          >
            <div
              class="flex items-center justify-between bg-white border border-slate-200 rounded-2xl px-5 py-3.5 pointer-events-auto w-full"
            >
              <div class="flex items-center gap-3">
                <div
                  class="bg-orange-500 text-white px-4 py-2 rounded-xl font-bold text-[13px] whitespace-nowrap"
                >
                  เลือกไว้ {{ selectedUserIds.length }} รายการ
                </div>
                <button
                  @click="selectedUserIds = []"
                  class="px-5 py-2 bg-slate-100 text-slate-600 font-bold text-sm rounded-xl hover:bg-slate-200 transition-all"
                >
                  ยกเลิก
                </button>
              </div>
              <div class="flex items-center gap-4">
                <div class="hidden sm:flex items-center gap-3">
                  <span class="text-sm font-bold text-slate-400">ย้ายทีม:</span>
                  <div class="relative min-w-[200px]">
                    <button
                      @click="showTeamDropdown = !showTeamDropdown"
                      class="w-full px-4 py-2 text-sm font-bold border border-slate-200 bg-slate-50 rounded-xl flex items-center justify-center gap-2 hover:bg-white hover:border-orange-400 transition-all text-slate-700"
                    >
                      <span class="truncate">{{
                        teams.find((t) => t.id === selectedTeamToAssign)
                          ?.name ||
                        (selectedTeamToAssign === ""
                          ? "ไม่มีทีม (ลบออก)"
                          : "-- เลือกทีม --")
                      }}</span>
                      <ChevronDown
                        class="text-slate-400 transition-transform duration-200"
                        :class="{ 'rotate-180': showTeamDropdown }"
                        :size="14"
                      />
                    </button>
                    <transition name="fade">
                      <div
                        v-if="showTeamDropdown"
                        class="absolute bottom-full mb-2 left-0 right-0 bg-white border border-slate-200 rounded-2xl overflow-hidden z-[110] animate-in"
                      >
                        <div class="max-h-60 overflow-y-auto custom-scroll">
                          <div
                            @click="
                              selectedTeamToAssign = '';
                              showTeamDropdown = false;
                            "
                            class="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-orange-50 hover:text-orange-600 cursor-pointer transition-colors border-b border-slate-50"
                          >
                            ไม่มีทีม (ลบออก)
                          </div>
                          <div
                            v-for="t in teams"
                            :key="t.id"
                            @click="
                              selectedTeamToAssign = t.id;
                              showTeamDropdown = false;
                            "
                            class="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-orange-50 hover:text-orange-600 cursor-pointer transition-colors border-b border-slate-50 last:border-0"
                            :class="{
                              'bg-orange-50 text-orange-600 font-bold':
                                selectedTeamToAssign === t.id,
                            }"
                          >
                            {{ t.name }}
                          </div>
                        </div>
                      </div>
                    </transition>
                  </div>
                </div>
                <button
                  @click="assignTeam"
                  :disabled="loading"
                  class="bg-orange-500 text-white px-8 py-2.5 rounded-xl text-sm font-bold hover:bg-orange-600 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Loader2 v-if="loading" class="animate-spin" :size="16" />
                  <Check v-else :size="16" stroke-width="3" />
                  <span>บันทึก</span>
                </button>
                <button
                  @click="removeParticipants"
                  :disabled="loading"
                  class="bg-rose-50 text-rose-600 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-rose-100 transition-all flex items-center gap-2 disabled:opacity-50"
                  title="นำออกจากกิจกรรม"
                >
                  <Loader2 v-if="loading" class="animate-spin" :size="16" />
                  <UserX v-else :size="16" stroke-width="3" />
                  <span class="hidden sm:inline">นำออก</span>
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
      <div v-else-if="activeTab === 'submissions'" class="space-y-5">
        <div class="flex items-center justify-between">
          <div class="search-pill-container">
            <Search :size="18" class="search-icon" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="ค้นหาชื่อ ภารกิจ..."
            />
          </div>
          <div class="hidden md:block">
            <span
              class="text-[11px] font-bold text-slate-400 uppercase tracking-wider"
            >
              รายการทั้งหมด {{ filteredSubmissions.length }} รายการ
            </span>
          </div>
        </div>
        <div
          class="overflow-x-auto custom-scroll w-full border border-slate-200 rounded-2xl bg-white relative custom-table-wrapper"
        >
          <table
            class="w-full text-left whitespace-nowrap border-separate border-spacing-0 text-sm text-slate-600 clean-table"
          >
            <thead
              class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 shadow-sm"
            >
              <tr>
                <th
                  class="p-4 w-[52px] min-w-[52px] max-w-[52px] text-center border-r border-slate-100 sticky left-0 bg-slate-50 z-20"
                >
                  <div
                    @click="toggleSelectAllSubmissions"
                    class="w-5 h-5 mx-auto rounded-full border-2 flex items-center justify-center cursor-pointer transition-all"
                    :class="
                      isAllSubmissionsSelected
                        ? 'bg-indigo-600 border-indigo-600'
                        : 'bg-white border-slate-300'
                    "
                  >
                    <Check
                      v-if="isAllSubmissionsSelected"
                      :size="12"
                      class="text-white"
                      stroke-width="4"
                    />
                  </div>
                </th>
                <th
                  class="p-4 text-sm font-bold text-slate-700 bg-slate-50 border-r border-slate-100 sticky left-[52px] z-20 whitespace-nowrap min-w-[120px]"
                >
                  ส่งเมื่อ
                </th>
                <th
                  class="p-4 text-sm font-bold text-slate-700 bg-slate-50 border-r border-slate-100 sticky left-[172px] z-20 whitespace-nowrap min-w-[200px]"
                >
                  ชื่อ-นามสกุล
                </th>
                <th
                  class="p-4 text-sm font-bold text-slate-700 bg-slate-50 border-r border-slate-100 whitespace-nowrap min-w-[200px]"
                >
                  ภารกิจ
                </th>
                <th
                  class="p-4 text-sm font-bold text-slate-700 bg-slate-50 border-r border-slate-100 whitespace-nowrap min-w-[100px] text-center"
                >
                  หลักฐาน
                </th>
                <th
                  class="p-4 text-sm font-bold text-slate-700 bg-slate-50 border-r border-slate-100 whitespace-nowrap min-w-[100px]"
                >
                  ค่าที่ส่ง
                </th>
                <th
                  class="p-4 text-sm font-bold text-slate-700 bg-slate-50 border-r border-slate-100 whitespace-nowrap min-w-[100px] text-center"
                >
                  สถานะ
                </th>
                <th
                  class="p-4 text-sm font-bold text-slate-700 bg-slate-50 border-r border-slate-100 whitespace-nowrap min-w-[100px] text-center"
                >
                  ⚙️ จัดการ
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="item in paginatedSubmissions"
                :key="item.id"
                class="transition-colors"
                :class="{
                  'bg-slate-50': selectedSubmissionIds.includes(item.id),
                }"
              >
                <td
                  class="p-4 w-[52px] min-w-[52px] max-w-[52px] text-center border-r border-slate-50 sticky left-0 z-10"
                  :class="
                    selectedSubmissionIds.includes(item.id)
                      ? 'bg-slate-50'
                      : 'bg-white'
                  "
                >
                  <div
                    @click.stop="toggleSubmissionSelect(item.id)"
                    class="w-5 h-5 mx-auto rounded-full border-2 flex items-center justify-center cursor-pointer transition-all"
                    :class="
                      selectedSubmissionIds.includes(item.id)
                        ? 'bg-indigo-600 border-indigo-600 shadow-sm shadow-indigo-200'
                        : 'bg-white border-slate-300'
                    "
                  >
                    <Check
                      v-if="selectedSubmissionIds.includes(item.id)"
                      :size="12"
                      class="text-white"
                      stroke-width="4"
                    />
                  </div>
                </td>
                <td
                  class="p-4 sticky left-[52px] z-10 border-r border-slate-50"
                  :class="
                    selectedSubmissionIds.includes(item.id)
                      ? 'bg-slate-50'
                      : 'bg-white'
                  "
                >
                  <span
                    class="text-xs sm:text-sm text-slate-500 whitespace-nowrap font-medium"
                    >{{ formatDate(item.created_at) }}</span
                  >
                </td>
                <td
                  class="p-4 sticky left-[172px] z-10 border-r border-slate-50"
                  :class="
                    selectedSubmissionIds.includes(item.id)
                      ? 'bg-slate-50'
                      : 'bg-white'
                  "
                >
                  <div class="flex items-center gap-3 min-w-[180px]">
                    <img
                      v-if="item.picture_url"
                      :src="item.picture_url"
                      class="w-8 h-8 rounded-full border border-slate-200 object-cover shrink-0"
                    />
                    <div
                      v-else
                      class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs shrink-0"
                    >
                      {{ (item.fname_th || item.name || "?")[0] }}
                    </div>
                    <div class="flex flex-col">
                      <span
                        class="font-bold text-slate-800 text-sm whitespace-nowrap"
                        >{{ item.fname_th || item.name }}
                        {{ item.lname_th || "" }}</span
                      >
                      <div class="flex items-center gap-1.5 leading-tight">
                        <span
                          v-if="item.nickname"
                          class="text-[10px] text-slate-400 font-medium"
                          >{{ item.nickname }}</span
                        >
                        <span
                          v-if="item.nickname && item.team_id"
                          class="text-[10px] text-slate-300"
                          >|</span
                        >
                        <span
                          v-if="item.team_id"
                          class="text-[10px] text-slate-400 font-medium"
                          >{{ getTeamName(item.team_id) }}</span
                        >
                      </div>
                    </div>
                  </div>
                </td>
                <td class="p-4">
                  <div class="flex flex-col py-1 min-w-[120px] max-w-[200px]">
                    <span
                      class="text-xs sm:text-sm font-bold text-slate-700 line-clamp-2 leading-snug"
                      :title="item.task_note || item.activity_type"
                      >{{ item.task_note || item.activity_type }}</span
                    >
                  </div>
                </td>
                <td class="p-4 text-center">
                  <a
                    v-if="safeImageUrl(item.img_url)"
                    :href="safeImageUrl(item.img_url)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-block hover:opacity-80 transition-opacity"
                  >
                    <img
                      :src="safeImageUrl(item.img_url)"
                      class="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded-xl border border-slate-200 mx-auto"
                    />
                  </a>
                  <span v-else class="text-xs text-slate-400 font-bold"
                    >ไม่มี</span
                  >
                </td>
                <td class="p-4 max-w-[240px]">
                  <div
                    v-if="item.text_response"
                    class="text-slate-700 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap line-clamp-3"
                    :title="item.text_response"
                  >
                    {{ item.text_response }}
                  </div>
                  <div
                    v-else
                    class="text-slate-700 text-xs sm:text-sm whitespace-nowrap"
                  >
                    <template v-if="item.proof_type === 'line'">
                      <span
                        class="px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-[10px] sm:text-[11px] font-bold text-slate-600"
                        >รูปแชท LINE</span
                      >
                    </template>
                    <template
                      v-else-if="
                        item.value !== null &&
                        item.value !== undefined &&
                        Number(item.value) !== 0
                      "
                    >
                      <span class="font-bold text-orange-600 text-base">{{
                        item.value
                      }}</span>
                      <span
                        class="text-[10px] sm:text-xs font-bold text-slate-400"
                        v-if="item.metric_unit || item.metric_type"
                        >{{ item.metric_unit || item.metric_type }}</span
                      >
                    </template>
                    <span v-else class="text-slate-300 font-bold">-</span>
                  </div>
                </td>
                <td class="p-4 text-center">
                  <span
                    class="text-[12px] sm:text-[13px] font-extrabold flex items-center justify-center gap-1.5 w-fit mx-auto whitespace-nowrap"
                    :class="{
                      'text-orange-500': item.status === 'pending',
                      'text-emerald-500': item.status === 'approved',
                      'text-rose-500': item.status === 'rejected',
                    }"
                  >
                    <span
                      class="w-1.5 h-1.5 rounded-full"
                      :class="
                        item.status === 'approved'
                          ? 'bg-emerald-500'
                          : item.status === 'pending'
                            ? 'bg-orange-500'
                            : 'bg-rose-500'
                      "
                    ></span>
                    {{
                      item.status === "approved"
                        ? "อนุมัติ"
                        : item.status === "pending"
                          ? "รอตรวจ"
                          : "ปฏิเสธ"
                    }}
                  </span>
                </td>
                <td class="p-4 text-center">
                  <button
                    @click.stop="toggleRowMenu(item.id, $event)"
                    class="p-2 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-all"
                    :class="{
                      'text-orange-500 bg-orange-50': activeMenuId === item.id,
                    }"
                  >
                    <MoreVertical :size="18" />
                  </button>
                </td>
              </tr>
              <tr v-if="filteredSubmissions.length === 0">
                <td
                  colspan="8"
                  class="p-10 text-center text-slate-400 font-bold"
                >
                  ไม่มีข้อมูลการส่งยื่นภารกิจ
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <AppPagination
          :currentPage="submissionsPage"
          :totalPages="Math.ceil(filteredSubmissions.length / perPageLimit)"
          @change="submissionsPage = $event"
        />
        <Transition name="slide-up">
          <div
            v-if="selectedSubmissionIds.length > 0"
            class="fixed bottom-0 right-0 z-[100] flex items-center p-4 sm:p-6 pointer-events-none"
            :style="{ left: 'var(--sidebar-width, 0)' }"
          >
            <div
              class="flex items-center justify-between bg-white border border-slate-200 rounded-2xl px-5 py-3.5 pointer-events-auto w-full"
            >
              <div class="flex items-center gap-3">
                <div
                  class="bg-orange-500 text-white px-4 py-2 rounded-xl font-bold text-[13px] shadow-lg shadow-orange-500/25 whitespace-nowrap"
                >
                  เลือกไว้ {{ selectedSubmissionIds.length }} รายการ
                </div>
                <button
                  @click="selectedSubmissionIds = []"
                  class="px-5 py-2 bg-slate-100 text-slate-600 font-bold text-sm rounded-xl hover:bg-slate-200 transition-all"
                >
                  ยกเลิก
                </button>
              </div>
              <div class="flex items-center gap-2">
                <button
                  @click="bulkUpdateSubStatus('approved')"
                  class="bg-[#10b981] text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-600 transition-all flex items-center gap-2"
                >
                  <CheckCircle :size="16" stroke-width="2.5" />
                  <span class="hidden sm:inline">อนุมัติทั้งหมด</span
                  ><span class="sm:hidden">อนุมัติ</span>
                </button>
                <button
                  @click="bulkUpdateSubStatus('rejected')"
                  class="bg-[#f43f5e] text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-rose-600 transition-all flex items-center gap-2"
                >
                  <X :size="16" stroke-width="2.5" />
                  <span class="hidden sm:inline">ปฏิเสธทั้งหมด</span
                  ><span class="sm:hidden">ปฏิเสธ</span>
                </button>
                <div class="w-px h-6 bg-slate-200 mx-1"></div>
                <button
                  @click="bulkDeleteSubmissions"
                  class="bg-rose-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-rose-600 transition-all flex items-center gap-2 shadow-lg shadow-rose-500/20"
                >
                  <Trash2 :size="16" stroke-width="2.5" />
                  <span class="hidden sm:inline">ลบที่เลือก</span
                  ><span class="sm:hidden">ลบ</span>
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
      <div v-else-if="activeTab === 'tracking'" class="space-y-5">
        <div
          class="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
        >
          <div class="search-pill-container lg:w-auto w-full">
            <Search :size="18" class="search-icon" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="ค้นหาชื่อผู้เข้าร่วม..."
            />
          </div>
          <div
            class="flex items-center gap-2 w-full sm:w-auto overflow-x-auto hide-scrollbar shrink-0 pb-2 sm:pb-0"
          >
            <div
              class="relative flex items-center bg-white border border-slate-200 rounded-full h-11 px-5 hover:border-orange-400 hover:ring-4 hover:ring-orange-50 transition-all cursor-pointer group"
              @click="($refs.dateInputRef as any)?.showPicker()"
            >
              <Calendar
                class="text-orange-500 mr-3 shrink-0 group-hover:scale-110 transition-transform"
                :size="18"
              />
              <span
                class="text-sm font-extrabold text-slate-700 whitespace-nowrap min-w-[100px] text-center"
                >{{ monthYearLabel }}</span
              >
              <input
                ref="dateInputRef"
                type="month"
                v-model="monthInput"
                class="dashboard-hidden-date absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
              />
            </div>
            <button
              @click="exportMonthlyExcel"
              :disabled="isExportingExcel"
              class="shrink-0 h-11 px-6 text-sm font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 rounded-full flex items-center gap-2 disabled:opacity-50 transition-colors"
            >
              <Download :size="16" />
              {{ isExportingExcel ? "กำลังโหลด..." : "Excel" }}
            </button>
          </div>
        </div>

        <div
          class="flex flex-wrap items-center gap-4 px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl mb-1 text-[11px] font-bold text-slate-500"
        >
          <div class="flex items-center gap-1.5">
            <CheckCircle2 class="w-3.5 h-3.5 text-emerald-500" />
            <span
              >ส่งภารกิจแล้ว
              (กดที่เครื่องหมายเพื่อเเก้ไขข้อมูลที่ผู้ใช้ส่งมา)</span
            >
          </div>
          <div class="flex items-center gap-1.5">
            <XCircle class="w-3.5 h-3.5 text-rose-400" />
            <span>ยังไม่ส่ง (ในวันที่มีภารกิจ)</span>
          </div>
          <div class="flex items-center gap-1.5">
            <div
              class="w-3.5 h-3.5 bg-slate-100 border border-slate-200 rounded-sm"
            ></div>
            <span>ไม่มีภารกิจในวันดังกล่าว</span>
          </div>
          <div class="ml-auto opacity-60 font-medium italic text-[10px]">
            * ข้อมูลอิงตามการตั้งค่าวันที่มีภารกิจ (Allowed Days)
          </div>
        </div>

        <div
          class="overflow-x-auto custom-scroll w-full border border-slate-200 rounded-2xl bg-white relative custom-table-wrapper"
        >
          <table
            class="w-max text-left whitespace-nowrap border-separate border-spacing-0 text-sm text-slate-600 clean-table"
          >
            <thead
              class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200"
            >
              <tr>
                <th
                  class="p-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 bg-slate-50 border-r border-slate-100 sticky left-0 z-40 w-[180px] min-w-[180px] max-w-[180px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]"
                >
                  ผู้เข้าร่วม
                </th>
                <th
                  class="p-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 bg-slate-50 border-r border-slate-100 sticky left-[180px] z-40 w-[120px] min-w-[120px] max-w-[120px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]"
                >
                  ภารกิจ
                </th>
                <th
                  v-for="day in currentMonthDates"
                  :key="'date-' + day.dStr"
                  class="p-1 min-w-[36px] text-center font-bold text-slate-400 text-[10px] z-30 border-r border-slate-100/50"
                >
                  <div class="flex flex-col items-center leading-none py-1">
                    <span class="text-[9px] opacity-60 font-medium mb-1">{{
                      day.date
                        .toLocaleDateString("th-TH", { weekday: "short" })
                        .replace(".", "")
                    }}</span>
                    <span class="text-xs text-slate-600">{{
                      day.date.getDate()
                    }}</span>
                  </div>
                </th>
                <th
                  class="p-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 bg-slate-50 border-r border-slate-100 whitespace-nowrap min-w-[60px] text-center border-l bg-slate-50/80"
                >
                  ส่ง
                </th>
                <th
                  class="p-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 bg-slate-50 border-r border-slate-100 whitespace-nowrap min-w-[60px] text-center bg-slate-50/80"
                >
                  ขาด
                </th>
                <th
                  class="p-3 text-[11px] uppercase tracking-wider font-bold text-slate-500 bg-slate-50 border-r border-slate-100 whitespace-nowrap min-w-[60px] text-center bg-slate-50/80"
                >
                  %
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white">
              <template
                v-for="(ut, i) in paginatedTrackingSheet"
                :key="ut.user_id"
              >
                <tr
                  v-for="(task, tIdx) in visibleTasks"
                  :key="ut.user_id + '-' + task.id"
                  class="transition-colors hover:bg-slate-50/30 group"
                >
                  <td
                    v-if="tIdx === 0"
                    :rowspan="visibleTasks.length"
                    class="p-2 font-bold text-slate-800 sticky left-0 z-20 bg-white border-r border-b border-slate-100 w-[180px] min-w-[180px] max-w-[180px] align-top shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]"
                  >
                    <div class="flex items-start gap-2 pt-1">
                      <img
                        v-if="ut.picture_url"
                        :src="ut.picture_url"
                        class="w-7 h-7 rounded-full border border-slate-200 object-cover shrink-0"
                      />
                      <div
                        v-else
                        class="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-[10px] shrink-0"
                      >
                        {{ (ut.fname_th || "?")[0] }}
                      </div>
                      <div class="flex flex-col overflow-hidden leading-tight">
                        <span
                          class="font-bold text-slate-700 text-xs truncate w-full"
                          :title="ut.fname_th + ' ' + (ut.lname_th || '')"
                          >{{ ut.fname_th }}</span
                        >
                        <div class="flex flex-col mt-0.5">
                          <span
                            v-if="ut.nickname"
                            class="text-[9px] text-slate-400 font-medium truncate"
                            >{{ ut.nickname }}</span
                          >
                          <span
                            v-if="ut.team_id"
                            class="text-[9px] text-slate-300 font-medium truncate max-w-full mt-0.5"
                            :title="getTeamName(ut.team_id)"
                            >{{ getTeamName(ut.team_id) }}</span
                          >
                        </div>
                      </div>
                    </div>
                  </td>
                  <td
                    class="p-2 text-[10px] font-bold text-slate-600 sticky left-[180px] z-20 bg-white border-r border-slate-50 w-[120px] min-w-[120px] max-w-[120px] align-middle shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]"
                    :title="task.title || task.note || task.type"
                  >
                    <div class="flex items-center gap-1.5">
                      <span
                        class="w-1.5 h-1.5 rounded-full shrink-0"
                        :class="taskColors[task.id]?.dot || 'bg-slate-300'"
                      ></span>
                      <span class="truncate line-clamp-2 leading-tight">{{
                        task.title || task.note || task.type || "ภารกิจ"
                      }}</span>
                    </div>
                  </td>
                  <td
                    v-for="day in currentMonthDates"
                    :key="'cell-' + ut.user_id + '-' + day.dStr + '-' + task.id"
                    class="p-1 text-center border-r border-slate-100/50 transition-colors"
                    :class="{
                      'bg-slate-50/80': !isTaskExpectedOnDate(
                        task.id,
                        day.dStr,
                      ),
                    }"
                  >
                    <div class="flex justify-center items-center w-full h-7">
                      <!-- 1. Submitted -->
                      <div
                        v-if="ut.taskStatus[`${day.dStr}_${task.id}`]"
                        class="flex justify-center items-center w-5 h-5 cursor-pointer hover:scale-125 transition-all"
                        @click="
                          handleEditTracking(
                            ut.taskStatus[`${day.dStr}_${task.id}`],
                          )
                        "
                        :title="
                          'ส่งแล้ว: ' +
                          ut.taskStatus[`${day.dStr}_${task.id}`].value
                        "
                      >
                        <CheckCircle2 class="w-4 h-4 text-emerald-500" />
                      </div>

                      <!-- 2. Missed (Past & Expected) -->
                      <div
                        v-else-if="
                          day.dStr <= todayStr &&
                          (!eventInfo?.is_continuous_event ||
                            day.dStr >=
                              getYMD(
                                new Date(
                                  ut.joined_at || ut.created_at || '1900-01-01',
                                ),
                              )) &&
                          isTaskExpectedOnDate(task.id, day.dStr)
                        "
                        class="flex justify-center items-center w-5 h-5"
                      >
                        <XCircle class="w-4 h-4 text-rose-400/80" />
                      </div>

                      <!-- 3. Not Expected (No task today) -->
                      <div
                        v-else-if="!isTaskExpectedOnDate(task.id, day.dStr)"
                        class="flex justify-center items-center w-5 h-5 opacity-20"
                        title="ไม่มีภารกิจในวันนี้"
                      >
                        <div class="w-1 h-1 rounded-full bg-slate-400"></div>
                      </div>

                      <!-- 4. Future / Pending (Expected but not yet reached) -->
                      <div
                        v-else
                        class="flex justify-center items-center w-5 h-5 opacity-30"
                      >
                        <div
                          class="w-1.5 h-1.5 rounded-full border border-slate-300"
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td
                    v-if="tIdx === 0"
                    :rowspan="visibleTasks.length"
                    class="p-2 text-center text-emerald-600 font-bold border-l border-b border-slate-100 bg-white align-middle text-xs"
                  >
                    {{ ut.completed }}
                  </td>
                  <td
                    v-if="tIdx === 0"
                    :rowspan="visibleTasks.length"
                    class="p-2 text-center text-rose-500 font-bold bg-white border-b border-slate-100 align-middle text-xs"
                  >
                    {{ ut.missedCount }}
                  </td>
                  <td
                    v-if="tIdx === 0"
                    :rowspan="visibleTasks.length"
                    class="p-2 text-center text-orange-600 font-bold bg-white border-b border-slate-100 align-middle text-xs"
                  >
                    {{ ut.percentage }}%
                  </td>
                </tr>
              </template>
              <tr v-if="userTrackingSheet.length === 0">
                <td
                  :colspan="5 + currentMonthDates.length"
                  class="p-8 text-center text-slate-300 font-bold text-sm"
                >
                  ไม่มีข้อมูลติดตามการส่ง
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <AppPagination
          :currentPage="trackingPage"
          :totalPages="Math.ceil(userTrackingSheet.length / perPageLimit)"
          @change="trackingPage = $event"
        />
      </div>
      <div v-else-if="activeTab === 'participation'" class="space-y-5">
        <div
          class="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
        >
          <div class="search-pill-container lg:w-auto w-full">
            <Search :size="18" class="search-icon" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="ค้นหาทีม หรือผู้ร่วมกิจกรรม..."
            />
          </div>
          <div
            class="flex items-center gap-2 w-full sm:w-auto overflow-x-auto hide-scrollbar shrink-0 pb-2 sm:pb-0"
          >
            <div
              class="relative flex items-center bg-white border border-slate-200 rounded-full h-11 px-5 hover:border-orange-400 hover:ring-4 hover:ring-orange-50 transition-all cursor-pointer group"
              @click="($refs.yearDateInputRef as any)?.showPicker()"
            >
              <Calendar
                class="text-orange-500 mr-3 shrink-0 group-hover:scale-110 transition-transform"
                :size="18"
              />
              <span
                class="text-sm font-extrabold text-slate-700 whitespace-nowrap min-w-[100px] text-center"
                >{{ monthYearLabel }}</span
              >
              <input
                ref="yearDateInputRef"
                type="month"
                v-model="monthInput"
                class="dashboard-hidden-date absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
              />
            </div>
          </div>
        </div>
        <div
          class="overflow-x-auto custom-scroll w-full border border-slate-200 rounded-2xl bg-white relative custom-table-wrapper"
        >
          <table
            class="w-max text-right whitespace-nowrap border-separate border-spacing-0 text-sm text-slate-600 clean-table"
          >
            <thead
              class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 shadow-sm"
            >
              <tr>
                <th
                  class="p-4 text-sm font-bold text-slate-700 bg-slate-50 border-r border-slate-100 text-left sticky left-0 z-40 whitespace-nowrap min-w-[200px]"
                >
                  ชื่อ - นามสกุล
                </th>
                <th
                  v-for="opt in trackingMonthOptions"
                  :key="'m-' + opt.value"
                  class="p-3 text-center font-bold text-slate-500 min-w-[90px]"
                >
                  {{ opt.label }}<br /><span
                    class="text-[10px] text-slate-400 font-medium"
                    >(เป้า:
                    {{ participationExpected.perMonth[opt.value] }})</span
                  >
                </th>
                <th
                  class="p-4 text-sm font-bold text-slate-700 bg-slate-50 border-r border-slate-100 text-center whitespace-nowrap min-w-[100px] border-l"
                >
                  รวมที่ส่ง<br /><span
                    class="text-[10px] text-slate-400 font-medium"
                    >(เกณฑ์: {{ participationExpected.total }})</span
                  >
                </th>
                <th
                  class="p-4 text-sm font-bold text-slate-700 bg-slate-50 border-r border-slate-100 text-center whitespace-nowrap min-w-[100px]"
                >
                  ร้อยละ
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white">
              <tr
                v-for="(up, i) in paginatedParticipationSheet"
                :key="up.user_id"
                class="transition-colors text-center"
              >
                <td
                  class="p-3 text-left sticky left-0 z-20 bg-white border-r border-slate-50"
                >
                  <div class="flex items-center gap-3 min-w-[180px]">
                    <img
                      v-if="up.picture_url"
                      :src="up.picture_url"
                      class="w-8 h-8 rounded-full border border-slate-200 object-cover shrink-0"
                    />
                    <div
                      v-else
                      class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs shrink-0"
                    >
                      {{ (up.fname_th || "?")[0] }}
                    </div>
                    <div class="flex flex-col text-left">
                      <span
                        class="font-bold text-slate-800 text-sm whitespace-nowrap"
                        >{{ up.fname_th }} {{ up.lname_th || "" }}</span
                      >
                      <div class="flex items-center gap-1.5 leading-tight">
                        <span
                          v-if="up.nickname"
                          class="text-[10px] text-slate-400 font-medium"
                          >{{ up.nickname }}</span
                        >
                        <span
                          v-if="up.nickname && up.team_id"
                          class="text-[10px] text-slate-300"
                          >|</span
                        >
                        <span
                          v-if="up.team_id"
                          class="text-[10px] text-slate-400 font-medium"
                          >{{ getTeamName(up.team_id) }}</span
                        >
                      </div>
                    </div>
                  </div>
                </td>
                <td
                  v-for="opt in trackingMonthOptions"
                  :key="'val-' + opt.value"
                  class="p-3 text-slate-700 font-medium"
                >
                  {{ up.monthlySubmissions[opt.value] }}
                </td>
                <td
                  class="p-3 font-bold border-l border-slate-50 bg-white"
                  :class="
                    up.percentage >= 80 ? 'text-emerald-600' : 'text-slate-600'
                  "
                >
                  {{ up.totalUserSubs }}
                </td>
                <td
                  class="p-3 font-bold bg-white"
                  :class="
                    up.percentage >= 80 ? 'text-emerald-600' : 'text-slate-600'
                  "
                >
                  {{ up.percentage.toFixed(1) }}%
                </td>
              </tr>
              <tr v-if="userParticipationSheet.length === 0">
                <td
                  :colspan="2 + trackingMonthOptions.length"
                  class="p-10 text-center text-slate-400 font-bold"
                >
                  ไม่มีข้อมูลกิจกรรม
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <AppPagination
          :currentPage="participationPage"
          :totalPages="Math.ceil(userParticipationSheet.length / perPageLimit)"
          @change="participationPage = $event"
        />
      </div>
      <div v-else-if="activeTab === 'rankings'" class="space-y-5">
        <div
          class="flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div class="search-pill-container lg:w-auto w-full">
            <Search :size="18" class="search-icon" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="ค้นหาชื่อ หรือทีม..."
            />
          </div>
          <div
            class="flex items-center gap-1 bg-white border border-slate-200 rounded-full p-1 w-full sm:w-auto shrink-0"
          >
            <button
              @click="rankingsTab = 'individual'"
              class="w-full sm:w-auto shrink-0 px-5 py-2 text-sm font-bold rounded-full transition-all"
              :class="
                rankingsTab === 'individual'
                  ? 'bg-orange-500 text-white'
                  : 'bg-transparent text-slate-600 hover:bg-slate-50'
              "
            >
              อันดับบุคคล
            </button>
            <button
              @click="rankingsTab = 'team'"
              class="w-full sm:w-auto shrink-0 px-5 py-2 text-sm font-bold rounded-full transition-all"
              :class="
                rankingsTab === 'team'
                  ? 'bg-orange-500 text-white'
                  : 'bg-transparent text-slate-600 hover:bg-slate-50'
              "
            >
              อันดับทีม
            </button>
          </div>
        </div>
        <div
          class="overflow-x-auto custom-scroll w-full border border-slate-200 rounded-2xl bg-white relative custom-table-wrapper"
        >
          <table
            class="w-full text-left whitespace-nowrap border-separate border-spacing-0 text-sm text-slate-600 clean-table"
          >
            <thead
              class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 shadow-sm"
            >
              <tr>
                <th
                  class="p-4 text-sm font-bold text-slate-700 bg-slate-50 border-r border-slate-100 sticky left-0 z-20 whitespace-nowrap min-w-[200px]"
                >
                  ชื่อ-นามสกุล
                </th>
                <th
                  class="p-4 text-sm font-bold text-slate-700 bg-slate-50 border-r border-slate-100 text-right whitespace-nowrap min-w-[120px]"
                >
                  คะแนน
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="row in paginatedRankings"
                :key="row.id || row.user_id || row.team_id"
                class="transition-colors"
              >
                <td
                  class="p-4 sticky left-0 z-10 bg-white border-r border-slate-50"
                >
                  <div class="flex items-center gap-3 min-w-[180px]">
                    <img
                      v-if="row.picture_url || row.image"
                      :src="row.picture_url || row.image"
                      class="w-8 h-8 rounded-full border border-slate-200 object-cover shrink-0"
                    />
                    <div
                      v-else
                      class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs shrink-0"
                    >
                      {{ (row.nickname || row.fname_th || row.name || "?")[0] }}
                    </div>
                    <div class="flex flex-col text-left">
                      <span
                        class="font-bold text-slate-800 text-sm whitespace-nowrap"
                        >{{ row.fname_th || row.name || "ผู้ใช้" }}
                        {{ row.lname_th || "" }}</span
                      >
                      <div class="flex items-center gap-1.5 leading-tight">
                        <span
                          v-if="row.nickname"
                          class="text-[10px] text-slate-400 font-medium"
                          >{{ row.nickname }}</span
                        >
                        <span
                          v-if="row.nickname && row.team_id"
                          class="text-[10px] text-slate-300"
                          >|</span
                        >
                        <span
                          v-if="row.team_id"
                          class="text-[10px] text-slate-400 font-medium"
                          >{{ getTeamName(row.team_id) }}</span
                        >
                      </div>
                    </div>
                  </div>
                </td>
                <td class="p-4 text-right">
                  <div class="text-right">
                    <span class="text-base font-extrabold text-slate-800">{{
                      formatDist(
                        Number(row.total_unit_value) > 0
                          ? Number(row.total_unit_value)
                          : Number(row.total_points),
                      )
                    }}</span>
                    <span
                      class="text-[10px] font-bold text-slate-400 ml-1 uppercase tracking-widest"
                      >{{
                        Number(row.total_unit_value) > 0
                          ? rankingUnitLong
                          : "pts"
                      }}</span
                    >
                  </div>
                </td>
              </tr>
              <tr v-if="rankingTableData.length === 0">
                <td
                  colspan="2"
                  class="p-10 text-center text-slate-400 font-bold"
                >
                  ยังไม่มีข้อมูลอันดับ
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <AppPagination
          :currentPage="rankingsPage"
          :totalPages="Math.ceil(rankingTableData.length / perPageLimit)"
          @change="rankingsPage = $event"
        />
      </div>
      <div v-else-if="activeTab === 'changes'" class="space-y-5">
        <div class="flex items-center justify-between">
          <div class="search-pill-container lg:w-auto w-full">
            <Search :size="18" class="search-icon" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="ค้นหาชื่อ..."
            />
          </div>
          <div class="hidden md:block">
            <span
              class="text-[11px] font-bold text-slate-400 uppercase tracking-wider"
            >
              เปรียบเทียบค่าร่างกาย {{ filteredTanitaChanges.length }} รายการ
            </span>
          </div>
        </div>
        <div
          v-if="loadingComparison"
          class="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-2xl"
        >
          <div
            class="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"
          ></div>
          <p class="text-slate-500 font-bold">
            กำลังโหลดข้อมูลการเปรียบเทียบ...
          </p>
        </div>
        <div
          v-else
          class="overflow-x-auto custom-scroll w-full border border-slate-200 rounded-2xl bg-white relative custom-table-wrapper"
        >
          <table
            class="w-max text-left whitespace-nowrap border-separate border-spacing-0 text-sm text-slate-600 clean-table"
          >
            <thead
              class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 shadow-sm"
            >
              <tr class="text-[11px] uppercase tracking-wider">
                <th
                  rowspan="2"
                  class="p-3 text-center border-r border-slate-200 bg-slate-100/80 sticky left-0 z-30"
                >
                  ลำดับ
                </th>
                <th
                  rowspan="2"
                  class="p-3 text-center border-r border-slate-200 bg-slate-100/80"
                >
                  รหัสพนักงาน
                </th>
                <th
                  rowspan="2"
                  class="p-3 text-left border-r border-slate-200 bg-slate-100/80 sticky left-[48px] z-30 min-w-[200px]"
                >
                  ชื่อ-นามสกุล
                </th>
                <th
                  rowspan="2"
                  class="p-3 text-center border-r border-slate-200 bg-slate-100/80"
                >
                  อายุ (ปี)
                </th>
                <th
                  rowspan="2"
                  class="p-3 text-center border-r border-slate-200 bg-slate-100/80"
                >
                  เพศ
                </th>
                <th
                  colspan="5"
                  class="p-2 text-center border-r border-slate-200 bg-emerald-50 text-emerald-700"
                >
                  ผลร่างกาย (ก่อน)
                </th>
                <th
                  colspan="5"
                  class="p-2 text-center border-r border-slate-200 bg-amber-50 text-amber-700"
                >
                  ผลร่างกาย (หลัง)
                </th>
                <th
                  colspan="5"
                  class="p-2 text-center border-r border-slate-200 bg-sky-50 text-sky-700"
                >
                  เปลี่ยนแปลง
                </th>
                <th
                  colspan="5"
                  class="p-2 text-center border-r border-slate-200 bg-slate-50 text-slate-700"
                >
                  คะแนนที่ได้
                </th>
                <th
                  rowspan="2"
                  class="p-3 text-center border-r border-slate-200 bg-slate-100/80"
                >
                  คะแนนรวม
                </th>
                <th rowspan="2" class="p-3 text-center bg-slate-100/80">
                  วิเคราะห์ผล (Insight)
                </th>
              </tr>
              <tr class="text-[10px] bg-white">
                <th
                  class="p-2 text-center border-r border-slate-100 bg-emerald-50/50"
                >
                  น้ำหนัก (kg)
                </th>
                <th
                  class="p-2 text-center border-r border-slate-100 bg-emerald-50/50"
                >
                  รอบเอว (cm)
                </th>
                <th
                  class="p-2 text-center border-r border-slate-100 bg-emerald-50/50"
                >
                  BMI
                </th>
                <th
                  class="p-2 text-center border-r border-slate-100 bg-emerald-50/50"
                >
                  % Fat
                </th>
                <th
                  class="p-2 text-center border-r border-slate-200 bg-emerald-50/50"
                >
                  VP
                </th>
                <th
                  class="p-2 text-center border-r border-slate-100 bg-amber-50/50"
                >
                  น้ำหนัก (kg)
                </th>
                <th
                  class="p-2 text-center border-r border-slate-100 bg-amber-50/50"
                >
                  รอบเอว (cm)
                </th>
                <th
                  class="p-2 text-center border-r border-slate-100 bg-amber-50/50"
                >
                  BMI
                </th>
                <th
                  class="p-2 text-center border-r border-slate-100 bg-amber-50/50"
                >
                  % Fat
                </th>
                <th
                  class="p-2 text-center border-r border-slate-200 bg-amber-50/50"
                >
                  VP
                </th>
                <th
                  class="p-2 text-center border-r border-slate-100 bg-sky-50/50"
                >
                  น้ำหนัก (kg)
                </th>
                <th
                  class="p-2 text-center border-r border-slate-100 bg-sky-50/50"
                >
                  รอบเอว (cm)
                </th>
                <th
                  class="p-2 text-center border-r border-slate-100 bg-sky-50/50"
                >
                  BMI
                </th>
                <th
                  class="p-2 text-center border-r border-slate-100 bg-sky-50/50"
                >
                  % Fat
                </th>
                <th
                  class="p-2 text-center border-r border-slate-200 bg-sky-50/50"
                >
                  VP
                </th>
                <th
                  class="p-2 text-center border-r border-slate-100 bg-slate-50/50"
                >
                  น้ำหนัก (kg)
                </th>
                <th
                  class="p-2 text-center border-r border-slate-100 bg-slate-50/50"
                >
                  รอบเอว (cm)
                </th>
                <th
                  class="p-2 text-center border-r border-slate-100 bg-slate-50/50"
                >
                  BMI
                </th>
                <th
                  class="p-2 text-center border-r border-slate-100 bg-slate-50/50"
                >
                  % Fat
                </th>
                <th
                  class="p-2 text-center border-r border-slate-200 bg-slate-50/50"
                >
                  VP
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="(u, idx) in filteredTanitaChanges"
                :key="u.user_id"
                class="transition-colors hover:bg-slate-50/50 text-[12px]"
              >
                <td
                  class="p-3 text-center border-r border-slate-100 sticky left-0 z-10 bg-white"
                >
                  {{ idx + 1 }}
                </td>
                <td
                  class="p-3 text-center border-r border-slate-100 font-medium text-slate-500"
                >
                  {{ u.id_code || "-" }}
                </td>
                <td
                  class="p-3 sticky left-[48px] z-10 bg-white border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]"
                >
                  <div class="flex items-center gap-2">
                    <img
                      v-if="u.picture_url"
                      :src="u.picture_url"
                      class="w-6 h-6 rounded-full border border-slate-200 object-cover"
                    />
                    <div
                      v-else
                      class="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 border border-slate-200"
                    >
                      {{ (u.fname_th || "?")[0] }}
                    </div>
                    <span class="font-bold text-slate-800"
                      >{{ u.fname_th }} {{ u.lname_th }}</span
                    >
                  </div>
                </td>
                <td class="p-3 text-center border-r border-slate-100">
                  {{ calculateAge(u.birth_date) }}
                </td>
                <td class="p-3 text-center border-r border-slate-100">
                  {{
                    u.gender === "male" || u.gender === "ชาย"
                      ? "ชาย"
                      : u.gender === "female" || u.gender === "หญิง"
                        ? "หญิง"
                        : u.gender || "-"
                  }}
                </td>
                <td
                  class="p-3 text-center border-r border-slate-50 bg-emerald-50/10"
                >
                  {{ u.first_tanita?.weight ?? "-" }}
                </td>
                <td
                  class="p-3 text-center border-r border-slate-50 bg-emerald-50/10"
                >
                  {{ u.first_tanita?.waist ?? "-" }}
                </td>
                <td
                  class="p-3 text-center border-r border-slate-50 bg-emerald-50/10"
                >
                  {{ u.first_tanita?.bmi ?? "-" }}
                </td>
                <td
                  class="p-3 text-center border-r border-slate-50 bg-emerald-50/10"
                >
                  {{ u.first_tanita?.body_fat ?? "-" }}
                </td>
                <td
                  class="p-3 text-center border-r border-slate-200 bg-emerald-50/10"
                >
                  {{ u.first_tanita?.visceral_fat ?? "-" }}
                </td>
                <td
                  class="p-3 text-center border-r border-slate-50 bg-amber-50/10"
                >
                  {{ u.latest_tanita?.weight ?? "-" }}
                </td>
                <td
                  class="p-3 text-center border-r border-slate-50 bg-amber-50/10"
                >
                  {{ u.latest_tanita?.waist ?? "-" }}
                </td>
                <td
                  class="p-3 text-center border-r border-slate-50 bg-amber-50/10"
                >
                  {{ u.latest_tanita?.bmi ?? "-" }}
                </td>
                <td
                  class="p-3 text-center border-r border-slate-50 bg-amber-50/10"
                >
                  {{ u.latest_tanita?.body_fat ?? "-" }}
                </td>
                <td
                  class="p-3 text-center border-r border-slate-200 bg-amber-50/10"
                >
                  {{ u.latest_tanita?.visceral_fat ?? "-" }}
                </td>
                <td
                  class="p-3 text-center border-r border-slate-50 bg-sky-50/10 font-bold"
                  :class="
                    Number(u.latest_tanita?.weight || 0) -
                      Number(u.first_tanita?.weight || 0) <=
                    0
                      ? 'text-emerald-500'
                      : 'text-rose-500'
                  "
                >
                  {{
                    (
                      Number(u.latest_tanita?.weight || 0) -
                      Number(u.first_tanita?.weight || 0)
                    ).toFixed(1)
                  }}
                </td>
                <td
                  class="p-3 text-center border-r border-slate-50 bg-sky-50/10 font-medium"
                >
                  {{
                    (
                      Number(u.latest_tanita?.waist || 0) -
                      Number(u.first_tanita?.waist || 0)
                    ).toFixed(1)
                  }}
                </td>
                <td
                  class="p-3 text-center border-r border-slate-50 bg-sky-50/10 font-medium"
                >
                  {{
                    (
                      Number(u.latest_tanita?.bmi || 0) -
                      Number(u.first_tanita?.bmi || 0)
                    ).toFixed(1)
                  }}
                </td>
                <td
                  class="p-3 text-center border-r border-slate-50 bg-sky-50/10 font-medium"
                >
                  {{
                    (
                      Number(u.latest_tanita?.body_fat || 0) -
                      Number(u.first_tanita?.body_fat || 0)
                    ).toFixed(1)
                  }}
                </td>
                <td
                  class="p-3 text-center border-r border-slate-200 bg-sky-50/10 font-medium"
                >
                  {{
                    (
                      Number(u.latest_tanita?.visceral_fat || 0) -
                      Number(u.first_tanita?.visceral_fat || 0)
                    ).toFixed(0)
                  }}
                </td>
                <td
                  class="p-3 text-center border-r border-slate-50 bg-slate-50/10"
                >
                  {{ u.latest_tanita?.weight_score || 0 }}
                </td>
                <td
                  class="p-3 text-center border-r border-slate-50 bg-slate-50/10"
                >
                  {{ u.latest_tanita?.waist_score || 0 }}
                </td>
                <td
                  class="p-3 text-center border-r border-slate-50 bg-slate-50/10"
                >
                  {{ u.latest_tanita?.bmi_score || 0 }}
                </td>
                <td
                  class="p-3 text-center border-r border-slate-50 bg-slate-50/10"
                >
                  {{ u.latest_tanita?.fat_score || 0 }}
                </td>
                <td
                  class="p-3 text-center border-r border-slate-200 bg-slate-50/10"
                >
                  {{ u.latest_tanita?.vp_score || 0 }}
                </td>
                <td
                  class="p-3 text-center border-r border-slate-200 font-black text-slate-800"
                >
                  {{
                    u.latest_tanita?.total_points ||
                    u.latest_tanita?.total_score ||
                    0
                  }}
                </td>
                <td class="p-3 text-center min-w-[160px] bg-slate-50/30">
                  <div class="flex items-center justify-center gap-2 px-2">
                    <Activity
                      v-if="
                        u.summary.includes('ดีขึ้น') ||
                        u.summary.includes('รักษาวินัย')
                      "
                      :size="12"
                      class="text-emerald-500"
                    />
                    <TrendingUp
                      v-else-if="u.summary.includes('ก้าวหน้า')"
                      :size="12"
                      class="text-blue-500"
                    />
                    <Info v-else :size="12" class="text-amber-500" />
                    <span
                      class="text-[10px] font-bold text-slate-600 leading-tight whitespace-normal text-left"
                      >{{ u.summary }}</span
                    >
                  </div>
                </td>
              </tr>
              <tr v-if="filteredTanitaChanges.length === 0">
                <td
                  colspan="32"
                  class="p-10 text-center text-slate-400 font-bold"
                >
                  ยังไม่พบข้อมูลการบันทึกค่าร่างกายในกิจกรรมนี้
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div v-else-if="activeTab === 'responses'" class="space-y-5">
        <div class="flex items-center justify-between">
          <div class="search-pill-container lg:w-auto w-full">
            <Search :size="18" class="search-icon" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="ค้นหาชื่อ..."
            />
          </div>
          <div class="hidden md:block">
            <span
              class="text-[11px] font-bold text-slate-400 uppercase tracking-wider"
            >
              เปรียบเทียบแบบทดสอบ
              {{ filteredAssessmentComparison.length }} รายการ
            </span>
          </div>
        </div>
        <div
          v-if="loadingComparison"
          class="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-2xl"
        >
          <div
            class="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mb-4"
          ></div>
          <p class="text-slate-500 font-bold">กำลังโหลดข้อมูลผลการทดสอบ...</p>
        </div>
        <div v-else class="space-y-6">
          <div
            v-if="
              assessmentPartStats.partStats &&
              assessmentPartStats.partStats.length > 0
            "
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <div
              v-for="part in assessmentPartStats.partStats"
              :key="part.part_id || part.part_name"
              class="bg-white border border-slate-200 rounded-2xl p-4 hover:border-purple-200 hover:shadow-sm transition-all"
            >
              <div class="flex items-start justify-between mb-3">
                <div
                  class="font-bold text-slate-800 text-sm leading-snug flex-1 pr-2"
                >
                  {{ part.part_name || "หมวด " + part.part_id }}
                </div>
                <div class="shrink-0 text-right">
                  <div class="text-xl font-black text-purple-600">
                    {{ Number(part.avg_score).toFixed(1) }}
                  </div>
                  <div class="text-[10px] text-slate-400 font-bold">เฉลี่ย</div>
                </div>
              </div>
              <div
                class="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2"
              >
                <div
                  class="h-full bg-purple-400 rounded-full transition-all"
                  :style="{
                    width:
                      (part.avg_score /
                        (part.max_possible || part.max_score || 100)) *
                        100 +
                      '%',
                  }"
                ></div>
              </div>
              <div
                class="flex justify-between text-[10px] font-bold text-slate-400"
              >
                <span>ต่ำ {{ Number(part.min_score).toFixed(0) }}</span>
                <span>สูง {{ Number(part.max_score).toFixed(0) }}</span>
              </div>
            </div>
          </div>
          <div
            class="overflow-x-auto custom-scroll w-full border border-slate-200 rounded-2xl bg-white relative custom-table-wrapper"
          >
            <table
              class="w-full text-left whitespace-nowrap border-separate border-spacing-0 text-sm text-slate-600 clean-table"
            >
              <thead
                class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 shadow-sm"
              >
                <tr>
                  <th
                    class="p-4 text-sm font-bold text-slate-700 bg-slate-50 border-r border-slate-100 sticky left-0 z-20 whitespace-nowrap min-w-[200px]"
                  >
                    ชื่อ-นามสกุล
                  </th>
                  <th
                    class="p-4 text-sm font-bold text-slate-700 bg-slate-50 border-r border-slate-100 text-center whitespace-nowrap min-w-[120px]"
                  >
                    Pre-Test (คะแนน)
                  </th>
                  <th
                    class="p-4 text-sm font-bold text-slate-700 bg-slate-50 border-r border-slate-100 text-center whitespace-nowrap min-w-[120px]"
                  >
                    Post-Test (คะแนน)
                  </th>
                  <th
                    class="p-4 text-sm font-bold text-slate-700 bg-slate-50 border-r border-slate-100 text-center whitespace-nowrap min-w-[100px]"
                  >
                    ส่วนต่าง
                  </th>
                  <th
                    class="p-4 text-sm font-bold text-slate-700 bg-slate-50 border-r border-slate-100 text-center whitespace-nowrap min-w-[120px]"
                  >
                    สรุปผล
                  </th>
                  <th
                    class="p-4 text-sm font-bold text-slate-700 bg-slate-50 text-center whitespace-nowrap min-w-[80px]"
                  >
                    ดูผล
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr
                  v-for="u in filteredAssessmentComparison"
                  :key="u.user_id"
                  class="transition-colors hover:bg-slate-50/50"
                >
                  <td
                    class="p-4 sticky left-0 z-10 bg-white border-r border-slate-50"
                  >
                    <div class="flex items-center gap-3 min-w-[180px]">
                      <img
                        v-if="u.picture_url"
                        :src="u.picture_url"
                        class="w-8 h-8 rounded-full border border-slate-200 object-cover shrink-0"
                      />
                      <div
                        v-else
                        class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs shrink-0"
                      >
                        {{ (u.fname_th || "?")[0] }}
                      </div>
                      <div class="flex flex-col text-left">
                        <span
                          class="font-bold text-slate-800 text-sm whitespace-nowrap"
                          >{{ u.fname_th }} {{ u.lname_th }}</span
                        >
                        <span class="text-[10px] text-slate-400 font-medium">{{
                          u.team_name || "ไม่มีทีม"
                        }}</span>
                      </div>
                    </div>
                  </td>
                  <td class="p-4 text-center border-r border-slate-50">
                    <span class="font-extrabold text-slate-700 text-base">{{
                      u.pre_score ?? "-"
                    }}</span>
                  </td>
                  <td class="p-4 text-center border-r border-slate-50">
                    <span class="font-extrabold text-slate-700 text-base">{{
                      u.post_score ?? "-"
                    }}</span>
                  </td>
                  <td class="p-4 text-center border-r border-slate-50">
                    <span
                      v-if="u.pre_score != null && u.post_score != null"
                      class="font-black"
                      :class="
                        Number(u.post_score) > Number(u.pre_score)
                          ? 'text-emerald-500'
                          : 'text-rose-500'
                      "
                    >
                      {{ u.post_score - u.pre_score > 0 ? "+" : ""
                      }}{{ Number(u.post_score - u.pre_score) }}
                    </span>
                    <span v-else class="text-slate-300 font-bold">-</span>
                  </td>
                  <td class="p-4">
                    <div class="flex items-center justify-center">
                      <div
                        v-if="u.pre_score != null && u.post_score != null"
                        class="px-4 py-1 rounded-full text-xs font-bold border"
                        :class="
                          Number(u.post_score) > Number(u.pre_score)
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            : 'bg-amber-50 text-amber-600 border-amber-100'
                        "
                      >
                        {{
                          Number(u.post_score) > Number(u.pre_score)
                            ? "มีความก้าวหน้า"
                            : "ควรพัฒนาต่อ"
                        }}
                      </div>
                      <div
                        v-else
                        class="bg-slate-50 text-slate-400 px-4 py-1 rounded-full text-xs font-bold border border-slate-100"
                      >
                        ข้อมูลไม่ครบ
                      </div>
                    </div>
                  </td>
                  <td class="p-4 text-center">
                    <button
                      @click="openAssessmentModal(u)"
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-600 border border-purple-100 rounded-xl text-xs font-bold hover:bg-purple-100 transition-all"
                    >
                      <FileText :size="13" />
                      ดูผล
                    </button>
                  </td>
                </tr>
                <tr v-if="filteredAssessmentComparison.length === 0">
                  <td
                    colspan="6"
                    class="p-10 text-center text-slate-400 font-bold"
                  >
                    ยังไม่พบข้อมูลผลการทดสอบในกิจกรรมนี้
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </div>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="showGenderModal"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in"
        @click.self="showGenderModal = false"
      >
        <div class="bg-white rounded-3xl w-full max-w-sm overflow-hidden">
          <div
            class="flex justify-between items-center p-5 border-b border-slate-100"
          >
            <h3
              class="text-lg font-bold text-slate-900 flex items-center gap-2"
            >
              <Users class="text-blue-500" :size="20" /> สัดส่วนผู้เข้าร่วม
            </h3>
            <button
              @click="showGenderModal = false"
              class="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-full transition-colors"
            >
              <X :size="20" />
            </button>
          </div>
          <div class="p-6 space-y-4 bg-white">
            <div class="text-center mb-6">
              <div class="text-5xl font-extrabold text-slate-800">
                {{ totalParticipants }}
              </div>
              <div class="text-sm font-bold text-slate-500 mt-2">
                ผู้เข้าร่วมทั้งหมด
              </div>
            </div>
            <div class="space-y-3" v-if="genderStats && genderStats.length > 0">
              <div
                v-for="[gender, count] in genderStats"
                :key="gender"
                class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between transition-all hover:shadow-md"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-full flex items-center justify-center font-bold"
                    :class="
                      gender === 'ชาย'
                        ? 'bg-blue-50 text-blue-500'
                        : gender === 'หญิง'
                          ? 'bg-pink-50 text-pink-500'
                          : 'bg-slate-100 text-slate-500'
                    "
                  >
                    <User :size="18" />
                  </div>
                  <span class="font-bold text-slate-700">{{ gender }}</span>
                </div>
                <div class="text-right">
                  <div class="text-lg font-bold text-slate-800">
                    {{ count }}
                  </div>
                  <div class="text-xs text-slate-400 font-medium">
                    {{ Math.round((count / totalParticipants) * 100) }}%
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="text-center text-slate-400 font-medium py-4">
              ยังไม่มีข้อมูลสัดส่วนเพศ
            </div>
          </div>
        </div>
      </div>
    </Transition>
    <Transition name="fade">
      <div
        v-if="showUserProfileModal"
        class="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in"
        @click.self="showUserProfileModal = false"
      >
        <div
          class="bg-white rounded-3xl w-full max-w-[95%] sm:max-w-4xl max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden"
        >
          <div
            class="flex justify-between items-center p-5 border-b border-slate-100 bg-white"
          >
            <h3 class="text-lg font-bold text-slate-900">
              ข้อมูลผู้ใช้งาน & ประวัติ
            </h3>
            <button
              @click="showUserProfileModal = false"
              class="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-full transition-colors"
            >
              <X :size="20" />
            </button>
          </div>
          <div
            class="flex-1 overflow-y-auto p-5 bg-white custom-scroll"
            v-if="selectedUserProfile"
          >
            <div
              class="flex flex-col sm:flex-row gap-5 items-center sm:items-start mb-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"
            >
              <div
                class="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 text-3xl overflow-hidden shrink-0 border-4 border-white"
              >
                <img
                  v-if="selectedUserProfile.picture_url"
                  :src="selectedUserProfile.picture_url"
                  class="w-full h-full object-cover"
                />
                <span v-else>{{
                  selectedUserProfile.fname_th?.[0] || "?"
                }}</span>
              </div>
              <div class="text-center sm:text-left flex-1">
                <h4 class="text-xl font-bold text-slate-900">
                  {{ selectedUserProfile.fname_th }}
                  {{ selectedUserProfile.lname_th }}
                </h4>
                <p class="text-sm font-medium text-slate-500 mt-1">
                  {{ selectedUserProfile.email || "-" }}
                  <span class="hidden sm:inline">|</span
                  ><br class="sm:hidden" />
                  {{ selectedUserProfile.phone || "-" }}
                </p>
                <div
                  class="mt-3 text-xs font-bold bg-orange-50 text-orange-600 border border-orange-100 px-3 py-1 rounded-lg inline-block"
                >
                  {{
                    selectedUserProfile.role_type ||
                    selectedUserProfile.role ||
                    "สมาชิก"
                  }}
                </div>
              </div>
            </div>
            <div
              class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-slate-600 mb-6"
            >
              <div
                class="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm"
              >
                <div
                  class="font-bold text-slate-800 mb-3 flex items-center gap-2"
                >
                  <User :size="16" class="text-orange-500" /> ข้อมูลส่วนตัว
                </div>
                <div class="grid grid-cols-2 gap-2 mb-2">
                  <span class="text-slate-400 font-medium">เพศ:</span>
                  <span class="font-bold text-slate-800">{{
                    selectedUserProfile.gender || "-"
                  }}</span>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <span class="text-slate-400 font-medium">อายุ:</span>
                  <span class="font-bold text-slate-800"
                    >{{ calculateAge(selectedUserProfile.birth_date) }} ปี</span
                  >
                </div>
              </div>
              <div
                class="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm"
              >
                <div
                  class="font-bold text-slate-800 mb-3 flex items-center gap-2"
                >
                  <Target :size="16" class="text-orange-500" /> เป้าหมาย
                </div>
                <div class="font-bold text-slate-800 leading-relaxed">
                  {{ selectedUserProfile.main_goal || "ไม่ได้ระบุเป้าหมาย" }}
                </div>
              </div>
            </div>
            <h4
              class="font-bold text-slate-900 mb-3 px-1 text-base flex items-center gap-2"
            >
              <ClipboardCheck :size="18" class="text-slate-500" />
              ประวัติการส่งภารกิจ
            </h4>
            <div
              class="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm"
            >
              <div class="overflow-x-auto w-full no-scrollbar">
                <table
                  class="w-full text-sm text-left text-slate-600 min-w-[300px]"
                >
                  <thead
                    class="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold"
                  >
                    <tr>
                      <th class="p-4 whitespace-nowrap">เวลา</th>
                      <th class="p-4 min-w-[150px]">ภารกิจ</th>
                      <th class="p-4 text-center whitespace-nowrap">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <tr
                      v-for="sub in selectedUserSubmissions"
                      :key="sub.id"
                      class="hover:bg-slate-50 transition-colors"
                    >
                      <td
                        class="p-4 whitespace-nowrap text-slate-500 text-xs font-medium"
                      >
                        {{ formatDate(sub.created_at) }}
                      </td>
                      <td class="p-4 font-bold text-slate-800">
                        {{ sub.task_name || "กิจกรรม" }}
                      </td>
                      <td class="p-4 text-center">
                        <span
                          class="text-[10px] sm:text-xs px-2.5 py-1 rounded-full whitespace-nowrap font-bold border"
                          :class="
                            sub.status === 'approved'
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                              : sub.status === 'rejected'
                                ? 'bg-rose-50 text-rose-600 border-rose-100'
                                : 'bg-orange-50 text-orange-600 border-orange-100'
                          "
                          >{{
                            sub.status === "approved"
                              ? "อนุมัติ"
                              : sub.status === "rejected"
                                ? "ปฏิเสธ"
                                : "รอตรวจ"
                          }}</span
                        >
                      </td>
                    </tr>
                    <tr v-if="selectedUserSubmissions.length === 0">
                      <td
                        colspan="3"
                        class="p-10 text-center text-slate-400 font-bold"
                      >
                        ไม่มีข้อมูลการส่งภารกิจ
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
  <Teleport to="body">
    <div
      v-if="activeMenuId !== null"
      class="fixed inset-0 z-[1000]"
      @click="activeMenuId = null"
    >
      <div
        class="fixed z-[1001] w-56 bg-white border border-slate-200 shadow-2xl rounded-2xl flex flex-col overflow-hidden transition-all duration-200 animate-in fade-in zoom-in-95"
        :style="{
          top: menuPos.top + 'px',
          right: menuPos.right + 'px',
          transform: menuPos.transform,
        }"
        @click.stop
      >
        <div class="px-4 py-2 mb-1 border-b border-slate-50">
          <p
            class="text-[10px] font-bold text-slate-400 uppercase tracking-wider"
          >
            จัดการรายการนี้
          </p>
        </div>
        <button
          @click="
            updateSubStatus(Number(activeMenuId), 'approved');
            activeMenuId = null;
          "
          class="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 transition-colors flex items-center gap-3"
        >
          <div class="p-1.5 bg-emerald-100/50 rounded-lg text-emerald-500">
            <Check :size="16" stroke-width="3" />
          </div>
          อนุมัติรายการ
        </button>
        <button
          @click="
            deleteSubmission(Number(activeMenuId));
            activeMenuId = null;
          "
          class="w-full px-4 py-2.5 text-left text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-3"
        >
          <div class="p-1.5 bg-rose-100/50 rounded-lg text-rose-500">
            <Trash2 :size="16" />
          </div>
          ลบรายการ/ปฏิเสธ
        </button>
      </div>
    </div>
  </Teleport>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="showAssessmentModal"
        class="fixed inset-0 z-[200] flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm"
        @click.self="showAssessmentModal = false"
      >
        <div
          class="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
        >
          <div
            class="flex items-center justify-between p-5 border-b border-slate-100 shrink-0"
          >
            <div class="flex items-center gap-3">
              <button
                v-if="assessmentModalView === 'detail'"
                @click="
                  assessmentModalView = 'list';
                  selectedAssessmentRecord = null;
                "
                class="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
              >
                <ChevronLeft :size="18" />
              </button>
              <div>
                <h3 class="text-base font-bold text-slate-900">
                  {{
                    assessmentModalView === "list"
                      ? "ประวัติการประเมินสุขภาพ"
                      : "ผลการประเมินสุขภาพ"
                  }}
                </h3>
                <p class="text-xs text-slate-400 font-medium mt-0.5">
                  {{ selectedAssessmentUser?.fname_th }}
                  {{ selectedAssessmentUser?.lname_th }}
                </p>
              </div>
            </div>
            <button
              @click="showAssessmentModal = false"
              class="p-2 hover:bg-rose-50 hover:text-rose-500 rounded-xl transition-colors text-slate-400"
            >
              <X :size="18" />
            </button>
          </div>
          <div
            v-if="assessmentModalLoading"
            class="flex-1 flex items-center justify-center py-16 gap-3"
          >
            <div
              class="w-6 h-6 border-4 border-purple-400 border-t-transparent rounded-full animate-spin"
            ></div>
            <span class="text-slate-400 font-bold text-sm"
              >กำลังโหลดข้อมูล...</span
            >
          </div>
          <div
            v-else-if="assessmentModalView === 'list'"
            class="flex-1 overflow-y-auto custom-scroll p-5 space-y-3"
          >
            <div
              v-if="assessmentModalRecords.length === 0"
              class="flex flex-col items-center justify-center py-16 gap-3 text-slate-300"
            >
              <Inbox :size="32" />
              <span class="text-sm font-bold text-slate-400"
                >ยังไม่มีข้อมูลการประเมิน</span
              >
            </div>
            <div
              v-for="rec in assessmentModalRecords"
              :key="rec.id || rec.user_id + rec.test_type"
              @click="
                selectedAssessmentRecord = rec;
                assessmentModalView = 'detail';
              "
              class="border border-slate-200 rounded-2xl p-4 cursor-pointer hover:border-purple-200 hover:bg-purple-50/30 transition-all group"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div
                    class="p-2.5 rounded-xl"
                    :style="{
                      background: healthLevelMeta(rec.overall_level || '-').bg,
                    }"
                  >
                    <FileText
                      :size="16"
                      :style="{
                        color: healthLevelMeta(rec.overall_level || '-').color,
                      }"
                    />
                  </div>
                  <div>
                    <div class="font-bold text-slate-800 text-sm">
                      {{
                        rec.test_type === "pre_test"
                          ? "Pre-Test"
                          : rec.test_type === "post_test"
                            ? "Post-Test"
                            : "ผลการประเมิน"
                      }}
                    </div>
                    <div class="text-xs text-slate-400 font-medium mt-0.5">
                      {{
                        rec.pre_date ||
                        rec.post_date ||
                        rec.submitted_at ||
                        rec.created_at
                          ? formatDate(
                              rec.pre_date ||
                                rec.post_date ||
                                rec.submitted_at ||
                                rec.created_at,
                            )
                          : "-"
                      }}
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <span
                    v-if="rec.overall_level"
                    class="px-3 py-1 rounded-full text-xs font-bold border"
                    :class="healthLevelMeta(rec.overall_level).badge"
                  >
                    {{ rec.overall_level }}
                  </span>
                  <span class="text-lg font-black text-slate-700">{{
                    rec.total_score ?? rec.pre_score ?? rec.post_score ?? "-"
                  }}</span>
                  <span class="text-xs text-slate-400">คะแนน</span>
                  <ChevronRight
                    :size="16"
                    class="text-slate-300 group-hover:text-purple-400 transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>
          <div
            v-else-if="
              assessmentModalView === 'detail' && selectedAssessmentRecord
            "
            class="flex-1 overflow-y-auto custom-scroll"
          >
            <div
              class="p-5 border-b border-slate-100"
              :style="{
                background: healthLevelMeta(
                  selectedAssessmentRecord.overall_level || '-',
                ).bg,
              }"
            >
              <div class="flex items-center justify-between">
                <div>
                  <p
                    class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1"
                  >
                    ระดับสุขภาพโดยรวม
                  </p>
                  <div
                    class="text-2xl font-black"
                    :style="{
                      color: healthLevelMeta(
                        selectedAssessmentRecord.overall_level || '-',
                      ).color,
                    }"
                  >
                    {{ selectedAssessmentRecord.overall_level || "-" }}
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-3xl font-black text-slate-800">
                    {{
                      selectedAssessmentRecord.total_score ??
                      selectedAssessmentRecord.pre_score ??
                      selectedAssessmentRecord.post_score ??
                      "-"
                    }}
                  </div>
                  <div class="text-xs text-slate-400 font-bold">คะแนนรวม</div>
                </div>
              </div>
            </div>
            <div class="p-5 space-y-3">
              <template
                v-if="parseSectionScores(selectedAssessmentRecord).length > 0"
              >
                <div
                  class="text-xs font-black text-slate-400 uppercase tracking-widest mb-3"
                >
                  ผลแยกตามด้านสุขภาพ
                </div>
                <div
                  v-for="sec in parseSectionScores(selectedAssessmentRecord)"
                  :key="sec.sectionId || sec.section_id"
                  class="border rounded-2xl p-4 transition-all"
                  :style="{
                    borderColor:
                      healthLevelMeta(sec.level || sec.overall_level || '-')
                        .color + '40',
                    background: healthLevelMeta(
                      sec.level || sec.overall_level || '-',
                    ).bg,
                  }"
                >
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-bold text-slate-700">
                      {{
                        healthSectionLabels[sec.sectionId || sec.section_id] ||
                        sec.sectionId ||
                        sec.section_id
                      }}
                    </span>
                    <div class="flex items-center gap-2">
                      <span class="text-base font-black text-slate-800">{{
                        sec.score
                      }}</span>
                      <span
                        class="px-2.5 py-0.5 rounded-full text-[11px] font-bold border"
                        :class="
                          healthLevelMeta(sec.level || sec.overall_level || '-')
                            .badge
                        "
                      >
                        {{ sec.level || sec.overall_level }}
                      </span>
                    </div>
                  </div>
                </div>
              </template>
              <template
                v-if="
                  selectedAssessmentRecord.responses &&
                  selectedAssessmentRecord.responses.length > 0
                "
              >
                <div
                  class="text-xs font-black text-slate-400 uppercase tracking-widest mt-5 mb-3"
                >
                  คำตอบของผู้ประเมิน
                </div>
                <div
                  v-for="(ans, idx) in selectedAssessmentRecord.responses"
                  :key="idx"
                  class="bg-slate-50 rounded-xl p-3 border border-slate-100"
                >
                  <p class="text-xs font-bold text-slate-500 mb-1">
                    ข้อ {{ Number(idx) + 1 }}
                  </p>
                  <p
                    class="text-sm text-slate-700 font-medium leading-snug mb-2"
                  >
                    {{ ans.question_text || ans.question }}
                  </p>
                  <div
                    class="inline-flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1 rounded-lg text-xs font-bold text-slate-800"
                  >
                    <CheckCircle2
                      :size="13"
                      class="text-emerald-500 shrink-0"
                    />
                    {{ ans.answer_text || ans.answer }}
                    <span
                      v-if="ans.score != null"
                      class="text-slate-400 font-medium"
                      >({{ ans.score }} คะแนน)</span
                    >
                  </div>
                </div>
              </template>
              <div
                v-if="
                  parseSectionScores(selectedAssessmentRecord).length === 0 &&
                  (!selectedAssessmentRecord.responses ||
                    selectedAssessmentRecord.responses.length === 0)
                "
                class="py-10 text-center text-slate-400 font-bold text-sm"
              >
                ไม่มีข้อมูลรายละเอียดการประเมิน
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="showPointsModal"
        class="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
        @click.self="closePointsModal"
      >
        <div
          class="w-full max-w-lg rounded-3xl bg-white p-6 soft-shadow-lg sm:p-7"
          role="dialog"
          aria-modal="true"
          aria-labelledby="points-modal-title"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-xs font-bold uppercase tracking-wider text-orange-500">
                จัดการคะแนนผู้เข้าร่วม
              </p>
              <h3
                id="points-modal-title"
                class="mt-1 text-xl font-extrabold text-slate-900"
              >
                {{ pointsParticipant?.fname_th }}
                {{ pointsParticipant?.lname_th }}
              </h3>
            </div>
            <button
              type="button"
              class="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              :disabled="!!updatingId"
              aria-label="ปิด"
              @click="closePointsModal"
            >
              <X :size="20" />
            </button>
          </div>

          <div class="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              class="rounded-2xl border p-4 text-left transition-colors"
              :class="
                pointsTarget === 'ranking'
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              "
              @click="pointsTarget = 'ranking'"
            >
              <span class="block text-sm font-extrabold">คะแนนอันดับ</span>
              <span class="mt-1 block text-xs">ใช้จัดอันดับกิจกรรมนี้</span>
            </button>
            <button
              type="button"
              class="rounded-2xl border p-4 text-left transition-colors"
              :class="
                pointsTarget === 'shop'
                  ? 'border-orange-500 bg-orange-50 text-orange-800'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              "
              @click="pointsTarget = 'shop'"
            >
              <span class="block text-sm font-extrabold">คะแนนร้าน</span>
              <span class="mt-1 block text-xs">ใช้แลกรางวัลในร้านค้า</span>
            </button>
          </div>

          <label class="mt-5 block">
            <span class="text-sm font-bold text-slate-700">จำนวนคะแนน</span>
            <input
              v-model.number="pointsAmount"
              type="number"
              min="1"
              step="1"
              inputmode="numeric"
              class="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-lg font-extrabold text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
              placeholder="เช่น 10"
              @keyup.enter="submitParticipantPoints"
            />
          </label>
          <label class="mt-4 block">
            <span class="text-sm font-bold text-slate-700">
              เหตุผล <span class="font-normal text-slate-400">(ไม่บังคับ)</span>
            </span>
            <input
              v-model="pointsReason"
              type="text"
              maxlength="500"
              class="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
              placeholder="ระบุเหตุผลเพื่อใช้ตรวจสอบย้อนหลัง"
            />
          </label>

          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              class="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200"
              :disabled="!!updatingId"
              @click="closePointsModal"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!!updatingId"
              @click="submitParticipantPoints"
            >
              <Loader2 v-if="updatingId" class="animate-spin" :size="16" />
              <Plus v-else :size="16" />
              เพิ่มคะแนน
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
@import url("https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap");
.font-sarabun {
  font-family: "Sarabun", sans-serif;
}
.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.custom-scroll::-webkit-scrollbar {
  height: 6px;
  width: 6px;
}
.custom-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scroll::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 10px;
}
.search-pill-container {
  display: flex;
  align-items: center;
  background: white;
  padding: 0 20px;
  height: 48px;
  border-radius: 99px;
  border: 1.5px solid #e2e8f0;
  box-shadow: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  gap: 12px;
  width: 100%;
}
@media (min-width: 640px) {
  .search-pill-container {
    width: 420px;
  }
}
.search-pill-container:focus-within {
  border-color: #f97316;
  background: #fff;
}
.search-icon {
  color: #9ca3af;
  flex-shrink: 0;
}
.search-pill-container input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 700;
  color: #1e293b;
}
.search-pill-container input::placeholder {
  color: #9ca3af;
  font-weight: 500;
}
.custom-table-wrapper {
  border: 1px solid #e2e8f0 !important;
}
.custom-table-wrapper th,
.clean-table th {
  background-color: #f8fafc;
  color: #334155;
  font-weight: 700;
  border-bottom: 1px solid #e2e8f0;
  padding: 16px;
}
.custom-table-wrapper td,
.clean-table td {
  border-bottom: 1px solid #f1f5f9;
  padding: 16px;
}
thead th.sticky {
  z-index: 20;
}
@media (max-width: 640px) {
  .custom-table-wrapper th {
    padding: 12px 10px;
    font-size: 0.75rem;
  }
  .custom-table-wrapper td {
    padding: 12px 10px;
    font-size: 0.75rem;
  }
  .sticky.left-0 {
    left: 0 !important;
  }
  .sticky.left-\[48px\] {
    left: 0 !important;
  }
  .sticky.left-\[52px\] {
    left: 52px !important;
    min-width: 160px !important;
    max-width: 160px !important;
    border-left: none !important;
  }
  .sticky.left-\[64px\] {
    left: 64px !important;
    min-width: 160px !important;
    max-width: 160px !important;
    border-left: none !important;
  }
  .sticky.left-\[148px\] {
    left: 148px !important;
    min-width: 160px !important;
    max-width: 160px !important;
    border-left: none !important;
  }
  .sticky.left-\[172px\] {
    left: 172px !important;
    min-width: 160px !important;
    max-width: 160px !important;
    border-left: none !important;
  }
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
@keyframes slideUp {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
.slide-up-enter-active {
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-up-leave-active {
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) reverse;
}
@keyframes zoomIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
.animate-in {
  animation: zoomIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.ov-card {
  position: relative;
  background: #ffffff;
  border: 1px solid #f1f5f9;
  padding: 1rem;
  border-radius: 1.25rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  height: 100%;
  min-height: 130px;
}
@media (min-width: 640px) {
  .ov-card {
    padding: 1.25rem;
    min-height: 150px;
    border-radius: 1.5rem;
  }
}
.ov-card:hover {
  transform: translateY(-3px);
  border-color: #ffedd5;
}
.ov-card-bar {
  position: absolute;
  inset: 0;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  border-radius: 1.5rem 1.5rem 0 0;
}
.ov-panel {
  background: #ffffff;
  border: 1px solid #f1f5f9;
  border-radius: 1.5rem;
  padding: 1.5rem;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  height: 100%;
}
.ov-panel:hover {
  border-color: #e2e8f0;
}
.ov-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-weight: 700;
  color: #475569;
}
.ov-badge {
  font-size: 0.7rem;
  font-weight: 700;
  background: #f1f5f9;
  color: #64748b;
  padding: 4px 12px;
  border-radius: 99px;
  border: 1px solid #e2e8f0;
}
.dashboard-hidden-date::-webkit-calendar-picker-indicator {
  cursor: pointer;
  opacity: 0;
  position: absolute;
  right: 0;
  top: 0;
  width: 100%;
  height: 100%;
  z-index: 20;
}
.dashboard-hidden-date {
  position: absolute;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
/* ----- Soft Shadow System (แสงเงานุ่มแทนกรอบเส้น) ----- */
.soft-shadow-sm {
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 2px 8px -2px rgba(15, 23, 42, 0.06);
}
.soft-shadow {
  box-shadow:
    0 4px 15px -1px rgba(15, 23, 42, 0.05),
    0 10px 30px -5px rgba(15, 23, 42, 0.08);
}
.soft-shadow-lg {
  box-shadow:
    0 10px 25px -5px rgba(15, 23, 42, 0.1),
    0 25px 50px -12px rgba(15, 23, 42, 0.15);
}
</style>
