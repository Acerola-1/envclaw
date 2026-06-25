# Pingdingshan IPP-AIR Workflow (平顶山市)

## Three-Screenshot Mode

| Screenshot | Page | Target | Purpose |
|------------|------|--------|---------|
| Screenshot 1 | 一张图 | 河南省范围 | Province air quality overview |
| Screenshot 2 | 一张图 | 平顶山市范围 | City detailed view |
| Screenshot 3 | 浓度排名 | 河南省地市日累计 | City ranking table |

## Output

- 3 PNG screenshots
- Text summary

## Quick Run

```bash
python3 ~/.hermes/skills/web-automation/mapairs-automation/scripts/pingdingshan_screenshot.py
```

## City Switch

Default account city is 保定市 (河北省). Must switch to 平顶山市 via localStorage modification:

```python
def switch_city_via_localstorage(page):
    """Switch to 平顶山市 via localStorage regionList."""
    safe_eval(page, """() => {
        const provinces = JSON.parse(localStorage.getItem('yesprovinces') || '[]');
        const henan = provinces.find(p => p.fullName === '河南省');
        const pds = henan.children?.find(c => c.fullName?.includes('平顶山'));
        const newRegionList = {
            provinceShortCode: henan.provinceCodeVO,
            provinceName: henan.fullName,
            parentShortCode: henan.provinceCodeVO,
            parentName: henan.fullName,
            currentShortCode: pds.regionKeyVO,
            currentRegionName: pds.fullName,
            currentRegionLevel: 1,
            virtualCode: "-"
        };
        localStorage.setItem('regionList', JSON.stringify(newRegionList));
        localStorage.setItem('is_province', '0');
    }""")
    # Refresh to apply
    page.goto(url, timeout=60000, wait_until="domcontentloaded")
    time.sleep(15)
```

**Key codes**: 河南省 `4102950f2`, 平顶山市 `41459546a`

## Map Navigation

Mapbox GL JS map instance is hidden in Vue 3 — `flyTo()` unavailable. Use zoom buttons:

```python
def click_zoom_button(page, text):
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
    time.sleep(12)  # Wait for tiles
```

After zoom, wait 8-15 seconds for map tiles to load.

## Mapbox Access Limitations

Mapbox GL JS map instance is hidden:
- `window` has no map object
- Pinia store `map.state.map` is empty `{}`
- Vue 3 component tree search fails
- DOM elements have no `__vueParentComponent`

**Workaround**: Use right-side zoom buttons (全国/河南省/平顶山市) — button text depends on default city.
