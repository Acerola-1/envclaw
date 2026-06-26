# 环保管家差异化改造 — Phase 4: 值守任务/运行历史/技能库/任务详情

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现工作台 4 个核心页面——值守任务列表、任务详情、运行历史、技能库——全部对接真实 API，完成工作台主体功能闭环。

**Architecture:** 在 Phase 1-3 已建立的 `/envclaw/*` 路由体系和 EnvclawLayout 布局下，将 4 个占位页面替换为完整实现。值守任务和任务详情复用 `useJobsStore` + jobs API；运行历史复用 cron-history API；技能库复用 skills API。新增 `JobDetailPage.vue` 及其路由。所有页面遵循暗色主题设计语言，使用 Naive UI 组件 + 自定义 SCSS。

**Tech Stack:** Vue 3.5 + TypeScript + Pinia 3(setup stores) + Naive UI 2.44 + vue-router + vue-i18n | 复用现有 jobs/cron-history/skills API

## Global Constraints

- Vue 组件必须用 `<script setup lang="ts">` + Composition API
- Pinia store 用 setup store 语法(`defineStore('name', () => {...})`)
- 每个新用户可见字符串必须加到 `packages/client/src/i18n/locales/en.ts` 和 `zh.ts` 的 `envclaw` 命名空间
- 使用 `import { request } from '@/api/client'` 发请求，不引入 axios
- 图标用 Lucide 风格 SVG(stroke-width 1.6)，不使用 emoji
- 配色遵循暗色主题：背景 `#1a1a1a`、卡片 `#2a2a2a`、边框 `#3a3a3a`、主文字 `#e0e0e0`、次文字 `#a0a0a0`、弱文字 `#666`
- 状态色克制使用：绿 `#66bb6a`(成功)、琥珀 `#e0a458`(警告)、红 `#d96a6a`(错误)、蓝 `#6a9fd9`(信息)
- 圆角 8px(小 6px、大 12px)
- 所有数据从现有 API 获取，不造 mock
- 不包含 commit 步骤

---

## File Structure

### 新建文件

| 文件 | 职责 |
|---|---|
| `packages/client/src/views/envclaw/JobDetailPage.vue` | 任务详情页：配置+运行历史+对话入口 |
| `packages/client/src/components/envclaw/jobs/JobListTable.vue` | 值守任务列表行布局组件 |
| `packages/client/src/components/envclaw/jobs/JobStatusPill.vue` | 任务状态 pill 组件(运行中/已暂停/异常) |
| `packages/client/src/components/envclaw/history/RunRecordList.vue` | 运行记录左侧列表(按日期分组) |
| `packages/client/src/components/envclaw/history/RunDetailPanel.vue` | 运行记录右侧详情(Markdown输出+推送结果) |
| `packages/client/src/components/envclaw/skills/SkillCategoryList.vue` | 技能库左侧分类列表 |
| `packages/client/src/components/envclaw/skills/SkillDetailPanel.vue` | 技能库右侧详情面板 |

### 修改文件

| 文件 | 改动 |
|---|---|
| `packages/client/src/views/envclaw/JobsPage.vue` | 从占位替换为完整值守任务列表页 |
| `packages/client/src/views/envclaw/HistoryPage.vue` | 从占位替换为完整运行历史页 |
| `packages/client/src/views/envclaw/SkillsPage.vue` | 从占位替换为完整技能库页 |
| `packages/client/src/router/index.ts` | 新增 `/envclaw/jobs/:jobId` 路由 |
| `packages/client/src/i18n/locales/zh.ts` | 新增 envclaw 命名空间下的 jobs/history/skills/detail 相关条目 |
| `packages/client/src/i18n/locales/en.ts` | 新增 envclaw 命名空间下的 jobs/history/skills/detail 相关条目 |

---

## Task 1: 值守任务列表页 (JobsPage.vue 完整实现)

**Files:**
- Modify: `packages/client/src/views/envclaw/JobsPage.vue`
- Create: `packages/client/src/components/envclaw/jobs/JobListTable.vue`
- Create: `packages/client/src/components/envclaw/jobs/JobStatusPill.vue`
- Modify: `packages/client/src/i18n/locales/zh.ts`
- Modify: `packages/client/src/i18n/locales/en.ts`

**Interfaces:**
- Consumes: `useJobsStore` (from `@/stores/hermes/jobs`) — `jobs`, `loading`, `fetchJobs`, `pauseJob`, `resumeJob`, `runJob`, `deleteJob`
- Consumes: `Job`, `scheduleToDisplayText` (from `@/api/hermes/jobs`)
- Produces: 完整值守任务列表页，点击行跳转任务详情

- [ ] **Step 1: 添加 i18n 条目**

在 `packages/client/src/i18n/locales/zh.ts` 的 `envclaw` 命名空间中，替换原有 `jobs` 子对象为完整版本：

```ts
jobs: {
  title: '值守任务',
  description: '无人值守的定时任务，按计划自动运行并推送结果',
  searchPlaceholder: '搜索任务名称...',
  filterAll: '全部',
  filterRunning: '运行中',
  filterPaused: '已暂停',
  filterError: '异常',
  createTask: '创建任务',
  noJobs: '暂无值守任务',
  noJobsHint: '点击上方按钮创建第一个值守任务',
  noMatch: '没有匹配的任务',
  columns: {
    name: '任务名称',
    schedule: '调度频率',
    deliver: '推送渠道',
    lastRun: '上次运行',
    nextRun: '下次运行',
    status: '状态',
  },
  lastRunSuccess: '成功',
  lastRunFailed: '失败',
  lastRunNever: '未运行',
  actions: {
    runNow: '立即运行',
    pause: '暂停',
    resume: '恢复',
    edit: '编辑',
    delete: '删除',
    deleteConfirm: '确定要删除任务「{name}」吗？此操作不可撤销。',
  },
  runTriggered: '任务已触发',
  paused: '任务已暂停',
  resumed: '任务已恢复',
  deleted: '任务已删除',
  operationFailed: '操作失败',
  scenarioTag: '场景',
},
```

在 `packages/client/src/i18n/locales/en.ts` 的 `envclaw` 命名空间中添加对应英文：

```ts
jobs: {
  title: 'Guard Tasks',
  description: 'Automated scheduled tasks that run on plan and push results',
  searchPlaceholder: 'Search task name...',
  filterAll: 'All',
  filterRunning: 'Running',
  filterPaused: 'Paused',
  filterError: 'Error',
  createTask: 'Create Task',
  noJobs: 'No guard tasks yet',
  noJobsHint: 'Click the button above to create your first guard task',
  noMatch: 'No matching tasks',
  columns: {
    name: 'Task Name',
    schedule: 'Schedule',
    deliver: 'Deliver To',
    lastRun: 'Last Run',
    nextRun: 'Next Run',
    status: 'Status',
  },
  lastRunSuccess: 'Success',
  lastRunFailed: 'Failed',
  lastRunNever: 'Never',
  actions: {
    runNow: 'Run Now',
    pause: 'Pause',
    resume: 'Resume',
    edit: 'Edit',
    delete: 'Delete',
    deleteConfirm: 'Are you sure you want to delete task "{name}"? This action cannot be undone.',
  },
  runTriggered: 'Task triggered',
  paused: 'Task paused',
  resumed: 'Task resumed',
  deleted: 'Task deleted',
  operationFailed: 'Operation failed',
  scenarioTag: 'Scenario',
},
```

