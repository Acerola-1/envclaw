# Hermes Web UI 原型改造实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 `docs/prototypes/` 12 个 HTML 原型设计，将 `/hermes/chat` 完全替换为 Workbuddy 风格融合式大提示词布局，并新建自动化值守页面群。

**Architecture:** 保留现有 Socket.IO 通信层、会话 API、model/profile store 不变。ChatPanel.vue (104KB) 拆分为 8 个独立组件。新建 `stores/envclaw/duty.ts` 管理值守 UI 状态。新建 `/hermes/duty/*` 路由群承载原型中的自动化页面。

**Tech Stack:** Vue 3 + Naive UI + Pinia + vue-router (hash) + SCSS + TypeScript

**Spec:** `docs/superpowers/specs/2026-08-04-hermes-web-ui-redesign.md`

## Global Constraints

- `--accent-primary: #1886e7` 替换当前 `#333333`，同步更新 `--accent-primary-rgb`
- 侧栏固定 240px，用户信息在侧栏底部，禁止漂移
- 内联 SVG `viewBox="0 0 24 24"` stroke 风格，禁止 emoji
- 品牌文案「UniEcoClaw」；「Skill」→「技能」；「MCP」→「连接器」
- 禁止 `<a>` 嵌套 `<a>`；卡片外层用 `<div>` + click 跳转
- 保留 `api/hermes/chat.ts` Socket.IO 通信层、`MarkdownRenderer.vue`、`ModelSelector.vue` 核心逻辑不变
- 新文案走 `i18n/locales/`（原型阶段至少 `zh-CN.json`），不硬编码中文
- Electron 内嵌 Chromium 兼容（Chrome 90+），最小分辨率 1280×720
- **不提交 / 不推送**

---

### Task 1: CSS 变量体系切换为原型配色

**Files:**
- Modify: `packages/client/src/styles/variables.scss`

**Interfaces:**
- Produces: 全局 CSS 变量 `--accent-primary: #1886e7`、`--accent-primary-rgb: 24,134,231`、`--radius-lg: 14px`、`--radius-md: 10px`、`--radius-sm: 6px`
- Breaking change: 所有引用 `--accent-primary` / `$accent-primary` 的组件视觉会变为蓝色系

**Steps:**

- [ ] 将 light 主题 `:root` 中的 accent 变量从黑白改为蓝色系：
  ```scss
  :root {
    --accent-primary: #1886e7;
    --accent-hover: #0f7ad4;
    --accent-muted: #7ab8f0;
    --accent-primary-rgb: 24, 134, 231;
    --accent-hover-rgb: 15, 122, 212;
  }
  ```

- [ ] 更新 dark 主题 accent 变量：
  ```scss
  .dark {
    --accent-primary: #4da3f5;
    --accent-hover: #6db5f7;
    --accent-muted: #2d6db0;
    --accent-primary-rgb: 77, 163, 245;
    --accent-hover-rgb: 109, 181, 247;
  }
  ```

- [ ] 补充原型所需的额外 CSS 变量（在 `:root` 和 `.dark` 中分别定义）：
  ```scss
  :root {
    --bg-page: #f5f8fb;           // 页面底色（浅蓝灰）
    --radius-lg: 14px;
    --radius-md: 10px;
    --radius-sm: 6px;
    --accent-orange: #f59e0b;     // 「创建值守任务」chip 橙色边框
    --badge-config: #dbeafe;      // ⚙ 需配置 蓝色徽章
    --badge-direct: #dcfce7;      // ⚡ 直接用 绿色徽章
  }
  .dark {
    --bg-page: #14181c;
    --accent-orange: #fbbf24;
    --badge-config: #1e3a5f;
    --badge-direct: #14532d;
  }
  ```

- [ ] 更新对应 SCSS 变量引用：
  ```scss
  $bg-page: var(--bg-page);
  ```

- [ ] 手动检查：在浏览器中打开任意 `/hermes/chat` 页面，确认按钮、链接、active 状态从黑色变为蓝色

---

### Task 2: 侧栏重构为原型 5 段布局

**Files:**
- Modify: `packages/client/src/components/layout/AppSidebar.vue`

**Interfaces:**
- Consumes: 现有 route names（`hermes.chat`, `hermes.duty` 等，Task 13 新增的 route name 后续匹配）
- Produces: 侧栏 5 段：品牌区 → 新建任务主按钮 → 4 项主导航 → 最近对话 → 用户区

**Steps:**

- [ ] 替换 `<template>` 为原型 5 段结构：
  ```vue
  <template>
    <aside class="sidebar" :class="{ open: appStore.sidebarOpen, collapsed: appStore.sidebarCollapsed }"
      @click="handleSidebarClick">
      <!-- ① 品牌区 -->
      <div class="sidebar-brand">
        <div class="brand-logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v12M6 12h12"/>
          </svg>
        </div>
        <div class="brand-text">
          <span class="brand-name">UniEcoClaw</span>
          <span class="brand-subtitle">数智环保·UniEcoClaw</span>
        </div>
      </div>

      <!-- ② 新建任务主按钮 -->
      <RouteLinkItem class="nav-item primary-btn" :to="{ name: 'hermes.chat' }">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        <span>新建任务</span>
      </RouteLinkItem>

      <!-- ③ 4 项主导航 -->
      <nav class="sidebar-nav">
        <RouteLinkItem class="nav-item" :to="{ name: 'hermes.duty' }"
          :active="selectedKey === 'hermes.duty' || selectedKey === 'hermes.dutyDetail' || selectedKey === 'hermes.dutyCreate' || selectedKey === 'hermes.dutyPicker'">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
          </svg>
          <span>自动化</span>
        </RouteLinkItem>
        <RouteLinkItem class="nav-item" :to="{ name: 'hermes.templates' }"
          :active="selectedKey === 'hermes.templates' || selectedKey === 'hermes.templateEditor'">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          <span>任务模板库</span>
        </RouteLinkItem>
        <RouteLinkItem class="nav-item" :to="{ name: 'hermes.capabilities' }"
          :active="selectedKey === 'hermes.capabilities'">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <polygon points="12 2 2 7 12 12 22 7 12 2"/>
            <polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
          </svg>
          <span>平台·技能·连接器</span>
        </RouteLinkItem>
        <!-- 更多（折叠）占位 -->
        <div class="nav-item nav-more" @click="toggleGroup('more')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
          </svg>
          <span>更多</span>
        </div>
      </nav>

      <!-- ④ 最近对话折叠区 -->
      <div class="sidebar-recent">
        <div class="recent-header" @click="toggleRecent">
          <span>最近对话</span>
          <svg class="recent-arrow" :class="{ collapsed: recentCollapsed }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
        <div v-show="!recentCollapsed" class="recent-list">
          <div v-for="s in recentSessions" :key="s.id" class="recent-item" @click="router.push({ name: 'hermes.session', params: { sessionId: s.id } })">
            {{ s.title }}
          </div>
          <div v-if="moreCount > 0" class="recent-more" @click="router.push({ name: 'hermes.history' })">
            查看更多 ({{ moreCount }})
          </div>
        </div>
      </div>

      <!-- ⑤ 用户信息（底部固定） -->
      <div class="sidebar-user">
        <div class="user-avatar">{{ currentUsername?.charAt(0)?.toUpperCase() }}</div>
        <span class="user-name">{{ currentUsername }}</span>
        <button class="user-btn" title="通知"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></button>
        <button class="user-btn" title="设置" @click="router.push({ name: 'hermes.settings' })"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>
      </div>
    </aside>
  </template>
  ```

- [ ] 更新 `<script setup>` 添加最近对话和退出逻辑：
  ```ts
  import { useChatStore } from '@/stores/hermes/chat'
  import { usePersistentRecord } from '@/composables/usePersistentRecord'

  const chatStore = useChatStore()
  const router = useRouter()

  const { record: recentCollapsed, persist: persistRecent } = usePersistentRecord('unieco_recent_collapsed')

  const recentSessions = computed(() => chatStore.sessions.slice(0, 5))
  const moreCount = computed(() => Math.max(0, chatStore.sessions.length - 5))

  function toggleRecent() {
    recentCollapsed.value = !recentCollapsed.value
    persistRecent()
  }

  function toggleGroup(_key: string) { /* Toast 示意原型 */ }
  ```

- [ ] 更新 `<style scoped lang="scss">` — 保留 sidebar 基本布局样式，增加新段样式：
  ```scss
  .sidebar-brand {
    display: flex; align-items: center; gap: 10px; padding: 12px 8px 16px;
    .brand-logo { color: $accent-primary; }
    .brand-name { font-size: 16px; font-weight: 700; color: $text-primary; display: block; }
    .brand-subtitle { font-size: 11px; color: $text-muted; }
  }
  .primary-btn {
    background: $accent-primary; color: #fff; border-radius: $radius-md;
    justify-content: center; margin-bottom: 8px;
    &:hover { background: $accent-hover; color: #fff; }
    &.active { background: $accent-hover; }
  }
  .sidebar-recent {
    flex: 1; overflow-y: auto; min-height: 0; border-top: 1px solid $border-color; padding-top: 8px;
  }
  .sidebar-user {
    display: flex; align-items: center; gap: 8px; padding: 10px 8px; border-top: 1px solid $border-color;
    .user-avatar { width: 28px; height: 28px; border-radius: 50%; background: $accent-primary; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; }
    .user-name { flex: 1; font-size: 13px; color: $text-primary; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .user-btn { background: none; border: none; color: $text-muted; cursor: pointer; padding: 4px; border-radius: 4px; &:hover { color: $text-primary; } }
  }
  ```

