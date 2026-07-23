<script setup lang="ts">
import { reactive, watch } from "vue";
import { Save, Loader2 } from "lucide-vue-next";
const props = defineProps<{ ctx: any }>();

const fields = [
  { key: "fname_th", label: "ชื่อ" },
  { key: "lname_th", label: "นามสกุล" },
  { key: "nickname", label: "ชื่อเล่น" },
  { key: "email", label: "อีเมล" },
  { key: "phone", label: "โทรศัพท์" },
  { key: "id_code", label: "รหัสประจำตัว" },
  { key: "address", label: "ที่อยู่" },
  { key: "role_type", label: "ประเภทผู้ใช้" },
  { key: "role_detail_1", label: "รายละเอียด 1" },
  { key: "role_detail_2", label: "รายละเอียด 2" },
  { key: "main_goal", label: "เป้าหมายหลัก" },
  { key: "underlying_disease", label: "โรคประจำตัว" },
  { key: "weight", label: "น้ำหนัก (กก.)" },
  { key: "height", label: "ส่วนสูง (ซม.)" },
  { key: "birth_date", label: "วันเกิด (YYYY-MM-DD)" },
];

const form = reactive<Record<string, any>>({});
const sync = () => {
  const u = props.ctx.user.value || {};
  fields.forEach((f) => (form[f.key] = u[f.key] ?? ""));
  form.gender = u.gender ?? "";
  form.role = u.role ?? "user";
};
watch(() => props.ctx.user.value, sync, { immediate: true });

const save = () => props.ctx.saveProfile({ ...form });
</script>

<template>
  <div class="max-w-3xl">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <label v-for="f in fields" :key="f.key" class="flex flex-col gap-1">
        <span class="text-xs font-bold text-slate-500">{{ f.label }}</span>
        <input
          v-model="form[f.key]"
          class="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-500"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs font-bold text-slate-500">เพศ</span>
        <select
          v-model="form.gender"
          class="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-500"
        >
          <option value="">ไม่ระบุ</option>
          <option value="male">ชาย</option>
          <option value="female">หญิง</option>
        </select>
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs font-bold text-slate-500">สิทธิ์</span>
        <select
          v-model="form.role"
          class="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-500"
        >
          <option value="user">user</option>
          <option value="host">host</option>
          <option value="admin">admin</option>
        </select>
      </label>
    </div>
    <button
      @click="save"
      :disabled="ctx.submitting.value"
      class="mt-6 bg-orange-500 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-orange-600 disabled:opacity-50"
    >
      <Loader2 v-if="ctx.submitting.value" :size="18" class="animate-spin" />
      <Save v-else :size="18" /> บันทึกโปรไฟล์
    </button>
  </div>
</template>
