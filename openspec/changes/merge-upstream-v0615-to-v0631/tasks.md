## 1. 后端 Bug 修复 — Session 生命周期

- [ ] 1.1 提取 `bde8f2b0` 的 `updateSession({ ended_at, end_reason })` 逻辑，合并到 `handle-bridge-run.ts`（保留我们的改动）
- [ ] 1.2 提取 `bde8f2b0` 的 session 结束状态写入逻辑，合并到 `handle-coding-agent-run.ts`
- [ ] 1.3 提取 `bde8f2b0` 的 abort 时 session 结束状态写入逻辑，合并到 `abort.ts`
- [ ] 1.4 提取 `a375b9dc` 的 `memoryExportStarted` 字段和 `startCodingAgentMemoryExport()` 方法，合并到 `coding-agent-run-manager.ts`
- [ ] 1.5 复制新增测试文件：`tests/server/handle-bridge-run-session-ended.test.ts`
- [ ] 1.6 复制新增文档：`docs/chat-chain-changes/2026-07-09-pr2004-bridge-session-ended.md`

## 2. 后端 Bug 修复 — Session 分页

- [ ] 2.1 提取 `30d40450` 的分页修复逻辑，合并到 `packages/server/src/controllers/hermes/sessions.ts`（保留我们的 profile 兜底和 source 过滤）
- [ ] 2.2 提取 `30d40450` 的 lineage 查询逻辑，合并到 `packages/server/src/db/hermes/sessions-db.ts`
- [ ] 2.3 提取 `30d40450` 的 sessions API 扩展，合并到 `packages/client/src/api/hermes/sessions.ts`
- [ ] 2.4 提取 `30d40450` 的路由变更，合并到 `packages/server/src/routes/hermes/sessions.ts`
- [ ] 2.5 复制新增测试文件：`tests/server/sessions-db-lineage.test.ts`、`tests/e2e/history-session-deeplink.spec.ts`
- [ ] 2.6 复制新增文档：`docs/chat-chain-changes/2026-07-17-pr2107-history-session-pagination.md`

## 3. Jobs 功能增强 — 模型选择

- [ ] 3.1 提取 `d81b0644` 的 `--model`/`--provider` 参数逻辑，合并到 `packages/server/src/controllers/hermes/jobs.ts` 的 create 和 update 函数
- [ ] 3.2 提取 `d81b0644` 的 `resolveDefaultProviderAndModel()` 逻辑，合并到 jobs controller 的 list 函数
- [ ] 3.3 在 `packages/client/src/api/hermes/jobs.ts` 的 `CreateJobRequest`/`UpdateJobRequest`/`JobFormValues` 中增加 `model`/`provider` 字段
- [ ] 3.4 在 `packages/client/src/views/hermes/CreateTask.vue` 中增加 Provider/Model 下拉选择（适配我们的 UI，不使用上游 JobFormModal）
- [ ] 3.5 在 `packages/client/src/views/hermes/EditTask.vue` 中增加 Provider/Model 显示和编辑
- [ ] 3.6 确认 `15be6f37` 的 delivery-targets 逻辑与我们 commit `34008288` 一致，如有差异则补充

## 4. Jobs 功能增强 — 排序

- [ ] 4.1 提取 `6143b2d5` 的排序逻辑，适配到 `packages/client/src/views/hermes/JobsView.vue`
- [ ] 4.2 提取 `6143b2d5` 的排序 UI 组件，适配到 `packages/client/src/components/hermes/jobs/JobsPanel.vue`

## 5. Chat 修复 — 会话切换和 Profile 持久化

- [ ] 5.1 提取 `64030437` 的闪烁修复代码，合并到 `packages/client/src/components/hermes/chat/ChatPanel.vue`
- [ ] 5.2 提取 `f0aa7ef6` 的 profile filter 持久化逻辑，合并到 `packages/client/src/stores/hermes/chat.ts`
- [ ] 5.3 提取 `f0aa7ef6` 的 profile filter UI 逻辑，合并到 `ChatPanel.vue`
- [ ] 5.4 提取 `f0aa7ef6` 的 ChatView.vue 和 GlobalAgentView.vue 改动
- [ ] 5.5 复制新增测试：`tests/client/chat-store-profile-filter.test.ts`

## 6. 首屏加载优化

- [ ] 6.1 复制上游 `packages/client/src/i18n/index.ts` 和 `packages/client/src/i18n/messages.ts`（i18n 懒加载逻辑，无冲突）
- [ ] 6.2 提取 `937d0d8d` 的 `defineAsyncComponent` 改动，适配到 `packages/client/src/App.vue`
- [ ] 6.3 提取 `937d0d8d` 的 main.ts 懒加载改动，适配到 `packages/client/src/main.ts`
- [ ] 6.4 复制新增文件 `packages/server/src/middleware/static-cache.ts`
- [ ] 6.5 提取 `937d0d8d` 的 static-cache 中间件注册，适配到 `packages/server/src/index.ts`
- [ ] 6.6 复制新增测试：`tests/client/i18n-lazy-loading.test.ts`、`tests/server/static-cache.test.ts`
- [ ] 6.7 复制新增文档：`docs/chat-chain-changes/2026-07-14-first-screen-bundle-splitting.md`

