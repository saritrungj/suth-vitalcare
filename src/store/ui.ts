import { reactive, computed } from "vue";
interface Toast {
  id: string;
  type: "success" | "error" | "info" | "warning";
  title: string;
  message: string;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
}
interface AlertModal {
  show: boolean;
  type: "error" | "success" | "confirm" | "maintenance";
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}
export const uiStore = reactive({
  // Notifications
  toasts: [] as Toast[],
  // Modals (สวยๆ ให้กด)
  alertModal: {
    show: false,
    type: "error",
    title: "",
    message: "",
    confirmLabel: "ตกลง",
    cancelLabel: "ยกเลิก",
  } as AlertModal,
  // Page Loaders
  isPageLoading: false,
  loadingMessage: "",
  // SEO Management
  pageTitle: "SUTH VitalCare | ระบบส่งเสริมสุขภาพและกิจกรรม",
  // Fatal Error States (หน้า Error พรีเมียม)
  errorState: {
    hasError: false,
    title: "",
    message: "",
    retryAction: null as null | (() => void),
  },
  // Realtime Centralized Tracker
  lastRealtimeUpdate: Date.now(),
  // --- Actions ---
  triggerRealtimeUpdate() {
    this.lastRealtimeUpdate = Date.now();
  },
  toast(
    type: Toast["type"],
    title: string,
    message: string,
    options?: Partial<Omit<Toast, "id" | "type" | "title" | "message">>,
  ) {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = {
      id,
      type,
      title,
      message,
      duration: options?.duration || 4000,
      actionLabel: options?.actionLabel,
      onAction: options?.onAction,
    };
    this.toasts.push(newToast);
    if (newToast.duration !== -1) {
      setTimeout(() => {
        this.removeToast(id);
      }, newToast.duration);
    }
    return id;
  },
  removeToast(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  },
  showAlert(
    type: AlertModal["type"],
    title: string,
    message: string,
    options?: Partial<Omit<AlertModal, "show" | "type" | "title" | "message">>,
  ) {
    this.alertModal = {
      show: true,
      type,
      title,
      message,
      confirmLabel: options?.confirmLabel || "ตกลง",
      cancelLabel: options?.cancelLabel || "ยกเลิก",
      onConfirm: options?.onConfirm,
      onCancel: options?.onCancel,
    };
  },
  hideAlert() {
    this.alertModal.show = false;
  },
  setLoading(state: boolean, message: string = "") {
    this.isPageLoading = state;
    this.loadingMessage = message;
  },
  setPageTitle(title: string) {
    this.pageTitle = title
      ? `${title} | SUTH VitalCare`
      : "SUTH VitalCare | ระบบส่งเสริมสุขภาพและกิจกรรม";
    if (typeof document !== "undefined") {
      // NFC normalize: กัน title เพี้ยนบน WebView บางตัวที่ render สระ/วรรณยุกต์
      // ไทยแบบ decomposed (NFD) ผิดตำแหน่ง เช่นข้อมูลที่ผ่านมาจาก macOS/iOS
      document.title = this.pageTitle.normalize("NFC");
    }
  },
});
