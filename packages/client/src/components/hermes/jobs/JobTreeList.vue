<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useJobsStore } from '@/stores/hermes/jobs'
import { listCronRuns } from '@/api/hermes/cron-history'
import type { RunEntry } from '@/api/hermes/cron-history'

const props = withDefaults(defineProps<{
  selectedJobId: string | null
  selectedRunKey: string | null
  maxItems?: number
  expanded?: boolean
}>(), {
  maxItems: Infinity,
  expanded: true,
})

const emit = defineEmits<{
  selectJob: [jobId: string]
  selectRun: [jobId: string, fileName: string, runTime: string]
  editJob: [jobId: string]
  createJob: []
}>()

const jobsStore = useJobsStore()

// ── 暖墨色板 ──
const inkGreen = '#7a9a7e'
const inkRed = '#c47a6a'
const inkBlue = '#5b7f95'

// 树形状态
const expandedJobs = ref<Set<string>>(new Set())
const jobRuns = ref<Map<string, RunEntry[]>>(new Map())
const loadingRuns = ref<Map<string, boolean>>(new Map())
const MAX_VISIBLE_RUNS = 30

const visibleJobs = computed(() => {
  const sorted = [...jobsStore.jobs].sort((a, b) => {
    const aTime = a.created_at || ''
    const bTime = b.created_at || ''
    return bTime.localeCompare(aTime)
  })
  return props.expanded ? sorted : sorted.slice(0, props.maxItems)
})

function getJobId(job: any): string {
  return job.job_id || job.id
}

function getStatusLabel(job: any): string {
  if (job.state === 'running') return '运行中'
  if (job.state === 'paused') return '已暂停'
  if (job.enabled === false) return '已禁用'
  return '已调度'
}

function getStatusClass(job: any): string {
  if (job.state === 'running') return 'info'
  if (job.state === 'paused') return 'warning'
  if (job.enabled === false) return 'error'
  return 'success'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

function formatRunTime(time: string): string {
  try {
    const d = new Date(time)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    return `${mm}/${dd} ${hh}:${mi}`
  } catch { return time }
}

// 判断执行记录状态
type RunStatus = 'running' | 'failed' | 'success'
function getRunStatus(job: any, runIndex: number): RunStatus {
  if (runIndex === 0) {
    if (job.state === 'running') return 'running'
    if (job.last_status === 'error') return 'failed'
  }
  return 'success'
}

function getRunStatusLabel(status: RunStatus): string {
  if (status === 'running') return '执行中'
  if (status === 'failed') return '失败'
  return '成功'
}

function getRunCount(job: any): number {
  const runs = jobRuns.value.get(getJobId(job))
  return runs ? runs.length : 0
}

async function toggleExpand(jobId: string, event: Event) {
  event.stopPropagation()
  if (expandedJobs.value.has(jobId)) {
    expandedJobs.value.delete(jobId)
  } else {
    expandedJobs.value.add(jobId)
    if (!jobRuns.value.has(jobId)) {
      await loadRuns(jobId)
    }
  }
}

async function loadRuns(jobId: string) {
  loadingRuns.value.set(jobId, true)
  try {
    const runs = await listCronRuns(jobId)
    jobRuns.value.set(jobId, runs.slice(0, MAX_VISIBLE_RUNS))
  } catch {
    jobRuns.value.set(jobId, [])
  } finally {
    loadingRuns.value.set(jobId, false)
  }
}

function handleJobClick(jobId: string) {
  emit('selectJob', jobId)
}

function handleRunClick(jobId: string, fileName: string, runTime: string) {
  emit('selectRun', jobId, fileName, runTime)
}

function handleEditClick(jobId: string, event: Event) {
  event.stopPropagation()
  emit('editJob', jobId)
}

// 初始自动展开第一个任务
watch(() => jobsStore.jobs, (jobs) => {
  if (jobs.length > 0 && expandedJobs.value.size === 0) {
    const firstId = getJobId(jobs[0])
    expandedJobs.value.add(firstId)
    loadRuns(firstId)
  }
}, { immediate: true })
</script>

<template>
  <div class="job-tree-list">
    <!-- 空状态 -->
    <div v-if="visibleJobs.length === 0" class="tree-empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"
        stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <span class="tree-empty-title">暂无定时任务</span>
      <span class="tree-empty-desc">创建你的第一个自动化值守任务</span>
      <button class="tree-empty-btn" @click="emit('createJob')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        创建任务
      </button>
    </div>

    <div v-for="job in visibleJobs" :key="getJobId(job)" class="tree-job-group">
      <!-- Job 行 -->
      <div
        class="tree-job-row"
        :class="{ active: selectedJobId === getJobId(job) }"
        @click="handleJobClick(getJobId(job))"
      >
        <span class="tree-arrow" @click="toggleExpand(getJobId(job), $event)">
          <svg v-if="expandedJobs.has(getJobId(job))" width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <svg v-else width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>

        <div class="tree-job-info">
          <span class="tree-job-name">{{ job.name || '未命名任务' }}</span>
          <span :class="['tree-job-status', getStatusClass(job)]">{{ getStatusLabel(job) }}</span>
        </div>

        <span v-if="getRunCount(job) > 0" class="tree-job-count">{{ getRunCount(job) }}</span>

        <span class="tree-job-settings" @click="handleEditClick(getJobId(job), $event)" title="编辑">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </span>
      </div>

      <!-- Run 行 -->
      <template v-if="expandedJobs.has(getJobId(job))">
        <div v-if="loadingRuns.get(getJobId(job))" class="tree-runs-loading">加载中...</div>
        <div v-else-if="getRunCount(job) === 0" class="tree-runs-empty">暂无运行记录</div>
        <div
          v-for="(run, i) in (jobRuns.get(getJobId(job)) || [])"
          :key="`${run.jobId}/${run.fileName}`"
          class="tree-run-row"
          :class="{
            active: selectedRunKey === `${run.jobId}/${run.fileName}`,
            'run-failed': getRunStatus(job, i) === 'failed',
            'run-running': getRunStatus(job, i) === 'running',
          }"
          @click="handleRunClick(run.jobId, run.fileName, run.runTime)"
        >
          <div class="run-strip"
            :class="{
              'strip-ok': getRunStatus(job, i) === 'success',
              'strip-err': getRunStatus(job, i) === 'failed',
              'strip-running': getRunStatus(job, i) === 'running',
            }"
          />
          <span class="tree-run-time">{{ formatRunTime(run.runTime) }}</span>
          <span class="tree-run-status-label">{{ getRunStatusLabel(getRunStatus(job, i)) }}</span>
          <span class="tree-run-size">{{ formatSize(run.size) }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

$ink-green: #7a9a7e;
$ink-red: #c47a6a;
$ink-blue: #5b7f95;
$warm-hover: #f2efeb;

.job-tree-list {
  display: flex;
  flex-direction: column;
  padding: 2px 0;
}

// ── 空状态 ──
.tree-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 12px;
  gap: 8px;
  color: $text-muted;

  svg {
    opacity: 0.25;
    margin-bottom: 4px;
  }
}

