<script setup lang="ts">
import type { DraftParams } from '@/stores/envclaw/duty'

const props = defineProps<{ params: DraftParams }>()
const emit = defineEmits<{ (e: 'create'): void; (e: 'confirm'): void }>()
</script>

<template>
  <div class="draft-card">
    <div class="draft-header">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
      <span>检测到值守任务意图</span>
    </div>
    <div class="draft-fields">
      <div class="draft-field"><span class="df-label">任务名</span><span class="df-value">{{ params.taskName }}</span></div>
      <div class="draft-field"><span class="df-label">能力</span><span class="df-value">{{ params.capabilities.join('、') }}</span></div>
      <div class="draft-field"><span class="df-label">调度</span><span class="df-value">{{ params.schedule }}</span></div>
      <div class="draft-field"><span class="df-label">推送</span><span class="df-value">{{ params.pushChannels.join('、') }}</span></div>
    </div>
    <div class="draft-actions">
      <button class="draft-btn primary" @click="emit('create')">创建为值守任务</button>
      <button class="draft-btn" @click="emit('confirm')">直接确认（跳过向导）</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;
.draft-card {
  border: 1px solid var(--accent-orange); border-radius: $radius-md;
  background: $bg-card; padding: 16px; max-width: 480px; margin: 8px 0;
}
.draft-header {
  display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: $text-primary; margin-bottom: 12px;
  svg { color: var(--accent-orange); }
}
.draft-fields { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.draft-field { display: flex; gap: 8px; font-size: 13px; }
.df-label { color: $text-muted; min-width: 48px; }
.df-value { color: $text-primary; }
.draft-actions { display: flex; gap: 8px; }
.draft-btn {
  padding: 8px 16px; border-radius: $radius-sm; font-size: 13px; cursor: pointer; border: 1px solid $border-color;
  background: $bg-card; color: $text-primary;
  &.primary { background: $accent-primary; color: #fff; border-color: $accent-primary; }
}
</style>
