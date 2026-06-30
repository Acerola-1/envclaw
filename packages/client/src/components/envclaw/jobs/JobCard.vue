<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessage, useDialog, NTooltip } from 'naive-ui'
import type { Job } from '@/api/hermes/jobs'
import { scheduleToDisplayText } from '@/api/hermes/jobs'
import { useJobsStore } from '@/stores/hermes/jobs'

const props = defineProps<{
  job: Job
  selected?: boolean
}>()

const emit = defineEmits<{
  edit: [jobId: string]
  select: [jobId: string]
}>()

const { t } = useI18n()
const jobsStore = useJobsStore()
const message = useMessage()
const dialog = useDialog()

const jobId = computed(() => props.job.job_id || props.job.id)

// 状态映射：运行中 / 已暂停 / 异常 / 已调度
const statusInfo = computed(() => {
  if (props.job.state === 'paused' || !props.job.enabled) {
    return { label: t('envclaw.jobs.filterPaused'), cls: 'paused' }
  }
  if (props.job.last_status && props.job.last_status !== 'ok') {
    return { label: t('envclaw.jobs.filterError'), cls: 'error' }
  }
  if (props.job.state === 'running') {
    return { label: t('envclaw.jobs.filterRunning'), cls: 'running' }
  }
  return { label: t('jobs.status.scheduled'), cls: 'scheduled' }
})

const scheduleExpr = computed(() =>
  scheduleToDisplayText(props.job.schedule, props.job.schedule_display || '—')
)

// 推送渠道中文
function formatDeliver(deliver: string | null | undefined): string {
  if (!deliver) return '—'
  const key = deliver.split(':')[0]
  return t(`envclaw.jobs.deliverChannels.${key}`, key)
}

// 下次执行时间
function formatNextRun(time: string | null): string {
  if (!time) return '—'
  const d = new Date(time)
  const now = new Date()
  const todayStr = now.toDateString()
  const isToday = d.toDateString() === todayStr
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return isToday ? `今日 ${timeStr}` : timeStr
}

// 上次运行状态
function lastRunInfo(): { text: string; cls: string } {
  if (!props.job.last_run_at) return { text: '—', cls: '' }
  if (props.job.last_status === 'ok') return { text: t('envclaw.jobs.lastRunSuccess'), cls: 'success' }
  if (props.job.last_status) return { text: props.job.last_status, cls: 'error' }
  return { text: '—', cls: '' }
}

function handleCardClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.closest('.card-actions')) return
  emit('select', jobId.value)
}

async function handleRun(e: MouseEvent) {
  e.stopPropagation()
  try {
    await jobsStore.runJob(jobId.value)
    message.success(t('envclaw.jobs.runTriggered'))
  } catch (err: any) {
    message.error(t('envclaw.jobs.operationFailed') + `: ${err.message}`)
  }
}

async function handlePause(e: MouseEvent) {
  e.stopPropagation()
  try {
    await jobsStore.pauseJob(jobId.value)
    message.success(t('envclaw.jobs.paused'))
  } catch (err: any) {
    message.error(t('envclaw.jobs.operationFailed') + `: ${err.message}`)
  }
}

async function handleResume(e: MouseEvent) {
  e.stopPropagation()
  try {
    await jobsStore.resumeJob(jobId.value)
    message.success(t('envclaw.jobs.resumed'))
  } catch (err: any) {
    message.error(t('envclaw.jobs.operationFailed') + `: ${err.message}`)
  }
}

function handleEdit(e: MouseEvent) {
  e.stopPropagation()
  emit('edit', jobId.value)
}

function handleDelete(e: MouseEvent) {
  e.stopPropagation()
  dialog.warning({
    title: t('envclaw.jobs.actions.delete'),
    content: t('envclaw.jobs.actions.deleteConfirm', { name: props.job.name }),
    positiveText: t('envclaw.jobs.actions.delete'),
    negativeText: 'Cancel',
    onPositiveClick: async () => {
      try {
        await jobsStore.deleteJob(jobId.value)
        message.success(t('envclaw.jobs.deleted'))
      } catch (err: any) {
        message.error(t('envclaw.jobs.operationFailed') + `: ${err.message}`)
      }
    },
  })
}

const isPaused = computed(() => props.job.state === 'paused' || !props.job.enabled)
const hasError = computed(() => props.job.last_status && props.job.last_status !== 'ok')
</script>

