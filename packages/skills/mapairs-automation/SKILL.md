---
name: mapairs-automation
description: "Mapairs.com (数智大气/IPP-AIR) 空气质量监测平台完整操作手册。覆盖登录、一张图、小时播报、浓度排名、监测数据，使用 agent-browser CLI。当用户提到 mapairs.com、数智大气、IPP-AIR、空气质量监测平台、大气数据可视化时，应加载此技能。"
tags: [mapairs, "mapairs.com", 数智大气, ipp-air, 空气质量, 大气数据, 环境监测, "agent-browser", "website-guide", "air-quality", screenshot, automation, onemap]
related_skills: [mapairs-automation]
---

# Mapairs.com 完整操作手册

该技能记录了 mapairs.com 平台从登录到截图/数据提取的唯一正确流程。使用 agent-browser CLI。
覆盖模块：一张图、小时播报、浓度排名、监测数据。

---

## 一、铁律（违反任何一条必定失败）

| # | 规则 | 原因 |
|---|------|------|
| 1 | 必须用 `--session-name mapairs` 打开浏览器 | 否则状态不持久，每次是新浏览器 |
| 2 | 模块切换必须用 `location.href`，绝对不能用 `agent-browser open` | `open` 丢失 localStorage token，页面退回首页地图 |
| 3 | 截图前必须先 `set viewport 1920 1080` | 否则 viewport 默认值，截图小且画面挤压 |
| 4 | eval JS 必须用 `var` + `for(i=0;i<n;i++)`，不能用 `for...of` / `let` / `const` / 箭头函数 | agent-browser 的 eval 对 ES6 语法支持不稳定 |
| 5 | Vue 3 元素 `.click()` 可能静默失效，改用 `MouseEvent dispatch` | Element Plus 的 Vue 响应式代理拦截了原生 click |
| 6 | 级联选择器必须按 panel 索引操作：`menus[0]`=省, `menus[1]`=市, `menus[2]`=区县 | 所有 panel 的节点混在 querySelectorAll 结果中无法区分 |
| 7 | Session 有效期极短（约 2-5 分钟），整个流程必须快速完成 | 页面跳转到 `/lock` 后必须重新登录。每次重新打开浏览器必须用新 `--session-name` 或先 `agent-browser close --all` |
| 8 | 从 `/lock` 页面点击 `.loginBg` 可 auto-login（不弹出输入框） | 如果 auto-login 失败（跳到 about:blank），从首页重新触发完整登录弹窗 |
| 9 | 小时播报使用 vxe-table（非 el-table），数据提取需用专用选择器 | `.el-table__body tr td` 选不到 vxe-table 的行 |

---

## 二、账号

| 地区 | 用户名 | 密码 |
|------|--------|------|
| 平顶山市 | `X-mojl` | `yutu@889` |

---

## 三、URL 速查

| 页面 | URL 路径 |
|------|---------|
| 首页 | `https://www.mapairs.com/` |
| **一张图** | `/onemap/default` |
| **小时播报** | `/dataStatistics/CityHourBroadcast` |
| **浓度排名** | `/dataStatistics/concentrationranking` |
| **监测数据** | `/dataStatistics/cityMonitoringData` |

---

## 四、登录流程

### 4.1 自动脚本（推荐）

```bash
python3 ~/.hermes/skills/mapairs-automation/scripts/mapairs_screenshot.py --module all
```

### 4.2 手动操作

