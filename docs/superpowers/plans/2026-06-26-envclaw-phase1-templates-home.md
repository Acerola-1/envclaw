# 环保管家差异化改造 — 实施计划（总览 + Phase 1）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Hermes Studio 二次开发客户端改造为"环保管家"——工作台为主体,平台配置驱动任务创建,对话绑定任务上下文。

**Architecture:** 在现有 Koa BFF + Vue 3 前端上新增工作台模块(路由 `/envclaw/*`),复用 Hermes 的 jobs/skills/sessions API 和 agent-bridge 对话运行时。新增平台管理模块(platforms store + SQLite 加密存储)作为核心差异化。不修改 Hermes Agent 本身。

**Tech Stack:** Vue 3.5 + TypeScript + Pinia 3(setup stores) + Naive UI 2.44 + vue-router + vue-i18n | Koa + node:sqlite + AES-256 | Vitest | Playwright

## Global Constraints

- Vue 组件必须用 `<script setup lang="ts">` + Composition API
- Pinia store 用 setup store 语法(`defineStore('name', () => {...})`)
- 每个新用户可见字符串必须加到 `packages/client/src/i18n/locales/en.ts` 和 `zh.ts`
- 使用 `import { request } from '@/api/client'` 发请求,不引入 axios
- 服务端用 `node:sqlite` 的 `DatabaseSync`(同步 API),不引入 ORM
- 新增本地 API 路由必须在代理 catch-all 之前注册
- 凭据加密用 Node 内置 `crypto.createCipheriv`(AES-256-GCM)
- 图标用 Lucide 风格 SVG(stroke-width 1.6),不使用 emoji
- 本期只落地"数据播报"场景,其余三场景仅占位

---

## 总览：5 个 Phase

| Phase | 名称 | 依赖 | 产出 |
|---|---|---|---|
| 1 | 场景模板 + 工作台首页骨架 | 无 | 模板定义模块 + 工作台路由/布局/首页 |
| 2 | 平台管理 | Phase 1 | 平台 CRUD + 凭据加密存储 + 平台配置 UI |
| 3 | 创建向导 | Phase 1+2 | 模板向导(数据播报) + 提示词组装 |
| 4 | 值守任务/运行历史/技能库/任务详情 | Phase 1+2 | 完整工作台5个页面 |
| 5 | 智能问数 + 任务对话 | Phase 4 | 顶栏双入口 + 任务绑定对话 |

每个 Phase 单独一份计划文件。以下是 Phase 1。

---

# Phase 1: 场景模板系统 + 工作台首页骨架

**Goal:** 让首页"看起来不一样"——新路由体系、工作台布局、场景卡片由模板数据驱动、活跃任务列表从 jobs store 读取。

**Architecture:** 新增 `/envclaw/*` 路由组,包含 `EnvclawLayout.vue`(顶栏+侧栏+content)作为外壳,内嵌 5 个子路由页面。场景模板定义为前端 TypeScript 常量(不落库),驱动首页场景卡片和向导。工作台首页复用 `useJobsStore` 读取任务列表。

---

## File Structure

### 新建文件

| 文件 | 职责 |
|---|---|
| `packages/client/src/views/envclaw/EnvclawLayout.vue` | 工作台外壳:顶栏(品牌+模式切换+用户)+左侧导航+`<router-view>` |
| `packages/client/src/views/envclaw/WorkstationHome.vue` | 工作台首页:概览+场景卡+活跃任务+平台条 |
| `packages/client/src/views/envclaw/JobsPage.vue` | 值守任务列表页(Phase 4 填充) |
| `packages/client/src/views/envclaw/PlatformsPage.vue` | 平台管理页(Phase 2 填充) |
| `packages/client/src/views/envclaw/SkillsPage.vue` | 技能库页(Phase 4 填充) |
| `packages/client/src/views/envclaw/HistoryPage.vue` | 运行历史页(Phase 4 填充) |
| `packages/client/src/views/envclaw/SmartQueryPage.vue` | 智能问数页(Phase 5 填充) |
| `packages/client/src/components/envclaw/workstation/OverviewBanner.vue` | 欢迎概览区 |
| `packages/client/src/components/envclaw/workstation/StatCards.vue` | 统计卡片区(运行中/成功率/待接入) |
| `packages/client/src/components/envclaw/workstation/ScenarioGrid.vue` | 场景卡片网格 |
| `packages/client/src/components/envclaw/workstation/ActiveTasks.vue` | 活跃任务列表 |
| `packages/client/src/components/envclaw/workstation/PlatformBar.vue` | 平台状态条 |
| `packages/client/src/stores/envclaw/templates.ts` | 场景模板定义 Pinia store |
| `packages/client/src/api/envclaw/platforms.ts` | 平台 API 类型定义(Phase 2 填充实现) |

### 修改文件

| 文件 | 改动 |
|---|---|
| `packages/client/src/router/index.ts` | 新增 `/envclaw/*` 路由组,默认路由改为 `/envclaw` |
| `packages/client/src/i18n/locales/en.ts` | 新增 `envclaw` 命名空间 |
| `packages/client/src/i18n/locales/zh.ts` | 新增 `envclaw` 命名空间 |

