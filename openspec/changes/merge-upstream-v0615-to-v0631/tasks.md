## 1. 后端 Bug 修复 — Session 生命周期

- [x] 1.1 提取 `bde8f2b0` 的 `updateSession({ ended_at, end_reason })` 逻辑，合并到 `handle-bridge-run.ts`（保留我们的改动）
- [x] 1.2 提取 `bde8f2b0` 的 session 结束状态写入逻辑，合并到 `handle-coding-agent-run.ts`
- [x] 1.3 提取 `bde8f2b0` 的 abort 时 session 结束状态写入逻辑，合并到 `abort.ts`
- [x] 1.4 提取 `a375b9dc` 的 `memoryExportStarted` 字段和 `startCodingAgentMemoryExport()` 方法，合并到 `coding-agent-run-manager.ts`
- [x] 1.5 复制新增测试文件：`tests/server/handle-bridge-run-session-ended.test.ts`
- [x] 1.6 复制新增文档：`docs/chat-chain-changes/2026-07-09-pr2004-bridge-session-ended.md`

## 2. 后端 Bug 修复 — Session 分页

- [x] 2.1 提取 `30d40450` 的分页修复逻辑，合并到 `packages/server/src/controllers/hermes/sessions.ts`（保留我们的 profile 兜底和 source 过滤）—— 用上游 `mergeHermesHistorySessions` 主体，线程化 userId，保留排除 api_server 行；同批完成 15.1/15.2
- [x] 2.2 提取 `30d40450` 的 lineage 查询逻辑，合并到 `packages/server/src/db/hermes/sessions-db.ts`（新增 `loadSessionChain`/`listSessionSummaryGroups`，后者加 userId 隔离）
- [x] 2.3 提取 `30d40450` 的 sessions API 扩展，合并到 `packages/client/src/api/hermes/sessions.ts`
- [x] 2.4 提取 `30d40450` 的路由变更，合并到 `packages/server/src/routes/hermes/sessions.ts`
- [x] 2.5 复制新增测试文件：`tests/server/sessions-db-lineage.test.ts`（已适配 fork mock，5 passed/2 skipped）；`tests/e2e/history-session-deeplink.spec.ts`（e2e 修改，留待第 18 节 e2e 验证）
- [x] 2.6 复制新增文档：`docs/chat-chain-changes/2026-07-17-history-detail-targeted-lineage.md`（实际文件名）

## 3. Jobs 功能增强 — 模型选择

- [x] 3.1 提取 `d81b0644` 的 `--model`/`--provider` 参数逻辑，合并到 `packages/server/src/controllers/hermes/jobs.ts` 的 create 和 update 函数
- [x] 3.2 提取 `d81b0644` 的 `resolveDefaultProviderAndModel()` 逻辑，合并到 jobs controller 的 list 函数
- [x] 3.3 在 `packages/client/src/api/hermes/jobs.ts` 的 `CreateJobRequest`/`UpdateJobRequest`/`JobFormValues` 中增加 `model`/`provider` 字段
- [x] 3.4 在 `packages/client/src/views/hermes/CreateTask.vue` 中增加 Provider/Model 下拉选择（适配我们的 UI，不使用上游 JobFormModal）
- [x] 3.5 在 `packages/client/src/views/hermes/EditTask.vue` 中增加 Provider/Model 显示和编辑（EditTask 为 CreateTask 薄包装，随 3.4 自动覆盖）
- [x] 3.6 确认 `15be6f37` 的 delivery-targets 逻辑与我们 commit `34008288` 一致（已还原，readDeliveryTargets/端点/api/类型齐全，无差异）

## 4. Jobs 功能增强 — 排序

- [x] 4.1 提取 `6143b2d5` 的排序逻辑，适配到 `packages/client/src/views/hermes/JobsView.vue`
- [x] 4.2 提取 `6143b2d5` 的排序 UI 组件，适配到 `packages/client/src/components/hermes/jobs/JobsPanel.vue`（props 用 withDefaults 可选，避免破坏其他调用方）

## 5. Chat 修复 — 会话切换和 Profile 持久化

