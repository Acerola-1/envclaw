<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NSpin, NEmpty, NTag, NTooltip } from 'naive-ui'
import { listCronRuns, readCronRun } from '@/api/hermes/cron-history'
import type { RunEntry } from '@/api/hermes/cron-history'

interface JobInfo {
  id: string
  job_id: string
  name: string
  prompt: string
  schedule: string
  status: string
  created_at: string
}

const props = defineProps<{
  job: JobInfo | null
  profileKey: string
}>()

const loading = ref(false)
const runs = ref<RunEntry[]>([])
const activeTab = ref<'chat' | 'logs' | 'output'>('logs')
const expandedContent = ref<Record<string, string>>({})
const loadingContent = ref<Record<string, boolean>>({})

const filteredRuns = computed(() => {
  if (!props.job) return []
  return runs.value.filter(r => r.jobId === (props.job?.job_id || props.job?.id))
})

async function fetchRuns() {
  if (!props.job) return
  loading.value = true
  try {
    runs.value = await listCronRuns(props.job.job_id || props.job.id)
  } catch (err) {
    console.error('Failed to fetch cron runs:', err)
    runs.value = []
  } finally {
    loading.value = false
  }
}

async function toggleContent(run: RunEntry) {
  const key = run.fileName
  if (expandedContent.value[key]) {
    delete expandedContent.value[key]
    return
  }
  loadingContent.value[key] = true
  try {
    const detail = await readCronRun(run.jobId, run.fileName)
    expandedContent.value[key] = detail.content
  } catch {
    expandedContent.value[key] = '(无法加载内容)'
  } finally {
    loadingContent.value[key] = false
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

function formatTime(time: string): string {
  try {
    const date = new Date(time)
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return time
  }
}

watch(() => [props.job, props.profileKey], () => {
  expandedContent.value = {}
  fetchRuns()
}, { immediate: true })
</script>

<template>
  <div class="task-detail-panel">
    <template v-if="job">
      <!-- Header -->
      <div class="detail-header">
        <div class="header-info">
          <div class="header-title-row">
            <NTooltip trigger="hover">
              <template #trigger>
                <h3 class="job-name">{{ job.name }}</h3>
              </template>
              <span>{{ job.name }}</span>
            </NTooltip>
            <NTag
              :type="job.status === 'active' ? 'success' : 'default'"
              size="small"
              round
            >
              {{ job.status === 'active' ? '运行中' : '已暂停' }}
            </NTag>
          </div>
          <div class="header-meta">
            <span v-if="job.schedule" class="meta-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {{ job.schedule }}
            </span>
            <span class="meta-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              创建于 {{ formatTime(job.created_at) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="detail-tabs">
        <button
          :class="['tab-btn', { active: activeTab === 'chat' }]"
          @click="activeTab = 'chat'"
        >
          问数沟通
        </button>
        <button
          :class="['tab-btn', { active: activeTab === 'logs' }]"
          @click="activeTab = 'logs'"
        >
          运行日志
          <span v-if="filteredRuns.length" class="tab-badge">{{ filteredRuns.length }}</span>
        </button>
        <button
          :class="['tab-btn', { active: activeTab === 'output' }]"
          @click="activeTab = 'output'"
        >
          产出物
        </button>
      </div>

      <!-- Tab Content -->
      <div class="detail-content">
        <!-- 问数沟通 Tab -->
        <div v-if="activeTab === 'chat'" class="tab-pane chat-pane">
          <div class="chat-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <p>与智能体的对话记录将在此处展示</p>
            <span class="placeholder-hint">当任务执行时，智能体会自动记录分析过程</span>
          </div>
        </div>

        <!-- 运行日志 Tab -->
        <div v-if="activeTab === 'logs'" class="tab-pane">
          <NSpin :show="loading">
            <div v-if="filteredRuns.length === 0 && !loading" class="empty-logs">
              <NEmpty description="暂无运行记录" />
            </div>
            <div v-else class="runs-list">
              <div
                v-for="run in filteredRuns"
                :key="run.fileName"
                :class="['run-item', { expanded: expandedContent[run.fileName] }]"
              >
                <div class="run-header" @click="toggleContent(run)">
                  <div class="run-info">
                    <span class="run-time">{{ formatTime(run.runTime) }}</span>
                    <span class="run-size">{{ formatSize(run.size) }}</span>
                  </div>
                  <svg
                    :class="['expand-icon', { rotated: expandedContent[run.fileName] }]"
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
                <div v-if="expandedContent[run.fileName]" class="run-content">
                  <pre>{{ expandedContent[run.fileName] }}</pre>
                </div>
                <div v-else-if="loadingContent[run.fileName]" class="run-content loading">
                  <NSpin size="small" />
                </div>
              </div>
            </div>
          </NSpin>
        </div>

        <!-- 产出物 Tab -->
        <div v-if="activeTab === 'output'" class="tab-pane output-pane">
          <div class="output-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            <p>任务产出物将在此处展示</p>
            <span class="placeholder-hint">包括生成的报告、图表、数据文件等</span>
          </div>
        </div>
      </div>
    </template>

    <!-- Empty State -->
    <template v-else>
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>
        <p class="empty-text">请从左侧选择一个任务查看详情</p>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.task-detail-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.02);
}

