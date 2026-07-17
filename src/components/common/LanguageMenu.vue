<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from "vue";
import { Languages, Check, X } from "lucide-vue-next";
import { langStore } from "../../store/lang";
import type { Locale } from "../../store/lang";

/**
 * Unified language switcher.
 *  - >= 768px : anchored dropdown popover under the trigger
 *  - <  768px : bottom sheet (teleported to body)
 * Fully keyboard + screen-reader accessible (listbox pattern).
 */
const props = withDefaults(
  defineProps<{
    /** Icon-only trigger (used in the mobile profile hero). */
    compact?: boolean;
  }>(),
  { compact: false },
);

const locales: { code: Locale; native: string; sub: string }[] = [
  { code: "th", native: "ไทย", sub: "Thai" },
  { code: "en", native: "English", sub: "อังกฤษ" },
];

const open = ref(false);
const isMobile = ref(false);
const activeIndex = ref(0);

const triggerEl = ref<HTMLButtonElement | null>(null);
const rootEl = ref<HTMLElement | null>(null);
const popEl = ref<HTMLElement | null>(null);
const optionEls = ref<HTMLButtonElement[]>([]);

// Inline fixed-position for the teleported desktop popover, anchored to the
// trigger so it never gets clipped or stacked under page content.
const popStyle = ref<Record<string, string>>({});

const menuId = `lang-menu-${Math.random().toString(36).slice(2, 8)}`;

const currentShort = computed(() => (langStore.locale === "th" ? "ไทย" : "EN"));

const checkMobile = () => {
  isMobile.value = window.innerWidth <= 767;
};

const setOptionRef = (el: any, i: number) => {
  if (el) optionEls.value[i] = el as HTMLButtonElement;
};

const focusOption = (i: number) => {
  activeIndex.value = i;
  nextTick(() => optionEls.value[i]?.focus());
};

const updatePopPosition = () => {
  const el = triggerEl.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  popStyle.value = {
    top: `${Math.round(r.bottom + 8)}px`,
    right: `${Math.round(window.innerWidth - r.right)}px`,
  };
};

const onReposition = () => {
  if (open.value && !isMobile.value) updatePopPosition();
};

const openMenu = async () => {
  open.value = true;
  if (isMobile.value) {
    document.body.style.overflow = "hidden";
  } else {
    updatePopPosition();
    window.addEventListener("scroll", onReposition, {
      passive: true,
      capture: true,
    });
  }
  const selected = locales.findIndex((l) => l.code === langStore.locale);
  await nextTick();
  focusOption(selected === -1 ? 0 : selected);
};

const closeMenu = (returnFocus = true) => {
  if (!open.value) return;
  open.value = false;
  document.body.style.overflow = "";
  window.removeEventListener("scroll", onReposition, true);
  if (returnFocus) nextTick(() => triggerEl.value?.focus());
};

const toggleMenu = () => {
  if (open.value) closeMenu();
  else openMenu();
};

const selectLang = (code: Locale) => {
  langStore.setLocale(code);
  closeMenu();
};

const onListKeydown = (e: KeyboardEvent) => {
  const last = locales.length - 1;
  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      focusOption(activeIndex.value >= last ? 0 : activeIndex.value + 1);
      break;
    case "ArrowUp":
      e.preventDefault();
      focusOption(activeIndex.value <= 0 ? last : activeIndex.value - 1);
      break;
    case "Home":
      e.preventDefault();
      focusOption(0);
      break;
    case "End":
      e.preventDefault();
      focusOption(last);
      break;
    case "Enter":
    case " ":
      e.preventDefault();
      selectLang(locales[activeIndex.value].code);
      break;
    case "Escape":
      e.preventDefault();
      closeMenu();
      break;
  }
};

// Close the desktop popover on outside click. The popover is teleported to
// <body>, so check both the trigger root and the popover element.
const onDocPointer = (e: PointerEvent) => {
  if (isMobile.value) return; // mobile sheet handled by overlay
  const t = e.target as Node;
  if (rootEl.value?.contains(t) || popEl.value?.contains(t)) return;
  closeMenu(false);
};