- [ ] 删除原有 nav-group 分组结构（Agent/Monitoring/System 三组 + ModelSelector + 状态指示器 + 登出 + 版本信息），这些功能入口迁移到「更多」折叠区内

- [ ] 手动验证：启动 dev server，检查 `/hermes/chat` 侧栏显示 5 段（品牌 → 新建任务按钮 → 4 导航 → 最近对话 → 用户区）

---

### Task 3: 新建 duty store + 削减 chat store

**Files:**
- Create: `packages/client/src/stores/envclaw/duty.ts`
- Modify: `packages/client/src/stores/hermes/chat.ts`

**Interfaces:**
- `duty.ts` Produces:
  - `scene: Ref<'query' | 'duty'>` — 当前场景 Tab
  - `capabilityChips: ComputedRef<Chip[]>` — 根据 scene 返回 chip 池
  - `selectedModel: Ref<string>` — 当前选中模型
  - `draftParams: Ref<DraftParams | null>` — 草稿卡参数
  - `pickerSelection: Ref<PickerSelection>` — picker 页多选结果
  - `setScene(s: 'query' | 'duty'): void`
  - `setDraftParams(p: DraftParams): void`
  - `createJobFromDraft(): Promise<void>`
  - `clearDraft(): void`
- `chat.ts` Produces (same as before, UI state moved to duty store):
  - 保留：`sessions`, `activeSession`, `activeSessionId`, `sendMessage()`, `loadSessions()`, `switchSession()`, Socket.IO 管理
  - 移除：ChatPanel 特有的 UI 状态（appMode 等）

**Steps:**

- [ ] 创建 `packages/client/src/stores/envclaw/duty.ts`：
  ```ts
  import { defineStore } from 'pinia'
  import { ref, computed } from 'vue'
  import { useMessage } from 'naive-ui'
  import { createJob } from '@/api/envclaw/jobs'

  export interface Chip {
    id: string
    label: string
    icon: string    // SVG icon name
    prompt: string
    kind: 'query' | 'duty'
    highlighted?: boolean  // 橙色边框
  }

  export interface DraftParams {
    taskName: string
    capabilities: string[]
    schedule: string
    pushChannels: string[]
  }

  export interface PickerSelection {
    templateId?: string
    capIds: string[]
    capNames: string[]
    skillIds: string[]
    skillNames: string[]
    mcpIds: string[]
    mcpNames: string[]
  }

  const QUERY_CHIPS: Chip[] = [
    { id: 'onemap', label: '一张图', icon: 'map', prompt: '请用一张图展示...', kind: 'query' },
    { id: 'ranking', label: '浓度排名', icon: 'bar-chart', prompt: '请查询浓度排名...', kind: 'query' },
    { id: 'hourly', label: '小时播报', icon: 'clock', prompt: '请播报最近一小时...', kind: 'query' },
    { id: 'monitor', label: '监测数据', icon: 'database', prompt: '请查询监测数据...', kind: 'query' },
    { id: 'create-duty', label: '创建值守任务', icon: 'zap', prompt: '请帮我创建一个值守任务...', kind: 'query', highlighted: true },
  ]

  const DUTY_CHIPS: Chip[] = [
    { id: 'duty-create', label: '创建值守任务', icon: 'zap', prompt: '请帮我创建一个值守任务...', kind: 'duty', highlighted: true },
    { id: 'duty-ranking', label: '定时浓度排名', icon: 'bar-chart', prompt: '每天定时发送浓度排名...', kind: 'duty' },
    { id: 'duty-onemap', label: '定时一张图', icon: 'map', prompt: '每天定时生成一张图...', kind: 'duty' },
    { id: 'duty-hourly', label: '定时小时播报', icon: 'clock', prompt: '每小时定时播报...', kind: 'duty' },
    { id: 'duty-monitor', label: '定时监测数据', icon: 'database', prompt: '定时采集监测数据...', kind: 'duty' },
  ]

  export const useDutyStore = defineStore('duty', () => {
    const scene = ref<'query' | 'duty'>('query')
    const selectedModel = ref('Auto')
    const draftParams = ref<DraftParams | null>(null)
    const pickerSelection = ref<PickerSelection>({
      capIds: [], capNames: [], skillIds: [], skillNames: [], mcpIds: [], mcpNames: [],
    })
    const message = useMessage()

    const capabilityChips = computed<Chip[]>(() =>
      scene.value === 'query' ? QUERY_CHIPS : DUTY_CHIPS
    )

    function setScene(s: 'query' | 'duty') { scene.value = s }
    function setDraftParams(p: DraftParams) { draftParams.value = p }

    function clearDraft() { draftParams.value = null }

    function setPickerSelection(sel: Partial<PickerSelection>) {
      Object.assign(pickerSelection.value, sel)
    }

    function clearPickerSelection() {
      pickerSelection.value = { capIds: [], capNames: [], skillIds: [], skillNames: [], mcpIds: [], mcpNames: [] }
    }

    async function createJobFromDraft() {
      if (!draftParams.value) return
      await createJob({
        name: draftParams.value.taskName,
        capabilities: draftParams.value.capabilities,
        schedule: draftParams.value.schedule,
        pushChannels: draftParams.value.pushChannels,
      })
      message.success('已创建并调度')
      clearDraft()
    }

    return {
      scene, selectedModel, draftParams, pickerSelection, capabilityChips,
      setScene, setDraftParams, clearDraft, setPickerSelection, clearPickerSelection, createJobFromDraft,
    }
  })
  ```

- [ ] 创建 API 文件 `packages/client/src/api/envclaw/jobs.ts`：
  ```ts
  import { api } from '@/api/client'
  export interface CreateJobPayload {
    name: string; capabilities: string[]; schedule: string; pushChannels: string[]
    prompt?: string; skills?: string[]; mcps?: string[];
  }
  export function createJob(payload: CreateJobPayload) {
    return api.post('/api/hermes/jobs', payload)
  }
  export function getJobRuns(jobId: string) {
    return api.get(`/api/hermes/jobs/${jobId}/runs`)
  }
  export function runJob(jobId: string) {
    return api.post(`/api/hermes/jobs/${jobId}/run`)
  }
  export function toggleJob(jobId: string, action: 'pause' | 'resume') {
    return api.post(`/api/hermes/jobs/${jobId}/${action}`)
  }
  export function deleteJob(jobId: string) {
    return api.delete(`/api/hermes/jobs/${jobId}`)
  }
  ```

- [ ] 在 `chat.ts` 中移除 ChatPanel 特有 UI 状态（如 appMode），保留所有通信层逻辑不变

---

### Task 4: ChatInput 重构为纯输入框

**Files:**
- Modify: `packages/client/src/components/hermes/chat/ChatInput.vue`

**Interfaces:**
- Consumes: 无
- Produces:
  - Props: `modelValue: string`, `disabled?: boolean`, `placeholder?: string`
  - Emits: `update:modelValue`, `send`, `slash` (键入 `/` 时触发)

**Steps:**

- [ ] 重写 ChatInput.vue 为纯 textarea 组件：
  ```vue
  <script setup lang="ts">
  import { ref, watch, nextTick } from 'vue'

  const props = withDefaults(defineProps<{
    modelValue: string
    disabled?: boolean
    placeholder?: string
  }>(), { disabled: false, placeholder: '描述您的问题或值守需求…' })

  const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void
    (e: 'send'): void
    (e: 'slash'): void
  }>()

  const textarea = ref<HTMLTextAreaElement>()
  const focused = ref(false)

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (props.modelValue.trim()) emit('send')
    }
    if (e.key === '/' && props.modelValue === '') {
      emit('slash')
    }
  }

  function fill(prompt: string) {
    emit('update:modelValue', prompt)
    nextTick(() => textarea.value?.focus())
  }

  defineExpose({ fill })
  </script>

  <template>
    <div class="chat-input-wrapper" :class="{ focused }">
      <textarea
        ref="textarea"
        :value="modelValue"
        :disabled="disabled"
        :placeholder="placeholder"
        class="chat-input-textarea"
        rows="3"
        @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
        @keydown="onKeydown"
        @focus="focused = true"
        @blur="focused = false"
      />
      <div class="chat-input-hint">Enter 发送 / Shift+Enter 换行</div>
    </div>
  </template>

  <style scoped lang="scss">
  @use "@/styles/variables" as *;
  .chat-input-wrapper {
    border: 2px solid $border-color;
    border-radius: $radius-lg;
    padding: 16px;
    background: $bg-card;
    transition: border-color 0.2s, box-shadow 0.2s;
    &.focused { border-color: $accent-primary; box-shadow: 0 0 0 3px rgba(var(--accent-primary-rgb), 0.15); }
  }
  .chat-input-textarea {
    width: 100%; border: none; outline: none; resize: none; font-size: 15px; line-height: 1.6;
    background: transparent; color: $text-primary; font-family: inherit;
    &::placeholder { color: $text-muted; }
  }
  .chat-input-hint { font-size: 11px; color: $text-muted; margin-top: 8px; text-align: right; }
  </style>
  ```

---

### Task 5: CapabilityChips 组件

**Files:**
- Create: `packages/client/src/components/hermes/chat/CapabilityChips.vue`

