<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Package,
  Inbox,
  Check,
  X,
  Coins,
  ImageIcon,
  Upload,
} from "lucide-vue-next";
import { uiStore } from "../../store/ui";
import { showConfirm } from "../../lib/swal";
import {
  useAdminShop,
  emptyItem,
  type ShopItem,
} from "../../composables/useAdminShop";

const {
  items,
  redemptions,
  loading,
  saving,
  fetchItems,
  fetchRedemptions,
  uploadImage,
  saveItem,
  deleteItem,
  updateRedemptionStatus,
} = useAdminShop();

const tab = ref<"items" | "redemptions">("items");
const showForm = ref(false);
const draft = ref<ShopItem>(emptyItem());
const uploading = ref(false);

onMounted(() => {
  fetchItems();
  fetchRedemptions("pending");
});

const openCreate = () => {
  draft.value = emptyItem();
  showForm.value = true;
};
const openEdit = (item: ShopItem) => {
  draft.value = { ...item };
  showForm.value = true;
};

const onUpload = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  uploading.value = true;
  try {
    draft.value.image_url = await uploadImage(file);
  } catch (err: any) {
    uiStore.toast("error", "อัปโหลดล้มเหลว", err?.message || "");
  } finally {
    uploading.value = false;
  }
};

const onSave = async () => {
  if (!draft.value.name.trim()) {
    uiStore.toast("warning", "กรอกข้อมูล", "กรุณาระบุชื่อของรางวัล");
    return;
  }
  const ok = await saveItem(draft.value);
  if (ok) {
    uiStore.toast("success", "บันทึกแล้ว", "อัปเดตของรางวัลเรียบร้อย");
    showForm.value = false;
  } else {
    uiStore.toast("error", "ผิดพลาด", "บันทึกไม่สำเร็จ");
  }
};

const onDelete = async (item: ShopItem) => {
  const ok = await showConfirm(
    `ลบ "${item.name}"?`,
    "การลบนี้ไม่สามารถย้อนกลับได้",
    "ลบ",
    "warning",
    true,
  );
  if (!ok) return;
  if (await deleteItem(item.id!)) uiStore.toast("success", "ลบแล้ว", "");
};

const onFulfill = async (id: number, status: "completed" | "rejected") => {
  const ok = await updateRedemptionStatus(id, status);
  if (ok)
    uiStore.toast(
      "success",
      status === "completed" ? "ยืนยันแล้ว" : "ปฏิเสธแล้ว",
      status === "rejected" ? "คืนแต้มให้ผู้ใช้เรียบร้อย" : "",
    );
};

const switchTab = (t: "items" | "redemptions") => {
  tab.value = t;
  if (t === "redemptions") fetchRedemptions("pending");
};
</script>