<template>
  <div class="job-card" :class="{ selected }" @click="handleCardClick">
    <div class="card-head">
      <div class="card-title">{{ job.name }}</div>
      <span class="status-pill" :class="statusInfo.cls">
        <span class="pill-dot"></span>
        {{ statusInfo.label }}
      </span>
    </div>

    <div class="card-body">
      <div class="info-row">
        <span class="label">{{ t('jobs.info.schedule') }}</span>
        <span class="val mono">{{ scheduleExpr }}</span>
      </div>
      <div class="info-row">
        <span class="label">{{ t('envclaw.jobs.columns.deliver') }}</span>
        <span class="val">{{ formatDeliver(job.deliver) }}</span>
      </div>
      <div class="info-row">
        <span class="label">{{ t('envclaw.jobs.columns.nextRun') }}</span>
        <span class="val" :class="{ 'highlight-time': !!job.next_run_at }">{{ formatNextRun(job.next_run_at) }}</span>
      </div>
      <div class="info-row" v-if="job.last_run_at">
        <span class="label">{{ t('envclaw.jobs.columns.lastRun') }}</span>
        <span class="val" :class="lastRunInfo().cls">{{ lastRunInfo().text }}</span>
      </div>
    </div>

    <div class="card-actions">
      <NTooltip v-if="!isPaused && !hasError">
        <template #trigger>
          <button class="act-btn act-primary" @click="handleRun">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            {{ t('envclaw.jobs.actions.runNow') }}
          </button>
        </template>
        {{ t('jobs.action.triggerImmediately') }}
      </NTooltip>

      <NTooltip v-if="!isPaused && !hasError">
        <template #trigger>
          <button class="act-btn" @click="handlePause">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
            {{ t('envclaw.jobs.actions.pause') }}
          </button>
        </template>
        {{ t('envclaw.jobs.actions.pause') }}
      </NTooltip>

      <NTooltip v-else-if="isPaused">
        <template #trigger>
          <button class="act-btn act-primary" @click="handleResume">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            {{ t('envclaw.jobs.actions.resume') }}
          </button>
        </template>
        {{ t('envclaw.jobs.actions.resume') }}
      </NTooltip>

      <NTooltip>
        <template #trigger>
          <button class="act-btn" :class="{ 'act-danger': hasError }" @click="handleEdit">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            {{ hasError ? t('jobs.action.fix') : t('envclaw.jobs.actions.edit') }}
          </button>
        </template>
        {{ hasError ? t('jobs.action.fixJob') : t('envclaw.jobs.actions.edit') }}
      </NTooltip>

      <NTooltip>
        <template #trigger>
          <button class="act-btn act-danger" @click="handleDelete">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
            {{ t('envclaw.jobs.actions.delete') }}
          </button>
        </template>
        {{ t('envclaw.jobs.actions.delete') }}
      </NTooltip>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.job-card {
  background: var(--bg-card);
  border: 2px solid var(--border-color);
  border-radius: $radius-lg;
  padding: 18px 20px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
  position: relative;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);

  &:hover {
    border-color: var(--border-strong, var(--border-color));
    background: var(--bg-card-hover);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  &.selected {
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 1px var(--accent-primary), 0 4px 20px rgba(var(--accent-primary-rgb), 0.10);
  }
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
  gap: 10px;
}

.card-title {
  font-size: 14.5px;
  font-weight: 600;
  line-height: 1.4;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 11px;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;

  .pill-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
  }

  &.running {
    background: rgba(var(--success-rgb), 0.12);
    color: var(--success);
  }

  &.scheduled {
    background: rgba(var(--accent-primary-rgb), 0.10);
    color: var(--accent-primary);
  }

  &.paused {
    background: rgba(var(--warning-rgb), 0.15);
    color: var(--warning);
  }

  &.error {
    background: rgba(var(--error-rgb), 0.12);
    color: var(--error);
  }
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-bottom: 14px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;

  .label {
    color: var(--text-muted);
    min-width: 64px;
    flex-shrink: 0;
  }

  .val {
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .val.mono {
    font-family: $font-code;
    font-size: 12px;
  }

  .val.highlight-time {
    color: var(--success);
  }

  .val.success {
    color: var(--success);
  }

  .val.error {
    color: var(--error);
  }
}

.card-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  border-top: 1px solid var(--border-light);
  padding-top: 10px;
}

.act-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: $radius-sm;
  font-size: 11.5px;
  font-weight: 500;
  background: transparent;
  border: none;
  color: var(--accent-primary);
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;

  &:hover {
    background: rgba(var(--accent-primary-rgb), 0.10);
  }

  &.act-primary {
    color: var(--success);

    &:hover {
      background: rgba(var(--success-rgb), 0.12);
    }
  }

  &.act-danger {
    color: var(--error);

    &:hover {
      background: rgba(var(--error-rgb), 0.12);
    }
  }
}
</style>