**Interfaces:**
- Consumes: `scene` from `useDutyStore()`
- Produces:
  - Emits: `select(cmd: string, prompt: string)`

**Steps:**

- [ ] 创建组件：
  ```vue
  <script setup lang="ts">
  import { useDutyStore } from '@/stores/envclaw/duty'

  const dutyStore = useDutyStore()
  const emit = defineEmits<{ (e: 'select', cmd: string, prompt: string): void }>()

  function handleChip(chip: typeof dutyStore.capabilityChips[number]) {
    emit('select', chip.id, chip.prompt)
  }
  </script>

  <template>
    <div class="capability-chips">
      <button
        v-for="chip in dutyStore.capabilityChips"
        :key="chip.id"
        class="chip"
        :class="{ highlighted: chip.highlighted }"
        @click="handleChip(chip)"
      >
        <span class="chip-label">{{ chip.label }}</span>
      </button>
    </div>
  </template>

  <style scoped lang="scss">
  @use "@/styles/variables" as *;
  .capability-chips {
    display: flex; gap: 8px; overflow-x: auto; padding: 4px 0;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }
  .chip {
    display: flex; align-items: center; gap: 6px; padding: 6px 14px;
    border: 1px solid $border-color; border-radius: 999px;
    background: $bg-card; color: $text-secondary; font-size: 13px;
    cursor: pointer; white-space: nowrap; transition: all 0.15s;
    flex-shrink: 0;
    &:hover { border-color: $accent-primary; background: rgba(var(--accent-primary-rgb), 0.04); color: $text-primary; }
    &.highlighted { border-color: var(--accent-orange); color: var(--accent-orange); }
  }
  </style>
  ```

---

### Task 6: SlashCommandMenu 组件

**Files:**
- Create: `packages/client/src/components/hermes/chat/SlashCommandMenu.vue`

**Interfaces:**
- Consumes: `dutyStore.capabilityChips`
- Produces:
  - Props: `visible: boolean`
  - Emits: `select(cmd: string, prompt: string)`, `close`

**Steps:**

- [ ] 创建组件：
  ```vue
  <script setup lang="ts">
  import { computed, watch, ref } from 'vue'
  import { useDutyStore } from '@/stores/envclaw/duty'

  const props = defineProps<{ visible: boolean }>()
  const emit = defineEmits<{ (e: 'select', cmd: string, prompt: string): void; (e: 'close'): void }>()

  const dutyStore = useDutyStore()
  const activeIdx = ref(0)
  const items = computed(() => dutyStore.capabilityChips.map(c => ({ id: c.id, label: c.label, prompt: c.prompt })))

  watch(() => props.visible, (v) => { if (v) activeIdx.value = 0 })

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx.value = Math.min(activeIdx.value + 1, items.value.length - 1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx.value = Math.max(activeIdx.value - 1, 0) }
    else if (e.key === 'Enter') { e.preventDefault(); const item = items.value[activeIdx.value]; if (item) emit('select', item.id, item.prompt) }
    else if (e.key === 'Escape') { emit('close') }
  }
  </script>

  <template>
    <Teleport to="body">
      <div v-if="visible" class="slash-overlay" @click="emit('close')">
        <div class="slash-menu" :style="{ position: 'fixed', bottom: '120px', left: '280px' }" @click.stop @keydown="onKeydown">
          <div v-for="(item, idx) in items" :key="item.id"
            class="slash-item" :class="{ active: idx === activeIdx }"
            @click="emit('select', item.id, item.prompt)">
            <span class="slash-cmd">/{{ item.id }}</span>
            <span class="slash-label">{{ item.label }}</span>
          </div>
        </div>
      </div>
    </Teleport>
  </template>

  <style scoped lang="scss">
  @use "@/styles/variables" as *;
  .slash-overlay { position: fixed; inset: 0; z-index: 999; }
  .slash-menu {
    background: $bg-card; border: 1px solid $border-color; border-radius: $radius-md;
    box-shadow: 0 8px 30px rgba(0,0,0,0.12); padding: 6px; min-width: 280px;
  }
  .slash-item {
    display: flex; gap: 12px; padding: 10px 12px; border-radius: $radius-sm; cursor: pointer;
    &:hover, &.active { background: rgba(var(--accent-primary-rgb), 0.06); }
    .slash-cmd { font-family: $font-code; font-size: 13px; color: $accent-primary; min-width: 80px; }
    .slash-label { font-size: 13px; color: $text-primary; }
  }
  </style>
  ```

---

### Task 7: ChatHero 空态组件

**Files:**
- Create: `packages/client/src/components/hermes/chat/ChatHero.vue`

**Interfaces:**
- Consumes: `dutyStore.scene`, `dutyStore.setScene`
- Produces:
  - Emits: `fill-prompt(text: string)`

**Steps:**

- [ ] 创建组件：
  ```vue
  <script setup lang="ts">
  import { useDutyStore } from '@/stores/envclaw/duty'

  const dutyStore = useDutyStore()
  const emit = defineEmits<{ (e: 'fill-prompt', text: string): void }>()

  const examplePrompts = {
    query: '试试：每天早上 8 点把平顶山市的实时浓度排名发到我邮箱',
    duty: '试试：每周一早上生成郑州市上一周空气质量周报',
  }
  </script>

  <template>
    <div class="chat-hero">
      <h1 class="hero-title">UniEcoClaw，我帮你</h1>
      <p class="hero-subtitle">直接提问，或选一个能力开始——也可以让我把它变成定时运行的值守任务</p>

      <div class="hero-scene-tabs">
        <button class="scene-tab" :class="{ active: dutyStore.scene === 'query' }" @click="dutyStore.setScene('query')">
          查数据
        </button>
        <button class="scene-tab" :class="{ active: dutyStore.scene === 'duty' }" @click="dutyStore.setScene('duty')">
          建值守
        </button>
      </div>

      <button class="hero-example" @click="emit('fill-prompt', dutyStore.scene === 'query' ? examplePrompts.query : examplePrompts.duty)">
        {{ dutyStore.scene === 'query' ? examplePrompts.query : examplePrompts.duty }}
      </button>
    </div>
  </template>

  <style scoped lang="scss">
  @use "@/styles/variables" as *;
  .chat-hero { text-align: center; padding: 60px 20px 40px; }
  .hero-title { font-size: 28px; font-weight: 700; color: $text-primary; margin: 0 0 8px; }
  .hero-subtitle { font-size: 15px; color: $text-secondary; margin: 0 0 24px; }
  .hero-scene-tabs { display: flex; justify-content: center; gap: 4px; margin-bottom: 16px; }
  .scene-tab {
    padding: 8px 20px; border: 1px solid $border-color; border-radius: 999px;
    background: $bg-card; color: $text-secondary; font-size: 14px; cursor: pointer;
    &.active { background: $accent-primary; color: #fff; border-color: $accent-primary; }
  }
  .hero-example {
    padding: 10px 24px; border: 1px dashed $border-color; border-radius: $radius-md;
    background: $bg-page; color: $text-secondary; font-size: 13px; cursor: pointer;
    &:hover { border-color: $accent-primary; color: $accent-primary; }
  }
  </style>
  ```

---

### Task 8: TaskDraftCard 草稿卡组件

**Files:**
- Create: `packages/client/src/components/hermes/chat/TaskDraftCard.vue`

**Interfaces:**
- Consumes: `dutyStore.draftParams`
- Produces:
  - Emits: `create` (跳 create 预填), `confirm` (直接创建)
  - Props: `params: DraftParams`

**Steps:**

- [ ] 创建组件：
  ```vue
  <script setup lang="ts">
  import type { DraftParams } from '@/stores/envclaw/duty'

  const props = defineProps<{ params: DraftParams }>()
  const emit = defineEmits<{ (e: 'create'): void; (e: 'confirm'): void }>()
  </script>

  <template>
    <div class="draft-card">
      <div class="draft-header">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
        <span>检测到值守任务意图</span>
      </div>
      <div class="draft-fields">
        <div class="draft-field"><span class="df-label">任务名</span><span class="df-value">{{ params.taskName }}</span></div>
        <div class="draft-field"><span class="df-label">能力</span><span class="df-value">{{ params.capabilities.join('、') }}</span></div>
        <div class="draft-field"><span class="df-label">调度</span><span class="df-value">{{ params.schedule }}</span></div>
        <div class="draft-field"><span class="df-label">推送</span><span class="df-value">{{ params.pushChannels.join('、') }}</span></div>
      </div>
      <div class="draft-actions">
        <button class="draft-btn primary" @click="emit('create')">创建为值守任务</button>
        <button class="draft-btn" @click="emit('confirm')">直接确认（跳过向导）</button>
      </div>
    </div>
  </template>

  <style scoped lang="scss">
  @use "@/styles/variables" as *;
  .draft-card {
    border: 1px solid var(--accent-orange); border-radius: $radius-md;
    background: $bg-card; padding: 16px; max-width: 480px; margin: 8px 0;
  }
  .draft-header {
    display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: $text-primary; margin-bottom: 12px;
    svg { color: var(--accent-orange); }
  }
  .draft-fields { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
  .draft-field { display: flex; gap: 8px; font-size: 13px; }
  .df-label { color: $text-muted; min-width: 48px; }
  .df-value { color: $text-primary; }
  .draft-actions { display: flex; gap: 8px; }
  .draft-btn {
    padding: 8px 16px; border-radius: $radius-sm; font-size: 13px; cursor: pointer; border: 1px solid $border-color;
    background: $bg-card; color: $text-primary;
    &.primary { background: $accent-primary; color: #fff; border-color: $accent-primary; }
  }
  </style>
  ```

