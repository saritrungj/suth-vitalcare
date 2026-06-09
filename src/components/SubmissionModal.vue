<template>
    <transition name="sm-fade">
        <div
            v-if="open"
            class="sm-overlay"
            @click.self="$emit('close')"
        >
            <div class="sm-card">
                <!-- Header -->
                <header class="sm-header">
                    <div class="sm-user">
                        <div class="sm-avatar">
                            <img v-if="avatar" :src="avatar" loading="lazy" decoding="async" />
                            <span v-else>{{ initial }}</span>
                        </div>
                        <div class="sm-user-meta">
                            <h3 class="sm-name">{{ displayName }}</h3>
                            <p class="sm-sub">{{ langStore.t('mission_history') }}</p>
                        </div>
                    </div>
                    <button class="sm-close" @click="$emit('close')" :aria-label="langStore.t('close')">
                        <X :size="20" />
                    </button>
                </header>

                <!-- Body -->
                <div class="sm-body">
                    <div v-if="loading" class="sm-loading">
                        <div class="sm-spinner"></div>
                        <p>{{ langStore.t('loading_data') }}</p>
                    </div>

                    <div v-else-if="error" class="sm-empty">
                        <AlertTriangle :size="40" class="sm-empty-icon" />
                        <p>{{ langStore.t('error_connect') }}</p>
                        <button class="sm-retry" @click="retry">
                            {{ langStore.t('retry') }}
                        </button>
                    </div>

                    <div v-else-if="filteredSubmissions.length === 0" class="sm-empty">
                        <Inbox :size="40" class="sm-empty-icon" />
                        <p>{{ langStore.t('rank_no_data') }}</p>
                    </div>

                    <TransitionGroup v-else tag="ul" name="sm-list" class="sm-list">
                        <li
                            v-for="sub in filteredSubmissions"
                            :key="sub.id"
                            class="sm-item"
                        >
                            <img
                                v-if="safeImageUrl(sub.img_url)"
                                :src="safeImageUrl(sub.img_url)"
                                class="sm-thumb"
                                loading="lazy"
                                decoding="async"
                                :alt="langStore.t('proof_image')"
                            />
                            <div v-else class="sm-thumb sm-thumb--empty">
                                <ImageOff :size="18" />
                            </div>

                            <div class="sm-item-main">
                                <div class="sm-item-top">
                                    <span class="sm-task">{{ sub.tasks?.note || '—' }}</span>
                                    <span class="sm-badge" :class="badgeClass(sub.status)">
                                        {{ statusLabel(sub.status) }}
                                    </span>
                                </div>
                                <div class="sm-item-bottom">
                                    <span class="sm-value">
                                        {{ formatValue(sub.value) }}
                                        <span class="sm-unit">{{ sub.tasks?.metric_unit || unitShort }}</span>
                                    </span>
                                    <span class="sm-date">{{ formatDate(sub.created_at) }}</span>
                                </div>
                            </div>
                        </li>
                    </TransitionGroup>
                </div>
            </div>
        </div>
    </transition>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { X, Inbox, ImageOff, AlertTriangle } from "lucide-vue-next";
import { langStore } from "../store/lang";
import { safeImageUrl } from "../lib/safeUrl";
import { abortableJson, isAbortError } from "../lib/http";

const props = defineProps<{
    open: boolean;
    user: any;
    activityId: string | null;
    unitShort?: string;
}>();

defineEmits<{ (e: "close"): void }>();

const loading = ref(false);
const error = ref(false);
const submissions = ref<any[]>([]);

const STATUS_CLASS: Record<string, string> = {
    approved: "sm-badge--approved",
    pending: "sm-badge--pending",
    rejected: "sm-badge--rejected",
};
const badgeClass = (status: string) => STATUS_CLASS[status] || "sm-badge--pending";

const displayName = computed(
    () => props.user?.nickname || props.user?.fname_th || "นักวิ่ง",
);
const avatar = computed(() => safeImageUrl(props.user?.picture_url));
const initial = computed(() => (displayName.value?.[0] ?? "?").toUpperCase());

