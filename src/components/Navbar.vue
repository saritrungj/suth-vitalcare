<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { authStore } from "../store/auth";
import { langStore } from "../store/lang";
import {
  Activity,
  Target,
  Medal,
  UsersRound,
  CircleUserRound,
  ShieldCheck,
  ShoppingBag,
} from "lucide-vue-next";
import LanguageMenu from "./common/LanguageMenu.vue";
import NotificationBell from "./common/NotificationBell.vue";
const router = useRouter();
const route = useRoute();
const activeIndex = ref(-1);
const isScrolled = ref(false);

// ── Navigation items (reactive to language) ──────────────────────────────────
const navigation = computed(() => [
  { name: langStore.t("nav_activities"), icon: Activity, path: "/" },
  { name: langStore.t("nav_missions"), icon: Target, path: "/missions" },
  { name: langStore.t("nav_rankings"), icon: Medal, path: "/rankings" },
  {
    name: langStore.t("nav_create_team"),
    icon: UsersRound,
    path: "/create-teams",
  },
  { name: langStore.t("nav_shop"), icon: ShoppingBag, path: "/shop" },
  { name: langStore.t("nav_profile"), icon: CircleUserRound, path: "/profile" },
]);

const isAdmin = computed(() => authStore.user?.role?.toLowerCase() === "admin");

const hideNavbar = computed(() => {
  const hiddenPaths = ["/register", "/body-composition"];
  return hiddenPaths.includes(route.path);
});

const toggleAdminMode = () => {
  authStore.toggleAdminMode();
  if (authStore.isAdminMode) {
    router.push("/admin");
  } else {
    router.push("/");
  }
};

const setActive = (index: number) => {
  activeIndex.value = index;
};

watch(
  () => route.path,
  (newPath) => {
    const index = navigation.value.findIndex((item) => item.path === newPath);
    if (index !== -1) {
      activeIndex.value = index;
    } else {
      const subIndex = navigation.value.findIndex((item) => {
        if (item.path === "/") return false;
        return newPath.startsWith(item.path);
      });
      activeIndex.value = subIndex;
    }
  },
  { immediate: true },
);

const isMobile = ref(false);
const checkMobile = () => {
  isMobile.value = window.innerWidth <= 767;
};

const handleScroll = () => {
  isScrolled.value = window.scrollY > 10;
};

onMounted(() => {
  checkMobile();
  window.addEventListener("resize", checkMobile, { passive: true });
  window.addEventListener("scroll", handleScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener("resize", checkMobile);
  window.removeEventListener("scroll", handleScroll);
});
</script>

<template>
  <!-- ===== DESKTOP / TABLET NAVBAR (Top Bar) ===== -->
  <nav
    v-if="!hideNavbar && !isMobile"
    class="navbar-top"
    :class="{ 'is-scrolled': isScrolled }"
  >
    <div class="container-nav">
      <router-link to="/" class="brand">
        <img src="/logo.png" class="logo" alt="" />
        <span class="brand-text">VitalCare</span>
      </router-link>

      <div class="nav-links">
        <router-link
          v-for="(item, index) in navigation"
          :key="index"
          :to="item.path"
          class="nav-item"
          :class="{ active: activeIndex === index }"
          :aria-current="activeIndex === index ? 'page' : undefined"
          @click="setActive(index)"
        >
          <component :is="item.icon" class="icon-nav" />
          <span class="label">{{ item.name }}</span>
        </router-link>

        <button
          v-if="isAdmin"
          @click="toggleAdminMode"
          class="nav-item admin-btn"
        >
          <ShieldCheck class="icon-nav" />
          <span class="label">{{ langStore.t("nav_admin") }}</span>
        </button>
      </div>

      <div class="user-section">
        <NotificationBell />
        <!-- Language Switcher (Desktop popover) -->
        <LanguageMenu />

        <router-link to="/profile" class="avatar-link">
          <img
            v-if="authStore.user?.picture_url"
            :src="authStore.user.picture_url"
            alt="Profile"
          />
          <CircleUserRound v-else class="fallback-avatar" />
        </router-link>
      </div>
    </div>
  </nav>

  <!-- ===== MOBILE NAVBAR (Bottom Tab Bar) ===== -->
  <nav v-if="!hideNavbar && isMobile" class="navbar-mobile">
    <div class="mobile-grid">
      <router-link
        v-for="(item, index) in navigation"
        :key="index"
        :to="item.path"
        class="tab-item"
        :class="{ active: activeIndex === index }"
        :aria-current="activeIndex === index ? 'page' : undefined"
        @click="setActive(index)"
      >
        <div class="tab-icon-wrapper">
          <component :is="item.icon" class="tab-icon" />
        </div>
        <span class="tab-label">{{ item.name }}</span>
      </router-link>

      <button
        v-if="isAdmin"
        class="tab-item admin-tab"
        @click="toggleAdminMode"
      >
        <div class="tab-icon-wrapper">
          <ShieldCheck class="tab-icon" />
        </div>
        <span class="tab-label">{{ langStore.t("nav_admin") }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
:global(:root) {
  /* Accent maps to the app's teal brand tokens (see index.css).
     --accent      : icons / underline / focus rings  (large + non-text, >=3:1)
     --accent-text : active / hover label text        (#127555, ~5:1, passes AA)
     --accent-soft : soft hover/active backgrounds */
  --accent: var(--color-primary);
  --accent-text: var(--color-primary-dark);
  --accent-soft: var(--color-primary-light);
  --gray-main: #111827;
  --gray-muted: #6b7280;
  --white-pure: #ffffff;
  --border-color: #f3f4f6;
}

/* ========== NAVBAR TOP (Desktop/Tablet) ========== */
.navbar-top {
  display: none;
  position: sticky;
  top: 0;
  z-index: 100;
  width: 100%;
  background-color: var(--white-pure);
  border-bottom: 1px solid var(--border-color);
  transition:
    background-color 0.3s ease,
    box-shadow 0.3s ease;
}
@media (min-width: 768px) {
  .navbar-top {
    display: block;
  }
}
.navbar-top.is-scrolled {
  background-color: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}
.container-nav {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Brand */
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
}
.logo {
  width: 38px;
  height: 38px;
  object-fit: contain;
}
.brand-text {
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--gray-main);
  letter-spacing: -0.03em;
}

/* Nav Links */
.nav-links {
  display: flex;
  align-items: center;
  height: 100%;
  gap: 4px;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  height: 100%;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--gray-muted);
  text-decoration: none;
  background: transparent;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.2s ease;
  position: relative;
}
.nav-item::after {
  content: "";
  position: absolute;
  bottom: -1px;
  left: 0;
  width: 100%;
  height: 3px;
  background-color: var(--accent);
  transform: scaleX(0);
  transition: transform 0.2s ease;
}
.nav-item:hover {
  color: var(--accent-text);
}
.nav-item.active {
  color: var(--accent-text);
  font-weight: 700;
}
.nav-item.active::after {
  transform: scaleX(1);
}
.nav-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  border-radius: 6px;
}
.icon-nav {
  width: 20px;
  height: 20px;
  stroke-width: 2.2;
}
@media (prefers-reduced-motion: reduce) {
  .nav-item::after {
    transition: none;
  }
}