```bash
# 1. 打开浏览器
agent-browser --session-name mapairs open https://www.mapairs.com/
sleep 5

# 2. 如果被重定向到 /lock，在此登录
agent-browser eval "var el=document.querySelector('.loginBg'); if(el){var evt=new MouseEvent('click',{bubbles:true,cancelable:true});el.dispatchEvent(evt);}"
sleep 2

# 3. 填账号密码（平顶山市）
agent-browser eval "var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; var ins=document.querySelectorAll('input'); for(var i=0;i<ins.length;i++){if(ins[i].placeholder?.includes('账号')||ins[i].placeholder?.includes('手机号')){ins[i].removeAttribute('readonly');ins[i].focus();s.call(ins[i],'X-mojl');ins[i].dispatchEvent(new Event('input',{bubbles:true}));ins[i].dispatchEvent(new Event('change',{bubbles:true}));}if(ins[i].placeholder?.includes('密码')){ins[i].removeAttribute('readonly');ins[i].focus();s.call(ins[i],'yutu@889');ins[i].dispatchEvent(new Event('input',{bubbles:true}));ins[i].dispatchEvent(new Event('change',{bubbles:true}));}}"
sleep 1

# 4. 点击登录
agent-browser eval "var b=document.querySelectorAll('button'); for(var i=0;i<b.length;i++){if(b[i].textContent?.trim()==='登录'){b[i].click();break}}"
sleep 5

# 5. 验证
agent-browser eval "window.location.href.includes('/lock')"
# → false 即成功
```

### 4.3 核心经验

- **唯一可靠的登录验证是 URL 不在 `/lock`，不是 token 字符串格式**（过期 token 也以 `eyJ` 开头，能通过字符串检查但服务器会拒绝）
- **从 `/lock` 登录成功后，Vue SPA 会跳转到上次关闭前的页面**
- **登录后再用 `location.href` 导航到目标模块**

---

## 五、模块操作

### 5.1 一张图（Onemap）

执行顺序：定位平顶山 → 切监测图 → 关闭侧栏截图 → 放大到市级截图 → 放大到区县级截图

#### 定位平顶山 + 切换监测图

```bash
agent-browser eval "location.href='https://www.mapairs.com/onemap/default'"
sleep 10
agent-browser set viewport 1920 1080
sleep 2
# 1. 点击左侧区域层级定位到目标城市
agent-browser eval "var el=document.querySelectorAll('*'); for(var i=0;i<el.length;i++){if(el[i].textContent?.trim()==='平顶山市'&&el[i].children.length===0){var evt=new MouseEvent('click',{bubbles:true,cancelable:true});el[i].dispatchEvent(evt);break}}"
sleep 5
# 2. 切换到监测图模式（点击"插值图"按钮）
agent-browser eval "var els=document.querySelectorAll('*'); for(var i=0;i<els.length;i++){if(els[i].textContent?.trim()==='插值图'&&els[i].children.length===0){var evt=new MouseEvent('click',{bubbles:true,cancelable:true});els[i].dispatchEvent(evt);break}}"
sleep 3
```

#### 关闭左侧站点列表（全景截图）

```bash
# 3. 收起左侧站点列表，截全景图
agent-browser eval "var btn=document.querySelector('button.el-button--primary'); if(btn)btn.click()"
sleep 2
agent-browser set viewport 1920 1080
sleep 1
agent-browser screenshot ~/Desktop/onemap_full.png
```

#### 缩放：市级截图 + 区县级截图

```bash
# 4. 放大到市级（2次），截图
agent-browser eval "var a=document.querySelector('a.map-control-zoom-in,button.map-control-zoom-in,button.mapboxgl-ctrl-zoom-in'); if(a){var evt=new MouseEvent('click',{bubbles:true,cancelable:true});a.dispatchEvent(evt)}"
sleep 2
agent-browser eval "var a=document.querySelector('a.map-control-zoom-in,button.map-control-zoom-in,button.mapboxgl-ctrl-zoom-in'); if(a){var evt=new MouseEvent('click',{bubbles:true,cancelable:true});a.dispatchEvent(evt)}"
sleep 2
agent-browser set viewport 1920 1080
sleep 1
agent-browser screenshot ~/Desktop/onemap_city.png

# 5. 再放大到区县级（再4次，共6次），截图
for i in $(seq 1 4); do
  agent-browser eval "var a=document.querySelector('a.map-control-zoom-in,button.map-control-zoom-in,button.mapboxgl-ctrl-zoom-in'); if(a){var evt=new MouseEvent('click',{bubbles:true,cancelable:true});a.dispatchEvent(evt)}"
  sleep 1.5
done
sleep 3
agent-browser screenshot ~/Desktop/onemap_district.png
```

