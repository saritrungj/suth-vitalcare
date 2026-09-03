import { ref, onMounted, onUnmounted, nextTick, computed, watch } from "vue";
import { authStore } from "../store/auth";
import { uiStore } from "../store/ui";
import { exportWorkbook } from "../lib/exportXlsx";
import {
  Briefcase,
  Users,
  Calendar,
  Activity,
  TrendingUp,
  UserCheck,
  Minus,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  History,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Image as ImageIcon,
  FileText,
} from "lucide-vue-next";

/* ==========================================
   TYPES & INTERFACES
========================================== */
export interface KpiItem {
  label: string;
  value: string | number;
  icon: string;
  badge: string;
  kc?: string;
  iconColor?: string;
}
export interface GrowthItem {
  month: string;
  count: number;
  cum: number;
}
export interface HealthDist {
  name: string;
  value: number;
  color: string;
}
export interface RoleDist {
  role: string;
  count: number;
  color: string;
}
export interface TopUser {
  id: number;
  fname_th: string;
  picture_url: string;
  points: number;
  role_type?: string;
}
export interface TopTeam {
  id: number;
  name: string;
  code: string;
  team_total_score: number;
  member_count: number;
}
export interface RecentAct {
  id: number;
  user: { fname_th: string; picture_url?: string };
  action: string;
  status: string;
  time: string;
  type?: "submission" | "registration";
  created_at?: string;
}
export interface TaskBreakdown {
  task_id: number;
  task_name: string;
  metric_unit: string;
  points: number;
  total_submissions: number;
  approved: number;
  pending: number;
  rejected: number;
  avg_value: number;
  max_value: number;
  unique_users: number;
}
export interface ActivityBreakdown {
  id: number;
  title: string;
  start_date: string;
  end_date: string;
  status: string;
  participant_count: number;
  achieved_count: number;
  task_count: number;
  total_submissions: number;
  approved_submissions: number;
  pending_submissions: number;
  rejected_submissions: number;
  tasks: TaskBreakdown[];
  is_continuous_event?: boolean;
}
export interface RewardPopular {
  name: string;
  redeem_count: number;
}
export interface RewardsStats {
  total_rewards: number;
  total_stock: number;
  pending_redemptions: number;
  popular: RewardPopular[];
}
export interface HealthAssessment {
  form_title: string;
  total_responses: number;
  avg_score: number;
  normal_count: number;
  at_risk_count: number;
}

export interface DeepInsights {
  todayRegistrations: any[];
  inactiveAnalysis: {
    byRole: Record<string, number>;
    byAge: Record<string, number>;
    byBmi: Record<string, number>;
  };
  activityWinners: any[];
  healthByAge: Record<string, Record<string, number>>;
}

export interface BodyMetrics {
  weight: number;
  waist: number;
  bmi: number;
  fat: number;
  vf: number;
  muscle_mass: number;
}
export interface TanitaRecord {
  round1: BodyMetrics;
  round3?: BodyMetrics;
  scores?: {
    waist: number;
    bmi: number;
    fat: number;
    vf: number;
    muscle_mass: number;
    total: number;
  };
}

export interface MonthlyActivity {
  month: string;
  total_submissions: number;
  approved_submissions: number;
  participation_percent: number;
  activities: { title: string; count: number }[];
}

export interface TeamMember {
  id: number;
  fname_th: string;
  lname_th: string;
  picture_url?: string;
  gender?: string;
  role_type?: string;
  approved_count: number;
  pending_count: number;
  rejected_count: number;
  points: number;
  submissions: {
    id: number;
    task_name: string;
    status: string;
    value: number;
    points: number;
    time: string;
    date: string;
    metric_unit?: string;
  }[];
}

export interface TeamOverview {
  id: number;
  name: string;
  code: string;
  image?: string;
  member_count: number;
  total_points: number;
  total_approved: number;
  members: TeamMember[];
}

export interface ActivityOverview {
  id: number;
  title: string;
  start_date: string;
  end_date: string;
  status: string;
  total_participants: number;
  individual_count: number;
  team_count: number;
  individuals: TeamMember[];
  teams: TeamOverview[];
}

export interface DashboardData {
  stats: KpiItem[];
  userGrowth: GrowthItem[];
  submissionStats: {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
  };
  submissionTimeline: { date: string; count: number }[];
  healthDistribution: HealthDist[];
  roleDistribution: RoleDist[];
  topUsers: TopUser[];
  topTeams: TopTeam[];
  recentActivities: RecentAct[];
  activityBreakdown: ActivityBreakdown[];
  rewardsStats: RewardsStats;
  healthAssessment: HealthAssessment[];
  pulse?: {
    activeToday: number;
    submissionsToday: number;
    trending: { id: number; title: string; sub_count: number } | null;
  };
}

export interface DailySubmission {
  time: string;
  activity_title: string;
  task_name: string;
  status: "approved" | "pending" | "rejected";
  points: number;
}
export interface DailyProgress {
  date: string;
  submissions: DailySubmission[];
}
export interface RegisteredActivity {
  id: number;
  title: string;
  target?: number;
  achieved_value?: number;
  is_achieved?: boolean;
}

export interface ParticipantDetail {
  id: number;
  fname_th: string;
  lname_th: string;
  nickname?: string;
  picture_url?: string;
  role?: string;
  registration_type?: "individual" | "team";
  team_name?: string;
  gender?: string;
  age?: number;
  target: number;
  achieved_value: number;
  points: number;
  is_achieved: boolean;
  created_at?: string;
  submission_count?: number;
  registered_activities?: RegisteredActivity[];
  daily_progress?: DailyProgress[];
  tanita?: TanitaRecord;
  monthly_summary?: MonthlyActivity[];
}

export interface TanitaInsightUser {
  id: number;
  fname_th: string;
  lname_th: string;
  nickname: string;
  picture_url: string;
  role_type: string;
  gender?: string;
  birth_date?: string;
  team_name?: string;
  participation_pct: number;
  active_days: number;
  total_event_days: number;
  has_tanita_change: boolean;
  first_tanita?: any;
  latest_tanita?: any;
}

export interface SmartTableColumn<T = any> {
  key: string;
  label: string;
  width?: string;
  align?: "left" | "center" | "right";
  sortKey?: string;
}

