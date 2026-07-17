<script setup lang="ts">
import {
  ref,
  onMounted,
  onUnmounted,
  watch,
  computed,
  reactive,
  nextTick,
} from "vue";
import {
  X,
  Save,
  Upload,
  Trash2,
  Type,
  User,
  Calendar,
  Trophy,
  Image as ImageIcon,
  ChevronLeft,
  Loader2,
  MapPin,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Eye,
  EyeOff,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Copy,
  ChevronUp,
  ChevronDown,
  Minimize2,
  Grid,
  Move,
  PanelLeft,
  PanelRight,
  Check,
  Sliders,
  Star,
  RefreshCw,
  Monitor,
  AlertTriangle,
  Info,
  Smartphone,
} from "lucide-vue-next";
import * as fabric from "fabric";
import { authStore } from "../../store/auth";
const props = defineProps<{ eventId: number; isOpen: boolean }>();
const emit = defineEmits(["close", "saved"]);
const canvasEl = ref<HTMLCanvasElement | null>(null);
const containerRef = ref<HTMLElement | null>(null);
let canvas: fabric.Canvas | null = null;
const loading = ref(false);
const saving = ref(false);
const saveSuccess = ref(false);
const zoom = ref(1);
const showGrid = ref(false);
const activeTab = ref<"elements" | "layers">("elements");
const leftPanelOpen = ref(true);
const rightPanelOpen = ref(true);
const toastMsg = ref("");
const toastType = ref<"success" | "error" | "info">("info");
let toastTimer: ReturnType<typeof setTimeout> | null = null;
const isDirty = ref(false);
const lastSavedJson = ref("");
const templateVersion = ref<number | null>(null);
const historyStack = ref<string[]>([]);
const historyIndex = ref(-1);
const MAX_HISTORY = 50;
const MAX_W = 900;
const canvasWidth = ref(800);
const canvasHeight = ref(565);
const selectedObject = ref<any>(null);
const selectedProps = reactive<Record<string, any>>({});
const layers = ref<any[]>([]);
const eventData = ref<any>(null);
const liveDataMode = ref(false);
const sampleUsers = ref<any[]>([]);
const selectedSampleUser = ref<any>(null);
const originalDataMap = new Map<string, any>();
const showUserPicker = ref(false);
const userSearchQ = ref("");
const loadingUsers = ref(false);
const fontsReady = ref(false);
const fontDropdownOpen = ref(false);
const fontDdRef = ref<HTMLElement | null>(null);
const fontDdStyle = ref<Record<string, string>>({});
const isMobile = computed(() => {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768;
});
const showMobileWarn = ref(isMobile.value);
const fontFamilies = [
  "Kanit",
  "Sarabun",
  "Prompt",
  "Mitr",
  "Chakra Petch",
  "Noto Sans Thai",
  "IBM Plex Sans Thai",
  "Thasadith",
  "Georgia",
  "Playfair Display",
  "Montserrat",
  "Oswald",
];
const colorPresets = [
  "#111827",
  "#374151",
  "#6b7280",
  "#9ca3af",
  "#dc2626",
  "#ea580c",
  "#d97706",
  "#16a34a",
  "#0891b2",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#ffffff",
  "#f9fafb",
  "#f3f4f6",
  "#e5e7eb",
  "#ffd700",
  "#c0392b",
  "#8e44ad",
  "#1abc9c",
];
const placeholders = [
  { id: "user_fullname", label: "ชื่อ-นามสกุล", icon: User, category: "user" },
  { id: "user_nickname", label: "ชื่อเล่น", icon: User, category: "user" },
  { id: "user_team", label: "ชื่อทีม", icon: Trophy, category: "user" },
  {
    id: "user_picture",
    label: "รูปโปรไฟล์",
    icon: ImageIcon,
    category: "user",
  },
  { id: "user_score", label: "คะแนนสะสม", icon: Star, category: "user" },
  { id: "event_title", label: "ชื่อกิจกรรม", icon: Trophy, category: "event" },
  {
    id: "event_date",
    label: "วันที่กิจกรรม",
    icon: Calendar,
    category: "event",
  },
  {
    id: "event_organizer",
    label: "ผู้จัดกิจกรรม",
    icon: User,
    category: "event",
  },
  { id: "event_location", label: "สถานที่", icon: MapPin, category: "event" },
  {
    id: "issued_date",
    label: "วันที่ออกใบ",
    icon: Calendar,
    category: "event",
  },
];
const userPlaceholders = computed(() =>
  placeholders.filter((p) => p.category === "user"),
);
const eventPlaceholders = computed(() =>
  placeholders.filter((p) => p.category === "event"),
);
const isText = computed(() =>
  ["i-text", "textbox"].includes(selectedObject.value?.type),
);
const canUndo = computed(() => historyIndex.value > 0);
const canRedo = computed(
  () => historyIndex.value < historyStack.value.length - 1,
);
function showToast(msg: string, type: "success" | "error" | "info" = "info") {
  toastMsg.value = msg;
  toastType.value = type;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastMsg.value = "";
  }, 3000);
}
function sanitizeInput(str: string): string {
  return String(str)
    .slice(0, 500)
    .replace(/<[^>]*>/g, "");
}
const formatDateThai = (d: string) => {
  if (!d) return "";
  const dt = new Date(d);
  const m = [
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
  return `${dt.getDate()} ${m[dt.getMonth()]} ${dt.getFullYear() + 543}`;
};
const toSafeUrl = (url: string) => {
  if (!url || typeof url !== "string") return "";
  if (!url.startsWith("http") && !url.startsWith("/")) return "";
  try {
    if (url.startsWith("http")) {
      const u = new URL(url);
      const allowed = [window.location.hostname, "localhost"];
      if (allowed.includes(u.hostname)) return u.pathname + u.search;
    }
    return url;
  } catch {
    return "";
  }
};
const patchJsonForCORS = (obj: any): void => {
  if (!obj || typeof obj !== "object") return;
  if (typeof obj.src === "string") {
    obj.crossOrigin = "anonymous";
    obj.src = toSafeUrl(obj.src) || obj.src;
  }
  if (Array.isArray(obj.objects)) obj.objects.forEach(patchJsonForCORS);
  if (obj.backgroundImage) patchJsonForCORS(obj.backgroundImage);
};
const getPlaceholderDisplayText = (fieldId: string): string => {
  const found = placeholders.find((p) => p.id === fieldId);
  return found ? `[ ${found.label} ]` : `[ ${fieldId} ]`;
};
const resolveCanvasText = (obj: any): string => {
  const raw: string = obj.text || "";
  const token = raw.match(/^\{\{(.+?)\}\}$/)?.[1];
  if (token) return getPlaceholderDisplayText(token);
  return raw;
};
function syncSelectedProps() {
  const obj = canvas?.getActiveObject() as any;
  if (!obj) {
    Object.keys(selectedProps).forEach((k) => delete selectedProps[k]);
    return;
  }
  selectedProps.left = Math.round(obj.left || 0);
  selectedProps.top = Math.round(obj.top || 0);
  selectedProps.width = Math.round((obj.width || 0) * (obj.scaleX || 1));
  selectedProps.height = Math.round((obj.height || 0) * (obj.scaleY || 1));
  selectedProps.opacity = obj.opacity ?? 1;
  selectedProps.fill = obj.fill || "#000000";
  selectedProps.fontSize = obj.fontSize || 28;
  selectedProps.fontFamily = obj.fontFamily || "Kanit";
  selectedProps.fontWeight = obj.fontWeight || "normal";
  selectedProps.fontStyle = obj.fontStyle || "normal";
  selectedProps.underline = obj.underline || false;
  selectedProps.textAlign = obj.textAlign || "center";
  selectedProps.lineHeight = obj.lineHeight || 1.2;
  selectedProps.type = obj.type;
  selectedProps.data = obj.data;
}
function continueOnMobile() {
  showMobileWarn.value = false;
  setTimeout(initEditor, 100);
}
const waitFonts = async () => {
  try {
    await document.fonts.ready;
    fontsReady.value = true;
  } catch {
    fontsReady.value = true;
  }
};
onMounted(async () => {
  await waitFonts();
  if (props.isOpen && !isMobile.value) initEditor();
  window.addEventListener("beforeunload", handleBeforeUnload);
});
watch(
  () => props.isOpen,
  (v) => {
    if (v) {
      setTimeout(initEditor, 100);
    } else {
      disposeCanvas();
    }
  },
);
onUnmounted(() => {
  disposeCanvas();
  window.removeEventListener("beforeunload", handleBeforeUnload);
});
const handleBeforeUnload = (e: BeforeUnloadEvent) => {
  if (isDirty.value) {
    e.preventDefault();
    e.returnValue = "";
  }
};
const handleClose = async () => {
  if (isDirty.value) {
    const ok = window.confirm(
      "มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก ต้องการออกโดยไม่บันทึกหรือไม่?",
    );
    if (!ok) return;
  }
  emit("close");
};
const initEditor = async () => {
  if (!canvasEl.value) return;
  if (canvas) {
    canvas.dispose();
    canvas = null;
  }
  canvas = new fabric.Canvas(canvasEl.value, {
    width: canvasWidth.value,
    height: canvasHeight.value,
    backgroundColor: "#ffffff",
    preserveObjectStacking: true,
    fireRightClick: false,
    stopContextMenu: true,
  });
  canvas.on("selection:created", () => {
    selectedObject.value = canvas?.getActiveObject();
    syncSelectedProps();
  });
  canvas.on("selection:updated", () => {
    selectedObject.value = canvas?.getActiveObject();
    syncSelectedProps();
  });
  canvas.on("selection:cleared", () => {
    selectedObject.value = null;
    syncSelectedProps();
  });
  canvas.on("object:modified", () => {
    syncSelectedProps();
    pushHistory();
    updateLayers();
    markDirty();
  });
  canvas.on("object:scaling", () => syncSelectedProps());
  canvas.on("object:moving", () => syncSelectedProps());
  canvas.on("object:added", () => {
    updateLayers();
    markDirty();
  });
  canvas.on("object:removed", () => {
    updateLayers();
    markDirty();
  });
  await fetchTemplate();
  pushHistory();
};
const markDirty = () => {
  const current = canvas
    ? JSON.stringify((canvas as any).toObject(["data"]))
    : "";
  isDirty.value = current !== lastSavedJson.value;
};
function disposeCanvas() {
  if (canvas) {
    canvas.dispose();
    canvas = null;
    selectedObject.value = null;
  }
  eventData.value = null;
  isDirty.value = false;
}
const pushHistory = () => {
  if (!canvas) return;
  const json = JSON.stringify(canvas.toObject(["data"]));
  if (historyIndex.value < historyStack.value.length - 1)
    historyStack.value = historyStack.value.slice(0, historyIndex.value + 1);
  historyStack.value.push(json);
  if (historyStack.value.length > MAX_HISTORY) historyStack.value.shift();
  historyIndex.value = historyStack.value.length - 1;
};
const restoreJSON = async (json: string) => {
  if (!canvas) return;
  const parsed = JSON.parse(json);
  await (canvas as any).loadFromJSON(
    parsed,
    undefined,
    (_: any, fObj: any, jObj: any) => {
      if (jObj?.data && fObj) (fObj as any).data = jObj.data;
    },
  );
  refreshDisplayTexts();
  canvas.renderAll();
  updateLayers();
  selectedObject.value = null;
  syncSelectedProps();
};
const refreshDisplayTexts = () => {
  if (!canvas || liveDataMode.value) return;
  canvas.getObjects().forEach((obj: any) => {
    if (!["i-text", "text", "textbox"].includes(obj.type)) return;
    const token = obj.data?.field ? `{{${obj.data.field}}}` : null;
    if (!token) return;
    const display = getPlaceholderDisplayText(obj.data.field);
    if (obj.text !== display) obj.set({ text: display });
  });
  canvas.renderAll();
};
const undo = async () => {
  if (!canUndo.value) return;
  if (liveDataMode.value) await toggleLiveMode();
  historyIndex.value--;
  await restoreJSON(historyStack.value[historyIndex.value]);
  showToast("ย้อนกลับแล้ว", "info");
};
const redo = async () => {
  if (!canRedo.value) return;
  if (liveDataMode.value) await toggleLiveMode();
  historyIndex.value++;
  await restoreJSON(historyStack.value[historyIndex.value]);
  showToast("ทำซ้ำแล้ว", "info");
};
const setBackgroundFit = (img: fabric.Image) => {
  if (!canvas) return;
  let w = img.width || 800,
    h = img.height || 565;
  if (w > MAX_W) {
    h = h * (MAX_W / w);
    w = MAX_W;
  }
  canvasWidth.value = Math.round(w);
  canvasHeight.value = Math.round(h);
  canvas.setDimensions({
    width: canvasWidth.value,
    height: canvasHeight.value,
  });
  img.set({
    originX: "left",
    originY: "top",
    left: 0,
    top: 0,
    scaleX: canvasWidth.value / (img.width || 1),
    scaleY: canvasHeight.value / (img.height || 1),
    selectable: false,
    evented: false,
  });
  canvas.backgroundImage = img;
  canvas.renderAll();
};
const fetchTemplate = async () => {
  loading.value = true;
  try {
    const res = await fetch(`/api/certificates/templates/${props.eventId}`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data?.canvas_json) return;
    templateVersion.value = data.updated_at ?? data.version ?? null;
    if (data.width && data.height) {
      canvasWidth.value = data.width;
      canvasHeight.value = data.height;
      canvas?.setDimensions({ width: data.width, height: data.height });
    }
    const parsed =
      typeof data.canvas_json === "string"
        ? JSON.parse(data.canvas_json)
        : data.canvas_json;
    patchJsonForCORS(parsed);
    await (canvas as any)?.loadFromJSON(
      parsed,
      undefined,
      (_: any, fObj: any, jObj: any) => {
        if (jObj?.data && fObj) (fObj as any).data = jObj.data;
      },
    );
    refreshDisplayTexts();
    const bgImg = canvas?.backgroundImage as fabric.Image | undefined;
    if (bgImg) setBackgroundFit(bgImg);
    canvas?.renderAll();
    updateLayers();
    lastSavedJson.value = canvas
      ? JSON.stringify((canvas as any).toObject(["data"]))
      : "";
    isDirty.value = false;
  } catch {
    showToast("โหลดเทมเพลตไม่สำเร็จ", "error");
  } finally {
    loading.value = false;
  }
};
const checkConflict = async (): Promise<boolean> => {
  if (!templateVersion.value) return false;
  try {
    const res = await fetch(`/api/certificates/templates/${props.eventId}`);
    if (!res.ok) return false;
    const data = await res.json();
    const serverVersion = data.updated_at ?? data.version ?? null;
    if (serverVersion && serverVersion !== templateVersion.value) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
};
const getTokenFromDisplayText = (text: string): string => {
  const match = text.match(/^\[ (.+?) \]$/);
  if (!match) return text;
  const found = placeholders.find((p) => p.label === match[1]);
  return found ? `{{${found.id}}}` : text;
};
const serializeCanvasWithTokens = (): any => {
  if (!canvas) return null;
  const json = (canvas as any).toObject(["data"]);
  if (json.objects) {
    json.objects = json.objects.map((obj: any) => {
      if (["i-text", "text", "textbox"].includes(obj.type) && obj.data?.field) {
        return { ...obj, text: `{{${obj.data.field}}}` };
      }
      return obj;
    });
  }
  return json;
};
const saveTemplate = async () => {
  if (!canvas || saving.value) return;
  const wasLive = liveDataMode.value;
  if (wasLive) await toggleLiveMode();
  const hasConflict = await checkConflict();
  if (hasConflict) {
    const ok = window.confirm(
      "มีผู้อื่นแก้ไขเทมเพลตนี้ไปแล้ว ต้องการบันทึกทับหรือไม่?",
    );
    if (!ok) {
      showToast("ยกเลิกการบันทึก", "info");
      return;
    }
  }
  saving.value = true;
  try {
    const json = serializeCanvasWithTokens();
    const bgImg = canvas.backgroundImage as fabric.Image;
    const bgUrl = bgImg ? bgImg.getSrc() : "";
    const config =
      typeof eventData.value?.certificate_config === "string"
        ? JSON.parse(eventData.value.certificate_config)
        : eventData.value?.certificate_config || {};
    const currentMode = config.issue_mode || "immediately";
    const res = await fetch("/api/certificates/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: props.eventId,
        name: "เกียรติบัตร",
        background_url: bgUrl,
        canvas_json: JSON.stringify(json),
        width: canvasWidth.value,
        height: canvasHeight.value,
        issue_mode: currentMode,
      }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.message || errBody.error || `HTTP ${res.status}`);
    }
    const saved = await res.json();
    templateVersion.value =
      saved.updated_at ?? saved.version ?? templateVersion.value;
    lastSavedJson.value = canvas
      ? JSON.stringify((canvas as any).toObject(["data"]))
      : "";
    isDirty.value = false;
    saveSuccess.value = true;
    setTimeout(() => {
      saveSuccess.value = false;
    }, 2500);
    showToast("บันทึกสำเร็จ", "success");
    emit("saved");
  } catch (e: any) {
    showToast("บันทึกล้มเหลว: " + e.message, "error");
  } finally {
    saving.value = false;
  }
};
const fetchSampleUsers = async () => {
  loadingUsers.value = true;
  try {
    const res = await fetch("/api/users", {
      headers: { "x-user-id": String(authStore.user?.id) },
    });
    if (res.ok) {
      sampleUsers.value = await res.json();
      if (sampleUsers.value.length > 0 && !selectedSampleUser.value) {
        selectedSampleUser.value = sampleUsers.value[0];
      }
    }
  } catch {
    // intentionally silent (no console output in browser)
  } finally {
    loadingUsers.value = false;
  }
};
const fetchEventData = async () => {
  try {
    const res = await fetch(`/api/activities/${props.eventId}`);
    if (res.ok) eventData.value = await res.json();
  } catch {}
};
const filteredUsers = computed(() => {
  const q = userSearchQ.value.toLowerCase().trim();
  if (!q) return sampleUsers.value.slice(0, 100);
  return sampleUsers.value
    .filter(
      (u) =>
        (u.fname_th || "").toLowerCase().includes(q) ||
        (u.lname_th || "").toLowerCase().includes(q) ||
        (u.nickname || "").toLowerCase().includes(q) ||
        (u.line_id || "").toLowerCase().includes(q),
    )
    .slice(0, 100);
});
async function toggleLiveMode() {
  if (!canvas) return;
  if (liveDataMode.value) {
    await revertLivePreview();
    liveDataMode.value = false;
  } else {
    if (!selectedSampleUser.value) await fetchSampleUsers();
    if (!eventData.value) await fetchEventData();
    // Start live mode BEFORE applying to prevent race condition with refreshDisplayTexts
    liveDataMode.value = true;
    await applyLivePreview();
  }
}
const applyLivePreview = async () => {
  if (!canvas) return;
  const u = selectedSampleUser.value || authStore.user || {};
  const ev = eventData.value || {};
  const today = new Date().toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const rep: Record<string, string> = {
    "{{user_fullname}}":
      [u.fname_th, u.lname_th].filter(Boolean).join(" ") || "ชื่อ-นามสกุล",
    "{{user_nickname}}": u.nickname || "ชื่อเล่น",
    "{{user_team}}": u.team_name || "ชื่อทีม",
    "{{user_score}}": String(u.total_score ?? 0),
    "{{event_title}}": ev.title || "ชื่อกิจกรรม",
    "{{event_date}}": ev.start_date
      ? formatDateThai(ev.start_date)
      : "วันที่กิจกรรม",
    "{{event_organizer}}": ev.organizer || "ผู้จัดกิจกรรม",
    "{{event_location}}": ev.location_name || "สถานที่",
    "{{issued_date}}": today,
  };
  const objs = canvas.getObjects();
  for (const obj of objs) {
    const o = obj as any;
    if (["i-text", "text", "textbox"].includes(o.type)) {
      const field = o.data?.field;
      const token = field ? `{{${field}}}` : null;
      // Use a unique ID for the map key
      const objId =
        o.id || o.get("id") || String(o) + (o.left || 0) + (o.top || 0);
      if (!originalDataMap.has(objId)) {
        originalDataMap.set(objId, token || o.text);
      }
      // Force use token as base if field exists (Robust replacement)
      let txt = token || o.text || "";
      for (const [k, v] of Object.entries(rep)) {
        if (typeof txt === "string") {
          txt = txt.replaceAll(k, String(v ?? ""));
        }
      }
      o.set({ text: txt });
    }
    if (o.data?.field === "user_picture") {
      const picUrl = toSafeUrl(u.picture_url || u.pictureUrl || u.avatar || "");
      if (picUrl) {
        try {
          const img = await (fabric.Image as any).fromURL(picUrl, {
            crossOrigin: "anonymous",
          });
          const scaleX = o.scaleX ?? 1;
          const rawR =
            o.radius ?? Math.min(o.width || 120, o.height || 120) / 2;
          const tR = rawR * Math.max(scaleX, o.scaleY ?? 1);
          const scale = Math.max(
            (tR * 2) / (img.width || 1),
            (tR * 2) / (img.height || 1),
          );
          img.set({
            left: o.left,
            top: o.top,
            originX: o.originX || "center",
            originY: o.originY || "center",
            scaleX: scale,
            scaleY: scale,
            angle: o.angle || 0,
            clipPath: new fabric.Circle({
              radius: tR / scale,
              originX: "center",
              originY: "center",
            }),
            data: { isLivePreview: true, placeholderSource: o.id || String(o) },
          });
          o.set({ visible: false });
          canvas.add(img);
        } catch {
          // intentionally silent (no console output in browser)
        }
      }
    }
  }
  canvas.renderAll();
};
const revertLivePreview = async () => {
  if (!canvas) return;
  const objs = canvas.getObjects();
  const toRemove: any[] = [];
  for (const obj of objs) {
    const o = obj as any;
    if (o.data?.isLivePreview) {
      toRemove.push(o);
      continue;
    }
    if (o.data?.field === "user_picture") o.set({ visible: true });
    if (["i-text", "text", "textbox"].includes(o.type)) {
      const objId =
        o.id || o.get("id") || String(o) + (o.left || 0) + (o.top || 0);
      const orig = originalDataMap.get(objId);
      if (orig !== undefined) {
        const display = orig.match(/^\{\{(.+?)\}\}$/)
          ? getPlaceholderDisplayText(orig.match(/^\{\{(.+?)\}\}$/)![1])
          : orig;
        o.set({ text: display });
      }
    }
  }
  toRemove.forEach((rm) => canvas?.remove(rm));
  originalDataMap.clear();
  canvas.renderAll();
};
const selectSampleUser = async (user: any) => {
  selectedSampleUser.value = user;
  showUserPicker.value = false;
  if (liveDataMode.value) {
    await revertLivePreview();
    await applyLivePreview();
  }
};
const addText = () => {
  if (!canvas) return;
  const t = new fabric.IText("พิมพ์ข้อความ", {
    left: canvasWidth.value / 2,
    top: canvasHeight.value / 2,
    originX: "center",
    originY: "center",
    fontFamily: "Kanit",
    fontSize: 28,
    fill: "#1e293b",
  });
  canvas.add(t);
  canvas.setActiveObject(t);
  canvas.renderAll();
  pushHistory();
};
const addPlaceholder = (p: (typeof placeholders)[0]) => {
  if (!canvas) return;
  if (p.id === "user_picture") {
    const c = new fabric.Circle({
      radius: 60,
      fill: "rgba(99,102,241,0.07)",
      stroke: "#6366f1",
      strokeWidth: 2,
      strokeDashArray: [6, 4],
      left: canvasWidth.value / 2,
      top: canvasHeight.value / 2,
      originX: "center",
      originY: "center",
    });
    c.set("data", { field: "user_picture" });
    canvas.add(c);
    canvas.setActiveObject(c);
    canvas.renderAll();
    pushHistory();
    return;
  }
  const displayText = getPlaceholderDisplayText(p.id);
  const t = new fabric.IText(displayText, {
    left: canvasWidth.value / 2,
    top: canvasHeight.value / 2,
    originX: "center",
    originY: "center",
    fontFamily: "Kanit",
    fontSize: 28,
    fontWeight: "bold",
    fill: "#1e293b",
  });
  t.set("data", { field: p.id });
  canvas.add(t);
  canvas.setActiveObject(t);
  canvas.renderAll();
  pushHistory();
};
const deleteSelected = () => {
  const a = canvas?.getActiveObject();
  if (!a) return;
  canvas?.remove(a);
  canvas?.discardActiveObject();
  canvas?.renderAll();
  selectedObject.value = null;
  syncSelectedProps();
  pushHistory();
};
const duplicateSelected = async () => {
  const a = canvas?.getActiveObject();
  if (!a) return;
  const cloned = await (a as any).clone();
  if ((a as any).data) (cloned as any).data = { ...(a as any).data };
  cloned.set({ left: (a.left || 0) + 20, top: (a.top || 0) + 20 });
  canvas?.add(cloned);
  canvas?.setActiveObject(cloned);
  canvas?.renderAll();
  pushHistory();
};
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
const handleBgUpload = async (e: any) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
    showToast("รองรับเฉพาะ PNG และ JPG", "error");
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast("ไฟล์ต้องไม่เกิน 10MB", "error");
    return;
  }
  loading.value = true;
  try {
    const b64 = await fileToBase64(file);
    const img = await (fabric.Image as any).fromURL(b64, {
      crossOrigin: "anonymous",
    });
    if (canvas) {
      setBackgroundFit(img);
      pushHistory();
      showToast("อัปโหลดพื้นหลังสำเร็จ", "success");
    }
  } catch (err: any) {
    showToast("อัปโหลดล้มเหลว: " + err.message, "error");
  } finally {
    loading.value = false;
  }
};
const setZoom = (z: number) => {
  zoom.value = Math.max(0.3, Math.min(2, z));
};
const zoomIn = () => setZoom(zoom.value + 0.1);
const zoomOut = () => setZoom(zoom.value - 0.1);
const updateLayers = () => {
  if (!canvas) return;
  layers.value = [...canvas.getObjects()].reverse().map((obj: any, i) => ({
    id: i,
    obj,
    label: obj.data?.field
      ? placeholders.find((p) => p.id === obj.data.field)?.label ||
        obj.data.field
      : obj.type === "i-text"
        ? obj.text?.slice(0, 18) || "ข้อความ"
        : obj.type,
    type: obj.type,
    visible: obj.visible !== false,
  }));
};
const bringToFront = () => {
  const a = canvas?.getActiveObject();
  if (a && canvas) {
    (canvas as any).bringObjectToFront(a);
    canvas.renderAll();
    updateLayers();
  }
};
const bringForward = () => {
  const a = canvas?.getActiveObject();
  if (a && canvas) {
    (canvas as any).bringObjectForward(a);
    canvas.renderAll();
    updateLayers();
  }
};
const sendBackward = () => {
  const a = canvas?.getActiveObject();
  if (a && canvas) {
    (canvas as any).sendObjectBackwards(a);
    canvas.renderAll();
    updateLayers();
  }
};
const sendToBack = () => {
  const a = canvas?.getActiveObject();
  if (a && canvas) {
    (canvas as any).sendObjectToBack(a);
    canvas.renderAll();
    updateLayers();
  }
};
const selectLayer = (obj: any) => {
  if (!canvas) return;
  canvas.setActiveObject(obj);
  canvas.renderAll();
  selectedObject.value = obj;
  syncSelectedProps();
};
const toggleVisible = (obj: any) => {
  obj.set({ visible: !obj.visible });
  canvas?.renderAll();
  updateLayers();
};
const updateStyle = (key: string, val: any) => {
  const obj = canvas?.getActiveObject() as any;
  if (!obj) return;
  obj.set(key as any, val);
  (selectedProps as any)[key] = val;
  canvas?.renderAll();
};
const updateFill = (val: string) => {
  if (!/^#[0-9A-Fa-f]{3,8}$/.test(val) && !/^rgba?\(/.test(val)) return;
  updateStyle("fill", val);
};
const toggleBold = () =>
  updateStyle(
    "fontWeight",
    selectedProps.fontWeight === "bold" ? "normal" : "bold",
  );
const toggleItalic = () =>
  updateStyle(
    "fontStyle",
    selectedProps.fontStyle === "italic" ? "normal" : "italic",
  );
const toggleUnderline = () =>
  updateStyle("underline", !selectedProps.underline);
const setAlign = (al: string) => updateStyle("textAlign", al);
const onKeyDown = (e: KeyboardEvent) => {
  if (!props.isOpen) return;
  const tgt = e.target as HTMLElement;
  const inInput =
    ["INPUT", "TEXTAREA", "SELECT"].includes(tgt.tagName) ||
    tgt.isContentEditable;
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key === "z") {
    e.preventDefault();
    undo();
    return;
  }
  if (ctrl && e.key === "y") {
    e.preventDefault();
    redo();
    return;
  }
  if (ctrl && e.key === "s") {
    e.preventDefault();
    saveTemplate();
    return;
  }
  if (ctrl && e.key === "d") {
    e.preventDefault();
    duplicateSelected();
    return;
  }
  if (!inInput && (e.key === "Delete" || e.key === "Backspace"))
    deleteSelected();
};
function openFontDropdown() {
  if (fontDdRef.value) {
    const rect = fontDdRef.value.getBoundingClientRect();
    const wantHeight = 280;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < wantHeight + 8 && rect.top > wantHeight + 8;
    fontDdStyle.value = openUp
      ? {
          position: "fixed",
          bottom: window.innerHeight - rect.top + 4 + "px",
          left: rect.left + "px",
          width: rect.width + "px",
        }
      : {
          position: "fixed",
          top: rect.bottom + 4 + "px",
          left: rect.left + "px",
          width: rect.width + "px",
        };
  }
  fontDropdownOpen.value = true;
}
function toggleFontDropdown() {
  if (fontDropdownOpen.value) fontDropdownOpen.value = false;
  else openFontDropdown();
}
function selectFont(f: string) {
  updateStyle("fontFamily", f);
  fontDropdownOpen.value = false;
}
function onDocClickForDd() {
  fontDropdownOpen.value = false;
}
onMounted(() => {
  window.addEventListener("keydown", onKeyDown);
  document.addEventListener("click", onDocClickForDd);
});
onUnmounted(() => {
  window.removeEventListener("keydown", onKeyDown);
  document.removeEventListener("click", onDocClickForDd);
  if (toastTimer) clearTimeout(toastTimer);
});
</script>
<template>
  <Teleport to="body">
    <Transition name="er-fade">
      <div v-if="isOpen" class="er">
        <Transition name="toast-slide">
          <div v-if="toastMsg" class="toast" :class="toastType">
            <Check v-if="toastType === 'success'" :size="14" />
            <AlertTriangle v-else-if="toastType === 'error'" :size="14" />
            <Info v-else :size="14" />
            <span>{{ toastMsg }}</span>
          </div>
        </Transition>
        <header class="top-bar">
          <div class="tb-l">
            <button class="tb-back" @click="handleClose" title="กลับ">
              <ChevronLeft :size="16" />
            </button>
            <div class="tb-brand">
              <span class="tb-logo">◆</span>
              <span>Certificate Studio</span>
            </div>
            <span class="tb-tag">Event #{{ eventId }}</span>
            <span
              v-if="isDirty"
              class="tb-dirty"
              title="มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก"
              >●</span
            >
          </div>
          <div class="tb-c">
            <button
              class="tb-btn"
              :class="{ dim: !canUndo }"
              @click="undo"
              title="Undo (Ctrl+Z)"
            >
              <RotateCcw :size="14" />
            </button>
            <button
              class="tb-btn"
              :class="{ dim: !canRedo }"
              @click="redo"
              title="Redo (Ctrl+Y)"
              style="transform: scaleX(-1)"
            >
              <RotateCcw :size="14" />
            </button>
            <div class="tb-sep"></div>
            <button class="tb-btn" @click="zoomOut" title="ย่อ">
              <ZoomOut :size="14" />
            </button>
            <div class="tb-zoom">
              <input
                type="number"
                :value="Math.round(zoom * 100)"
                @input="(e: any) => setZoom(e.target.value / 100)"
                min="30"
                max="200"
              />
              <span>%</span>
            </div>
            <button class="tb-btn" @click="zoomIn" title="ขยาย">
              <ZoomIn :size="14" />
            </button>
            <button class="tb-btn" @click="setZoom(1)" title="Reset zoom">
              <Minimize2 :size="14" />
            </button>
            <div class="tb-sep"></div>
            <button
              class="tb-btn"
              :class="{ 'tb-on': showGrid }"
              @click="showGrid = !showGrid"
              title="แสดงตาราง"
            >
              <Grid :size="14" />
            </button>
            <div class="tb-sep"></div>
            <button
              class="tb-btn live-btn"
              :class="{ 'tb-on': liveDataMode }"
              @click="toggleLiveMode"
              :title="
                liveDataMode ? 'ปิดการจำลองข้อมูล' : 'เปิดการจำลองข้อมูลจริง'
              "
            >
              <User :size="14" />
              <span v-if="!isMobile" class="live-lbl">{{
                liveDataMode ? "โหมดจำลอง" : "จำลองข้อมูล"
              }}</span>
            </button>
            <div
              v-if="liveDataMode"
              class="user-sel-pill"
              @click="showUserPicker = true"
            >
              <img
                :src="
                  selectedSampleUser?.picture_url ||
                  'https://api.dicebear.com/7.x/initials/svg?seed=U'
                "
                class="usp-img"
              />
              <span class="usp-name">{{
                selectedSampleUser?.fname_th || "เลือกผู้ใช้"
              }}</span>
              <ChevronDown :size="10" />
            </div>
          </div>
          <div class="tb-r">
            <button
              class="btn-save"
              :class="{ saving, ok: saveSuccess }"
              @click="saveTemplate"
              :disabled="saving"
              title="บันทึก (Ctrl+S)"
            >
              <Transition name="ico" mode="out-in">
                <Check v-if="saveSuccess" :size="13" key="ok" />
                <Loader2 v-else-if="saving" :size="13" class="spin" key="sp" />
                <Save v-else :size="13" key="sv" />
              </Transition>
              <span>{{
                saveSuccess
                  ? "บันทึกแล้ว"
                  : saving
                    ? "กำลังบันทึก..."
                    : "บันทึก"
              }}</span>
            </button>
            <div class="tb-sep"></div>
            <button
              class="tb-btn"
              :class="{ 'tb-on': leftPanelOpen }"
              @click="leftPanelOpen = !leftPanelOpen"
              title="แสดง/ซ่อน แผงซ้าย"
            >
              <PanelLeft :size="14" />
            </button>
            <button
              class="tb-btn"
              :class="{ 'tb-on': rightPanelOpen }"
              @click="rightPanelOpen = !rightPanelOpen"
              title="แสดง/ซ่อน แผงขวา"
            >
              <PanelRight :size="14" />
            </button>
          </div>
        </header>
        <div class="er-body">
          <Transition name="sl">
            <aside v-if="leftPanelOpen" class="panel pl">
              <div class="p-tabs">
                <button
                  class="p-tab"
                  :class="{ on: activeTab === 'elements' }"
                  @click="activeTab = 'elements'"
                >
                  <Layers :size="12" /> Elements
                </button>
                <button
                  class="p-tab"
                  :class="{ on: activeTab === 'layers' }"
                  @click="activeTab = 'layers'"
                >
                  <Move :size="12" /> Layers
                </button>
              </div>
              <div v-if="activeTab === 'elements'" class="p-body">
                <section class="ps">
                  <p class="ps-h">พื้นหลัง</p>
                  <label class="upload-zone">
                    <Upload :size="18" class="uz-ico" />
                    <span class="uz-txt">อัปโหลดภาพพื้นหลัง</span>
                    <span class="uz-sub"
                      >PNG / JPG · สูงสุด 10MB · แนะนำ 1200×850px</span
                    >
                    <input
                      type="file"
                      class="hidden"
                      accept="image/png,image/jpeg"
                      @change="handleBgUpload"
                    />
                  </label>
                </section>
                <section class="ps">
                  <p class="ps-h">ข้อความ</p>
                  <button
                    class="el-row"
                    @click="addText"
                    title="เพิ่มข้อความอิสระ"
                  >
                    <div class="el-icon"><Type :size="15" /></div>
                    <div>
                      <p class="el-name">เพิ่มข้อความอิสระ</p>
                      <p class="el-sub">Double-click เพื่อแก้ไข</p>
                    </div>
                  </button>
                </section>
                <section class="ps">
                  <p class="ps-h">ข้อมูลผู้เข้าร่วม</p>
                  <div class="ph-list">
                    <button
                      v-for="p in userPlaceholders"
                      :key="p.id"
                      class="ph-row"
                      @click="addPlaceholder(p)"
                      :title="`เพิ่ม ${p.label}`"
                    >
                      <component :is="p.icon" :size="13" class="ph-ico" />
                      <span>{{ p.label }}</span>
                    </button>
                  </div>
                </section>
                <section class="ps">
                  <p class="ps-h">ข้อมูลกิจกรรม</p>
                  <div class="ph-list">
                    <button
                      v-for="p in eventPlaceholders"
                      :key="p.id"
                      class="ph-row"
                      @click="addPlaceholder(p)"
                      :title="`เพิ่ม ${p.label}`"
                    >
                      <component :is="p.icon" :size="13" class="ph-ico" />
                      <span>{{ p.label }}</span>
                    </button>
                  </div>
                </section>
              </div>
              <div v-else class="p-body">
                <p class="lc">{{ layers.length }} layers</p>
                <div v-if="layers.length" class="llist">
                  <div
                    v-for="l in layers"
                    :key="l.id"
                    class="lrow"
                    :class="{ sel: selectedObject === l.obj }"
                    @click="selectLayer(l.obj)"
                    :title="l.label"
                  >
                    <div class="lt">
                      <Type v-if="l.type === 'i-text'" :size="10" />
                      <span v-else-if="l.type === 'circle'" class="lt-c"></span>
                      <ImageIcon v-else :size="10" />
                    </div>
                    <span class="ln">{{ l.label }}</span>
                    <button
                      class="lv"
                      @click.stop="toggleVisible(l.obj)"
                      :title="l.visible ? 'ซ่อน' : 'แสดง'"
                    >
                      <Eye v-if="l.visible" :size="11" />
                      <EyeOff v-else :size="11" />
                    </button>
                  </div>
                </div>
                <div v-else class="le">
                  <Layers :size="20" />
                  <span>ยังไม่มี elements</span>
                  <p class="le-hint">เพิ่ม element จากแถบ Elements</p>
                </div>
              </div>
            </aside>
          </Transition>
          <main class="cw" ref="containerRef">
            <div class="cs">
              <Transition name="fade">
                <div v-if="loading" class="cov">
                  <div class="ring"></div>
                  <p>กำลังโหลดเทมเพลต...</p>
                </div>
              </Transition>
              <div
                v-if="showGrid"
                class="gl"
                :style="{
                  width: canvasWidth * zoom + 'px',
                  height: canvasHeight * zoom + 'px',
                  backgroundSize: `${40 * zoom}px ${40 * zoom}px`,
                }"
              ></div>
              <div
                class="cf"
                :style="{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top center',
                  marginBottom: `${canvasHeight * zoom - canvasHeight + 48}px`,
                }"
              >
                <canvas ref="canvasEl"></canvas>
              </div>
            </div>
            <div class="zpill">
              <button @click="zoomOut" title="ย่อ">
                <ZoomOut :size="13" />
              </button>
              <span>{{ Math.round(zoom * 100) }}%</span>
              <button @click="zoomIn" title="ขยาย">
                <ZoomIn :size="13" />
              </button>
            </div>
          </main>
          <Transition name="sr">
            <aside v-if="rightPanelOpen" class="panel pr">
              <div v-if="selectedObject" class="p-body props">
                <div class="ph">
                  <span class="pt">{{
                    isText ? "ข้อความ" : "องค์ประกอบ"
                  }}</span>
                  <div class="pa">
                    <button
                      class="ab"
                      title="ทำซ้ำ (Ctrl+D)"
                      @click="duplicateSelected"
                    >
                      <Copy :size="11" />
                    </button>
                    <button
                      class="ab red"
                      title="ลบ (Del)"
                      @click="deleteSelected"
                    >
                      <Trash2 :size="11" />
                    </button>
                  </div>
                </div>
                <div class="pb">
                  <p class="pl">ตำแหน่งและขนาด</p>
                  <div class="coord-grid">
                    <label class="coord-cell" title="ระยะจากขอบซ้าย">
                      <span class="coord-tag">← ซ้าย</span>
                      <div class="coord-row">
                        <input
                          type="number"
                          class="coord-inp"
                          :value="selectedProps.left"
                          @input="
                            (e: any) => updateStyle('left', +e.target.value)
                          "
                        />
                        <span class="coord-unit">px</span>
                      </div>
                    </label>
                    <label class="coord-cell" title="ระยะจากขอบบน">
                      <span class="coord-tag">↑ บน</span>
                      <div class="coord-row">
                        <input
                          type="number"
                          class="coord-inp"
                          :value="selectedProps.top"
                          @input="
                            (e: any) => updateStyle('top', +e.target.value)
                          "
                        />
                        <span class="coord-unit">px</span>
                      </div>
                    </label>
                    <label
                      class="coord-cell ro"
                      title="ความกว้าง (ลากมุมเพื่อปรับ)"
                    >
                      <span class="coord-tag">↔ กว้าง</span>
                      <div class="coord-row">
                        <input
                          type="number"
                          class="coord-inp"
                          readonly
                          :value="selectedProps.width"
                        />
                        <span class="coord-unit">px</span>
                      </div>
                    </label>
                    <label
                      class="coord-cell ro"
                      title="ความสูง (ลากมุมเพื่อปรับ)"
                    >
                      <span class="coord-tag">↕ สูง</span>
                      <div class="coord-row">
                        <input
                          type="number"
                          class="coord-inp"
                          readonly
                          :value="selectedProps.height"
                        />
                        <span class="coord-unit">px</span>
                      </div>
                    </label>
                  </div>
                </div>
                <div class="pb">
                  <p class="pl">ลำดับชั้น</p>
                  <div class="obs">
                    <button class="ob" @click="bringToFront" title="ขึ้นสุด">
                      <ChevronUp :size="11" /><ChevronUp
                        :size="11"
                        style="margin-left: -5px"
                      />
                    </button>
                    <button
                      class="ob"
                      @click="bringForward"
                      title="ขึ้นหนึ่งชั้น"
                    >
                      <ChevronUp :size="11" />
                    </button>
                    <button
                      class="ob"
                      @click="sendBackward"
                      title="ลงหนึ่งชั้น"
                    >
                      <ChevronDown :size="11" />
                    </button>
                    <button class="ob" @click="sendToBack" title="ลงสุด">
                      <ChevronDown :size="11" /><ChevronDown
                        :size="11"
                        style="margin-left: -5px"
                      />
                    </button>
                  </div>
                </div>
                <div class="pdiv"></div>
                <template v-if="isText">
                  <div class="pb">
                    <p class="pl">ฟอนต์</p>
                    <div
                      class="dd"
                      :class="{ open: fontDropdownOpen }"
                      ref="fontDdRef"
                    >
                      <button
                        type="button"
                        class="dd-trigger"
                        @click.stop="toggleFontDropdown"
                      >
                        <span
                          class="dd-current"
                          :style="{
                            fontFamily: selectedProps.fontFamily || 'Kanit',
                          }"
                        >
                          {{ selectedProps.fontFamily || "Kanit" }}
                        </span>
                        <ChevronDown :size="14" class="dd-chevron" />
                      </button>
                      <Teleport to="body">
                        <Transition name="dd">
                          <div
                            v-if="fontDropdownOpen"
                            class="dd-menu"
                            :style="fontDdStyle"
                            @click.stop
                          >
                            <button
                              v-for="f in fontFamilies"
                              :key="f"
                              type="button"
                              class="dd-item"
                              :class="{
                                active: selectedProps.fontFamily === f,
                              }"
                              :style="{ fontFamily: f }"
                              @click.stop="selectFont(f)"
                            >
                              <span>{{ f }}</span>
                              <Check
                                v-if="selectedProps.fontFamily === f"
                                :size="13"
                                class="dd-check"
                              />
                            </button>
                          </div>
                        </Transition>
                      </Teleport>
                    </div>
                  </div>
                  <!-- ส่วนที่ปรับปรุง: ขยายช่องกรอกข้อมูลให้เรียงแนวตั้งและกว้างขึ้น -->
                  <div class="r-stack">
                    <div class="pf">
                      <label>ขนาดตัวอักษร (px)</label>
                      <input
                        type="number"
                        class="pi-expanded"
                        min="6"
                        max="300"
                        :value="selectedProps.fontSize"
                        @input="
                          (e: any) =>
                            updateStyle(
                              'fontSize',
                              Math.max(6, Math.min(300, +e.target.value)),
                            )
                        "
                      />
                    </div>
                    <div class="pf">
                      <label>ระยะห่างบรรทัด</label>
                      <input
                        type="number"
                        class="pi-expanded"
                        step="0.1"
                        min="0.5"
                        max="5"
                        :value="selectedProps.lineHeight"
                        @input="
                          (e: any) => updateStyle('lineHeight', +e.target.value)
                        "
                      />
                    </div>
                  </div>
                  <div class="pb">
                    <p class="pl">สไตล์</p>
                    <div class="srow">
                      <button
                        class="sb"
                        :class="{ on: selectedProps.fontWeight === 'bold' }"
                        @click="toggleBold"
                        title="ตัวหนา"
                      >
                        <Bold :size="12" />
                      </button>
                      <button
                        class="sb"
                        :class="{ on: selectedProps.fontStyle === 'italic' }"
                        @click="toggleItalic"
                        title="ตัวเอียง"
                      >
                        <Italic :size="12" />
                      </button>
                      <button
                        class="sb"
                        :class="{ on: selectedProps.underline }"
                        @click="toggleUnderline"
                        title="ขีดเส้นใต้"
                      >
                        <Underline :size="12" />
                      </button>
                      <span class="sdiv"></span>
                      <button
                        class="sb"
                        :class="{ on: selectedProps.textAlign === 'left' }"
                        @click="setAlign('left')"
                        title="จัดซ้าย"
                      >
                        <AlignLeft :size="12" />
                      </button>
                      <button
                        class="sb"
                        :class="{
                          on:
                            selectedProps.textAlign === 'center' ||
                            !selectedProps.textAlign,
                        }"
                        @click="setAlign('center')"
                        title="จัดกลาง"
                      >
                        <AlignCenter :size="12" />
                      </button>
                      <button
                        class="sb"
                        :class="{ on: selectedProps.textAlign === 'right' }"
                        @click="setAlign('right')"
                        title="จัดขวา"
                      >
                        <AlignRight :size="12" />
                      </button>
                    </div>
                  </div>
                </template>
                <div class="pb">
                  <p class="pl">{{ isText ? "สีตัวอักษร" : "สี" }}</p>
                  <div class="crow">
                    <div
                      class="cs-swatch"
                      :style="{ background: selectedProps.fill }"
                      title="คลิกเพื่อเลือกสี"
                    >
                      <input
                        type="color"
                        :value="
                          selectedProps.fill &&
                          selectedProps.fill.startsWith('#')
                            ? selectedProps.fill
                            : '#6366f1'
                        "
                        @input="(e: any) => updateFill(e.target.value)"
                        class="cinput"
                      />
                    </div>
                    <input
                      type="text"
                      class="pi chex"
                      :value="selectedProps.fill"
                      @input="(e: any) => updateFill(e.target.value)"
                      placeholder="#000000"
                      maxlength="25"
                    />
                  </div>
                  <div class="cps">
                    <button
                      v-for="c in colorPresets"
                      :key="c"
                      class="cp"
                      :style="{
                        background: c,
                        outline: c === '#ffffff' ? '1px solid #e5e7eb' : 'none',
                      }"
                      :title="c"
                      @click="updateFill(c)"
                    >
                      <Check
                        v-if="selectedProps.fill === c"
                        :size="7"
                        class="cpck"
                      />
                    </button>
                  </div>
                </div>
                <div class="pb">
                  <div class="pl-r">
                    <p class="pl">ความโปร่งใส</p>
                    <span class="pv"
                      >{{ Math.round(selectedProps.opacity * 100) }}%</span
                    >
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    :value="selectedProps.opacity"
                    @input="(e: any) => updateStyle('opacity', +e.target.value)"
                    class="pr-range"
                  />
                </div>
                <div class="pdiv"></div>
                <button
                  class="del-btn"
                  @click="deleteSelected"
                  title="ลบ element นี้ (Del)"
                >
                  <Trash2 :size="13" />
                  <span>ลบ element นี้</span>
                </button>
              </div>
              <div v-else class="props-empty">
                <div class="em-rings">
                  <div class="em-r r1"></div>
                  <div class="em-r r2"></div>
                  <Sliders :size="22" class="em-ico" />
                </div>
                <p class="em-t">เลือก Element</p>
                <p class="em-s">
                  คลิกที่ข้อความหรือองค์ประกอบบนเกียรติบัตรเพื่อปรับแต่ง
                </p>
                <div class="scs">
                  <div class="sc"><kbd>Ctrl+Z</kbd><span>Undo</span></div>
                  <div class="sc"><kbd>Ctrl+Y</kbd><span>Redo</span></div>
                  <div class="sc"><kbd>Ctrl+S</kbd><span>Save</span></div>
                  <div class="sc"><kbd>Ctrl+D</kbd><span>Duplicate</span></div>
                  <div class="sc"><kbd>Del</kbd><span>Delete</span></div>
                </div>
              </div>
            </aside>
          </Transition>
        </div>
        <Transition name="modal">
          <div
            v-if="showUserPicker"
            class="modal-bg"
            @click.self="showUserPicker = false"
          >
            <div class="user-picker-box">
              <div class="uph">
                <h3>เลือกผู้ใช้เพื่อจำลองข้อมูล</h3>
                <button class="upc" @click="showUserPicker = false">
                  <X :size="16" />
                </button>
              </div>
              <div class="up-search">
                <Grid :size="14" class="ups-ico" />
                <input
                  v-model="userSearchQ"
                  placeholder="ค้นหาชื่อ, นามสกุล, หรือชื่อเล่น..."
                />
              </div>
              <div class="up-list">
                <div v-if="loadingUsers" class="up-loading">
                  <Loader2 :size="20" class="spin" />
                  <span>กำลังดึงข้อมูลผู้ใช้...</span>
                </div>
                <button
                  v-for="u in filteredUsers"
                  :key="u.id"
                  class="u-row"
                  @click="selectSampleUser(u)"
                  :class="{ sel: selectedSampleUser?.id === u.id }"
                >
                  <img
                    :src="
                      u.picture_url ||
                      'https://api.dicebear.com/7.x/initials/svg?seed=' +
                        encodeURIComponent(
                          [u.fname_th, u.lname_th].filter(Boolean).join(' '),
                        )
                    "
                    class="u-avatar"
                    referrerpolicy="no-referrer"
                  />
                  <div class="u-info">
                    <p class="u-name">
                      {{
                        [u.fname_th, u.lname_th].filter(Boolean).join(" ") ||
                        "ไม่ระบุชื่อ"
                      }}
                    </p>
                    <p class="u-meta">
                      {{ u.nickname ? `(${u.nickname})` : "" }} •
                      {{ u.team_name || "ไม่มีทีม" }}
                    </p>
                  </div>
                  <Check
                    v-if="selectedSampleUser?.id === u.id"
                    :size="14"
                    class="u-check"
                  />
                </button>
              </div>
            </div>
          </div>
        </Transition>
        <Transition name="modal">
          <div v-if="showMobileWarn" class="modal-bg">
            <div class="mobile-warn-box">
              <div class="mw-icon"><Monitor :size="40" /></div>
              <h3>แนะนำให้ใช้บนคอมพิวเตอร์</h3>
              <p>
                Certificate Studio ออกแบบมาสำหรับหน้าจอขนาดใหญ่<br />การใช้งานบนมือถืออาจไม่สะดวก
              </p>
              <div class="mw-btns">
                <button class="mw-continue" @click="continueOnMobile">
                  <Smartphone :size="14" />
                  <span>ใช้ต่อบนมือถือ</span>
                </button>
                <button class="mw-back" @click="emit('close')">
                  <ChevronLeft :size="14" />
                  <span>กลับ</span>
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&display=swap");
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
.er {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  font-family: "Kanit", system-ui, sans-serif;
  color: #1e293b;
  overflow: hidden;
}
.toast {
  position: fixed;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10100;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
  border: 1px solid #e2e8f0;
  pointer-events: none;
  white-space: nowrap;
}
.toast.success {
  background: #fff;
  color: #1d9e75;
  border-color: #1d9e75;
}
.toast.error {
  background: #fff;
  color: #ef4444;
  border-color: #ef4444;
}
.toast.info {
  background: #fff;
  color: #f05a23;
  border-color: #f05a23;
}
.top-bar {
  height: 60px;
  flex-shrink: 0;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  gap: 8px;
  box-shadow: none;
}
.tb-l,
.tb-c,
.tb-r {
  display: flex;
  align-items: center;
  gap: 4px;
}
.tb-c {
  flex: 1;
  justify-content: center;
}
.tb-back {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #64748b;
  transition: all 0.18s;
  border: 1px solid #e2e8f0;
  background: #fff;
  cursor: pointer;
}
.tb-back:hover {
  background: #fff7f3;
  color: #f05a23;
  border-color: #fbcfb6;
  transform: translateX(-1px);
}
.tb-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 800;
  color: #f05a23;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.tb-logo {
  color: #f05a23;
  font-size: 12px;
}
.tb-tag {
  font-size: 11px;
  color: #64748b;
  background: #f1f5f9;
  padding: 2px 10px;
  border-radius: 999px;
  border: 1px solid #e2e8f0;
  font-weight: 700;
}
.tb-dirty {
  font-size: 10px;
  color: #ef4444;
  margin-left: 2px;
  line-height: 1;
}
.tb-sep {
  width: 1px;
  height: 20px;
  background: #e5e7eb;
  margin: 0 2px;
}
.tb-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: #64748b;
  transition: all 0.13s;
  border: 1px solid transparent;
  background: none;
  cursor: pointer;
}
.tb-btn:hover {
  border-color: #fbcfb6;
  background: #fff7f3;
  color: #f05a23;
}
.tb-btn.dim {
  opacity: 0.2;
  cursor: not-allowed;
  pointer-events: none;
}
.tb-on {
  background: #f05a23 !important;
  color: #fff !important;
}
.tb-zoom {
  display: flex;
  align-items: center;
  gap: 2px;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 10px;
  padding: 0 7px;
  height: 34px;
}
.tb-zoom input {
  width: 32px;
  background: transparent;
  color: #374151;
  font-size: 12px;
  text-align: center;
  border: none;
  outline: none;
  font-family: inherit;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: textfield;
}
.tb-zoom input::-webkit-inner-spin-button {
  display: none;
}
.tb-zoom span {
  font-size: 11px;
  color: #9ca3af;
}
.btn-save {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 16px;
  background: #f05a23;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  transition: all 0.18s;
  border: none;
  cursor: pointer;
  font-family: inherit;
  text-transform: uppercase;
  box-shadow: 0 2px 6px rgba(240, 90, 35, 0.25);
}
.btn-save:hover:not(:disabled) {
  background: #d14a17;
  box-shadow: 0 4px 12px rgba(240, 90, 35, 0.35);
}
.btn-save.saving {
  background: #94a3b8;
  box-shadow: none;
}
.btn-save.ok {
  background: #1d9e75;
  box-shadow: 0 2px 6px rgba(29, 158, 117, 0.25);
}
.btn-save:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.er-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
  max-height: 100%;
}
.panel {
  width: 260px;
  flex-shrink: 0;
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  min-height: 0;
}
.pl {
  border-right: 1px solid #e2e8f0;
}
.pr {
  border-left: 1px solid #e2e8f0;
}
.p-tabs {
  display: flex;
  padding: 0;
  gap: 0;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
  background: #f8fafc;
}
.p-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 14px;
  border-radius: 0;
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  transition: all 0.15s;
  border: none;
  background: none;
  cursor: pointer;
  font-family: inherit;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.p-tab:hover {
  color: #1e293b;
  background: #fff;
}
.p-tab.on {
  color: #f05a23;
  background: #fff;
  border-bottom: 2px solid #f05a23;
}
.p-body {
  flex: 1;
  height: 100%;
  overflow-y: auto;
  padding: 20px;
  border: none;
  min-height: 0;
}
.p-body::-webkit-scrollbar {
  width: 4px;
}
.p-body::-webkit-scrollbar-track {
  background: transparent;
}
.p-body::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 999px;
  border: none;
}
.p-body::-webkit-scrollbar-thumb:hover {
  background: #d1d5db;
}
.ps {
  margin-bottom: 22px;
}
.ps-h {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #9ca3af;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.upload-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100px;
  border: 2px dashed #e2e8f0;
  border-radius: 14px;
  cursor: pointer;
  gap: 4px;
  color: #64748b;
  transition: all 0.18s;
  background: #f8fafc;
}
.upload-zone:hover {
  border-color: #f05a23;
  color: #f05a23;
  background: #fff7f3;
}
.uz-ico {
  color: inherit;
}
.uz-txt {
  font-size: 12px;
  font-weight: 700;
  color: inherit;
}
.uz-sub {
  font-size: 10px;
  color: #94a3b8;
  text-align: center;
  line-height: 1.4;
}
.hidden {
  display: none;
}
.el-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  transition: all 0.15s;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
}
.el-row:hover {
  border-color: #f05a23;
  background: #fff7f3;
}
.el-icon {
  color: #f05a23;
  flex-shrink: 0;
}
.el-name {
  font-size: 12px;
  font-weight: 700;
  color: #1e293b;
  display: block;
}
.el-sub {
  font-size: 10px;
  color: #64748b;
  display: block;
  margin-top: 1px;
}
.ph-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ph-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  color: #1e293b;
  transition: all 0.15s;
  cursor: pointer;
  font-family: inherit;
}
.ph-row:hover {
  border-color: #fbcfb6;
  background: #fff7f3;
  color: #f05a23;
}
.ph-row:hover .ph-ico {
  color: #f05a23;
}
.ph-ico {
  color: #f05a23;
  flex-shrink: 0;
  transition: color 0.15s;
}
.hint-box {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 10px 12px;
}
.hint-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 6px;
}
.hint-list li {
  font-size: 11px;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 6px;
}
.hint-list kbd {
  padding: 1px 5px;
  background: #fff;
  border: 1px solid #d1d5db;
  border-bottom-width: 2px;
  border-radius: 5px;
  font-size: 9px;
  font-family: monospace;
  color: #374151;
}
.lc {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #9ca3af;
  margin-bottom: 10px;
}
.llist {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.lrow {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 8px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.12s;
}
.lrow:hover {
  background: #fff7f3;
}
.lrow.sel {
  background: #fff1ea;
  border-color: #fbcfb6;
}
.lt {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  flex-shrink: 0;
}
.lt-c {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid #6b7280;
  display: block;
}
.ln {
  flex: 1;
  font-size: 11px;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lrow.sel .ln {
  color: #f05a23;
  font-weight: 600;
}
.lv {
  color: #d1d5db;
  padding: 3px;
  border-radius: 5px;
  transition: color 0.12s;
  border: none;
  background: none;
  cursor: pointer;
}
.lv:hover {
  color: #f05a23;
}
.le {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  height: 140px;
  justify-content: center;
  color: #d1d5db;
}
.le span {
  font-size: 12px;
}
.le-hint {
  font-size: 10px;
  color: #e5e7eb;
  text-align: center;
}
.cw {
  flex: 1;
  background: #f1f5f9;
  position: relative;
  overflow: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.cw::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: radial-gradient(#eee 1px, transparent 1px);
  background-size: 20px 20px;
  opacity: 1;
}
.cs {
  position: relative;
  padding: 44px;
  min-height: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}
.cf {
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  line-height: 0;
  position: relative;
  transition: none;
  background: #fff;
  overflow: hidden;
}
.cf:hover {
  transform: none;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.08);
  border-color: #cbd5e1;
}
canvas {
  display: block;
}
.gl {
  position: absolute;
  pointer-events: none;
  z-index: 5;
  background-image:
    linear-gradient(rgba(240, 90, 35, 0.12) 1px, transparent 1px),
    linear-gradient(90deg, rgba(240, 90, 35, 0.12) 1px, transparent 1px);
}
.cov {
  position: absolute;
  inset: 0;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 50;
  gap: 12px;
  backdrop-filter: none;
  border-radius: 12px;
}
.cov p {
  font-size: 13px;
  color: #6b7280;
}
.zpill {
  position: absolute;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  padding: 6px 16px;
  font-size: 12px;
  color: #1e293b;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  z-index: 20;
}
.zpill button {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  transition: all 0.12s;
  border: none;
  background: none;
  cursor: pointer;
}
.zpill button:hover {
  background: #fff1ea;
  color: #f05a23;
}
.props {
  padding: 10px 10px;
}
.ph {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.pt {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #9ca3af;
}
.pa {
  display: flex;
  gap: 3px;
}
.ab {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  color: #9ca3af;
  transition: all 0.12s;
  border: none;
  background: none;
  cursor: pointer;
}
.ab:hover {
  background: #fff7f3;
  color: #f05a23;
}
.ab.red:hover {
  background: #fff1f2;
  color: #e11d48;
}
.r2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-bottom: 4px;
}
.pf {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.pf label {
  font-size: 10px;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
}
.pi {
  width: 100%;
  padding: 5px 9px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 12px;
  color: #111827;
  font-family: inherit;
  transition: border-color 0.13s;
  text-align: center;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: textfield;
}
.pi::-webkit-inner-spin-button,
.pi::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.pi:focus {
  border-color: #f05a23;
  background: #fff;
  outline: none;
  box-shadow: 0 0 0 3px rgba(240, 90, 35, 0.12);
}
.pi[readonly] {
  color: #9ca3af;
  cursor: default;
}
/* Position & size grid */
.coord-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.coord-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
  background: #fff;
  border: 1.5px solid #e5e7eb;
  border-radius: 10px;
  padding: 7px 10px;
  cursor: text;
  transition: all 0.15s;
}
.coord-cell:hover {
  border-color: #cbd5e1;
}
.coord-cell:focus-within {
  border-color: #f05a23;
  box-shadow: 0 0 0 3px rgba(240, 90, 35, 0.12);
}
.coord-cell.ro {
  background: #fafbfc;
  cursor: default;
}
.coord-cell.ro:hover {
  border-color: #e5e7eb;
}
.coord-cell.ro:focus-within {
  box-shadow: none;
  border-color: #e5e7eb;
}
.coord-tag {
  font-size: 10px;
  font-weight: 700;
  color: #94a3b8;
  letter-spacing: 0.02em;
  user-select: none;
}
.coord-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.coord-inp {
  flex: 1;
  min-width: 0;
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  font-family: inherit;
  padding: 0;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: textfield;
}
.coord-inp::-webkit-inner-spin-button,
.coord-inp::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.coord-inp[readonly] {
  color: #94a3b8;
  cursor: default;
}
.coord-unit {
  font-size: 10px;
  color: #cbd5e1;
  font-weight: 700;
  flex-shrink: 0;
  user-select: none;
}
.pb {
  margin-bottom: 10px;
}
.pl {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #9ca3af;
  margin-bottom: 4px;
}
.pl-r {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.pv {
  font-size: 11px;
  color: #6b7280;
  font-variant-numeric: tabular-nums;
}
.pdiv {
  height: 1px;
  background: #f3f4f6;
  margin: 8px 0;
}
.psel {
  width: 100%;
  padding: 6px 10px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 12px;
  color: #111827;
  font-family: inherit;
  appearance: none;
  cursor: pointer;
}
.psel:focus {
  border-color: #f05a23;
  outline: none;
  box-shadow: 0 0 0 3px rgba(240, 90, 35, 0.12);
}
/* Custom dropdown (AdminActivities-style) */
.dd {
  position: relative;
  width: 100%;
}
.dd-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  min-height: 34px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 9px;
  font-size: 12px;
  color: #1e293b;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}
.dd-trigger:hover {
  border-color: #fbcfb6;
  background: #fff;
}
.dd.open .dd-trigger {
  border-color: #f05a23;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(240, 90, 35, 0.12);
}
.dd-current {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dd-chevron {
  color: #9ca3af;
  transition:
    transform 0.2s,
    color 0.15s;
  flex-shrink: 0;
}
.dd.open .dd-chevron {
  transform: rotate(180deg);
  color: #f05a23;
}
/* Dropdown menu (teleported to body, position:fixed via inline style) */
.dd-menu {
  z-index: 10050;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 4px;
  max-height: 280px;
  overflow-y: auto;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.14);
}
.dd-menu::-webkit-scrollbar {
  width: 4px;
}
.dd-menu::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 999px;
}
.dd-menu::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
.dd-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 7px;
  font-size: 12.5px;
  font-weight: 500;
  color: #374151;
  font-family: inherit;
  border: none;
  background: none;
  cursor: pointer;
  transition: all 0.12s;
  text-align: left;
}
.dd-item:hover {
  background: #fff7f3;
  color: #f05a23;
}
.dd-item.active {
  background: #fff1ea;
  color: #f05a23;
  font-weight: 700;
}
.dd-check {
  color: #f05a23;
  flex-shrink: 0;
}
/* Dropdown enter/leave */
.dd-enter-active,
.dd-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
  transform-origin: top center;
}
.dd-enter-from,
.dd-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
.obs {
  display: flex;
  gap: 4px;
}
.ob {
  flex: 1;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  color: #6b7280;
  transition: all 0.13s;
  cursor: pointer;
}
.ob:hover {
  border-color: #f05a23;
  color: #f05a23;
  background: #fff;
}
.srow {
  display: flex;
  align-items: center;
  gap: 2px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 3px;
}
.sb {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: #64748b;
  transition: all 0.12s;
  border: none;
  background: none;
  cursor: pointer;
}
.sb:hover {
  background: #fff7f3;
  color: #f05a23;
}
.sb.on {
  background: #f05a23;
  color: #fff;
}
.sdiv {
  width: 1px;
  height: 18px;
  background: #e5e7eb;
  margin: 0 2px;
}
.crow {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.cs-swatch {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1.5px solid #e5e7eb;
  cursor: pointer;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
  transition: border-color 0.15s;
}
.cs-swatch:hover {
  border-color: #f05a23;
}
.cinput {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  width: 100%;
  height: 100%;
}
.chex {
  flex: 1;
  text-transform: uppercase;
  font-size: 11px;
  font-family: monospace;
}
.cps {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 2px;
}
.cp {
  aspect-ratio: 1;
  border-radius: 6px;
  cursor: pointer;
  transition: transform 0.13s;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
}
.cp:hover {
  transform: scale(1.18);
  z-index: 1;
}
.cpck {
  color: #fff;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.4));
}
.pr-range {
  width: 100%;
  height: 4px;
  border-radius: 4px;
  accent-color: #f05a23;
  cursor: pointer;
  display: block;
}
.del-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 9px;
  background: #fff;
  border: 1px solid #ef4444;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  color: #ef4444;
  transition: all 0.15s;
  cursor: pointer;
  font-family: inherit;
  text-transform: uppercase;
}
.del-btn:hover {
  background: #ef4444;
  color: #fff;
}
.props-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 24px;
  gap: 6px;
}
.em-rings {
  width: 64px;
  height: 64px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 6px;
}
.em-r {
  position: absolute;
  border-radius: 50%;
  border: 1px solid #e5e7eb;
}
.r1 {
  width: 64px;
  height: 64px;
}
.r2 {
  width: 42px;
  height: 42px;
}
.em-ico {
  color: #d1d5db;
  z-index: 1;
}
.em-t {
  font-size: 13px;
  font-weight: 700;
  color: #374151;
}
.em-s {
  font-size: 11px;
  color: #9ca3af;
  line-height: 1.6;
}
.scs {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 100%;
}
.sc {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: #9ca3af;
}
.sc span {
  margin-left: auto;
}
kbd {
  padding: 1px 5px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-bottom-width: 2px;
  border-radius: 5px;
  font-size: 9px;
  font-family: monospace;
  color: #6b7280;
}
.ring {
  width: 32px;
  height: 32px;
  border: 2px solid #e5e7eb;
  border-top-color: #f05a23;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
.modal-bg {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  backdrop-filter: none;
}
.mobile-warn-box {
  background: #fff;
  border-radius: 18px;
  padding: 40px 32px;
  max-width: 360px;
  width: 100%;
  text-align: center;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.18);
  border: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.mw-icon {
  color: #f05a23;
  margin-bottom: 4px;
}
.mobile-warn-box h3 {
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
}
.mobile-warn-box p {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.6;
}
.mw-btns {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  margin-top: 8px;
}
.mw-continue {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 40px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}
.mw-continue:hover {
  border-color: #f05a23;
  color: #f05a23;
}
.mw-back {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 40px;
  background: #f05a23;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  cursor: pointer;
  font-family: inherit;
  border: none;
  transition: all 0.15s;
  box-shadow: 0 2px 6px rgba(240, 90, 35, 0.25);
}
.mw-back:hover {
  background: #d14a17;
  box-shadow: 0 4px 12px rgba(240, 90, 35, 0.35);
}
.spin {
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}
.er-fade-enter-active,
.er-fade-leave-active {
  transition: opacity 0.2s;
}
.er-fade-enter-from,
.er-fade-leave-to {
  opacity: 0;
}
.sl-enter-active,
.sl-leave-active {
  transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}
.sl-enter-from,
.sl-leave-to {
  width: 0 !important;
  opacity: 0;
  overflow: hidden;
}
.sr-enter-active,
.sr-leave-active {
  transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}
.sr-enter-from,
.sr-leave-to {
  width: 0 !important;
  opacity: 0;
  overflow: hidden;
}
.modal-enter-active,
.modal-leave-active {
  transition: all 0.22s;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .mobile-warn-box,
.modal-leave-to .mobile-warn-box {
  transform: scale(0.97);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.ico-enter-active,
.ico-leave-active {
  transition: all 0.12s;
}
.ico-enter-from,
.ico-leave-to {
  opacity: 0;
  transform: scale(0.6);
}
.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.toast-slide-enter-from,
.toast-slide-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}
.live-btn {
  width: auto !important;
  height: 34px;
  margin-left: 4px;
  padding: 0 14px;
  gap: 7px;
  border-radius: 999px;
  white-space: nowrap;
  flex-shrink: 0;
  border: 1px solid #e2e8f0 !important;
  background: #fff;
}
.live-btn:hover {
  background: #fff7f3 !important;
  color: #f05a23 !important;
  border-color: #fbcfb6 !important;
}
.live-btn.tb-on {
  border-color: #f05a23 !important;
  box-shadow: 0 2px 6px rgba(240, 90, 35, 0.25);
}
.live-btn.tb-on:hover {
  background: #d14a17 !important;
  color: #fff !important;
  border-color: #d14a17 !important;
}
.live-lbl {
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.02em;
}
.user-sel-pill {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 12px 0 4px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.15s;
  margin-left: 6px;
  white-space: nowrap;
  flex-shrink: 0;
}
.user-sel-pill:hover {
  background: #fff7f3;
  border-color: #fbcfb6;
}
.user-sel-pill:hover .usp-name {
  color: #f05a23;
}
.usp-img {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  object-fit: cover;
  border: 1.5px solid #fff;
  box-shadow: 0 0 0 1px #e2e8f0;
}
.usp-name {
  font-size: 12px;
  font-weight: 700;
  color: #1e293b;
  transition: color 0.15s;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.user-picker-box {
  width: 100%;
  max-width: 440px;
  background: #fff;
  border-radius: 18px;
  display: flex;
  flex-direction: column;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
}
.uph {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #f3f4f6;
}
.uph h3 {
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
}
.upc {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  transition: all 0.15s;
  border: none;
  background: none;
  cursor: pointer;
}
.upc:hover {
  background: #fff7f3;
  color: #f05a23;
}
.up-search {
  padding: 12px 16px;
  position: relative;
  border-bottom: 1px solid #f3f4f6;
}
.ups-ico {
  position: absolute;
  left: 26px;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
}
.up-search input {
  width: 100%;
  padding: 12px 12px 12px 36px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: all 0.15s;
}
.up-search input:focus {
  border-color: #f05a23;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(240, 90, 35, 0.12);
}
.up-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.up-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 40px;
  color: #9ca3af;
  font-size: 13px;
}
.u-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  transition: all 0.12s;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
}
.u-row:hover {
  background: #fff7f3;
}
.u-row.sel {
  background: #fff1ea;
}
.u-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  background: #f3f4f6;
}
.u-info {
  flex: 1;
  min-width: 0;
}
.u-name {
  font-size: 13px;
  font-weight: 700;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.u-meta {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 1px;
}
.u-check {
  color: #16a34a;
  flex-shrink: 0;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
.spin {
  animation: spin 1s linear infinite;
}
/* เพิ่ม CSS สำหรับช่องพิมพ์แบบขยายกว้าง */
.r-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}
.pi-expanded {
  width: 100%;
  padding: 8px 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  color: #111827;
  font-family: inherit;
  transition: border-color 0.13s;
  text-align: left; /* จัดชิดซ้ายให้อ่านและมองเห็นชัดเจน */
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: textfield;
}
.pi-expanded::-webkit-inner-spin-button,
.pi-expanded::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.pi-expanded:focus {
  border-color: #f05a23;
  background: #fff;
  outline: none;
  box-shadow: 0 0 0 3px rgba(240, 90, 35, 0.12);
}
</style>