<template>
  <div class="shop-admin">
    <header class="sa-head">
      <h2 class="sa-title">จัดการร้านแลกของรางวัล</h2>
      <button v-if="tab === 'items'" class="btn-primary" @click="openCreate">
        <Plus :size="16" /> เพิ่มของรางวัล
      </button>
    </header>

    <div class="sa-tabs">
      <button :class="{ active: tab === 'items' }" @click="switchTab('items')">
        <Package :size="15" /> ของรางวัล
      </button>
      <button
        :class="{ active: tab === 'redemptions' }"
        @click="switchTab('redemptions')"
      >
        <Inbox :size="15" /> คำขอแลก
        <span v-if="redemptions.length" class="badge">{{
          redemptions.length
        }}</span>
      </button>
    </div>

    <!-- Items -->
    <div v-if="tab === 'items'">
      <div v-if="loading" class="state-row">
        <Loader2 :size="20" class="spin" /> กำลังโหลด...
      </div>
      <table v-else class="sa-table">
        <thead>
          <tr>
            <th>รูป</th>
            <th>ชื่อ</th>
            <th>แต้ม</th>
            <th>คงเหลือ</th>
            <th>สถานะ</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="it in items" :key="it.id">
            <td>
              <div class="thumb">
                <img v-if="it.image_url" :src="it.image_url" :alt="it.name" />
                <ImageIcon v-else :size="18" class="muted" />
              </div>
            </td>
            <td class="strong">{{ it.name }}</td>
            <td><Coins :size="13" /> {{ it.points_required }}</td>
            <td>{{ it.stock }}</td>
            <td>
              <span class="chip" :class="it.is_active ? 'on' : 'off'">
                {{ it.is_active ? "เปิด" : "ปิด" }}
              </span>
            </td>
            <td class="actions">
              <button class="icon-btn" @click="openEdit(it)">
                <Pencil :size="15" />
              </button>
              <button class="icon-btn danger" @click="onDelete(it)">
                <Trash2 :size="15" />
              </button>
            </td>
          </tr>
          <tr v-if="!items.length">
            <td colspan="6" class="empty">ยังไม่มีของรางวัล</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Redemptions queue -->
    <div v-else>
      <div v-if="!redemptions.length" class="state-row">
        <Inbox :size="38" class="muted" />
        <p>ไม่มีคำขอแลกที่รอดำเนินการ</p>
      </div>
      <ul v-else class="req-list">
        <li v-for="r in redemptions" :key="r.id" class="req-row">
          <div class="thumb">
            <img v-if="r.image_url" :src="r.image_url" :alt="r.reward_name" />
            <ImageIcon v-else :size="18" class="muted" />
          </div>
          <div class="req-info">
            <div class="strong">{{ r.reward_name }}</div>
            <div class="req-sub">
              {{ r.fname_th }} {{ r.lname_th }} · <Coins :size="12" />
              {{ r.points_required }}
            </div>
          </div>
          <div class="req-actions">
            <button class="btn-ok" @click="onFulfill(r.id, 'completed')">
              <Check :size="15" /> ยืนยัน
            </button>
            <button class="btn-no" @click="onFulfill(r.id, 'rejected')">
              <X :size="15" /> ปฏิเสธ
            </button>
          </div>
        </li>
      </ul>
    </div>

    <!-- Item form modal -->
    <div v-if="showForm" class="modal-overlay" @click.self="showForm = false">
      <div class="modal">
        <h3 class="modal-title">{{ draft.id ? "แก้ไข" : "เพิ่ม" }}ของรางวัล</h3>
        <div class="form-grid">
          <label class="f">
            <span>ชื่อ</span>
            <input v-model="draft.name" type="text" />
          </label>
          <label class="f">
            <span>รายละเอียด</span>
            <textarea v-model="draft.description" rows="2" />
          </label>
          <div class="f-row">
            <label class="f">
              <span>แต้มที่ใช้</span>
              <input
                v-model.number="draft.points_required"
                type="number"
                min="0"
              />
            </label>
            <label class="f">
              <span>จำนวนคงเหลือ</span>
              <input v-model.number="draft.stock" type="number" min="0" />
            </label>
          </div>
          <label class="f">
            <span>รูปภาพ</span>
            <div class="upload-row">
              <div class="thumb lg">
                <img v-if="draft.image_url" :src="draft.image_url" alt="" />
                <ImageIcon v-else :size="22" class="muted" />
              </div>
              <label class="upload-btn">
                <Loader2 v-if="uploading" :size="15" class="spin" />
                <Upload v-else :size="15" />
                อัปโหลด
                <input type="file" accept="image/*" hidden @change="onUpload" />
              </label>
            </div>
          </label>
          <label class="f-check">
            <input v-model="draft.is_active" type="checkbox" />
            <span>เปิดให้แลก</span>
          </label>
        </div>
        <div class="modal-actions">
          <button class="btn-ghost" @click="showForm = false">ยกเลิก</button>
          <button class="btn-primary" :disabled="saving" @click="onSave">
            <Loader2 v-if="saving" :size="15" class="spin" />
            บันทึก
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shop-admin {
  padding: 16px;
  max-width: 1000px;
  margin: 0 auto;
}
.sa-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.sa-title {
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--color-text-main);
  margin: 0;
}
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  border: none;
  border-radius: 10px;
  background: var(--color-primary);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}
