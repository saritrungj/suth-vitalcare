import { ref, computed } from "vue";
import { authStore } from "../store/auth";
import { abortableJson } from "../lib/http";

export interface Reward {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  points_required: number;
  stock: number;
  is_active: number | boolean;
  reward_type: string;
  category: string;
}

export interface Redemption {
  id: number;
  reward_id: number;
  name: string;
  image_url: string | null;
  reward_points: number;
  status: "pending" | "completed" | "rejected" | "cancelled";
  created_at: string;
}

export function useShop() {
  const rewards = ref<Reward[]>([]);
  const history = ref<Redemption[]>([]);
  const loading = ref(false);
  const redeeming = ref<number | null>(null);
  const error = ref("");

  const balance = computed(() => authStore.user?.points ?? 0);

  const activeRewards = computed(() =>
    rewards.value.filter((r) => r.is_active),
  );

  const fetchRewards = async () => {
    loading.value = true;
    error.value = "";
    try {
      rewards.value = await abortableJson<Reward[]>("/api/items");
    } catch (e: any) {
      error.value = e?.message || "โหลดของรางวัลไม่สำเร็จ";
    } finally {
      loading.value = false;
    }
  };

  const fetchHistory = async () => {
    if (!authStore.user?.id) return;
    try {
      history.value = await abortableJson<Redemption[]>(
        `/api/items/redeemed/${authStore.user.id}`,
      );
    } catch {
      /* non-fatal */
    }
  };

  /** Redeem a reward. Returns { ok, error }. Updates local balance on success. */
  const redeem = async (reward: Reward) => {
    if (!authStore.user?.id) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };
    // Guard against a double-click firing two overlapping redeem requests
    // for the same (or a different) reward before the first settles.
    if (redeeming.value) return { ok: false, error: "" };
    redeeming.value = reward.id;
    try {
      const res = await fetch("/api/items/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(authStore.user.id),
        },
        body: JSON.stringify({
          user_id: authStore.user.id,
          reward_id: reward.id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: data.error || "แลกของรางวัลไม่สำเร็จ" };
      }
      // Reflect new balance + stock locally.
      if (typeof data.new_points === "number" && authStore.user) {
        authStore.user.points = data.new_points;
      }
      const local = rewards.value.find((r) => r.id === reward.id);
      if (local && local.stock > 0) local.stock -= 1;
      await fetchHistory();
      return { ok: true, error: "" };
    } catch (e: any) {
      return { ok: false, error: e?.message || "แลกของรางวัลไม่สำเร็จ" };
    } finally {
      redeeming.value = null;
    }
  };

  return {
    rewards,
    activeRewards,
    history,
    loading,
    redeeming,
    error,
    balance,
    fetchRewards,
    fetchHistory,
    redeem,
  };
}
