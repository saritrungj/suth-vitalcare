<script setup lang="ts">
import {
  onMounted,
  onUnmounted,
  computed,
  watch,
  onErrorCaptured,
  ref,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import Navbar from "./components/Navbar.vue";
import { authStore } from "./store/auth";
import { uiStore } from "./store/ui";
import { logoutLiff } from "./lib/liff";
import { useRealtime } from "./composables/useRealtime";
import {
  AlertTriangle,
  CheckCircle,
  Info,
  X,
  RotateCcw,
  ShieldAlert,
  WifiOff,
  RefreshCcw,
  Loader2,
} from "lucide-vue-next";
const route = useRoute();
const router = useRouter();
const appError = ref<any>(null);
const isRouterReady = ref(false);
// Error Boundary Handler: เปลี่ยน "จอขาว" ให้เป็น "หน้าสวยๆ ให้กด"
onErrorCaptured((err, instance, info) => {
  uiStore.errorState = {
    hasError: true,
    title: "ขออภัย มีบางอย่างไม่ถูกต้อง",
    message:
      "ดูเหมือนว่าจะมีบางส่วนของแอปพลิเคชันทำงานผิดพลาด เรากำลังพยายามแก้ไขโดยเร็วที่สุด",
    retryAction: () => window.location.reload(),
  };
  return false; // Stop error from bubbling
});
function reloadApp() {
  window.location.reload();
}
// Init Realtime Listeners (Centralized)
useRealtime({
  onUserUpdated: (updatedUser) => {
    uiStore.triggerRealtimeUpdate();
    if (authStore.user && updatedUser.id === authStore.user.id) {
      const oldRole = authStore.user.role;
      // Object.assign(authStore.user, updatedUser); // Careful with reactive proxy
      if (updatedUser.role) authStore.user.role = updatedUser.role;
      if (updatedUser.team_id !== undefined)
        authStore.user.team_id = updatedUser.team_id;
      authStore.saveUser();
      // If role changed from admin/host to user, and we are in admin route -> KICK OUT!
      const isNowAdmin =
        updatedUser.role === "admin" || updatedUser.role === "host";
      const wasAdmin = oldRole === "admin" || oldRole === "host";
      if (wasAdmin && !isNowAdmin && route.path.startsWith("/admin")) {
        uiStore.showAlert(
          "error",
          "สิทธิ์การใช้งานเปลี่ยนไป",
          "บัญชีของคุณถูกปรับลดสิทธิ์การใช้งาน กรุณาติดต่อผู้ดูแลระบบหากคิดว่าเป็นข้อผิดพลาด",
          {
            confirmLabel: "รับทราบ",
            onConfirm: () => {
              authStore.isAdminMode = false;
              router.push("/");
            },
          },
        );
      } else if (updatedUser.role && oldRole !== updatedUser.role) {
        uiStore.toast(
          "info",
          "สิทธิ์การใช้งานอัปเดต",
          `บทบาทของคุณถูกเปลี่ยนจาก "${oldRole}" เป็น "${updatedUser.role}"`,
        );
      }
    }
  },
  onActivityCreated: (activity) => {
    uiStore.triggerRealtimeUpdate();
    uiStore.toast(
      "success",
      "กิจกรรมใหม่!",
      `มีกิจกรรม "${activity.title}" พึ่งถูกสร้างขึ้น`,
    );
  },
  onActivityUpdated: () => uiStore.triggerRealtimeUpdate(),
  onActivityDeleted: () => uiStore.triggerRealtimeUpdate(),
  onSubmissionCreated: () => uiStore.triggerRealtimeUpdate(),
  onSubmissionUpdated: (sub) => {
    uiStore.triggerRealtimeUpdate();
    if (authStore.user && String(sub.user_id) === String(authStore.user.id)) {
      if (sub.status === "approved") {
        uiStore.toast(
          "success",
          "ภารกิจผ่านการอนุมัติ!",
          `ยินดีด้วย! ภารกิจของคุณได้รับอนุมัติแล้ว และได้รับแต้มสะสมเพิ่มขึ้น`,
        );
      } else if (sub.status === "rejected") {
        uiStore.toast(
          "error",
          "ภารกิจไม่ผ่านการอนุมัติ",
          `กรุณาตรวจสอบรายละเอียดและแก้ไขหลักฐานให้ถูกต้องครับ`,
        );
      }
    }
  },
  onSubmissionDeleted: () => uiStore.triggerRealtimeUpdate(),
  onActivityRequestCreated: () => uiStore.triggerRealtimeUpdate(),
  onActivityRequestUpdated: () => uiStore.triggerRealtimeUpdate(),
  onTeamCreated: () => uiStore.triggerRealtimeUpdate(),
  onTeamUpdated: () => uiStore.triggerRealtimeUpdate(),
  onTeamDeleted: () => uiStore.triggerRealtimeUpdate(),
  onTeamJoined: () => uiStore.triggerRealtimeUpdate(),
  onTeamLeft: () => uiStore.triggerRealtimeUpdate(),
  onTeamKicked: () => uiStore.triggerRealtimeUpdate(),
  onBannerCreated: () => uiStore.triggerRealtimeUpdate(),
  onBannerDeleted: () => uiStore.triggerRealtimeUpdate(),
  onUserKicked: (data) => {
    if (authStore.user && data.id === authStore.user.id) {
      uiStore.showAlert(
        "error",
        "เซสชันหมดอายุ",
        "บัญชีของคุณถูกระงับหรือลบโดยผู้ดูแลระบบ กรุณาติดต่อแอดมิน",
        {
          confirmLabel: "รับทราบ",
          onConfirm: () => {
            logoutLiff();
            router.push("/login");
          },
        },
      );
      // Force logout after 5 seconds if no interaction
      setTimeout(() => {
        if (authStore.user) {
          logoutLiff();
          router.push("/login");
        }
      }, 5000);
    } else {
      uiStore.triggerRealtimeUpdate();
    }
  },
});
onMounted(async () => {
  // Sync page title with route meta
  watch(
    () => route.meta?.title,
    (title) => {
      uiStore.setPageTitle(title as string);
    },
    { immediate: true },
  );
  // รอให้ Router เตรียมความพร้อมเพื่อป้องกัน UI กระตุก/เนฟบาร์แวบ
  // เพิ่ม Safety Timeout 5 วินาที เดี๋ยวมันค้างหน้าโหลด (แก้ปัญหาเครื่องช้า/เน็ตเน่า)
  const safetyTimer = setTimeout(() => {
    if (!isRouterReady.value) {
      isRouterReady.value = true;
      authStore.loading = false;
    }
  }, 5000);
  try {
    await router.isReady();
    isRouterReady.value = true;
  } finally {
    clearTimeout(safetyTimer);
  }
});
onUnmounted(() => {});
</script>
<template>
  <!-- Full Screen Initial Loading - แสดงจนกว่า Auth และ Router จะพร้อมจริงๆ -->
  <div
    v-if="authStore.loading || !isRouterReady"
    class="flex flex-col items-center justify-center min-h-screen bg-white"
  >
    <div
      class="w-10 h-10 border-4 border-slate-100 border-t-[#F05A23] rounded-full animate-spin"
    ></div>
  </div>
  <div v-else class="app-container">
    <!-- Global Error Screen (Error Boundary) -->
    <div
      v-if="appError"
      class="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center p-6 text-center"
    >
      <div
        class="mb-8 text-red-500 flex items-center justify-center animate-bounce-soft"
      >
        <ShieldAlert :size="80" stroke-width="1.5" />
      </div>
      <h1 class="text-2xl font-bold text-slate-800 mb-3">
        {{ appError.title }}
      </h1>
      <p class="text-slate-500 max-w-md mb-10 leading-relaxed">
        {{ appError.message }}
      </p>
      <div class="flex flex-col gap-3 w-full max-w-xs">
        <button
          @click="reloadApp"
          class="flex items-center justify-center gap-2 bg-[#1d9e75] text-white font-bold py-4 px-8 rounded-2xl shadow-lg shadow-emerald-700/20 active:scale-95 transition-all"
        >
          <RefreshCcw :size="20" /> ลองใหม่อีกครั้ง
        </button>
        <button
          @click="appError = null"
          class="text-slate-400 text-sm font-medium py-3 hover:text-slate-600"
        >
          ย้อนกลับไปหน้าหลัก
        </button>
      </div>
      <div
        class="mt-12 text-slate-300 font-mono text-[10px] break-all max-w-xs cursor-help"
      >
        Error Log: {{ appError.details.substring(0, 50) }}...
      </div>
    </div>
    <!-- Navigation & Main Content -->
    <Navbar v-if="!route.meta.hideNavbar" />
    <!-- Global Error Screen (พรีเมียมหน้า Error) -->
    <Transition name="fade">
      <div
        v-if="uiStore.errorState.hasError"
        class="fixed inset-0 z-[11000] bg-white flex flex-col items-center justify-center p-6 text-center"
      >
        <div
          class="absolute inset-0 bg-gradient-to-b from-emerald-50/50 to-white -z-10"
        ></div>
        <div
          class="mb-6 text-red-500 flex items-center justify-center animate-bounce-soft"
        >
          <ShieldAlert :size="100" stroke-width="1.2" />
        </div>
        <h1 class="text-2xl font-black text-slate-800 mb-2">
          {{ uiStore.errorState.title }}
        </h1>
        <p class="text-slate-500 mb-8 max-w-sm leading-relaxed">
          {{ uiStore.errorState.message }}
        </p>
        <button
          @click="
            uiStore.errorState.retryAction
              ? uiStore.errorState.retryAction()
              : reloadApp()
          "
          class="px-8 py-4 bg-[#1d9e75] text-white font-black rounded-2xl shadow-xl shadow-emerald-200 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
        >
          <RefreshCcw :size="20" /> ลองใหม่อีกครั้ง
        </button>
      </div>
    </Transition>
    <main
      class="main-content"
      :class="{ 'has-bottom-nav': !route.meta.hideNavbar }"
    >
      <RouterView />
    </main>
    <!-- Global Toasts Stack -->
    <div
      class="fixed top-20 right-4 z-[9995] flex flex-col gap-3 items-end pointer-events-none"
    >
      <TransitionGroup name="toast">
        <div
          v-for="toast in uiStore.toasts"
          :key="toast.id"
          class="toast-item pointer-events-auto flex items-start gap-4 p-4 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-100 min-w-[300px] max-w-[420px]"
        >
          <div
            class="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
            :class="toast.type"
          >
            <CheckCircle
              v-if="toast.type === 'success'"
              :size="20"
              class="text-emerald-500"
            />
            <AlertTriangle
              v-else-if="toast.type === 'error'"
              :size="20"
              class="text-red-500"
            />
            <Info
              v-else-if="toast.type === 'info'"
              :size="20"
              class="text-blue-500"
            />
            <AlertTriangle v-else :size="20" class="text-amber-500" />
          </div>
          <div class="flex-1 pr-4">
            <h4 class="text-sm font-bold text-slate-800">{{ toast.title }}</h4>
            <p class="text-[13px] text-slate-500 leading-tight mt-0.5">
              {{ toast.message }}
            </p>
            <button
              v-if="toast.actionLabel"
              @click="toast.onAction?.()"
              class="mt-2 text-[#1d9e75] font-bold text-xs underline decoration-emerald-200 decoration-2 underline-offset-4"
            >
              {{ toast.actionLabel }}
            </button>
          </div>
          <button
            @click="uiStore.removeToast(toast.id)"
            class="text-slate-300 hover:text-slate-500 transition-colors"
          >
            <X :size="16" />
          </button>
        </div>
      </TransitionGroup>
    </div>
    <!-- Global Alert Modal -->
    <Transition name="modal-fade">
      <div
        v-if="uiStore.alertModal.show"
        class="fixed inset-0 z-[9998] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6"
      >
        <div
          class="w-full max-w-sm bg-white rounded-[32px] overflow-hidden shadow-2xl animate-pop-in"
        >
          <div class="p-8 text-center">
            <div class="mx-auto mb-6 flex items-center justify-center">
              <CheckCircle
                v-if="uiStore.alertModal.type === 'success'"
                :size="80"
                class="text-emerald-500"
              />
              <WifiOff
                v-else-if="uiStore.alertModal.type === 'maintenance'"
                :size="80"
                class="text-amber-500"
              />
              <AlertTriangle v-else :size="80" class="text-red-500" />
            </div>
            <h3 class="text-xl font-bold text-slate-800 mb-2">
              {{ uiStore.alertModal.title }}
            </h3>
            <p class="text-slate-500 text-sm leading-relaxed">
              {{ uiStore.alertModal.message }}
            </p>
          </div>
          <div class="flex border-t border-slate-50">
            <button
              v-if="uiStore.alertModal.onCancel"
              @click="
                uiStore.alertModal.onCancel();
                uiStore.hideAlert();
              "
              class="flex-1 py-5 text-slate-400 font-bold text-sm border-r border-slate-50 hover:bg-slate-50"
            >
              {{ uiStore.alertModal.cancelLabel }}
            </button>
            <button
              @click="
                uiStore.alertModal.onConfirm?.();
                uiStore.hideAlert();
              "
              class="flex-1 py-5 text-[#1d9e75] font-extrabold text-sm hover:bg-emerald-50"
              :class="{ 'text-red-500': uiStore.alertModal.type === 'error' }"
            >
              {{ uiStore.alertModal.confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
    <!-- Global Loading Overlay -->
    <Transition name="fade">
      <div
        v-if="uiStore.isPageLoading"
        class="fixed inset-0 z-[10000] bg-white flex flex-col items-center justify-center"
      >
        <div
          class="w-10 h-10 border-4 border-slate-100 border-t-[#F05A23] rounded-full animate-spin"
        ></div>
      </div>
    </Transition>
  </div>
</template>
<style>
:root {
  --font-main: var(--font-sans);
  --primary: #1d9e75;
}
body {
  font-family: var(--font-main);
  background: #ffffff;
  color: #1e293b;
  -webkit-font-smoothing: antialiased;
}
.app-container {
  min-height: 100vh;
}
@media (max-width: 767px) {
  .main-content.has-bottom-nav {
    padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px));
  }
}
/* Transitions */
.toast-enter-from {
  transform: translateX(100px);
  opacity: 0;
}
.toast-leave-to {
  transform: translateX(100px);
  opacity: 0;
}
.toast-item {
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
.animate-spin {
  animation: spin 0.8s linear infinite;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
@keyframes fade-in-up {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
.animate-fade-in-up {
  animation: fade-in-up 0.8s ease-out both;
}
@keyframes pop-in {
  from {
    transform: scale(0.85);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
.animate-pop-in {
  animation: pop-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
@keyframes bounce-soft {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}
.animate-bounce-soft {
  animation: bounce-soft 3s ease-in-out infinite;
}
/* Status Classes */
.success {
  background: #ecfdf5;
}
.error {
  background: #fef2f2;
}
.maintenance {
  background: #fffbeb;
}
.info {
  background: #eff6ff;
}
</style>
