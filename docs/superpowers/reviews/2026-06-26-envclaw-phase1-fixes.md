# 环保管家 Phase 1 修复总结

**日期**: 2026-06-26  
**分支**: dev（未提交，待人工确认）  
**修复内容**: P0 严重问题修复

---

## 已修复问题

### ✅ 问题 -6: 新建数据播报任务页面优化

**问题**:
1. 推送平台是 hermes 频道，不是平台管理的数据平台
2. 可选技能是多选标签，应该改为下拉列表单选
3. 选了平台后看不到平台的技能
4. 数据平台需要多选，支持一次任务访问多个网站

**修复**:
- 推送平台改为下拉选择，只显示已配置的频道，已配置的排在前面
- 修复了频道配置判断逻辑，从 settingsStore 的单独字段读取配置
- 可选技能改为下拉列表，单选，只显示平台自带的技能
- 当平台切换时，自动更新技能列表
- 平台自带技能显示为标签（不可删除），额外技能通过下拉选择
- 数据平台改为多选，支持选择多个平台
- 合并所有选中平台的功能和技能

**修改文件**:
```
packages/client/src/components/envclaw/wizard/TemplateWizard.vue
packages/client/src/components/envclaw/wizard/DeliverSelector.vue
packages/client/src/components/envclaw/wizard/SkillSelector.vue
packages/client/src/i18n/locales/zh.ts
packages/client/src/i18n/locales/en.ts
```

---

### ✅ 问题 -5: 设置页面返回按钮问题

**问题**: 设置页面点击返回按钮会回到老旧页面，而不是工作台页面

**修复**:
- 默认返回路径设置为 `/envclaw`（工作台首页）
- 返回按钮始终显示

**修改文件**:
```
packages/client/src/views/hermes/SettingsView.vue
```

---

### ✅ 问题 -4: 问候语和品牌名

**修复内容**:
- 问候语根据时间动态显示（早上好/下午好/晚上好/夜深了）
- 删除用户名"张工"
- 删除"河南省环境监测中心"
- 品牌名改为"数值大气 EnvClaw"

**修改文件**:
```
packages/client/src/components/envclaw/workstation/OverviewBanner.vue
packages/client/src/i18n/locales/zh.ts
packages/client/src/i18n/locales/en.ts
```

---

### ✅ 问题 -3: 平台配置技能列表为空

**问题**: 平台配置中的技能选择显示"No Data"，没有从系统技能列表获取

**修复**:
- 在 `PlatformConfigDrawer.vue` 中添加 `fetchSkills()` 调用
- 从系统技能 API 获取技能列表
- 技能选项显示为"分类 / 技能名"格式
- 添加加载状态

**修改文件**:
```
packages/client/src/components/envclaw/platforms/PlatformConfigDrawer.vue
```

---

### ✅ 问题 -2: 平台管理账号问题

**修复内容**:
- 删除"待验证"状态（从 PlatformCard.vue 的 statusTag 中移除）
- 删除"自动重登"选项（从 AccountDrawer.vue 中移除）
- 密码输入框改为明文显示（因为要作为提示词交给大模型）
- 添加凭据说明提示："凭据将以明文形式保存，用于生成提示词交给大模型执行任务"
- 编辑账号时显示已保存的凭据（明文）

**修改文件**:
```
packages/client/src/components/envclaw/platforms/PlatformCard.vue
packages/client/src/components/envclaw/platforms/AccountDrawer.vue
packages/client/src/i18n/locales/zh.ts
packages/client/src/i18n/locales/en.ts
```

---

### ✅ 问题 -1: 推送渠道列表只显示平台名称

**修复内容**:
- `JobListTable.vue` 中的 `formatDeliver()` 函数只返回平台中文名称，不显示 ID
- `JobDetailPage.vue` 中的 `formatDeliver()` 函数返回完整信息（平台名 + 账号 ID）
- 列表中：`wecom:wo3zARCQ` → `企业微信`
- 详情中：`wecom:wo3zARCQ` → `企业微信 · wo3zARCQ`

---

### ✅ 问题 0: 添加设置入口

**修复内容**:
- 在 `EnvclawLayout.vue` 顶栏右侧添加通知按钮和设置按钮
- 设置按钮点击后跳转到 `/hermes/settings` 页面
- 添加了 `topbar-icon-btn` 样式，支持 hover 效果
- 在 i18n 中添加 `envclaw.topbar.settings` 和 `envclaw.topbar.notifications`
- 设置页面添加返回按钮，可返回到 envclaw 页面

**修改文件**:
```
packages/client/src/views/envclaw/EnvclawLayout.vue
packages/client/src/views/hermes/SettingsView.vue
packages/client/src/i18n/locales/zh.ts
packages/client/src/i18n/locales/en.ts
```

---

### ✅ 问题 0.5: 推送渠道映射为中文

