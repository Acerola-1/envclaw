---
name: mapairs-automation
description: "Mapairs.com (数智大气/IPP-AIR) 空气质量监测平台操作指南。包含页面结构、登录流程、功能入口、数据查询等完整操作手册，使用 agent-browser 进行网页交互。当用户提到 mapairs.com、数智大气、IPP-AIR、空气质量监测平台、大气数据可视化时，应加载此技能。"
tags: ["mapairs", "mapairs.com", "数智大气", "ipp-air", "空气质量", "大气数据", "环境监测", "agent-browser", "playwright", "website-guide", "air-quality", "screenshot", "automation"]
related_skills: ["mapairs-automation"]
---

# Mapairs.com Automation

Use this skill when automating https://www.mapairs.com/ — the air quality monitoring platform. Covers login, page navigation, Element Plus UI interaction, CDP screenshots, and data extraction for any city or region.

For general Playwright patterns (element finding, form filling, SPA pitfalls), see `browser-automation` skill. This skill focuses on mapairs.com-specific knowledge.

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

## Login Flow

The login entry is **NOT a labeled "登录" button**. It is a **user icon** (circular silhouette) at the far top-right corner. Use `browser_vision(annotate=True)` to find it, or click `.loginBg` via JS.

### Playwright Login (for scripts)

Vue 3 reactive inputs require native value setter + event dispatch:

```python
safe_eval(page, """() => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    for (const i of document.querySelectorAll('input')) {
        if (i.placeholder?.includes('账号')) { 
            i.removeAttribute('readonly'); i.focus();
            s.call(i, 'zhangn');
            i.dispatchEvent(new Event('input', {bubbles: true}));
            i.dispatchEvent(new Event('change', {bubbles: true}));
        }
        if (i.placeholder?.includes('密码')) {
            i.removeAttribute('readonly'); i.focus();
            s.call(i, 'yutu@124');
            i.dispatchEvent(new Event('input', {bubbles: true}));
            i.dispatchEvent(new Event('change', {bubbles: true}));
        }
    }
}""")
```

### Browser Tool Login (interactive sessions)

```
1. browser_console: document.querySelector('.loginBg').click()
2. Wait for dialog (check snapshot has dialog element)
3. browser_type: username ref → "zhangn"
4. browser_type: password ref → "yutu@124"
5. browser_click: login button ref
6. browser_console: localStorage.getItem('saber-token') — verify token exists
```

### Post-Login State

- Token: `localStorage.getItem('saber-token')` returns JWT (`eyJ0eXAi...`)
- Dashboard shows "总体态势" tab
- Left menu: 总体态势, 一张图, 数据分析, 热点网格, 预测预报, 大气遥感, 溯源分析

## City Switching via localStorage

The default city depends on the account (e.g., "保定市" for zhangn). Switch by modifying `localStorage('regionList')`:

```python
def switch_city(page, province_name, city_name):
    """Switch city via localStorage modification."""
    safe_eval(page, f"""() => {{
        const provinces = JSON.parse(localStorage.getItem('yesprovinces') || '[]');
        const province = provinces.find(p => p.fullName === '{province_name}');
        if (!province) return 'province not found';
        const city = province.children?.find(c => c.fullName?.includes('{city_name}'));
        if (!city) return 'city not found';
        const newRegionList = {{
            provinceShortCode: province.provinceCodeVO,
            provinceName: province.fullName,
            parentShortCode: province.provinceCodeVO,
            parentName: province.fullName,
            currentShortCode: city.regionKeyVO,
            currentRegionName: city.fullName,
            currentRegionLevel: 1,
            virtualCode: "-"
        }};
        localStorage.setItem('regionList', JSON.stringify(newRegionList));
        localStorage.setItem('is_province', '0');
    }}""")
    # Refresh page to apply
    page.goto(url, timeout=60000, wait_until="domcontentloaded")
    time.sleep(15)
```

**Key**: `yesprovinces` contains all province/city `regionKeyVO` codes. After modification, refresh the page.

## CDP Screenshots (Required for Mapbox pages)

`page.screenshot()` fails on Mapbox pages — always use CDP:

