<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NTag, NSpin, useMessage } from 'naive-ui'
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
const showProperties = ref(false)
const showMoreMenu = ref(false)

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

function cronToText(expr: string): string {
  const parts = expr.trim().split(/\s+/)
  
  if (parts.length < 5) return expr

  const [minute, hour, dom, month, dow] = parts

  const hourNum = parseInt(hour)
  const minuteNum = parseInt(minute)

  // 每N分钟 */N * * * *
  if (minute.startsWith('*/')) {
    const n = parseInt(minute.slice(2))
    return `每 ${n} 分钟`
  }

  // 每N小时 0 */N * * *
  if (hour.startsWith('*/')) {
    const n = parseInt(hour.slice(2))
    const suffix = minuteNum > 0 ? `:${String(minuteNum).padStart(2, '0')}` : ''
    return `每 ${n} 小时${suffix}`
  }

  // 处理逗号分隔的小时（如 8,14）
  const hours = hour.split(',').map((h: string) => parseInt(h))
  const timeStr = hours.length > 1
    ? hours.map((h: number) => minuteNum > 0 ? `${h}:${String(minuteNum).padStart(2, '0')}` : `${h}点`).join('、')
    : minuteNum > 0 ? `${hourNum}:${String(minuteNum).padStart(2, '0')}` : `${hourNum}点`

  // 月初 0 9 1 * * 或 0 9 1 */N *
  if (dom !== '*' && month === '*') {
    const doms = dom.split(',').join('、')
    return `每月 ${doms} 号 ${timeStr}`
  }

  // 特定月份 0 9 1 1,4,7,10 *
  if (dom !== '*' && month !== '*') {
    const monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
    const m = month.split(',').map((v: string) => monthNames[parseInt(v) - 1] || v).join('、')
    return `每年 ${m} ${dom} 号 ${timeStr}`
  }

  // 星期
  if (dow !== '*') {
    const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const dows = dow.split(',').map((d: string) => weekNames[parseInt(d)] || d).join('、')
    if (dom === '*') return `每${dows} ${timeStr}`
    return `每${dows} ${timeStr}`
  }

  // 每天
  return `每天 ${timeStr}`
}

const scheduleText = computed(() => {
  if (!props.job) return '—'
  console.log(props.job.schedule_display);
  if (props.job.schedule_display) return cronToText(props.job.schedule_display)
  // if (props.job.schedule_display) return props.job.schedule_display
  // if (typeof props.job.schedule === 'string') return cronToText(props.job.schedule)
  // const sched = props.job.schedule as any
  // if (sched?.kind === 'cron' && sched?.expr) return cronToText(sched.expr)
  return scheduleToDisplayText(props.job.schedule, '—')
})

const repeatSummary = computed(() => {
  if (!props.job) return '—'
  const r = props.job.repeat
  if (typeof r === 'string') return r
  if (r && typeof r === 'object') {
    if (r.times === null) return '不限次数'
    return `${r.completed ?? 0} / ${r.times} 次`
  }
  return '—'
})

const deliverText = computed(() => {
  if (!props.job) return '—'
  return props.job.deliver || '未设置'
})

const originText = computed(() => {
  if (!props.job?.origin) return '—'
  const o = props.job.origin
  return o.chat_name ? `${o.platform} · ${o.chat_name}` : o.platform
})

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

function formatRunTime(time: string): string {
  try {
    const d = new Date(time)
    return d.toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    })
  } catch { return time }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

// 判断单条 run 的状态：依托 job.last_status 和 job.state
type RunStatus = 'success' | 'failed' | 'running'

function getRunStatus(_run: RunEntry, index: number): RunStatus {
  if (!props.job) return 'success'
  // 最新一条
  if (index === 0) {
    if (props.job.state === 'running') return 'running'
    if (props.job.last_status === 'error') return 'failed'
  }
  return 'success'
}

function getRunStatusLabel(status: RunStatus): string {
  if (status === 'running') return '运行中'
  if (status === 'failed') return '失败'
  return '成功'
}

const recentRuns = computed(() => runs.value)

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
    message.success('任务已加入执行队列')
    await fetchRuns()
  } catch (e: any) {
    message.error('触发失败: ' + (e.message || e))
  } finally {
    actionLoading.value = null
  }
}

function handleEdit() {
  if (!props.job) return
  showMoreMenu.value = false
  emit('edit', props.job.job_id || props.job.id)
}

async function handleDelete() {
  if (!props.job) return
  const jobId = props.job.job_id || props.job.id
  actionLoading.value = 'delete'
  showMoreMenu.value = false
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
  const runTime = formatRunTime(run.runTime)
  emit('selectRun', jobId, run.fileName, runTime)
}

