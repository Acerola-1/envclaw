---
name: pingdingshan-sentry
description: "平顶山值守任务——严格执行3张截图流程：浓度排名(日累计)+一张图(河南区域)+一张图(平顶山区县级)。首次加载此技能时应完整阅读全文，按步骤依次执行。所有浏览器操作使用 agent-browser CLI。"
tags: [平顶山, 值守, mapairs, 浓度排名, 一张图, 截图, cron, agent-browser]
---

# 平顶山值守任务 · 3张截图标准流程

该技能是**平顶山值守任务**的标准操作流程，严格遵循任务提示词：

1. 需要一张 18 地市的浓度排名截图,日累计类型
2. 从浓度排名确认平顶山市的首要污染物
3. 来到一张图页面,切换成监测图并关闭左侧面板,根据第2步得到的首要污染物,切换地图的因子类型,然后河南区域截一张图,放大到平顶山市区县级别再截一张图
4. 任务确认,最终一共 3 张截图,其他信息不是必要的

---

## 一、前置条件

| 项 | 值 |
|---|-----|
| 平台URL | `https://www.mapairs.com/` |
| 内网URL | `http://192.168.4.25:8090/lock` |
| 账号 | `X-mojl` / `yutu@889` |
| 默认城市 | `平顶山市` |
| 浏览器引擎 | `agent-browser` CLI |
| Session名 | `--session-name pingdingshan`（需新的未用过的名字，避免旧session冲突） |

### 1.1 打开浏览器并登录

```bash
# 如果agent-browser找不到Chrome，使用下面的executable-path
# 找到Playwright安装的Chrome: ls ~/Library/Caches/ms-playwright/
agent-browser --session-name pingdingshan open https://www.mapairs.com/
sleep 3
```

如果报 `Auto-launch failed: Chrome exited early`，说明Chrome不在标准路径，需指定：

```bash
# 找到最新版本的Playwright Chromium
CHROME_PATH=$(find ~/Library/Caches/ms-playwright/chromium-*/chrome-mac-arm64/Google\ Chrome\ for\ Testing.app/Contents/MacOS/Google\ Chrome\ for\ Testing 2>/dev/null | tail -1)
agent-browser --executable-path "$CHROME_PATH" --session-name pingdingshan open https://www.mapairs.com/
sleep 3
```

### 1.2 检测并处理 /lock 登录

```bash
# 检查是否在登录页
agent-browser --session-name pingdingshan eval "window.location.href"
# 如果返回包含 /lock，执行登录流程
```

#### 完整登录脚本

```bash
agent-browser --session-name pingdingshan set viewport 1920 1080
sleep 2

# 点击 loginBg 打开登录弹窗
agent-browser --session-name pingdingshan eval "document.querySelector('.loginBg')?.click()"
sleep 2

# 填账号密码（使用Vue兼容方式，通过Object.getOwnPropertyDescriptor赋值）
agent-browser --session-name pingdingshan eval "var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; var ins=document.querySelectorAll('input'); for(var i=0;i<ins.length;i++){if(ins[i].placeholder?.includes('账号')||ins[i].placeholder?.includes('手机号')){ins[i].removeAttribute('readonly');ins[i].focus();s.call(ins[i],'X-mojl');ins[i].dispatchEvent(new Event('input',{bubbles:true}));ins[i].dispatchEvent(new Event('change',{bubbles:true}));}if(ins[i].placeholder?.includes('密码')){ins[i].removeAttribute('readonly');ins[i].focus();s.call(ins[i],'yutu@889');ins[i].dispatchEvent(new Event('input',{bubbles:true}));ins[i].dispatchEvent(new Event('change',{bubbles:true}));}} 'ok'"
sleep 2

# 点登录按钮（使用MouseEvent dispatch兼容Vue）
agent-browser --session-name pingdingshan eval "var b=document.querySelectorAll('button'); for(var i=0;i<b.length;i++){if(b[i].textContent?.trim()==='登录'){var evt=new MouseEvent('click',{bubbles:true,cancelable:true});b[i].dispatchEvent(evt);break}} 'ok'"
sleep 6

# 验证登录成功（不应包含 /lock）
agent-browser --session-name pingdingshan eval "window.location.href"
```

---

## 二、核心规则（违反必失败）

