<script setup lang="ts">
import { ref, onMounted, watch, computed } from "vue";
import {
  Check,
  X,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  MoreVertical,
} from "lucide-vue-next";
import { uiStore } from "../../store/ui";
import { swal, showSuccess, showError } from "../../lib/swal";
import { authStore } from "../../store/auth";
interface ActivityRequest {
  id: number;
  title: string;
  type: string;
  detail: string;
  note: string;
  start_date: string;
  end_date: string;
  status: string;
  team_name?: string;
  created_at: string;
  users?: { fname_th: string; picture_url: string };
}
const requests = ref<ActivityRequest[]>([]);
const loading = ref(true);
const processingId = ref<number | null>(null);
// --- 🌟 State สำหรับ DataTable และ Pagination ---
const searchQuery = ref("");
const currentPage = ref(1);
const perPage = ref(10);
const sortKey = ref("created_at");
const sortDir = ref<"asc" | "desc">("desc");
const selectedIds = ref<number[]>([]);
// --- 🌟 Local State สำหรับจัดการ Table แบบเดียวกับ AdminUsers ---
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
    const menuHeight = 120; // ประมาณขนาดเมนู อนุมัติ/ปฏิเสธ
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
onMounted(() => {
  const handleGlobalClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (localActiveMenuId.value && !target.closest(".action-menu-wrapper")) {
      localActiveMenuId.value = null;
    }
  };
  window.addEventListener("click", handleGlobalClick);
});
const isAllSelected = computed(
  () =>
    paginatedRequests.value.length > 0 &&
    paginatedRequests.value.every((r) => selectedIds.value.includes(r.id)),
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
      (id) => !paginatedRequests.value.some((r) => r.id === id),
    );
  } else {
    const newIds = [...selectedIds.value];
    paginatedRequests.value.forEach((r) => {
      if (!newIds.includes(r.id)) newIds.push(r.id);
    });
    selectedIds.value = newIds;
  }
};
const clearSearch = () => {
  searchQuery.value = "";
};
const toggleSort = (key: string) => {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
  } else {
    sortKey.value = key;
    sortDir.value = key === "created_at" ? "desc" : "asc";
  }
  currentPage.value = 1; // เมื่อเปลี่ยนการจัดเรียง ให้กลับไปหน้า 1 เสมอ
};
// --- 🌟 การประมวลผลข้อมูล (ค้นหา & จัดเรียง) ---
const filteredRequests = computed(() => {
  const q = searchQuery.value.toLowerCase();
  let result = requests.value.filter(
    (r) =>
      (r.users?.fname_th || "").toLowerCase().includes(q) ||
      (r.team_name || "").toLowerCase().includes(q) ||
      (r.note || "").toLowerCase().includes(q),
  );
  result.sort((a: any, b: any) => {
    let av = a[sortKey.value] || "",
      bv = b[sortKey.value] || "";
    if (sortDir.value === "asc") return av > bv ? 1 : -1;
    return av < bv ? 1 : -1;
  });
  return result;
});
// --- 🌟 ระบบแบ่งหน้า (Pagination) ---
const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredRequests.value.length / perPage.value)),
);
const paginatedRequests = computed(() => {
  const start = (currentPage.value - 1) * perPage.value;
  return filteredRequests.value.slice(start, start + perPage.value);
});
// ฟังก์ชันสำหรับเปลี่ยนหน้า พร้อมเลื่อนหน้าจอขึ้นบนสุด
const setPage = (p: number) => {
  if (p >= 1 && p <= totalPages.value) {
    currentPage.value = p;
    const viewport = document.querySelector(".content-viewport");
    if (viewport) viewport.scrollTo({ top: 0, behavior: "smooth" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }
};
// คำนวณช่วงของเลขหน้าและจุดไข่ปลา (...)
const visiblePages = computed(() => {
  const current = currentPage.value;
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
// รีเซ็ตไปหน้าแรกเมื่อมีการค้นหาหรือเปลี่ยนจำนวนต่อหน้า
watch([searchQuery, perPage], () => {
  currentPage.value = 1;
  selectedIds.value = []; // ล้างการเลือกเมื่อมีการค้นหาหรือเปลี่ยนหน้า
});
watch(currentPage, () => {
  selectedIds.value = []; // ล้างการเลือกเมื่อเปลี่ยนหน้า
});
// --- 🌟 ฟังก์ชันจัดการข้อมูล ---
const fetchRequests = async () => {
  loading.value = true;
  try {
    const res = await fetch("/api/activities/admin/requests");
    if (res.ok) {
      const all = await res.json();
      requests.value = all.filter((r: any) => r.status === "pending");
    }
  } catch {
    // intentionally silent (no console output in browser)
  } finally {
    loading.value = false;
  }
};
const handleAction = async (id: number, status: "approved" | "rejected") => {
  const isApprove = status === "approved";
  const result = await swal.fire({
    title: isApprove ? "ยืนยันการอนุมัติคำขอนี้?" : "ยืนยันการปฏิเสธคำขอนี้?",
    icon: isApprove ? "question" : "warning",
    showCancelButton: true,
    confirmButtonColor: isApprove ? "#f97316" : "#ef4444",
    cancelButtonColor: "#94a3b8",
    confirmButtonText: "ตกลง",
    cancelButtonText: "ยกเลิก",
  });
  if (!result.isConfirmed) return;
  processingId.value = id;
  try {
    const res = await fetch(`/api/activities/admin/requests/${id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": authStore.user?.id || "",
      },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      requests.value = requests.value.filter((r) => r.id !== id);
      selectedIds.value = selectedIds.value.filter((sid) => sid !== id);
      showSuccess(isApprove ? "อนุมัติคำขอสำเร็จ" : "ปฏิเสธคำขอสำเร็จ");
    } else {
      const err = await res.json();
      showError(err.error);
    }
  } catch {
    showError("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
  } finally {
    processingId.value = null;
  }
};
const bulkHandleAction = async (status: "approved" | "rejected") => {
  if (selectedIds.value.length === 0) return;
  const isApprove = status === "approved";
  const count = selectedIds.value.length;
  const result = await swal.fire({
    title: isApprove
      ? `ยืนยันการอนุมัติ ${count} คำขอที่เลือก?`
      : `ยืนยันการปฏิเสธ ${count} คำขอที่เลือก?`,
    icon: isApprove ? "question" : "warning",
    showCancelButton: true,
    confirmButtonColor: isApprove ? "#f97316" : "#ef4444",
    cancelButtonColor: "#94a3b8",
    confirmButtonText: "ตกลง",
    cancelButtonText: "ยกเลิก",
  });
  if (!result.isConfirmed) return;
  loading.value = true;
  let successCount = 0;
  let failCount = 0;
  // ประมวลผลทีละรายการ (เนื่องจากยังไม่มี Bulk API endpoint)
  // หมายเหตุ: ในโปรเจคจริงควรใช้ Promise.all หรือ Bulk API
  for (const id of [...selectedIds.value]) {
    try {
      const res = await fetch(`/api/activities/admin/requests/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": authStore.user?.id || "",
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        requests.value = requests.value.filter((r) => r.id !== id);
        selectedIds.value = selectedIds.value.filter((sid) => sid !== id);
        successCount++;
      } else {
        failCount++;
      }
    } catch {
      failCount++;
    }
  }
  loading.value = false;
  if (successCount > 0) {
    showSuccess(
      `${isApprove ? "อนุมัติ" : "ปฏิเสธ"}สำเร็จ ${successCount} รายการ` +
        (failCount > 0 ? ` (ล้มเหลว ${failCount} รายการ)` : ""),
    );
  } else if (failCount > 0) {
    showError(`ไม่สามารถดำเนินการได้ทั้ง ${failCount} รายการ`);
  }
};
const formatDate = (dateStr: string) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};
const getObjective = (note: string) => {
  if (!note) return "ไม่มีรายละเอียดเพิ่มเติม";
  const objective = note.split("|").find((t) => t.includes("วัตถุประสงค์"));
  return objective ? objective.trim() : note.split("|")[0].trim();
};
onMounted(() => {
  fetchRequests();
});
let fetchTimeout: any = null;
watch(
  () => uiStore.lastRealtimeUpdate,
  () => {
    if (fetchTimeout) clearTimeout(fetchTimeout);
    fetchTimeout = setTimeout(() => {
      fetchRequests();
    }, 1500);
  },
);
</script>
<template>
  <div
    class="font-sarabun bg-white min-h-screen w-full relative pb-24 text-slate-900"
  >
    <div
      class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-in"
    >
      <!-- แถบค้นหา -->
      <div
        class="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        <div class="flex items-center gap-4 w-full">
          <div
            class="search-pill-container flex-1 min-w-0 w-full bg-white shadow-sm border-slate-200"
          >
            <Search class="search-icon flex-shrink-0" :size="20" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="ค้นหาชื่อผู้ขอ หรือรายละเอียดการขอเข้าร่วม..."
              class="w-full bg-transparent outline-none text-sm font-bold text-slate-700"
            />
            <button
              v-if="searchQuery"
              @click="clearSearch"
              class="btn-clear-search flex-shrink-0"
            >
              <X :size="14" />
            </button>
          </div>
        </div>
      </div>
      <!-- สถิติรายการ -->
      <div class="flex items-center justify-between px-1">
        <p
          class="text-[11px] font-bold text-slate-400 uppercase tracking-widest"
        >
          แสดง {{ paginatedRequests.length }} /
          {{ filteredRequests.length }} รายการ
        </p>
      </div>
      <!-- Loading State -->
      <div v-if="loading && requests.length === 0" class="space-y-4">
        <div
          v-for="i in 5"
          :key="i"
          class="h-20 bg-white border border-slate-100 animate-pulse rounded-3xl shadow-sm"
        ></div>
      </div>
      <!-- Empty State -->
      <div
        v-else-if="filteredRequests.length === 0"
        class="py-24 text-center bg-white rounded-3xl border border-dashed border-slate-300 shadow-sm flex flex-col items-center justify-center"
      >
        <div
          class="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-5"
        >
          <Check :size="32" class="text-orange-300" />
        </div>
        <p class="text-slate-800 font-bold text-xl mb-2">
          ไม่มีคำขอค้างอยู่ หรือไม่พบข้อมูล
        </p>
      </div>
      <!-- Table State -->
      <div v-else class="w-full">
        <div class="overflow-x-auto no-scrollbar pb-32">
          <table
            class="w-full text-left border-collapse whitespace-nowrap text-sm"
          >
            <thead
              class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200"
            >
              <tr>
                <th
                  class="p-4 w-14 text-center border-r border-slate-100 sticky left-0 bg-slate-50 z-20"
                >
                  <div
                    @click="toggleAll"
                    class="w-5 h-5 mx-auto rounded-full border-2 flex items-center justify-center cursor-pointer transition-all"
                    :class="
                      isAllSelected
                        ? 'bg-orange-500 border-orange-500 shadow-sm shadow-orange-200'
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
                  class="p-4 min-w-[200px] cursor-pointer hover:bg-slate-100 transition-colors group sticky left-14 bg-slate-50 z-20 border-r border-slate-100"
                  @click="toggleSort('users.fname_th')"
                >
                  <div class="flex items-center gap-2 flex-nowrap">
                    <span
                      class="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest group-hover:text-orange-500 transition-colors whitespace-nowrap"
                      >ผู้ขอเข้าร่วม</span
                    >
                    <ChevronUp
                      v-if="sortKey === 'users.fname_th' && sortDir === 'asc'"
                      :size="14"
                      class="text-orange-500 shrink-0"
                    />
                    <ChevronDown
                      v-else-if="
                        sortKey === 'users.fname_th' && sortDir === 'desc'
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
                  class="p-4 min-w-[200px] cursor-pointer hover:bg-slate-100 transition-colors group"
                  @click="toggleSort('team_name')"
                >
                  <div class="flex items-center gap-2 flex-nowrap">
                    <span
                      class="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest group-hover:text-orange-500 transition-colors whitespace-nowrap"
                      >ทีมที่ขอ</span
                    >
                    <ChevronUp
                      v-if="sortKey === 'team_name' && sortDir === 'asc'"
                      :size="14"
                      class="text-orange-500 shrink-0"
                    />
                    <ChevronDown
                      v-else-if="sortKey === 'team_name' && sortDir === 'desc'"
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
                <th class="p-4 min-w-[250px]">
                  <div class="flex items-center gap-2 flex-nowrap">
                    <span
                      class="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest whitespace-nowrap"
                      >วัตถุประสงค์</span
                    >
                  </div>
                </th>
                <th
                  class="p-4 min-w-[150px] cursor-pointer hover:bg-slate-100 transition-colors group"
                  @click="toggleSort('created_at')"
                >
                  <div class="flex items-center gap-2 flex-nowrap">
                    <span
                      class="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest group-hover:text-orange-500 transition-colors whitespace-nowrap"
                      >วันที่ส่ง</span
                    >
                    <ChevronUp
                      v-if="sortKey === 'created_at' && sortDir === 'asc'"
                      :size="14"
                      class="text-orange-500 shrink-0"
                    />
                    <ChevronDown
                      v-else-if="sortKey === 'created_at' && sortDir === 'desc'"
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
                  class="p-4 w-20 text-center sticky right-0 bg-slate-50 z-20 border-l border-slate-100 shadow-[-4px_0_8px_rgba(0,0,0,0.02)]"
                >
                  <span
                    class="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest"
                    >จัดการ</span
                  >
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="req in paginatedRequests"
                :key="req.id"
                class="transition-colors group hover:bg-white"
              >
                <td
                  class="p-4 text-center border-r border-slate-50 sticky left-0 bg-white group-hover:bg-white transition-colors z-10"
                >
                  <div
                    @click.stop="toggleOne(req.id)"
                    class="w-5 h-5 mx-auto rounded-full border-2 flex items-center justify-center cursor-pointer transition-all"
                    :class="
                      selectedIds.includes(req.id)
                        ? 'bg-orange-500 border-orange-500 shadow-sm shadow-orange-200'
                        : 'bg-white border-slate-300'
                    "
                  >
                    <Check
                      v-if="selectedIds.includes(req.id)"
                      :size="12"
                      class="text-white"
                      stroke-width="4"
                    />
                  </div>
                </td>
                <td
                  class="p-4 sticky left-14 bg-white group-hover:bg-white transition-colors z-10 border-r border-slate-50"
                >
                  <div class="flex items-center gap-3">
                    <img
                      :src="
                        req.users?.picture_url ||
                        'https://via.placeholder.com/40'
                      "
                      class="w-10 h-10 rounded-full border border-slate-200 object-cover bg-slate-50 shrink-0"
                    />
                    <div class="flex flex-col min-w-0 leading-tight gap-0.5">
                      <p
                        class="font-bold text-slate-900 text-[13px] truncate group-hover:text-orange-600 transition-colors"
                      >
                        {{ req.users?.fname_th || "Host" }}
                      </p>
                      <span
                        class="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md inline-block w-max mt-0.5 tracking-wide"
                        >PENDING</span
                      >
                    </div>
                  </div>
                </td>
                <td class="p-4">
                  <div class="flex flex-col gap-0.5">
                    <p
                      class="text-xs font-bold text-orange-600 truncate max-w-[180px]"
                    >
                      {{ req.team_name || "ทั่วไป" }}
                    </p>
                    <span class="text-[10px] text-slate-400 font-medium"
                      >TEAM_PERMISSION</span
                    >
                  </div>
                </td>
                <td class="p-4">
                  <p
                    class="text-xs text-slate-600 max-w-[250px] lg:max-w-md truncate"
                    :title="getObjective(req.note)"
                  >
                    {{ getObjective(req.note) }}
                  </p>
                </td>
                <td class="p-4">
                  <span
                    class="text-[11px] font-medium text-slate-500 flex items-center gap-1.5"
                  >
                    {{ formatDate(req.created_at) }}
                  </span>
                </td>
                <td
                  class="p-4 text-center sticky right-0 bg-white group-hover:bg-white transition-colors z-10 border-l border-slate-50"
                >
                  <button
                    @click.stop="toggleMenu(req.id, $event)"
                    class="w-10 h-10 mx-auto flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all action-menu-wrapper"
                    :class="{
                      'bg-slate-100 text-slate-700 shadow-sm':
                        localActiveMenuId === req.id,
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
      <!-- Pagination UI -->
      <div
        v-if="totalPages > 1"
        class="flex items-center justify-center gap-2 pt-4 pb-4"
      >
        <button
          @click="setPage(currentPage - 1)"
          :disabled="currentPage === 1"
          class="rounded-full border border-slate-200 bg-white text-slate-500 hover:text-orange-500 hover:border-orange-500 disabled:opacity-30 disabled:hover:text-slate-500 disabled:hover:border-slate-200 transition-all shadow-sm flex items-center justify-center flex-shrink-0"
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
              currentPage === p
                ? 'bg-orange-500 border-orange-500 text-white shadow-orange-500/20 shadow-sm border'
                : typeof p === 'number'
                  ? 'bg-white border-slate-200 text-slate-600 hover:border-orange-300 hover:text-orange-600 shadow-sm border'
                  : 'bg-transparent border-transparent text-slate-400 cursor-default shadow-none pointer-events-none',
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
          @click="setPage(currentPage + 1)"
          :disabled="currentPage === totalPages"
          class="rounded-full border border-slate-200 bg-white text-slate-500 hover:text-orange-500 hover:border-orange-500 disabled:opacity-30 disabled:hover:text-slate-500 disabled:hover:border-slate-200 transition-all shadow-sm flex items-center justify-center flex-shrink-0"
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
    </div>
    <!-- Persistent Bottom Actions Bar -->
    <div
      class="fixed bottom-0 right-0 z-[40] flex items-center justify-end gap-3 p-4 sm:p-6"
      :style="{
        left: selectedIds.length > 0 ? 'var(--sidebar-width, 0)' : 'auto',
      }"
    >
      <transition name="fade">
        <div
          v-if="selectedIds.length > 0"
          class="flex items-center gap-2 w-full justify-between bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 shadow-lg animate-in slide-in-from-bottom-4 overflow-hidden"
        >
          <div class="flex items-center gap-2 sm:gap-3 shrink-0">
            <div
              class="bg-orange-500 text-white px-3 sm:px-4 py-2 rounded-xl font-bold text-xs sm:text-sm shadow-sm whitespace-nowrap"
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
              @click="bulkHandleAction('rejected')"
              :disabled="loading"
              class="bg-rose-500 text-white px-3 sm:px-4 h-9 sm:h-10 rounded-xl text-xs sm:text-[13px] font-bold flex items-center gap-1.5 sm:gap-2 hover:bg-rose-600 transition-all shadow-sm shrink-0"
            >
              <X :size="16" />
              <span class="hidden sm:inline">ปฏิเสธทั้งหมด</span>
              <span class="sm:hidden">ปฏิเสธ</span>
            </button>
            <button
              @click="bulkHandleAction('approved')"
              :disabled="loading"
              class="bg-orange-500 text-white px-3 sm:px-4 h-9 sm:h-10 rounded-xl text-xs sm:text-[13px] font-bold flex items-center gap-1.5 sm:gap-2 hover:bg-orange-600 transition-all shadow-sm shadow-orange-500/20 shrink-0"
            >
              <Loader2 v-if="loading" :size="16" class="animate-spin" />
              <Check v-else :size="16" stroke-width="3" />
              <span class="hidden sm:inline">อนุมัติทั้งหมด</span>
              <span class="sm:hidden">อนุมัติ</span>
            </button>
          </div>
        </div>
      </transition>
    </div>
    <Teleport to="body">
      <div v-if="localActiveMenuId !== null">
        <div
          @click="localActiveMenuId = null"
          class="fixed inset-0 z-[9998]"
        ></div>
        <div
          class="fixed z-[9999] w-48 bg-white border border-slate-200 shadow-2xl rounded-2xl flex flex-col overflow-hidden transition-all duration-200 animate-in fade-in zoom-in-95"
          :style="{
            top: localMenuPos.top + 'px',
            right: localMenuPos.right + 'px',
            transform: localMenuPos.transform,
          }"
          @click.stop
        >
          <div class="py-2">
            <button
              @click="
                handleAction(localActiveMenuId, 'approved');
                localActiveMenuId = null;
              "
              class="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-orange-50 hover:text-orange-600 flex items-center gap-2 transition-colors"
            >
              <Check :size="16" class="text-orange-500" /> อนุมัติคำขอ
            </button>
            <button
              @click="
                handleAction(localActiveMenuId, 'rejected');
                localActiveMenuId = null;
              "
              class="w-full px-4 py-2.5 text-left text-sm font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors"
            >
              <X :size="16" /> ปฏิเสธคำขอ
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
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.04);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  gap: 12px;
}
.search-pill-container:focus-within {
  border-color: #f97316;
  box-shadow: 0 8px 25px rgba(249, 115, 22, 0.12);
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
  table th,
  table td {
    padding: 12px 10px !important;
    font-size: 12px !important;
  }
  .sticky.left-14 {
    left: 40px !important;
    min-width: 160px !important;
    max-width: 160px !important;
  }
  .sticky.left-0 {
    left: 0 !important;
    width: 40px !important;
    min-width: 40px !important;
  }
  th.w-20,
  td.sticky.right-0 {
    width: 50px !important;
    min-width: 50px !important;
  }
  .sticky.left-0,
  .sticky.left-14,
  .sticky.right-0 {
    box-shadow: none !important;
  }
}
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
