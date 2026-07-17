<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  Coins,
  Package,
  History,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  ImageIcon,
} from "lucide-vue-next";
import { useShop, type Reward } from "../composables/useShop";
import { showConfirm } from "../lib/swal";
import { uiStore } from "../store/ui";

const {
  activeRewards,
  history,
  loading,
  redeeming,
  balance,
  fetchRewards,
  fetchHistory,
  redeem,
} = useShop();

const tab = ref<"shop" | "history">("shop");

onMounted(() => {
  fetchRewards();
  fetchHistory();
});

const onRedeem = async (reward: Reward) => {
  if (balance.value < reward.points_required) {
    uiStore.toast("warning", "แต้มไม่พอ", "คุณมีแต้มไม่เพียงพอสำหรับรายการนี้");
    return;
  }
  const ok = await showConfirm(
    `แลก "${reward.name}"?`,
    `ใช้ ${reward.points_required.toLocaleString()} แต้ม`,
    "แลกเลย",
    "question",
  );
  if (!ok) return;
  const res = await redeem(reward);
  if (res.ok) {
    uiStore.toast("success", "แลกสำเร็จ", "รอแอดมินยืนยันการมอบของรางวัล");
    tab.value = "history";
  } else {
    uiStore.toast("error", "ไม่สำเร็จ", res.error);
  }
};

const statusMeta = (s: string) => {
  if (s === "completed")
    return { label: "ได้รับแล้ว", icon: CheckCircle2, cls: "ok" };
  if (s === "rejected" || s === "cancelled")
    return { label: "ถูกปฏิเสธ (คืนแต้ม)", icon: XCircle, cls: "bad" };
  return { label: "รอดำเนินการ", icon: Clock, cls: "wait" };
};
</script>

<template>
  <div class="shop-page">
    <header class="shop-hero">
      <div>
        <h1 class="shop-title">ร้านแลกของรางวัล</h1>
        <p class="shop-desc">ใช้แต้มสะสมแลกของรางวัลสุดพิเศษ</p>
      </div>
      <div class="balance-chip">
        <Coins :size="20" />
        <span class="balance-num">{{ balance.toLocaleString() }}</span>
        <span class="balance-unit">แต้ม</span>
      </div>
    </header>

    <div class="shop-tabs">
      <button :class="{ active: tab === 'shop' }" @click="tab = 'shop'">
        <Package :size="16" /> ของรางวัล
      </button>
      <button :class="{ active: tab === 'history' }" @click="tab = 'history'">
        <History :size="16" /> ประวัติการแลก
      </button>
    </div>

    <!-- Shop grid -->
    <div v-if="tab === 'shop'">
      <div v-if="loading" class="state-row">
        <Loader2 :size="22" class="spin" /> กำลังโหลด...
      </div>
      <div v-else-if="activeRewards.length === 0" class="state-row">
        <Package :size="40" class="muted-icon" />
        <p>ยังไม่มีของรางวัลให้แลกในขณะนี้</p>
      </div>
      <div v-else class="reward-grid">
        <article v-for="r in activeRewards" :key="r.id" class="reward-card">
          <div class="reward-img">
            <img
              v-if="r.image_url"
              :src="r.image_url"
              :alt="r.name"
              loading="lazy"
            />
            <ImageIcon v-else :size="34" class="muted-icon" />
            <span v-if="r.stock <= 0" class="sold-out">หมด</span>
          </div>
          <div class="reward-body">
            <h3 class="reward-name">{{ r.name }}</h3>
            <p class="reward-desc">{{ r.description }}</p>
            <div class="reward-foot">
              <span class="reward-cost">
                <Coins :size="15" /> {{ r.points_required.toLocaleString() }}
              </span>
              <button
                class="redeem-btn"
                :disabled="
                  r.stock <= 0 ||
                  redeeming === r.id ||
                  balance < r.points_required
                "
                @click="onRedeem(r)"
              >
                <Loader2 v-if="redeeming === r.id" :size="15" class="spin" />
                <span v-else>แลก</span>
              </button>
            </div>
          </div>
        </article>
      </div>
    </div>

    <!-- History -->
    <div v-else>
      <div v-if="history.length === 0" class="state-row">
        <History :size="40" class="muted-icon" />
        <p>ยังไม่มีประวัติการแลก</p>
      </div>
      <ul v-else class="history-list">
        <li v-for="h in history" :key="h.id" class="history-row">
          <div class="history-thumb">
            <img
              v-if="h.image_url"
              :src="h.image_url"
              :alt="h.name"
              loading="lazy"
            />
            <ImageIcon v-else :size="20" class="muted-icon" />
          </div>
          <div class="history-info">
            <div class="history-name">{{ h.name }}</div>
            <div class="history-cost">
              <Coins :size="13" /> {{ h.reward_points?.toLocaleString() }} แต้ม
            </div>
          </div>
          <div class="history-status" :class="statusMeta(h.status).cls">
            <component :is="statusMeta(h.status).icon" :size="15" />
            {{ statusMeta(h.status).label }}
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.shop-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px;
}
.shop-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}
.shop-title {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--color-text-main);
  margin: 0;
}
.shop-desc {
  color: var(--vp-muted);
  margin: 4px 0 0;
  font-size: 0.9rem;
}
.balance-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: 999px;
  background: var(--color-primary-light);
  color: var(--color-primary-dark);
  font-weight: 700;
}
.balance-num {
  font-size: 1.15rem;
}
.balance-unit {
  font-size: 0.8rem;
}
.shop-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
}
.shop-tabs button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  border: 1.5px solid var(--color-border);
  border-radius: 999px;
  background: transparent;
  color: var(--vp-muted);
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  transition:
    color 0.2s ease,
    border-color 0.2s ease,
    background-color 0.2s ease;
}
.shop-tabs button.active {
  color: var(--color-primary-dark);
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}
.reward-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}
.reward-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: box-shadow 0.2s ease;
}
.reward-card:hover {
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
}
.reward-img {
  position: relative;
  aspect-ratio: 4 / 3;
  background: var(--color-primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.reward-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.sold-out {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(15, 23, 42, 0.78);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
}
.reward-body {
  padding: 12px 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}
.reward-name {
  font-size: 0.98rem;
  font-weight: 700;
  color: var(--color-text-main);
  margin: 0;
}
.reward-desc {
  font-size: 0.8rem;
  color: var(--vp-muted);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.reward-foot {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
}
.reward-cost {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 800;
  color: var(--color-primary-dark);
}
.redeem-btn {
  min-width: 64px;
  padding: 8px 16px;
  border: none;
  border-radius: 10px;
  background: var(--color-primary);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
}
.redeem-btn:hover:not(:disabled) {
  background: var(--color-primary-dark);
}
.redeem-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.history-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.history-row {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 10px 14px;
}
.history-thumb {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.history-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.history-info {
  flex: 1;
  min-width: 0;
}
.history-name {
  font-weight: 700;
  color: var(--color-text-main);
}
.history-cost {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  color: var(--vp-muted);
}
.history-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
}
.history-status.ok {
  color: #16a34a;
}
.history-status.wait {
  color: #d97706;
}
.history-status.bad {
  color: #ef4444;
}
.state-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--vp-muted);
  padding: 50px 0;
}
.muted-icon {
  color: var(--color-border);
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
