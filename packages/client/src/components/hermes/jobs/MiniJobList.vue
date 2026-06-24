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
</style>
