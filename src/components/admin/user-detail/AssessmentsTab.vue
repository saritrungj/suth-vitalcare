<script setup lang="ts">
defineProps<{ ctx: any }>();
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
</script>

<template>
  <div class="flex flex-col gap-8 max-w-3xl">
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
          class="border border-slate-100 rounded-2xl p-3 flex items-center justify-between"
        >
          <div>
            <p class="text-sm font-bold text-slate-700">
              คะแนน {{ a.total_score ?? "—" }} · {{ a.overall_level || "—" }}
            </p>
            <p class="text-xs text-slate-400">{{ fmt(a.created_at) }}</p>
          </div>
        </div>
      </div>
      <p v-else class="text-slate-400 text-sm">ยังไม่มีผลประเมิน</p>
    </section>

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