- [ ] **Step 2: 创建 JobStatusPill 组件**

```vue
<!-- packages/client/src/components/envclaw/jobs/JobStatusPill.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  state: string
  enabled: boolean
  lastStatus: string | null
}>()

const { t } = useI18n()

const pill = computed(() => {
  if (props.state === 'paused') return { label: t('envclaw.jobs.filterPaused'), cls: 'paused' }
  if (!props.enabled) return { label: t('envclaw.jobs.filterPaused'), cls: 'paused' }
  if (props.lastStatus && props.lastStatus !== 'ok') return { label: t('envclaw.jobs.filterError'), cls: 'error' }
  return { label: t('envclaw.jobs.filterRunning'), cls: 'running' }
})
</script>

<template>
  <span :class="['status-pill', pill.cls]">{{ pill.label }}</span>
</template>

<style scoped lang="scss">
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;

  &::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  &.running {
    background: rgba(102, 187, 106, 0.12);
    color: #66bb6a;
    &::before { background: #66bb6a; }
  }

  &.paused {
    background: rgba(224, 164, 88, 0.12);
    color: #e0a458;
    &::before { background: #e0a458; }
  }

  &.error {
    background: rgba(217, 106, 106, 0.12);
    color: #d96a6a;
    &::before { background: #d96a6a; }
  }
}
</style>
```

- [ ] **Step 3: 创建 JobListTable 组件**

```vue
<!-- packages/client/src/components/envclaw/jobs/JobListTable.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useMessage, useDialog, NButton, NTooltip, NEmpty, NSpin } from 'naive-ui'
import { useJobsStore } from '@/stores/hermes/jobs'
import type { Job } from '@/api/hermes/jobs'
import { scheduleToDisplayText } from '@/api/hermes/jobs'
import JobStatusPill from './JobStatusPill.vue'

const props = defineProps<{
  filter: 'all' | 'running' | 'paused' | 'error'
  searchQuery: string
}>()

const emit = defineEmits<{
  edit: [jobId: string]
}>()

const { t } = useI18n()
const router = useRouter()
const jobsStore = useJobsStore()
const message = useMessage()
const dialog = useDialog()

const filteredJobs = computed(() => {
  let result = jobsStore.jobs

  if (props.filter === 'running') {
    result = result.filter(j => j.enabled && j.state !== 'paused' && (j.last_status === null || j.last_status === 'ok'))
  } else if (props.filter === 'paused') {
    result = result.filter(j => j.state === 'paused' || !j.enabled)
  } else if (props.filter === 'error') {
    result = result.filter(j => j.last_status && j.last_status !== 'ok')
  }

  if (props.searchQuery) {
    const q = props.searchQuery.toLowerCase()
    result = result.filter(j => j.name.toLowerCase().includes(q))
  }

  return result
})

function formatTime(time: string | null): string {
  if (!time) return '—'
  const d = new Date(time)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return t('envclaw.jobs.lastRunNever') === 'Never' ? 'just now' : '刚刚'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatNextRun(time: string | null): string {
  if (!time) return '—'
  const d = new Date(time)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getJobId(job: Job): string {
  return job.job_id || job.id
}

function goToDetail(job: Job) {
  router.push({ name: 'envclaw.jobDetail', params: { jobId: getJobId(job) } })
}

async function handleRunNow(job: Job, e: MouseEvent) {
  e.stopPropagation()
  try {
    await jobsStore.runJob(getJobId(job))
    message.success(t('envclaw.jobs.runTriggered'))
  } catch (err: any) {
    message.error(t('envclaw.jobs.operationFailed') + `: ${err.message}`)
  }
}

async function handlePause(job: Job, e: MouseEvent) {
  e.stopPropagation()
  try {
    await jobsStore.pauseJob(getJobId(job))
    message.success(t('envclaw.jobs.paused'))
  } catch (err: any) {
    message.error(t('envclaw.jobs.operationFailed') + `: ${err.message}`)
  }
}

async function handleResume(job: Job, e: MouseEvent) {
  e.stopPropagation()
  try {
    await jobsStore.resumeJob(getJobId(job))
    message.success(t('envclaw.jobs.resumed'))
  } catch (err: any) {
    message.error(t('envclaw.jobs.operationFailed') + `: ${err.message}`)
  }
}

function handleEdit(job: Job, e: MouseEvent) {
  e.stopPropagation()
  emit('edit', getJobId(job))
}

function handleDelete(job: Job, e: MouseEvent) {
  e.stopPropagation()
  dialog.warning({
    title: t('envclaw.jobs.actions.delete'),
    content: t('envclaw.jobs.actions.deleteConfirm', { name: job.name }),
    positiveText: t('envclaw.jobs.actions.delete'),
    negativeText: 'Cancel',
    onPositiveClick: async () => {
      try {
        await jobsStore.deleteJob(getJobId(job))
        message.success(t('envclaw.jobs.deleted'))
      } catch (err: any) {
        message.error(t('envclaw.jobs.operationFailed') + `: ${err.message}`)
      }
    },
  })
}

function lastRunLabel(job: Job): string {
  if (!job.last_run_at) return '—'
  if (job.last_status === 'ok') return t('envclaw.jobs.lastRunSuccess')
  if (job.last_status) return t('envclaw.jobs.lastRunFailed')
  return '—'
}

function lastRunCls(job: Job): string {
  if (job.last_status === 'ok') return 'success'
  if (job.last_status) return 'failed'
  return ''
}
</script>

<template>
  <NSpin :show="jobsStore.loading && jobsStore.jobs.length === 0">
    <div v-if="!jobsStore.loading && jobsStore.jobs.length === 0" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="empty-icon">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
      <p>{{ t('envclaw.jobs.noJobs') }}</p>
      <p class="hint">{{ t('envclaw.jobs.noJobsHint') }}</p>
    </div>

    <div v-else-if="filteredJobs.length === 0" class="empty-state">
      <p>{{ t('envclaw.jobs.noMatch') }}</p>
    </div>

    <div v-else class="job-table">
      <div class="table-header">
        <div class="col-name">{{ t('envclaw.jobs.columns.name') }}</div>
        <div class="col-schedule">{{ t('envclaw.jobs.columns.schedule') }}</div>
        <div class="col-deliver">{{ t('envclaw.jobs.columns.deliver') }}</div>
        <div class="col-last-run">{{ t('envclaw.jobs.columns.lastRun') }}</div>
        <div class="col-next-run">{{ t('envclaw.jobs.columns.nextRun') }}</div>
        <div class="col-status">{{ t('envclaw.jobs.columns.status') }}</div>
        <div class="col-actions" />
      </div>

      <div
        v-for="job in filteredJobs"
        :key="getJobId(job)"
        class="table-row"
        @click="goToDetail(job)"
      >
        <div class="col-name">
          <div class="job-identity">
            <div class="job-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div class="job-text">
              <span class="job-name">{{ job.name }}</span>
              <span v-if="job.skills && job.skills.length" class="scenario-tag">
                {{ t('envclaw.jobs.scenarioTag') }}: {{ job.skills.join(', ') }}
              </span>
            </div>
          </div>
        </div>

        <div class="col-schedule">
          <code class="mono">{{ scheduleToDisplayText(job.schedule, job.schedule_display || '—') }}</code>
        </div>

        <div class="col-deliver">
          <span class="deliver-text">{{ job.deliver || '—' }}</span>
        </div>

        <div class="col-last-run">
          <span class="time-text">{{ formatTime(job.last_run_at) }}</span>
          <span v-if="job.last_run_at" :class="['run-result', lastRunCls(job)]">{{ lastRunLabel(job) }}</span>
        </div>

        <div class="col-next-run">
          <span class="time-text">{{ formatNextRun(job.next_run_at) }}</span>
        </div>

        <div class="col-status">
          <JobStatusPill :state="job.state" :enabled="job.enabled" :last-status="job.last_status" />
        </div>

        <div class="col-actions" @click.stop>
          <NTooltip>
            <template #trigger>
              <NButton size="tiny" quaternary @click="handleRunNow(job, $event)">
                <template #icon>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                </template>
              </NButton>
            </template>
            {{ t('envclaw.jobs.actions.runNow') }}
          </NTooltip>
          <NTooltip v-if="job.state !== 'paused' && job.enabled">
            <template #trigger>
              <NButton size="tiny" quaternary @click="handlePause(job, $event)">
                <template #icon>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                </template>
              </NButton>
            </template>
            {{ t('envclaw.jobs.actions.pause') }}
          </NTooltip>
          <NTooltip v-else-if="job.state === 'paused' || !job.enabled">
            <template #trigger>
              <NButton size="tiny" quaternary @click="handleResume(job, $event)">
                <template #icon>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                </template>
              </NButton>
            </template>
            {{ t('envclaw.jobs.actions.resume') }}
          </NTooltip>
          <NTooltip>
            <template #trigger>
              <NButton size="tiny" quaternary @click="handleEdit(job, $event)">
                <template #icon>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                </template>
              </NButton>
            </template>
            {{ t('envclaw.jobs.actions.edit') }}
          </NTooltip>
          <NTooltip>
            <template #trigger>
              <NButton size="tiny" quaternary type="error" @click="handleDelete(job, $event)">
                <template #icon>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" /></svg>
                </template>
              </NButton>
            </template>
            {{ t('envclaw.jobs.actions.delete') }}
          </NTooltip>
        </div>
      </div>
    </div>
  </NSpin>
</template>

<style scoped lang="scss">
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #666;
  gap: 8px;

  .empty-icon { opacity: 0.3; margin-bottom: 8px; }
  p { font-size: 14px; }
  .hint { font-size: 12px; color: #555; }
}

.job-table {
  width: 100%;
}

.table-header {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  font-size: 11px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid #3a3a3a;
}

.table-row {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #2e2e2e;
  cursor: pointer;
  transition: background 0.15s;

  &:hover { background: #252525; }
  &:last-child { border-bottom: none; }
}

.col-name { flex: 2; min-width: 0; }
.col-schedule { flex: 1.2; min-width: 0; }
.col-deliver { flex: 0.8; min-width: 0; }
.col-last-run { flex: 1.2; min-width: 0; }
.col-next-run { flex: 0.8; min-width: 0; }
.col-status { flex: 0.7; min-width: 0; }
.col-actions { flex: 1; min-width: 0; display: flex; justify-content: flex-end; gap: 2px; }

.job-identity {
  display: flex;
  align-items: center;
  gap: 10px;
}

.job-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #252525;
  border: 1px solid #3a3a3a;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a0a0a0;
  flex-shrink: 0;
}

.job-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.job-name {
  font-size: 13px;
  font-weight: 500;
  color: #e0e0e0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scenario-tag {
  font-size: 11px;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mono {
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  color: #a0a0a0;
}

.deliver-text {
  font-size: 12px;
  color: #a0a0a0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time-text {
  font-size: 12px;
  color: #a0a0a0;
}

.col-last-run {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.run-result {
  font-size: 11px;
  font-weight: 500;

  &.success { color: #66bb6a; }
  &.failed { color: #d96a6a; }
}
</style>
```