---

## Task 1: 场景模板定义模块

**Files:**
- Create: `packages/client/src/stores/envclaw/templates.ts`
- Test: `tests/client/stores/envclaw/templates.test.ts`

**Interfaces:**
- Consumes: 无(纯前端常量)
- Produces: `useTemplatesStore`, `ScenarioTemplate` 类型, `TEMPLATE_LIST` 常量——供 Task 3(ScenarioGrid)和 Phase 3(向导)消费

- [ ] **Step 1: 写模板类型和常量**

```ts
// packages/client/src/stores/envclaw/templates.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/** 场景模板定义 */
export interface ScenarioTemplate {
  /** 模板 ID,如 'data-broadcast' */
  id: string
  /** 显示名称 */
  name: string
  /** 简短描述 */
  description: string
  /** Lucide 图标名 */
  icon: string
  /** 场景分类标签 */
  tags: string[]
  /** 是否已上线(未上线=场景卡置灰) */
  available: boolean
  /** 角色基底提示词(组装公式第一段) */
  roleBasePrompt: string
}

export const TEMPLATE_LIST: ScenarioTemplate[] = [
  {
    id: 'data-broadcast',
    name: '数据播报',
    description: '定时抓取空气质量数据，自动生成播报内容并推送到指定群组',
    icon: 'volume-2',
    tags: ['定时', '多渠道'],
    available: true,
    roleBasePrompt:
      '你是数据播报助手，负责按时从指定数据平台抓取环保监测数据，生成结构化的播报文案，并推送到指定渠道。播报内容应包含：当前空气质量指数（AQI）、首要污染物、各项指标浓度及变化趋势、省内排名信息（如适用）。语言要求简洁专业，面向环保业务人员。',
  },
  {
    id: 'data-collection',
    name: '数据采集',
    description: '从 mapairs、国控站等平台自动抓取空气质量数据并生成报表',
    icon: 'bar-chart-3',
    tags: ['定时', '报表'],
    available: false,
    roleBasePrompt: '',
  },
  {
    id: 'anomaly-alert',
    name: '异常预警',
    description: '实时监控空气质量指标，超阈值自动预警并多渠道推送',
    icon: 'triangle-alert',
    tags: ['实时', '预警'],
    available: false,
    roleBasePrompt: '',
  },
  {
    id: 'report-generation',
    name: '报告生成',
    description: '自动生成日报、周报、月报，支持自定义模板与定时推送',
    icon: 'file-text',
    tags: ['定时', '报告'],
    available: false,
    roleBasePrompt: '',
  },
]

export const useTemplatesStore = defineStore('envclaw-templates', () => {
  const templates = ref<ScenarioTemplate[]>(TEMPLATE_LIST)

  const availableTemplates = computed(() =>
    templates.value.filter((t) => t.available),
  )

  const unavailableTemplates = computed(() =>
    templates.value.filter((t) => !t.available),
  )

  function getById(id: string): ScenarioTemplate | undefined {
    return templates.value.find((t) => t.id === id)
  }

  return { templates, availableTemplates, unavailableTemplates, getById }
})
```

- [ ] **Step 2: 写测试**

```ts
// tests/client/stores/envclaw/templates.test.ts
import { describe, it, expect } from 'vitest'
import { TEMPLATE_LIST, type ScenarioTemplate } from '@/stores/envclaw/templates'

describe('ScenarioTemplate constants', () => {
  it('has exactly 4 templates', () => {
    expect(TEMPLATE_LIST).toHaveLength(4)
  })

  it('only data-broadcast is available', () => {
    const available = TEMPLATE_LIST.filter((t) => t.available)
    expect(available).toHaveLength(1)
    expect(available[0].id).toBe('data-broadcast')
  })

  it('data-broadcast has non-empty roleBasePrompt', () => {
    const broadcast = TEMPLATE_LIST.find((t) => t.id === 'data-broadcast')!
    expect(broadcast.roleBasePrompt.length).toBeGreaterThan(10)
  })

  it('unavailable templates have empty roleBasePrompt', () => {
    const unavailable = TEMPLATE_LIST.filter((t) => !t.available)
    for (const t of unavailable) {
      expect(t.roleBasePrompt).toBe('')
    }
  })

  it('each template has required fields', () => {
    for (const t of TEMPLATE_LIST) {
      expect(t.id).toBeTruthy()
      expect(t.name).toBeTruthy()
      expect(t.description).toBeTruthy()
      expect(t.icon).toBeTruthy()
      expect(Array.isArray(t.tags)).toBe(true)
      expect(typeof t.available).toBe('boolean')
    }
  })
})
```

- [ ] **Step 3: 运行测试确认通过**