// 关闭下拉菜单（点击外部）
function handleClickOutside() {
  showMoreMenu.value = false
}

watch(() => [props.job, props.profileKey], () => {
  fetchRuns()
}, { immediate: true })
</script>

<template>
  <div class="job-card" v-on-click-outside="handleClickOutside">
    <template v-if="job">
      <!-- 返回行 -->
      <div class="return-row">
        <button class="return-link" @click="emit('back')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          返回任务列表
        </button>
      </div>

      <!-- 吸顶操作栏 -->
      <div class="sticky-bar">
        <div class="sticky-left">
          <h2 class="sticky-title">{{ job.name || '未命名任务' }}</h2>
          <NTag :type="statusType" size="small" round>{{ statusLabel }}</NTag>
        </div>
        <div class="sticky-actions">
          <button class="oper-btn oper-btn--edit" @click="handleEdit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            编辑
          </button>
          <div class="more-wrapper">
            <button class="oper-btn oper-btn--more" @click="showMoreMenu = !showMoreMenu">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </button>
            <div v-if="showMoreMenu" class="more-dropdown">
              <button class="more-item more-item--danger" :disabled="!!actionLoading" @click="handleDelete">
                <NSpin v-if="actionLoading === 'delete'" :size="12" />
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                删除任务
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 主操作按钮 -->
      <div class="main-ops">
        <button class="main-btn main-btn--primary" :disabled="!!actionLoading" @click="handleRunNow">
          <NSpin v-if="actionLoading === 'run'" :size="14" />
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          立即执行
        </button>
        <button class="main-btn main-btn--secondary" :disabled="!!actionLoading" @click="handleTogglePause">
          <NSpin v-if="actionLoading === 'pause'" :size="14" />
          <svg v-else-if="isPaused" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
          {{ isPaused ? '恢复任务' : '暂停任务' }}
        </button>
      </div>

      <!-- 运行卡片 -->
      <div class="running-card">
        <!-- 描述 -->
        <!-- <p v-if="job.prompt_preview || job.prompt" class="rc-desc">
          {{ job.prompt_preview || (job.prompt.length > 200 ? job.prompt.slice(0, 200) + '…' : job.prompt) }}
        </p> -->

        <!-- 调度规则 + 下次执行 -->
        <div class="rc-meta">
          <div class="rc-meta-item">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            <span class="rc-meta-label">调度规则</span>
            <span class="rc-meta-value">{{ scheduleText }}</span>
          </div>
          <div class="rc-meta-item rc-meta-item--accent">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            <span class="rc-meta-label">下次执行</span>
            <span class="rc-meta-value">{{ formatTime(job.next_run_at) }}</span>
          </div>
          <div class="rc-meta-item">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            <span class="rc-meta-label">推送目标</span>
            <span class="rc-meta-value">{{ deliverText }}</span>
          </div>
        </div>

        <!-- 关联技能 -->
        <div v-if="job.skills && job.skills.length > 0" class="rc-skills">
          <span class="rc-skills-label">关联技能</span>
          <div class="rc-skills-list">
            <NTag v-for="skill in job.skills" :key="skill" size="small" round>{{ skill }}</NTag>
          </div>
        </div>

        <!-- 错误内嵌 -->
        <div v-if="job.last_error" class="rc-error">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>上次执行失败：{{ job.last_error }}</span>
        </div>
      </div>

      <!-- 任务属性（可折叠） -->
      <div class="props-section">
        <button class="props-toggle" @click="showProperties = !showProperties">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            class="props-chevron" :class="{ rotated: showProperties }">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span>任务属性</span>
          <span class="props-summary">{{ repeatSummary }} · {{ job.model || '默认模型' }} · {{ formatTime(job.created_at) }} 创建</span>
        </button>
        <div v-if="showProperties" class="props-grid">
          <div class="props-item">
            <span class="props-label">重复次数</span>
            <span class="props-value">{{ repeatSummary }}</span>
          </div>
          <div class="props-item">
            <span class="props-label">执行模型</span>
            <span class="props-value">{{ job.model || '默认模型' }}</span>
          </div>
          <div class="props-item">
            <span class="props-label">来源平台</span>
            <span class="props-value">{{ originText }}</span>
          </div>
          <div class="props-item">
            <span class="props-label">创建时间</span>
            <span class="props-value">{{ formatTime(job.created_at) }}</span>
          </div>
          <div class="props-item">
            <span class="props-label">上次执行</span>
            <span class="props-value">
              {{ formatTime(job.last_run_at) }}
              <NTag v-if="job.last_status" :type="job.last_status === 'ok' ? 'success' : 'error'" size="tiny" round>
                {{ job.last_status === 'ok' ? '成功' : '失败' }}
              </NTag>
            </span>
          </div>
        </div>
      </div>

      <!-- 执行记录 -->
      <div class="runs-section">
        <div class="runs-header">
          <span class="runs-title">执行记录</span>
          <span v-if="runs.length" class="runs-count">共 {{ runs.length }} 条</span>
        </div>
        <NSpin :show="loading">
          <div v-if="recentRuns.length === 0 && !loading" class="runs-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.3">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <p>暂无执行记录</p>
            <span>任务将在首次调度后产生执行记录</span>
          </div>
          <div v-else class="runs-list">
            <div
              v-for="(run, i) in recentRuns"
              :key="run.fileName"
              class="run-row"
              :class="{
                'run-row--failed': getRunStatus(run, i) === 'failed',
                'run-row--running': getRunStatus(run, i) === 'running',
              }"
              @click="getRunStatus(run, i) !== 'running' && handleRunClick(run)"
            >
              <div class="run-status">
                <span v-if="getRunStatus(run, i) === 'success'" class="run-dot run-dot--ok">✓</span>
                <span v-else-if="getRunStatus(run, i) === 'failed'" class="run-dot run-dot--err">✗</span>
                <span v-else class="run-dot run-dot--running">⟳</span>
              </div>
              <div class="run-info">
                <span class="run-info-time">{{ formatRunTime(run.runTime) }}</span>
                <span class="run-info-status">{{ getRunStatusLabel(getRunStatus(run, i)) }}</span>
              </div>
              <div class="run-meta">
                <span v-if="getRunStatus(run, i) === 'failed' && job.last_error" class="run-error-hint">{{ job.last_error }}</span>
                <span v-else-if="getRunStatus(run, i) === 'running'" class="run-progress">生成中…</span>
                <span v-else class="run-size">{{ formatSize(run.size) }}</span>
              </div>
              <div class="run-action">
                <template v-if="getRunStatus(run, i) === 'failed'">
                  <button class="run-retry-btn" @click.stop="handleRunNow">🔄 重试</button>
                </template>
                <template v-else-if="getRunStatus(run, i) === 'running'">
                  <!-- 不显示操作 -->
                </template>
                <template v-else>
                  <span class="run-view-link">查看详情 ▸</span>
                </template>
              </div>
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

