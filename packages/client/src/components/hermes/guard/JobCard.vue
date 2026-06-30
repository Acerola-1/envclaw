<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NTag, NTooltip, NSpin, useMessage } from 'naive-ui'
import { listCronRuns } from '@/api/hermes/cron-history'
import type { RunEntry } from '@/api/hermes/cron-history'
import { pauseJob, resumeJob, runJob, deleteJob, scheduleToDisplayText } from '@/api/hermes/jobs'
import type { Job } from '@/api/hermes/jobs'
import { useJobsStore } from '@/stores/hermes/jobs'

const props = defineProps<{
  job: Job | null
  profileKey: string
  showHeader?: boolean
}>()

const emit = defineEmits<{
  edit: [jobId: string]
  back: []
  selectRun: [jobId: string, fileName: string, runTime: string]
  deleted: [jobId: string]
}>()

const message = useMessage()
const jobsStore = useJobsStore()
const loading = ref(false)
const runs = ref<RunEntry[]>([])
const actionLoading = ref<string | null>(null)

// --- 状态相关 ---
const statusLabel = computed(() => {
  if (!props.job) return ''
  if (props.job.state === 'running') return '运行中'
  if (props.job.state === 'paused') return '已暂停'
  if (!props.job.enabled) return '已禁用'
  return '已调度'
})

const statusType = computed(() => {
  if (!props.job) return 'default'
  if (props.job.state === 'running') return 'info' as const
  if (props.job.state === 'paused') return 'warning' as const
  if (!props.job.enabled) return 'error' as const
  return 'success' as const
})

const isPaused = computed(() => {
  if (!props.job) return false
  return props.job.enabled === false || props.job.state === 'paused'
})

// --- 调度显示 ---
const scheduleText = computed(() => {
  if (!props.job) return '—'
  return scheduleToDisplayText(props.job.schedule, props.job.schedule_display || '—')
})

// --- 重复次数 ---
const repeatText = computed(() => {
  if (!props.job) return '—'
  const r = props.job.repeat
  if (typeof r === 'string') return r
  if (r && typeof r === 'object') {
    if (r.times === null) return '不限次数'
    return `${r.completed ?? 0} / ${r.times} 次`
  }
  return '—'
})

// --- 推送目标 ---
const deliverText = computed(() => {
  if (!props.job) return '—'
  return props.job.deliver || '未设置'
})

// --- 来源平台 ---
const originText = computed(() => {
  if (!props.job?.origin) return '—'
  const o = props.job.origin
  return o.chat_name ? `${o.platform} · ${o.chat_name}` : o.platform
})

