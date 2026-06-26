<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NSpin, NButton, NEmpty } from 'naive-ui'
import { useJobsStore } from '@/stores/hermes/jobs'
import type { Job } from '@/api/hermes/jobs'
import { scheduleToDisplayText } from '@/api/hermes/jobs'
import { listCronRuns, readCronRun } from '@/api/hermes/cron-history'
import type { RunEntry, RunDetail } from '@/api/hermes/cron-history'
import MarkdownRenderer from '@/components/hermes/chat/MarkdownRenderer.vue'
import JobStatusPill from '@/components/envclaw/jobs/JobStatusPill.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const jobsStore = useJobsStore()

const job = ref<Job | null>(null)
const loading = ref(true)
const runs = ref<RunEntry[]>([])
const runsLoading = ref(false)
const expandedRun = ref<string | null>(null)
const runContent = ref<Record<string, string>>({})
const runContentLoading = ref<Record<string, boolean>>({})

const jobId = computed(() => route.params.jobId as string)

async function loadJob() {
  loading.value = true
  try {
    if (jobsStore.jobs.length === 0) {
      await jobsStore.fetchJobs()
    }
    const found = jobsStore.jobs.find(j => (j.job_id || j.id) === jobId.value)
    if (found) {
      job.value = found
    } else {
      job.value = null
    }
  } catch {
    job.value = null
  } finally {
    loading.value = false
  }
}

async function loadRuns() {
  runsLoading.value = true
  try {
    runs.value = await listCronRuns(jobId.value)
  } catch {
    runs.value = []
  } finally {
    runsLoading.value = false
  }
}

async function toggleRunExpand(run: RunEntry) {
  const key = `${run.jobId}/${run.fileName}`
  if (expandedRun.value === key) {
    expandedRun.value = null
    return
  }
  expandedRun.value = key
  if (runContent.value[key] || runContentLoading.value[key]) return

  runContentLoading.value[key] = true
  try {
    const detail: RunDetail = await readCronRun(run.jobId, run.fileName)
    runContent.value[key] = detail.content
  } catch {
    runContent.value[key] = t('envclaw.detail.loadOutputFailed')
  } finally {
    runContentLoading.value[key] = false
  }
}

function formatDate(time: string): string {
  return new Date(time).toLocaleDateString()
}

function goBack() {
  router.push({ name: 'envclaw.jobs' })
}

function repeatLabel(repeat: Job['repeat']): string {
  if (!repeat) return t('envclaw.detail.infinite')
  if (typeof repeat === 'string') return repeat
  if (repeat.times === null || repeat.times === undefined) return t('envclaw.detail.infinite')
  return `${repeat.completed || 0} / ${repeat.times}`
}

/** 将 deliver 字段映射为中文显示（详情页显示完整信息） */
function formatDeliver(deliver: string | null | undefined): string {
  if (!deliver) return '—'

  // 解析格式：platform:accountId 或 platform
  const parts = deliver.split(':')
  const platformKey = parts[0]

  // 获取平台中文名称
  const channelName = t(`envclaw.jobs.deliverChannels.${platformKey}`, platformKey)

  // 详情页显示完整信息：平台名 + 账号ID
  if (parts.length > 1 && parts[1]) {
    return `${channelName} · ${parts[1]}`
  }

  return channelName
}

// Group runs by date
const groupedRuns = computed(() => {
  const groups: Record<string, RunEntry[]> = {}
  for (const run of runs.value) {
    const date = formatDate(run.runTime)
    if (!groups[date]) groups[date] = []
    groups[date].push(run)
  }
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
})

onMounted(() => {
  void loadJob()
  void loadRuns()
})

watch(jobId, () => {
  void loadJob()
  void loadRuns()
  expandedRun.value = null
  runContent.value = {}
})
</script>

