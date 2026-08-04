# Hermes Web UI 原型改造整体规划

> **版本**: v1.0 (2026-08-04)
> **来源**: `docs/prototypes/` 12 个 HTML 设计原型分析
> **配套**: `PAGE-DESIGN.md` · `PRODUCT-FUNCTION-DESIGN.md` · `PAGE-GUIDE.md` · `PRODUCT-ROADMAP.md`
> **读者**: 前端开发 / 后端对接 / 产品评审

---

## 1. 规划目标

按 `docs/prototypes/` 下 12 个 HTML 设计原型，将现有 Hermes Web UI 重构为 UniEcoClaw 品牌值守平台前端。核心策略：

- **完全替换**现有 ChatPanel.vue，按 Workbuddy 风格融合式大提示词布局重构
- **保留**已有 Socket.IO 通信层、会话 API、模型/Profile store
- **分 3 期**对齐产品路线图三个里程碑：桌面 MVP → 多用户 Web → 多平台扩展
- 不列入：对话→任务闭环演示页 (`chat-create-task.html`)、模板分享/导入页 (`template-share.html`)

---

## 2. 阶段划分

### Phase 1：单机桌面版 MVP — 值守闭环核心

**目标**：支撑「登录 → 对话创建 → 自动化管理 → 任务详情」完整链路。

| # | 原型文件 | 对应现有代码 | 改造策略 |
|---|----------|-------------|----------|
| 1 | `login.html` | `views/LoginView.vue` | 视觉对齐原型，保留已有 OAuth 逻辑 |
| 2 | `duty-chat.html` | `views/hermes/ChatView.vue` + `components/hermes/chat/ChatPanel.vue` | **完全重写**，按 6 组件拆分（见第 4 节） |
| 3 | `duty-tasks.html` | `views/hermes/JobsPage.vue` | 重构为双 Tab（定时任务卡片网格 + 三层运行记录） |
| 4 | `duty-task-detail.html` | `views/hermes/JobDetailPage.vue` | 重构为配置/日志/成果 3 Tab |
| 5 | `duty-create.html` | `views/hermes/CreateTask.vue` (137KB) | 重写为融合式大提示词 6 段布局，替代 3 步向导 |
| 6 | `duty-picker.html` | 无对应 | **新建**路由页：模板/技能/连接器 3 Tab Picker |
| — | 固定侧栏 | `components/layout/AppSidebar.vue` | 按原型 5 段重排 |

**不在此阶段**：模板库、技能/连接器管理、平台接入向导 —— 原型交互完整但后端依赖重。

### Phase 2：多用户 Web 版 — 模板 & 资产管理

| # | 原型文件 | 说明 |
|---|----------|------|
| 1 | `templates-library.html` | 4 分组卡片网格（全部/系统/我的/外部导入），从任务/创建另存回流 |
| 2 | `template-editor.html` | 4 段表单，支持 clone/edit/from-create 三种 URL 预填入口 |
| 3 | `duty-capabilities.html` 技能 Tab + 连接器 Tab | 技能导入/启用/删除 + 连接器 stdio/HTTP 管理（后端已就绪） |
| 4 | 权限等级落地 | Create 页 + 对话页底栏权限切换（完全访问/仅读/只读查询） |

### Phase 3：多平台扩展 — 生态接入

| # | 原型文件 | 说明 |
|---|----------|------|
| 1 | `duty-capabilities.html` 平台 Tab | 4 列平台方形卡片网格，内置底座保护 |
| 2 | `platform-onboarding.html` | 4 步接入向导（平台信息→认证→能力映射→测试确认） |
| 3 | `duty-capabilities.html` 技能详情抽屉 | 6 段面板，需配置/直接用两种形态 |
| 4 | 运行记录专项对话 | L3 执行详情 → 跳对话页注入运行上下文 |

---

## 3. 路由设计

### 3.1 新路由表（Hash 模式，在现有 router 基础上改造）

