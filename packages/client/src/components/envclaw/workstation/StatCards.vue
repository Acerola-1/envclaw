<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useJobsStore } from '@/stores/hermes/jobs'

const { t } = useI18n()
const jobsStore = useJobsStore()

const runningCount = computed(() =>
  jobsStore.jobs.filter((j) => j.enabled && j.state !== 'paused').length,
)

// TODO: 成功率需要 cron-history API 支持,暂时标记为待接入
// const successRate = computed(() => '98%')
</script>

<template>
  <div class="stat-grid">
    <div class="stat-card">
      <div class="stat-top">
        <span class="stat-label">{{ t('envclaw.home.stats.runningTasks') }}</span>
        <div class="stat-ic blue">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4" />
          </svg>
        </div>
      </div>
      <div class="stat-val">{{ runningCount }}</div>
      <div class="stat-meta">{{ t('envclaw.home.stats.allNormal') }}</div>
    </div>

    <div class="stat-card pending">
      <div class="stat-top">
        <span class="stat-label">{{ t('envclaw.home.stats.successRate') }}</span>
        <span class="badge-soon">{{ t('envclaw.home.stats.pending') }}</span>
      </div>
      <div class="stat-val">—</div>
      <div class="stat-meta">{{ t('envclaw.home.stats.noData') }}</div>
    </div>

    <div class="stat-card pending">
      <div class="stat-top">
        <span class="stat-label">{{ t('envclaw.home.stats.pendingAlerts') }}</span>
        <span class="badge-soon">{{ t('envclaw.home.stats.pending') }}</span>
      </div>
      <div class="stat-val">—</div>
      <div class="stat-meta">{{ t('envclaw.home.stats.noData') }}</div>
    </div>

    <div class="stat-card pending">
      <div class="stat-top">
        <span class="stat-label">{{ t('envclaw.home.stats.todayCollection') }}</span>
        <span class="badge-soon">{{ t('envclaw.home.stats.pending') }}</span>
      </div>
      <div class="stat-val">—</div>
      <div class="stat-meta">{{ t('envclaw.home.stats.noData') }}</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 30px; }
.stat-card {
  background: var(--envclaw-bg-secondary); border: 1px solid var(--envclaw-border); border-radius: 12px; padding: 16px 18px;
  &.pending { opacity: 0.55; .stat-val { color: var(--envclaw-text-muted) !important; } }
}
.stat-top { display: flex; align-items: center; justify-content: space-between; }
.stat-label { font-size: 12px; color: var(--envclaw-text-secondary); }
.stat-ic {
  width: 30px; height: 30px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  &.blue { background: rgba(106,159,217,0.14); color: var(--envclaw-info); }
  &.green { background: rgba(102,187,106,0.14); color: var(--envclaw-success); }
}
.stat-val { font-size: 26px; font-weight: 650; margin-top: 10px; letter-spacing: -0.5px; }
.stat-meta { font-size: 11px; color: var(--envclaw-text-muted); margin-top: 3px; }
.badge-soon {
  font-size: 10px; padding: 1px 7px; border-radius: 9px;
  background: var(--envclaw-bg-tertiary); border: 1px solid var(--envclaw-border); color: var(--envclaw-text-muted);
}
</style>
