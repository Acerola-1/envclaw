# 一张图（Map Package）配置参数对照文档

> **用途**：说明"一张图"（Map Package）页面 URL 参数、Hermes 任务配置（`MapOutputSnapshot`）与 Playwright 脚本的对应关系，供开发、测试和调试参考。
> **当前实现**：基于 Playwright 浏览器自动化的截图采集，**非 REST API**。所有参数通过 UI 操作完成。
> **注意**：当前尚未编写对应的 Playwright 脚本（`mapairs-map-capture`），本文档为预期接口定义，供脚本实现时参考。

---

## 1. 页面 URL 查询参数一览

一张图页面（`/oneMap`）的 URL 形如：

```
https://www.mapairs.com/oneMap
  ?theme=Light
  &factor=PM2.5
  &leftPanel=false
  &region=1320a70ee
  &windWaves=true
  &mode=monitoring
```

| URL 参数 | 示例值 | 说明 | 是否必填 |
|---------|-------|------|---------|
| `theme` | `Light` / `Dark` | 页面主题：浅色 / 深色 | 否（默认 Light） |
| `factor` | `PM2.5` / `PM10` / `SO2` / `NO2` / `CO` / `O3` / `AQI` | 污染因子 | 是 |
| `leftPanel` | `true` / `false` | 是否显示左侧面板 | 否 |
| `region` | `1320a70ee` | 地图范围 regionKeyVO（城市账号=城市，区县账号=区县） | 是 |
| `windWaves` | `true` / `false` | 是否开启风/海浪动画 | 否（默认 true） |
| `mode` | `monitoring` / `interpolation` | 地图类型：监测图 / 插值图 | 是 |



---

## 2. Hermes 任务配置参数一览

CreateTask 前端表单收集的"一张图"配置项，类型与默认值：

| Hermes 字段 | 类型 | 默认值 | 说明 |
|------------|------|--------|------|
| `region` | `string` | 用户城市/区县（由 `onMounted` 根据账号层级自动设定） | 动态，见第 3 节 |
| `timeType` | `'hourly' \| 'dt' \| 'daily'` | `'hourly'` | 时间类型：实时 / 累计 / 日 |
| `mode` | `'monitoring' \| 'interpolation'` | `'monitoring'` | 地图类型：监测图 / 插值图 |
| `factor` | `string` | `'PM2.5'` | 污染因子（见下方对照表） |
| `zoom`(未使用) | `number` | `8` | 地图缩放等级（范围 3–16） |
| `theme` | `'light' \| 'dark'` | `'light'` | 截图颜色主题：浅色 / 深色 |
| `windWaves` | `boolean` | `true` | 是否开启风/海浪动画 |
| `screenshotScope`(未使用)  | `'mapOnly' \| 'mapLegend' \| 'fullPage'` | `'mapLegend'` | 截图区域范围（见下方截图参数表） |
| `leftPanel` | `boolean` | `false` | 是否打开左侧面板 |

---

## 3. 地图范围（`region`）对照

`region` 已从硬编码改为动态值，从 `userStore.platformUserInfo.region`（`localStorage` 中 `hermes_platform_user`）读取：

**城市账号**（`currentRegionLevel === 1`）：

| 代码值 | 来源字段 | 中文标签来源 | 说明 |
|-------|---------|------------|------|
| `national` | 固定 | 全国 | 全国范围地图 |
| `provinceShortCode`（如 `4102950f2`） | 用户 region.provinceShortCode | 用户 region.provinceName（如"河南省"） | 用户省份范围地图 |
| `currentShortCode`（如 `1320a70ee`） | 用户 region.currentShortCode | 用户 region.currentRegionName（如"保定市"） | 用户城市范围地图 |

**区县账号**（`currentRegionLevel === 2`）：

| 代码值 | 来源字段 | 中文标签来源 | 说明 |
|-------|---------|------------|------|
| `provinceShortCode`（如 `4102950f2`） | 用户 region.provinceShortCode | 用户 region.provinceName（如"河南省"） | 用户省份范围地图 |
| `parentShortCode`（如 `411856cc4`） | 用户 region.parentShortCode | 用户 region.parentName（如"洛阳市"） | 用户城市范围地图 |
| `currentShortCode`（如 `41bb1ac37`） | 用户 region.currentShortCode | 用户 region.currentRegionName（如"新安县"） | 用户区县范围地图 |

**默认值**：`onMounted` 时优先取 `currentShortCode`，fallback 取 `provinceShortCode`。`currentShortCode` 具体含义取决于账号层级：城市账号时为用户城市，区县账号时为用户区县。


> 旧版遗留配置（`'henan'`、`'pingdingshan'` 等字符串）仍可正常读取，但会显示为原字符串，不再匹配动态选项。