## 7. 草稿工作区保留

- [ ] 7.1 提取 `5be85483` 的 draft workspace 保留逻辑，合并到 `packages/client/src/stores/hermes/chat.ts`
- [ ] 7.2 复制新增文档：`docs/chat-chain-changes/2026-07-16-preserve-draft-workspace-on-model-switch.md`

## 8. MoA 预设模型选择

> 接入方式：**适配接入（主体不变）**。上游 ChatInput 仅 +2 行，主体是独立组件 `CombinationModelsPanel.vue` + ChatPanel 挂接（+184 加法型）。不改 ChatInput/ChatPanel 结构主体，只挂面板和选择状态。

- [ ] 8.1 提取 `3decc0e9` 的 MoA 相关逻辑，合并到 `packages/client/src/stores/hermes/models.ts`
- [ ] 8.2 提取 `3decc0e9` 的 MoA 后端逻辑，合并到 `packages/server/src/controllers/hermes/models.ts` 和 `model-context.ts`
- [ ] 8.3 提取 `3decc0e9` 的 MoA UI 逻辑，适配到 `ChatInput.vue` 和 `ChatPanel.vue`
- [ ] 8.4 复制新增组件：`packages/client/src/components/hermes/models/CombinationModelsPanel.vue`
- [ ] 8.5 复制新增文档：`docs/chat-chain-changes/2026-07-15-moa-session-model-selection.md`

## 9. 推理强度滑块

> 接入方式：**适配接入（主体不变）**。在 ChatInput 工具栏新增 slider 控件 + `reasoning_effort` 状态（纯新增块，约 +245 行），不动输入框主体（文本域/发送/语音/技能）。

- [ ] 9.1 提取 `e683cd36` 的 reasoning effort slider 组件和逻辑，适配到 `ChatInput.vue`
- [ ] 9.2 复制新增文档：`docs/chat-chain-changes/2026-07-16-reasoning-effort-slider.md`

## 10. 消息引用功能

> 接入方式：**适配接入（主体不变）**。均为加法型增量（ChatInput +77 / MessageItem +61 / MessageList +6 / GroupChatInput +75），新增"引用预览块 + 高亮逻辑"即可，不改主体结构。

- [ ] 10.1 提取 `d246455e` 的 `activeMessageReference` 状态管理，合并到 `chat.ts` store
- [ ] 10.2 提取 `d246455e` 的消息引用 UI，适配到 `ChatInput.vue`（引用预览、取消按钮）
- [ ] 10.3 提取 `d246455e` 的消息高亮逻辑，适配到 `MessageItem.vue`
- [ ] 10.4 提取 `d246455e` 的消息引用渲染，适配到 `MessageList.vue`
- [ ] 10.5 提取 `d246455e` 的群聊消息引用，适配到 `GroupChatInput.vue` 和 `GroupMessageItem.vue`
- [ ] 10.6 提取 `d246455e` 的 group-chat store 引用逻辑，合并到 `group-chat.ts`
- [ ] 10.7 复制新增后端：`packages/server/src/services/hermes/group-chat/mention-routing.ts`
- [ ] 10.8 复制新增测试：`tests/client/chat-message-reference.test.ts`、`tests/client/message-item-highlight.test.ts` 等
- [ ] 10.9 复制新增文档：`docs/chat-chain-changes/2026-07-16-single-chat-message-reference.md`

## 11. 生成文件预览（拆组件接入，避开 MessageItem 大重构）

> 接入方式：**只摘独立预览组件挂到现有 MessageItem**，不吃上游对 `MessageItem.vue`（−469）/`MarkdownRenderer.vue`（−128）的渲染层重构，也不引入 `ToolChangeCard` 拆分。文件预览依赖 workspace-diff 数据链，**必须先补 `#1919` 建表**，否则预览取不到数据。

### 11A. 前置依赖：workspace-diff 数据链（`#1919`）

- [ ] 11A.1 复制新增 DB：`packages/server/src/db/hermes/workspace-run-changes-store.ts`
- [ ] 11A.2 从 `schemas.ts` 只提取 workspace-run-changes 建表语句（**跳过 mcu-devices / workflow 相关表**）
- [ ] 11A.3 提取 `#1919` 的文件系统 workspace run diff 生成逻辑（后端 service），加法型插入，不动我们的会话主流程
- [ ] 11A.4 复制 `#1919` 相关新增测试

