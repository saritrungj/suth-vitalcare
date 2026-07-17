<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted, watch } from "vue";
import {
  Search,
  Terminal,
  Eye,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
  User as UserIcon,
  Clock,
  Check,
  Copy,
  Database,
  MonitorSmartphone,
} from "lucide-vue-next";
import moment from "moment";
import "moment/dist/locale/th";
import { authStore } from "../../store/auth";
import { uiStore } from "../../store/ui";
moment.locale("th");
const logs = ref<any[]>([]);
const stats = ref<any>(null);
const loading = ref(true);
const page = ref(1);
const total = ref(0);
const limit = 10; // ปรับเป็น 10 รายการต่อหน้า
// ดึง Log ทั้งหมดเป็นค่าเริ่มต้น (เนื่องจากเอาแท็บออกแล้ว)
const logType = ref<"admin" | "user" | "all">("all");
const filters = ref({
  search: "",
  action: "",
  userId: "",
  startDate: "",
  endDate: "",
});
const activeLog = ref<any>(null);
const showScrollTop = ref(false);
const expandedLogId = ref<number | null>(null);
const selectedIds = ref<number[]>([]);
const isAllSelected = computed(
  () =>
    logs.value.length > 0 &&
    logs.value.every((l) => selectedIds.value.includes(l.id)),
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
      (id) => !logs.value.some((l) => l.id === id),
    );
  } else {
    const newIds = [...selectedIds.value];
    logs.value.forEach((l) => {
      if (!newIds.includes(l.id)) newIds.push(l.id);
    });
    selectedIds.value = newIds;
  }
};
const toggleExpandLog = (id: number) => {
  expandedLogId.value = expandedLogId.value === id ? null : id;
};
const copiedId = ref<string | null>(null);
const fetchLogs = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams({
      page: page.value.toString(),
      limit: limit.toString(),
      logType: logType.value,
      ...filters.value,
    });
    const res = await fetch(`/api/logs?${params}`, {
      headers: { "x-user-id": authStore.user?.id || "" },
    });
    if (res.ok) {
      const result = await res.json();
      logs.value = result.data;
      total.value = result.total;
    }
  } catch {
    // intentionally silent (no console output in browser)
  } finally {
    loading.value = false;
  }
};
const fetchStats = async () => {
  try {
    const res = await fetch("/api/logs/stats", {
      headers: { "x-user-id": authStore.user?.id || "" },
    });
    if (res.ok) stats.value = await res.json();
  } catch {
    // intentionally silent (no console output in browser)
  }
};
const applyFilters = () => {
  page.value = 1;
  fetchLogs();
};
let searchTimeout: any = null;
watch(
  () => filters.value.search,
  () => {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      applyFilters();
    }, 500);
  },
);
const clearSearch = () => {
  filters.value.search = "";
  applyFilters();
};
const clearFilters = () => {
  filters.value = {
    search: "",
    action: "",
    userId: "",
    startDate: "",
    endDate: "",
  };
  applyFilters();
};
const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  copiedId.value = text;
  setTimeout(() => {
    copiedId.value = null;
  }, 2000);
};
const totalPages = computed(() => Math.ceil(total.value / limit) || 1);
const goToPage = (p: number) => {
  if (p >= 1 && p <= totalPages.value) {
    page.value = p;
    fetchLogs();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
};
const displayedPages = computed(() => {
  const current = page.value;
  const last = totalPages.value;
  const delta = 2;
  const left = current - delta;
  const right = current + delta + 1;
  const range = [];
  const rangeWithDots = [];
  let l;
  for (let i = 1; i <= last; i++) {
    if (i === 1 || i === last || (i >= left && i < right)) {
      range.push(i);
    }
  }
  for (const i of range) {
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
const actionLabels: Record<string, string> = {
  login_line: "เข้าสู่ระบบด้วย LINE",
  login_google: "เข้าสู่ระบบด้วย Google",
  login_email: "เข้าสู่ระบบด้วยอีเมล",
  register_email: "สมัครสมาชิกใหม่",
  create_activity: "สร้างกิจกรรมใหม่",
  edit_activity: "แก้ไขข้อมูลกิจกรรม",
  delete_activity: "ลบกิจกรรม",
  ENROLL_USER: "ลงทะเบียนเข้าร่วมกิจกรรม",
  leave_activity_solo: "ยกเลิกการเข้าร่วมกิจกรรม",
  leave_team: "ออกจากทีม",
  profile_update: "อัปเดตข้อมูลโปรไฟล์",
  password_reset: "เปลี่ยนรหัสผ่าน",
  BULK_KICK_USER: "ลบสมาชิกออกจากกลุ่ม",
  admin_login: "ผู้ดูแลระบบเข้าสู่ระบบ",
  activity_status_change: "เปลี่ยนสถานะกิจกรรม",
  EXPORT: "ส่งออกข้อมูล",
};
const targetLabels: Record<string, string> = {
  activity: "กิจกรรม",
  user: "ผู้ใช้งาน",
  event: "เหตุการณ์",
  team: "ทีม",
  goal: "เป้าหมาย",
};
const getActionLabel = (action: string) => actionLabels[action] || action;
const getTargetLabel = (target: string) => targetLabels[target] || target;
const isActionDropdownOpen = ref(false);
const selectAction = (act: string) => {
  filters.value.action = act;
  isActionDropdownOpen.value = false;
  applyFilters();
};
const handleScroll = () => {
  showScrollTop.value = window.scrollY > 300;
};
onMounted(() => {
  fetchLogs();
  fetchStats();
  window.addEventListener("scroll", handleScroll);
  document.addEventListener("click", (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".custom-dropdown-container")) {
      isActionDropdownOpen.value = false;
    }
  });
});
onUnmounted(() => {
  window.removeEventListener("scroll", handleScroll);
});
let fetchTimeout: any = null;
watch(
  () => uiStore.lastRealtimeUpdate,
  () => {
    if (fetchTimeout) clearTimeout(fetchTimeout);
    fetchTimeout = setTimeout(() => {
      fetchLogs();
      fetchStats();
    }, 1500);
  },
);
const getStatus = (action: string) => {
  const act = action.toLowerCase();
  if (act.includes("error") || act.includes("fail") || act.includes("denied"))
    return { text: "ล้มเหลว", color: "text-rose-600", icon: AlertCircle };
  if (
    act.includes("delete") ||
    act.includes("remove") ||
    act.includes("suspend")
  )
    return { text: "ลบ/ระงับ", color: "text-rose-600", icon: CheckCircle2 };
  if (act.includes("update") || act.includes("edit"))
    return { text: "แก้ไข", color: "text-orange-600", icon: CheckCircle2 };
  return { text: "สำเร็จ", color: "text-orange-600", icon: CheckCircle2 };
};
const maskName = (fname: string, lname: string) => {
  if (!fname) return "ไม่ระบุชื่อ";
  return `${fname} ${lname || ""}`.trim();
};
const getDeviceIcon = (ua: string) => {
  if (!ua) return "Unknown Device";
  let browser = "Browser";
  if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Line")) browser = "LINE";
  else if (ua.includes("Chrome") && !ua.includes("Chromium"))
    browser = "Chrome";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Firefox")) browser = "Firefox";
  let os = "OS";
  if (ua.includes("Windows NT 10.0")) os = "Windows 10/11";
  else if (ua.includes("Windows NT")) os = "Windows";
  else if (ua.includes("Mac OS X")) {
    const match = ua.match(/Mac OS X ([0-9_]+)/);
    os = match ? `macOS ${match[1].replace(/_/g, ".")}` : "macOS";
  } else if (ua.includes("Android")) {
    const match = ua.match(/Android ([0-9.]+)/);
    os = match ? `Android ${match[1]}` : "Android";
  } else if (ua.includes("iPhone") || ua.includes("iPad")) {
    const match = ua.match(/OS ([0-9_]+) like Mac OS X/);
    os = match ? `iOS ${match[1].replace(/_/g, ".")}` : "iOS";
  }
  return `${browser} on ${os}`;
};
const bulkExport = () => {
  // reserved for future implementation
};
</script>
<template>
  <div class="font-sarabun bg-white min-h-screen w-full relative pb-24">
    <div
      class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-in"
    >
      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-2 sm:gap-4 w-full">
          <div class="search-pill-container flex-1 min-w-0 w-full">
            <Search class="search-icon flex-shrink-0" :size="18" />
            <input
              v-model="filters.search"
              type="text"
              placeholder="ค้นหาเหตุการณ์, ID หรือรายละเอียด..."
              class="w-full bg-transparent outline-none text-sm font-bold font-sarabun"
            />
            <button
              v-if="filters.search"
              @click="clearSearch"
              class="btn-clear-search flex-shrink-0"
            >
              <X :size="14" />
            </button>
          </div>
        </div>
        <div
          class="flex flex-wrap items-center gap-3 bg-white p-0 rounded-none border-0 shadow-none"
        >
          <div
            class="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-sm flex-1 min-w-[220px] relative custom-dropdown-container"
          >
            <span
              class="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest flex-shrink-0 font-sarabun"
              >การกระทำ</span
            >
            <div
              @click="isActionDropdownOpen = !isActionDropdownOpen"
              class="flex-1 flex items-center justify-between cursor-pointer group"
            >
              <span
                class="text-sm font-bold font-sarabun"
                :class="filters.action ? 'text-slate-800' : 'text-slate-400'"
              >
                {{
                  filters.action
                    ? getActionLabel(filters.action)
                    : "ทั้งหมด (All Actions)"
                }}
              </span>
              <ChevronDown
                :size="16"
                class="text-slate-400 group-hover:text-orange-500 transition-colors"
              />
            </div>
            <!-- Custom Dropdown Menu -->
            <transition name="fade">
              <div
                v-if="isActionDropdownOpen"
                class="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden z-[100] max-h-[300px] overflow-y-auto custom-scrollbar"
              >
                <div
                  @click="selectAction('')"
                  class="px-5 py-3 text-sm font-bold hover:bg-slate-50 cursor-pointer border-b border-slate-50"
                  :class="
                    filters.action === ''
                      ? 'text-orange-600 bg-orange-50'
                      : 'text-slate-600'
                  "
                >
                  ทั้งหมด (All Actions)
                </div>
                <div
                  v-for="act in stats?.actions"
                  :key="act.action"
                  @click="selectAction(act.action)"
                  class="px-5 py-3 text-sm font-bold hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors border-b border-slate-50 last:border-0"
                  :class="
                    filters.action === act.action
                      ? 'text-orange-600 bg-orange-50'
                      : 'text-slate-600'
                  "
                >
                  <span>{{ getActionLabel(act.action) }}</span>
                  <span
                    class="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg"
                    >{{ act.count }}</span
                  >
                </div>
              </div>
            </transition>
          </div>
          <div
            class="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-sm flex-1 min-w-[180px]"
          >
            <span
              class="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest flex-shrink-0 font-sarabun"
              >ตั้งแต่</span
            >
            <input
              type="date"
              v-model="filters.startDate"
              @change="applyFilters"
              class="text-sm font-bold text-slate-800 bg-transparent outline-none w-full cursor-pointer font-sarabun"
            />
          </div>
          <div
            class="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-sm flex-1 min-w-[180px]"
          >
            <span
              class="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest flex-shrink-0 font-sarabun"
              >ถึง</span
            >
            <input
              type="date"
              v-model="filters.endDate"
              @change="applyFilters"
              class="text-sm font-bold text-slate-800 bg-transparent outline-none w-full cursor-pointer font-sarabun"
            />
          </div>
          <button
            @click="clearFilters"
            class="px-6 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-extrabold text-slate-600 hover:text-orange-600 hover:bg-orange-50 hover:border-orange-200 transition-all shadow-sm flex-shrink-0 font-sarabun"
          >
            ล้างตัวกรอง
          </button>
        </div>
      </div>
      <div class="flex items-center justify-between px-1">
        <p
          class="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-sarabun"
        >
          แสดง {{ logs.length }} / {{ total }} รายการบันทึกระบบ
        </p>
      </div>
      <div v-if="loading" class="space-y-4">
        <div
          v-for="i in 5"
          :key="i"
          class="h-16 bg-white border border-slate-100 animate-pulse rounded-2xl shadow-sm"
        ></div>
      </div>
      <div v-else class="w-full">
        <div class="overflow-x-auto custom-scrollbar pb-10">
          <table
            class="w-full text-left border-collapse whitespace-nowrap text-sm"
          >
            <thead
              class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200"
            >
              <tr>
                <th
                  class="p-4 w-28 border-r border-slate-100 sticky left-0 bg-slate-50 z-20"
                >
                  <span
                    class="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest whitespace-nowrap font-sarabun"
                    >เวลา / วันที่</span
                  >
                </th>
                <th class="p-4 min-w-[220px] border-r border-slate-100">
                  <span
                    class="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest whitespace-nowrap font-sarabun"
                    >ผู้ใช้งาน</span
                  >
                </th>
                <th class="p-4 min-w-[160px] border-r border-slate-100">
                  <span
                    class="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest whitespace-nowrap font-sarabun"
                    >กิจกรรม / การกระทำ</span
                  >
                </th>
                <th class="p-4 min-w-[500px] border-r border-slate-100">
                  <span
                    class="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest whitespace-nowrap font-sarabun"
                    >รายละเอียดเหตุการณ์</span
                  >
                </th>
                <th class="p-4 min-w-[260px] border-r border-slate-100">
                  <span
                    class="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest whitespace-nowrap font-sarabun"
                    >ข้อมูลอุปกรณ์ / IP</span
                  >
                </th>
                <th
                  class="p-4 w-20 text-center sticky right-0 bg-slate-50 z-20 border-l border-slate-100 shadow-[-4px_0_8px_rgba(0,0,0,0.02)] font-sarabun"
                >
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-sarabun">
              <template v-for="log in logs" :key="log.id">
                <tr class="transition-colors group hover:bg-slate-50 bg-white">
                  <td
                    class="p-4 sticky left-0 bg-white group-hover:bg-slate-50 transition-colors z-10 border-r border-slate-50"
                  >
                    <div class="flex flex-col leading-tight gap-0.5">
                      <p
                        class="font-black text-slate-900 text-[13px] font-sarabun"
                      >
                        {{ moment(log.created_at).format("HH:mm:ss") }}
                      </p>
                      <p
                        class="text-[10px] font-bold text-slate-400 uppercase font-sarabun"
                      >
                        {{ moment(log.created_at).format("DD MMM YY") }}
                      </p>
                    </div>
                  </td>
                  <td class="p-4">
                    <div v-if="log.user_id" class="flex items-center gap-3">
                      <img
                        :src="log.picture_url || '/placeholder.jpg'"
                        class="w-10 h-10 rounded-full border border-slate-200 object-cover bg-slate-50 shrink-0"
                      />
                      <div class="flex flex-col min-w-0 leading-tight gap-0.5">
                        <p
                          class="font-bold text-slate-900 text-[13px] truncate group-hover:text-orange-600 transition-colors font-sarabun"
                        >
                          {{ maskName(log.fname_th, log.lname_th) }}
                        </p>
                        <p
                          class="text-[10px] text-orange-600 font-bold tracking-tighter font-sarabun"
                        >
                          ID: ..{{ String(log.user_id).slice(-4) }}
                        </p>
                      </div>
                    </div>
                    <div v-else class="flex items-center gap-3">
                      <div
                        class="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center border border-slate-200 shrink-0"
                      >
                        <Terminal :size="18" />
                      </div>
                      <span
                        class="text-[11px] font-black text-slate-400 tracking-wider font-sarabun uppercase"
                        >ระบบอัตโนมัติ</span
                      >
                    </div>
                  </td>
                  <td class="p-4 text-center">
                    <div
                      class="flex flex-col gap-1.5 items-center font-sarabun"
                    >
                      <span
                        class="font-black text-slate-900 text-[10px] uppercase tracking-tight font-sarabun"
                        >{{ getActionLabel(log.action) }}</span
                      >
                      <span
                        class="border text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider inline-flex items-center gap-1 font-sarabun"
                        :class="
                          getStatus(log.action)
                            .color.replace('text-', 'border-')
                            .replace('-600', '-200') +
                          ' ' +
                          getStatus(log.action).color.replace('-600', '-50')
                        "
                      >
                        <component
                          :is="getStatus(log.action).icon"
                          :size="10"
                          stroke-width="3"
                          :class="getStatus(log.action).color"
                        />
                        <span :class="getStatus(log.action).color">{{
                          getStatus(log.action).text
                        }}</span>
                      </span>
                    </div>
                  </td>
                  <td class="p-4">
                    <p
                      class="text-slate-600 text-[13px] font-bold leading-relaxed font-sarabun"
                    >
                      {{ log.description }}
                    </p>
                  </td>
                  <td class="p-4">
                    <div class="flex flex-col gap-1 font-sarabun">
                      <div class="flex items-center gap-2">
                        <Monitor :size="14" class="text-slate-400" />
                        <p
                          class="text-[11px] font-black text-slate-800 font-sarabun"
                        >
                          {{ getDeviceIcon(log.user_agent) }}
                        </p>
                      </div>
                      <div class="flex items-center gap-2">
                        <Globe :size="14" class="text-slate-400" />
                        <p
                          class="text-[10px] font-bold text-orange-600 tracking-normal font-sarabun"
                        >
                          {{ log.ip_address || "ไม่มีข้อมูล IP" }}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td
                    class="p-4 text-center sticky right-0 bg-white group-hover:bg-slate-50 transition-colors z-10 border-l border-slate-50 font-sarabun"
                  >
                    <button
                      @click.stop="
                        expandedLogId = expandedLogId === log.id ? null : log.id
                      "
                      class="w-10 h-10 mx-auto flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all font-sarabun"
                    >
                      <ChevronDown
                        :size="20"
                        :class="{ 'rotate-180': expandedLogId === log.id }"
                        class="transition-transform"
                      />
                    </button>
                  </td>
                </tr>
                <tr
                  v-if="expandedLogId === log.id"
                  class="animate-in fade-in bg-slate-50 font-sarabun"
                >
                  <td colspan="6" class="p-6 font-sarabun">
                    <div
                      class="bg-white rounded-2xl border border-slate-200 p-6 shadow-lg shadow-slate-100 font-sarabun"
                    >
                      <div
                        class="grid grid-cols-1 md:grid-cols-2 gap-8 font-sarabun"
                      >
                        <div class="space-y-4 font-sarabun">
                          <h4
                            class="text-xs font-black text-slate-400 uppercase tracking-widest font-sarabun"
                          >
                            รายละเอียดเพิ่มเติม
                          </h4>
                          <p
                            class="text-slate-700 text-sm font-medium leading-relaxed font-sarabun"
                          >
                            {{ log.description }}
                          </p>
                          <div
                            class="mt-4 pt-4 border-t border-slate-100 font-sarabun"
                          >
                            <span
                              class="text-[11px] font-bold text-slate-400 block mb-1 font-sarabun"
                              >User Agent</span
                            >
                            <p
                              class="text-[10px] font-mono text-slate-500 break-words bg-slate-50 p-2 rounded-lg font-sarabun"
                            >
                              {{ log.user_agent }}
                            </p>
                          </div>
                        </div>
                        <div
                          class="bg-slate-900 rounded-xl p-4 overflow-x-auto font-sarabun"
                        >
                          <h4
                            class="text-xs font-black text-orange-500 uppercase tracking-widest mb-3 font-sarabun"
                          >
                            Metadata
                          </h4>
                          <pre class="text-[11px] text-orange-200 font-mono">{{
                            JSON.stringify(log.metadata, null, 2)
                          }}</pre>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
              <tr v-if="logs.length === 0 && !loading">
                <td colspan="6" class="py-24 text-center bg-white font-sarabun">
                  <div class="flex flex-col items-center justify-center">
                    <div
                      class="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-5"
                    >
                      <Terminal :size="32" class="text-slate-300" />
                    </div>
                    <p
                      class="text-slate-800 font-bold text-xl mb-2 font-sarabun"
                    >
                      ไม่พบข้อมูลบันทึกระบบ
                    </p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div
        v-if="totalPages > 1"
        class="flex items-center justify-center gap-2 pt-4 pb-4 font-sarabun"
      >
        <button
          @click="goToPage(page - 1)"
          :disabled="page === 1"
          class="rounded-full border border-slate-200 bg-white text-slate-500 hover:text-orange-500 hover:border-orange-500 disabled:opacity-30 disabled:hover:text-slate-500 disabled:hover:border-slate-200 transition-all shadow-sm flex items-center justify-center flex-shrink-0 font-sarabun"
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
        <div class="flex items-center gap-1.5 font-sarabun">
          <button
            v-for="(p, idx) in displayedPages"
            :key="idx"
            @click="p !== '...' ? goToPage(p) : null"
            class="rounded-full text-sm font-bold transition-all flex items-center justify-center flex-shrink-0 font-sarabun"
            :class="[
              page === p
                ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-200'
                : p === '...'
                  ? 'text-slate-400 cursor-default border-transparent'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-orange-300 hover:text-orange-600 shadow-sm',
            ]"
            style="
              width: 40px;
              height: 40px;
              min-width: 40px;
              min-height: 40px;
              padding: 0;
            "
          >
            {{ p }}
          </button>
        </div>
        <button
          @click="goToPage(page + 1)"
          :disabled="page === totalPages"
          class="rounded-full border border-slate-200 bg-white text-slate-500 hover:text-orange-500 hover:border-orange-500 disabled:opacity-30 disabled:hover:text-slate-500 disabled:hover:border-slate-200 transition-all shadow-sm flex items-center justify-center flex-shrink-0 font-sarabun"
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
    </div>
  </div>
</template>
<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap");
.font-sarabun {
  font-family: "Sarabun", sans-serif !important;
}
.font-sarabun input,
.font-sarabun select,
.font-sarabun button,
.font-sarabun textarea {
  font-family: "Sarabun", sans-serif !important;
}
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
@keyframes logExpand {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: #f8fafc;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
  border: 2px solid #f8fafc;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
/* ─── Search Pill ─── */
.search-pill-container {
  display: flex;
  align-items: center;
  background: white;
  padding: 0 24px;
  height: 54px;
  border-radius: 99px;
  border: 1.5px solid #e2e8f0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  gap: 14px;
}
.search-pill-container:focus-within {
  border-color: #f97316;
  box-shadow: 0 10px 30px rgba(249, 115, 22, 0.1);
  transform: translateY(-1px);
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
@media (max-width: 768px) {
  table th,
  table td {
    padding: 12px 10px !important;
    font-size: 12px !important;
  }
  .sticky.left-0 {
    width: 48px !important;
    min-width: 48px !important;
    border-right: none !important;
  }
  .sticky.left-14 {
    left: 47px !important;
    min-width: 100px !important;
    max-width: 100px !important;
    border-left: none !important;
  }
  .sticky.right-0 {
    width: 50px !important;
    min-width: 50px !important;
    box-shadow: none !important;
  }
}
</style>
