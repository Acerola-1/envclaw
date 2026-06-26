# 环保管家 Phase 1 代码审查

**日期**: 2026-06-26  
**审查范围**: Phase 1 实现（场景模板 + 工作台首页骨架）  
**审查者**: acerola

---

## 一、严重问题（必须修复）

### 1. 未实现浅色模式支持 ❌

**问题描述**:
- 所有 envclaw 组件硬编码了暗色主题（`#1a1a1a`, `#2a2a2a` 等）
- 完全忽略了项目已有的主题系统（`useTheme()` + `theme.ts`）
- 其他 Hermes 页面都支持浅色/暗色切换，唯独 envclaw 不支持

**影响**:
- 用户在浅色模式下使用其他页面，进入 envclaw 突然变成暗色，体验割裂
- 违反了项目的设计一致性原则

**涉及文件**:
```
packages/client/src/views/envclaw/EnvclawLayout.vue
packages/client/src/views/envclaw/WorkstationHome.vue
packages/client/src/components/envclaw/workstation/*.vue
packages/client/src/components/envclaw/wizard/*.vue
packages/client/src/components/envclaw/platforms/*.vue
```

**修复方案**:
1. 所有组件引入 `useTheme()` 获取 `isDark` 状态
2. 样式改用 CSS 变量或动态 class，响应主题切换
3. 参考 `theme.ts` 中的 `lightThemeOverrides` 和 `darkThemeOverrides`
4. 建议创建 envclaw 专用的主题变量文件（如 `@/styles/envclaw-theme.scss`）

**示例修复**（EnvclawLayout.vue）:
```vue
<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'
const { isDark } = useTheme()
</script>

<template>
  <div class="envclaw-layout" :class="{ dark: isDark }">
    <!-- ... -->
  </div>
</template>

<style scoped lang="scss">
.envclaw-layout {
  background: #fafafa; // light mode
  color: #1a1a1a;
  
  &.dark {
    background: #1a1a1a;
    color: #e0e0e0;
  }
}
</style>
```

---

### 2. 向导面板挤压主页面布局 ❌

**问题描述**:
- `WorkstationHome.vue` 使用 `display: flex`，向导面板作为兄弟节点
- 点击"数据播报"后，向导从右侧滑出，**挤压** `.main-area`，导致所有卡片变形
- 设计意图是"右侧滑出面板，左侧任务列表保持可见"，但实际是挤压而非覆盖

**当前代码**（WorkstationHome.vue:68-70）:
```vue
<div class="workstation-home">
  <div class="main-area">...</div>
  <TaskWizard />  <!-- 560px 固定宽度，挤占 main-area 空间 -->
</div>
```

**修复方案**:
使用 `position: fixed` 或 `absolute`，让向导面板覆盖在内容之上，而非挤压：

```vue
<style scoped lang="scss">
.workstation-home {
  position: relative; // 为 TaskWizard 提供定位上下文
  height: 100%;
}

.main-area {
  width: 100%;  // 不被挤压
  // ...
}

// TaskWizard.vue 中
.task-wizard {
  position: fixed;
  top: 52px;  // 顶栏高度
  right: 0;
  bottom: 0;
  width: 560px;
  z-index: 100;
  // ...
}
</style>
```

或者给 `.main-area` 添加遮罩层，暗示"背后的内容不可交互"。

---

### 3. 两个侧边栏同时显示 ❌ **[严重架构错误]**

**问题描述**:
- 用户看到的：访问 `/envclaw` 时，**左侧同时出现两个侧边栏**
  - 外层：AppSidebar（任务/看板/频道/技能/插件/MCP）
  - 内层：EnvclawLayout 自己的导航（工作台/值守任务/平台管理/技能库/运行历史）
- 用户评价："新页面左侧是老的设置页面，这不应该同屏"

**根本原因**（App.vue:23-26）:
```ts
const usesPageSidebar = computed(() =>
  ['hermes.chat', 'hermes.session', ...].includes(route.name as string),
)
const showAppSidebar = computed(() => !usesPageSidebar.value)  // ❌ 忘记排除 envclaw
```

当前逻辑：
- 只有 hermes.chat / hermes.history 等几个页面隐藏 AppSidebar
- **envclaw 路由未被排除**，导致 AppSidebar 仍然显示
- 同时 EnvclawLayout 又渲染了自己的左侧导航
- **结果 = 两个侧边栏叠在一起**

**修复方案**（已在 App.vue 中修复）:
```ts
const isEnvclawRoute = computed(() => route.path.startsWith('/envclaw'))
const showAppSidebar = computed(() => !usesPageSidebar.value && !isEnvclawRoute.value)
```