// --- 格式化时间 ---
function formatTime(time: string | null | undefined): string {
  if (!time) return '—'
  try {
    const d = new Date(time)
    return d.toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return time }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

// --- 运行历史 ---
const recentRuns = computed(() => runs.value.slice(0, 5))

async function fetchRuns() {
  if (!props.job) return
  loading.value = true
  try {
    runs.value = await listCronRuns(props.job.job_id || props.job.id)
  } catch {
    runs.value = []
  } finally {
    loading.value = false
  }
}

// --- 操作 ---
async function handleTogglePause() {
  if (!props.job) return
  const jobId = props.job.job_id || props.job.id
  actionLoading.value = 'pause'
  try {
    if (isPaused.value) {
      await resumeJob(jobId)
      message.success('任务已恢复')
    } else {
      await pauseJob(jobId)
      message.success('任务已暂停')
    }
    await jobsStore.fetchJobs()
  } catch (e: any) {
    message.error('操作失败: ' + (e.message || e))
  } finally {
    actionLoading.value = null
  }
}

async function handleRunNow() {
  if (!props.job) return
  const jobId = props.job.job_id || props.job.id
  actionLoading.value = 'run'
  try {
    await runJob(jobId)
    message.success('任务已加入执行队列，将在 60 秒内执行')
    await fetchRuns()
  } catch (e: any) {
    message.error('触发失败: ' + (e.message || e))
  } finally {
    actionLoading.value = null
  }
}

function handleEdit() {
  if (!props.job) return
  emit('edit', props.job.job_id || props.job.id)
}

async function handleDelete() {
  if (!props.job) return
  const jobId = props.job.job_id || props.job.id
  actionLoading.value = 'delete'
  try {
    await deleteJob(jobId)
    message.success('任务已删除')
    emit('deleted', jobId)
    await jobsStore.fetchJobs()
  } catch (e: any) {
    message.error('删除失败: ' + (e.message || e))
  } finally {
    actionLoading.value = null
  }
}

function handleRunClick(run: RunEntry) {
  if (!props.job) return
  const jobId = props.job.job_id || props.job.id
  const runTime = new Date(run.runTime).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
  emit('selectRun', jobId, run.fileName, runTime)
}

watch(() => [props.job, props.profileKey], () => {
  fetchRuns()
}, { immediate: true })
</script>

<template>
  <div class="job-card">
    <template v-if="job">
      <!-- 顶部操作栏 -->
      <div class="card-topbar">
        <button class="topbar-back" @click="emit('back')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          返回
        </button>
        <div class="topbar-actions">
          <NTooltip trigger="hover">
            <template #trigger>
              <button class="action-btn" :disabled="!!actionLoading" @click="handleTogglePause">
                <NSpin v-if="actionLoading === 'pause'" :size="14" />
                <svg v-else-if="isPaused" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              </button>
            </template>
            {{ isPaused ? '恢复任务' : '暂停任务' }}
          </NTooltip>
          <NTooltip trigger="hover">
            <template #trigger>
              <button class="action-btn" :disabled="!!actionLoading" @click="handleRunNow">
                <NSpin v-if="actionLoading === 'run'" :size="14" />
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              </button>
            </template>
            立即执行
          </NTooltip>
          <NTooltip trigger="hover">
            <template #trigger>
              <button class="action-btn" @click="handleEdit">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            </template>
            编辑任务
          </NTooltip>
          <NTooltip trigger="hover">
            <template #trigger>
              <button class="action-btn action-btn--danger" :disabled="!!actionLoading" @click="handleDelete">
                <NSpin v-if="actionLoading === 'delete'" :size="14" />
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </template>
            删除任务
          </NTooltip>
        </div>
      </div>

      <!-- 任务头部 -->
      <div v-if="showHeader !== false" class="card-header">
        <div class="header-title-row">
          <h2 class="card-title">{{ job.name || '未命名任务' }}</h2>
          <NTag :type="statusType" size="small" round>{{ statusLabel }}</NTag>
        </div>
        <p v-if="job.prompt_preview || job.prompt" class="card-desc">
          {{ job.prompt_preview || (job.prompt.length > 120 ? job.prompt.slice(0, 120) + '…' : job.prompt) }}
        </p>
      </div>

      <!-- 信息网格 -->
      <div class="card-body">
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">调度规则</span>
            <span class="info-value">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {{ scheduleText }}
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">重复次数</span>
            <span class="info-value">{{ repeatText }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">执行模型</span>
            <span class="info-value">{{ job.model || '默认模型' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">推送目标</span>
            <span class="info-value">{{ deliverText }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">来源平台</span>
            <span class="info-value">{{ originText }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">创建时间</span>
            <span class="info-value">{{ formatTime(job.created_at) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">上次执行</span>
            <span class="info-value">
              {{ formatTime(job.last_run_at) }}
              <NTag v-if="job.last_status" :type="job.last_status === 'ok' ? 'success' : 'error'" size="tiny"
                round>
                {{ job.last_status === 'ok' ? '成功' : '失败' }}
              </NTag>
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">下次执行</span>
            <span class="info-value highlight">{{ formatTime(job.next_run_at) }}</span>
          </div>
        </div>

        <!-- 上次错误 -->
        <div v-if="job.last_error" class="error-banner">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span class="error-text">{{ job.last_error }}</span>
        </div>

        <!-- 技能标签 -->
        <div v-if="job.skills && job.skills.length > 0" class="skills-section">
          <span class="section-label">关联技能</span>
          <div class="skills-list">
            <NTag v-for="skill in job.skills" :key="skill" size="small" round>{{ skill }}</NTag>
          </div>
        </div>
      </div>

      <!-- 运行历史 -->
      <div class="card-footer">
        <div class="section-header">
          <span class="section-title">最近运行</span>
          <span v-if="runs.length" class="section-count">{{ runs.length }} 条记录</span>
        </div>
        <NSpin :show="loading">
          <div v-if="recentRuns.length === 0 && !loading" class="empty-runs">
            <span class="empty-text">暂无运行记录</span>
          </div>
          <div v-else class="runs-list">
            <div v-for="run in recentRuns" :key="run.fileName" class="run-row" @click="handleRunClick(run)">
              <div class="run-left">
                <span class="run-time">{{ formatTime(run.runTime) }}</span>
                <span class="run-size">{{ formatSize(run.size) }}</span>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                class="run-arrow">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </div>
        </NSpin>
      </div>
    </template>

    <!-- 空状态 -->
    <template v-else>
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
          stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        <p>请从左侧选择一个任务查看详情</p>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.job-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  background: var(--bg-primary, #fff);
}

// ── 顶部操作栏 ──
.card-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid $border-light;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--bg-primary, #fff);
}

.topbar-back {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: $text-muted;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.15s;

  &:hover {
    color: $text-primary;
    background: rgba(var(--accent-primary-rgb), 0.06);
  }
}

.topbar-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid $border-light;
  background: var(--bg-primary, #fff);
  color: $text-secondary;
  cursor: pointer;
  transition: all 0.15s;

  &:hover:not(:disabled) {
    border-color: var(--accent-primary);
    color: var(--accent-primary);
    background: rgba(var(--accent-primary-rgb), 0.04);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &--danger:hover:not(:disabled) {
    border-color: #ef4444;
    color: #ef4444;
    background: #fef2f2;
  }
}

// ── 头部 ──
.card-header {
  padding: 20px 20px 16px;
  flex-shrink: 0;
}

.header-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: $text-primary;
  margin: 0;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-desc {
  font-size: 13px;
  color: $text-muted;
  line-height: 1.6;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

// ── 信息网格 ──
.card-body {
  padding: 0 20px 16px;
  flex-shrink: 0;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: $border-light;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid $border-light;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  background: var(--bg-primary, #fff);
}

.info-label {
  font-size: 11px;
  font-weight: 500;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.info-value {
  font-size: 13px;
  color: $text-primary;
  display: flex;
  align-items: center;
  gap: 6px;
  word-break: break-all;

  svg {
    flex-shrink: 0;
    opacity: 0.5;
  }

  &.highlight {
    color: var(--accent-primary);
    font-weight: 500;
  }
}

// ── 错误横幅 ──
.error-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 12px;
  padding: 10px 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #991b1b;

  svg {
    flex-shrink: 0;
    margin-top: 1px;
  }
}

.error-text {
  font-size: 12px;
  line-height: 1.5;
  word-break: break-all;
}

// ── 技能标签 ──
.skills-section {
  margin-top: 12px;
}

.section-label {
  font-size: 11px;
  font-weight: 500;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  display: block;
  margin-bottom: 8px;
}

.skills-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

// ── 运行历史 ──
.card-footer {
  padding: 16px 20px 20px;
  flex: 1;
  min-height: 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: $text-primary;
}

.section-count {
  font-size: 11px;
  color: $text-muted;
}

.empty-runs {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.empty-text {
  font-size: 13px;
  color: $text-muted;
}

.runs-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.run-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: rgba(var(--accent-primary-rgb), 0.06);

    .run-arrow {
      opacity: 1;
      transform: translateX(2px);
    }
  }
}

.run-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.run-time {
  font-size: 13px;
  font-weight: 500;
  color: $text-secondary;
  font-family: $font-code;
}

.run-size {
  font-size: 11px;
  color: $text-muted;
  background: rgba(255, 255, 255, 0.05);
  padding: 1px 6px;
  border-radius: 4px;
}

.run-arrow {
  color: $text-muted;
  opacity: 0.4;
  transition: all 0.2s;
}

// ── 空状态 ──
.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: $text-muted;

  svg {
    opacity: 0.3;
  }

  p {
    font-size: 14px;
    margin: 0;
  }
}
</style>
