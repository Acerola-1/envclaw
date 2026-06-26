<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NInput } from 'naive-ui'
import { useJobsStore } from '@/stores/hermes/jobs'
import JobListTable from '@/components/envclaw/jobs/JobListTable.vue'

const { t } = useI18n()
const jobsStore = useJobsStore()

const searchQuery = ref('')
const activeFilter = ref<'all' | 'running' | 'paused' | 'error'>('all')

const filters = [
  { key: 'all' as const },
  { key: 'running' as const },
  { key: 'paused' as const },
  { key: 'error' as const },
]

onMounted(() => {
  void jobsStore.fetchJobs()
})
</script>

<template>
  <div class="jobs-page">
    <div class="page-header">
      <h1>{{ t('envclaw.jobs.title') }}</h1>
      <p class="page-desc">{{ t('envclaw.jobs.description') }}</p>
    </div>

    <div class="toolbar">
      <div class="filter-tabs">
        <button
          v-for="f in filters"
          :key="f.key"
          :class="['filter-btn', { active: activeFilter === f.key }]"
          @click="activeFilter = f.key"
        >
          {{ t(`envclaw.jobs.filter${f.key.charAt(0).toUpperCase() + f.key.slice(1)}`) }}
        </button>
      </div>
      <div class="toolbar-right">
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
        <NButton type="primary" size="small">
          <template #icon>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </template>
          {{ t('envclaw.jobs.createTask') }}
        </NButton>
      </div>
    </div>

    <div class="table-container">
      <JobListTable :filter="activeFilter" :search-query="searchQuery" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.jobs-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 24px 28px;
  overflow-y: auto;
}

.page-header {
  margin-bottom: 20px;
  h1 { font-size: 20px; font-weight: 600; color: var(--envclaw-text-primary); }
  .page-desc { font-size: 13px; color: var(--envclaw-text-secondary); margin-top: 4px; }
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 12px;
}

.filter-tabs {
  display: flex;
  gap: 4px;
  background: var(--envclaw-bg-tertiary);
  border: 1px solid var(--envclaw-border);
  border-radius: 8px;
  padding: 3px;
}

.filter-btn {
  padding: 5px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--envclaw-text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: 0.15s;

  &:hover { color: var(--envclaw-text-primary); }
  &.active { background: var(--envclaw-button-bg); color: var(--envclaw-button-text); }
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-input {
  width: 220px;
}

.table-container {
  flex: 1;
  min-height: 0;
  background: var(--envclaw-bg-secondary);
  border: 1px solid var(--envclaw-border);
  border-radius: 12px;
  overflow-y: auto;
}
</style>
