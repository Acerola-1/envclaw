# 环保管家 Phase 1 修改文件清单

**日期**: 2026-06-26  
**分支**: dev（未提交）  
**修改目的**: 修复主题支持、布局问题、侧边栏重叠

---

## 新建文件

```
packages/client/src/styles/envclaw-theme.scss
  - 统一的主题变量文件
  - 定义暗色/浅色两套配色方案
  - 使用 CSS 自定义属性（--envclaw-*）
```

---

## 修改文件（共 25 个）

### 1. 根组件

```
packages/client/src/App.vue
  - 新增 isEnvclawRoute 判断
  - 修改 showAppSidebar 逻辑，排除 envclaw 路由
  - 修复两个侧边栏同时显示的问题
```

### 2. 国际化文件

```
packages/client/src/i18n/locales/zh.ts
  - 添加 envclaw.topbar.settings 和 envclaw.topbar.notifications
  - 添加 envclaw.jobs.deliverChannels 推送渠道映射

packages/client/src/i18n/locales/en.ts
  - 添加 envclaw.topbar.settings 和 envclaw.topbar.notifications
  - 添加 envclaw.jobs.deliverChannels 推送渠道映射
```

### 2. 工作台页面

```
packages/client/src/views/envclaw/WorkstationHome.vue
  - 调整 .main-area 布局
  - 添加 position: relative 为 fixed 向导提供定位上下文
  - 移除 flex 布局，避免向导挤压
```

### 3. 工作台组件

```
packages/client/src/views/envclaw/EnvclawLayout.vue
  - 引入 useTheme()
  - 添加 :class="{ light: !isDark }"
  - 所有硬编码颜色改为 CSS 变量

packages/client/src/components/envclaw/workstation/OverviewBanner.vue
  - .sub 颜色改为 var(--envclaw-text-secondary)

packages/client/src/components/envclaw/workstation/StatCards.vue
  - 所有样式改为 CSS 变量
  - 标记成功率为 pending 状态
  - 移除硬编码的 98% 和 +2%

packages/client/src/components/envclaw/workstation/ScenarioGrid.vue
  - 所有样式改为 CSS 变量

packages/client/src/components/envclaw/workstation/ActiveTasks.vue
  - 所有样式改为 CSS 变量

packages/client/src/components/envclaw/workstation/PlatformBar.vue
  - 所有样式改为 CSS 变量
```

### 4. 值守任务页面

```
packages/client/src/views/envclaw/JobsPage.vue
  - 所有样式改为 CSS 变量

packages/client/src/views/envclaw/JobDetailPage.vue
  - 所有样式改为 CSS 变量

packages/client/src/components/envclaw/jobs/JobListTable.vue
  - 所有样式改为 CSS 变量

packages/client/src/components/envclaw/jobs/JobStatusPill.vue
  - 状态颜色改为 CSS 变量（--envclaw-success/warning/error）
```

### 5. 平台管理页面

```
packages/client/src/views/envclaw/PlatformsPage.vue
  - 所有样式改为 CSS 变量

packages/client/src/components/envclaw/platforms/PlatformCard.vue
  - 所有样式改为 CSS 变量

packages/client/src/components/envclaw/platforms/PlatformConfigDrawer.vue
  - 所有样式改为 CSS 变量

packages/client/src/components/envclaw/platforms/AccountDrawer.vue
  - 所有样式改为 CSS 变量
```

### 6. 技能库页面

```
packages/client/src/views/envclaw/SkillsPage.vue
  - 所有样式改为 CSS 变量

packages/client/src/components/envclaw/skills/SkillCategoryList.vue
  - 所有样式改为 CSS 变量
  - 来源指示器颜色保留（dot-builtin/dot-hub）

packages/client/src/components/envclaw/skills/SkillDetailPanel.vue
  - 所有样式改为 CSS 变量
  - 来源指示器颜色保留（dot-builtin/dot-hub）
```

### 7. 运行历史页面

```
packages/client/src/views/envclaw/HistoryPage.vue
  - 所有样式改为 CSS 变量

packages/client/src/components/envclaw/history/RunRecordList.vue
  - 所有样式改为 CSS 变量

packages/client/src/components/envclaw/history/RunDetailPanel.vue
  - 所有样式改为 CSS 变量
```

### 8. 向导面板