**问题描述**:
- 值守任务的推送渠道显示的是真实的代号（如 `wecom:wo3zARCQAAw6LhYEu94vUAijh5gUQWng`）
- 代号太长遮挡了其他列的内容

**修复内容**:
- 在 `JobListTable.vue` 和 `JobDetailPage.vue` 中添加 `formatDeliver()` 函数
- 将平台代号映射为中文（如 `wecom` → `企业微信`）
- 如果有账号 ID，显示为"平台名 · ID前8位"（如 `企业微信 · wo3zARCQ`）
- 添加 title 属性，悬停可查看完整代号
- 在 i18n 中添加 `envclaw.jobs.deliverChannels` 映射

**修改文件**:
```
packages/client/src/components/envclaw/jobs/JobListTable.vue
packages/client/src/views/envclaw/JobDetailPage.vue
packages/client/src/i18n/locales/zh.ts
packages/client/src/i18n/locales/en.ts
```

**显示效果**:
- `wecom:wo3zARCQAAw6LhYEu94vUAijh5gUQWng` → `企业微信 · wo3zARCQ`
- `dingtalk:abc123` → `钉钉 · abc123`
- `feishu` → `飞书`
- `origin` → `原路返回`

---

### ✅ 问题 1: 浅色模式支持

**修复内容**:
- 创建 `packages/client/src/styles/envclaw-theme.scss` - 统一的主题变量文件
- 所有 envclaw 组件从硬编码颜色改为 CSS 变量（`var(--envclaw-*)`）
- `EnvclawLayout.vue` 引入 `useTheme()`，根据 `isDark` 动态添加 `.light` class
- 主题变量支持暗色/浅色两套配色方案

**修改文件**:
```
packages/client/src/styles/envclaw-theme.scss (新建)
packages/client/src/views/envclaw/EnvclawLayout.vue
packages/client/src/components/envclaw/workstation/StatCards.vue
packages/client/src/components/envclaw/workstation/ScenarioGrid.vue
packages/client/src/components/envclaw/workstation/ActiveTasks.vue
packages/client/src/components/envclaw/workstation/PlatformBar.vue
packages/client/src/components/envclaw/workstation/OverviewBanner.vue
packages/client/src/components/envclaw/wizard/TaskWizard.vue
packages/client/src/components/envclaw/wizard/TemplateWizard.vue
packages/client/src/components/envclaw/wizard/FunctionSelector.vue
packages/client/src/components/envclaw/wizard/PromptPreview.vue
```

**验证方法**:
1. 运行 `npm run dev`
2. 访问 `/envclaw`
3. 在 Hermes 设置中切换浅色/暗色主题
4. 确认 envclaw 页面配色正确响应

---

### ✅ 问题 2: 向导面板挤压主页布局

**修复内容**:
- `TaskWizard.vue` 改为 `position: fixed`（原来是 flex 布局中的兄弟节点）
- 设置 `top: 52px`（顶栏高度）、`right: 0`、`bottom: 0`、`z-index: 100`
- `WorkstationHome.vue` 调整布局，`.main-area` 宽度固定为 100%，不再被挤压

**修改文件**:
```
packages/client/src/components/envclaw/wizard/TaskWizard.vue
packages/client/src/views/envclaw/WorkstationHome.vue
```

**效果**:
- 点击"数据播报"后，向导从右侧覆盖而非挤压
- 左侧主页面卡片保持宽度不变

---

### ✅ 问题 3: 两个侧边栏同时显示

**修复内容**:
- `App.vue` 中新增 `isEnvclawRoute` 判断（`route.path.startsWith('/envclaw')`）
- `showAppSidebar` 逻辑改为 `!usesPageSidebar.value && !isEnvclawRoute.value`
- 访问 `/envclaw` 时，Hermes 原有的 AppSidebar 被隐藏
- 只显示 EnvclawLayout 自己的左侧导航

**修改文件**:
```
packages/client/src/App.vue
```

**效果**:
- 访问 envclaw 页面时，左侧只显示一个侧边栏（工作台/值守任务/平台管理/技能库/运行历史）
- 不再出现"任务/看板/频道/技能/插件/MCP"的 Hermes 全局侧边栏

---

### ✅ 问题 4: 成功率假数据

**修复内容**:
- `StatCards.vue` 中将"今日成功率"卡片改为 `pending` 状态
- 移除硬编码的 `98%` 和 `+2%`
- 显示"待接入"徽章和"—"占位符
- 保留 TODO 注释说明后续需要接入真实 API

**修改文件**:
```
packages/client/src/components/envclaw/workstation/StatCards.vue
```

**效果**:
- "今日成功率"卡片置灰，右上角显示"待接入"徽章
- 数值显示"—"，说明文案显示"暂无数据"
- 用户不会误以为 98% 是真实数据

---

## 修改统计

| 类型 | 文件数 |
|------|-------|
| 新建文件 | 1（envclaw-theme.scss） |
| 修改文件 | 23 |
| 涉及组件 | 22 个 Vue 组件 + 1 个根组件（App.vue） |

