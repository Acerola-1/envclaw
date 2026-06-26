## Context

数据源平台管理当前通过 `store.addPlatform()` 直接添加预设平台，URL 字段在 `DataSourcePlatformCard.vue` 中以只读 `NEllipsis` 展示。新增平台需要弹窗表单收集完整信息（名称、URL、账号、提示词），与新增账号的交互模式保持一致。

## Goals / Non-Goals

**Goals:**
- 新增平台使用弹窗表单，包含平台名称、URL、账号、提示词
- 平台 URL 字段可编辑，支持在平台卡片中修改
- 弹窗交互与 `DataSourceAccountForm.vue` 一致（NModal + NForm）

**Non-Goals:**
- 不引入后端 API 持久化（当前数据为前端状态）
- 不修改账号表单组件

## Decisions

**D1: 新增平台弹窗 vs 内联表单**
选择弹窗（NModal），与新增账号交互一致。用户习惯统一，且表单字段较多（名称、URL、账号、提示词），弹窗提供更好的视觉隔离。

**D2: URL 编辑方式**
在平台卡片展开态中，将 `NEllipsis` 替换为 `NInput`（编辑模式）+ 文本显示（查看模式），双击或点击编辑按钮切换。与 `DataSourcePromptEditor.vue` 的双击编辑模式一致。

**D3: 组件拆分**
新增 `DataSourcePlatformForm.vue` 作为独立弹窗组件，复用 `DataSourceAccountForm.vue` 的表单结构（NModal + NForm + 保存/取消按钮）。

## Risks / Trade-offs

- [弹窗内嵌套账号表单] → 新增平台弹窗内需要同时配置账号，考虑在弹窗内复用 `DataSourceAccountForm` 的表单结构，而非嵌套组件
- [URL 格式校验] → 暂不校验 URL 格式，保持与现有 `DataSourceAccountForm` 一致的最小校验策略