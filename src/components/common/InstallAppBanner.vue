<script setup lang="ts">
import { Download, Share, PlusSquare, X } from "lucide-vue-next";
import { usePwaInstall } from "../../composables/usePwaInstall";
import { langStore } from "../../store/lang";

const { isIOS, canPromptInstall, showInstallUi, promptInstall, dismiss } =
  usePwaInstall();
</script>

<template>
  <Transition name="install-banner-fade">
    <div
      v-if="showInstallUi"
      class="install-banner"
      role="region"
      :aria-label="langStore.t('install_app_title')"
    >
      <button
        class="install-banner-close"
        @click="dismiss"
        :aria-label="langStore.t('close')"
      >
        <X :size="16" />
      </button>

      <div class="install-banner-icon">
        <img src="/logo.png" alt="" width="40" height="40" />
      </div>

      <div class="install-banner-body">
        <p class="install-banner-title">
          {{ langStore.t("install_app_title") }}
        </p>

        <p v-if="canPromptInstall" class="install-banner-text">
          {{ langStore.t("install_app_text") }}
        </p>
        <p v-else-if="isIOS" class="install-banner-text">
          {{ langStore.t("install_app_ios_text") }}
          <span class="install-step">
            <Share :size="14" class="inline-icon" />
            {{ langStore.t("install_app_ios_step1") }}
          </span>
          <span class="install-step">
            <PlusSquare :size="14" class="inline-icon" />
            {{ langStore.t("install_app_ios_step2") }}
          </span>
        </p>
      </div>

      <button
        v-if="canPromptInstall"
        class="install-banner-cta"
        @click="promptInstall"
      >
        <Download :size="16" />
        {{ langStore.t("install_app_cta") }}
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.install-banner {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: calc(84px + env(safe-area-inset-bottom, 0px));
  z-index: 9990;
  background: #ffffff;
  border-radius: 18px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
  border: 1px solid #f1f5f9;
  padding: 14px 16px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  max-width: 480px;
  margin: 0 auto;
}

@media (min-width: 1024px) {
  .install-banner {
    left: auto;
    right: 24px;
    bottom: 24px;
    width: 360px;
  }
}

.install-banner-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  overflow: hidden;
}
.install-banner-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.install-banner-body {
  flex: 1;
  min-width: 0;
}

.install-banner-title {
  font-weight: 800;
  font-size: 0.9rem;
  color: #1e293b;
  margin: 0 0 2px 0;
}

.install-banner-text {
  font-size: 0.8rem;
  color: #64748b;
  margin: 0;
  line-height: 1.5;
}

.install-step {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}

.inline-icon {
  flex-shrink: 0;
  color: #ff6a00;
}

.install-banner-cta {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #ff6a00;
  color: #fff;
  border: none;
  border-radius: 99px;
  padding: 8px 14px;
  font-weight: 700;
  font-size: 0.8rem;
  min-height: 44px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}
.install-banner-cta:hover {
  background: #e65f00;
}

.install-banner-close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: #94a3b8;
  border-radius: 50%;
  cursor: pointer;
}
.install-banner-close:hover {
  background: #f1f5f9;
  color: #64748b;
}

.install-banner-fade-enter-active,
.install-banner-fade-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}
.install-banner-fade-enter-from,
.install-banner-fade-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

@media (prefers-reduced-motion: reduce) {
  .install-banner-fade-enter-active,
  .install-banner-fade-leave-active {
    transition: none;
  }
}
</style>