export function useAdminOverview() {
  // --- Core State ---
  const loading = ref(true);
  const activeTab = ref<"overview" | "participants" | "health-assessment">(
    "overview",
  );

  // --- Overview Data ---
  const data = ref<DashboardData>({
    stats: [],
    userGrowth: [],
    submissionStats: { total: 0, approved: 0, pending: 0, rejected: 0 },
    submissionTimeline: [],
    healthDistribution: [],
    roleDistribution: [],
    topUsers: [],
    topTeams: [],
    recentActivities: [],
    activityBreakdown: [],
    rewardsStats: {
      total_rewards: 0,
      total_stock: 0,
      pending_redemptions: 0,
      popular: [],
    },
    healthAssessment: [],
    pulse: { activeToday: 0, submissionsToday: 0, trending: null },
  });
  const deep = ref<DeepInsights | null>(null);
  const growthMode = ref<"cum" | "new">("new");

  // --- Tanita State ---
  const tanitaInsights = ref<TanitaInsightUser[]>([]);
  const loadingTanita = ref(false);
  const tanitaSearch = ref("");
  const selectedTanitaUsers = ref<number[]>([]);

  // --- Inactive Streak State ---
  const inactiveStreak = ref<any[]>([]);
  const inactiveStreakDays = ref(3);
  const loadingInactiveStreak = ref(false);

  // --- BMI Risk State ---
  const showBmiRiskExpanded = ref(false);

  // --- Health Assessment State ---
  const allHealthAssessments = ref<any[]>([]);
  const loadingHealthAssessments = ref(false);
  const healthAssessmentSearch = ref("");
  const healthAssessmentFilter = ref<
    "" | "ควรปรับปรุง" | "พอใช้" | "ดี" | "ดีมาก"
  >("");

  // --- Comment Modal State ---
  const showCommentModal = ref(false);
  const commentTarget = ref<any | null>(null);
  const commentText = ref("");
  const savingComment = ref(false);

  // --- Global Participants State ---
  const allParticipants = ref<ParticipantDetail[]>([]);
  const globalSearch = ref("");
  const globalTypeFilter = ref<"all" | "individual" | "team">("all");
  const globalRoleFilter = ref("");
  const globalGenderFilter = ref("");
  const globalAgeGroupFilter = ref("");
  const globalBmiFilter = ref("");
  const loadingAllParticipants = ref(false);

  // --- Team Viewer Modal State ---
  const showTeamViewerModal = ref(false);
  const teamViewerData = ref<any>(null);
  const loadingTeamViewer = ref(false);
  const allTeamsList = ref<any[]>([]);
  const movingUserId = ref<number | null>(null);
  const moveTargetTeamId = ref<number | null>(null);
  const savingTeamMove = ref(false);

  const participantColumns: SmartTableColumn<ParticipantDetail>[] = [
    {
      key: "id_code",
      label: "รหัสพนักงาน/นักศึกษา",
      width: "150px",
      sortKey: "id_code",
    },
    { key: "profile", label: "ผู้ใช้งาน", width: "220px", sortKey: "fname_th" },
    { key: "role", label: "บทบาท", width: "120px", sortKey: "role" },
    { key: "team", label: "ทีม", width: "150px", sortKey: "team_name" },
    {
      key: "bmi",
      label: "BMI",
      align: "center",
      width: "100px",
      sortKey: "bmi",
    },
    {
      key: "activities",
      label: "กิจกรรม",
      align: "center",
      width: "100px",
      sortKey: "activity_count",
    },
    {
      key: "points",
      label: "แต้มรวม",
      align: "center",
      width: "120px",
      sortKey: "points",
    },
  ];

  // --- Activity Modals & Overview State ---
  const selectedActivityId = ref("");
  const showParticipantModal = ref(false);
  const selectedActivity = ref<ActivityBreakdown | null>(null);
  const participants = ref<ParticipantDetail[]>([]);
  const participantFilter = ref("");
  const typeFilter = ref<"all" | "individual" | "team">("all");
  const loadingParticipants = ref(false);
  const expandedParticipantId = ref<number | null>(null);

  // --- User Detail Modal State ---
  const showUserDetailModal = ref(false);
  const selectedUserDetail = ref<ParticipantDetail | null>(null);
  const profileLoading = ref(false);
  const selectedUserProfile = ref<any>(null);
  const selectedUserSubmissions = ref<any[]>([]);
  const selectedUserTanita = ref<any>(null);
  const selectedUserRegistrations = ref<any[]>([]);

  // --- Sub Tab Analytics State ---
  const userInsightSubTab = ref<"users" | "activities" | "teams">("users");
  const activityOverviews = ref<ActivityOverview[]>([]);
  const loadingActivityOverview = ref(false);
  const selectedOverviewActivityId = ref<number | null>(null);

  // --- Summary Stats Modal State ---
  const showStatsModal = ref(false);
  const statsModalTitle = ref("");
  const statsModalIcon = ref<any>(null);
  const statsModalData = ref<any[]>([]);
  const statsModalType = ref<"role" | "gender" | "age" | "bmi">("role");

  const showTeamsListModal = ref(false);
  const teamsListSearch = ref("");

  // --- Chart Instances ---
  let growthChart: any = null;
  let bmiChart: any = null;
  let submissionsChart: any = null;
  let demographicsChart: any = null;
  let eventsChart: any = null;
  let genderChart: any = null;
  let roleChart: any = null;
  let highRiskChart: any = null;
  let submissionTimeChart: any = null;
  let goalAchievementChart: any = null;
  let Chart: any = null;
  let fetchTimeout: any = null;

  /* ==========================================
     COMPUTED PROPERTIES
  ========================================== */

  // --- ดึง 5 อันดับกิจกรรมที่มีจำนวนการส่งภารกิจสูงสุด ---
  const topSubmittedActivities = computed(() => {
    const activities = data.value.activityBreakdown || [];
    return [...activities]
      .filter((a) => a.total_submissions > 0)
      .sort((a, b) => (b.total_submissions || 0) - (a.total_submissions || 0))
      .slice(0, 5);
  });

  const highRiskCounts = computed(() => {
    let obese3 = 0,
      obese2 = 0,
      obese1 = 0;
    allParticipants.value.forEach((u: any) => {
      if (u.bmi_category === "อ้วนมาก") obese3++;
      else if (u.bmi_category === "อ้วน") obese2++;
      else if (u.bmi_category === "ท้วม") obese1++;
    });
    return { obese3, obese2, obese1 };
  });

  const ongoingActivities = computed(() => {
    return data.value.activityBreakdown.filter((a) => {
      const s = (a.status || "").toLowerCase();
      const isOpen =
        s === "open" ||
        s === "active" ||
        s === "ongoing" ||
        s === "in_progress";
      if (!isOpen && s !== "") return false;

      const now = new Date();
      if (a.is_continuous_event) return true;
      if (!a.end_date) return true;

      return new Date(a.end_date) >= now;
    });
  });

  const submissionTimeStats = computed(() => {
    let morning = 0,
      afternoon = 0,
      evening = 0,
      night = 0;
    allParticipants.value.forEach((p) => {
      if (p.daily_progress) {
        p.daily_progress.forEach((dp) => {
          if (dp.submissions) {
            dp.submissions.forEach((sub) => {
              if (sub.time) {
                const hour = parseInt(sub.time.split(":")[0], 10);
                if (!isNaN(hour)) {
                  if (hour >= 6 && hour < 12) morning++;
                  else if (hour >= 12 && hour < 18) afternoon++;
                  else if (hour >= 18 && hour <= 23) evening++;
                  else night++;
                }
              }
            });
          }
        });
      }
    });
    return { morning, afternoon, evening, night };
  });

  const goalAchievementStats = computed(() => {
    const activities = data.value.activityBreakdown || [];

    const totalAchievers = activities.reduce(
      (s, a) => s + (a.achieved_count || 0),
      0,
    );
    const totalParticipants = activities.reduce(
      (s, a) => s + (a.participant_count || 0),
      0,
    );
    const overallRate =
      totalParticipants > 0
        ? Math.round((totalAchievers / totalParticipants) * 100)
        : 0;

    const top = activities
      .filter((a) => (a.participant_count || 0) > 0)
      .map((a) => {
        const achieved = a.achieved_count || 0;
        const participants = a.participant_count || 0;
        return {
          id: a.id,
          title: a.title || "-",
          achieved,
          participants,
          remaining: Math.max(0, participants - achieved),
          rate:
            participants > 0 ? Math.round((achieved / participants) * 100) : 0,
        };
      })
      .sort((a, b) => b.rate - a.rate || b.achieved - a.achieved)
      .slice(0, 5);

    const topByCount = [...activities].sort(
      (a, b) => (b.achieved_count || 0) - (a.achieved_count || 0),
    )[0];

    const topByRate = top[0];

    return {
      totalAchievers,
      totalParticipants,
      notAchieved: Math.max(0, totalParticipants - totalAchievers),
      overallRate,
      top,
      topActivityName: topByCount?.title || "-",
      topActivityCount: topByCount?.achieved_count || 0,
      topRateName: topByRate?.title || "-",
      topRateValue: topByRate?.rate || 0,
    };
  });

  const totalUsersCount = computed(() => {
    return allParticipants.value.length > 0
      ? allParticipants.value.length
      : data.value.userGrowth[data.value.userGrowth.length - 1]?.cum || 0;
  });

  const todayUsersCount = computed(() => {
    if (allParticipants.value.length > 0) {
      const todayStr = new Date().toISOString().split("T")[0];
      return allParticipants.value.filter(
        (p) => p.created_at && p.created_at.startsWith(todayStr),
      ).length;
    }
    return data.value.userGrowth[data.value.userGrowth.length - 1]?.count || 0;
  });

  function normalizeGender(g: string): string {
    const lower = (g || "").toLowerCase().trim();
    if (lower === "male" || lower === "ชาย") return "male";
    if (lower === "female" || lower === "หญิง") return "female";
    return "other";
  }

  const filteredGlobalParticipants = computed(() => {
    let result = allParticipants.value;
    if (globalTypeFilter.value !== "all") {
      result = result.filter((p) => {
        const actualType =
          p.registration_type === "team" ? "team" : "individual";
        return actualType === globalTypeFilter.value;
      });
    }
    if (globalRoleFilter.value)
      result = result.filter((p) => (p.role || "") === globalRoleFilter.value);
    if (globalGenderFilter.value)
      result = result.filter(
        (p) => normalizeGender((p as any).gender) === globalGenderFilter.value,
      );

    if (globalAgeGroupFilter.value) {
      result = result.filter((p) => {
        const age = (p as any).age;
        if (age === null || age === undefined) return false;
        const grp = globalAgeGroupFilter.value;
        if (grp === "ต่ำกว่า 18") return age < 18;
        if (grp === "18-24") return age >= 18 && age <= 24;
        if (grp === "25-34") return age >= 25 && age <= 34;
        if (grp === "35-44") return age >= 35 && age <= 44;
        if (grp === "45-54") return age >= 45 && age <= 54;
        if (grp === "55-64") return age >= 55 && age <= 64;
        if (grp === "65+") return age >= 65;
        return true;
      });
    }

    if (globalBmiFilter.value) {
      result = result.filter(
        (p) => (p as any).bmi_category === globalBmiFilter.value,
      );
    }

    const f = globalSearch.value.toLowerCase().trim();
    if (f) {
      result = result.filter(
        (p) =>
          (p.fname_th || "").toLowerCase().includes(f) ||
          (p.lname_th || "").toLowerCase().includes(f) ||
          (p.nickname || "").toLowerCase().includes(f) ||
          (p.team_name || "").toLowerCase().includes(f) ||
          (p.role || "").toLowerCase().includes(f),
      );
    }
    return result;
  });

  function calculateAge(dateString: string) {
    if (!dateString) return "-";
    const birthYear = new Date(dateString).getFullYear();
    return new Date().getFullYear() - birthYear;
  }

  const userSummaryStats = computed(() => {
    const users = allParticipants.value;
    const stats = {
      byRole: {} as Record<string, number>,
      byGender: {} as Record<string, number>,
      byAge: {} as Record<string, Record<string, number>>,
      byBmi: {} as Record<string, number>,
      total: users.length,
      teamCount: 0,
      totalInTeams: 0,
      activeUsers: 0,
    };

    const orderedAgeGroups = [
      "ต่ำกว่า 18",
      "18-24",
      "25-34",
      "35-44",
      "45-54",
      "55-64",
      "65+",
    ];
    orderedAgeGroups.forEach((group) => {
      stats.byAge[group] = { male: 0, female: 0, other: 0 };
    });

    users.forEach((u) => {
      const role = (u as any).role || "ทั่วไป";
      stats.byRole[role] = (stats.byRole[role] || 0) + 1;

      const genderLabel = formatGenderLabel((u as any).gender || "");
      stats.byGender[genderLabel] = (stats.byGender[genderLabel] || 0) + 1;

      const bmiCat = (u as any).bmi_category;
      if (bmiCat) stats.byBmi[bmiCat] = (stats.byBmi[bmiCat] || 0) + 1;

      if ((u as any).team_id) stats.totalInTeams++;
      const hasActivity =
        ((u as any).activity_count ?? 0) > 0 ||
        ((u as any).submission_count ?? 0) > 0;
      if (hasActivity) stats.activeUsers++;

      let finalAge = (u as any).age;
      const birthDate = (u as any).birth_date;
      if (
        (finalAge === null || finalAge === undefined || finalAge === "") &&
        birthDate
      ) {
        finalAge = calculateAge(birthDate);
      }

      const genderKey = normalizeGender((u as any).gender);

      if (finalAge !== null && finalAge !== undefined && finalAge !== "-") {
        let ageGroup = "";
        if (finalAge < 18) ageGroup = "ต่ำกว่า 18";
        else if (finalAge <= 24) ageGroup = "18-24";
        else if (finalAge <= 34) ageGroup = "25-34";
        else if (finalAge <= 44) ageGroup = "35-44";
        else if (finalAge <= 54) ageGroup = "45-54";
        else if (finalAge <= 64) ageGroup = "55-64";
        else ageGroup = "65+";

        if (stats.byAge[ageGroup]) {
          stats.byAge[ageGroup][genderKey]++;
        }
      }
    });

    const uniqueTeamIds = new Set(
      users.filter((u) => (u as any).team_id).map((u) => (u as any).team_id),
    );
    stats.teamCount = uniqueTeamIds.size;

    return stats;
  });

  const groupedGenderStats = computed(() => {
    return userSummaryStats.value.byGender;
  });

  const teamsListData = computed(() => {
    const map = new Map<
      number,
      { id: number; name: string; code: string; members: any[] }
    >();
    allParticipants.value.forEach((u) => {
      const tid = (u as any).team_id;
      const tname = (u as any).team_name;
      if (!tid) return;
      if (!map.has(tid))
        map.set(tid, {
          id: tid,
          name: tname || `ทีม #${tid}`,
          code: (u as any).team_code || "",
          members: [],
        });
      map.get(tid)!.members.push(u);
    });
    return Array.from(map.values()).sort(
      (a, b) => b.members.length - a.members.length,
    );
  });

  const activityEngagementStats = computed(() => {
    const users = allParticipants.value;
    const activities = new Map<string, number>();

    users.forEach((u) => {
      if (u.registered_activities) {
        u.registered_activities.forEach((act) => {
          activities.set(act.title, (activities.get(act.title) || 0) + 1);
        });
      }
    });

    const totalActivities = activities.size;
    const avgParticipation =
      users.length > 0
        ? Math.round(
            Array.from(activities.values()).reduce(
              (sum, count) => sum + count,
              0,
            ) / totalActivities,
          )
        : 0;
    const mostPopular =
      activities.size > 0 ? Math.max(...activities.values()) : 0;

    return { totalActivities, avgParticipation, mostPopular };
  });

  const uniqueRoles = computed(() => [
    ...new Set(allParticipants.value.map((p: any) => p.role).filter(Boolean)),
  ]);

  const roleDistributionData = computed(() => {
    const roleData = userSummaryStats.value.byRole;
    const labels = Object.keys(roleData);
    const palette = [
      "#3b82f6",
      "#10b981",
      "#f59e0b",
      "#ec4899",
      "#8b5cf6",
      "#64748b",
      "#ef4444",
      "#14b8a6",
    ];
    return labels.map((label, index) => ({
      role: label,
      count: roleData[label],
      color: palette[index % palette.length],
    }));
  });

  const filteredParticipants = computed(() => {
    let result = participants.value;
    if (typeFilter.value !== "all") {
      result = result.filter((p) => {
        const actualType =
          p.registration_type === "team" ? "team" : "individual";
        return actualType === typeFilter.value;
      });
    }
    const f = participantFilter.value.toLowerCase().trim();
    if (f) {
      result = result.filter(
        (p) =>
          (p.fname_th || "").toLowerCase().includes(f) ||
          (p.nickname || "").toLowerCase().includes(f) ||
          (p.team_name || "").toLowerCase().includes(f) ||
          (p.role || "").toLowerCase().includes(f),
      );
    }
    return result;
  });

  const selectedActivityOverview = computed(
    () =>
      activityOverviews.value.find(
        (a) => a.id === selectedOverviewActivityId.value,
      ) || null,
  );

  const filteredTanitaInsights = computed(() => {
    const f = tanitaSearch.value.toLowerCase().trim();
    if (!f) return tanitaInsights.value;
    return tanitaInsights.value.filter(
      (u) =>
        (u.fname_th || "").toLowerCase().includes(f) ||
        (u.lname_th || "").toLowerCase().includes(f) ||
        (u.nickname || "").toLowerCase().includes(f),
    );
  });

  const bmiRiskUsers = computed(() => {
    return allParticipants.value
      .filter(
        (u) =>
          (u as any).bmi_category === "อ้วน" ||
          (u as any).bmi_category === "อ้วนมาก" ||
          (u as any).bmi_category === "ท้วม",
      )
      .sort((a, b) => ((b as any).bmi || 0) - ((a as any).bmi || 0))
      .slice(0, showBmiRiskExpanded.value ? 50 : 10);
  });

  const bmiRiskCount = computed(() => {
    return allParticipants.value.filter(
      (u) =>
        (u as any).bmi_category === "อ้วน" ||
        (u as any).bmi_category === "อ้วนมาก" ||
        (u as any).bmi_category === "ท้วม",
    ).length;
  });

  const filteredHealthAssessments = computed(() => {
    let result = allHealthAssessments.value;
    if (healthAssessmentFilter.value) {
      result = result.filter(
        (a) => a.overall_level === healthAssessmentFilter.value,
      );
    }
    const f = healthAssessmentSearch.value.toLowerCase().trim();
    if (f) {
      result = result.filter(
        (a) =>
          (a.fname_th || "").toLowerCase().includes(f) ||
          (a.lname_th || "").toLowerCase().includes(f) ||
          (a.team_name || "").toLowerCase().includes(f),
      );
    }
    return result;
  });

  const tanitaSummaryAnalytics = computed(() => {
    const all = tanitaInsights.value;
    if (!all.length) return null;

    let hasFirstTanita = 0,
      fatIncreased = 0,
      fatDecreased = 0,
      sedentaryCount = 0,
      sedentaryThinCount = 0,
      obeseCount = 0;
    const obeseRoles: Record<string, number> = {};
    const obeseAges: Record<string, number> = {};

    all.forEach((u) => {
      if (u.first_tanita) hasFirstTanita++;

      let bmiVal = 0;
      if (u.first_tanita?.bmi) bmiVal = Number(u.first_tanita.bmi);

      const isSedentary = u.participation_pct < 20;
      if (isSedentary) {
        sedentaryCount++;
        if (bmiVal > 0 && bmiVal < 18.5) sedentaryThinCount++;
      }

      if (u.has_tanita_change && u.first_tanita && u.latest_tanita) {
        const fFat = Number(u.first_tanita.fat_pc) || 0;
        const lFat = Number(u.latest_tanita.fat_pc) || 0;
        if (fFat > 0 && lFat > 0) {
          if (lFat > fFat) fatIncreased++;
          else if (lFat < fFat) fatDecreased++;
        }
      }

      const w = u.first_tanita?.weight ? Number(u.first_tanita.weight) : 0;
      const h = u.first_tanita?.height
        ? Number(u.first_tanita.height) / 100
        : 0;
      const calcBmi = w > 0 && h > 0 ? w / (h * h) : bmiVal;

      if (calcBmi >= 25) {
        obeseCount++;
        const role = u.role_type || "ไม่ระบุ";
        obeseRoles[role] = (obeseRoles[role] || 0) + 1;

        let ageGroup = "ไม่ระบุอายุ";
        if (u.birth_date) {
          const age =
            new Date().getFullYear() - new Date(u.birth_date).getFullYear();
          if (age < 25) ageGroup = "<25 ปี";
          else if (age <= 35) ageGroup = "25-35 ปี";
          else if (age <= 45) ageGroup = "36-45 ปี";
          else if (age <= 55) ageGroup = "46-55 ปี";
          else ageGroup = "55+ ปี";
        }
        obeseAges[ageGroup] = (obeseAges[ageGroup] || 0) + 1;
      }
    });

    const getTop = (dict: Record<string, number>) => {
      const entries = Object.entries(dict).sort((a, b) => b[1] - a[1]);
      if (entries.length === 0) return "-";
      const total = entries.reduce((s, e) => s + e[1], 0);
      return `${entries[0][0]} (${Math.round((entries[0][1] / total) * 100)}%)`;
    };

    return {
      total: all.length,
      hasFirstTanita,
      noFirstTanita: all.length - hasFirstTanita,
      fatDecreased,
      fatIncreased,
      sedentaryCount,
      sedentaryThinCount,
      obeseCount,
      obeseTopRole: getTop(obeseRoles),
      obeseTopAge: getTop(obeseAges),
    };
  });

  /* ==========================================
     METHODS
  ========================================== */

  function openStatsModal(type: "role" | "gender" | "age" | "bmi") {
    statsModalType.value = type;
    let rawData: any[] = [];

    if (type === "role") {
      statsModalTitle.value = "ประเภทผู้ใช้";
      statsModalIcon.value = Briefcase;
      rawData = Object.entries(userSummaryStats.value.byRole).map(
        ([label, count]) => ({ label, count, filterVal: label }),
      );
    } else if (type === "gender") {
      statsModalTitle.value = "เพศ";
      statsModalIcon.value = Users;
      rawData = Object.entries(groupedGenderStats.value).map(
        ([label, count]) => ({
          label,
          count,
          filterVal: label === "ชาย" ? "male" : "female",
        }),
      );
    } else if (type === "age") {
      statsModalTitle.value = "กลุ่มอายุ";
      statsModalIcon.value = Calendar;
      rawData = Object.entries(userSummaryStats.value.byAge).map(
        ([label, _]) => ({
          label,
          count: Object.values(userSummaryStats.value.byAge[label]).reduce(
            (a, b) => a + b,
            0,
          ),
          filterVal: label,
        }),
      );
    } else if (type === "bmi") {
      statsModalTitle.value = "เกณฑ์ BMI";
      statsModalIcon.value = Activity;
      rawData = Object.entries(userSummaryStats.value.byBmi)
        .filter(([_, count]) => count > 0)
        .map(([label, count]) => ({ label, count, filterVal: label }));
    }

    statsModalData.value = rawData.sort((a, b) => b.count - a.count);
    showStatsModal.value = true;
  }

  function handleStatModalClick(item: any) {
    globalRoleFilter.value = "";
    globalGenderFilter.value = "";
    globalAgeGroupFilter.value = "";
    globalBmiFilter.value = "";
    globalSearch.value = "";
    globalTypeFilter.value = "all";

    if (statsModalType.value === "role") {
      globalRoleFilter.value = item.filterVal;
    } else if (statsModalType.value === "gender") {
      globalGenderFilter.value = normalizeGender(item.label);
    } else if (statsModalType.value === "age") {
      globalAgeGroupFilter.value = item.filterVal;
    } else if (statsModalType.value === "bmi") {
      globalBmiFilter.value = item.filterVal;
    }

    activeTab.value = "participants";
    userInsightSubTab.value = "users";
    showStatsModal.value = false;
  }

  async function openTeamViewer(user: any) {
    if (!user.team_id) return;
    loadingTeamViewer.value = true;
    showTeamViewerModal.value = true;
    teamViewerData.value = null;
    movingUserId.value = null;
    moveTargetTeamId.value = null;
    try {
      const res = await fetch(`/api/teams/${user.team_id}`, {
        headers: { "x-user-id": String(authStore.user?.id || "") },
      });
      if (res.ok) teamViewerData.value = await res.json();
    } catch {
      // intentionally silent
    } finally {
      loadingTeamViewer.value = false;
    }
  }

  async function fetchAllTeamsList() {
    if (allTeamsList.value.length > 0) return;
    try {
      const res = await fetch("/api/teams", {
        headers: { "x-user-id": String(authStore.user?.id || "") },
      });
      if (res.ok) allTeamsList.value = await res.json();
    } catch (e) {}
  }

  async function moveUserToTeam() {
    if (!movingUserId.value || !moveTargetTeamId.value) return;
    savingTeamMove.value = true;
    try {
      const resLeave = await fetch("/api/teams/leave", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(authStore.user?.id || ""),
        },
        body: JSON.stringify({ userId: movingUserId.value }),
      });
      if (!resLeave.ok) {
        const err = await resLeave.json();
        alert(err.error || "ออกจากทีมเดิมไม่ได้");
        return;
      }
      const resJoin = await fetch("/api/teams/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(authStore.user?.id || ""),
        },
        body: JSON.stringify({
          teamId: moveTargetTeamId.value,
          userId: movingUserId.value,
        }),
      });
      if (!resJoin.ok) {
        const err = await resJoin.json();
        alert(err.error || "เข้าทีมใหม่ไม่ได้");
        return;
      }
      showTeamViewerModal.value = false;
      movingUserId.value = null;
      moveTargetTeamId.value = null;
      await fetchAllParticipants();
    } catch {
      // intentionally silent
    } finally {
      savingTeamMove.value = false;
    }
  }

  function clearAllFilters() {
    globalRoleFilter.value = "";
    globalGenderFilter.value = "";
    globalAgeGroupFilter.value = "";
    globalBmiFilter.value = "";
    globalSearch.value = "";
    globalTypeFilter.value = "all";
  }

  function filterParticipantsBy(
    type: "role" | "gender" | "team",
    value: string,
  ) {
    activeTab.value = "participants";
    userInsightSubTab.value = "users";
    nextTick(() => {
      if (type === "role") globalRoleFilter.value = value;
      if (type === "gender")
        globalGenderFilter.value =
          value === "ชาย" ? "male" : value === "หญิง" ? "female" : value;
      if (type === "team") globalTypeFilter.value = "team";
    });
  }

  async function fetchStats(isBackground = false) {
    if (!isBackground) loading.value = true;
    try {
      const [resSummary, resDeep] = await Promise.all([
        fetch("/api/stats/summary", {
          headers: { "x-user-id": String(authStore.user?.id || "") },
        }),
        fetch("/api/stats/deep-insights", {
          headers: { "x-user-id": String(authStore.user?.id || "") },
        }),
        fetchAllParticipants(),
        fetchInactiveStreak(),
      ]);

      if (resSummary.ok) {
        const json = await resSummary.json();

        const finishedCount = (json.activityBreakdown || []).filter(
          (a: any) => {
            if (a.is_continuous_event) return false;
            if (!a.end_date) return false;
            return new Date(a.end_date) < new Date();
          },
        ).length;

        const draftCount = (json.activityBreakdown || []).filter((a: any) => {
          return (a.status || "").toLowerCase() === "draft";
        }).length;

        data.value = {
          ...json,
          stats: (json.stats || [])
            .filter((s: any) => s.label !== "คำขอรออนุมัติ")
            .map((s: any) => {
              if (s.label === "จำนวนทีม") {
                return {
                  label: "กิจกรรมที่สิ้นสุด",
                  value: finishedCount,
                  icon: "CheckCircle2",
                  badge: "สรุปผล",
                };
              }
              return {
                label: s.label,
                value: s.value,
                icon: s.icon || "Activity",
                badge: s.badge || "+5.2%",
              };
            }),
          userGrowth: (json.userGrowth || []).map(
            (g: any, _i: number, arr: any[]) => {
              const cum = arr
                .slice(0, arr.indexOf(g) + 1)
                .reduce((a: number, b: any) => a + (b.count || 0), 0);
              return { month: g.month, count: g.count || 0, cum };
            },
          ),
        };

        data.value.stats.push({
          label: "กิจกรรมฉบับร่าง",
          value: draftCount,
          icon: "FileText",
          badge: "สถานะ",
        });
      }
      if (resDeep.ok) deep.value = await resDeep.json();
    } catch {
      // intentionally silent
    } finally {
      loading.value = false;
      await nextTick();
      await loadChartJs();
      buildAllCharts();
    }
  }

  // --- Real-time focus sync ---
  let lastFetchTime = Date.now();
  const handleFocus = () => {
    if (Date.now() - lastFetchTime > 15000) {
      lastFetchTime = Date.now();
      fetchStats(true);
      if (activeTab.value === "participants") fetchAllParticipants();
    }
  };

  onMounted(() => {
    window.addEventListener("focus", handleFocus);
    fetchStats();
  });

  onUnmounted(() => {
    window.removeEventListener("focus", handleFocus);
  });

  async function fetchAllParticipants() {
    loadingAllParticipants.value = true;
    try {
      const res = await fetch(`/api/stats/users/all`, {
        headers: { "x-user-id": String(authStore.user?.id || "") },
      });
      if (res.ok) {
        const rawData = await res.json();
        allParticipants.value = rawData.map((p: any) => ({
          ...p,
          fname_th: p.fname_th || "",
          lname_th: p.lname_th || "",
          nickname: p.nickname || "",
          target: 0,
          achieved_value: 0,
          is_achieved: false,
          registered_activities: (p.registered_activities || []).map(
            (a: any) => ({
              id: a.id,
              title: a.title,
              target: 0,
              achieved_value: 0,
              is_achieved: false,
              registration_type: a.registration_type,
              team_name: a.team_name,
            }),
          ),
          daily_progress: p.daily_progress || [],
        }));
      }
    } catch {
      // intentionally silent
    } finally {
      loadingAllParticipants.value = false;
    }
  }

  async function fetchActivityOverview() {
    loadingActivityOverview.value = true;
    try {
      const res = await fetch(`/api/stats/activities/overview`, {
        headers: { "x-user-id": String(authStore.user?.id || "") },
      });
      if (res.ok) {
        activityOverviews.value = await res.json();
        if (
          activityOverviews.value.length > 0 &&
          !selectedOverviewActivityId.value
        ) {
          selectedOverviewActivityId.value = activityOverviews.value[0].id;
        }
      }
    } catch {
      // intentionally silent
    } finally {
      loadingActivityOverview.value = false;
    }
  }

  async function fetchTanitaInsights() {
    if (tanitaInsights.value.length > 0) return;
    loadingTanita.value = true;
    try {
      const res = await fetch(`/api/stats/tanita-insights`, {
        headers: { "x-user-id": String(authStore.user?.id || "") },
      });
      if (res.ok) tanitaInsights.value = await res.json();
    } catch {
      // intentionally silent
    } finally {
      loadingTanita.value = false;
    }
  }

  function openUserDetail(user: ParticipantDetail) {
    selectedUserDetail.value = user;
    selectedUserProfile.value = { ...user };
    showUserDetailModal.value = true;
    profileLoading.value = true;
    selectedUserSubmissions.value = [];
    selectedUserTanita.value = null;
    selectedUserRegistrations.value = [];

    fetch(`/api/users/${user.id}/full-profile`, {
      headers: { "x-user-id": String(authStore.user?.id || "") },
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            selectedUserProfile.value = {
              ...selectedUserProfile.value,
              ...data.user,
            };
          }
          selectedUserSubmissions.value = data.submissions || [];
          selectedUserTanita.value =
            data.healthHistory && data.healthHistory.length > 0
              ? data.healthHistory[0]
              : null;
          selectedUserRegistrations.value = (data.registrations || []).map(
            (r: any) => ({
              id: r.event_id,
              title: r.title,
              poster: r.poster,
              start_date: r.start_date,
              end_date: r.end_date,
              status: r.event_status,
            }),
          );
        }
      })
      .catch(() => {
        // intentionally silent
      })
      .finally(() => {
        profileLoading.value = false;
      });
  }

  function closeUserDetail() {
    showUserDetailModal.value = false;
    setTimeout(() => {
      selectedUserDetail.value = null;
      selectedUserProfile.value = null;
      selectedUserSubmissions.value = [];
      selectedUserTanita.value = null;
      selectedUserRegistrations.value = [];
    }, 300);
  }

  async function fetchInactiveStreak() {
    loadingInactiveStreak.value = true;
    try {
      const res = await fetch(
        `/api/stats/users/inactive-streak?days=${inactiveStreakDays.value}`,
        {
          headers: { "x-user-id": String(authStore.user?.id || "") },
        },
      );
      if (res.ok) inactiveStreak.value = await res.json();
    } catch {
      // intentionally silent
    } finally {
      loadingInactiveStreak.value = false;
    }
  }

  async function fetchAllHealthAssessments() {
    loadingHealthAssessments.value = true;
    try {
      const res = await fetch("/api/health/all-assessments", {
        headers: { "x-user-id": String(authStore.user?.id || "") },
      });
      if (res.ok) allHealthAssessments.value = await res.json();
    } catch {
      // intentionally silent
    } finally {
      loadingHealthAssessments.value = false;
    }
  }

  function openCommentModal(assessment: any) {
    commentTarget.value = assessment;
    commentText.value = assessment.admin_comment || "";
    showCommentModal.value = true;
  }

  async function saveComment() {
    if (!commentTarget.value || !commentText.value.trim()) return;
    savingComment.value = true;
    try {
      const res = await fetch(
        `/api/health/assessments/${commentTarget.value.id}/comment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": String(authStore.user?.id || ""),
          },
          body: JSON.stringify({
            comment: commentText.value.trim(),
            adminId: authStore.user?.id,
          }),
        },
      );
      if (res.ok) {
        const idx = allHealthAssessments.value.findIndex(
          (a) => a.id === commentTarget.value!.id,
        );
        if (idx !== -1) {
          allHealthAssessments.value[idx].admin_comment =
            commentText.value.trim();
          allHealthAssessments.value[idx].commented_at =
            new Date().toISOString();
        }
        showCommentModal.value = false;
        uiStore.toast(
          "success",
          "บันทึกแล้ว",
          "คําแนะนําถูกบันทึกเรียบร้อยแล้ว",
        );
      }
    } catch {
      // intentionally silent
    } finally {
      savingComment.value = false;
    }
  }

  async function openParticipants(act: ActivityBreakdown) {
    selectedActivity.value = act;
    showParticipantModal.value = true;
    loadingParticipants.value = true;
    participants.value = [];
    participantFilter.value = "";
    typeFilter.value = "all";
    expandedParticipantId.value = null;

    try {
      const res = await fetch(`/api/stats/activity/${act.id}/participants`, {
        headers: { "x-user-id": String(authStore.user?.id || "") },
      });
      if (res.ok) {
        const rawData = await res.json();
        participants.value = rawData.map((p: any) => ({
          ...p,
          registered_activities: p.registered_activities || [],
          daily_progress: p.daily_progress || [],
        }));
      } else {
        participants.value = allParticipants.value.slice(0, 2);
      }
    } catch {
      // intentionally silent
    } finally {
      loadingParticipants.value = false;
    }
  }

  function toggleExpandParticipant(id: number) {
    expandedParticipantId.value =
      expandedParticipantId.value === id ? null : id;
  }

  async function loadChartJs() {
    if (Chart) return;
    try {
      const mod = await import("chart.js/auto");
      Chart = mod.default || mod.Chart || mod;
    } catch {
      if ((window as any).Chart) {
        Chart = (window as any).Chart;
        return;
      }
      await new Promise<void>((resolve) => {
        const s = document.createElement("script");
        s.src =
          "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
        s.onload = () => {
          Chart = (window as any).Chart;
          resolve();
        };
        s.onerror = () => resolve();
        document.head.appendChild(s);
      });
    }
  }

  function buildAllCharts() {
    if (!Chart || activeTab.value !== "overview") return;
    Chart.defaults.font.family = "'Sarabun', sans-serif";
    Chart.defaults.color = "#64748b";
    Chart.defaults.scale.grid.color = "#f1f5f9";

    buildGrowthChart();
    buildBMI();
    buildSubmissionsChart();
    buildSubmissionTimeChart();
    buildDemographicsChart();
    buildEventsChart();
    buildGenderChart();
    buildRoleChart();
    buildHighRiskChart();
    buildGoalAchievementChart();
  }

  function buildSubmissionTimeChart() {
    const el = document.getElementById(
      "chart-submission-time",
    ) as HTMLCanvasElement | null;
    if (!el || !Chart) return;
    if (submissionTimeChart) submissionTimeChart.destroy();

    const times = submissionTimeStats.value;
    const total = times.morning + times.afternoon + times.evening + times.night;

    const dataValues =
      total > 0
        ? [times.morning, times.afternoon, times.evening, times.night]
        : [1];
    const bgColors =
      total > 0 ? ["#fcd34d", "#fb923c", "#818cf8", "#1e1b4b"] : ["#f1f5f9"];
    const labels =
      total > 0
        ? ["เช้า (06-12)", "บ่าย (12-18)", "เย็น (18-24)", "ดึก (00-06)"]
        : ["ไม่มีข้อมูล"];

    submissionTimeChart = new Chart(el.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [
          {
            data: dataValues,
            backgroundColor: bgColors,
            borderWidth: 0,
            borderRadius: 4,
            hoverOffset: total > 0 ? 6 : 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "75%",
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: total > 0,
            backgroundColor: "rgba(15, 23, 42, 0.9)",
            padding: 12,
            cornerRadius: 8,
          },
        },
      },
    });
  }

  function buildGoalAchievementChart() {
    const el = document.getElementById(
      "chart-goal-achievement",
    ) as HTMLCanvasElement | null;
    if (!el || !Chart) return;
    if (goalAchievementChart) goalAchievementChart.destroy();

    const stats = goalAchievementStats.value;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    if (!stats.top.length) {
      goalAchievementChart = new Chart(ctx, {
        type: "bar",
        data: {
          labels: ["ไม่มีข้อมูล"],
          datasets: [
            {
              label: "-",
              data: [1],
              backgroundColor: "#f1f5f9",
              borderRadius: 6,
              barPercentage: 0.6,
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: {
            x: { display: false, beginAtZero: true },
            y: {
              grid: { display: false },
              border: { display: false },
              ticks: { font: { size: 11 } },
              afterFit: function (scaleInstance: any) {
                scaleInstance.width = 160;
              },
            },
          },
        },
      });
      return;
    }

    const labels = stats.top.map((a) =>
      a.title.length > 22 ? a.title.substring(0, 22) + "…" : a.title,
    );
    const achievedData = stats.top.map((a) => a.achieved);
    const remainingData = stats.top.map((a) => a.remaining);

    let achievedGradient: any = "#10b981";
    const g = ctx.createLinearGradient(0, 0, 500, 0);
    if (g) {
      g.addColorStop(0, "#34d399");
      g.addColorStop(1, "#10b981");
      achievedGradient = g;
    }

    goalAchievementChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "สำเร็จเป้าหมาย",
            data: achievedData,
            backgroundColor: achievedGradient,
            borderRadius: 6,
            barPercentage: 0.65,
          },
          {
            label: "ยังไม่สำเร็จ",
            data: remainingData,
            backgroundColor: "#e2e8f0",
            borderRadius: 6,
            barPercentage: 0.65,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: "top",
            align: "end",
            labels: {
              usePointStyle: true,
              boxWidth: 8,
              padding: 15,
              font: { weight: "600", size: 11 },
            },
          },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.9)",
            padding: 12,
            cornerRadius: 8,
            titleFont: { size: 13 },
            bodyFont: { size: 13 },
            callbacks: {
              label: (tt: any) => {
                const item = stats.top[tt.dataIndex];
                if (!item) return "";
                if (tt.datasetIndex === 0) {
                  return `สำเร็จ: ${item.achieved}/${item.participants} คน (${item.rate}%)`;
                }
                return `ยังไม่สำเร็จ: ${item.remaining} คน`;
              },
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            grid: { color: "#f1f5f9", borderDash: [4, 4] },
            border: { display: false },
            beginAtZero: true,
            ticks: {
              font: { size: 11 },
              padding: 10,
              precision: 0,
              maxRotation: 0,
              minRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8,
            },
          },
          y: {
            stacked: true,
            grid: { display: false },
            border: { display: false },
            ticks: { font: { size: 11 } },
            afterFit: function (scaleInstance: any) {
              scaleInstance.width = 160;
            },
          },
        },
        interaction: { mode: "index", intersect: false },
      },
    });
  }

  function buildHighRiskChart() {
    const el = document.getElementById(
      "chart-high-risk",
    ) as HTMLCanvasElement | null;
    if (!el || !Chart) return;
    if (highRiskChart) highRiskChart.destroy();
    const counts = highRiskCounts.value;
    const total = counts.obese3 + counts.obese2 + counts.obese1;

    const dataValues =
      total > 0 ? [counts.obese3, counts.obese2, counts.obese1] : [1];
    const bgColors =
      total > 0 ? ["#f43f5e", "#f97316", "#f59e0b"] : ["#f1f5f9"];

    highRiskChart = new Chart(el.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: total > 0 ? ["อ้วนมาก", "อ้วน", "ท้วม"] : ["ไม่มีข้อมูล"],
        datasets: [
          {
            data: dataValues,
            backgroundColor: bgColors,
            borderWidth: 0,
            borderRadius: 4,
            hoverOffset: total > 0 ? 6 : 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "75%",
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: total > 0,
            backgroundColor: "rgba(15, 23, 42, 0.9)",
            padding: 12,
            cornerRadius: 8,
          },
        },
      },
    });
  }

  function buildRoleChart() {
    const el = document.getElementById(
      "chart-role",
    ) as HTMLCanvasElement | null;
    if (!el || !Chart) return;
    if (roleChart) roleChart.destroy();

    const labels = roleDistributionData.value.map((r) => r.role);
    const data = roleDistributionData.value.map((r) => r.count);
    const bgColors = roleDistributionData.value.map((r) => r.color);

    const ctx = el.getContext("2d");
    if (!ctx) return;

    const config = {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "จำนวน", // เอาคำว่า (คน) ออก
            data: data,
            backgroundColor: bgColors,
            borderRadius: 6,
            barPercentage: 0.6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.9)",
            padding: 12,
            cornerRadius: 8,
            titleFont: { size: 13 },
            bodyFont: { size: 14, weight: "bold" },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              font: { size: 11 },
              padding: 10,
              maxRotation: 0,
              minRotation: 0,
            },
          },
          y: {
            grid: { color: "#f1f5f9", borderDash: [4, 4] },
            border: { display: false },
            beginAtZero: true,
            ticks: {
              font: { size: 11 },
              padding: 10,
              precision: 0, // บังคับไม่ให้แสดงทศนิยม
              stepSize: 1, // เพิ่มสเกลขึ้นทีละ 1
            },
          },
        },
      },
    };

    roleChart = new Chart(ctx, config);
  }

  function buildGenderChart() {
    const el = document.getElementById(
      "chart-gender",
    ) as HTMLCanvasElement | null;
    if (!el || !Chart) return;
    if (genderChart) genderChart.destroy();

    const genderData = groupedGenderStats.value;
    const labels = Object.keys(genderData);
    const data = Object.values(genderData);

    genderChart = new Chart(el.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [
          {
            data: data,
            backgroundColor: ["#60a5fa", "#f472b6", "#cbd5e1"],
            borderWidth: 0,
            borderRadius: 4,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "75%",
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.9)",
            padding: 12,
            cornerRadius: 8,
          },
        },
      },
    });
  }

  function buildGrowthChart() {
    const el = document.getElementById(
      "chart-growth",
    ) as HTMLCanvasElement | null;
    if (!el || !Chart) return;
    if (growthChart) growthChart.destroy();

    const ctx = el.getContext("2d");
    if (!ctx) return;

    let gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, "rgba(99, 102, 241, 0.25)");
    gradient.addColorStop(1, "rgba(99, 102, 241, 0.0)");

    const g = data.value.userGrowth;
    const values =
      growthMode.value === "cum" ? g.map((i) => i.cum) : g.map((i) => i.count);

    growthChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: g.map((i) => i.month),
        datasets: [
          {
            label: growthMode.value === "cum" ? "สะสม" : "ใหม่",
            data: values,
            borderColor: "#6366f1",
            backgroundColor: gradient,
            borderWidth: 3,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointBackgroundColor: "#ffffff",
            pointBorderColor: "#6366f1",
            pointBorderWidth: 2.5,
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.9)",
            titleFont: { size: 13 },
            bodyFont: { size: 14, weight: "bold" },
            padding: 12,
            cornerRadius: 8,
            displayColors: false,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { font: { size: 12 } },
          },
          y: {
            grid: { color: "#f1f5f9", borderDash: [5, 5] },
            border: { display: false },
            beginAtZero: true,
            ticks: { font: { size: 12 }, padding: 10 },
          },
        },
        interaction: { intersect: false, mode: "index" },
      },
    });
  }

  function buildBMI() {
    const el = document.getElementById("chart-bmi") as HTMLCanvasElement | null;
    if (!el || !Chart) return;
    if (bmiChart) bmiChart.destroy();
    const hd = data.value.healthDistribution;
    if (!hd.length) return;

    bmiChart = new Chart(el.getContext("2d"), {
      type: "doughnut",
      data: {
        datasets: [
          {
            data: hd.map((h) => h.value),
            backgroundColor: hd.map((h) => h.color),
            borderWidth: 0,
            borderRadius: 6,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "82%",
        circumference: 180,
        rotation: -90,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.9)",
            padding: 12,
            cornerRadius: 8,
          },
        },
      },
    });
  }

  function buildSubmissionsChart() {
    const el = document.getElementById(
      "chart-submissions",
    ) as HTMLCanvasElement | null;
    if (!el || !Chart) return;
    if (submissionsChart) submissionsChart.destroy();

    const stats = data.value.submissionStats;
    submissionsChart = new Chart(el.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: ["อนุมัติ", "รอตรวจ", "ปฏิเสธ"],
        datasets: [
          {
            data: [
              stats?.approved || 0,
              stats?.pending || 0,
              stats?.rejected || 0,
            ],
            backgroundColor: ["#10b981", "#f59e0b", "#f43f5e"],
            borderWidth: 0,
            borderRadius: 6,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "82%",
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.9)",
            padding: 12,
            cornerRadius: 8,
          },
        },
      },
    });
  }

  function buildDemographicsChart() {
    const el = document.getElementById(
      "chart-demographics",
    ) as HTMLCanvasElement | null;
    if (!el || !Chart) return;
    if (demographicsChart) demographicsChart.destroy();

    const ageData = userSummaryStats.value.byAge;
    const orderedLabels = [
      "ต่ำกว่า 18",
      "18-24",
      "25-34",
      "35-44",
      "45-54",
      "55-64",
      "65+",
    ];

    const maleData = orderedLabels.map((label) => ageData[label]?.male || 0);
    const femaleData = orderedLabels.map(
      (label) => ageData[label]?.female || 0,
    );
    const otherData = orderedLabels.map((label) => ageData[label]?.other || 0);

    demographicsChart = new Chart(el.getContext("2d"), {
      type: "bar",
      data: {
        labels: orderedLabels,
        datasets: [
          {
            label: "ชาย",
            data: maleData,
            backgroundColor: "#3b82f6",
            borderRadius: 4,
            barPercentage: 0.55,
          },
          {
            label: "หญิง",
            data: femaleData,
            backgroundColor: "#ec4899",
            borderRadius: 4,
            barPercentage: 0.55,
          },
          {
            label: "อื่นๆ",
            data: otherData,
            backgroundColor: "#cbd5e1",
            borderRadius: 4,
            barPercentage: 0.55,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: "top",
            align: "end",
            labels: {
              usePointStyle: true,
              boxWidth: 8,
              padding: 15,
              font: { weight: "600", size: 11 },
            },
          },
          tooltip: {
            mode: "index",
            intersect: false,
            backgroundColor: "rgba(15, 23, 42, 0.9)",
            titleFont: { size: 13 },
            bodyFont: { size: 13 },
            padding: 12,
            cornerRadius: 8,
            itemSort: (a: any, b: any) => b.raw - a.raw,
          },
        },
        scales: {
          x: {
            stacked: true,
            grid: { color: "#f1f5f9", borderDash: [4, 4] },
            border: { display: false },
            beginAtZero: true,
            ticks: { font: { size: 11 }, padding: 10, stepSize: 5 },
          },
          y: {
            stacked: true,
            grid: { display: false },
            border: { display: false },
            ticks: {
              font: { size: 11 },
              maxRotation: 0,
              minRotation: 0,
              autoSkip: false,
            },
          },
        },
        interaction: { mode: "index", intersect: false },
      },
    });
  }

  function buildEventsChart() {
    const el = document.getElementById(
      "chart-events",
    ) as HTMLCanvasElement | null;
    if (!el || !Chart) return;
    if (eventsChart) eventsChart.destroy();

    const activities = [...data.value.activityBreakdown]
      .sort((a, b) => b.participant_count - a.participant_count)
      .slice(0, 5);

    const ctx = el.getContext("2d");
    let gradient = ctx?.createLinearGradient(0, 0, 400, 0);
    if (gradient) {
      gradient.addColorStop(0, "#818cf8");
      gradient.addColorStop(1, "#a78bfa");
    }

    eventsChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: activities.map((a) =>
          a.title.length > 20 ? a.title.substring(0, 20) + "..." : a.title,
        ),
        datasets: [
          {
            label: "ผู้เข้าร่วม",
            data: activities.map((a) => a.participant_count),
            backgroundColor: gradient || "#818cf8",
            borderRadius: 6,
            barPercentage: 0.6,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.9)",
            padding: 12,
            cornerRadius: 8,
            titleFont: { size: 13 },
            bodyFont: { size: 14, weight: "bold" },
          },
        },
        scales: {
          x: {
            grid: { color: "#f1f5f9", borderDash: [4, 4] },
            border: { display: false },
            beginAtZero: true,
            ticks: {
              padding: 10,
              precision: 0,
              maxRotation: 0,
              minRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8,
            },
          },
          y: {
            grid: { display: false },
            border: { display: false },
            ticks: { font: { size: 11 } },
            afterFit: function (scaleInstance: any) {
              scaleInstance.width = 160;
            },
          },
        },
      },
    });
  }

  function getBmiCategory(bmi: string | number | undefined | null) {
    if (!bmi) return null;
    const val = Number(bmi);
    if (isNaN(val)) return null;
    if (val < 18.5)
      return {
        text: "น้ำหนักน้อย/ผอม",
        bg: "bg-blue-100",
        textCls: "text-blue-700",
        border: "border-blue-200",
      };
    if (val < 23)
      return {
        text: "ปกติ (สุขภาพดี)",
        bg: "bg-emerald-100",
        textCls: "text-emerald-700",
        border: "border-emerald-200",
      };
    if (val < 25)
      return {
        text: "ท้วม/อ้วนระดับ 1",
        bg: "bg-amber-100",
        textCls: "text-amber-700",
        border: "border-amber-200",
      };
    if (val < 30)
      return {
        text: "อ้วนระดับ 2",
        bg: "bg-orange-100",
        textCls: "text-orange-700",
        border: "border-orange-200",
      };
    return {
      text: "อ้วนมาก/อันตราย",
      bg: "bg-rose-100",
      textCls: "text-rose-700",
      border: "border-rose-200",
    };
  }

  function formatGenderLabel(g: string) {
    const lower = (g || "").toLowerCase().trim();
    if (lower === "male" || lower === "ชาย") return "ชาย";
    if (lower === "female" || lower === "หญิง") return "หญิง";
    return "ไม่ระบุ";
  }

  function getGenderColor(label: string) {
    if (label === "ชาย") return "#3b82f6";
    if (label === "หญิง") return "#ec4899";
    return "#cbd5e1";
  }

  function switchGrowth(mode: "cum" | "new") {
    growthMode.value = mode;
    if (!growthChart) return;
    const g = data.value.userGrowth;
    growthChart.data.datasets[0].data =
      mode === "cum"
        ? g.map((i: GrowthItem) => i.cum)
        : g.map((i: GrowthItem) => i.count);
    growthChart.update();
  }

  function bmiTotal() {
    return data.value.healthDistribution.reduce((a, b) => a + b.value, 0) || 1;
  }
  function bmiPct(v: number) {
    return Math.round((v / bmiTotal()) * 100);
  }
  function roleTotal() {
    return data.value.roleDistribution?.reduce((a, b) => a + b.count, 0) || 1;
  }
  function rolePct(v: number) {
    return Math.round((v / roleTotal()) * 100);
  }
  function subRate() {
    const s = data.value.submissionStats;
    return s.total ? Math.round((s.approved / s.total) * 100) : 0;
  }
  function riskUsersTotal() {
    return (
      data.value.healthAssessment?.reduce(
        (a: any, b: any) => a + (b.at_risk_count || 0),
        0,
      ) || 0
    );
  }
  function goalAchieversTotal() {
    return (
      data.value.activityBreakdown?.reduce(
        (a: any, b: any) => a + (b.achieved_count || 0),
        0,
      ) || 0
    );
  }
  function pendingMissionsTotal() {
    return data.value.submissionStats?.pending || 0;
  }

  function getStatusColor(status: string) {
    if (status === "approved") return "bg-emerald-500 ring-emerald-100";
    if (status === "pending") return "bg-amber-400 ring-amber-100";
    if (status === "rejected") return "bg-rose-500 ring-rose-100";
    return "bg-slate-300 ring-slate-100";
  }
  function getStatusText(status: string) {
    if (status === "approved") return "ผ่าน";
    if (status === "pending") return "รอตรวจ";
    if (status === "rejected") return "ไม่ผ่าน";
    return "-";
  }

  function getChangeIcon(val1: number, val3: number) {
    if (!val3) return Minus;
    if (val3 < val1) return ArrowDown;
    if (val3 > val1) return ArrowUp;
    return Minus;
  }

  function getChangeColor(val1: number, val3: number, inverse = false) {
    if (!val3 || val1 === val3) return "text-slate-400 bg-slate-100";
    const isDown = val3 < val1;
    if (inverse)
      return isDown
        ? "text-rose-600 bg-rose-50"
        : "text-emerald-600 bg-emerald-50";
    else
      return isDown
        ? "text-emerald-600 bg-emerald-50"
        : "text-rose-600 bg-rose-50";
  }

  function getTanitaProgress(totalPoints: number) {
    return Math.min(100, (totalPoints / 3000) * 100);
  }

  function toggleTanitaSelection(id: number) {
    const index = selectedTanitaUsers.value.indexOf(id);
    if (index > -1) selectedTanitaUsers.value.splice(index, 1);
    else selectedTanitaUsers.value.push(id);
  }

  function selectAllTanita() {
    if (
      selectedTanitaUsers.value.length ===
        filteredTanitaInsights.value.length &&
      filteredTanitaInsights.value.length > 0
    ) {
      selectedTanitaUsers.value = [];
    } else {
      selectedTanitaUsers.value = filteredTanitaInsights.value.map((u) => u.id);
    }
  }

  function exportSelectedTanitaCSV() {
    const usersToExport = tanitaInsights.value.filter((u) =>
      selectedTanitaUsers.value.includes(u.id),
    );
    if (usersToExport.length === 0)
      return alert("กรุณาเลือกผู้ใช้งานที่ต้องการส่งออกข้อมูล");
    const headers = [
      "ชื่อ",
      "นามสกุล",
      "ชื่อทีม (สังกัด)",
      "ตำแหน่ง/ระดับ",
      "เพศ",
      "อายุ",
      "การเข้าร่วม (%)",
      "วันที่ร่วมทำ",
      "วันที่เปิดให้ทำรวม",
      "น้ำหนักแรกเข้า(กก.)",
      "น้ำหนักล่าสุด(กก.)",
      "เปลี่ยนแปลง(กก.)",
      "ไขมันแรกเข้า(%)",
      "ไขมันล่าสุด(%)",
      "ไขมันเปลี่ยน(%)",
      "กล้ามเนื้อแรกเข้า(กก.)",
      "กล้ามเนื้อล่าสุด(กก.)",
      "กล้ามเนื้อเปลี่ยน(กก.)",
    ];
    const rows = usersToExport.map((u) => {
      const fw = Number(u.first_tanita?.weight) || 0;
      const lw = Number(u.latest_tanita?.weight) || 0;
      const wf = lw && fw && lw !== fw ? (lw - fw).toFixed(1) : "";
      const ff = Number(u.first_tanita?.fat_pc) || 0;
      const lf = Number(u.latest_tanita?.fat_pc) || 0;
      const fpf = lf && ff && lf !== ff ? (lf - ff).toFixed(1) : "";
      const fm = Number(u.first_tanita?.muscle_mass) || 0;
      const lm = Number(u.latest_tanita?.muscle_mass) || 0;
      const mmf = lm && fm && lm !== fm ? (lm - fm).toFixed(1) : "";
      let age = "";
      if (u.birth_date)
        age = (
          new Date().getFullYear() - new Date(u.birth_date).getFullYear()
        ).toString();
      const gender =
        u.gender === "male"
          ? "ชาย"
          : u.gender === "female"
            ? "หญิง"
            : u.gender || "";
      return [
        u.fname_th || "",
        u.lname_th || "",
        u.team_name || "-",
        u.role_type || "",
        gender,
        age,
        u.participation_pct,
        u.active_days,
        u.total_event_days,
        fw || "",
        lw || "",
        wf,
        ff || "",
        lf || "",
        fpf,
        fm || "",
        lm || "",
        mmf,
      ];
    });
    downloadCSV("tanita_changes_export.csv", headers, rows);
  }

  function exportUsersCSV() {
    const headers = [
      "ชื่อ",
      "นามสกุล",
      "ประเภทผู้ใช้",
      "รายละเอียด (คณะ/ชั้น)",
      "รหัส",
      "เพศ",
      "อายุ",
      "BMI",
      "หมวด BMI",
      "น้ำหนัก (กก.)",
      "ส่วนสูง (ซม.)",
      "ชื่อทีม",
      "จำนวนกิจกรรม",
      "จำนวนการส่ง",
      "แต้มรวม",
      "เป้าหมาย",
      "วันที่สร้าง",
    ];
    const rows = filteredGlobalParticipants.value.map((p: any) => [
      p.fname_th,
      p.lname_th,
      p.role || "",
      p.role_detail_1 || "",
      p.id_code || "",
      p.gender === "male"
        ? "ชาย"
        : p.gender === "female"
          ? "หญิง"
          : p.gender || "",
      p.age ?? "",
      p.bmi ?? "",
      p.bmi_category || "",
      p.weight || "",
      p.height || "",
      p.team_name || "",
      p.activity_count ?? p.registered_activities?.length ?? 0,
      p.submission_count ?? 0,
      p.points || 0,
      p.main_goal || "",
      p.created_at ? new Date(p.created_at).toLocaleDateString("th-TH") : "",
    ]);
    downloadCSV("users_export.csv", headers, rows);
  }

  function exportActivityParticipantsCSV(act: ActivityOverview) {
    const headers = [
      "ชื่อ",
      "นามสกุล",
      "ประเภท",
      "ชื่อทีม",
      "ส่งทั้งหมด",
      "ผ่าน",
      "รอตรวจ",
      "ไม่ผ่าน",
      "แต้ม",
    ];
    const rows: any[][] = [];
    act.individuals.forEach((u: any) => {
      rows.push([
        u.fname_th,
        u.lname_th,
        "เดี่ยว",
        "",
        (u.approved_count || 0) +
          (u.pending_count || 0) +
          (u.rejected_count || 0),
        u.approved_count || 0,
        u.pending_count || 0,
        u.rejected_count || 0,
        u.points || 0,
      ]);
    });
    act.teams.forEach((tm: TeamOverview) => {
      tm.members.forEach((m: TeamMember) => {
        rows.push([
          m.fname_th,
          m.lname_th,
          "ทีม",
          tm.name,
          (m.approved_count || 0) +
            (m.pending_count || 0) +
            (m.rejected_count || 0),
          m.approved_count || 0,
          m.pending_count || 0,
          m.rejected_count || 0,
          m.points || 0,
        ]);
      });
    });
    downloadCSV(`activity_${act.id}_participants.csv`, headers, rows);
  }

  function downloadCSV(filename: string, headers: string[], rows: any[][]) {
    const xlsxFilename = filename.replace(".csv", ".xlsx");
    void exportWorkbook(xlsxFilename, [{ name: "Data", rows: [headers, ...rows] }]);
  }

  const getTeamName = (teamId: number | string) => {
    if (!teamId) return "-";
    const t = teamsListData.value.find((t) => String(t.id) === String(teamId));
    return t ? t.name : `ทีม #${teamId}`;
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "-";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const thMonths = [
      "ม.ค.",
      "ก.พ.",
      "มี.ค.",
      "เม.ย.",
      "พ.ค.",
      "มิ.ย.",
      "ก.ค.",
      "ส.ค.",
      "ก.ย.",
      "ต.ค.",
      "พ.ย.",
      "ธ.ค.",
    ];
    return `${d.getDate()} ${thMonths[d.getMonth()]} ${d.getFullYear() + 543} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  /* ==========================================
     LIFECYCLE & WATCHERS
  ========================================== */
  watch(
    () => uiStore.lastRealtimeUpdate,
    () => {
      if (fetchTimeout) clearTimeout(fetchTimeout);
      fetchTimeout = setTimeout(() => {
        fetchStats();
      }, 1500);
    },
  );

  watch(inactiveStreakDays, () => {
    fetchInactiveStreak();
  });

  function getIcon(name: string) {
    switch (name) {
      case "Users":
        return Users;
      case "Activity":
        return Activity;
      case "Briefcase":
        return Briefcase;
      case "Calendar":
        return Calendar;
      case "TrendingUp":
        return TrendingUp;
      case "UserCheck":
        return UserCheck;
      case "CheckCircle2":
        return CheckCircle2;
      case "History":
        return History;
      case "Clock":
        return Clock;
      case "ShieldCheck":
        return ShieldCheck;
      case "AlertTriangle":
        return AlertTriangle;
      case "Image":
        return ImageIcon;
      case "FileText":
        return FileText;
      default:
        return Activity;
    }
  }

  onMounted(() => {
    fetchStats();
    fetchAllParticipants();
    fetchActivityOverview();
    fetchInactiveStreak();
    fetchAllHealthAssessments();
  });

  return {
    // State
    loading,
    activeTab,
    data,
    deep,
    growthMode,
    tanitaInsights,
    loadingTanita,
    tanitaSearch,
    selectedTanitaUsers,
    inactiveStreak,
    inactiveStreakDays,
    loadingInactiveStreak,
    showBmiRiskExpanded,
    allHealthAssessments,
    loadingHealthAssessments,
    healthAssessmentSearch,
    healthAssessmentFilter,
    showCommentModal,
    commentTarget,
    commentText,
    savingComment,
    allParticipants,
    globalSearch,
    globalTypeFilter,
    globalRoleFilter,
    globalGenderFilter,
    globalAgeGroupFilter,
    globalBmiFilter,
    loadingAllParticipants,
    showTeamViewerModal,
    teamViewerData,
    loadingTeamViewer,
    allTeamsList,
    movingUserId,
    moveTargetTeamId,
    savingTeamMove,
    participantColumns,
    selectedActivityId,
    showParticipantModal,
    selectedActivity,
    participants,
    participantFilter,
    typeFilter,
    loadingParticipants,
    expandedParticipantId,
    showUserDetailModal,
    selectedUserDetail,
    profileLoading,
    selectedUserProfile,
    selectedUserSubmissions,
    selectedUserTanita,
    selectedUserRegistrations,
    userInsightSubTab,
    activityOverviews,
    loadingActivityOverview,
    selectedOverviewActivityId,
    showStatsModal,
    statsModalTitle,
    statsModalIcon,
    statsModalData,
    statsModalType,
    showTeamsListModal,
    teamsListSearch,
    roleDistributionData,
    topSubmittedActivities, // <--- ใช้ตัวนี้แทนในการแสดงผล

    // Computed
    totalUsersCount,
    todayUsersCount,
    filteredGlobalParticipants,
    userSummaryStats,
    groupedGenderStats,
    teamsListData,
    activityEngagementStats,
    uniqueRoles,
    filteredParticipants,
    selectedActivityOverview,
    filteredTanitaInsights,
    bmiRiskUsers,
    bmiRiskCount,
    filteredHealthAssessments,
    tanitaSummaryAnalytics,
    highRiskCounts,
    ongoingActivities,
    submissionTimeStats,
    goalAchievementStats,

    // Methods
    openStatsModal,
    handleStatModalClick,
    openTeamViewer,
    fetchAllTeamsList,
    moveUserToTeam,
    clearAllFilters,
    filterParticipantsBy,
    fetchStats,
    fetchAllParticipants,
    fetchActivityOverview,
    fetchTanitaInsights,
    openUserDetail,
    closeUserDetail,
    fetchInactiveStreak,
    fetchAllHealthAssessments,
    openCommentModal,
    saveComment,
    openParticipants,
    toggleExpandParticipant,
    loadChartJs,
    buildAllCharts,
    buildGrowthChart,
    buildBMI,
    calculateAge,
    getIcon,
    getBmiCategory,
    formatGenderLabel,
    getGenderColor,
    switchGrowth,
    bmiTotal,
    bmiPct,
    roleTotal,
    rolePct,
    subRate,
    riskUsersTotal,
    goalAchieversTotal,
    pendingMissionsTotal,
    getStatusColor,
    getStatusText,
    getChangeIcon,
    getChangeColor,
    getTanitaProgress,
    toggleTanitaSelection,
    selectAllTanita,
    exportSelectedTanitaCSV,
    exportUsersCSV,
    exportActivityParticipantsCSV,
    downloadCSV,
    getTeamName,
    formatDate,
  };
}