### 11B. 预览组件（挂到现有 MessageItem，不接受上游重构）

- [ ] 11B.1 复制独立预览组件：`DocxFilePreview.vue`、`HtmlFilePreview.vue`、`HtmlFileContextMenu.vue`、`PdfFilePreview.vue`、`PptxFilePreview.vue`、`SpreadsheetFilePreview.vue`、`WorkspaceDiffPreview.vue`、`xlsx-preview.worker.ts`
- [ ] 11B.2 复制工具函数：`file-preview.ts`、`ooxml-archive.ts`、`tabular-preview.ts`
- [ ] 11B.3 复制新增 API `binary-content.ts`；扩展 `packages/client/src/api/hermes/files.ts`（加法型）
- [ ] 11B.4 复制新增后端：`file-preview.ts` controller、`file-preview.ts` service、`file-provider.ts`（含路由注册，放在 proxy catch-all 之前）
- [ ] 11B.5 在**我们现有的 `MessageItem.vue`** 上手动接线：识别文件类型 → 渲染对应 `*Preview` 组件；**不合入上游 MessageItem −469 重构，不引入 ToolChangeCard**
- [ ] 11B.6 提取 `62166315` 的 FileList/FilesPanel 改动，适配到我们的组件（与定制冲突时仅补充入口/按钮，不覆盖）
- [ ] 11B.7 提取 `62166315` 的 sessions controller 文件预览相关后端改动（加法型插入）
- [ ] 11B.8 复制新增 store：`tool-panel.ts`

### 11C. 群聊工作区（可选，高风险，视需要延后）

- [ ] 11C.1 群聊工作区涉及 `GroupChatPanel.vue`（我们已重写 −362），如需支持则仅摘预览挂接，**不合入上游 GroupChatPanel +330**；否则本项延后

### 11D. 依赖与验证

- [ ] 11D.1 安装并锁版本：`docx-preview@^0.3.7`、`pdfjs-dist@^5.7.284`、`@aiden0z/pptx-renderer@^1.2.4`、`read-excel-file@^7.0.3`（**确认不误引入 `@vue-flow/*`，那是被排除的 Workflow v2 依赖**）
- [ ] 11D.2 复制新增测试文件
- [ ] 11D.3 验证：docx/pdf/pptx/xlsx/html 预览可正常渲染，且 workspace-diff 有数据（前置 `#1919` 生效）

## 12. Provider 编辑器

- [ ] 12.1 复制新增后端：`provider-editor.ts` service、`provider-audit-store.ts` db、`safe-file-store.ts`
- [ ] 12.2 复制新增前端：`ProviderEditorModal.vue`
- [ ] 12.3 提取 `ff8d78f6` 的 providers controller/routes 改动
- [ ] 12.4 提取 `ff8d78f6` 的 schemas.ts 改动（provider audit 表）
- [ ] 12.5 提取 `ff8d78f6` 的 model-context.ts 和 app-config.ts 改动
- [ ] 12.6 提取 `ff8d78f6` 的 user-auth.ts 改动
- [ ] 12.7 复制新增测试文件

## 13. 渠道凭证清除

- [ ] 13.1 提取 `062a5cb5` 的凭证清除 API，合并到 `packages/server/src/controllers/hermes/config.ts`
- [ ] 13.2 提取 `062a5cb5` 的路由变更，合并到 `packages/server/src/routes/hermes/config.ts`
- [ ] 13.3 提取 `062a5cb5` 的凭证清除 UI，适配到 `PlatformSettings.vue`
- [ ] 13.4 提取 `062a5cb5` 的 settings store 改动
- [ ] 13.5 提取 `062a5cb5` 的 config API 改动，合并到 `packages/client/src/api/hermes/config.ts`
- [ ] 13.6 复制新增测试：`tests/client/platform-settings-test.ts`、`tests/e2e/channels.spec.ts`

## 14. 后端 Bug 修复 — 绿灯（stock / 无关定制，可大胆合）

> 落点为原汁原味的后端 lib/API 或加法型 controller，与前端定制无关，冲突极低，可整段合入。

- [ ] 14.1 `#2036` 修复 Bridge 工具结果上下文上限 → `packages/server/src/lib/tool-result-context.ts`
- [ ] 14.2 `#1876` 约束 Hermes MCP 会话委托（安全）→ `packages/server/src/lib/llm-prompt.ts`
- [ ] 14.3 `#2051` 同步 Provider 静态目录与缓存优先级 → `controllers/hermes/models.ts` + `shared/providers.ts`
- [ ] 14.4 `#2058` Markdown 下载保留文件扩展名 → `packages/client/src/api/hermes/download.ts`
- [ ] 14.5 `#2026` 处理畸形会话导出文件名 → `packages/client/src/api/hermes/sessions.ts`
- [ ] 14.6 `#1706` 未知 coding agent provider 默认 chat completions → `packages/client/src/api/coding-agents.ts`
- [ ] 14.7 复制以上各 PR 的新增测试文件