### 修改的组件清单

**布局**:
- `App.vue` - 修复侧边栏逻辑
- `EnvclawLayout.vue` - 添加主题支持

**工作台首页**:
- `WorkstationHome.vue` - 调整布局
- `OverviewBanner.vue` - 主题支持
- `StatCards.vue` - 主题支持 + 标记成功率待接入
- `ScenarioGrid.vue` - 主题支持
- `ActiveTasks.vue` - 主题支持
- `PlatformBar.vue` - 主题支持

**值守任务**:
- `JobsPage.vue` - 主题支持
- `JobDetailPage.vue` - 主题支持
- `JobListTable.vue` - 主题支持
- `JobStatusPill.vue` - 主题支持

**平台管理**:
- `PlatformsPage.vue` - 主题支持
- `PlatformCard.vue` - 主题支持
- `PlatformConfigDrawer.vue` - 主题支持
- `AccountDrawer.vue` - 主题支持

**技能库**:
- `SkillsPage.vue` - 主题支持
- `SkillCategoryList.vue` - 主题支持
- `SkillDetailPanel.vue` - 主题支持

**运行历史**:
- `HistoryPage.vue` - 主题支持
- `RunRecordList.vue` - 主题支持
- `RunDetailPanel.vue` - 主题支持

**向导面板**:
- `TaskWizard.vue` - 主题支持 + fixed 定位
- `TemplateWizard.vue` - 主题支持
- `FunctionSelector.vue` - 主题支持
- `PromptPreview.vue` - 主题支持
- `SkillSelector.vue` - 主题支持
- `DeliverSelector.vue` - 主题支持
- `AiGuidePlaceholder.vue` - 主题支持

---

## 测试清单

### 必测项（修复验证）
- [ ] **主题切换**: 在 Hermes 设置中切换浅色/暗色，envclaw 页面正确响应
- [ ] **侧边栏**: 访问 `/envclaw`，左侧只有一个侧边栏（envclaw 自己的）
- [ ] **向导布局**: 点击"数据播报"，右侧向导覆盖而非挤压主页面
- [ ] **成功率卡片**: 显示"—"和"待接入"徽章，不是 98%
- [ ] **值守任务页**: `/envclaw/jobs` 主题颜色正确
- [ ] **任务详情页**: `/envclaw/jobs/:id` 主题颜色正确
- [ ] **平台管理页**: `/envclaw/platforms` 主题颜色正确
- [ ] **技能库页**: `/envclaw/skills` 主题颜色正确
- [ ] **运行历史页**: `/envclaw/history` 主题颜色正确

### 回归测试（确保没破坏现有功能）
- [ ] 访问 `/hermes/chat`，左侧 AppSidebar 正常显示
- [ ] 访问 `/hermes/jobs`，左侧 AppSidebar 正常显示
- [ ] 创建一个数据播报任务，任务列表正确显示
- [ ] 构建成功：`npm run build`

---

## 后续待办（非本次修复范围）

1. **接入真实成功率 API**（后端需提供 `/api/envclaw/stats/success-rate`）
2. **补齐国际化**（部分硬编码文案）
3. **添加测试**（至少 1 个 E2E 测试覆盖向导流程）
4. **可访问性标注**（aria-label）

---

## Git 提交建议

当前在 `dev` 分支，**未提交**。建议按以下顺序提交：

```bash
# 1. 提交主题系统
git add packages/client/src/styles/envclaw-theme.scss
git add packages/client/src/views/envclaw/
git add packages/client/src/components/envclaw/
git add packages/client/src/views/hermes/SettingsView.vue
git add packages/client/src/i18n/locales/zh.ts
git add packages/client/src/i18n/locales/en.ts
git commit -m "[envclaw] 支持浅色/暗色主题切换 + 功能优化

- 新增 envclaw-theme.scss 统一主题变量
- 所有 envclaw 组件从硬编码颜色改为 CSS 变量
- 覆盖所有页面：工作台/值守任务/平台管理/技能库/运行历史
- EnvclawLayout 引入 useTheme() 响应主题切换
- 添加顶栏设置入口，点击跳转到 Hermes 设置页面
- 设置页面添加返回按钮，可返回到 envclaw 页面
- 推送渠道代号映射为中文显示（列表只显示平台名，详情显示完整信息）
- 标记成功率为待接入状态

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"

# 2. 提交布局修复
git add packages/client/src/App.vue
git commit -m "[envclaw] 修复侧边栏重叠与向导挤压布局

- App.vue 排除 envclaw 路由，隐藏 Hermes AppSidebar
- TaskWizard 改为 fixed 定位，覆盖而非挤压主页面
- WorkstationHome 调整布局适配 fixed 向导

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## 审查报告

完整审查报告见：`docs/superpowers/reviews/2026-06-26-envclaw-phase1-review.md`
