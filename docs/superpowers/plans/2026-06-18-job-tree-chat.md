# Job Tree List + Task-Bound Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat job list in jobs mode with a tree view (Job → Runs) and enable task-bound chat sessions on the right panel.

**Architecture:** Extend the chat store with job/run session maps, create a new `JobTreeList.vue` component with expandable tree items, and rewire ChatPanel's jobs mode to show GuardPanel / Job chat / Run chat based on selection state.

**Tech Stack:** Vue 3 (Composition API), Pinia, Naive UI, Socket.IO (existing chat infrastructure)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/client/src/stores/hermes/chat.ts` | Modify | Add `jobSessionMap`, `runSessionMap`, `ensureJobSession()`, `ensureRunSession()` |
| `packages/client/src/components/hermes/jobs/JobTreeList.vue` | Create | Tree list component with Job rows (expandable) and Run rows |
| `packages/client/src/components/hermes/chat/ChatPanel.vue` | Modify | Replace MiniJobList with JobTreeList, add right panel mode switching |
| `packages/client/src/components/hermes/jobs/MiniJobList.vue` | Keep | No changes, remains available for other uses |

---

### Task 1: Chat Store — Job/Run Session Management

**Files:**
- Modify: `packages/client/src/stores/hermes/chat.ts`

- [ ] **Step 1: Add job/run session map refs**

Add after the existing `activeSessionId` ref (around line 76):

```ts
// Job-Session binding: jobId → sessionId
const jobSessionMap = ref<Map<string, string>>(new Map())
// Run-Session binding: "jobId/fileName" → sessionId
const runSessionMap = ref<Map<string, string>>(new Map())
```

- [ ] **Step 2: Add `getJobSessionId` function**

```ts
function getJobSessionId(jobId: string): string | null {
  return jobSessionMap.value.get(jobId) || null
}
```

- [ ] **Step 3: Add `ensureJobSession` function**

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

- [ ] **Step 4: Add `getRunSessionId` function**

```ts
function getRunSessionId(jobId: string, fileName: string): string | null {
  const key = `${jobId}/${fileName}`
  return runSessionMap.value.get(key) || null
}
```

- [ ] **Step 5: Add `ensureRunSession` function**

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
  // Inject run content as a system message for context
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

**Note:** The run content is injected as a local system message. It will be sent to the server when the user sends their first message via `sendMessage`. The `uid()` function is already available in the store.

- [ ] **Step 6: Export the new functions and maps**

Add to the store's return object:

```ts
return {
  // ... existing exports
  jobSessionMap,
  runSessionMap,
  getJobSessionId,
  ensureJobSession,
  getRunSessionId,
  ensureRunSession,
}
```

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/stores/hermes/chat.ts
git commit -m "feat(chat): add job/run session binding to chat store"
```

---

### Task 2: JobTreeList Component — Structure and Job Rows

**Files:**
- Create: `packages/client/src/components/hermes/jobs/JobTreeList.vue`

- [ ] **Step 1: Create component skeleton with props and emits**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useJobsStore } from '@/stores/hermes/jobs'
import { listCronRuns } from '@/api/hermes/cron-history'
import type { RunEntry } from '@/api/hermes/cron-history'

const props = defineProps<{
  selectedJobId: string | null
  selectedRunKey: string | null  // "jobId/fileName"
}>()

const emit = defineEmits<{
  selectJob: [jobId: string]
  selectRun: [jobId: string, fileName: string]
  editJob: [jobId: string]
  createJob: []
}>()

const jobsStore = useJobsStore()

// Tree state
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

- [ ] **Step 2: Add expand/collapse and run loading logic**

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

- [ ] **Step 3: Write the template**

```vue
<template>
  <div class="job-tree-list">
    <div v-if="jobsStore.jobs.length === 0" class="tree-empty">
      <span>暂无定时任务</span>
    </div>

    <div v-for="job in jobsStore.jobs" :key="getJobId(job)" class="tree-job-group">
      <!-- Job Row -->
      <div
        class="tree-job-row"
        :class="{ active: selectedJobId === getJobId(job) }"
        @click="handleJobClick(getJobId(job))"
      >
        <!-- Expand arrow -->
        <span class="tree-arrow" @click="toggleExpand(getJobId(job), $event)">
          <svg v-if="expandedJobs.has(getJobId(job))" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
          <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </span>

        <!-- Job info -->
        <div class="tree-job-info">
          <span class="tree-job-name">{{ job.name || '未命名任务' }}</span>
          <span :class="['tree-job-status', getStatusClass(job)]">{{ getStatusLabel(job) }}</span>
        </div>

        <!-- Settings icon -->
        <span class="tree-job-settings" @click="handleEditClick(getJobId(job), $event)" title="编辑">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </span>
      </div>

      <!-- Run Rows (when expanded) -->
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

- [ ] **Step 4: Write the styles**

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

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/components/hermes/jobs/JobTreeList.vue
git commit -m "feat(jobs): add JobTreeList component with expandable tree view"
```

