<script setup lang="ts">
import { ref, computed, watch } from "vue";
import {
  Check,
  X,
  Trash2,
  Plus,
  Loader2,
  Pencil,
  Upload,
} from "lucide-vue-next";
import { safeImageUrl } from "../../../lib/safeUrl";
import {
  metricModeForTask,
  encodeMissionValue,
} from "../../../lib/missionValue";
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
const toDateInput = (d: string) => (d ? String(d).slice(0, 10) : "");

const grouped = computed(() => {
  const map: Record<string, any[]> = {};
  for (const s of props.ctx.submissions.value) {
    const key = s.event_title || "อื่น ๆ";
    (map[key] ||= []).push(s);
  }
  return map;
});

// ── Edit an existing submission ───────────────────────────────
const editingId = ref<number | null>(null);
const editForm = ref<any>({
  value: 0,
  textResponse: "",
  note: "",
  created_at: "",
  imageUrl: "",
});
const editUploading = ref(false);

const startEdit = (s: any) => {
  editingId.value = s.id;
  editForm.value = {
    value: Number(s.value) || 0,
    textResponse: s.text_response || "",
    note: s.comment || "",
    created_at: toDateInput(s.created_at),
    imageUrl: s.img_url || "",
  };
};
const cancelEdit = () => {
  editingId.value = null;
};
const onEditFile = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  editUploading.value = true;
  const url = await props.ctx.uploadProofImage(file, "admin-edit");
  editUploading.value = false;
  if (url) editForm.value.imageUrl = url;
};
const saveEdit = async () => {
  if (editingId.value == null) return;
  await props.ctx.editSubmission(editingId.value, {
    value: Number(editForm.value.value) || 0,
    imageUrl: editForm.value.imageUrl || null,
    textResponse: editForm.value.textResponse || null,
    note: editForm.value.note || null,
    created_at: editForm.value.created_at || undefined,
  });
  editingId.value = null;
};

// ── Add a submission (any date) ───────────────────────────────
const showAdd = ref(false);
const addEventId = ref<number | null>(null);
const tasks = ref<any[]>([]);
const addTaskId = ref<number | null>(null);
const addForm = ref<any>({
  num: "",
  steps: "",
  h: "",
  m: "",
  s: "",
  textResponse: "",
  status: "approved",
  created_at: "",
  imageUrl: "",
});
const addUploading = ref(false);

const selectedTask = computed(
  () =>
    tasks.value.find((t) => Number(t.id) === Number(addTaskId.value)) || null,
);
const mode = computed(() => metricModeForTask(selectedTask.value));
const submissionType = computed(() =>
  (selectedTask.value?.submission_type || "manual").toLowerCase(),
);
const needsText = computed(
  () => submissionType.value === "text" || submissionType.value === "both",
);
const needsPhoto = computed(
  () => submissionType.value === "photo" || submissionType.value === "both",
);

watch(addEventId, async (id) => {
  addTaskId.value = null;
  tasks.value = id ? await props.ctx.fetchActivityTasks(Number(id)) : [];
});

const onAddFile = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  addUploading.value = true;
  const url = await props.ctx.uploadProofImage(
    file,
    selectedTask.value?.note || "mission",
  );
  addUploading.value = false;
  if (url) addForm.value.imageUrl = url;
};

const resetAdd = () => {
  addEventId.value = null;
  addTaskId.value = null;
  tasks.value = [];
  addForm.value = {
    num: "",
    steps: "",
    h: "",
    m: "",
    s: "",
    textResponse: "",
    status: "approved",
    created_at: "",
    imageUrl: "",
  };
};

