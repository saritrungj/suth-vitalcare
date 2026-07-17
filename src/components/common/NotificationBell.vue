<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { Bell, CheckCheck, Inbox } from "lucide-vue-next";
import { langStore } from "../../store/lang";
import {
  useNotifications,
  type AppNotification,
} from "../../composables/useNotifications";
import { useRealtime } from "../../composables/useRealtime";

const router = useRouter();
const { items, unread, fetchNotifications, markRead, markAllRead } =
  useNotifications();

// Live updates: refetch when the server broadcasts a new notification.
useRealtime({ onNotificationCreated: () => fetchNotifications() });

const open = ref(false);
const rootEl = ref<HTMLElement | null>(null);

const toggle = () => {
  open.value = !open.value;
  if (open.value) fetchNotifications();
};
const close = () => (open.value = false);

const onItem = (n: AppNotification) => {
  if (!n.is_read) markRead(n.id);
  close();
  if (n.link_url) router.push(n.link_url);
};

const onDocPointer = (e: PointerEvent) => {
  if (rootEl.value && !rootEl.value.contains(e.target as Node)) close();
};

const timeAgo = (iso: string) => {
  const d = new Date(iso).getTime();
  if (isNaN(d)) return "";
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60) return "เมื่อสักครู่";
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชม.ที่แล้ว`;
  return `${Math.floor(diff / 86400)} วันที่แล้ว`;
};

onMounted(() => {
  fetchNotifications();
  document.addEventListener("pointerdown", onDocPointer, true);
});
onUnmounted(() => {
  document.removeEventListener("pointerdown", onDocPointer, true);
});
</script>

<template>
  <div ref="rootEl" class="bell-wrap">
    <button
      type="button"
      class="bell-trigger"
      :class="{ 'is-open': open }"
      :aria-label="langStore.t('notifications')"
      :aria-expanded="open"
      @click="toggle"
    >
      <Bell :size="20" />
      <span v-if="unread > 0" class="bell-badge">{{
        unread > 9 ? "9+" : unread
      }}</span>
    </button>

    <transition name="bell-pop">
      <div v-if="open" class="bell-panel" role="dialog">
        <header class="bell-head">
          <span class="bell-title">{{ langStore.t("notifications") }}</span>
          <button v-if="unread > 0" class="bell-readall" @click="markAllRead">
            <CheckCheck :size="14" /> {{ langStore.t("mark_all_read") }}
          </button>
        </header>

        <div v-if="items.length === 0" class="bell-empty">
          <Inbox :size="34" />
          <p>{{ langStore.t("no_notifications") }}</p>
        </div>

        <ul v-else class="bell-list">
          <li
            v-for="n in items"
            :key="n.id"
            class="bell-item"
            :class="{ unread: !n.is_read }"
            @click="onItem(n)"
          >
            <span v-if="!n.is_read" class="dot"></span>
            <div class="bell-item-body">
              <div class="bell-item-title">{{ n.title }}</div>
              <div class="bell-item-msg">{{ n.message }}</div>
              <div class="bell-item-time">{{ timeAgo(n.created_at) }}</div>
            </div>
          </li>
        </ul>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.bell-wrap {
  position: relative;
  display: inline-flex;
}
.bell-trigger {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1.5px solid var(--color-border);
  border-radius: 999px;
  background: transparent;
  color: var(--vp-muted);
  cursor: pointer;
  transition:
    color 0.2s ease,
    border-color 0.2s ease,
    background-color 0.2s ease;
}
.bell-trigger:hover,
.bell-trigger.is-open {
  color: var(--color-primary-dark);
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}
.bell-trigger:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
.bell-badge {
  position: absolute;
  top: -3px;
  right: -3px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 0.66rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.bell-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 200;
  width: 340px;
  max-width: calc(100vw - 32px);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16);
  overflow: hidden;
}
.bell-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--color-border);
}
.bell-title {
  font-weight: 700;
  color: var(--color-text-main);
}
.bell-readall {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  color: var(--color-primary-dark);
  font-weight: 600;
  font-size: 0.78rem;
  cursor: pointer;
}
.bell-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 0;
  color: var(--vp-muted);
}
.bell-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 60vh;
  overflow-y: auto;
}
.bell-item {
  display: flex;
  gap: 8px;
  padding: 11px 14px;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: background-color 0.15s ease;
}
.bell-item:hover {
  background: var(--color-bg);
}
.bell-item.unread {
  background: var(--color-primary-light);
}
.bell-item.unread:hover {
  background: var(--color-primary-light);
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary);
  margin-top: 6px;
  flex-shrink: 0;
}
.bell-item-body {
  min-width: 0;
}
.bell-item-title {
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--color-text-main);
}
.bell-item-msg {
  font-size: 0.8rem;
  color: var(--vp-text);
  margin-top: 1px;
}
.bell-item-time {
  font-size: 0.72rem;
  color: var(--vp-muted);
  margin-top: 3px;
}
.bell-pop-enter-active,
.bell-pop-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.18s cubic-bezier(0.22, 1, 0.36, 1);
  transform-origin: top right;
}
.bell-pop-enter-from,
.bell-pop-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(-6px);
}
</style>
