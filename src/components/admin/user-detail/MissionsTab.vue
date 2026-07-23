<script setup lang="ts">
import { ref, computed } from "vue";
import { Check, X, Trash2, Plus, Loader2 } from "lucide-vue-next";
const props = defineProps<{ ctx: any }>();

const statusLabel = (s: string) =>
  s === "approved" ? "อนุมัติ" : s === "rejected" ? "ปฏิเสธ" : "รอตรวจ";
const statusClass = (s: string) =>
  s === "approved"
    ? "bg-emerald-100 text-emerald-700"
    : s === "rejected"
      ? "bg-rose-100 text-rose-700"
      : "bg-amber-100 text-amber-700";
const fmt = (d: string) =>
  d
    ? new Date(d).toLocaleDateString("th-TH", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      })
    : "—";

// Group submissions by activity title for readability.
const grouped = computed(() => {
  const map: Record<string, any[]> = {};
  for (const s of props.ctx.submissions.value) {
    const key = s.event_title
      ? s.event_title
      : s.tasks?.event_id
        ? `กิจกรรม #${s.tasks.event_id}`
        : "อื่น ๆ";
    (map[key] ||= []).push(s);
  }
  return map;
});

// Backdated create form — the task list comes from the user's registrations
// is not enough (need task ids); admin enters a task id + date directly.
const showAdd = ref(false);
const addForm = ref<any>({
  taskId: "",
  value: 0,
  status: "approved",
  created_at: "",
  textResponse: "",
});
const submitAdd = async () => {
  if (!addForm.value.taskId) return;
  await props.ctx.backdateSubmit({
    taskId: Number(addForm.value.taskId),
    value: Number(addForm.value.value) || 0,
    status: addForm.value.status,
    created_at: addForm.value.created_at || undefined,
    textResponse: addForm.value.textResponse || undefined,
  });
  showAdd.value = false;
  addForm.value = {
    taskId: "",
    value: 0,
    status: "approved",
    created_at: "",
    textResponse: "",
  };
};
</script>

<template>
  <div>
    <div class="flex justify-between items-center mb-4">
      <p class="text-sm font-bold text-slate-500">
        ทั้งหมด {{ ctx.submissions.value.length }} รายการ
      </p>
      <button
        @click="showAdd = !showAdd"
        class="bg-orange-500 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-orange-600"
      >
        <Plus :size="16" /> เพิ่มภารกิจย้อนหลัง
      </button>
    </div>

    <div
      v-if="showAdd"
      class="border border-slate-200 rounded-2xl p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3"
    >
      <label class="flex flex-col gap-1">
        <span class="text-xs font-bold text-slate-500">Task ID</span>
        <input
          v-model="addForm.taskId"
          type="number"
          class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs font-bold text-slate-500">ค่า (value)</span>
        <input
          v-model="addForm.value"
          type="number"
          class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs font-bold text-slate-500"
          >วันที่ (ย้อนหลังได้)</span
        >
        <input
          v-model="addForm.created_at"
          type="date"
          class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs font-bold text-slate-500">สถานะ</span>
        <select
          v-model="addForm.status"
          class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
        >
          <option value="approved">อนุมัติ</option>
          <option value="pending">รอตรวจ</option>
          <option value="rejected">ปฏิเสธ</option>
        </select>
      </label>
      <label class="flex flex-col gap-1 sm:col-span-2">
        <span class="text-xs font-bold text-slate-500">หมายเหตุ/ข้อความ</span>
        <input
          v-model="addForm.textResponse"
          class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
        />
      </label>
      <div class="sm:col-span-2 flex justify-end">
        <button
          @click="submitAdd"
          :disabled="ctx.submitting.value || !addForm.taskId"
          class="bg-orange-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50"
        >
          <Loader2
            v-if="ctx.submitting.value"
            :size="16"
            class="animate-spin"
          />
          <Check v-else :size="16" /> บันทึก
        </button>
      </div>
    </div>

    <div v-for="(list, group) in grouped" :key="group" class="mb-6">
      <h3
        class="text-xs font-black text-slate-400 uppercase tracking-widest mb-2"
      >
        {{ group }}
      </h3>
      <div class="flex flex-col gap-2">
        <div
          v-for="s in list"
          :key="s.id"
          class="border border-slate-100 rounded-2xl p-3 flex items-center gap-3"
        >
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold text-slate-700 truncate">
              {{ s.task_name || s.tasks?.note || s.tasks?.type || "ภารกิจ" }}
            </p>
            <p class="text-xs text-slate-400">
              {{ fmt(s.created_at) }} · ค่า {{ s.value }}
            </p>
          </div>
          <span
            class="text-[10px] font-bold px-2 py-1 rounded-md"
            :class="statusClass(s.status)"
          >
            {{ statusLabel(s.status) }}
          </span>
          <button
            v-if="s.status !== 'approved'"
            @click="ctx.setSubmissionStatus(s.id, 'approved')"
            class="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg"
            title="อนุมัติ"
          >
            <Check :size="16" />
          </button>
          <button
            v-if="s.status !== 'rejected'"
            @click="ctx.setSubmissionStatus(s.id, 'rejected')"
            class="p-2 text-amber-600 hover:bg-amber-50 rounded-lg"
            title="ปฏิเสธ"
          >
            <X :size="16" />
          </button>
          <button
            @click="ctx.deleteSubmission(s.id)"
            class="p-2 text-rose-600 hover:bg-rose-50 rounded-lg"
            title="ลบ"
          >
            <Trash2 :size="16" />
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="ctx.submissions.value.length === 0"
      class="text-slate-400 text-sm py-8 text-center"
    >
      ยังไม่มีภารกิจที่ส่ง
    </div>
  </div>
</template>
