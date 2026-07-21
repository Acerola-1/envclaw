## Context

我们的项目 fork 自上游 hermes-studio v0.6.15，上游已迭代到 v0.6.31（285 个提交）。我们主要定制了 UI 层（envclaw 组件体系、CreateTask.vue 替代 JobFormModal.vue、OAuth2 登录、桌面端自动更新等），后端改动相对较少。

上游 v0.6.15→v0.6.31 的改动中，我们排除 Workflow v2 和后台委托任务（功能复杂、暂不需要），其余高/中优先级改动需要合并。

**当前状态**：
- 我们有 65 个自定义提交，上游领先 285 个提交
- 冲突热点：ChatPanel.vue（我们改了 1786 行）、ChatInput.vue（3 个功能叠加）、chat.ts store（435 行）
- 机械冲突：i18n locale 文件（10 个语言 × 多个提交）、docs/openapi.json（9672 行差异）

## Goals / Non-Goals

**Goals:**
- 合并上游 16 个高/中优先级提交的关键代码改动
- 保留我们的 UI 定制（envclaw 组件、CreateTask.vue、OAuth2 登录等）
- 修复已知 bug（session 结束状态、会话分页、闪烁等）
- 引入实用新功能（模型选择、推理滑块、消息引用、文件预览等）
- 优化首屏加载性能

**Non-Goals:**
- 不合并 Workflow v2 编排（`5eb1b941`，9000+ 行）
- 不合并后台委托任务（`08caa227`，3293 行，依赖 Workflow v2）
- 不合并 MCU/ESP32 硬件相关改动
- 不合并实时语音模式（需要硬件配合）
- 不做整体 `git merge upstream/main`（冲突不可控）
- 不重写我们的 UI 定制来匹配上游

## Decisions

### D1: 手动提取策略而非 cherry-pick

**选择**：读取上游 diff，手动提取关键代码改动，逐个合并到我们的文件中。

**理由**：cherry-pick 实测冲突率极高（i18n/openapi 机械冲突 + 核心文件双方改动），逐个解决成本远高于手动提取。手动提取可以精确控制合并范围，跳过不需要的改动。

**替代方案**：
- `git merge upstream/main`：冲突量巨大，不可控
- `git cherry-pick` 逐个提交：i18n 冲突在每个提交中重复出现，解决效率低
- 整体替换文件再回退我们的改动：对 ChatPanel.vue 等大文件风险太高

### D2: 上游 JobFormModal.vue 改动适配到 CreateTask.vue

**选择**：不合并 JobFormModal.vue 的改动，而是将功能逻辑（模型选择、delivery targets）适配到我们的 CreateTask.vue。

**理由**：我们用 CreateTask.vue 完全替代了上游的 JobFormModal.vue，两者 UI 结构完全不同。直接合并 JobFormModal.vue 会丢失我们的定制。

### D3: i18n 统一处理

**选择**：所有 i18n locale 文件的合并放在最后统一处理，从上游提取新增 key，保留我们的自定义 key。

**理由**：i18n 冲突是机械性的（双方都在文件末尾追加 key），逐个提交处理会重复劳动。统一处理效率更高，且不易遗漏。

### D4: docs/openapi.json 不合并，最后重新生成

**选择**：跳过 openapi.json 的合并，所有改动完成后运行 `npm run openapi:generate` 重新生成。

**理由**：openapi.json 是自动生成的，我们改了 9672 行，上游也大量改动，手动合并无意义。

### D5: ChatInput.vue 多功能叠加按提交顺序适配

**选择**：按上游提交时间顺序（MoA → 推理滑块 → 消息引用）逐个适配到我们的 ChatInput.vue。

**理由**：三个功能都修改 ChatInput.vue，按时间顺序适配可以复用上游的增量改动逻辑，避免一次性处理大量差异。

### D6: handle-ekko-agent-run.ts 跳过

**选择**：我们删除了 `handle-ekko-agent-run.ts`，上游的改动涉及此文件时跳过。

**理由**：我们不用 Ekko Agent，该文件已被删除，无需恢复。

## Risks / Trade-offs

- **[ChatPanel.vue 大量冲突]** → 我们改了 1786 行，上游也大量改动。缓解：只提取具体修复代码（闪烁修复、profile 持久化），不整体替换。
- **[ChatInput.vue 三功能叠加]** → MoA + 推理滑块 + 消息引用都改这个文件。缓解：按提交顺序逐个适配，每步验证编译。
- **[i18n key 遗漏]** → 10 个 locale × 多个提交，容易遗漏新增 key。缓解：最后用 diff 工具对比上游完整 locale 文件，确保无遗漏。
- **[coding-agent-run-manager.ts 双方改动]** → 我们加了 sessionSource/SendOptions，上游加了 memoryExport。缓解：两者改动区域不重叠，可安全合并。
- **[sessions controller 双方改动]** → 我们加了 profile 兜底/source 过滤，上游修了分页/lineage。缓解：保留我们的逻辑，插入上游的修复代码。
- **[新依赖引入]** → 文件预览功能可能引入新 npm 包。缓解：检查 package.json 差异，按需安装。
