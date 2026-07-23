<script setup lang="ts">
import { ref, watch, reactive } from "vue";
import { useRoute } from "vue-router";
import { Save, Loader2, Coins, Plus } from "lucide-vue-next";
import PointsBreakdownModal from "../../common/PointsBreakdownModal.vue";
const props = defineProps<{ ctx: any }>();
const route = useRoute();
const showBreakdown = ref(false);

// Global (shop/legacy) points override — unchanged behavior.
const points = ref(0);
const totalScore = ref(0);
watch(
  () => props.ctx.user.value,
  (u) => {
    points.value = Number(u?.points || 0);
    totalScore.value = Number(u?.total_score || 0);
  },
  { immediate: true },
);
const saveGlobal = () =>
  props.ctx.savePoints(
    Math.max(0, points.value),
    Math.max(0, totalScore.value),
  );

// Per-activity adjustment inputs, keyed by event_id.
const adjInput = reactive<
  Record<number, { delta: number | null; reason: string }>
>({});
const ensureRow = (id: number) => {
  if (!adjInput[id]) adjInput[id] = { delta: null, reason: "" };
  return adjInput[id];
};
const applyAdjustment = async (eventId: number) => {
  const row = ensureRow(eventId);
  const delta = Number(row.delta);
  if (!delta) return;
  await props.ctx.addAdjustment(eventId, delta, row.reason || "");
  row.delta = null;
  row.reason = "";
};
</script>

<template>
  <div class="max-w-2xl flex flex-col gap-10">
    <!-- Per-activity scores + adjustment -->
    <div>
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2 text-slate-500">
          <Coins :size="18" class="text-orange-500" />
          <span class="text-sm font-bold">คะแนนรายกิจกรรม</span>
        </div>
        <button
          @click="showBreakdown = true"
          class="text-sm font-black text-orange-600 underline decoration-dotted underline-offset-4 hover:text-orange-700"
        >
          รวม {{ ctx.scoreTotal.value.toLocaleString() }} คะแนน
        </button>
      </div>

      <div v-if="ctx.activityScores.value.length" class="flex flex-col gap-3">
        <div
          v-for="a in ctx.activityScores.value"
          :key="a.event_id"
          class="border border-slate-100 rounded-2xl p-3"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-bold text-slate-700 truncate">{{
              a.title
            }}</span>
            <span class="text-sm font-black text-slate-900 shrink-0">{{
              a.score.toLocaleString()
            }}</span>
          </div>
          <div class="text-xs text-slate-400 mt-1">
            ภารกิจ {{ a.base_points }} · streak +{{ a.streak_bonus }} · ปรับ
            {{ a.adjustment }}
          </div>
          <div class="flex items-center gap-2 mt-3">
            <input
              v-model.number="ensureRow(a.event_id).delta"
              type="number"
              placeholder="+/- คะแนน"
              class="w-28 border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
            <input
              v-model="ensureRow(a.event_id).reason"
              placeholder="เหตุผล"
              class="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
            <button
              @click="applyAdjustment(a.event_id)"
              :disabled="ctx.submitting.value || !ensureRow(a.event_id).delta"
              class="bg-orange-500 text-white px-3 py-2 rounded-xl text-sm font-bold flex items-center gap-1 disabled:opacity-50 shrink-0"
            >
              <Loader2
                v-if="ctx.submitting.value"
                :size="14"
                class="animate-spin"
              />
              <Plus v-else :size="14" /> ปรับ
            </button>
          </div>
        </div>
      </div>
      <p v-else class="text-slate-400 text-sm">ยังไม่ได้เข้าร่วมกิจกรรม</p>
    </div>

    <!-- Global (shop/legacy) override -->
    <div>
      <div class="flex items-center gap-2 mb-4 text-slate-500">
        <Coins :size="18" class="text-slate-400" />
        <span class="text-sm font-bold"
          >คะแนนระบบ (ร้านค้า/รวมสะสม) — เขียนทับโดยตรง</span
        >
      </div>
      <div class="flex flex-col gap-4">
        <label class="flex flex-col gap-1">
          <span class="text-xs font-bold text-slate-500">คะแนน (points)</span>
          <input
            v-model.number="points"
            type="number"
            min="0"
            class="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-500"
          />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs font-bold text-slate-500"
            >คะแนนสะสม (total_score)</span
          >
          <input
            v-model.number="totalScore"
            type="number"
            min="0"
            class="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-500"
          />
        </label>
      </div>
      <button
        @click="saveGlobal"
        :disabled="ctx.submitting.value"
        class="mt-6 bg-slate-700 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-slate-800 disabled:opacity-50"
      >
        <Loader2 v-if="ctx.submitting.value" :size="18" class="animate-spin" />
        <Save v-else :size="18" /> บันทึกคะแนนระบบ
      </button>
    </div>
    <PointsBreakdownModal
      :open="showBreakdown"
      :user-id="Number(route.params.id)"
      @close="showBreakdown = false"
    />
  </div>
</template>
