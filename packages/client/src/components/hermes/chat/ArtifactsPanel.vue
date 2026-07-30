<script setup lang="ts">
import type { Artifact, ArtifactGroup } from "@/composables/useArtifacts";
import { downloadFile, getDownloadUrl } from "@/api/hermes/download";
import { formatChatTimestamp } from "@/utils/chat-timestamp";
import { computed, ref } from "vue";
import { useMessage } from "naive-ui";

const props = defineProps<{
  groups: ArtifactGroup[];
  visible: boolean;
}>();

const emit = defineEmits<{
  close: [];
  scrollToMessage: [messageId: string];
}>();

const toast = useMessage();
const previewUrl = ref<string | null>(null);

const totalCount = computed(() =>
  props.groups.reduce((s, g) => s + g.artifacts.length, 0),
);

function getUrl(item: Artifact): string {
  return getDownloadUrl(item.path, item.name);
}

function handlePreview(item: Artifact) {
  previewUrl.value = getUrl(item);
}

function handleDownload(item: Artifact) {
  toast.info("下载中…");
  downloadFile(item.path, item.name).catch((err: Error) => {
    toast.error(err.message || "下载失败");
  });
}

function handleScrollToMessage(messageId: string) {
  emit("scrollToMessage", messageId);
}

function handleOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    previewUrl.value = null;
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") previewUrl.value = null;
}

function getIcon(item: Artifact): string {
  return item.type === "image" ? "🖼" : "📄";
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="previewUrl"
      class="artifact-preview-overlay"
      @click="handleOverlayClick"
      @keydown="handleKeydown"
    >
      <img :src="previewUrl" class="artifact-preview-img" />
    </div>
  </Teleport>

  <aside v-if="visible" class="artifacts-panel">
    <div class="artifacts-header">
      <span class="artifacts-title">产物列表 ({{ totalCount }})</span>
      <button class="artifacts-close-btn" @click="emit('close')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
    <div class="artifacts-content">
      <template v-if="groups.length > 0">
        <div
          v-for="group in groups"
          :key="group.messageId"
          class="artifact-group"
        >
          <button
            class="artifact-group-header"
            @click="handleScrollToMessage(group.messageId)"
          >
            <span class="artifact-group-icon">📋</span>
            <span class="artifact-group-label">回复</span>
            <span class="artifact-group-time">{{ formatChatTimestamp(group.timestamp) }}</span>
          </button>
          <div class="artifact-items">
            <div
              v-for="item in group.artifacts"
              :key="item.path"
              class="artifact-item"
              :class="{ clickable: item.type === 'image' }"
              @click="item.type === 'image' ? handlePreview(item) : handleDownload(item)"
            >
              <span class="artifact-item-icon">{{ getIcon(item) }}</span>
              <span class="artifact-item-name">{{ item.name }}</span>
              <span class="artifact-item-ext">{{ item.extension }}</span>
            </div>
          </div>
        </div>
      </template>
      <div v-else class="artifacts-empty">暂无产物</div>
    </div>
  </aside>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.artifacts-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: $bg-card;
  border-left: 1px solid $border-color;
  width: 360px;
  flex-shrink: 0;
  overflow: hidden;

  @media (max-width: $breakpoint-mobile) {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(360px, 86vw);
    z-index: 8;
    box-shadow: -4px 0 16px rgba(0, 0, 0, 0.12);
  }
}

.artifacts-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid $border-color;
  flex-shrink: 0;
}

.artifacts-title {
  font-size: 13px;
  font-weight: 600;
  color: $text-primary;
}

.artifacts-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: $text-muted;
  cursor: pointer;
  border-radius: $radius-sm;
  padding: 0;

  &:hover {
    color: $text-secondary;
    background: rgba(0, 0, 0, 0.06);
  }
}

.artifacts-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.artifact-group {
  margin-bottom: 4px;
}

.artifact-group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 14px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  color: $text-secondary;

  &:hover {
    background: rgba(0, 0, 0, 0.03);
  }
}

.artifact-group-icon {
  flex-shrink: 0;
  font-size: 12px;
}

.artifact-group-label {
  flex-shrink: 0;
  font-weight: 500;
}

.artifact-group-time {
  color: $text-muted;
}

.artifact-items {
  // empty block - grouping indent only
}

.artifact-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px 6px 32px;
  font-size: 12px;
  color: $text-primary;
  cursor: pointer;
  border-radius: 0;

  &:hover {
    background: rgba(0, 0, 0, 0.04);
  }
}

.artifact-item-icon {
  flex-shrink: 0;
  font-size: 14px;
}

.artifact-item-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artifact-item-ext {
  flex-shrink: 0;
  font-size: 10px;
  color: $text-muted;
  background: rgba(0, 0, 0, 0.04);
  padding: 1px 5px;
  border-radius: 4px;
  text-transform: uppercase;
}

.artifacts-empty {
  padding: 32px 14px;
  text-align: center;
  font-size: 13px;
  color: $text-muted;
}

.artifact-preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.artifact-preview-img {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 4px;
}
</style>