/* User Section */
.user-section {
  display: flex;
  align-items: center;
  gap: 10px;
}
.avatar-link {
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  aspect-ratio: 1 / 1;
  flex-shrink: 0;
  border-radius: 50%;
  background-color: var(--border-color);
  overflow: hidden;
  border: 2px solid transparent;
  transition: border-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar-link:hover {
  border-color: var(--accent);
}
.avatar-link:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.avatar-link img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.fallback-avatar {
  width: 26px;
  height: 26px;
  color: var(--gray-muted);
}

/* Admin button shares .nav-item styling; ensure focus ring matches links. */
.admin-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  border-radius: 6px;
}

/* ========== TABLET SPECIFIC (768px - 1024px) ========== */
@media (min-width: 768px) and (max-width: 1024px) {
  .container-nav {
    padding: 0 16px;
  }
  .brand-text {
    display: none;
  }
  .nav-item {
    padding: 0 10px;
    font-size: 0.9rem;
  }
  .nav-links {
    gap: 0;
  }
  /* Tablet: language trigger shows icon only (label lives in child component). */
  .user-section :deep(.lang-trigger-label) {
    display: none;
  }
  .user-section :deep(.lang-trigger) {
    padding: 6px 10px;
  }
}

/* ========== NAVBAR MOBILE (Bottom Nav) ========== */
.navbar-mobile {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  background: var(--white-pure);
  border-top: 1px solid var(--border-color);
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.05);
  z-index: 200;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.mobile-grid {
  display: flex;
  height: 60px;
  align-items: center;
  justify-content: space-around;
  padding: 0 4px;
}
.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: transparent;
  border: none;
  text-decoration: none;
  color: var(--gray-muted);
  -webkit-tap-highlight-color: transparent;
}
.tab-icon-wrapper {
  width: 48px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 15px;
  transition: background-color 0.2s;
}
.tab-icon {
  width: 22px;
  height: 22px;
  stroke-width: 1.8;
}
.tab-label {
  font-size: 0.68rem;
  font-weight: 600;
  white-space: nowrap;
}
.tab-item.active {
  color: var(--accent-text);
}
.tab-item.active .tab-icon-wrapper {
  background-color: transparent;
}
.tab-item.active .tab-icon {
  stroke-width: 2.5;
}
.tab-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -3px;
  border-radius: 10px;
}

/* Push app content up (bottom tab bar = 60px + safe-area, no language strip) */
@media (max-width: 767px) {
  :global(#app) {
    padding-bottom: calc(60px + env(safe-area-inset-bottom, 0px));
  }
}
</style>
