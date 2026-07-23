import { createRouter, createWebHistory } from "vue-router";
import { watch } from "vue";
import { authStore } from "../store/auth";
import { setRedirectAfterLogin, consumeSafeRedirect } from "../lib/redirect";
// แก้ปัญหา 404 โดยการ Import ตรงๆ (Static Import) สำหรับหน้าที่ Tunnel โหลดไม่ได้
import EventDetail from "../views/EventDetail.vue";
import Missions from "../views/Missions.vue";
import Rankings from "../views/Rankings.vue";
import Health from "../views/Health.vue";
const routes = [
  {
    path: "/",
    name: "Home",
    component: () => import("../views/Activities.vue"),
    meta: { title: "กิจกรรมทั้งหมด" },
  },
  {
    path: "/login",
    name: "Login",
    component: () => import("../views/Login.vue"),
    meta: { title: "เข้าสู่ระบบ", hideNavbar: true },
  },
  {
    path: "/register",
    name: "Register",
    component: () => import("../views/Signup.vue"),
    meta: { title: "ลงทะเบียนสมาชิก", hideNavbar: true },
  },
  {
    path: "/forgot-password",
    name: "ForgotPassword",
    component: () => import("../views/ResetPassword.vue"),
    meta: { title: "ลืมรหัสผ่าน", hideNavbar: true },
  },
  {
    path: "/reset-password",
    name: "ResetPassword",
    component: () => import("../views/ResetPassword.vue"),
    meta: { title: "ตั้งรหัสผ่านใหม่", hideNavbar: true },
  },
  {
    path: "/body-composition",
    name: "BodyComposition",
    component: () => import("../views/BodyComposition.vue"),
    meta: { title: "องค์ประกอบของร่างกาย", hideNavbar: true },
  },
  {
    path: "/activities/:id",
    name: "EventDetail",
    component: EventDetail, // ใช้ตัวแปรที่ Import มาด้านบนแทน () => import
    meta: { title: "รายละเอียดกิจกรรม" },
  },
  {
    path: "/missions",
    name: "Missions",
    component: Missions,
    meta: { title: "ภารกิจของฉัน" },
  },
  {
    path: "/health",
    name: "Health",
    component: Health,
    meta: { title: "ข้อมูลสุขภาพ" },
  },
  {
    path: "/rankings",
    name: "Rankings",
    component: Rankings,
    meta: { title: "อันดับผู้ท้าชิง (Leaderboard)" },
  },
  {
    path: "/admin",
    name: "Admin",
    component: () => import("../views/Admin.vue"),
    meta: {
      title: "ระบบจัดการผู้ดูแล (Admin)",
      hideNavbar: true,
      requiresAdmin: true,
    },
  },
  {
    path: "/admin/users/:id",
    name: "AdminUserDetail",
    component: () => import("../views/AdminUserDetail.vue"),
    meta: {
      title: "จัดการข้อมูลสมาชิก",
      hideNavbar: true,
      requiresAdmin: true,
    },
  },
  {
    path: "/create-teams",
    name: "CreateTeams",
    component: () => import("../views/CreateTeams.vue"),
    meta: { title: "ค้นหาและสร้างทีม" },
  },
  {
    path: "/teams",
    name: "Teams",
    component: () => import("../views/Teams.vue"),
    meta: { title: "ทีมของฉัน" },
  },
  {
    path: "/profile",
    name: "Profile",
    component: () => import("../views/Profile.vue"),
    meta: { title: "โปรไฟล์ส่วนตัว" },
  },
  {
    path: "/shop",
    name: "Shop",
    component: () => import("../views/Shop.vue"),
    meta: { title: "ร้านแลกของรางวัล" },
  },
  {
    path: "/my-activities",
    name: "MyActivities",
    component: () => import("../views/Activities.vue"),
    meta: { title: "กิจกรรมที่สมัครทั้งหมด" },
  },
];
const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    }
    // Admin panel has its own scroll container (.content-viewport),
    // so we only need to scroll to top on non-admin route changes.
    // For admin, each component handles its own scroll.
    if (to.path === "/admin" && from.path === "/admin") {
      // Tab change inside admin — let the component handle it
      return false;
    }
    return { top: 0, behavior: "smooth" };
  },
});
router.beforeEach(async (to, from, next) => {
  const isRegistering = to.name === "Register";
  const isLoggingIn = to.name === "Login";
  const isResetting =
    to.name === "ForgotPassword" || to.name === "ResetPassword";
  if (authStore.loading) {
    await new Promise<void>((resolve) => {
      const stop = watch(
        () => authStore.loading,
        (isLoading) => {
          if (!isLoading) {
            stop();
            resolve();
          }
        },
        { immediate: true },
      );
    });
  }
  const userAfterLoad = authStore.user;
  if (!userAfterLoad && !isLoggingIn && !isRegistering && !isResetting) {
    if (to.fullPath !== "/") {
      setRedirectAfterLogin(to.fullPath);
    }
    return next({ name: "Login" });
  }
  // ── Route-level Admin access guard ─────────────────────────────────
  // Only admin may access /admin panel.
  // Regular users are redirected to / silently.
  if (to.meta.requiresAdmin && userAfterLoad) {
    const role = userAfterLoad.role as string;
    if (role !== "admin") {
      return next({ path: "/" });
    }
  }
  if (userAfterLoad && isLoggingIn) {
    return next(consumeSafeRedirect());
  }
  if (userAfterLoad && !isRegistering && !isLoggingIn) {
    if (userAfterLoad.role !== "admin") {
      const isIncomplete = !userAfterLoad.fname_th || !userAfterLoad.phone;
      if (isIncomplete) {
        return next({ name: "Register" });
      }
    }
  }
  next();
});
export default router;
