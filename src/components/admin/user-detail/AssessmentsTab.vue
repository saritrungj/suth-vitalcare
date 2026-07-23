<script setup lang="ts">
import { ref, computed } from "vue";
import { Pencil, Save, X, Loader2 } from "lucide-vue-next";
import { authStore } from "../../../store/auth";
import { showSuccess, showError } from "../../../lib/swal";
import {
  sections,
  scoreSection,
  levelForSection,
  overallLevelFromSectionLevels,
} from "../../../lib/healthAssessment";
const props = defineProps<{ ctx: any }>();

const API = import.meta.env.VITE_API_URL || "/api";
const fmt = (d: string) =>
  d
    ? new Date(d).toLocaleDateString("th-TH", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      })
    : "—";
const testLabel = (t: string) =>
  t === "pre_test" ? "ก่อนเข้าร่วม" : t === "post_test" ? "หลังจบ" : t;

// ── Editor state ──────────────────────────────────────────────
const editingId = ref<number | null>(null);
const answers = ref<Record<string, string>>({});
const loadingAnswers = ref(false);
const saving = ref(false);

const liveSections = computed(() =>
  sections.map((s) => {
    const score = scoreSection(s, answers.value);
    const range = levelForSection(s, score);
    return { section: s, score, level: range.level, maxScore: s.maxScore };
  }),
);
const liveTotal = computed(() =>
  liveSections.value.reduce((t, s) => t + s.score, 0),
);
const liveOverall = computed(() =>
  overallLevelFromSectionLevels(liveSections.value.map((s) => s.level)),
);

const startEdit = async (a: any) => {
  editingId.value = a.id;
  answers.value = {};
  loadingAnswers.value = true;
  try {
    const r = await fetch(`${API}/health/assessments/${a.id}/answers`, {
      headers: { "x-user-id": String(authStore.user?.id || "") },
    });
    if (r.ok) {
      const rows = await r.json();
      // Stored answers key on question_text; match back to the definition.
      for (const row of rows) {
        for (const s of sections) {
          const q = s.questions.find((q) => q.text === row.question_text);
          if (q) {
            answers.value[q.id] = row.answer_text;
            break;
          }
        }
      }
    }
  } catch {
    /* silent */
  } finally {
    loadingAnswers.value = false;
  }
};
const cancelEdit = () => {
  editingId.value = null;
  answers.value = {};
};

