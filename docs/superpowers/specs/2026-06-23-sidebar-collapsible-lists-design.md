# 侧边栏折叠列表设计文档

## 概述

将 ChatPanel 侧边栏从「按模式二选一」改为「始终上下排列两个可折叠区域」：历史对话和定时任务。每个区域默认展开，最多显示 5 条，超出显示"查看更多（N）"按钮。

## 布局

```
┌──────────────────────┐
│  问数 / 值守 导航     │
│  [+ 新对话]           │
├──────────────────────┤
│ ▼ 历史对话 (8)        │  ← 可折叠，默认展开
│   对话1               │
│   对话2               │
│   对话3               │
│   对话4               │
│   对话5               │
│   查看更多（3）        │  ← 点击展开全部
│                       │
│ ▼ 定时任务 (3)        │  ← 可折叠，默认展开
│   任务1               │
│   任务2               │
│   任务3               │
├──────────────────────┤
│  ⚙ 设置              │
└──────────────────────┘
```

## 折叠交互

- **折叠/展开**：点击区域 header 的 ▼/▶ 箭头切换
- **默认状态**：展开，显示最多 5 条（`MAX_VISIBLE_ITEMS = 5`）
- **查看更多**：条目 > 5 时显示 `查看更多（N）`，点击展开全部
- **收起**：展开全部后按钮变为 `收起`，点击回到 5 条
- **两个区域互不影响**

## 改动范围

| 文件 | 改动 |
|------|------|
| `packages/client/src/components/hermes/chat/ChatPanel.vue` | 移除 `currentMode` 条件判断，两个列表始终渲染；新增折叠/展开状态；修改模板和样式 |

## 状态管理

```ts
const historyCollapsed = ref(false)    // 历史对话折叠状态
const historyExpanded = ref(false)     // 历史对话是否展开全部
const jobsCollapsed = ref(false)       // 定时任务折叠状态
const jobsExpanded = ref(false)        // 定时任务是否展开全部

const MAX_VISIBLE_ITEMS = 5

const visibleSessions = computed(() =>
  historyExpanded.value ? unpinnedSessions : unpinnedSessions.slice(0, MAX_VISIBLE_ITEMS)
)
const visibleJobs = computed(() =>
  jobsExpanded.value ? jobsStore.jobs : jobsStore.jobs.slice(0, MAX_VISIBLE_ITEMS)
)
```

## 模板结构

```html
<!-- 历史对话 -->
<div class="session-section">
  <div class="session-group-header" @click="historyCollapsed = !historyCollapsed">
    <svg class="group-chevron" :class="{ collapsed: historyCollapsed }">▼</svg>
    <span class="session-group-label">历史对话</span>
    <span class="session-group-count">{{ chatStore.sessions.length }}</span>
  </div>
  <template v-if="!historyCollapsed">
    <SessionListItem v-for="s in visibleSessions" ... />
    <button v-if="unpinnedSessions.length > MAX_VISIBLE_ITEMS"
      class="session-more-btn" @click="historyExpanded = !historyExpanded">
      {{ historyExpanded ? '收起' : `查看更多（${unpinnedSessions.length - MAX_VISIBLE_ITEMS}）` }}
    </button>
  </template>
</div>

<!-- 定时任务 -->
<div class="session-section">
  <div class="session-group-header" @click="jobsCollapsed = !jobsCollapsed">
    <svg class="group-chevron" :class="{ collapsed: jobsCollapsed }">▼</svg>
    <span class="session-group-label">定时任务</span>
    <span class="session-group-count">{{ jobsStore.jobs.length }}</span>
  </div>
  <template v-if="!jobsCollapsed">
    <JobTreeList :visible-jobs="visibleJobs" ... />
    <button v-if="jobsStore.jobs.length > MAX_VISIBLE_ITEMS"
      class="session-more-btn" @click="jobsExpanded = !jobsExpanded">
      {{ jobsExpanded ? '收起' : `查看更多（${jobsStore.jobs.length - MAX_VISIBLE_ITEMS}）` }}
    </button>
  </template>
</div>
```

## 样式

复用已有的 `.group-chevron` CSS（已定义旋转动画），新增 `.session-more-btn` 样式。
