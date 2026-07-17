import { ref } from "vue";
import { authStore } from "../store/auth";
import { abortableJson } from "../lib/http";

export interface ShopItem {
  id?: number;
  name: string;
  description: string;
  image_url: string;
  points_required: number;
  stock: number;
  is_active: boolean;
  reward_type: string;
  category: string;
}

export interface AdminRedemption {
  id: number;
  user_id: number;
  reward_id: number;
  reward_name: string;
  image_url: string | null;
  points_required: number;
  status: "pending" | "completed" | "rejected" | "cancelled";
  fname_th: string | null;
  lname_th: string | null;
  picture_url: string | null;
  created_at: string;
}

export const emptyItem = (): ShopItem => ({
  name: "",
  description: "",
  image_url: "",
  points_required: 0,
  stock: 0,
  is_active: true,
  reward_type: "item",
  category: "ทั่วไป",
});

function authHeaders(json = true): Record<string, string> {
  const h: Record<string, string> = {
    "x-user-id": String(authStore.user?.id || ""),
  };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

export function useAdminShop() {
  const items = ref<ShopItem[]>([]);
  const redemptions = ref<AdminRedemption[]>([]);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref("");

  const fetchItems = async () => {
    loading.value = true;
    error.value = "";
    try {
      const rows = await abortableJson<any[]>("/api/items");
      items.value = rows.map((r) => ({ ...r, is_active: !!r.is_active }));
    } catch (e: any) {
      error.value = e?.message || "โหลดรายการไม่สำเร็จ";
    } finally {
      loading.value = false;
    }
  };

  const fetchRedemptions = async (status = "pending") => {
    try {
      redemptions.value = await abortableJson<AdminRedemption[]>(
        `/api/items/admin/redemptions${status ? `?status=${status}` : ""}`,
      );
    } catch (e: any) {
      error.value = e?.message || "โหลดรายการแลกไม่สำเร็จ";
    }
  };

  /** Upload an image file, returns the stored URL (reuses /api/upload). */
  const uploadImage = async (file: File): Promise<string> => {
    const form = new FormData();
    form.append("image", file);
    const res = await fetch(
      `/api/upload?type=banners&name=${encodeURIComponent(file.name)}`,
      { method: "POST", headers: authHeaders(false), body: form },
    );
    if (!res.ok) throw new Error("อัปโหลดรูปไม่สำเร็จ");
    const data = await res.json();
    return data.url || "";
  };

  const saveItem = async (item: ShopItem): Promise<boolean> => {
    saving.value = true;
    error.value = "";
    try {
      const isEdit = !!item.id;
      const res = await fetch(isEdit ? `/api/items/${item.id}` : "/api/items", {
        method: isEdit ? "PATCH" : "POST",
        headers: authHeaders(),
        body: JSON.stringify(item),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "บันทึกไม่สำเร็จ");
      }
      await fetchItems();
      return true;
    } catch (e: any) {
      error.value = e?.message || "บันทึกไม่สำเร็จ";
      return false;
    } finally {
      saving.value = false;
    }
  };

  const deleteItem = async (id: number): Promise<boolean> => {
    try {
      const res = await fetch(`/api/items/${id}`, {
        method: "DELETE",
        headers: authHeaders(false),
      });
      if (!res.ok && res.status !== 204) throw new Error("ลบไม่สำเร็จ");
      items.value = items.value.filter((i) => i.id !== id);
      return true;
    } catch (e: any) {
      error.value = e?.message || "ลบไม่สำเร็จ";
      return false;
    }
  };

  const updateRedemptionStatus = async (
    id: number,
    status: "completed" | "rejected",
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/items/admin/redemptions/${id}/status`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "อัปเดตไม่สำเร็จ");
      }
      redemptions.value = redemptions.value.filter((r) => r.id !== id);
      return true;
    } catch (e: any) {
      error.value = e?.message || "อัปเดตไม่สำเร็จ";
      return false;
    }
  };

  return {
    items,
    redemptions,
    loading,
    saving,
    error,
    fetchItems,
    fetchRedemptions,
    uploadImage,
    saveItem,
    deleteItem,
    updateRedemptionStatus,
  };
}