| # | 规则 | 原因 |
|---|------|------|
| 1 | 必须用 `--session-name` 持久化会话 | 否则每次是新浏览器，token丢失 |
| 2 | SPA导航必须用 `location.href`，绝对不能用 `agent-browser open` | `open` 丢失登录状态，退回首页 |
| 3 | 截图前必须先 `set viewport 1920 1080` | 否则viewport默认值，截图尺寸不对 |
| 4 | eval JS 必须用 `var` + `for(i=0;i<n;i++)`，不能用 `for...of`/`let`/`const`/箭头函数 | agent-browser eval對ES6语法支持不稳定 |
| 5 | Vue 3元素 `.click()` 静默失效，必须用 `MouseEvent dispatch` | Element Plus的Vue响应式代理拦截了原生click |
| 6 | Session有效期约2-5分钟，整个流程必须一气呵成 | 被踢回 `/lock` 后需要重新登录 |
| 7 | 截图表单数据前必须点「查询」按钮触发Vue数据加载 | 不点查询表格无数据 |

---

## 三、步骤详解

### Step 1: 浓度排名 — 全省18地市日累计截图

#### 3.1 导航到浓度排名

```bash
# 先去首页保证SPA状态
agent-browser --session-name pingdingshan eval "location.href='https://www.mapairs.com/overallSituation'"
sleep 8
# 再去浓度排名页面
agent-browser --session-name pingdingshan eval "location.href='https://www.mapairs.com/dataStatistics/concentrationranking'"
sleep 15

# 检查URL，如果被重定向到其他页面，再执行一次导航
agent-browser --session-name pingdingshan eval "window.location.href"
# 如果不是 /concentrationranking，重试导航
```

> ⚠️ **已知问题**：`concentrationranking` 可能双向重定向到 `CityHourBroadcast`。如果重定向了，等15秒后再执行一次 `location.href` 导航。

#### 3.2 切换到日累计模式

```bash
# 先确认当前模式
agent-browser --session-name pingdingshan eval "var r=document.querySelectorAll('.el-radio-button'); var out=''; for(var i=0;i<r.length;i++){out+=r[i].textContent?.trim()+' active='+r[i].classList.contains('is-active')+'|'}; out"
```

默认是 `城市+实时`。需要点击 **日累计** 的label标签（`el-radio-button__inner` 的父级 `label`）：

```bash
# 点击日累计（通过查找SPAN标签的父级label）
agent-browser --session-name pingdingshan eval "var els=document.querySelectorAll('*'); for(var i=0;i<els.length;i++){if(els[i].textContent?.trim()==='日累计'&&els[i].tagName==='SPAN'){var label=els[i].closest('label'); if(label){var evt=new MouseEvent('click',{bubbles:true,cancelable:true});label.dispatchEvent(evt)}; break}} 'ok'"
sleep 3

# 验证日累计已激活
agent-browser --session-name pingdingshan eval "var r=document.querySelectorAll('.el-radio-button'); var out=''; for(var i=0;i<r.length;i++){out+=r[i].textContent?.trim()+' active='+r[i].classList.contains('is-active')+'|'}; out"
# 应显示: 日累计 active=true
```

#### 3.3 点击查询

```bash
# 点查询按钮
agent-browser --session-name pingdingshan eval "var els=document.querySelectorAll('*'); for(var i=0;i<els.length;i++){if(els[i].textContent?.trim()==='查询'&&els[i].tagName==='BUTTON'){var evt=new MouseEvent('click',{bubbles:true,cancelable:true});els[i].dispatchEvent(evt); break}} 'ok'"
sleep 10
```

#### 3.4 截图并提取数据

```bash
agent-browser --session-name pingdingshan set viewport 1920 1080
sleep 2
agent-browser --session-name pingdingshan screenshot ~/Desktop/mapairs/rank_18cities_$(date +%Y%m%d).png
```

**提取数据找首要污染物：**

```bash
agent-browser --session-name pingdingshan eval "var rows=document.querySelectorAll('.el-table__body tr'); var out=''; for(var i=0;i<rows.length;i++){var cells=rows[i].querySelectorAll('td'); for(var j=0;j<cells.length;j++){out+=cells[j].textContent?.trim();if(j<cells.length-1)out+=','}; out+='\\n'}; out"
```

**列结构**（19列）：`排名, 综指-城市, 综指-值, PM2.5-城市, PM2.5-值, PM10-城市, PM10-值, SO2-城市, SO2-值, NO2-城市, NO2-值, CO-城市, CO-值, O3_8h-城市, O3_8h-值, AQI-城市, AQI-值, 等级, 首要污染物`