```
/hermes/chat                          ← 对话主页（重构）
/hermes/chat?demo                     ← 对话演示模式（可选，Phase 2+）
/hermes/duty                          ← 自动化主控（= duty-tasks）
/hermes/duty/:id                      ← 任务详情（= duty-task-detail）
/hermes/duty/create                   ← 创建值守任务（= duty-create）
/hermes/duty/picker                   ← Picker 选择器（= duty-picker）
/hermes/templates                     ← 模板库（Phase 2）
/hermes/templates/:id/edit            ← 模板编辑器（Phase 2）
/hermes/capabilities                  ← 平台·技能·连接器（Phase 2/3）
/hermes/capabilities/onboarding       ← 平台接入向导（Phase 3）
```

### 3.2 跨页参数协议（严格按原型 PAGE-DESIGN 第 5 节）

```
duty-create?edit=<jobId>
duty-create?from=<tplId>
duty-create?from=picker&caps=id1,id2&cap_names=名1|名2
duty-create?from=picker&skills=sk_01&skill_names=日报技能
duty-create?from=picker&mcps=mcp_fs&mcp_names=本地文件
duty-create?from=chat&prompt=<encoded>
template-editor?from=create&name=<encoded>&caps=<ids>&...
template-editor?clone=<tplId>
template-editor?edit=<tplId>
duty-picker#tab=tmpl|skills|mcps
duty-capabilities#tab=platforms|skills|mcps[&pick=<id>]
```

### 3.3 侧栏 active 规则

| 页面范围 | Active 项 |
|----------|----------|
| 对话入口（/hermes/chat） | 4 项都不亮，主按钮「新建任务」是焦点 |
| 自动化 3 页（duty + duty/:id + duty/create + duty/picker） | 「自动化」active |
| 模板库 2 页（templates + templates/:id/edit） | 「任务模板库」active（Phase 2） |
| 平台·技能·连接器（capabilities） | 「平台·技能·连接器」active（Phase 2/3） |

---

## 4. `/hermes/chat` 组件拆分

### 4.1 组件树

```
views/hermes/ChatView.vue               ← 路由入口（保留，去 ChatPanel，换 ChatShell）
  └─ components/hermes/chat/
       ├─ ChatShell.vue                 ← NEW 布局壳
       │    ├─ ChatSessionList.vue      ← 保留，视觉对齐「最近对话」
       │    └─ (内容区)
       │         ├─ ChatHero.vue                ← NEW 空态 Hero
       │         ├─ ChatMessageFlow.vue         ← 重构自 MessageList
       │         ├─ ChatComposer.vue            ← NEW 大输入框组合块
       │         │    ├─ CapabilityChips.vue    ← NEW 能力 chip 行
       │         │    ├─ ModelSelector.vue      ← 保留，移至底栏
       │         │    ├─ SlashCommandMenu.vue   ← NEW / 指令浮层
       │         │    └─ ChatInput.vue          ← 重构：纯输入框
       │         └─ TaskDraftCard.vue           ← NEW 值守草稿卡
       └─ MarkdownRenderer.vue         ← 保留不变
```

### 4.2 组件职责规格

#### ChatShell.vue
- **职责**：左右分栏布局壳；根据消息列表是否为空切换空态 Hero / 消息流；始终保持 Composer 在底部
- **Props**: 无（从 store 读取）
- **State**: `hasMessages` (computed from chat store)
- **预估行数**: ~80

#### ChatHero.vue
- **职责**：空态展示。主标题「UniEcoClaw，我帮你」+ 副标题「直接提问，或选一个能力开始——也可以让我把它变成定时运行的值守任务」+ 场景 Tab（查数据/建值守）+ 示例 prompt 一键填充按钮
- **Props**: 无
- **Emits**: `select-scene(scene: 'query' | 'duty')` / `fill-prompt(text: string)`
- **预估行数**: ~100

#### ChatMessageFlow.vue
- **职责**：虚拟滚动消息列表。渲染用户气泡 + AI 气泡 + 工具调用内嵌卡片 + 数据结果卡 + 草稿卡（TaskDraftCard 嵌入）；支持流式追加
- **Props**: `messages: Message[]`
- **Emits**: `create-duty(params: DraftParams)` / `confirm-duty(params: DraftParams)`
- **预估行数**: ~250

