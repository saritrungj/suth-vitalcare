import { ref, onMounted, onUnmounted, computed, nextTick, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { authStore } from "../store/auth";
import { uiStore } from "../store/ui";
import { useRealtime } from "./useRealtime";
import { abortableJson, isAbortError } from "../lib/http";
import { safeImageUrl } from "../lib/safeUrl";
export function useRankings() {
  const PAGE_SIZE = 10;
  const activityPageSize = 10;
  const router = useRouter();
  const route = useRoute();
  // ==========================================
  // UI States (Mobile Sidebar & Tabs)
  // ==========================================
  const showSidebar = ref(false);
  const activeTab = ref<"individual" | "team">("individual");
  const loading = ref(true);
  const error = ref(false);
  // AbortControllers so rapid tab/activity switches cancel stale in-flight
  // requests instead of letting late responses overwrite fresh data.
  let rankingsController: AbortController | null = null;
  let userRanksController: AbortController | null = null;
  const startRankingsRequest = () => {
    rankingsController?.abort();
    rankingsController = new AbortController();
    return rankingsController.signal;
  };
  const startUserRanksRequest = () => {
    userRanksController?.abort();
    userRanksController = new AbortController();
    return userRanksController.signal;
  };
  // ==========================================
  // Activities States
  // ==========================================
  const eventData = ref<any>(null);
  const eventDefaultUnit = ref("แต้ม");
  const allActivities = ref<any[]>([]);
  const activitySearch = ref("");
  const selectedActivityId = ref<string | null>(null);
  const activityVisibleCount = ref(20);
  const filteredActivities = computed(() => {
    if (!activitySearch.value) return allActivities.value;
    const q = activitySearch.value.toLowerCase();
    return allActivities.value.filter((a) => a.title.toLowerCase().includes(q));
  });
  const visibleActivities = computed(() => {
    return filteredActivities.value.slice(0, activityVisibleCount.value);
  });
  const hasJoinedActivities = computed(() => allActivities.value.length > 0);
  const loadMoreActivities = () => {
    if (activityVisibleCount.value < filteredActivities.value.length) {
      activityVisibleCount.value += 20;
    }
  };
  watch(activitySearch, () => {
    activityVisibleCount.value = 20;
  });
  // ==========================================
  // Ranking Filters
  // ==========================================
  const selectedRoleTypes = ref<string[]>([]);
  const roleTypeOptionsRaw = ref<string[]>([]);
  const roleTypeOptions = computed(() =>
    roleTypeOptionsRaw.value.map((o) => ({ id: o, label: o })),
  );
  const hasFilters = computed(() => selectedRoleTypes.value.length > 0);
  const setRoleTypeOptionsFromRows = (rows: any[]) => {
    if (roleTypeOptionsRaw.value.length) return;
    roleTypeOptionsRaw.value = Array.from(
      new Set(
        rows.map((row) => String(row.role_type || "").trim()).filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, "th"));
  };
  const fetchFilterOptions = async () => {
    try {
      const data = await abortableJson<{
        roleTypes: string[];
      }>("/api/stats/rankings/filters");
      roleTypeOptionsRaw.value = data.roleTypes || [];
    } catch (err) {
      // Filter options are non-critical — fail quietly.
    }
  };
  // Query-string fragment (leading `&`) appended to ranking requests.
  const filterQuery = () => {
    const params = new URLSearchParams();
    if (selectedRoleTypes.value.length)
      params.append("role_type", selectedRoleTypes.value.join(","));
    const qs = params.toString();
    return qs ? `&${qs}` : "";
  };
  // ==========================================
  // Units & Formatting
  // ==========================================
  const rankingUnitLong = computed(() => {
    if (route.query.unit) return route.query.unit as string;
    return eventDefaultUnit.value;
  });
  const rankingUnitShort = computed(() => {
    const u = rankingUnitLong.value;
    if (u === "กม.") return "km";
    if (u === "ก้าว") return "steps";
    if (u === "นาที") return "min";
    if (u === "ชม.") return "hr";
    if (u === "แคลอรี่" || u === "kcal" || u === "Kcal") return "kcal";
    if (u === "รอบ" || u === "ครั้ง") return "times";
    return u;
  });
  const isPoints = computed(() => {
    return (
      !rankingUnitLong.value ||
      rankingUnitLong.value === "pts" ||
      rankingUnitLong.value === "แต้ม"
    );
  });
  // ==========================================
  // Rankings States (Individual & Team)
  // ==========================================
  const individualRankings = ref<any[]>([]);
  const teamRankings = ref<any[]>([]);
  const indPage = ref(1);
  const teamPage = ref(1);
  const indHasMore = ref(true);
  const teamHasMore = ref(true);
  const currentPage = computed(() =>
    activeTab.value === "individual" ? indPage.value : teamPage.value,
  );
  const currentList = computed(() =>
    activeTab.value === "individual"
      ? individualRankings.value
      : teamRankings.value,
  );
  // Real rows only — CSS reserves min-height so the table doesn't jump.
  const tableRows = computed(() => currentList.value);
  const hasMore = computed(() =>
    activeTab.value === "individual" ? indHasMore.value : teamHasMore.value,
  );
  const top3 = computed(() => {
    return currentList.value.slice(0, 3);
  });
  // ==========================================
  // User & Team Specific States
  // ==========================================
  const hasTeam = computed(() => !!authStore.user?.team_id);
  const showTeamModal = ref(false);
  const selectedTeam = ref<any>(null);
  const teamMembers = ref<any[]>([]);
  const loadingMembers = ref(false);
  // Individual submission detail modal
  const showSubmissionModal = ref(false);
  const selectedUser = ref<any>(null);
  const userIndividualRank = ref<number | null>(null);
  const userTeamRank = ref<number | null>(null);
  const userActivityScore = ref(0);
  const userTeamActivityScore = ref(0);
  const rankLoading = ref(false);
  const userRank = computed(() =>
    activeTab.value === "individual"
      ? userIndividualRank.value
      : userTeamRank.value,
  );
  // ==========================================
  // Helper Functions
  // ==========================================
  const getRankClass = (rank: number) => {
    if (rank === 1) return "rk-rank--gold";
    if (rank === 2) return "rk-rank--silver";
    if (rank === 3) return "rk-rank--bronze";
    return "";
  };
  const formatDist = (val: any) =>
    Number(val || 0).toLocaleString("th-TH", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  const getName = (item: any) =>
    activeTab.value === "individual"
      ? item.nickname || item.fname_th || "นักวิ่ง"
      : item.name || "ทีม";
  const getInitial = (item: any) => (getName(item)?.[0] ?? "?").toUpperCase();
  const getDistance = (item: any) => {
    if (!isPoints.value && item.total_unit_value !== undefined) {
      return item.total_unit_value || 0;
    }
    return activeTab.value === "individual"
      ? item.total_points || item.total_distance || item.total_unit_value || 0
      : item.total_points || item.total_dist || item.total_unit_value || 0;
  };
  const getImage = (item: any) =>
    safeImageUrl(
      activeTab.value === "individual" ? item.picture_url : item.image,
    );
  const getTarget = (item: any) => Number(item.target) || 0;
  const isReached = (item: any) => item.reached === true;
  const isCurrentUser = (item: any) => {
    if (!authStore.user) return false;
    return activeTab.value === "individual"
      ? Number(item.id) === Number(authStore.user.id)
      : Number(item.id) === Number(authStore.user.team_id);
  };
  // ==========================================
  // API Fetching Functions
  // ==========================================
  const fetchActivities = async () => {
    const uid = authStore.user?.id;
    if (!uid) {
      allActivities.value = [];
      return;
    }
    try {
      const regs = await abortableJson<any[]>(
        `/api/users/${uid}/registrations`,
      );
      allActivities.value = (regs || [])
        .filter((r) => r.event?.id)
        .map((r) => ({
          id: r.event.id,
          title: r.event.title,
          goal_config: r.event.goal_config,
          joined_at: r.joined_at,
        }))
        .sort(
          (a, b) =>
            new Date(b.joined_at || 0).getTime() -
            new Date(a.joined_at || 0).getTime(),
        );
    } catch (err) {
      if (!isAbortError(err)) {
        uiStore.toast(
          "error",
          "โหลดรายการกิจกรรมไม่สำเร็จ",
          "ไม่สามารถดึงรายการกิจกรรมได้ในขณะนี้",
          { actionLabel: "ลองใหม่", onAction: () => fetchActivities() },
        );
      }
    }
  };
  const fetchPage = async (
    type: "individual" | "team",
    page: number,
    signal?: AbortSignal,
  ) => {
    const eventId = selectedActivityId.value;
    let url = `/api/stats/rankings/${type}?page=${page}&limit=${PAGE_SIZE}`;
    if (eventId) url += `&activity_id=${eventId}`;
    if (rankingUnitLong.value)
      url += `&unit=${encodeURIComponent(rankingUnitLong.value)}`;
    url += filterQuery();
    return await abortableJson<any[]>(url, { signal });
  };
  const fetchRankings = async (silent = false) => {
    const signal = startRankingsRequest();
    if (!silent) loading.value = true;
    indPage.value = 1;
    teamPage.value = 1;
    indHasMore.value = true;
    teamHasMore.value = true;
    try {
      const [indData, teamData] = await Promise.all([
        fetchPage("individual", 1, signal),
        fetchPage("team", 1, signal),
      ]);
      individualRankings.value = indData;
      teamRankings.value = teamData;
      setRoleTypeOptionsFromRows(indData);
      if (indData.length < PAGE_SIZE) indHasMore.value = false;
      if (teamData.length < PAGE_SIZE) teamHasMore.value = false;
      error.value = false;
    } catch (e) {
      if (isAbortError(e)) return; // superseded by a newer request — ignore
      error.value = true;
      if (!silent) {
        uiStore.toast(
          "error",
          "โหลดอันดับไม่สำเร็จ",
          "ไม่สามารถดึงข้อมูลอันดับได้ในขณะนี้",
          { actionLabel: "ลองใหม่", onAction: () => fetchRankings() },
        );
      }
    } finally {
      // Only the most recent request may clear the loading flag.
      if (rankingsController?.signal === signal) loading.value = false;
    }
  };
  const fetchUserRanks = async () => {
    const currentUser = authStore.user;
    if (!currentUser || !currentUser.id) return;
    const signal = startUserRanksRequest();
    rankLoading.value = true;
    try {
      const actId = selectedActivityId.value;
      const unit = rankingUnitLong.value;
      const params = new URLSearchParams();
      if (actId) params.append("activity_id", String(actId));
      if (unit) params.append("unit", unit);
      if (selectedRoleTypes.value.length)
        params.append("role_type", selectedRoleTypes.value.join(","));
      const qs = params.toString() ? `?${params.toString()}` : "";
      const indData = await abortableJson<{ rank: number; score: number }>(
        `/api/stats/individual/rank/${currentUser.id}${qs}`,
        { signal },
      );
      userIndividualRank.value = indData.rank;
      userActivityScore.value = indData.score;
      if (currentUser.team_id) {
        const teamData = await abortableJson<{ rank: number; score: number }>(
          `/api/stats/team/rank/${currentUser.team_id}${qs}`,
          { signal },
        );
        userTeamRank.value = teamData.rank;
        userTeamActivityScore.value = teamData.score;
      }
    } catch (err) {
      // Secondary data — fail quietly (abort or transient error).
    } finally {
      if (userRanksController?.signal === signal) rankLoading.value = false;
    }
  };
  // ==========================================
  // Interactions & Events
  // ==========================================
  const selectActivity = (id: any) => {
    if (!id) return;
    selectedActivityId.value = String(id);
    updateUrlQuery(true); // 🌟 Use Push for activity change
    showSidebar.value = false;
    fetchRankings();
    fetchUserRanks();
    const act = allActivities.value.find((a) => String(a.id) === String(id));
    if (act) {
      eventData.value = act;
      const config = act.goal_config || {};
      const unit =
        config.target_unit ||
        config.unit ||
        (config.target_type !== "points" ? config.target_type : "");
      if (unit && unit !== "points") eventDefaultUnit.value = unit;
      else eventDefaultUnit.value = "แต้ม";
    }
  };
  function updateUrlQuery(isPush = false) {
    const query: any = { ...route.query };
    if (selectedActivityId.value) query.eventId = selectedActivityId.value;
    else delete query.eventId;
    if (activeTab.value !== "individual") query.tab = activeTab.value;
    else delete query.tab;
    const page =
      activeTab.value === "individual" ? indPage.value : teamPage.value;
    if (page > 1) query.page = String(page);
    else delete query.page;
    if (selectedRoleTypes.value.length)
      query.roleType = selectedRoleTypes.value.join(",");
    else delete query.roleType;
    delete query.faculty;
    delete query.year;
    delete query.org;
    delete query.dept;
    if (isPush) router.replace({ query }).catch(() => {});
    else router.replace({ query }).catch(() => {});
  }
  // Re-fetch the leaderboard whenever a filter changes.
  const applyFilters = () => {
    indPage.value = 1;
    teamPage.value = 1;
    updateUrlQuery(true);
    fetchRankings();
    fetchUserRanks();
  };
  const setSelectedRoleTypes = (roleTypes: string[]) => {
    selectedRoleTypes.value = roleTypes;
    applyFilters();
  };
  const clearFilters = () => {
    selectedRoleTypes.value = [];
    applyFilters();
  };
  watch(
    () => route.query,
    (q) => {
      if (q.eventId) selectedActivityId.value = String(q.eventId);
      if (q.tab) activeTab.value = q.tab as any;
      if (q.page) {
        if (activeTab.value === "individual") indPage.value = Number(q.page);
        else teamPage.value = Number(q.page);
      }
      selectedRoleTypes.value = q.roleType
        ? String(q.roleType).split(",").filter(Boolean)
        : [];
    },
    { immediate: true },
  );
  const changePage = async (page: number) => {
    if (page < 1) return;
    if (page > 1 && !hasMore.value) return;
    const signal = startRankingsRequest();
    const tab = activeTab.value;
    loading.value = true;
    if (tab === "individual") indPage.value = page;
    else teamPage.value = page;
    try {
      const data = await fetchPage(tab, page, signal);
      if (tab === "individual") {
        individualRankings.value = data;
        setRoleTypeOptionsFromRows(data);
        indHasMore.value = data.length === PAGE_SIZE;
      } else {
        teamRankings.value = data;
        teamHasMore.value = data.length === PAGE_SIZE;
      }
      error.value = false;
      updateUrlQuery(true); // 🌟 Sync to URL
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      if (isAbortError(e)) return;
      error.value = true;
      uiStore.toast(
        "error",
        "โหลดอันดับไม่สำเร็จ",
        "ไม่สามารถเปลี่ยนหน้าได้ในขณะนี้",
        { actionLabel: "ลองใหม่", onAction: () => changePage(page) },
      );
    } finally {
      if (rankingsController?.signal === signal) loading.value = false;
    }
  };
  const switchTab = (tab: "individual" | "team") => {
    if (activeTab.value === tab) return;
    activeTab.value = tab;
    updateUrlQuery(true); // 🌟 Sync to URL
    fetchRankings();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openTeamModal = async (team: any) => {
    selectedTeam.value = team;
    showTeamModal.value = true;
    loadingMembers.value = true;
    teamMembers.value = [];
    try {
      const members = await abortableJson<any[]>(`/api/teams/${team.id}/users`);
      teamMembers.value = members || [];
    } catch (e) {
      uiStore.toast(
        "error",
        "โหลดสมาชิกทีมไม่สำเร็จ",
        "ไม่สามารถดึงรายชื่อสมาชิกได้ในขณะนี้",
      );
    } finally {
      loadingMembers.value = false;
    }
  };
  const closeTeamModal = () => {
    showTeamModal.value = false;
    selectedTeam.value = null;
  };
  const openSubmissionModal = (user: any) => {
    selectedUser.value = user;
    showSubmissionModal.value = true;
  };
  const closeSubmissionModal = () => {
    showSubmissionModal.value = false;
    selectedUser.value = null;
  };
  const handleItemClick = (item: any) => {
    if (activeTab.value === "team") openTeamModal(item);
    else openSubmissionModal(item);
  };
  const scrollToMyRank = async () => {
    if (!authStore.user || rankLoading.value) return;
    const rank = userRank.value;
    if (!rank) return;
    if (rank <= 3) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const targetPage = Math.ceil(rank / PAGE_SIZE);
    if (currentPage.value !== targetPage) {
      await changePage(targetPage);
    }
    await nextTick();
    // Wait one frame so the freshly-rendered row is laid out before scrolling.
    requestAnimationFrame(() => {
      const el = document.querySelector("[data-my-rank='true']");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };
  // ==========================================
  // Lifecycle Hooks
  // ==========================================
  onMounted(async () => {
    await Promise.all([fetchActivities(), fetchFilterOptions()]);
    const eid = route.query.eventId || route.query.activity_id;
    const joinedIds = allActivities.value.map((a) => String(a.id));
    let chosen: string | null = null;
    if (eid && joinedIds.includes(String(eid))) {
      chosen = String(eid);
    } else if (allActivities.value.length > 0) {
      chosen = String(allActivities.value[0].id);
    }
    selectedActivityId.value = chosen;
    if (chosen) {
      const act = allActivities.value.find(
        (a) => String(a.id) === String(chosen),
      );
      if (act) {
        eventData.value = act;
        const config = act.goal_config || {};
        const unit =
          config.target_unit ||
          config.unit ||
          (config.target_type !== "points" ? config.target_type : "");
        if (unit && unit !== "points") eventDefaultUnit.value = unit;
        else eventDefaultUnit.value = "แต้ม";
      }
      updateUrlQuery(false);
    }
    await fetchRankings();
    await fetchUserRanks();
  });
  // Coalesce bursts of realtime submission events into a single refetch so a
  // flurry of updates doesn't trigger one network round-trip per event.
  let realtimeTimer: ReturnType<typeof setTimeout> | null = null;
  const debouncedRefresh = () => {
    if (realtimeTimer) clearTimeout(realtimeTimer);
    realtimeTimer = setTimeout(() => {
      fetchRankings(true);
      fetchUserRanks();
    }, 600);
  };
  useRealtime({
    onSubmissionCreated: debouncedRefresh,
    onSubmissionUpdated: debouncedRefresh,
    onSubmissionDeleted: debouncedRefresh,
    onActivityUpdated: () => {
      fetchActivities();
      debouncedRefresh();
    },
  });
  onUnmounted(() => {
    if (realtimeTimer) clearTimeout(realtimeTimer);
    rankingsController?.abort();
    userRanksController?.abort();
  });
  // ==========================================
  // Export Data for UI Template
  // ==========================================
  return {
    PAGE_SIZE,
    authStore,
    // States
    showSidebar,
    eventData,
    eventDefaultUnit,
    activitySearch,
    selectedActivityId,
    activeTab,
    loading,
    error,
    showTeamModal,
    selectedTeam,
    teamMembers,
    loadingMembers,
    showSubmissionModal,
    selectedUser,
    // Filters
    selectedRoleTypes,
    roleTypeOptions,
    hasFilters,
    setSelectedRoleTypes,
    clearFilters,
    // Computed Properties
    filteredActivities,
    visibleActivities,
    rankingUnitLong,
    rankingUnitShort,
    isPoints,
    hasTeam,
    currentPage,
    currentList,
    tableRows,
    hasMore,
    top3,
    userRank,
    userActivityScore,
    userTeamActivityScore,
    rankLoading,
    // Methods
    selectActivity,
    getRankClass,
    formatDist,
    getName,
    getInitial,
    getDistance,
    getImage,
    isCurrentUser,
    hasJoinedActivities,
    getTarget,
    isReached,
    changePage,
    switchTab,
    loadMoreActivities,
    openTeamModal,
    closeTeamModal,
    openSubmissionModal,
    closeSubmissionModal,
    handleItemClick,
    scrollToMyRank,
  };
}
