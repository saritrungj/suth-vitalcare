<script setup lang="ts" generic="T extends Record<string, any>">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import {
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Download,
  AlignJustify,
  AlignLeft,
  RefreshCw,
  ChevronRight as ChevronRightIcon,
  Settings,
  Search,
  Filter,
} from "lucide-vue-next";
export interface SmartTableColumn<T = any> {
  key: string;
  label: string;
  sortable?: boolean;
  sortKey?: string | ((row: T) => any);
  align?: "left" | "center" | "right";
  width?: string | number;
  minWidth?: number;
  render?: (row: T) => string | number;
  exportRender?: (row: T) => any;
  hidden?: boolean;
  fixed?: boolean;
}
export interface SortRule {
  key: string;
  dir: "asc" | "desc";
}
const props = withDefaults(
  defineProps<{
    data: T[];
    columns: SmartTableColumn<T>[];
    loading?: boolean;
    selectable?: boolean;
    expandable?: boolean;
    searchKey?: string[];
    defaultSortDir?: "asc" | "desc";
    itemName?: string;
    storageKey?: string;
    stickyHeader?: boolean;
    exportDateKey?: string;
    exportFileName?: string;
    rowClass?: (row: T) => string;
    hideToolbar?: boolean;
    hideSearch?: boolean;
    hideExport?: boolean;
    hideSettings?: boolean;
    hideDense?: boolean;
    hideRefresh?: boolean;
    defaultSortKey?: string;
  }>(),
  {
    loading: false,
    selectable: false,
    expandable: false,
    itemName: "รายการ",
    stickyHeader: true,
    exportFileName: "export",
    rowClass: () => "",
    hideToolbar: false,
    hideSearch: false,
    hideExport: false,
    hideSettings: false,
    hideDense: false,
    hideRefresh: false,
  },
);
const emit = defineEmits<{
  (e: "refresh"): void;
  (e: "export"): void;
  (e: "update:selected", ids: (string | number)[]): void;
}>();
const search = ref("");
const sorts = ref<SortRule[]>([]);
const dense = ref(false);
const page = ref(1);
const perPage = ref(20);
const selectedIds = ref<(string | number)[]>([]);
const expandedIds = ref<(string | number)[]>([]);
interface ColState extends SmartTableColumn<T> {
  visible: boolean;
  currentWidth?: number;
}
const colsState = ref<ColState[]>([]);
onMounted(() => {
  if (props.defaultSortKey) {
    sorts.value = [
      { key: props.defaultSortKey, dir: props.defaultSortDir || "desc" },
    ];
  }
  let prefsParams: any = null;
  if (props.storageKey) {
    const saved = localStorage.getItem(`smart-table-prefs-${props.storageKey}`);
    if (saved) {
      try {
        prefsParams = JSON.parse(saved);
      } catch (e) {}
    }
  }
  colsState.value = props.columns.map((c) => {
    let prefWidth: number | undefined;
    let prefVisible = !c.hidden;
    if (prefsParams?.cols?.[c.key]) {
      prefWidth = prefsParams.cols[c.key].width;
      if (!c.fixed) prefVisible = prefsParams.cols[c.key].visible;
    }
    return { ...c, visible: prefVisible, currentWidth: prefWidth } as ColState;
  });
  if (prefsParams?.dense !== undefined) dense.value = prefsParams.dense;
  if (prefsParams?.perPage !== undefined) perPage.value = prefsParams.perPage;
  document.addEventListener("click", closeSettingsOutside);
});
onUnmounted(() => {
  document.removeEventListener("click", closeSettingsOutside);
});
const savePrefs = () => {
  if (!props.storageKey) return;
  const prefs = {
    dense: dense.value,
    perPage: perPage.value,
    cols: colsState.value.reduce(
      (acc, c) => ({
        ...acc,
        [c.key]: { visible: c.visible, width: c.currentWidth },
      }),
      {},
    ),
  };
  localStorage.setItem(
    `smart-table-prefs-${props.storageKey}`,
    JSON.stringify(prefs),
  );
};
watch([dense, perPage], savePrefs);
watch(colsState, savePrefs, { deep: true });
const showSettings = ref(false);
const showFilters = ref(false);
const settingsRef = ref<HTMLElement | null>(null);
const closeSettingsOutside = (e: MouseEvent) => {
  if (
    showSettings.value &&
    settingsRef.value &&
    !settingsRef.value.contains(e.target as Node)
  ) {
    showSettings.value = false;
  }
};
const toggleColVisibility = (col: ColState) => {
  if (col.fixed) return;
  col.visible = !col.visible;
};
const toggleSort = (key: string, e: MouseEvent) => {
  const col = props.columns.find((c) => c.key === key);
  if (!col || col.sortable === false) return;
  const idx = sorts.value.findIndex((s) => s.key === key);
  if (e.shiftKey) {
    if (idx > -1) {
      if (sorts.value[idx].dir === "asc") sorts.value[idx].dir = "desc";
      else sorts.value.splice(idx, 1);
    } else {
      sorts.value.push({ key, dir: "asc" });
    }
  } else {
    if (idx > -1) {
      if (sorts.value[idx].dir === "asc") sorts.value = [{ key, dir: "desc" }];
      else sorts.value = [];
    } else {
      sorts.value = [{ key, dir: "asc" }];
    }
  }
};
const getSortIndex = (key: string) =>
  sorts.value.findIndex((s) => s.key === key);