#### ChatComposer.vue
- **职责**：组合 Chip 行 + 输入框 + 底栏工具行的布局容器。管理发送、模型切换、斜杠指令、语音/附件按钮的协调
- **Props**: 无（从 store 读取）
- **预估行数**: ~200

#### CapabilityChips.vue
- **职责**：水平可滚动胶囊按钮行。根据场景 Tab 动态切换 chip 池。查数据场景：一张图/浓度排名/小时播报/监测数据/创建值守任务。建值守场景：创建值守任务/定时浓度排名/定时一张图/定时小时播报/定时监测数据。「创建值守任务」用橙色边框区分
- **Props**: `scene: 'query' | 'duty'`
- **Emits**: `select(cmd: string, prompt: string)`
- **预估行数**: ~120

#### SlashCommandMenu.vue
- **职责**：输入框键入 `/` 时在输入框左上弹出。5 项能力指令列表。方向键 ↑↓ 选择，Enter 确认，Esc 关闭
- **Props**: `visible: boolean`
- **Emits**: `select(cmd: string)` / `close()`
- **预估行数**: ~80

#### TaskDraftCard.vue
- **职责**：AI 识别值守意图后展示结构化参数卡片。任务名/能力/调度/推送四字段，「创建为值守任务」（跳 create 预填）和「直接确认（跳过向导）」两个出口
- **Props**: `params: DraftParams`
- **Emits**: `create(params)` / `confirm(params)`
- **预估行数**: ~150

#### ChatInput.vue
- **职责**：纯多行 textarea。焦点外发光 + 主色描边。Enter 发送，Shift+Enter 换行。键入 `/` 触发斜杠菜单。不包含底栏逻辑
- **Props**: `modelValue: string` / `disabled?: boolean`
- **Emits**: `update:modelValue` / `send()` / `slash()`
- **预估行数**: ~100

### 4.3 Store 拆分

| Store | 职责 | 改动 |
|-------|------|------|
| `stores/hermes/chat.ts` | **削减**：仅消息流、会话列表、发送/接收核心、Socket.IO 管理 | 移除 ChatPanel 特有的 UI 状态 |
| `stores/envclaw/duty.ts` | **新建**：场景 Tab、能力 chip 池、模型选择偏好、草稿卡参数、picker 预填数据 | 从原型 JS 逻辑迁移 |
| `stores/hermes/models.ts` | 保留不变 | — |
| `stores/hermes/profiles.ts` | 保留不变 | — |

### 4.4 不动的部分

- `api/hermes/chat.ts` — Socket.IO 通信层
- `api/hermes/sessions.ts` — 会话 REST API
- 服务端 `/api/hermes/sessions`、Socket.IO `/chat-run` namespace
- `MarkdownRenderer.vue`
- `ModelSelector.vue`（仅位置从输入框右上移至底栏）

---

## 5. Phase 1 全页面组件清单

### 5.1 页面级组件

| 路由 | View 文件 | 策略 | 预估行数 |
|------|----------|------|----------|
| `/login` | `views/LoginView.vue` | 重构：原型视觉对齐 | ~200 |
| `/hermes/chat` | `views/hermes/ChatView.vue` | 保留入口，内容换 ChatShell | ~50 |
| `/hermes/duty` | `views/hermes/JobsPage.vue` | 重构：双 Tab + 卡片网格 | ~300 |
| `/hermes/duty/:id` | `views/hermes/JobDetailPage.vue` | 重构：3 Tab 详情 | ~250 |
| `/hermes/duty/create` | `views/hermes/CreateTask.vue` | 重写：融合式 6 段 | ~400 |
| `/hermes/duty/picker` | `views/hermes/PickerPage.vue` | **新建** | ~200 |

### 5.2 功能组件（`components/hermes/guard/`）

