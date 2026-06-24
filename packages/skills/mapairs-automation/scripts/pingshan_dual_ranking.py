#!/usr/bin/env python3
"""Playwright: 平顶山市浓度排名双截图 - 省级排名 + 区县排名 (日累计)"""
import os, time, base64, json
from playwright.sync_api import sync_playwright

SCREENSHOT_DIR = os.path.expanduser("~/Desktop/mapairs_screenshots")
TIMESTAMP = time.strftime("%Y%m%d_%H%M%S")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

TARGET_URL = "https://www.mapairs.com/dataStatistics/ConcentrationRanking"
CITY_NAME = "平顶山市"
PROVINCE_NAME = "河南省"

CHROME_PATH = "/Users/acerola/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"

def cdp_ss(page, context, path):
    cdp = None
    try:
        cdp = context.new_cdp_session(page)
        r = cdp.send("Page.captureScreenshot", {"format": "png"})
        with open(path, "wb") as f:
            f.write(base64.b64decode(r["data"]))
        sz = os.path.getsize(path)
        print(f"  SS: {path} ({sz/1024:.0f}K)", flush=True)
        return sz
    except Exception as e:
        print(f"  SS failed: {e}", flush=True)
        return 0
    finally:
        if cdp:
            try: cdp.detach()
            except: pass

def safe_eval(page, expr):
    try:
        return page.evaluate(expr)
    except Exception as e:
        print(f"  eval failed: {e}", flush=True)
        return None

def extract_table_data(page):
    result = safe_eval(page, """() => {
        const tables = document.querySelectorAll('table');
        const results = [];
        for (const table of tables) {
            if (table.className && table.className.includes('el-date-table')) continue;
            const rows = table.querySelectorAll('tr');
            const tableData = [];
            for (const row of rows) {
                const cells = row.querySelectorAll('th, td');
                const rowData = Array.from(cells).map(c => c.textContent?.trim() || '');
                if (rowData.length > 0 && rowData.some(c => c.length > 0)) tableData.push(rowData);
            }
            if (tableData.length > 0) results.push(tableData);
        }
        return results;
    }""")
    return result if result else []

def wait_for_page(page, timeout=20):
    time.sleep(timeout)
    for i in range(3):
        loaded = safe_eval(page, """() => {
            const tables = document.querySelectorAll('table');
            for (const t of tables) {
                if (t.className && t.className.includes('el-date-table')) continue;
                const rows = t.querySelectorAll('tr');
                if (rows.length > 1) return true;
            }
            return false;
        }""")
        if loaded:
            return True
        page.reload(timeout=30000)
        time.sleep(15)
    return False

def navigate_and_login(page):
    try:
        page.goto("https://www.mapairs.com/", timeout=60000, wait_until="domcontentloaded")
    except: pass
    time.sleep(8)

    safe_eval(page, "document.querySelector('.loginBg')?.click()")
    time.sleep(3)

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
    time.sleep(0.5)
    safe_eval(page, """() => { for (const b of document.querySelectorAll('button')) { if (b.textContent?.trim() === '登录') { b.click(); break; } } }""")

    for i in range(15):
        time.sleep(2)
        token = safe_eval(page, "localStorage.getItem('saber-token')")
        if token: break

    time.sleep(3)
    safe_eval(page, """() => { for (const b of document.querySelectorAll('button')) { if (b.textContent?.trim() === '取消') { b.click(); break; } } }""")
    time.sleep(2)

def reset_and_navigate(page):
    try:
        page.goto(TARGET_URL, timeout=60000, wait_until="domcontentloaded")
    except: pass
    time.sleep(20)
    safe_eval(page, """() => { for (const b of document.querySelectorAll('button')) { if (b.textContent?.trim() === '取消') { b.click(); break; } } }""")
    time.sleep(2)
    for _ in range(2):
        page.keyboard.press("Escape")
        time.sleep(0.3)

def setup_daily_cumulative(page):
    safe_eval(page, """() => {
        const radios = document.querySelectorAll('.el-radio, .el-radio-button');
        for (const r of radios) {
            if (r.textContent?.trim() === '日累计') { r.click(); return true; }
        }
        return false;
    }""")
    time.sleep(2)

def click_query(page):
    safe_eval(page, """() => {
        const btns = document.querySelectorAll('button, .el-button');
        for (const btn of btns) {
            const text = btn.textContent?.trim();
            if (text === '查询' || text === '搜索') {
                const rect = btn.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) { btn.click(); return true; }
            }
        }
        return false;
    }""")
    time.sleep(5)

def clear_all_selections(page):
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

def select_cascader_level(page, menu_index, text):
    node = page.locator(
        f'.el-cascader-panel .el-cascader-menu:nth-child({menu_index + 1}) .el-cascader-node'
    ).filter(has_text=text).first
    node.scroll_into_view_if_needed()
    time.sleep(0.5)
    checkbox_inner = node.locator('.el-checkbox__inner').first
    if checkbox_inner.count() > 0:
        checkbox_inner.click()
        print(f"  Level {menu_index + 1}: {text}", flush=True)
        time.sleep(2)
        return True
    return False

