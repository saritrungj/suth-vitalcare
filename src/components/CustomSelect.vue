<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
const props = defineProps<{
  modelValue: string;
  options: { value: string; label: string }[] | string[];
  label: string;
  required?: boolean;
}>();
const emit = defineEmits(["update:modelValue"]);
const isOpen = ref(false);
const selectRef = ref<HTMLElement | null>(null);
const normalizedOptions = computed(() => {
  if (!props.options) return [];
  return props.options.map((opt) => {
    if (typeof opt === "string") {
      return { value: opt, label: opt };
    }
    return opt;
  });
});
const selectedLabel = computed(() => {
  const selected = normalizedOptions.value.find(
    (opt) => opt.value === props.modelValue,
  );
  return selected ? selected.label : "";
});
const dropdownDirection = ref<"down" | "up">("down");
const toggleDropdown = () => {
  if (!isOpen.value && selectRef.value) {
    const rect = selectRef.value.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    // If space below is less than 260px and there's more space above, flip up
    dropdownDirection.value =
      spaceBelow < 260 && spaceAbove > spaceBelow ? "up" : "down";
  }
  isOpen.value = !isOpen.value;
};
const selectOption = (val: string) => {
  emit("update:modelValue", val);
  isOpen.value = false;
};
const closeDropdown = (e: MouseEvent) => {
  if (selectRef.value && !selectRef.value.contains(e.target as Node)) {
    isOpen.value = false;
  }
};
onMounted(() => {
  document.addEventListener("click", closeDropdown);
});
onUnmounted(() => {
  document.removeEventListener("click", closeDropdown);
});
</script>
<template>
  <div class="premium-input-group custom-select-container" ref="selectRef">
    <div
      class="select-trigger"
      :class="{ 'is-open': isOpen, selected: modelValue }"
      @click="toggleDropdown"
      tabindex="0"
    >
      <span class="trigger-text">{{ selectedLabel }}</span>
    </div>
    <label>{{ label }} <span v-if="required">*</span></label>
    <div
      class="select-caret pointer-events-none"
      :class="{ 'is-open': isOpen }"
    ></div>
    <transition name="slide-dropdown">
      <div
        v-if="isOpen"
        class="options-menu"
        :class="{ 'is-up': dropdownDirection === 'up' }"
      >
        <div
          v-for="opt in normalizedOptions"
          :key="opt.value"
          class="option-item"
          :class="{ active: modelValue === opt.value }"
          @click="selectOption(opt.value)"
        >
          {{ opt.label }}
        </div>
      </div>
    </transition>
  </div>
</template>
<style scoped>
.custom-select-container {
  position: relative;
  width: 100%;
}
.select-trigger {
  width: 100%;
  padding: 18px 20px 8px;
  min-height: 54px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  font-size: 16px;
  color: var(--text-main);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  cursor: pointer;
  outline: none;
}
.select-trigger:focus,
.select-trigger.is-open {
  border-color: var(--primary-color);
  background: #ffffff;
}
.trigger-text {
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 24px;
}
label {
  position: absolute;
  left: 16px;
  top: 16px;
  font-size: 16px;
  color: var(--text-muted);
  pointer-events: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 0 4px;
  border-radius: 4px;
}
.select-trigger:focus ~ label,
.select-trigger.is-open ~ label,
.select-trigger.selected ~ label {
  top: 4px;
  font-size: 11px;
  color: var(--primary-color);
  font-weight: 500;
}
.select-caret {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid #4a5568;
  transition: transform 0.3s ease;
}
.select-caret.is-open {
  transform: translateY(-50%) rotate(180deg);
}
.options-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  width: 100%;
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow:
    0 10px 25px rgba(0, 0, 0, 0.1),
    0 20px 40px rgba(0, 0, 0, 0.05);
  max-height: 250px;
  overflow-y: auto;
  z-index: 999;
  padding: 8px 0;
  transform-origin: top center;
}
.options-menu.is-up {
  top: auto;
  bottom: calc(100% + 4px);
  transform-origin: bottom center;
}
.option-item {
  padding: 12px 20px;
  font-size: 16px;
  color: #333;
  cursor: pointer;
  transition: background 0.2s;
}
.option-item:hover {
  background: var(--primary-light);
  color: var(--primary-color);
}
.option-item.active {
  background: var(--primary-light);
  color: var(--primary-color);
  font-weight: 600;
}
/* Custom Scrollbar for Options */
.options-menu::-webkit-scrollbar {
  width: 6px;
}
.options-menu::-webkit-scrollbar-track {
  background: transparent;
}
.options-menu::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}
.options-menu::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
/* Animation */
.slide-dropdown-enter-active,
.slide-dropdown-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: top center;
}
.slide-dropdown-enter-from,
.slide-dropdown-leave-to {
  opacity: 0;
}
.slide-dropdown-enter-from.options-menu:not(.is-up),
.slide-dropdown-leave-to.options-menu:not(.is-up) {
  transform: scaleY(0.95) translateY(-10px);
}
.slide-dropdown-enter-from.options-menu.is-up,
.slide-dropdown-leave-to.options-menu.is-up {
  transform: scaleY(0.95) translateY(10px);
}
</style>