---

### Task 9: ChatMessageFlow 消息流组件

**Files:**
- Create: `packages/client/src/components/hermes/chat/ChatMessageFlow.vue`

**Interfaces:**
- Consumes: `chatStore.messages`, `chatStore.activeSession`, `MarkdownRenderer.vue`
- Produces: 消息流渲染（用户气泡 / AI 气泡 / 草稿卡嵌入 / 工具调用卡嵌入）

**Steps:**

- [ ] 创建组件，复用现有 `MessageItem.vue` 和 `MarkdownRenderer.vue`，在消息末尾嵌入 TaskDraftCard：
  ```vue
  <script setup lang="ts">
  import { computed } from 'vue'
  import { useChatStore } from '@/stores/hermes/chat'
  import { useDutyStore, type DraftParams } from '@/stores/envclaw/duty'
  import MessageItem from './MessageItem.vue'
  import TaskDraftCard from './TaskDraftCard.vue'

  const chatStore = useChatStore()
  const dutyStore = useDutyStore()

  const messages = computed(() => chatStore.activeSession?.messages ?? [])

  const showDraftCard = computed(() => dutyStore.draftParams !== null)
  const draftParams = computed(() => dutyStore.draftParams!)

  function handleCreate() {
    if (!draftParams.value) return
    const p = encodeURIComponent(JSON.stringify(draftParams.value))
    window.location.hash = `/hermes/duty/create?from=chat&prompt=${p}`
  }

  function handleConfirm() {
    dutyStore.createJobFromDraft()
  }
  </script>

  <template>
    <div class="message-flow">
      <MessageItem v-for="msg in messages" :key="msg.id" :message="msg" />
      <TaskDraftCard v-if="showDraftCard" :params="draftParams" @create="handleCreate" @confirm="handleConfirm" />
      <div v-if="chatStore.isStreaming" class="streaming-indicator">AI 正在思考...</div>
    </div>
  </template>

  <style scoped lang="scss">
  .message-flow { flex: 1; overflow-y: auto; padding: 20px 24px; }
  .streaming-indicator { font-size: 13px; color: var(--text-muted); padding: 12px 0; }
  </style>
  ```

---

### Task 10: ChatComposer 输入组合块

**Files:**
- Create: `packages/client/src/components/hermes/chat/ChatComposer.vue`

**Interfaces:**
- Consumes: `ChatInput.vue`, `CapabilityChips.vue`, `SlashCommandMenu.vue`, `ModelSelector.vue`, `dutyStore`, `chatStore`
- Produces: 融合式大输入框组合块（Chip 行 + 输入框 + 底栏工具行 + 框下辅助行）

**Steps:**

- [ ] 创建组件：
  ```vue
  <script setup lang="ts">
  import { ref, computed } from 'vue'
  import { useRouter } from 'vue-router'
  import { useChatStore } from '@/stores/hermes/chat'
  import { useDutyStore } from '@/stores/envclaw/duty'
  import ChatInput from './ChatInput.vue'
  import CapabilityChips from './CapabilityChips.vue'
  import SlashCommandMenu from './SlashCommandMenu.vue'
  import ModelSelector from '@/components/layout/ModelSelector.vue'

  const chatStore = useChatStore()
  const dutyStore = useDutyStore()
  const router = useRouter()

  const inputText = ref('')
  const showSlash = ref(false)
  const hasMessages = computed(() => (chatStore.activeSession?.messages?.length ?? 0) > 0)

  function handleChipSelect(_cmd: string, prompt: string) {
    inputText.value = prompt
  }

  function handleSend() {
    if (!inputText.value.trim()) return
    chatStore.sendMessage(inputText.value)
    inputText.value = ''
  }

  function handleSlash() { showSlash.value = true }
  function handleSlashClose() { showSlash.value = false }

  function handleSlashSelect(_cmd: string, prompt: string) {
    inputText.value = prompt
    showSlash.value = false
  }
  </script>

  <template>
    <div class="composer" :class="{ 'composer-hero': !hasMessages }">
      <!-- Chip 行 -->
      <CapabilityChips @select="handleChipSelect" />

      <!-- 输入框 -->
      <ChatInput v-model="inputText" @send="handleSend" @slash="handleSlash" />

      <!-- 底栏工具行 -->
      <div class="composer-toolbar">
        <div class="toolbar-left">
          <button class="toolbar-btn" title="附件">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>
        </div>
        <div class="toolbar-right">
          <ModelSelector />
          <button class="toolbar-btn" title="语音">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/>
            </svg>
          </button>
          <button class="send-btn" :disabled="!inputText.trim()" @click="handleSend">发送</button>
        </div>
      </div>

      <!-- 框下辅助行 -->
      <div class="composer-footer">
        <span>默认工作空间</span>
        <span class="footer-sep">·</span>
        <span class="perm-badge">完全访问权限</span>
      </div>

      <SlashCommandMenu :visible="showSlash" @select="handleSlashSelect" @close="handleSlashClose" />
    </div>
  </template>

  <style scoped lang="scss">
  @use "@/styles/variables" as *;
  .composer {
    padding: 16px 24px 20px; border-top: 1px solid $border-color;
    &.composer-hero { max-width: 720px; margin: 0 auto; border: none; padding-top: 40px; }
  }
  .composer-toolbar {
    display: flex; justify-content: space-between; align-items: center; margin-top: 12px;
  }
  .toolbar-left, .toolbar-right { display: flex; align-items: center; gap: 6px; }
  .toolbar-btn {
    background: none; border: none; color: $text-muted; cursor: pointer; padding: 6px; border-radius: 4px;
    &:hover { color: $text-primary; background: $bg-secondary; }
  }
  .send-btn {
    padding: 8px 20px; border: none; border-radius: $radius-sm; background: $accent-primary; color: #fff;
    font-size: 14px; cursor: pointer;
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }
  .composer-footer {
    display: flex; gap: 6px; font-size: 12px; color: $text-muted; margin-top: 8px;
  }
  .perm-badge { border: 1px solid var(--accent-orange); color: var(--accent-orange); padding: 1px 8px; border-radius: 999px; font-size: 11px; }
  </style>
  ```

---

### Task 11: ChatShell 布局壳

**Files:**
- Create: `packages/client/src/components/hermes/chat/ChatShell.vue`

**Interfaces:**
- Consumes: ChatHero, ChatMessageFlow, ChatComposer, chatStore
- Produces: 对话页完整布局（Hero 空态/MessageFlow 消息流 + 始终底部 Composer）

**Steps:**

- [ ] 创建组件：
  ```vue
  <script setup lang="ts">
  import { computed } from 'vue'
  import { useChatStore } from '@/stores/hermes/chat'
  import ChatHero from './ChatHero.vue'
  import ChatMessageFlow from './ChatMessageFlow.vue'
  import ChatComposer from './ChatComposer.vue'

  const chatStore = useChatStore()
  const hasMessages = computed(() => (chatStore.activeSession?.messages?.length ?? 0) > 0)
  </script>

  <template>
    <div class="chat-shell">
      <ChatHero v-if="!hasMessages" @fill-prompt="/* ChatComposer handles via provide/inject or shared ref */" />
      <ChatMessageFlow v-else />
      <ChatComposer />
    </div>
  </template>

  <style scoped lang="scss">
  .chat-shell {
    display: flex; flex-direction: column; height: calc(100 * var(--vh));
    width: 100%;
  }
  </style>
  ```

---

### Task 12: ChatView 集成 — 连接 ChatShell 替换 ChatPanel

**Files:**
- Modify: `packages/client/src/views/hermes/ChatView.vue`
- Modify: `packages/client/src/App.vue`（如需要调整侧栏显示逻辑）

**Interfaces:**
- Consumes: ChatShell

**Steps:**

- [ ] 简化 ChatView.vue，用 ChatShell 替换 ChatPanel：
  ```vue
  <script setup lang="ts">
  import { computed, onMounted, onUnmounted, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import ChatShell from '@/components/hermes/chat/ChatShell.vue'
  import { useAppStore } from '@/stores/hermes/app'
  import { useChatStore } from '@/stores/hermes/chat'
  import { useProfilesStore } from '@/stores/hermes/profiles'
  import { useSettingsStore } from '@/stores/hermes/settings'

  const appStore = useAppStore()
  const chatStore = useChatStore()
  const profilesStore = useProfilesStore()
  const settingsStore = useSettingsStore()
  const route = useRoute()
  const router = useRouter()

  const routeSessionId = computed(() => {
    const value = route.params.sessionId
    return typeof value === 'string' && value.trim() ? value : null
  })

  const productTitle = 'UniEcoClaw'
  const tabTitle = computed(() => {
    if (route.name !== 'hermes.session') return productTitle
    return chatStore.activeSession?.title?.trim() || productTitle
  })

  watch(tabTitle, (value) => { document.title = value }, { immediate: true })
  onUnmounted(() => { document.title = productTitle })

  onMounted(async () => {
    chatStore.setRuntimeMode('default')
    appStore.loadModels()
    await Promise.all([profilesStore.fetchProfiles(), settingsStore.fetchSettings()])
    chatStore.validateSessionProfileFilter(profilesStore.profiles.map(p => p.name))
    await chatStore.loadSessions(chatStore.sessionProfileFilter, routeSessionId.value)
  })
  </script>

  <template>
    <div class="chat-view">
      <ChatShell />
    </div>
  </template>

  <style scoped lang="scss">
  .chat-view { height: calc(100 * var(--vh)); display: flex; flex-direction: column; }
  </style>
  ```

