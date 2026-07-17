<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { ChevronDown, Check, Circle, X, Settings2 } from "lucide-vue-next";
const props = defineProps<{
  options: { id: string; label: string }[];
  modelValue: string[];
  label: string;
}>();
const emit = defineEmits(["update:modelValue", "clear"]);
const isOpen = ref(false);
const dropdownRef = ref<HTMLElement | null>(null);
const isMobileScreen = ref(false);
const checkScreen = () => {
  isMobileScreen.value = window.innerWidth <= 768;
};
const toggleDropdown = () => {
  isOpen.value = !isOpen.value;
};
const closeDropdown = (e: MouseEvent) => {
  if (
    dropdownRef.value &&
    !dropdownRef.value.contains(e.target as Node) &&
    !isMobileScreen.value
  ) {
    isOpen.value = false;
  }
};
const toggleOption = (id: string) => {
  const newValue = [...props.modelValue];
  const index = newValue.indexOf(id);
  if (index > -1) {
    newValue.splice(index, 1);
  } else {
    newValue.push(id);
  }
  emit("update:modelValue", newValue);
};
const isSelected = (id: string) => props.modelValue.includes(id);
const toggleAll = () => {
  if (props.modelValue.length === props.options.length) {
    emit("update:modelValue", []);
  } else {
    emit(
      "update:modelValue",
      props.options.map((o) => o.id),
    );
  }
};
const clearAll = () => {
  emit("update:modelValue", []);
  emit("clear");
};
onMounted(() => {
  checkScreen();
  window.addEventListener("resize", checkScreen);
  document.addEventListener("click", closeDropdown);
});
onUnmounted(() => {
  window.removeEventListener("resize", checkScreen);
  document.removeEventListener("click", closeDropdown);
});
const activeCount = computed(() => props.modelValue.length);
</script>
<template>
  <div class="multi-select-container" ref="dropdownRef">
    <button
      type="button"
      class="filter-trigger"
      :class="{ 'is-active': activeCount > 0, 'is-open': isOpen }"
      @click="toggleDropdown"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      :aria-label="`${label}: ${activeCount} selected`"
    >
      <div class="trigger-left">
        <Settings2 :size="18" class="icon-filter" />
        <span class="label hidden-mobile">{{ label }}</span>
        <div v-if="activeCount > 0" class="badge">{{ activeCount }}</div>
      </div>
      <ChevronDown :size="18" class="chevron" :class="{ rotate: isOpen }" />
    </button>
    <transition name="fade">
      <div
        v-if="isOpen"
        class="filter-backdrop"
        aria-hidden="true"
        @click="isOpen = false"
      ></div>
    </transition>
    <transition :name="isMobileScreen ? 'slide-down-mobile' : 'slide-up'">
      <div v-if="isOpen" class="filter-panel" role="dialog" :aria-label="label">
        <div class="panel-header">
          <span class="header-title">เลือกตัวกรอง</span>
          <div class="header-actions">
            <button type="button" class="action-btn" @click="toggleAll">
              {{
                modelValue.length === options.length
                  ? "ยกเลิกทั้งหมด"
                  : "เลือกทั้งหมด"
              }}
            </button>
          </div>
        </div>
        <div class="options-list" role="listbox" aria-multiselectable="true">
          <button
            v-for="opt in options"
            :key="opt.id"
            type="button"
            class="option-item"
            :class="{ selected: isSelected(opt.id) }"
            :aria-selected="isSelected(opt.id)"
            @click="toggleOption(opt.id)"
          >
            <div
              class="checkbox-circle"
              :class="{ checked: isSelected(opt.id) }"
            >
              <Check v-if="isSelected(opt.id)" :size="12" stroke-width="4" />
            </div>
            <span class="option-label">{{ opt.label }}</span>
          </button>
        </div>
        <div class="panel-footer">
          <button type="button" class="btn-apply" @click="isOpen = false">
            ตกลง
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>
<style scoped>
.multi-select-container {
  position: relative;
  width: 100%;
  max-width: 240px;
}
.filter-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 44px;
  padding: 0 16px;
  background: #fff;
  border: 1.5px solid #e2e8f0;
  border-radius: 99px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  color: #1e293b;
  font-weight: 600;
  font-size: 0.95rem;
}
.filter-trigger:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}
@media (max-width: 768px) {
  .filter-trigger {
    width: 44px;
    padding: 0;
    justify-content: center;
  }
  .hidden-mobile {
    display: none;
  }
  .trigger-left {
    gap: 0;
    position: relative;
  }
  .badge {
    position: absolute;
    top: -8px;
    right: -8px;
    border: 2px solid #fff;
  }
  .chevron {
    display: none;
  }
}
.filter-trigger.is-open {
  border-color: #ff6a00;
}
.filter-trigger.is-active {
  background: rgba(255, 106, 0, 0.05);
  border-color: #ff6a00;
  color: #ff6a00;
}
.trigger-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.badge {
  background: #ff6a00;
  color: white;
  font-size: 11px;
  font-weight: 700;
  min-width: 18px;
  height: 18px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
}
.chevron {
  transition: transform 0.3s ease;
  color: #94a3b8;
}
.chevron.rotate {
  transform: rotate(180deg);
}
.filter-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: 280px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 20px 40px -12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  overflow: hidden;
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
.panel-header {
  padding: 16px;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.header-title {
  font-size: 13px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.action-btn {
  background: none;
  border: none;
  padding: 0;
  font-size: 14px;
  font-weight: 600;
  color: #ff6a00;
  cursor: pointer;
  transition: opacity 0.2s;
}
.action-btn:hover {
  opacity: 0.7;
}
.action-btn.text-danger {
  color: #ef4444;
}
.divider {
  width: 1px;
  height: 12px;
  background: #e2e8f0;
}
.options-list {
  max-height: 300px;
  overflow-y: auto;
  padding: 8px;
}
.option-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  font-family: inherit;
}
.option-item:hover {
  background: #f8fafc;
}
.option-item:focus-visible {
  outline: 2px solid #ff6a00;
  outline-offset: 2px;
}
.option-item.selected {
  background: rgba(255, 106, 0, 0.03);
}
.checkbox-circle {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
  color: white;
}
.checkbox-circle.checked {
  background: #ff6a00;
  border-color: #ff6a00;
}
.option-label {
  font-size: 15px;
  font-weight: 500;
  color: #334155;
}
.option-item.selected .option-label {
  color: #1e293b;
  font-weight: 600;
}
.panel-footer {
  padding: 12px;
  border-top: 1px solid #f1f5f9;
  background: #f8fafc;
}
.btn-apply {
  width: 100%;
  height: 40px;
  background: #ff6a00;
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-apply:hover {
  background: #e65f00;
}
/* Animations */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
.slide-down-mobile-enter-active,
.slide-down-mobile-leave-active {
  transition:
    transform 0.4s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.3s ease;
}
.slide-down-mobile-enter-from,
.slide-down-mobile-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.filter-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(4px);
  z-index: 999;
}
.mobile-handle {
  width: 40px;
  height: 4px;
  background: #e2e8f0;
  border-radius: 2px;
  margin: 12px auto 0;
}
@media (max-width: 768px) {
  .multi-select-container {
    max-width: none;
  }
  .filter-panel {
    position: fixed;
    top: 0;
    bottom: auto;
    left: 0;
    right: 0;
    width: 100%;
    border-radius: 0 0 24px 24px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
    z-index: 1000;
  }
}
</style>