- [ ] **Step 4: 替换 JobsPage.vue 为完整实现**

```vue
<!-- packages/client/src/views/envclaw/JobsPage.vue -->
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
  h1 { font-size: 20px; font-weight: 600; color: #e0e0e0; }
  .page-desc { font-size: 13px; color: #a0a0a0; margin-top: 4px; }
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
  background: #252525;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  padding: 3px;
}

.filter-btn {
  padding: 5px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #a0a0a0;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: 0.15s;

  &:hover { color: #e0e0e0; }
  &.active { background: #e0e0e0; color: #1a1a1a; }
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
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 12px;
  overflow-y: auto;
}
</style>
```

---

## Task 2: 任务详情页 (JobDetailPage.vue 新建 + 路由注册)

**Files:**
- Create: `packages/client/src/views/envclaw/JobDetailPage.vue`
- Modify: `packages/client/src/router/index.ts`
- Modify: `packages/client/src/i18n/locales/zh.ts`
- Modify: `packages/client/src/i18n/locales/en.ts`

**Interfaces:**
- Consumes: `useJobsStore` — 读取单个 job 配置
- Consumes: `listCronRuns`, `readCronRun` (from `@/api/hermes/cron-history`) — 读取该任务的运行历史
- Consumes: `scheduleToDisplayText` (from `@/api/hermes/jobs`)
- Produces: 任务详情页，含配置展示、运行历史列表、任务对话入口按钮(Phase 5 占位)

- [ ] **Step 1: 添加 i18n 条目**

在 `packages/client/src/i18n/locales/zh.ts` 的 `envclaw` 命名空间中添加 `detail` 子对象：

```ts
detail: {
  backToList: '返回任务列表',
  taskConfig: '任务配置',
  taskChat: '任务对话',
  taskChatHint: '围绕此任务进行对话、调整配置或排查问题',
  taskChatComingSoon: '即将推出',
  config: {
    name: '任务名称',
    schedule: '调度频率',
    prompt: '执行提示词',
    deliver: '推送渠道',
    skills: '关联技能',
    enabled: '启用状态',
    model: '使用模型',
    repeat: '重复次数',
    origin: '来源平台',
  },
  enabled: '已启用',
  disabled: '已禁用',
  noSkills: '无关联技能',
  infinite: '无限',
  runHistory: '运行历史',
  noHistory: '暂无运行记录',
  loadFailed: '加载任务失败',
  notFound: '未找到该任务',
  runOutput: '运行输出',
  pushResult: '推送结果',
  loadingOutput: '加载输出中...',
  loadOutputFailed: '加载输出失败',
},
```

在 `packages/client/src/i18n/locales/en.ts` 的 `envclaw` 命名空间中添加：

