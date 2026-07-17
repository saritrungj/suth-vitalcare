<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  Pencil,
  Plus,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Check,
  Lock,
  Unlock,
  MoreVertical,
  Loader2,
  User,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Eye,
  LogOut,
  UserMinus,
  Crown,
  RefreshCw,
  Download,
  EyeOff,
  AlertTriangle,
  Zap,
  ChevronUp,
  ChevronDown,
  MonitorSmartphone,
  Calendar,
  Clock,
  ShieldOff,
} from "lucide-vue-next";
import { useAdminTeam, type Team } from "../../composables/useAdminTeam";
import { authStore } from "../../store/auth";
import { useRoute, useRouter } from "vue-router";
import Swal from "sweetalert2";
const route = useRoute();
const router = useRouter();
const {
  teams,
  loading,
  searchQuery,
  submitting,
  fetchTeams,
  deleteTeam,
  updateTeam,
  createTeam,
  kickMember,
  toggleActivityRights,
  allUsers,
  fetchAllUsers,
  addMember,
} = useAdminTeam();
// --- 🌟 Table State ---
const dtSortKey = ref("id");
const dtSortDir = ref("desc");
const dtCurrentPage = ref(1);
const dtPerPage = ref(10);
const localSearchQuery = ref("");
const clearSearch = () => {
  localSearchQuery.value = "";
};
const visiblePages = computed(() => {
  const current = dtCurrentPage.value;
  const total = totalPages.value;
  const delta = 2;
  const range = [];
  const rangeWithDots = [];
  let l;
  for (let i = 1; i <= total; i++) {
    if (
      i === 1 ||
      i === total ||
      (i >= current - delta && i <= current + delta)
    ) {
      range.push(i);
    }
  }
  for (let i of range) {
    if (l) {
      if (i - l === 2) {
        rangeWithDots.push(l + 1);
      } else if (i - l !== 1) {
        rangeWithDots.push("...");
      }
    }
    rangeWithDots.push(i);
    l = i;
  }
  return rangeWithDots;
});
// --- 🚀 Process Data ---
const processedTeams = computed(() => {
  const list = [...(teams.value || [])];
  if (localSearchQuery.value) {
    const q = localSearchQuery.value.toLowerCase();
    return list.filter(
      (t) =>
        String(t.id).includes(q) ||
        (t.name || "").toLowerCase().includes(q) ||
        (t.code || "").toLowerCase().includes(q) ||
        String(t.hostId).includes(q),
    );
  }
  // Sort
  list.sort((a: any, b: any) => {
    let valA = a[dtSortKey.value];
    let valB = b[dtSortKey.value];
    if (valA == null) valA = "";
    if (valB == null) valB = "";
    if (typeof valA === "string") valA = valA.toLowerCase();
    if (typeof valB === "string") valB = valB.toLowerCase();
    if (valA < valB) return dtSortDir.value === "asc" ? -1 : 1;
    if (valA > valB) return dtSortDir.value === "asc" ? 1 : -1;
    return 0;
  });
  return list;
});
// --- 📄 Pagination ---
const totalPages = computed(() =>
  Math.ceil(processedTeams.value.length / dtPerPage.value),
);
const paginatedTeams = computed(() => {
  const start = (dtCurrentPage.value - 1) * dtPerPage.value;
  return processedTeams.value.slice(start, start + dtPerPage.value);
});
const setPage = (p: number) => {
  if (p >= 1 && p <= totalPages.value) dtCurrentPage.value = p;
};
const toggleSort = (key: string) => {
  if (dtSortKey.value === key) {
    dtSortDir.value = dtSortDir.value === "asc" ? "desc" : "asc";
  } else {
    dtSortKey.value = key;
    dtSortDir.value = "asc";
  }
};
// --- 🔗 Selection Logic ---
const selectedIds = ref<number[]>([]);
const isAllSelected = computed(
  () =>
    paginatedTeams.value.length > 0 &&
    paginatedTeams.value.every((t) => selectedIds.value.includes(t.id)),
);
const toggleOne = (id: number) => {
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter((i) => i !== id);
  } else {
    selectedIds.value.push(id);
  }
};
const toggleAll = () => {
  if (isAllSelected.value) {
    selectedIds.value = selectedIds.value.filter(
      (id) => !paginatedTeams.value.some((t) => t.id === id),
    );
  } else {
    const newIds = [...selectedIds.value];
    paginatedTeams.value.forEach((t) => {
      if (!newIds.includes(t.id)) newIds.push(t.id);
    });
    selectedIds.value = newIds;
  }
};
const bulkDelete = async () => {
  if (selectedIds.value.length === 0) return;
  const ok = await Swal.fire({
    title: "ยืนยันการลบกลุ่ม?",
    text: `คุณต้องการลบทีมที่เลือกทั้ง ${selectedIds.value.length} ทีมใช่หรือไม่? การลบนี้ไม่สามารถเรียกคืนได้`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "ยืนยันลบ",
    cancelButtonText: "ยกเลิก",
    customClass: {
      confirmButton: "premium-swal-confirm premium-swal-confirm-danger",
      cancelButton: "premium-swal-cancel",
      popup: "premium-swal-popup",
    },
    buttonsStyling: false,
  });
  if (ok.isConfirmed) {
    submitting.value = true;
    let successCount = 0;
    for (const id of selectedIds.value) {
      const team = teams.value.find((t) => t.id === id);
      if (team) {
        const success = await deleteTeam(team, true);
        if (success) successCount++;
      }
    }
    if (successCount > 0) {
      Swal.fire({
        icon: "success",
        title: "ลบสำเร็จ",
        text: `ลบทีม ${successCount} ทีมเรียบร้อยแล้ว`,
        confirmButtonColor: "#f97316",
      });
    }
    selectedIds.value = [];
    fetchTeams();
    submitting.value = false;
  }
};
// --- 📝 Modal Management ---
const modalMode = ref<"create" | "edit" | "members" | null>(null);
const targetTeam = ref<Team | null>(null);
const form = ref({
  name: "",
  maxMembers: 6,
  hostId: 0,
  hostName: "",
  isPrivate: false,
  code: "",
});
// --- Sync Modal with URL ---
watch(
  () => [route.query.sub, route.query.id, teams.value],
  ([newSub, newId, teamList]) => {
    const sub = String(newSub || "");
    const validSub = ["create", "edit", "members"].includes(sub);
    if (validSub) {
      if (modalMode.value !== sub) {
        modalMode.value = sub as any;
      }
      if (newId && Array.isArray(teamList) && teamList.length > 0) {
        const found = teamList.find((t: any) => t.id === Number(newId)) as any;
        if (found && (!targetTeam.value || targetTeam.value.id !== found.id)) {
          setupModalData(sub as any, found);
        }
      }
    } else if (!sub && modalMode.value) {
      modalMode.value = null;
      targetTeam.value = null;
    }
  },
  { immediate: true },
);
const setupModalData = (mode: "create" | "edit" | "members", team?: Team) => {
  if (team) targetTeam.value = team;
  if (mode === "edit" && team) {
    form.value = {
      name: team.name,
      maxMembers: team.maxMembers,
      hostId: team.hostId,
      hostName: team.members.find((m) => m.id === team.hostId)?.fname_th || "",
      isPrivate: team.isPrivate || false,
      code: team.code || "",
    };
    fetchAllUsers();
  } else if (mode === "create") {
    targetTeam.value = null;
    form.value = {
      name: "",
      maxMembers: 6,
      hostId: 0,
      hostName: "",
      isPrivate: false,
      code: "",
    };
    selectingHost.value = false;
    fetchAllUsers();
  } else if (mode === "members") {
    selectedCurrentMembers.value = [];
    selectedAvailableUsers.value = [];
    fetchAllUsers();
  }
};
const openModal = (mode: "create" | "edit" | "members", team?: Team) => {
  modalMode.value = mode;
  if (team) targetTeam.value = team;
  // Push to URL
  router.push({
    query: { ...route.query, sub: mode, id: team?.id || undefined },
  });
  setupModalData(mode, team);
};
const selectingHost = ref(false);
const hostSearchQuery = ref("");
const filteredHostUsers = computed(() => {
  if (!allUsers.value) return [];
  const q = hostSearchQuery.value.toLowerCase().trim();
  return allUsers.value
    .filter((u) => {
      // 1. Must not be in any team (except if editing and it's the current host)
      const inTeam =
        u.team_id && (!targetTeam.value || u.team_id !== targetTeam.value.id);
      if (inTeam) return false;
      // 2. Search filter
      if (!q) return true;
      return (
        String(u.id).includes(q) ||
        (u.fname_th || "").toLowerCase().includes(q) ||
        (u.nickname || "").toLowerCase().includes(q)
      );
    })
    .slice(0, 50);
});
const selectHost = (user: any) => {
  form.value.hostId = user.id;
  form.value.hostName = user.fname_th;
  selectingHost.value = false;
};
const selectedCurrentMembers = ref<number[]>([]);
const selectedAvailableUsers = ref<number[]>([]);
const currentMembersSearchQuery = ref("");
const filteredCurrentMembers = computed(() => {
  if (!targetTeam.value) return [];
  const q = currentMembersSearchQuery.value.toLowerCase().trim();
  if (!q) return targetTeam.value.members;
  return targetTeam.value.members.filter(
    (m) =>
      String(m.id).includes(q) ||
      (m.fname_th || "").toLowerCase().includes(q) ||
      (m.nickname || "").toLowerCase().includes(q),
  );
});
const isAllCurrentMembersSelected = computed(() => {
  const current = filteredCurrentMembers.value;
  return (
    current.length > 0 &&
    current.every((m) => selectedCurrentMembers.value.includes(m.id))
  );
});
const toggleSelectAllCurrentMembers = () => {
  if (isAllCurrentMembersSelected.value) {
    selectedCurrentMembers.value = [];
  } else {
    selectedCurrentMembers.value = filteredCurrentMembers.value.map(
      (m) => m.id,
    );
  }
};
const allUsersSearchQuery = ref("");
const filteredAllUsers = computed(() => {
  if (!allUsers.value) return [];
  let list = allUsers.value;
  // Filter out members already in this team
  if (targetTeam.value) {
    const memberIds = targetTeam.value.members.map((m) => m.id);
    list = list.filter((u) => !memberIds.includes(u.id));
  }
  if (allUsersSearchQuery.value) {
    const q = allUsersSearchQuery.value.toLowerCase();
    list = list.filter(
      (u) =>
        String(u.id).includes(q) ||
        (u.fname_th || "").toLowerCase().includes(q) ||
        (u.nickname || "").toLowerCase().includes(q) ||
        (u.phone || "").toLowerCase().includes(q),
    );
  }
  return list.slice(0, 50); // Limit to 50 for performance
});
const isAllAvailableUsersSelected = computed(() => {
  const current = filteredAllUsers.value;
  return (
    current.length > 0 &&
    current.every((u) => selectedAvailableUsers.value.includes(u.id))
  );
});
const toggleSelectAllAvailableUsers = () => {
  if (isAllAvailableUsersSelected.value) {
    selectedAvailableUsers.value = [];
  } else {
    selectedAvailableUsers.value = filteredAllUsers.value.map((u) => u.id);
  }
};
const handleBulkAddMembers = async () => {
  if (!targetTeam.value || selectedAvailableUsers.value.length === 0) return;
  submitting.value = true;
  let successCount = 0;
  for (const userId of selectedAvailableUsers.value) {
    const success = await addMember(targetTeam.value.id, userId, true);
    if (success) successCount++;
  }
  if (successCount > 0) {
    Swal.fire({
      icon: "success",
      title: "ดำเนินการสำเร็จ",
      text: `เพิ่มสมาชิก ${successCount} คนเข้าทีมเรียบร้อยแล้ว`,
      confirmButtonColor: "#f97316",
    });
    selectedAvailableUsers.value = [];
    const updatedTeam = teams.value.find((t) => t.id === targetTeam.value?.id);
    if (updatedTeam) targetTeam.value = updatedTeam;
  }
  submitting.value = false;
};
const handleBulkKickMembers = async () => {
  if (!targetTeam.value || selectedCurrentMembers.value.length === 0) return;
  const ok = await Swal.fire({
    title: "คัดสมาชิกออก",
    text: `คุณต้องการคัด ${selectedCurrentMembers.value.length} สมาชิกที่เลือกออกจากทีมใช่หรือไม่?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "ยืนยัน",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#f43f5e",
  });
  if (!ok.isConfirmed) return;
  submitting.value = true;
  let successCount = 0;
  for (const userId of selectedCurrentMembers.value) {
    if (userId === targetTeam.value.hostId) continue;
    const success = await kickMember(targetTeam.value.id, userId, true);
    if (success) successCount++;
  }
  if (successCount > 0) {
    Swal.fire({
      icon: "success",
      title: "ดำเนินการสำเร็จ",
      text: `คัดสมาชิก ${successCount} คนออกจากทีมเรียบร้อยแล้ว`,
      confirmButtonColor: "#f97316",
    });
    selectedCurrentMembers.value = [];
    const updatedTeam = teams.value.find((t) => t.id === targetTeam.value?.id);
    if (updatedTeam) targetTeam.value = updatedTeam;
  }
  submitting.value = false;
};
const handleAddMember = async (userId: number) => {
  if (!targetTeam.value) return;
  const success = await addMember(targetTeam.value.id, userId);
  if (success) {
    const updatedTeam = teams.value.find((t) => t.id === targetTeam.value?.id);
    if (updatedTeam) targetTeam.value = updatedTeam;
  }
};
const closeModal = () => {
  if (route.query.sub) {
    router.back();
  } else {
    modalMode.value = null;
    targetTeam.value = null;
  }
};
const handleKick = async (teamId: number, userId: number) => {
  const success = await kickMember(teamId, userId);
  if (success && targetTeam.value) {
    // fetchTeams will refresh the list
  }
};
const handleToggleRights = async (teamId: number, userId: number) => {
  await toggleActivityRights(teamId, userId);
};
const handleSubmit = async () => {
  if (!form.value.hostId) {
    Swal.fire("ข้อผิดพลาด", "กรุณาเลือกผู้ดูแลทีม (Host)", "error");
    return;
  }
  if (
    form.value.isPrivate &&
    (!form.value.code || form.value.code.length < 4)
  ) {
    Swal.fire("ข้อผิดพลาด", "กรุณาระบุ PIN สำหรับทีมส่วนตัว", "error");
    return;
  }
  // If public, clear code to match user-side logic
  if (!form.value.isPrivate) {
    form.value.code = "";
  }
  let success = false;
  if (modalMode.value === "create") {
    success = await createTeam(form.value);
  } else if (modalMode.value === "edit" && targetTeam.value) {
    success = await updateTeam(targetTeam.value.id, form.value);
  }
  if (success) closeModal();
};
// --- 🎛️ Action Menu (3-Dots) ---
const localActiveMenuId = ref<number | null>(null);
const localMenuPos = ref({ top: 0, right: 0 });
const toggleMenu = (id: number, event?: MouseEvent) => {
  if (localActiveMenuId.value === id) {
    localActiveMenuId.value = null;
    return;
  }
  localActiveMenuId.value = id;
  if (event) {
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    const menuHeight = 180;
    const spaceBelow = window.innerHeight - rect.bottom;
    const right = Math.max(8, window.innerWidth - rect.right);
    if (spaceBelow < menuHeight && rect.top > menuHeight) {
      localMenuPos.value = { top: rect.top - menuHeight - 4, right };
    } else {
      localMenuPos.value = {
        top: Math.min(rect.bottom + 4, window.innerHeight - menuHeight - 8),
        right,
      };
    }
  }
};
onMounted(() => {
  const handleGlobalClick = (e: MouseEvent) => {
    if (
      localActiveMenuId.value &&
      !(e.target as HTMLElement).closest(".action-menu-wrapper")
    ) {
      localActiveMenuId.value = null;
    }
  };
  window.addEventListener("click", handleGlobalClick);
  fetchTeams();
});
onUnmounted(() => window.removeEventListener("click", () => {}));
</script>
<template>
  <div class="font-sarabun bg-white min-h-screen w-full relative pb-24">
    <div
      class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-in"
    >
      <!-- Search -->
      <div
        class="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        <div class="flex items-center gap-2 sm:gap-4 w-full">
          <div class="search-pill-container flex-1 min-w-0 w-full">
            <Search class="search-icon flex-shrink-0" :size="18" />
            <input
              v-model="localSearchQuery"
              type="text"
              placeholder="ค้นหาชื่อทีม, หรือ Host ID..."
              class="w-full bg-transparent outline-none text-sm font-bold"
            />
            <button
              v-if="localSearchQuery"
              @click="clearSearch"
              class="btn-clear-search flex-shrink-0"
            >
              <X :size="14" />
            </button>
          </div>
        </div>
      </div>
      <div class="flex items-center justify-between px-1">
        <p
          class="text-[11px] font-bold text-slate-400 uppercase tracking-widest"
        >
          แสดง {{ paginatedTeams.length }} / {{ processedTeams.length }} รายการ
        </p>
      </div>
      <!-- Teams Table -->
      <div v-if="loading" class="space-y-4">
        <div
          v-for="i in 5"
          :key="i"
          class="h-16 bg-white border border-slate-100 animate-pulse rounded-2xl"
        ></div>
      </div>
      <div
        v-else-if="processedTeams.length === 0"
        class="py-24 text-center bg-white rounded-3xl border border-dashed border-slate-300 flex flex-col items-center justify-center"
      >
        <div
          class="w-20 h-20 bg-white border border-slate-100 rounded-full flex items-center justify-center mb-5"
        >
          <Search :size="32" class="text-slate-300" />
        </div>
        <p class="text-slate-800 font-bold text-xl mb-2">ไม่พบข้อมูลทีม</p>
      </div>
      <div v-else class="w-full">
        <div class="overflow-x-auto no-scrollbar pb-32">
          <table
            class="w-full text-left border-collapse whitespace-nowrap text-sm"
          >
            <thead
              class="bg-white text-slate-600 font-bold border-b border-slate-200"
            >
              <tr>
                <th
                  class="p-4 w-14 text-center border-r border-slate-100 sticky left-0 bg-white z-20"
                >
                  <div
                    @click="toggleAll"
                    class="w-5 h-5 mx-auto rounded-full border-2 flex items-center justify-center cursor-pointer transition-all"
                    :class="
                      isAllSelected
                        ? 'bg-orange-500 border-orange-500'
                        : 'bg-white border-slate-300'
                    "
                  >
                    <Check
                      v-if="isAllSelected"
                      :size="12"
                      class="text-white"
                      stroke-width="4"
                    />
                  </div>
                </th>
                <th
                  class="p-6 text-[11px] font-black text-slate-400 uppercase tracking-widest"
                >
                  ข้อมูลทีม
                </th>
                <th class="p-4 text-center">
                  <span
                    class="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest"
                    >รหัส Code</span
                  >
                </th>
                <th
                  class="p-6 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center"
                >
                  สมาชิก
                </th>
                <th
                  class="p-6 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center"
                >
                  สถานะ
                </th>
                <th
                  class="p-6 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest"
                >
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="team in paginatedTeams"
                :key="team.id"
                class="group transition-all"
              >
                <td
                  class="p-4 text-center border-r border-slate-50 sticky left-0 bg-white transition-colors z-10"
                >
                  <div
                    @click.stop="toggleOne(team.id)"
                    class="w-5 h-5 mx-auto rounded-full border-2 flex items-center justify-center cursor-pointer transition-all"
                    :class="
                      selectedIds.includes(team.id)
                        ? 'bg-orange-500 border-orange-500'
                        : 'bg-white border-slate-300'
                    "
                  >
                    <Check
                      v-if="selectedIds.includes(team.id)"
                      :size="12"
                      class="text-white"
                      stroke-width="4"
                    />
                  </div>
                </td>
                <td class="p-4">
                  <div class="flex items-center gap-3">
                    <div
                      class="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 font-bold text-sm border border-orange-100 shrink-0"
                    >
                      {{ (team.name || "T").charAt(0).toUpperCase() }}
                    </div>
                    <div class="flex flex-col min-w-0 leading-tight gap-0.5">
                      <p
                        class="font-bold text-slate-900 text-[13px] truncate group-hover:text-orange-600 transition-colors"
                      >
                        {{ team.name }}
                      </p>
                      <p
                        class="text-xs text-slate-400 truncate uppercase tracking-tighter font-bold"
                      >
                        Host ID: {{ team.hostId }}
                      </p>
                    </div>
                  </div>
                </td>
                <td class="p-4 text-center">
                  <span
                    v-if="team.isPrivate && team.code"
                    class="px-2.5 py-1 bg-white text-slate-700 rounded-lg font-mono font-bold text-xs tracking-widest border border-slate-200"
                  >
                    {{ team.code }}
                  </span>
                  <span v-else class="text-slate-400 text-[11px] font-bold"
                    >ไม่มีรหัส</span
                  >
                </td>
                <td class="p-4 text-center">
                  <div class="inline-flex flex-col items-center leading-none">
                    <span class="text-lg font-black text-slate-800">{{
                      team.members.length
                    }}</span>
                    <span
                      class="text-[9px] font-bold text-slate-400 uppercase tracking-tighter"
                      >/ {{ team.maxMembers }} คน</span
                    >
                  </div>
                </td>
                <td class="p-4 text-center">
                  <span
                    v-if="team.isPrivate"
                    class="border text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider inline-block border-amber-200 bg-amber-50 text-amber-600"
                  >
                    ส่วนตัว
                  </span>
                  <span
                    v-else
                    class="border text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider inline-block border-emerald-200 bg-emerald-50 text-emerald-600"
                  >
                    สาธารณะ
                  </span>
                </td>
                <td
                  class="p-4 text-center sticky right-0 bg-white transition-colors z-10 border-l border-slate-50"
                >
                  <button
                    @click.stop="toggleMenu(team.id, $event)"
                    class="w-10 h-10 mx-auto flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all action-menu-wrapper"
                    :class="{
                      'bg-slate-50 text-slate-700':
                        localActiveMenuId === team.id,
                    }"
                  >
                    <MoreVertical :size="20" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <!-- Pagination -->
      <div
        v-if="totalPages > 1"
        class="flex items-center justify-center gap-2 pt-4 pb-4"
      >
        <button
          @click="setPage(dtCurrentPage - 1)"
          :disabled="dtCurrentPage === 1"
          class="rounded-full border border-slate-200 bg-white text-slate-500 hover:text-orange-500 hover:border-orange-500 disabled:opacity-30 disabled:hover:text-slate-500 disabled:hover:border-slate-200 transition-all flex items-center justify-center flex-shrink-0"
          style="width: 40px; height: 40px"
        >
          <ChevronLeft :size="18" />
        </button>
        <div class="flex items-center gap-1.5">
          <button
            v-for="(p, index) in visiblePages"
            :key="index"
            @click="typeof p === 'number' ? setPage(p) : null"
            class="rounded-full text-sm font-bold transition-all flex items-center justify-center flex-shrink-0"
            :class="[
              dtCurrentPage === p
                ? 'bg-orange-500 border-orange-500 text-white border'
                : typeof p === 'number'
                  ? 'bg-white border-slate-200 text-slate-600 hover:border-orange-300 hover:text-orange-600 border'
                  : 'bg-transparent border-transparent text-slate-400 cursor-default pointer-events-none',
            ]"
            style="width: 40px; height: 40px"
            :disabled="typeof p !== 'number'"
          >
            {{ p }}
          </button>
        </div>
        <button
          @click="setPage(dtCurrentPage + 1)"
          :disabled="dtCurrentPage === totalPages"
          class="rounded-full border border-slate-200 bg-white text-slate-500 hover:text-orange-500 hover:border-orange-500 disabled:opacity-30 disabled:hover:text-slate-500 disabled:hover:border-slate-200 transition-all flex items-center justify-center flex-shrink-0"
          style="width: 40px; height: 40px"
        >
          <ChevronRight :size="18" />
        </button>
      </div>
      <div class="h-32"></div>
    </div>
    <!-- Persistent Bottom Actions Bar -->
    <div
      class="fixed bottom-0 right-0 z-[40] flex items-center justify-end gap-3 p-4 sm:p-6"
      :style="{
        left: selectedIds.length > 0 ? 'var(--sidebar-width, 0)' : 'auto',
      }"
    >
      <template v-if="selectedIds.length > 0">
        <div
          class="flex items-center gap-2 w-full justify-between bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 max-w-7xl mx-auto overflow-hidden"
        >
          <div class="flex items-center gap-2 sm:gap-3 shrink-0">
            <div
              class="bg-orange-500 text-white px-3 sm:px-4 py-2 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap"
            >
              เลือกไว้ {{ selectedIds.length }} รายการ
            </div>
            <button
              @click="selectedIds = []"
              class="px-3 sm:px-4 py-2 bg-slate-100 text-slate-600 font-bold text-xs sm:text-sm rounded-xl hover:bg-slate-200 transition-all shrink-0"
            >
              ยกเลิก
            </button>
          </div>
          <!-- Right side actions, horizontally scrollable on small screens -->
          <div
            class="flex items-center gap-2 overflow-x-auto custom-scrollbar no-scrollbar py-1"
            style="scrollbar-width: none"
          >
            <button
              @click="bulkDelete"
              class="bg-rose-500 text-white px-3 sm:px-4 h-9 sm:h-10 rounded-xl text-xs sm:text-[13px] font-bold flex items-center gap-1.5 sm:gap-2 hover:bg-rose-600 transition-all shrink-0"
            >
              <Trash2 :size="16" />
              <span class="hidden sm:inline">ลบที่เลือก</span>
              <span class="sm:hidden">ลบ</span>
            </button>
          </div>
        </div>
      </template>
      <template v-else>
        <button
          @click="openModal('create')"
          class="bg-orange-500 text-white w-48 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-orange-600 shadow-none"
        >
          <Plus :size="20" stroke-width="3" />
          สร้างทีมใหม่
        </button>
      </template>
    </div>
    <!-- 3-Dots Action Menu -->
    <!-- 3-Dots Action Menu -->
    <Teleport to="body">
      <div v-if="localActiveMenuId !== null">
        <div
          @click="localActiveMenuId = null"
          class="fixed inset-0 z-[1050]"
        ></div>
        <div
          class="fixed z-[1051] w-56 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden transition-all duration-200 animate-in fade-in zoom-in-95"
          :style="{
            top: localMenuPos.top + 'px',
            right: localMenuPos.right + 'px',
          }"
          @click.stop
        >
          <div class="py-2">
            <div class="px-4 py-2 mb-1 border-b border-slate-100">
              <p
                class="text-[10px] font-bold text-slate-400 uppercase tracking-wider"
              >
                จัดการทีม
              </p>
            </div>
            <!-- 🌟 ย้ายปุ่ม "แก้ไขข้อมูลทีม" ขึ้นมาไว้ด้านบนสุดตามที่คุณต้องการ -->
            <button
              @click="
                openModal(
                  'edit',
                  teams.find((t) => t.id === localActiveMenuId)!,
                );
                localActiveMenuId = null;
              "
              class="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-orange-50 hover:text-orange-600 transition-colors flex items-center gap-3"
            >
              <div class="p-1.5 bg-slate-50 rounded-lg text-slate-500">
                <Pencil :size="16" />
              </div>
              แก้ไขข้อมูลทีม
            </button>
            <!-- เลื่อนปุ่ม "จัดการสมาชิก" ลงมาเป็นอันดับที่ 2 -->
            <button
              @click="
                openModal(
                  'members',
                  teams.find((t) => t.id === localActiveMenuId)!,
                );
                localActiveMenuId = null;
              "
              class="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-orange-50 hover:text-orange-600 transition-colors flex items-center gap-3"
            >
              <div class="p-1.5 bg-slate-50 rounded-lg text-slate-500">
                <Users :size="16" />
              </div>
              จัดการสมาชิก
            </button>
            <div class="h-px bg-slate-100 my-1 mx-4"></div>
            <button
              @click="
                deleteTeam(teams.find((t) => t.id === localActiveMenuId)!);
                localActiveMenuId = null;
              "
              class="w-full px-4 py-2.5 text-left text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-3"
            >
              <div class="p-1.5 bg-rose-100/50 rounded-lg text-rose-500">
                <Trash2 :size="16" />
              </div>
              ลบทีมถาวร
            </button>
          </div>
        </div>
      </div>
    </Teleport>
    <!-- Modal: Create/Edit Team -->
    <div
      v-if="modalMode === 'create' || modalMode === 'edit'"
      class="fixed inset-0 z-[1000] flex items-center justify-center p-0 sm:p-4"
    >
      <div
        @click="closeModal"
        class="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
      ></div>
      <!-- เพิ่ม h-full sm:h-auto และปรับ rounded สำหรับมือถือ -->
      <div
        class="relative bg-white w-full h-full sm:h-auto max-h-[95vh] sm:max-h-[90vh] max-w-lg rounded-none sm:rounded-[2.5rem] overflow-hidden animate-in zoom-in duration-200 flex flex-col"
      >
        <!-- ใช้ flex-col เพื่อดันปุ่มลงด้านล่างสุดได้ถ้าต้องการ -->
        <div
          class="p-6 sm:p-8 space-y-6 sm:space-y-8 flex-1 flex flex-col overflow-y-auto custom-scrollbar"
        >
          <div class="flex items-center justify-between">
            <div>
              <p
                class="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] mb-1"
              >
                TEAM MANAGEMENT
              </p>
              <h2 class="text-2xl font-black text-slate-900 tracking-tight">
                {{ modalMode === "create" ? "สร้างทีมใหม่" : "แก้ไขข้อมูลทีม" }}
              </h2>
            </div>
            <button
              @click="closeModal"
              class="p-3 hover:bg-slate-50 rounded-2xl transition-colors text-slate-300 hover:text-slate-900"
            >
              <X :size="24" />
            </button>
          </div>
          <div class="space-y-6">
            <div class="space-y-2">
              <label
                class="text-xs font-black text-slate-400 uppercase tracking-widest ml-1"
                >ชื่อทีมของคุณ</label
              >
              <input
                v-model="form.name"
                type="text"
                placeholder="ระบุชื่อทีมสุดเจ๋ง..."
                class="w-full px-6 py-4.5 bg-white border border-slate-200 rounded-[1.25rem] outline-none focus:border-orange-500 transition-all font-black text-lg"
              />
            </div>
            <div class="space-y-3">
              <div
                class="flex items-center justify-between py-2 px-1 cursor-pointer group"
                @click="form.isPrivate = !form.isPrivate"
              >
                <div class="flex flex-col">
                  <span class="text-sm font-black text-slate-800"
                    >ตั้งรหัสผ่านเข้าทีม (Private)</span
                  >
                  <span class="text-[11px] text-slate-400 font-bold"
                    >เฉพาะผู้ที่มี PIN เท่านั้นถึงจะเข้าร่วมได้</span
                  >
                </div>
                <div
                  class="w-12 h-7 rounded-full transition-all relative"
                  :class="form.isPrivate ? 'bg-orange-500' : 'bg-slate-200'"
                >
                  <div
                    class="absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-all shadow-sm"
                    :class="{ 'translate-x-5': form.isPrivate }"
                  ></div>
                </div>
              </div>
              <Transition name="fade">
                <div v-if="form.isPrivate" class="space-y-2">
                  <label
                    class="text-xs font-black text-orange-500 uppercase tracking-widest ml-1"
                    >สร้าง PIN เข้าร่วมทีม</label
                  >
                  <input
                    v-model="form.code"
                    type="text"
                    placeholder="ระบุ PIN..."
                    class="w-full px-6 py-4.5 bg-orange-50/30 border border-orange-100 rounded-[1.25rem] outline-none focus:bg-white focus:border-orange-500 transition-all font-black text-center uppercase tracking-[0.5em] text-xl"
                  />
                </div>
              </Transition>
            </div>
            <div class="space-y-3">
              <label
                class="text-xs font-black text-slate-400 uppercase tracking-widest ml-1"
                >จำนวนสมาชิกสูงสุด (คน)</label
              >
              <div class="grid grid-cols-5 gap-3">
                <button
                  v-for="n in [2, 3, 4, 5, 6]"
                  :key="n"
                  @click="form.maxMembers = n"
                  class="h-14 rounded-2xl font-black text-lg transition-all border-2 flex items-center justify-center shadow-sm"
                  :class="
                    form.maxMembers === n
                      ? 'bg-orange-500 border-orange-500 text-white'
                      : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                  "
                >
                  {{ n }}
                </button>
              </div>
            </div>
            <div class="space-y-2">
              <label
                class="text-xs font-black text-slate-400 uppercase tracking-widest ml-1"
                >ผู้ดูแลทีม (Host)</label
              >
              <div
                v-if="!selectingHost"
                class="flex items-center justify-between p-5 bg-white border border-slate-200 rounded-2xl group hover:border-orange-500 transition-all cursor-pointer"
                @click="selectingHost = true"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="w-10 h-10 bg-white rounded-full border border-slate-100 flex items-center justify-center text-orange-500 font-black"
                  >
                    {{
                      form.hostName
                        ? form.hostName.charAt(0).toUpperCase()
                        : form.hostId
                          ? "ID"
                          : "?"
                    }}
                  </div>
                  <div>
                    <p class="text-sm font-black text-slate-900">
                      {{
                        form.hostName ||
                        (form.hostId
                          ? "กำลังโหลดชื่อ..."
                          : "ยังไม่ได้เลือกผู้ดูแล")
                      }}
                    </p>
                    <p
                      class="text-[10px] text-slate-400 font-bold uppercase tracking-widest"
                    >
                      ID: {{ form.hostId || "—" }}
                    </p>
                  </div>
                </div>
                <div
                  class="text-orange-500 font-black text-xs uppercase tracking-widest"
                >
                  เปลี่ยน
                </div>
              </div>
              <!-- Host Selection Area -->
              <div
                v-else
                class="space-y-3 p-5 bg-white border-2 border-orange-100 rounded-3xl animate-in fade-in zoom-in-95"
              >
                <div class="flex items-center justify-between mb-2">
                  <span
                    class="text-[10px] font-black text-orange-600 uppercase tracking-widest"
                    >เลือกผู้ดูแลจากรายชื่อ</span
                  >
                  <button
                    @click="selectingHost = false"
                    class="text-slate-300 hover:text-slate-900"
                  >
                    <X :size="16" />
                  </button>
                </div>
                <div class="relative">
                  <Search
                    :size="14"
                    class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    v-model="hostSearchQuery"
                    type="text"
                    placeholder="ค้นหาชื่อ หรือ ID..."
                    class="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs focus:border-orange-500 transition-all outline-none font-bold"
                  />
                </div>
                <div
                  class="max-h-32 overflow-y-auto custom-scrollbar space-y-1 pr-1"
                >
                  <div
                    v-for="u in filteredHostUsers"
                    :key="u.id"
                    @click="selectHost(u)"
                    class="p-3 rounded-xl hover:bg-orange-50 cursor-pointer flex items-center justify-between group"
                  >
                    <div class="flex items-center gap-3">
                      <img
                        :src="
                          u.picture_url ||
                          u.avatar ||
                          'https://ui-avatars.com/api/?name=' + u.fname_th
                        "
                        class="w-8 h-8 rounded-full border border-slate-100 object-cover"
                      />
                      <div>
                        <p class="text-xs font-black text-slate-800">
                          {{ u.fname_th }}
                        </p>
                        <p class="text-[9px] text-slate-400 font-bold">
                          ID: {{ u.id }}
                        </p>
                      </div>
                    </div>
                    <Check
                      v-if="form.hostId === u.id"
                      :size="14"
                      class="text-orange-500"
                    />
                  </div>
                  <p
                    v-if="filteredHostUsers.length === 0"
                    class="text-center py-4 text-[10px] text-slate-400 italic"
                  >
                    ไม่พบผู้ใช้ที่ว่าง
                  </p>
                </div>
              </div>
              <p class="text-[10px] text-slate-400 font-bold px-1">
                * ผู้ดูแลทีมต้องไม่ได้อยู่ในทีมอื่นอยู่แล้ว
              </p>
            </div>
          </div>
          <!-- ใช้ mt-auto เพื่อดันปุ่มลงล่างสุดในมือถือ -->
          <div class="pt-4 mt-auto flex gap-4">
            <button
              @click="closeModal"
              class="flex-1 py-5 bg-slate-50 text-slate-600 rounded-[1.5rem] font-black hover:bg-slate-100 transition-all active:scale-95"
            >
              ยกเลิก
            </button>
            <button
              @click="handleSubmit"
              :disabled="submitting || !form.name || !form.hostId"
              class="flex-[2] py-5 bg-orange-500 text-white rounded-[1.5rem] font-black hover:bg-orange-600 transition-all disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95"
            >
              <Loader2 v-if="submitting" :size="20" class="animate-spin" />
              {{ modalMode === "create" ? "ยืนยันสร้างทีม" : "บันทึกการแก้ไข" }}
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- Modal: Member Management (Premium UI) -->
    <Teleport to="body">
      <div
        v-if="modalMode === 'members' && targetTeam"
        class="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      >
        <div
          @click="closeModal"
          class="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
        ></div>
        <div
          class="relative bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[90vh]"
        >
          <!-- Header -->
          <div
            class="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-white"
          >
            <h3
              class="font-bold text-orange-800 text-base flex items-center gap-2"
            >
              <Users :size="20" class="text-orange-500" />
              จัดการกิจกรรมที่เข้าร่วม
            </h3>
            <button
              @click="closeModal"
              class="p-1.5 text-orange-400 hover:text-orange-800 bg-white rounded-full transition-colors border border-slate-100"
            >
              <X :size="20" />
            </button>
          </div>
          <!-- Content Area -->
          <div class="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            <!-- Team Info Card -->
            <div
              class="flex items-center gap-4 p-5 bg-white rounded-3xl border-2 border-slate-100"
            >
              <div
                class="w-14 h-14 bg-white rounded-full flex items-center justify-center text-slate-400 font-black text-xl border-4 border-slate-50"
              >
                {{ targetTeam.name.substring(0, 2).toUpperCase() }}
              </div>
              <div class="flex-1 min-w-0 leading-tight">
                <p class="font-black text-slate-900 text-lg truncate">
                  {{ targetTeam.name }}
                </p>
                <p class="text-xs text-slate-400 mt-1 font-bold">
                  {{
                    targetTeam.isPrivate
                      ? "ทีมส่วนตัว (มีรหัสเข้า)"
                      : "ทีมสาธารณะ"
                  }}
                </p>
              </div>
            </div>
            <!-- Section 1: Current Members -->
            <div class="space-y-4">
              <div class="flex items-center justify-between px-1">
                <p
                  class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest"
                >
                  สมาชิกในทีมปัจจุบัน ({{ targetTeam.members.length }} /
                  {{ targetTeam.maxMembers }})
                </p>
                <button
                  v-if="targetTeam.members.length > 0"
                  @click="toggleSelectAllCurrentMembers"
                  class="flex items-center gap-2 group"
                >
                  <div class="flex flex-col items-end">
                    <span
                      class="text-[10px] font-black text-slate-400 group-hover:text-orange-600 transition-colors uppercase"
                      >เลือกทั้งหมด</span
                    >
                    <span
                      v-if="selectedCurrentMembers.length > 0"
                      class="text-[9px] font-bold text-orange-500"
                      >เลือกแล้ว {{ selectedCurrentMembers.length }} คน</span
                    >
                  </div>
                  <div
                    class="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all"
                    :class="
                      isAllCurrentMembersSelected
                        ? 'bg-orange-500 border-orange-500'
                        : 'bg-white border-slate-200 group-hover:border-slate-300'
                    "
                  >
                    <Check
                      v-if="isAllCurrentMembersSelected"
                      :size="12"
                      class="text-white"
                      stroke-width="4"
                    />
                  </div>
                </button>
              </div>
              <!-- Search Current Members -->
              <div v-if="targetTeam.members.length > 5" class="relative group">
                <Search
                  :size="16"
                  class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors"
                />
                <input
                  v-model="currentMembersSearchQuery"
                  type="text"
                  placeholder="ค้นหาสมาชิกในทีม..."
                  class="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs focus:border-orange-500 transition-all outline-none font-bold"
                />
              </div>
              <div
                class="flex flex-col gap-2 max-h-60 overflow-y-auto custom-scrollbar pr-1 py-1"
              >
                <div
                  v-for="m in filteredCurrentMembers"
                  :key="m.id"
                  @click="
                    selectedCurrentMembers.includes(m.id)
                      ? (selectedCurrentMembers = selectedCurrentMembers.filter(
                          (id) => id !== m.id,
                        ))
                      : selectedCurrentMembers.push(m.id)
                  "
                  class="group flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-2xl hover:border-orange-200 transition-all cursor-pointer"
                  :class="{
                    'bg-orange-50/30 border-orange-200':
                      selectedCurrentMembers.includes(m.id),
                  }"
                >
                  <div
                    class="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                    :class="
                      selectedCurrentMembers.includes(m.id)
                        ? 'bg-orange-500 border-orange-500'
                        : 'bg-white border-slate-200 group-hover:border-slate-300'
                    "
                  >
                    <Check
                      v-if="selectedCurrentMembers.includes(m.id)"
                      :size="14"
                      class="text-white"
                      stroke-width="4"
                    />
                  </div>
                  <div class="flex items-center gap-3">
                    <img
                      :src="
                        m.avatar ||
                        m.picture_url ||
                        'https://ui-avatars.com/api/?name=' + m.fname_th
                      "
                      class="w-10 h-10 rounded-full border-2 border-white object-cover shrink-0"
                    />
                    <div class="flex-1 min-w-0">
                      <p
                        class="text-sm font-black text-slate-800 truncate group-hover:text-orange-600 transition-colors leading-tight"
                      >
                        {{ m.fname_th }}
                      </p>
                      <p class="text-[10px] text-slate-400 font-bold mt-0.5">
                        ID: {{ m.id }}
                        <span
                          v-if="m.id === targetTeam.hostId"
                          class="ml-2 text-orange-500"
                          >★ เจ้าของทีม</span
                        >
                      </p>
                    </div>
                  </div>
                  <button
                    @click.stop="handleKick(targetTeam.id, m.id)"
                    v-if="m.id !== targetTeam.hostId"
                    class="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                  >
                    <LogOut :size="18" />
                  </button>
                </div>
                <div
                  v-if="filteredCurrentMembers.length === 0"
                  class="py-12 text-center bg-white rounded-3xl border border-dashed border-slate-200"
                >
                  <p class="text-slate-400 font-bold italic text-xs">
                    ไม่พบรายชื่อสมาชิก
                  </p>
                </div>
              </div>
              <!-- Bulk Removal Button -->
              <transition name="fade">
                <button
                  v-if="selectedCurrentMembers.length > 0"
                  @click="handleBulkKickMembers"
                  :disabled="submitting"
                  class="w-full py-4 bg-rose-50 text-rose-600 border border-rose-100 rounded-2xl text-sm font-black hover:bg-rose-100 transition-all flex items-center justify-center gap-3"
                >
                  <Loader2 v-if="submitting" :size="20" class="animate-spin" />
                  <Trash2 v-else :size="20" />
                  คัดออกจาก {{ selectedCurrentMembers.length }} สมาชิกที่เลือก
                </button>
              </transition>
            </div>
            <!-- Section 2: Add New Members -->
            <div class="pt-6 border-t border-slate-100 space-y-4">
              <div class="flex items-center justify-between px-1">
                <p
                  class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest"
                >
                  สั่งให้เข้าร่วมกิจกรรมใหม่ (เพิ่มสมาชิกเข้าทีม)
                </p>
                <button
                  v-if="filteredAllUsers.length > 0"
                  @click="toggleSelectAllAvailableUsers"
                  class="flex items-center gap-2 group"
                >
                  <div class="flex flex-col items-end">
                    <span
                      class="text-[10px] font-black text-slate-400 group-hover:text-orange-600 transition-colors uppercase"
                      >เลือกทั้งหมด</span
                    >
                    <span
                      v-if="selectedAvailableUsers.length > 0"
                      class="text-[9px] font-bold text-blue-500"
                      >เลือกแล้ว {{ selectedAvailableUsers.length }} คน</span
                    >
                  </div>
                  <div
                    class="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all"
                    :class="
                      isAllAvailableUsersSelected
                        ? 'bg-orange-500 border-orange-500'
                        : 'bg-white border-slate-200 group-hover:border-slate-300'
                    "
                  >
                    <Check
                      v-if="isAllAvailableUsersSelected"
                      :size="12"
                      class="text-white"
                      stroke-width="4"
                    />
                  </div>
                </button>
              </div>
              <!-- Search Input -->
              <div class="relative group">
                <Search
                  :size="16"
                  class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors"
                />
                <input
                  v-model="allUsersSearchQuery"
                  type="text"
                  placeholder="ค้นหาชื่อผู้ใช้งานเพื่อเพิ่มเข้าทีม..."
                  class="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs focus:border-orange-500 transition-all outline-none font-bold"
                />
              </div>
              <div
                class="flex flex-col gap-2 max-h-60 overflow-y-auto custom-scrollbar pr-1 py-1"
              >
                <div
                  v-for="u in filteredAllUsers"
                  :key="u.id"
                  @click="
                    selectedAvailableUsers.includes(u.id)
                      ? (selectedAvailableUsers = selectedAvailableUsers.filter(
                          (id) => id !== u.id,
                        ))
                      : selectedAvailableUsers.push(u.id)
                  "
                  class="group flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-2xl hover:border-blue-200 transition-all cursor-pointer"
                  :class="{
                    'bg-blue-50/30 border-blue-200':
                      selectedAvailableUsers.includes(u.id),
                  }"
                >
                  <div
                    class="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                    :class="
                      selectedAvailableUsers.includes(u.id)
                        ? 'bg-blue-500 border-blue-500'
                        : 'bg-white border-slate-200 group-hover:border-blue-300'
                    "
                  >
                    <Check
                      v-if="selectedAvailableUsers.includes(u.id)"
                      :size="14"
                      class="text-white"
                      stroke-width="4"
                    />
                  </div>
                  <img
                    :src="
                      u.picture_url ||
                      u.avatar ||
                      'https://ui-avatars.com/api/?name=' + u.fname_th
                    "
                    class="w-10 h-10 rounded-full border border-slate-100 object-cover shrink-0"
                  />
                  <div class="flex-1 min-w-0">
                    <p
                      class="text-sm font-bold text-slate-700 truncate group-hover:text-blue-600 transition-colors leading-tight"
                    >
                      {{ u.fname_th }}
                    </p>
                    <p class="text-[10px] text-slate-400 font-bold mt-0.5">
                      ID: {{ u.id }}
                      <span
                        v-if="u.team_name"
                        class="ml-2 px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded-md uppercase text-[8px]"
                        >IN: {{ u.team_name }}</span
                      >
                    </p>
                  </div>
                </div>
                <p
                  v-if="filteredAllUsers.length === 0"
                  class="text-center py-10 text-xs text-slate-400 font-bold italic bg-white rounded-2xl border border-dashed border-slate-200"
                >
                  ไม่พบผู้ใช้ที่ต้องการเพิ่ม
                </p>
              </div>
              <!-- Confirm Bulk Add Button -->
              <transition name="fade">
                <button
                  v-if="selectedAvailableUsers.length > 0"
                  @click="handleBulkAddMembers"
                  :disabled="submitting"
                  class="w-full py-4 bg-orange-500 text-white rounded-2xl text-sm font-black hover:bg-orange-600 transition-all flex items-center justify-center gap-3 active:scale-95"
                >
                  <Loader2 v-if="submitting" :size="20" class="animate-spin" />
                  <Check v-else :size="20" stroke-width="3" />
                  {{
                    submitting
                      ? "กำลังดำเนินการ..."
                      : `ยืนยันย้ายเข้า (${selectedAvailableUsers.length} คน)`
                  }}
                </button>
              </transition>
            </div>
          </div>
          <!-- Footer -->
          <div class="p-6 bg-white border-t border-slate-100">
            <button
              @click="closeModal"
              class="w-full py-4 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all active:scale-95"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap");
.font-sarabun {
  font-family: "Sarabun", sans-serif;
}
.font-sarabun input,
.font-sarabun select,
.font-sarabun button,
.font-sarabun textarea {
  font-family: "Sarabun", sans-serif;
}
/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
@keyframes zoomIn {
  from {
    opacity: 0;
    transform: scale(0.98);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
.animate-in {
  animation: zoomIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
/* ─── Search Pill ─── */
.search-pill-container {
  display: flex;
  align-items: center;
  background: white;
  padding: 0 20px;
  height: 48px;
  border-radius: 99px;
  border: 1.5px solid #e2e8f0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  gap: 12px;
}
.search-pill-container:focus-within {
  border-color: #f97316;
}
.search-icon {
  color: #9ca3af;
  flex-shrink: 0;
}
.btn-clear-search {
  background: #f3f4f6;
  border: none;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border-radius: 50%;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s;
}
.btn-clear-search:hover {
  background: #e5e7eb;
  color: #1e293b;
}
/* ─── Sticky Table Adjustments ─── */
@media (max-width: 768px) {
  table th,
  table td {
    padding: 12px 10px !important;
    font-size: 12px !important;
  }
  .sticky.left-0 {
    width: 45px !important;
    min-width: 45px !important;
    border-right: none !important;
  }
  .sticky.left-14 {
    left: 44px !important;
    min-width: 160px !important;
    max-width: 160px !important;
    border-left: none !important;
  }
  td.sticky.right-0 {
    width: 50px !important;
    min-width: 50px !important;
    box-shadow: none !important;
  }
}
/* Custom Scrollbar */
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
  height: 5px;
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
</style>
