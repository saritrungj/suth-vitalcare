import { ref } from "vue";
import { authStore } from "../store/auth";
import { abortableJson } from "../lib/http";

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  message: string | null;
  link_url: string | null;
  ref_id: number | null;
  is_read: number;
  created_at: string;
}

// Module-level singleton state shared by every consumer (navbar bell, dashboard).
const items = ref<AppNotification[]>([]);
const unread = ref(0);
const loading = ref(false);

async function fetchNotifications() {
  if (!authStore.user?.id) return;
  loading.value = true;
  try {
    const data = await abortableJson<{
      items: AppNotification[];
      unread: number;
    }>("/api/notifications");
    items.value = data.items || [];
    unread.value = data.unread || 0;
  } catch {
    /* non-fatal */
  } finally {
    loading.value = false;
  }
}

async function markRead(id: number) {
  const n = items.value.find((i) => i.id === id);
  if (n && !n.is_read) {
    n.is_read = 1;
    unread.value = Math.max(0, unread.value - 1);
  }
  try {
    await fetch(`/api/notifications/${id}/read`, {
      method: "PATCH",
      headers: { "x-user-id": String(authStore.user?.id || "") },
    });
  } catch {
    /* keep optimistic state */
  }
}

async function markAllRead() {
  items.value.forEach((i) => (i.is_read = 1));
  unread.value = 0;
  try {
    await fetch(`/api/notifications/read-all`, {
      method: "PATCH",
      headers: { "x-user-id": String(authStore.user?.id || "") },
    });
  } catch {
    /* keep optimistic state */
  }
}

export function useNotifications() {
  return {
    items,
    unread,
    loading,
    fetchNotifications,
    markRead,
    markAllRead,
  };
}