从数据中找到包含"平顶山"的行，**最后一列**即为首要污染物。

---

### Step 2: 确认首要污染物

从提取的数据中找到平顶山市的行，确定首要污染物列的值：
- 如果是 `"-"` 表示无（优级），地图因子保持默认 `AQI`
- 如果是 `"PM2.5"` 或 `"O3"` 等，地图需切换到对应因子

---

### Step 3: 一张图 — 河南区域截图

#### 3.5 导航到一张图

```bash
agent-browser --session-name pingdingshan eval "location.href='https://www.mapairs.com/onemap/default'"
sleep 12
```

#### 3.6 切换监测图模式

当前页面显示"插值图"按钮时，点击切换为监测图模式：

```bash
# 点击"插值图"文字切换到监测图模式
agent-browser --session-name pingdingshan eval "var els=document.querySelectorAll('*'); for(var i=0;i<els.length;i++){if(els[i].textContent?.trim()==='插值图'&&els[i].children.length===0){var evt=new MouseEvent('click',{bubbles:true,cancelable:true});els[i].dispatchEvent(evt);break}} 'ok'"
sleep 3

# 验证切换成功（应显示"监测图"文字）
agent-browser --session-name pingdingshan eval "var els=document.querySelectorAll('*'); for(var i=0;i<els.length;i++){if(els[i].textContent?.trim()==='监测图'||els[i].textContent?.trim()==='插值图'){out+=els[i].textContent?.trim()+'|'}}; out"
```

#### 3.7 关闭左侧面板

```bash
# 点el-button--primary按钮关闭左侧站点列表
agent-browser --session-name pingdingshan eval "var btn=document.querySelector('button.el-button--primary'); if(btn){var evt=new MouseEvent('click',{bubbles:true,cancelable:true});btn.dispatchEvent(evt)} 'ok'"
sleep 3
```

#### 3.8 切换地图因子（可选）

如果首要污染物不是`"-"`，切换到对应因子（例如 O₃、PM₂.₅ 等）：

```bash
# 找到因子选择列表中的对应项（例如O₃），点击切换
agent-browser --session-name pingdingshan eval "var items=document.querySelectorAll('*'); for(var i=0;i<items.length;i++){if(items[i].textContent?.trim()==='O₃'&&items[i].children.length<2){var evt=new MouseEvent('click',{bubbles:true,cancelable:true});items[i].dispatchEvent(evt);break}} 'ok'"
sleep 3
```

> 如果首要污染物为 "-"（无），保持默认 `AQI` 因子即可。

#### 3.9 截图 — 河南区域

```bash
agent-browser --session-name pingdingshan set viewport 1920 1080
sleep 2
agent-browser --session-name pingdingshan screenshot ~/Desktop/mapairs/onemap_henan_$(date +%Y%m%d).png
```

---

### Step 4: 一张图 — 放大到平顶山区县级截图

#### 3.10 放大2次到区县级

> ⚠️ **关键参数**：只放大 **2次**（不要放大4次以上）。2次=城市边界可见的区县级，4次=街道级别过于放大。

```bash
# 放大第1次
agent-browser --session-name pingdingshan eval "var a=document.querySelector('a.map-control-zoom-in,button.map-control-zoom-in,button.mapboxgl-ctrl-zoom-in'); if(a){var evt=new MouseEvent('click',{bubbles:true,cancelable:true});a.dispatchEvent(evt)} 'ok'"
sleep 2

# 放大第2次（共2次，刚好区县级）
agent-browser --session-name pingdingshan eval "var a=document.querySelector('a.map-control-zoom-in,button.map-control-zoom-in,button.mapboxgl-ctrl-zoom-in'); if(a){var evt=new MouseEvent('click',{bubbles:true,cancelable:true});a.dispatchEvent(evt)} 'ok'"
sleep 3
```

#### 3.11 截图 — 平顶山区县级

```bash
agent-browser --session-name pingdingshan set viewport 1920 1080
sleep 2
agent-browser --session-name pingdingshan screenshot ~/Desktop/mapairs/onemap_pingdingshan_$(date +%Y%m%d).png
```

---

## 四、质量检查

### 4.1 检查文件

```bash
ls -lh ~/Desktop/mapairs/rank_18cities_*.png
ls -lh ~/Desktop/mapairs/onemap_henan_*.png
ls -lh ~/Desktop/mapairs/onemap_pingdingshan_*.png
```

### 4.2 质量标准

