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

## 2. 地图模式（`category`）

一张图配置顶层分为两种地图模式，影响后续所有配置项的可见性与可选值：

| 代码值 | 中文标签 | 说明 |
|-------|---------|------|
| `initial` | 初始 | 标准一张图模式，含地图范围、地图类型、缩放等级、左侧面板等 |
| `starground` | 星地模 | 星地模地图（卫星+地面模型），不含地图范围/类型，时间类型不同 |

---

## 3. Hermes 任务配置参数一览

CreateTask 前端表单收集的"一张图"配置项，类型与默认值：

### 3.1 通用配置（两种模式共有）

| Hermes 字段 | 类型 | 默认值 | 说明 |
|------------|------|--------|------|
| `category` | `'initial' \| 'starground'` | `'initial'` | 地图模式 |
| `theme` | `'light' \| 'dark'` | `'light'` | 截图颜色主题：浅色 / 深色 |
| `windWaves` | `boolean` | `true` | 是否开启风/海浪动画 |

### 3.2 初始地图（`category: 'initial'`）

| Hermes 字段 | 类型 | 默认值 | 说明 |
|------------|------|--------|------|
| `region` | `string` | 用户城市/区县（由 `onMounted` 根据账号层级自动设定） | 动态，见第 4 节 |
| `timeType` | `'hourly' \| 'dt' \| 'daily'` | `'hourly'` | 时间类型：实时 / 累计 / 日 |
| `mode` | `'monitoring' \| 'interpolation'` | `'monitoring'` | 地图类型：监测图 / 插值图 |
| `monitorFactor` | `string` | `'PM2.5'` | 监测图 - 点位值污染因子（见因子对照表） |
| `monitorLayer` | `string` | `''` | 监测图 - 地图图层（环境要素单选，见图层对照表） |
| `interpolationLayer` | `string` | `''` | 插值图 - 地图图层（污染因子+环境要素单选） |
| `zoomLevel` | `'site' \| 'city' \| 'custom'` | `'city'` | 缩放等级：站点层级 / 城市层级 / 自定义 |
| `zoomCustom` | `number` | `6` | 自定义缩放值（3–16），仅 `zoomLevel=custom` 时有效 |
| `leftPanelOpen` | `boolean` | `false` | 是否显示左侧面板 |
| `leftPanelZone` | `string` | `'city'` | 左侧面板展示区域，仅 `leftPanelOpen=true` 时有效（见展示区域对照表） |

### 3.3 星地模（`category: 'starground'`）

| Hermes 字段 | 类型 | 默认值 | 说明 |
|------------|------|--------|------|
| `starFactor` | `string` | `'PM2.5'` | 污染因子（同因子对照表） |
| `starTimeType` | `'hourly' \| 'daily' \| 'month'` | `'hourly'` | 时间类型：实时 / 日 / 月 |

---

## 4. 地图范围（`region`）对照

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

## 5. 时间类型对照

### 5.1 初始地图（`timeType`）

| 代码值 | 中文标签 | 说明 |
|-------|---------|------|
| `hourly` | 实时 | 官网最新可用时点数据 |
| `dt` | 累计 | 累计数据（日累计到当前时点） |
| `daily` | 日 | 单日数据 |

### 5.2 星地模（`starTimeType`）

| 代码值 | 中文标签 | 说明 |
|-------|---------|------|
| `hourly` | 实时 | 实时数据 |
| `daily` | 日 | 单日数据 |
| `month` | 月 | 月度数据 |

> 注意：`timeType` 与浓度排名页面的 `period` 含义不同。一张图的 `timeType` 只控制数据时间维度，不涉及 datetime/date 控件选择。

---

## 6. 地图类型（`mode`）对照

仅初始地图有此配置。

| 代码值 | 中文标签 | 说明 |
|-------|---------|------|
| `monitoring` | 监测图 | 显示站点监测数据分布 |
| `interpolation` | 插值图 | 显示污染物浓度空间插值 |

---

## 7. 污染因子对照

`monitorFactor`（初始监测图）和 `starFactor`（星地模）共用同一因子列表：

| 配置值 | 显示标签 | 说明 |
|-------|---------|------|
| `primaryPollutant` | 首要污染物 | 仅为任务配置值，不直接进 URL；执行时由 agent 调用 MCP 工具 `mcp_city_common_get_air_quality_realtime_stat` 取 `maxPollutionEn` 解析为下表具体因子（`O3_8H`→`O3`；`"-"`/空→`AQI`） |
| `PM2.5` | PM₂.₅ | 可吸入细颗粒物（默认值） |
| `PM10` | PM₁₀ | 可吸入颗粒物 |
| `SO2` | SO₂ | 二氧化硫 |
| `NO2` | NO₂ | 二氧化氮 |
| `CO` | CO | 一氧化碳 |
| `O3` | O₃ | 臭氧 |

---

## 8. 地图图层对照

仅初始地图有此配置，依地图类型不同可选值范围不同。

### 8.1 环境图层（监测图 `monitorLayer`）

