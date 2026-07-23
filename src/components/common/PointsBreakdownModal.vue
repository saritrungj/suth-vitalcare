<script setup lang="ts">
import { ref, watch } from "vue";
import { X, ChevronDown, Loader2 } from "lucide-vue-next";
import { authStore } from "../../store/auth";

const props = defineProps<{
  open: boolean;
  userId: number | string | null;
  title?: string;
}>();
defineEmits<{ (e: "close"): void }>();

const API = import.meta.env.VITE_API_URL || "/api";
const loading = ref(false);
const total = ref(0);
const activities = ref<any[]>([]);
const expanded = ref<Record<number, boolean>>({});

const toggle = (id: number) => {
  expanded.value[id] = !expanded.value[id];
};

const fmtDate = (d: string) =>
  d
    ? new Date(d).toLocaleDateString("th-TH", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      })
    : "—";

const load = async () => {
  if (!props.userId) return;
  loading.value = true;
  try {
    const r = await fetch(
      `${API}/stats/user/${props.userId}/activity-scores?detail=1`,
      { headers: { "x-user-id": String(authStore.user?.id || "") } },
    );
    if (r.ok) {
      const d = await r.json();
      total.value = d.total || 0;
      activities.value = d.activities || [];
    }
  } catch {
    /* silent */
  } finally {
    loading.value = false;
  }
};

watch(
  () => [props.open, props.userId],
  ([isOpen]) => {
    if (isOpen) load();
  },
  { immediate: true },
);
</script>

<template>
  <transition name="pb-fade">
    <div
      v-if="open"
      class="fixed inset-0 z-[300] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 font-sarabun"
      @click.self="$emit('close')"
    >
      <div
        class="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
      >
        <header
          class="flex items-center justify-between px-6 py-4 border-b border-slate-100"
        >
          <h3 class="font-bold text-slate-900">
            {{ title || "ที่มาของคะแนน" }}
          </h3>
          <button
            @click="$emit('close')"
            class="p-2 text-slate-400 hover:text-slate-700 rounded-full"
          >
            <X :size="20" />
          </button>
        </header>

        <div class="px-6 py-4 border-b border-slate-100">
          <p class="text-xs font-bold text-slate-400">คะแนนรวมจากกิจกรรม</p>
          <p class="text-3xl font-black text-orange-600">
            {{ total.toLocaleString() }}
          </p>
          <p class="text-[11px] text-slate-400 mt-1">
            = ผลรวมของ (คะแนนภารกิจ + โบนัส streak + คะแนนที่ปรับ) ทุกกิจกรรม
          </p>
        </div>

        <div class="flex-1 overflow-y-auto px-6 py-4">
          <div v-if="loading" class="py-10 flex justify-center text-slate-400">
            <Loader2 :size="28" class="animate-spin" />
          </div>
          <div
            v-else-if="activities.length === 0"
            class="text-slate-400 text-sm py-8 text-center"
          >
            ยังไม่มีข้อมูลคะแนน
          </div>
          <div v-else class="flex flex-col gap-3">
            <div
              v-for="a in activities"
              :key="a.event_id"
              class="border border-slate-100 rounded-2xl overflow-hidden"
            >
              <button
                @click="toggle(a.event_id)"
                class="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-slate-50"
              >
                <div class="min-w-0">
                  <p class="text-sm font-bold text-slate-700 truncate">
                    {{ a.title }}
                  </p>
                  <p class="text-xs text-slate-400">
                    ภารกิจ {{ a.base_points }} + streak {{ a.streak_bonus }} +
                    ปรับ {{ a.adjustment }}
                  </p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-sm font-black text-slate-900">{{
                    a.score.toLocaleString()
                  }}</span>
                  <ChevronDown
                    :size="16"
                    class="text-slate-400 transition-transform"
                    :class="{ 'rotate-180': expanded[a.event_id] }"
                  />
                </div>
              </button>

              <div
                v-if="expanded[a.event_id]"
                class="px-3 pb-3 border-t border-slate-100 pt-3 flex flex-col gap-3"
              >
                <div>
                  <p class="text-[11px] font-bold text-slate-400 mb-1">
                    ภารกิจที่อนุมัติ ({{ (a.missions || []).length }}) — รวม
                    {{ a.base_points }} คะแนน
                  </p>
                  <div
                    v-for="m in a.missions || []"
                    :key="m.submission_id"
                    class="flex justify-between text-xs text-slate-600 py-0.5"
                  >
                    <span class="truncate mr-2"
                      >{{ m.task_name }} · {{ fmtDate(m.date) }}</span
                    >
                    <span class="font-bold shrink-0">+{{ m.points }}</span>
                  </div>
                  <p
                    v-if="(a.missions || []).length === 0"
                    class="text-xs text-slate-300 italic"
                  >
                    ไม่มี
                  </p>
                </div>

                <div>
                  <p class="text-[11px] font-bold text-slate-400 mb-1">
                    โบนัส streak — ต่อเนื่อง {{ a.streak }} วัน →
                    {{ a.streak_bonus }} คะแนน
                  </p>
                </div>

                <div>
                  <p class="text-[11px] font-bold text-slate-400 mb-1">
                    คะแนนที่ปรับโดยแอดมิน ({{ (a.adjustments || []).length }}) —
                    รวม {{ a.adjustment }} คะแนน
                  </p>
                  <div
                    v-for="adj in a.adjustments || []"
                    :key="adj.id"
                    class="flex justify-between text-xs text-slate-600 py-0.5"
                  >
                    <span class="truncate mr-2"
                      >{{ adj.reason || "ไม่ระบุเหตุผล" }} ·
                      {{ fmtDate(adj.created_at) }}</span
                    >
                    <span class="font-bold shrink-0"
                      >{{ adj.points > 0 ? "+" : "" }}{{ adj.points }}</span
                    >
                  </div>
                  <p
                    v-if="(a.adjustments || []).length === 0"
                    class="text-xs text-slate-300 italic"
                  >
                    ไม่มี
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.pb-fade-enter-active,
.pb-fade-leave-active {
  transition: opacity 0.2s ease;
}
.pb-fade-enter-from,
.pb-fade-leave-to {
  opacity: 0;
}
</style>
