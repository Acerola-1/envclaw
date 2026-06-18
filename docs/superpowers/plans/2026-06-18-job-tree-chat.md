# 定时任务树形列表 + 任务绑定对话 实施计划

> **自动化代理说明：** 必须使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实施。步骤使用 `- [ ]` 语法跟踪进度。

**目标：** 将值守模式下的扁平任务列表改造为树形视图（Job → Runs），右侧面板支持任务绑定的对话会话。

**架构：** 扩展 chat store 添加 job/run session 映射，创建新的 `JobTreeList.vue` 组件实现可展开的树形列表，重写 ChatPanel 的 jobs 模式实现 GuardPanel / Job 对话 / Run 对话 三种右侧面板状态。

**技术栈：** Vue 3 (Composition API)、Pinia、Naive UI、Socket.IO（现有对话基础设施）

---

## 文件清单

| 文件 | 操作 | 职责 |
|------|------|------|
| `packages/client/src/stores/hermes/chat.ts` | 修改 | 新增 `jobSessionMap`、`runSessionMap`、`ensureJobSession()`、`ensureRunSession()` |
| `packages/client/src/components/hermes/jobs/JobTreeList.vue` | 新建 | 树形列表组件（Job 可展开行 + Run 子行） |
| `packages/client/src/components/hermes/chat/ChatPanel.vue` | 修改 | 替换 MiniJobList 为 JobTreeList，新增右侧面板三态切换 |
| `packages/client/src/components/hermes/jobs/MiniJobList.vue` | 保留 | 不删除，其他页面可能使用 |

---

### 任务 1：Chat Store — Job/Run Session 管理

**文件：**
- 修改：`packages/client/src/stores/hermes/chat.ts`

- [ ] **步骤 1：新增 job/run session 映射 ref**

在现有的 `activeSessionId` ref 之后添加（约第 76 行）：

```ts
// Job-Session 绑定：jobId → sessionId
const jobSessionMap = ref<Map<string, string>>(new Map())
// Run-Session 绑定："jobId/fileName" → sessionId
const runSessionMap = ref<Map<string, string>>(new Map())
```

- [ ] **步骤 2：新增 `getJobSessionId` 函数**

```ts
function getJobSessionId(jobId: string): string | null {
  return jobSessionMap.value.get(jobId) || null
}
```

- [ ] **步骤 3：新增 `ensureJobSession` 函数**

```ts
async function ensureJobSession(jobId: string, jobPrompt: string): Promise<string> {
  const existing = jobSessionMap.value.get(jobId)
  if (existing) {
    await switchSession(existing)
    return existing
  }
  const session = createSession({ source: 'job' })
  session.title = `Job: ${jobId}`
  jobSessionMap.value.set(jobId, session.id)
  await switchSession(session.id)
  return session.id
}
```

- [ ] **步骤 4：新增 `getRunSessionId` 函数**

```ts
function getRunSessionId(jobId: string, fileName: string): string | null {
  const key = `${jobId}/${fileName}`
  return runSessionMap.value.get(key) || null
}
```

- [ ] **步骤 5：新增 `ensureRunSession` 函数**

```ts
async function ensureRunSession(jobId: string, fileName: string, runContent: string): Promise<string> {
  const key = `${jobId}/${fileName}`
  const existing = runSessionMap.value.get(key)
  if (existing) {
    await switchSession(existing)
    return existing
  }
  const session = createSession({ source: 'job-run' })
  session.title = `Run: ${fileName}`
  // 将运行结果作为系统消息注入，供 AI 回答用户追问时参考
  session.messages.push({
    id: uid(),
    role: 'system',
    content: `[运行结果上下文]\n\n${runContent}`,
    timestamp: Date.now(),
  })
  runSessionMap.value.set(key, session.id)
  await switchSession(session.id)
  return session.id
}
```

**说明：** 运行内容以本地 system 消息注入。用户发送第一条消息时，该内容会通过 `sendMessage` 同步到服务端。`uid()` 函数已在 store 中定义。

- [ ] **步骤 6：导出新增的函数和映射**

添加到 store 的 return 对象中：

```ts
return {
  // ... 现有导出
  jobSessionMap,
  runSessionMap,
  getJobSessionId,
  ensureJobSession,
  getRunSessionId,
  ensureRunSession,
}
```

