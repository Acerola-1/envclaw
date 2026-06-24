#!/usr/bin/env python3
"""Playwright: login → concentration ranking → select 湖州市 → screenshot (v4)
2026-06-16: 修复城市选择 - 点击 .el-checkbox__inner 而非 input[type="checkbox"]
"""
import os, time, base64, json, shutil
from playwright.sync_api import sync_playwright

SCREENSHOT_DIR = os.environ.get("MAPAIRS_SS_DIR", "/opt/data/screenshots")
TIMESTAMP = time.strftime("%Y%m%d_%H%M%S")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

TARGET_URL = "https://www.mapairs.com/dataStatistics/ConcentrationRanking"
CITY_NAME = "湖州市"

# Chrome 路径 - 根据平台自动选择
CHROME_PATH = os.environ.get("CHROME_PATH")
if not CHROME_PATH:
    import platform
    if platform.system() == "Darwin":
        CHROME_PATH = os.path.expanduser("~/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing")
    else:
        CHROME_PATH = "/opt/hermes/.playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell"

def cdp_ss(page, context, path):
    cdp = None
    try:
        cdp = context.new_cdp_session(page)
        r = cdp.send("Page.captureScreenshot", {"format": "png"})
        with open(path, "wb") as f:
            f.write(base64.b64decode(r["data"]))
        sz = os.path.getsize(path)
        print(f"  SS: {path} ({sz/1024:.0f}K)", flush=True)
        return sz > 200000
    except Exception as e:
        print(f"  SS failed: {e}", flush=True)
        return False
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

def is_page_loaded(page):
    result = safe_eval(page, """() => {
        const tables = document.querySelectorAll('table');
        if (tables.length > 0) {
            for (const t of tables) {
                if (t.className && t.className.includes('el-date-table')) continue;
                const rows = t.querySelectorAll('tr');
                if (rows.length > 1) return true;
            }
        }
        const mainContent = document.querySelector('.main-content, .content-wrapper, [class*="main"], [class*="content"]');
        if (mainContent) {
            const text = mainContent.innerText || '';
            return text.length > 200 && !text.includes('加载中');
        }
        return false;
    }""")
    return result is True

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

def format_summary(tables):
    if not tables:
        return "未能提取到表格数据，详见截图。"
    lines = ["📊 **浓度排名数据总结**\n"]
    for i, table in enumerate(tables):
        if len(table) < 2:
            continue
        headers = table[0]
        lines.append(f"**数据表 {i+1}**（{len(table)-1} 条记录）")
        lines.append(" | ".join(headers[:8]))
        lines.append("---")
        for row in table[1:6]:
            lines.append(" | ".join(row[:8]))
        if len(table) > 6:
            lines.append(f"... 共 {len(table)-1} 条记录")
        lines.append("")
    return "\n".join(lines)