```python
def cdp_ss(page, context, path):
    cdp = None
    try:
        cdp = context.new_cdp_session(page)
        r = cdp.send("Page.captureScreenshot", {"format": "png"})
        with open(path, "wb") as f:
            f.write(base64.b64decode(r["data"]))
        return os.path.getsize(path)
    finally:
        if cdp:
            try: cdp.detach()
            except: pass
```

## Element Plus UI Patterns

### el-cascader (级联选择器)

**Critical**: `input[type="checkbox"]` is hidden — click `.el-checkbox__inner` instead:

```python
# ✅ Correct
checkbox_inner = node.locator('.el-checkbox__inner').first
checkbox_inner.click()

# ❌ Wrong — "Element is outside of the viewport"
node.locator('input[type="checkbox"]').click()
```

**Clearing selections** before opening the cascader (multi-select mode causes data mixing):

```python
def clear_all_selections(page):
    """Remove all selected tags and panel checkboxes."""
    for _ in range(5):
        cleared = safe_eval(page, """() => {
            const tags = document.querySelectorAll('.el-cascader .el-tag .el-tag__close');
            if (tags.length > 0) { tags[0].click(); return true; }
            return false;
        }""")
        if not cleared:
            break
        time.sleep(0.5)
    safe_eval(page, """() => {
        const checked = document.querySelectorAll('.el-cascader-node.is-checked');
        for (const node of checked) {
            const box = node.querySelector('.el-checkbox__inner');
            if (box) box.click();
        }
    }""")
    time.sleep(1)
```

**After selection**, press Escape to close the panel before clicking query.

### el-radio-group (时间类型)

Select "日累计" (daily cumulative):

```python
safe_eval(page, """() => {
    const radios = document.querySelectorAll('.el-radio, .el-radio-button');
    for (const r of radios) {
        if (r.textContent?.trim() === '日累计') { r.click(); return true; }
    }
    return false;
}""")
```

## State Reset Between Screenshots

**Critical**: Navigate to the target page fresh between screenshots — cascader/map state accumulates and causes timeouts:

```python
def reset_and_navigate(page, url):
    try:
        page.goto(url, timeout=60000, wait_until="domcontentloaded")
    except: pass
    time.sleep(15-20)
    safe_eval(page, """() => { for (const b of document.querySelectorAll('button')) { 
        if (b.textContent?.trim() === '取消') { b.click(); break; } } }""")
    time.sleep(2)
    for _ in range(2):
        page.keyboard.press("Escape")
        time.sleep(0.3)
```

## Workflows

### Concentration Ranking (浓度排名)

See `references/concentration-ranking.md` for the dual-screenshot workflow (province-level + city-level rankings).

**Quick run**:
```bash
python3 ~/.hermes/skills/web-automation/mapairs-automation/scripts/mapairs_dual_screenshot.py
```
Edit `CITY_NAME` variable for different cities.

### One-Map View (一张图)

Used for geographic air quality visualization. Mapbox GL JS map instance is hidden in Vue 3 component tree — cannot access `flyTo()`. Use zoom buttons instead:

```python
def click_zoom_button(page, text):
    """Click right-side zoom button (全国/河南省/平顶山市)."""
    safe_eval(page, f"""() => {{
        const allEls = document.querySelectorAll('*');
        for (const el of allEls) {{
            if (el.textContent?.trim() === '{text}' && el.children.length === 0) {{
                el.click();
                return true;
            }}
        }}
        return false;
    }}""")
    time.sleep(12)  # Wait for map tiles to load
```

### Pingdingshan IPP-AIR (三截图)

See `references/pingdingshan-workflow.md` for the three-screenshot workflow (河南省 map + 平顶山市 map + concentration ranking).

**Quick run**:
```bash
python3 ~/.hermes/skills/web-automation/mapairs-automation/scripts/pingdingshan_screenshot.py
```

## Province Mapping

```python
PROVINCE_MAP = {
    "杭州市": "浙江省", "宁波市": "浙江省", "温州市": "浙江省",
    "郑州市": "河南省", "洛阳市": "河南省", "平顶山市": "河南省",
    "成都市": "四川省", "广州市": "广东省", "武汉市": "湖北省",
    "南京市": "江苏省", "苏州市": "江苏省", "济南市": "山东省",
    # ... extend as needed
}
```

