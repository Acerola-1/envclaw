<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useMessage, useDialog, NButton, NTooltip, NSpin } from 'naive-ui'
import { useJobsStore } from '@/stores/hermes/jobs'
import type { Job } from '@/api/hermes/jobs'
import { scheduleToDisplayText } from '@/api/hermes/jobs'
import JobStatusPill from './JobStatusPill.vue'

const props = defineProps<{
  filter: 'all' | 'running' | 'paused' | 'error'
  searchQuery: string
}>()

const emit = defineEmits<{
  edit: [jobId: string]
}>()

const { t } = useI18n()
const router = useRouter()
const jobsStore = useJobsStore()
const message = useMessage()
const dialog = useDialog()

const filteredJobs = computed(() => {
  let result = jobsStore.jobs

  if (props.filter === 'running') {
    result = result.filter(j => j.enabled && j.state !== 'paused' && (j.last_status === null || j.last_status === 'ok'))
  } else if (props.filter === 'paused') {
    result = result.filter(j => j.state === 'paused' || !j.enabled)
  } else if (props.filter === 'error') {
    result = result.filter(j => j.last_status && j.last_status !== 'ok')
  }

  if (props.searchQuery) {
    const q = props.searchQuery.toLowerCase()
    result = result.filter(j => j.name.toLowerCase().includes(q))
  }

  return result
})

function formatTime(time: string | null): string {
  if (!time) return '—'
  const d = new Date(time)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatNextRun(time: string | null): string {
  if (!time) return '—'
  const d = new Date(time)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getJobId(job: Job): string {
  return job.job_id || job.id
}

function goToDetail(job: Job) {
  router.push({ name: 'envclaw.jobDetail', params: { jobId: getJobId(job) } })
}

async function handleRunNow(job: Job, e: MouseEvent) {
  e.stopPropagation()
  try {
    await jobsStore.runJob(getJobId(job))
    message.success(t('envclaw.jobs.runTriggered'))
  } catch (err: any) {
    message.error(t('envclaw.jobs.operationFailed') + `: ${err.message}`)
  }
}

async function handlePause(job: Job, e: MouseEvent) {
  e.stopPropagation()
  try {
    await jobsStore.pauseJob(getJobId(job))
    message.success(t('envclaw.jobs.paused'))
  } catch (err: any) {
    message.error(t('envclaw.jobs.operationFailed') + `: ${err.message}`)
  }
}

async function handleResume(job: Job, e: MouseEvent) {
  e.stopPropagation()
  try {
    await jobsStore.resumeJob(getJobId(job))
    message.success(t('envclaw.jobs.resumed'))
  } catch (err: any) {
    message.error(t('envclaw.jobs.operationFailed') + `: ${err.message}`)
  }
}

function handleEdit(job: Job, e: MouseEvent) {
  e.stopPropagation()
  emit('edit', getJobId(job))
}

function handleDelete(job: Job, e: MouseEvent) {
  e.stopPropagation()
  dialog.warning({
    title: t('envclaw.jobs.actions.delete'),
    content: t('envclaw.jobs.actions.deleteConfirm', { name: job.name }),
    positiveText: t('envclaw.jobs.actions.delete'),
    negativeText: 'Cancel',
    onPositiveClick: async () => {
      try {
        await jobsStore.deleteJob(getJobId(job))
        message.success(t('envclaw.jobs.deleted'))
      } catch (err: any) {
        message.error(t('envclaw.jobs.operationFailed') + `: ${err.message}`)
      }
    },
  })
}

function lastRunLabel(job: Job): string {
  if (!job.last_run_at) return '—'
  if (job.last_status === 'ok') return t('envclaw.jobs.lastRunSuccess')
  if (job.last_status) return t('envclaw.jobs.lastRunFailed')
  return '—'
}

function lastRunCls(job: Job): string {
  if (job.last_status === 'ok') return 'success'
  if (job.last_status) return 'failed'
  return ''
}

/** 将 deliver 字段映射为中文显示（列表只显示平台名称） */
function formatDeliver(deliver: string | null | undefined): string {
  if (!deliver) return '—'

  // 解析格式：platform:accountId 或 platform
  const parts = deliver.split(':')
  const platformKey = parts[0]

  // 获取平台中文名称
  return t(`envclaw.jobs.deliverChannels.${platformKey}`, platformKey)
}
</script>

<template>
  <NSpin :show="jobsStore.loading && jobsStore.jobs.length === 0">
    <div v-if="!jobsStore.loading && jobsStore.jobs.length === 0" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="empty-icon">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
      <p>{{ t('envclaw.jobs.noJobs') }}</p>
      <p class="hint">{{ t('envclaw.jobs.noJobsHint') }}</p>
    </div>

    <div v-else-if="filteredJobs.length === 0" class="empty-state">
      <p>{{ t('envclaw.jobs.noMatch') }}</p>
    </div>

    <div v-else class="job-table">
      <div class="table-header">
        <div class="col-name">{{ t('envclaw.jobs.columns.name') }}</div>
        <div class="col-schedule">{{ t('envclaw.jobs.columns.schedule') }}</div>
        <div class="col-deliver">{{ t('envclaw.jobs.columns.deliver') }}</div>
        <div class="col-last-run">{{ t('envclaw.jobs.columns.lastRun') }}</div>
        <div class="col-next-run">{{ t('envclaw.jobs.columns.nextRun') }}</div>
        <div class="col-status">{{ t('envclaw.jobs.columns.status') }}</div>
        <div class="col-actions" />
      </div>

      <div
        v-for="job in filteredJobs"
        :key="getJobId(job)"
        class="table-row"
        @click="goToDetail(job)"
      >
        <div class="col-name">
          <div class="job-identity">
            <div class="job-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div class="job-text">
              <span class="job-name">{{ job.name }}</span>
              <span v-if="job.skills && job.skills.length" class="scenario-tag">
                {{ t('envclaw.jobs.scenarioTag') }}: {{ job.skills.join(', ') }}
              </span>
            </div>
          </div>
        </div>

        <div class="col-schedule">
          <code class="mono">{{ scheduleToDisplayText(job.schedule, job.schedule_display || '—') }}</code>
        </div>

        <div class="col-deliver">
          <span class="deliver-text" :title="job.deliver || ''">{{ formatDeliver(job.deliver) }}</span>
        </div>

        <div class="col-last-run">
          <span class="time-text">{{ formatTime(job.last_run_at) }}</span>
          <span v-if="job.last_run_at" :class="['run-result', lastRunCls(job)]">{{ lastRunLabel(job) }}</span>
        </div>

        <div class="col-next-run">
          <span class="time-text">{{ formatNextRun(job.next_run_at) }}</span>
        </div>

        <div class="col-status">
          <JobStatusPill :state="job.state" :enabled="job.enabled" :last-status="job.last_status" />
        </div>

        <div class="col-actions" @click.stop>
          <NTooltip>
            <template #trigger>
              <NButton size="tiny" quaternary @click="handleRunNow(job, $event)">
                <template #icon>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                </template>
              </NButton>
            </template>
            {{ t('envclaw.jobs.actions.runNow') }}
          </NTooltip>
          <NTooltip v-if="job.state !== 'paused' && job.enabled">
            <template #trigger>
              <NButton size="tiny" quaternary @click="handlePause(job, $event)">
                <template #icon>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                </template>
              </NButton>
            </template>
            {{ t('envclaw.jobs.actions.pause') }}
          </NTooltip>
          <NTooltip v-else-if="job.state === 'paused' || !job.enabled">
            <template #trigger>
              <NButton size="tiny" quaternary @click="handleResume(job, $event)">
                <template #icon>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                </template>
              </NButton>
            </template>
            {{ t('envclaw.jobs.actions.resume') }}
          </NTooltip>
          <NTooltip>
            <template #trigger>
              <NButton size="tiny" quaternary @click="handleEdit(job, $event)">
                <template #icon>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                </template>
              </NButton>
            </template>
            {{ t('envclaw.jobs.actions.edit') }}
          </NTooltip>
          <NTooltip>
            <template #trigger>
              <NButton size="tiny" quaternary type="error" @click="handleDelete(job, $event)">
                <template #icon>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" /></svg>
                </template>
              </NButton>
            </template>
            {{ t('envclaw.jobs.actions.delete') }}
          </NTooltip>
        </div>
      </div>
    </div>
  </NSpin>
</template>

<style scoped lang="scss">
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--envclaw-text-muted);
  gap: 8px;

  .empty-icon { opacity: 0.3; margin-bottom: 8px; }
  p { font-size: 14px; }
  .hint { font-size: 12px; color: var(--envclaw-text-muted); }
}

