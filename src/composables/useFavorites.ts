import { ref, onMounted } from "vue";
import { authStore } from "../store/auth";
import { showError } from "../lib/swal";
const favoriteIds = ref<Set<number>>(new Set());
const counts = ref<Record<number, number>>({});
const isLoading = ref(false);
// Per-event in-flight guard: a fast double-click on the same favorite button
// fired two overlapping toggle requests, and whichever response landed last
// won — regardless of click order — leaving the UI out of sync with the
// server (e.g. two "add" clicks could net out as "removed").
const pendingToggles = new Set<number>();
export function useFavorites() {
  const fetchFavorites = async () => {
    if (!authStore.user?.id) return;
    isLoading.value = true;
    try {
      // Get all favorites for this user
      const res = await fetch(`/api/fav-user/${authStore.user.id}`, {
        headers: { "x-user-id": String(authStore.user.id) },
      });
      if (res.ok) {
        const data = await res.json();
        // Trigger reactivity with a new Set
        favoriteIds.value = new Set(data.map((f: any) => f.event_id));
      }
    } catch (e) {
    } finally {
      isLoading.value = false;
    }
  };
  const toggleFavorite = async (eventId: number) => {
    if (!authStore.user?.id) {
      showError("กรุณาเข้าสู่ระบบก่อนบันทึกกิจกรรมเป็นรายการโปรดครับ");
      return;
    }
    if (pendingToggles.has(eventId)) return;
    pendingToggles.add(eventId);
    const isFav = favoriteIds.value.has(eventId);
    // Optimistic Update with reactive trigger
    const newSet = new Set(favoriteIds.value);
    if (isFav) newSet.delete(eventId);
    else newSet.add(eventId);
    favoriteIds.value = newSet;
    try {
      const res = await fetch(`/api/fav-toggle/${eventId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(authStore.user.id),
        },
        body: JSON.stringify({ userId: authStore.user.id }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Server error");
      }
      const data = await res.json();
      // Ensure sync with server response
      const serverSet = new Set(favoriteIds.value);
      if (data.action === "added") serverSet.add(eventId);
      else serverSet.delete(eventId);
      favoriteIds.value = serverSet;
    } catch (e: any) {
      // Rollback on error
      const rollbackSet = new Set(favoriteIds.value);
      if (isFav) rollbackSet.add(eventId);
      else rollbackSet.delete(eventId);
      favoriteIds.value = rollbackSet;
      showError(e.message || "เกิดข้อผิดพลาด ไม่สามารถดำเนินการได้");
    } finally {
      pendingToggles.delete(eventId);
    }
  };
  const fetchEventFavoriteData = async (eventId: number) => {
    try {
      const res = await fetch(`/api/fav-status/${eventId}`, {
        headers: { "x-user-id": authStore.user?.id || "" },
      });
      if (res.ok) {
        const data = await res.json();
        const nextSet = new Set(favoriteIds.value);
        if (data.isFavorited) nextSet.add(eventId);
        else nextSet.delete(eventId);
        favoriteIds.value = nextSet;
        return { count: data.count || 0, isFavorited: !!data.isFavorited };
      }
    } catch (e) {}
    return { count: 0, isFavorited: false };
  };
  return {
    favoriteIds,
    isLoading,
    fetchFavorites,
    toggleFavorite,
    fetchEventFavoriteData,
  };
}
