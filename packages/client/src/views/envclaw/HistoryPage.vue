<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSelect } from 'naive-ui'
import { listCronRuns } from '@/api/hermes/cron-history'
import type { RunEntry } from '@/api/hermes/cron-history'
import { useJobsStore } from '@/stores/hermes/jobs'
import RunRecordList from '@/components/envclaw/history/RunRecordList.vue'
import RunDetailPanel from '@/components/envclaw/history/RunDetailPanel.vue'

const { t } = useI18n()
const jobsStore = useJobsStore()

const runs = ref<RunEntry[]>([])
const runsLoading = ref(false)
const selectedRun = ref<RunEntry | null>(null)
const filterJobId = ref<string | null>(null)

const jobNameMap = computed(() => {
  const map: Record<string, string> = {}
  for (const job of jobsStore.jobs) {
    const id = job.job_id || job.id
    map[id] = job.name
  }
  return map
})

const jobOptions = computed(() => {
  const options: { label: string; value: string }[] = []
  for (const job of jobsStore.jobs) {
    const id = job.job_id || job.id
    options.push({ label: job.name, value: id })
  }
  return options
})

const selectedRunKey = computed(() => {
  if (!selectedRun.value) return null
  return `${selectedRun.value.jobId}/${selectedRun.value.fileName}`
})

async function fetchRuns() {
  runsLoading.value = true
  try {
    runs.value = await listCronRuns(filterJobId.value ?? undefined)
  } catch {
    runs.value = []
  } finally {
    runsLoading.value = false
  }
}

function handleSelectRun(run: RunEntry) {
  selectedRun.value = run
}

onMounted(async () => {
  if (jobsStore.jobs.length === 0) {
    await jobsStore.fetchJobs()
  }
  await fetchRuns()
})

watch(filterJobId, () => {
  selectedRun.value = null
  void fetchRuns()
})
</script>

<template>
  <div class="history-page">
    <div class="page-header">
      <h1>{{ t('envclaw.history.title') }}</h1>
      <p class="page-desc">{{ t('envclaw.history.description') }}</p>
    </div>

    <div class="toolbar">
      <NSelect
        v-model:value="filterJobId"
        :options="jobOptions"
        :placeholder="t('envclaw.history.selectTask')"
        size="small"
        clearable
        class="task-filter"
      />
    </div>

    <div class="history-split">
      <div class="split-left">
        <RunRecordList
          :runs="runs"
          :loading="runsLoading"
          :selected-key="selectedRunKey"
          :job-name-map="jobNameMap"
          :filter-job-id="filterJobId"
          @select="handleSelectRun"
        />
      </div>
      <div class="split-divider" />
      <div class="split-right">
        <RunDetailPanel :run="selectedRun" :job-name-map="jobNameMap" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.history-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 24px 28px;
  overflow: hidden;
}

.page-header {
  margin-bottom: 16px;
  flex-shrink: 0;
  h1 { font-size: 20px; font-weight: 600; color: var(--envclaw-text-primary); }
  .page-desc { font-size: 13px; color: var(--envclaw-text-secondary); margin-top: 4px; }
}

.toolbar {
  margin-bottom: 16px;
  flex-shrink: 0;
}

.task-filter {
  width: 240px;
}

.history-split {
  flex: 1;
  display: flex;
  min-height: 0;
  background: var(--envclaw-bg-secondary);
  border: 1px solid var(--envclaw-border);
  border-radius: 12px;
  overflow: hidden;
}

.split-left {
  width: 320px;
  flex-shrink: 0;
  overflow-y: auto;
  padding: 8px;
}

.split-divider {
  width: 1px;
  background: var(--envclaw-border);
  flex-shrink: 0;
}

.split-right {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
}
</style>