def format_summary(tables1, tables2, city, province):
    lines = [f"📊 **{city}空气质量排名分析（日累计）**\n"]
    
    if tables1:
        for table in tables1:
            if len(table) > 1:
                lines.append(f"**{province}城市排名**（共{len(table)-1}个城市）")
                # Find city's position
                for row in table[1:]:
                    if len(row) > 2 and city in str(row[1] if len(row) > 1 else row[0]):
                        aqi = row[10] if len(row) > 10 else '-'
                        level = row[11] if len(row) > 11 else '-'
                        lines.append(f"  {city}排名第{row[0]}位，综指{row[2]}，AQI {aqi}，等级{level}")
                        break
                # Show top 3
                lines.append("  前三名：")
                for row in table[1:4]:
                    if len(row) > 2:
                        name = row[1] if len(row) > 1 else row[0]
                        lines.append(f"    第{row[0]}名: {name}，综指{row[2]}")
                lines.append("")
    
    if tables2:
        for table in tables2:
            if len(table) > 1:
                lines.append(f"**{city}区县排名**（共{len(table)-1}个区县）")
                for row in table[1:]:
                    if len(row) > 2:
                        name = row[1] if len(row) > 1 else row[0]
                        aqi = row[10] if len(row) > 10 else '-'
                        level = row[11] if len(row) > 11 else '-'
                        lines.append(f"  第{row[0]}名: {name}，综指{row[2]}，AQI {aqi}，等级{level}")
                lines.append("")
    
    summary = "\n".join(lines)
    return summary[:497] + "..." if len(summary) > 500 else summary

if __name__ == "__main__":
    print("=" * 60, flush=True)
    print(f"平顶山市浓度排名双截图", flush=True)
    print("=" * 60, flush=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROME_PATH,
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"]
        )
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()
        page.set_default_timeout(60000)

        print("\nStep 1: Login...", flush=True)
        navigate_and_login(page)
        print("  Login done", flush=True)

        # Screenshot 1: 河南省 全部城市排名 (平顶山在省下的排名)
        print(f"\nStep 2: Screenshot 1 - {PROVINCE_NAME} 全部城市排名...", flush=True)
        reset_and_navigate(page)
        wait_for_page(page)
        
        clear_all_selections(page)
        cascader = page.locator('.el-cascader').first
        cascader.click()
        time.sleep(3)
        
        select_cascader_level(page, 0, PROVINCE_NAME)
        select_cascader_level(page, 1, "全部")
        
        page.keyboard.press("Escape")
        time.sleep(1)
        
        setup_daily_cumulative(page)
        click_query(page)
        
        ss1 = os.path.join(SCREENSHOT_DIR, f"rank_henan_cities_{TIMESTAMP}.png")
        cdp_ss(page, context, ss1)
        tables1 = extract_table_data(page)
        print(f"  Tables: {len(tables1)}", flush=True)

        # Screenshot 2: 平顶山市 全部区县排名
        print(f"\nStep 3: Screenshot 2 - {CITY_NAME} 全部区县排名...", flush=True)
        reset_and_navigate(page)
        wait_for_page(page)
        
        clear_all_selections(page)
        cascader = page.locator('.el-cascader').first
        cascader.click()
        time.sleep(3)
        
        select_cascader_level(page, 0, PROVINCE_NAME)
        time.sleep(1)
        select_cascader_level(page, 1, CITY_NAME)
        time.sleep(1)
        
        menu_count = safe_eval(page, """() => {
            return document.querySelectorAll('.el-cascader-panel .el-cascader-menu').length;
        }""")
        print(f"  Menu count: {menu_count}", flush=True)
        
        if menu_count and menu_count >= 3:
            select_cascader_level(page, 2, "全部")
        
        page.keyboard.press("Escape")
        time.sleep(1)
        
        setup_daily_cumulative(page)
        click_query(page)
        
        ss2 = os.path.join(SCREENSHOT_DIR, f"rank_pingdingshan_districts_{TIMESTAMP}.png")
        cdp_ss(page, context, ss2)
        tables2 = extract_table_data(page)
        print(f"  Tables: {len(tables2)}", flush=True)

        summary = format_summary(tables1, tables2, CITY_NAME, PROVINCE_NAME)

        result = {
            "province": PROVINCE_NAME,
            "city": CITY_NAME,
            "ss1": ss1,
            "ss2": ss2,
            "tables1": len(tables1),
            "tables2": len(tables2),
            "summary": summary,
        }
        print("\n" + "=" * 60, flush=True)
        print("RESULT:", flush=True)
        print(json.dumps(result, ensure_ascii=False, indent=2), flush=True)
        print("=" * 60, flush=True)
        print("Done!", flush=True)
        browser.close()
