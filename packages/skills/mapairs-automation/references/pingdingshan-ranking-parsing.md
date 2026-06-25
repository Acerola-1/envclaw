# 平顶山市浓度排名数据提取与解析

## 账号

| 账号 | 密码 | 默认城市 |
|------|------|----------|
| `X-mojl` | `yutu@889` | 平顶山市（河南省） |

## 完整工作流

### 1. 登录

```javascript
// Step 1: Click login icon
document.querySelector('.loginBg').click()

// Step 2: Fill credentials with Vue 3 value setter
(() => {
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
})()

// Step 3: Click login button and verify
localStorage.getItem('saber-token')  // Should return JWT
```

### 2. 省级排名（河南省所有地市）

Navigate to `https://www.mapairs.com/dataStatistics/concentrationranking`

```javascript
// Switch to 日累计
(() => {
    const radios = document.querySelectorAll('.el-radio, .el-radio-button');
    for (const r of radios) {
        if (r.textContent?.trim() === '日累计') { r.click(); return true; }
    }
    return false;
})()

// Open cascader
const cascader = document.querySelector('.el-cascader');
if (cascader) cascader.click();

// Deselect "全部" (checked by default)
(() => {
    const nodes = document.querySelectorAll('.el-cascader-node');
    for (const node of nodes) {
        if (node.textContent?.trim() === '全部') {
            const box = node.querySelector('.el-checkbox__inner');
            if (box) box.click();
        }
    }
})()

// Select all cities under 河南省 (after 全部 in node list)
(() => {
    const nodes = document.querySelectorAll('.el-cascader-node');
    let foundAll = false;
    for (const node of nodes) {
        const text = node.textContent?.trim();
        if (text === '全部') { foundAll = true; continue; }
        if (foundAll) {
            const box = node.querySelector('.el-checkbox__inner');
            if (box && !node.classList.contains('is-checked')) box.click();
        }
    }
})()

// Close panel and query
// Press Escape, then click Query button
```

### 3. 市级排名（平顶山市各区/站点）

Navigate fresh, then switch to "站点" mode:

```javascript
// Switch to 站点 mode
(() => {
    const radios = document.querySelectorAll('.el-radio, .el-radio-button');
    for (const r of radios) {
        if (r.textContent?.trim() === '站点') { r.click(); return true; }
    }
    return false;
})()

// Switch to 日累计
(() => {
    const radios = document.querySelectorAll('.el-radio, .el-radio-button');
    for (const r of radios) {
        if (r.textContent?.trim() === '日累计') { r.click(); return true; }
    }
    return false;
})()

// Open cascader (now shows 3 panels: 省 → 市 → 区县)
document.querySelector('.el-cascader').click();

// Expand 河南省 (panel 0)
(() => {
    const nodes = document.querySelectorAll('.el-cascader-menu')[0].querySelectorAll('.el-cascader-node');
    for (const node of nodes) {
        if (node.textContent?.includes('河南省')) {
            const label = node.querySelector('.el-cascader-node__label');
            if (label) label.click();
        }
    }
})()

// Expand 平顶山市 (panel 1)
(() => {
    const nodes = document.querySelectorAll('.el-cascader-menu')[1].querySelectorAll('.el-cascader-node');
    for (const node of nodes) {
        if (node.textContent?.includes('平顶山')) {
            const expandIcon = node.querySelector('.el-icon.el-cascader-node__postfix');
            if (expandIcon) expandIcon.click();
            const label = node.querySelector('.el-cascader-node__label');
            if (label) label.click();
        }
    }
})()

// Select all districts (panel 2 — skip "全部" node)
(() => {
    const menu = document.querySelectorAll('.el-cascader-menu')[2];
    if (!menu) return 'no third panel';
    const nodes = menu.querySelectorAll('.el-cascader-node');
    for (const node of nodes) {
        if (node.textContent?.trim() === '全部') continue;
        const box = node.querySelector('.el-checkbox__inner');
        if (box && !node.classList.contains('is-checked')) box.click();
    }
    return 'done';
})()

// Escape → 查询
```

平顶山市的区县列表（共12个）：
宝丰县、城乡一体化示范区、石龙区、高新区、郏县、鲁山县、汝州市、卫东区、舞钢市、新华区、叶县、湛河区

### 4. 数据提取

```javascript
// Extract full table
const rows = document.querySelectorAll('.el-table__body tr');
const result = [];
for (const row of rows) {
    const cells = row.querySelectorAll('td');
    const rowData = [];
    for (const cell of cells) {
        rowData.push(cell.textContent?.trim());
    }
    if (rowData.length > 0 && rowData[0] !== '') result.push(rowData);
}
return result;
```

### 5. 表格列解析

每行代表一个排名位置，每个指标显示"在该排名位置的城市名+指标值"：

```
col[0]  = 排名
col[1]  = 综指城市名
col[2]  = 综指值
col[3]  = PM2.5城市名（该排名位置对应的城市）
col[4]  = PM2.5值
col[5]  = PM10城市名
col[6]  = PM10值
col[7]  = SO2城市名
col[8]  = SO2值
col[9]  = NO2城市名
col[10] = NO2值
col[11] = CO城市名
col[12] = CO值
col[13] = O3城市名
col[14] = O3值
col[15] = AQI城市名
col[16] = AQI值
col[17] = 等级（优/良）
col[18] = 首要污染物
```

**注意**：同一城市的各指标排名可能不同。例如平顶山市的综指排第16，但O3排第1，NO2排第18。

## 关键发现：平顶山市当前排名

| 指标 | 数值 | 全省排名 | 评价 |
|------|------|:--------:|------|
| 综指 | 6.266 | 16/18 | 倒数第3 |
| PM₂.₅ | 28 µg/m³ | 14/18 | 中等偏后 |
| PM₁₀ | 55 µg/m³ | 16/18 | 偏高，首要污染物 |
| SO₂ | 6 µg/m³ | 8/18 | 中等 |
| NO₂ | 40 µg/m³ | 18/18 | **倒数第1** |
| CO | 0.6 mg/m³ | 16/18 | 偏高 |
| O₃ | 24 µg/m³ | 1/18 | **最优** |
| AQI | 54 | 16/18 | 良 |

## 站点级异常数据

| 站点 | 综指 | 异常指标 |
|------|:----:|----------|
| 林业局 | 7.849 | PM₂.₅ 40（全市最高） |
| 遵化党群中心 | 7.171 | PM₁₀ 68, NO₂ 52 |
| 石龙区站 | 7.063 | NO₂ 58（全市最高） |
| 干部公寓 | 5.679 | CO 2.1（全市最高，其他站点0.2-0.8） |