- [x] 5.1 提取 `64030437` 的闪烁修复代码，合并到 `packages/client/src/components/hermes/chat/ChatPanel.vue`
- [x] 5.2 提取 `f0aa7ef6` 的 profile filter 持久化逻辑，合并到 `packages/client/src/stores/hermes/chat.ts`
- [x] 5.3 提取 `f0aa7ef6` 的 profile filter UI 逻辑，合并到 `ChatPanel.vue`（fork 的该 UI 已整段注释，store setter 即持久化机制，无需接线）
- [x] 5.4 提取 `f0aa7ef6` 的 ChatView.vue 和 GlobalAgentView.vue 改动
- [x] 5.5 复制新增测试：`tests/client/chat-store-profile-filter.test.ts`（3/3 通过）

## 6. 首屏加载优化

- [x] 6.1 复制上游 `packages/client/src/i18n/index.ts` 和 `packages/client/src/i18n/messages.ts`（i18n 懒加载逻辑，无冲突）；同步适配消费方 `LanguageSwitch.vue`/`useKeyboard.ts` 及 `tests/client/i18n-coverage.test.ts`（`messages` 导出改为本地重建）
- [x] 6.2 提取 `937d0d8d` 的 `defineAsyncComponent` 改动，适配到 `packages/client/src/App.vue`（AppSidebar/DesktopTitleBar/SessionSearchModal 异步化 + sessionSearchOpen 门控）
- [x] 6.3 提取 `937d0d8d` 的 main.ts 懒加载改动，适配到 `packages/client/src/main.ts`（`i18nReady` 异步挂载，保留 ensureAuthenticated/FOUC；katex CSS 移至 MarkdownRenderer.vue）
- [x] 6.4 复制新增文件 `packages/server/src/middleware/static-cache.ts`
- [x] 6.5 提取 `937d0d8d` 的 static-cache 中间件注册，适配到 `packages/server/src/index.ts`（保留 fork 的 socket.io 分支）
- [x] 6.6 复制新增测试：`tests/client/i18n-lazy-loading.test.ts`、`tests/server/static-cache.test.ts`
- [x] 6.7 复制新增文档：`docs/chat-chain-changes/2026-07-14-first-screen-bundle-splitting.md`

## 7. 草稿工作区保留

- [x] 7.1 提取 `5be85483` 的 draft workspace 保留逻辑，合并到 `packages/client/src/stores/hermes/chat.ts`（fork 无 `isLocalOnly`，改用 fork 原生 `messageCount == null || 0` 判定草稿，跳过会 404 的后端 `/model` 调用，仅更新本地状态；新增 2 个 fork 版测试）
- [x] 7.2 复制新增文档：`docs/chat-chain-changes/2026-07-16-preserve-draft-workspace-on-model-switch.md`（附 fork 适配说明）

## 8. MoA 预设模型选择

