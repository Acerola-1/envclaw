## Why

我们的项目 fork 自上游 hermes-studio v0.6.15，上游已迭代到 v0.6.31（285 个提交），包含大量 bug 修复和功能增强。我们长期未同步上游，导致已知 bug 未修复、新功能缺失。需要将高/中优先级的上游改动合并回来，同时保留我们的 UI 定制（envclaw 组件、CreateTask.vue 等）。

## What Changes

### Bug 修复（高优先级）
- Bridge 运行终止时正确写入 session `ended_at`/`end_reason`（`bde8f2b0`）
- 历史会话加载和分页修复（`30d40450`）
- 导出 coding agent 会话修复（`a375b9dc`）
- 切换会话时聊天内容闪烁修复（`64030437`）
- 会话 profile 筛选持久化（`f0aa7ef6`）
- cron delivery target 选择修复（`15be6f37`，我们已部分还原，需确认差异）

### 功能增强（中优先级）
- 定时任务支持选择模型/Provider（`d81b0644`）
- 定时任务列表排序（`6143b2d5`）
- 首屏加载优化：i18n 懒加载、组件异步加载、静态缓存（`937d0d8d`）
- 切换模型时保留草稿工作区（`5be85483`）
- MoA 预设模型选择（`3decc0e9`）
- 推理强度滑块（`e683cd36`）
- 消息引用功能（`d246455e`）
- 生成文件预览（docx/html/pdf/pptx/xlsx）和群聊工作区（`62166315`）
- Provider 编辑器改进（`ff8d78f6`）
- 渠道凭证清除（`062a5cb5`）

### 排除项
- Workflow v2 编排（`5eb1b941`，9000+ 行，功能复杂暂不需要）
- 后台委托任务（`08caa227`，3293 行，依赖 Workflow v2）
- MCU/ESP32 硬件相关改动
- 实时语音模式（`42c6c2c2`，需要硬件配合）

## Capabilities

### New Capabilities
- `job-model-selection`: 定时任务创建/编辑时选择 LLM 模型和 Provider
- `job-sort-toggle`: 定时任务列表按名称/创建时间排序
- `reasoning-effort-slider`: 聊天输入框中的推理强度滑块控件
- `message-references`: 单聊和群聊中的消息引用/回复功能
- `file-preview-formats`: 生成文件预览（docx/html/pdf/pptx/xlsx/spreadsheet）
- `provider-editor`: Provider 版本化编辑器（审计日志、安全文件存储）
- `credential-clearing`: 渠道凭证一键清除
- `first-screen-optimization`: 首屏加载优化（i18n 懒加载、组件异步加载、静态缓存）

### Modified Capabilities
- `session-lifecycle`: Bridge/coding-agent 运行终止时写入 session 结束状态
- `session-pagination`: 历史会话分页和 lineage 查询修复
- `chat-session-switch`: 会话切换闪烁修复和 profile 筛选持久化
- `draft-workspace-preservation`: 模型切换时保留草稿工作区
- `moa-model-selection`: MoA 预设在聊天模型选择中的支持

## Impact

- **后端**：`jobs.ts` controller、`sessions.ts` controller/db/routes、`coding-agent-run-manager.ts`、`handle-bridge-run.ts`、`abort.ts`、`config.ts` controller、`models.ts` controller、`providers.ts` controller
- **前端**：`ChatInput.vue`（3 个功能叠加）、`ChatPanel.vue`（我们改了 1786 行）、`MessageItem.vue`、`MessageList.vue`、`CreateTask.vue`（适配模型选择）、`JobsView.vue`、`App.vue`、`main.ts`
- **新增文件**：约 30+ 个新文件（文件预览组件、Provider 编辑器、测试文件等）
- **i18n**：10 个 locale 文件需合并新增 key（保留我们的自定义 key）
- **API**：新增 delivery-targets、credential-clearing、file-preview 等端点
- **依赖**：`package.json`/`package-lock.json` 可能有新增依赖
