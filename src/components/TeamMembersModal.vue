<script setup lang="ts">
import { computed } from "vue";
import { X, Users, Loader2 } from "lucide-vue-next";
import { safeImageUrl } from "../lib/safeUrl";
import { langStore } from "../store/lang";

const props = defineProps<{
  open: boolean;
  team: any;
  members: any[];
  loading?: boolean;
  isPoints?: boolean;
  unitShort?: string;
}>();
defineEmits<{ (e: "close"): void }>();

const teamImage = computed(() => safeImageUrl(props.team?.image));
const teamInitial = computed(() =>
  (props.team?.name?.[0] ?? "?").toString().toUpperCase(),
);
// The headline total must use the same metric the leaderboard ranked by,
// otherwise it would disagree with the row the user just tapped.
const teamTotal = computed(() =>
  props.isPoints
    ? Number(props.team?.total_points) || 0
    : Number(props.team?.total_unit_value) || 0,
);
// On unit-metric activities the points sum is a separate, still-useful number.
const teamPoints = computed(() => Number(props.team?.total_points) || 0);
const unitLabel = computed(() =>
  props.isPoints ? langStore.t("points") : props.unitShort || "",
);
const fmt = (n: number) => Number(n || 0).toLocaleString();
const memberImage = (m: any) => safeImageUrl(m?.picture_url);
const memberInitial = (m: any) =>
  (m?.name?.[0] ?? "?").toString().toUpperCase();
// Share of the team total, used for the contribution bar.
const share = (m: any) => {
  const total = teamTotal.value;
  if (total <= 0) return 0;
  return Math.min(100, (Number(m?.score || 0) / total) * 100);
};
</script>

<template>
  <Teleport to="body">
    <Transition name="tm-fade">
      <div v-if="open" class="tm-overlay" @click.self="$emit('close')">
        <div
          class="tm-sheet"
          role="dialog"
          aria-modal="true"
          :aria-label="team?.name"
        >
          <header class="tm-header">
            <div class="tm-team">
              <div class="tm-team-avatar">
                <img v-if="teamImage" :src="teamImage" alt="" />
                <span v-else>{{ teamInitial }}</span>
              </div>
              <div class="tm-team-info">
                <h3 class="tm-team-name">{{ team?.name || "—" }}</h3>
                <p class="tm-team-meta">
                  <Users :size="13" />
                  {{ members.length }} {{ langStore.t("team_members_unit") }}
                </p>
              </div>
            </div>
            <button
              class="tm-close"
              @click="$emit('close')"
              :aria-label="langStore.t('close')"
            >
              <X :size="18" />
            </button>
          </header>

          <div class="tm-total">
            <span class="tm-total-label">{{
              langStore.t("team_total_score")
            }}</span>
            <span class="tm-total-val">
              {{ fmt(teamTotal) }}
              <small>{{ unitLabel }}</small>
            </span>
            <p v-if="!isPoints" class="tm-total-sub">
              {{ fmt(teamPoints) }} {{ langStore.t("points") }}
            </p>
            <p class="tm-total-hint">{{ langStore.t("team_total_hint") }}</p>
          </div>

          <div class="tm-body">
            <div v-if="loading" class="tm-loading">
              <Loader2 :size="22" class="tm-spin" />
            </div>
            <p v-else-if="!members.length" class="tm-empty">
              {{ langStore.t("team_no_members") }}
            </p>
            <ol v-else class="tm-list">
              <li v-for="(m, i) in members" :key="m.id" class="tm-item">
                <span class="tm-item-rank">{{ i + 1 }}</span>
                <div class="tm-item-avatar">
                  <img
                    v-if="memberImage(m)"
                    :src="memberImage(m)"
                    alt=""
                    loading="lazy"
                  />
                  <span v-else>{{ memberInitial(m) }}</span>
                </div>
                <div class="tm-item-main">
                  <div class="tm-item-name-line">
                    <span class="tm-item-name">{{ m.name }}</span>
                    <span v-if="m.streak >= 1" class="tm-item-streak">
                      <img
                        class="tm-streak-icon"
                        src="/Streak%20fire.svg"
                        alt=""
                      />{{ m.streak }}
                    </span>
                  </div>
                  <div class="tm-item-track">
                    <div
                      class="tm-item-fill"
                      :style="{ width: share(m) + '%' }"
                    ></div>
                  </div>
                </div>
                <div class="tm-item-score">
                  <span class="tm-item-score-val">{{ fmt(m.score) }}</span>
                  <span class="tm-item-score-unit">{{ unitLabel }}</span>
                  <span v-if="!isPoints" class="tm-item-score-pts">
                    {{ fmt(m.points) }} {{ langStore.t("points") }}
                  </span>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.tm-overlay {
  position: fixed;
  inset: 0;
  z-index: 10050;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0;
}
@media (min-width: 640px) {
  .tm-overlay {
    align-items: center;
    padding: 24px;
  }
}

