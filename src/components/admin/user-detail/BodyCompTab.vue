<script setup lang="ts">
import { ref } from "vue";
import { Plus, Pencil, Trash2, Save, X, Loader2 } from "lucide-vue-next";
const props = defineProps<{ ctx: any }>();

const numFields = [
  { key: "weight", label: "น้ำหนัก" },
  { key: "height", label: "ส่วนสูง" },
  { key: "bmi", label: "BMI" },
  { key: "fat_pc", label: "ไขมัน %" },
  { key: "fat_mass", label: "มวลไขมัน" },
  { key: "muscle_mass", label: "มวลกล้ามเนื้อ" },
  { key: "visceral_fat", label: "ไขมันช่องท้อง" },
  { key: "metabolic_age", label: "อายุเมตาบอลิก" },
  { key: "bone_mass", label: "มวลกระดูก" },
  { key: "waist_cm", label: "รอบเอว (ซม.)" },
];

const editing = ref<any | null>(null);
const startNew = () => {
  editing.value = { recorded_at: "" };
  numFields.forEach((f) => (editing.value[f.key] = ""));
};
const startEdit = (r: any) => {
  editing.value = { ...r, recorded_at: (r.recorded_at || "").slice(0, 10) };
};
const cancel = () => (editing.value = null);
const save = async () => {
  await props.ctx.saveTanita({ ...editing.value });
  editing.value = null;
};
const fmt = (d: string) =>
  d
    ? new Date(d).toLocaleDateString("th-TH", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      })
    : "—";
</script>

<template>
  <div>
    <div class="flex justify-between items-center mb-4">
      <p class="text-sm font-bold text-slate-500">
        ประวัติ {{ ctx.tanita.value.length }} รายการ
      </p>
      <button
        @click="startNew"
        class="bg-orange-500 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-orange-600"
      >
        <Plus :size="16" /> เพิ่มค่าร่างกาย
      </button>
    </div>

    <div v-if="editing" class="border border-slate-200 rounded-2xl p-4 mb-6">
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <label class="flex flex-col gap-1">
          <span class="text-xs font-bold text-slate-500">วันที่บันทึก</span>
          <input
            v-model="editing.recorded_at"
            type="date"
            class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
          />
        </label>
        <label v-for="f in numFields" :key="f.key" class="flex flex-col gap-1">
          <span class="text-xs font-bold text-slate-500">{{ f.label }}</span>
          <input
            v-model="editing[f.key]"
            class="border border-slate-200 rounded-xl px-3 py-2 text-sm"
          />
        </label>
      </div>
      <div class="flex justify-end gap-2 mt-4">
        <button
          @click="cancel"
          class="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 bg-slate-100"
        >
          <X :size="16" class="inline" /> ยกเลิก
        </button>
        <button
          @click="save"
          :disabled="ctx.submitting.value"
          class="bg-orange-500 text-white px-5 py-2 rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50"
        >
          <Loader2
            v-if="ctx.submitting.value"
            :size="16"
            class="animate-spin"
          />
          <Save v-else :size="16" /> บันทึก
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <div
        v-for="r in ctx.tanita.value"
        :key="r.id"
        class="border border-slate-100 rounded-2xl p-3 flex items-center gap-3"
      >
        <div class="flex-1 min-w-0">
          <p class="text-sm font-bold text-slate-700">
            {{ fmt(r.recorded_at) }}
          </p>
          <p class="text-xs text-slate-400">
            น้ำหนัก {{ r.weight || "—" }} · BMI {{ r.bmi || "—" }} · ไขมัน
            {{ r.fat_pc || "—" }}%
          </p>
        </div>
        <button
          @click="startEdit(r)"
          class="p-2 text-slate-500 hover:bg-slate-50 rounded-lg"
          title="แก้ไข"
        >
          <Pencil :size="16" />
        </button>
        <button
          @click="ctx.deleteTanita(r.id)"
          class="p-2 text-rose-600 hover:bg-rose-50 rounded-lg"
          title="ลบ"
        >
          <Trash2 :size="16" />
        </button>
      </div>
    </div>

    <div
      v-if="ctx.tanita.value.length === 0 && !editing"
      class="text-slate-400 text-sm py-8 text-center"
    >
      ยังไม่มีข้อมูลค่าร่างกาย
    </div>
  </div>
</template>