// Header
.detail-header {
  padding: 20px 24px;
  border-bottom: 1px solid $border-light;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.02);
}

.header-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.header-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.job-name {
  font-size: 16px;
  font-weight: 600;
  color: $text-primary;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-meta {
  display: flex;
  align-items: center;
  gap: 16px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: $text-muted;

  svg {
    opacity: 0.6;
  }
}

// Tabs
.detail-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid $border-light;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.01);
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 500;
  color: $text-muted;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    color: $text-secondary;
    background: rgba(255, 255, 255, 0.03);
  }

  &.active {
    color: var(--accent-primary);
    border-bottom-color: var(--accent-primary);
    background: rgba(var(--accent-primary-rgb), 0.03);
  }
}

.tab-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
  background: rgba(var(--accent-primary-rgb), 0.15);
  color: var(--accent-primary);
}

// Content
.detail-content {
  flex: 1;
  overflow: hidden;
}

.tab-pane {
  height: 100%;
  overflow-y: auto;
  padding: 20px 24px;
}

// Chat Tab
.chat-pane {
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: $text-muted;
  text-align: center;

  svg {
    opacity: 0.3;
  }

  p {
    font-size: 14px;
    margin: 0;
  }
}

.placeholder-hint {
  font-size: 12px;
  opacity: 0.7;
}

// Logs Tab
.empty-logs {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
}

.runs-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.run-item {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid $border-light;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s;

  &:hover {
    border-color: rgba(var(--accent-primary-rgb), 0.3);
  }

  &.expanded {
    border-color: var(--accent-primary);
    background: rgba(var(--accent-primary-rgb), 0.03);
  }
}

.run-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.15s;

  &:hover {
    background: rgba(255, 255, 255, 0.03);
  }
}

.run-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.run-time {
  font-size: 13px;
  font-weight: 500;
  color: $text-secondary;
  font-family: $font-code;
}

.run-size {
  font-size: 12px;
  color: $text-muted;
  background: rgba(255, 255, 255, 0.05);
  padding: 2px 8px;
  border-radius: 4px;
}

.expand-icon {
  transition: transform 0.2s;
  color: $text-muted;

  &.rotated {
    transform: rotate(180deg);
  }
}

.run-content {
  padding: 0 16px 16px;
  border-top: 1px solid $border-light;

  &.loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  pre {
    margin: 0;
    padding: 12px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 6px;
    font-family: $font-code;
    font-size: 12px;
    line-height: 1.6;
    color: $text-secondary;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 300px;
    overflow-y: auto;
  }
}

// Output Tab
.output-pane {
  display: flex;
  align-items: center;
  justify-content: center;
}

.output-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: $text-muted;
  text-align: center;

  svg {
    opacity: 0.3;
  }

  p {
    font-size: 14px;
    margin: 0;
  }
}

// Empty State
.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.empty-icon {
  color: $text-muted;
  opacity: 0.4;
}

.empty-text {
  font-size: 14px;
  color: $text-muted;
  margin: 0;
}
</style>