const processedData = computed(() => {
  let res = [...props.data];
  if (search.value) {
    const q = search.value.toLowerCase();
    res = res.filter((item) => {
      if (props.searchKey?.length) {
        return props.searchKey.some((k) =>
          String(item[k] ?? "")
            .toLowerCase()
            .includes(q),
        );
      }
      return Object.values(item).some((v) =>
        String(v ?? "")
          .toLowerCase()
          .includes(q),
      );
    });
  }
  if (sorts.value.length > 0) {
    res.sort((a, b) => {
      for (const rule of sorts.value) {
        const colDef = props.columns.find((c) => c.key === rule.key);
        let va, vb;
        if (colDef && typeof colDef.sortKey === "function") {
          va = colDef.sortKey(a);
          vb = colDef.sortKey(b);
        } else if (colDef && typeof colDef.sortKey === "string") {
          va = a[colDef.sortKey];
          vb = b[colDef.sortKey];
        } else {
          va = a[rule.key];
          vb = b[rule.key];
        }
        if (va === vb) continue;
        if (va == null) return rule.dir === "asc" ? 1 : -1;
        if (vb == null) return rule.dir === "asc" ? -1 : 1;
        const comp =
          typeof va === "string" && typeof vb === "string"
            ? va.localeCompare(vb, "th")
            : va > vb
              ? 1
              : -1;
        return rule.dir === "asc" ? comp : -comp;
      }
      return 0;
    });
  }
  return res;
});
const totalPages = computed(
  () => Math.ceil(processedData.value.length / perPage.value) || 1,
);
const paginatedData = computed(() => {
  const start = (page.value - 1) * perPage.value;
  return processedData.value.slice(start, start + perPage.value);
});
watch(totalPages, (nv) => {
  if (page.value > nv && nv > 0) page.value = nv;
});
const handleSelectAll = (e: Event) => {
  const el = e.target as HTMLInputElement;
  selectedIds.value = el.checked
    ? paginatedData.value.map((r) => r.id as string | number)
    : [];
  emit("update:selected", selectedIds.value);
};
const toggleSelect = (id: string | number) => {
  const idx = selectedIds.value.indexOf(id);
  if (idx > -1) selectedIds.value.splice(idx, 1);
  else selectedIds.value.push(id);
  emit("update:selected", selectedIds.value);
};
const toggleExpand = (id: string | number) => {
  const idx = expandedIds.value.indexOf(id);
  if (idx > -1) expandedIds.value.splice(idx, 1);
  else expandedIds.value.push(id);
};
const clearSelection = () => {
  selectedIds.value = [];
  emit("update:selected", []);
};
defineExpose({ clearSelection });
const pagesArray = computed(() => {
  const arr: (number | string)[] = [];
  const maxVisible = 5;
  const current = page.value;
  const total = totalPages.value;
  if (total <= maxVisible) {
    for (let i = 1; i <= total; i++) arr.push(i);
    return arr;
  }
  let start = Math.max(1, current - 2);
  let end = Math.min(total, start + 4);
  if (end - start < 4) {
    start = Math.max(1, end - 4);
  }
  if (start > 1) {
    arr.push(1);
    if (start > 2) {
      arr.push("...");
    }
  }
  for (let i = start; i <= end; i++) {
    arr.push(i);
  }
  return arr;
});
const visibleCols = computed(() => colsState.value.filter((c) => c.visible));
// ─── Export Excel Logic ───
const showExportModal = ref(false);
const exportStartDate = ref("");
const exportEndDate = ref("");
const selectedExportDateKey = ref(props.exportDateKey || "");
watch(
  () => props.exportDateKey,
  (nv) => {
    if (nv) selectedExportDateKey.value = nv;
  },
);
const handleExportExcel = async () => {
  let dataToExport = props.data;
  if (
    selectedExportDateKey.value &&
    exportStartDate.value &&
    exportEndDate.value
  ) {
    const start = new Date(exportStartDate.value);
    start.setHours(0, 0, 0, 0);
    const end = new Date(exportEndDate.value);
    end.setHours(23, 59, 59, 999);
    dataToExport = dataToExport.filter((row: any) => {
      const val = row[selectedExportDateKey.value];
      if (!val) return false;
      const d = new Date(val);
      if (isNaN(d.getTime())) return true;
      return d >= start && d <= end;
    });
  }
  const exportData = dataToExport.map((row: any) => {
    const mappedRow: any = {};
    // นำเฉพาะคอลัมน์ที่ถูกตั้งค่าไว้ใน columns (อิงตาม UI) มาแสดง
    props.columns.forEach((c) => {
      // ข้ามคอลัมน์ที่เป็นปุ่มจัดการ หรือคอลัมน์ที่ไม่มีชื่อ/key
      if (c.key === "actions" || (!c.label && !c.key)) return;
      // ข้ามคอลัมน์ที่ถูกซ่อน (ยกเว้นกรณีต้องการส่งออกทั้งหมด แต่อิงตาม UI จะดีกว่า)
      // ในที่นี้เราจะส่งออกเฉพาะคอลัมน์ที่มีในนิยาม เพื่อให้ Excel สวยงามตามตาราง
      let val = c.exportRender
        ? c.exportRender(row)
        : c.render
          ? c.render(row)
          : row[c.key];
      const headerName = c.label || c.key;
      if (val instanceof Date) {
        mappedRow[headerName] = val.toLocaleString("th-TH");
      } else if (typeof val === "object" && val !== null) {
        // ถ้าเป็น array/object ที่ไม่ใช่ Date ให้พยายามแสดงเป็น string ที่อ่านง่ายขึ้น
        if (Array.isArray(val)) {
          mappedRow[headerName] = val.join(", ");
        } else {
          mappedRow[headerName] = JSON.stringify(val);
        }
      } else {
        mappedRow[headerName] = val;
      }
    });
    return mappedRow;
  });
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, `${props.exportFileName}.xlsx`);
  showExportModal.value = false;
};
</script>
<template>
  <div class="st">
    <!-- ── Toolbar ── -->
    <div v-if="!hideToolbar" class="st-toolbar">
      <div class="st-toolbar-left">
        <slot name="toolbar-left" />
      </div>
      <div class="st-toolbar-right">
        <div v-if="!hideSearch" class="st-search-wrap">
          <Search :size="14" class="st-search-icon" />
          <input
            v-model="search"
            type="text"
            :placeholder="`ค้นหา${itemName}...`"
            class="st-search"
          />
        </div>
        <div class="st-toolbar-actions">
          <slot name="toolbar-actions" />
          <button
            v-if="$slots.filters"
            @click="showFilters = !showFilters"
            class="st-btn st-btn-label"
            :class="showFilters ? 'st-btn--active' : ''"
            :title="showFilters ? 'ซ่อนตัวกรอง' : 'เปิดตัวกรอง'"
          >
            <Filter :size="14" />
            <span class="st-btn-text">ตัวกรอง</span>
          </button>
          <button
            v-if="!hideDense"
            @click="dense = !dense"
            class="st-btn"
            :title="dense ? 'มุมมองปกติ' : 'มุมมองแน่น'"
          >
            <AlignJustify v-if="dense" :size="15" />
            <AlignLeft v-else :size="15" />
          </button>
          <button
            v-if="!hideExport"
            @click="showExportModal = true"
            class="st-btn st-btn-label"
          >
            <Download :size="14" />
            <span>Excel</span>
          </button>
          <button v-if="!hideRefresh" @click="$emit('refresh')" class="st-btn">
            <RefreshCw :size="15" />
          </button>
          <div v-if="!hideSettings" class="st-settings-wrap" ref="settingsRef">
            <button
              @click="showSettings = !showSettings"
              class="st-btn"
              :class="showSettings ? 'st-btn--active' : ''"
            >
              <Settings :size="15" />
            </button>
            <transition name="st-pop">
              <div v-if="showSettings" class="st-settings-panel">
                <p class="st-settings-title">คอลัมน์</p>
                <div class="st-settings-list">
                  <button
                    v-for="col in colsState"
                    :key="col.key"
                    @click="toggleColVisibility(col)"
                    :disabled="col.fixed"
                    class="st-settings-item"
                    :class="col.visible ? 'st-settings-item--on' : ''"
                  >
                    <span
                      class="st-checkbox"
                      :class="col.visible ? 'st-checkbox--on' : ''"
                    >
                      <svg
                        v-if="col.visible"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="3"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    <span class="truncate">{{ col.label }}</span>
                    <span v-if="col.fixed" class="st-settings-fixed"
                      >คงที่</span
                    >
                  </button>
                </div>
                <p class="st-settings-hint">
                  กด <kbd>Shift</kbd> + คลิกหัวคอลัมน์ เพื่อเรียงหลายคอลัมน์
                </p>
              </div>
            </transition>
          </div>
        </div>
      </div>
    </div>
    <!-- ── Filters Panel ── -->
    <div v-show="showFilters" v-if="$slots.filters" class="st-filters-panel">
      <slot name="filters" />
    </div>
    <!-- ── Bulk Actions ── -->
    <div v-if="selectable && selectedIds.length > 0" class="st-bulk">
      <div class="st-bulk-info">
        <span class="st-bulk-count">{{ selectedIds.length }}</span>
        รายการที่เลือก
        <button @click="clearSelection" class="st-bulk-clear">ยกเลิก</button>
      </div>
      <div class="st-bulk-actions">
        <slot name="bulk-actions" :selected="selectedIds" />
      </div>
    </div>
    <!-- ── Table ── -->
    <div class="st-table-wrap">
      <!-- Loading -->
      <transition name="st-fade">
        <div v-if="loading" class="st-loading">
          <div class="st-spinner" />
        </div>
      </transition>
      <div class="st-scroll" :style="stickyHeader ? 'max-height:65vh' : ''">
        <table class="st-table" :class="dense ? 'st-table--dense' : ''">
          <thead
            class="st-thead"
            :class="stickyHeader ? 'st-thead--sticky' : ''"
          >
            <tr>
              <th
                v-if="expandable"
                class="st-th st-th-icon"
                :class="stickyHeader ? 'st-col-sticky-0' : ''"
              />
              <th
                v-if="selectable"
                class="st-th st-th-icon"
                :class="stickyHeader ? 'st-col-sticky-1' : ''"
              >
                <input
                  type="checkbox"
                  @change="handleSelectAll"
                  :checked="
                    selectedIds.length === paginatedData.length &&
                    paginatedData.length > 0
                  "
                  class="st-checkbox-input"
                />
              </th>
              <th
                v-for="col in visibleCols"
                :key="col.key"
                class="st-th"
                :class="[
                  col.sortable !== false ? 'st-th--sort' : '',
                  col.align === 'center'
                    ? 'text-center'
                    : col.align === 'right'
                      ? 'text-right'
                      : '',
                ]"
                :style="{
                  width: col.width as string,
                  minWidth: col.minWidth ? col.minWidth + 'px' : 'auto',
                }"
                @click="
                  col.sortable !== false ? toggleSort(col.key, $event) : null
                "
              >
                <div
                  class="st-th-inner"
                  :class="
                    col.align === 'center'
                      ? 'justify-center'
                      : col.align === 'right'
                        ? 'justify-end'
                        : ''
                  "
                >
                  <slot :name="'header-' + col.key" :col="col">
                    <span>{{ col.label }}</span>
                  </slot>
                  <span
                    v-if="col.sortable !== false"
                    class="st-sort-icon"
                    :class="
                      getSortIndex(col.key) > -1 ? 'st-sort-icon--active' : ''
                    "
                  >
                    <ArrowUp
                      v-if="
                        getSortIndex(col.key) > -1 &&
                        sorts[getSortIndex(col.key)].dir === 'asc'
                      "
                      :size="11"
                      stroke-width="3"
                    />
                    <ArrowDown
                      v-else-if="getSortIndex(col.key) > -1"
                      :size="11"
                      stroke-width="3"
                    />
                    <ArrowUp
                      v-else
                      :size="11"
                      stroke-width="2"
                      class="st-sort-idle"
                    />
                    <sup
                      v-if="sorts.length > 1 && getSortIndex(col.key) > -1"
                      >{{ getSortIndex(col.key) + 1 }}</sup
                    >
                  </span>
                </div>
              </th>
              <th
                v-if="$slots.actions"
                class="st-th st-th-actions"
                :class="stickyHeader ? 'st-col-sticky-r' : ''"
              >
                จัดการ
              </th>
            </tr>
          </thead>
          <tbody>
            <template
              v-for="(row, index) in paginatedData"
              :key="row.id ?? index"
            >
              <tr
                class="st-row"
                :class="[
                  expandedIds.includes(row.id) ? 'st-row--expanded' : '',
                  rowClass(row),
                ]"
              >
                <td
                  v-if="expandable"
                  class="st-td st-td-icon"
                  :class="stickyHeader ? 'st-col-sticky-0' : ''"
                >
                  <button
                    @click="toggleExpand(row.id)"
                    class="st-expand-btn"
                    :class="
                      expandedIds.includes(row.id) ? 'st-expand-btn--open' : ''
                    "
                  >
                    <ChevronRightIcon :size="15" />
                  </button>
                </td>
                <td
                  v-if="selectable"
                  class="st-td st-td-icon"
                  :class="stickyHeader ? 'st-col-sticky-1' : ''"
                >
                  <input
                    type="checkbox"
                    :checked="selectedIds.includes(row.id)"
                    @change="toggleSelect(row.id)"
                    class="st-checkbox-input"
                  />
                </td>
                <td
                  v-for="col in visibleCols"
                  :key="col.key"
                  class="st-td"
                  :class="
                    col.align === 'center'
                      ? 'text-center'
                      : col.align === 'right'
                        ? 'text-right'
                        : ''
                  "
                >
                  <slot
                    :name="'cell-' + col.key"
                    :value="row[col.key]"
                    :row="row"
                  >
                    {{ col.render ? col.render(row) : row[col.key] }}
                  </slot>
                </td>
                <td
                  v-if="$slots.actions"
                  class="st-td st-td-actions"
                  :class="stickyHeader ? 'st-col-sticky-r' : ''"
                >
                  <slot name="actions" :row="row" />
                </td>
              </tr>
              <!-- Expansion Row -->
              <tr
                v-if="expandable && expandedIds.includes(row.id)"
                class="st-expansion-row"
              >
                <td :colspan="100" class="st-expansion-td">
                  <div class="st-expansion-body">
                    <slot name="expansion" :row="row" />
                  </div>
                </td>
              </tr>
            </template>
            <!-- Empty State -->
            <tr v-if="!loading && paginatedData.length === 0">
              <td :colspan="100" class="st-empty">
                <div class="st-empty-inner">
                  <Search :size="20" class="st-empty-icon" />
                  <span>ไม่พบ{{ itemName }}</span>
                  <span v-if="search" class="st-empty-query"
                    >"{{ search }}"</span
                  >
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <!-- ── Pagination ── -->
    <div
      v-if="!loading && processedData.length > 0"
      class="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 pb-2 px-4 border-t border-slate-100"
    >
      <div class="flex items-center gap-4">
        <span
          class="text-[11px] font-bold text-slate-400 uppercase tracking-widest"
        >
          แสดง {{ (page - 1) * perPage + 1 }}–{{
            Math.min(page * perPage, processedData.length)
          }}
          จาก {{ processedData.length }} {{ itemName }}
        </span>
        <div
          class="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-1.5 border border-slate-100"
        >
          <label
            class="text-[10px] font-bold text-slate-500 uppercase tracking-tight"
            >ต่อหน้า</label
          >
          <select
            v-model="perPage"
            class="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
          >
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
        </div>
      </div>
      <div class="flex items-center gap-1.5">
        <button
          @click="page--"
          :disabled="page === 1"
          class="rounded-full border border-slate-200 bg-white text-slate-500 hover:text-orange-500 hover:border-orange-500 disabled:opacity-30 disabled:hover:text-slate-500 disabled:hover:border-slate-200 transition-all shadow-sm flex items-center justify-center flex-shrink-0"
          style="
            width: 38px;
            height: 38px;
            min-width: 38px;
            min-height: 38px;
            padding: 0;
          "
        >
          <ChevronLeft :size="16" />
        </button>
        <div class="flex items-center gap-1">
          <button
            v-for="(p, i) in pagesArray"
            :key="i"
            @click="typeof p === 'number' ? (page = p) : null"
            :disabled="typeof p === 'string'"
            class="rounded-full text-[13px] font-bold transition-all shadow-sm border flex items-center justify-center flex-shrink-0"
            :class="[
              page === p
                ? 'bg-orange-500 border-orange-500 text-white shadow-orange-500/20'
                : 'bg-white border-slate-200 text-slate-600 hover:border-orange-300 hover:text-orange-600',
              typeof p === 'string'
                ? 'opacity-50 !bg-transparent !border-transparent !shadow-none cursor-default hover:text-slate-600 hover:border-transparent'
                : '',
            ]"
            style="
              width: 38px;
              height: 38px;
              min-width: 38px;
              min-height: 38px;
              padding: 0;
            "
          >
            {{ p }}
          </button>
        </div>
        <button
          @click="page++"
          :disabled="page === totalPages"
          class="rounded-full border border-slate-200 bg-white text-slate-500 hover:text-orange-500 hover:border-orange-500 disabled:opacity-30 disabled:hover:text-slate-500 disabled:hover:border-slate-200 transition-all shadow-sm flex items-center justify-center flex-shrink-0"
          style="
            width: 38px;
            height: 38px;
            min-width: 38px;
            min-height: 38px;
            padding: 0;
          "
        >
          <ChevronRight :size="16" />
        </button>
      </div>
    </div>
    <!-- ── Export Modal ── -->
    <transition name="st-fade">
      <div
        v-if="showExportModal"
        class="st-export-modal-overlay"
        @click.self="showExportModal = false"
      >
        <div class="st-export-modal">
          <h3 class="st-export-modal-title">ส่งออกข้อมูล (Excel)</h3>
          <div class="st-export-modal-body">
            <div class="st-field">
              <label>อ้างอิงช่วงเวลาจากคอลัมน์</label>
              <select v-model="selectedExportDateKey" class="st-input">
                <option value="">ส่งออกทั้งหมด (ไม่กรองเวลา)</option>
                <option v-for="col in columns" :key="col.key" :value="col.key">
                  {{ col.label }} ({{ col.key }})
                </option>
              </select>
            </div>
            <div class="st-field-row" v-if="selectedExportDateKey">
              <div class="st-field">
                <label>ตั้งแต่วันที่</label>
                <input type="date" v-model="exportStartDate" class="st-input" />
              </div>
              <div class="st-field">
                <label>ถึงวันที่</label>
                <input type="date" v-model="exportEndDate" class="st-input" />
              </div>
            </div>
            <p
              v-if="
                selectedExportDateKey && (!exportStartDate || !exportEndDate)
              "
              class="st-export-hint"
            >
              กรุณาเลือกวันที่เริ่มต้นและสิ้นสุดให้ครบ เพื่อกรองข้อมูลตามวัน
            </p>
          </div>
          <div class="st-export-modal-footer">
            <button @click="showExportModal = false" class="st-btn">
              ยกเลิก
            </button>
            <button
              @click="handleExportExcel"
              class="st-btn st-btn-primary"
              :disabled="
                !!(
                  selectedExportDateKey &&
                  (!exportStartDate || !exportEndDate)
                )
              "
            >
              <Download :size="14" /> ส่งออก Excel
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>
<style scoped>
/* ─── Root ─────────────────────────────────────── */
.st {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  font-family: var(--font-sans, "IBM Plex Sans Thai", sans-serif);
  font-size: 13px;
  color: #1e293b;
}
/* ─── Toolbar ───────────────────────────────────── */
.st-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.st-toolbar-left {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.st-toolbar-right {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  flex: 1;
  justify-content: flex-end;
}
.st-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
/* Search */
.st-search-wrap {
  position: relative;
  min-width: 200px;
  flex: 1;
  max-width: 280px;
}
.st-search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
  pointer-events: none;
}
.st-search {
  width: 100%;
  height: 36px;
  padding: 0 12px 0 34px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  font-size: 12.5px;
  color: #1e293b;
  outline: none;
  transition: border-color 0.15s;
}
.st-search::placeholder {
  color: #94a3b8;
}
.st-search:focus {
  border-color: #356768;
}
/* Toolbar buttons */
.st-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 0 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  color: #475569;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition:
    background 0.12s,
    border-color 0.12s,
    color 0.12s;
  white-space: nowrap;
}
.st-btn:hover {
  background: #f8fafc;
  color: #1e293b;
}
.st-btn--active {
  background: #f1f5f9;
  border-color: #cbd5e1;
  color: #1e293b;
}
.st-btn-label {
  gap: 6px;
}
.st-btn-text {
  white-space: nowrap;
}
/* ─── Filters Panel ────────────────────────────── */
.st-filters-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 16px;
  background: #f8fafc;
  border-bottom: 1px dashed #cbd5e1;
  align-items: flex-end;
}
/* ─── Settings Panel ────────────────────────────── */
.st-settings-wrap {
  position: relative;
}
.st-settings-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  width: 220px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.07);
  z-index: 100;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.st-settings-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #94a3b8;
  padding-bottom: 6px;
  border-bottom: 1px solid #f1f5f9;
  margin-bottom: 2px;
}
.st-settings-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 240px;
  overflow-y: auto;
}
.st-settings-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 7px;
  border: none;
  background: transparent;
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: background 0.1s;
}
.st-settings-item:hover:not(:disabled) {
  background: #f8fafc;
  color: #1e293b;
}
.st-settings-item--on {
  color: #1e293b;
}
.st-settings-item:disabled {
  opacity: 0.45;
  cursor: default;
}
.st-settings-fixed {
  margin-left: auto;
  font-size: 9px;
  color: #94a3b8;
  background: #f1f5f9;
  padding: 1px 5px;
  border-radius: 4px;
}
.st-settings-hint {
  font-size: 10.5px;
  color: #94a3b8;
  padding-top: 8px;
  border-top: 1px solid #f1f5f9;
  line-height: 1.6;
}
.st-settings-hint kbd {
  font-family: monospace;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 1px 4px;
  font-size: 9px;
}
/* Checkbox shared */
.st-checkbox {
  width: 15px;
  height: 15px;
  border: 1.5px solid #cbd5e1;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition:
    background 0.12s,
    border-color 0.12s;
}
.st-checkbox--on {
  background: #356768;
  border-color: #356768;
  color: #fff;
}
.st-checkbox svg {
  width: 9px;
  height: 9px;
}
/* ─── Bulk Actions ──────────────────────────────── */
.st-bulk {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 16px;
  background: #f0fdf9;
  border: 1px solid #bbf7d0;
  border-radius: 10px;
}
.st-bulk-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #166534;
}
.st-bulk-count {
  background: #356768;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 8px;
  border-radius: 20px;
}
.st-bulk-clear {
  font-size: 11px;
  color: #356768;
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  padding: 0;
  font-weight: 600;
}
.st-bulk-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
/* ─── Table Wrapper ─────────────────────────────── */
.st-table-wrap {
  position: relative;
  background: #fff;
  border: 1px solid #e8edf2;
  border-radius: 12px;
  overflow: hidden;
}
/* Loading overlay */
.st-loading {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(2px);
}
.st-spinner {
  width: 28px;
  height: 28px;
  border: 2.5px solid #e2e8f0;
  border-top-color: #356768;
  border-right-color: #356768;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
/* Scroll container */
.st-scroll {
  overflow-x: auto;
  overflow-y: auto;
}
.st-scroll::-webkit-scrollbar {
  height: 6px;
  width: 6px;
}
.st-scroll::-webkit-scrollbar-track {
  background: #f8fafc;
}
.st-scroll::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 6px;
}
.st-scroll::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
/* ─── Table ─────────────────────────────────────── */
.st-table {
  width: 100%;
  border-collapse: collapse;
  white-space: nowrap;
  font-size: 12.5px;
}
/* Dense mode */
.st-table--dense .st-th,
.st-table--dense .st-td {
  padding-top: 7px !important;
  padding-bottom: 7px !important;
}
/* Header */
.st-thead {
  background: #f8fafc;
}
.st-thead--sticky {
  position: sticky;
  top: 0;
  z-index: 40;
}
.st-th {
  padding: 11px 16px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #64748b;
  background: #f8fafc;
  border-bottom: 1px solid #e8edf2;
  white-space: nowrap;
  user-select: none;
}
.st-th-icon {
  width: 40px;
  padding: 11px 10px;
  text-align: center;
}
.st-th-actions {
  text-align: center;
  width: 80px;
}
.st-th--sort {
  cursor: pointer;
}
.st-th--sort:hover {
  background: #f1f5f9;
  color: #334155;
}
/* ─── Export Modal ─────────────────────────────── */
.st-export-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.st-export-modal {
  background: #fff;
  border-radius: 12px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.st-export-modal-title {
  padding: 16px 20px;
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  border-bottom: 1px solid #e8edf2;
  color: #1e293b;
}
.st-export-modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.st-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.st-field label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}
.st-field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.st-input {
  height: 38px;
  padding: 0 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 13px;
  background: #fff;
  outline: none;
  transition: border-color 0.2s;
  color: #1e293b;
}
.st-input:focus {
  border-color: #356768;
}
.st-export-hint {
  font-size: 11px;
  color: #ef4444;
  margin: 0;
}
.st-export-modal-footer {
  padding: 16px 20px;
  background: #f8fafc;
  border-top: 1px solid #e8edf2;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.st-btn-primary {
  background: #356768;
  color: #fff;
  border-color: #356768;
}
.st-btn-primary:hover {
  background: #284c4d;
  color: #fff;
}
.st-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.st-th-inner {
  display: flex;
  align-items: center;
  gap: 5px;
}
/* Sort icons */
.st-sort-icon {
  display: inline-flex;
  align-items: center;
  color: #94a3b8;
  transition: color 0.12s;
  flex-shrink: 0;
}
.st-sort-icon--active {
  color: #356768;
}
.st-sort-idle {
  opacity: 0.3;
}
.st-th--sort:hover .st-sort-idle {
  opacity: 0.6;
}
.st-sort-icon sup {
  font-size: 8px;
  margin-left: 1px;
  line-height: 1;
  color: #356768;
}
/* Sticky columns */
.st-col-sticky-0 {
  position: sticky;
  left: 0;
  z-index: 30;
}
.st-col-sticky-1 {
  position: sticky;
  left: 40px;
  z-index: 30;
}
.st-col-sticky-r {
  position: sticky;
  right: 0;
  z-index: 30;
  box-shadow: -1px 0 0 #e8edf2;
}
/* ─── Rows ──────────────────────────────────────── */
.st-row {
  border-bottom: 1px solid #f1f5f9;
  transition: background 0.1s;
}
.st-row:hover {
  background: #fafbfc;
}
.st-row--expanded {
  background: #fafbfc;
}
.st-td {
  padding: 12px 16px;
  color: #334155;
  vertical-align: middle;
  background: inherit;
}
.st-table--dense .st-th {
  padding: 8px 12px;
}
.st-table--dense .st-td {
  padding: 6px 12px;
}
.st-table--dense .st-td-icon,
.st-table--dense .st-td-actions {
  padding: 6px 10px;
}
.st-td-icon {
  padding: 12px 10px;
  text-align: center;
}
.st-td-actions {
  text-align: center;
  padding: 12px 10px;
}
/* Checkbox input */
.st-checkbox-input {
  width: 15px;
  height: 15px;
  border-radius: 4px;
  border: 1.5px solid #cbd5e1;
  cursor: pointer;
  accent-color: #356768;
}
/* Expand button */
.st-expand-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  transition:
    color 0.12s,
    background 0.12s,
    transform 0.2s;
}
.st-expand-btn:hover {
  background: #f1f5f9;
  color: #356768;
}
.st-expand-btn--open {
  color: #356768;
  transform: rotate(90deg);
}
/* ─── Expansion Row ─────────────────────────────── */
.st-expansion-row {
  background: #fafbfc;
}
.st-expansion-td {
  padding: 0;
  border-bottom: 1px solid #f1f5f9;
}
.st-expansion-body {
  padding: 16px 20px 16px 56px;
  border-left: 2px solid #356768;
  margin-left: 20px;
  animation: expandIn 0.18s ease;
}
@keyframes expandIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
/* ─── Empty State ───────────────────────────────── */
.st-empty {
  padding: 60px 16px;
  background: #fff;
}
.st-empty-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #94a3b8;
  font-size: 12px;
  font-weight: 500;
}
.st-empty-icon {
  color: #cbd5e1;
}
.st-empty-query {
  font-size: 11px;
  color: #cbd5e1;
  background: #f8fafc;
  border: 1px solid #e8edf2;
  padding: 2px 10px;
  border-radius: 20px;
}
/* ─── Pagination ────────────────────────────────── */
.st-pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid #e8edf2;
  border-top: none;
  border-radius: 0 0 20px 20px;
}
.st-pagination-info {
  font-size: 12px;
  font-weight: 700;
  color: #475569;
}
.st-pagination-total {
  color: #94a3b8;
  font-weight: 500;
  margin-left: 4px;
}
.st-pagination-controls {
  display: flex;
  align-items: center;
  gap: 20px;
}
.st-per-page {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #94a3b8;
  font-weight: 600;
}
.st-per-page-select {
  height: 32px;
  padding: 0 8px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  font-size: 12px;
  font-weight: 700;
  color: #1e293b;
  outline: none;
  cursor: pointer;
  transition: all 0.15s;
}
.st-per-page-select:focus {
  border-color: #f97316;
  background: #fff;
}
.st-pages {
  display: flex;
  align-items: center;
  gap: 4px;
}
.st-page-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid transparent;
  background: transparent;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.st-page-btn:hover:not(:disabled) {
  background: #fff7ed;
  color: #f97316;
}
.st-page-btn:disabled {
  opacity: 0.3;
  cursor: default;
}
.st-page-btn--dots {
  opacity: 0.5 !important;
  background: transparent !important;
  color: #94a3b8 !important;
  pointer-events: none;
}
.st-page-btn--active {
  background: #f97316 !important;
  color: #fff !important;
  box-shadow: 0 4px 12px rgba(249, 115, 22, 0.25);
}
/* ─── Transitions ───────────────────────────────── */
.st-fade-enter-active,
.st-fade-leave-active {
  transition: opacity 0.18s ease;
}
.st-fade-enter-from,
.st-fade-leave-to {
  opacity: 0;
}
.st-pop-enter-active,
.st-pop-leave-active {
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
}
.st-pop-enter-from,
.st-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
.st-checkbox-input {
  accent-color: #f97316;
}
.st-checkbox--on {
  background: #f97316;
  border-color: #f97316;
}
</style>
