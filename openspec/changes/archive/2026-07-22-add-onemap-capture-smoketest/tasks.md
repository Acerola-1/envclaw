## 1. 统一值守执行器 Skill

- [ ] 1.1 新建 `packages/skills/mapairs-duty-executor/` 目录结构：
  - `SKILL.md`（约束：只执行本 skill 脚本、不用 agent-browser、不猜网页步骤、凭证不外泄）
  - `agents/openai.yaml`（display_name "数智大气值守执行器"，default_prompt 说明按成果类型分发到对应操作器并返回图片路径）
  - `scripts/executor.py`（统一入口：预检 → 登录 → 循环成果 → 按 type 分发 → 收集 ARTIFACT）
  - `scripts/operators/__init__.py`（操作器注册表，按 `type` 字符串映射到模块函数）
  - `scripts/operators/onemap.py`（本次实现：写死直链、整页截图）
  - `scripts/operators/ranking.py`（预留 stub）
  - `scripts/operators/hourly.py`（预留 stub）
  - `scripts/operators/monitoring.py`（预留 stub）
- [ ] 1.2 `executor.py` 实现：
  - `--preflight` 预检：Python 版本、Playwright、Chromium、数智大气域名可解析、`MAPAIRS_USERNAME/PASSWORD` 已注入
  - 登录与设备清退（复用已验证逻辑，一次登录，所有操作器共享 page）
  - 读取任务成果列表（JSON 格式，每项含 `type` 和 `config`）
  - 按 `type` 分发到对应操作器，捕获异常并记录
  - 收集所有成功产出的路径，统一打印 `ARTIFACT:<path>`（每行一个）
- [ ] 1.3 `onemap` 操作器实现：
  - 写死导航 URL：`/oneMap?theme=Light&factor=pm25&leftPanel=false&city=411856cc4`
  - 固定等待渲染（如 15 秒）
  - 整页截图，写入 `--output-dir`
  - 返回截图绝对路径
- [ ] 1.4 预留 stub 操作器实现：
  - 每个 stub 包含 `def capture(page, config): raise NotImplementedError("该操作器尚未实现")`
  - 注册到 `operators/__init__.py`，使执行器能按 `type` 分发到它们

## 2. 定时任务接入（最小）

- [ ] 2.1 确认"一张图截图"成果在创建页可被选择并保存（config 可为占位，不参与直链拼接）。
- [ ] 2.2 任务提示词包含：调用本 skill 的 `executor.py`，传入成果列表，拿到 `ARTIFACT` 路径后用 `media://` 语法推送图片。

## 3. 验证

- [ ] 3.1 本地手动运行 `executor.py --preflight`，确认预检通过。
- [ ] 3.2 本地手动运行 `executor.py` 传入单条 `onemap` 成果，确认登录+清退成功、抵达一张图页面、整页截图落盘并打印正确的 `ARTIFACT` 路径。
- [ ] 3.3 验证预留 stub 操作器：传入 `type=ranking` 的成果，确认执行器正确分发到 stub 并抛出 `NotImplementedError`，错误信息清晰。
- [ ] 3.4 创建一个定时"一张图截图"任务，触发一次，确认 agent 能调起 skill、拿到图片路径并完成 `media://` 推送。
- [ ] 3.5 运行相关测试与生产构建（`npm run harness:check` 至少通过；skill 为纯脚本，如无对应单测则以手动运行结果为准）。