.tm-sheet {
  width: 100%;
  max-width: 480px;
  background: #fff;
  border-radius: 24px 24px 0 0;
  display: flex;
  flex-direction: column;
  max-height: 88vh;
  max-height: 88dvh;
  overflow: hidden;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
@media (min-width: 640px) {
  .tm-sheet {
    border-radius: 24px;
    max-height: 80vh;
  }
}

.tm-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 20px 14px;
  border-bottom: 1px solid #f1f5f9;
}

.tm-team {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.tm-team-avatar {
  width: 48px;
  height: 48px;
  min-width: 48px;
  border-radius: 14px;
  overflow: hidden;
  background: #e2e8f0;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 1.1rem;
  flex-shrink: 0;
}
.tm-team-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tm-team-info {
  min-width: 0;
}
.tm-team-name {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tm-team-meta {
  margin: 2px 0 0;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.78rem;
  color: #64748b;
  font-weight: 600;
}

.tm-close {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: #94a3b8;
  border-radius: 50%;
  cursor: pointer;
}
.tm-close:hover {
  background: #f1f5f9;
  color: #475569;
}

.tm-total {
  padding: 16px 20px;
  background: #fff7ed;
  border-bottom: 1px solid #fed7aa;
}
.tm-total-label {
  display: block;
  font-size: 0.72rem;
  font-weight: 700;
  color: #9a3412;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.tm-total-val {
  display: block;
  font-size: 1.9rem;
  font-weight: 900;
  color: #ff6a00;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}
.tm-total-val small {
  font-size: 0.85rem;
  font-weight: 700;
  color: #c2410c;
}
.tm-total-sub {
  margin: 2px 0 0;
  font-size: 0.85rem;
  font-weight: 800;
  color: #c2410c;
  font-variant-numeric: tabular-nums;
}
.tm-total-hint {
  margin: 4px 0 0;
  font-size: 0.72rem;
  color: #9a3412;
  opacity: 0.85;
}

.tm-body {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 8px 12px 20px;
}

.tm-loading,
.tm-empty {
  padding: 40px 20px;
  text-align: center;
  color: #94a3b8;
  font-size: 0.9rem;
}
.tm-spin {
  animation: tm-spin 0.9s linear infinite;
}
@keyframes tm-spin {
  to {
    transform: rotate(360deg);
  }
}

.tm-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tm-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 8px;
  border-radius: 12px;
}
.tm-item:hover {
  background: #f8fafc;
}

.tm-item-rank {
  width: 20px;
  flex-shrink: 0;
  text-align: center;
  font-size: 0.78rem;
  font-weight: 700;
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
}

.tm-item-avatar {
  width: 36px;
  height: 36px;
  min-width: 36px;
  border-radius: 50%;
  overflow: hidden;
  background: #e2e8f0;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.85rem;
  flex-shrink: 0;
}
.tm-item-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tm-item-main {
  flex: 1;
  min-width: 0;
}
.tm-item-name-line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.tm-item-name {
  font-size: 0.88rem;
  font-weight: 600;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tm-item-streak {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  font-size: 0.66rem;
  font-weight: 700;
  color: #ea580c;
  background: #fff0e6;
  border: 1px solid #fed7aa;
  border-radius: 99px;
  padding: 1px 6px;
}
.tm-streak-icon {
  width: 34px;
  height: 34px;
  object-fit: contain;
}

.tm-item-track {
  height: 4px;
  background: #f1f5f9;
  border-radius: 99px;
  overflow: hidden;
  margin-top: 5px;
}
.tm-item-fill {
  height: 100%;
  background: #ff6a00;
  border-radius: 99px;
  transition: width 0.3s ease;
}

.tm-item-score {
  flex-shrink: 0;
  text-align: right;
  min-width: 52px;
}
.tm-item-score-val {
  display: block;
  font-size: 0.92rem;
  font-weight: 800;
  color: #1e293b;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}
.tm-item-score-unit {
  display: block;
  font-size: 0.62rem;
  font-weight: 600;
  color: #94a3b8;
}
.tm-item-score-pts {
  display: block;
  margin-top: 2px;
  font-size: 0.62rem;
  font-weight: 700;
  color: #ff6a00;
  font-variant-numeric: tabular-nums;
}

/* Transitions */
.tm-fade-enter-active,
.tm-fade-leave-active {
  transition: opacity 0.22s ease;
}
.tm-fade-enter-active .tm-sheet,
.tm-fade-leave-active .tm-sheet {
  transition: transform 0.26s cubic-bezier(0.32, 0.72, 0, 1);
}
.tm-fade-enter-from,
.tm-fade-leave-to {
  opacity: 0;
}
.tm-fade-enter-from .tm-sheet,
.tm-fade-leave-to .tm-sheet {
  transform: translateY(24px);
}

@media (prefers-reduced-motion: reduce) {
  .tm-fade-enter-active,
  .tm-fade-leave-active,
  .tm-fade-enter-active .tm-sheet,
  .tm-fade-leave-active .tm-sheet,
  .tm-item-fill {
    transition: none;
  }
}
</style>