```ts
detail: {
  backToList: 'Back to task list',
  taskConfig: 'Task Configuration',
  taskChat: 'Task Chat',
  taskChatHint: 'Chat around this task to adjust config or troubleshoot',
  taskChatComingSoon: 'Coming soon',
  config: {
    name: 'Task Name',
    schedule: 'Schedule',
    prompt: 'Execution Prompt',
    deliver: 'Deliver To',
    skills: 'Linked Skills',
    enabled: 'Enabled',
    model: 'Model',
    repeat: 'Repeat Count',
    origin: 'Source Platform',
  },
  enabled: 'Enabled',
  disabled: 'Disabled',
  noSkills: 'No linked skills',
  infinite: 'Infinite',
  runHistory: 'Run History',
  noHistory: 'No run records yet',
  loadFailed: 'Failed to load task',
  notFound: 'Task not found',
  runOutput: 'Run Output',
  pushResult: 'Push Result',
  loadingOutput: 'Loading output...',
  loadOutputFailed: 'Failed to load output',
},
```

- [ ] **Step 2: 注册路由**

在 `packages/client/src/router/index.ts` 的 envclaw children 数组中，在 `jobs` 路由之后添加：

```ts
{ path: 'jobs/:jobId', name: 'envclaw.jobDetail', component: () => import('@/views/envclaw/JobDetailPage.vue') },
```

- [ ] **Step 3: 创建 JobDetailPage.vue**

```vue
<!-- packages/client/src/views/envclaw/JobDetailPage.vue -->
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NSpin, NButton, NEmpty } from 'naive-ui'
import { useJobsStore } from '@/stores/hermes/jobs'
import type { Job } from '@/api/hermes/jobs'
import { scheduleToDisplayText } from '@/api/hermes/jobs'
import { listCronRuns, readCronRun } from '@/api/hermes/cron-history'
import type { RunEntry, RunDetail } from '@/api/hermes/cron-history'
import MarkdownRenderer from '@/components/hermes/chat/MarkdownRenderer.vue'
import JobStatusPill from '@/components/envclaw/jobs/JobStatusPill.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const jobsStore = useJobsStore()

const job = ref<Job | null>(null)
const loading = ref(true)
const runs = ref<RunEntry[]>([])
const runsLoading = ref(false)
const expandedRun = ref<string | null>(null)
const runContent = ref<Record<string, string>>({})
const runContentLoading = ref<Record<string, boolean>>({})

const jobId = computed(() => route.params.jobId as string)

async function loadJob() {
  loading.value = true
  try {
    if (jobsStore.jobs.length === 0) {
      await jobsStore.fetchJobs()
    }
    const found = jobsStore.jobs.find(j => (j.job_id || j.id) === jobId.value)
    if (found) {
      job.value = found
    } else {
      job.value = null
    }
  } catch {
    job.value = null
  } finally {
    loading.value = false
  }
}

async function loadRuns() {
  runsLoading.value = true
  try {
    runs.value = await listCronRuns(jobId.value)
  } catch {
    runs.value = []
  } finally {
    runsLoading.value = false
  }
}

async function toggleRunExpand(run: RunEntry) {
  const key = `${run.jobId}/${run.fileName}`
  if (expandedRun.value === key) {
    expandedRun.value = null
    return
  }
  expandedRun.value = key
  if (runContent.value[key] || runContentLoading.value[key]) return

  runContentLoading.value[key] = true
  try {
    const detail: RunDetail = await readCronRun(run.jobId, run.fileName)
    runContent.value[key] = detail.content
  } catch {
    runContent.value[key] = t('envclaw.detail.loadOutputFailed')
  } finally {
    runContentLoading.value[key] = false
  }
}

function formatTime(time: string): string {
  return new Date(time).toLocaleString()
}

function formatDate(time: string): string {
  return new Date(time).toLocaleDateString()
}

function goBack() {
  router.push({ name: 'envclaw.jobs' })
}

function repeatLabel(repeat: Job['repeat']): string {
  if (!repeat) return t('envclaw.detail.infinite')
  if (typeof repeat === 'string') return repeat
  if (repeat.times === null || repeat.times === undefined) return t('envclaw.detail.infinite')
  return `${repeat.completed || 0} / ${repeat.times}`
}

// Group runs by date
const groupedRuns = computed(() => {
  const groups: Record<string, RunEntry[]> = {}
  for (const run of runs.value) {
    const date = formatDate(run.runTime)
    if (!groups[date]) groups[date] = []
    groups[date].push(run)
  }
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
})

onMounted(() => {
  void loadJob()
  void loadRuns()
})

watch(jobId, () => {
  void loadJob()
  void loadRuns()
  expandedRun.value = null
  runContent.value = {}
})
</script>

<template>
  <div class="detail-page">
    <NSpin :show="loading">
      <div v-if="!loading && !job" class="not-found">
        <NEmpty :description="t('envclaw.detail.notFound')" />
        <NButton size="small" @click="goBack">{{ t('envclaw.detail.backToList') }}</NButton>
      </div>

      <template v-else-if="job">
        <!-- Header -->
        <div class="detail-header">
          <button class="back-btn" @click="goBack">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {{ t('envclaw.detail.backToList') }}
          </button>
          <div class="header-center">
            <h1>{{ job.name }}</h1>
            <JobStatusPill :state="job.state" :enabled="job.enabled" :last-status="job.last_status" />
          </div>
          <div class="header-right">
            <NButton type="primary" size="small" disabled>
              <template #icon>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </template>
              {{ t('envclaw.detail.taskChat') }}
            </NButton>
            <span class="coming-soon-badge">{{ t('envclaw.detail.taskChatComingSoon') }}</span>
          </div>
        </div>

        <div class="detail-body">
          <!-- Left: Config -->
          <div class="config-section">
            <h2 class="section-title">{{ t('envclaw.detail.taskConfig') }}</h2>
            <div class="config-grid">
              <div class="config-item">
                <span class="config-label">{{ t('envclaw.detail.config.name') }}</span>
                <span class="config-value">{{ job.name }}</span>
              </div>
              <div class="config-item">
                <span class="config-label">{{ t('envclaw.detail.config.schedule') }}</span>
                <code class="config-value mono">{{ scheduleToDisplayText(job.schedule, job.schedule_display || '—') }}</code>
              </div>
              <div class="config-item">
                <span class="config-label">{{ t('envclaw.detail.config.enabled') }}</span>
                <span :class="['config-value', job.enabled ? 'text-success' : 'text-warning']">
                  {{ job.enabled ? t('envclaw.detail.enabled') : t('envclaw.detail.disabled') }}
                </span>
              </div>
              <div class="config-item">
                <span class="config-label">{{ t('envclaw.detail.config.model') }}</span>
                <span class="config-value">{{ job.model || '—' }}</span>
              </div>
              <div class="config-item">
                <span class="config-label">{{ t('envclaw.detail.config.deliver') }}</span>
                <span class="config-value">{{ job.deliver || '—' }}</span>
              </div>
              <div class="config-item">
                <span class="config-label">{{ t('envclaw.detail.config.repeat') }}</span>
                <span class="config-value">{{ repeatLabel(job.repeat) }}</span>
              </div>
              <div v-if="job.origin" class="config-item">
                <span class="config-label">{{ t('envclaw.detail.config.origin') }}</span>
                <span class="config-value">{{ job.origin.platform }} — {{ job.origin.chat_name }}</span>
              </div>
              <div class="config-item full-width">
                <span class="config-label">{{ t('envclaw.detail.config.skills') }}</span>
                <span class="config-value">
                  <template v-if="job.skills && job.skills.length">
                    <span v-for="skill in job.skills" :key="skill" class="skill-tag">{{ skill }}</span>
                  </template>
                  <template v-else>{{ t('envclaw.detail.noSkills') }}</template>
                </span>
              </div>
              <div class="config-item full-width">
                <span class="config-label">{{ t('envclaw.detail.config.prompt') }}</span>
                <pre class="config-value prompt-preview">{{ job.prompt_preview || job.prompt || '—' }}</pre>
              </div>
            </div>
          </div>

          <!-- Right: Run History -->
          <div class="history-section">
            <h2 class="section-title">{{ t('envclaw.detail.runHistory') }}</h2>
            <NSpin :show="runsLoading && runs.length === 0">
              <div v-if="!runsLoading && runs.length === 0" class="no-history">
                {{ t('envclaw.detail.noHistory') }}
              </div>
              <div v-else class="run-list">
                <div v-for="[date, dateRuns] in groupedRuns" :key="date" class="date-group">
                  <div class="date-label">{{ date }}</div>
                  <div
                    v-for="run in dateRuns"
                    :key="`${run.jobId}/${run.fileName}`"
                    :class="['run-item', { expanded: expandedRun === `${run.jobId}/${run.fileName}` }]"
                  >
                    <div class="run-header" @click="toggleRunExpand(run)">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="expand-arrow">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                      <span class="run-time">{{ new Date(run.runTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span>
                      <span class="run-size">{{ run.size > 1024 ? `${(run.size / 1024).toFixed(1)}KB` : `${run.size}B` }}</span>
                    </div>
                    <div v-if="expandedRun === `${run.jobId}/${run.fileName}`" class="run-content">
                      <NSpin v-if="runContentLoading[`${run.jobId}/${run.fileName}`]" size="small" />
                      <MarkdownRenderer
                        v-else-if="runContent[`${run.jobId}/${run.fileName}`]"
                        :content="runContent[`${run.jobId}/${run.fileName}`]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </NSpin>
          </div>
        </div>
      </template>
    </NSpin>
  </div>
</template>

<style scoped lang="scss">
.detail-page {
  height: 100%;
  overflow-y: auto;
  padding: 24px 28px;
}

.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px 0;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  gap: 16px;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: #a0a0a0;
  background: transparent;
  border: 1px solid #3a3a3a;
  cursor: pointer;
  transition: 0.15s;

  &:hover { background: #252525; color: #e0e0e0; }
}

.header-center {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;

  h1 { font-size: 18px; font-weight: 600; color: #e0e0e0; }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.coming-soon-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 9px;
  background: #252525;
  border: 1px dashed #555;
  color: #666;
}

.detail-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.config-section, .history-section {
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 12px;
  padding: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #e0e0e0;
  margin-bottom: 16px;
}

.config-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 4px;

  &.full-width { grid-column: 1 / -1; }
}

.config-label {
  font-size: 11px;
  color: #666;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.config-value {
  font-size: 13px;
  color: #e0e0e0;

  &.mono {
    font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 12px;
  }

  &.text-success { color: #66bb6a; }
  &.text-warning { color: #e0a458; }
}

.skill-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  background: #252525;
  border: 1px solid #3a3a3a;
  color: #a0a0a0;
  margin-right: 4px;
  margin-bottom: 4px;
}

.prompt-preview {
  font-size: 12px;
  color: #a0a0a0;
  background: #1a1a1a;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  padding: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  margin: 0;
}

.no-history {
  padding: 40px 0;
  text-align: center;
  color: #666;
  font-size: 13px;
}

.run-list {
  max-height: 500px;
  overflow-y: auto;
}

.date-group {
  margin-bottom: 12px;
}

.date-label {
  font-size: 11px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  padding: 4px 0;
  margin-bottom: 4px;
}

.run-item {
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  margin-bottom: 4px;
  overflow: hidden;

  &.expanded { border-color: #555; }
}

.run-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover { background: #252525; }
}

.expand-arrow {
  color: #666;
  transition: transform 0.15s;
  .run-item.expanded & { transform: rotate(180deg); }
}

.run-time {
  font-size: 12px;
  color: #a0a0a0;
  flex: 1;
}

.run-size {
  font-size: 11px;
  color: #666;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
}

.run-content {
  padding: 12px;
  border-top: 1px solid #3a3a3a;
  background: #1a1a1a;
  max-height: 300px;
  overflow-y: auto;
}
</style>
```

