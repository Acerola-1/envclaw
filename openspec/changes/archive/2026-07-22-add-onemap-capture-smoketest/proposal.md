## Why

已通过独立 Playwright 脚本验证：登录数智大气后，直接访问带参数的一张图深链接（`/oneMap?...`）能够携带登录态抵达目标页面并截图。现在需要把这条链路以 Envclaw 的正式形态跑通一次——即"定时任务 → agent 调用 skill → skill 登录并截图 → 产出图片路径 → agent 推送"，以此确认整条无人值守链路可用。

本次是流程冒烟测试（smoke test），不是完整功能。目的是先证明"一张图截图值守"能跑通，再谈参数化。因此**不做任务参数到 URL 的真实映射**：用户选择"一张图截图"这一成果时，最终拼出的地址写死为已验证的直链。

同时，本次在架构上预埋"值守执行器"的统一框架：一个 skill 内部包含多个"页面操作器"，每个操作器对应一个内置功能（一张图、浓度排名、小时播报、监测数据）。本次只实现"一张图"操作器，其他操作器留空接入点，供后续变更填充。

## What Changes

- 新增一个统一的"数智大气值守执行器" Skill（`mapairs-duty-executor`），内部包含多个页面操作器：
  - `onemap`：本次实现，访问写死的一张图直链并整页截图
  - `ranking`、`hourly`、`monitoring`：预留接入点，本次不实现
- 该 Skill 的 `onemap` 操作器访问的直链**写死**为 `/oneMap?theme=Light&factor=pm25&leftPanel=false&city=411856cc4`，不接收任务参数、不做参数映射。
- Skill 输出 `ARTIFACT:<绝对图片路径>`，与现有 ranking 能力保持一致的产物协议。
- 凭证复用 Envclaw 既有注入机制（`MAPAIRS_USERNAME` / `MAPAIRS_PASSWORD`），不在脚本、任务、日志中出现明文。
- 推送不在本次范围内实现：由定时任务提示词交给 agent 用 `media://` 语法完成。本次只保证 skill 稳定产出可推送的图片路径。
- 预留的 `ranking`、`hourly`、`monitoring` 操作器在本次 skill 中以 stub 形式存在，返回"未实现"错误，不执行任何页面操作。

## Capabilities

### New Capabilities

- `mapairs-duty-executor`：统一的数智大气值守执行器，支持按成果类型分发到对应页面操作器。本次只实现 `onemap` 操作器，用于验证一张图截图值守链路的可行性。

### Modified Capabilities

- 无。

## Impact

- 新增 `packages/skills/mapairs-duty-executor/`（SKILL.md、agents/openai.yaml、scripts/executor.py、scripts/operators/onemap.py、scripts/operators/ranking.py、scripts/operators/hourly.py、scripts/operators/monitoring.py）。
- 复用现有 Hermes Python/Playwright 运行时与凭证注入；不新增服务端接口。
- 不改动 `CreateTask.vue` 的参数表单逻辑（本次不做参数映射）；如需在创建页出现"一张图截图"成果选项，仅作为固定成果占位，其 config 不影响写死的直链。
- 参数（theme / factor / leftPanel / city）的语义已确认（主题、污染因子、左侧面板开关、行政区），但本次不实现其到 URL 的映射，留待后续参数化变更。
- 预留的 `ranking`、`hourly`、`monitoring` 操作器 stub 不改动现有 `mapairs-ranking-capture` skill 的行为，两者独立存在。