**修复效果**:
- 访问 `/envclaw` 时，AppSidebar 被隐藏
- 只显示 EnvclawLayout 自己的左侧导航（工作台/值守任务/平台管理/技能库/运行历史）
- 这才是设计文档的本意

---

### 4. 成功率数据是假的 ⚠️

**问题描述**（StatCards.vue:13-14）:
```ts
// TODO: 成功率需要 cron-history API 支持,当前用占位值
const successRate = computed(() => '98%')
```

**影响**:
- 用户看到 "今日成功率 98% +2%" 这个数字，会以为是真实数据
- 实际是硬编码假值，误导用户

**当前状态**:
- 代码里有 TODO 注释，说明开发者知道这是临时方案
- 但 **UI 上没有任何"待接入"标识**，用户无法区分真假数据

**修复方案**（短期）:
像"待处理预警"和"今日数据采集"一样，添加 `pending` class 和"待接入"徽章：

```vue
<div class="stat-card pending">
  <div class="stat-top">
    <span class="stat-label">{{ t('envclaw.home.stats.successRate') }}</span>
    <span class="badge-soon">{{ t('envclaw.home.stats.pending') }}</span>
  </div>
  <div class="stat-val">—</div>
  <div class="stat-meta">{{ t('envclaw.home.stats.noData') }}</div>
</div>
```

**修复方案**（长期）:
1. 后端提供 `/api/envclaw/stats/success-rate` 接口
2. 基于 `jobs` 表的 `lastRunAt` + `state` 字段，计算今日任务成功率
3. 前端调用真实接口，移除 `pending` 标记

---

## 二、次要问题（建议修复）

### 5. 代码组织：缺少统一的样式变量

**问题描述**:
- 所有颜色值硬编码在各组件的 `<style>` 中
- 例如 `#1a1a1a`, `#2a2a2a`, `#3a3a3a`, `#e0e0e0` 重复出现 50+ 次
- 修改主题色需要全局搜索替换，容易遗漏

**建议**:
创建 `packages/client/src/styles/envclaw-theme.scss`：

```scss
// envclaw 专用主题变量
$envclaw-bg-primary: #1a1a1a;
$envclaw-bg-secondary: #2a2a2a;
$envclaw-border: #3a3a3a;
$envclaw-text-primary: #e0e0e0;
$envclaw-text-secondary: #a0a0a0;
$envclaw-text-muted: #666;

// 状态色（与设计文档一致）
$envclaw-success: #66bb6a;
$envclaw-warning: #e0a458;
$envclaw-error: #d96a6a;
$envclaw-info: #6a9fd9;

// 浅色主题（配合问题 1 修复）
$envclaw-bg-primary-light: #fafafa;
$envclaw-bg-secondary-light: #ffffff;
$envclaw-border-light: #e0e0e0;
$envclaw-text-primary-light: #1a1a1a;
$envclaw-text-secondary-light: #666666;
```

然后在组件中：
```scss
@use '@/styles/envclaw-theme' as envclaw;

.stat-card {
  background: envclaw.$envclaw-bg-secondary;
  border: 1px solid envclaw.$envclaw-border;
}
```

---

### 6. 国际化不完整

**问题描述**:
- 部分文案直接硬编码在组件中，未走 i18n
- 例如 `OverviewBanner.vue` 中可能有硬编码的"欢迎"、"数智大气"等文案

**检查方法**:
```bash
grep -r "欢迎\|数智大气\|待接入" packages/client/src/components/envclaw --include="*.vue"
```

**修复**:
所有用户可见文案必须在 `packages/client/src/i18n/locales/en.ts` 和 `zh.ts` 中定义。

---

### 7. 性能：缺少虚拟滚动

**问题描述**:
- `ActiveTasks.vue` 直接渲染所有任务列表
- 如果用户有 100+ 个值守任务，会有性能问题

**建议**:
- 如果任务数量可能超过 50，考虑使用 Naive UI 的 `VirtualList` 或分页

---

### 8. 可访问性（A11y）

**问题描述**:
- 所有按钮/链接缺少 `aria-label`
- 图标没有文字说明，屏幕阅读器无法理解
- 键盘导航未测试（Tab、Enter、Esc 是否正常工作）

**示例修复**（EnvclawLayout.vue:57-63）:
```vue
<button
  :class="['mode-btn', { active: isWorkstation }]"
  @click="goWorkstation"
  aria-label="切换到工作台模式"
  :aria-pressed="isWorkstation"
>
  <svg aria-hidden="true">...</svg>
  {{ t('envclaw.mode.workstation') }}
</button>
```