- [ ] **步骤 7：提交**

```bash
git add packages/client/src/stores/hermes/chat.ts
git commit -m "feat(chat): 新增 job/run session 绑定到 chat store"
```

---

### 任务 2：JobTreeList 组件 — 结构和 Job 行

**文件：**
- 新建：`packages/client/src/components/hermes/jobs/JobTreeList.vue`

- [ ] **步骤 1：创建组件骨架（props 和 emits）**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useJobsStore } from '@/stores/hermes/jobs'
import { listCronRuns } from '@/api/hermes/cron-history'
import type { RunEntry } from '@/api/hermes/cron-history'

const props = defineProps<{
  selectedJobId: string | null
  selectedRunKey: string | null  // 格式："jobId/fileName"
}>()

const emit = defineEmits<{
  selectJob: [jobId: string]
  selectRun: [jobId: string, fileName: string]
  editJob: [jobId: string]
  createJob: []
}>()

const jobsStore = useJobsStore()

// 树形状态
const expandedJobs = ref<Set<string>>(new Set())
const jobRuns = ref<Map<string, RunEntry[]>>(new Map())
const loadingRuns = ref<Map<string, boolean>>(new Map())

const MAX_VISIBLE_RUNS = 10

function getJobId(job: any): string {
  return job.job_id || job.id
}

function getStatusLabel(job: any): string {
  const status = job.state || job.status || ''
  if (job.enabled === false) return '已禁用'
  const map: Record<string, string> = {
    active: '运行中', running: '执行中', paused: '已暂停',
    error: '异常', completed: '已完成', ready: '待执行', idle: '待执行',
  }
  return map[status] || '待执行'
}

function getStatusClass(job: any): string {
  const status = job.state || job.status || ''
  if (job.enabled === false) return 'status-paused'
  const map: Record<string, string> = {
    active: 'status-active', running: 'status-running', paused: 'status-paused',
    error: 'status-error', completed: 'status-completed', ready: 'status-idle', idle: 'status-idle',
  }
  return map[status] || 'status-idle'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}
</script>
```

- [ ] **步骤 2：添加展开/折叠和运行记录加载逻辑**

```ts
async function toggleExpand(jobId: string, event: Event) {
  event.stopPropagation()
  if (expandedJobs.value.has(jobId)) {
    expandedJobs.value.delete(jobId)
  } else {
    expandedJobs.value.add(jobId)
    if (!jobRuns.value.has(jobId)) {
      await loadRuns(jobId)
    }
  }
}

async function loadRuns(jobId: string) {
  loadingRuns.value.set(jobId, true)
  try {
    const runs = await listCronRuns(jobId)
    jobRuns.value.set(jobId, runs.slice(0, MAX_VISIBLE_RUNS))
  } catch {
    jobRuns.value.set(jobId, [])
  } finally {
    loadingRuns.value.set(jobId, false)
  }
}

function handleJobClick(jobId: string) {
  emit('selectJob', jobId)
}

function handleRunClick(jobId: string, fileName: string) {
  emit('selectRun', jobId, fileName)
}