<template>
  <div class="detail-page">
    <NSpin :show="loading">
      <div v-if="!loading && !job" class="not-found">
        <NEmpty :description="t('envclaw.detail.notFound')" />
        <NButton size="small" @click="goBack">{{ t('envclaw.detail.backToList') }}</NButton>
      </div>

      <template v-else-if="job">
        <!-- Header -->
        <div class="detail-header">
          <button class="back-btn" @click="goBack">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {{ t('envclaw.detail.backToList') }}
          </button>
          <div class="header-center">
            <h1>{{ job.name }}</h1>
            <JobStatusPill :state="job.state" :enabled="job.enabled" :last-status="job.last_status" />
          </div>
          <div class="header-right">
            <NButton type="primary" size="small" disabled>
              <template #icon>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </template>
              {{ t('envclaw.detail.taskChat') }}
            </NButton>
            <span class="coming-soon-badge">{{ t('envclaw.detail.taskChatComingSoon') }}</span>
          </div>
        </div>

        <div class="detail-body">
          <!-- Left: Config -->
          <div class="config-section">
            <h2 class="section-title">{{ t('envclaw.detail.taskConfig') }}</h2>
            <div class="config-grid">
              <div class="config-item">
                <span class="config-label">{{ t('envclaw.detail.config.name') }}</span>
                <span class="config-value">{{ job.name }}</span>
              </div>
              <div class="config-item">
                <span class="config-label">{{ t('envclaw.detail.config.schedule') }}</span>
                <code class="config-value mono">{{ scheduleToDisplayText(job.schedule, job.schedule_display || '—') }}</code>
              </div>
              <div class="config-item">
                <span class="config-label">{{ t('envclaw.detail.config.enabled') }}</span>
                <span :class="['config-value', job.enabled ? 'text-success' : 'text-warning']">
                  {{ job.enabled ? t('envclaw.detail.enabled') : t('envclaw.detail.disabled') }}
                </span>
              </div>
              <div class="config-item">
                <span class="config-label">{{ t('envclaw.detail.config.model') }}</span>
                <span class="config-value">{{ job.model || '—' }}</span>
              </div>
              <div class="config-item">
                <span class="config-label">{{ t('envclaw.detail.config.deliver') }}</span>
                <span class="config-value" :title="job.deliver || ''">{{ formatDeliver(job.deliver) }}</span>
              </div>
              <div class="config-item">
                <span class="config-label">{{ t('envclaw.detail.config.repeat') }}</span>
                <span class="config-value">{{ repeatLabel(job.repeat) }}</span>
              </div>
              <div v-if="job.origin" class="config-item">
                <span class="config-label">{{ t('envclaw.detail.config.origin') }}</span>
                <span class="config-value">{{ job.origin.platform }} — {{ job.origin.chat_name }}</span>
              </div>
              <div class="config-item full-width">
                <span class="config-label">{{ t('envclaw.detail.config.skills') }}</span>
                <span class="config-value">
                  <template v-if="job.skills && job.skills.length">
                    <span v-for="skill in job.skills" :key="skill" class="skill-tag">{{ skill }}</span>
                  </template>
                  <template v-else>{{ t('envclaw.detail.noSkills') }}</template>
                </span>
              </div>
              <div class="config-item full-width">
                <span class="config-label">{{ t('envclaw.detail.config.prompt') }}</span>
                <pre class="config-value prompt-preview">{{ job.prompt_preview || job.prompt || '—' }}</pre>
              </div>
            </div>
          </div>

          <!-- Right: Run History -->
          <div class="history-section">
            <h2 class="section-title">{{ t('envclaw.detail.runHistory') }}</h2>
            <NSpin :show="runsLoading && runs.length === 0">
              <div v-if="!runsLoading && runs.length === 0" class="no-history">
                {{ t('envclaw.detail.noHistory') }}
              </div>
              <div v-else class="run-list">
                <div v-for="[date, dateRuns] in groupedRuns" :key="date" class="date-group">
                  <div class="date-label">{{ date }}</div>
                  <div
                    v-for="run in dateRuns"
                    :key="`${run.jobId}/${run.fileName}`"
                    :class="['run-item', { expanded: expandedRun === `${run.jobId}/${run.fileName}` }]"
                  >
                    <div class="run-header" @click="toggleRunExpand(run)">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="expand-arrow">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                      <span class="run-time">{{ new Date(run.runTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span>
                      <span class="run-size">{{ run.size > 1024 ? `${(run.size / 1024).toFixed(1)}KB` : `${run.size}B` }}</span>
                    </div>
                    <div v-if="expandedRun === `${run.jobId}/${run.fileName}`" class="run-content">
                      <NSpin v-if="runContentLoading[`${run.jobId}/${run.fileName}`]" size="small" />
                      <MarkdownRenderer
                        v-else-if="runContent[`${run.jobId}/${run.fileName}`]"
                        :content="runContent[`${run.jobId}/${run.fileName}`]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </NSpin>
          </div>
        </div>
      </template>
    </NSpin>
  </div>
</template>

<style scoped lang="scss">
.detail-page {
  height: 100%;
  overflow-y: auto;
  padding: 24px 28px;
}

.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px 0;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  gap: 16px;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--envclaw-text-secondary);
  background: transparent;
  border: 1px solid var(--envclaw-border);
  cursor: pointer;
  transition: 0.15s;

  &:hover { background: var(--envclaw-bg-tertiary); color: var(--envclaw-text-primary); }
}

.header-center {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;

  h1 { font-size: 18px; font-weight: 600; color: var(--envclaw-text-primary); }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.coming-soon-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 9px;
  background: var(--envclaw-bg-tertiary);
  border: 1px dashed var(--envclaw-border-light);
  color: var(--envclaw-text-muted);
}

.detail-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.config-section, .history-section {
  background: var(--envclaw-bg-secondary);
  border: 1px solid var(--envclaw-border);
  border-radius: 12px;
  padding: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--envclaw-text-primary);
  margin-bottom: 16px;
}