---

## Task 3: 运行历史页 (HistoryPage.vue 完整实现)

**Files:**
- Modify: `packages/client/src/views/envclaw/HistoryPage.vue`
- Create: `packages/client/src/components/envclaw/history/RunRecordList.vue`
- Create: `packages/client/src/components/envclaw/history/RunDetailPanel.vue`
- Modify: `packages/client/src/i18n/locales/zh.ts`
- Modify: `packages/client/src/i18n/locales/en.ts`

**Interfaces:**
- Consumes: `listCronRuns`, `readCronRun` (from `@/api/hermes/cron-history`) — `RunEntry`, `RunDetail`
- Consumes: `useJobsStore` — 构建 jobNameMap
- Produces: 左右分栏运行历史页，左侧按日期分组的运行记录列表，右侧选中记录的输出详情

- [ ] **Step 1: 添加 i18n 条目**

在 `packages/client/src/i18n/locales/zh.ts` 的 `envclaw` 命名空间中替换原有 `history` 子对象：

```ts
history: {
  title: '运行历史',
  description: '值守任务每次运行的记录与输出',
  searchPlaceholder: '搜索任务名称...',
  filterAll: '全部任务',
  filterByTask: '按任务筛选',
  selectTask: '选择任务...',
  noRecords: '暂无运行记录',
  noRecordsHint: '任务运行后将在此显示执行记录',
  noDetail: '选择一条运行记录查看详情',
  runAt: '运行于',
  duration: '耗时',
  pushStatus: '推送状态',
  pushSuccess: '推送成功',
  pushFailed: '推送失败',
  pushPending: '未推送',
  output: '运行输出',
  loadingOutput: '加载输出中...',
  loadOutputFailed: '加载输出失败',
  loadFailed: '加载运行记录失败',
  today: '今天',
  yesterday: '昨天',
},
```

在 `packages/client/src/i18n/locales/en.ts` 的 `envclaw` 命名空间中替换：

```ts
history: {
  title: 'Run History',
  description: 'Execution records and output for each guard task run',
  searchPlaceholder: 'Search task name...',
  filterAll: 'All Tasks',
  filterByTask: 'Filter by Task',
  selectTask: 'Select task...',
  noRecords: 'No run records yet',
  noRecordsHint: 'Run records will appear here after tasks execute',
  noDetail: 'Select a run record to view details',
  runAt: 'Run at',
  duration: 'Duration',
  pushStatus: 'Push Status',
  pushSuccess: 'Pushed',
  pushFailed: 'Push Failed',
  pushPending: 'Not Pushed',
  output: 'Run Output',
  loadingOutput: 'Loading output...',
  loadOutputFailed: 'Failed to load output',
  loadFailed: 'Failed to load records',
  today: 'Today',
  yesterday: 'Yesterday',
},
```