const onResize = () => {
  checkMobile();
  onReposition();
};

watch(isMobile, () => {
  if (open.value) closeMenu(false);
});

onMounted(() => {
  checkMobile();
  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("pointerdown", onDocPointer, true);
});

onUnmounted(() => {
  window.removeEventListener("resize", onResize);
  window.removeEventListener("scroll", onReposition, true);
  document.removeEventListener("pointerdown", onDocPointer, true);
  document.body.style.overflow = "";
});
</script>

<template>
  <div ref="rootEl" class="lang-menu">
    <!-- Trigger -->
    <button
      ref="triggerEl"
      type="button"
      class="lang-trigger"
      :class="{ 'is-compact': compact, 'is-open': open }"
      :aria-haspopup="'listbox'"
      :aria-expanded="open"
      :aria-controls="menuId"
      :aria-label="langStore.t('select_language')"
      :title="langStore.t('select_language')"
      @click="toggleMenu"
    >
      <Languages :size="compact ? 18 : 16" class="lang-trigger-icon" />
      <span v-if="!compact" class="lang-trigger-label">{{ currentShort }}</span>
    </button>

    <!-- Desktop popover (teleported + fixed-positioned so it floats above all
         page content, anchored to the trigger). -->
    <Teleport to="body">
      <transition name="lang-pop">
        <ul
          v-if="open && !isMobile"
          ref="popEl"
          :id="menuId"
          class="lang-pop"
          :style="popStyle"
          role="listbox"
          :aria-label="langStore.t('select_language')"
          @keydown="onListKeydown"
        >
          <li v-for="(loc, i) in locales" :key="loc.code" role="presentation">
            <button
              :ref="(el) => setOptionRef(el, i)"
              type="button"
              class="lang-option"
              :class="{ active: langStore.locale === loc.code }"
              role="option"
              :aria-selected="langStore.locale === loc.code"
              :tabindex="activeIndex === i ? 0 : -1"
              @click="selectLang(loc.code)"
            >
              <span class="lang-option-text">
                <span class="lang-option-native">{{ loc.native }}</span>
                <span class="lang-option-sub">{{ loc.sub }}</span>
              </span>
              <Check
                v-if="langStore.locale === loc.code"
                :size="18"
                class="lang-option-check"
              />
            </button>
          </li>
        </ul>
      </transition>
    </Teleport>

    <!-- Mobile bottom sheet -->
    <Teleport to="body">
      <transition name="lang-sheet">
        <div
          v-if="open && isMobile"
          class="lang-sheet-overlay"
          @click.self="closeMenu()"
        >
          <div
            class="lang-sheet"
            role="dialog"
            aria-modal="true"
            :aria-label="langStore.t('select_language')"
          >
            <div class="lang-sheet-grip"></div>
            <header class="lang-sheet-header">
              <h3 class="lang-sheet-title">
                {{ langStore.t("select_language") }}
              </h3>
              <button
                type="button"
                class="lang-sheet-close"
                :aria-label="langStore.t('close')"
                @click="closeMenu()"
              >
                <X :size="18" />
              </button>
            </header>

            <ul
              :id="menuId"
              class="lang-option-list"
              role="listbox"
              :aria-label="langStore.t('select_language')"
              @keydown="onListKeydown"
            >
              <li
                v-for="(loc, i) in locales"
                :key="loc.code"
                role="presentation"
              >
                <button
                  :ref="(el) => setOptionRef(el, i)"
                  type="button"
                  class="lang-option lang-option--sheet"
                  :class="{ active: langStore.locale === loc.code }"
                  role="option"
                  :aria-selected="langStore.locale === loc.code"
                  :tabindex="activeIndex === i ? 0 : -1"
                  @click="selectLang(loc.code)"
                >
                  <span class="lang-option-text">
                    <span class="lang-option-native">{{ loc.native }}</span>
                    <span class="lang-option-sub">{{ loc.sub }}</span>
                  </span>
                  <Check
                    v-if="langStore.locale === loc.code"
                    :size="20"
                    class="lang-option-check"
                  />
                </button>
              </li>
            </ul>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<style scoped>