---

## 4. 时间类型（`timeType`）对照

| 代码值 | 中文标签 | 说明 |
|-------|---------|------|
| `hourly` | 实时 | 官网最新可用时点数据 |
| `dt` | 累计 | 累计数据（日累计到当前时点） |
| `daily` | 日 | 单日数据 |

> 注意：`timeType` 与浓度排名页面的 `period` 含义不同。一张图的 `timeType` 只控制数据时间维度，不涉及 datetime/date 控件选择。

---

## 5. 地图类型（`mode`）对照

| 代码值 | 中文标签 | 说明 |
|-------|---------|------|
| `monitoring` | 监测图 | 显示站点监测数据分布 |
| `interpolation` | 插值图 | 显示污染物浓度空间插值 |

---

## 6. 污染因子（`factor`）对照

`factor` 字段来源于 `mapFactorOptions`，由“首要污染物”选项 + 浓度排名页面因子列表组成：

| URL 参数值 | 显示标签 | 说明 |
|-----------|---------|------|
| `primaryPollutant` | 首要污染物 | 仅为任务配置值，不直接进 URL；执行时由 agent 调用 MCP 工具 `mcp_city_common_get_air_quality_realtime_stat` 取 `maxPollutionEn` 解析为下表具体因子（`O3_8H`→`O3`；`"-"`/空→`AQI`） |
| `PM2.5` | PM₂.₅ | 可吸入细颗粒物（默认值） |
| `PM10` | PM₁₀ | 可吸入颗粒物 |
| `SO2` | SO₂ | 二氧化硫 |
| `NO2` | NO₂ | 二氧化氮 |
| `CO` | CO | 一氧化碳 |
| `O3` | O₃ | 臭氧 |
| `AQI` | AQI | 空气质量指数 |

---

## 6. 缩放等级（`zoom`）

| 属性 | 值 |
|------|-----|
| 类型 | `number` |
| 范围 | 3（最小，全球视图）– 16（最大，街道级） |
| 默认值 | 8 |

---

## 7. 截图参数

| 字段 | 说明 | 可选值 |
|------|------|-------|
| `screenshotScope` | 截图区域范围 | `mapOnly`（仅地图）、`mapLegend`（地图+图例）、`fullPage`（完整页面） |
| `theme` | 截图颜色主题 | `light`（浅色）、`dark`（深色） |

---

## 8. 任务 prompt 中的配置示例

```json
{
  "version": 1,
  "outputs": [
    {
      "id": "output-2",
      "capability": "mapairs-map-capture",
      "skill": null,
      "config": {
        "region": "1320a70ee",
        "timeType": "hourly",
        "mode": "monitoring",
        "factor": "PM2.5",
        "zoom": 8,
        "theme": "light",
        "windWaves": true,
        "screenshotScope": "mapLegend",
        "leftPanel": true
      }
    }
  ]
}
```

> 上例中 `region` 为用户城市的 `currentShortCode`（保定市）。若用户切换至省份则值为 `provinceShortCode`（如 `1309a14a1`），全国则为 `"national"`。区县账号（`currentRegionLevel=2`）下 `region` 还可取 `parentShortCode`（用户城市）或 `currentShortCode`（用户区县）。

---

## 9. 与浓度排名的关联

- 一张图的 `factor` 因子列表复用浓度排名的 `rankingFactorOptions`（`primaryPollutant` 已注释移除）
- 两者均使用 Playwright 自动化截图，预期脚本风格一致
- 目前浓度排名已有脚本 `mapairs-ranking-capture.py`，一张图尚未实现，需在 `mapairs-map-capture` 技能中补充

---

## 10. 当前已知限制

| 限制项 | 说明 | 影响 |
|-------|------|------|
| 无对应 Playwright 脚本 | `mapairs-map-capture` 技能尚未创建 | 一张图成果目前无法自动执行截图 |
| `timeType` 参数映射未验证 | 需确认页面时间控件选择逻辑 | 脚本实现时需对齐浓度排名的时间控件处理 |
| `zoom` 缩放范围无下限保护 | UI 限制 3–16，脚本需额外校验 | 超出范围可能导致截图无效 |

---

## 11. 相关文件

| 文件 | 作用 |
|------|------|
| `packages/client/src/views/hermes/CreateTask.vue` | 前端任务配置 UI（一张图配置面板） |
| `packages/skills/mapairs-map-capture/` | **待创建** — 一张图 Playwright 技能目录 |
| `packages/skills/mapairs-ranking-capture/scripts/mapairs_ranking_capture.py` | 浓度排名 Playwright 脚本（参考实现） |
| `docs/URL参数对照.md` | 浓度排名参数对照文档（参考格式） |