---

### Task 3: ChatPanel — Wire Up JobTreeList and Right Panel Modes

**Files:**
- Modify: `packages/client/src/components/hermes/chat/ChatPanel.vue`

- [ ] **Step 1: Import JobTreeList and add new state**

Replace the `MiniJobList` import with `JobTreeList`:

```ts
// Remove: import MiniJobList from "@/components/hermes/jobs/MiniJobList.vue";
import JobTreeList from "@/components/hermes/jobs/JobTreeList.vue";
```

Add new state refs (near the existing `selectedJobId` ref):

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

- [ ] **Step 2: Add handler functions**

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
    console.error('Failed to load run:', e)
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

Add the `readCronRun` import:

```ts
import { readCronRun } from '@/api/hermes/cron-history'
```

- [ ] **Step 3: Replace sidebar MiniJobList with JobTreeList**

Find the sidebar jobs section (around line 1289) and replace:

```html
<!-- Before -->
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

<!-- After -->
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

- [ ] **Step 4: Replace right panel content for jobs mode**

Find the jobs mode template (around line 2071) and replace:

```html
<!-- Before -->
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

<!-- After -->
<template v-else-if="currentMode === 'jobs'">
  <div class="guard-content-area">
    <!-- GuardPanel: shown when no job is selected -->
    <GuardPanel
      v-if="rightPanelMode === 'guard'"
      @select="handleRobotSelect"
      @create-task="handleRobotSelect"
    />

    <!-- Job chat: shown when a job is selected -->
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

    <!-- Run chat: shown when a run is selected -->
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

- [ ] **Step 5: Add CSS for job-chat-panel**

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

- [ ] **Step 6: Update handleAppModeChange to clear job session state**

In the `handleAppModeChange` function, add cleanup for the new state:

```ts
function handleAppModeChange(mode: 'smartQuery' | 'automation') {
  appMode.value = mode;
  if (mode === 'automation') {
    currentMode.value = "jobs";
    selectedJobId.value = null;
    showGuardPanel.value = true;
    selectedRobot.value = null;
    selectedTaskJob.value = null;
    activeJobSessionId.value = null;       // NEW
    activeRunSessionId.value = null;       // NEW
    activeRunContext.value = null;         // NEW
    void jobsStore.fetchJobs();
  } else {
    currentMode.value = "chat";
    selectedJobId.value = null;
    showGuardPanel.value = true;
    selectedRobot.value = null;
    selectedTaskJob.value = null;
    activeJobSessionId.value = null;       // NEW
    activeRunSessionId.value = null;       // NEW
    activeRunContext.value = null;         // NEW
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/components/hermes/chat/ChatPanel.vue
git commit -m "feat(chat): integrate JobTreeList and job/run chat sessions in jobs mode"
```

---

### Task 4: Verify and Clean Up

**Files:**
- Verify: `packages/client/src/stores/hermes/chat.ts`
- Verify: `packages/client/src/components/hermes/jobs/JobTreeList.vue`
- Verify: `packages/client/src/components/hermes/chat/ChatPanel.vue`

- [ ] **Step 1: Run TypeScript check**

```bash
cd e:/envclaw && npx vue-tsc --noEmit --pretty
```

Expected: No errors.

- [ ] **Step 2: Verify JobTreeList renders correctly**

1. Switch to automation mode in the UI
2. Verify the tree list shows jobs from `jobsStore.jobs`
3. Click the expand arrow on a job → verify runs load via `listCronRuns`
4. Click the ⚙️ icon → verify `JobFormModal` opens
5. Click a job row → verify right panel switches to chat mode

- [ ] **Step 3: Verify chat session binding**

1. Click a job → verify a new session is created and `MessageList` + `ChatInput` appear
2. Send a message → verify it's associated with the job session
3. Click a different job → verify it creates/loads a different session
4. Click back → verify it returns to GuardPanel

- [ ] **Step 4: Verify run chat binding**

1. Expand a job → click a run row
2. Verify `readCronRun` is called and run content is loaded
3. Verify right panel shows chat with run context
4. Click "返回任务对话" → verify it returns to the job's chat session

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete job tree list + task-bound chat implementation"
```
