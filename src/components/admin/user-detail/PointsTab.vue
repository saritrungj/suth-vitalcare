<script setup lang="ts">
import { ref, watch } from "vue";
import { Save, Loader2, Coins } from "lucide-vue-next";
const props = defineProps<{ ctx: any }>();

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

const save = () =>
  props.ctx.savePoints(
    Math.max(0, points.value),
    Math.max(0, totalScore.value),
  );
</script>

<template>
  <div class="max-w-lg">
    <div class="flex items-center gap-2 mb-6 text-slate-500">
      <Coins :size="18" class="text-orange-500" />
      <span class="text-sm font-bold"
        >ปรับคะแนนโดยตรง (ค่าปัจจุบันจะถูกเขียนทับ)</span
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
      @click="save"
      :disabled="ctx.submitting.value"
      class="mt-6 bg-orange-500 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-orange-600 disabled:opacity-50"
    >
      <Loader2 v-if="ctx.submitting.value" :size="18" class="animate-spin" />
      <Save v-else :size="18" /> บันทึกคะแนน
    </button>
  </div>
</template>