- [ ] 验证：启动 dev server，访问 `/hermes/chat`，确认 ChatShell 渲染 Hero 空态 + Composer；发送消息后 Hero 消失、MessageFlow 出现

---

### Task 13: Router 添加 /hermes/duty 路由

**Files:**
- Modify: `packages/client/src/router/index.ts`

**Interfaces:**
- Produces: 新增 `hermes.duty`, `hermes.dutyDetail`, `hermes.dutyCreate`, `hermes.dutyPicker` 路由

**Steps:**

- [ ] 在 routes 数组中，`/hermes/chat` 之前插入 duty 路由组：
  ```ts
  {
    path: '/hermes/duty',
    name: 'hermes.duty',
    component: () => import('@/views/hermes/JobsPage.vue'),
  },
  {
    path: '/hermes/duty/:id',
    name: 'hermes.dutyDetail',
    component: () => import('@/views/hermes/JobDetailPage.vue'),
  },
  {
    path: '/hermes/duty/create',
    name: 'hermes.dutyCreate',
    component: () => import('@/views/hermes/CreateTask.vue'),
  },
  {
    path: '/hermes/duty/picker',
    name: 'hermes.dutyPicker',
    component: () => import('@/views/hermes/PickerPage.vue'),
  },
  ```

- [ ] 验证：`/hermes/duty` 可访问（当前可能空白或报错，后续任务填充页面内容）

---

### Task 14: JobCard + JobCardGrid 值守任务卡片

**Files:**
- Create 或重写: `packages/client/src/components/hermes/guard/JobCard.vue`
- Create: `packages/client/src/components/hermes/guard/JobCardGrid.vue`

**Interfaces:**
- JobCard Props: `job: { id: string; name: string; schedule: string; lastRun?: string; status: 'running' | 'paused' | 'failed' }`
- JobCard Emits: `edit`, `run`, `toggle`, `delete`
- JobCardGrid Consumes: JobCard, `api/envclaw/jobs`
- JobCardGrid Produces: 筛选条 + 卡片网格

**Steps:**

- [ ] 重写 `JobCard.vue`：
  ```vue
  <script setup lang="ts">
  import { useRouter } from 'vue-router'

  const props = defineProps<{
    job: { id: string; name: string; schedule: string; lastRun?: string; status: string }
  }>()
  const emit = defineEmits<{
    (e: 'edit', id: string): void
    (e: 'run', id: string): void
    (e: 'toggle', id: string): void
    (e: 'delete', id: string): void
  }>()

  const router = useRouter()

  function goDetail() { router.push({ name: 'hermes.dutyDetail', params: { id: props.job.id } }) }
  function statusLabel(s: string) {
    const map: Record<string, string> = { running: '运行中', paused: '已暂停', failed: '失败' }
    return map[s] ?? s
  }
  function statusColor(s: string) {
    const map: Record<string, string> = { running: '#22c55e', paused: '#f59e0b', failed: '#ef4444' }
    return map[s] ?? '#999'
  }
  </script>

  <template>
    <div class="job-card" @click="goDetail">
      <div class="jc-status-bar" :style="{ background: statusColor(job.status) }" />
      <div class="jc-body">
        <h4 class="jc-name">{{ job.name }}</h4>
        <div class="jc-meta">
          <span class="jc-schedule">{{ job.schedule }}</span>
          <span v-if="job.lastRun" class="jc-last-run">{{ job.lastRun }}</span>
        </div>
        <span class="jc-status-badge" :style="{ color: statusColor(job.status) }">{{ statusLabel(job.status) }}</span>
      </div>
      <div class="jc-actions" @click.stop>
        <button class="jc-btn" @click="emit('edit', job.id)">编辑</button>
        <button class="jc-btn" @click="emit('run', job.id)">立即运行</button>
        <button class="jc-btn" @click="emit('toggle', job.id)">{{ job.status === 'running' ? '暂停' : '恢复' }}</button>
        <button class="jc-btn danger" @click="emit('delete', job.id)">删除</button>
      </div>
    </div>
  </template>

  <style scoped lang="scss">
  @use "@/styles/variables" as *;
  .job-card {
    background: $bg-card; border: 1px solid $border-color; border-radius: $radius-md;
    overflow: hidden; cursor: pointer; transition: box-shadow 0.2s;
    &:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
  }
  .jc-status-bar { height: 3px; }
  .jc-body { padding: 16px 16px 8px; }
  .jc-name { font-size: 15px; font-weight: 600; margin: 0 0 6px; color: $text-primary; }
  .jc-meta { display: flex; gap: 12px; font-size: 12px; color: $text-muted; margin-bottom: 6px; }
  .jc-actions { display: flex; gap: 4px; padding: 8px 16px 12px; border-top: 1px solid $border-light; }
  .jc-btn {
    padding: 4px 10px; border: 1px solid $border-color; border-radius: $radius-sm;
    background: $bg-card; color: $text-secondary; font-size: 12px; cursor: pointer;
    &:hover { border-color: $accent-primary; color: $accent-primary; }
    &.danger:hover { border-color: $error; color: $error; }
  }
  </style>
  ```

- [ ] 创建 `JobCardGrid.vue`：
  ```vue
  <script setup lang="ts">
  import { ref } from 'vue'
  import JobCard from './JobCard.vue'

  interface Job { id: string; name: string; schedule: string; lastRun?: string; status: string }
  defineProps<{ jobs: Job[] }>()
  const emit = defineEmits<{
    (e: 'edit', id: string): void
    (e: 'run', id: string): void
    (e: 'toggle', id: string): void
    (e: 'delete', id: string): void
  }>()

  const activeFilter = ref('all')
  const search = ref('')
  const filters = ['all', 'running', 'paused', 'failed'] as const
  const filterLabels: Record<string, string> = { all: '全部', running: '运行中', paused: '已暂停', failed: '失败' }
  </script>

  <template>
    <div class="job-grid-shell">
      <div class="filter-bar">
        <div class="filter-pills">
          <button v-for="f in filters" :key="f" class="filter-pill" :class="{ active: activeFilter === f }" @click="activeFilter = f">
            {{ filterLabels[f] }}
          </button>
        </div>
        <input v-model="search" class="filter-search" placeholder="搜索任务名..." />
      </div>
      <div class="card-grid">
        <JobCard v-for="job in jobs" :key="job.id" :job="job" @edit="emit('edit', $event)" @run="emit('run', $event)" @toggle="emit('toggle', $event)" @delete="emit('delete', $event)" />
      </div>
    </div>
  </template>

  <style scoped lang="scss">
  @use "@/styles/variables" as *;
  .filter-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
  .filter-pills { display: flex; gap: 6px; }
  .filter-pill {
    padding: 6px 14px; border: 1px solid $border-color; border-radius: 999px; background: $bg-card;
    color: $text-secondary; font-size: 13px; cursor: pointer;
    &.active { background: $accent-primary; color: #fff; border-color: $accent-primary; }
  }
  .filter-search {
    padding: 6px 12px; border: 1px solid $border-color; border-radius: $radius-sm;
    font-size: 13px; width: 200px; outline: none;
    &:focus { border-color: $accent-primary; }
  }
  .card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
  </style>
  ```

---

### Task 15: RunLogTree + RunLogItem 三层运行记录

**Files:**
- Create: `packages/client/src/components/hermes/guard/RunLogTree.vue`
- Create: `packages/client/src/components/hermes/guard/RunLogItem.vue`

**Interfaces:**
- RunLogTree Props: `jobs: RunLogJob[]`（含 L1/L2/L3 嵌套数据）
- RunLogItem Props: `item: RunLogItem`, `level: 1 | 2 | 3`, `expanded: boolean`

**Steps:**

- [ ] 创建 `RunLogItem.vue` — 可折叠行组件：
  ```vue
  <script setup lang="ts">
  const props = defineProps<{ label: string; sub: string; level: number; expanded: boolean; isLast?: boolean }>()
  const emit = defineEmits<{ (e: 'toggle'): void }>()
  </script>

  <template>
    <div class="rli-row" :class="`rli-level-${level}`" :style="{ paddingLeft: `${(level - 1) * 20 + 12}px` }" @click="emit('toggle')">
      <svg class="rli-arrow" :class="{ expanded }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
      <span class="rli-label">{{ label }}</span>
      <span class="rli-sub">{{ sub }}</span>
    </div>
  </template>

  <style scoped lang="scss">
  @use "@/styles/variables" as *;
  .rli-row {
    display: flex; align-items: center; gap: 8px; padding: 8px 12px;
    cursor: pointer; font-size: 13px; border-bottom: 1px solid $border-light;
    &:hover { background: rgba(var(--accent-primary-rgb), 0.03); }
    &.rli-level-1 { font-weight: 600; }
  }
  .rli-arrow { transition: transform 0.15s; flex-shrink: 0; color: $text-muted; &.expanded { transform: rotate(90deg); } }
  .rli-label { flex: 1; color: $text-primary; }
  .rli-sub { color: $text-muted; font-size: 12px; flex-shrink: 0; }
  </style>
  ```