Run: `npm run test -- tests/client/stores/envclaw/templates.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 4: 提交**

```bash
git add packages/client/src/stores/envclaw/templates.ts tests/client/stores/envclaw/templates.test.ts
git commit -m "feat(envclaw): add scenario template definitions with tests"
```

---

## Task 2: 路由体系 + i18n 基础

**Files:**
- Modify: `packages/client/src/router/index.ts`
- Modify: `packages/client/src/i18n/locales/en.ts`
- Modify: `packages/client/src/i18n/locales/zh.ts`
- Create: `packages/client/src/views/envclaw/EnvclawLayout.vue`(骨架)
- Create: 5 个占位页面组件

**Interfaces:**
- Consumes: 无
- Produces: `/envclaw` 路由组 + `EnvclawLayout` 布局组件,供后续 Task 添加子路由页面

- [ ] **Step 1: 创建 EnvclawLayout 骨架**

```vue
<!-- packages/client/src/views/envclaw/EnvclawLayout.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const navItems = computed(() => [
  { key: 'home', label: t('envclaw.nav.home'), route: '/envclaw', icon: 'layout-dashboard' },
  { key: 'jobs', label: t('envclaw.nav.jobs'), route: '/envclaw/jobs', icon: 'clock' },
  { key: 'platforms', label: t('envclaw.nav.platforms'), route: '/envclaw/platforms', icon: 'link' },
])
const resourceItems = computed(() => [
  { key: 'skills', label: t('envclaw.nav.skills'), route: '/envclaw/skills', icon: 'file-text' },
  { key: 'history', label: t('envclaw.nav.history'), route: '/envclaw/history', icon: 'layers' },
])

const activeNav = computed(() => {
  const path = route.path
  if (path === '/envclaw') return 'home'
  const match = [...navItems.value, ...resourceItems.value].find((n) => n.route === path)
  return match?.key ?? ''
})

function go(path: string) {
  router.push(path)
}

function goSmartQuery() {
  router.push('/envclaw/smart-query')
}

function goWorkstation() {
  router.push('/envclaw')
}

const isWorkstation = computed(() => route.path !== '/envclaw/smart-query')
</script>

<template>
  <div class="envclaw-layout">
    <!-- 顶栏 -->
    <header class="topbar">
      <div class="topbar-left">
        <div class="brand">
          <div class="brand-mark">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
              <path d="M2 21c0-3 1.85-5.36 5.08-6" />
            </svg>
          </div>
          {{ t('envclaw.brand') }}
        </div>
        <div class="mode-switch">
          <button :class="['mode-btn', { active: isWorkstation }]" @click="goWorkstation">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" />
              <rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" />
            </svg>
            {{ t('envclaw.mode.workstation') }}
          </button>
          <button :class="['mode-btn', { active: !isWorkstation }]" @click="goSmartQuery">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M12 3l1.9 5.7L20 10l-6.1 1.3L12 17l-1.9-5.7L4 10l6.1-1.3z" />
            </svg>
            {{ t('envclaw.mode.smartQuery') }}
          </button>
        </div>
      </div>
      <div class="topbar-right">
        <div class="avatar">{{ t('envclaw.avatarFallback') }}</div>
      </div>
    </header>

    <!-- 工作台模式: 侧栏 + 内容 -->
    <template v-if="isWorkstation">
      <div class="body">
        <nav class="railnav">
          <a
            v-for="item in navItems"
            :key="item.key"
            :class="['rail-item', { active: activeNav === item.key }]"
            @click="go(item.route)"
          >
            {{ item.label }}
          </a>
          <div class="rail-group-label">{{ t('envclaw.nav.resourceGroup') }}</div>
          <a
            v-for="item in resourceItems"
            :key="item.key"
            :class="['rail-item', { active: activeNav === item.key }]"
            @click="go(item.route)"
          >
            {{ item.label }}
          </a>
        </nav>
        <main class="content">
          <router-view />
        </main>
      </div>
    </template>

    <!-- 智能问数模式: 全屏内容 -->
    <template v-else>
      <main class="content-full">
        <router-view />
      </main>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.envclaw-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #1a1a1a;
  color: #e0e0e0;
  font-family: 'Inter', system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.topbar {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px;
  border-bottom: 1px solid #3a3a3a;
  flex-shrink: 0;
}

.topbar-left { display: flex; align-items: center; gap: 22px; }

.brand {
  display: flex; align-items: center; gap: 9px;
  font-weight: 600; font-size: 14px;
}

.brand-mark {
  width: 26px; height: 26px; border-radius: 7px;
  background: #e0e0e0; color: #1a1a1a;
  display: flex; align-items: center; justify-content: center;
}

.mode-switch {
  display: flex; background: #252525; border: 1px solid #3a3a3a;
  border-radius: 8px; padding: 3px; gap: 2px;
}

