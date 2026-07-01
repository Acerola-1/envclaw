# 一张图（Onemap）操作手册

## URL

`https://www.mapairs.com/onemap/default`

## 页面结构

```
左上方区域层级：全国 → 河南省 → 平顶山市（点击定位 flyTo）
上方工具栏：AQI | PM2.5 | PM10 | ... | 更多图层... | 风/海浪 | 气压场
视图模式：遥感 | 插值图/监测图（互斥切换）
显示模式：城市 | 站点
左下方：站点列表 | 污染源（切换左侧列表内容）
地图区域：各站点 AQI 数值气泡
```

## 视图模式切换规则

左上角的视图按钮显示**当前模式的相反名称**。点击后切换到另一种模式：

| 按钮文字 | 真实模式 | 说明 |
|---------|---------|------|
| 监测图 | 插值图 | 污染物空间插值渲染，显示连续色块 |
| 插值图 | 监测图 | 站点数值模式，各站点 AQI 气泡 |

> 点击「插值图」→ 切换到监测图模式；点击「监测图」→ 切换到插值图模式。

## 定位平顶山市

```bash
agent-browser eval "location.href='https://www.mapairs.com/onemap/default'"
sleep 10
agent-browser set viewport 1920 1080
sleep 2
agent-browser eval "var el=document.querySelectorAll('*'); for(var i=0;i<el.length;i++){if(el[i].textContent?.trim()==='平顶山市'&&el[i].children.length===0){var evt=new MouseEvent('click',{bubbles:true,cancelable:true});el[i].dispatchEvent(evt);break}}"
sleep 5
agent-browser screenshot ~/Desktop/onemap.png
```

## 缩放（放大/缩小）

一张图提供两个缩放按钮（左下角）：**放大（+）** 和 **缩小（−）**。

### 多次放大的典型效果

| 缩放次数 | 展示级别 | 可见内容 |
|---------|---------|---------|
| 0（初始） | 全省 | 河南省全貌，主要城市点位 |
| 2-3 次 | 市级 | 平顶山市范围，各区站点 AQI |
| 5-6 次 | **区县级** | 区县名称、各监测站点详细数据 |
| 8+ 次 | 街道/社区 | 街道级别，局部高值区域 |

```bash
# 放大 1 次（缩放按钮可能是 button 或 a 标签）
agent-browser eval "var a=document.querySelector('a.map-control-zoom-in,button.map-control-zoom-in,button.mapboxgl-ctrl-zoom-in'); if(a){var evt=new MouseEvent('click',{bubbles:true,cancelable:true});a.dispatchEvent(evt)}"
sleep 2
```

### 快速缩放到区县级（推荐）

连续点击 6 次「放大」可以从全省视图缩放到区县级别：

```bash
# 连续放大 6 次（区县级）
for i in $(seq 1 6); do
  agent-browser eval "var a=document.querySelector('a.map-control-zoom-in,button.map-control-zoom-in,button.mapboxgl-ctrl-zoom-in'); if(a){var evt=new MouseEvent('click',{bubbles:true,cancelable:true});a.dispatchEvent(evt)}"
  sleep 1.5
done
sleep 3
agent-browser set viewport 1920 1080
sleep 1
agent-browser screenshot ~/Desktop/onemap_district.png
```

### 两级截图方案（推荐）

```bash
# 截图1：市级概览（放 2 次）
agent-browser eval "var btns=document.querySelectorAll('button'); for(var i=0;i<btns.length;i++){if(btns[i].textContent?.trim()==='+'){btns[i].click();break}}"
sleep 1
agent-browser eval "var btns=document.querySelectorAll('button'); for(var j=0;j<btns.length;j++){if(btns[j].textContent?.trim()==='+'){btns[j].click();break}}"
sleep 3
agent-browser screenshot ~/Desktop/onemap_city.png

# 截图2：区县详图（再放大 4 次 = 共 6 次）
for i in $(seq 1 4); do
  agent-browser eval "var btns=document.querySelectorAll('button'); for(var j=0;j<btns.length;j++){if(btns[j].textContent?.trim()==='+'){btns[j].click();break}}"
  sleep 1
done
sleep 3
agent-browser screenshot ~/Desktop/onemap_district.png
```

### 注意事项

- **放大后可能需要重新居中地图**。如果放得太大偏离了平顶山，重新点击层级区域「平顶山市」可 flyTo 回来
- **缩放动画约 1-2 秒**，每次 click 后需 sleep 等待
- **放大次数过多（>10 次）** 地图会进入街道级别，站点气泡可能超出可视范围
- **缩小同理**：用 `textContent?.trim()==='−'` 找到缩小按钮
- **关闭左侧面板后地图可视区域更大**，缩放效果更明显

## 切换到监测图模式 + 截图

```bash
# 如果按钮显示"插值图"，点击切换到监测图
agent-browser eval "var els=document.querySelectorAll('*'); for(var i=0;i<els.length;i++){if(els[i].textContent?.trim()==='插值图'&&els[i].children.length===0){var evt=new MouseEvent('click',{bubbles:true,cancelable:true});els[i].dispatchEvent(evt);break}}"
sleep 3
agent-browser set viewport 1920 1080
sleep 1
agent-browser screenshot ~/Desktop/onemap_monitor.png
```

## 关闭左侧站点列表

左侧站点列表（各站点 AQI 数值）通过一个隐藏按钮收起：

```bash
agent-browser eval "var btn=document.querySelector('button.el-button--primary'); if(btn)btn.click()"
sleep 2
agent-browser set viewport 1920 1080
sleep 1
agent-browser screenshot ~/Desktop/onemap_full.png
```

## 切换图层

```bash
# 选择污染物图层（例如切换到 PM10）
agent-browser eval "var els=document.querySelectorAll('*'); for(var i=0;i<els.length;i++){if(els[i].textContent?.trim()==='PM₁₀'){var evt=new MouseEvent('click',{bubbles:true,cancelable:true});els[i].dispatchEvent(evt);break}}"
sleep 3
```