---

## 三、设计一致性问题

### 9. 与设计文档的偏差

| 设计文档要求 | 当前实现 | 状态 |
|------------|---------|------|
| 顶栏包含通知 🔔 / 设置 ⚙️ / 头像 👤 | 只有头像，缺少通知和设置入口 | ❌ 缺失 |
| 平台条"名称统一为'平台管理'" | 未实现 PlatformBar 点击跳转 | ⚠️ 部分实现 |
| 场景卡"数据采集、异常预警、报告生成置为不可点击" | 实现正确（ScenarioGrid.vue:37） | ✅ 符合 |
| 概览卡"待处理预警、今日数据采集置灰标注待接入" | 实现正确（StatCards.vue:45-61） | ✅ 符合 |

---

## 四、测试覆盖

**当前状态**: 未发现 envclaw 相关的测试文件

**建议添加**:
```
tests/client/stores/envclaw/templates.test.ts
tests/client/stores/envclaw/platforms.test.ts
tests/client/composables/envclaw/usePromptAssembly.test.ts
tests/e2e/envclaw-wizard-flow.spec.ts
```

**最低测试要求**:
1. **单元测试**: `usePromptAssembly` 的提示词组装逻辑
2. **E2E 测试**: 打开向导 → 选平台 → 选功能 → 创建任务 → 验证任务列表

---

## 五、修复优先级建议

| 优先级 | 问题 | 工作量估计 | 阻塞 Phase 2 |
|-------|-----|-----------|-------------|
| **P0** | 1. 浅色模式支持 | 4-6h | 是 |
| **P0** | 2. 向导挤压布局 | 1h | 是 |
| **P0** | 3. 两个侧边栏同时显示 | 5min | 是（已修复） |
| **P1** | 4. 成功率假数据 | 0.5h（短期方案） | 否 |
| **P2** | 5. 样式变量统一 | 2h | 否 |
| **P2** | 6-9. 其他次要问题 | 4-6h | 否 |

**建议 Phase 1.1 迭代**:
- 先修复 P0 问题（浅色模式 + 布局），确保基础体验正常
- 再修复 P1 问题，补齐设计缺失的功能
- P2 问题可延后到 Phase 2 实施时一并优化

---

## 六、正向反馈 ✅

以下实现符合设计文档要求，值得表扬：

1. ✅ **模块化做得好**: `workstation/`、`wizard/`、`platforms/` 组件拆分清晰
2. ✅ **场景卡片置灰逻辑正确**: `ScenarioGrid.vue` 只开放"数据播报"，其余三张正确标记为 `comingSoon`
3. ✅ **提示词组装逻辑**: `usePromptAssembly` 组合式函数设计合理，易于测试
4. ✅ **国际化键名规范**: `envclaw.home.*`、`envclaw.wizard.*` 命名空间清晰
5. ✅ **Git 未提交状态**: 所有新文件都在 `??` 状态，便于 review 后统一提交

---

## 七、下一步行动建议

### 短期（本周内）
1. 修复浅色模式（问题 1）
2. 修复向导布局（问题 2）
3. 将成功率卡片改为"待接入"态（问题 4）

### 中期（Phase 2 开始前）
4. 补齐顶栏设置入口（问题 3）
5. 提取样式变量（问题 5）
6. 添加基础测试（至少 1 个 E2E）

### 长期（Phase 2-4 并行）
7. 接入真实成功率 API
8. 补齐可访问性标注
9. 完善测试覆盖率（目标 >70%）

---

## 附录：检查清单

在提交 Phase 1 代码前，请逐项确认：

- [ ] 所有页面支持浅色/暗色主题切换
- [ ] 向导面板不挤压主页面布局
- [ ] 顶栏有设置入口（齿轮图标）
- [ ] 假数据的统计卡标记为"待接入"
- [ ] 运行 `npm run test` 无报错
- [ ] 运行 `npm run build` 成功
- [ ] 手动测试：创建一个"数据播报"任务，任务列表正确显示
- [ ] Git 提交信息清晰（建议格式：`[envclaw] Phase 1: 场景模板 + 工作台首页骨架`）

---

**审查结论**: Phase 1 实现了核心功能框架，但存在 4 个严重问题（浅色模式、布局挤压、设置入口、假数据）必须修复后才能合并到 `main` 分支。建议创建 `feat/envclaw-phase1-fixes` 分支进行迭代。