## 15. 后端 Bug 修复 — 黄灯（基座+叠加，提取式插入）

> 落点在我们叠加过的加法型文件（`coding-agents.ts` +211 / sessions controller +118 / `chat.ts` +395 / router +29），按区域插入上游修复的那几行，不动我们叠加的逻辑。

- [ ] 15.1 `#1816` History 纳入本地 coding_agent 会话 → `controllers/hermes/sessions.ts`（**与第 2 节分页 `#2107` 同链，建议同批做**）
- [ ] 15.2 `#1838` History 保留本地归档状态 → sessions 相关
- [ ] 15.3 `#1725` coding agent 模型切换 → `api/hermes/sessions.ts` + `stores/hermes/chat.ts` + `controllers/hermes/sessions.ts` + `services/coding-agents.ts`
- [ ] 15.4 `#1944` 持久化会话 API 模式 → 同上 + `db/hermes/schemas.ts`（只加相关列）+ `session-store.ts`
- [ ] 15.5 `#1932` 规范化 codex app-server API 模式 → `services/coding-agents.ts`
- [ ] 15.6 `#1711` coding agent 自定义 provider key 环境变量 → `services/coding-agents.ts`
- [ ] 15.7 `#1983` scoped coding agent 继承外部 MCP → `services/coding-agents.ts`
- [ ] 15.8 `#2054` 保留 Studio bridge 中的自定义 Provider 状态 → 与 `custom-providers-compat.ts` 对齐后插入（我们的定制文件，仅补充不覆盖）
- [ ] 15.9 `#1853` 默认模型/Provider 动作 → `stores/hermes/models.ts` + i18n
- [ ] 15.10 `#1797` 修复 MCP admin 路由访问（安全）→ `packages/client/src/router/index.ts`（避开 envclaw 路由，仅插入）
- [ ] 15.11 `#1631` 将 coding agent prompt 移出 CLI 参数（安全：避免进程命令行泄露）→ `coding-agent-run-manager.ts`（现状为 PARTIAL，仅补全 file-based 分支）
- [ ] 15.12 `#1671` auth 过期时清除 active profile（现状 ABSENT）→ **触及我们 OAuth2 定制（`auth.ts` +215），需评估后再决定是否合**
- [ ] 15.13 复制以上各 PR 的新增测试文件

## 16. Bridge / Electron 主进程修复

> Bridge 修复落在加法型后端；electron 主进程文件相对 v0.6.15 **零改动**，上游补丁可干净合入。

- [ ] 16.1 `#1796` 修复 bridge session workspace cwd → bridge 相关 service
- [ ] 16.2 `#1890` 修复 bridge terminal 错误检测 → `services/hermes/run-chat/handle-bridge-run.ts`（加法型插入）
- [ ] 16.3 `#1910` 修复 execute_code guard bridge 兼容性（我们有 execute-code 审批记忆，强相关）
- [ ] 16.4 `#1949` 修复 webui-server stdout/stderr EPIPE 崩溃 → `packages/desktop/src/main/webui-server.ts`（零改动文件，干净合）
- [ ] 16.5 `#1968` 内置 Web UI 启动回退 → `packages/desktop/src/main/paths.ts` + `webui-server.ts`
- [ ] 16.6 `#2101` 修复 macOS 托盘图标尺寸 → `packages/desktop/src/main/index.ts` + 托盘 png 资源
- [ ] 16.7 复制以上各 PR 的新增测试文件

> **说明**：`#1963`（claude code api mode 提示）落在 `ChatPanel.vue`（前端定制主体），按 D7 原则不整合，如需要则手动补充，不纳入本批。

## 17. i18n 统一处理

- [ ] 17.1 从上游 v0.6.31 提取所有新增 i18n key，合并到 10 个 locale 文件（de/en/es/fr/ja/ko/pt/ru/zh-TW/zh），保留我们的自定义 key
- [ ] 17.2 验证所有新增 key 在所有语言文件中都有对应条目

## 18. 验证

- [ ] 18.1 运行 `npm run build` 确认编译通过
- [ ] 18.2 运行 `npm run test` 确认核心测试通过
- [ ] 18.3 运行 `npm run harness:check` 确认文档/脚本检查通过
- [ ] 18.4 运行 `npm run openapi:generate` 重新生成 openapi.json
- [ ] 18.5 手动验证：任务创建（含模型选择）、推送频道选择、会话切换、文件预览
- [ ] 18.6 手动验证 bug 修复：coding agent 模型切换、History 显示本地会话、桌面版 webui 长输出不崩溃（EPIPE）、Provider 目录同步