| 截图 | 预期大小 | 预期内容 | 问题排查 |
|------|---------|---------|---------|
| 排名截图 | 400-600 KB | 18行数据表格 | <200KB=数据未加载，检查是否点了查询 |
| 河南区域 | 1-2 MB | 地图+监测图因子 | 太小=地图未渲染(MouseEvent无效)，尝试换其他click方式 |
| 区县级 | 1.5-2.5 MB | 平顶山周边城市边界可见 | 灰图=放太大导致无图块 |

### 4.3 文件总计

最终应恰好 **3 张截图**，不包含其他模块。

---

## 五、常见问题处理

### Session过期（被踢回 /lock）

```bash
# 重新登录
agent-browser --session-name pingdingshan eval "document.querySelector('.loginBg')?.click()"
# ... 重复登录流程
```

注意：重复使用同一 `--session-name` 可能失败，建议轮换名称（`pingdingshan1`, `pingdingshan2`...）

### 导航重定向

如果 `concentrationranking` 重定向到 `CityHourBroadcast` 或主页：

```bash
# 等15秒后重试导航
agent-browser --session-name pingdingshan eval "location.href='https://www.mapairs.com/dataStatistics/concentrationranking'"
sleep 15
```

最多重试 2 次，如果仍失败则关闭session用新name重新开始。

### 查询后表格无数据

确保**先切换到日累计模式**，**再点击查询**。顺序很重要：
1. 先点击日累计 radio label
2. 等待 3 秒
3. 点击查询 button
4. 等待 8-10 秒

### Chrome 崩溃

```bash
# 如果agent-browser报Chrome/Lightpanda找不到
# 先通过Playwright安装Chromium
npx playwright install chromium

# 找到Chrome二进制路径
CHROME_PATH=$(find ~/Library/Caches/ms-playwright/chromium-*/chrome-mac-arm64/Google\ Chrome\ for\ Testing.app/Contents/MacOS/Google\ Chrome\ for\ Testing 2>/dev/null | tail -1)
echo "Chrome at: $CHROME_PATH"

# 使用--executable-path指定
agent-browser close --all
agent-browser --executable-path "$CHROME_PATH" --session-name pingdingshan open https://www.mapairs.com/
```

---

## 六、完整一键执行脚本（参考）

以下是一键执行全部3个步骤的 Python 封装（使用 subprocess 调 agent-browser）：

