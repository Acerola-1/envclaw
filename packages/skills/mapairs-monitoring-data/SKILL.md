---
name: mapairs-monitoring-data
description: 使用固定 Playwright 脚本按结构化参数生成数智大气监测数据截图（URL 直连模式）。当任务成果为城市/站点监测数据、需要设置时间类型、主题或截图时使用。
---

# 数智大气监测数据截图（URL 直连）

只执行本 Skill 附带的 `scripts/mapairs_monitoring_data.py`；不要使用 agent-browser、不要自行操作网页、不要修改脚本或猜测页面步骤。脚本会用参数拼接完整 URL 后直接跳转截图，比逐级点击菜单更稳定。

## 是否截图

**仅当当前成果的 `config.includeScreenshot` 为 `true` 时才执行本 Skill 并生成截图。** 若为 `false`，不要运行脚本，也不要生成任何图片成果。

## 输入

从当前成果块读取 JSON 参数，仅使用该成果自己的 `config`：

```json
{
  "zone": "city",
  "region": "357af1351",
  "township": "",
  "type": "daily_count",
  "factors": "PM2.5,PM10,SO2,NO2,CO,O3,AQI",
  "gbKey": "0",
  "includeTable": true,
  "includeScreenshot": true,
  "includeAnalysis": false,
  "theme": "light"
}
```

`zone=site` 时可附带 `stationType`、`station`。不要读取或复用其他成果的参数；只有当前成果明确声明 `dependsOn` 时，才读取声明的上游结果。

## 执行

将该成果的 `config` JSON 原样写入当前运行目录的 `monitoring-data-config.json`，先定位本 Skill 安装目录再执行：

```bash
SKILL_DIR="${HERMES_HOME:-$HOME/.hermes}/skills/mapairs-monitoring-data"
python3 "$SKILL_DIR/scripts/mapairs_monitoring_data.py" --preflight
python3 "$SKILL_DIR/scripts/mapairs_monitoring_data.py" --config-file monitoring-data-config.json --output-dir ./artifacts
```

脚本预检是强制执行的：检查 Python 版本、Python Playwright、Chromium 能否无头启动、数智大气主机是否可解析，以及 Envclaw 是否已注入凭证。任一项不满足时停止执行并报告明确错误；不要尝试安装依赖、不要自行操作网页作为替代方案。

运行时凭证由 Envclaw 通过 `MAPAIRS_USERNAME` / `MAPAIRS_PASSWORD` 环境变量注入；不得在 Prompt、命令、日志或回复中输出凭证。基础地址可通过 `MAPAIRS_BASE_URL` 覆盖（默认内网）。

脚本会输出 `ARTIFACT:<绝对图片路径>` 和 `MEDIA:<绝对路径>`。成功后，你的最终回复必须原样包含该 `MEDIA:/绝对路径` 行，Hermes 会据此自动将截图作为原生媒体投递到任务配置的推送目标；不要自行调用推送工具，也不要用 delegate/派发子任务的方式去发送。失败时报告脚本错误，不要改用网页操作作为替代方案。
