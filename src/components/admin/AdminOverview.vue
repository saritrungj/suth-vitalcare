<script setup lang="ts">
import { onMounted, computed, ref, nextTick, watch } from "vue";
import {
  Activity,
  CheckCircle2,
  Heart,
  TrendingUp,
  FileText,
  UserCheck,
  AlertTriangle,
  Users,
  LayoutDashboard,
  ArrowUpRight,
  X,
  Target,
  ArrowDown,
  ArrowUp,
} from "lucide-vue-next";
import { useAdminOverview } from "../../composables/useAdminOverview";

const {
  loading,
  data,
  deep,
  bmiTotal,
  inactiveStreakDays,
  loadingInactiveStreak,
  inactiveStreak,
  bmiRiskCount,
  showBmiRiskExpanded,
  loadingAllParticipants,
  bmiRiskUsers,
  buildAllCharts,
  getIcon,
  fetchStats,
  formatDate,
  openUserDetail,
  allParticipants,
  teamsListData,
  highRiskCounts,
  ongoingActivities,
  submissionTimeStats,
  goalAchievementStats,
  roleDistributionData,
  topSubmittedActivities, // <--- รับค่ามาจาก useAdminOverview
} = useAdminOverview();

defineEmits(["change-tab"]);

// --- ส่วนจัดการการเลื่อนกราฟการเติบโตไปวันล่าสุด ---
const chartGrowthScrollRef = ref<HTMLElement | null>(null);
const scrollToLatest = async () => {
  await nextTick();
  if (chartGrowthScrollRef.value) {
    chartGrowthScrollRef.value.scrollLeft =
      chartGrowthScrollRef.value.scrollWidth;
  }
};

watch(
  () => data.value?.userGrowth,
  () => {
    scrollToLatest();
  },
  { deep: true },
);

onMounted(async () => {
  await fetchStats();
  scrollToLatest();
});
// ---------------------------------------------

// ธีมสีสำหรับการ์ดสถิติ
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

const submissionTimeLabels: Record<string, string> = {
  morning: "เช้า",
  afternoon: "บ่าย",
  evening: "เย็น",
  night: "ดึก",
};

const ongoingActivitiesSort = ref<"desc" | "asc">("desc");
const bmiRiskSort = ref<"desc" | "asc">("desc");

const sortedOngoingActivities = computed(() => {
  const list = [...(ongoingActivities.value || [])];
  return list.sort((a: any, b: any) => {
    const av = Number(a.participant_count) || 0;
    const bv = Number(b.participant_count) || 0;
    return ongoingActivitiesSort.value === "desc" ? bv - av : av - bv;
  });
});

const sortedBmiRiskUsers = computed(() => {
  const list = [...(bmiRiskUsers.value || [])];
  return list.sort((a: any, b: any) => {
    const av = Number(a.bmi) || 0;
    const bv = Number(b.bmi) || 0;
    return bmiRiskSort.value === "desc" ? bv - av : av - bv;
  });
});

const ongoingExtremes = computed(() => {
  const list = [...(ongoingActivities.value || [])];
  if (!list.length) return null;
  const sorted = list.sort(
    (a: any, b: any) =>
      (Number(b.participant_count) || 0) - (Number(a.participant_count) || 0),
  );
  return { max: sorted[0], min: sorted[sorted.length - 1] };
});

const bmiRiskExtremes = computed(() => {
  const list = [...(bmiRiskUsers.value || [])];
  if (!list.length) return null;
  const sorted = list.sort(
    (a: any, b: any) => (Number(b.bmi) || 0) - (Number(a.bmi) || 0),
  );
  return { max: sorted[0], min: sorted[sorted.length - 1] };
});
</script>