print("=" * 60, flush=True)
print("Mapairs 浓度排名自动截图 v4", flush=True)
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

    # Step 1: Login
    print("\nStep 1: Login...", flush=True)
    try:
        page.goto("https://www.mapairs.com/", timeout=60000, wait_until="domcontentloaded")
    except Exception as e:
        print(f"  Initial nav: {e}", flush=True)
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

    safe_eval(page, """() => { 
        for (const b of document.querySelectorAll('button')) { 
            if (b.textContent?.trim() === '登录') { b.click(); break; } 
        } 
    }""")

    print("  Waiting for login...", flush=True)
    for i in range(15):
        time.sleep(2)
        token = safe_eval(page, "localStorage.getItem('saber-token')")
        if token:
            print(f"  Token obtained (attempt {i+1})", flush=True)
            time.sleep(3)
            break
    else:
        print("  Login timeout", flush=True)

    dialog_visible = safe_eval(page, """() => {
        const dialogs = document.querySelectorAll('.el-dialog, .login-dialog, [class*="login"]');
        for (const d of dialogs) {
            const rect = d.getBoundingClientRect();
            if (rect.width > 100 && rect.height > 100 && rect.y > 0 && rect.y < 600) return true;
        }
        return false;
    }""")
    if dialog_visible:
        safe_eval(page, """() => { 
            for (const b of document.querySelectorAll('button')) { 
                if (b.textContent?.trim() === '取消') { b.click(); break; } 
            } 
        }""")
        time.sleep(2)

    print("  Login done", flush=True)

    # Step 2: Navigate
    print("\nStep 2: Navigate to concentration ranking...", flush=True)
    try:
        page.goto(TARGET_URL, timeout=60000, wait_until="domcontentloaded")
    except Exception as e:
        print(f"  Nav error: {e}", flush=True)
    time.sleep(20)
    print(f"  URL: {page.url}", flush=True)

    dialog_reappeared = safe_eval(page, """() => {
        const dialogs = document.querySelectorAll('.el-dialog, .login-dialog, [class*="login"]');
        for (const d of dialogs) {
            const rect = d.getBoundingClientRect();
            if (rect.width > 100 && rect.height > 100 && rect.y > 0 && rect.y < 600) return true;
        }
        return false;
    }""")
    if dialog_reappeared:
        safe_eval(page, """() => { for (const b of document.querySelectorAll('button')) { if (b.textContent?.trim() === '取消') { b.click(); break; } } }""")
        time.sleep(2)
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
        time.sleep(5)
        try:
            page.goto(TARGET_URL, timeout=60000, wait_until="domcontentloaded")
        except: pass
        time.sleep(20)

    loaded = is_page_loaded(page)
    print(f"  Page loaded: {loaded}", flush=True)

    if not loaded:
        for attempt in range(3):
            page.reload(timeout=30000)
            time.sleep(15)
            loaded = is_page_loaded(page)
            if loaded: break

    # Step 3: Select city - v4: 点击 .el-checkbox__inner
    print(f"\nStep 3: Selecting {CITY_NAME}...", flush=True)
    city_selected = False
    try:
        for _ in range(2):
            page.keyboard.press("Escape")
            time.sleep(0.3)

        safe_eval(page, """() => {
            const closeBtn = document.querySelector('.el-cascader .el-tag .el-tag__close');
            if (closeBtn) closeBtn.click();
        }""")
        time.sleep(1)

        cascader = page.locator('.el-cascader').first
        rect = cascader.bounding_box()
        if rect and rect['width'] > 50:
            print(f"  Found cascader at ({rect['x']:.0f}, {rect['y']:.0f})", flush=True)
            cascader.click()
            time.sleep(3)

            # 选择浙江省（第一级）
            province_node = page.locator(
                '.el-cascader-panel .el-cascader-menu:first-child .el-cascader-node'
            ).filter(has_text='浙江省').first
            province_node.scroll_into_view_if_needed()
            time.sleep(0.5)
            province_node.click()
            time.sleep(3)
            print("  Selected 浙江省", flush=True)

            # 选择湖州市 - 点击 .el-checkbox__inner（可见复选框）
            city_node = page.locator(
                '.el-cascader-panel .el-cascader-menu:last-child .el-cascader-node'
            ).filter(has_text='湖州市').first
            city_node.wait_for(state='visible', timeout=5000)
            time.sleep(1)

            checkbox_inner = city_node.locator('.el-checkbox__inner').first
            if checkbox_inner.count() > 0:
                checkbox_inner.click()
                print("  Clicked .el-checkbox__inner", flush=True)
                city_selected = True
            else:
                checkbox_span = city_node.locator('.el-checkbox').first
                if checkbox_span.count() > 0:
                    checkbox_span.click()
                    print("  Clicked .el-checkbox span", flush=True)
                    city_selected = True
                else:
                    city_node.click()
                    print("  Clicked city node (fallback)", flush=True)
                    city_selected = True

            time.sleep(1)
            # 关闭级联面板
            page.keyboard.press("Escape")
            time.sleep(1)

            selected_value = safe_eval(page, """() => {
                const cascader = document.querySelector('.el-cascader');
                if (cascader) {
                    const tags = cascader.querySelectorAll('.el-tag');
                    return Array.from(tags).map(t => t.textContent?.trim()).join(', ') || 'no tags';
                }
                return 'no cascader';
            }""")
            print(f"  Selected value: {selected_value}", flush=True)
    except Exception as e:
        print(f"  City selection error: {e}", flush=True)

    print(f"  City selected: {city_selected}", flush=True)

    # Step 4: Click query button
    print("\nStep 4: Clicking query button...", flush=True)
    query_clicked = safe_eval(page, """() => {
        const btns = document.querySelectorAll('button, .el-button');
        for (const btn of btns) {
            const text = btn.textContent?.trim();
            if (text === '查询' || text === '搜索') {
                const rect = btn.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    btn.click();
                    return {clicked: true, text: text};
                }
            }
        }
        return {clicked: false};
    }""")
    print(f"  Query button: {query_clicked}", flush=True)
    if query_clicked and query_clicked.get('clicked'):
        time.sleep(5)

    # Step 5: Extract table data
    print("\nStep 5: Extracting table data...", flush=True)
    tables = extract_table_data(page)
    summary = format_summary(tables)
    print(f"  {len(tables)} tables found", flush=True)

    # Step 6: Screenshots
    print("\nStep 6: Taking screenshots...", flush=True)
    ss1 = os.path.join(SCREENSHOT_DIR, f"mapairs_concentration_{TIMESTAMP}.png")
    ss2 = os.path.join(SCREENSHOT_DIR, f"mapairs_concentration_scrolled_{TIMESTAMP}.png")
    cdp_ss(page, context, ss1)
    try:
        needs_scroll = safe_eval(page, "() => document.body.scrollHeight > window.innerHeight + 100")
        if needs_scroll:
            page.evaluate("window.scrollBy(0, 500)")
            time.sleep(2)
            page.keyboard.press("Escape")
            time.sleep(1)
            cdp_ss(page, context, ss2)
        else:
            shutil.copy2(ss1, ss2)
    except:
        pass

    result = {
        "s1": ss1,
        "s2": ss2,
        "summary": summary,
        "url": page.url,
        "tables": len(tables),
        "city_selected": city_selected,
        "query_clicked": bool(query_clicked and query_clicked.get('clicked'))
    }
    print("\n" + "=" * 60, flush=True)
    print("RESULT:", flush=True)
    print(json.dumps(result, ensure_ascii=False, indent=2), flush=True)
    print("=" * 60, flush=True)
    print("Done!", flush=True)
    browser.close()