const save = async () => {
  if (editingId.value == null) return;
  saving.value = true;
  try {
    const granularAnswers: any[] = [];
    for (const s of sections) {
      for (const q of s.questions) {
        const val = answers.value[q.id];
        if (!val) continue;
        const opt = q.options.find((o) => o.text === val);
        granularAnswers.push({
          question_text: q.text,
          answer_text: val,
          score: opt?.score || 0,
        });
      }
    }
    const r = await fetch(`${API}/health/assessments/${editingId.value}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": String(authStore.user?.id || ""),
      },
      body: JSON.stringify({
        totalScore: liveTotal.value,
        overallLevel: liveOverall.value,
        sectionScores: liveSections.value.map((s) => ({
          sectionId: s.section.id,
          score: s.score,
          level: s.level,
        })),
        granularAnswers,
      }),
    });
    if (!r.ok)
      throw new Error(
        (await r.json().catch(() => ({}))).error || "บันทึกไม่สำเร็จ",
      );
    showSuccess("บันทึกผลประเมินสำเร็จ");
    cancelEdit();
    await props.ctx.load();
  } catch (e: any) {
    showError(e.message);
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div class="flex flex-col gap-8 max-w-3xl">
    <!-- Editor -->
    <section
      v-if="editingId !== null"
      class="border border-orange-200 rounded-2xl p-4"
    >
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-black text-slate-700">แก้ไขผลประเมิน</h3>
        <div class="text-right">
          <p class="text-xs font-bold text-slate-400">คะแนนรวม</p>
          <p class="text-2xl font-black text-orange-600">
            {{ liveTotal }} <span class="text-sm">({{ liveOverall }})</span>
          </p>
        </div>
      </div>

      <div
        v-if="loadingAnswers"
        class="py-8 flex justify-center text-slate-400"
      >
        <Loader2 :size="24" class="animate-spin" />
      </div>

      <div v-else class="flex flex-col gap-6">
        <div
          v-for="ls in liveSections"
          :key="ls.section.id"
          class="border border-slate-100 rounded-2xl p-3"
        >
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-sm font-bold text-slate-700">
              {{ ls.section.label }}
            </h4>
            <span class="text-xs font-black text-slate-900 shrink-0">
              {{ ls.score }}/{{ ls.maxScore }} · {{ ls.level }}
            </span>
          </div>
          <div class="flex flex-col gap-3">
            <div v-for="q in ls.section.questions" :key="q.id">
              <p class="text-xs text-slate-600 mb-1">{{ q.text }}</p>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="o in q.options"
                  :key="o.text"
                  @click="answers[q.id] = o.text"
                  class="px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors"
                  :class="
                    answers[q.id] === o.text
                      ? 'bg-orange-500 border-orange-500 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-orange-300'
                  "
                >
                  {{ o.shortLabel || o.text }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2 mt-4">
        <button
          @click="cancelEdit"
          class="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 bg-slate-100"
        >
          <X :size="16" class="inline" /> ยกเลิก
        </button>
        <button
          @click="save"
          :disabled="saving"
          class="bg-orange-500 text-white px-5 py-2 rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50"
        >
          <Loader2 v-if="saving" :size="16" class="animate-spin" />
          <Save v-else :size="16" /> บันทึก
        </button>
      </div>
    </section>

    <!-- List -->
    <section>
      <h3
        class="text-xs font-black text-slate-400 uppercase tracking-widest mb-3"
      >
        แบบประเมินสุขภาพ (3อ2ส)
      </h3>
      <div v-if="ctx.assessments.value.length" class="flex flex-col gap-2">
        <div
          v-for="a in ctx.assessments.value"
          :key="a.id"
          class="border border-slate-100 rounded-2xl p-3 flex items-center justify-between gap-2"
        >
          <div class="min-w-0">
            <p class="text-sm font-bold text-slate-700">
              คะแนนรวม {{ a.total_score ?? "—" }} · {{ a.overall_level || "—" }}
            </p>
            <p class="text-xs text-slate-400">{{ fmt(a.created_at) }}</p>
          </div>
          <button
            @click="startEdit(a)"
            class="p-2 text-slate-500 hover:bg-slate-50 rounded-lg shrink-0"
            title="แก้ไข"
          >
            <Pencil :size="16" />
          </button>
        </div>
      </div>
      <p v-else class="text-slate-400 text-sm">ยังไม่มีผลประเมิน</p>
    </section>

    <!-- Event pre/post tests (read-only) -->
    <section>
      <h3
        class="text-xs font-black text-slate-400 uppercase tracking-widest mb-3"
      >
        คะแนนทดสอบก่อน/หลังกิจกรรม
      </h3>
      <div
        v-if="ctx.assessmentSubmissions.value.length"
        class="flex flex-col gap-2"
      >
        <div
          v-for="s in ctx.assessmentSubmissions.value"
          :key="s.id"
          class="border border-slate-100 rounded-2xl p-3 flex items-center justify-between"
        >
          <div>
            <p class="text-sm font-bold text-slate-700">
              {{ s.event_title || "กิจกรรม #" + s.event_id }} ·
              {{ testLabel(s.test_type) }}
            </p>
            <p class="text-xs text-slate-400">{{ fmt(s.submitted_at) }}</p>
          </div>
          <span class="text-sm font-black text-orange-600">{{
            s.total_score ?? "—"
          }}</span>
        </div>
      </div>
      <p v-else class="text-slate-400 text-sm">ยังไม่มีคะแนนทดสอบ</p>
    </section>
  </div>
</template>