- [ ] 创建 `RunLogTree.vue` — 含筛选条和三层的整体容器：
  ```vue
  <script setup lang="ts">
  import { ref } from 'vue'
  import RunLogItem from './RunLogItem.vue'

  // Mock 数据结构，生产从 api/envclaw/jobs 拉取
  interface RunLogJob {
    id: string; name: string; runs: RunLogRun[]
  }
  interface RunLogRun {
    id: string; time: string; duration: string; status: string; results: number; logs?: string
  }

  defineProps<{ jobs: RunLogJob[] }>()
  const expandedL1 = ref<Set<string>>(new Set())
  const expandedL2 = ref<Set<string>>(new Set())
  const timeFilter = ref('7d')
  const statusFilter = ref('all')

  function toggleL1(id: string) {
    if (expandedL1.value.has(id)) expandedL1.value.delete(id)
    else expandedL1.value.add(id)
  }
  function toggleL2(id: string) { /* similar */ }
  </script>

  <template>
    <div class="runlog-shell">
      <div class="runlog-filter">
        <select v-model="timeFilter"> <option value="today">今日</option><option value="7d">近 7 天</option><option value="30d">近 30 天</option><option value="custom">自定义</option></select>
        <select v-model="statusFilter"> <option value="all">全部</option><option value="success">成功</option><option value="failed">失败</option><option value="running">进行中</option></select>
        <input placeholder="搜索任务名..." />
      </div>
      <div class="runlog-list">
        <template v-for="job in jobs" :key="job.id">
          <RunLogItem :label="job.name" :sub="`${job.runs.length} 次执行`" :level="1" :expanded="expandedL1.has(job.id)" @toggle="toggleL1(job.id)" />
          <template v-if="expandedL1.has(job.id)">
            <RunLogItem v-for="run in job.runs" :key="run.id" :label="run.time" :sub="run.duration" :level="2" :expanded="expandedL2.has(run.id)" @toggle="toggleL2(run.id)" />
          </template>
        </template>
      </div>
    </div>
  </template>

  <style scoped lang="scss">
  @use "@/styles/variables" as *;
  .runlog-shell { }
  .runlog-filter { display: flex; gap: 8px; margin-bottom: 12px; select, input { padding: 6px 12px; border: 1px solid $border-color; border-radius: $radius-sm; } }
  .runlog-list { border: 1px solid $border-color; border-radius: $radius-md; overflow: hidden; }
  </style>
  ```

---

### Task 16: JobsPage 重构为双 Tab（定时任务 + 运行记录）

**Files:**
- Modify: `packages/client/src/views/hermes/JobsPage.vue`

**Interfaces:**
- Consumes: JobCardGrid, RunLogTree, `api/envclaw/jobs`

**Steps:**

- [ ] 重写 JobsPage.vue：
  ```vue
  <script setup lang="ts">
  import { ref, onMounted } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import JobCardGrid from '@/components/hermes/guard/JobCardGrid.vue'
  import RunLogTree from '@/components/hermes/guard/RunLogTree.vue'
  import { getJobs } from '@/api/envclaw/jobs'

  const router = useRouter()
  const route = useRoute()
  const activeTab = ref<string>((route.query.tab as string) || 'tasks')
  const jobs = ref<any[]>([])

  async function loadJobs() {
    try {
      const res: any = await getJobs()
      jobs.value = res.data ?? []
    } catch { /* mock fallback */ }
  }

  onMounted(loadJobs)

  function handleEdit(id: string) { router.push({ name: 'hermes.dutyCreate', query: { edit: id } }) }
  function handleRun(id: string) { /* call runJob API */ }
  function handleToggle(id: string) { /* call toggleJob API */ }
  function handleDelete(id: string) { /* confirm + call deleteJob API */ }
  </script>

  <template>
    <div class="jobs-page">
      <div class="page-header">
        <div class="page-tabs">
          <button class="seg-btn" :class="{ active: activeTab === 'tasks' }" @click="activeTab = 'tasks'">定时任务</button>
          <button class="seg-btn" :class="{ active: activeTab === 'runlog' }" @click="activeTab = 'runlog'">运行记录</button>
        </div>
        <div class="page-actions">
          <button class="action-btn" @click="router.push({ name: 'hermes.dutyPicker' })">从模板/技能添加</button>
          <button class="action-btn primary" @click="router.push({ name: 'hermes.dutyCreate' })">创建任务</button>
        </div>
      </div>

      <JobCardGrid v-if="activeTab === 'tasks'" :jobs="jobs" @edit="handleEdit" @run="handleRun" @toggle="handleToggle" @delete="handleDelete" />
      <RunLogTree v-else :jobs="jobs" />
    </div>
  </template>

  <style scoped lang="scss">
  @use "@/styles/variables" as *;
  .jobs-page { padding: 24px; }
  .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  .page-tabs { display: flex; gap: 4px; }
  .seg-btn {
    padding: 8px 20px; border: 1px solid $border-color; border-radius: $radius-sm; background: $bg-card; color: $text-secondary; font-size: 14px; cursor: pointer;
    &.active { background: $accent-primary; color: #fff; border-color: $accent-primary; }
  }
  .page-actions { display: flex; gap: 8px; }
  .action-btn {
    padding: 8px 16px; border: 1px solid $border-color; border-radius: $radius-sm; background: $bg-card; color: $text-secondary; font-size: 13px; cursor: pointer;
    &:hover { border-color: $accent-primary; color: $accent-primary; }
    &.primary { background: $accent-primary; color: #fff; border-color: $accent-primary; }
  }
  </style>
  ```

---

### Task 17: PushChannelSelect + ConnectorCheckCards + TaskSaveTemplate

**Files:**
- Create: `packages/client/src/components/hermes/guard/PushChannelSelect.vue`
- Create: `packages/client/src/components/hermes/guard/ConnectorCheckCards.vue`
- Create: `packages/client/src/components/hermes/guard/TaskSaveTemplate.vue`

**Interfaces:**
- PushChannelSelect: `modelValue: string[]` (v-model), options: 企业微信/钉钉/飞书/邮件/本地
- ConnectorCheckCards: `modelValue: string[]` (v-model 已选连接器 ID), `connectors: ConnectorInfo[]`
- TaskSaveTemplate: `visible: boolean`, emits `save(result)`, `cancel`

**Steps:**

- [ ] PushChannelSelect — 多选 tag 组件：
  ```vue
  <script setup lang="ts">
  const channels = ['企业微信', '钉钉', '飞书', '邮件', '本地']
  const props = defineProps<{ modelValue: string[] }>()
  const emit = defineEmits<{ (e: 'update:modelValue', v: string[]): void }>()

  function toggle(ch: string) {
    const next = props.modelValue.includes(ch) ? props.modelValue.filter(c => c !== ch) : [...props.modelValue, ch]
    emit('update:modelValue', next)
  }
  </script>

  <template>
    <div class="push-select">
      <label class="ps-label">推送渠道</label>
      <div class="ps-chips">
        <button v-for="ch in channels" :key="ch" class="ps-chip" :class="{ active: modelValue.includes(ch) }" @click="toggle(ch)">{{ ch }}</button>
      </div>
    </div>
  </template>

  <style scoped lang="scss">
  @use "@/styles/variables" as *;
  .ps-label { font-size: 14px; font-weight: 600; color: $text-primary; margin-bottom: 8px; display: block; }
  .ps-chips { display: flex; gap: 8px; flex-wrap: wrap; }
  .ps-chip {
    padding: 6px 16px; border: 1px solid $border-color; border-radius: 999px; background: $bg-card; color: $text-secondary; font-size: 13px; cursor: pointer;
    &.active { background: rgba(var(--accent-primary-rgb), 0.1); border-color: $accent-primary; color: $accent-primary; }
  }
  </style>
  ```

- [ ] ConnectorCheckCards — 2 列复选卡片：
  ```vue
  <script setup lang="ts">
  defineProps<{ modelValue: string[]; connectors: { id: string; name: string; type: string; tools: number }[] }>()
  const emit = defineEmits<{ (e: 'update:modelValue', v: string[]): void }>()

  function toggle(id: string, current: string[]) {
    emit('update:modelValue', current.includes(id) ? current.filter(x => x !== id) : [...current, id])
  }
  </script>

  <template>
    <div class="cc-grid">
      <div v-for="mcp in connectors" :key="mcp.id" class="cc-card" :class="{ selected: modelValue.includes(mcp.id) }" @click="toggle(mcp.id, modelValue)">
        <div class="cc-icon">{{ mcp.name.charAt(0) }}</div>
        <div class="cc-info">
          <div class="cc-name">{{ mcp.name }}</div>
          <div class="cc-meta">{{ mcp.type }} · {{ mcp.tools }} 个工具</div>
        </div>
        <div class="cc-check">&#10003;</div>
      </div>
    </div>
  </template>

  <style scoped lang="scss">
  @use "@/styles/variables" as *;
  .cc-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .cc-card {
    display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid $border-color; border-radius: $radius-md; cursor: pointer; background: $bg-card;
    &.selected { border-color: $accent-primary; background: rgba(var(--accent-primary-rgb), 0.04); .cc-check { opacity: 1; } }
  }
  .cc-icon { width: 36px; height: 36px; border-radius: 8px; background: $bg-secondary; display: flex; align-items: center; justify-content: center; font-weight: 700; color: $accent-primary; flex-shrink: 0; }
  .cc-info { flex: 1; }
  .cc-name { font-size: 14px; font-weight: 600; color: $text-primary; }
  .cc-meta { font-size: 12px; color: $text-muted; }
  .cc-check { color: $accent-primary; font-size: 16px; opacity: 0; transition: opacity 0.15s; }
  </style>
  ```