- [ ] **Step 2: 创建 RunRecordList 组件**

```vue
<!-- packages/client/src/components/envclaw/history/RunRecordList.vue -->
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
  // Sort dates in reverse order (most recent first)
  const entries = Object.entries(groups)
  // We rely on insertion order which is already chronological from API
  // Reverse to show most recent first
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
  color: #666;
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

  &:hover { background: #252525; }
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
  color: #e0e0e0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-time {
  font-size: 11px;
  color: #666;
}

.record-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.record-size {
  font-size: 11px;
  color: #666;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
}
</style>
```

- [ ] **Step 3: 创建 RunDetailPanel 组件**

```vue
<!-- packages/client/src/components/envclaw/history/RunDetailPanel.vue -->
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
  color: #666;
  gap: 12px;

  .empty-icon { opacity: 0.3; }
  p { font-size: 13px; }
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #3a3a3a;
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
  color: #e0e0e0;
}

.run-time {
  font-size: 12px;
  color: #666;
}

.file-size {
  font-size: 11px;
  color: #666;
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
```

- [ ] **Step 4: 替换 HistoryPage.vue 为完整实现**

```vue
<!-- packages/client/src/views/envclaw/HistoryPage.vue -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
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
  const options = [{ label: t('envclaw.history.filterAll'), value: null as string | null }]
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

// Re-fetch when filter changes
import { watch } from 'vue'
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
  h1 { font-size: 20px; font-weight: 600; color: #e0e0e0; }
  .page-desc { font-size: 13px; color: #a0a0a0; margin-top: 4px; }
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
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
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
  background: #3a3a3a;
  flex-shrink: 0;
}

.split-right {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
}
</style>
```

---

## Task 4: 技能库页 (SkillsPage.vue 完整实现)

**Files:**
- Modify: `packages/client/src/views/envclaw/SkillsPage.vue`
- Create: `packages/client/src/components/envclaw/skills/SkillCategoryList.vue`
- Create: `packages/client/src/components/envclaw/skills/SkillDetailPanel.vue`
- Modify: `packages/client/src/i18n/locales/zh.ts`
- Modify: `packages/client/src/i18n/locales/en.ts`

**Interfaces:**
- Consumes: `fetchSkills`, `toggleSkill`, `fetchSkillContent` (from `@/api/hermes/skills`) — `SkillInfo`, `SkillCategory`, `SkillListResponse`
- Produces: 左右分栏技能库页，左侧分类折叠列表+来源色点+启用开关+搜索，右侧技能详情

- [ ] **Step 1: 添加 i18n 条目**

在 `packages/client/src/i18n/locales/zh.ts` 的 `envclaw` 命名空间中替换原有 `skills` 子对象：

```ts
skills: {
  title: '技能库',
  description: '技能可被平台和任务复用，开关控制是否启用',
  searchPlaceholder: '搜索技能名称或描述...',
  noSkills: '暂无技能',
  noMatch: '没有匹配的技能',
  source: {
    builtin: '内置',
    hub: 'Hub',
    local: '本地',
    external: '外部',
  },
  sourceColor: {
    builtin: '内置技能',
    hub: 'Hub 安装技能',
    local: '本地安装技能',
    external: '外部目录技能',
  },
  enabled: '已启用',
  disabled: '已禁用',
  toggleFailed: '切换技能状态失败',
  detail: {
    name: '技能名称',
    source: '来源',
    enabled: '启用状态',
    description: '描述',
    usedByTasks: '被以下任务使用',
    noTasks: '暂无任务使用此技能',
    contentPreview: '技能内容预览',
    loadContentFailed: '加载技能内容失败',
    loading: '加载中...',
    noSelection: '选择一个技能查看详情',
  },
  category: {
    archived: '已归档',
    count: '{n} 个技能',
  },
},
```

在 `packages/client/src/i18n/locales/en.ts` 的 `envclaw` 命名空间中替换：

```ts
skills: {
  title: 'Skill Library',
  description: 'Skills can be reused by platforms and tasks, toggle to enable or disable',
  searchPlaceholder: 'Search skill name or description...',
  noSkills: 'No skills yet',
  noMatch: 'No matching skills',
  source: {
    builtin: 'Built-in',
    hub: 'Hub',
    local: 'Local',
    external: 'External',
  },
  sourceColor: {
    builtin: 'Built-in skill',
    hub: 'Hub installed skill',
    local: 'Locally installed skill',
    external: 'External directory skill',
  },
  enabled: 'Enabled',
  disabled: 'Disabled',
  toggleFailed: 'Failed to toggle skill',
  detail: {
    name: 'Skill Name',
    source: 'Source',
    enabled: 'Status',
    description: 'Description',
    usedByTasks: 'Used by Tasks',
    noTasks: 'No tasks using this skill',
    contentPreview: 'Content Preview',
    loadContentFailed: 'Failed to load skill content',
    loading: 'Loading...',
    noSelection: 'Select a skill to view details',
  },
  category: {
    archived: 'Archived',
    count: '{n} skills',
  },
},
```

- [ ] **Step 2: 创建 SkillCategoryList 组件**