function handleEditClick(jobId: string, event: Event) {
  event.stopPropagation()
  emit('editJob', jobId)
}
```

- [ ] **步骤 3：编写模板**

```vue
<template>
  <div class="job-tree-list">
    <div v-if="jobsStore.jobs.length === 0" class="tree-empty">
      <span>暂无定时任务</span>
    </div>

    <div v-for="job in jobsStore.jobs" :key="getJobId(job)" class="tree-job-group">
      <!-- Job 行 -->
      <div
        class="tree-job-row"
        :class="{ active: selectedJobId === getJobId(job) }"
        @click="handleJobClick(getJobId(job))"
      >
        <!-- 展开箭头 -->
        <span class="tree-arrow" @click="toggleExpand(getJobId(job), $event)">
          <svg v-if="expandedJobs.has(getJobId(job))" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
          <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </span>

        <!-- Job 信息 -->
        <div class="tree-job-info">
          <span class="tree-job-name">{{ job.name || '未命名任务' }}</span>
          <span :class="['tree-job-status', getStatusClass(job)]">{{ getStatusLabel(job) }}</span>
        </div>

        <!-- 设置图标 -->
        <span class="tree-job-settings" @click="handleEditClick(getJobId(job), $event)" title="编辑">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </span>
      </div>

      <!-- Run 行（展开时显示） -->
      <template v-if="expandedJobs.has(getJobId(job))">
        <div v-if="loadingRuns.get(getJobId(job))" class="tree-runs-loading">
          加载中...
        </div>
        <div v-else-if="(jobRuns.get(getJobId(job)) || []).length === 0" class="tree-runs-empty">
          暂无运行记录
        </div>
        <div
          v-for="run in (jobRuns.get(getJobId(job)) || [])"
          :key="`${run.jobId}/${run.fileName}`"
          class="tree-run-row"
          :class="{ active: selectedRunKey === `${run.jobId}/${run.fileName}` }"
          @click="handleRunClick(run.jobId, run.fileName)"
        >
          <span class="tree-run-time">{{ run.runTime }}</span>
          <span class="tree-run-size">{{ formatSize(run.size) }}</span>
        </div>
      </template>
    </div>
  </div>
</template>
```

- [ ] **步骤 4：编写样式**

```vue
<style scoped lang="scss">
@use '@/styles/variables' as *;

.job-tree-list {
  display: flex;
  flex-direction: column;
  padding: 4px 0;
}

.tree-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px 12px;
  font-size: 12px;
  color: $text-muted;
}

.tree-job-group {
  display: flex;
  flex-direction: column;
}

.tree-job-row {
  display: flex;
  align-items: center;
  gap: 6px;
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

.tree-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: $text-muted;
  cursor: pointer;

  &:hover {
    color: $text-primary;
  }
}