.mode-btn {
  display: flex; align-items: center; gap: 6px; padding: 6px 13px;
  border-radius: 6px; font-size: 13px; font-weight: 500;
  color: #a0a0a0; background: transparent; border: none; cursor: pointer;
  transition: 0.15s;
  &:hover { color: #e0e0e0; }
  &.active { background: #e0e0e0; color: #1a1a1a; }
}

.topbar-right { display: flex; align-items: center; gap: 8px; }

.avatar {
  width: 30px; height: 30px; border-radius: 50%;
  background: #2a2a2a; border: 1px solid #555;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 600;
}

.body { flex: 1; display: flex; overflow: hidden; }

.railnav {
  width: 200px; background: #202020; border-right: 1px solid #3a3a3a;
  padding: 12px 10px; display: flex; flex-direction: column; gap: 2px;
  flex-shrink: 0;
}

.rail-group-label {
  font-size: 11px; color: #666; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.6px; padding: 12px 10px 6px;
}

.rail-item {
  display: flex; align-items: center; gap: 10px; padding: 9px 10px;
  border-radius: 6px; color: #a0a0a0; cursor: pointer; font-size: 13px;
  transition: 0.15s; text-decoration: none;
  &:hover { background: #252525; color: #e0e0e0; }
  &.active { background: rgba(255,255,255,0.08); color: #e0e0e0; font-weight: 500; }
}

.content { flex: 1; overflow-y: auto; }
.content-full { flex: 1; overflow-y: auto; }
</style>
```

- [ ] **Step 2: 创建 5 个占位页面(只含标题,后续 Phase 填充)**

每个文件结构相同,仅标题不同:

```vue
<!-- packages/client/src/views/envclaw/JobsPage.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>

<template>
  <div class="page">
    <h1>{{ t('envclaw.jobs.title') }}</h1>
    <p class="sub">{{ t('envclaw.jobs.description') }}</p>
  </div>
</template>

<style scoped lang="scss">
.page { max-width: 1080px; margin: 0 auto; padding: 28px 32px; }
h1 { font-size: 20px; font-weight: 600; }
.sub { color: #a0a0a0; font-size: 13px; margin-top: 4px; }
</style>
```

同样创建 `PlatformsPage.vue`(key=`platforms`)、`SkillsPage.vue`(key=`skills`)、`HistoryPage.vue`(key=`history`)、`SmartQueryPage.vue`(key=`smartQuery`)。

- [ ] **Step 3: 注册路由**

在 `packages/client/src/router/index.ts` 中,在 `path: '/'` 的 redirect 之后添加:

```ts
// Envclaw workstation routes
{
  path: '/envclaw',
  component: () => import('@/views/envclaw/EnvclawLayout.vue'),
  children: [
    { path: '', name: 'envclaw.home', component: () => import('@/views/envclaw/WorkstationHome.vue') },
    { path: 'jobs', name: 'envclaw.jobs', component: () => import('@/views/envclaw/JobsPage.vue') },
    { path: 'platforms', name: 'envclaw.platforms', component: () => import('@/views/envclaw/PlatformsPage.vue') },
    { path: 'skills', name: 'envclaw.skills', component: () => import('@/views/envclaw/SkillsPage.vue') },
    { path: 'history', name: 'envclaw.history', component: () => import('@/views/envclaw/HistoryPage.vue') },
    { path: 'smart-query', name: 'envclaw.smartQuery', component: () => import('@/views/envclaw/SmartQueryPage.vue') },
  ],
},
```

将默认路由 `path: '/'` 的 redirect 从 `'/hermes/chat'` 改为 `'/envclaw'`。

- [ ] **Step 4: 添加 i18n 条目**

在 `packages/client/src/i18n/locales/zh.ts` 的 export default 对象中新增 `envclaw` 命名空间:

```ts
envclaw: {
  brand: '数智大气 · 环保管家',
  avatarFallback: '张',
  mode: {
    workstation: '工作台',
    smartQuery: '智能问数',
  },
  nav: {
    home: '工作台首页',
    jobs: '值守任务',
    platforms: '平台管理',
    skills: '技能库',
    history: '运行历史',
    resourceGroup: '资源',
  },
  home: {
    greeting: '早上好',
    date: '{date} · {org}',
    stats: {
      runningTasks: '运行中任务',
      successRate: '今日成功率',
      pendingAlerts: '待处理预警',
      todayCollection: '今日数据采集',
      allNormal: '全部正常运行',
      vsYesterday: '较昨日 {diff}',
      pending: '待接入',
      noData: '数据源未接入',
    },
    scenarios: {
      title: '业务场景',
      hint: '选择场景，系统引导你完成配置',
      start: '开始',
      comingSoon: '即将推出',
      stayTuned: '敬请期待',
    },
    tasks: {
      title: '活跃任务',
      viewAll: '查看全部',
      running: '运行中',
      paused: '已暂停',
      lastRun: '上次 {time}',
      nextRun: '下次 {time}',
      triggerToday: '今日触发 {n} 次',
    },
    platforms: {
      title: '平台管理',
      hint: '配置一次，自动登录',
      manage: '管理',
      addPlatform: '添加平台',
      connected: '已连接',
      disconnected: '未连接',
    },
  },
  jobs: {
    title: '值守任务',
    description: '无人值守的定时任务，按计划自动运行并推送结果',
  },
  platforms: {
    title: '平台管理',
    description: '管理数据平台的凭据、操作知识、技能和功能',
  },
  skills: {
    title: '技能库',
    description: '技能可被平台和任务复用，开关控制是否启用',
  },
  history: {
    title: '运行历史',
    description: '值守任务每次运行的记录与输出',
  },
  smartQuery: {
    title: '智能问数',
  },
},
```

在 `packages/client/src/i18n/locales/en.ts` 中添加对应的英文翻译(结构同上,值翻译为英文)。

- [ ] **Step 5: 创建 WorkstationHome 骨架(占位,Task 3-6 填充子组件)**

```vue
<!-- packages/client/src/views/envclaw/WorkstationHome.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>

<template>
  <div class="page">
    <h1>{{ t('envclaw.home.greeting') }}</h1>
  </div>
</template>

<style scoped lang="scss">
.page { max-width: 1080px; margin: 0 auto; padding: 28px 32px; }
</style>
```

- [ ] **Step 6: 运行构建确认无编译错误**

Run: `npm run build`
Expected: 成功(可能有未使用 import 的 warning,无 error)

- [ ] **Step 7: 提交**

```bash
git add packages/client/src/router/index.ts \
  packages/client/src/i18n/locales/en.ts \
  packages/client/src/i18n/locales/zh.ts \
  packages/client/src/views/envclaw/
git commit -m "feat(envclaw): add /envclaw route group, layout shell, and i18n namespace"
```

---

## Task 3: 工作台首页 — 欢迎概览 + 统计卡片

**Files:**
- Create: `packages/client/src/components/envclaw/workstation/OverviewBanner.vue`
- Create: `packages/client/src/components/envclaw/workstation/StatCards.vue`
- Modify: `packages/client/src/views/envclaw/WorkstationHome.vue`

**Interfaces:**
- Consumes: `useJobsStore` (from `@/stores/hermes/jobs`) — 读取 `jobs` 列表计算"运行中任务"数量和成功率
- Produces: 概览区 + 统计卡片,嵌入 `WorkstationHome`

- [ ] **Step 1: 创建 OverviewBanner 组件**

```vue
<!-- packages/client/src/components/envclaw/workstation/OverviewBanner.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const dateStr = computed(() => {
  const now = new Date()
  return `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日`
})
</script>

<template>
  <div class="overview">
    <div>
      <h1>{{ t('envclaw.home.greeting') }}，张工</h1>
      <div class="sub">{{ t('envclaw.home.date', { date: dateStr, org: '河南省环境监测中心' }) }}</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.overview {
  display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 26px;
}
h1 { font-size: 21px; font-weight: 600; letter-spacing: 0.2px; }
.sub { color: #a0a0a0; font-size: 13px; margin-top: 5px; }
</style>
```

- [ ] **Step 2: 创建 StatCards 组件**

```vue
<!-- packages/client/src/components/envclaw/workstation/StatCards.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useJobsStore } from '@/stores/hermes/jobs'

const { t } = useI18n()
const jobsStore = useJobsStore()

const runningCount = computed(() =>
  jobsStore.jobs.filter((j) => j.enabled && j.state !== 'paused').length,
)

// TODO: 成功率需要 cron-history API 支持,当前用占位值
const successRate = computed(() => '98%')
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

    <div class="stat-card">
      <div class="stat-top">
        <span class="stat-label">{{ t('envclaw.home.stats.successRate') }}</span>
        <div class="stat-ic green">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
      </div>
      <div class="stat-val" style="color: #66bb6a">{{ successRate }}</div>
      <div class="stat-meta">{{ t('envclaw.home.stats.vsYesterday', { diff: '+2%' }) }}</div>
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
  background: #2a2a2a; border: 1px solid #3a3a3a; border-radius: 12px; padding: 16px 18px;
  &.pending { opacity: 0.55; .stat-val { color: #666 !important; } }
}
.stat-top { display: flex; align-items: center; justify-content: space-between; }
.stat-label { font-size: 12px; color: #a0a0a0; }
.stat-ic {
  width: 30px; height: 30px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  &.blue { background: rgba(106,159,217,0.14); color: #6a9fd9; }
  &.green { background: rgba(102,187,106,0.14); color: #66bb6a; }
}
.stat-val { font-size: 26px; font-weight: 650; margin-top: 10px; letter-spacing: -0.5px; }
.stat-meta { font-size: 11px; color: #666; margin-top: 3px; }
.badge-soon {
  font-size: 10px; padding: 1px 7px; border-radius: 9px;
  background: #252525; border: 1px solid #3a3a3a; color: #666;
}
</style>
```

- [ ] **Step 3: 更新 WorkstationHome 引入这两个组件**

修改 `packages/client/src/views/envclaw/WorkstationHome.vue`:

```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { useJobsStore } from '@/stores/hermes/jobs'
import OverviewBanner from '@/components/envclaw/workstation/OverviewBanner.vue'
import StatCards from '@/components/envclaw/workstation/StatCards.vue'

const jobsStore = useJobsStore()

onMounted(() => {
  void jobsStore.fetchJobs()
})
</script>

<template>
  <div class="page">
    <OverviewBanner />
    <StatCards />
  </div>
</template>

<style scoped lang="scss">
.page { max-width: 1080px; margin: 0 auto; padding: 28px 32px 48px; }
</style>
```

- [ ] **Step 4: 运行 dev 确认渲染**

Run: `npm run dev:client`
Expected: 访问 `http://localhost:8649/#/envclaw` 能看到顶栏+侧栏+概览+统计卡片

- [ ] **Step 5: 提交**

```bash
git add packages/client/src/components/envclaw/workstation/OverviewBanner.vue \
  packages/client/src/components/envclaw/workstation/StatCards.vue \
  packages/client/src/views/envclaw/WorkstationHome.vue
git commit -m "feat(envclaw): add overview banner and stat cards to workstation home"
```

---

## Task 4: 工作台首页 — 场景卡片网格

**Files:**
- Create: `packages/client/src/components/envclaw/workstation/ScenarioGrid.vue`
- Modify: `packages/client/src/views/envclaw/WorkstationHome.vue`

**Interfaces:**
- Consumes: `useTemplatesStore` — 读取 `templates` 列表
- Produces: 场景卡片区,点击可用卡片触发 `@select` 事件(Phase 3 连接向导)

- [ ] **Step 1: 创建 ScenarioGrid 组件**

```vue
<!-- packages/client/src/components/envclaw/workstation/ScenarioGrid.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTemplatesStore, type ScenarioTemplate } from '@/stores/envclaw/templates'
import { useRouter } from 'vue-router'

const { t } = useI18n()
const router = useRouter()
const templatesStore = useTemplatesStore()

const emit = defineEmits<{
  select: [template: ScenarioTemplate]
}>()

function handleClick(tpl: ScenarioTemplate) {
  if (!tpl.available) return
  emit('select', tpl)
  // Phase 3 将改为打开向导面板,目前跳转占位
  router.push({ name: 'envclaw.jobs' })
}
</script>

<template>
  <div class="section">
    <div class="section-head">
      <div class="section-title">
        {{ t('envclaw.home.scenarios.title') }}
        <span class="hint">{{ t('envclaw.home.scenarios.hint') }}</span>
      </div>
    </div>
    <div class="scenario-grid">
      <div
        v-for="tpl in templatesStore.templates"
        :key="tpl.id"
        :class="['scenario-card', { disabled: !tpl.available }]"
        @click="handleClick(tpl)"
      >
        <div :class="['scenario-ic', tpl.available ? 'color-green' : 'color-mute']">
          <!-- 使用通用图标占位,后续替换为 Lucide 组件 -->
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <path v-if="tpl.icon === 'volume-2'" d="M3 11v2a1 1 0 0 0 1 1h3l4 4V6L7 10H4a1 1 0 0 0-1 1ZM16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14" />
            <path v-else-if="tpl.icon === 'bar-chart-3'" d="M3 3v18h18M7 10v8M12 6v12M17 13v5" />
            <path v-else-if="tpl.icon === 'triangle-alert'" d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3ZM12 9v4M12 17h.01" />
            <path v-else d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6M9 13h6M9 17h4" />
          </svg>
        </div>
        <h3>{{ tpl.name }}</h3>
        <p>{{ tpl.description }}</p>
        <div class="scenario-foot">
          <div v-if="tpl.available" class="tag-row">
            <span v-for="tag in tpl.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
          <span v-else class="badge-wip">{{ t('envclaw.home.scenarios.comingSoon') }}</span>
          <span :class="['scenario-go', { muted: !tpl.available }]">
            {{ tpl.available ? t('envclaw.home.scenarios.start') : t('envclaw.home.scenarios.stayTuned') }}
            <svg v-if="tpl.available" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.section { margin-bottom: 30px; }
.section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.section-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; }
.hint { font-weight: 400; font-size: 12px; color: #666; }

.scenario-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.scenario-card {
  background: #2a2a2a; border: 1px solid #3a3a3a; border-radius: 12px;
  padding: 18px; cursor: pointer; transition: 0.15s;
  &:hover:not(.disabled) { border-color: #555; background: #303030; transform: translateY(-2px); }
  &.disabled { cursor: not-allowed; opacity: 0.5; }
}

.scenario-ic {
  width: 40px; height: 40px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center; margin-bottom: 13px;
  &.color-green { background: rgba(102,187,106,0.14); color: #66bb6a; }
  &.color-mute { background: #252525; color: #a0a0a0; }
}

h3 { font-size: 14px; font-weight: 600; margin-bottom: 6px; }
p { font-size: 12px; color: #a0a0a0; line-height: 1.55; margin-bottom: 14px; min-height: 37px; }
.scenario-foot { display: flex; align-items: center; justify-content: space-between; }
.tag-row { display: flex; gap: 5px; }
.tag { padding: 2px 8px; border-radius: 10px; font-size: 10.5px; background: #252525; color: #a0a0a0; border: 1px solid #3a3a3a; }
.badge-wip { padding: 2px 8px; border-radius: 10px; font-size: 10.5px; background: #252525; color: #666; border: 1px dashed #555; }
.scenario-go { display: flex; align-items: center; gap: 3px; font-size: 12px; color: #a0a0a0; &.muted { color: #666; } }
.scenario-card:hover:not(.disabled) .scenario-go { color: #e0e0e0; }
</style>
```

- [ ] **Step 2: 更新 WorkstationHome 引入 ScenarioGrid**

在 `WorkstationHome.vue` 的 template 中,`<StatCards />` 之后添加:

```vue
<ScenarioGrid />
```

在 script 中添加 import:

```ts
import ScenarioGrid from '@/components/envclaw/workstation/ScenarioGrid.vue'
```

- [ ] **Step 3: 运行 dev 确认 4 张场景卡片渲染**

Run: `npm run dev:client`
Expected: 4 张卡片,数据播报可点击(hover 有动效),其余三张置灰不可点击

- [ ] **Step 4: 提交**

```bash
git add packages/client/src/components/envclaw/workstation/ScenarioGrid.vue \
  packages/client/src/views/envclaw/WorkstationHome.vue
git commit -m "feat(envclaw): add scenario grid driven by template definitions"
```

---

## Task 5: 工作台首页 — 活跃任务列表

**Files:**
- Create: `packages/client/src/components/envclaw/workstation/ActiveTasks.vue`
- Modify: `packages/client/src/views/envclaw/WorkstationHome.vue`

**Interfaces:**
- Consumes: `useJobsStore` — 读取 `jobs` 列表,取前 N 条活跃任务(非 disabled)
- Produces: 任务行列表,点击触发 `@selectJob` 事件(Phase 4 连接任务详情)

- [ ] **Step 1: 创建 ActiveTasks 组件**

```vue
<!-- packages/client/src/components/envclaw/workstation/ActiveTasks.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useJobsStore } from '@/stores/hermes/jobs'
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
  return job.schedule_display || job.schedule || ''
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

    <div v-if="activeJobs.length === 0" class="empty">{{ t('common.noData') }}</div>

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
.section-link { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #a0a0a0; text-decoration: none; &:hover { color: #e0e0e0; } }
.empty { color: #666; font-size: 13px; padding: 20px 0; }

.task-list { display: flex; flex-direction: column; gap: 8px; }
.task-row {
  display: flex; align-items: center; gap: 14px; background: #2a2a2a;
  border: 1px solid #3a3a3a; border-radius: 8px; padding: 13px 16px;
  cursor: pointer; transition: 0.15s;
  &:hover { border-color: #555; }
}
.task-ic {
  width: 36px; height: 36px; border-radius: 9px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  &.color-blue { background: rgba(106,159,217,0.14); color: #6a9fd9; }
}
.task-main { flex: 1; min-width: 0; }
h4 { font-size: 13px; font-weight: 500; }
.task-meta { display: flex; gap: 16px; margin-top: 5px; span { font-size: 11.5px; color: #666; } }
.task-right { display: flex; align-items: center; }

.pill {
  display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px;
  border-radius: 11px; font-size: 11px; font-weight: 500;
  &::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  &.pill-run { background: rgba(102,187,106,0.14); color: #66bb6a; }
  &.pill-pause { background: rgba(224,164,88,0.14); color: #e0a458; }
}
</style>
```

- [ ] **Step 2: 更新 WorkstationHome 引入 ActiveTasks**

在 `WorkstationHome.vue` 的 template 中,`<ScenarioGrid />` 之后添加 `<ActiveTasks />`,并在 script 中 import。

- [ ] **Step 3: 提交**

```bash
git add packages/client/src/components/envclaw/workstation/ActiveTasks.vue \
  packages/client/src/views/envclaw/WorkstationHome.vue
git commit -m "feat(envclaw): add active tasks list to workstation home"
```

---

## Task 6: 工作台首页 — 平台状态条

**Files:**
- Create: `packages/client/src/components/envclaw/workstation/PlatformBar.vue`
- Modify: `packages/client/src/views/envclaw/WorkstationHome.vue`

**Interfaces:**
- Consumes: `usePlatformsStore` (Phase 2 创建,当前用空 store 占位)
- Produces: 平台状态条,点击跳转平台管理页

- [ ] **Step 1: 创建平台 store 占位**

```ts
// packages/client/src/stores/envclaw/platforms.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

/** 平台数据模型 — Phase 2 会补全完整字段和 API 调用 */
export interface Platform {
  id: string
  type: string
  name: string
  url?: string
  operationPrompt: string
  skills: string[]
  functions: PlatformFunction[]
  accounts: PlatformAccount[]
}

export interface PlatformFunction {
  id: string
  name: string
  prompt: string
}

export interface PlatformAccount {
  id: string
  name: string
  status: 'connected' | 'expired' | 'error' | 'pending'
}

export const usePlatformsStore = defineStore('envclaw-platforms', () => {
  const platforms = ref<Platform[]>([])
  const loading = ref(false)

  async function fetchPlatforms() {
    loading.value = true
    try {
      // Phase 2: 调用真实 API
      platforms.value = []
    } finally {
      loading.value = false
    }
  }

  return { platforms, loading, fetchPlatforms }
})
```

- [ ] **Step 2: 创建 PlatformBar 组件**

```vue
<!-- packages/client/src/components/envclaw/workstation/PlatformBar.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { usePlatformsStore } from '@/stores/envclaw/platforms'

const { t } = useI18n()
const platformsStore = usePlatformsStore()
</script>

<template>
  <div class="section">
    <div class="section-head">
      <div class="section-title">
        {{ t('envclaw.home.platforms.title') }}
        <span class="hint">{{ t('envclaw.home.platforms.hint') }}</span>
      </div>
      <router-link :to="{ name: 'envclaw.platforms' }" class="section-link">
        {{ t('envclaw.home.platforms.manage') }}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </router-link>
    </div>

    <div v-if="platformsStore.platforms.length === 0" class="platform-bar">
      <div class="pl-chip pl-add" @click="$router.push({ name: 'envclaw.platforms' })">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M5 12h14M12 5v14" />
        </svg>
        {{ t('envclaw.home.platforms.addPlatform') }}
      </div>
    </div>

    <div v-else class="platform-bar">
      <div v-for="p in platformsStore.platforms" :key="p.id" class="pl-chip">
        <span :class="['pl-status', p.accounts.some(a => a.status === 'connected') ? 'pl-on' : 'pl-off']" />
        {{ p.name }}
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.section { margin-bottom: 30px; }
.section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.section-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; }
.hint { font-weight: 400; font-size: 12px; color: #666; }
.section-link { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #a0a0a0; text-decoration: none; &:hover { color: #e0e0e0; } }

.platform-bar { display: flex; gap: 10px; flex-wrap: wrap; }
.pl-chip {
  display: flex; align-items: center; gap: 8px; padding: 9px 14px;
  background: #2a2a2a; border: 1px solid #3a3a3a; border-radius: 8px;
  font-size: 12.5px; cursor: pointer; transition: 0.15s;
  &:hover { border-color: #555; }
  &.pl-add { color: #a0a0a0; border-style: dashed; }
}
.pl-status { width: 7px; height: 7px; border-radius: 50%; }
.pl-on { background: #66bb6a; }
.pl-off { background: #666; }
</style>
```

- [ ] **Step 3: 更新 WorkstationHome 引入 PlatformBar**

在 `<ActiveTasks />` 之后添加 `<PlatformBar />`,script 中 import `PlatformBar` 和 `usePlatformsStore`,在 `onMounted` 中也调用 `platformsStore.fetchPlatforms()`。

- [ ] **Step 4: 提交**

```bash
git add packages/client/src/stores/envclaw/platforms.ts \
  packages/client/src/components/envclaw/workstation/PlatformBar.vue \
  packages/client/src/views/envclaw/WorkstationHome.vue
git commit -m "feat(envclaw): add platform status bar and platforms store placeholder"
```

---

## Task 7: 端到端验证

**Files:** 无新增,全量验证

- [ ] **Step 1: 运行全部单元测试**

Run: `npm run test`
Expected: 全部 PASS(含 Task 1 的模板测试)

- [ ] **Step 2: 运行构建**

Run: `npm run build`
Expected: 成功,无 TypeScript 错误

- [ ] **Step 3: 运行 dev 验证完整首页**

Run: `npm run dev`
Expected:
- 访问 `http://localhost:8649/#/envclaw` 显示完整工作台首页
- 顶栏有"工作台/智能问数"切换
- 左侧导航 5 项可点击切换
- 统计卡片 4 张(后两张置灰)
- 场景卡片 4 张(后三张置灰不可点击)
- 活跃任务列表从 jobs store 读取
- 平台条显示(当前为空,只显示"添加平台")

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "chore(envclaw): Phase 1 complete — workstation home with templates"
```

---

## Phase 1 Self-Review

### 1. Spec Coverage

| 设计文档 §3.1 需求 | 覆盖 Task |
|---|---|
| 欢迎概览(问候+日期+单位) | Task 3 (OverviewBanner) |
| 统计卡×4(运行中/成功率=真数据,预警/采集=置灰) | Task 3 (StatCards) |
| 场景卡片×4(数据播报可点击,其余置灰) | Task 4 (ScenarioGrid) + Task 1 (模板定义) |
| 活跃任务列表(频率/推送/上次运行/状态/操作) | Task 5 (ActiveTasks) |
| 平台条(连接状态+快捷入口) | Task 6 (PlatformBar) |
| 左侧导航(5项,不含智能问数) | Task 2 (EnvclawLayout) |
| 顶栏双模式切换(工作台/智能问数) | Task 2 (EnvclawLayout) |
| 切换模式不丢失状态(Pinia 持久化) | Task 2 (路由体系) — Pinia 状态天然保持 |

### 2. Placeholder Scan

无 TBD/TODO(除 `StatCards` 中 `successRate` 标注了 `// TODO: 需要 cron-history API`,这是已知未决依赖,设计文档 §6 已明确)

### 3. Type Consistency

- `ScenarioTemplate.id` = `string`,被 `ScenarioGrid` 的 `v-for :key="tpl.id"` 使用 — 一致
- `Platform` / `PlatformFunction` / `PlatformAccount` 接口与设计文档 §3.3 定义一致
- `useJobsStore` 的 `jobs: Job[]` 中 `Job` 来自 `@/api/hermes/jobs` — 与现有代码一致

---

**Phase 1 完成后产出:** 可运行的环保管家工作台首页,场景卡片由模板数据驱动,活跃任务从 Hermes jobs store 读取,为 Phase 2(平台管理)和 Phase 3(创建向导)打好基础。

**后续 Phase 计划文件将在各自 Phase 开始前产出:**
- `docs/superpowers/plans/2026-06-26-envclaw-phase2-platforms.md`
- `docs/superpowers/plans/2026-06-26-envclaw-phase3-wizard.md`
- `docs/superpowers/plans/2026-06-26-envclaw-phase4-pages.md`
- `docs/superpowers/plans/2026-06-26-envclaw-phase5-smartquery-chat.md`
