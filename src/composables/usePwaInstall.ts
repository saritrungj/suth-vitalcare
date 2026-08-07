import { ref, computed, onMounted, onUnmounted } from "vue";

// Chrome/Android only — not in lib.dom.d.ts yet.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "vc_pwa_install_dismissed_at";
const SNOOZE_DAYS = 14;

const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null);
const isStandalone = ref(false);
const isInstalled = ref(false);
const dismissedAt = ref<number>(Number(localStorage.getItem(DISMISS_KEY)) || 0);

const detectStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  (window.navigator as any).standalone === true;

let listenersAttached = false;
const attachListeners = () => {
  if (listenersAttached) return;
  listenersAttached = true;
  isStandalone.value = detectStandalone();
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt.value = e as BeforeInstallPromptEvent;
  });
  window.addEventListener("appinstalled", () => {
    isInstalled.value = true;
    deferredPrompt.value = null;
  });
};

export function usePwaInstall() {
  onMounted(attachListeners);

  const isIOS = computed(() => {
    const ua = navigator.userAgent;
    const isAppleTouch =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    return isAppleTouch;
  });

  // Mobile/tablet-ish viewport (matches the breakpoint already used across the app for "not desktop").
  const isMobileOrTablet = ref(window.innerWidth < 1024);
  const updateWidth = () => {
    isMobileOrTablet.value = window.innerWidth < 1024;
  };
  onMounted(() => window.addEventListener("resize", updateWidth));
  onUnmounted(() => window.removeEventListener("resize", updateWidth));

  const isSnoozed = computed(() => {
    if (!dismissedAt.value) return false;
    const elapsedDays = (Date.now() - dismissedAt.value) / 86400000;
    return elapsedDays < SNOOZE_DAYS;
  });

  // Android/Chrome: native prompt available. iOS: no native prompt, show manual steps instead.
  const canPromptInstall = computed(() => !!deferredPrompt.value);
  const showInstallUi = computed(
    () =>
      isMobileOrTablet.value &&
      !isStandalone.value &&
      !isInstalled.value &&
      !isSnoozed.value &&
      (canPromptInstall.value || isIOS.value),
  );

  const promptInstall = async () => {
    if (!deferredPrompt.value) return;
    await deferredPrompt.value.prompt();
    const { outcome } = await deferredPrompt.value.userChoice;
    deferredPrompt.value = null;
    if (outcome === "accepted") isInstalled.value = true;
  };

  const dismiss = () => {
    dismissedAt.value = Date.now();
    localStorage.setItem(DISMISS_KEY, String(dismissedAt.value));
  };

  return {
    isIOS,
    isMobileOrTablet,
    canPromptInstall,
    showInstallUi,
    promptInstall,
    dismiss,
  };
}