// ── 色板 ──
$ink-green: #7a9a7e;
$ink-gold: #c4a35a;
$ink-red: #c47a6a;
$ink-blue: #5b7f95;
$warm-bg: #fcfbfa;
$warm-border: #e8e4e0;
$warm-hover: #f2efeb;

.job-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  background: $warm-bg;
}

// ── 返回行 ──
.return-row {
  padding: 10px 20px;
  flex-shrink: 0;
}

.return-link {
  display: inline-flex;
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
    background: rgba(0, 0, 0, 0.04);
  }
}

// ── 吸顶操作栏 ──
.sticky-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px 12px;
  position: sticky;
  top: 0;
  z-index: 2;
  background: $warm-bg;
  flex-shrink: 0;
}

.sticky-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.sticky-title {
  font-size: 18px;
  font-weight: 600;
  color: $text-primary;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sticky-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.oper-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid $warm-border;
  background: $warm-bg;
  color: $text-secondary;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: $warm-hover;
    border-color: darken($warm-border, 8%);
  }

  &--edit:hover {
    color: $ink-blue;
    border-color: $ink-blue;
    background: rgba($ink-blue, 0.06);
  }

  &--more {
    padding: 6px 8px;
    border: none;
  }
}

.more-wrapper {
  position: relative;
}

.more-dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  background: #fff;
  border: 1px solid $warm-border;
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  padding: 4px;
  z-index: 10;
  min-width: 120px;
}

.more-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: none;
  font-size: 12px;
  color: $text-secondary;
  cursor: pointer;
  border-radius: 6px;

  &:hover {
    background: $warm-hover;
  }

  &--danger {
    color: $ink-red;

    &:hover {
      background: rgba($ink-red, 0.08);
    }
  }
}

// ── 主操作按钮 ──
.main-ops {
  display: flex;
  gap: 8px;
  padding: 0 20px 16px;
  flex-shrink: 0;
}