```
packages/client/src/components/envclaw/wizard/TaskWizard.vue
  - 所有样式改为 CSS 变量
  - 改为 position: fixed
  - 设置 top: 52px, right: 0, bottom: 0, z-index: 100

packages/client/src/components/envclaw/wizard/TemplateWizard.vue
  - 所有样式改为 CSS 变量

packages/client/src/components/envclaw/wizard/FunctionSelector.vue
  - 所有样式改为 CSS 变量

packages/client/src/components/envclaw/wizard/PromptPreview.vue
  - 所有样式改为 CSS 变量

packages/client/src/components/envclaw/wizard/SkillSelector.vue
  - 所有样式改为 CSS 变量

packages/client/src/components/envclaw/wizard/DeliverSelector.vue
  - 所有样式改为 CSS 变量

packages/client/src/components/envclaw/wizard/AiGuidePlaceholder.vue
  - 所有样式改为 CSS 变量
```

---

## 主题变量对照表

### 暗色模式（默认）

| 变量名 | 值 | 用途 |
|--------|-----|------|
| `--envclaw-bg-primary` | #1a1a1a | 主背景 |
| `--envclaw-bg-secondary` | #2a2a2a | 卡片/面板背景 |
| `--envclaw-bg-tertiary` | #252525 | 次要背景/按钮 |
| `--envclaw-bg-hover` | #202020 | 侧边栏背景 |
| `--envclaw-border` | #3a3a3a | 边框 |
| `--envclaw-border-light` | #555 | 高亮边框 |
| `--envclaw-text-primary` | #e0e0e0 | 主文字 |
| `--envclaw-text-secondary` | #a0a0a0 | 次要文字 |
| `--envclaw-text-muted` | #666 | 弱化文字 |
| `--envclaw-success` | #66bb6a | 成功状态 |
| `--envclaw-warning` | #e0a458 | 警告状态 |
| `--envclaw-error` | #d96a6a | 错误状态 |
| `--envclaw-info` | #6a9fd9 | 信息状态 |
| `--envclaw-button-bg` | #e0e0e0 | 按钮背景 |
| `--envclaw-button-text` | #1a1a1a | 按钮文字 |
| `--envclaw-input-bg` | #252525 | 输入框背景 |
| `--envclaw-input-border` | #3a3a3a | 输入框边框 |
| `--envclaw-input-border-focus` | #555 | 输入框聚焦边框 |

### 浅色模式

| 变量名 | 值 | 用途 |
|--------|-----|------|
| `--envclaw-bg-primary` | #fafafa | 主背景 |
| `--envclaw-bg-secondary` | #ffffff | 卡片/面板背景 |
| `--envclaw-bg-tertiary` | #f5f5f5 | 次要背景/按钮 |
| `--envclaw-bg-hover` | #f0f0f0 | 侧边栏背景 |
| `--envclaw-border` | #e0e0e0 | 边框 |
| `--envclaw-border-light` | #d0d0d0 | 高亮边框 |
| `--envclaw-text-primary` | #1a1a1a | 主文字 |
| `--envclaw-text-secondary` | #666666 | 次要文字 |
| `--envclaw-text-muted` | #999999 | 弱化文字 |
| `--envclaw-success` | #4caf50 | 成功状态 |
| `--envclaw-warning` | #d89a3c | 警告状态 |
| `--envclaw-error` | #d32f2f | 错误状态 |
| `--envclaw-info` | #1976d2 | 信息状态 |
| `--envclaw-button-bg` | #333333 | 按钮背景 |
| `--envclaw-button-text` | #ffffff | 按钮文字 |
| `--envclaw-input-bg` | #ffffff | 输入框背景 |
| `--envclaw-input-border` | #e0e0e0 | 输入框边框 |
| `--envclaw-input-border-focus` | #999999 | 输入框聚焦边框 |

---

## 验证方法

### 1. 主题切换验证

```bash
npm run dev
```

1. 访问 `http://localhost:8649`
2. 点击右上角设置 → 主题切换
3. 切换到浅色模式
4. 访问所有 envclaw 页面，确认颜色正确

### 2. 布局验证

1. 访问 `/envclaw`
2. 确认左侧只有一个侧边栏
3. 点击"数据播报"
4. 确认向导覆盖而非挤压主页面

### 3. 构建验证

```bash
npm run build
```

确认构建成功，无报错。
