## ADDED Requirements

### Requirement: Job model and provider selection in CreateTask
创建定时任务时，用户 SHALL 能选择 LLM Provider 和具体模型。选中的 provider 和 model SHALL 通过 `--provider` 和 `--model` 参数传递给 hermes cron CLI。

#### Scenario: Create job with model selection
- **WHEN** 用户在 CreateTask 页面选择了一个 provider 和 model 后提交
- **THEN** 系统 SHALL 将 provider 和 model 传递给后端 create job API，后端 SHALL 将 `--provider` 和 `--model` 传入 hermes cron create 命令

#### Scenario: Edit job preserves model selection
- **WHEN** 用户编辑已有任务
- **THEN** 编辑表单 SHALL 显示当前任务的 provider 和 model，用户可修改后保存

#### Scenario: Default model behavior
- **WHEN** 用户未选择 provider/model
- **THEN** 系统 SHALL 使用 profile 默认的 provider 和 model（即不传 `--provider`/`--model` 参数）

### Requirement: Job API supports model fields
`CreateJobRequest` SHALL 包含 `model` 和 `provider` 字段。`UpdateJobRequest` SHALL 包含 `model` 和 `provider` 字段。`JobFormValues` SHALL 包含 `model` 和 `provider` 字段。

#### Scenario: API accepts model fields on create
- **WHEN** 前端发送 `POST /api/hermes/jobs` 包含 `provider` 和 `model` 字段
- **THEN** 后端 SHALL 将这些字段传入 hermes cron create 命令的 `--provider` 和 `--model` 参数

#### Scenario: API accepts model fields on update
- **WHEN** 前端发送 `PATCH /api/hermes/jobs/:id` 包含 `provider` 和/或 `model` 字段
- **THEN** 后端 SHALL 将这些字段传入 hermes cron edit 命令的 `--provider` 和 `--model` 参数

### Requirement: Job list resolves default provider/model
任务列表响应中，当任务的 provider/model 为空时，后端 SHALL 解析 profile 默认值并填充，以便前端正确显示。

#### Scenario: Job without explicit model shows profile default
- **WHEN** 任务未指定 model，但 profile 有默认模型
- **THEN** 任务列表中该任务的 model 字段 SHALL 显示 profile 默认模型名称
