import {
  ref,
  shallowRef,
  watch,
  onMounted,
  onUnmounted,
  isRef,
  Ref,
  computed,
} from "vue";
import { uiStore } from "../store/ui";
import { authStore } from "../store/auth";
// Global cache to store data across component mounts
const globalCache = new Map<string, { data: any; timestamp: number }>();
// Deduping ongoing requests
const activeRequests = new Map<string, Promise<any>>();
export interface SWROptions<T> {
  dedupingInterval?: number; // default: 2000ms
  revalidateOnFocus?: boolean; // default: true
  fallbackData?: T;
  fetcher?: (url: string) => Promise<T>;
  // Global UI options
  showGlobalLoading?: boolean; // Show global full-screen spinner on first load
  loadingMessage?: string;
  onError?: (err: any) => void;
  showErrorToast?: boolean; // Show toast on error
  showErrorModal?: boolean; // Show big modal on error (critical fetches)
}
export function useSWR<T>(
  urlOrProvider: string | Ref<string | null> | (() => string | null),
  options: SWROptions<T> = {},
) {
  const data = shallowRef<T | undefined>(options.fallbackData);
  const error = shallowRef<Error | undefined>();
  const isValidating = ref(false);
  const {
    dedupingInterval = 2000,
    revalidateOnFocus = true,
    showGlobalLoading = false,
    loadingMessage = "กำลังโหลดข้อมูล...",
    showErrorToast = true,
    showErrorModal = false,
    fetcher = async (u: string) => {
      const headers: Record<string, string> = {};
      if (authStore.user?.id) {
        headers["x-user-id"] = String(authStore.user.id);
      }
      const res = await fetch(u, { headers });
      if (res.status === 401) {
        uiStore.showAlert(
          "error",
          "เซสชันหมดอายุ",
          "กรุณาเข้าสู่ระบบใหม่อีกครั้งเพื่อดำเนินการต่อ",
        );
        throw new Error("Unauthorized");
      }
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(
          errBody.error ||
            errBody.message ||
            `เกิดข้อผิดพลาดในการเชื่อมต่อ (${res.status})`,
        );
      }
      return res.json();
    },
  } = options;
  const urlRef = isRef(urlOrProvider)
    ? urlOrProvider
    : typeof urlOrProvider === "function"
      ? ref(urlOrProvider())
      : ref(urlOrProvider);
  if (typeof urlOrProvider === "function") {
    watch(
      () => urlOrProvider(),
      (val) => {
        urlRef.value = val;
      },
    );
  }
  const mutate = async (bg: boolean = false) => {
    const key = urlRef.value;
    if (!key) return;
    const cacheEntry = globalCache.get(key);
    // Return early if requesting too soon (deduping)
    if (
      cacheEntry &&
      !isValidating.value &&
      Date.now() - cacheEntry.timestamp < dedupingInterval
    ) {
      if (data.value === undefined) data.value = cacheEntry.data;
      return;
    }
    if (showGlobalLoading && !cacheEntry && !bg) {
      uiStore.setLoading(true, loadingMessage);
    }
    isValidating.value = true;
    try {
      let request = activeRequests.get(key);
      if (!request) {
        request = fetcher(key);
        activeRequests.set(key, request);
      }
      const resData = await request;
      data.value = resData;
      globalCache.set(key, { data: resData, timestamp: Date.now() });
      error.value = undefined;
    } catch (err: any) {
      error.value = err;
      // Auto Error Handling for Production Level UX
      if (showErrorModal) {
        uiStore.showAlert(
          "error",
          "เชื่อมต่อข้อมูลไม่สำเร็จ",
          err.message || "ไม่สามารถดึงข้อมูลได้ในขณะนี้",
          {
            confirmLabel: "ลองใหม่อีกครั้ง",
            onConfirm: () => mutate(true),
          },
        );
      } else if (showErrorToast) {
        uiStore.toast(
          "error",
          "เกิดข้อผิดพลาดในการโหลดข้อมูล",
          err.message || "เกิดปัญหาบางอย่างในการเชื่อมต่อ",
          {
            actionLabel: "ลองใหม่",
            onAction: () => mutate(true),
          },
        );
      }
      if (options.onError) options.onError(err);
    } finally {
      activeRequests.delete(key);
      isValidating.value = false;
      if (showGlobalLoading) uiStore.setLoading(false);
    }
  };
  const onFocus = () => {
    if (revalidateOnFocus && document.visibilityState === "visible") {
      const key = urlRef.value;
      if (!key) return;
      const cacheEntry = globalCache.get(key);
      // Additional safety: don't revalidate if we just fetched less than 5 seconds ago
      if (cacheEntry && Date.now() - cacheEntry.timestamp < 5000) return;
      mutate(true);
    }
  };
  onMounted(() => {
    const key = urlRef.value;
    if (key) {
      const cacheEntry = globalCache.get(key);
      if (cacheEntry) {
        data.value = cacheEntry.data;
        // If data is older than dedupingInterval, fetch in background
        if (Date.now() - cacheEntry.timestamp > dedupingInterval) mutate(true);
      } else {
        mutate();
      }
    }
    if (revalidateOnFocus) {
      window.addEventListener("visibilitychange", onFocus);
      window.addEventListener("focus", onFocus);
    }
  });
  onUnmounted(() => {
    if (revalidateOnFocus) {
      window.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    }
  });
  watch(urlRef, () => {
    mutate();
  });
  const isLoading = computed(() => data.value === undefined && !error.value);
  return { data, error, isValidating, isLoading, mutate };
}
