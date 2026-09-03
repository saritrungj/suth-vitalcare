<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted } from "vue";
import {
  Plus,
  Trash2,
  Image as ImageIcon,
  PlusCircle,
  Loader2,
  Search,
  Pencil,
  List,
  Tag,
  X,
  ChevronDown,
  Smile,
  Utensils,
  Dumbbell,
  Target,
  Trophy,
  Users2,
  LayoutGrid,
  FileText,
  Clock,
  Palette,
  Check,
  Eye,
  EyeOff,
  MoreVertical,
  Filter,
  ArrowDownAZ,
  ArrowUpZA,
  Copy,
  ChevronLeft,
  Download,
  AlignJustify,
  AlignLeft,
  RefreshCw,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Table2,
  ClipboardCheck,
  GripVertical,
  Calendar,
  MapPin,
  ShieldCheck,
  Settings,
  Settings2,
  ExternalLink,
  Heart,
  CalendarDays,
  Lock,
  ClipboardList,
  Footprints,
  Timer,
  Flame,
  BarChart3,
  Scale,
  Droplet,
  Hash,
  Ruler,
} from "lucide-vue-next";
import moment from "moment";
import { authStore } from "../../store/auth";
import { uiStore } from "../../store/ui";
import { useRoute, useRouter } from "vue-router";
import Cropper from "cropperjs";
import "cropperjs/dist/cropper.css";
import { swal, showSuccess, showError, showConfirm } from "../../lib/swal";
import AdminActivityDashboard from "./AdminActivityDashboard.vue";
import AdminCertificateEditor from "./AdminCertificateEditor.vue";
// Import Composables
import { useAdminActivities } from "../../composables/useAdminActivities";
import { useActivityForm } from "../../composables/useActivityForm";
const route = useRoute();
const router = useRouter();
// Define Props for Team Scoping
const props = defineProps({
  teamId: { type: [String, Number], default: null },
  isHostMode: { type: Boolean, default: false },
});
// Initialize Composables
const {
  activities,
  loading,
  submitting: adminSubmitting,
  searchQuery,
  sortBy,
  filterStatus,
  filterCert,
  filterContinuousReg,
  filterHasGoals,
  filterRoleStudent,
  filterRoleUni,
  filterRoleStaff,
  filterRolePublic,
  filterOpenStatus,
  selectedIds,
  viewMode,
  denseMode,
  dtSortKey,
  dtSortDir,
  dtExpandedId,
  dtCurrentPage,
  dtPerPage,
  filteredActivities,
  isAllSelected,
  activitiesFetch,
  deleteActivity,
  duplicateActivity,
  duplicateMultipleActivities,
  toggleStatus,
  bulkAction,
  exportActivitiesCSV,
  toggleDtExpand,
  toggleDtSort,
  paginatedActivities,
  totalPages,
  setPage,
  toggleSelectAll,
} = useAdminActivities();
const {
  form,
  activeTab,
  editingId,
  uploading,
  submitting: formSubmitting,
  roles,
  submissionOptions,
  taskTypeOptions,
  metricOptions,
  unitOptions,
  showAdvanced,
  activeTaskIdx,
  showCropper,
  cropperTarget,
  cropperRawFile,
  cropperImgUrl,
  cropperEl,
  cropRatio,
  showCertEditor,
  certEditorEventId,
  hasCertTemplate,
  certLastUpdated,
  isDragging,
  draggingSectionIdx,
  displayedTasks,
  flatUnits,
  clockField,
  clockMode,
  currentHour,
  currentMin,
  isAm,
  sectionDraggingIdx,
  sectionDragOverIdx,
  taskDraggingOrigIdx,
  taskDragOverOrigIdx,
  fetchMasterData,
  openCreate,
  editActivity,
  viewActivityDetails,
  saveActivity,
  resetForm,
  restoreDraft,
  addTask,
  removeTask,
  handleTypeChange,
  handleMetricChange,
  toggleDay,
  setDayPreset,
  addSection,
  removeSection,
  handlePosterUpload,
  handleSectionImageUpload,
  openCropper,
  closeCropper,
  confirmCrop,
  setCropRatio,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleSectionDragOver,
  handleSectionDragLeave,
  handleSectionDrop,
  openCertificateEditor,
  openCertEditorDirect,
  closeCertEditor,
  checkCertTemplate,
  onSectionDragStart,
  onSectionDragOver,
  onSectionDragLeave,
  onSectionDrop,
  onSectionDragEnd,
  onTaskTabDragStart,
  onTaskTabDragOver,
  onTaskTabDragLeave,
  onTaskTabDrop,
  onTaskTabDragEnd,
  onTaskTabClick,
  toggleAll: toggleAllVisibility,
  showSchoolLevels,
  showUniFilters,
  showFacultyFilters,
  fmtTime,
  openClock,
  closeClock,
  selectHour,
  selectMin,
  toggleAmPm,
  formatDateThai,
  pad2,
  vAutoExpand,
} = useActivityForm(() => {
  const tid = route.query.teamId ? Number(route.query.teamId) : undefined;
  return activitiesFetch(tid);
});
// ✅ Watch for task title changes and sync with note for persistence integrity
watch(
  () => form.value.tasks,
  (tasks) => {
    if (tasks && Array.isArray(tasks)) {
      tasks.forEach((t) => {
        // If title is modified but note isn't, sync them
        // This ensures that when only 'title' is edited in the UI, 'note' is also updated
        // for the backend which uses 'note' as the primary display field
        if (t.title && t.title !== t.note) {
          t.note = t.title;
        }
      });
    }
  },
  { deep: true },
);
const handleBack = () => {
  resetForm();
  activeTab.value = "list";
  editingId.value = null;
  const newQuery = { ...route.query };
  delete newQuery.edit;
  delete newQuery.create;
  router.replace({ query: newQuery });
};
const filterOptions = [
  { id: "cert", label: "มีเกียรติบัตร" },
  { id: "open", label: "เปิดรับสมัคร" },
  { id: "role_student", label: "เฉพาะนักเรียน" },
  { id: "role_uni", label: "เฉพาะนักศึกษา" },
  { id: "role_staff", label: "เฉพาะบุคลากร" },
  { id: "role_public", label: "บุคคลทั่วไป" },
  { id: "continuous", label: "รับสมัครตลอด" },
  { id: "goals", label: "มีเป้าหมาย" },
];
const selectedFilterIds = computed({
  get: () => {
    const active = [];
    if (filterCert.value) active.push("cert");
    if (filterOpenStatus.value) active.push("open");
    if (filterRoleStudent.value) active.push("role_student");
    if (filterRoleUni.value) active.push("role_uni");
    if (filterRoleStaff.value) active.push("role_staff");
    if (filterRolePublic.value) active.push("role_public");
    if (filterContinuousReg.value) active.push("continuous");
    if (filterHasGoals.value) active.push("goals");
    return active;
  },
  set: (newVal: string[]) => {
    filterCert.value = newVal.includes("cert");
    filterOpenStatus.value = newVal.includes("open");
    filterRoleStudent.value = newVal.includes("role_student");
    filterRoleUni.value = newVal.includes("role_uni");
    filterRoleStaff.value = newVal.includes("role_staff");
    filterRolePublic.value = newVal.includes("role_public");
    filterContinuousReg.value = newVal.includes("continuous");
    filterHasGoals.value = newVal.includes("goals");
  },
});
const goalUnitOptions = computed(() => {
  const options = [{ value: "points", label: "คะแนนสะสม", icon: Trophy }];
  flatUnits.forEach((fu) => {
    if (fu.value === "points") return;
    let icon: any = ClipboardList;
    if (fu.value === "km" || fu.value === "m") icon = MapPin;
    else if (fu.value === "steps") icon = Footprints;
    else if (fu.value === "min" || fu.value === "hr") icon = Timer;
    else if (fu.value === "cal") icon = Flame;
    else if (fu.value === "meal") icon = Utensils;
    else if (fu.value === "level") icon = BarChart3;
    else if (fu.value === "kg") icon = Scale;
    else if (fu.value === "glass") icon = Droplet;
    else if (fu.value === "times") icon = Hash;
    options.push({
      value: fu.value,
      label: fu.label,
      icon: icon,
    });
  });
  return options;
});
// Date consistency watchers
watch(
  () => form.value.registration_start_date,
  (newStart) => {
    if (
      newStart &&
      form.value.registration_end_date &&
      moment(newStart).isAfter(moment(form.value.registration_end_date))
    ) {
      form.value.registration_end_date = newStart;
    }
  },
);
watch(
  () => form.value.start_date,
  (newStart) => {
    if (
      newStart &&
      form.value.end_date &&
      moment(newStart).isAfter(moment(form.value.end_date))
    ) {
      form.value.end_date = newStart;
    }
  },
);
const clearSearch = () => {
  searchQuery.value = "";
};
const toggleOne = (id: number) => {
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter((i) => i !== id);
  } else {
    selectedIds.value.push(id);
  }
};
const toggleAll = () => {
  if (isAllSelected.value) {
    selectedIds.value = [];
  } else {
    selectedIds.value = filteredActivities.value.map((a) => a.id);
  }
};
const getTaskCount = (act: any) => {
  if (!act.tasks) return 0;
  if (typeof act.tasks === "string") {
    try {
      return JSON.parse(act.tasks).length;
    } catch {
      return 0;
    }
  }
  return Array.isArray(act.tasks) ? act.tasks.length : 0;
};
const previewActivity = (act: any) => {
  window.open(`/activities/${act.id}`, "_blank", "noopener,noreferrer");
};
const exportFullReport = async (act: any) => {
  const eventStartStr = act.start_date
    ? moment(act.start_date).format("YYYY-MM-DD")
    : act.created_at
      ? moment(act.created_at).format("YYYY-MM-DD")
      : moment().format("YYYY-MM-DD");
  const eventEndStr = act.end_date
    ? moment(act.end_date).format("YYYY-MM-DD")
    : moment().format("YYYY-MM-DD");
  const defaultStart = moment().startOf("month").isBefore(moment(eventStartStr))
    ? eventStartStr // If start of month is BEFORE event start, use event start
    : moment().startOf("month").format("YYYY-MM-DD"); // Otherwise use start of month
  const defaultEnd = moment().endOf("month").format("YYYY-MM-DD");
  const { value: formValues } = await swal.fire({
    title: "ส่งออกรายงานการส่งภารกิจ",
    html: `
      <div class="text-left font-sans py-2" style="display: flex; flex-direction: column; gap: 16px;">
        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">เลือกช่วงเวลาด่วน:</label>
          <div class="flex gap-2">
            <button type="button" id="btn-this-month" class="flex-1 py-2 text-xs font-bold bg-white text-slate-600 rounded-xl hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-all border border-slate-200 shadow-sm cursor-pointer">เดือนนี้</button>
            <button type="button" id="btn-last-month" class="flex-1 py-2 text-xs font-bold bg-white text-slate-600 rounded-xl hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-all border border-slate-200 shadow-sm cursor-pointer">เดือนที่แล้ว</button>
            <button type="button" id="btn-all-time" class="flex-1 py-2 text-xs font-bold bg-white text-slate-600 rounded-xl hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-all border border-slate-200 shadow-sm cursor-pointer">ทั้งหมด</button>
          </div>
        </div>
        <div style="width: 100%; height: 1px; background-color: #f1f5f9; margin: 8px 0;"></div>
        <div id="date-selection-container" style="display: flex; flex-direction: column; gap: 16px;">
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">ตั้งแต่วันที่:</label>
            <input type="date" id="export-start-date" 
              class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500 focus:bg-white transition-all font-medium text-slate-700 cursor-pointer"
              onclick="try{this.showPicker()}catch(e){}"
              value="${defaultStart}">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">ถึงวันที่:</label>
            <input type="date" id="export-end-date" 
              class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500 focus:bg-white transition-all font-medium text-slate-700 cursor-pointer"
              onclick="try{this.showPicker()}catch(e){}"
              value="${defaultEnd}">
          </div>
        </div>
      </div>
    `,
    didOpen: (popup) => {
      const startInput = popup.querySelector(
        "#export-start-date",
      ) as HTMLInputElement;
      const endInput = popup.querySelector(
        "#export-end-date",
      ) as HTMLInputElement;
      const btnThisMonth = popup.querySelector("#btn-this-month");
      const btnLastMonth = popup.querySelector("#btn-last-month");
      const btnAllTime = popup.querySelector("#btn-all-time");
      const btns = [btnThisMonth, btnLastMonth, btnAllTime];
      const setActive = (activeBtn: Element | null) => {
        btns.forEach((b) => {
          if (b) {
            b.classList.remove(
              "border-orange-500",
              "bg-orange-50",
              "text-orange-600",
              "ring-2",
              "ring-orange-200",
            );
            b.classList.add("border-slate-200", "bg-white", "text-slate-600");
          }
        });
        if (activeBtn) {
          activeBtn.classList.remove(
            "border-slate-200",
            "bg-white",
            "text-slate-600",
          );
          activeBtn.classList.add(
            "border-orange-500",
            "bg-orange-50",
            "text-orange-600",
            "ring-2",
            "ring-orange-200",
          );
        }
      };
      const updateValues = (start: string, end: string) => {
        if (startInput) startInput.value = start;
        if (endInput) endInput.value = end;
        // Trigger change event for validation/visual updates
        startInput?.dispatchEvent(new Event("change"));
        endInput?.dispatchEvent(new Event("change"));
      };
      btnThisMonth?.addEventListener("click", () => {
        const start = moment().startOf("month").isBefore(moment(eventStartStr))
          ? eventStartStr
          : moment().startOf("month").format("YYYY-MM-DD");
        const end = moment().endOf("month").format("YYYY-MM-DD");
        updateValues(start, end);
        setActive(btnThisMonth);
      });
      btnLastMonth?.addEventListener("click", () => {
        const start = moment()
          .subtract(1, "month")
          .startOf("month")
          .format("YYYY-MM-DD");
        const end = moment()
          .subtract(1, "month")
          .endOf("month")
          .format("YYYY-MM-DD");
        updateValues(start, end);
        setActive(btnLastMonth);
      });
      btnAllTime?.addEventListener("click", () => {
        updateValues(eventStartStr, eventEndStr);
        setActive(btnAllTime);
      });
      [startInput, endInput].forEach((inp) => {
        inp?.addEventListener("change", () => {
          if (
            startInput.value &&
            endInput.value &&
            startInput.value > endInput.value
          ) {
            endInput.value = startInput.value;
          }
        });
        // Clear active state when user manually types or picks a date
        inp?.addEventListener("input", () => setActive(null));
      });
      // Set initial active state if matches This Month
      if (
        defaultStart ===
          (moment().startOf("month").isBefore(moment(eventStartStr))
            ? eventStartStr
            : moment().startOf("month").format("YYYY-MM-DD")) &&
        defaultEnd === moment().endOf("month").format("YYYY-MM-DD")
      ) {
        setActive(btnThisMonth);
      }
    },
    showCancelButton: true,
    confirmButtonText: "ดาวน์โหลด Excel",
    cancelButtonText: "ยกเลิก",
    customClass: {
      confirmButton:
        "bg-orange-500 text-white font-bold rounded-xl px-8 py-3 hover:bg-orange-600 transition-all shadow-lg shadow-orange-200",
      cancelButton:
        "bg-slate-100 text-slate-600 font-bold rounded-xl px-8 py-3 hover:bg-slate-200 transition-all",
    },
    buttonsStyling: false,
    preConfirm: () => {
      const startDate = (
        document.getElementById("export-start-date") as HTMLInputElement
      ).value;
      const endDate = (
        document.getElementById("export-end-date") as HTMLInputElement
      ).value;
      if (!startDate || !endDate) {
        swal.showValidationMessage("กรุณาเลือกวันที่ให้ครบถ้วน");
        return false;
      }
      if (moment(endDate).isBefore(moment(startDate))) {
        swal.showValidationMessage("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น");
        return false;
      }
      return { startDate, endDate };
    },
  });
  if (!formValues) return;
  try {
    showSuccess("กำลังเตรียมข้อมูลรายงาน...");
    const url = new URL(
      `/api/export/activities/${act.id}/monthly-report`,
      window.location.origin,
    );
    url.searchParams.append("start_date", formValues.startDate);
    url.searchParams.append("end_date", formValues.endDate);
    const res = await fetch(url.toString(), {
      headers: { "x-user-id": String(authStore.user?.id) },
    });
    if (!res.ok) throw new Error("ไม่สามารถดึงข้อมูลได้");
    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Report_${act.title}_${formValues.startDate}_to_${formValues.endDate}.xlsx`;
    link.click();
    showSuccess("ส่งออกรายงานสำเร็จ");
  } catch (e) {
    showError("เกิดข้อผิดพลาดในการส่งออกข้อมูล");
  }
};
const exportParticipants = async (act: any) => {
  try {
    const res = await fetch(
      `/api/export/activities/${act.id}/participants-export`,
      {
        headers: { "x-user-id": String(authStore.user?.id) },
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showError(err.error || "ไม่สามารถส่งออกข้อมูลได้");
      return;
    }
    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `participants_${act.title}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    link.click();
    URL.revokeObjectURL(link.href);
    showSuccess("ส่งออกรายชื่อสำเร็จ");
  } catch (e) {
    showError("เกิดข้อผิดพลาดในการส่งออกข้อมูล");
  }
};
const getRegProgress = (act: any) => {
  if (act.is_unlimited_max_slots || !act.max_slots) return 0;
  return Math.min(
    Math.round(((act.registration_count || 0) / act.max_slots) * 100),
    100,
  );
};
// Watch for activeTab changes to clean up URL
watch(activeTab, (newTab) => {
  if (newTab === "list") {
    const newQuery = { ...route.query };
    delete newQuery.create;
    delete newQuery.edit;
    router.replace({ query: newQuery });
  }
});
// UI Local State
const showScrollTop = ref(false);
const activeMenuId = ref<string | number | null>(null);
const isFilterOpen = ref(false);
// Smart Dropdown Logic
const activeDropdown = ref<string | null>(null);
const dropdownDirection = ref<"up" | "down">("down");
const toggleDropdown = (id: string, event: MouseEvent) => {
  event.stopPropagation();
  if (activeDropdown.value === id) {
    activeDropdown.value = null;
  } else {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    dropdownDirection.value = spaceBelow < 350 ? "up" : "down";
    activeDropdown.value = id;
  }
};
onMounted(() => {
  const handleClickOutside = (e: MouseEvent) => {
    if (
      activeDropdown.value &&
      !(e.target as HTMLElement).closest(".custom-dropdown")
    ) {
      activeDropdown.value = null;
    }
  };
  window.addEventListener("click", handleClickOutside);
});
const handleScroll = () => {
  showScrollTop.value = window.scrollY > 300;
  activeMenuId.value = null;
};
const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
};
const toggleMenu = (id: string | number, event?: MouseEvent) => {
  if (activeMenuId.value === id) {
    activeMenuId.value = null;
    return;
  }
  activeMenuId.value = id;
  if (event) {
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    const menuHeight = 380; // Estimated height
    const menuWidth = 256; // w-64 is 256px

    const spaceOnRight = window.innerWidth - rect.right - 8;
    const spaceOnLeft = rect.left - 8;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;

    // 1. Check if we can do Side Positioning (Desktop)
    if (spaceOnRight >= menuWidth || spaceOnLeft >= menuWidth) {
      let top = rect.top;
      if (top + menuHeight > window.innerHeight - 16) {
        top = Math.max(16, window.innerHeight - menuHeight - 16);
      }
      menuPos.value.top = top;

      if (spaceOnRight >= menuWidth) {
        menuPos.value.left = rect.right + 8;
        menuPos.value.right = null;
      } else {
        menuPos.value.left = null;
        menuPos.value.right = window.innerWidth - rect.left + 8;
      }
    } else {
      // 2. Mobile / Narrow Screen: Not enough space on sides. Place Below or Above.
      if (spaceBelow >= menuHeight || spaceBelow > spaceAbove) {
        menuPos.value.top = rect.bottom + 8;
      } else {
        menuPos.value.top = Math.max(16, rect.top - menuHeight - 8);
      }

      // Horizontal alignment: Align right edge with button's right edge
      menuPos.value.left = null;
      let rightPos = window.innerWidth - rect.right;

      // Prevent overflowing the left side of the screen
      if (window.innerWidth - rightPos < menuWidth + 16) {
        rightPos = window.innerWidth - menuWidth - 16;
      }
      // Prevent overflowing the right side of the screen
      if (rightPos < 16) rightPos = 16;

      menuPos.value.right = rightPos;
    }

    menuPos.value.transform = "none";
  }
};
const menuPos = ref({
  top: 0,
  left: null as number | null,
  right: null as number | null,
  transform: "none",
});
const activeMenuAct = computed(
  () =>
    paginatedActivities.value.find((a) => a.id === activeMenuId.value) || null,
);
// Lifecycle Hooks
onMounted(() => {
  const teamIdParam = props.isHostMode
    ? props.teamId
      ? Number(props.teamId)
      : undefined
    : route.query.teamId
      ? Number(route.query.teamId)
      : undefined;
  activitiesFetch(teamIdParam);
  fetchMasterData();
  restoreDraft();
  window.addEventListener("scroll", handleScroll);
  if (route.query.edit) {
    const checkEdit = () => {
      if (activities.value.length > 0) {
        const act = activities.value.find(
          (a) => String(a.id) === String(route.query.edit),
        );
        if (act) editActivity(act);
      } else {
        setTimeout(checkEdit, 500);
      }
    };
    checkEdit();
  } else if (route.query.create) {
    openCreate(props.isHostMode ? Number(props.teamId) : undefined);
  }
});
watch(
  () => route.query.edit,
  (newEd) => {
    if (newEd) {
      const act = activities.value.find((a) => String(a.id) === String(newEd));
      if (act) editActivity(act);
    }
  },
);
watch(
  () => route.query.teamId,
  (newTeamId) => {
    const tid = newTeamId ? Number(newTeamId) : undefined;
    activitiesFetch(tid);
  },
);
const hoveringHandleIdx = ref<number | null>(null);
const hoveringTaskHandleIdx = ref<number | null>(null);
watch(
  () => [authStore.user?.role, authStore.user?.id],
  () => {
    const tid = props.isHostMode
      ? props.teamId
        ? Number(props.teamId)
        : undefined
      : route.query.teamId
        ? Number(route.query.teamId)
        : undefined;
    activitiesFetch(tid);
    if (!editingId.value) resetForm();
  },
);
let fetchTimeout: any = null;
watch(
  () => uiStore.lastRealtimeUpdate,
  () => {
    if (fetchTimeout) clearTimeout(fetchTimeout);
    fetchTimeout = setTimeout(() => {
      activitiesFetch();
    }, 1500);
  },
);
onUnmounted(() => {
  window.removeEventListener("scroll", handleScroll);
});
// Reset menu state when switching tabs
watch(activeTab, () => {
  activeMenuId.value = null;
});
// ── Helpers for Detailed Status & Dates ──────────────────
const getActivityStatus = (act: any) => {
  const now = moment();
  const regStart = act.registration_start_date
    ? moment(act.registration_start_date)
    : null;
  const regEnd = act.registration_end_date
    ? moment(act.registration_end_date)
    : null;
  const start = act.start_date ? moment(act.start_date) : null;
  const end = act.end_date ? moment(act.end_date) : null;
  // 1. Draft/Hidden
  if (act.is_active === false || act.status === "draft") {
    return {
      label: "ร่าง/ซ่อนอยู่",
      class: "bg-slate-100 text-slate-500 border-slate-200 status-draft",
    };
  }
  // 2. Ended
  if (!act.is_continuous_event && end && now.isAfter(end)) {
    return {
      label: "จบกิจกรรมแล้ว",
      class: "bg-rose-50 text-rose-600 border-rose-100 status-ended",
    };
  }
  // 3. Full
  const isFull =
    !act.is_unlimited_max_slots &&
    act.max_slots &&
    (act.registration_count || 0) >= act.max_slots;
  if (isFull) {
    return {
      label: "ที่นั่งเต็มแล้ว",
      class: "bg-amber-50 text-amber-600 border-amber-100 status-full",
    };
  }
  // 4. Ongoing (Registration closed but activity not ended)
  const regClosed =
    !act.is_continuous_registration && regEnd && now.isAfter(regEnd);
  if (regClosed) {
    return {
      label: "กำลังดำเนินการ",
      class: "bg-blue-50 text-blue-600 border-blue-100 status-ongoing",
    };
  }
  // 5. Open (Registration still open)
  if (!regStart || now.isSameOrAfter(regStart)) {
    return {
      label: "กำลังเปิดรับสมัคร",
      class: "bg-emerald-50 text-emerald-600 border-emerald-100 status-open",
    };
  }
  // 6. Waiting for registration to open
  return {
    label: "รอเปิดรับสมัคร",
    class: "bg-blue-50 text-blue-600 border-blue-100 status-open",
  };
};
const getCountdown = (act: any) => {
  const now = moment();
  const target = act.registration_end_date
    ? moment(act.registration_end_date)
    : act.start_date
      ? moment(act.start_date)
      : null;
  if (!target || now.isAfter(target)) return null;
  const diff = target.diff(now);
  const duration = moment.duration(diff);
  if (duration.asDays() >= 1)
    return `เหลือ ${Math.floor(duration.asDays())} วัน`;
  if (duration.asHours() >= 1)
    return `เหลือ ${Math.floor(duration.asHours())} ชม.`;
  return `เหลือ ${Math.floor(duration.asMinutes())} นาที`;
};
const getGoalSummary = (act: any) => {
  if (!act.tasks) return "ไม่ระบุเป้าหมาย";
  let tasks = [];
  try {
    tasks = Array.isArray(act.tasks)
      ? act.tasks
      : JSON.parse(act.tasks || "[]");
  } catch {
    return "ไม่ระบุเป้าหมาย";
  }
  if (tasks.length === 0) return "ไม่ระบุเป้าหมาย";
  const mainTask = tasks[0];
  if (!mainTask.title && !mainTask.target_value && !mainTask.goal)
    return "ไม่ระบุเป้าหมาย";
  const title = mainTask.title || "เป้าหมายหลัก";
  const unit = mainTask.unit || "";
  const goal = mainTask.target_value || mainTask.goal || "";
  if (!goal) return title;
  return `${title} (${goal} ${unit})`;
};
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
</script>
<template>
  <div class="font-sarabun bg-white min-h-screen w-full relative pb-24">
    <!-- Removed fixed backdrop from here to move it inside Teleport -->
    <div
      v-if="activeTab === 'list'"
      class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-in"
    >
      <div
        class="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        <!-- Host Mode Header -->
        <div v-if="isHostMode" class="flex-1">
          <h2 class="text-3xl font-black text-slate-800 mb-1">
            จัดการกิจกรรมทีม
          </h2>
          <p class="text-sm text-slate-400 font-bold">
            แคมเปญสุขภาพเหล่านี้จะเห็นได้เฉพาะสมาชิกในทีมของคุณเท่านั้น
          </p>
        </div>
        <div
          class="flex items-center gap-2 sm:gap-4 w-full"
          :class="{ 'lg:w-auto': isHostMode }"
        >
          <!-- Search Pill -->
          <div class="search-pill-container flex-1 min-w-0">
            <Search class="search-icon flex-shrink-0" :size="18" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="ค้นหา..."
              class="w-full bg-transparent outline-none text-sm font-bold"
            />
            <button
              v-if="searchQuery"
              @click="clearSearch"
              class="btn-clear-search flex-shrink-0"
            >
              <X :size="14" />
            </button>
          </div>
          <!-- Action Buttons for Host Mode -->
          <button
            v-if="isHostMode"
            @click="openCreate(Number(props.teamId))"
            class="px-6 py-3 bg-[#F05A23] text-white rounded-2xl font-black shadow-lg shadow-orange-500/20 hover:scale-105 transition-all flex items-center gap-2"
          >
            <PlusCircle :size="18" /> สร้างกิจกรรม
          </button>
          <!-- Sliding Toggle (Hidden in Host Mode if desired, or keep for list/grid toggle) -->
          <div
            v-if="!isHostMode"
            class="view-toggle-switch flex-shrink-0"
            @click="viewMode = viewMode === 'table' ? 'preview' : 'table'"
          >
            <div
              class="toggle-slider"
              :class="{ 'is-right': viewMode === 'table' }"
            ></div>
            <div class="toggle-btn" :class="{ active: viewMode === 'table' }">
              <Table2 :size="16" />
            </div>
            <div class="toggle-btn" :class="{ active: viewMode === 'preview' }">
              <Eye :size="16" />
            </div>
          </div>
        </div>
      </div>
      <!-- 🌟 Filter Chips 🌟 -->
      <div class="w-full -mt-2">
        <div
          class="flex gap-2.5 overflow-x-auto pb-2"
          style="scrollbar-width: none"
        >
          <button
            v-for="opt in filterOptions"
            :key="opt.id"
            class="inline-flex items-center bg-white border border-slate-200 px-5 py-2 rounded-full text-[13px] font-medium text-slate-700 whitespace-nowrap cursor-pointer transition-all shrink-0 hover:border-slate-300 h-11"
            :class="{
              '!bg-[#FF6A00] !text-white !border-[#FF6A00] font-semibold':
                selectedFilterIds.includes(opt.id),
            }"
            @click="
              selectedFilterIds = selectedFilterIds.includes(opt.id)
                ? selectedFilterIds.filter((id) => id !== opt.id)
                : [...selectedFilterIds, opt.id]
            "
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
      <div class="flex items-center justify-between px-1 mt-2">
        <p
          class="text-[11px] font-bold text-slate-400 uppercase tracking-widest"
        >
          แสดง {{ paginatedActivities.length }} /
          {{ filteredActivities.length }} รายการ
        </p>
      </div>
      <div v-if="loading" class="space-y-4">
        <div
          v-for="i in 5"
          :key="i"
          class="h-20 bg-white border border-slate-100 animate-pulse rounded-2xl shadow-sm"
        ></div>
      </div>
      <div
        v-else-if="filteredActivities.length === 0"
        class="py-24 text-center bg-white rounded-3xl border border-dashed border-slate-300 shadow-sm flex flex-col items-center justify-center"
      >
        <div
          class="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-5"
        >
          <Search :size="32" class="text-slate-300" />
        </div>
        <p class="text-slate-800 font-bold text-xl mb-2">ไม่พบข้อมูลกิจกรรม</p>
      </div>
      <div v-else-if="viewMode === 'table'" class="w-full">
        <div class="overflow-x-auto custom-scrollbar">
          <table
            class="w-full text-left border-collapse whitespace-nowrap text-sm"
          >
            <thead
              class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200"
            >
              <tr>
                <th
                  class="p-4 w-12 text-center border-r border-slate-100 sticky left-0 bg-slate-50 z-10"
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
                  class="p-4 min-w-[200px] cursor-pointer hover:bg-slate-100 transition-colors group sticky left-12 bg-slate-50 z-10 border-r border-slate-100"
                  @click="toggleDtSort('title')"
                >
                  <div class="flex items-center gap-2">
                    ชื่อกิจกรรม / สถานะ
                    <ArrowUpDown
                      :size="14"
                      class="text-slate-400 group-hover:text-orange-500 transition-colors"
                    />
                  </div>
                </th>
                <th class="p-4 min-w-[150px] hidden lg:table-cell">
                  สรุปเป้าหมายหลัก
                </th>
                <th class="p-4 min-w-[120px] text-center">
                  ผู้สำเร็จ / ผู้สมัคร
                </th>
                <th class="p-4 min-w-[180px]">วันรับสมัคร - สิ้นสุด</th>
                <th class="p-4 min-w-[180px]">วันกิจกรรม - สิ้นสุด</th>
                <th class="p-4 min-w-[120px] text-center">นับถอยหลัง</th>
                <th
                  class="p-4 w-20 text-center sticky right-0 bg-slate-50 z-10 border-l border-slate-100 shadow-[-4px_0_8px_rgba(0,0,0,0.02)]"
                >
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="act in paginatedActivities"
                :key="act.id"
                class="transition-colors group"
                :class="{ 'is-selected': selectedIds.includes(act.id) }"
              >
                <td
                  class="p-4 text-center border-r border-slate-50 sticky left-0 bg-white z-10"
                >
                  <div
                    @click.stop="toggleOne(act.id)"
                    class="w-5 h-5 mx-auto rounded-full border-2 flex items-center justify-center cursor-pointer transition-all"
                    :class="
                      selectedIds.includes(act.id)
                        ? 'bg-orange-500 border-orange-500 shadow-sm shadow-orange-200'
                        : 'bg-white border-slate-300'
                    "
                  >
                    <Check
                      v-if="selectedIds.includes(act.id)"
                      :size="12"
                      class="text-white"
                      stroke-width="4"
                    />
                  </div>
                </td>
                <td
                  class="p-4 sticky left-12 bg-white z-10 border-r border-slate-50"
                >
                  <div class="flex flex-col min-w-0">
                    <p
                      class="font-bold text-slate-900 truncate text-[13px] group-hover:text-orange-600 transition-colors cursor-pointer"
                      @click="viewActivityDetails(act)"
                    >
                      {{ act.title }}
                    </p>
                    <div class="mt-1 flex gap-1 flex-wrap items-center">
                      <span
                        class="px-2 py-0.5 rounded text-[10px] font-bold border tracking-tight"
                        :class="getActivityStatus(act).class"
                      >
                        {{ getActivityStatus(act).label }}
                      </span>
                      <!-- Only show on small screens to save horizontal space -->
                      <span
                        class="lg:hidden px-2 py-0.5 rounded text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-100 truncate max-w-[120px]"
                      >
                        {{ getGoalSummary(act) }}
                      </span>
                    </div>
                  </div>
                </td>
                <td class="p-4 hidden lg:table-cell">
                  <div class="flex flex-col gap-1">
                    <span class="text-xs font-bold text-slate-700">{{
                      getGoalSummary(act)
                    }}</span>
                    <span class="text-[10px] text-slate-400"
                      >{{ getTaskCount(act) }} ภารกิจย่อย</span
                    >
                  </div>
                </td>
                <td class="p-4 text-center">
                  <div class="flex flex-col items-center">
                    <div class="flex items-baseline gap-1">
                      <span class="font-bold text-blue-600 text-sm">{{
                        act.completion_count || 0
                      }}</span>
                      <span class="text-slate-400 text-[10px]"
                        >/ {{ act.registration_count || 0 }} คน</span
                      >
                    </div>
                    <div
                      class="w-16 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden"
                    >
                      <div
                        class="h-full bg-blue-500"
                        :style="{
                          width:
                            ((act.completion_count || 0) /
                              (act.registration_count || 1)) *
                              100 +
                            '%',
                        }"
                      ></div>
                    </div>
                  </div>
                </td>
                <td class="p-4">
                  <div class="flex flex-col text-[11px] leading-tight">
                    <div class="flex items-center gap-1.5 text-slate-500">
                      <CalendarDays :size="10" />
                      {{
                        act.is_continuous_registration
                          ? "เริ่ม: เปิดถาวร"
                          : act.registration_start_date
                            ? formatDateThai(act.registration_start_date)
                            : "-"
                      }}
                    </div>
                    <div
                      class="flex items-center gap-1.5 text-rose-500 font-medium mt-1"
                    >
                      <X :size="10" />
                      {{
                        act.is_continuous_registration
                          ? "สิ้นสุด: -"
                          : act.registration_end_date
                            ? formatDateThai(act.registration_end_date)
                            : "-"
                      }}
                    </div>
                  </div>
                </td>
                <td class="p-4">
                  <div class="flex flex-col text-[11px] leading-tight">
                    <div class="flex items-center gap-1.5 text-slate-500">
                      <Calendar :size="10" />
                      {{
                        act.is_continuous_event
                          ? "เริ่ม: ต่อเนื่อง"
                          : act.start_date
                            ? formatDateThai(act.start_date)
                            : "-"
                      }}
                    </div>
                    <div class="flex items-center gap-1.5 text-slate-500 mt-1">
                      <Calendar :size="10" />
                      {{
                        act.is_continuous_event
                          ? "สิ้นสุด: -"
                          : act.end_date
                            ? formatDateThai(act.end_date)
                            : "-"
                      }}
                    </div>
                  </div>
                </td>
                <td class="p-4 text-center">
                  <span
                    v-if="getCountdown(act)"
                    class="px-2 py-1 bg-orange-50 text-orange-600 text-[11px] font-bold rounded-lg border border-orange-100"
                  >
                    {{ getCountdown(act) }}
                  </span>
                  <span v-else class="text-slate-300 text-xs">—</span>
                </td>
                <td
                  class="p-4 text-center sticky right-0 bg-white z-10 border-l border-slate-50"
                >
                  <button
                    @click.stop="toggleMenu(act.id, $event)"
                    class="p-2 text-slate-400 hover:text-orange-500 transition-colors"
                  >
                    <MoreVertical :size="18" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="h-32"></div>
        <!-- Space for dropdown menus -->
      </div>
      <!-- ── Preview Mode: จำลองหน้าผู้ใช้จริง ─────────────────────────────── -->
      <div v-else-if="viewMode === 'preview'" class="animate-in">
        <!-- User-Style Grid -->
        <div class="preview-grid">
          <div
            v-for="act in paginatedActivities"
            :key="act.id"
            class="preview-card relative"
            :class="{
              'is-draft': act.is_active === false || act.status === 'draft',
            }"
          >
            <!-- Top Right Admin Action Button -->
            <div class="absolute top-2 right-2 z-30">
              <button
                @click.stop="toggleMenu(act.id, $event)"
                class="rounded-full bg-white flex items-center justify-center text-slate-500 hover:text-orange-500 hover:bg-orange-50 hover:border-orange-200 transition-all border border-slate-200 shadow-sm flex-shrink-0"
                style="
                  width: 36px;
                  height: 36px;
                  min-width: 36px;
                  min-height: 36px;
                  padding: 0;
                "
              >
                <Pencil :size="16" />
              </button>
            </div>

            <!-- Image Box — identical to user view -->
            <div class="preview-img-box" @click="previewActivity(act)">
              <img v-if="act.poster" :src="act.poster" :alt="act.title" />
              <div v-else class="preview-img-fallback">
                <ImageIcon :size="36" class="text-slate-300" />
              </div>
              <!-- Status badge (mirrors user dark-badge) -->
              <div
                class="preview-dark-badge"
                :class="getActivityStatus(act).class"
              >
                {{ getActivityStatus(act).label }}
              </div>
              <!-- Draft overlay -->
              <div
                v-if="act.is_active === false || act.status === 'draft'"
                class="preview-draft-overlay"
              >
                <span class="preview-draft-label">DRAFT — ผู้ใช้ไม่เห็น</span>
              </div>
            </div>
            <!-- Info box — mirrors user info-box -->
            <div class="preview-info-box">
              <h4 class="preview-title" :title="act.title">{{ act.title }}</h4>
              <div class="preview-meta text-primary">
                <Clock :size="13" />
                <span
                  >รับสมัคร:
                  {{
                    act.is_continuous_registration
                      ? "เปิดถาวร"
                      : act.registration_end_date
                        ? formatDateThai(act.registration_end_date)
                        : "ไม่ระบุ"
                  }}</span
                >
              </div>
              <div class="preview-meta text-gray">
                <CalendarDays :size="13" />
                <span
                  >จัดกิจกรรม:
                  {{
                    act.is_continuous_event
                      ? "ต่อเนื่อง"
                      : act.start_date
                        ? formatDateThai(act.start_date)
                        : "ไม่ระบุ"
                  }}</span
                >
              </div>
              <div class="preview-meta text-gray mt-1">
                <Users2 :size="13" />
                <span v-if="act.is_unlimited_max_slots">รับจำนวนไม่จำกัด</span>
                <span v-else
                  >เข้าร่วมแล้ว {{ act.registration_count || 0 }} /
                  {{ act.max_slots || 0 }} คน</span
                >
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- Pagination Controls -->
      <div
        v-if="totalPages > 1"
        class="flex items-center justify-center gap-2 pt-4 pb-4"
      >
        <button
          @click="setPage(dtCurrentPage - 1)"
          :disabled="dtCurrentPage === 1"
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
              dtCurrentPage === p
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
          @click="setPage(dtCurrentPage + 1)"
          :disabled="dtCurrentPage === totalPages"
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
      <!-- Shared Popup Menu via Teleport — works in both table & preview modes -->
      <!-- Shared Popup Menu via Teleport — works in both table & preview modes -->
      <Teleport to="body">
        <div v-if="activeMenuId !== null && activeMenuAct">
          <!-- Invisible backdrop for closing -->
          <div
            @click="activeMenuId = null"
            class="fixed inset-0 z-[9998]"
          ></div>
          <div
            class="fixed z-[9999] w-64 bg-white border border-slate-200 shadow-2xl rounded-2xl flex flex-col overflow-hidden transition-all duration-200 animate-in fade-in zoom-in-95"
            :style="{
              top: menuPos.top + 'px',
              ...(menuPos.left !== null ? { left: menuPos.left + 'px' } : {}),
              ...(menuPos.right !== null
                ? { right: menuPos.right + 'px' }
                : {}),
              transform: menuPos.transform,
            }"
            @click.stop
          >
            <!-- เพิ่มความสูง max-h นิดหน่อยเพื่อให้แสดงหมวดหมู่ได้ครอบคลุมขึ้น -->
            <div class="overflow-y-auto max-h-[380px] custom-scrollbar py-2">
              <!-- 1. จัดการทั่วไป -->
              <div class="px-4 py-2 mb-1 border-b border-slate-50">
                <p
                  class="text-[10px] font-bold text-slate-400 uppercase tracking-wider"
                >
                  จัดการทั่วไป
                </p>
              </div>
              <button
                @click="
                  editActivity(activeMenuAct);
                  activeMenuId = null;
                "
                :disabled="formSubmitting"
                class="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-3 disabled:opacity-50"
              >
                <div class="p-1.5 bg-slate-100 rounded-lg text-slate-500">
                  <Pencil :size="16" />
                </div>
                แก้ไขข้อมูล
              </button>
              <button
                @click="
                  openCertEditorDirect(activeMenuAct.id);
                  activeMenuId = null;
                "
                class="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-purple-50 hover:text-purple-600 transition-colors flex items-center gap-3"
              >
                <div class="p-1.5 bg-purple-100/50 rounded-lg text-purple-500">
                  <ShieldCheck :size="16" />
                </div>
                จัดการใบประกาศ
              </button>
              <button
                @click="
                  previewActivity(activeMenuAct);
                  activeMenuId = null;
                "
                class="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-3"
              >
                <div class="p-1.5 bg-slate-100 rounded-lg text-slate-500">
                  <ExternalLink :size="16" />
                </div>
                ดูหน้าเว็บผู้ใช้
              </button>
              <button
                @click="
                  viewActivityDetails(activeMenuAct);
                  activeMenuId = null;
                "
                class="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-3"
              >
                <div class="p-1.5 bg-slate-100 rounded-lg text-slate-500">
                  <Eye :size="16" />
                </div>
                ดูสถิติ/หลังบ้าน
              </button>
              <!-- 2. เครื่องมือด่วนและการทำซ้ำ -->
              <div class="px-4 py-2 mt-2 mb-1 border-b border-slate-50">
                <p
                  class="text-[10px] font-bold text-slate-400 uppercase tracking-wider"
                >
                  เครื่องมือด่วน
                </p>
              </div>
              <button
                @click="
                  duplicateActivity(activeMenuAct);
                  activeMenuId = null;
                "
                :disabled="adminSubmitting"
                class="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-orange-50 hover:text-orange-600 transition-colors flex items-center gap-3 disabled:opacity-50"
              >
                <div class="p-1.5 bg-orange-100/50 rounded-lg text-orange-500">
                  <Loader2
                    v-if="adminSubmitting"
                    class="animate-spin"
                    :size="16"
                  />
                  <Copy v-else :size="16" />
                </div>
                คัดลอกกิจกรรม
              </button>
              <button
                @click="
                  duplicateMultipleActivities(activeMenuAct);
                  activeMenuId = null;
                "
                :disabled="adminSubmitting"
                class="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-purple-50 hover:text-purple-600 transition-colors flex items-center gap-3 disabled:opacity-50"
              >
                <div class="p-1.5 bg-purple-100/50 rounded-lg text-purple-500">
                  <Loader2
                    v-if="adminSubmitting"
                    class="animate-spin"
                    :size="16"
                  />
                  <Copy v-else :size="16" />
                </div>
                คัดลอกหลายฉบับ
              </button>
              <!-- 3. การส่งออกข้อมูล -->
              <div class="px-4 py-2 mt-2 mb-1 border-b border-slate-50">
                <p
                  class="text-[10px] font-bold text-slate-400 uppercase tracking-wider"
                >
                  การส่งออกข้อมูล
                </p>
              </div>
              <button
                @click="
                  exportFullReport(activeMenuAct);
                  activeMenuId = null;
                "
                class="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 transition-colors flex items-center gap-3"
              >
                <div
                  class="p-1.5 bg-emerald-100/50 rounded-lg text-emerald-500"
                >
                  <FileText :size="16" />
                </div>
                ส่งออกรายงานกิจกรรม (.xlsx)
              </button>
              <button
                @click="
                  exportParticipants(activeMenuAct);
                  activeMenuId = null;
                "
                class="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-3"
              >
                <div class="p-1.5 bg-blue-100/50 rounded-lg text-blue-500">
                  <Download :size="16" />
                </div>
                ส่งออกรายชื่อ (.csv)
              </button>
              <!-- 4. การจัดการสถานะ -->
              <div class="px-4 py-2 mt-2 mb-1 border-b border-slate-50">
                <p
                  class="text-[10px] font-bold text-slate-400 uppercase tracking-wider"
                >
                  การจัดการสถานะ
                </p>
              </div>
              <button
                @click="
                  toggleStatus(activeMenuAct.id);
                  activeMenuId = null;
                "
                :disabled="adminSubmitting"
                class="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 transition-colors flex items-center gap-3 disabled:opacity-50"
              >
                <div
                  class="p-1.5 bg-emerald-100/50 rounded-lg text-emerald-500"
                >
                  <Loader2
                    v-if="adminSubmitting"
                    :size="16"
                    class="animate-spin"
                  />
                  <template v-else>
                    <EyeOff
                      v-if="activeMenuAct.is_active !== false"
                      :size="16"
                    />
                    <Eye v-else :size="16" />
                  </template>
                </div>
                {{
                  activeMenuAct.is_active !== false
                    ? "ซ่อนกิจกรรม"
                    : "เปิดแสดงกิจกรรม"
                }}
              </button>
              <button
                @click="
                  deleteActivity(activeMenuAct.id);
                  activeMenuId = null;
                "
                :disabled="adminSubmitting"
                class="w-full px-4 py-2.5 text-left text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-3 disabled:opacity-50"
              >
                <div class="p-1.5 bg-rose-100/50 rounded-lg text-rose-500">
                  <Loader2
                    v-if="adminSubmitting"
                    :size="16"
                    class="animate-spin"
                  />
                  <Trash2 v-else :size="16" />
                </div>
                {{ adminSubmitting ? "กำลังลบ..." : "ลบกิจกรรมถาวร" }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </div>
    <AdminActivityDashboard
      v-else-if="activeTab === 'dashboard' && editingId !== null"
      :activity-id="editingId"
      :activity-title="form.title"
      @back="handleBack"
    />
    <div
      v-else-if="activeTab === 'form'"
      class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8 mt-2"
    >
      <form @submit.prevent="saveActivity" class="space-y-6 md:space-y-8">
        <div class="bg-white p-6 md:p-8 rounded-3xl border border-slate-200">
          <div class="flex items-center gap-3 mb-8">
            <FileText :size="22" class="text-orange-500" />
            <h3 class="text-lg font-bold text-slate-900">
              ข้อมูลหลักและโปสเตอร์
            </h3>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12">
            <div class="md:col-span-4 flex flex-col items-center">
              <label
                class="relative group aspect-square w-full max-w-[280px] bg-white border-2 border-dashed border-slate-200 rounded-3xl overflow-hidden flex flex-col items-center justify-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/50 transition-all"
                :class="{ 'border-solid border-slate-200': form.poster }"
                @dragover="handleDragOver"
                @dragleave="handleDragLeave"
                @drop="handleDrop"
              >
                <input
                  type="file"
                  class="absolute inset-0 opacity-0 cursor-pointer z-10"
                  accept="image/*"
                  @change="handlePosterUpload"
                />
                <img
                  v-if="form.poster"
                  :src="form.poster"
                  class="absolute inset-0 w-full h-full object-cover"
                />
                <div v-else-if="!uploading" class="text-center p-4">
                  <ImageIcon
                    :size="44"
                    class="mx-auto mb-3 text-slate-300 group-hover:text-orange-500 transition-colors"
                  />
                  <span class="text-sm font-bold text-slate-500 block"
                    >อัปโหลดโปสเตอร์</span
                  >
                </div>
                <div v-else class="text-center p-4">
                  <Loader2
                    class="animate-spin text-orange-500 mx-auto mb-2"
                    :size="24"
                  /><span class="text-sm text-slate-600">กำลังอัปโหลด...</span>
                </div>
              </label>
              <p
                class="text-xs text-slate-400 mt-4 text-center leading-relaxed"
              >
                แนะนำสี่เหลี่ยมจัตุรัส 1080 x 1080 px<br />ขนาดไฟล์ไม่เกิน 5MB
              </p>
            </div>
            <div class="md:col-span-8 space-y-6">
              <div>
                <label class="text-[13px] font-bold text-slate-600 block mb-2"
                  >ชื่อกิจกรรม <span class="text-rose-500">*</span></label
                >
                <input
                  v-model="form.title"
                  type="text"
                  class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-orange-500 outline-none text-sm text-slate-900 transition-all font-bold placeholder-slate-400"
                  placeholder="ตั้งชื่อกิจกรรมของคุณ..."
                  required
                />
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label class="text-[13px] font-bold text-slate-600 block mb-2"
                    >ผู้จัด / หน่วยงาน</label
                  >
                  <input
                    v-model="form.organizer"
                    type="text"
                    class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-orange-500 outline-none text-sm text-slate-900 transition-all font-bold placeholder-slate-400"
                    placeholder="เช่น ชมรมเดินวิ่ง..."
                  />
                </div>
                <div>
                  <label class="text-[13px] font-bold text-slate-600 block mb-2"
                    >สถานที่</label
                  >
                  <input
                    v-model="form.location_name"
                    type="text"
                    class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-orange-500 outline-none text-sm text-slate-900 transition-all font-bold placeholder-slate-400"
                    placeholder="เช่น สวนลุมพินี / ออนไลน์"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="bg-white p-6 md:p-8 rounded-3xl border border-slate-200">
          <div class="flex items-center gap-3 mb-8">
            <Calendar :size="22" class="text-orange-500" />
            <h3 class="text-lg font-bold text-slate-900">
              วันเวลาและจำนวนรับสมัคร
            </h3>
          </div>
          <div class="space-y-8 max-w-3xl mx-auto">
            <div class="flex flex-col gap-3">
              <div
                class="flex flex-col sm:flex-row sm:items-center justify-between py-2"
              >
                <div class="flex-1 mb-2 sm:mb-0">
                  <span class="font-bold text-slate-800 text-[15px]"
                    >กำหนดช่วงวันรับสมัคร (Manual)</span
                  >
                </div>
                <div class="flex items-center sm:justify-end">
                  <label
                    class="relative inline-flex items-center cursor-pointer shrink-0"
                  >
                    <input
                      type="checkbox"
                      :checked="!form.is_continuous_registration"
                      @change="
                        form.is_continuous_registration = !(
                          $event.target as any
                        ).checked
                      "
                      class="sr-only peer"
                    />
                    <div
                      class="w-12 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0 after:left-0 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all after:shadow-sm peer-checked:bg-orange-500"
                    ></div>
                  </label>
                </div>
              </div>
              <transition name="fade">
                <div
                  v-if="!form.is_continuous_registration"
                  class="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 pb-4"
                >
                  <div>
                    <label class="text-xs font-bold text-slate-500 block mb-2"
                      >วันเปิดรับสมัคร</label
                    >
                    <input
                      v-model="form.registration_start_date"
                      type="date"
                      class="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none text-sm font-medium text-slate-800 focus:border-orange-500 transition-all"
                    />
                  </div>
                  <div>
                    <label class="text-xs font-bold text-slate-500 block mb-2"
                      >วันปิดรับสมัคร</label
                    >
                    <input
                      v-model="form.registration_end_date"
                      type="date"
                      :min="form.registration_start_date"
                      class="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none text-sm font-medium text-slate-800 focus:border-orange-500 transition-all"
                    />
                  </div>
                </div>
              </transition>
            </div>
            <div class="h-px bg-slate-100 w-full"></div>
            <div class="flex flex-col gap-3">
              <div
                class="flex flex-col sm:flex-row sm:items-center justify-between py-2"
              >
                <div class="flex-1 mb-2 sm:mb-0">
                  <span class="font-bold text-slate-800 text-[15px]"
                    >ระบุวันจัดกิจกรรมเอง (Manual)</span
                  >
                </div>
                <div class="flex items-center sm:justify-end">
                  <label
                    class="relative inline-flex items-center cursor-pointer shrink-0"
                  >
                    <input
                      type="checkbox"
                      :checked="!form.is_continuous_event"
                      @change="
                        form.is_continuous_event = !($event.target as any)
                          .checked
                      "
                      class="sr-only peer"
                    />
                    <div
                      class="w-12 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0 after:left-0 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all after:shadow-sm peer-checked:bg-orange-500"
                    ></div>
                  </label>
                </div>
              </div>
              <transition name="fade">
                <div
                  v-if="!form.is_continuous_event"
                  class="space-y-5 pt-2 pb-4"
                >
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label class="text-xs font-bold text-slate-500 block mb-2"
                        >วันเริ่ม</label
                      >
                      <input
                        v-model="form.start_date"
                        type="date"
                        class="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none text-sm font-medium text-slate-800 focus:border-orange-500 transition-all"
                      />
                    </div>
                    <div>
                      <label class="text-xs font-bold text-slate-500 block mb-2"
                        >เวลา</label
                      >
                      <input
                        v-model="form.start_time"
                        type="time"
                        class="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-orange-500 transition-all"
                      />
                    </div>
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label class="text-xs font-bold text-slate-500 block mb-2"
                        >วันสิ้นสุด</label
                      >
                      <input
                        v-model="form.end_date"
                        type="date"
                        :min="form.start_date"
                        class="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none text-sm font-medium text-slate-800 focus:border-orange-500 transition-all"
                      />
                    </div>
                    <div>
                      <label class="text-xs font-bold text-slate-500 block mb-2"
                        >เวลา</label
                      >
                      <input
                        v-model="form.end_time"
                        type="time"
                        class="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-orange-500 transition-all"
                      />
                    </div>
                  </div>
                </div>
              </transition>
            </div>
            <div class="h-px bg-slate-100 w-full"></div>
            <div class="flex flex-col gap-3">
              <div
                class="flex flex-col sm:flex-row sm:items-center justify-between py-2"
              >
                <div class="flex-1">
                  <span class="font-bold text-slate-800 text-[15px]"
                    >จำกัดจำนวนผู้เข้าร่วมสูงสุด</span
                  >
                </div>
                <div class="w-12 flex-shrink-0 flex justify-end">
                  <label
                    class="relative inline-flex items-center cursor-pointer shrink-0"
                  >
                    <input
                      type="checkbox"
                      :checked="!form.is_unlimited_max_slots"
                      @change="
                        form.is_unlimited_max_slots = !($event.target as any)
                          .checked
                      "
                      class="sr-only peer"
                    />
                    <div
                      class="w-12 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0 after:left-0 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all after:shadow-sm peer-checked:bg-orange-500"
                    ></div>
                  </label>
                </div>
              </div>
              <transition name="fade">
                <div
                  v-if="!form.is_unlimited_max_slots"
                  class="pt-2 pb-4 w-full"
                >
                  <input
                    v-model.number="form.max_slots"
                    type="number"
                    class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none text-base font-bold text-slate-800 focus:border-orange-500 transition-all text-center"
                    placeholder="ระบุจำนวนคนสูงสุด..."
                  />
                </div>
              </transition>
            </div>
          </div>
        </div>
        <div class="bg-white p-6 md:p-8 rounded-3xl border border-slate-200">
          <div
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
          >
            <div class="flex items-center gap-3 flex-1">
              <LayoutGrid :size="22" class="text-orange-500" />
              <h3 class="text-lg font-bold text-slate-900">วิดเจ็ตและภารกิจ</h3>
            </div>
            <div class="flex items-center gap-6">
              <button
                type="button"
                @click="addTask()"
                class="text-orange-600 hover:text-orange-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-colors border border-orange-200"
              >
                <Plus :size="16" stroke-width="2.5" /> เพิ่มภารกิจใหม่
              </button>
              <div class="w-12 flex-shrink-0"></div>
              <!-- Placeholder for alignment with toggle rows -->
            </div>
          </div>
          <div class="mb-10">
            <div v-if="form.tasks.length > 0">
              <div class="flex overflow-x-auto no-scrollbar gap-2.5 mb-8 p-1">
                <div
                  v-for="item in displayedTasks"
                  :key="item.origIdx"
                  class="flex items-center gap-2 px-6 py-2.5 text-sm font-bold cursor-pointer transition-all rounded-full border whitespace-nowrap"
                  :class="
                    activeTaskIdx === item.origIdx
                      ? 'bg-orange-500 border-orange-500 text-white'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-500'
                  "
                  draggable="true"
                  @click="
                    onTaskTabClick(item.origIdx);
                    hoveringHandleIdx = null;
                  "
                  @dragstart="onTaskTabDragStart($event, item.origIdx)"
                  @dragover="onTaskTabDragOver($event, item.origIdx)"
                  @dragleave="onTaskTabDragLeave"
                  @drop="onTaskTabDrop(item.origIdx)"
                  @dragend="onTaskTabDragEnd"
                >
                  <span>{{
                    item.task.title || `ภารกิจ ${item.displayNum}`
                  }}</span>
                </div>
              </div>
              <div
                v-if="form.tasks[activeTaskIdx]"
                class="bg-white border border-slate-100 rounded-2xl p-6"
              >
                <div class="space-y-6">
                  <div class="flex flex-col md:flex-row gap-6">
                    <div class="flex-1">
                      <label
                        class="text-[13px] font-bold text-slate-600 block mb-2"
                        >ชื่อภารกิจ</label
                      >
                      <input
                        v-model="form.tasks[activeTaskIdx].title"
                        type="text"
                        :placeholder="'ภารกิจ ' + (activeTaskIdx + 1)"
                        class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none text-sm font-bold text-slate-900 focus:border-orange-500 transition-all"
                      />
                    </div>
                    <div class="w-full md:w-40">
                      <label
                        class="text-[13px] font-bold text-slate-600 block mb-2 md:text-center"
                        >แต้มที่ได้รับ / ครั้ง</label
                      >
                      <input
                        v-model.number="form.tasks[activeTaskIdx].points"
                        type="number"
                        min="1"
                        class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none text-sm font-bold text-orange-600 text-center focus:border-orange-500 transition-all"
                      />
                    </div>
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label
                        class="text-[13px] font-bold text-slate-600 block mb-2"
                        >รูปแบบการส่ง</label
                      >
                      <div
                        class="custom-dropdown relative bg-white border border-slate-200 rounded-xl"
                      >
                        <button
                          type="button"
                          @click="
                            toggleDropdown('sub_type_' + activeTaskIdx, $event)
                          "
                          class="w-full px-4 py-3 text-left text-sm font-bold text-slate-800 flex items-center justify-between hover:bg-slate-50 transition-all rounded-xl"
                        >
                          <span>{{
                            submissionOptions.find(
                              (o) =>
                                o.value ===
                                form.tasks[activeTaskIdx].submission_type,
                            )?.label
                          }}</span>
                          <ChevronDown
                            :size="16"
                            class="text-slate-400 transition-transform duration-300"
                            :class="{
                              'rotate-180':
                                activeDropdown === 'sub_type_' + activeTaskIdx,
                            }"
                          />
                        </button>
                        <div
                          v-if="activeDropdown === 'sub_type_' + activeTaskIdx"
                          :class="
                            dropdownDirection === 'up'
                              ? 'bottom-full mb-1'
                              : 'top-full mt-1'
                          "
                          class="absolute left-0 right-0 z-[100] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in"
                        >
                          <div
                            v-for="s in submissionOptions"
                            :key="s.value"
                            @click="
                              form.tasks[activeTaskIdx].submission_type =
                                s.value;
                              activeDropdown = null;
                            "
                            class="px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-orange-600 cursor-pointer transition-all border-b border-slate-50 last:border-0 flex items-center justify-between"
                            :class="{
                              'text-orange-600 font-bold':
                                form.tasks[activeTaskIdx].submission_type ===
                                s.value,
                            }"
                          >
                            {{ s.label }}
                            <Check
                              v-if="
                                form.tasks[activeTaskIdx].submission_type ===
                                s.value
                              "
                              :size="16"
                              stroke-width="3"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label
                        class="text-[13px] font-bold text-slate-600 block mb-2"
                        >หน่วยวัด (Unit)</label
                      >
                      <div
                        class="custom-dropdown relative bg-white border border-slate-200 rounded-xl"
                      >
                        <button
                          type="button"
                          @click="
                            toggleDropdown('unit_' + activeTaskIdx, $event)
                          "
                          class="w-full px-4 py-3 text-left text-sm font-bold text-slate-800 flex items-center justify-between hover:bg-slate-50 transition-all rounded-xl"
                        >
                          <span>{{
                            flatUnits.find(
                              (o) =>
                                o.value ===
                                form.tasks[activeTaskIdx].metric_unit,
                            )?.label ||
                            form.tasks[activeTaskIdx].metric_unit ||
                            "เลือกหน่วยวัด"
                          }}</span>
                          <ChevronDown
                            :size="16"
                            class="text-slate-400 transition-transform duration-300"
                            :class="{
                              'rotate-180':
                                activeDropdown === 'unit_' + activeTaskIdx,
                            }"
                          />
                        </button>
                        <div
                          v-if="activeDropdown === 'unit_' + activeTaskIdx"
                          :class="
                            dropdownDirection === 'up'
                              ? 'bottom-full mb-1'
                              : 'top-full mt-1'
                          "
                          class="absolute left-0 right-0 z-[100] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden flex flex-col animate-in"
                        >
                          <!-- รายการหน่วยที่มีให้เลือก -->
                          <div
                            class="overflow-y-auto max-h-[220px] no-scrollbar"
                          >
                            <div
                              v-for="u in flatUnits"
                              :key="u.value"
                              @click="
                                form.tasks[activeTaskIdx].metric_unit = u.value;
                                activeDropdown = null;
                              "
                              class="px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-orange-600 cursor-pointer transition-all border-b border-slate-50 last:border-0 flex items-center justify-between"
                              :class="{
                                'text-orange-600 font-bold':
                                  form.tasks[activeTaskIdx].metric_unit ===
                                  u.value,
                              }"
                            >
                              {{ u.label }}
                              <Check
                                v-if="
                                  form.tasks[activeTaskIdx].metric_unit ===
                                  u.value
                                "
                                :size="16"
                                stroke-width="3"
                              />
                            </div>
                          </div>
                          <!-- ส่วนระบุเอง — @click.stop ป้องกัน click-outside ปิด dropdown -->
                          <div
                            class="p-3 bg-orange-50/50 border-t border-orange-100"
                            @click.stop
                          >
                            <p
                              class="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-2 ml-1"
                            >
                              หรือระบุหน่วยใหม่
                            </p>
                            <div class="relative">
                              <input
                                type="text"
                                placeholder="เช่น แก้ว, รอบ, เซต..."
                                class="w-full pl-3 pr-10 py-2.5 bg-white border border-orange-200 rounded-xl text-xs font-bold outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all placeholder-slate-300"
                                @keyup.enter="activeDropdown = null"
                                @click.stop
                                v-model="form.tasks[activeTaskIdx].metric_unit"
                              />
                              <button
                                type="button"
                                @click.stop="activeDropdown = null"
                                class="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-orange-500 text-white rounded-lg flex items-center justify-center hover:bg-orange-600 transition-all shadow-sm active:scale-95"
                              >
                                <Check :size="14" stroke-width="4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <!-- Option for OCR Verification -->
                  <transition name="fade">
                    <div
                      v-if="
                        form.tasks[activeTaskIdx].submission_type === 'photo' ||
                        form.tasks[activeTaskIdx].submission_type === 'both'
                      "
                      class="p-4 bg-orange-50/50 border border-orange-100 rounded-2xl flex items-center justify-between gap-4 animate-in slide-in-from-top-1 mb-4"
                    >
                      <div class="flex items-center gap-3">
                        <div
                          class="p-2 bg-orange-100 rounded-xl text-orange-600"
                        >
                          <Eye :size="18" />
                        </div>
                        <div>
                          <p class="text-xs font-black text-slate-700">
                            ใช้ OCR ในการตรวจสอบภาพภารกิจ
                          </p>
                          <p class="text-[10px] text-slate-400 mt-0.5">
                            ระบบจะใช้ AI ตรวจจับวิเคราะห์ตัวเลขและตัวอักษรในภาพ
                            (เช่น รูปหน้าจอแอปวิ่ง/ผลการออกกำลังกาย)
                          </p>
                        </div>
                      </div>
                      <label
                        class="relative inline-flex items-center cursor-pointer shrink-0"
                      >
                        <input
                          type="checkbox"
                          v-model="form.tasks[activeTaskIdx].use_ocr"
                          class="sr-only peer"
                        />
                        <div
                          class="w-12 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0 after:left-0 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all after:shadow-sm peer-checked:bg-orange-500"
                        ></div>
                      </label>
                    </div>
                  </transition>
                  <div class="pt-2">
                    <label
                      class="text-[13px] font-bold text-slate-600 block mb-3"
                      >วันที่อนุญาตให้ส่งผล (Allowed Days)</label
                    >
                    <div class="flex flex-wrap gap-2">
                      <button
                        v-for="(dayName, dIdx) in [
                          'อา',
                          'จ',
                          'อ',
                          'พ',
                          'พฤ',
                          'ศ',
                          'ส',
                        ]"
                        :key="dIdx"
                        type="button"
                        @click="toggleDay(form.tasks[activeTaskIdx], dIdx)"
                        class="w-10 h-10 rounded-full font-bold text-sm transition-colors flex items-center justify-center border"
                        :class="
                          form.tasks[activeTaskIdx].allowed_days.includes(dIdx)
                            ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-orange-300 hover:text-orange-500'
                        "
                      >
                        {{ dayName }}
                      </button>
                    </div>
                    <div class="flex flex-wrap gap-3 mt-3">
                      <button
                        type="button"
                        @click="setDayPreset(form.tasks[activeTaskIdx], 'all')"
                        class="text-[12px] font-bold text-slate-500 hover:text-orange-600 bg-slate-100 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-orange-200"
                      >
                        ทุกวัน
                      </button>
                      <button
                        type="button"
                        @click="
                          setDayPreset(form.tasks[activeTaskIdx], 'weekday')
                        "
                        class="text-[12px] font-bold text-slate-500 hover:text-orange-600 bg-slate-100 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-orange-200"
                      >
                        จันทร์ - ศุกร์
                      </button>
                      <button
                        type="button"
                        @click="
                          setDayPreset(form.tasks[activeTaskIdx], 'weekend')
                        "
                        class="text-[12px] font-bold text-slate-500 hover:text-orange-600 bg-slate-100 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-orange-200"
                      >
                        เสาร์ - อาทิตย์
                      </button>
                    </div>
                  </div>
                  <div
                    class="flex justify-end pt-4 mt-2 border-t border-slate-100"
                  >
                    <button
                      type="button"
                      @click="removeTask(activeTaskIdx)"
                      class="text-rose-500 hover:text-rose-600 font-bold text-sm flex items-center gap-2 transition-colors"
                    >
                      <Trash2 :size="16" /> ลบภารกิจนี้
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div
              v-else
              class="py-12 text-center bg-slate-50 border border-dashed border-slate-300 rounded-3xl"
            >
              <Target :size="36" class="text-slate-300 mx-auto mb-3" />
              <p class="text-base font-bold text-slate-600">
                กิจกรรมนี้ยังไม่มีภารกิจ
              </p>
              <p class="text-sm text-slate-400 mt-1">
                กดเพิ่มภารกิจใหม่เพื่อกำหนดเงื่อนไข
              </p>
            </div>
          </div>
        </div>
        <!-- ระบบเกียรติบัตร -->
        <div class="bg-white border border-slate-200 rounded-3xl p-6 mb-6">
          <div
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div class="flex items-center gap-4 flex-1">
              <div class="p-2.5 bg-amber-50 rounded-xl">
                <Palette class="text-amber-500" :size="22" />
              </div>
              <p class="font-bold text-[15px] text-slate-800">
                ระบบเกียรติบัตร
              </p>
            </div>
            <div class="flex items-center gap-6">
              <button
                v-if="form.certificate_config.enabled"
                type="button"
                @click="openCertificateEditor"
                class="text-orange-600 hover:text-orange-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-orange-200"
              >
                <Palette :size="14" /> ออกแบบเกียรติบัตร
              </button>
              <div class="w-12 flex-shrink-0 flex justify-end">
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    v-model="form.certificate_config.enabled"
                    class="sr-only peer"
                  />
                  <div
                    class="w-12 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0 after:left-0 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-[#F05A23]"
                  ></div>
                </label>
              </div>
            </div>
          </div>
          <transition name="fade">
            <div
              v-if="form.certificate_config.enabled"
              class="mt-4 pl-0 sm:pl-[3.25rem] animate-in"
            >
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  class="flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all"
                  :class="
                    form.certificate_config.issue_mode === 'immediately'
                      ? 'bg-orange-50 border-orange-300 ring-2 ring-orange-100'
                      : 'bg-white border-slate-50 hover:border-orange-200'
                  "
                >
                  <input
                    type="radio"
                    value="immediately"
                    v-model="form.certificate_config.issue_mode"
                    class="sr-only"
                  />
                  <div
                    class="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                    :class="
                      form.certificate_config.issue_mode === 'immediately'
                        ? 'bg-orange-500 border-orange-500'
                        : 'border-slate-300 bg-white'
                    "
                  >
                    <div
                      v-if="
                        form.certificate_config.issue_mode === 'immediately'
                      "
                      class="w-2 h-2 bg-white rounded-full"
                    ></div>
                  </div>
                  <div class="flex flex-col min-w-0">
                    <span
                      class="text-sm font-bold truncate"
                      :class="
                        form.certificate_config.issue_mode === 'immediately'
                          ? 'text-orange-700'
                          : 'text-slate-700'
                      "
                      >รับทันที</span
                    >
                    <span class="text-[10px] text-slate-500"
                      >หลังลงทะเบียนสำเร็จ</span
                    >
                  </div>
                </label>
                <label
                  class="flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all"
                  :class="
                    form.certificate_config.issue_mode === 'goal_complete'
                      ? 'bg-orange-50 border-orange-300 ring-2 ring-orange-100'
                      : 'bg-white border-slate-50 hover:border-orange-200'
                  "
                >
                  <input
                    type="radio"
                    value="goal_complete"
                    v-model="form.certificate_config.issue_mode"
                    class="sr-only"
                  />
                  <div
                    class="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                    :class="
                      form.certificate_config.issue_mode === 'goal_complete'
                        ? 'bg-orange-500 border-orange-500'
                        : 'border-slate-300 bg-white'
                    "
                  >
                    <div
                      v-if="
                        form.certificate_config.issue_mode === 'goal_complete'
                      "
                      class="w-2 h-2 bg-white rounded-full"
                    ></div>
                  </div>
                  <div class="flex flex-col min-w-0">
                    <span
                      class="text-sm font-bold truncate"
                      :class="
                        form.certificate_config.issue_mode === 'goal_complete'
                          ? 'text-orange-700'
                          : 'text-slate-700'
                      "
                      >เมื่อผ่านเป้า</span
                    >
                    <span class="text-[10px] text-slate-500"
                      >ทำภารกิจผ่านตามเกณฑ์</span
                    >
                  </div>
                </label>
              </div>
            </div>
          </transition>
        </div>
        <!-- ค่าองค์ประกอบของร่างกาย -->
        <div class="bg-white border border-slate-200 rounded-3xl p-6 mb-6">
          <div
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div class="flex items-center gap-4 flex-1">
              <div class="p-2.5 bg-orange-50 rounded-xl">
                <ClipboardCheck class="text-[#F05A23]" :size="22" />
              </div>
              <div>
                <p class="font-bold text-[15px] text-slate-800">
                  ค่าองค์ประกอบของร่างกาย
                </p>
                <p class="text-xs text-slate-500 mt-0.5">
                  ปัจจุบันกำหนดไว้ {{ form.tanita_dates.length }} รอบ
                </p>
              </div>
            </div>
            <div class="flex items-center gap-6">
              <button
                type="button"
                @click="
                  form.tanita_dates.push({
                    label: `เก็บค่าองค์ประกอบของร่างกายครั้งที่ ${form.tanita_dates.length + 1}`,
                    date: '',
                  })
                "
                class="text-orange-600 hover:text-orange-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-colors border border-orange-200"
              >
                <Plus :size="16" stroke-width="2.5" /> เพิ่มรอบการบันทึก
              </button>
              <div class="w-12 flex-shrink-0"></div>
            </div>
          </div>
          <transition name="fade">
            <div
              v-if="form.tanita_dates.length > 0"
              class="mt-6 space-y-4 pl-0 sm:pl-[3.25rem] animate-in"
            >
              <div
                v-for="(round, idx) in form.tanita_dates"
                :key="idx"
                class="flex flex-col sm:flex-row items-start sm:items-center gap-3"
              >
                <div class="flex-1 w-full flex items-center gap-2 sm:gap-3">
                  <span class="text-xs font-bold text-slate-400 w-5 text-right"
                    >{{ idx + 1 }}.</span
                  >
                  <input
                    v-model="round.label"
                    type="text"
                    class="w-full text-sm font-bold text-slate-900 bg-white border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:border-[#F05A23] transition-colors"
                    placeholder="เช่น ชั่งน้ำหนักครั้งที่ 1"
                  />
                </div>
                <div
                  class="flex items-center w-full sm:w-auto gap-2 sm:gap-3 pl-7 sm:pl-0"
                >
                  <input
                    v-model="round.date"
                    type="date"
                    class="w-full sm:w-auto text-sm font-bold text-slate-700 bg-white border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:border-[#F05A23] transition-colors"
                  />
                  <button
                    type="button"
                    @click="form.tanita_dates.splice(idx, 1)"
                    class="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors flex-shrink-0"
                  >
                    <Trash2 :size="16" />
                  </button>
                </div>
              </div>
              <p class="text-xs text-slate-500 mt-2 ml-1">
                <span class="font-bold text-orange-500">* หมายเหตุ:</span>
                หากไม่กำหนดวันที่ (เว้นว่างไว้)
                ผู้เข้าร่วมจะสามารถส่งค่าได้ตลอดเวลาตั้งแต่เริ่มกิจกรรม
              </p>
            </div>
          </transition>
        </div>
        <!-- แบบทดสอบ -->
        <div class="bg-white border border-slate-200 rounded-3xl p-6 mb-6">
          <div
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div class="flex items-center gap-4 flex-1">
              <div class="p-2.5 bg-rose-50 rounded-xl">
                <FileText class="text-rose-500" :size="22" />
              </div>
              <p class="font-bold text-[15px] text-slate-800">
                แบบทดสอบก่อนเริ่ม (Pre-test)
              </p>
            </div>
            <div class="flex items-center gap-6">
              <div class="flex-1"></div>
              <div class="w-12 flex-shrink-0 flex justify-end">
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    v-model="form.assessment_config.pre_test.enabled"
                    class="sr-only peer"
                  />
                  <div
                    class="w-12 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0 after:left-0 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-orange-500"
                  ></div>
                </label>
              </div>
            </div>
          </div>
        </div>
        <div class="bg-white border border-slate-200 rounded-3xl p-6 mb-8">
          <div
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div class="flex items-center gap-4 flex-1">
              <div class="p-2.5 bg-rose-50 rounded-xl">
                <FileText class="text-rose-500" :size="22" />
              </div>
              <p class="font-bold text-[15px] text-slate-800">
                แบบประเมินหลังจบ (Post-test)
              </p>
            </div>
            <div class="flex items-center gap-6">
              <div class="flex-1"></div>
              <div class="w-12 flex-shrink-0 flex justify-end">
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    v-model="form.assessment_config.post_test.enabled"
                    class="sr-only peer"
                  />
                  <div
                    class="w-12 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0 after:left-0 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-orange-500"
                  ></div>
                </label>
              </div>
            </div>
          </div>
        </div>
        <!-- ส่วนที่ 5: เงื่อนไขผู้เข้าร่วม -->
        <div class="bg-white p-6 md:p-8 rounded-3xl border border-slate-200">
          <div
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div class="flex items-center gap-3 flex-1">
              <ShieldCheck :size="22" class="text-orange-500" />
              <h3 class="text-lg font-bold text-slate-900">
                จำกัดกลุ่มผู้เข้าร่วม (Private)
              </h3>
            </div>
            <div class="w-12 flex-shrink-0 flex justify-end">
              <label
                class="relative inline-flex items-center cursor-pointer shrink-0"
              >
                <input
                  type="checkbox"
                  v-model="form.is_restricted"
                  class="sr-only peer"
                />
                <div
                  class="w-12 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0 after:left-0 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-orange-500"
                ></div>
              </label>
            </div>
          </div>
          <transition name="fade">
            <div
              v-if="form.is_restricted"
              class="space-y-6 animate-in slide-in-from-top-2"
            >
              <div class="py-5 space-y-6">
                <!-- 5.1 Header & Clear Actions -->
                <div
                  class="flex items-center justify-between gap-4 border-b border-slate-50 pb-4"
                >
                  <p
                    class="text-[11px] font-black text-orange-400 uppercase tracking-widest flex items-center gap-2"
                  >
                    <Filter :size="12" /> จำกัดกลุ่มที่เข้าร่วมได้
                  </p>
                  <button
                    v-if="
                      form.visibility.filter((v) => v !== 'general').length > 0
                    "
                    type="button"
                    @click="form.visibility = []"
                    class="text-[11px] font-black text-slate-300 hover:text-rose-500 transition-colors flex items-center gap-1.5 px-3 py-1.5 hover:bg-rose-50 rounded-lg"
                  >
                    <Trash2 :size="12" /> ล้างการเลือกทั้งหมด
                  </button>
                </div>
                <!-- 5.2 Selection Summary Chips (Top-aligned for better context) -->
                <transition name="fade">
                  <div
                    v-if="
                      form.visibility.filter((v) => v !== 'general').length > 0
                    "
                    class="flex flex-wrap items-center gap-2 p-3 rounded-2xl border border-slate-100/50"
                  >
                    <span
                      class="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1"
                      >เลือกไว้แล้ว:</span
                    >
                    <span
                      v-for="vid in form.visibility.filter(
                        (v) => v !== 'general',
                      )"
                      :key="vid"
                      class="inline-flex items-center gap-2 bg-white text-orange-600 text-[11px] font-black px-3.5 py-1.5 rounded-xl border border-orange-100 animate-in zoom-in-95"
                    >
                      {{ roles.find((r) => r.id === vid)?.name || vid }}
                      <button
                        type="button"
                        @click="
                          form.visibility = form.visibility.filter(
                            (v) => v !== vid,
                          )
                        "
                        class="text-slate-300 hover:text-rose-500 transition-colors"
                      >
                        <X :size="12" stroke-width="3" />
                      </button>
                    </span>
                  </div>
                </transition>
                <!-- 5.3 Primary Roles Selection Grid -->
                <div
                  class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
                >
                  <label
                    v-for="r in roles.filter(
                      (r) => r.category === 'บทบาทหลัก' && r.id !== 'general',
                    )"
                    :key="r.id"
                    class="flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all"
                    :class="
                      form.visibility.includes(r.id)
                        ? 'bg-white border-orange-400 ring-4 ring-orange-500/10'
                        : 'bg-white border-slate-100 hover:border-orange-200'
                    "
                  >
                    <input
                      type="checkbox"
                      :value="r.id"
                      v-model="form.visibility"
                      class="sr-only"
                    />
                    <div
                      class="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                      :class="
                        form.visibility.includes(r.id)
                          ? 'bg-orange-500 border-orange-500'
                          : 'border-slate-300 bg-white'
                      "
                    >
                      <div
                        v-if="form.visibility.includes(r.id)"
                        class="w-1.5 h-1.5 bg-white rounded-full"
                      ></div>
                    </div>
                    <span
                      class="text-xs font-bold"
                      :class="
                        form.visibility.includes(r.id)
                          ? 'text-orange-700'
                          : 'text-slate-600'
                      "
                      >{{ r.name }}</span
                    >
                  </label>
                </div>
                <!-- 5.4 Sub-filters (School, Uni, Faculty) -->
                <div class="space-y-6 pt-2">
                  <transition name="fade">
                    <div
                      v-if="showSchoolLevels"
                      class="pl-4 border-l-2 border-orange-200 animate-in slide-in-from-left-2"
                    >
                      <p
                        class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3"
                      >
                        ระดับชั้นเรียน
                      </p>
                      <div class="flex flex-wrap gap-2">
                        <label
                          v-for="r in roles.filter(
                            (r) => r.category === 'ระบุระดับชั้น',
                          )"
                          :key="r.id"
                          class="flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer text-[11px] font-black transition-all"
                          :class="
                            form.visibility.includes(r.id)
                              ? 'bg-orange-500 text-white border-orange-500'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'
                          "
                        >
                          <input
                            type="checkbox"
                            :value="r.id"
                            v-model="form.visibility"
                            class="sr-only"
                          />
                          {{ r.name }}
                        </label>
                      </div>
                    </div>
                  </transition>
                  <transition name="fade">
                    <div
                      v-if="showUniFilters"
                      class="pl-4 border-l-2 border-orange-200 space-y-4 animate-in slide-in-from-left-2"
                    >
                      <div>
                        <div class="flex items-center justify-between mb-3">
                          <p
                            class="text-[10px] font-bold text-slate-400 uppercase tracking-widest"
                          >
                            ชั้นปีมหาวิทยาลัย
                          </p>
                          <button
                            type="button"
                            @click="
                              toggleAllVisibility(
                                roles.filter(
                                  (r) => r.category === 'ระบุชั้นปี',
                                ),
                              )
                            "
                            class="text-[10px] font-black text-orange-500 hover:text-orange-700 transition-colors px-3 py-1.5 rounded-lg border border-orange-200"
                          >
                            เลือกทั้งหมด
                          </button>
                        </div>
                        <div class="flex flex-wrap gap-2">
                          <label
                            v-for="r in roles.filter(
                              (r) => r.category === 'ระบุชั้นปี',
                            )"
                            :key="r.id"
                            class="flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer text-[11px] font-black transition-all"
                            :class="
                              form.visibility.includes(r.id)
                                ? 'bg-orange-500 text-white border-orange-500'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'
                            "
                          >
                            <input
                              type="checkbox"
                              :value="r.id"
                              v-model="form.visibility"
                              class="sr-only"
                            />
                            {{ r.name }}
                          </label>
                        </div>
                      </div>
                    </div>
                  </transition>
                  <transition name="fade">
                    <div
                      v-if="showFacultyFilters"
                      class="pl-4 border-l-2 border-orange-200 animate-in slide-in-from-left-2"
                    >
                      <div class="flex items-center justify-between mb-3">
                        <p
                          class="text-[10px] font-bold text-slate-400 uppercase tracking-widest"
                        >
                          สำนักวิชา
                        </p>
                        <button
                          type="button"
                          @click="
                            toggleAllVisibility(
                              roles.filter(
                                (r) => r.category === 'ระบุสำนักวิชา',
                              ),
                            )
                          "
                          class="text-[10px] font-black text-orange-500 hover:text-orange-700 transition-colors px-3 py-1.5 rounded-lg border border-orange-200"
                        >
                          เลือกทั้งหมด
                        </button>
                      </div>
                      <div class="flex flex-wrap gap-2">
                        <label
                          v-for="r in roles.filter(
                            (r) => r.category === 'ระบุสำนักวิชา',
                          )"
                          :key="r.id"
                          class="flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer text-[11px] font-black transition-all"
                          :class="
                            form.visibility.includes(r.id)
                              ? 'bg-orange-500 text-white border-orange-500'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'
                          "
                        >
                          <input
                            type="checkbox"
                            :value="r.id"
                            v-model="form.visibility"
                            class="sr-only"
                          />
                          {{ r.name }}
                        </label>
                      </div>
                    </div>
                  </transition>
                </div>
                <!-- 5.6 Event Password (Bottom) -->
                <div class="pt-8 border-t border-slate-100">
                  <div class="flex items-center gap-3 mb-4">
                    <div
                      class="p-2.5 bg-white rounded-2xl border border-slate-100"
                    >
                      <Lock :size="18" class="text-orange-500" />
                    </div>
                    <div>
                      <p class="text-sm font-bold text-slate-700">
                        รหัสผ่านกิจกรรม
                        <span
                          class="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md uppercase ml-1 tracking-wider"
                          >ไม่บังคับ</span
                        >
                      </p>
                      <p class="text-[11px] text-slate-400 mt-0.5">
                        ใครก็ตามที่มีรหัสผ่านนี้สามารถเข้าร่วมกิจกรรมได้ทันที
                      </p>
                    </div>
                  </div>
                  <div class="relative max-w-md">
                    <input
                      v-model="form.event_password"
                      type="text"
                      placeholder="เช่น HELLO2025"
                      class="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none text-sm font-black text-slate-700 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all placeholder-slate-300 tracking-widest uppercase"
                    />
                    <button
                      v-if="form.event_password"
                      type="button"
                      @click="form.event_password = ''"
                      class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-rose-500 transition-colors p-1.5 hover:bg-rose-50 rounded-lg"
                    >
                      <X :size="16" stroke-width="3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </transition>
        </div>
        <!-- ส่วนที่ 6: เป้าหมายกิจกรรม -->
        <div class="bg-white border border-slate-200 rounded-3xl p-6 mb-6">
          <div
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            :class="{ 'mb-6': form.goal_config.enabled }"
          >
            <div class="flex items-center gap-4 flex-1">
              <div class="p-2.5 bg-orange-50 rounded-xl">
                <Trophy :size="22" class="text-orange-500" />
              </div>
              <div>
                <p class="font-bold text-[15px] text-slate-800">
                  กำหนดเป้าหมายความสำเร็จของกิจกรรม
                </p>
              </div>
            </div>
            <div class="w-12 flex-shrink-0 flex justify-end">
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  v-model="form.goal_config.enabled"
                  class="sr-only peer"
                />
                <div
                  class="w-12 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0 after:left-0 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-orange-500"
                ></div>
              </label>
            </div>
          </div>
          <transition name="fade">
            <div
              v-if="form.goal_config.enabled"
              class="space-y-6 pl-0 sm:pl-[3.25rem] animate-in slide-in-from-top-2"
            >
              <!-- เลือกหน่วยวัดเป้าหมาย (Dropdown) -->
              <div>
                <label class="text-[13px] font-bold text-slate-600 block mb-2"
                  >เป้าหมายคืออะไร? (หน่วยวัด)</label
                >
                <div
                  class="custom-dropdown relative bg-white border border-slate-200 rounded-xl"
                >
                  <button
                    type="button"
                    @click="toggleDropdown('goal_type', $event)"
                    class="w-full px-4 py-3 text-left text-sm font-bold text-slate-800 flex items-center justify-between hover:bg-slate-50 transition-all rounded-xl"
                  >
                    <span class="flex items-center gap-2">
                      <component
                        :is="
                          goalUnitOptions.find(
                            (o) => o.value === form.goal_config.target_type,
                          )?.icon ||
                          (form.goal_config.target_type === 'points'
                            ? Trophy
                            : Ruler)
                        "
                        :size="18"
                      />
                      {{
                        goalUnitOptions.find(
                          (o) => o.value === form.goal_config.target_type,
                        )?.label ||
                        form.goal_config.target_type ||
                        "เลือกหน่วยวัด"
                      }}
                    </span>
                    <ChevronDown
                      :size="16"
                      class="text-slate-400 transition-transform duration-300"
                      :class="{ 'rotate-180': activeDropdown === 'goal_type' }"
                    />
                  </button>
                  <div
                    v-if="activeDropdown === 'goal_type'"
                    :class="
                      dropdownDirection === 'up'
                        ? 'bottom-full mb-1'
                        : 'top-full mt-1'
                    "
                    class="absolute left-0 right-0 z-[100] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden flex flex-col animate-in"
                  >
                    <!-- รายการหน่วยที่มีให้เลือก -->
                    <div class="overflow-y-auto max-h-[220px] no-scrollbar">
                      <div
                        v-for="opt in goalUnitOptions"
                        :key="opt.value"
                        @click="
                          form.goal_config.target_type = opt.value;
                          activeDropdown = null;
                        "
                        class="px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-orange-600 cursor-pointer transition-all border-b border-slate-50 last:border-0 flex items-center justify-between"
                        :class="{
                          'text-orange-600 font-bold':
                            form.goal_config.target_type === opt.value,
                        }"
                      >
                        <span class="flex items-center gap-2">
                          <component :is="opt.icon || Trophy" :size="18" />
                          {{ opt.label }}
                        </span>
                        <Check
                          v-if="form.goal_config.target_type === opt.value"
                          :size="16"
                          stroke-width="3"
                        />
                      </div>
                    </div>
                    <!-- ส่วนระบุเอง -->
                    <div
                      class="p-3 bg-orange-50/50 border-t border-orange-100"
                      @click.stop
                    >
                      <p
                        class="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-2 ml-1"
                      >
                        หรือระบุหน่วยใหม่
                      </p>
                      <div class="relative">
                        <input
                          type="text"
                          placeholder="เช่น แก้ว, รอบ, เซต..."
                          class="w-full pl-3 pr-10 py-2.5 bg-white border border-orange-200 rounded-xl text-xs font-bold outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all placeholder-slate-300"
                          @keyup.enter="activeDropdown = null"
                          @click.stop
                          v-model="form.goal_config.target_type"
                        />
                        <button
                          type="button"
                          @click.stop="activeDropdown = null"
                          class="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-orange-500 text-white rounded-lg flex items-center justify-center hover:bg-orange-600 transition-all shadow-sm active:scale-95"
                        >
                          <Check :size="14" stroke-width="4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <label class="text-[13px] font-bold text-slate-600 block mb-2">
                  จำนวนที่ต้องการให้สำเร็จ
                  <span class="text-slate-400 font-normal ml-1"
                    >({{
                      goalUnitOptions.find(
                        (o) => o.value === form.goal_config.target_type,
                      )?.label || form.goal_config.target_type
                    }})</span
                  >
                </label>
                <input
                  v-model.number="form.goal_config.target_value"
                  type="number"
                  min="1"
                  class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none text-base font-bold text-orange-600 text-center focus:border-orange-500 transition-all"
                  placeholder="ระบุจำนวนเป้าหมาย"
                />
              </div>
            </div>
          </transition>
        </div>
        <!-- ส่วนที่ 7: การแสดงผลและสถานะ -->
        <div class="bg-white p-6 rounded-3xl border border-slate-200 mb-6">
          <div
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div class="flex items-center gap-4 flex-1">
              <div class="p-2.5 bg-slate-50 rounded-xl">
                <EyeOff :size="22" class="text-slate-400" />
              </div>
              <p class="font-bold text-[15px] text-slate-800">
                ซ่อนกิจกรรม (ฉบับร่าง)
              </p>
            </div>
            <div class="w-12 flex-shrink-0 flex justify-end">
              <label
                class="relative inline-flex items-center cursor-pointer shrink-0"
              >
                <input
                  type="checkbox"
                  :checked="form.visibility_type === 'draft'"
                  @change="
                    form.visibility_type = ($event.target as HTMLInputElement)
                      .checked
                      ? 'draft'
                      : 'now'
                  "
                  class="sr-only peer"
                />
                <div
                  class="w-12 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0 after:left-0 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-orange-500"
                ></div>
              </label>
            </div>
          </div>
        </div>
        <div
          class="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 overflow-hidden mb-8"
        >
          <div class="mb-8">
            <h3
              class="text-lg font-bold text-slate-900 flex items-center gap-3"
            >
              <List :size="22" class="text-orange-500" />
              รายละเอียดกติกา / รูปภาพเพิ่มเติม
            </h3>
          </div>
          <div
            v-if="form.sections.length > 0"
            class="divide-y divide-slate-100 border-t border-slate-100 -mx-6 md:-mx-8"
          >
            <div
              v-for="(section, idx) in form.sections"
              :key="idx"
              class="relative group bg-white p-6 md:p-8 transition-all"
              :class="{
                'bg-orange-50/30': sectionDragOverIdx === idx,
                'opacity-50': sectionDraggingIdx === idx,
              }"
              :draggable="hoveringHandleIdx === idx"
              @dragstart="onSectionDragStart(idx)"
              @dragover.prevent="onSectionDragOver(idx)"
              @dragleave="onSectionDragLeave"
              @drop.prevent="onSectionDrop(idx)"
              @dragend="onSectionDragEnd"
            >
              <div
                class="absolute left-2 top-1/2 -translate-y-1/2 cursor-grab text-slate-200 hover:text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity p-2 hidden md:block"
                @mouseenter="hoveringHandleIdx = idx"
                @mouseleave="hoveringHandleIdx = null"
              >
                <GripVertical :size="20" />
              </div>
              <div class="flex items-start justify-between gap-4 mb-5">
                <div class="flex-1 flex items-center gap-3">
                  <div
                    class="cursor-grab text-slate-300 hover:text-orange-500 md:hidden p-1 -ml-2"
                    @mouseenter="hoveringHandleIdx = idx"
                    @mouseleave="hoveringHandleIdx = null"
                  >
                    <GripVertical :size="20" />
                  </div>
                  <input
                    v-model="section.title"
                    type="text"
                    class="text-lg font-bold text-slate-900 bg-transparent border-none placeholder-slate-200 focus:outline-none w-full transition-colors"
                    placeholder="ใส่หัวข้อ (เช่น กติกาการแข่งขัน...)"
                  />
                </div>
                <button
                  type="button"
                  @click="removeSection(idx)"
                  class="text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg p-2 transition-all"
                >
                  <Trash2 :size="18" />
                </button>
              </div>
              <div class="space-y-5">
                <textarea
                  v-model="section.content"
                  v-auto-expand
                  rows="2"
                  class="w-full text-base text-slate-700 bg-white border border-slate-200 rounded-2xl outline-none resize-none leading-relaxed placeholder-slate-200 focus:ring-4 focus:ring-orange-500/5 focus:border-orange-400 min-h-[80px] p-5 transition-all"
                  placeholder="เริ่มเขียนเนื้อหาของคุณที่นี่..."
                ></textarea>
                <div
                  v-if="section.image"
                  class="relative rounded-2xl overflow-hidden border border-slate-100 group/img inline-block max-w-full bg-slate-50"
                >
                  <img :src="section.image" class="max-h-80 object-contain" />
                  <div
                    class="absolute inset-0 bg-slate-950/40 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity backdrop-blur-[2px] gap-4"
                  >
                    <label
                      class="cursor-pointer bg-white text-slate-900 p-3 rounded-full hover:scale-110 transition-all shadow-xl"
                      title="เปลี่ยนรูปภาพ"
                    >
                      <input
                        type="file"
                        class="hidden"
                        accept="image/*"
                        @change="handleSectionImageUpload($event, idx)"
                      />
                      <Pencil :size="20" />
                    </label>
                    <button
                      type="button"
                      @click="section.image = ''"
                      class="bg-rose-500 text-white p-3 rounded-full hover:scale-110 transition-all shadow-xl"
                      title="ลบรูปภาพ"
                    >
                      <Trash2 :size="20" />
                    </button>
                  </div>
                </div>
                <div v-else>
                  <label
                    class="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-xl hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 cursor-pointer transition-all"
                  >
                    <input
                      type="file"
                      class="hidden"
                      accept="image/*"
                      @change="handleSectionImageUpload($event, idx)"
                    />
                    <ImageIcon :size="16" /> แนบรูปประกอบ
                  </label>
                </div>
              </div>
            </div>
          </div>
          <div class="pt-6 mt-6 border-t border-slate-100">
            <button
              type="button"
              @click="addSection"
              class="w-full py-4 rounded-xl border border-orange-200 text-orange-600 hover:bg-orange-50 font-bold text-sm flex justify-center items-center gap-2 transition-all"
            >
              <PlusCircle :size="20" /> เพิ่มแท็บเนื้อหาใหม่
            </button>
          </div>
        </div>
        <div
          class="fixed bottom-0 left-0 right-0 z-[50] bg-white/90 backdrop-blur-xl border-t border-slate-200 px-4 py-4 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]"
        >
          <div class="max-w-4xl mx-auto w-full flex justify-end gap-3">
            <button
              type="button"
              @click="handleBack"
              class="px-6 py-3 bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold text-sm md:text-base rounded-xl transition-all"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              :disabled="formSubmitting"
              class="px-8 py-3 bg-orange-500 text-white hover:bg-orange-600 font-bold text-sm md:text-base rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check v-if="!formSubmitting" :size="18" stroke-width="3" />
              <Loader2 v-else class="animate-spin" :size="18" />
              {{ editingId ? "บันทึกการแก้ไข" : "สร้างกิจกรรมนี้" }}
            </button>
          </div>
        </div>
      </form>
    </div>
    <AdminCertificateEditor
      v-if="certEditorEventId !== null"
      :event-id="certEditorEventId"
      :is-open="showCertEditor"
      @close="closeCertEditor"
      @saved="closeCertEditor"
    />
    <!-- Persistent Bottom Actions Bar -->
    <div
      v-if="activeTab === 'list'"
      class="fixed bottom-0 right-0 z-[40] flex items-center justify-end gap-3 p-4 sm:p-6"
      :style="{
        left: selectedIds.length > 0 ? 'var(--sidebar-width, 0)' : 'auto',
      }"
    >
      <!-- Selection Mode -->
      <template v-if="selectedIds.length > 0">
        <div
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
              @click="bulkAction('delete')"
              :disabled="adminSubmitting"
              class="bg-rose-500 text-white px-3 sm:px-4 h-9 sm:h-10 rounded-xl text-xs sm:text-[13px] font-bold flex items-center gap-1.5 sm:gap-2 hover:bg-rose-600 transition-all shadow-sm shrink-0 disabled:opacity-50"
            >
              <Loader2 v-if="adminSubmitting" :size="16" class="animate-spin" />
              <Trash2 v-else :size="16" />
              <span class="hidden sm:inline">{{
                adminSubmitting ? "กำลังลบ..." : "ลบที่เลือก"
              }}</span>
              <span class="sm:hidden">{{
                adminSubmitting ? "..." : "ลบ"
              }}</span>
            </button>
          </div>
        </div>
      </template>
      <!-- Default Mode (Add Button) -->
      <template v-else>
        <button
          @click="() => openCreate()"
          class="bg-orange-500 text-white w-48 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-orange-600 shadow-none"
        >
          <Plus :size="20" stroke-width="3" />
          เพิ่มกิจกรรมใหม่
        </button>
      </template>
    </div>
    <transition name="fade">
      <div
        v-if="showCropper"
        class="fixed inset-0 z-[9999] bg-slate-950 flex flex-col animate-in"
      >
        <div
          class="px-6 py-5 flex items-center justify-between z-10 bg-gradient-to-b from-black/60 to-transparent absolute top-0 left-0 right-0"
        >
          <div class="text-white">
            <h3 class="font-bold text-lg">ปรับแต่งรูปภาพ (Crop Image)</h3>
            <p class="text-xs text-white/70 mt-0.5">
              เลื่อนและขยายกรอบเพื่อเลือกพื้นที่ที่ต้องการ
            </p>
          </div>
          <button
            @click="closeCropper"
            class="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-sm"
          >
            <X :size="24" />
          </button>
        </div>
        <div
          class="flex-1 w-full h-full relative flex items-center justify-center"
        >
          <img
            ref="cropperEl"
            :src="cropperImgUrl"
            class="block max-w-full max-h-full"
          />
        </div>
        <div
          class="absolute bottom-0 left-0 right-0 p-6 sm:p-8 flex justify-center gap-4 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-20"
        >
          <button
            type="button"
            @click="closeCropper"
            class="px-8 py-3.5 text-sm font-bold text-white bg-white/10 rounded-full hover:bg-white/20 backdrop-blur-md transition-all border border-white/10"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            @click="confirmCrop"
            class="px-10 py-3.5 text-sm font-bold text-slate-900 bg-white rounded-full hover:bg-slate-100 transition-all flex items-center gap-2 shadow-[0_0_30px_rgba(255,255,255,0.2)]"
          >
            <Check :size="20" stroke-width="3" /> ยืนยันการตัดรูปภาพ
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>
<style scoped>
.font-sarabun {
  font-family: var(--font-sans);
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
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
/* ─── Search Pill (Copied from Activities.vue style) ─── */
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
/* ─── Sliding Toggle Switch (Physical 'Cover' Style) ─── */
.view-toggle-switch {
  position: relative;
  background: #f1f5f9;
  border: 1.5px solid #e2e8f0;
  border-radius: 99px;
  padding: 3px;
  display: flex;
  width: 88px;
  height: 44px;
  box-shadow: inset 0 2px 5px rgba(15, 23, 42, 0.05);
  flex-shrink: 0;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.3s ease;
}
.toggle-slider {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 38px;
  height: 38px;
  background: white;
  border-radius: 50%;
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.15);
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 10; /* Above icons */
}
.toggle-slider.is-right {
  transform: translateX(44px);
}
.toggle-btn {
  position: relative;
  flex: 1;
  z-index: 1; /* Below slider */
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  transition: all 0.3s ease;
}
.toggle-btn.active {
  color: #f97316;
}
.view-toggle-switch:hover .toggle-slider {
  box-shadow: 0 5px 15px rgba(15, 23, 42, 0.2);
}
@media (max-width: 640px) {
  .view-toggle-switch {
    width: 80px;
    height: 40px;
    padding: 3px;
  }
  .toggle-slider {
    width: 34px;
    height: 34px;
    top: 3px;
    left: 3px;
  }
  .toggle-slider.is-right {
    transform: translateX(40px);
  }
  .toggle-btn {
    width: 40px;
  }
}
/* ─── Preview Mode (User-Facing Clone) ───────────────────────────────────── */
.preview-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 20px 16px;
}
@media (max-width: 1200px) {
  .preview-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
@media (max-width: 1024px) {
  .preview-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 768px) {
  .preview-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 480px) {
  .preview-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 16px 12px;
  }
}
/* Card wrapper */
.preview-card {
  display: flex;
  flex-direction: column;
  cursor: default;
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
}
.preview-card:hover {
  transform: translateY(-2px);
}
.preview-card.is-draft {
  opacity: 0.55;
}
/* 1:1 Image box — exact clone of user .img-box */
.preview-img-box {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: #f9fafb;
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 12px;
  cursor: pointer;
}
.preview-img-box img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}
.preview-card:hover .preview-img-box img {
  transform: scale(1.05);
}
.preview-img-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
}
/* Status badge — clone of user .dark-badge */
.preview-dark-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(17, 24, 39, 0.82);
  backdrop-filter: blur(4px);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 5px 10px;
  border-radius: 8px;
  letter-spacing: 0.4px;
  pointer-events: none;
  z-index: 10;
}
.preview-dark-badge.status-open {
  background: rgba(16, 185, 129, 0.9) !important;
}
.preview-dark-badge.status-ongoing {
  background: rgba(59, 130, 246, 0.9) !important;
}
.preview-dark-badge.status-full {
  background: rgba(239, 68, 68, 0.9) !important;
}
.preview-dark-badge.status-ended {
  background: rgba(100, 116, 139, 0.9) !important;
}
.preview-dark-badge.status-draft {
  background: rgba(71, 85, 105, 0.9) !important;
}
/* Admin quick-action buttons (top-right of image) */
.preview-admin-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 5px;
  opacity: 0;
  transition: opacity 0.2s;
}
.preview-card:hover .preview-admin-actions {
  opacity: 1;
}
.preview-action-btn {
  width: 30px;
  height: 30px;
  background: rgba(255, 255, 255, 0.92);
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #475569;
  cursor: pointer;
  backdrop-filter: blur(6px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  transition:
    background 0.15s,
    color 0.15s;
}
.preview-action-btn:hover {
  background: #fff;
  color: #f97316;
}
/* Draft stripe overlay */
.preview-draft-overlay {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    -45deg,
    rgba(0, 0, 0, 0.03) 0px,
    rgba(0, 0, 0, 0.03) 8px,
    transparent 8px,
    transparent 16px
  );
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 12px;
  pointer-events: none;
}
.preview-draft-label {
  background: rgba(71, 85, 105, 0.9);
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 99px;
  letter-spacing: 0.5px;
}
/* Info box — mirrors .info-box in Activities.vue */
.preview-info-box {
  padding: 0 2px;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.preview-title {
  font-size: 14px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 8px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.preview-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  margin-bottom: 3px;
}
.preview-meta.text-primary {
  color: #f97316;
  font-weight: 600;
}
.preview-meta.text-gray {
  color: #6b7280;
  font-weight: 500;
}
.preview-meta.mt-1 {
  margin-top: 4px;
}
/* Admin info bar (below info-box) */
.preview-admin-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px dashed #e2e8f0;
}
.preview-admin-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  padding: 3px 8px;
  border-radius: 6px;
}
.preview-admin-edit {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  color: #f97316;
  background: transparent;
  border: 1px solid #fdba74;
  padding: 3px 9px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.preview-admin-edit:hover {
  background: #fff7ed;
}
@media (max-width: 768px) {
  /* Tighter table for mobile */
  table th,
  table td {
    padding: 12px 10px !important;
    font-size: 12px !important;
  }
  /* Sticky columns adjustments for mobile */
  /* Remove border between col 1 and 2 to prevent gap */
  .sticky.left-0 {
    width: 45px !important; /* Overlap by 1px to cover gap */
    min-width: 45px !important;
    border-right: none !important;
  }
  /* Offset to perfectly cover the first column */
  .sticky.left-12 {
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
  /* Remove all extra shadows as requested */
  .sticky.left-12,
  .sticky.right-0 {
    box-shadow: none !important;
  }
}
/* Base sticky header styling */
thead th.sticky {
  z-index: 20;
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
/* Floating Actions Bar Responsive */
@media (max-width: 640px) {
  .fixed.bottom-0.right-0 {
    padding: 16px !important;
  }
  .btn-add-activity {
    padding: 12px 16px !important;
    font-size: 14px !important;
  }
}
</style>
