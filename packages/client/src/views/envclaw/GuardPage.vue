<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { NInput, NSpin } from 'naive-ui'
import { useJobsStore } from '@/stores/hermes/jobs'
import type { Job } from '@/api/hermes/jobs'
import JobCardList from '@/components/hermes/guard/JobCardList.vue'

const { t } = useI18n()
const router = useRouter()
const jobsStore = useJobsStore()

const searchQuery = ref('')
const activeFilter = ref<'all' | 'running' | 'paused' | 'error'>('all')
const selectedJobId = ref<string | null>(null)

const filters = [
  { key: 'all' as const, labelKey: 'envclaw.jobs.filterAll' },
  { key: 'running' as const, labelKey: 'envclaw.jobs.filterRunning' },
  { key: 'paused' as const, labelKey: 'envclaw.jobs.filterPaused' },
  { key: 'error' as const, labelKey: 'envclaw.jobs.filterError' },
]

function getJobId(job: Job): string {
  return job.job_id || job.id
}

const filteredJobs = computed(() => {
  let result = jobsStore.jobs

  if (activeFilter.value === 'running') {
    result = result.filter(j =>
      j.enabled && j.state !== 'paused' && (j.last_status === null || j.last_status === 'ok')
    )
  } else if (activeFilter.value === 'paused') {
    result = result.filter(j => j.state === 'paused' || !j.enabled)
  } else if (activeFilter.value === 'error') {
    result = result.filter(j => j.last_status && j.last_status !== 'ok')
  }

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(j => j.name.toLowerCase().includes(q))
  }

  return result
})

const countAll = computed(() => jobsStore.jobs.length)
const countRunning = computed(() =>
  jobsStore.jobs.filter(j => j.enabled && j.state !== 'paused' && (j.last_status === null || j.last_status === 'ok')).length
)
const countPaused = computed(() =>
  jobsStore.jobs.filter(j => j.state === 'paused' || !j.enabled).length
)
const countError = computed(() =>
  jobsStore.jobs.filter(j => j.last_status && j.last_status !== 'ok').length
)

function handleSelect(jobId: string) {
  selectedJobId.value = selectedJobId.value === jobId ? null : jobId
}

function handleEdit(jobId: string) {
  router.push({ name: 'envclaw.jobDetail', params: { jobId } })
}

onMounted(() => {
  void jobsStore.fetchJobs()
})
</script>

<template>
  <div class="guard-page">
    <div class="page-header">
      <div>
        <h1>{{ t('envclaw.guard.title') }}</h1>
        <div class="page-sub">{{ t('envclaw.guard.description') }}</div>
      </div>
    </div>

    <div class="filter-bar">
      <div
        v-for="f in filters"
        :key="f.key"
        class="filter-pill"
        :class="{ active: activeFilter === f.key, [f.key]: activeFilter === f.key }"
        @click="activeFilter = f.key"
      >
        <span v-if="f.key !== 'all'" class="dot" :style="{ background: f.key === 'running' ? 'var(--success)' : f.key === 'paused' ? 'var(--warning)' : 'var(--error)' }"></span>
        {{ t(f.labelKey) }}
        <span class="num">
          {{ f.key === 'all' ? countAll : f.key === 'running' ? countRunning : f.key === 'paused' ? countPaused : countError }}
        </span>
      </div>

      <div class="filter-bar-right">
        <NInput
          v-model:value="searchQuery"
          :placeholder="t('envclaw.jobs.searchPlaceholder')"
          size="small"
          clearable
          class="search-input"
        >
          <template #prefix>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </template>
        </NInput>
      </div>
    </div>

    <NSpin :show="jobsStore.loading && jobsStore.jobs.length === 0">
      <div v-if="!jobsStore.loading && jobsStore.jobs.length === 0" class="empty-state">
        <p>{{ t('envclaw.jobs.noJobs') }}</p>
        <p class="empty-hint">{{ t('envclaw.jobs.noJobsHint') }}</p>
      </div>

      <div v-else-if="filteredJobs.length === 0" class="empty-state">
        {{ t('envclaw.jobs.noMatch') }}
      </div>

      <div v-else class="card-grid">
        <JobCardList
          v-for="job in filteredJobs"
          :key="getJobId(job)"
          :job="job"
          :selected="selectedJobId === getJobId(job)"
          @select="handleSelect"
          @edit="handleEdit"
        />
      </div>
    </NSpin>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.guard-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 24px 28px;
  overflow-y: auto;
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 20px;

  h1 {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: 0.2px;
  }

  .page-sub {
    color: var(--text-secondary);
    font-size: 13px;
    margin-top: 5px;
  }
}

.filter-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  flex-wrap: wrap;
  align-items: center;
}

.filter-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 24px;
  font-size: 13px;
  font-weight: 500;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  cursor: pointer;
  transition: 0.15s;
  user-select: none;

  &:hover {
    border-color: var(--border-strong, var(--border-color));
    color: var(--text-primary);
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .num {
    font-weight: 600;
    margin-left: 2px;
  }

  &.active {
    border-color: var(--accent-primary);
    background: rgba(var(--accent-primary-rgb), 0.10);
    color: var(--accent-primary);
  }

  &.active.running {
    border-color: var(--success);
    background: rgba(var(--success-rgb), 0.12);
    color: var(--success);
  }

  &.active.paused {
    border-color: var(--warning);
    background: rgba(var(--warning-rgb), 0.15);
    color: var(--warning);
  }

  &.active.error {
    border-color: var(--error);
    background: rgba(var(--error-rgb), 0.12);
    color: var(--error);
  }
}

.filter-bar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-input {
  width: 220px;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
  gap: 14px;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-muted);
  font-size: 14px;
}

.empty-hint {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 8px;
}
</style>