.config-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 4px;

  &.full-width { grid-column: 1 / -1; }
}

.config-label {
  font-size: 11px;
  color: var(--envclaw-text-muted);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.config-value {
  font-size: 13px;
  color: var(--envclaw-text-primary);

  &.mono {
    font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 12px;
  }

  &.text-success { color: var(--envclaw-success); }
  &.text-warning { color: var(--envclaw-warning); }
}

.skill-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  background: var(--envclaw-bg-tertiary);
  border: 1px solid var(--envclaw-border);
  color: var(--envclaw-text-secondary);
  margin-right: 4px;
  margin-bottom: 4px;
}

.prompt-preview {
  font-size: 12px;
  color: var(--envclaw-text-secondary);
  background: var(--envclaw-bg-primary);
  border: 1px solid var(--envclaw-border);
  border-radius: 8px;
  padding: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  margin: 0;
}

.no-history {
  padding: 40px 0;
  text-align: center;
  color: var(--envclaw-text-muted);
  font-size: 13px;
}

.run-list {
  max-height: 500px;
  overflow-y: auto;
}

.date-group {
  margin-bottom: 12px;
}

.date-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--envclaw-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  padding: 4px 0;
  margin-bottom: 4px;
}

.run-item {
  border: 1px solid var(--envclaw-border);
  border-radius: 8px;
  margin-bottom: 4px;
  overflow: hidden;

  &.expanded { border-color: var(--envclaw-border-light); }
}

.run-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover { background: var(--envclaw-bg-tertiary); }
}

.expand-arrow {
  color: var(--envclaw-text-muted);
  transition: transform 0.15s;
  .run-item.expanded & { transform: rotate(180deg); }
}

.run-time {
  font-size: 12px;
  color: var(--envclaw-text-secondary);
  flex: 1;
}

.run-size {
  font-size: 11px;
  color: var(--envclaw-text-muted);
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
}

.run-content {
  padding: 12px;
  border-top: 1px solid var(--envclaw-border);
  background: var(--envclaw-bg-primary);
  max-height: 300px;
  overflow-y: auto;
}
</style>