```python
#!/usr/bin/env python3
"""平顶山值守任务 - 一键3截图"""
import subprocess, time, json, os, datetime

SESSION = "pingdingshan"
BASE = "https://www.mapairs.com"
OUT = os.path.expanduser("~/Desktop/mapairs")
os.makedirs(OUT, exist_ok=True)

def agent(args, timeout=30):
    full = ["agent-browser", "--session-name", SESSION] + args
    try:
        r = subprocess.run(full, capture_output=True, text=True, timeout=timeout)
        return r.stdout.strip(), r.stderr.strip(), r.returncode
    except:
        return "", "error", -1

def ev(js, timeout=15):
    out, _, code = agent(["eval", js], timeout)
    if code != 0: return None
    try: return json.loads(out)
    except: return out

def ss(path):
    agent(["screenshot", path], timeout=20)
    if os.path.exists(path):
        print(f"  ✓ {os.path.basename(path)} ({os.path.getsize(path)/1024:.0f} KB)")

def login():
    agent(["set", "viewport", "1920", "1080"])
    time.sleep(2)
    ev("document.querySelector('.loginBg')?.click()")
    time.sleep(2)
    ev("var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;var ins=document.querySelectorAll('input');for(var i=0;i<ins.length;i++){if(ins[i].placeholder?.includes('账号')||ins[i].placeholder?.includes('手机号')){ins[i].removeAttribute('readonly');ins[i].focus();s.call(ins[i],'X-mojl');ins[i].dispatchEvent(new Event('input',{bubbles:true}));ins[i].dispatchEvent(new Event('change',{bubbles:true}));}if(ins[i].placeholder?.includes('密码')){ins[i].removeAttribute('readonly');ins[i].focus();s.call(ins[i],'yutu@889');ins[i].dispatchEvent(new Event('input',{bubbles:true}));ins[i].dispatchEvent(new Event('change',{bubbles:true}));}} 'ok'")
    time.sleep(2)
    ev("var b=document.querySelectorAll('button');for(var i=0;i<b.length;i++){if(b[i].textContent?.trim()==='登录'){var e=new MouseEvent('click',{bubbles:true,cancelable:true});b[i].dispatchEvent(e);break}} 'ok'")
    time.sleep(6)
    url = ev("window.location.href")
    return url and '/lock' not in url

# 主流程
ts = datetime.datetime.now().strftime("%Y%m%d")

# === Step 1: 浓度排名 ===
print("[1/3] 浓度排名（全省18地市日累计）")
ev(f"location.href='{BASE}/overallSituation'")
time.sleep(8)
ev(f"location.href='{BASE}/dataStatistics/concentrationranking'")
time.sleep(15)
ev("set viewport 1920 1080")
time.sleep(2)
# 切日累计
ev("var els=document.querySelectorAll('*');for(var i=0;i<els.length;i++){if(els[i].textContent?.trim()==='日累计'&&els[i].tagName==='SPAN'){var label=els[i].closest('label');if(label){var e=new MouseEvent('click',{bubbles:true,cancelable:true});label.dispatchEvent(e)};break}} 'ok'")
time.sleep(3)
# 点查询
ev("var els=document.querySelectorAll('*');for(var i=0;i<els.length;i++){if(els[i].textContent?.trim()==='查询'&&els[i].tagName==='BUTTON'){var e=new MouseEvent('click',{bubbles:true,cancelable:true});els[i].dispatchEvent(e);break}} 'ok'")
time.sleep(10)
agent(["set", "viewport", "1920", "1080"])
time.sleep(2)
ss(os.path.join(OUT, f"rank_18cities_{ts}.png"))

# 提取首要污染物
data = ev("var rows=document.querySelectorAll('.el-table__body tr');var out='';for(var i=0;i<rows.length;i++){var cells=rows[i].querySelectorAll('td');for(var j=0;j<cells.length;j++){out+=cells[j].textContent?.trim();if(j<cells.length-1)out+=','};out+='\\n'};out")
primary = "-"
for line in (data or "").split("\n"):
    if "平顶山" in line:
        cols = line.split(",")
        primary = cols[-1]  # 最后一列是首要污染物
        print(f"  平顶山首要污染物: {primary}")
        break

# === Step 2: 一张图河南区域 ===
print("[2/3] 一张图-河南区域")
ev(f"location.href='{BASE}/onemap/default'")
time.sleep(12)
# 切监测图
ev("var els=document.querySelectorAll('*');for(var i=0;i<els.length;i++){if(els[i].textContent?.trim()==='插值图'&&els[i].children.length===0){var e=new MouseEvent('click',{bubbles:true,cancelable:true});els[i].dispatchEvent(e);break}} 'ok'")
time.sleep(3)
# 关左侧面板
ev("var btn=document.querySelector('button.el-button--primary');if(btn){var e=new MouseEvent('click',{bubbles:true,cancelable:true});btn.dispatchEvent(e)} 'ok'")
time.sleep(3)
# 切换因子（如需要）
if primary and primary != "-":
    print(f"  切换因子到: {primary}")
    ev(f"var items=document.querySelectorAll('*');for(var i=0;i<items.length;i++){{if(items[i].textContent?.trim()==='{primary}'&&items[i].children.length<2){{var e=new MouseEvent('click',{{bubbles:true,cancelable:true}});items[i].dispatchEvent(e);break}}}} 'ok'")
    time.sleep(3)
agent(["set", "viewport", "1920", "1080"])
time.sleep(2)
ss(os.path.join(OUT, f"onemap_henan_{ts}.png"))

# === Step 3: 放大到平顶山区县级 ===
print("[3/3] 一张图-平顶山区县级")
for i in range(2):  # 只放大2次
    ev("var a=document.querySelector('a.map-control-zoom-in,button.map-control-zoom-in,button.mapboxgl-ctrl-zoom-in');if(a){var e=new MouseEvent('click',{bubbles:true,cancelable:true});a.dispatchEvent(e)} 'ok'")
    time.sleep(2)
agent(["set", "viewport", "1920", "1080"])
time.sleep(2)
ss(os.path.join(OUT, f"onemap_pingdingshan_{ts}.png"))

print(f"\n✅ 完成！3张截图已保存至 {OUT}")
```

---

## 七、投递说明

该技能适合用于 **Hermes cron 任务**，投递目标支持：

- `deliver: "weixin:{chat_id}"` — 推送到微信
- `deliver: "telegram:{chat_id}"` — 推送到Telegram

在cron任务提示词中只需写：

```
请加载 pingdingshan-sentry 技能并执行完整的3张截图流程。
```