- [ ] TaskSaveTemplate — 可展开表单（略，10 行以内组件，含名称/分组/描述/标签字段 + 保存/取消按钮）

---

### Task 18: FusedPromptEditor 大提示词框块（Create 页核心）

**Files:**
- Create: `packages/client/src/components/hermes/guard/FusedPromptEditor.vue`

**Interfaces:**
- Consumes: `dutyStore`
- Produces:
  - Props: `prompt: string`, `selectedCaps: string[]`, `selectedSkills: string[]`
  - Emits: `update:prompt`, `removeCap(id)`, `removeSkill(id)`

**Steps:**

- [ ] 创建组件（大 textarea + 底栏 + chips 区）：
  ```vue
  <script setup lang="ts">
  import { useDutyStore } from '@/stores/envclaw/duty'
  import { useRouter } from 'vue-router'

  const props = defineProps<{
    prompt: string
    capNames: { id: string; name: string }[]
    skillNames: { id: string; name: string; kind: 'config' | 'direct' }[]
  }>()
  const emit = defineEmits<{
    (e: 'update:prompt', v: string): void
    (e: 'removeCap', id: string): void
    (e: 'removeSkill', id: string): void
  }>()

  const dutyStore = useDutyStore()
  const router = useRouter()

  const capNeedsConfig = computed(() => props.capNames.length)
  const skillDirect = computed(() => props.skillNames.filter(s => s.kind === 'direct').length)

  function openSkillPicker() { router.push('/hermes/duty/picker#tab=skills') }
  </script>

  <template>
    <div class="fused-editor">
      <label class="fe-label">提示词 <span class="fe-hint">描述任务目标，AI 将按目标调用下方技能、连接器与工具</span></label>
      <textarea class="fe-textarea" :value="prompt" @input="emit('update:prompt', ($event.target as HTMLTextAreaElement).value)" rows="8" placeholder="描述你的任务目标，比如：针对平顶山市早高峰 7:00-9:00 汇总浓度排名并推送到飞书..." />

      <div class="fe-toolbar">
        <span class="fe-model">模型：{{ dutyStore.selectedModel }}</span>
        <button class="fe-skill-btn" @click="openSkillPicker">
          技能
          <span class="fe-count blue">{{ capNeedsConfig }} 需</span>
          <span class="fe-count green">{{ skillDirect }} 直</span>
        </button>
        <span class="perm-badge">完全访问权限</span>
      </div>

      <div class="fe-chips" v-if="capNames.length || skillNames.length">
        <span v-for="c in capNames" :key="c.id" class="fe-chip blue">&#9881; {{ c.name }} <button class="chip-x" @click="emit('removeCap', c.id)">&times;</button></span>
        <span v-for="s in skillNames" :key="s.id" class="fe-chip green">&#9889; {{ s.name }} <button class="chip-x" @click="emit('removeSkill', s.id)">&times;</button></span>
      </div>
    </div>
  </template>

  <style scoped lang="scss">
  @use "@/styles/variables" as *;
  .fused-editor { border: 1px solid $border-color; border-radius: $radius-lg; background: $bg-card; padding: 20px; }
  .fe-label { font-size: 14px; font-weight: 600; color: $text-primary; display: block; margin-bottom: 4px; }
  .fe-hint { font-weight: 400; font-size: 12px; color: $text-muted; }
  .fe-textarea {
    width: 100%; border: 1px solid $border-color; border-radius: $radius-md; padding: 14px; font-size: 14px; line-height: 1.7;
    resize: vertical; font-family: inherit; margin-top: 12px;
    &:focus { outline: none; border-color: $accent-primary; }
  }
  .fe-toolbar { display: flex; align-items: center; gap: 12px; margin-top: 12px; font-size: 13px; }
  .fe-skill-btn {
    display: flex; align-items: center; gap: 6px; padding: 4px 12px; border: 1px solid $border-color; border-radius: 999px;
    background: $bg-card; cursor: pointer; font-size: 12px;
    &:hover { border-color: $accent-primary; }
  }
  .fe-count { padding: 1px 6px; border-radius: 999px; font-size: 11px; &.blue { background: var(--badge-config); color: #1d4ed8; } &.green { background: var(--badge-direct); color: #15803d; } }
  .fe-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
  .fe-chip {
    display: flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 999px; font-size: 12px;
    &.blue { background: var(--badge-config); color: #1d4ed8; }
    &.green { background: var(--badge-direct); color: #15803d; }
    .chip-x { background: none; border: none; cursor: pointer; font-size: 14px; padding: 0; color: inherit; }
  }
  </style>
  ```

---

### Task 19: CreateTask.vue 重写为融合式 6 段布局

**Files:**
- Modify: `packages/client/src/views/hermes/CreateTask.vue`（重写）

**Interfaces:**
- Consumes: FusedPromptEditor, ConnectorCheckCards, PushChannelSelect, SchedulePicker, TaskSaveTemplate, dutyStore
- URL 参数：`from=chat|picker|tpl`, `edit=<jobId>`, `caps=`, `skills=`, `mcps=`, `prompt=`

**Steps:**

- [ ] 重写 CreateTask.vue 为 6 段融合布局：
  ```vue
  <script setup lang="ts">
  import { ref, onMounted } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useDutyStore } from '@/stores/envclaw/duty'
  import FusedPromptEditor from '@/components/hermes/guard/FusedPromptEditor.vue'
  import ConnectorCheckCards from '@/components/hermes/guard/ConnectorCheckCards.vue'
  import PushChannelSelect from '@/components/hermes/guard/PushChannelSelect.vue'
  import SchedulePicker from '@/components/hermes/shared/SchedulePicker.vue'

  const route = useRoute()
  const router = useRouter()
  const dutyStore = useDutyStore()

  const taskName = ref('')
  const prompt = ref('')
  const capNames = ref<{ id: string; name: string }[]>([])
  const skillNames = ref<{ id: string; name: string; kind: 'config' | 'direct' }[]>([])
  const selectedMcps = ref<string[]>([])
  const pushChannels = ref<string[]>([])
  const schedule = ref('daily')

  const mockConnectors = [
    { id: 'mcp_fs', name: '本地文件系统', type: 'stdio', tools: 5 },
    { id: 'mcp_lark', name: '飞书 IM', type: 'http', tools: 3 },
  ]

  function parseUrlParams() {
    const q = route.query
    if (q.prompt) prompt.value = decodeURIComponent(q.prompt as string)
    if (q.caps) {
      const ids = (q.caps as string).split(',').filter(Boolean)
      const names = q.cap_names ? decodeURIComponent(q.cap_names as string).split('|') : ids
      capNames.value = ids.map((id, i) => ({ id, name: names[i] || id }))
    }
    if (q.skills) {
      const ids = (q.skills as string).split(',').filter(Boolean)
      const names = q.skill_names ? decodeURIComponent(q.skill_names as string).split('|') : ids
      skillNames.value = ids.map((id, i) => ({ id, name: names[i] || id, kind: 'direct' }))
    }
    if (q.mcps) selectedMcps.value = (q.mcps as string).split(',').filter(Boolean)
  }

  onMounted(parseUrlParams)

  function handleCreate() { /* POST job + redirect to duty */ }
  function handleCancel() { router.back() }
  </script>

  <template>
    <div class="create-page">
      <h2 class="page-title">创建值守任务</h2>

      <!-- ① 快捷入口卡 -->
      <div class="quick-entry-cards">
        <div class="qe-card" @click="router.push('/hermes/duty/picker#tab=tmpl')">从模板选<span class="qe-badge">最推荐</span></div>
        <div class="qe-card" @click="router.push('/hermes/duty/picker#tab=skills')">从技能添加<span class="qe-badge muted">2 种形态</span></div>
        <div class="qe-card" @click="router.push('/hermes/duty/picker#tab=mcps')">从连接器添加</div>
      </div>

      <!-- ② 任务名 -->
      <div class="field"><label>任务名</label><input v-model="taskName" placeholder="输入任务名称..." /></div>

      <!-- ③ 大提示词框块 -->
      <FusedPromptEditor v-model:prompt="prompt" :cap-names="capNames" :skill-names="skillNames" @remove-cap="capNames = capNames.filter(c => c.id !== $event)" @remove-skill="skillNames = skillNames.filter(s => s.id !== $event)" />

      <!-- ④ 连接器多选 -->
      <ConnectorCheckCards v-model="selectedMcps" :connectors="mockConnectors" />

      <!-- ⑤ 调度 + 推送 -->
      <div class="schedule-push-row">
        <div class="field"><label>调度频率</label><SchedulePicker v-model="schedule" /></div>
        <PushChannelSelect v-model="pushChannels" />
      </div>

      <!-- ⑥ 底栏 -->
      <div class="create-footer">
        <button class="btn-cancel" @click="handleCancel">取消</button>
        <button class="btn-save-template" @click="/* 展开保存表单 */">保存为模板</button>
        <button class="btn-create" @click="handleCreate">创建任务</button>
      </div>
    </div>
  </template>

  <style scoped lang="scss">
  @use "@/styles/variables" as *;
  .create-page { max-width: 800px; margin: 0 auto; padding: 24px; }
  .page-title { font-size: 22px; font-weight: 700; margin-bottom: 24px; }
  .quick-entry-cards { display: flex; gap: 12px; margin-bottom: 20px; }
  .qe-card {
    flex: 1; padding: 14px; border: 1px solid $border-color; border-radius: $radius-md; text-align: center;
    font-size: 14px; color: $text-primary; cursor: pointer;
    &:hover { border-color: $accent-primary; }
  }
  .qe-badge { font-size: 10px; padding: 1px 6px; border-radius: 999px; background: $accent-primary; color: #fff; margin-left: 6px; &.muted { background: $bg-secondary; color: $text-muted; } }
  .field { margin-bottom: 16px; label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 6px; } input { width: 100%; padding: 8px 12px; border: 1px solid $border-color; border-radius: $radius-sm; } }
  .schedule-push-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0; }
  .create-footer { display: flex; justify-content: flex-end; gap: 8px; padding-top: 16px; border-top: 1px solid $border-color; }
  .btn-cancel { padding: 10px 20px; border: 1px solid $border-color; border-radius: $radius-sm; background: $bg-card; cursor: pointer; }
  .btn-save-template { padding: 10px 20px; border: 1px solid $accent-primary; border-radius: $radius-sm; background: $bg-card; color: $accent-primary; cursor: pointer; }
  .btn-create { padding: 10px 24px; border: none; border-radius: $radius-sm; background: $accent-primary; color: #fff; cursor: pointer; }
  </style>
  ```

