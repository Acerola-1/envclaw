<script setup lang="ts">
import { ref, computed } from 'vue'
import { useJobsStore } from '@/stores/hermes/jobs'
import { listCronRuns } from '@/api/hermes/cron-history'
import type { RunEntry } from '@/api/hermes/cron-history'

const props = withDefaults(defineProps<{
  selectedJobId: string | null
  selectedRunKey: string | null  // 格式："jobId/fileName"
  maxItems?: number
  expanded?: boolean
}>(), {
  maxItems: Infinity,
  expanded: true,
})

const visibleJobs = computed(() =>
  props.expanded ? jobsStore.jobs : jobsStore.jobs.slice(0, props.maxItems)
)

const emit = defineEmits<{
  selectJob: [jobId: string]
  selectRun: [jobId: string, fileName: string, runTime: string]
  editJob: [jobId: string]
  createJob: []
}>()

const jobsStore = useJobsStore()

// 树形状态
const expandedJobs = ref<Set<string>>(new Set())
const jobRuns = ref<Map<string, RunEntry[]>>(new Map())
const loadingRuns = ref<Map<string, boolean>>(new Map())

const MAX_VISIBLE_RUNS = 10

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
</script>

<template>
  <div class="job-tree-list">
    <div v-if="visibleJobs.length === 0" class="tree-empty">
      <span>暂无定时任务</span>
    </div>

    <div v-for="job in visibleJobs" :key="getJobId(job)" class="tree-job-group">
      <!-- Job 行 -->
      <div
        class="tree-job-row"
        :class="{ active: selectedJobId === getJobId(job) }"
        @click="handleJobClick(getJobId(job))"
      >
        <!-- 展开箭头 -->
        <span class="tree-arrow" @click="toggleExpand(getJobId(job), $event)">
          <svg v-if="expandedJobs.has(getJobId(job))" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
          <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </span>

        <!-- Job 信息 -->
        <div class="tree-job-info">
          <span class="tree-job-name">{{ job.name || '未命名任务' }}</span>
          <span :class="['tree-job-status', getStatusClass(job)]">{{ getStatusLabel(job) }}</span>
        </div>

        <!-- 设置图标 -->
        <span class="tree-job-settings" @click="handleEditClick(getJobId(job), $event)" title="编辑">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </span>
      </div>

      <!-- Run 行（展开时显示） -->
      <template v-if="expandedJobs.has(getJobId(job))">
        <div v-if="loadingRuns.get(getJobId(job))" class="tree-runs-loading">
          加载中...
        </div>
        <div v-else-if="(jobRuns.get(getJobId(job)) || []).length === 0" class="tree-runs-empty">
          暂无运行记录
        </div>
        <div
          v-for="run in (jobRuns.get(getJobId(job)) || [])"
          :key="`${run.jobId}/${run.fileName}`"
          class="tree-run-row"
          :class="{ active: selectedRunKey === `${run.jobId}/${run.fileName}` }"
          @click="handleRunClick(run.jobId, run.fileName, run.runTime)"
        >
          <span class="tree-run-time">{{ run.runTime }}</span>
          <span class="tree-run-size">{{ formatSize(run.size) }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.job-tree-list {
  display: flex;
  flex-direction: column;
  padding: 4px 0;
}

.tree-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px 12px;
  font-size: 12px;
  color: $text-muted;
}

.tree-job-group {
  display: flex;
  flex-direction: column;
}

.tree-job-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background-color 0.15s ease;
  border-left: 3px solid transparent;

  &:hover {
    background: rgba(var(--accent-primary-rgb), 0.06);
  }

  &.active {
    background: rgba(var(--accent-primary-rgb), 0.1);
    border-left-color: var(--accent-primary);
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
  gap: 2px;
}

.tree-job-name {
  font-size: 13px;
  font-weight: 500;
  color: $text-primary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-job-status {
  font-size: 11px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 4px;
  width: fit-content;
  &.success {
    background: rgba(var(--success-rgb), 0.12);
    color: $success;
  }

  &.info {
    background: rgba(var(--accent-primary-rgb), 0.12);
    color: $accent-primary;
  }

  &.warning {
    background: rgba(var(--warning-rgb), 0.12);
    color: $warning;
  }

  &.error {
    background: rgba(var(--error-rgb), 0.12);
    color: $error;
  }
}

.tree-job-settings {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  color: $text-muted;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    color: $accent-primary;
    background: rgba(var(--accent-primary-rgb), 0.08);
  }
}

.tree-run-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px 6px 36px;
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background: rgba(var(--accent-primary-rgb), 0.04);
  }

  &.active {
    background: rgba(var(--accent-primary-rgb), 0.08);
  }
}

.tree-run-time {
  font-size: 12px;
  color: $text-secondary;
}

.tree-run-size {
  font-size: 11px;
  color: $text-muted;
  font-family: $font-code;
}

.tree-runs-loading,
.tree-runs-empty {
  padding: 6px 12px 6px 36px;
  font-size: 11px;
  color: $text-muted;
}
</style>
