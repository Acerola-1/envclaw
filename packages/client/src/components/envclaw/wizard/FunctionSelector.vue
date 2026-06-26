<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

export interface FunctionItem {
  id: string
  name: string
  prompt: string
}

const props = defineProps<{
  functions: FunctionItem[]
  modelValue: string[] /** 已选功能 ID 列表 */
}>()

const emit = defineEmits<{
  'update:modelValue': [ids: string[]]
}>()

function toggle(id: string) {
  const current = [...props.modelValue]
  const idx = current.indexOf(id)
  if (idx >= 0) {
    current.splice(idx, 1)
  } else {
    current.push(id)
  }
  emit('update:modelValue', current)
}

function isSelected(id: string): boolean {
  return props.modelValue.includes(id)
}
</script>

<template>
  <div class="function-selector">
    <div v-if="functions.length === 0" class="func-empty">
      {{ t('envclaw.wizard.selectPlatformFirst') }}
    </div>
    <div
      v-for="fn in functions"
      :key="fn.id"
      :class="['func-card', { sel: isSelected(fn.id) }]"
      @click="toggle(fn.id)"
    >
      <div class="func-check">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <div class="func-info">
        <h5>{{ fn.name }}</h5>
        <p>{{ fn.prompt }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.func-empty {
  padding: 14px; border: 1px dashed var(--envclaw-border); border-radius: 8px;
  font-size: 12px; color: var(--envclaw-text-muted); text-align: center;
}

.func-card {
  display: flex; align-items: flex-start; gap: 11px;
  padding: 12px 13px; background: var(--envclaw-bg-tertiary); border: 1px solid var(--envclaw-border);
  border-radius: 8px; cursor: pointer; margin-bottom: 8px; transition: 0.15s;
  &:hover { border-color: var(--envclaw-border-light); }
  &.sel { border-color: var(--envclaw-success); background: rgba(102,187,106,0.14); }
}

.func-check {
  width: 18px; height: 18px; border-radius: 5px;
  border: 1.5px solid var(--envclaw-border-light); display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; margin-top: 1px; color: transparent; transition: 0.15s;
  .func-card.sel & { background: var(--envclaw-success); border-color: var(--envclaw-success); color: var(--envclaw-button-text); }
}

.func-info {
  h5 { font-size: 13px; font-weight: 600; }
  p { font-size: 11.5px; color: var(--envclaw-text-muted); margin-top: 3px; line-height: 1.5; }
}
</style>
