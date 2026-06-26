<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSpin, NEmpty } from 'naive-ui'
import type { RunEntry } from '@/api/hermes/cron-history'

const props = defineProps<{
  runs: RunEntry[]
  loading: boolean
  selectedKey: string | null
  jobNameMap: Record<string, string>
  filterJobId: string | null
}>()

const emit = defineEmits<{
  select: [run: RunEntry]
}>()

const { t } = useI18n()

function getJobName(jobId: string): string {
  return props.jobNameMap[jobId] || jobId
}

function formatDateLabel(time: string): string {
  const d = new Date(time)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const runDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())

  if (runDate.getTime() === today.getTime()) return t('envclaw.history.today')
  if (runDate.getTime() === yesterday.getTime()) return t('envclaw.history.yesterday')
  return d.toLocaleDateString()
}

function formatTime(time: string): string {
  return new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function runKey(run: RunEntry): string {
  return `${run.jobId}/${run.fileName}`
}

const groupedRuns = computed(() => {
  const groups: Record<string, RunEntry[]> = {}
  for (const run of props.runs) {
    const date = formatDateLabel(run.runTime)
    if (!groups[date]) groups[date] = []
    groups[date].push(run)
  }
  const entries = Object.entries(groups)
  return entries.reverse()
})
</script>

<template>
  <NSpin :show="loading && runs.length === 0">
    <NEmpty v-if="!loading && runs.length === 0" :description="t('envclaw.history.noRecords')" class="empty" />

    <div v-else class="record-list">
      <div v-for="[date, dateRuns] in groupedRuns" :key="date" class="date-group">
        <div class="date-label">{{ date }}</div>
        <div
          v-for="run in dateRuns"
          :key="runKey(run)"
          :class="['record-item', { selected: selectedKey === runKey(run) }]"
          @click="emit('select', run)"
        >
          <div class="record-main">
            <span v-if="!filterJobId" class="record-job-name">{{ getJobName(run.jobId) }}</span>
            <span class="record-time">{{ formatTime(run.runTime) }}</span>
          </div>
          <div class="record-meta">
            <span class="record-size">{{ run.size > 1024 ? `${(run.size / 1024).toFixed(1)}KB` : `${run.size}B` }}</span>
          </div>
        </div>
      </div>
    </div>
  </NSpin>
</template>

<style scoped lang="scss">
.empty {
  padding: 60px 0;
}

.record-list {
  padding: 4px 0;
}

.date-group {
  margin-bottom: 8px;
}

.date-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--envclaw-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  padding: 8px 12px 4px;
}

.record-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.15s;
  border-radius: 6px;
  margin: 0 4px;

  &:hover { background: var(--envclaw-bg-tertiary); }
  &.selected { background: rgba(106, 159, 217, 0.1); }
}

.record-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.record-job-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--envclaw-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-time {
  font-size: 11px;
  color: var(--envclaw-text-muted);
}

.record-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.record-size {
  font-size: 11px;
  color: var(--envclaw-text-muted);
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
}
</style>
