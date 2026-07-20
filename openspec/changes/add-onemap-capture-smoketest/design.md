## Context

一张图（`/oneMap`）是数智大气的核心可视化功能。独立脚本已验证：登录（含设备数上限清退）后，直接 `goto` 一个带 query 参数的一张图深链接，登录态会被正确携带，页面能抵达目标状态并渲染完成，随后可整页截图。参数含义已确认：

- `theme`：浅色 / 深色主题
- `factor`：污染因子（如 pm25）
- `leftPanel`：左侧面板开启 / 关闭
- `city`：行政区编码

现有 `mapairs-ranking-capture` Skill 已经把"登录 + 设备清退 + 无头 Playwright + 产物协议（`ARTIFACT:<path>`）+ 凭证注入"这套跑通。本次一张图截图与它高度同构，差异只在**截图目标**（整页 vs 表格并集裁剪）和**导航目标**（写死直链 vs 结构化条件）。

同时，Envclaw 的值守任务体系已规划多个内置功能：一张图、浓度排名、小时播报、监测数据。每个功能对应不同的页面路径和操作逻辑，但共享"登录 → 导航 → 操作 → 产出"的同一条链路。本次在架构上预埋统一的"值守执行器"框架：一个 skill 内部分发多个"页面操作器"，每个操作器对应一个功能。本次只实现 `onemap` 操作器，其他操作器以 stub 形式预留。

## Goals / Non-Goals

**Goals:**

- 以 Envclaw 正式形态跑通一次一张图截图值守链路：定时任务 → agent 调 skill → skill 登录截图 → 产出路径 → agent 推送。
- 复用已验证的登录、设备清退、凭证注入、产物协议，降低新增面。
- 确认整页截图在无头环境下能稳定产出。
- **架构上预埋统一执行器框架**：一个 skill 内部分发多个页面操作器，本次只实现 `onemap`，其他预留 stub。

**Non-Goals:**

- **不做任务参数到 URL 的真实映射**：直链写死为已验证值。
- 不实现推送本身；推送由任务提示词交给 agent 的 `media://` 语法完成。
- 不实现红框标注、地图要素坐标计算等一张图高级能力。
- **不实现 `ranking`、`hourly`、`monitoring` 操作器**：仅预留接入点，返回"未实现"错误。
- 不改动创建页的参数表单交互逻辑。

## Decisions

### 统一执行器 + 分发的页面操作器

新增 `mapairs-duty-executor` skill，内部结构：

```
scripts/
  executor.py          # 统一入口：登录 → 循环成果 → 按 type 分发
  operators/
    __init__.py        # 操作器注册表
    onemap.py          # 本次实现：一张图截图
    ranking.py         # 预留 stub
    hourly.py          # 预留 stub
    monitoring.py      # 预留 stub
```

`executor.py` 的职责：
1. 预检（Python/Playwright/Chromium/凭证）
2. 登录数智大气（一次登录，所有操作器共享 page 实例）
3. 读取任务成果列表，按 `type` 字段分发到对应操作器
4. 收集所有操作器的产出，统一返回 `ARTIFACT` 列表

每个操作器接收 `(page: Page, config: dict) → str | None`，返回截图路径或 None。操作器之间不共享状态，只共享同一个 Playwright page 实例。

### 直链写死，不接收参数

`onemap` 操作器内部把导航 URL 固定为 `/oneMap?theme=Light&factor=pm25&leftPanel=false&city=411856cc4`。任务成果的 config 即使传值也不参与拼接。这样本次只验证"能到达并截图"这一条链路，把参数映射的复杂度隔离到后续变更，避免半成品参数逻辑污染冒烟测试结论。

### 预留操作器以 stub 形式存在

`ranking.py`、`hourly.py`、`monitoring.py` 在本次 skill 中只包含最小 stub：

```python
def capture(page, config):
    raise NotImplementedError("该操作器尚未实现")
```

这样执行器框架可以注册它们、可以按 `type` 分发，但执行时会明确报错。后续变更只需替换 stub 为真实实现，不需要改动执行器框架。

### 整页截图，固定等待

一张图是 WebGL/地图渲染，网络永不 idle。沿用已验证经验：`goto` 后固定等待足够时长（如 15 秒）让瓦片和图层渲染完成，再整页截图。不做裁剪。

### 凭证与推送分离

凭证仍由 Envclaw 通过 `MAPAIRS_USERNAME` / `MAPAIRS_PASSWORD` 注入，Skill 预检只确认是否已注入、不输出内容。Skill 只产出 `ARTIFACT:<绝对路径>`；如何推送（`media://`）由 agent 依据任务提示词决定，不在 Skill 内实现。

## Risks / Trade-offs

- [写死直链掩盖参数映射的真实难度] → 明确本次为冒烟测试，Non-Goals 已声明参数化留待后续；不在本变更内伪称参数可用。
- [一张图渲染时长不稳定导致截图截早] → 沿用固定等待经验值，若实测不稳定则在脚本内提高等待或加入对具体页面元素的等待，而非引入网络 idle 判断。
- [无人值守登录受设备数上限影响] → 复用 ranking 已验证的清退循环，失败明确返回任务日志。
- [截图产物无法回传 agent] → 沿用 `ARTIFACT:<path>` stdout 协议与任务输出目录约定，与 ranking 一致。
- [推送语法不在本仓库、无法在此验证] → 本次不验证推送实现，只保证产物路径可用；推送由 hermes agent 内部处理，验证放在真实任务运行时观察。
- [预留 stub 操作器被误用] → stub 明确抛出 `NotImplementedError`，任务日志会清晰显示"该操作器尚未实现"，不会静默失败或产生无效产物。