.lang-menu {
  position: relative;
  display: inline-flex;
}

/* ── Trigger ─────────────────────────────────────────────────────────────── */
.lang-trigger {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1.5px solid var(--color-border);
  background: transparent;
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--vp-muted);
  white-space: nowrap;
  transition:
    color 0.2s ease,
    border-color 0.2s ease,
    background-color 0.2s ease;
}
.lang-trigger:hover,
.lang-trigger.is-open {
  border-color: var(--color-primary);
  color: var(--color-primary-dark);
  background: var(--color-primary-light);
}
.lang-trigger:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
.lang-trigger.is-compact {
  width: 40px;
  height: 40px;
  padding: 0;
  justify-content: center;
}
.lang-trigger-icon {
  flex-shrink: 0;
}
.lang-trigger-label {
  line-height: 1;
}

/* ── Desktop popover ─────────────────────────────────────────────────────── */
.lang-pop {
  position: fixed;
  z-index: 1000;
  min-width: 220px;
  margin: 0;
  padding: 6px;
  list-style: none;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.14);
}

/* ── Shared option ───────────────────────────────────────────────────────── */
.lang-option {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1.5px solid transparent;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}
.lang-option:hover {
  background: var(--color-primary-light);
}
.lang-option:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}
.lang-option.active {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}
.lang-option-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.lang-option-native {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-text-main);
}
.lang-option.active .lang-option-native {
  color: var(--color-primary-dark);
}
.lang-option-sub {
  font-size: 0.75rem;
  color: var(--vp-muted);
}
.lang-option-check {
  flex-shrink: 0;
  color: var(--color-primary-dark);
}

/* ── Mobile bottom sheet ─────────────────────────────────────────────────── */
.lang-sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  font-family: var(--font-sans);
}
.lang-sheet {
  width: 100%;
  max-width: 520px;
  background: var(--color-surface);
  border-radius: 22px 22px 0 0;
  padding: 8px 16px calc(16px + env(safe-area-inset-bottom, 0px));
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.18);
}
.lang-sheet-grip {
  width: 38px;
  height: 4px;
  border-radius: 999px;
  background: #e2e8f0;
  margin: 4px auto 10px;
}
.lang-sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.lang-sheet-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text-main);
  margin: 0;
}
.lang-sheet-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 10px;
  border: none;
  border-radius: 30%;
  background: var(--color-border);
  color: var(--vp-muted);
  cursor: pointer;
}
.lang-sheet-close:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
.lang-option-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lang-option--sheet {
  min-height: 54px;
  padding: 10px 16px;
  border-color: var(--color-border);
  border-radius: 14px;
}

/* ── Transitions ─────────────────────────────────────────────────────────── */
.lang-pop-enter-active,
.lang-pop-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.18s cubic-bezier(0.22, 1, 0.36, 1);
  transform-origin: top right;
}
.lang-pop-enter-from,
.lang-pop-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(-6px);
}

.lang-sheet-enter-active,
.lang-sheet-leave-active {
  transition: opacity 0.25s ease;
}
.lang-sheet-enter-active .lang-sheet,
.lang-sheet-leave-active .lang-sheet {
  transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}
.lang-sheet-enter-from,
.lang-sheet-leave-to {
  opacity: 0;
}
.lang-sheet-enter-from .lang-sheet,
.lang-sheet-leave-to .lang-sheet {
  transform: translateY(100%);
}
@media (prefers-reduced-motion: reduce) {
  .lang-pop-enter-active,
  .lang-pop-leave-active,
  .lang-sheet-enter-active .lang-sheet,
  .lang-sheet-leave-active .lang-sheet {
    transition: none;
  }
}
</style>