| 组件 | 职责 | 行数 |
|------|------|------|
| `JobCardGrid.vue` | 定时任务卡片网格 + 筛选条 | ~150 |
| `JobCard.vue` | 单任务卡：4 按钮横排 + div 点击跳详情（禁止 a 嵌套 a） | ~100 |
| `RunLogTree.vue` | 三层渐进式运行记录 L1→L2→L3 | ~200 |
| `RunLogItem.vue` | L2/L3 单条展开项 | ~80 |
| `FusedPromptEditor.vue` | Create 页大提示词框块（textarea + 框底工具行 + chips） | ~250 |
| `ConnectorCheckCards.vue` | 连接器多选复选卡片网格（2 列） | ~120 |
| `PushChannelSelect.vue` | 推送渠道多选（企业微信/钉钉/飞书/邮件/本地） | ~80 |
| `TaskSaveTemplate.vue` | 保存为模板展开表单 | ~100 |
| `PickerTabs.vue` | Picker 页 3 Tab 内容区（模板/技能/连接器） | ~250 |

### 5.3 布局组件

| 组件 | 改动 |
|------|------|
| `AppSidebar.vue` | 重构为原型 5 段：品牌区 → 主按钮 → 4 导航 → 最近对话 → 用户区 |

---

## 6. API 依赖矩阵

| 前端功能 | 已有服务端路由 | Phase 1 状态 |
|----------|---------------|-------------|
| 对话发送/流式 | `Socket.IO /chat-run` + `POST /api/chat-run/runs` | 就绪，直接复用 |
| 会话 CRUD | `GET/POST/DELETE /api/hermes/sessions` | 就绪 |
| 任务 CRUD | `GET/POST/PUT/DELETE /api/hermes/jobs` | 就绪 |
| 任务暂停/恢复/立即运行 | `POST /api/hermes/jobs/:id/run` 等 | 就绪 |
| 运行记录 L1/L2 | `GET /api/hermes/jobs/:id/runs` | 就绪 |
| 运行记录 L3 日志 | `GET /api/hermes/jobs/:id/runs/:rid/logs` | 需补 |
| 模型列表 | `GET /api/hermes/models` | 就绪 |
| 技能列表 | `GET /api/hermes/skills` | 就绪（Phase 2 UI） |
| 连接器列表 | `GET /api/hermes/mcp` | 就绪（Phase 2 UI） |
| 平台/能力列表 | `GET /api/envclaw/platforms` | 就绪（Phase 3 UI） |
| 推送渠道配置 | 待建路由 | Phase 1 前端 mock localStorage |
| 权限等级切换 | 待建 | Phase 1 前端 mock |
| 模板 CRUD | 待建 `templates` 表 + 路由 | Phase 2 |

---

## 7. 兼容与规范约束

| 维度 | 约束 |
|------|------|
| 浏览器 | Chrome 90+ / Edge 90+ / Firefox 90+（桌面 Electron 内嵌 Chromium） |
| 最小分辨率 | 1280×720；推荐 1920×1080；侧栏固定 240px |
| CSS 变量 | 统一引用 `duty-proto.css` 变量体系；`--accent-primary: #1886e7` 替换当前 `#333` |
| 图标 | 内联 SVG `viewBox="0 0 24 24"` stroke 风格；禁止 emoji；分组来源用单字母圆角方块（T/M/I） |
| 路由 | Hash 模式不变；跨页参数协议严格按第 3.2 节 |
| i18n | 新文案走 `i18n/locales/`，不硬编码中文 |
| 品牌文案 | 可见文本统一「UniEcoClaw」；「Skill」→「技能」；「MCP」→「连接器」 |
| 代码规范 | 路由 Controller 只做参数校验+调用 Service；Service 放业务逻辑；禁止 shell 字符串拼接 |
| 禁止项 | a 嵌套 a（卡片用 div + click 跳转）；能力详情抽屉用半透明/深色背景；模板库顶部 3 统计卡 |

---

## 8. 状态机与关键交互

### 8.1 对话页状态机