---

### Task 20: PickerTabs + PickerPage 选择器

**Files:**
- Create: `packages/client/src/components/hermes/guard/PickerTabs.vue`
- Create: `packages/client/src/views/hermes/PickerPage.vue`

**Interfaces:**
- PickerTabs Props: `activeTab: string`
- PickerTabs Emits: `select(result: PickerSelection)`
- PickerPage: 3 Tab（模板/技能/连接器），底部动态按钮

**Steps:**

- [ ] 创建 `PickerTabs.vue` — 含 3 个 Tab 的内容区：
  - Tab 1「选模板」：按分组子 Tab（全部/系统/我的/外部导入）筛选，单选
  - Tab 2「选技能」：统一列表，分 ⚙ 需配置（蓝）和 ⚡ 直接用（绿）两种徽章，多选 ≤ 6
  - Tab 3「选连接器」：卡片三栏展示，多选

- [ ] 创建 `PickerPage.vue`：
  ```vue
  <script setup lang="ts">
  import { ref, onMounted, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useDutyStore } from '@/stores/envclaw/duty'
  import PickerTabs from '@/components/hermes/guard/PickerTabs.vue'

  const route = useRoute()
  const router = useRouter()
  const dutyStore = useDutyStore()

  const activeTab = ref('skills')
  const selected = ref({ templateId: '', capIds: [], capNames: [], skillIds: [], skillNames: [], mcpIds: [], mcpNames: [] })

  onMounted(() => {
    const hash = route.hash.replace('#tab=', '')
    if (['tmpl', 'skills', 'mcps'].includes(hash)) activeTab.value = hash
    else if (hash === 'caps') activeTab.value = 'skills' // 兼容旧 hash
  })

  function handleCreate() {
    dutyStore.setPickerSelection(selected.value)
    const params = new URLSearchParams()
    params.set('from', 'picker')
    if (selected.value.capIds.length) { params.set('caps', selected.value.capIds.join(',')); params.set('cap_names', encodeURIComponent(selected.value.capNames.join('|'))) }
    if (selected.value.skillIds.length) { params.set('skills', selected.value.skillIds.join(',')); params.set('skill_names', encodeURIComponent(selected.value.skillNames.join('|'))) }
    if (selected.value.mcpIds.length) { params.set('mcps', selected.value.mcpIds.join(',')); params.set('mcp_names', encodeURIComponent(selected.value.mcpNames.join('|'))) }
    router.push({ name: 'hermes.dutyCreate', query: Object.fromEntries(params) })
  }

  const bottomLabel = activeTab === 'tmpl' ? '使用此模板创建' : activeTab === 'skills' ? '使用选中的技能创建' : '使用选中的连接器创建'
  </script>

  <template>
    <div class="picker-page">
      <div class="picker-tabs">
        <button class="picker-tab" :class="{ active: activeTab === 'tmpl' }" @click="activeTab = 'tmpl'">选模板</button>
        <button class="picker-tab" :class="{ active: activeTab === 'skills' }" @click="activeTab = 'skills'">选技能</button>
        <button class="picker-tab" :class="{ active: activeTab === 'mcps' }" @click="activeTab = 'mcps'">选连接器</button>
      </div>
      <PickerTabs :active-tab="activeTab" v-model:selection="selected" />
      <div class="picker-footer">
        <button class="btn-cancel" @click="router.back()">取消</button>
        <button class="btn-primary" @click="handleCreate">{{ bottomLabel }}</button>
      </div>
    </div>
  </template>
  ```

---

### Task 21: JobDetailPage 重构为 3 Tab

**Files:**
- Modify: `packages/client/src/views/hermes/JobDetailPage.vue`

**Interfaces:**
- Consumes: route params `id`, `api/envclaw/jobs`
- Produces: 头部（任务名/状态/调度/操作栏）+ 3 Tab（配置/运行日志/成果）

**Steps:**

- [ ] 重写为 3 Tab 详情页（结构与 JobDetailPage 现有逻辑类似，Tab 切换 + 操作栏「编辑/暂停·恢复/立即运行/删除」）

- [ ] 编辑操作 → `router.push({ name: 'hermes.dutyCreate', query: { edit: jobId } })`

- [ ] 配置 Tab：能力/技能/连接器清单（可展开参数）+ 推送渠道 + 调度规则
- [ ] 运行日志 Tab：时间线 + 每项可展开 stdout/stderr
- [ ] 成果 Tab：截图预览 + 数据文件下载链接

---

### Task 22: LoginView 视觉对齐

**Files:**
- Modify: `packages/client/src/views/LoginView.vue`

**Interfaces:**
- 保留现有 OAuth 逻辑，仅改 UI 为原型风格

**Steps:**

- [ ] 对齐原型样式：Logo 80×80 框 + 标题「UniEcoClaw 登录」+ 平台徽章「数智大气平台 统一登录」+ 账号/密码输入框 + 错误提示条 + 登录按钮（spinner）+ 底部版权 + 「无法登录？联系管理员」

---

### Task 23: i18n 补充中文入口

**Files:**
- Modify: `packages/client/src/i18n/locales/zh-CN.json`

**Steps:**

- [ ] 补充新增 UI 的中文文案：
  ```json
  {
    "sidebar": {
      "newTask": "新建任务",
      "automation": "自动化",
      "templates": "任务模板库",
      "platformsSkillsMcps": "平台·技能·连接器",
      "more": "更多",
      "recentChats": "最近对话",
      "viewMore": "查看更多"
    },
    "chat": {
      "heroTitle": "UniEcoClaw，我帮你",
      "heroSubtitle": "直接提问，或选一个能力开始——也可以让我把它变成定时运行的值守任务",
      "queryData": "查数据",
      "buildDuty": "建值守",
      "send": "发送",
      "model": "模型",
      "skill": "技能",
      "connector": "连接器",
      "fullAccess": "完全访问权限",
      "createDuty": "创建为值守任务",
      "confirmDirect": "直接确认（跳过向导）"
    },
    "duty": {
      "timedTasks": "定时任务",
      "runLog": "运行记录",
      "createTask": "创建任务",
      "addFromTemplate": "从模板/技能添加"
    }
  }
  ```

---

## 实施顺序

```
Task 1  (CSS 变量)    ──┐
Task 2  (侧栏重构)    ──┤ 基础层（可并行）
Task 3  (Store)       ──┤
Task 23 (i18n)        ──┘
    │
    ├── Task 4  (ChatInput)       ──┐
    ├── Task 5  (CapabilityChips) ──┤ 对话组件层（可并行）
    ├── Task 6  (SlashCommandMenu)──┤
    ├── Task 7  (ChatHero)        ──┤
    ├── Task 8  (TaskDraftCard)   ──┘
    │
    ├── Task 9  (ChatMessageFlow) ── 依赖 Task 8
    ├── Task 10 (ChatComposer)    ── 依赖 Task 4/5/6
    ├── Task 11 (ChatShell)       ── 依赖 Task 7/9/10
    ├── Task 12 (ChatView 集成)   ── 依赖 Task 11
    │
    ├── Task 13 (Router)          ──┐
    ├── Task 14 (JobCard+Grid)    ──┤ 值守页面层（可并行）
    ├── Task 15 (RunLogTree)      ──┤
    ├── Task 17 (PushChannel等)   ──┤
    ├── Task 18 (FusedPromptEditor)──┤
    │
    ├── Task 16 (JobsPage)        ── 依赖 Task 14/15
    ├── Task 19 (CreateTask)      ── 依赖 Task 17/18
    ├── Task 20 (PickerPage)      ── 依赖 Task 3
    ├── Task 21 (JobDetailPage)   ── 依赖 Task 13
    └── Task 22 (LoginView)       ── 独立
```
