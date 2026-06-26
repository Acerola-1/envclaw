<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useJobsStore } from '@/stores/hermes/jobs'
import { scheduleToDisplayText } from '@/api/hermes/jobs'
import type { Job } from '@/api/hermes/jobs'

const { t } = useI18n()
const jobsStore = useJobsStore()

const emit = defineEmits<{
  selectJob: [job: Job]
}>()

/** 取前 5 条活跃(非 disabled)任务 */
const activeJobs = computed(() =>
  jobsStore.jobs
    .filter((j) => j.enabled)
    .slice(0, 5),
)

function statusPill(job: Job) {
  if (job.state === 'paused') return { class: 'pill-pause', label: t('envclaw.home.tasks.paused') }
  return { class: 'pill-run', label: t('envclaw.home.tasks.running') }
}

function scheduleDisplay(job: Job): string {
  return job.schedule_display || scheduleToDisplayText(job.schedule) || ''
}
</script>

<template>
  <div class="section">
    <div class="section-head">
      <div class="section-title">{{ t('envclaw.home.tasks.title') }}</div>
      <router-link :to="{ name: 'envclaw.jobs' }" class="section-link">
        {{ t('envclaw.home.tasks.viewAll') }}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </router-link>
    </div>

    <div v-if="activeJobs.length === 0" class="empty">—</div>

    <div v-else class="task-list">
      <div
        v-for="job in activeJobs"
        :key="job.job_id || job.id"
        class="task-row"
        @click="emit('selectJob', job)"
      >
        <div class="task-ic color-blue">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <path d="M3 11v2a1 1 0 0 0 1 1h3l4 4V6L7 10H4a1 1 0 0 0-1 1Z" />
            <path d="M16 8a5 5 0 0 1 0 8" />
          </svg>
        </div>
        <div class="task-main">
          <h4>{{ job.name }}</h4>
          <div class="task-meta">
            <span>{{ scheduleDisplay(job) }}</span>
            <span v-if="job.last_run_at">
              {{ t('envclaw.home.tasks.lastRun', { time: job.last_run_at }) }}
            </span>
          </div>
        </div>
        <div class="task-right">
          <span :class="['pill', statusPill(job).class]">{{ statusPill(job).label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.section { margin-bottom: 30px; }
.section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.section-title { font-size: 14px; font-weight: 600; }
.section-link { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--envclaw-text-secondary); text-decoration: none; &:hover { color: var(--envclaw-text-primary); } }
.empty { color: var(--envclaw-text-muted); font-size: 13px; padding: 20px 0; }

.task-list { display: flex; flex-direction: column; gap: 8px; }
.task-row {
  display: flex; align-items: center; gap: 14px; background: var(--envclaw-bg-secondary);
  border: 1px solid var(--envclaw-border); border-radius: 8px; padding: 13px 16px;
  cursor: pointer; transition: 0.15s;
  &:hover { border-color: var(--envclaw-border-light); }
}
.task-ic {
  width: 36px; height: 36px; border-radius: 9px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  &.color-blue { background: rgba(106,159,217,0.14); color: var(--envclaw-info); }
}
.task-main { flex: 1; min-width: 0; }
h4 { font-size: 13px; font-weight: 500; }
.task-meta { display: flex; gap: 16px; margin-top: 5px; span { font-size: 11.5px; color: var(--envclaw-text-muted); } }
.task-right { display: flex; align-items: center; }

.pill {
  display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px;
  border-radius: 11px; font-size: 11px; font-weight: 500;
  &::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  &.pill-run { background: rgba(102,187,106,0.14); color: var(--envclaw-success); }
  &.pill-pause { background: rgba(224,164,88,0.14); color: var(--envclaw-warning); }
}
</style>
