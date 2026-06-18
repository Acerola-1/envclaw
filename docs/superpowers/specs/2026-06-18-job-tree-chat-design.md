# 定时任务层级列表 + 任务绑定对话 设计文档

## 概述

改造值守模式（`currentMode === 'jobs'`）的左侧任务列表和右侧内容区：

1. **左侧**：扁平任务列表 → 树形列表（Job 父节点 + Runs 子节点）
2. **右侧**：选中 Job 时展示绑定的对话会话；选中 Run 时展示运行详情；未选中时展示值守方案卡片
3. **设置图标**：每个 Job 行右侧增加 ⚙️ 图标，点击打开现有 JobFormModal 编辑弹窗

## 组件架构

### 新增组件

#### `JobTreeList.vue`（替代 `MiniJobList.vue`）

位置：`packages/client/src/components/hermes/jobs/JobTreeList.vue`

**Props**：
```ts
{
  selectedJobId: string | null
  selectedRunKey: string | null  // 格式: "jobId/fileName"
}
```

**Emits**：
```ts
{
  selectJob: [jobId: string]           // 点击 Job 行 → 打开对话
  selectRun: [jobId: string, fileName: string]  // 点击 Run 行 → 展示详情
  editJob: [jobId: string]             // 点击 ⚙️ → 编辑弹窗
  createJob: []                        // 点击新建按钮
}
```

**内部状态**：
```ts
expandedJobs: Set<string>              // 展开的 Job ID 集合
jobRuns: Map<string, RunEntry[]>       // jobId → runs 缓存
loadingRuns: Map<string, boolean>      // jobId → 加载状态
```

**数据加载**：
- 组件挂载时从 `jobsStore.jobs` 读取 Job 列表
- 展开 Job 时懒加载 `listCronRuns(jobId)`，缓存到 `jobRuns`
- 最多显示最近 10 条 runs，超出显示"查看更多 N 条"

### 修改组件

#### `ChatPanel.vue`

**新增状态**：
```ts
const activeJobSessionId = ref<string | null>(null)       // 当前 Job 绑定的 session ID
const activeRunSessionId = ref<string | null>(null)        // 当前 Run 绑定的 session ID
const activeRunContext = ref<{ jobId: string; fileName: string; runTime: string } | null>(null)

type RightPanelMode = 'guard' | 'chat' | 'run-chat'
const rightPanelMode = computed<RightPanelMode>(() => {
  if (activeRunSessionId.value) return 'run-chat'
  if (activeJobSessionId.value) return 'chat'
  return 'guard'
})
```

**新增/修改的处理函数**：
```ts
// 选中 Job → 加载/创建 Job 绑定的对话 session
async function handleSelectJobForChat(jobId: string)

// 选中 Run → 加载/创建 Run 绑定的对话 session（以运行结果为上下文）
async function handleSelectRunForChat(jobId: string, fileName: string, runTime: string)

// 编辑 Job → 打开 JobFormModal
function handleEditJobFromTree(jobId: string)

// 返回值守方案（清除选中）
function handleBackToGuard()

// 从 Run 对话返回到 Job 对话
function handleBackToJobChat()
```

**jobs 模式右侧模板结构**：
```html
<template v-else-if="currentMode === 'jobs'">
  <div class="guard-content-area">
    <!-- GuardPanel：未选中任何 Job 时展示 -->
    <GuardPanel v-if="rightPanelMode === 'guard'"
      @select="handleRobotSelect"
      @create-task="handleRobotSelect" />

    <!-- Job 对话会话：选中 Job 时展示 -->
    <div v-else-if="rightPanelMode === 'chat'" class="job-chat-panel">
      <div class="job-chat-header">
        <span>{{ selectedJobName }}</span>
        <button @click="handleBackToGuard">返回</button>
      </div>
      <MessageList />
      <ChatInput />
    </div>

    <!-- Run 对话会话：选中 Run 时展示 -->
    <div v-else-if="rightPanelMode === 'run-chat'" class="job-chat-panel">
      <div class="job-chat-header">
        <span>{{ activeRunContext.runTime }} 运行分析</span>
        <button @click="handleBackToJobChat">返回任务对话</button>
      </div>
      <MessageList />
      <ChatInput />
    </div>
  </div>
</template>
```

