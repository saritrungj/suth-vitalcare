<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import {
  Search,
  RefreshCw,
  Download,
  Users,
  Pencil,
  Trash2,
  Ban,
  ShieldCheck,
  LogOut,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronUp,
  ChevronDown,
  AlignJustify,
  AlignLeft,
  X,
  Save,
  Eye,
  EyeOff,
  AlertTriangle,
  Check,
  Plus,
  MonitorSmartphone,
  Clock,
  Calendar,
  UserPlus,
  Loader2,
  KeyRound,
} from "lucide-vue-next";
import { useRouter } from "vue-router";
import { useAdminUsers } from "../../composables/useAdminUsers";
import { authStore } from "../../store/auth";
import PointsBreakdownModal from "../common/PointsBreakdownModal.vue";
import Swal from "sweetalert2";
const router = useRouter();
// ดึงตัวแปรและฟังก์ชันทั้งหมดมาจาก Composable
const {
  roleTypes,
  schoolLevels,
  uniFaculties,
  uniYears,
  mainGoals,
  loadingUsers,
  mutate,
  selectedIds,
  filtered,
  counts,
  fmtDate,
  avatar,
  getInitialsAvatar,
  roleBadge,
  statusBadge,
  statusLabel,
  roleLabel,
  displayName,
  modal,
  target,
  editForm,
  editTanita,
  viewTanita,
  viewScoreTotal,
  showBreakdown,
  banReason,
  banType,
  submitting,
  openModal,
  closeModal,
  saveEdit,
  resetPassword,
  confirmBan,
  unban,
  kick,
  deleteUser,
  bulkBan,
  bulkDelete,
  exportCSV,
  allActivities,
  userRegistrations,
  fetchUserRegistrations,
  loadingRegistrations,
  adminEnroll,
  adminKick,
  bulkEnroll,
  showConfirm,
  showSuccess,
  showError,
  formatPhone,
} = useAdminUsers();
// --- 🌟 Local State สำหรับจัดการ Table แบบ Native ---
const localSearchQuery = ref("");
const dtSortKey = ref("created_at");
const dtSortDir = ref("desc");
const dtCurrentPage = ref(1);
const dtPerPage = ref(10); // ปรับเป็น 10 รายการต่อหน้า
const clearSearch = () => {
  localSearchQuery.value = "";
};
// --- Process Data (Search & Sort) ---
const processedUsers = computed(() => {
  let list = [...(filtered.value || [])];
  // Search
  if (localSearchQuery.value) {
    const q = localSearchQuery.value.toLowerCase();
    list = list.filter(
      (u) =>
        String(u.id).includes(q) ||
        (u.fname_th || "").toLowerCase().includes(q) ||
        (u.lname_th || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.phone || "").toLowerCase().includes(q),
    );
  }
  // Sort
  list.sort((a: any, b: any) => {
    let valA = a[dtSortKey.value];
    let valB = b[dtSortKey.value];
    // พิเศษ: ถ้าเป็นชื่อ ให้เอาชื่อจริง+นามสกุลมาต่อกันก่อนเรียง
    if (dtSortKey.value === "fname_th") {
      valA = `${a.fname_th} ${a.lname_th}`;
      valB = `${b.fname_th} ${b.lname_th}`;
    }
    if (valA == null) valA = typeof valB === "number" ? 0 : "";
    if (valB == null) valB = typeof valA === "number" ? 0 : "";
    if (typeof valA === "string") valA = valA.toLowerCase();
    if (typeof valB === "string") valB = valB.toLowerCase();
    if (valA < valB) return dtSortDir.value === "asc" ? -1 : 1;
    if (valA > valB) return dtSortDir.value === "asc" ? 1 : -1;
    return b.id - a.id;
  });
  return list;
});
// --- Pagination ---
const totalPages = computed(() =>
  Math.ceil(processedUsers.value.length / dtPerPage.value),
);
const paginatedUsers = computed(() => {
  const start = (dtCurrentPage.value - 1) * dtPerPage.value;
  return processedUsers.value.slice(start, start + dtPerPage.value);
});
const setPage = (p: number) => {
  if (p >= 1 && p <= totalPages.value) {
    dtCurrentPage.value = p;
    const viewport = document.querySelector(".content-viewport");
    if (viewport) viewport.scrollTo({ top: 0, behavior: "smooth" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }
};
const toggleDtSort = (key: string) => {
  if (dtSortKey.value === key) {
    dtSortDir.value = dtSortDir.value === "asc" ? "desc" : "asc";
  } else {
    dtSortKey.value = key;
    // ถ้าเป็นจำนวนกิจกรรม หรือวันที่สมัคร ให้เริ่มที่ มากไปน้อย (desc) ก่อนเลย
    if (["registrations_count", "created_at"].includes(key)) {
      dtSortDir.value = "desc";
    } else {
      dtSortDir.value = "asc";
    }
  }
};
watch(localSearchQuery, () => {
  dtCurrentPage.value = 1;
});
const visiblePages = computed(() => {
  const current = dtCurrentPage.value;
  const total = totalPages.value;
  const delta = 2; // จำนวนหน้าที่ต้องการแสดงรอบๆ หน้าปัจจุบัน
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
// --- Selection Logic ---
const isAllSelected = computed(
  () =>
    paginatedUsers.value.length > 0 &&
    paginatedUsers.value.every((u) => selectedIds.value.includes(u.id)),
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
      (id) => !paginatedUsers.value.some((u) => u.id === id),
    );
  } else {
    const newIds = [...selectedIds.value];
    paginatedUsers.value.forEach((u) => {
      if (!newIds.includes(u.id)) newIds.push(u.id);
    });
    selectedIds.value = newIds;
  }
};
// --- Custom Dropdowns Management ---
const activeDropdown = ref<string | null>(null);
const toggleDropdown = (name: string) => {
  activeDropdown.value = activeDropdown.value === name ? null : name;
};
const closeAllDropdowns = () => {
  activeDropdown.value = null;
  localActiveMenuId.value = null;
};
onMounted(() => {
  const handleGlobalClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    // Close 3-dots menu
    if (localActiveMenuId.value && !target.closest(".action-menu-wrapper")) {
      localActiveMenuId.value = null;
    }
    // Close custom dropdowns
    if (activeDropdown.value && !target.closest(".custom-select-container")) {
      activeDropdown.value = null;
    }
    // Close bulk enroll menu
    if (showBulkEnrollMenu.value && !target.closest(".bulk-enroll-container")) {
      showBulkEnrollMenu.value = false;
    }
  };
  window.addEventListener("click", handleGlobalClick);
});
// --- Custom Popup Menu (3 Dots) ---
const localActiveMenuId = ref<number | null>(null);
const localMenuPos = ref({ top: 0, right: 0, transform: "none" });
const toggleMenu = (id: number, event?: MouseEvent) => {
  if (localActiveMenuId.value === id) {
    localActiveMenuId.value = null;
    return;
  }
  localActiveMenuId.value = id;
  if (event) {
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    const menuHeight = 250;
    const spaceBelow = window.innerHeight - rect.bottom;
    const right = Math.max(8, window.innerWidth - rect.right);
    if (spaceBelow < menuHeight && rect.top > menuHeight) {
      localMenuPos.value = {
        top: rect.top - menuHeight - 4,
        right,
        transform: "none",
      };
    } else {
      localMenuPos.value = {
        top: Math.min(rect.bottom + 4, window.innerHeight - menuHeight - 8),
        right,
        transform: "none",
      };
    }
  }
};
const activeMenuUser = computed(
  () =>
    paginatedUsers.value.find((u) => u.id === localActiveMenuId.value) || null,
);
const quickAddUser = async () => {
  try {
    const { value: amount } = await Swal.fire({
      title: "สร้างผู้ใช้งานแบบรวดเร็ว",
      text: "ระบุจำนวนบัญชีที่ต้องการสร้าง (ระบบจะสุ่มอีเมลและตั้งรหัสผ่านเป็น 123456789)",
      input: "number",
      inputValue: 1,
      inputAttributes: {
        min: "1",
        max: "100",
        step: "1",
      },
      showCancelButton: true,
      confirmButtonText: "ยืนยันสร้าง",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#f97316",
      inputValidator: (value) => {
        if (!value || parseInt(value) <= 0) {
          return "กรุณาระบุจำนวนที่มากกว่า 0";
        }
      },
    });
    if (amount) {
      const numToCreate = parseInt(amount);
      const API_URL = import.meta.env.VITE_API_URL || "/api";
      Swal.fire({
        title: "กำลังสร้างบัญชี...",
        text: `โปรดรอสักครู่ ระบบกำลังสร้าง ${numToCreate} บัญชี`,
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });
      let successCount = 0;
      let createdEmails: string[] = [];
      for (let i = 0; i < numToCreate; i++) {
        const randomValue = crypto.getRandomValues(new Uint32Array(1))[0];
        const randId = 10000 + (randomValue % 90000);
        const genEmail = `VitalCare${randId}@gmail.com`;
        const genPassword = `${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}A1!`;
        const res = await fetch(`${API_URL}/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: genEmail,
            password: genPassword,
            fname_th: "VitalCare",
            lname_th: `User ${randId}`,
            role: "user",
            send_email: false,
          }),
        });
        if (res.ok) {
          successCount++;
          createdEmails.push(`${genEmail} — ${genPassword}`);
        }
      }
      mutate(); // Reload data
      if (successCount > 0) {
        Swal.fire({
          icon: "success",
          title: "สร้างสำเร็จ!",
          html: `สร้างบัญชีสำเร็จ <b>${successCount}</b> บัญชี<br><br><div class="max-h-40 overflow-y-auto text-sm text-left bg-slate-50 p-3 rounded-lg border border-slate-200 tracking-tight text-slate-700">${createdEmails.join("<br>")}</div>`,
          confirmButtonColor: "#f97316",
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "เกิดข้อผิดพลาด",
          text: "ไม่สามารถสร้างผู้ใช้งานได้เลย",
          confirmButtonColor: "#f97316",
        });
      }
    }
  } catch (err: any) {
    Swal.fire({
      icon: "error",
      title: "เกิดข้อผิดพลาด",
      text: err.message,
      confirmButtonColor: "#f97316",
    });
  }
};
const showBulkEnrollMenu = ref(false);
const toggleBulkEnroll = () => {
  showBulkEnrollMenu.value = !showBulkEnrollMenu.value;
};
const selectedBulkActivities = ref<number[]>([]);
const toggleBulkAct = (id: number) => {
  if (selectedBulkActivities.value.includes(id)) {
    selectedBulkActivities.value = selectedBulkActivities.value.filter(
      (i) => i !== id,
    );
  } else {
    selectedBulkActivities.value.push(id);
  }
};
const handleBulkEnrollConfirm = async () => {
  if (selectedBulkActivities.value.length === 0) return;
  await bulkEnroll(selectedBulkActivities.value);
  showBulkEnrollMenu.value = false;
  selectedBulkActivities.value = [];
};
const selectedSingleActivities = ref<number[]>([]);
const toggleSingleAct = (id: number) => {
  if (selectedSingleActivities.value.includes(id)) {
    selectedSingleActivities.value = selectedSingleActivities.value.filter(
      (i) => i !== id,
    );
  } else {
    selectedSingleActivities.value.push(id);
  }
};
const handleSingleEnrollConfirm = async () => {
  if (selectedSingleActivities.value.length === 0) return;
  for (const actId of selectedSingleActivities.value) {
    await adminEnroll(actId);
  }
  selectedSingleActivities.value = [];
};
// --- Activity Enrollment Logic ---
const singleActSearch = ref("");
const filteredActivities = computed(() => {
  const query = singleActSearch.value.toLowerCase().trim();
  // Filter out activities that the user has already joined (using r.id because it's an event object)
  const available = allActivities.value.filter(
    (a) => !userRegistrations.value.some((r) => r.id === a.id),
  );
  if (!query) return available;
  return available.filter((a) => a.title.toLowerCase().includes(query));
});
const isAllSingleSelected = computed(() => {
  const current = filteredActivities.value;
  return (
    current.length > 0 &&
    current.every((a) => selectedSingleActivities.value.includes(a.id))
  );
});
const toggleSelectAllSingle = () => {
  if (isAllSingleSelected.value) {
    selectedSingleActivities.value = [];
  } else {
    selectedSingleActivities.value = filteredActivities.value.map((a) => a.id);
  }
};
// --- Bulk Activity Enrollment Logic ---
const bulkActSearch = ref("");
const filteredBulkActivities = computed(() => {
  const query = bulkActSearch.value.toLowerCase().trim();
  const available = allActivities.value || [];
  if (!query) return available;
  return available.filter((a) => a.title.toLowerCase().includes(query));
});
const isAllBulkSelected = computed(() => {
  const current = filteredBulkActivities.value;
  return (
    current.length > 0 &&
    current.every((a) => selectedBulkActivities.value.includes(a.id))
  );
});
const toggleSelectAllBulk = () => {
  if (isAllBulkSelected.value) {
    selectedBulkActivities.value = [];
  } else {
    selectedBulkActivities.value = filteredBulkActivities.value.map(
      (a) => a.id,
    );
  }
};
// --- Current Registrations Logic ---
const currentActSearch = ref("");
const selectedCurrentActivities = ref<number[]>([]);
const filteredCurrentActivities = computed(() => {
  const query = currentActSearch.value.toLowerCase().trim();
  if (!query) return userRegistrations.value;
  return userRegistrations.value.filter((reg) =>
    reg.title.toLowerCase().includes(query),
  );
});
const isAllCurrentSelected = computed(() => {
  const current = filteredCurrentActivities.value;
  return (
    current.length > 0 &&
    current.every((reg) => selectedCurrentActivities.value.includes(reg.id))
  );
});
const toggleSelectAllCurrent = () => {
  if (isAllCurrentSelected.value) {
    selectedCurrentActivities.value = [];
  } else {
    selectedCurrentActivities.value = filteredCurrentActivities.value.map(
      (reg) => reg.id,
    );
  }
};
const handleBulkLeaveConfirm = async () => {
  if (selectedCurrentActivities.value.length === 0 || !target.value) return;
  const ok = await showConfirm(
    `คุณต้องการคัดชื่อออกจาก ${selectedCurrentActivities.value.length} กิจกรรมที่เลือก ใช่หรือไม่?`,
  );
  if (!ok) return;
  submitting.value = true;
  try {
    const userId = target.value.id;
    // Process bulk removal in one request
    const r = await fetch("/api/activities/admin/kick-bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": String(authStore.user?.id),
      },
      body: JSON.stringify({
        userId,
        eventIds: selectedCurrentActivities.value,
      }),
    });
    if (!r.ok) throw new Error("การดำเนินการไม่สำเร็จ");
    showSuccess(
      `คัดชื่อออกจาก ${selectedCurrentActivities.value.length} กิจกรรมเรียบร้อยแล้ว`,
    );
    selectedCurrentActivities.value = [];
    // Refresh the list once
    fetchUserRegistrations(userId);
  } catch (e: any) {
    showError(e.message || "เกิดข้อผิดพลาดในการดำเนินการ");
  } finally {
    submitting.value = false;
  }
};
</script>
<template>
  <div class="font-sarabun bg-white min-h-screen w-full relative pb-24">
    <div
      class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-in"
    >
      <div
        class="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        <div class="flex items-center gap-2 sm:gap-4 w-full">
          <div class="search-pill-container flex-1 min-w-0 w-full">
            <Search class="search-icon flex-shrink-0" :size="18" />
            <input
              v-model="localSearchQuery"
              type="text"
              placeholder="ค้นหาชื่อ, อีเมล, โทรศัพท์, หรือ ID..."
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
          แสดง {{ paginatedUsers.length }} / {{ processedUsers.length }} รายการ
        </p>
      </div>
      <div v-if="loadingUsers" class="space-y-4">
        <div
          v-for="i in 5"
          :key="i"
          class="h-16 bg-white border border-slate-100 animate-pulse rounded-2xl"
        ></div>
      </div>
      <div
        v-else-if="processedUsers.length === 0"
        class="py-24 text-center bg-white rounded-3xl border border-dashed border-slate-300 flex flex-col items-center justify-center"
      >
        <div
          class="w-20 h-20 bg-white border border-slate-100 rounded-full flex items-center justify-center mb-5"
        >
          <Search :size="32" class="text-slate-300" />
        </div>
        <p class="text-slate-800 font-bold text-xl mb-2">
          ไม่พบข้อมูลผู้ใช้งาน
        </p>
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
                  class="p-4 min-w-[240px] cursor-pointer transition-colors group sticky left-14 bg-white z-20 border-r border-slate-100"
                  @click="toggleDtSort('fname_th')"
                >
                  <div class="flex items-center gap-2 flex-nowrap">
                    <span
                      class="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest group-hover:text-orange-500 transition-colors whitespace-nowrap"
                      >ข้อมูลผู้ใช้งาน</span
                    >
                    <ChevronUp
                      v-if="dtSortKey === 'fname_th' && dtSortDir === 'asc'"
                      :size="14"
                      class="text-orange-500 shrink-0"
                    />
                    <ChevronDown
                      v-else-if="
                        dtSortKey === 'fname_th' && dtSortDir === 'desc'
                      "
                      :size="14"
                      class="text-orange-500 shrink-0"
                    />
                    <ArrowUpDown
                      v-else
                      :size="12"
                      class="text-slate-200 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    />
                  </div>
                </th>
                <th
                  class="p-4 min-w-[180px] cursor-pointer transition-colors group hidden lg:table-cell"
                  @click="toggleDtSort('email')"
                >
                  <div class="flex items-center gap-2 flex-nowrap">
                    <span
                      class="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest group-hover:text-orange-500 transition-colors whitespace-nowrap"
                      >ข้อมูลติดต่อ</span
                    >
                    <ChevronUp
                      v-if="dtSortKey === 'email' && dtSortDir === 'asc'"
                      :size="14"
                      class="text-orange-500 shrink-0"
                    />
                    <ChevronDown
                      v-else-if="dtSortKey === 'email' && dtSortDir === 'desc'"
                      :size="14"
                      class="text-orange-500 shrink-0"
                    />
                    <ArrowUpDown
                      v-else
                      :size="12"
                      class="text-slate-200 opacity-0 group-hover:opacity-100 shrink-0"
                    />
                  </div>
                </th>
                <th
                  class="p-4 min-w-[80px] text-center cursor-pointer transition-colors group hidden sm:table-cell"
                  @click="toggleDtSort('role')"
                >
                  <div
                    class="flex items-center justify-center gap-2 flex-nowrap"
                  >
                    <span
                      class="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest group-hover:text-orange-500 whitespace-nowrap"
                      >สิทธิ์</span
                    >
                    <ChevronUp
                      v-if="dtSortKey === 'role' && dtSortDir === 'asc'"
                      :size="14"
                      class="text-orange-500 shrink-0"
                    />
                    <ChevronDown
                      v-else-if="dtSortKey === 'role' && dtSortDir === 'desc'"
                      :size="14"
                      class="text-orange-500 shrink-0"
                    />
                  </div>
                </th>
                <th
                  class="p-4 min-w-[80px] text-center cursor-pointer transition-colors group hidden sm:table-cell"
                  @click="toggleDtSort('is_suspended')"
                >
                  <div
                    class="flex items-center justify-center gap-2 flex-nowrap"
                  >
                    <span
                      class="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest group-hover:text-orange-500 whitespace-nowrap"
                      >สถานะ</span
                    >
                    <ChevronUp
                      v-if="dtSortKey === 'is_suspended' && dtSortDir === 'asc'"
                      :size="14"
                      class="text-orange-500 shrink-0"
                    />
                    <ChevronDown
                      v-else-if="
                        dtSortKey === 'is_suspended' && dtSortDir === 'desc'
                      "
                      :size="14"
                      class="text-orange-500 shrink-0"
                    />
                  </div>
                </th>
                <th
                  class="p-4 min-w-[150px] text-center cursor-pointer transition-colors group hidden md:table-cell"
                  @click="toggleDtSort('registrations_count')"
                >
                  <div
                    class="flex items-center justify-center gap-2 flex-nowrap"
                  >
                    <span
                      class="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest group-hover:text-orange-500 whitespace-nowrap"
                      >กิจกรรมที่ร่วม</span
                    >
                    <ChevronUp
                      v-if="
                        dtSortKey === 'registrations_count' &&
                        dtSortDir === 'asc'
                      "
                      :size="14"
                      class="text-orange-500 shrink-0"
                    />
                    <ChevronDown
                      v-else-if="
                        dtSortKey === 'registrations_count' &&
                        dtSortDir === 'desc'
                      "
                      :size="14"
                      class="text-orange-500 shrink-0"
                    />
                    <ArrowUpDown
                      v-else
                      :size="12"
                      class="text-slate-200 opacity-0 group-hover:opacity-100 shrink-0"
                    />
                  </div>
                </th>
                <th
                  class="p-4 min-w-[140px] cursor-pointer transition-colors group hidden lg:table-cell"
                  @click="toggleDtSort('created_at')"
                >
                  <div class="flex items-center gap-2 flex-nowrap">
                    <span
                      class="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest group-hover:text-orange-500 transition-colors whitespace-nowrap"
                      >วันที่สมัคร</span
                    >
                    <ChevronUp
                      v-if="dtSortKey === 'created_at' && dtSortDir === 'asc'"
                      :size="14"
                      class="text-orange-500 shrink-0"
                    />
                    <ChevronDown
                      v-else-if="
                        dtSortKey === 'created_at' && dtSortDir === 'desc'
                      "
                      :size="14"
                      class="text-orange-500 shrink-0"
                    />
                    <ArrowUpDown
                      v-else
                      :size="12"
                      class="text-slate-200 opacity-0 group-hover:opacity-100 shrink-0"
                    />
                  </div>
                </th>
                <th
                  class="p-4 w-20 text-center sticky right-0 bg-white z-20 border-l border-slate-100"
                >
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="u in paginatedUsers"
                :key="u.id"
                class="transition-colors group"
              >
                <td
                  class="p-4 text-center border-r border-slate-50 sticky left-0 bg-white transition-colors z-10"
                >
                  <div
                    @click.stop="toggleOne(u.id)"
                    class="w-5 h-5 mx-auto rounded-full border-2 flex items-center justify-center cursor-pointer transition-all"
                    :class="
                      selectedIds.includes(u.id)
                        ? 'bg-orange-500 border-orange-500'
                        : 'bg-white border-slate-300'
                    "
                  >
                    <Check
                      v-if="selectedIds.includes(u.id)"
                      :size="12"
                      class="text-white"
                      stroke-width="4"
                    />
                  </div>
                </td>
                <td
                  class="p-4 sticky left-14 bg-white transition-colors z-10 border-r border-slate-50 max-w-[240px]"
                >
                  <div class="flex items-center gap-3">
                    <img
                      :src="avatar(u)"
                      class="w-10 h-10 rounded-full border border-slate-200 object-cover bg-white shrink-0"
                      @error="($event.target as any).src = getInitialsAvatar(u)"
                    />
                    <div
                      class="flex flex-col min-w-0 leading-tight gap-0.5 flex-1"
                    >
                      <p
                        class="font-bold text-slate-900 text-[13px] truncate group-hover:text-orange-600 transition-colors cursor-pointer"
                        @click="openModal('view', u)"
                        :title="displayName(u)"
                      >
                        {{ displayName(u) }}
                      </p>
                      <p
                        v-if="u.nickname"
                        class="text-xs text-slate-400 truncate"
                        :title="'@' + u.nickname"
                      >
                        @{{ u.nickname }}
                      </p>
                    </div>
                  </div>
                </td>
                <td
                  class="p-4 hidden lg:table-cell"
                  :class="{
                    'max-w-[200px]': u.email || u.phone,
                    'text-center': !(u.email || u.phone),
                  }"
                >
                  <div
                    v-if="u.email || u.phone"
                    class="flex flex-col text-[12px] text-slate-600 min-w-0 gap-0.5 text-left"
                  >
                    <div
                      v-if="u.email"
                      class="flex items-center gap-1.5 truncate"
                      :title="u.email"
                    >
                      <span class="truncate">{{ u.email }}</span>
                    </div>
                    <div
                      v-if="u.phone"
                      class="flex items-center gap-1.5 truncate text-slate-500"
                      :title="formatPhone(u.phone)"
                    >
                      <span class="text-[10px] shrink-0">📞</span>
                      <span class="truncate">{{ formatPhone(u.phone) }}</span>
                    </div>
                  </div>
                  <div
                    v-else
                    class="flex items-center justify-center w-full text-[12px] text-slate-400 italic"
                  >
                    ไม่มีข้อมูล
                  </div>
                </td>
                <td class="p-4 text-center hidden sm:table-cell">
                  <span
                    class="border text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider inline-block"
                    :class="roleBadge(u.role)"
                  >
                    {{ roleLabel(u) }}
                  </span>
                </td>
                <td class="p-4 text-center hidden sm:table-cell">
                  <span
                    class="border text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider inline-block"
                    :class="statusBadge(u)"
                  >
                    {{ statusLabel(u) }}
                  </span>
                </td>
                <td class="p-4 text-center hidden md:table-cell">
                  <div class="inline-flex flex-col items-center leading-none">
                    <span class="text-lg font-black text-slate-800">{{
                      u.registrations_count || 0
                    }}</span>
                    <span
                      class="text-[9px] font-bold text-slate-400 uppercase tracking-tighter"
                      >กิจกรรม</span
                    >
                  </div>
                </td>
                <td class="p-4 hidden lg:table-cell">
                  <span
                    class="text-[11px] font-medium text-slate-500 flex items-center gap-1.5"
                  >
                    {{ fmtDate(u.created_at) }}
                  </span>
                </td>
                <td
                  class="p-4 text-center sticky right-0 bg-white transition-colors z-10 border-l border-slate-50"
                >
                  <button
                    @click.stop="toggleMenu(u.id, $event)"
                    class="w-10 h-10 mx-auto flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all action-menu-wrapper"
                    :class="{
                      'bg-slate-50 text-slate-700': localActiveMenuId === u.id,
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
      <div
        v-if="totalPages > 1"
        class="flex items-center justify-center gap-2 pt-4 pb-4"
      >
        <button
          @click="setPage(dtCurrentPage - 1)"
          :disabled="dtCurrentPage === 1"
          class="rounded-full border border-slate-200 bg-white text-slate-500 hover:text-orange-500 hover:border-orange-500 disabled:opacity-30 disabled:hover:text-slate-500 disabled:hover:border-slate-200 transition-all flex items-center justify-center flex-shrink-0"
          style="
            width: 40px;
            height: 40px;
            min-width: 40px;
            min-height: 40px;
            padding: 0;
          "
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
            style="
              width: 40px;
              height: 40px;
              min-width: 40px;
              min-height: 40px;
              padding: 0;
            "
            :disabled="typeof p !== 'number'"
          >
            {{ p }}
          </button>
        </div>
        <button
          @click="setPage(dtCurrentPage + 1)"
          :disabled="dtCurrentPage === totalPages"
          class="rounded-full border border-slate-200 bg-white text-slate-500 hover:text-orange-500 hover:border-orange-500 disabled:opacity-30 disabled:hover:text-slate-500 disabled:hover:border-slate-200 transition-all flex items-center justify-center flex-shrink-0"
          style="
            width: 40px;
            height: 40px;
            min-width: 40px;
            min-height: 40px;
            padding: 0;
          "
        >
          <ChevronRight :size="18" />
        </button>
      </div>
      <div class="h-32"></div>
      <!-- Space for dropdown menus and floating action bar -->
    </div>
    <!-- Persistent Bottom Actions Bar -->
    <div
      class="fixed bottom-0 right-0 z-[40] flex items-center justify-end gap-3 p-4 sm:p-6"
      :style="{
        left: selectedIds.length > 0 ? 'var(--sidebar-width, 0)' : 'auto',
      }"
    >
      <!-- Selection Mode -->
      <template v-if="selectedIds.length > 0">
        <div
          class="flex items-center gap-3 w-full justify-between bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl px-4 py-3 max-w-7xl mx-auto overflow-hidden"
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
          <!-- Right side actions, horizontally scrollable on small screens to prevent overflow -->
          <div
            class="flex items-center gap-2 overflow-x-auto custom-scrollbar no-scrollbar py-1"
            style="scrollbar-width: none"
          >
            <div class="relative bulk-enroll-container shrink-0">
              <button
                @click.stop="toggleBulkEnroll"
                :disabled="submitting"
                class="h-9 sm:h-10 px-3 sm:px-4 flex items-center justify-center gap-1.5 sm:gap-2 bg-white border border-slate-200 text-slate-700 text-xs sm:text-[13px] font-bold rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50"
                :class="{
                  'border-orange-500 ring-2 ring-orange-500/10':
                    showBulkEnrollMenu,
                }"
              >
                <UserPlus :size="16" />
                <span class="hidden sm:inline">ย้ายเข้ากิจกรรม</span
                ><span class="sm:hidden">ย้ายเข้า</span>
              </button>
              <!-- Bulk Enroll Dropdown -->
              <transition name="fade">
                <div
                  v-if="showBulkEnrollMenu"
                  class="absolute bottom-full right-0 mb-3 w-[280px] sm:w-80 bg-white border border-slate-200 rounded-3xl p-4 z-50 animate-in zoom-in-95 origin-bottom"
                >
                  <div class="flex items-center justify-between mb-4 px-1">
                    <div class="flex-1">
                      <p
                        class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest"
                      >
                        เลือกกิจกรรมปลายทาง
                      </p>
                      <p
                        class="text-[11px] text-orange-500 font-bold"
                        v-if="selectedBulkActivities.length > 0"
                      >
                        เลือกแล้ว {{ selectedBulkActivities.length }} กิจกรรม
                      </p>
                    </div>
                    <button
                      @click="toggleSelectAllBulk"
                      class="flex items-center gap-1.5 group mr-2"
                    >
                      <span
                        class="text-[10px] font-bold text-slate-400 group-hover:text-orange-600 transition-colors"
                        >ทั้งหมด</span
                      >
                      <div
                        class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                        :class="
                          isAllBulkSelected
                            ? 'bg-orange-500 border-orange-500'
                            : 'bg-white border-slate-200 group-hover:border-slate-300'
                        "
                      >
                        <Check
                          v-if="isAllBulkSelected"
                          :size="12"
                          class="text-white"
                          stroke-width="4"
                        />
                      </div>
                    </button>
                    <button
                      @click="showBulkEnrollMenu = false"
                      class="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                    >
                      <X :size="14" />
                    </button>
                  </div>
                  <div class="relative group mb-3">
                    <Search
                      :size="14"
                      class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors"
                    />
                    <input
                      v-model="bulkActSearch"
                      type="text"
                      placeholder="ค้นหาชื่อกิจกรรม..."
                      class="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-100 rounded-2xl text-xs focus:border-orange-500 transition-all outline-none"
                    />
                  </div>
                  <div
                    class="max-h-64 overflow-y-auto custom-scrollbar flex flex-col gap-1 mb-4"
                  >
                    <div
                      v-for="act in filteredBulkActivities"
                      :key="act.id"
                      @click="toggleBulkAct(act.id)"
                      class="flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer transition-all border border-transparent"
                      :class="
                        selectedBulkActivities.includes(act.id)
                          ? 'bg-orange-50 border-orange-100 text-orange-700'
                          : 'text-slate-600'
                      "
                    >
                      <div
                        class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                        :class="
                          selectedBulkActivities.includes(act.id)
                            ? 'bg-orange-500 border-orange-500'
                            : 'bg-white border-slate-200'
                        "
                      >
                        <Check
                          v-if="selectedBulkActivities.includes(act.id)"
                          :size="12"
                          class="text-white"
                          stroke-width="4"
                        />
                      </div>
                      <span class="text-sm font-bold truncate">{{
                        act.title
                      }}</span>
                    </div>
                  </div>
                  <button
                    @click="handleBulkEnrollConfirm"
                    :disabled="
                      selectedBulkActivities.length === 0 || submitting
                    "
                    class="w-full py-4 bg-orange-500 text-white rounded-2xl text-sm font-extrabold hover:bg-orange-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                  >
                    <Loader2
                      v-if="submitting"
                      :size="20"
                      class="animate-spin"
                    />
                    <Check v-else :size="20" stroke-width="3" />
                    {{
                      submitting ? "กำลังดำเนินการ..." : "ยืนยันย้ายเข้ากิจกรรม"
                    }}
                  </button>
                </div>
              </transition>
            </div>
            <button
              @click="bulkBan"
              :disabled="submitting"
              class="bg-amber-100 text-amber-700 border border-amber-200 px-3 h-9 sm:h-10 rounded-xl text-xs sm:text-[13px] font-bold flex items-center gap-1.5 sm:gap-2 hover:bg-amber-200 transition-all shrink-0 disabled:opacity-50"
            >
              <Loader2 v-if="submitting" :size="16" class="animate-spin" />
              <Ban v-else :size="16" />
              <span class="hidden lg:inline">{{
                submitting ? "กำลังดำเนินการ..." : "แบนที่เลือก"
              }}</span
              ><span class="lg:hidden">{{ submitting ? "..." : "แบน" }}</span>
            </button>
            <button
              @click="bulkDelete"
              :disabled="submitting"
              class="bg-rose-500 text-white px-3 sm:px-4 h-9 sm:h-10 rounded-xl text-xs sm:text-[13px] font-bold flex items-center gap-1.5 sm:gap-2 hover:bg-rose-600 transition-all shrink-0 disabled:opacity-50"
            >
              <Loader2 v-if="submitting" :size="16" class="animate-spin" />
              <Trash2 v-else :size="16" />
              <span class="hidden sm:inline">{{
                submitting ? "กำลังลบ..." : "ลบที่เลือก"
              }}</span
              ><span class="sm:hidden">{{ submitting ? "..." : "ลบ" }}</span>
            </button>
          </div>
        </div>
      </template>
      <!-- Default Mode (Add Button) -->
      <template v-else>
        <button
          @click="quickAddUser"
          class="bg-orange-500 text-white w-48 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-orange-600 shadow-none"
        >
          <Plus :size="20" stroke-width="3" />
          เพิ่มผู้ใช้งานด่วน
        </button>
      </template>
    </div>
    <Teleport to="body">
      <div v-if="localActiveMenuId !== null && activeMenuUser">
        <div
          @click="localActiveMenuId = null"
          class="fixed inset-0 z-[9998]"
        ></div>
        <div
          class="fixed z-[9999] w-56 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden transition-all duration-200 animate-in fade-in zoom-in-95"
          :style="{
            top: localMenuPos.top + 'px',
            right: localMenuPos.right + 'px',
            transform: localMenuPos.transform,
          }"
          @click.stop
        >
          <div class="overflow-y-auto max-h-[280px] custom-scrollbar py-2">
            <div class="px-4 py-2 mb-1 border-b border-slate-100">
              <p
                class="text-[10px] font-bold text-slate-400 uppercase tracking-wider"
              >
                จัดการข้อมูล
              </p>
            </div>
            <button
              @click="
                openModal('edit', activeMenuUser);
                localActiveMenuId = null;
              "
              class="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-orange-50 hover:text-orange-600 transition-colors flex items-center gap-3"
            >
              <div class="p-1.5 bg-slate-50 rounded-lg text-slate-500">
                <Pencil :size="16" />
              </div>
              แก้ไขข้อมูล
            </button>
            <button
              @click="
                openModal('view', activeMenuUser);
                localActiveMenuId = null;
              "
              class="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-orange-50 hover:text-orange-600 transition-colors flex items-center gap-3"
            >
              <div class="p-1.5 bg-slate-50 rounded-lg text-slate-500">
                <Eye :size="16" />
              </div>
              ดูรายละเอียด
            </button>
            <button
              @click="
                router.push('/admin/users/' + activeMenuUser.id);
                localActiveMenuId = null;
              "
              class="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-orange-50 hover:text-orange-600 transition-colors flex items-center gap-3"
            >
              <div class="p-1.5 bg-slate-50 rounded-lg text-slate-500">
                <Pencil :size="16" />
              </div>
              จัดการข้อมูลทั้งหมด
            </button>
            <button
              @click="
                openModal('enroll', activeMenuUser);
                localActiveMenuId = null;
              "
              class="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-orange-50 hover:text-orange-600 transition-colors flex items-center gap-3"
            >
              <div class="p-1.5 bg-slate-50 rounded-lg text-slate-500">
                <Calendar :size="16" />
              </div>
              การเข้าร่วมกิจกรรม
            </button>
            <button
              @click="
                kick(activeMenuUser);
                localActiveMenuId = null;
              "
              :disabled="submitting"
              class="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 transition-colors flex items-center gap-3 disabled:opacity-50"
            >
              <div class="p-1.5 bg-slate-50 rounded-lg text-slate-500">
                <Loader2 v-if="submitting" :size="16" class="animate-spin" />
                <LogOut v-else :size="16" />
              </div>
              {{ submitting ? "กำลังเตะ..." : "เตะออกระบบ" }}
            </button>
            <div class="px-4 py-2 mt-2 mb-1 border-b border-slate-100">
              <p
                class="text-[10px] font-bold text-slate-400 uppercase tracking-wider"
              >
                จัดการบัญชี
              </p>
            </div>
            <button
              v-if="activeMenuUser.is_suspended > 0"
              @click="
                unban(activeMenuUser);
                localActiveMenuId = null;
              "
              :disabled="submitting"
              class="w-full px-4 py-2.5 text-left text-sm font-bold text-emerald-600 hover:bg-emerald-50 transition-colors flex items-center gap-3 disabled:opacity-50"
            >
              <div class="p-1.5 bg-emerald-100/50 rounded-lg text-emerald-500">
                <Loader2 v-if="submitting" :size="16" class="animate-spin" />
                <ShieldCheck v-else :size="16" />
              </div>
              {{ submitting ? "กำลังเลิกแบน..." : "เลิกแบน" }}
            </button>
            <button
              v-else
              @click="
                openModal('ban', activeMenuUser);
                localActiveMenuId = null;
              "
              :disabled="submitting"
              class="w-full px-4 py-2.5 text-left text-sm font-bold text-amber-600 hover:bg-amber-50 transition-colors flex items-center gap-3 disabled:opacity-50"
            >
              <div class="p-1.5 bg-amber-100/50 rounded-lg text-amber-500">
                <Ban :size="16" />
              </div>
              แบน/ระงับ
            </button>
            <div class="h-px bg-slate-100 my-1 mx-4"></div>
            <button
              @click="
                deleteUser(activeMenuUser);
                localActiveMenuId = null;
              "
              :disabled="submitting"
              class="w-full px-4 py-2.5 text-left text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-3 disabled:opacity-50"
            >
              <div class="p-1.5 bg-rose-100/50 rounded-lg text-rose-500">
                <Loader2 v-if="submitting" :size="16" class="animate-spin" />
                <Trash2 v-else :size="16" />
              </div>
              {{ submitting ? "กำลังลบ..." : "ลบบัญชีถาวร" }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
    <teleport to="body">
      <transition name="fade">
        <div
          v-if="modal"
          class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 font-sarabun"
          @click.self="closeModal"
        >
          <!-- View Modal -->
          <div
            v-if="modal === 'view' && target"
            class="modal-window max-w-[650px]"
            style="animation: modalIn 0.2s ease"
          >
            <div class="modal-header">
              <h3
                class="font-bold text-slate-900 text-lg flex items-center gap-2"
              >
                <div class="p-2 bg-orange-50 rounded-xl">
                  <Eye :size="20" class="text-orange-500" />
                </div>
                รายละเอียดผู้ใช้งาน
              </h3>
              <button
                @click="closeModal"
                class="p-2 text-slate-400 hover:text-slate-700 rounded-full transition-colors"
              >
                <X :size="20" />
              </button>
            </div>
            <div
              class="modal-body flex flex-col gap-12 bg-white px-10 py-12 font-sarabun"
            >
              <!-- Profile Header Section -->
              <div
                class="flex items-center gap-8 pb-10 border-b border-slate-100"
              >
                <img
                  :src="avatar(target)"
                  class="w-28 h-28 rounded-full border border-slate-200 object-cover bg-white"
                  @error="
                    ($event.target as any).src = getInitialsAvatar(target)
                  "
                />
                <div class="flex flex-col gap-3">
                  <h4 class="text-3xl font-bold text-slate-900 tracking-tight">
                    {{ displayName(target) }}
                  </h4>
                  <div class="flex items-center gap-3">
                    <span
                      class="px-3 py-1 bg-white text-slate-600 rounded-lg text-xs font-bold border border-slate-200 uppercase tracking-wider"
                      >{{ roleLabel(target) }}</span
                    >
                    <span
                      class="px-3 py-1 rounded-lg text-xs font-bold border uppercase tracking-wider"
                      :class="statusBadge(target)"
                    >
                      สถานะ: {{ statusLabel(target) }}
                    </span>
                  </div>
                </div>
              </div>
              <!-- Section: Personal Info -->
              <div class="flex flex-col gap-8">
                <h5
                  class="text-base font-bold text-slate-800 flex items-center gap-3"
                >
                  <div class="w-1.5 h-6 bg-orange-500 rounded-full"></div>
                  ข้อมูลส่วนตัวพื้นฐาน
                </h5>
                <div
                  class="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-12 px-4"
                >
                  <div
                    v-for="field in [
                      { label: 'รหัสสมาชิก', val: '#' + target.id },
                      { label: 'รหัสประจำตัว', val: target.id_code },
                      { label: 'ชื่อเล่น / นามแฝง', val: target.nickname },
                      {
                        label: 'เพศกำเนิด',
                        val:
                          target.gender === 'male'
                            ? 'ชาย'
                            : target.gender === 'female'
                              ? 'หญิง'
                              : '',
                      },
                      {
                        label: 'วันเกิด',
                        val:
                          fmtDate(target.birth_date) === '—'
                            ? ''
                            : fmtDate(target.birth_date),
                      },
                    ]"
                    :key="field.label"
                    class="flex items-baseline gap-2"
                  >
                    <span
                      class="text-slate-700 text-[13px] font-bold flex-shrink-0"
                      >{{ field.label }}:</span
                    >
                    <span
                      :class="
                        field.val
                          ? 'text-slate-800 text-base'
                          : 'text-slate-300 italic text-base'
                      "
                      >{{ field.val || "ไม่ระบุ" }}</span
                    >
                  </div>
                </div>
              </div>
              <!-- Section: Contact Info -->
              <div class="flex flex-col gap-8">
                <h5
                  class="text-base font-bold text-slate-800 flex items-center gap-3"
                >
                  <div class="w-1.5 h-6 bg-slate-300 rounded-full"></div>
                  ข้อมูลการติดต่อ
                </h5>
                <div
                  class="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-12 px-4"
                >
                  <div
                    v-for="field in [
                      { label: 'LINE ID', val: target.line_id },
                      { label: 'อีเมล', val: target.email },
                      { label: 'โทรศัพท์', val: formatPhone(target.phone) },
                    ]"
                    :key="field.label"
                    class="flex items-baseline gap-2"
                  >
                    <span
                      class="text-slate-700 text-[13px] font-bold flex-shrink-0"
                      >{{ field.label }}:</span
                    >
                    <!-- 💡 แก้ไขตรงบรรทัดนี้: เพิ่มคลาส 'break-all' ลงไปใน class ฝั่ง text-slate-800 -->
                    <span
                      :class="
                        field.val
                          ? 'text-slate-800 text-base break-all'
                          : 'text-slate-300 italic text-base'
                      "
                    >
                      {{ field.val || "ไม่ระบุ" }}
                    </span>
                  </div>
                  <div class="sm:col-span-2 flex flex-col gap-2">
                    <span class="text-slate-700 text-[13px] font-bold"
                      >ที่อยู่ปัจจุบัน:</span
                    >
                    <span
                      :class="
                        target.address
                          ? 'text-slate-800 text-base leading-relaxed'
                          : 'text-slate-300 italic text-base px-2'
                      "
                      >{{ target.address || "ไม่ระบุ" }}</span
                    >
                  </div>
                </div>
              </div>
              <!-- Section: Health Goals -->
              <div class="flex flex-col gap-8">
                <h5
                  class="text-base font-bold text-slate-800 flex items-center gap-3"
                >
                  <div class="w-1.5 h-6 bg-slate-300 rounded-full"></div>
                  เป้าหมายและสุขภาพ
                </h5>
                <div
                  class="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-12 px-4"
                >
                  <div
                    v-for="field in [
                      { label: 'เป้าหมายหลัก', val: target.main_goal },
                      { label: 'โรคประจำตัว', val: target.underlying_disease },
                      {
                        label: 'น้ำหนัก (กก.)',
                        val: target.weight ? target.weight + ' กก.' : '',
                      },
                      {
                        label: 'ส่วนสูง (ซม.)',
                        val: target.height ? target.height + ' ซม.' : '',
                      },
                    ]"
                    :key="field.label"
                    class="flex items-baseline gap-2"
                  >
                    <span
                      class="text-slate-700 text-[13px] font-bold flex-shrink-0"
                      >{{ field.label }}:</span
                    >
                    <span
                      :class="
                        field.val
                          ? 'text-slate-800 text-base'
                          : 'text-slate-300 italic text-base'
                      "
                      >{{ field.val || "ไม่ระบุ" }}</span
                    >
                  </div>
                </div>
              </div>
              <!-- Section: System info -->
              <div class="flex flex-col gap-8">
                <h5
                  class="text-base font-bold text-slate-800 flex items-center gap-3"
                >
                  <div class="w-1.5 h-6 bg-slate-300 rounded-full"></div>
                  ข้อมูลกลุ่มและการใช้งานระบบ
                </h5>
                <div
                  class="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-12 px-4"
                >
                  <div
                    v-for="field in [
                      { label: 'กลุ่มผู้ใช้งาน', val: target.role_type },
                      {
                        label:
                          target.role_type === 'นักเรียน'
                            ? 'ระดับชั้น'
                            : target.role_type === 'นักศึกษา'
                              ? 'สำนักวิชา / ชั้นปี'
                              : 'ข้อมูลสังกัดเพิ่มเติม',
                        val:
                          target.role_detail_1 || target.role_detail_2
                            ? (target.role_detail_1 || '') +
                              (target.role_detail_2
                                ? ' ' + target.role_detail_2
                                : '')
                            : '',
                      },
                      {
                        label: 'วันที่เริ่มใช้งานระบบ',
                        val: fmtDate(target.created_at),
                      },
                    ]"
                    :key="field.label"
                    class="flex items-baseline gap-2"
                  >
                    <span
                      class="text-slate-700 text-[13px] font-bold flex-shrink-0"
                      >{{ field.label }}:</span
                    >
                    <span
                      :class="
                        field.val
                          ? 'text-slate-800 text-base'
                          : 'text-slate-300 italic text-base'
                      "
                      >{{ field.val || "ไม่ระบุ" }}</span
                    >
                  </div>
                  <div
                    class="sm:col-span-2 flex flex-wrap items-baseline gap-x-8 gap-y-3 pt-2"
                  >
                    <div class="flex items-baseline gap-2">
                      <span class="text-slate-700 text-[13px] font-bold"
                        >คะแนนสะสมรวม (กิจกรรม):</span
                      >
                      <button
                        @click="showBreakdown = true"
                        class="text-orange-600 text-base font-bold underline decoration-dotted underline-offset-4 hover:text-orange-700"
                      >
                        {{ viewScoreTotal.toLocaleString() }}
                      </button>
                    </div>
                    <div class="flex items-baseline gap-2">
                      <span class="text-slate-700 text-[13px] font-bold"
                        >แต้ม (Points) — ใช้ในร้านค้า:</span
                      >
                      <span class="text-slate-800 text-base">{{
                        target.points || 0
                      }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button
                @click="closeModal"
                class="flex-1 sm:flex-none px-6 py-3 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                ปิดหน้าต่าง
              </button>
              <button
                @click="openModal('edit', target)"
                class="flex-1 sm:flex-none px-8 py-3 text-sm font-bold text-white bg-orange-500 rounded-xl hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
              >
                <Pencil :size="18" /> แก้ไขข้อมูลผู้ใช้
              </button>
            </div>
          </div>
          <!-- Edit Modal -->
          <div
            v-if="modal === 'edit' && target"
            class="modal-window max-w-[650px]"
            style="animation: modalIn 0.2s ease"
          >
            <div class="modal-header">
              <h3
                class="font-bold text-slate-900 text-lg flex items-center gap-2"
              >
                <div class="p-2 bg-orange-50 rounded-xl">
                  <Pencil :size="20" class="text-orange-500" />
                </div>
                แก้ไขข้อมูลผู้ใช้งาน
                <span
                  class="bg-white text-slate-500 px-2.5 py-0.5 rounded-lg text-[10px] ml-2 border border-slate-200"
                  >#{{ target.id }}</span
                >
              </h3>
              <button
                @click="closeModal"
                class="p-2 text-slate-400 hover:text-slate-700 rounded-full transition-colors"
              >
                <X :size="20" />
              </button>
            </div>
            <div
              class="modal-body flex flex-col gap-12 bg-white px-10 py-12 font-sarabun"
            >
              <!-- Section: Personal Info -->
              <div class="flex flex-col gap-8">
                <h5
                  class="text-base font-bold text-slate-800 flex items-center gap-3"
                >
                  <div class="w-1.5 h-6 bg-orange-500 rounded-full"></div>
                  ข้อมูลส่วนตัวพื้นฐาน
                </h5>
                <div
                  class="grid grid-cols-1 sm:grid-cols-2 gap-y-8 gap-x-16 px-4"
                >
                  <div class="col-span-1">
                    <label
                      class="block text-[13px] font-bold text-slate-700 mb-2.5"
                      >ชื่อจริง</label
                    >
                    <input
                      v-model="editForm.fname_th"
                      class="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:border-orange-500 focus:ring-0 outline-none text-base text-slate-900 transition-all font-normal hover:border-slate-300"
                    />
                  </div>
                  <div class="col-span-1">
                    <label
                      class="block text-[13px] font-bold text-slate-700 mb-2.5"
                      >นามสกุล</label
                    >
                    <input
                      v-model="editForm.lname_th"
                      class="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:border-orange-500 focus:ring-0 outline-none text-base text-slate-900 transition-all font-normal hover:border-slate-300"
                    />
                  </div>
                  <div class="col-span-1">
                    <label
                      class="block text-[13px] font-bold text-slate-700 mb-2.5"
                      >ชื่อเล่น</label
                    >
                    <input
                      v-model="editForm.nickname"
                      class="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:border-orange-500 focus:ring-0 outline-none text-base text-slate-900 transition-all font-normal hover:border-slate-300"
                    />
                  </div>
                  <div class="col-span-1">
                    <label
                      class="block text-[13px] font-bold text-slate-700 mb-2.5"
                      >รหัสประจำตัว (ID Code)</label
                    >
                    <input
                      v-model="editForm.id_code"
                      class="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:border-orange-500 focus:ring-0 outline-none text-base text-slate-900 transition-all font-normal hover:border-slate-300"
                    />
                  </div>
                  <div class="col-span-1">
                    <label
                      class="block text-[13px] font-bold text-slate-700 mb-2.5"
                      >เพศกำเนิด</label
                    >
                    <div class="relative custom-select-container">
                      <button
                        @click.stop="toggleDropdown('gender')"
                        type="button"
                        class="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:border-orange-500 outline-none text-base text-slate-900 transition-all flex items-center justify-between hover:border-slate-300"
                        :class="{
                          'border-orange-500 ring-1 ring-orange-500/20':
                            activeDropdown === 'gender',
                        }"
                      >
                        <span :class="{ 'text-slate-400': !editForm.gender }">
                          {{
                            editForm.gender === "male"
                              ? "ชาย"
                              : editForm.gender === "female"
                                ? "หญิง"
                                : "-ไม่ระบุ-"
                          }}
                        </span>
                        <ChevronDown
                          :size="18"
                          class="text-slate-400 transition-transform duration-200"
                          :class="{ 'rotate-180': activeDropdown === 'gender' }"
                        />
                      </button>
                      <transition name="fade">
                        <div
                          v-if="activeDropdown === 'gender'"
                          class="absolute z-[100] mt-2 w-full bg-white border border-slate-100 rounded-2xl shadow-xl py-2 animate-in fade-in zoom-in-95"
                        >
                          <button
                            v-for="opt in [
                              { v: '', l: '-ไม่ระบุ-' },
                              { v: 'male', l: 'ชาย' },
                              { v: 'female', l: 'หญิง' },
                            ]"
                            :key="opt.v"
                            @click="
                              editForm.gender = opt.v;
                              activeDropdown = null;
                            "
                            class="w-full px-5 py-2.5 text-left text-sm font-bold transition-colors hover:bg-orange-50 hover:text-orange-600"
                            :class="
                              editForm.gender === opt.v
                                ? 'text-orange-600 bg-orange-50/50'
                                : 'text-slate-700'
                            "
                          >
                            {{ opt.l }}
                          </button>
                        </div>
                      </transition>
                    </div>
                  </div>
                  <div class="col-span-1">
                    <label
                      class="block text-[13px] font-bold text-slate-700 mb-2.5"
                      >วันเกิด</label
                    >
                    <input
                      v-model="editForm.birth_date"
                      type="date"
                      class="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:border-orange-500 focus:ring-0 outline-none text-base text-slate-900 transition-all font-normal hover:border-slate-300 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
              <!-- Section: Contact Info -->
              <div class="flex flex-col gap-8">
                <h5
                  class="text-base font-bold text-slate-800 flex items-center gap-3"
                >
                  <div class="w-1.5 h-6 bg-slate-300 rounded-full"></div>
                  ข้อมูลการติดต่อ
                </h5>
                <div
                  class="grid grid-cols-1 sm:grid-cols-2 gap-y-8 gap-x-16 px-4"
                >
                  <div class="col-span-1">
                    <label
                      class="block text-[13px] font-bold text-slate-700 mb-2.5"
                      >อีเมล</label
                    >
                    <input
                      v-model="editForm.email"
                      type="email"
                      class="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:border-orange-500 focus:ring-0 outline-none text-base text-slate-900 transition-all font-normal hover:border-slate-300"
                    />
                  </div>
                  <div class="col-span-1">
                    <label
                      class="block text-[13px] font-bold text-slate-700 mb-2.5"
                      >โทรศัพท์</label
                    >
                    <input
                      v-model="editForm.phone"
                      class="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:border-orange-500 focus:ring-0 outline-none text-base text-slate-900 transition-all font-normal hover:border-slate-300"
                    />
                  </div>
                  <div class="sm:col-span-2">
                    <label
                      class="block text-[13px] font-bold text-slate-700 mb-2.5"
                      >ที่อยู่ปัจจุบัน</label
                    >
                    <textarea
                      v-model="editForm.address"
                      rows="3"
                      class="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:border-orange-500 focus:ring-0 outline-none text-base text-slate-900 transition-all font-normal resize-none leading-relaxed hover:border-slate-300"
                    ></textarea>
                  </div>
                </div>
              </div>
              <!-- Section: Health Goals -->
              <div class="flex flex-col gap-8">
                <h5
                  class="text-base font-bold text-slate-800 flex items-center gap-3"
                >
                  <div class="w-1.5 h-6 bg-slate-300 rounded-full"></div>
                  เป้าหมายและสุขภาพ
                </h5>
                <div
                  class="grid grid-cols-1 sm:grid-cols-2 gap-y-8 gap-x-16 px-4"
                >
                  <div class="col-span-1">
                    <label
                      class="block text-[13px] font-bold text-slate-700 mb-2.5"
                      >เป้าหมายหลัก</label
                    >
                    <div class="relative custom-select-container">
                      <button
                        @click.stop="toggleDropdown('main_goal')"
                        type="button"
                        class="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:border-orange-500 outline-none text-base text-slate-900 transition-all flex items-center justify-between hover:border-slate-300"
                        :class="{
                          'border-orange-500 ring-1 ring-orange-500/20':
                            activeDropdown === 'main_goal',
                        }"
                      >
                        <span
                          :class="{ 'text-slate-400': !editForm.main_goal }"
                        >
                          {{ editForm.main_goal || "- เลือกเป้าหมาย -" }}
                        </span>
                        <ChevronDown
                          :size="18"
                          class="text-slate-400 transition-transform duration-200"
                          :class="{
                            'rotate-180': activeDropdown === 'main_goal',
                          }"
                        />
                      </button>
                      <transition name="fade">
                        <div
                          v-if="activeDropdown === 'main_goal'"
                          class="absolute z-[100] mt-2 w-full bg-white border border-slate-100 rounded-2xl shadow-xl py-2 max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95"
                        >
                          <button
                            @click="
                              editForm.main_goal = '';
                              activeDropdown = null;
                            "
                            class="w-full px-5 py-2.5 text-left text-sm font-bold text-slate-400 hover:bg-slate-50"
                          >
                            - เลือกเป้าหมาย -
                          </button>
                          <button
                            v-for="g in mainGoals"
                            :key="g"
                            @click="
                              editForm.main_goal = g;
                              activeDropdown = null;
                            "
                            class="w-full px-5 py-2.5 text-left text-sm font-bold transition-colors hover:bg-orange-50 hover:text-orange-600"
                            :class="
                              editForm.main_goal === g
                                ? 'text-orange-600 bg-orange-50/50'
                                : 'text-slate-700'
                            "
                          >
                            {{ g }}
                          </button>
                        </div>
                      </transition>
                    </div>
                  </div>
                  <div class="col-span-1">
                    <label
                      class="block text-[13px] font-bold text-slate-700 mb-2.5"
                      >โรคประจำตัว</label
                    >
                    <input
                      v-model="editForm.underlying_disease"
                      placeholder="พิมพ์ ไม่มี หากไม่มี"
                      class="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:border-orange-500 focus:ring-0 outline-none text-base text-slate-900 transition-all font-normal hover:border-slate-300"
                    />
                  </div>
                  <div class="col-span-1">
                    <label
                      class="block text-[13px] font-bold text-slate-700 mb-2.5"
                      >น้ำหนัก (กิโลกรัม)</label
                    >
                    <input
                      v-model="editForm.weight"
                      type="number"
                      step="0.1"
                      class="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:border-orange-500 focus:ring-0 outline-none text-base text-slate-900 transition-all font-normal hover:border-slate-300"
                    />
                  </div>
                  <div class="col-span-1">
                    <label
                      class="block text-[13px] font-bold text-slate-700 mb-2.5"
                      >ส่วนสูง (เซนติเมตร)</label
                    >
                    <input
                      v-model="editForm.height"
                      type="number"
                      step="0.1"
                      class="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:border-orange-500 focus:ring-0 outline-none text-base text-slate-900 transition-all font-normal hover:border-slate-300"
                    />
                  </div>
                </div>
              </div>
              <!-- Section: System & Role -->
              <div class="flex flex-col gap-8">
                <h5
                  class="text-base font-bold text-slate-800 flex items-center gap-3"
                >
                  <div class="w-1.5 h-6 bg-slate-300 rounded-full"></div>
                  กลุ่มผู้ใช้งานและสิทธิ์ในระบบ
                </h5>
                <div
                  class="grid grid-cols-1 sm:grid-cols-2 gap-y-8 gap-x-16 px-4"
                >
                  <div class="col-span-1">
                    <label
                      class="block text-[13px] font-bold text-slate-700 mb-2.5"
                      >สิทธิ์การเข้าถึงระบบ (Role)</label
                    >
                    <div class="relative custom-select-container">
                      <button
                        @click.stop="toggleDropdown('role')"
                        type="button"
                        class="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:border-orange-500 outline-none text-base text-orange-600 font-bold transition-all flex items-center justify-between hover:border-slate-300"
                        :class="{
                          'border-orange-500 ring-1 ring-orange-500/20':
                            activeDropdown === 'role',
                        }"
                      >
                        <span>{{
                          editForm.role === "admin"
                            ? "Admin (ผู้ดูแลระบบ)"
                            : "User (ผู้ใช้งานทั่วไป)"
                        }}</span>
                        <ChevronDown
                          :size="18"
                          class="text-orange-400 transition-transform duration-200"
                          :class="{ 'rotate-180': activeDropdown === 'role' }"
                        />
                      </button>
                      <transition name="fade">
                        <div
                          v-if="activeDropdown === 'role'"
                          class="absolute z-[100] mt-2 w-full bg-white border border-slate-100 rounded-2xl shadow-xl py-2 animate-in fade-in zoom-in-95"
                        >
                          <button
                            @click="
                              editForm.role = 'user';
                              activeDropdown = null;
                            "
                            class="w-full px-5 py-2.5 text-left text-sm font-bold transition-colors hover:bg-orange-50 hover:text-orange-600"
                            :class="
                              editForm.role === 'user'
                                ? 'text-orange-600 bg-orange-50/50'
                                : 'text-slate-700'
                            "
                          >
                            User (ผู้ใช้งานทั่วไป)
                          </button>
                          <button
                            @click="
                              editForm.role = 'admin';
                              activeDropdown = null;
                            "
                            class="w-full px-5 py-2.5 text-left text-sm font-bold transition-colors hover:bg-orange-50 hover:text-orange-600"
                            :class="
                              editForm.role === 'admin'
                                ? 'text-orange-600 bg-orange-50/50'
                                : 'text-slate-700'
                            "
                          >
                            Admin (ผู้ดูแลระบบ)
                          </button>
                        </div>
                      </transition>
                    </div>
                  </div>
                  <div class="col-span-1">
                    <label
                      class="block text-[13px] font-bold text-slate-700 mb-2.5"
                      >กลุ่มผู้ใช้งานเป้าหมาย</label
                    >
                    <div class="relative custom-select-container">
                      <button
                        @click.stop="toggleDropdown('role_type')"
                        type="button"
                        class="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:border-orange-500 outline-none text-base text-slate-900 transition-all flex items-center justify-between hover:border-slate-300"
                        :class="{
                          'border-orange-500 ring-1 ring-orange-500/20':
                            activeDropdown === 'role_type',
                        }"
                      >
                        <span
                          :class="{ 'text-slate-400': !editForm.role_type }"
                        >
                          {{ editForm.role_type || "- เลือก -" }}
                        </span>
                        <ChevronDown
                          :size="18"
                          class="text-slate-400 transition-transform duration-200"
                          :class="{
                            'rotate-180': activeDropdown === 'role_type',
                          }"
                        />
                      </button>
                      <transition name="fade">
                        <div
                          v-if="activeDropdown === 'role_type'"
                          class="absolute z-[100] mt-2 w-full bg-white border border-slate-100 rounded-2xl shadow-xl py-2 max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95"
                        >
                          <button
                            @click="
                              editForm.role_type = '';
                              activeDropdown = null;
                            "
                            class="w-full px-5 py-2.5 text-left text-sm font-bold text-slate-400 hover:bg-slate-50"
                          >
                            - เลือก -
                          </button>
                          <button
                            v-for="r in roleTypes"
                            :key="r"
                            @click="
                              editForm.role_type = r;
                              editForm.role_detail_1 = '';
                              activeDropdown = null;
                            "
                            class="w-full px-5 py-2.5 text-left text-sm font-bold transition-colors hover:bg-orange-50 hover:text-orange-600"
                            :class="
                              editForm.role_type === r
                                ? 'text-orange-600 bg-orange-50/50'
                                : 'text-slate-700'
                            "
                          >
                            {{ r }}
                          </button>
                        </div>
                      </transition>
                    </div>
                  </div>
                  <div v-if="editForm.role_type" class="col-span-1">
                    <label
                      class="block text-[13px] font-bold text-slate-700 mb-2.5"
                    >
                      {{
                        editForm.role_type === "นักเรียน"
                          ? "ระดับชั้นเรียน"
                          : editForm.role_type === "นักศึกษา"
                            ? "สำนักวิชา / คณะ"
                            : "ข้อมูลสังกัด / หน่วยงาน"
                      }}
                    </label>
                    <div
                      v-if="
                        editForm.role_type === 'นักเรียน' ||
                        editForm.role_type === 'นักศึกษา'
                      "
                      class="relative custom-select-container"
                    >
                      <button
                        @click.stop="toggleDropdown('role_detail_1')"
                        type="button"
                        class="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:border-orange-500 outline-none text-base text-slate-900 transition-all flex items-center justify-between hover:border-slate-300"
                        :class="{
                          'border-orange-500 ring-1 ring-orange-500/20':
                            activeDropdown === 'role_detail_1',
                        }"
                      >
                        <span
                          :class="{ 'text-slate-400': !editForm.role_detail_1 }"
                        >
                          {{ editForm.role_detail_1 || "- เลือก -" }}
                        </span>
                        <ChevronDown
                          :size="18"
                          class="text-slate-400 transition-transform duration-200"
                          :class="{
                            'rotate-180': activeDropdown === 'role_detail_1',
                          }"
                        />
                      </button>
                      <transition name="fade">
                        <div
                          v-if="activeDropdown === 'role_detail_1'"
                          class="absolute z-[100] mt-2 w-full bg-white border border-slate-100 rounded-2xl shadow-xl py-2 max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95"
                        >
                          <button
                            @click="
                              editForm.role_detail_1 = '';
                              activeDropdown = null;
                            "
                            class="w-full px-5 py-2.5 text-left text-sm font-bold text-slate-400 hover:bg-slate-50"
                          >
                            - เลือก -
                          </button>
                          <template v-if="editForm.role_type === 'นักเรียน'">
                            <button
                              v-for="l in schoolLevels"
                              :key="l"
                              @click="
                                editForm.role_detail_1 = l;
                                activeDropdown = null;
                              "
                              class="w-full px-5 py-2.5 text-left text-sm font-bold transition-colors hover:bg-orange-50 hover:text-orange-600"
                              :class="
                                editForm.role_detail_1 === l
                                  ? 'text-orange-600 bg-orange-50/50'
                                  : 'text-slate-700'
                              "
                            >
                              {{ l }}
                            </button>
                          </template>
                          <template
                            v-else-if="editForm.role_type === 'นักศึกษา'"
                          >
                            <button
                              v-for="f in uniFaculties"
                              :key="f"
                              @click="
                                editForm.role_detail_1 = f;
                                activeDropdown = null;
                              "
                              class="w-full px-5 py-2.5 text-left text-sm font-bold transition-colors hover:bg-orange-50 hover:text-orange-600"
                              :class="
                                editForm.role_detail_1 === f
                                  ? 'text-orange-600 bg-orange-50/50'
                                  : 'text-slate-700'
                              "
                            >
                              {{ f }}
                            </button>
                          </template>
                        </div>
                      </transition>
                    </div>
                    <input
                      v-else
                      v-model="editForm.role_detail_1"
                      class="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:border-orange-500 focus:ring-0 outline-none text-base text-slate-900 transition-all font-normal hover:border-slate-300"
                    />
                  </div>
                  <div
                    v-if="editForm.role_type === 'นักศึกษา'"
                    class="col-span-1"
                  >
                    <label
                      class="block text-[13px] font-bold text-slate-700 mb-2.5"
                      >ชั้นปีที่ศึกษา</label
                    >
                    <div class="relative custom-select-container">
                      <!-- 1. ปรับปรุงปุ่ม Toggle -->
                      <button
                        @click.stop="toggleDropdown('role_detail_2')"
                        type="button"
                        class="w-full px-5 py-3.5 bg-white border-2 rounded-2xl outline-none text-base transition-all flex items-center justify-between"
                        :class="
                          activeDropdown === 'role_detail_2'
                            ? 'border-orange-500'
                            : 'border-slate-200 hover:border-slate-300'
                        "
                      >
                        <!-- เปลี่ยนสีข้อความให้ชัดเจนเมื่อถูกเลือก -->
                        <span
                          :class="
                            editForm.role_detail_2
                              ? 'text-slate-900 font-bold'
                              : 'text-slate-400 font-normal'
                          "
                        >
                          {{ editForm.role_detail_2 || "- เลือกชั้นปี -" }}
                        </span>
                        <!-- หมุนลูกศรและเปลี่ยนสีเมื่อ Active -->
                        <ChevronDown
                          :size="18"
                          class="transition-transform duration-200"
                          :class="
                            activeDropdown === 'role_detail_2'
                              ? 'text-orange-500 rotate-180'
                              : 'text-slate-400'
                          "
                        />
                      </button>
                      <!-- 2. ปรับปรุงรายการ Dropdown -->
                      <transition name="fade">
                        <div
                          v-if="activeDropdown === 'role_detail_2'"
                          class="absolute z-[110] mt-2 w-full bg-white border border-slate-200 rounded-2xl py-2 max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95"
                        >
                          <button
                            @click="
                              editForm.role_detail_2 = '';
                              activeDropdown = null;
                            "
                            class="w-full px-5 py-3 text-left text-sm font-medium text-slate-400 transition-colors"
                          >
                            - ไม่ระบุ / ยกเลิกการเลือก -
                          </button>
                          <!-- ลูปรายการจาก uniYears -->
                          <button
                            v-for="y in uniYears"
                            :key="y"
                            @click="
                              editForm.role_detail_2 = y;
                              activeDropdown = null;
                            "
                            class="w-full px-5 py-3 text-sm font-bold transition-all flex items-center justify-between group"
                            :class="
                              editForm.role_detail_2 === y
                                ? 'text-orange-700 bg-orange-50'
                                : 'text-slate-700 hover:text-orange-600'
                            "
                          >
                            <span>{{ y }}</span>
                            <!-- เพิ่มไอคอน Check เมื่อรายการนี้ตรงกับค่าที่เลือก -->
                            <Check
                              v-if="editForm.role_detail_2 === y"
                              :size="16"
                              class="text-orange-500"
                              stroke-width="3"
                            />
                          </button>
                        </div>
                      </transition>
                    </div>
                  </div>
                  <div class="col-span-1">
                    <label
                      class="block text-[13px] font-bold text-slate-700 mb-2.5"
                      >คะแนนสะสมรวม (Total Score)</label
                    >
                    <input
                      v-model="editForm.total_score"
                      type="number"
                      step="0.01"
                      class="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:border-orange-500 focus:ring-0 outline-none text-base text-slate-900 transition-all font-normal hover:border-slate-300"
                    />
                  </div>
                  <div class="col-span-1">
                    <label
                      class="block text-[13px] font-bold text-slate-700 mb-2.5"
                      >แต้ม (Points)</label
                    >
                    <input
                      v-model="editForm.points"
                      type="number"
                      class="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:border-orange-500 focus:ring-0 outline-none text-base text-slate-900 transition-all font-normal hover:border-slate-300"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button
                @click="closeModal"
                class="flex-1 sm:flex-none px-6 py-3 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                @click="resetPassword"
                :disabled="submitting"
                class="flex-1 sm:flex-none px-6 py-3 text-sm font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded-xl hover:bg-orange-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <KeyRound :size="18" />
                เปลี่ยนรหัสผ่าน
              </button>
              <button
                @click="saveEdit"
                :disabled="submitting"
                class="flex-1 sm:flex-none px-8 py-3 text-sm font-bold text-white bg-orange-500 rounded-xl hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                <Save :size="18" />
                {{ submitting ? "กำลังบันทึก..." : "ยืนยันการแก้ไขข้อมูล" }}
              </button>
            </div>
          </div>
          <div
            v-if="modal === 'ban' && target"
            class="bg-white w-full max-w-sm border border-slate-200 flex flex-col rounded-2xl"
            style="animation: modalIn 0.2s ease"
          >
            <div
              class="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-red-50 rounded-t-2xl"
            >
              <h3
                class="font-bold text-red-800 text-base flex items-center gap-2"
              >
                <Ban :size="18" /> ยืนยันการแบนผู้ใช้
              </h3>
              <button
                @click="closeModal"
                class="p-1 text-red-400 hover:text-red-800 bg-white rounded-full"
              >
                <X :size="18" />
              </button>
            </div>
            <div class="p-6 flex flex-col gap-6">
              <div
                class="flex items-center gap-4 bg-white border border-slate-200 p-4 rounded-2xl"
              >
                <img
                  :src="avatar(target)"
                  class="w-14 h-14 rounded-full object-cover border-2 border-slate-100"
                  @error="
                    ($event.target as any).src = getInitialsAvatar(target)
                  "
                />
                <div class="leading-tight">
                  <p class="font-bold text-slate-900 text-base">
                    {{ displayName(target) }}
                  </p>
                  <p class="text-xs text-slate-400 mt-1">
                    {{ target.email || target.phone || "—" }}
                  </p>
                </div>
              </div>
              <p
                class="text-sm text-slate-600 leading-relaxed text-center font-medium px-2"
              >
                คุณแน่ใจหรือไม่ที่จะระงับการใช้งานผู้ใช้รายนี้?<br />
                <span class="text-red-500 font-bold text-xs mt-1 block"
                  >ผู้ใช้จะไม่สามารถเข้าสู่ระบบได้ทันที</span
                >
              </p>
            </div>
            <div
              class="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-white rounded-b-2xl"
            >
              <button
                @click="closeModal"
                class="flex-1 px-5 py-3 text-sm font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 rounded-xl transition-all"
              >
                ยกเลิก
              </button>
              <button
                @click="confirmBan"
                :disabled="submitting"
                class="flex-[2] bg-red-600 hover:bg-red-700 px-6 py-3 rounded-xl text-white text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Ban :size="16" />
                {{ submitting ? "กำลังดำเนินการ..." : "ยืนยันการแบนทันที" }}
              </button>
            </div>
          </div>
          <!-- Activity Enrollment Modal -->
          <div
            v-if="modal === 'enroll' && target"
            class="bg-white w-full max-w-md border border-slate-200 flex flex-col rounded-3xl overflow-hidden"
            style="animation: modalIn 0.2s ease"
          >
            <div
              class="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-white"
            >
              <h3
                class="font-bold text-orange-800 text-base flex items-center gap-2"
              >
                <Calendar :size="18" /> จัดการกิจกรรมที่เข้าร่วม
              </h3>
              <button
                @click="closeModal"
                class="p-1.5 text-orange-400 hover:text-orange-800 bg-white rounded-full"
              >
                <X :size="18" />
              </button>
            </div>
            <div
              class="modal-body !p-6 flex flex-col gap-6 max-h-[70vh] overflow-y-auto custom-scrollbar"
            >
              <div
                class="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-100"
              >
                <img
                  :src="avatar(target)"
                  class="w-12 h-12 rounded-full object-cover border-2 border-white"
                />
                <div class="leading-tight">
                  <p class="font-bold text-slate-900 text-base">
                    {{ displayName(target) }}
                  </p>
                  <p class="text-[11px] text-slate-400 mt-0.5 tracking-wide">
                    {{ target.email || target.id_code || "ไม่มีข้อมูลติดต่อ" }}
                  </p>
                </div>
              </div>
              <!-- Current Registrations -->
              <div class="space-y-4">
                <div class="flex items-center justify-between px-1">
                  <p
                    class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest"
                  >
                    กิจกรรมที่เข้าร่วมอยู่ ({{ userRegistrations.length }} /
                    {{ allActivities.length }})
                  </p>
                  <button
                    v-if="userRegistrations.length > 0"
                    @click="toggleSelectAllCurrent"
                    class="flex items-center gap-1.5 group"
                  >
                    <span
                      class="text-[10px] font-bold text-slate-400 group-hover:text-orange-600 transition-colors"
                      >เลือกทั้งหมด</span
                    >
                    <div
                      class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                      :class="
                        isAllCurrentSelected
                          ? 'bg-orange-500 border-orange-500'
                          : 'bg-white border-slate-200 group-hover:border-slate-300'
                      "
                    >
                      <Check
                        v-if="isAllCurrentSelected"
                        :size="12"
                        class="text-white"
                        stroke-width="4"
                      />
                    </div>
                  </button>
                </div>
                <!-- Search Current Registrations -->
                <div v-if="userRegistrations.length > 5" class="relative group">
                  <Search
                    :size="14"
                    class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors"
                  />
                  <input
                    v-model="currentActSearch"
                    type="text"
                    placeholder="ค้นหากิจกรรมที่เข้าร่วม..."
                    class="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-100 rounded-2xl text-xs focus:border-orange-500 transition-all outline-none"
                  />
                </div>
                <div
                  v-if="loadingRegistrations"
                  class="flex justify-center py-10"
                >
                  <Loader2 class="animate-spin text-orange-500" :size="32" />
                </div>
                <div
                  v-else-if="userRegistrations.length === 0"
                  class="text-center py-10 border-2 border-dashed border-slate-100 rounded-2xl bg-white"
                >
                  <p class="text-xs text-slate-400 font-medium">
                    ยังไม่ได้เข้าร่วมกิจกรรมใดๆ
                  </p>
                </div>
                <div v-else class="space-y-2">
                  <div
                    class="max-h-60 overflow-y-auto custom-scrollbar pr-2 py-1 flex flex-col gap-2"
                  >
                    <div
                      v-for="reg in filteredCurrentActivities"
                      :key="reg.id"
                      @click="
                        selectedCurrentActivities.includes(reg.id)
                          ? (selectedCurrentActivities =
                              selectedCurrentActivities.filter(
                                (id) => id !== reg.id,
                              ))
                          : selectedCurrentActivities.push(reg.id)
                      "
                      class="group flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-2xl hover:border-orange-200 transition-all cursor-pointer"
                      :class="{
                        'bg-orange-50/30 border-orange-200':
                          selectedCurrentActivities.includes(reg.id),
                      }"
                    >
                      <!-- Circular Toggle -->
                      <div
                        class="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                        :class="
                          selectedCurrentActivities.includes(reg.id)
                            ? 'bg-orange-500 border-orange-500'
                            : 'bg-white border-slate-200 group-hover:border-slate-300'
                        "
                      >
                        <Check
                          v-if="selectedCurrentActivities.includes(reg.id)"
                          :size="14"
                          class="text-white"
                          stroke-width="4"
                        />
                      </div>
                      <div
                        v-if="reg.poster"
                        class="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-slate-100"
                      >
                        <img
                          :src="reg.poster"
                          class="w-full h-full object-cover"
                        />
                      </div>
                      <div class="flex-1 min-w-0">
                        <p
                          class="text-sm font-bold text-slate-700 truncate group-hover:text-orange-700 transition-colors leading-tight"
                        >
                          {{ reg.title }}
                        </p>
                        <p
                          class="text-[10px] text-slate-400 font-medium mt-0.5"
                        >
                          ลงทะเบียน: {{ fmtDate(reg.created_at) }}
                        </p>
                      </div>
                      <button
                        @click.stop="adminKick(reg.id, reg.title)"
                        :disabled="submitting"
                        class="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all disabled:opacity-50"
                      >
                        <Loader2
                          v-if="submitting"
                          :size="18"
                          class="animate-spin text-rose-500"
                        />
                        <LogOut v-else :size="18" />
                      </button>
                    </div>
                  </div>
                  <!-- Bulk Removal Button -->
                  <transition name="fade">
                    <button
                      v-if="selectedCurrentActivities.length > 0"
                      @click="handleBulkLeaveConfirm"
                      :disabled="submitting"
                      class="w-full py-4 bg-rose-50 text-rose-600 border border-rose-100 rounded-2xl text-sm font-extrabold hover:bg-rose-100 transition-all flex items-center justify-center gap-2 mt-2 shadow-none"
                    >
                      <Loader2
                        v-if="submitting"
                        :size="20"
                        class="animate-spin"
                      />
                      <Trash2 v-else :size="20" />
                      คัดออกจาก
                      {{ selectedCurrentActivities.length }} กิจกรรมที่เลือก
                    </button>
                  </transition>
                </div>
              </div>
              <!-- Add to New Activity (Checklist Mode) -->
              <div
                v-if="allActivities.length > userRegistrations.length"
                class="pt-6 border-t border-slate-100 space-y-4"
              >
                <div class="flex items-center justify-between px-1">
                  <p
                    class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest"
                  >
                    สั่งให้เข้าร่วมกิจกรรมใหม่
                  </p>
                  <button
                    @click="toggleSelectAllSingle"
                    class="flex items-center gap-1.5 group"
                  >
                    <span
                      class="text-[10px] font-bold text-slate-400 group-hover:text-orange-600 transition-colors"
                      >เลือกทั้งหมด</span
                    >
                    <div
                      class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                      :class="
                        isAllSingleSelected
                          ? 'bg-orange-500 border-orange-500'
                          : 'bg-white border-slate-200 group-hover:border-slate-300'
                      "
                    >
                      <Check
                        v-if="isAllSingleSelected"
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
                    v-model="singleActSearch"
                    type="text"
                    placeholder="ค้นหาชื่อกิจกรรมที่ต้องการ..."
                    class="w-full pl-11 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-sm focus:border-orange-500 transition-all outline-none"
                  />
                  <button
                    v-if="singleActSearch"
                    @click="singleActSearch = ''"
                    class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                  >
                    <X :size="14" />
                  </button>
                </div>
                <div
                  class="flex flex-col gap-2 max-h-60 overflow-y-auto custom-scrollbar pr-2 py-1"
                >
                  <div
                    v-for="act in filteredActivities"
                    :key="act.id"
                    @click="toggleSingleAct(act.id)"
                    class="flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border"
                    :class="
                      selectedSingleActivities.includes(act.id)
                        ? 'bg-orange-50 border-orange-200 text-orange-700'
                        : 'bg-white border-slate-100 hover:border-slate-200 text-slate-700'
                    "
                  >
                    <div
                      class="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                      :class="
                        selectedSingleActivities.includes(act.id)
                          ? 'bg-orange-500 border-orange-500'
                          : 'bg-white border-slate-200'
                      "
                    >
                      <Check
                        v-if="selectedSingleActivities.includes(act.id)"
                        :size="14"
                        class="text-white"
                        stroke-width="4"
                      />
                    </div>
                    <span class="text-sm font-bold truncate">{{
                      act.title
                    }}</span>
                  </div>
                  <p
                    v-if="filteredActivities.length === 0"
                    class="text-center py-10 text-xs text-slate-400 italic bg-slate-50 rounded-2xl border border-dashed border-slate-200"
                  >
                    {{
                      singleActSearch
                        ? "ไม่พบกิจกรรมที่ค้นหา"
                        : "ไม่มีกิจกรรมใหม่ให้เข้าร่วมแล้ว"
                    }}
                  </p>
                </div>
                <!-- Confirm Action -->
                <transition name="fade">
                  <button
                    v-if="selectedSingleActivities.length > 0"
                    @click="handleSingleEnrollConfirm"
                    :disabled="submitting"
                    class="w-full py-4 bg-orange-500 text-white rounded-2xl text-sm font-extrabold hover:bg-orange-600 transition-all flex items-center justify-center gap-3 mt-4 shadow-none"
                  >
                    <Loader2
                      v-if="submitting"
                      :size="20"
                      class="animate-spin"
                    />
                    <Check v-else :size="20" stroke-width="3" />
                    {{
                      submitting
                        ? "กำลังดำเนินการ..."
                        : `ยืนยันย้ายเข้า (${selectedSingleActivities.length} กิจกรรม)`
                    }}
                  </button>
                </transition>
              </div>
              <!-- Message when all activities joined -->
              <div
                v-else
                class="pt-8 pb-4 flex flex-col items-center justify-center text-center space-y-3 border-t border-slate-100"
              >
                <div
                  class="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center"
                >
                  <ShieldCheck :size="32" class="text-emerald-500" />
                </div>
                <div class="space-y-1">
                  <p class="text-emerald-600 font-bold text-sm">
                    เข้าร่วมครบทุกกิจกรรมแล้ว!
                  </p>
                  <p class="text-[11px] text-slate-400 px-10">
                    ผู้ใช้รายนี้เป็นสมาชิกของกิจกรรมทั้งหมดในระบบเรียบร้อยแล้ว
                    ไม่สามารถเพิ่มกิจกรรมใหม่ได้
                  </p>
                </div>
              </div>
            </div>
            <div class="p-6 bg-white border-t border-slate-100">
              <button
                @click="closeModal"
                class="w-full py-4 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>
    <PointsBreakdownModal
      :open="showBreakdown"
      :user-id="target?.id ?? null"
      @close="showBreakdown = false"
    />
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
@keyframes modalIn {
  from {
    opacity: 0;
    transform: scale(0.98) translateY(4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
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
.search-pill-container input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 600;
  color: #1e293b;
}
.search-pill-container input::placeholder {
  color: #9ca3af;
  font-weight: 500;
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
/* Base sticky header styling */
thead th.sticky {
  z-index: 20;
}
@media (max-width: 768px) {
  /* Tighter table for mobile */
  table th,
  table td {
    padding: 12px 10px !important;
    font-size: 12px !important;
  }
  /* Sticky columns adjustments for mobile */
  .sticky.left-0 {
    width: 45px !important;
    min-width: 45px !important;
    border-right: none !important;
  }
  /* Offset to perfectly cover the first column */
  .sticky.left-14 {
    left: 44px !important;
    min-width: 160px !important;
    max-width: 160px !important;
    border-left: none !important;
  }
  /* Manage column - narrower */
  th.w-20,
  td.sticky.right-0 {
    width: 50px !important;
    min-width: 50px !important;
  }
  /* Remove all extra shadows */
  .sticky.left-14,
  .sticky.right-0 {
    box-shadow: none !important;
  }
}
/* ─── Premium Modal System ─── */
.modal-window {
  background: white;
  width: 95%;
  height: 85vh;
  display: flex;
  flex-direction: column;
  border-radius: 24px;
  overflow: hidden;
  border: 1px solid #f1f5f9;
}
.modal-header {
  padding: 16px 24px;
  border-bottom: 1px solid #f1f5f9;
  background: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  z-index: 10;
}
.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  scrollbar-width: thin;
  scrollbar-color: #e2e8f0 transparent;
}
.modal-body::-webkit-scrollbar {
  width: 6px;
}
.modal-body::-webkit-scrollbar-track {
  background: transparent;
}
.modal-body::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 10px;
}
.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #f1f5f9;
  background: white;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex-shrink: 0;
}
@media (max-width: 640px) {
  .modal-window {
    height: 92vh;
    border-radius: 20px;
  }
  .modal-header,
  .modal-footer {
    padding: 12px 16px;
  }
  .modal-body {
    padding: 16px;
  }
  .modal-footer {
    flex-direction: row;
    flex-wrap: wrap;
  }
}
/* Custom Scrollbar for Popup */
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
</style>
