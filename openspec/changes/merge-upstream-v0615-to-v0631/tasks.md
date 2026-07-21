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

- [ ] 8.1 提取 `3decc0e9` 的 MoA 相关逻辑，合并到 `packages/client/src/stores/hermes/models.ts`
- [ ] 8.2 提取 `3decc0e9` 的 MoA 后端逻辑，合并到 `packages/server/src/controllers/hermes/models.ts` 和 `model-context.ts`
- [ ] 8.3 提取 `3decc0e9` 的 MoA UI 逻辑，适配到 `ChatInput.vue` 和 `ChatPanel.vue`
- [ ] 8.4 复制新增组件：`packages/client/src/components/hermes/models/CombinationModelsPanel.vue`
- [ ] 8.5 复制新增文档：`docs/chat-chain-changes/2026-07-15-moa-session-model-selection.md`

## 9. 推理强度滑块

- [ ] 9.1 提取 `e683cd36` 的 reasoning effort slider 组件和逻辑，适配到 `ChatInput.vue`
- [ ] 9.2 复制新增文档：`docs/chat-chain-changes/2026-07-16-reasoning-effort-slider.md`

## 10. 消息引用功能

- [ ] 10.1 提取 `d246455e` 的 `activeMessageReference` 状态管理，合并到 `chat.ts` store
- [ ] 10.2 提取 `d246455e` 的消息引用 UI，适配到 `ChatInput.vue`（引用预览、取消按钮）
- [ ] 10.3 提取 `d246455e` 的消息高亮逻辑，适配到 `MessageItem.vue`
- [ ] 10.4 提取 `d246455e` 的消息引用渲染，适配到 `MessageList.vue`
- [ ] 10.5 提取 `d246455e` 的群聊消息引用，适配到 `GroupChatInput.vue` 和 `GroupMessageItem.vue`
- [ ] 10.6 提取 `d246455e` 的 group-chat store 引用逻辑，合并到 `group-chat.ts`
- [ ] 10.7 复制新增后端：`packages/server/src/services/hermes/group-chat/mention-routing.ts`
- [ ] 10.8 复制新增测试：`tests/client/chat-message-reference.test.ts`、`tests/client/message-item-highlight.test.ts` 等
- [ ] 10.9 复制新增文档：`docs/chat-chain-changes/2026-07-16-single-chat-message-reference.md`

## 11. 生成文件预览

- [ ] 11.1 复制新增前端组件：`DocxFilePreview.vue`、`HtmlFileContextMenu.vue`、`HtmlFilePreview.vue`、`PdfFilePreview.vue`、`PptxFilePreview.vue`、`SpreadsheetFilePreview.vue`、`WorkspaceDiffPreview.vue`、`xlsx-preview.worker.ts`
- [ ] 11.2 复制新增工具函数：`file-preview.ts`、`ooxml-archive.ts`、`tabular-preview.ts`
- [ ] 11.3 复制新增 API：`binary-content.ts`
- [ ] 11.4 提取 `62166315` 的 files API 扩展，合并到 `packages/client/src/api/hermes/files.ts`
- [ ] 11.5 提取 `62166315` 的 FileList/FileTree 改动，适配到我们的组件
- [ ] 11.6 复制新增后端：`file-preview.ts` controller、`file-preview.ts` service、`file-provider.ts`
- [ ] 11.7 提取 `62166315` 的 sessions controller 文件预览相关改动
- [ ] 11.8 提取 `62166315` 的群聊工作区文件逻辑，合并到 group-chat 相关文件
- [ ] 11.9 复制新增 store：`tool-panel.ts`
- [ ] 11.10 复制新增测试文件
- [ ] 11.11 检查并安装新增 npm 依赖（如有）

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

## 14. i18n 统一处理

- [ ] 14.1 从上游 v0.6.31 提取所有新增 i18n key，合并到 10 个 locale 文件（de/en/es/fr/ja/ko/pt/ru/zh-TW/zh），保留我们的自定义 key
- [ ] 14.2 验证所有新增 key 在所有语言文件中都有对应条目

## 15. 验证

- [ ] 15.1 运行 `npm run build` 确认编译通过
- [ ] 15.2 运行 `npm run test` 确认核心测试通过
- [ ] 15.3 运行 `npm run harness:check` 确认文档/脚本检查通过
- [ ] 15.4 运行 `npm run openapi:generate` 重新生成 openapi.json
- [ ] 15.5 手动验证：任务创建（含模型选择）、推送频道选择、会话切换、文件预览