```
ChatShell
├─ [空态] ChatHero 可见，ChatMessageFlow 隐藏
│    ├─ 场景 Tab 切换 → CapabilityChips 刷新 chip 池
│    ├─ 点示例 prompt → 填入 ChatInput + 聚焦
│    └─ 点 chip → 填入 ChatInput + 聚焦
│
├─ [有消息] ChatHero 隐藏，ChatMessageFlow 可见
│    ├─ AI 返回消息 → 流式追加气泡
│    ├─ 工具调用 → 内嵌工具调用卡片
│    └─ 含值守关键词 → 消息流末尾插入 TaskDraftCard
│
└─ [始终] ChatComposer 固定在底部
     ├─ 输入 `/` → SlashCommandMenu 弹出
     ├─ 模型选择 → ModelSelector 向上展开
     └─ Enter → send → Socket.IO → 切换到 [有消息]
```

### 8.2 对话转值守闭环

```
用户输入含「值守/每天/定时」→ AI 流式返回 + intent=duty
→ chat store 插入 DraftCard
→ 用户点「创建为值守任务」
  → duty store.setDraftParams(params)
  → router.push(/hermes/duty/create?from=chat&prompt=<encoded>)
或 用户点「直接确认」
  → duty store.createJobFromDraft()
  → Toast「已创建并调度」
```

### 8.3 定时任务卡片交互约束

- 卡片外层用 `<div>`，禁止用 `<a>` 包裹（会导致内层按钮被浏览器剥离）
- 卡片空白区 click → `router.push(/hermes/duty/:id)`
- 底部 4 按钮 click → `stopPropagation()` + 各自 action

### 8.4 运行记录三层展开

- 默认全折叠，首屏不堆内容
- L1（任务层）→ 点击行头展开 L2（时间点列表）
- L2 → 点击展开 L3（执行详情内嵌，不另开抽屉）
- L3 含：任务摘要 + 文件面包屑 + 日志代码块
- 筛选不含「任务模板」（与模板无直接关系）

---

## 9. URL 参数预填协议（Create 页入口映射）

```
入口来源                    → Create 页 URL
────────────────────────────────────────────────────
对话草稿卡                  → ?from=chat&prompt=<encoded>
Picker 技能·需配置          → ?from=picker&caps=id1,id2&cap_names=URLEncode(名1|名2)
Picker 技能·直接用          → ?from=picker&skills=sk_01&skill_names=URLEncode(...)
Picker 连接器               → ?from=picker&mcps=mcp_fs&mcp_names=URLEncode(...)
Picker 模板                 → ?from=<tplId>
任务详情「编辑」             → ?edit=<jobId>
任务详情「另存为模板」       → template-editor?from=detail&id=<jobId>（Phase 2）
Create「保存为模板」         → template-editor?from=create&name=...（Phase 2）
```

---

## 10. 实施顺序（Phase 1 内部优先级）

1. **CSS 变量体系切换** — `--accent-primary: #1886e7` 全局替换，引入 `duty-proto.css` 基础变量
2. **固定侧栏重构** — `AppSidebar.vue` 按 5 段重排，所有页面共用
3. **对话页组件拆分** — ChatShell → ChatHero → ChatComposer → ChatMessageFlow → CapabilityChips → TaskDraftCard，逐组件替换
4. **store 拆分** — 新建 `duty.ts`，削减 `chat.ts`
5. **Create 页重写** — 融合式大提示词 6 段布局替换 3 步向导
6. **Picker 页新建** — 3 Tab 选择器 + URL 参数预填
7. **自动化主控重构** — 双 Tab + 卡片网格 + 三层运行记录
8. **任务详情重构** — 配置/日志/成果 3 Tab
9. **登录页视觉对齐** — 原型样式，保留 OAuth

---

## 11. 风险与缓解

| 风险 | 缓解 |
|------|------|
| ChatPanel 104KB 拆分时破坏 Socket.IO 通信 | 通信层在 chat store / api 层不动，仅拆视图 |
| AppSidebar 全页面共用，改动影响面大 | 先在新分支改造，所有页面回归验证 |
| CreateTask.vue 137KB 重写时遗漏功能点 | 以原型功能点清单为 checklist 逐项覆盖 |
| Phase 1 后端接口有缺口（推送/权限/L3日志） | 前端 mock + localStorage，接口就绪后无痛切换 |
| CSS 变量全局替换产生视觉回归 | 增量替换，旧变量保留 fallback |