<template>
  <div class="min-h-screen bg-white text-slate-800 font-sarabun pb-24">
    <div
      class="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 space-y-6"
    >
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1
            class="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-500"
          >
            แดชบอร์ด
          </h1>
        </div>
      </div>

      <div
        v-if="loading"
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <div
          v-for="i in 4"
          :key="i"
          class="h-36 bg-slate-50 rounded-3xl animate-pulse soft-shadow"
        ></div>
      </div>
      <div
        v-else
        class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-6"
      >
        <div
          v-for="(s, index) in data.stats"
          :key="s.label"
          :class="[
            'border rounded-3xl p-6 relative overflow-hidden transition-all duration-300 hover:-translate-y-1.5 cursor-pointer group soft-shadow hover:soft-shadow-lg',
            kpiThemes[index % kpiThemes.length].wrapper,
          ]"
          @click="
            s.label === 'คำขอรออนุมัติ'
              ? $emit('change-tab', 'requests')
              : undefined
          "
        >
          <div
            class="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-40 blur-2xl transition-all duration-500 group-hover:scale-150"
            :class="kpiThemes[index % kpiThemes.length].iconBox.split(' ')[0]"
          ></div>
          <div class="flex justify-between items-start relative z-10 pt-1">
            <div
              :class="[
                'p-3 rounded-2xl transition-all soft-shadow-sm',
                kpiThemes[index % kpiThemes.length].iconBox,
              ]"
            >
              <component :is="getIcon(s.icon)" class="w-6 h-6" />
            </div>
          </div>
          <div class="mt-6 relative z-10">
            <p
              :class="[
                'text-sm font-semibold mb-1 transition-colors',
                kpiThemes[index % kpiThemes.length].label,
              ]"
            >
              {{ s.label }}
            </p>
            <div class="flex items-end justify-between">
              <h3
                :class="[
                  'text-4xl font-black tracking-tight',
                  kpiThemes[index % kpiThemes.length].value,
                ]"
              >
                {{
                  typeof s.value === "number"
                    ? s.value.toLocaleString()
                    : s.value
                }}
              </h3>
              <ArrowUpRight
                v-if="s.label !== 'กิจกรรมฉบับร่าง'"
                :class="[
                  'w-5 h-5 transition-colors',
                  kpiThemes[index % kpiThemes.length].arrow,
                ]"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
        <div
          class="lg:col-span-2 bg-white rounded-3xl soft-shadow p-5 sm:p-6 flex flex-col h-[420px]"
        >
          <div class="mb-4">
            <h2 class="text-lg font-bold text-slate-900">
              การเติบโตของผู้ใช้งาน
            </h2>
            <p class="text-xs font-medium text-slate-400 mt-0.5">
              ผู้ใช้งานสะสมบนแพลตฟอร์ม
            </p>
          </div>
          <div
            ref="chartGrowthScrollRef"
            class="flex-1 w-full relative overflow-x-auto overflow-y-hidden custom-scrollbar-x"
          >
            <div
              class="h-full"
              :style="{
                minWidth:
                  Math.max((data.userGrowth?.length || 0) * 70, 700) + 'px',
              }"
            >
              <canvas id="chart-growth"></canvas>
            </div>
          </div>
        </div>
        <div
          class="lg:col-span-1 bg-white rounded-3xl soft-shadow p-5 sm:p-6 flex flex-col h-[420px]"
        >
          <div class="flex flex-col mb-3">
            <h2 class="text-lg font-bold text-slate-900">
              ช่วงเวลาในการส่งงาน
            </h2>
            <p class="text-xs font-medium text-slate-400 mt-0.5">
              สัดส่วนการส่งตามช่วงเวลา
            </p>
          </div>
          <div
            class="relative flex-1 flex flex-col items-center justify-center p-2"
          >
            <div
              class="w-full max-w-[180px] aspect-square relative flex items-center justify-center"
            >
              <canvas
                id="chart-submission-time"
                class="w-full h-full relative z-10"
              ></canvas>
              <div
                class="absolute inset-0 flex flex-col items-center justify-center z-0 mt-1"
              >
                <span class="text-4xl font-black text-slate-900">
                  {{
                    submissionTimeStats.morning +
                    submissionTimeStats.afternoon +
                    submissionTimeStats.evening +
                    submissionTimeStats.night
                  }}
                </span>
                <span
                  class="text-[10px] font-bold text-slate-400 tracking-widest mt-0.5"
                  >ทั้งหมด</span
                >
              </div>
            </div>
          </div>
          <div
            class="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-100/70"
          >
            <div
              v-for="(val, key) in submissionTimeStats"
              :key="key"
              class="text-center bg-slate-50/70 rounded-xl py-2.5"
            >
              <div class="font-bold text-xl leading-none text-indigo-600">
                {{ val }}
              </div>
              <div class="text-[10px] text-slate-500 font-semibold mt-1">
                {{ submissionTimeLabels[key] || key }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
        <div
          class="bg-white rounded-3xl soft-shadow p-5 sm:p-6 flex flex-col h-[400px]"
        >
          <div class="mb-4">
            <h2 class="text-lg font-bold text-slate-900">ประเภทผู้ใช้งาน</h2>
            <p class="text-xs font-medium text-slate-400 mt-0.5">
              แบ่งตามบทบาทในระบบ
            </p>
          </div>
          <div class="flex-1 w-full relative">
            <canvas id="chart-role"></canvas>
          </div>
        </div>

        <div
          class="bg-white rounded-3xl soft-shadow p-5 sm:p-6 flex flex-col h-[400px]"
        >
          <div class="mb-4">
            <h2 class="text-lg font-bold text-slate-900">กลุ่มอายุ</h2>
            <p class="text-xs font-medium text-slate-400 mt-0.5">
              แบ่งตามช่วงวัยและเพศ
            </p>
          </div>
          <div class="flex-1 w-full relative">
            <canvas id="chart-demographics"></canvas>
          </div>
        </div>

        <div
          class="bg-white rounded-3xl soft-shadow p-5 sm:p-6 flex flex-col h-[400px]"
        >
          <div class="mb-4">
            <h2 class="text-lg font-bold text-slate-900">กิจกรรมยอดฮิต</h2>
            <p class="text-xs font-medium text-slate-400 mt-0.5">
              การมีส่วนร่วมสูงสุด (จำนวนคน)
            </p>
          </div>
          <div class="flex-1 w-full relative">
            <canvas id="chart-events"></canvas>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
        <div
          class="lg:col-span-2 bg-white rounded-3xl soft-shadow p-5 sm:p-6 flex flex-col h-[420px]"
        >
          <div class="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2
                class="text-lg font-bold text-slate-900 flex items-center gap-2"
              >
                <Target class="w-5 h-5 text-emerald-500" />
                การทำตามเป้าหมายได้สำเร็จ
              </h2>
              <p class="text-xs font-medium text-slate-400 mt-0.5">
                Top 5 กิจกรรมที่มีอัตราการบรรลุเป้าหมายสูงสุด
              </p>
            </div>
            <div
              class="hidden sm:flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl"
            >
              <CheckCircle2 class="w-4 h-4" />
              <span class="text-xs font-bold"
                >{{ goalAchievementStats.totalAchievers.toLocaleString() }} คน
                สำเร็จแล้ว</span
              >
            </div>
          </div>
          <div class="flex-1 w-full relative">
            <canvas id="chart-goal-achievement"></canvas>
          </div>
        </div>
        <div
          class="lg:col-span-1 bg-white rounded-3xl soft-shadow p-5 sm:p-6 flex flex-col h-[420px]"
        >
          <div class="mb-2">
            <h2 class="text-lg font-bold text-slate-900">อัตราความสำเร็จรวม</h2>
            <p class="text-xs font-medium text-slate-400 mt-0.5">
              ผู้สำเร็จเป้าหมายต่อผู้เข้าร่วมทั้งหมด
            </p>
          </div>
          <div
            class="relative flex-1 flex flex-col items-center justify-center"
          >
            <div class="relative w-40 h-40 flex items-center justify-center">
              <svg class="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="#f1f5f9"
                  stroke-width="10"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="url(#goalGradient)"
                  stroke-width="10"
                  stroke-linecap="round"
                  :stroke-dasharray="2 * Math.PI * 42"
                  :stroke-dashoffset="
                    2 *
                    Math.PI *
                    42 *
                    (1 - goalAchievementStats.overallRate / 100)
                  "
                  style="transition: stroke-dashoffset 0.8s ease-out"
                />
                <defs>
                  <linearGradient
                    id="goalGradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                  >
                    <stop offset="0%" stop-color="#34d399" />
                    <stop offset="100%" stop-color="#10b981" />
                  </linearGradient>
                </defs>
              </svg>
              <div
                class="absolute inset-0 flex flex-col items-center justify-center"
              >
                <span class="text-4xl font-black text-slate-900"
                  >{{ goalAchievementStats.overallRate
                  }}<span class="text-2xl text-slate-400">%</span></span
                >
                <span
                  class="text-[10px] font-bold text-slate-400 tracking-widest mt-0.5"
                  >บรรลุเป้าหมาย</span
                >
              </div>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100/70">
            <div class="text-center bg-emerald-50 rounded-xl py-2.5">
              <div class="font-bold text-xl leading-none text-emerald-600">
                {{ goalAchievementStats.totalAchievers.toLocaleString() }}
              </div>
              <div class="text-[10px] text-emerald-700 font-semibold mt-1">
                สำเร็จ
              </div>
            </div>
            <div class="text-center bg-slate-50 rounded-xl py-2.5">
              <div class="font-bold text-xl leading-none text-slate-600">
                {{ goalAchievementStats.notAchieved.toLocaleString() }}
              </div>
              <div class="text-[10px] text-slate-500 font-semibold mt-1">
                คนที่ยังทำไม่เสร็จ
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-6"
      >
        <div class="bg-white rounded-3xl soft-shadow flex flex-col h-[450px]">
          <div class="px-6 pt-6 pb-3 border-b border-slate-100/70">
            <div class="flex items-center justify-between mb-3">
              <h2
                class="text-base font-bold text-slate-900 flex items-center gap-2"
              >
                <Activity class="w-5 h-5 text-indigo-500" />
                กิจกรรมที่ดำเนินการอยู่
              </h2>
              <span
                class="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-xs font-black"
                >{{ ongoingActivities.length }}</span
              >
            </div>
            <div
              v-if="ongoingExtremes"
              class="flex items-center justify-between gap-2"
            >
              <div class="flex items-center bg-slate-50 rounded-lg p-0.5">
                <button
                  @click="ongoingActivitiesSort = 'desc'"
                  :class="[
                    'px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all',
                    ongoingActivitiesSort === 'desc'
                      ? 'bg-white text-indigo-600 soft-shadow-sm'
                      : 'text-slate-400 hover:text-slate-600',
                  ]"
                >
                  <ArrowDown class="w-3 h-3" /> มากสุด
                </button>
                <button
                  @click="ongoingActivitiesSort = 'asc'"
                  :class="[
                    'px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all',
                    ongoingActivitiesSort === 'asc'
                      ? 'bg-white text-indigo-600 soft-shadow-sm'
                      : 'text-slate-400 hover:text-slate-600',
                  ]"
                >
                  <ArrowUp class="w-3 h-3" /> น้อยสุด
                </button>
              </div>
              <div
                class="flex items-center gap-1 text-[10px] font-bold bg-white px-2 py-1 rounded-md soft-shadow-sm"
              >
                <span class="text-slate-500"
                  >สูงสุด {{ ongoingExtremes.max.participant_count }}</span
                >
                <span class="text-slate-300">/</span>
                <span class="text-slate-500"
                  >ต่ำสุด {{ ongoingExtremes.min.participant_count }}</span
                >
              </div>
            </div>
          </div>
          <div class="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <div v-if="sortedOngoingActivities.length" class="space-y-3">
              <div
                v-for="act in sortedOngoingActivities"
                :key="act.id"
                class="flex items-center gap-4 p-3 bg-white soft-shadow-sm rounded-2xl transition-all hover:soft-shadow"
              >
                <div
                  class="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold shrink-0"
                >
                  <Activity class="w-5 h-5" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-bold text-slate-800 truncate">
                    {{ act.title }}
                  </p>
                  <p
                    class="text-[11px] font-semibold text-slate-400 truncate mt-0.5"
                  >
                    สิ้นสุด: {{ formatDate(act.end_date) }}
                  </p>
                </div>
                <div
                  class="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-1.5 rounded-lg flex flex-col items-center min-w-[3rem]"
                >
                  <span class="text-indigo-600 text-sm font-black">{{
                    act.participant_count
                  }}</span>
                  <span>คน</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-3xl soft-shadow flex flex-col h-[450px]">
          <div
            class="p-6 border-b border-slate-100/70 flex items-center justify-between"
          >
            <h2
              class="text-base font-bold text-slate-900 flex items-center gap-2"
            >
              <AlertTriangle class="w-5 h-5 text-orange-500" />
              ผู้ใช้ไม่เคลื่อนไหว
            </h2>
            <div
              class="flex items-center gap-2 bg-slate-50 px-2 py-1 rounded-lg"
            >
              <input
                type="number"
                v-model.number="inactiveStreakDays"
                min="1"
                max="30"
                class="w-8 text-center text-xs font-bold bg-white rounded py-0.5 outline-none soft-shadow-sm"
              />
              <span class="text-[10px] font-bold text-slate-400">วัน</span>
            </div>
          </div>
          <div class="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <div
              v-if="loadingInactiveStreak"
              class="h-full flex items-center justify-center"
            >
              <div
                class="w-6 h-6 border-2 border-slate-200 border-t-orange-500 rounded-full animate-spin"
              ></div>
            </div>
            <div
              v-else-if="inactiveStreak.length === 0"
              class="h-full flex flex-col items-center justify-center text-slate-300"
            >
              <CheckCircle2
                class="w-10 h-10 mb-2 text-emerald-400 opacity-40"
              />
              <p class="text-sm font-semibold">ทุกคนมีความเคลื่อนไหว</p>
            </div>
            <div v-else class="space-y-3">
              <div
                v-for="u in inactiveStreak.slice(0, 15)"
                :key="u.id"
                class="flex items-center gap-4 p-3 bg-white rounded-2xl soft-shadow-sm hover:soft-shadow transition-all"
              >
                <div
                  class="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-orange-600 font-bold shrink-0 overflow-hidden"
                >
                  <img
                    v-if="u.picture_url"
                    :src="u.picture_url"
                    class="w-full h-full object-cover"
                  />
                  <span v-else>{{ u.fname_th?.[0] }}</span>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-bold text-slate-800 truncate">
                    {{ u.fname_th }} {{ u.lname_th }}
                  </p>
                  <p class="text-[10px] font-semibold text-slate-400">
                    {{ u.team_name || "ไม่มีทีม" }}
                  </p>
                </div>
                <div class="text-right">
                  <span class="text-sm font-black text-orange-600">{{
                    u.missed_days
                  }}</span>
                  <span class="block text-[9px] font-bold text-slate-400"
                    >วัน</span
                  >
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-3xl soft-shadow flex flex-col h-[450px]">
          <div class="px-6 pt-6 pb-3 border-b border-slate-100/70">
            <div class="flex items-center justify-between mb-3">
              <h2
                class="text-base font-bold text-slate-900 flex items-center gap-2"
              >
                <Heart class="w-5 h-5 text-rose-500" /> ผู้มีความเสี่ยงสุขภาพสูง
              </h2>
              <span
                class="bg-rose-50 text-rose-600 px-3 py-1 rounded-lg text-xs font-black"
                >{{ bmiRiskCount }} คน</span
              >
            </div>
          </div>
          <div class="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <div v-if="sortedBmiRiskUsers.length > 0" class="space-y-3">
              <div
                v-for="u in sortedBmiRiskUsers as any[]"
                :key="u.id"
                class="flex items-center gap-4 p-3 bg-white rounded-2xl soft-shadow-sm hover:soft-shadow transition-all cursor-pointer"
                @click="openUserDetail(u)"
              >
                <div
                  class="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-rose-600 font-bold shrink-0 overflow-hidden"
                >
                  <img
                    v-if="u.picture_url"
                    :src="u.picture_url"
                    class="w-full h-full object-cover"
                  />
                  <span v-else>{{ u.fname_th?.[0] }}</span>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-bold text-slate-800 truncate">
                    {{ u.fname_th }} {{ u.lname_th }}
                  </p>
                  <span
                    :class="[
                      'text-[10px] px-2 py-0.5 rounded-md font-bold',
                      u.bmi_category === 'อ้วนมาก'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-orange-100 text-orange-700',
                    ]"
                  >
                    {{ u.bmi_category }}
                  </span>
                </div>
                <div class="text-right">
                  <p class="text-xs font-black text-slate-600">{{ u.bmi }}</p>
                  <p class="text-[9px] font-bold text-slate-400">BMI</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-3xl soft-shadow flex flex-col h-[450px]">
          <div class="px-6 pt-6 pb-3 border-b border-slate-100/70">
            <div class="flex items-center justify-between mb-1">
              <h2
                class="text-base font-bold text-slate-900 flex items-center gap-2 truncate"
              >
                <TrendingUp class="w-5 h-5 text-emerald-500 shrink-0" />
                ส่งงานต่อเนื่อง
              </h2>
            </div>
            <p class="text-[11px] font-medium text-slate-400">
              กิจกรรมที่มีการส่งภารกิจสูงสุด 5 อันดับแรก
            </p>
          </div>
          <div class="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <div
              v-if="topSubmittedActivities.length === 0"
              class="h-full flex flex-col items-center justify-center text-slate-300"
            >
              <Activity class="w-10 h-10 mb-2 text-emerald-400 opacity-40" />
              <p class="text-sm font-semibold text-center">
                ยังไม่มีกิจกรรม<br />ที่มีการส่งงาน
              </p>
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="(act, index) in topSubmittedActivities"
                :key="act.id"
                class="flex items-center gap-4 p-3 bg-white rounded-2xl soft-shadow-sm hover:soft-shadow transition-all"
              >
                <div
                  class="relative w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-emerald-600 font-bold shrink-0 overflow-hidden"
                >
                  <Activity class="w-5 h-5" />

                  <div
                    class="absolute -top-1 -right-1 w-4 h-4 text-white rounded-full flex items-center justify-center text-[9px] font-black border-2 border-white z-10"
                    :class="{
                      'bg-amber-400': index === 0,
                      'bg-slate-300': index === 1,
                      'bg-orange-400': index === 2,
                      'bg-emerald-500': index > 2,
                    }"
                  >
                    {{ index + 1 }}
                  </div>
                </div>

                <div class="min-w-0 flex-1">
                  <p class="text-sm font-bold text-slate-800 truncate">
                    {{ act.title }}
                  </p>
                  <p class="text-[10px] font-semibold text-slate-400 truncate">
                    ผู้เข้าร่วมทั้งหมด: {{ act.participant_count }} คน
                  </p>
                </div>

                <div class="text-right flex flex-col items-end shrink-0">
                  <span
                    class="text-sm font-black text-emerald-600 flex items-center gap-1"
                  >
                    {{ act.total_submissions }}
                  </span>
                  <span class="text-[9px] font-bold text-slate-400">ครั้ง</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
@import url("https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap");
.font-sarabun,
.font-sarabun * {
  font-family: var(--font-sans) !important;
}
</style>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #cbd5e1;
}
.custom-scrollbar-x::-webkit-scrollbar {
  height: 6px;
}
.custom-scrollbar-x::-webkit-scrollbar-track {
  background: #f8fafc;
  border-radius: 10px;
}
.custom-scrollbar-x::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}
.custom-scrollbar-x::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
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
