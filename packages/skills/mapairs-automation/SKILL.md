---
name: mapairs-automation
description: "Mapairs.com (数智大气/IPP-AIR) 空气质量监测平台操作指南。包含页面结构、登录流程、功能入口、数据查询等完整操作手册，支持 agent-browser CLI 和浏览器工具两种交互方式。当用户提到 mapairs.com、数智大气、IPP-AIR、空气质量监测平台、大气数据可视化时，应加载此技能。"
tags: [mapairs, "mapairs.com", 数智大气, ipp-air, 空气质量, 大气数据, 环境监测, "agent-browser", "website-guide", "air-quality", screenshot, automation]
related_skills: [mapairs-automation]
---

# Mapairs.com Automation

Use this skill when automating https://www.mapairs.com/ — the air quality monitoring platform. Covers login, page navigation, Element Plus UI interaction, agent-browser CLI screenshots, and data extraction for any city or region.

## Site Overview

- **URL**: https://www.mapairs.com/ (external) or http://192.168.4.25:8090/ (internal)
- **Framework**: Vue 3 + Nuxt + Element Plus + Mapbox GL JS
- **Auth**: Account/password login via modal dialog, JWT stored in `localStorage('saber-token')`

## Credentials（多地区账号）

| 地区 | 用户名 | 密码 | 默认城市 |
|------|--------|------|----------|
| 保定市 | `zhangn` | `yutu@124` | 保定市（河北省） |
| 平顶山市 | `X-mojl` | `yutu@889` | 平顶山市（河南省） |

> ⚠️ 如果用户询问其他地区的账号，请先询问能否提供该地区的账号密码，获得后再收入此技能中。

## Key URLs

| Page | External | Internal |
|------|----------|----------|
| Login/首页 | `https://www.mapairs.com/` | `http://192.168.4.25:8090/` |
| 一张图 | `https://www.mapairs.com/onemap/default` | `http://192.168.4.25:8090/onemap/default` |
| 浓度排名 | `https://www.mapairs.com/dataStatistics/concentrationranking` | `http://192.168.4.25:8090/dataStatistics/concentrationranking` |

## Prerequisites

### agent-browser CLI（必需）

截图脚本 `scripts/pingdingshan_ranking.py` 使用 **agent-browser CLI** 操作浏览器截图。

**安装命令：**
```bash
npm install -g agent-browser
```

**脚本自动检测：** 脚本启动时会自动检测 agent-browser 是否安装。如果未安装，会输出明确错误提示并退出，不会静默失败。

### 检查 agent-browser 是否已安装
```bash
agent-browser --version
```

当 agent-browser 未安装时，可用 Hermes 浏览器工具直接操作：
- `browser_navigate` — 打开页面
- `browser_console` — 执行 JS（**注意：必须用单行表达式，多行会返回 null**）
- `browser_click` — 点击元素（通过 ref ID）
- `browser_type` — 输入文本（通过 ref ID）
- `browser_vision` — 截图 + AI 分析
- `browser_press` — 按键（如 Escape）

⚠️ **browser_console 关键陷阱**：多行 JS 表达式会返回 `null`！必须用分号分隔的单行表达式：
```javascript
// ❌ 多行 — 返回 null
var nodes = document.querySelectorAll('.el-cascader-node');
for (var i = 0; i < nodes.length; i++) { ... }
result;

// ✅ 单行 — 正常返回
var nodes = document.querySelectorAll('.el-cascader-node'); var result = []; for (var i = 0; i < nodes.length; i++) { result.push(nodes[i].textContent.trim()); } result;
```

## Login Flow

The login entry is **NOT a labeled "登录" button**. It is a **user icon** (circular silhouette) at the far top-right corner. Click `.loginBg` via JS:

### agent-browser Login (scripts)

The `pingdingshan_ranking.py` script logs in via `agent-browser evaluate` with Vue-native value setter:

```python
# agent-browser evaluate executes JS in the page context
subprocess.run(["agent-browser", "evaluate", js_code])

# Vue 3 reactive input value setter (paste into evaluate or browser_console):
js_fill = """() => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    for (const i of document.querySelectorAll('input')) {
        if (i.placeholder?.includes('账号')) {
            i.removeAttribute('readonly'); i.focus();
            s.call(i, 'X-mojl');
            i.dispatchEvent(new Event('input', {bubbles: true}));
            i.dispatchEvent(new Event('change', {bubbles: true}));
        }
        if (i.placeholder?.includes('密码')) {
            i.removeAttribute('readonly'); i.focus();
            s.call(i, 'yutu@889');
            i.dispatchEvent(new Event('input', {bubbles: true}));
            i.dispatchEvent(new Event('change', {bubbles: true}));
        }
    }
    return 'done';
}()"""
```

Then click login button and verify token:

```python
subprocess.run(["agent-browser", "evaluate", """() => {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
        if (btn.textContent?.trim() === '登录') { btn.click(); return true; }
    }
    return false;
}()"""])
# Verify: localStorage.getItem('saber-token')
```

### Hermes Browser Console Login (interactive)

**方法1: browser_type（推荐，最简单）**

```javascript
// 1. 点击登录图标
document.querySelector('.loginBg').click()
// 2. 等待对话框出现，用 browser_snapshot 找到 ref
// 3. 用 browser_type 直接输入（会自动清空并输入）
//    browser_type ref=e44 text="X-mojl"    // 账号
//    browser_type ref=e45 text="yutu@889"   // 密码
// 4. 用 browser_click 点击登录按钮
// 5. 验证: localStorage.getItem('saber-token')
```

**方法2: browser_console + Vue value setter（复杂场景）**

```javascript
// 1. Click login icon
document.querySelector('.loginBg').click()
// 2. Fill username/password via Vue value setter (see JS above)
// 3. Click login button
// 4. Verify: localStorage.getItem('saber-token')
```

### Post-Login State

- Token: `localStorage.getItem('saber-token')` returns JWT (`eyJ0eXAi...`)
- Dashboard shows "总体态势" tab
- Left menu: 总体态势, 一张图, 数据分析, 热点网格, 预测预报, 大气遥感, 溯源分析

## City Switching via localStorage

```javascript
// Get province/city data first:
JSON.parse(localStorage.getItem('yesprovinces') || '[]')

// Then set new region:
const newRegionList = {
    provinceShortCode: "41",        // province code
    provinceName: "河南省",
    parentShortCode: "41",
    parentName: "河南省",
    currentShortCode: "410400",     // city regionKeyVO
    currentRegionName: "平顶山市",
    currentRegionLevel: 1,
    virtualCode: "-"
};
localStorage.setItem('regionList', JSON.stringify(newRegionList));
localStorage.setItem('is_province', '0');
// Refresh page to apply
```

## Screenshots via agent-browser CLI

`agent-browser screenshot <path>` uses CDP under the hood — no special handling needed for Mapbox.

### From Python script

```python
import subprocess
result = subprocess.run(["agent-browser", "screenshot", "/path/to/output.png"],
    capture_output=True, text=True, timeout=20)
```

### From shell / cron

```bash
agent-browser screenshot ~/Desktop/mapairs_screenshots/rank_province_$(date +%Y%m%d_%H%M%S).png
```

### Safe file size

- Screenshots < 200 KB → page not fully loaded
- Screenshots > 250 KB → normal

## Browser-based Data Extraction (替代截图)

When screenshots fail (agent-browser not installed, timeout, etc.), extract table data directly via JS:

```javascript
// Extract all table rows
const rows = document.querySelectorAll('.el-table__body tr');
const result = [];
for (const row of rows) {
    const cells = row.querySelectorAll('td');
    result.push(Array.from(cells).map(c => c.textContent?.trim()));
}
return result;
```

### Table Structure (浓度排名)

Each row = a rank position. Column pairs show (city_name, value) for the city holding that rank:

