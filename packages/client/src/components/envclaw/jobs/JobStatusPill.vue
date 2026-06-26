<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  state: string
  enabled: boolean
  lastStatus: string | null
}>()

const { t } = useI18n()

const pill = computed(() => {
  if (props.state === 'paused') return { label: t('envclaw.jobs.filterPaused'), cls: 'paused' }
  if (!props.enabled) return { label: t('envclaw.jobs.filterPaused'), cls: 'paused' }
  if (props.lastStatus && props.lastStatus !== 'ok') return { label: t('envclaw.jobs.filterError'), cls: 'error' }
  return { label: t('envclaw.jobs.filterRunning'), cls: 'running' }
})
</script>

<template>
  <span :class="['status-pill', pill.cls]">{{ pill.label }}</span>
</template>

<style scoped lang="scss">
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;

  &::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  &.running {
    background: rgba(102, 187, 106, 0.12);
    color: var(--envclaw-success);
    &::before { background: var(--envclaw-success); }
  }

  &.paused {
    background: rgba(224, 164, 88, 0.12);
    color: var(--envclaw-warning);
    &::before { background: var(--envclaw-warning); }
  }

  &.error {
    background: rgba(217, 106, 106, 0.12);
    color: var(--envclaw-error);
    &::before { background: var(--envclaw-error); }
  }
}
</style>
