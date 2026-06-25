# Browser Tools Fallback Workflow

When `agent-browser` CLI is not installed, use Hermes browser tools directly.

## Login Flow

```
1. browser_navigate url="https://www.mapairs.com/"
2. browser_console expression="document.querySelector('.loginBg').click(); 'clicked'"
3. browser_snapshot  → find ref for username (e.g. e44) and password (e.g. e45)
4. browser_type ref=e44 text="X-mojl"
5. browser_type ref=e45 text="yutu@889"
6. browser_snapshot  → find ref for login button (e.g. e29)
7. browser_click ref=e29
8. browser_console expression="localStorage.getItem('saber-token')"  → verify token
```

## Province Ranking (城市 mode)

```
1. browser_navigate url="https://www.mapairs.com/dataStatistics/concentrationranking"
2. browser_snapshot  → find radio "城市" and "日累计"
3. browser_click ref=<日累计 radio>
4. browser_click ref=<cascader area>
5. browser_console expression="Array.from(document.querySelectorAll('.el-cascader-menu')[0].querySelectorAll('.el-cascader-node__label')).map(n => n.textContent?.trim())"
   → verify provinces listed
6. browser_console expression="var nodes = document.querySelectorAll('.el-cascader-menu')[0].querySelectorAll('.el-cascader-node'); var found = false; for (var i = 0; i < nodes.length; i++) { if (nodes[i].textContent.trim() === '河南省') { var label = nodes[i].querySelector('.el-cascader-node__label'); if (label) { label.click(); found = true; } break; } } found;"
   → click province
7. browser_console expression="Array.from(document.querySelectorAll('.el-cascader-menu')[1].querySelectorAll('.el-cascader-node__label')).map(n => n.textContent?.trim())"
   → verify cities listed
8. browser_console expression="var menu = document.querySelectorAll('.el-cascader-menu')[1]; var nodes = menu.querySelectorAll('.el-cascader-node'); var count = 0; for (var i = 0; i < nodes.length; i++) { var label = nodes[i].querySelector('.el-cascader-node__label'); var text = label ? label.textContent.trim() : ''; if (text !== '全部' && text !== '' && !nodes[i].classList.contains('is-checked')) { var box = nodes[i].querySelector('.el-checkbox__inner'); if (box) { box.click(); count++; } } } count;"
   → select all cities
9. browser_press key="Escape"
10. browser_click ref=<查询 button>
11. browser_vision  → screenshot + verify data loaded
12. browser_console expression="var rows = document.querySelectorAll('.el-table__body tr'); var result = []; for (var i = 0; i < rows.length; i++) { var cells = rows[i].querySelectorAll('td'); var rowData = []; for (var j = 0; j < cells.length; j++) { rowData.push(cells[j].textContent.trim()); } if (rowData.length > 0 && rowData[0] !== '') result.push(rowData); } result;"
    → extract all table data
```

## City/District Ranking (站点 mode)

Same as above but:
- Switch to "站点" radio before opening cascader
- Cascader has **4 panels** (index 0-3): 省(0) → 市(1) → 区县(2) → empty(3)
- Select province, then city, then all districts in **panel index 2** (NOT the last panel)
- To verify panel count: `document.querySelectorAll('.el-cascader-menu').length`
- To select all districts: target `panels[2]` specifically:
  ```javascript
  (() => { var panels = document.querySelectorAll('.el-cascader-menu'); var p2 = panels[2]; if (!p2) return 'no panel 2'; var items = p2.querySelectorAll('.el-cascader-node'); for (var i = 0; i < items.length; i++) { if (items[i].textContent?.trim() === '全部') { var box = items[i].querySelector('.el-checkbox__inner'); if (box) { box.click(); return 'clicked 全部 in panel 2'; } } } return '全部 not found'; })()
  ```

## Opening Cascader (Reliable Method)

Clicking the textbox ref via `browser_click` may not always open the cascader panel. Use JS instead:

```javascript
// Method 1: Click the input inside the cascader (most reliable)
document.querySelector('.el-cascader').querySelector('input').click()

// Method 2: Click the cascader container itself
document.querySelector('.el-cascader').click()
```

After clicking, verify the panel opened:
```javascript
document.querySelectorAll('.el-cascader-menu').length  // Should be > 0
```

## Key browser_console Rules

1. **Always use single-line expressions** with semicolons
2. **Return the final value** as the last expression (e.g. `count;` or `result;`)
3. **Simple queries first** to verify elements exist before complex operations
4. **Use browser_snapshot** to find correct ref IDs before clicking/typing

## Screenshot Capture

Use `browser_vision` with a question describing what to capture. The tool returns:
- AI analysis of the page
- `screenshot_path` for the captured image

For full-page data, extract via `browser_console` JS instead of relying on visual capture.