```
[排名, 综指城市, 综指值, PM2.5城市, PM2.5值, PM10城市, PM10值,
 SO2城市, SO2值, NO2城市, NO2值, CO城市, CO值, O3城市, O3值,
 AQI城市, AQI值, 等级, 首要污染物]
```

**To find a specific city's values**, scan each metric column pair for the target city name (e.g., `col[1]` = 综指 city, `col[2]` = its value). A city may rank differently across metrics.

## 城市/站点 Mode

| Mode | Shows | Cascader Panels | Use Case |
|------|-------|-----------------|----------|
| **城市** | Province-level city ranking | 省 → 市 (2 panels, panel 2+ empty) | 全省地市排名 |
| **站点** | City-level district/station ranking | 省 → 市 → 区县 (4 panels total: 0=省, 1=市, 2=区县, 3=empty) | 各区县/站点排名 |

**Critical**: In "城市" mode the third panel is empty. Switch to "站点" for districts.

⚠️ **Panel index pitfall**: "站点" mode has **4 panels** (not 3). Panel index 3 is always empty. When selecting "全部" for districts, target **panel index 2** (not the last panel). Use `document.querySelectorAll('.el-cascader-menu')[2]` to access the districts panel.

### Switching Mode

```javascript
const radios = document.querySelectorAll('.el-radio, .el-radio-button');
for (const r of radios) {
    if (r.textContent?.trim() === '站点') { r.click(); break; }
}
```

### el-cascader (级联选择器) — Vue 3 Tricks

- **Hidden checkbox**: `input[type="checkbox"]` is invisible. Click `.el-checkbox__inner` instead.
- **Opening the cascader (reliable method)**: 点击 textbox "请选择" 的 ref 有时不生效。更可靠的方式是用 JS 直接点击 cascader 内部的 input：
  ```javascript
  document.querySelector('.el-cascader').querySelector('input').click()
  ```
  如果还不行，尝试点击 cascader 父容器：`document.querySelector('.el-cascader').click()`
- **Clearing selections** before reopening the cascader:

```javascript
// Close tags
for (let i = 0; i < 5; i++) {
    const tags = document.querySelectorAll('.el-cascader .el-tag .el-tag__close');
    if (tags.length > 0) { tags[0].click(); }
}
// Uncheck nodes
const checked = document.querySelectorAll('.el-cascader-node.is-checked');
for (const node of checked) {
    const box = node.querySelector('.el-checkbox__inner');
    if (box) box.click();
}
```

- **After selection**, press Escape to close panel before clicking 查询.
- **Critical**: Do NOT select the province/city itself — only select its children (下一级). Selecting both adds a spurious "汇总" row.

### el-radio-group (时间类型)

Select "日累计" (daily cumulative) — NOT 实时:

```javascript
const radios = document.querySelectorAll('.el-radio, .el-radio-button');
for (const r of radios) {
    if (r.textContent?.trim() === '日累计') { r.click(); break; }
}
```

## State Reset Between Screenshots

**Navigate fresh** between screenshots — cascader/map state accumulates:

```javascript
// Navigate via agent-browser
subprocess.run(["agent-browser", "open", "https://www.mapairs.com/dataStatistics/concentrationranking"])
// Wait 15-20s for page load
time.sleep(15)
```

## Workflows

### Concentration Ranking — 双截图

1. **Screenshot 1 (全省地市排名)**: Use "城市" mode. Open cascader, deselect all, navigate to province, select all cities (not province itself), switch to 日累计, click 查询, screenshot.
2. **Screenshot 2 (各区排名)**: Navigate fresh, switch to "站点" mode. Open cascader (3 panels), navigate 省→市, select all districts, switch to 日累计, click 查询, screenshot.

**Quick run**:
```bash
python3 ~/.hermes/skills/mapairs-automation/scripts/pingdingshan_ranking.py
```

### One-Map View (一张图)

Mapbox GL JS map instance is hidden in Vue 3 — cannot `flyTo()`. Use zoom buttons instead:

```javascript
const allEls = document.querySelectorAll('*');
for (const el of allEls) {
    if (el.textContent?.trim() === '平顶山市' && el.children.length === 0) {
        el.click(); break;
    }
}
// Wait 12s for tiles
```

## 截图发送格式

**重要**：在输出截图时，必须使用 `MEDIA:` 标签格式，否则微信/QQ 会显示文件路径而不是图片。

### ⚠️ Windows 平台路径处理

Windows 上 Python `os.path.join()` 生成的是反斜杠路径（`\`），但 **微信 `MEDIA:` 标签只支持正斜杠（`/`）**。

**正确做法**：在脚本输出 `MEDIA:` 标签前，将路径中的 `\` 替换为 `/`：

```python
def to_media_path(p):
    """Windows 路径转正斜杠（微信 MEDIA: 标签只支持正斜杠）"""
    return p.replace("\\", "/") if p else p

# 输出时
print(f"\nMEDIA:{to_media_path(screenshot_path)}")
```

### 正确格式
MEDIA:/path/to/rank_province_20260625_090000.png
MEDIA:/path/to/rank_city_20260625_090000.png
```

系统自动下载并作为图片发送到微信/QQ。

## Cron Debugging

### Diagnostic Sequence

1. **Check `last_run_at`**: If null, the scheduler hasn't picked up the job — start with `hermes cron status`, not model debugging.
2. **Check `last_status`**: "ok" means the agent completed its loop. Does NOT mean screenshots succeeded — verify output files exist on disk.
3. **Critical: don't repeat model diagnosis** — if the user says they already fixed the provider/config, **accept it** and move on to checking scheduler, runtime, and prerequisites. Repeating the same diagnosis frustrates the user.

### Common Failure Modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| `last_run_at` stays null | Scheduler not running | `hermes cron schedule` or restart gateway |
| `last_status: "ok"` but no screenshots | agent-browser not installed | `npm install -g agent-browser` |
| Screenshots < 200 KB | Page not fully loaded | Increase wait time after navigation |
| Screenshots sent but user sees nothing | Delivery format wrong | Use `weixin:CHAT_ID` not bare `weixin` |

## Scripts

- `scripts/pingdingshan_ranking.py` — Pingdingshan 浓度排名双截图 + 数据分析（agent-browser 版，推荐）

## References

- `references/concentration-ranking.md` — 浓度排名操作详情
- `references/pingdingshan-workflow.md` — 平顶山市工作流
- `references/pingdingshan-ranking-parsing.md` — 数据分析与报告模板
- `references/wechat-cron-delivery.md` — 微信推送配置
- `references/browser-tools-workflow.md` — 浏览器工具降级方案（agent-browser 不可用时）

## Pitfalls

- **agent-browser 推荐但非必需** — 未安装时可用 browser_* 工具降级操作
- **browser_console 多行 JS 返回 null** — 必须用分号分隔的单行表达式，否则返回 null 导致反复失败
- **URL navigation most reliable** — don't use sidebar menus
- **agent-browser evaluate** is the primary interaction method for Vue 3 reactive inputs
- **Close cascader panel before clicking 查询** — press Escape first
- **Mapbox flyTo unavailable** — map instance hidden; use zoom buttons
- **Screen timeout** — keep script under 90-120s per screenshot
- **user's config fix**: If user says they already fixed a config/provider issue, accept it immediately and move on
- **Cascader 打开方式** — 点击 textbox "请选择" 的 ref 有时不生效，用 JS `document.querySelector('.el-cascader').querySelector('input').click()` 更可靠
- **页面状态累积** — 截图之间必须 navigate fresh，否则 cascader/选择状态会累积导致数据错误
- **Cascader panel index 陷阱** — "站点"模式有 4 个 panel（index 0-3），panel 3 始终为空。选区县"全部"时必须用 `panels[2]`（不是最后一个 panel）。用 `document.querySelectorAll('.el-cascader-menu').length` 确认实际 panel 数量