## DOM Structure

### 一张图页面
```
#__nuxt
  .top (顶部导航)
  [Map] (Mapbox 地图区域)
  .right_l (右侧面板)
  .map-control-zoom (缩放按钮)
```

### 浓度排名页面
```
#__nuxt
  .menuBox (侧边栏)
  .data-content
    .right-side
      .choice_list (筛选栏: 行政区 cascader + 时间 radio)
      .data_list (.el-table 排名表格)
```

## Pitfalls

- **CDP required** — `page.screenshot()` fails on Mapbox pages
- **URL navigation most reliable** — don't use sidebar menus
- **Safe file size** — screenshots <200K = page not loaded, >250K = normal
- **safe_eval wrapper** — prevents JS execution hanging the script
- **Script timeout** — keep under 90-120s to avoid EPIPE
- **Close panel before query** — must press Escape after cascader selection
- **Mapbox flyTo unavailable** — map instance hidden in Vue 3 tree, use zoom buttons
- **agent-browser empty snapshot** — `browser_snapshot` returns empty on mapairs.com because Hermes browser tools and `agent-browser` CLI use different browser instances. Use `agent-browser` CLI via `terminal()` instead — its snapshot works:
  ```bash
  agent-browser open http://192.168.4.25:8090/lock
  agent-browser snapshot        # Full accessibility tree
  agent-browser click @e8       # Click by ref
  agent-browser screenshot /tmp/result.png
  ```
  See `browser-automation` skill for the "Hermes vs CLI different instances" section.

## 截图发送格式

**重要**：在输出截图时，必须使用 `MEDIA:` 标签格式，否则微信/QQ 会显示文件路径而不是图片。

### 正确格式

```
截图已保存：

MEDIA:/Users/acerola/Desktop/mapairs_screenshots/rank_province_20260624_160107.png
MEDIA:/Users/acerola/Desktop/mapairs_screenshots/rank_city_20260624_160107.png
```

### 错误格式（会显示文件路径）

```
截图已保存：
~/Desktop/mapairs_screenshots/rank_province_20260624_160107.png
```

### 在 Playwright 脚本中输出

```python
# 截图完成后，打印 MEDIA: 标签
print(f"\nMEDIA:{province_screenshot_path}")
print(f"\nMEDIA:{city_screenshot_path}")
```

### 在 agent 响应中输出

如果 agent 使用 `vision_analyze` 分析截图后，在最终响应中包含：

```
MEDIA:/path/to/screenshot1.png
MEDIA:/path/to/screenshot2.png
```

系统会自动下载并作为图片发送到微信/QQ。

## Cron Debugging

When a cron job appears not to execute, see `references/concentration-ranking.md` § Debugging Cron Runs for the diagnostic sequence: check `jobs.json` status fields → trace `agent.log` → verify output files → identify failure mode.

Key fields in `~/.hermes/cron/jobs.json`: `last_status` ("ok"/null), `last_run_at`, `last_delivery_error`, `repeat.completed`.

See `references/wechat-cron-delivery.md` for delivery format details.

## 浓度排名模块操作要点

### ⚠️ 级联选择器勾选规则（重要）

**核心原则：不勾选当前级别，只勾选下一级**

| 查询目标 | 不要勾选 | 应该勾选 | 示例 |
|----------|----------|----------|------|
| 河南省城市排名 | 河南省 | 河南省下的所有城市（郑州市、洛阳市、平顶山市...） | 去掉省级勾选 |
| 杭州市区县排名 | 杭州市 | 杭州市下的所有区县（西湖区、上城区、萧山区...） | 去掉市级勾选 |
| 全省排名 | 不选任何城市 | 只选省级 | 但要确保没有重复 |

### 为什么？

如果勾选了当前级别，会出现：
- 排名列表中多出一行"汇总"或"全省"数据
- 数据不准确，混淆了层级

### 正确操作流程

```python
# 1. 清空所有已选
clear_all_selections(page)

# 2. 打开级联选择器
page.click('.el-cascader')

# 3. 展开省 → 选择下一级城市（不勾选省本身）
# 例如：查河南省排名，展开"河南省"，勾选所有城市

# 4. 按 Escape 关闭面板
page.keyboard.press("Escape")
time.sleep(1)

# 5. 点击查询按钮
page.click('button:has-text("查询")')
```