.tree-job-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tree-job-name {
  font-size: 13px;
  font-weight: 500;
  color: $text-primary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-job-status {
  font-size: 11px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 4px;
  width: fit-content;

  &.status-active, &.status-running { background: #dcfce7; color: #166534; }
  &.status-paused { background: #fef9c3; color: #854d0e; }
  &.status-error { background: #fee2e2; color: #991b1b; }
  &.status-completed { background: #dbeafe; color: #1e40af; }
  &.status-idle { background: #f3f4f6; color: #6b7280; }
}

.tree-job-settings {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  color: $text-muted;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    color: $accent-primary;
    background: rgba(var(--accent-primary-rgb), 0.08);
  }
}

.tree-run-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px 6px 36px;
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background: rgba(var(--accent-primary-rgb), 0.04);
  }

  &.active {
    background: rgba(var(--accent-primary-rgb), 0.08);
  }
}

.tree-run-time {
  font-size: 12px;
  color: $text-secondary;
}

.tree-run-size {
  font-size: 11px;
  color: $text-muted;
  font-family: $font-code;
}

.tree-runs-loading,
.tree-runs-empty {
  padding: 6px 12px 6px 36px;
  font-size: 11px;
  color: $text-muted;
}
</style>
```

- [ ] **步骤 5：提交**

```bash
git add packages/client/src/components/hermes/jobs/JobTreeList.vue
git commit -m "feat(jobs): 新增 JobTreeList 组件，支持可展开的树形视图"
```

---

### 任务 3：ChatPanel — 接入 JobTreeList 和右侧面板模式

**文件：**
- 修改：`packages/client/src/components/hermes/chat/ChatPanel.vue`

- [ ] **步骤 1：导入 JobTreeList 并新增状态**

替换 `MiniJobList` 导入为 `JobTreeList`：

```ts
// 删除：import MiniJobList from "@/components/hermes/jobs/MiniJobList.vue";
import JobTreeList from "@/components/hermes/jobs/JobTreeList.vue";
```

在现有的 `selectedJobId` ref 附近新增状态：

```ts
const activeJobSessionId = ref<string | null>(null)
const activeRunSessionId = ref<string | null>(null)
const activeRunContext = ref<{ jobId: string; fileName: string; runTime: string } | null>(null)

type RightPanelMode = 'guard' | 'chat' | 'run-chat'
const rightPanelMode = computed<RightPanelMode>(() => {
  if (activeRunSessionId.value) return 'run-chat'
  if (activeJobSessionId.value) return 'chat'
  return 'guard'
})

const selectedJobName = computed(() => {
  if (!selectedJobId.value) return ''
  const job = jobsStore.jobs.find(j => (j.job_id || j.id) === selectedJobId.value)
  return job?.name || ''
})
```

- [ ] **步骤 2：新增处理函数**

```ts
async function handleSelectJobForChat(jobId: string) {
  selectedJobId.value = jobId
  activeRunSessionId.value = null
  activeRunContext.value = null
  const job = jobsStore.jobs.find(j => (j.job_id || j.id) === jobId)
  if (job) {
    const sessionId = await chatStore.ensureJobSession(jobId, job.prompt || '')
    activeJobSessionId.value = sessionId
  }
}

async function handleSelectRunForChat(jobId: string, fileName: string, runTime: string) {
  selectedJobId.value = jobId
  try {
    const detail = await readCronRun(jobId, fileName)
    const sessionId = await chatStore.ensureRunSession(jobId, fileName, detail.content)
    activeRunSessionId.value = sessionId
    activeRunContext.value = { jobId, fileName, runTime }
  } catch (e) {
    console.error('加载运行记录失败:', e)
  }
}

function handleEditJobFromTree(jobId: string) {
  editingJobId.value = jobId
  showJobFormModal.value = true
}

function handleBackToGuard() {
  activeJobSessionId.value = null
  activeRunSessionId.value = null
  activeRunContext.value = null
  selectedJobId.value = null
}

function handleBackToJobChat() {
  activeRunSessionId.value = null
  activeRunContext.value = null
  if (activeJobSessionId.value) {
    chatStore.switchSession(activeJobSessionId.value)
  }
}
```

新增 `readCronRun` 导入：

```ts
import { readCronRun } from '@/api/hermes/cron-history'
```

- [ ] **步骤 3：替换侧边栏 MiniJobList 为 JobTreeList**

找到侧边栏 jobs 部分（约第 1289 行）并替换：

```html
<!-- 替换前 -->
<div v-if="showSessions && currentMode === 'jobs'" class="session-items session-items--jobs">
  <div class="session-group-header session-group-header--static">
    <span class="session-group-label">定时任务</span>
    <span class="session-group-count">{{ jobsStore.jobs.length }}</span>
  </div>
  <MiniJobList
    :selected-job-id="selectedJobId"
    @select="handleSelectJob"
  />
</div>

<!-- 替换后 -->
<div v-if="showSessions && currentMode === 'jobs'" class="session-items session-items--jobs">
  <div class="session-group-header session-group-header--static">
    <span class="session-group-label">定时任务</span>
    <span class="session-group-count">{{ jobsStore.jobs.length }}</span>
  </div>
  <JobTreeList
    :selected-job-id="selectedJobId"
    :selected-run-key="activeRunContext ? `${activeRunContext.jobId}/${activeRunContext.fileName}` : null"
    @select-job="handleSelectJobForChat"
    @select-run="handleSelectRunForChat"
    @edit-job="handleEditJobFromTree"
    @create-job="openCreateJobModal"
  />
</div>
```

- [ ] **步骤 4：替换 jobs 模式右侧内容**

找到 jobs 模式模板（约第 2071 行）并替换：

```html
<!-- 替换前 -->
<template v-else-if="currentMode === 'jobs'">
  <div class="guard-content-area">
    <GuardPanel @select="handleRobotSelect" @create-task="handleRobotSelect" />
    <TaskDetailPanel
      v-if="selectedTaskJob"
      :job="selectedTaskJob"
      :profile-key="activeProfileName"
    />
  </div>
</template>

<!-- 替换后 -->
<template v-else-if="currentMode === 'jobs'">
  <div class="guard-content-area">
    <!-- GuardPanel：未选中任何 Job 时展示 -->
    <GuardPanel
      v-if="rightPanelMode === 'guard'"
      @select="handleRobotSelect"
      @create-task="handleRobotSelect"
    />

    <!-- Job 对话：选中 Job 时展示 -->
    <div v-else-if="rightPanelMode === 'chat'" class="job-chat-panel">
      <div class="job-chat-header">
        <span class="job-chat-title">{{ selectedJobName }}</span>
        <button class="job-chat-back" @click="handleBackToGuard">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          返回
        </button>
      </div>
      <div class="job-chat-body">
        <MessageList />
        <ChatInput />
      </div>
    </div>

    <!-- Run 对话：选中 Run 时展示 -->
    <div v-else-if="rightPanelMode === 'run-chat'" class="job-chat-panel">
      <div class="job-chat-header">
        <span class="job-chat-title">{{ activeRunContext?.runTime }} 运行分析</span>
        <button class="job-chat-back" @click="handleBackToJobChat">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          返回任务对话
        </button>
      </div>
      <div class="job-chat-body">
        <MessageList />
        <ChatInput />
      </div>
    </div>
  </div>
</template>
```

- [ ] **步骤 5：新增 job-chat-panel 样式**

```scss
.job-chat-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.job-chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid $border-light;
  flex-shrink: 0;
}

.job-chat-title {
  font-size: 14px;
  font-weight: 600;
  color: $text-primary;
}

.job-chat-back {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: none;
  background: none;
  color: $text-muted;
  font-size: 12px;
  cursor: pointer;
  border-radius: $radius-sm;
  transition: all 0.15s;

  &:hover {
    color: $accent-primary;
    background: rgba(var(--accent-primary-rgb), 0.06);
  }
}

.job-chat-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
```

- [ ] **步骤 6：更新 handleAppModeChange 清理 job session 状态**

在 `handleAppModeChange` 函数中新增状态清理：

```ts
function handleAppModeChange(mode: 'smartQuery' | 'automation') {
  appMode.value = mode;
  if (mode === 'automation') {
    currentMode.value = "jobs";
    selectedJobId.value = null;
    showGuardPanel.value = true;
    selectedRobot.value = null;
    selectedTaskJob.value = null;
    activeJobSessionId.value = null;       // 新增
    activeRunSessionId.value = null;       // 新增
    activeRunContext.value = null;         // 新增
    void jobsStore.fetchJobs();
  } else {
    currentMode.value = "chat";
    selectedJobId.value = null;
    showGuardPanel.value = true;
    selectedRobot.value = null;
    selectedTaskJob.value = null;
    activeJobSessionId.value = null;       // 新增
    activeRunSessionId.value = null;       // 新增
    activeRunContext.value = null;         // 新增
  }
}
```

- [ ] **步骤 7：提交**

```bash
git add packages/client/src/components/hermes/chat/ChatPanel.vue
git commit -m "feat(chat): 集成 JobTreeList 和 job/run 对话会话到值守模式"
```

---

### 任务 4：验证和清理

**文件：**
- 验证：`packages/client/src/stores/hermes/chat.ts`
- 验证：`packages/client/src/components/hermes/jobs/JobTreeList.vue`
- 验证：`packages/client/src/components/hermes/chat/ChatPanel.vue`

- [ ] **步骤 1：运行 TypeScript 检查**

```bash
cd e:/envclaw && npx vue-tsc --noEmit --pretty
```

预期：无错误。

- [ ] **步骤 2：验证 JobTreeList 渲染**

1. 切换到值守模式
2. 验证树形列表显示 `jobsStore.jobs` 中的任务
3. 点击 Job 行的展开箭头 → 验证 runs 通过 `listCronRuns` 加载
4. 点击 ⚙️ 图标 → 验证 `JobFormModal` 弹窗打开
5. 点击 Job 行 → 验证右侧面板切换到对话模式

- [ ] **步骤 3：验证 Job 对话绑定**

1. 点击某个 Job → 验证创建了新 session，`MessageList` + `ChatInput` 出现
2. 发送消息 → 验证消息关联到该 Job 的 session
3. 点击另一个 Job → 验证创建/加载了不同的 session
4. 点击返回 → 验证回到 GuardPanel

- [ ] **步骤 4：验证 Run 对话绑定**

1. 展开某个 Job → 点击一条 Run 行
2. 验证调用了 `readCronRun` 并加载了运行内容
3. 验证右侧展示带运行上下文的对话界面
4. 点击"返回任务对话" → 验证回到该 Job 的对话 session

- [ ] **步骤 5：最终提交**

```bash
git add -A
git commit -m "feat: 完成定时任务树形列表 + 任务绑定对话功能"
```
