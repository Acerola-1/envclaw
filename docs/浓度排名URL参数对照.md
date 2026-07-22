# 浓度排名查询参数对照文档

> **用途**：说明浓度排名页面（`/dataStatistics/concentrationranking`）各查询参数与 Playwright 自动化脚本（`mapairs_ranking_capture.py`）配置项的对应关系，供开发、测试和调试参考。
> **当前实现**：基于 Playwright 浏览器自动化的截图采集，**非 REST API**。所有参数通过 UI 操作完成。

---

## 1. 页面 URL 查询参数一览

浓度排名页面的 URL 形如：

```
https://www.mapairs.com/dataStatistics/concentrationranking
  ?theme=Dark
  &zone=city
  &province=4102950f2
  &region=411856cc4
  &query=
  &sTime=2026-07-20+09:00
  &eTime=
  &type=daily_count
  &index=PM2.5,PM10,SO2,NO2,CO,O3,AQI
```

| URL 参数 | 示例值 | 说明 | 是否必填 |
|---------|-------|------|---------|
| `theme` | `Dark` / `Light` | 页面主题：深色 / 浅色 | 否（默认 Dark） |
| `zone` | `city` | `city` / `site` 查询对象：城市 / 站点 | 是 |
| `province` | `4102950f2` | 省/大区 regionKeyVO | 是 |
| `region` | `411856cc4` | 城市 regionKeyVO（如平顶山市） | 是 |
| `query` | 空 / `1` | 查询层级：空=城市级；`1`=区县级账号 | 否 |
| `sTime` | `2026-07-20 09:00` | 查询起始时间（HH:mm 格式） 填空为最新时间 | 否（默认最新可用） |
| `eTime` | `2026-07-20 09:00` | 查询结束时间（HH:mm 格式） | 否（默认=起始时间） |
| `type` | `daily_count` | 时间类型（见下方对照表） | 是 |
| `index` | `PM2.5,PM10,SO2,NO2,CO,O3,AQI` | 污染因子，逗号分隔 | 是 |
| `stationType` | `S-100` | 站点类型，逗号分隔 | zone='site' 必填 |
| `station` | 空 / `410514b0b` | 站点，逗号分隔，默认空代表全部站点 | zone='site' 必填 |

---

## 2. Hermes 任务配置参数一览

CreateTask 前端表单收集的配置项，与脚本输入 config 的对应关系：

| Hermes 字段 | 类型 | 说明 | 脚本接收 |
|------------|------|------|---------|
| Hermes 字段 | 类型 | 说明 | 脚本接收 |
|------------|------|------|---------|
| `zone` | `city` / `site` | 查询对象：城市排名 / 站点排名 | ✅ `config.zone` |
| `province` | string | 省/大区 regionKeyVO（由行政区选择推导） | ❌ 仅前端展示用，脚本不使用 |
| `region` | string | 逗号分隔的 regionKeyVO，**脚本仅支持单 region**（多 region 传第一个） | ✅ `config.region` |
| `type` | string | 时间类型（见下方对照表） | ✅ `config.type` |
| `factors` | string[] | 污染因子编码列表，**需做 Unicode 下标转换** | ✅ `config.factors` |
| `theme` | `light` / `dark` | 截图颜色主题 | ✅ `config.theme` |
| `screenshotScope` | `tableOnly` / `withFilters` | 截图区域范围 | ✅ `config.screenshotScope` |
| `stationType` | string | 站点类型：多选逗号分隔（如 `S-100,S-10`） | ✅ Hermes config 存储，脚本**暂不支持** |
| `station` | string[] | 已选站点 shortCode 列表：浓度排名通过 V5 API 动态加载；小时播报/监测数据为硬编码列表 | ✅ Hermes config 存储，脚本**暂不支持** |
| `includeScreenshot` | boolean | 是否生成排名截图 | — |
| `includeAnalysis` | boolean | 是否生成数据分析摘要 | — |

> ⚠️ 脚本只接收 6 个参数：`zone`、`region`、`type`、`factors`、`theme`、`screenshotScope`。`stationType` 和 `station` 已存储在 Hermes config 中，但脚本尚未实现对它们的 UI 操作。其余字段仅用于前端展示和 task 任务描述。

