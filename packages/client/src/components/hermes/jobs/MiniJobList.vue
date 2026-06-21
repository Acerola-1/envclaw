<script setup lang="ts">
import { useJobsStore } from '@/stores/hermes/jobs'

const props = defineProps<{
  selectedJobId: string | null
}>()

const emit = defineEmits<{
  select: [jobId: string | null]
}>()

const jobsStore = useJobsStore()

function getStatusLabel(job: any): string {
  // 优先使用 state 字段，兼容 status 字段
  const status = job.state || job.status || ''
  if (job.enabled === false) return '已禁用'
  const map: Record<string, string> = {
    active: '运行中',
    running: '运行中',
    paused: '已暂停',
    error: '异常',
    completed: '已完成',
    ready: '待执行',
    idle: '待执行',
    disabled: '已禁用',
    scheduled: '已调度',
  }
  return map[status] || '待执行'
}

function getStatusClass(job: any): string {
  const status = job.state || job.status || ''
  if (job.enabled === false) return 'status-paused'
  const map: Record<string, string> = {
    active: 'status-active',
    running: 'status-running',
    paused: 'status-paused',
    error: 'status-error',
    completed: 'status-completed',
    ready: 'status-idle',
    idle: 'status-idle',
  }
  return map[status] || 'status-idle'
}

function handleSelect(jobId: string) {
  emit('select', props.selectedJobId === jobId ? null : jobId)
}
</script>

<template>
  <div class="mini-job-list">
    <div v-if="jobsStore.jobs.length === 0" class="mini-job-empty">
      <span class="mini-job-empty-text">暂无定时任务</span>
    </div>
    <div v-for="job in jobsStore.jobs" :key="job.id" class="mini-job-item"
      :class="{ active: selectedJobId === (job.job_id || job.id) }" @click="handleSelect(job.job_id || job.id)">
      <div class="mini-job-info">
        <div class="mini-job-name">{{ job.name || '未命名任务' }}</div>
        <div class="mini-job-meta">
          <span :class="['mini-job-status', getStatusClass(job)]">
            {{ getStatusLabel(job) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.mini-job-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 4px 0;
}

.mini-job-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px 12px;
}

.mini-job-empty-text {
  font-size: 12px;
  color: $text-muted;
}

.mini-job-item {
  display: flex;
  align-items: center;
  gap: 10px;
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

.mini-job-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mini-job-name {
  font-size: 13px;
  font-weight: 500;
  color: $text-primary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mini-job-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mini-job-status {
  font-size: 11px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 4px;

  &.status-active,
  &.status-running {
    background: #dcfce7;
    color: #166534;
  }

  &.status-paused {
    background: #fef9c3;
    color: #854d0e;
  }

  &.status-error {
    background: #fee2e2;
    color: #991b1b;
  }

  &.status-completed {
    background: #dbeafe;
    color: #1e40af;
  }

  &.status-idle {
    background: #f3f4f6;
    color: #6b7280;
  }
}
</style>