### 5.2 小时播报

> ⚠️ **关键发现**：`location.href` 导航到 `CityHourBroadcast` URL 可能会重定向到 `concentrationranking`！如果遇到这种问题，改用 sidebar 菜单点击导航：
> ```bash
> # 先展开数据分析
> agent-browser eval "var lis=document.querySelectorAll('li'); for(var i=0;i<lis.length;i++){if(lis[i].textContent?.trim()==='数据分析'){lis[i].click();}}"
> sleep 3
> # 再点击小时播报
> agent-browser eval "var lis=document.querySelectorAll('li'); for(var i=0;i<lis.length;i++){if(lis[i].textContent?.trim()==='小时播报'){lis[i].click();}}"
> sleep 12
> ```
>
> ⚠️ **必须点击「查询」按钮触发数据加载**，否则 vxe-table 不会渲染。
>
> ⚠️ **数据提取用 vxe-table 选择器**（非 el-table）：
> ```javascript
> var bw=document.querySelector('.vxe-table--body-wrapper'); if(!bw) return 'NO_DATA'; var cells=bw.querySelectorAll('.vxe-body--column'); var rows={}; for(var i=0;i<cells.length;i++){var rid=cells[i].getAttribute('rowid')||'r'+Math.floor(i/7); rows[rid]=rows[rid]||[]; rows[rid].push(cells[i].textContent?.trim());} var out=[]; for(var r in rows){out.push(rows[r].join(','));} out.join('\\n');
> ```
>
> 提取结果格式：`时间点,PM₂.₅,PM₁₀,SO₂,NO₂,CO,O₃`（共 7 列，无城市名列）。

### 5.3 浓度排名

**截图1（全省排名）**：
```bash
agent-browser eval "location.href='https://www.mapairs.com/dataStatistics/concentrationranking'"
sleep 20
agent-browser set viewport 1920 1080
sleep 2
agent-browser screenshot ~/Desktop/rank_province.png
```

**截图2（各区县排名）**：
```bash
agent-browser eval "location.href='https://www.mapairs.com/dataStatistics/concentrationranking'"
sleep 20
agent-browser set viewport 1920 1080
sleep 2
# 切换站点模式（用 MouseEvent dispatch 代替 .click()）
agent-browser eval "var r=document.querySelectorAll('.el-radio,.el-radio-button'); for(var i=0;i<r.length;i++){if(r[i].textContent?.trim()==='站点'){var evt=new MouseEvent('click',{bubbles:true,cancelable:true});r[i].dispatchEvent(evt);}}"
sleep 1
agent-browser eval "var r=document.querySelectorAll('.el-radio,.el-radio-button'); for(var i=0;i<r.length;i++){if(r[i].textContent?.trim()==='日累计'){var evt=new MouseEvent('click',{bubbles:true,cancelable:true});r[i].dispatchEvent(evt);}}"
sleep 1
# 级联选择器：河南 → 平顶山 → 全选区县（按 panel 索引操作）
agent-browser eval "document.querySelector('.el-cascader')?.querySelector('input')?.click()"
sleep 2
agent-browser eval "for(var i=0;i<10;i++){var t=document.querySelectorAll('.el-tag__close');if(t.length===0)break;t[0].click()}; var c=document.querySelectorAll('.el-cascader-node.is-checked'); for(var i=0;i<c.length;i++){var b=c[i].querySelector('.el-checkbox__inner');if(b)b.click()}"
sleep 1
agent-browser eval "document.querySelector('.el-cascader')?.querySelector('input')?.click()"
sleep 1
agent-browser eval "var m=document.querySelectorAll('.el-cascader-menu')[0]; if(m){var ns=m.querySelectorAll('.el-cascader-node'); for(var i=0;i<ns.length;i++){if(ns[i].textContent?.includes('河南')){ns[i].querySelector('.el-cascader-node__label')?.click();break}}}"
sleep 2
agent-browser eval "var m=document.querySelectorAll('.el-cascader-menu')[1]; if(m){var ns=m.querySelectorAll('.el-cascader-node'); for(var i=0;i<ns.length;i++){if(ns[i].textContent?.includes('平顶山')){ns[i].querySelector('.el-cascader-node__label')?.click();break}}}"
sleep 2
agent-browser eval "var menus=document.querySelectorAll('.el-cascader-menu'); if(menus.length>=3){var ns=menus[2].querySelectorAll('.el-cascader-node'); for(var i=0;i<ns.length;i++){if(ns[i].textContent?.trim()==='全部')continue; var b=ns[i].querySelector('.el-checkbox__inner'); if(b)b.click()}}"
sleep 1
agent-browser eval "document.dispatchEvent(new KeyboardEvent('keydown',{'key':'Escape'}))"
sleep 1
agent-browser eval "var b=document.querySelectorAll('button'); for(var i=0;i<b.length;i++){if(b[i].textContent?.trim()==='查询'){b[i].click();break}}"
sleep 5
agent-browser screenshot ~/Desktop/rank_city.png
```