.main-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  border: none;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &--primary {
    background: $ink-blue;
    color: #fff;

    &:hover:not(:disabled) {
      background: darken($ink-blue, 8%);
    }
  }

  &--secondary {
    background: $warm-bg;
    color: $text-secondary;
    border: 1px solid $warm-border;

    &:hover:not(:disabled) {
      background: $warm-hover;
      border-color: darken($warm-border, 8%);
    }
  }
}

// ── 运行卡片 ──
.running-card {
  margin: 0 20px 16px;
  padding: 16px 18px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  border: 1px solid $warm-border;
  flex-shrink: 0;
}

.rc-desc {
  font-size: 13px;
  color: $text-secondary;
  line-height: 1.6;
  margin: 0 0 14px;
}

.rc-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
}

.rc-meta-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;

  svg {
    flex-shrink: 0;
    opacity: 0.45;
  }

  &--accent {
    .rc-meta-value {
      color: $ink-blue;
      font-weight: 500;
    }
  }
}

.rc-meta-label {
  color: $text-muted;
  flex-shrink: 0;
  min-width: 64px;
}

.rc-meta-value {
  color: $text-primary;
}

.rc-skills {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.rc-skills-label {
  font-size: 12px;
  color: $text-muted;
  flex-shrink: 0;
  min-width: 64px;
}

.rc-skills-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.rc-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  background: rgba($ink-red, 0.06);
  border: 1px solid rgba($ink-red, 0.18);
  border-radius: 8px;
  color: darken($ink-red, 10%);
  font-size: 12px;
  line-height: 1.5;

  svg {
    flex-shrink: 0;
    margin-top: 1px;
  }
}

// ── 任务属性 ──
.props-section {
  margin: 0 20px 16px;
  flex-shrink: 0;
}

.props-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 0;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 12px;
  color: $text-muted;
  transition: color 0.15s;

  &:hover {
    color: $text-secondary;
  }
}

.props-chevron {
  flex-shrink: 0;
  transition: transform 0.15s ease;

  &.rotated {
    transform: rotate(90deg);
  }
}

.props-summary {
  color: $text-muted;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.props-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: $warm-border;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid $warm-border;
  margin-top: 8px;
}

.props-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: $warm-bg;
}

.props-label {
  font-size: 11px;
  color: $text-muted;
}

.props-value {
  font-size: 13px;
  color: $text-primary;
}

// ── 执行记录 ──
.runs-section {
  padding: 0 20px 20px;
  flex: 1;
  min-height: 0;
}

.runs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.runs-title {
  font-size: 13px;
  font-weight: 600;
  color: $text-primary;
}

.runs-count {
  font-size: 11px;
  color: $text-muted;
}

.runs-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  gap: 8px;

  p {
    font-size: 13px;
    color: $text-secondary;
    margin: 0;
  }

  span {
    font-size: 12px;
    color: $text-muted;
  }
}

.runs-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.run-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: rgba(0, 0, 0, 0.03);
  }

  &--failed {
    background: rgba($ink-red, 0.04);

    &:hover {
      background: rgba($ink-red, 0.08);
    }
  }

  &--running {
    cursor: default;
    background: rgba($ink-blue, 0.03);

    &:hover {
      background: rgba($ink-blue, 0.06);
    }
  }
}

.run-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  flex-shrink: 0;

  &--ok {
    background: rgba($ink-green, 0.12);
    color: $ink-green;
  }

  &--err {
    background: rgba($ink-red, 0.12);
    color: $ink-red;
  }

  &--running {
    background: rgba($ink-blue, 0.12);
    color: $ink-blue;
    animation: breathe 2s ease-in-out infinite;
  }
}

@keyframes breathe {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba($ink-blue, 0.4); }
  50% { opacity: 0.7; box-shadow: 0 0 0 6px rgba($ink-blue, 0); }
}

.run-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.run-info-time {
  font-size: 13px;
  font-weight: 500;
  color: $text-primary;
  font-family: $font-code;
}

.run-info-status {
  font-size: 11px;
  color: $text-muted;
}

.run-meta {
  flex-shrink: 0;
  min-width: 0;
  max-width: 180px;
}

.run-error-hint {
  font-size: 11px;
  color: $ink-red;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

.run-progress {
  font-size: 11px;
  color: $ink-blue;
}

.run-size {
  font-size: 11px;
  color: $text-muted;
  background: rgba(0, 0, 0, 0.03);
  padding: 1px 6px;
  border-radius: 4px;
}

.run-action {
  flex-shrink: 0;
}

.run-retry-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid $warm-border;
  background: #fff;
  color: $text-secondary;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: $ink-red;
    color: $ink-red;
    background: rgba($ink-red, 0.04);
  }
}

.run-view-link {
  font-size: 11px;
  color: $text-muted;
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