.job-table {
  width: 100%;
}

.table-header {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  font-size: 11px;
  font-weight: 600;
  color: var(--envclaw-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--envclaw-border);
}

.table-row {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--envclaw-border);
  cursor: pointer;
  transition: background 0.15s;

  &:hover { background: var(--envclaw-bg-tertiary); }
  &:last-child { border-bottom: none; }
}

.col-name { flex: 2; min-width: 0; }
.col-schedule { flex: 1.2; min-width: 0; }
.col-deliver { flex: 0.8; min-width: 0; }
.col-last-run { flex: 1.2; min-width: 0; }
.col-next-run { flex: 0.8; min-width: 0; }
.col-status { flex: 0.7; min-width: 0; }
.col-actions { flex: 1; min-width: 0; display: flex; justify-content: flex-end; gap: 2px; }

.job-identity {
  display: flex;
  align-items: center;
  gap: 10px;
}

.job-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--envclaw-bg-tertiary);
  border: 1px solid var(--envclaw-border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--envclaw-text-secondary);
  flex-shrink: 0;
}

.job-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.job-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--envclaw-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scenario-tag {
  font-size: 11px;
  color: var(--envclaw-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mono {
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  color: var(--envclaw-text-secondary);
}

.deliver-text {
  font-size: 12px;
  color: var(--envclaw-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time-text {
  font-size: 12px;
  color: var(--envclaw-text-secondary);
}

.col-last-run {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.run-result {
  font-size: 11px;
  font-weight: 500;

  &.success { color: var(--envclaw-success); }
  &.failed { color: var(--envclaw-error); }
}
</style>