### 5.4 监测数据

```bash
agent-browser eval "location.href='https://www.mapairs.com/dataStatistics/cityMonitoringData'"
sleep 15
agent-browser set viewport 1920 1080
sleep 2
agent-browser screenshot ~/Desktop/mapairs_monitor.png
```

表格列：时间点 | 城市名 | PM2.5 | PM10 | SO2 | NO2 | CO | O3（无 O3-8h 和 AQI）

---

## 六、agent-browser eval JS 语法表

agent-browser 的 `eval` 使用轻量 JS 引擎，对 ES6 语法支持有限：

| 语法 | 支持 | 替代写法 |
|------|------|---------|
| `const` / `let` | ❌ 报错 | 用 `var` |
| `for...of` | ❌ 静默失败 | `for(var i=0;i<n.length;i++)` |
| `()=>{}` 箭头函数 | ❌ SyntaxError | 直接用语句或用 `function(){}()` |
| `Array.from().map()` | ⚠️ 可能失败 | 手动 for 循环 |
| `.click()` on Vue 元素 | ⚠️ 静默失效 | `new MouseEvent('click',{bubbles:true,cancelable:true})` 派发 |
| `console.log()` | ❌ 不输出 | 用 `return` 返回值替代 |
| `?.` optional chaining | ✅ | — |
| `includes()` | ✅ | — |

---

## 七、质量检查

```bash
python3 -c "from PIL import Image; img=Image.open('<截图路径>'); print(f'{img.size[0]}x{img.size[1]}')"
```

| 指标 | 合格 | 问题原因 |
|------|------|---------|
| 尺寸 | 1920x1080 | <1920 → 忘记 set viewport |
| 大小 | 300-1900 KB | <200 KB → 页面未加载或显示了地图而非数据表 |
| 内容 | 显示数据表格 | 显示地图 → 用了 `agent-browser open` 而非 `location.href` |

---

## 八、脚本

| 脚本 | 说明 | 用法 |
|------|------|------|
| `scripts/mapairs_screenshot.py` | **推荐**。一键截图（一张图+小时播报+浓度排名+监测数据） | `python3 scripts/mapairs_screenshot.py --module all` |
| | 单模块：`--module hourly/rank/monitor/onemap` | |
| `scripts/pingdingshan_ranking.py` | 旧版平顶山浓度排名双截图（仅保留兼容） | 已被 mapairs_screenshot.py 替代 |

脚本内置了本技能所有最佳实践：`--session-name` 持久化、`/lock` 检测与自动登录、`location.href` SPA 导航、`var`+传统 `for` 循环兼容写法、截图前 `set viewport`、一张图缩放两级截图。

---

## 九、References

- `references/onemap-workflow.md` — 一张图操作：定位、插值图/监测图切换、缩放两级截图、关闭侧栏
- `references/three-modules-workflow.md` — 三大模块操作细节
- `references/concentration-ranking.md` — 浓度排名详情
- `references/pingdingshan-workflow.md` — 平顶山市工作流
- `references/pingdingshan-ranking-parsing.md` — 数据分析与报告模板

