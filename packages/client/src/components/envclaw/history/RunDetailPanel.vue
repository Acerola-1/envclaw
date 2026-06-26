<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSpin } from 'naive-ui'
import { readCronRun } from '@/api/hermes/cron-history'
import type { RunEntry, RunDetail } from '@/api/hermes/cron-history'
import MarkdownRenderer from '@/components/hermes/chat/MarkdownRenderer.vue'

const props = defineProps<{
  run: RunEntry | null
  jobNameMap: Record<string, string>
}>()

const { t } = useI18n()
const content = ref('')
const loading = ref(false)

async function loadContent() {
  if (!props.run) {
    content.value = ''
    return
  }
  loading.value = true
  try {
    const detail: RunDetail = await readCronRun(props.run.jobId, props.run.fileName)
    content.value = detail.content
  } catch {
    content.value = t('envclaw.history.loadOutputFailed')
  } finally {
    loading.value = false
  }
}

watch(() => props.run, loadContent, { immediate: true })

function getJobName(jobId: string): string {
  return props.jobNameMap[jobId] || jobId
}

function formatTime(time: string): string {
  return new Date(time).toLocaleString()
}
</script>

<template>
  <div class="detail-panel">
    <div v-if="!run" class="no-selection">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="empty-icon">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
      <p>{{ t('envclaw.history.noDetail') }}</p>
    </div>

    <template v-else>
      <div class="detail-header">
        <div class="detail-title">
          <span class="job-name">{{ getJobName(run.jobId) }}</span>
          <span class="run-time">{{ formatTime(run.runTime) }}</span>
        </div>
        <span class="file-size">{{ run.size > 1024 ? `${(run.size / 1024).toFixed(1)}KB` : `${run.size}B` }}</span>
      </div>

      <div class="detail-body">
        <NSpin :show="loading">
          <div v-if="content" class="output-content">
            <MarkdownRenderer :content="content" />
          </div>
        </NSpin>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.detail-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.no-selection {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--envclaw-text-muted);
  gap: 12px;

  .empty-icon { opacity: 0.3; }
  p { font-size: 13px; }
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--envclaw-border);
  flex-shrink: 0;
}

.detail-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.job-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--envclaw-text-primary);
}

.run-time {
  font-size: 12px;
  color: var(--envclaw-text-muted);
}

.file-size {
  font-size: 11px;
  color: var(--envclaw-text-muted);
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
}

.detail-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px;
}

.output-content {
  :deep(hr) {
    border: none;
    margin: 12px 0;
  }
}
</style>