const submitAdd = async () => {
  if (!addTaskId.value) return;
  const value = encodeMissionValue({
    mode: mode.value,
    num: addForm.value.num,
    steps: addForm.value.steps,
    h: addForm.value.h,
    m: addForm.value.m,
    s: addForm.value.s,
  });
  await props.ctx.backdateSubmit({
    taskId: Number(addTaskId.value),
    value,
    imageUrl: addForm.value.imageUrl || undefined,
    textResponse: addForm.value.textResponse || undefined,
    activity_type: selectedTask.value?.type || undefined,
    proof_type: selectedTask.value?.submission_type || undefined,
    status: addForm.value.status,
    created_at: addForm.value.created_at || undefined,
  });
  showAdd.value = false;
  resetAdd();
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
        <Plus :size="16" /> เพิ่มภารกิจ
      </button>
    </div>

    <!-- Add form -->
    <div
      v-if="showAdd"
      class="border border-slate-200 rounded-2xl p-4 mb-6 flex flex-col gap-3"
    >
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label class="flex flex-col gap-1">
          <span class="text-xs font-bold text-slate-500">กิจกรรม</span>
          <select
            v-model="addEventId"
            class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
          >
            <option :value="null">— เลือกกิจกรรม —</option>
            <option
              v-for="r in ctx.registrations.value"
              :key="r.event_id"
              :value="r.event_id"
            >
              {{ r.title }}
            </option>
          </select>
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs font-bold text-slate-500">ภารกิจ</span>
          <select
            v-model="addTaskId"
            :disabled="!addEventId"
            class="border border-slate-200 rounded-xl px-3 py-2 text-sm disabled:bg-slate-50"
          >
            <option :value="null">— เลือกภารกิจ —</option>
            <option v-for="t in tasks" :key="t.id" :value="t.id">
              {{ t.note || t.type }} ({{ t.points }} คะแนน)
            </option>
          </select>
        </label>
      </div>

      <template v-if="selectedTask">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <!-- value input adapts to the task metric -->
          <div v-if="mode === 'time'" class="flex flex-col gap-1">
            <span class="text-xs font-bold text-slate-500"
              >เวลา (ชม./นาที/วินาที)</span
            >
            <div class="flex gap-2">
              <input
                v-model="addForm.h"
                type="number"
                min="0"
                placeholder="ชม."
                class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
              <input
                v-model="addForm.m"
                type="number"
                min="0"
                placeholder="นาที"
                class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
              <input
                v-model="addForm.s"
                type="number"
                min="0"
                placeholder="วินาที"
                class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>
          <label v-else-if="mode === 'steps'" class="flex flex-col gap-1">
            <span class="text-xs font-bold text-slate-500">จำนวนก้าว</span>
            <input
              v-model="addForm.steps"
              type="number"
              min="0"
              class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
          </label>
          <label v-else class="flex flex-col gap-1">
            <span class="text-xs font-bold text-slate-500"
              >ค่า
              {{
                selectedTask.metric_unit
                  ? "(" + selectedTask.metric_unit + ")"
                  : ""
              }}</span
            >
            <input
              v-model="addForm.num"
              type="number"
              step="0.01"
              class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
          </label>

          <label class="flex flex-col gap-1">
            <span class="text-xs font-bold text-slate-500"
              >วันที่บันทึก (ย้อนหลัง/อนาคตได้)</span
            >
            <input
              v-model="addForm.created_at"
              type="date"
              class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
          </label>

          <label v-if="needsText" class="flex flex-col gap-1 sm:col-span-2">
            <span class="text-xs font-bold text-slate-500">ข้อความตอบกลับ</span>
            <textarea
              v-model="addForm.textResponse"
              rows="2"
              class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
            ></textarea>
          </label>

          <div class="flex flex-col gap-1 sm:col-span-2">
            <span class="text-xs font-bold text-slate-500">
              รูปหลักฐาน {{ needsPhoto ? "(จำเป็น)" : "(ถ้ามี)" }}
            </span>
            <div class="flex items-center gap-3">
              <label
                class="cursor-pointer inline-flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 text-sm"
              >
                <Loader2 v-if="addUploading" :size="14" class="animate-spin" />
                <Upload v-else :size="14" />
                เลือกรูป
                <input
                  type="file"
                  accept="image/*"
                  class="hidden"
                  @change="onAddFile"
                />
              </label>
              <img
                v-if="safeImageUrl(addForm.imageUrl)"
                :src="safeImageUrl(addForm.imageUrl)"
                class="w-14 h-14 rounded-lg object-cover border border-slate-200"
              />
            </div>
          </div>

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
        </div>

        <div class="flex justify-end gap-2">
          <button
            @click="
              showAdd = false;
              resetAdd();
            "
            class="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 bg-slate-100"
          >
            ยกเลิก
          </button>
          <button
            @click="submitAdd"
            :disabled="ctx.submitting.value || !addTaskId"
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
      </template>
    </div>

    <!-- Existing submissions -->
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
          class="border border-slate-100 rounded-2xl p-3"
        >
          <div class="flex items-center gap-3">
            <img
              v-if="safeImageUrl(s.img_url)"
              :src="safeImageUrl(s.img_url)"
              class="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0"
            />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-bold text-slate-700 truncate">
                {{ s.task_name || "ภารกิจ" }}
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
              @click="startEdit(s)"
              class="p-2 text-slate-500 hover:bg-slate-50 rounded-lg"
              title="แก้ไข"
            >
              <Pencil :size="16" />
            </button>
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

          <!-- Inline editor -->
          <div
            v-if="editingId === s.id"
            class="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            <label class="flex flex-col gap-1">
              <span class="text-xs font-bold text-slate-500">ค่า</span>
              <input
                v-model="editForm.value"
                type="number"
                step="0.01"
                class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs font-bold text-slate-500">วันที่บันทึก</span>
              <input
                v-model="editForm.created_at"
                type="date"
                class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
            </label>
            <label class="flex flex-col gap-1 sm:col-span-2">
              <span class="text-xs font-bold text-slate-500"
                >ข้อความตอบกลับ</span
              >
              <textarea
                v-model="editForm.textResponse"
                rows="2"
                class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
              ></textarea>
            </label>
            <label class="flex flex-col gap-1 sm:col-span-2">
              <span class="text-xs font-bold text-slate-500">หมายเหตุ</span>
              <input
                v-model="editForm.note"
                class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
            </label>
            <div class="flex flex-col gap-1 sm:col-span-2">
              <span class="text-xs font-bold text-slate-500">รูปหลักฐาน</span>
              <div class="flex items-center gap-3">
                <label
                  class="cursor-pointer inline-flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 text-sm"
                >
                  <Loader2
                    v-if="editUploading"
                    :size="14"
                    class="animate-spin"
                  />
                  <Upload v-else :size="14" />
                  เปลี่ยนรูป
                  <input
                    type="file"
                    accept="image/*"
                    class="hidden"
                    @change="onEditFile"
                  />
                </label>
                <img
                  v-if="safeImageUrl(editForm.imageUrl)"
                  :src="safeImageUrl(editForm.imageUrl)"
                  class="w-14 h-14 rounded-lg object-cover border border-slate-200"
                />
                <button
                  v-if="editForm.imageUrl"
                  @click="editForm.imageUrl = ''"
                  class="text-xs font-bold text-rose-600"
                >
                  ลบรูป
                </button>
              </div>
            </div>
            <div class="sm:col-span-2 flex justify-end gap-2">
              <button
                @click="cancelEdit"
                class="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 bg-slate-100"
              >
                ยกเลิก
              </button>
              <button
                @click="saveEdit"
                :disabled="ctx.submitting.value"
                class="bg-orange-500 text-white px-5 py-2 rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50"
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