**三种模式统一使用 `MessageList` + `ChatInput`**，通过 `chatStore.setActiveSession()` 切换不同 session 实现内容切换。

#### Chat Store 扩展

在 `stores/hermes/chat.ts` 中新增：

```ts
// Job-Session 绑定映射
const jobSessionMap = ref<Map<string, string>>(new Map())
// Run-Session 绑定映射（key: "jobId/fileName"）
const runSessionMap = ref<Map<string, string>>(new Map())

// 获取 Job 绑定的 session ID
function getJobSessionId(jobId: string): string | null

// 创建 Job 绑定的 session
async function createJobSession(jobId: string, jobPrompt: string): Promise<string>

// 加载 Job session（如果已有则切换，没有则创建）
async function ensureJobSession(jobId: string, jobPrompt: string): Promise<string>

// 获取 Run 绑定的 session ID
function getRunSessionId(jobId: string, fileName: string): string | null

// 创建 Run 绑定的 session（以运行结果为初始上下文）
async function createRunSession(jobId: string, fileName: string, runContent: string): Promise<string>

// 加载 Run session（如果已有则切换，没有则创建）
async function ensureRunSession(jobId: string, fileName: string, runContent: string): Promise<string>
```

`ensureJobSession` 的实现逻辑：
1. 检查 `jobSessionMap` 是否已有该 jobId 的 session
2. 有 → 调用 `setActiveSession(sessionId)` 切换
3. 无 → 调用 `createSession()` 创建新 session，标记 `source: 'job'`，存入映射
4. 返回 sessionId

`ensureRunSession` 的实现逻辑：
1. 检查 `runSessionMap` 是否已有该 run key 的 session
2. 有 → 调用 `setActiveSession(sessionId)` 切换
3. 无 → 调用 `createSession()` 创建新 session，标记 `source: 'job-run'`
4. 将 `runContent` 作为首条系统消息注入（AI 可基于此回答用户追问）
5. 存入映射，返回 sessionId

### 不变组件

- `JobFormModal.vue` — 直接复用，通过 `editJob` emit 触发
- `JobRunHistory.vue` — 不再在 jobs 模式右侧使用（runs 已整合到左侧树形列表）
- `JobsPanel.vue` / `JobCard.vue` — 仅在 `JobsView.vue` 独立页面使用，不影响

## UI 布局

### 左侧：Job 树形列表

```
┌─────────────────────────────────────────┐
│ 定时任务 (3)                    [新建+]  │  ← header
├─────────────────────────────────────────┤
│ ▼ 数字播报专家     [运行中]        ⚙️    │  ← Job 行
│     06-18 10:00  1.2KB                   │  ← Run 行（缩进 24px）
│     06-18 09:00  1.1KB                   │
│     06-18 08:00  1.3KB                   │
│ ▶ 截图采集专家     [待执行]        ⚙️    │
│ ▶ 日报通报专家     [已暂停]        ⚙️    │
└─────────────────────────────────────────┘
```

**Job 行样式**：
- 左侧：展开/折叠箭头（▶/▼），12px
- 中间：Job 名称（13px, font-weight: 500）+ 状态标签
- 右侧：⚙️ 设置图标（16px, 点击打开编辑弹窗）
- 整行可点击 → 选中 Job
- 选中态：左侧蓝色边框 + 浅蓝背景

**Run 行样式**：
- 缩进 24px
- 显示：运行时间（12px）+ 文件大小（11px, 灰色）
- 点击 → 右侧打开 Run 绑定的对话会话（以该次运行结果为上下文）
- 选中态：浅蓝背景

### 右侧：三种状态

| 状态 | 触发条件 | 内容 |
|------|----------|------|
| `guard` | 未选中任何 Job | GuardPanel 值守方案卡片 |
| `chat` | 选中 Job | 标题栏 + MessageList + ChatInput（Job 绑定 session） |
| `run-chat` | 选中 Run | 标题栏 + MessageList + ChatInput（Run 绑定 session） |

**chat 状态标题栏**：
- 左侧：Job 名称
- 右侧：返回按钮（清除选中，回到 guard 状态）

