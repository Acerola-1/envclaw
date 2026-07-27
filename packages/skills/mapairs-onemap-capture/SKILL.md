---
name: mapairs-onemap-capture
description: 使用固定 Playwright 脚本按结构化参数生成数智大气"一张图"（oneMap）截图（URL 直连模式）。当任务成果为一张图地图截图、需要设置污染因子、地图类型、时间类型、主题或左侧面板时使用。
---

# 数智大气一张图截图（URL 直连）

只执行本 Skill 附带的 `scripts/mapairs_onemap_capture.py`；不要使用 agent-browser、不要自行操作网页、不要修改脚本或猜测页面步骤。脚本会用参数拼接完整 `/oneMap` URL 后直接跳转截图。

## 是否截图

**仅当当前成果的 `config.includeScreenshot` 为 `true` 时才执行本 Skill 并生成截图。** 若为 `false`，不要运行脚本，也不要生成任何图片成果。

## 输入

从当前成果块读取 JSON 参数，仅使用该成果自己的 `config`：

```json
{
  "theme": "light",
  "mode": "monitoring",
  "factor": "PM2.5",
  "windWaves": true,
  "region": "1309a14a1",
  "timeType": "daily",
  "leftPanel": false,
  "screenshotScope": "mapLegend",
  "includeScreenshot": true
}
```

拼接后的 URL 形如：`/oneMap?theme=Light&factor=PM2.5&leftPanel=false&region=1309a14a1&windWaves=true&mode=monitoring&timeType=daily`。不要读取或复用其他成果的参数；只有当前成果明确声明 `dependsOn` 时，才读取声明的上游结果。

## 首要污染物因子

若 `config.factor` 为 `primaryPollutant`，脚本会直接报错拒绝执行。必须先解析出当前首要污染物再调用脚本：

1. 调用 MCP 工具 `helper_getLatestTime2` 获取基准时间；
2. 调用 MCP 工具 `mcp_city_common_get_air_quality_realtime_stat`（`region` 传行政区中文名；口径：timeType=hourly → type=hourly/sTime=airCityH，timeType=dt → type=daily_count/sTime=airCityDt，timeType=daily → type=daily/sTime=airCityD）；
3. 取返回记录的 `maxPollutionEn` 作为 `factor`：多个时取第一个；`O3_8H` 改用 `O3`；`"-"` 或空（无首要污染物）改用 `AQI`；
4. 把解析出的具体因子写入 `onemap-config.json` 的 `factor` 后再执行脚本。任务 prompt 中若有【首要污染物因子解析】规则，以其指定的判定行政区为准。

## 执行

将该成果的 `config` JSON 原样写入当前运行目录的 `onemap-config.json`，先定位本 Skill 安装目录再执行：

```bash
SKILL_DIR="${HERMES_HOME:-$HOME/.hermes}/skills/mapairs-onemap-capture"
python3 "$SKILL_DIR/scripts/mapairs_onemap_capture.py" --preflight
python3 "$SKILL_DIR/scripts/mapairs_onemap_capture.py" --config-file onemap-config.json --output-dir ./artifacts
```

脚本预检是强制执行的：检查 Python 版本、Python Playwright、Chromium 能否无头启动、数智大气主机是否可解析，以及 Envclaw 是否已注入凭证。任一项不满足时停止执行并报告明确错误；不要尝试安装依赖、不要自行操作网页作为替代方案。

运行时凭证由 Envclaw 在用户登录平台后写入运行时凭证文件，脚本自动读取；不得在 Prompt、命令、日志或回复中输出凭证。基础地址可通过 `MAPAIRS_BASE_URL` 覆盖（默认内网）。

脚本会输出 `ARTIFACT:<绝对图片路径>` 和 `MEDIA:<绝对路径>`。成功后，你的最终回复必须原样包含该 `MEDIA:/绝对路径` 行，Hermes 会据此自动将截图作为原生媒体投递到任务配置的推送目标；不要自行调用推送工具，也不要用 delegate/派发子任务的方式去发送。失败时报告脚本错误，不要改用网页操作作为替代方案。