```vue
<!-- packages/client/src/components/envclaw/skills/SkillCategoryList.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSwitch, useMessage } from 'naive-ui'
import type { SkillCategory, SkillInfo, SkillSource } from '@/api/hermes/skills'
import { toggleSkill } from '@/api/hermes/skills'

const props = defineProps<{
  categories: SkillCategory[]
  archived: SkillInfo[]
  selectedKey: string | null
  searchQuery: string
}>()

const emit = defineEmits<{
  select: [category: string, skill: string]
}>()

const { t } = useI18n()
const message = useMessage()

const collapsedCategories = ref<Set<string>>(new Set())
const togglingSkills = ref<Set<string>>(new Set())

const filteredCategories = computed(() => {
  if (!props.searchQuery) return props.categories
  const q = props.searchQuery.toLowerCase()
  return props.categories
    .map(cat => ({
      ...cat,
      skills: cat.skills.filter(
        s => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q),
      ),
    }))
    .filter(cat => cat.skills.length > 0 || cat.name.toLowerCase().includes(q))
})

function toggleCategory(name: string) {
  if (collapsedCategories.value.has(name)) {
    collapsedCategories.value.delete(name)
  } else {
    collapsedCategories.value.add(name)
  }
}

function skillKey(catName: string, skill: { name: string }): string {
  return `${catName}/${skill.name}`
}

function handleSelect(category: string, skillName: string) {
  emit('select', category, skillName)
}

function sourceDotClass(source?: SkillSource): string {
  return `dot-${source || 'local'}`
}

function sourceLabel(source?: SkillSource): string {
  const key = source || 'local'
  return t(`envclaw.skills.source.${key}`)
}

async function handleToggle(category: string, skillName: string, newEnabled: boolean) {
  if (togglingSkills.value.has(skillName)) return
  togglingSkills.value.add(skillName)
  try {
    await toggleSkill(skillName, newEnabled)
    const cat = props.categories.find(c => c.name === category)
    const skill = cat?.skills.find(s => s.name === skillName)
    if (skill) skill.enabled = newEnabled
  } catch (err: any) {
    message.error(t('envclaw.skills.toggleFailed') + `: ${err.message}`)
  } finally {
    togglingSkills.value.delete(skillName)
  }
}
</script>

<template>
  <div class="skill-list">
    <div v-if="filteredCategories.length === 0" class="skill-empty">
      {{ searchQuery ? t('envclaw.skills.noMatch') : t('envclaw.skills.noSkills') }}
    </div>

    <div v-for="cat in filteredCategories" :key="cat.name" class="skill-category">
      <button class="category-header" @click="toggleCategory(cat.name)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="category-arrow" :class="{ collapsed: collapsedCategories.has(cat.name) }">
          <polyline points="6 9 12 15 18 9" />
        </svg>
        <span class="category-name">{{ cat.name }}</span>
        <span class="category-count">{{ cat.skills.length }}</span>
      </button>
      <div v-if="!collapsedCategories.has(cat.name)" class="category-skills">
        <div
          v-for="skill in cat.skills"
          :key="skillKey(cat.name, skill)"
          :class="['skill-item', { active: selectedKey === skillKey(cat.name, skill) }]"
          @click="handleSelect(cat.name, skill.name)"
        >
          <div class="skill-info">
            <span class="skill-name">
              <span :class="['source-dot', sourceDotClass(skill.source)]" :title="sourceLabel(skill.source)" />
              {{ skill.name }}
            </span>
            <span v-if="skill.description" class="skill-desc">{{ skill.description }}</span>
          </div>
          <NSwitch
            size="small"
            :value="skill.enabled !== false"
            :loading="togglingSkills.has(skill.name)"
            @update:value="handleToggle(cat.name, skill.name, $event)"
            @click.stop
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.skill-list {
  padding: 8px;
}

.skill-empty {
  padding: 24px 16px;
  font-size: 13px;
  color: #666;
  text-align: center;
}

.skill-category {
  margin-bottom: 4px;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 10px;
  border: none;
  background: none;
  color: #a0a0a0;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  cursor: pointer;
  border-radius: 6px;

  &:hover { background: #252525; }
}

.category-arrow {
  flex-shrink: 0;
  transition: transform 0.15s;
  &.collapsed { transform: rotate(-90deg); }
}

.category-name {
  flex: 1;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-count {
  font-size: 11px;
  color: #666;
  background: #252525;
  padding: 1px 6px;
  border-radius: 8px;
}

.category-skills {
  padding: 2px 0 4px;
}

.skill-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px 6px 28px;
  border: none;
  background: none;
  color: #a0a0a0;
  font-size: 13px;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s;
  gap: 8px;

  &:hover { background: #252525; color: #e0e0e0; }
  &.active { background: rgba(106, 159, 217, 0.1); color: #e0e0e0; font-weight: 500; }
}

.skill-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.skill-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 6px;
}

.source-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;

  &.dot-builtin { background: #888; }
  &.dot-hub { background: #4a90d9; }
  &.dot-local { background: #66bb6a; }
  &.dot-external { background: #e0a458; }
}

.skill-desc {
  font-size: 11px;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
  padding-left: 14px;
}
</style>
```

- [ ] **Step 3: 创建 SkillDetailPanel 组件**

```vue
<!-- packages/client/src/components/envclaw/skills/SkillDetailPanel.vue -->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSwitch, NSpin, useMessage } from 'naive-ui'
import type { SkillCategory, SkillInfo, SkillSource } from '@/api/hermes/skills'
import { fetchSkillContent, toggleSkill } from '@/api/hermes/skills'
import { useJobsStore } from '@/stores/hermes/jobs'
import MarkdownRenderer from '@/components/hermes/chat/MarkdownRenderer.vue'

const props = defineProps<{
  category: string | null
  skill: SkillInfo | null
}>()

const { t } = useI18n()
const message = useMessage()
const jobsStore = useJobsStore()

const content = ref('')
const contentLoading = ref(false)
const toggling = ref(false)

const skillEnabled = computed(() => props.skill?.enabled !== false)

const sourceLabel = computed(() => {
  const source = props.skill?.source || 'local'
  return t(`envclaw.skills.source.${source}`)
})

const sourceDotClass = computed(() => `dot-${props.skill?.source || 'local'}`)

// Find which jobs use this skill
const usedByJobs = computed(() => {
  if (!props.skill) return []
  const skillName = props.skill.name
  return jobsStore.jobs.filter(j => j.skills && j.skills.includes(skillName))
})

async function loadContent() {
  if (!props.category || !props.skill) {
    content.value = ''
    return
  }
  contentLoading.value = true
  try {
    const skillPath = `${props.category}/${props.skill.name}/SKILL.md`
    content.value = await fetchSkillContent(skillPath)
  } catch {
    content.value = t('envclaw.skills.detail.loadContentFailed')
  } finally {
    contentLoading.value = false
  }
}

async function handleToggle(newEnabled: boolean) {
  if (!props.skill || toggling.value) return
  toggling.value = true
  try {
    await toggleSkill(props.skill.name, newEnabled)
    if (props.skill) props.skill.enabled = newEnabled
  } catch (err: any) {
    message.error(t('envclaw.skills.toggleFailed') + `: ${err.message}`)
  } finally {
    toggling.value = false
  }
}

watch(() => props.skill ? `${props.category}/${props.skill.name}` : null, loadContent, { immediate: true })
</script>

<template>
  <div class="detail-panel">
    <div v-if="!skill" class="no-selection">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="empty-icon">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      <p>{{ t('envclaw.skills.detail.noSelection') }}</p>
    </div>

    <template v-else>
      <div class="detail-header">
        <div class="detail-title-row">
          <span :class="['source-dot-lg', sourceDotClass]" />
          <h2>{{ skill.name }}</h2>
          <span class="source-tag">{{ sourceLabel }}</span>
        </div>
        <NSwitch
          :value="skillEnabled"
          :loading="toggling"
          @update:value="handleToggle"
        >
          <template #checked>{{ t('envclaw.skills.enabled') }}</template>
          <template #unchecked>{{ t('envclaw.skills.disabled') }}</template>
        </NSwitch>
      </div>

      <div class="detail-body">
        <!-- Description -->
        <div v-if="skill.description" class="detail-section">
          <div class="section-label">{{ t('envclaw.skills.detail.description') }}</div>
          <p class="section-text">{{ skill.description }}</p>
        </div>

        <!-- Used by tasks -->
        <div class="detail-section">
          <div class="section-label">{{ t('envclaw.skills.detail.usedByTasks') }}</div>
          <div v-if="usedByJobs.length === 0" class="section-empty">{{ t('envclaw.skills.detail.noTasks') }}</div>
          <div v-else class="task-list">
            <span v-for="job in usedByJobs" :key="job.job_id || job.id" class="task-tag">{{ job.name }}</span>
          </div>
        </div>

        <!-- Content preview -->
        <div class="detail-section">
          <div class="section-label">{{ t('envclaw.skills.detail.contentPreview') }}</div>
          <NSpin :show="contentLoading">
            <div v-if="content" class="content-preview">
              <MarkdownRenderer :content="content" />
            </div>
          </NSpin>
        </div>
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
  color: #666;
  gap: 12px;

  .empty-icon { opacity: 0.3; }
  p { font-size: 13px; }
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid #3a3a3a;
  flex-shrink: 0;
}

.detail-title-row {
  display: flex;
  align-items: center;
  gap: 8px;

  h2 { font-size: 16px; font-weight: 600; color: #e0e0e0; margin: 0; }
}

.source-dot-lg {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;

  &.dot-builtin { background: #888; }
  &.dot-hub { background: #4a90d9; }
  &.dot-local { background: #66bb6a; }
  &.dot-external { background: #e0a458; }
}

.source-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
  background: #252525;
  border: 1px solid #3a3a3a;
  color: #a0a0a0;
}

.detail-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px;
}

.detail-section {
  margin-bottom: 20px;
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: 8px;
}

.section-text {
  font-size: 13px;
  color: #a0a0a0;
  line-height: 1.6;
  margin: 0;
}

.section-empty {
  font-size: 12px;
  color: #555;
}

.task-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.task-tag {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 12px;
  background: #252525;
  border: 1px solid #3a3a3a;
  color: #a0a0a0;
}

.content-preview {
  background: #1a1a1a;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  padding: 14px;
  max-height: 400px;
  overflow-y: auto;
  font-size: 13px;
  color: #a0a0a0;

  :deep(hr) { border: none; margin: 12px 0; }
}
</style>
```