**run-chat 状态标题栏**：
- 左侧："{运行时间} 运行分析"
- 右侧：返回按钮（清除 Run 选中，回到该 Job 的 chat 状态）

## 数据流

```
用户点击 Job 行
    ↓
handleSelectJobForChat(jobId)
    ↓
chatStore.ensureJobSession(jobId, job.prompt)
    ↓
activeJobSessionId = sessionId
chatStore.setActiveSession(sessionId)
rightPanelMode → 'chat'
    ↓
右侧渲染 MessageList + ChatInput（Job 绑定 session）

用户点击 Run 行
    ↓
handleSelectRunForChat(jobId, fileName, runTime)
    ↓
readCronRun(jobId, fileName)  ← 加载运行内容
    ↓
chatStore.ensureRunSession(jobId, fileName, runContent)  ← 创建/加载 Run 绑定 session
    ↓
activeRunSessionId = sessionId
activeRunContext = { jobId, fileName, runTime }
chatStore.setActiveSession(sessionId)
rightPanelMode → 'run-chat'
    ↓
右侧渲染 MessageList + ChatInput（Run 绑定 session，以运行结果为上下文）

用户点击 ⚙️
    ↓
handleEditJobFromTree(jobId)
    ↓
editingJobId = jobId
showJobFormModal = true
    ↓
弹出 JobFormModal 编辑弹窗

用户点击"返回任务对话"
    ↓
handleBackToJobChat()
    ↓
activeRunSessionId = null
activeRunContext = null
chatStore.setActiveSession(activeJobSessionId)
rightPanelMode → 'chat'
    ↓
右侧回到 Job 对话会话

用户点击"返回"
    ↓
handleBackToGuard()
    ↓
activeJobSessionId = null
activeRunSessionId = null
rightPanelMode → 'guard'
    ↓
右侧渲染 GuardPanel
```

## 文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `components/hermes/jobs/JobTreeList.vue` | 新增 | 树形任务列表 |
| `components/hermes/jobs/MiniJobList.vue` | 保留 | 不删除，其他页面可能使用 |
| `components/hermes/chat/ChatPanel.vue` | 修改 | jobs 模式右侧改为三种状态 |
| `stores/hermes/chat.ts` | 修改 | 新增 jobSessionMap/runSessionMap、ensureJobSession/ensureRunSession |
| `components/hermes/guard/GuardPanel.vue` | 不变 | 未选中时展示 |
| `components/hermes/jobs/JobFormModal.vue` | 不变 | 复用 |

## MessageList / ChatInput 绑定

当前 `MessageList` 和 `ChatInput` 通过 `chatStore.activeSessionId` 自动关联活动 session。绑定 Job session 的方式：

1. 选中 Job 时，调用 `chatStore.setActiveSession(sessionId)` 切换活动 session
2. `MessageList` 自动渲染该 session 的消息（已通过 `chatStore.messages` 响应式更新）
3. `ChatInput` 发送消息时自动归属到当前活动 session
4. 返回值守方案时，恢复之前的活动 session（或清除）

**注意**：
- 切换 session 前需保存当前 session 的草稿（`ChatInput` 已有 `saveDraftForActiveSession` 逻辑）。
- `jobSessionMap` 页面刷新后的恢复：从 session 列表中筛选 `source === 'job'` 的 session 重建映射，无需额外持久化。

## 交互细节

1. **Job 行点击 vs ⚙️ 点击**：⚙️ 使用 `@click.stop` 阻止冒泡，不触发 Job 选中
2. **Run 懒加载**：首次展开 Job 时调用 `listCronRuns(jobId)`，结果缓存
3. **Session 持久化**：Job/Run 绑定的 session 持久化在后端，刷新后可恢复
4. **切换 Job**：点击不同 Job 时切换 session，之前的对话保留
5. **Run 对话返回**：从 Run 对话返回时，回到该 Job 的 chat 状态（而非 guard）
6. **新建任务**：header 区域的"新建+"按钮打开 JobFormModal
7. **Run 对话上下文**：首次创建 Run session 时，将该次运行的完整内容作为系统消息注入，AI 可基于此回答用户的追问
8. **session 切换前**：调用 `chatInputRef.value.saveDraftForActiveSession()` 保存当前草稿