---

## 3. 时间类型（`type`）对照

| URL 参数值 | 中文标签 | Playwright 配置值 | 日期控件类型 | 说明 |
|-----------|---------|-----------------|------------|------|
| `hourly` | 实时 | `hourly` | `el-date-editor--datetime`（日期+时间） | 最新可用时点 |
| `hour_avg` | 小时均值 | `hour_avg` | `el-date-editor--date`（仅日期） |  |
| `daily_count` | 日累计 | `daily_count` | `el-date-editor--datetime`（日期+时间） | 当日累计到所选时点 |
| `daily` | 日 | `daily` | `el-date-editor--date`（仅日期） | 单日数据 |
| `daily` | 逐日累计 | `daily` | `el-date-editor--date`（仅日期） | 多日累计数据 |
| `month` | 月 | `month` | `el-date-editor--date`（仅日期） | 月度汇总 |
| `year` | 年 | `year` | `el-date-editor--date`（仅日期） | 年度汇总 |
| `other` | 自定义 | `other` | — | 当前脚本**不支持**，需扩展 |

> **关键差异**：`hourly` 和 `daily_count`（日累计）使用 **datetime** 控件（需 sTime/eTime 带时分）；其余类型使用 **date-only** 控件（仅日期，忽略时分）。

---

## 4. 污染因子（`index`）对照

| URL 参数值 | 显示标签 | 脚本 FACTORS 列表 | 说明 |
|-----------|---------|------------------|------|
| `PM2.5` | PM₂.₅ | `PM₂.₅` | 可吸入细颗粒物 |
| `PM10` | PM₁₀ | `PM₁₀` | 可吸入颗粒物 |
| `SO2` | SO₂ | `SO₂` | 二氧化硫 |
| `NO2` | NO₂ | `NO₂` | 二氧化氮 |
| `CO` | CO | `CO` | 一氧化碳 |
| `O3` | O₃ | `O₃` | 臭氧 |
| `AQI` | AQI | `AQI` | 空气质量指数 |
| `O3_8H` | O₃-8h | — | **脚本暂不支持** |
| `TSP` | TSP | — | **脚本暂不支持** |

> **注意**：URL 参数使用半角数字（`PM2.5`），脚本 FACTORS 使用 Unicode 下标（`PM₂.₅`）。传递时需做字符转换。

---

## 5. 站点类型与站点名称

### 5.1 站点类型（`stationType`）

| 站点类型 | 代码 | 说明 |
|---------|-----|------|
| 标准站 | `S-100` | 默认类型 |
| 国控站 | `S-10` | 国家控制站 |
| 省控站 | `S-11` | 省级控制站 |
| 市控站 | `S-12` | 市级控制站 |
| 对比站 | `S-13` | 对比监测站 |
| 乡镇站 | `S-14` | 乡镇级站点 |
| 微站 | `S-15` | 微型监测站 |
| TVOC站 | `S-16` | 总挥发性有机物站 |
| 粉尘站 | `S-17` | 粉尘监测站 |
| 高密度站 | `S-18` | 高密度监测站 |

### 5.2 站点名称（`station`）

**浓度排名**：站点列表通过 V5 API（`fetchStationList`）动态获取，参数为 `province` + `region` + `stationType`，返回扁平列表。按类型分组存储于 `rankingStationListByType`，支持多选。

**小时播报 / 监测数据**：站点列表为硬编码（`STATION_NAME_OPTIONS`），按站点类型分组，单选站点类型。

> 浓度排名配置项 `stationType` 为多选（逗号分隔），`station` 为已选站点 shortCode 数组；小时播报/监测数据 `stationType` 为单选字符串，`station` 为已选站点数组。

---

## 6. 完整参数 → Playwright 配置映射表