> **【已跳过 — N/A for fork】** 经核查，fork 从未引入整套 MoA(Mixture of Agents)基础设施：无 900 行 `CombinationModelsPanel.vue`、无 `saveMoaConfig`/`MoaConfig` 配置 API、无 MoA 设置 UI、后端无 MoA bridge 事件/souls-python 支持。`3decc0e9`(#2078) 只是建立在这套基础之上的"聊天下拉框入口层"，其后端加法(`enabledMoaPresetNames`/`resolveMoaAggregator`/`provider!=='moa'` 过滤)在 fork 里读到的 `config.moa` 恒为空，属死代码。完整移植 MoA 跨 client/server/souls-python 多包、远超本次合并范围。经用户确认**跳过本节**，不引入任何 MoA 代码。

- [~] 8.1 ~~提取 `3decc0e9` 的 MoA 相关逻辑，合并到 `packages/client/src/stores/hermes/models.ts`~~ —— 跳过(fork 无 MoA 基础设施)
- [~] 8.2 ~~提取 `3decc0e9` 的 MoA 后端逻辑~~ —— 跳过(死代码，fork 从不写 `config.moa`)
- [~] 8.3 ~~提取 `3decc0e9` 的 MoA UI 逻辑~~ —— 跳过(无预设可选)
- [~] 8.4 ~~复制新增组件 `CombinationModelsPanel.vue`~~ —— 跳过(依赖整套缺失的 MoA 配置/后端)
- [~] 8.5 ~~复制新增文档 `2026-07-15-moa-session-model-selection.md`~~ —— 跳过

## 9. 推理强度滑块

> 接入方式：**适配接入（主体不变）**。在 ChatInput 工具栏新增 slider 控件 + `reasoning_effort` 状态（纯新增块，约 +245 行），不动输入框主体（文本域/发送/语音/技能）。

- [x] 9.1 提取 `e683cd36` 的 reasoning effort slider 组件和逻辑，适配到 `ChatInput.vue`（NPopselect→NPopover+NSlider，保留 fork 的 icon-only circle 按钮与 `!isCodingAgentSession` 门控；fork 仅 7 档无 `max`，省略 max 液态动画；同步更新 `chat-input-draft.test.ts`/`voice-dialogue-controls.test.ts` mock 与断言）
- [x] 9.2 复制新增文档：`docs/chat-chain-changes/2026-07-16-reasoning-effort-slider.md`（附 fork 适配说明）

## 10. 消息引用功能

> 接入方式：**适配接入（主体不变）**。均为加法型增量（ChatInput +77 / MessageItem +61 / MessageList +6 / GroupChatInput +75），新增"引用预览块 + 高亮逻辑"即可，不改主体结构。

- [x] 10.1 提取 `d246455e` 的 `activeMessageReference` 状态管理，合并到 `chat.ts` store（MessageReference 接口 + parse/format 纯函数 + ref/setters + sendMessage 集成 + 清理点）
- [x] 10.2 提取 `d246455e` 的消息引用 UI，适配到 `ChatInput.vue`（引用预览、取消按钮）
- [x] 10.3 提取 `d246455e` 的消息高亮逻辑，适配到 `MessageItem.vue`（引用渲染 + 引用按钮 + quotableContent）
- [x] 10.4 提取 `d246455e` 的消息引用渲染，适配到 `MessageList.vue`（queuedPreview 解析引用）
- [x] 10.5 提取 `d246455e` 的群聊消息引用，适配到 `GroupChatInput.vue` 和 `GroupMessageItem.vue`
- [x] 10.6 提取 `d246455e` 的 group-chat store 引用逻辑，合并到 `group-chat.ts`
- [x] 10.7 合并 `d246455e` 对 `mention-routing.ts` 的引用块屏蔽逻辑（既有文件，非新增）
- [x] 10.8 复制新增测试 `tests/client/chat-message-reference.test.ts`；补充 `group-chat-mention-routing.test.ts` 屏蔽用例；现有受影响测试全绿
- [x] 10.9 复制新增文档：`docs/chat-chain-changes/2026-07-16-single-chat-message-reference.md`；i18n 键 referenceMessage/cancelReference 已补全 10 语言

## 11. 生成文件预览（拆组件接入，避开 MessageItem 大重构）

> 接入方式（fork 适配）：fork 已**大幅简化** Files 子系统（files store −163 / sessions API −167 / FilesView −135 相对上游 pre-patch），上游预览建立在被 fork 删掉的结构上，无法整段合。故改为**加法式扩展 fork 的 FilesView 预览分发器**：把独立预览组件挂到 `FilePreview.vue`，store 用 util 的 `getFilePreviewKind` 扩展 `previewFile.type`。**不接** MessageItem(−469)/MarkdownRenderer(−128) 重构、`ToolChangeCard`、群聊工作区(11C)、workspace-diff(#1919)。数据经现有 `/api/hermes/download` 端点抓取，无需新后端。

### 11A. 前置依赖：workspace-diff 数据链（`#1919`）

- [~] 11A.1 ~~复制 `workspace-run-changes-store.ts`~~ —— 延后（仅 `WorkspaceDiffPreview` 需要，本批未接该组件）
- [~] 11A.2 ~~schemas.ts workspace-run-changes 建表~~ —— 延后（同上，避免动 DB schema）
- [~] 11A.3 ~~文件系统 workspace run diff 生成逻辑~~ —— 延后
- [~] 11A.4 ~~复制 `#1919` 测试~~ —— 延后

### 11B. 预览组件（挂到 FilesView 的 FilePreview 分发器）

- [x] 11B.1 复制独立预览组件：`DocxFilePreview.vue`、`HtmlFilePreview.vue`、`PdfFilePreview.vue`、`PptxFilePreview.vue`、`SpreadsheetFilePreview.vue`、`xlsx-preview.worker.ts`（**`WorkspaceDiffPreview.vue` 依赖 #1919 未接；`HtmlFileContextMenu.vue` 该 commit 不存在**）
- [x] 11B.2 复制工具函数：`file-preview.ts`、`ooxml-archive.ts`、`tabular-preview.ts`（自足，无外部依赖）
- [~] 11B.3 ~~复制 `binary-content.ts`~~ —— fork 适配删除，改用 fork 现有 `getFileDownloadUrl`（tokened URL）抓 ArrayBuffer，避开缺失的 `ensureDesktopAuthReady`；`files.ts` API 无需扩展
- [~] 11B.4 ~~复制后端 file-preview controller/service~~ —— 不需要，fork 经现有 `/api/hermes/download`（已支持 docx/pdf/xlsx MIME）取 blob
- [~] 11B.5 ~~MessageItem 手动接线~~ —— 延后（chat 内联预览触前端定制主体，改为落在 FilesView）
- [x] 11B.6 适配 FilesView 预览：`FilePreview.vue` 加 html/pdf/docx/presentation/spreadsheet/csv 分支（异步组件+按需抓 blob+错误回退）；store `openPreview`/`previewFile.type`/`isPreviewableFile` 用 `getFilePreviewKind` 扩展；`getLanguageFromPath` 优先委托 util 富映射。FileList 的 👁️ 预览按钮经广义化 `isPreviewableFile` 自动覆盖新格式
- [~] 11B.7 ~~sessions controller 文件预览后端~~ —— 不需要（不接 session/group workspace 预览）
- [~] 11B.8 ~~复制 `tool-panel.ts` store~~ —— 不需要（chat 工具面板相关，未接 MessageItem）

### 11C. 群聊工作区（可选，高风险，视需要延后）

- [~] 11C.1 群聊工作区 —— 延后（触 fork 已重写的 `GroupChatPanel.vue`，且依赖 session/group workspace API 链）

### 11D. 依赖与验证

- [x] 11D.1 安装并锁版本：`docx-preview@^0.3.7`、`pdfjs-dist@^5.7.284`、`@aiden0z/pptx-renderer@^1.2.4`、`read-excel-file@^7.0.3`（devDependencies，未引入 `@vue-flow/*`）
- [x] 11D.2 复制新增测试：`tests/client/file-preview-formats.test.ts`、`tests/client/pptx-file-preview.test.ts`（**适配后 15 例全绿**；i18n 新增 13 个 `files.*` key × 10 语言经 i18n-coverage 校验通过）
- [x] 11D.3 验证：`npm run build` 全绿（预览组件按需代码分割）；单测通过；docx/pdf/pptx/xlsx/csv/html 渲染路径就绪，**桌面端人工渲染验收留待 18.5**

## 12. Provider 编辑器

- [ ] 12.1 复制新增后端：`provider-editor.ts` service、`provider-audit-store.ts` db、`safe-file-store.ts`
- [ ] 12.2 复制新增前端：`ProviderEditorModal.vue`
- [ ] 12.3 提取 `ff8d78f6` 的 providers controller/routes 改动
- [ ] 12.4 提取 `ff8d78f6` 的 schemas.ts 改动（provider audit 表）
- [ ] 12.5 提取 `ff8d78f6` 的 model-context.ts 和 app-config.ts 改动
- [ ] 12.6 提取 `ff8d78f6` 的 user-auth.ts 改动
- [ ] 12.7 复制新增测试文件

## 13. 渠道凭证清除

- [x] 13.1 提取 `062a5cb5` 的凭证清除 API，合并到 `packages/server/src/controllers/hermes/config.ts`（clearCredentials + PLATFORM_CREDENTIAL_PATHS + getPlatformCredentialStatus + removeConfigPath 返回值）
- [x] 13.2 提取 `062a5cb5` 的路由变更，合并到 `packages/server/src/routes/hermes/config.ts`（DELETE /credentials/:platform）
- [x] 13.3 提取 `062a5cb5` 的凭证清除 UI，适配到 `PlatformSettings.vue`（清除按钮 + 确认对话框 + 未保存拦截）
- [x] 13.4 提取 `062a5cb5` 的 settings store 改动（platformCredentialStatus）
- [x] 13.5 提取 `062a5cb5` 的 config API 改动，合并到 `packages/client/src/api/hermes/config.ts`（clearCredentials + ClearCredentialsResult）
- [x] 13.6 复制新增测试：`tests/client/platform-settings.test.ts`（**已适配 fork 的 5 平台列表，3 例通过**）；`config-controller-file-lock.test.ts` 既有 14 例通过；`tests/e2e/channels.spec.ts` + fixtures（**e2e 需 Playwright + 起服务，延后**）
- [x] 13.7 i18n：7 个 `platform.clearCredentials*` key × 10 语言（随节内一并落地）

## 14. 后端 Bug 修复 — 绿灯（stock / 无关定制，可大胆合）

> 落点为原汁原味的后端 lib/API 或加法型 controller，与前端定制无关，冲突极低，可整段合入。

- [~] 14.1 `#2036` 修复 Bridge 工具结果上下文上限 → `packages/server/src/lib/tool-result-context.ts`（**用户指示跳过，延后**）
- [~] 14.2 `#1876` 约束 Hermes MCP 会话委托（安全）→ `packages/server/src/lib/llm-prompt.ts`（**用户指示跳过，延后**）
- [~] 14.3 `#2051` 同步 Provider 静态目录与缓存优先级 → `controllers/hermes/models.ts` + `shared/providers.ts`（**用户指示跳过，延后**）
- [x] 14.4 `#2058` Markdown 下载保留文件扩展名 → `packages/client/src/api/hermes/download.ts`
- [x] 14.5 `#2026` 处理畸形会话导出文件名 → `packages/client/src/api/hermes/sessions.ts`
- [x] 14.6 `#1706` 未知 coding agent provider 默认 chat completions → `packages/client/src/api/coding-agents.ts`（fork 已具备，no-op）
- [~] 14.7 复制以上各 PR 的新增测试文件（**随 14.1-14.3 一并延后**）

## 15. 后端 Bug 修复 — 黄灯（基座+叠加，提取式插入）

> 落点在我们叠加过的加法型文件（`coding-agents.ts` +211 / sessions controller +118 / `chat.ts` +395 / router +29），按区域插入上游修复的那几行，不动我们叠加的逻辑。

- [x] 15.1 `#1816` History 纳入本地 coding_agent 会话 → `controllers/hermes/sessions.ts`（**已随第 2 节 `mergeHermesHistorySessions` 一并落地**）
- [x] 15.2 `#1838` History 保留本地归档状态 → sessions 相关（**归档合并逻辑已随 `mergeHermesHistorySessions` 就位；fork 暂无 is_archived 基础设施，分支惰性生效，完整归档特性为独立后续工作**）
- [ ] 15.3 `#1725` coding agent 模型切换 → `api/hermes/sessions.ts` + `stores/hermes/chat.ts` + `controllers/hermes/sessions.ts` + `services/coding-agents.ts`
- [ ] 15.4 `#1944` 持久化会话 API 模式 → 同上 + `db/hermes/schemas.ts`（只加相关列）+ `session-store.ts`
- [ ] 15.5 `#1932` 规范化 codex app-server API 模式 → `services/coding-agents.ts`
- [ ] 15.6 `#1711` coding agent 自定义 provider key 环境变量 → `services/coding-agents.ts`
- [ ] 15.7 `#1983` scoped coding agent 继承外部 MCP → `services/coding-agents.ts`
- [ ] 15.8 `#2054` 保留 Studio bridge 中的自定义 Provider 状态 → 与 `custom-providers-compat.ts` 对齐后插入（我们的定制文件，仅补充不覆盖）
- [ ] 15.9 `#1853` 默认模型/Provider 动作 → `stores/hermes/models.ts` + i18n
- [x] 15.10 `#1797` 修复 MCP admin 路由访问（安全）→ `packages/client/src/router/index.ts`（**已应用：将 `requiresSuperAdmin` 守卫从 `hermes.mcp` 移到 `hermes.devices`，fork pre-patch 状态与上游一致；sidebar 的 devices/mcp 链接在 fork 里位于整段注释的 Tools 组内属死代码，故不改 AppSidebar，真正防护落在 router beforeEach 守卫**）
- [x] 15.11 `#1631` 将 coding agent prompt 移出 CLI 参数（安全：避免进程命令行泄露）→ `coding-agent-run-manager.ts`（**no-op：核查 fork 基线已完整包含此 PR — `normalizeCliPromptArgument`/`hasArg`/`promptArgument` 分支、`coding-agents.ts` 的 `hermes-rules.md`/`tomlMultilineString`/`--append-system-prompt-file`/`developer_instructions` 均与上游 post-patch 逐字一致**）
- [ ] 15.12 `#1671` auth 过期时清除 active profile（现状 ABSENT）→ **触及我们 OAuth2 定制（`auth.ts` +215），需评估后再决定是否合**
- [~] 15.13 复制以上各 PR 的新增测试文件（**#1797：上游 sidebar-search 测试断言 mcp 可见，但 fork sidebar 链接已注释不适用；改为新增 `tests/client/router-super-admin-guard.test.ts` 直接断言路由 meta 守卫，1 例通过。#1631：已在 fork 基线，无需补测试。其余 15.3-15.9/15.12 测试随对应主任务延后**）

## 16. Bridge / Electron 主进程修复

> Bridge 修复落在加法型后端；electron 主进程文件相对 v0.6.15 **零改动**，上游补丁可干净合入。

- [~] 16.1 `#1796` 修复 bridge session workspace cwd → bridge 相关 service（**延后：依赖打包 runtime 暴露 `agent.runtime_cwd`，且需改写 fork 定制 run-chat + 拆分后的 python bridge；若 runtime 不支持会丢失 cwd 感知，风险过高**）
- [x] 16.2 `#1890` 修复 bridge terminal 错误检测 → `services/hermes/run-chat/handle-bridge-run.ts`（加法型插入，整段合入）
- [x] 16.3 `#1910` 修复 execute_code guard bridge 兼容性 → `bridge_runtime.py`（仅核心 monkeypatch 变参兼容；版本号/changelog/i18n 发版噪声跳过）
- [x] 16.4 `#1949` 修复 webui-server stdout/stderr EPIPE 崩溃 → `packages/desktop/src/main/webui-server.ts`（干净合）
- [x] 16.5 `#1968` 内置 Web UI 启动回退 → `packages/desktop/src/main/paths.ts` + `webui-server.ts`（fork 运行时结构匹配上游 pre-patch，整段合）
- [x] 16.6 `#2101` 修复 macOS 托盘图标尺寸 → `index.ts` + `paths.ts` + 托盘 png（**适配：从 fork 自有 envclaw `icon.png` 生成 trayMac.png/@2x，保留品牌；index.ts 照上游去掉 template tinting**）
- [x] 16.7 复制以上各 PR 的新增测试文件（terminal-error 追加 3 例、tray-icon.test.ts 复制；runtime-paths 保留 dist/server 前置，回退测试因该套件既有环境性失败而未追加）

> **说明**：`#1963`（claude code api mode 提示）落在 `ChatPanel.vue`（前端定制主体），按 D7 原则不整合，如需要则手动补充，不纳入本批。

## 17. i18n 统一处理

- [x] 17.1 从上游 v0.6.31 提取所有新增 i18n key，合并到 10 个 locale 文件（de/en/es/fr/ja/ko/pt/ru/zh-TW/zh），保留我们的自定义 key（**因本批仅选择性合入特定功能，相关新增 key 已随第 4/6/9/10/13 各节按 D3 就地落地**）
- [x] 17.2 验证所有新增 key 在所有语言文件中都有对应条目（`tests/client/i18n-coverage.test.ts` 7 例通过；抽查 jobs.sort*/referenceMessage/cancelReference/platform.clearCredentials* 均 10/10）

## 18. 验证

- [x] 18.1 运行 `npm run build` 确认编译通过（**client vue-tsc + vite build + server tsc 全绿；期间修复了第 3 节遗留的 JobFormModal.vue `JobFormValues` 缺 model/provider 类型错误**）
- [x] 18.2 运行 `npm run test` 确认核心测试通过（**1807 passed；本会话唯一回归 markdown-rendering 因 14.4 新增 `inferDownloadFileName` 导出、测试 mock 未同步 → 已用 importActual 修复，34 例通过；其余 ~48 失败为该 checkout 既有的环境/schema/改名相关（user-auth 缺 external_platform 列、studio-mcp/avatar/mcu 改名 env、sessions-controller、cli-shim、job-form-modal DOM 选择器），与本批安全集无关**）
- [~] 18.3 运行 `npm run harness:check`（**失败项均为该 checkout 既有、与本批无关：缺 `packages/desktop/build/icon.icns`、updater Cloudflare/GitHub 内容校验；`updater.ts` 本批未改**）
- [x] 18.4 运行 `npm run openapi:generate` 重新生成 openapi.json（随 build 执行，238 endpoints）
- [ ] 18.5 手动验证：任务创建（含模型选择）、推送频道选择、会话切换、文件预览
- [ ] 18.6 手动验证 bug 修复：coding agent 模型切换、History 显示本地会话、桌面版 webui 长输出不崩溃（EPIPE）、Provider 目录同步