const filteredSubmissions = computed(() => {
    let list = submissions.value;
    if (props.activityId) {
        list = list.filter(
            (s) => String(s.tasks?.event_id) === String(props.activityId),
        );
    }
    return [...list].sort(
        (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
});

let controller: AbortController | null = null;

const fetchSubmissions = async (userId: any) => {
    if (!userId) return;
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    loading.value = true;
    error.value = false;
    submissions.value = [];
    try {
        submissions.value = await abortableJson<any[]>(
            `/api/missions/user/${userId}`,
            { signal },
        );
    } catch (e) {
        if (isAbortError(e)) return; // superseded — ignore
        error.value = true;
    } finally {
        if (controller?.signal === signal) loading.value = false;
    }
};

const retry = () => {
    if (props.user?.id) fetchSubmissions(props.user.id);
};

watch(
    () => [props.open, props.user?.id],
    ([isOpen, id]) => {
        if (isOpen && id) fetchSubmissions(id);
    },
    { immediate: true },
);

const statusLabel = (status: string) => {
    if (status === "approved") return langStore.t("approved");
    if (status === "rejected") return langStore.t("rejected");
    return langStore.t("pending");
};

const formatValue = (val: any) =>
    Number(val || 0).toLocaleString("th-TH", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
    });

const formatDate = (val: any) => {
    if (!val) return "";
    try {
        return new Date(val).toLocaleDateString("th-TH", {
            day: "numeric",
            month: "short",
            year: "2-digit",
        });
    } catch {
        return "";
    }
};
</script>

<style scoped>
.sm-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(4px);
    font-family: "Sarabun", sans-serif;
}
.sm-card {
    width: 100%;
    max-width: 460px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    background: #fff;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
}
.sm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #f1f5f9;
}
.sm-user {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
}
.sm-avatar {
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    border-radius: 50%;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #ff6a00, #ff9248);
    color: #fff;
    font-weight: 700;
}
.sm-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}
.sm-user-meta {
    min-width: 0;
}
.sm-name {
    font-size: 1rem;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.sm-sub {
    font-size: 0.75rem;
    color: #94a3b8;
    margin: 0;
}
.sm-close {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border: none;
    border-radius: 50%;
    background: #f1f5f9;
    color: #475569;
    cursor: pointer;
    transition: background 0.15s;
}
.sm-close:hover {
    background: #e2e8f0;
}
.sm-body {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem 1rem 1rem;
}
.sm-loading,
.sm-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 2.5rem 1rem;
    color: #94a3b8;
}
.sm-empty-icon {
    color: #cbd5e1;
}
.sm-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #ffe0c7;
    border-top-color: #ff6a00;
    border-radius: 50%;
    animation: sm-spin 0.7s linear infinite;
}
@keyframes sm-spin {
    to {
        transform: rotate(360deg);
    }
}
.sm-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
}
.sm-item {
    display: flex;
    gap: 0.75rem;
    padding: 0.625rem;
    border: 1px solid #f1f5f9;
    border-radius: 14px;
    background: #fcfcfd;
}
.sm-thumb {
    width: 52px;
    height: 52px;
    flex-shrink: 0;
    border-radius: 10px;
    object-fit: cover;
    background: #f1f5f9;
}
.sm-thumb--empty {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #cbd5e1;
}
.sm-item-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.35rem;
}
.sm-item-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
}
.sm-task {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1e293b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.sm-badge {
    flex-shrink: 0;
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 0.125rem 0.5rem;
    border-radius: 999px;
}
.sm-badge--approved {
    background: #dcfce7;
    color: #15803d;
}
.sm-badge--pending {
    background: #fef9c3;
    color: #a16207;
}
.sm-badge--rejected {
    background: #fee2e2;
    color: #b91c1c;
}
.sm-item-bottom {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
}
.sm-value {
    font-size: 0.9375rem;
    font-weight: 700;
    color: #ff6a00;
}
.sm-unit {
    font-size: 0.75rem;
    font-weight: 500;
    color: #94a3b8;
    margin-left: 2px;
}
.sm-date {
    font-size: 0.75rem;
    color: #94a3b8;
}
.sm-fade-enter-active,
.sm-fade-leave-active {
    transition: opacity 0.2s ease;
}
.sm-fade-enter-from,
.sm-fade-leave-to {
    opacity: 0;
}
.sm-retry {
    margin-top: 4px;
    padding: 7px 18px;
    border: none;
    border-radius: 999px;
    background: #ff6a00;
    color: #fff;
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
    transition: filter 0.15s ease;
}
.sm-retry:hover {
    filter: brightness(0.95);
}
.sm-list-enter-active,
.sm-list-move {
    transition: transform 0.25s ease, opacity 0.25s ease;
}
.sm-list-enter-from {
    opacity: 0;
    transform: translateY(6px);
}
@media (prefers-reduced-motion: reduce) {
    .sm-list-enter-active,
    .sm-list-move {
        transition: none;
    }
}
</style>
