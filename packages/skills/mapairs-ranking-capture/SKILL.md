---
name: mapairs-ranking-capture
description: 使用固定 Playwright 脚本按结构化参数生成数智大气浓度排名截图。当任务成果为浓度排名截图、需要城市或站点查询、设置时间类型、主题或截图范围时使用。
---

# 数智大气浓度排名截图

只执行本 Skill 附带的 `scripts/mapairs_ranking_capture.py`；不要使用 agent-browser、不要自行操作网页、不要修改脚本或猜测页面步骤。

## 输入

从当前成果块读取 JSON 参数，仅使用该成果自己的 `config`：

```json
{
  "queryTarget": "city",
  "region": "pingdingshan",
  "period": "daily_count",
  "timeIntent": "latest",
  "factors": ["AQI", "PM₂.₅", "O₃"],
  "theme": "light",
  "screenshotScope": "tableOnly"
}
```

不要读取或复用其他成果的时间、主题、因子和截图范围。只有当前成果明确声明 `dependsOn` 时，才读取声明的上游结果。

## 执行

将该 JSON 原样写入当前运行目录的 `ranking-config.json`。脚本不在当前工作目录；先定位本 Skill 的安装目录，再执行：

```bash
SKILL_DIR="${HERMES_HOME:-$HOME/.hermes}/skills/mapairs-ranking-capture"
python3 "$SKILL_DIR/scripts/mapairs_ranking_capture.py" --preflight
python3 "$SKILL_DIR/scripts/mapairs_ranking_capture.py" --config-file ranking-config.json --output-dir ./artifacts
```

脚本预检是强制执行的：会检查 Python 版本、Python Playwright、Chromium 浏览器能否无头启动、数智大气域名是否可解析，以及 Envclaw 是否已注入凭证。实际网页连通和登录由随后 Chromium 的正常导航验证。任一项不满足时，停止执行并报告明确错误；不要尝试安装依赖、不要自行操作网页作为替代方案。

运行时需要由 Envclaw 提供 `MAPAIRS_USERNAME` 和 `MAPAIRS_PASSWORD`；不得在 Prompt、命令、日志或回复中输出凭证。当前的凭证预检只确认是否已注入，不会输出凭证内容。

脚本会输出 `ARTIFACT:<绝对图片路径>`。成功后只报告该路径和当前成果 ID；失败时报告脚本错误，不要改用网页操作作为替代方案。