### clear_all_selections 函数

```python
def clear_all_selections(page):
    """清除所有已选的级联选择器选项"""
    for _ in range(5):
        cleared = safe_eval(page, """() => {
            const tags = document.querySelectorAll('.el-cascader .el-tag .el-tag__close');
            if (tags.length > 0) { tags[0].click(); return true; }
            return false;
        }""")
        if not cleared:
            break
        time.sleep(0.5)
    safe_eval(page, """() => {
        const checked = document.querySelectorAll('.el-cascader-node.is-checked');
        for (const node of checked) {
            const box = node.querySelector('.el-checkbox__inner');
            if (box) box.click();
        }
    }""")
    time.sleep(1)
```

### 选择下一级城市

```python
def select_next_level(page, province_name):
    """展开省，选择所有下一级城市（不勾选省本身）"""
    safe_eval(page, f"""() => {{
        // 找到省节点并展开
        const nodes = document.querySelectorAll('.el-cascader-node');
        for (const node of nodes) {{
            if (node.textContent?.includes('{province_name}')) {{
                // 点击展开（如果有子节点）
                const label = node.querySelector('.el-cascader-node__label');
                if (label) label.click();
                break;
            }}
        }}
    }}""")
    time.sleep(2)
    
    # 选择所有下一级城市
    safe_eval(page, f"""() => {{
        const nodes = document.querySelectorAll('.el-cascader-node');
        let inProvince = false;
        for (const node of nodes) {{
            if (node.textContent?.trim() === '{province_name}') {{
                inProvince = true;
                continue;
            }}
            if (inProvince && node.level === 2) {{
                const box = node.querySelector('.el-checkbox__inner');
                if (box) box.click();
            }}
            if (inProvince && node.level === 1) break; // 遇到下一个省就停止
        }}
    }}""")
    time.sleep(1)
```

## Cron Delivery Notes

When using this skill with Hermes cron jobs, delivery configuration is critical.

### WeChat (iLink) Delivery

Hermes uses Tencent's iLink Bot API for WeChat. The chat_id format from iLink is `xxxx@im.wechat` (e.g. `o9cq805Sb0RjMzwijBZ-r_5CLvbc@im.wechat`).

**Deliver format**: `weixin:CHAT_ID` — the full `@im.wechat` format works.

**The `_WEIXIN_TARGET_RE` regex** in `send_message_tool.py` does NOT match `@im.wechat` format, but this is OK — the cron scheduler falls back to using the raw value when the regex doesn't match (`is_explicit=False` path in `_resolve_single_delivery_target`).

**What actually fails**: Using just `weixin` without a chat_id. This triggers the `WEIXIN_HOME_CHANNEL` env var lookup, which returns empty → "no delivery target resolved".

| deliver 格式 | 结果 | 原因 |
|---|---|---|
| `weixin` | ❌ 失败 | 没有 chat_id，环境变量未设置 |
| `weixin:xxxx@im.wechat` | ✅ 成功 | 正则不匹配但 fallback 使用原始值 |
| `weixin:wxid_xxxxx` | ✅ 成功 | 正则匹配 |
| `origin` | 视情况 | 需要 origin 非 null（从对话中创建的任务才行） |

**For third-party WebUI**: Tasks created from a WebUI have `origin: null`, so `origin` delivery won't work. Must use explicit `weixin:CHAT_ID` format. Get the chat_id from `~/.hermes/channel_directory.json`.

See `references/wechat-cron-delivery.md` for full details.

## Scripts

- `scripts/mapairs_dual_screenshot.py` — concentration ranking dual screenshot (province + city)
- `scripts/mapairs_concentration_v4.py` — single-city concentration screenshot (Linux compatible)
- `scripts/pingdingshan_screenshot.py` — Pingdingshan IPP-AIR three-screenshot workflow

## References

- `references/concentration-ranking.md` — concentration ranking workflow details
- `references/pingdingshan-workflow.md` — Pingdingshan-specific workflow details
