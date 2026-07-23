<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, Loader2 } from "lucide-vue-next";
import { useAdminUserDetail } from "../composables/useAdminUserDetail";
import ProfileTab from "../components/admin/user-detail/ProfileTab.vue";
import PointsTab from "../components/admin/user-detail/PointsTab.vue";
import MissionsTab from "../components/admin/user-detail/MissionsTab.vue";
import BodyCompTab from "../components/admin/user-detail/BodyCompTab.vue";
import AssessmentsTab from "../components/admin/user-detail/AssessmentsTab.vue";
import ActivitiesTab from "../components/admin/user-detail/ActivitiesTab.vue";

const route = useRoute();
const router = useRouter();
const userId = Number(route.params.id);
const ctx = useAdminUserDetail(userId);

const tabs = [
  { key: "profile", label: "โปรไฟล์", comp: ProfileTab },
  { key: "points", label: "คะแนน", comp: PointsTab },
  { key: "missions", label: "ภารกิจ", comp: MissionsTab },
  { key: "body", label: "ค่าร่างกาย", comp: BodyCompTab },
  { key: "assess", label: "ผลประเมิน", comp: AssessmentsTab },
  { key: "activities", label: "กิจกรรม", comp: ActivitiesTab },
] as const;
const active = ref<(typeof tabs)[number]["key"]>("profile");
const currentComp = () => tabs.find((t) => t.key === active.value)!.comp;

onMounted(() => ctx.load());
</script>

<template>
  <div class="font-sarabun bg-white min-h-screen w-full">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <button
        @click="router.back()"
        class="flex items-center gap-2 text-slate-500 hover:text-orange-600 font-bold text-sm mb-6"
      >
        <ArrowLeft :size="18" /> กลับ
      </button>

      <div
        v-if="ctx.loading.value"
        class="py-24 flex justify-center text-slate-400"
      >
        <Loader2 :size="32" class="animate-spin" />
      </div>

      <template v-else-if="ctx.user.value">
        <div class="flex items-center gap-4 mb-6">
          <div class="min-w-0">
            <h1 class="text-2xl font-black text-slate-900 truncate">
              {{ ctx.displayName.value }}
            </h1>
            <p class="text-sm text-slate-400 font-bold">
              #{{ ctx.user.value.id }} · {{ ctx.user.value.role }}
            </p>
          </div>
        </div>

        <div
          class="flex gap-2 border-b border-slate-200 mb-8 overflow-x-auto no-scrollbar"
        >
          <button
            v-for="t in tabs"
            :key="t.key"
            @click="active = t.key"
            class="px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 -mb-px transition-colors"
            :class="
              active === t.key
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            "
          >
            {{ t.label }}
          </button>
        </div>

        <component :is="currentComp()" :ctx="ctx" />
      </template>

      <div v-else class="py-24 text-center text-slate-400 font-bold">
        ไม่พบข้อมูลผู้ใช้
      </div>
    </div>
  </div>
</template>