| URL 参数 | Playwright config 字段 | 映射规则 |
|---------|----------------------|---------|
| `theme` | `config.theme` | `Dark` → `"dark"`，`Light` → `"light"` |
| `region` | `config.region` | 直接映射到脚本硬编码 REGIONS key（如 `"pingdingshan"`、`"xinhua"`）；`province` 不参与脚本配置 |
| `query` | `config.zone` | 空 → `"city"`；`"1"` → `"site"` |
| `type` | `config.type` | 直接透传（如 `"daily_count"` → `"daily_count"`，无需转换） |
| `sTime` / `eTime` | — | 当前脚本**不使用**；使用"官网最新可用时间"，通过 UI 查询按钮触发 |
| `index` | `config.factors` | 逗号分隔 → 数组，并做 Unicode 下标转换 |
| `stationType` | — | Hermes config 已存储（浓度排名多选，小时播报/监测数据单选）；脚本**暂未实现**对站点类型按钮的 UI 操作 |
| `station` | — | 当前脚本**不支持**；需扩展脚本以支持站点多选 |

---

## 7. 截图参数

| 参数 | 说明 | 可选值 |
|------|------|-------|
| `screenshotScope` | 截图区域范围 | `tableOnly`（仅表格+标题）、`withFilters`（含查询条件区） |
| `theme` | 截图颜色主题 | `light`（浅色）、`dark`（深色） |

---

## 8. 脚本执行流程

```
mapairs_ranking_capture.py --config-json '{
  "zone": "city",
  "region": "pingdingshan",
  "type": "daily_count",
  "factors": ["AQI", "PM₂.₅", "O₃"],
  "theme": "light",
  "screenshotScope": "tableOnly"
}'
```

**执行步骤**：
1. 登录 `https://mapairs.com/lock`（凭据来自 `MAPAIRS_USERNAME` / `MAPAIRS_PASSWORD` 环境变量）
2. 点击"数据分析"菜单 → 点击"浓度排名"
3. 等待页面加载到 `concentrationranking` 路由
4. 设置查询对象（城市/站点 radio）
5. 设置行政区（通过 cascader 遍历 `REGION_PATHS`）
6. 设置污染因子（el-select 勾选）
7. 设置时间类型（点击标签按钮）
8. 点击"查询"按钮，等待表格数据渲染
9. 按 `theme` 切换颜色主题
10. 按 `screenshotScope` 计算裁剪区域并截图

---

## 9. 当前已知限制

| 限制项 | 说明 | 影响 |
|-------|------|------|
| 不支持自定义时间范围（`type=other`） | 脚本仅支持 5 种固定时间类型 | 无法实现用户指定起止时间 |
| 脚本不支持站点类型/站点名称筛选 | Hermes config 已存储 stationType 和 station（浓度排名通过 V5 API 动态加载，小时播报/监测数据为硬编码列表），但脚本尚未实现对站点类型按钮和站点选择器的 UI 操作 | 站点查询时无法指定具体站点类型和站点 |
| 地区仅支持硬编码列表 | `REGIONS` / `REGION_PATHS` 硬编码在脚本中 | 新增城市需修改代码 |
| `index` 字符编码差异 | URL 用半角数字，脚本用 Unicode 下标 | 需做字符转换 |
| `sTime`/`eTime` 被忽略 | 脚本始终使用"官网最新可用时间" | 无法指定历史时间点 |
| 多 region 仅使用第一个 | 脚本 `config.region` 只接受单个 region key，多行政区逗号拼接时仅第一个生效 | 无法实现多行政区同时查询 |
| `province` 不参与脚本配置 | 脚本无 `province` 参数，仅靠 `region` key 定位 | 前端 province 字段仅用于展示和 API 请求，对脚本无效 |

---

## 10. 相关文件

| 文件 | 作用 |
|------|------|
| `packages/skills/mapairs-ranking-capture/scripts/mapairs_ranking_capture.py` | Playwright 自动化主脚本 |
| `packages/skills/mapairs-ranking-capture/SKILL.md` | 技能定义与使用方式 |
| `packages/client/src/views/hermes/CreateTask.vue` | 前端任务配置 UI（浓度排名配置面板） |
| `packages/server/src/services/v5/region-tree.ts` | V5 城市级联树代理（AES-128-CBC 加密模式参考） |
| `packages/client/src/api/hermes/city-tree.ts` | 前端城市级联树 API 调用 |
| `packages/client/src/features/envclaw/ranking-duty-demo.ts` | 浓度排名值示范型定义 |
