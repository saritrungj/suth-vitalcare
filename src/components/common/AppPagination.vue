<script setup lang="ts">
import { computed, onMounted, ref, onUnmounted } from "vue";
import { ChevronLeft, ChevronRight } from "lucide-vue-next";
const props = defineProps<{
  currentPage: number;
  totalPages: number;
  maxVisible?: number;
}>();
const emit = defineEmits<{
  (e: "change", page: number): void;
}>();
const isMobile = ref(false);
function checkScreen() {
  isMobile.value = window.innerWidth <= 480;
}
onMounted(() => {
  checkScreen();
  window.addEventListener("resize", checkScreen);
});
onUnmounted(() => {
  window.removeEventListener("resize", checkScreen);
});
const pagesArray = computed(() => {
  const arr: (number | string)[] = [];
  // Reduce max visible on mobile to prevent overflow
  const maxVisible = isMobile.value ? 3 : props.maxVisible || 5;
  const current = props.currentPage;
  const total = props.totalPages;
  if (total <= maxVisible) {
    for (let i = 1; i <= total; i++) arr.push(i);
    return arr;
  }
  const sidePages = isMobile.value ? 1 : 2;
  let start = Math.max(1, current - sidePages);
  let end = Math.min(total, start + (maxVisible - 1));
  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - (maxVisible - 1));
  }
  if (start > 1) {
    arr.push(1);
    if (start > 2) arr.push("...");
  }
  for (let i = start; i <= end; i++) {
    arr.push(i);
  }
  if (end < total) {
    if (end < total - 1) arr.push("...");
    arr.push(total);
  }
  return arr;
});
const setPage = (p: number) => {
  if (p < 1 || p > props.totalPages) return;
  emit("change", p);
};
</script>
<template>
  <div
    v-if="totalPages > 1"
    class="pagination-container animate-in fade-in duration-500"
  >
    <!-- Previous Button -->
    <button
      @click="setPage(currentPage - 1)"
      :disabled="currentPage === 1"
      class="page-btn nav-btn"
    >
      <ChevronLeft :size="isMobile ? 16 : 18" />
    </button>
    <!-- Page Numbers -->
    <div class="page-numbers">
      <button
        v-for="(p, i) in pagesArray"
        :key="i"
        @click="typeof p === 'number' ? setPage(p) : null"
        :disabled="typeof p === 'string'"
        class="page-btn"
        :class="[
          currentPage === p ? 'active' : 'inactive',
          typeof p === 'string' ? 'ellipsis' : '',
        ]"
      >
        {{ p }}
      </button>
    </div>
    <!-- Next Button -->
    <button
      @click="setPage(currentPage + 1)"
      :disabled="currentPage === totalPages"
      class="page-btn nav-btn"
    >
      <ChevronRight :size="isMobile ? 16 : 18" />
    </button>
  </div>
</template>
<style scoped>
.pagination-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 16px 16px;
  width: 100%;
  box-sizing: border-box;
}
.page-numbers {
  display: flex;
  align-items: center;
  gap: 6px;
}
.page-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #475569;
  font-size: 14px;
  font-weight: 700;
  width: 40px;
  height: 40px;
  min-width: 40px;
  min-height: 40px;
  aspect-ratio: 1 / 1;
  flex-shrink: 0;
  transition: all 0.2s;
  cursor: pointer;
  padding: 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
.page-btn.active {
  background: #ff6a00;
  border-color: #ff6a00;
  color: #fff;
  box-shadow: 0 4px 12px rgba(255, 106, 0, 0.2);
}
.page-btn.inactive:hover {
  border-color: #ff6a00;
  color: #ff6a00;
}
.page-btn:disabled:not(.ellipsis) {
  opacity: 0.3;
  cursor: not-allowed;
}
.page-btn.ellipsis {
  border-color: transparent;
  background: transparent;
  cursor: default;
  box-shadow: none;
  width: 24px;
  min-width: 24px;
}
@media (max-width: 480px) {
  .pagination-container {
    gap: 4px;
  }
  .page-numbers {
    gap: 4px;
  }
  .page-btn {
    width: 34px;
    height: 34px;
    min-width: 34px;
    min-height: 34px;
    font-size: 13px;
  }
  .page-btn.ellipsis {
    width: 18px;
    min-width: 18px;
  }
}
</style>
