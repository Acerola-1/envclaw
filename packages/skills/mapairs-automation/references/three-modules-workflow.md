# Mapairs 三大模块操作手册

覆盖小时播报、浓度排名、监测数据。平顶山市账号: X-mojl / yutu@889。

## URL

| 模块 | URL |
|------|-----|
| 小时播报 | `/dataStatistics/CityHourBroadcast` |
| 浓度排名 | `/dataStatistics/concentrationranking` |
| 监测数据 | `/dataStatistics/cityMonitoringData` |

## 操作步骤

### 登录

```bash
agent-browser --session-name mapairs open https://www.mapairs.com/
# 如果在 /lock 则登录，否则直接跳到模块
agent-browser eval "var el=document.querySelector('.loginBg'); if(el){var evt=new MouseEvent('click',{bubbles:true,cancelable:true});el.dispatchEvent(evt);}"
sleep 2
agent-browser eval "var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; var ins=document.querySelectorAll('input'); for(var i=0;i<ins.length;i++){if(ins[i].placeholder?.includes('账号')||ins[i].placeholder?.includes('手机号')){ins[i].removeAttribute('readonly');ins[i].focus();s.call(ins[i],'X-mojl');ins[i].dispatchEvent(new Event('input',{bubbles:true}));ins[i].dispatchEvent(new Event('change',{bubbles:true}));}if(ins[i].placeholder?.includes('密码')){ins[i].removeAttribute('readonly');ins[i].focus();s.call(ins[i],'yutu@889');ins[i].dispatchEvent(new Event('input',{bubbles:true}));ins[i].dispatchEvent(new Event('change',{bubbles:true}));}}"
sleep 1
agent-browser eval "var b=document.querySelectorAll('button'); for(var i=0;i<b.length;i++){if(b[i].textContent?.trim()==='登录'){b[i].click();break}}"
sleep 5
```

### 小时播报

```bash
agent-browser eval "location.href='https://www.mapairs.com/dataStatistics/CityHourBroadcast'"
sleep 15
agent-browser set viewport 1920 1080
sleep 2
agent-browser screenshot ~/Desktop/mapairs_hourly.png
```

表格：时间点 | 城市名 | PM2.5 | PM10 | SO2 | NO2 | CO | O3 | O3-8h | AQI

### 浓度排名 — 全省排名

```bash
agent-browser eval "location.href='https://www.mapairs.com/dataStatistics/concentrationranking'"
sleep 20
agent-browser set viewport 1920 1080
sleep 2
agent-browser screenshot ~/Desktop/rank_province.png
```

### 浓度排名 — 平顶山区县排名

```bash
agent-browser eval "location.href='https://www.mapairs.com/dataStatistics/concentrationranking'"
sleep 20
agent-browser set viewport 1920 1080
sleep 2
agent-browser eval "var r=document.querySelectorAll('.el-radio,.el-radio-button'); for(var i=0;i<r.length;i++){if(r[i].textContent?.trim()==='站点'){var evt=new MouseEvent('click',{bubbles:true,cancelable:true});r[i].dispatchEvent(evt);}}"
sleep 1
agent-browser eval "var r=document.querySelectorAll('.el-radio,.el-radio-button'); for(var i=0;i<r.length;i++){if(r[i].textContent?.trim()==='日累计'){var evt=new MouseEvent('click',{bubbles:true,cancelable:true});r[i].dispatchEvent(evt);}}"
sleep 1
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
agent-browser set viewport 1920 1080
sleep 1
agent-browser screenshot ~/Desktop/rank_city.png
```

### 监测数据

```bash
agent-browser eval "location.href='https://www.mapairs.com/dataStatistics/cityMonitoringData'"
sleep 15
agent-browser set viewport 1920 1080
sleep 2
agent-browser screenshot ~/Desktop/mapairs_monitor.png
```

表格：时间点 | 城市名 | PM2.5 | PM10 | SO2 | NO2 | CO | O3（无 O3-8h 和 AQI）

## JS eval 规则

- 用 `var` 不用 `let/const`
- 用 `for(i=0;i<n;i++)` 不用 `for...of`
- 不用箭头函数 `()=>{}`
- Vue 3 元素用 `MouseEvent` dispatch 代替 `.click()`