- [ ] **Step 4: 替换 SkillsPage.vue 为完整实现**

```vue
<!-- packages/client/src/views/envclaw/SkillsPage.vue -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { NInput } from 'naive-ui'
import { fetchSkills } from '@/api/hermes/skills'
import type { SkillCategory, SkillInfo } from '@/api/hermes/skills'
import { useJobsStore } from '@/stores/hermes/jobs'
import SkillCategoryList from '@/components/envclaw/skills/SkillCategoryList.vue'
import SkillDetailPanel from '@/components/envclaw/skills/SkillDetailPanel.vue'

const { t } = useI18n()
const jobsStore = useJobsStore()

const categories = ref<SkillCategory[]>([])
const archived = ref<SkillInfo[]>([])
const loading = ref(false)
const searchQuery = ref('')
const selectedCategory = ref<string | null>(null)
const selectedSkillName = ref<string | null>(null)

const selectedSkill = computed<SkillInfo | null>(() => {
  if (!selectedCategory.value || !selectedSkillName.value) return null
  const cat = categories.value.find(c => c.name === selectedCategory.value)
  return cat?.skills.find(s => s.name === selectedSkillName.value) || null
})

const selectedKey = computed(() => {
  if (!selectedCategory.value || !selectedSkillName.value) return null
  return `${selectedCategory.value}/${selectedSkillName.value}`
})

async function loadSkills() {
  loading.value = true
  try {
    const data = await fetchSkills()
    categories.value = data.categories
    archived.value = data.archived ?? []
  } catch {
    categories.value = []
    archived.value = []
  } finally {
    loading.value = false
  }
}

function handleSelect(category: string, skillName: string) {
  selectedCategory.value = category
  selectedSkillName.value = skillName
}

onMounted(async () => {
  await loadSkills()
  if (jobsStore.jobs.length === 0) {
    await jobsStore.fetchJobs()
  }
})
</script>

<template>
  <div class="skills-page">
    <div class="page-header">
      <h1>{{ t('envclaw.skills.title') }}</h1>
      <p class="page-desc">{{ t('envclaw.skills.description') }}</p>
    </div>

    <div class="toolbar">
      <NInput
        v-model:value="searchQuery"
        :placeholder="t('envclaw.skills.searchPlaceholder')"
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

    <div class="skills-split">
      <div class="split-left">
        <SkillCategoryList
          :categories="categories"
          :archived="archived"
          :selected-key="selectedKey"
          :search-query="searchQuery"
          @select="handleSelect"
        />
      </div>
      <div class="split-divider" />
      <div class="split-right">
        <SkillDetailPanel :category="selectedCategory" :skill="selectedSkill" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.skills-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 24px 28px;
  overflow: hidden;
}

.page-header {
  margin-bottom: 16px;
  flex-shrink: 0;
  h1 { font-size: 20px; font-weight: 600; color: #e0e0e0; }
  .page-desc { font-size: 13px; color: #a0a0a0; margin-top: 4px; }
}

.toolbar {
  margin-bottom: 16px;
  flex-shrink: 0;
}

.search-input {
  width: 280px;
}

.skills-split {
  flex: 1;
  display: flex;
  min-height: 0;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 12px;
  overflow: hidden;
}

.split-left {
  width: 320px;
  flex-shrink: 0;
  overflow-y: auto;
}

.split-divider {
  width: 1px;
  background: #3a3a3a;
  flex-shrink: 0;
}

.split-right {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
}
</style>
```

---

## Task 5: 全量验证

**Files:** 无新增/修改

**Interfaces:** 验证所有页面渲染、路由跳转、API 对接

- [ ] **Step 1: 运行构建确认无编译错误**

Run: `npm run build`
Expected: 成功，无 TypeScript 错误

- [ ] **Step 2: 运行 dev 确认页面渲染**

Run: `npm run dev`
验证项：
1. 访问 `http://localhost:8649/#/envclaw/jobs` — 值守任务列表页渲染，筛选/搜索/操作按钮可用
2. 点击任务行 — 跳转到 `/#/envclaw/jobs/:jobId`，任务详情页渲染，配置+运行历史展示
3. 点击"返回任务列表" — 回到列表页
4. 访问 `http://localhost:8649/#/envclaw/history` — 运行历史页左右分栏渲染，任务筛选可用
5. 点击运行记录 — 右侧展示 Markdown 输出
6. 访问 `http://localhost:8649/#/envclaw/skills` — 技能库页左右分栏渲染，分类折叠/搜索/开关可用
7. 点击技能 — 右侧展示详情(来源标签+描述+被哪些任务使用+内容预览)

- [ ] **Step 3: 运行单元测试**

Run: `npm run test`
Expected: 所有现有测试通过，无回归

- [ ] **Step 4: 检查 i18n 完整性**

确认 `en.ts` 和 `zh.ts` 的 `envclaw` 命名空间中所有新增 key 在两个文件中都有对应条目，无遗漏。

- [ ] **Step 5: 检查路由注册**

确认 `packages/client/src/router/index.ts` 中 envclaw children 包含以下路由：
- `path: ''` → WorkstationHome
- `path: 'jobs'` → JobsPage
- `path: 'jobs/:jobId'` → JobDetailPage
- `path: 'platforms'` → PlatformsPage
- `path: 'skills'` → SkillsPage
- `path: 'history'` → HistoryPage
- `path: 'smart-query'` → SmartQueryPage
