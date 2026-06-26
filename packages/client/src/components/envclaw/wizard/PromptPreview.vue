<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { PromptSegment } from '@/composables/envclaw/usePromptAssembly'

const { t } = useI18n()

const props = defineProps<{
  segments: PromptSegment[]
  supplement: string
}>()

const emit = defineEmits<{
  'update:supplement': [value: string]
}>()
</script>

<template>
  <div class="prompt-section">
    <!-- 已组装提示词（只读预览） -->
    <div class="prompt-assembled">
      <div
        v-for="(seg, i) in segments"
        :key="i"
        class="pa-seg"
      >
        <span :class="['pa-tag', seg.kind]">{{ seg.tag }}</span>
        <div class="pa-text">{{ seg.text }}</div>
      </div>
      <div v-if="segments.length === 0" class="pa-empty">
        {{ t('envclaw.wizard.promptEmpty') }}
      </div>
    </div>

    <!-- 补充说明（可编辑） -->
    <textarea
      class="prompt-supplement"
      :value="supplement"
      :placeholder="t('envclaw.wizard.supplementPlaceholder')"
      @input="emit('update:supplement', ($event.target as HTMLTextAreaElement).value)"
    />
    <div class="field-hint">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
        <path d="M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
      {{ t('envclaw.wizard.promptHint') }}
    </div>
  </div>
</template>

<style scoped lang="scss">
.prompt-section { display: flex; flex-direction: column; gap: 8px; }

.prompt-assembled {
  background: var(--envclaw-bg-primary); border: 1px solid var(--envclaw-border); border-radius: 8px;
  padding: 12px 13px; font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
  font-size: 12px; line-height: 1.7; color: var(--envclaw-text-secondary);
  max-height: 220px; overflow-y: auto;
  &::-webkit-scrollbar { width: 7px; }
  &::-webkit-scrollbar-thumb { background: var(--envclaw-border); border-radius: 6px; }
}

.pa-seg {
  margin-bottom: 11px; padding-left: 10px; border-left: 2px solid var(--envclaw-border-light);
  &:last-child { margin-bottom: 0; }
}

.pa-tag {
  display: inline-block; font-family: 'Inter', system-ui, sans-serif;
  font-size: 10px; font-weight: 600; padding: 1px 7px; border-radius: 8px; margin-bottom: 5px;
  &.base { background: rgba(106,159,217,0.14); color: var(--envclaw-info); }
  &.platform { background: rgba(224,164,88,0.14); color: var(--envclaw-warning); }
  &.function { background: rgba(102,187,106,0.14); color: var(--envclaw-success); }
}

.pa-text { color: var(--envclaw-text-secondary); white-space: pre-wrap; }

.pa-empty { color: var(--envclaw-text-muted); font-family: 'Inter', system-ui, sans-serif; font-size: 12px; text-align: center; padding: 14px; }

.prompt-supplement {
  width: 100%; padding: 10px 12px; background: var(--envclaw-input-bg); border: 1px solid var(--envclaw-input-border);
  border-radius: 8px; color: var(--envclaw-text-primary); font-size: 13px; font-family: 'Inter', system-ui, sans-serif;
  resize: vertical; min-height: 64px; line-height: 1.5;
  &:focus { outline: none; border-color: var(--envclaw-input-border-focus); }
}

.field-hint {
  font-size: 11px; color: var(--envclaw-text-muted); display: flex; align-items: center; gap: 5px;
}
</style>