| 配置值 | 中文标签 | 说明 |
|-------|---------|------|
| `wind` | 风 | 风向风速图层 |
| `temperature` | 温度 | 温度分布图层 |
| `humidity` | 相对湿度 | 湿度分布图层 |
| `rainfall` | 降雨 | 降雨量图层 |
| `radiation` | 辐射 | 辐射图层 |
| `pressure` | 气压 | 气压图层 |
| `visibility` | 能见度 | 能见度图层 |

### 8.2 全量图层（插值图 `interpolationLayer`）

插值图图层 = 污染因子（不含首要污染物）+ 环境图层：

| 配置值 | 中文标签 |
|-------|---------|
| `PM2.5` | PM₂.₅ |
| `PM10` | PM₁₀ |
| `SO2` | SO₂ |
| `NO2` | NO₂ |
| `CO` | CO |
| `O3` | O₃ |
| `wind` | 风 |
| `temperature` | 温度 |
| `humidity` | 相对湿度 |
| `rainfall` | 降雨 |
| `radiation` | 辐射 |
| `pressure` | 气压 |
| `visibility` | 能见度 |

---

## 9. 缩放等级对照

仅初始地图有此配置。

| 配置值 | 中文标签 | 说明 |
|-------|---------|------|
| `site` | 站点层级 | 缩放到站点级别 |
| `city` | 城市层级 | 缩放到城市级别（默认） |
| `custom` | 自定义 | 自定义缩放值，取 `zoomCustom`（3–16，默认 6） |

---

## 10. 左侧面板 / 展示区域对照

仅初始地图有此配置。

| 字段 | 类型 | 说明 |
|------|------|------|
| `leftPanelOpen` | `boolean` | 左侧面板开关：`true`=显示，`false`=关闭（默认） |
| `leftPanelZone` | `'city' \| 'site' \| 'pollutionSource'` | 面板展示区域：城市 / 站点 / 污染源（默认城市） |

---

## 11. 任务 prompt 中的配置示例

### 11.1 初始地图

```json
{
  "version": 1,
  "outputs": [
    {
      "id": "output-2",
      "capability": "mapairs-onemap-capture",
      "skill": "mapairs-onemap-capture",
      "config": {
        "theme": "light",
        "category": "initial",
        "windWaves": true,
        "mode": "monitoring",
        "region": "1320a70ee",
        "timeType": "hourly",
        "monitorFactor": "PM2.5",
        "monitorLayer": "wind",
        "interpolationLayer": "",
        "zoomLevel": "city",
        "zoomCustom": 6,
        "leftPanelOpen": false,
        "leftPanelZone": "city"
      }
    }
  ]
}
```

### 11.2 星地模

```json
{
  "version": 1,
  "outputs": [
    {
      "id": "output-3",
      "capability": "mapairs-onemap-capture",
      "skill": "mapairs-onemap-capture",
      "config": {
        "theme": "light",
        "category": "starground",
        "windWaves": true,
        "starFactor": "PM2.5",
        "starTimeType": "daily"
      }
    }
  ]
}
```

> 上例中 `region` 为用户城市的 `currentShortCode`（保定市）。若用户切换至省份则值为 `provinceShortCode`（如 `1309a14a1`），全国则为 `"national"`。区县账号（`currentRegionLevel=2`）下 `region` 还可取 `parentShortCode`（用户城市）或 `currentShortCode`（用户区县）。

---

## 12. 与浓度排名的关联

- 一张图的 `monitorFactor` / `starFactor` 因子列表复用浓度排名的 `rankingFactorOptions`
- 两者均使用 Playwright 自动化截图，预期脚本风格一致
- 目前浓度排名已有脚本 `mapairs-ranking-capture.py`，一张图脚本 `mapairs-onemap-capture` 待实现

---

## 13. 当前已知限制

| 限制项 | 说明 | 影响 |
|-------|------|------|
| 无对应 Playwright 脚本 | `mapairs-onemap-capture` 技能尚未创建 | 一张图成果目前无法自动执行截图 |
| `timeType` 参数映射未验证 | 需确认页面时间控件选择逻辑 | 脚本实现时需对齐浓度排名的时间控件处理 |
| `zoomCustom` 缩放范围无下限保护 | UI 限制 3–16，脚本需额外校验 | 超出范围可能导致截图无效 |
| `monitorLayer` / `interpolationLayer` 图层切换未验证 | 需确认页面图层控件交互逻辑 | 脚本实现时需验证图层选择操作 |

---

## 14. 相关文件

| 文件 | 作用 |
|------|------|
| `packages/client/src/views/hermes/CreateTask.vue` | 前端任务配置 UI（一张图配置面板） |
| `packages/skills/mapairs-onemap-capture/` | **待创建** — 一张图 Playwright 技能目录 |
| `packages/skills/mapairs-ranking-capture/scripts/mapairs_ranking_capture.py` | 浓度排名 Playwright 脚本（参考实现） |
| `docs/URL参数对照.md` | 浓度排名参数对照文档（参考格式） |