.tree-empty-title {
  font-size: 12px;
  color: $text-secondary;
  font-weight: 500;
}

.tree-empty-desc {
  font-size: 11px;
  color: $text-muted;
}

.tree-empty-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid #e8e4e0;
  background: #fcfbfa;
  color: $text-secondary;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: $warm-hover;
    color: $ink-blue;
    border-color: $ink-blue;
  }
}

// ── Job 分组 ──
.tree-job-group {
  display: flex;
  flex-direction: column;
}

.tree-job-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 10px;
  cursor: pointer;
  transition: background-color 0.15s ease;
  border-left: 3px solid transparent;

  &:hover {
    background: rgba(0, 0, 0, 0.03);
  }

  &.active {
    background: rgba(0, 0, 0, 0.04);
    border-left-color: $text-muted;
  }
}

.tree-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: $text-muted;
  cursor: pointer;

  &:hover {
    color: $text-primary;
  }
}

.tree-job-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.tree-job-name {
  font-size: 12px;
  font-weight: 500;
  color: $text-primary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-job-status {
  font-size: 10px;
  font-weight: 500;
  padding: 0px 5px;
  border-radius: 3px;
  width: fit-content;
  line-height: 1.5;

  &.success {
    background: rgba($ink-green, 0.1);
    color: $ink-green;
  }

  &.info {
    background: rgba($ink-blue, 0.1);
    color: $ink-blue;
  }

  &.warning {
    background: rgba(#c4a35a, 0.1);
    color: darken(#c4a35a, 10%);
  }

  &.error {
    background: rgba($ink-red, 0.1);
    color: $ink-red;
  }
}

// 执行计数 badge
.tree-job-count {
  font-size: 10px;
  font-weight: 500;
  color: $text-muted;
  background: rgba(0, 0, 0, 0.05);
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0 5px;
}

.tree-job-settings {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  color: $text-muted;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: all 0.15s;
  opacity: 0;

  .tree-job-row:hover & {
    opacity: 1;
  }

  &:hover {
    color: $ink-blue;
    background: rgba($ink-blue, 0.08);
  }
}

// ── Run 行 ──
.tree-run-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px 4px 28px;
  cursor: pointer;
  transition: background-color 0.15s ease;
  position: relative;

  &:hover {
    background: rgba(0, 0, 0, 0.02);
  }

  &.active {
    background: rgba($ink-blue, 0.06);
  }

  &.run-failed {
    background: rgba($ink-red, 0.04);

    &:hover {
      background: rgba($ink-red, 0.08);
    }
  }

  &.run-running {
    background: rgba($ink-blue, 0.03);
  }
}

// 2px 左边框状态色条
.run-strip {
  position: absolute;
  left: 12px;
  top: 4px;
  bottom: 4px;
  width: 2px;
  border-radius: 1px;

  &.strip-ok {
    background: $ink-green;
  }

  &.strip-err {
    background: $ink-red;
  }

  &.strip-running {
    background: $ink-blue;
    animation: strip-breathe 2s ease-in-out infinite;
  }
}

@keyframes strip-breathe {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.tree-run-time {
  font-size: 11px;
  color: $text-primary;
  font-family: $font-code;
  flex: 1;
  min-width: 0;
}

.tree-run-status-label {
  font-size: 10px;
  color: $text-muted;
  flex-shrink: 0;
}

.tree-run-size {
  font-size: 10px;
  color: $text-muted;
  background: rgba(0, 0, 0, 0.03);
  padding: 1px 5px;
  border-radius: 3px;
  flex-shrink: 0;
  font-family: $font-code;
}

.tree-runs-loading,
.tree-runs-empty {
  padding: 4px 8px 4px 28px;
  font-size: 11px;
  color: $text-muted;
}
</style>
