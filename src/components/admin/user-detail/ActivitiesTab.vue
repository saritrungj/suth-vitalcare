<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { authStore } from "../../../store/auth";
import { Plus, LogOut, Search, Loader2 } from "lucide-vue-next";
const props = defineProps<{ ctx: any }>();

const API = import.meta.env.VITE_API_URL || "/api";
const allActivities = ref<any[]>([]);
const search = ref("");

onMounted(async () => {
  try {
    const r = await fetch(`${API}/activities?manage=true`, {
      headers: { "x-user-id": String(authStore.user?.id) },
    });
    if (r.ok) allActivities.value = await r.json();
  } catch {
    /* silent */
  }
});

// full-profile registrations: { id: registration_id, event_id, title, ... }
const joinedIds = computed(
  () => new Set(props.ctx.registrations.value.map((r: any) => r.event_id)),
);
const available = computed(() => {
  const q = search.value.toLowerCase().trim();
  return allActivities.value.filter(
    (a) =>
      !joinedIds.value.has(a.id) && (!q || a.title.toLowerCase().includes(q)),
  );
});
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
    <section>
      <h3
        class="text-xs font-black text-slate-400 uppercase tracking-widest mb-3"
      >
        กิจกรรมที่เข้าร่วม ({{ ctx.registrations.value.length }})
      </h3>
      <div class="flex flex-col gap-2">
        <div
          v-for="r in ctx.registrations.value"
          :key="r.id"
          class="border border-slate-100 rounded-2xl p-3 flex items-center justify-between gap-2"
        >
          <span class="text-sm font-bold text-slate-700 truncate">{{
            r.title
          }}</span>
          <button
            @click="ctx.kick(r.event_id, r.title)"
            class="p-2 text-rose-600 hover:bg-rose-50 rounded-lg shrink-0"
            title="คัดออก"
          >
            <LogOut :size="16" />
          </button>
        </div>
        <p
          v-if="ctx.registrations.value.length === 0"
          class="text-slate-400 text-sm"
        >
          ยังไม่ได้เข้าร่วมกิจกรรม
        </p>
      </div>
    </section>

    <section>
      <h3
        class="text-xs font-black text-slate-400 uppercase tracking-widest mb-3"
      >
        เพิ่มเข้ากิจกรรม
      </h3>
      <div class="relative mb-3">
        <Search
          :size="14"
          class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          v-model="search"
          placeholder="ค้นหากิจกรรม..."
          class="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500"
        />
      </div>
      <div class="flex flex-col gap-2 max-h-96 overflow-y-auto">
        <div
          v-for="a in available"
          :key="a.id"
          class="border border-slate-100 rounded-2xl p-3 flex items-center justify-between gap-2"
        >
          <span class="text-sm font-bold text-slate-700 truncate">{{
            a.title
          }}</span>
          <button
            @click="ctx.enroll(a.id)"
            :disabled="ctx.submitting.value"
            class="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg shrink-0 disabled:opacity-50"
            title="เพิ่ม"
          >
            <Loader2
              v-if="ctx.submitting.value"
              :size="16"
              class="animate-spin"
            />
            <Plus v-else :size="16" />
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