.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
}
.btn-primary:disabled {
  opacity: 0.6;
}
.sa-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.sa-tabs button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1.5px solid var(--color-border);
  border-radius: 999px;
  background: transparent;
  color: var(--vp-muted);
  font-weight: 700;
  font-size: 0.82rem;
  cursor: pointer;
}
.sa-tabs button.active {
  color: var(--color-primary-dark);
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}
.badge {
  background: #ef4444;
  color: #fff;
  border-radius: 999px;
  font-size: 0.68rem;
  padding: 1px 7px;
  font-weight: 700;
}
.sa-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
}
.sa-table th,
.sa-table td {
  text-align: left;
  padding: 10px 12px;
  font-size: 0.85rem;
  border-bottom: 1px solid var(--color-border);
}
.sa-table th {
  background: var(--color-bg);
  color: var(--vp-muted);
  font-weight: 700;
}
.strong {
  font-weight: 700;
  color: var(--color-text-main);
}
.thumb {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
}
.thumb.lg {
  width: 64px;
  height: 64px;
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.muted {
  color: var(--color-border);
}
.chip {
  font-size: 0.74rem;
  font-weight: 700;
  padding: 2px 10px;
  border-radius: 999px;
}
.chip.on {
  background: var(--color-primary-light);
  color: var(--color-primary-dark);
}
.chip.off {
  background: #f1f5f9;
  color: #94a3b8;
}
.actions {
  display: flex;
  gap: 6px;
}
.icon-btn {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  color: var(--vp-muted);
}
.icon-btn.danger {
  color: #ef4444;
}
.icon-btn:hover {
  background: var(--color-bg);
}
.empty,
.state-row {
  text-align: center;
  color: var(--vp-muted);
  padding: 30px;
}
.state-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.req-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.req-row {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 10px 14px;
}
.req-info {
  flex: 1;
  min-width: 0;
}
.req-sub {
  font-size: 0.78rem;
  color: var(--vp-muted);
  display: flex;
  align-items: center;
  gap: 4px;
}
.req-actions {
  display: flex;
  gap: 8px;
}
.btn-ok,
.btn-no {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 7px 12px;
  border-radius: 8px;
  border: none;
  font-weight: 700;
  font-size: 0.8rem;
  cursor: pointer;
}
.btn-ok {
  background: var(--color-primary);
  color: #fff;
}
.btn-no {
  background: #fef2f2;
  color: #ef4444;
}
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 400;
  background: rgba(15, 23, 42, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.modal {
  background: var(--color-surface);
  border-radius: 18px;
  padding: 22px;
  width: 100%;
  max-width: 460px;
  max-height: 90vh;
  overflow-y: auto;
}
.modal-title {
  font-size: 1.1rem;
  font-weight: 800;
  margin: 0 0 16px;
  color: var(--color-text-main);
}
.form-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.f {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.82rem;
}
.f span {
  font-weight: 600;
  color: var(--vp-muted);
}
.f input,
.f textarea {
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  padding: 9px 10px;
  font: inherit;
  width: 100%;
}
.f input:focus,
.f textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}
.f-row {
  display: flex;
  gap: 10px;
}
.f-row .f {
  flex: 1;
}
.f-check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--vp-text);
}
.upload-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.8rem;
  color: var(--vp-muted);
}
.upload-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary-dark);
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}
.btn-ghost {
  padding: 9px 16px;
  border: 1.5px solid var(--color-border);
  border-radius: 10px;
  background: transparent;
  font-weight: 700;
  cursor: pointer;
  color: var(--vp-muted);
}
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
