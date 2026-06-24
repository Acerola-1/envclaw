#!/usr/bin/env python3
"""Playwright: 平顶山市 IPP-AIR 三截图 v3 - 通过 localStorage 切换城市"""
import os, time, base64, json
from playwright.sync_api import sync_playwright

SCREENSHOT_DIR = os.path.expanduser("~/Desktop/pingdingshan_screenshots")
TIMESTAMP = time.strftime("%Y%m%d_%H%M%S")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

# URLs
BASE_URL = "https://www.mapairs.com"
ONE_MAP_URL = f"{BASE_URL}/onemap/default"            # 一张图
CONCENTRATION_URL = f"{BASE_URL}/dataStatistics/concentrationranking"  # 浓度排名

CHROME_PATH = "/Users/acerola/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"

# ============================================================
# 工具函数
# ============================================================

def cdp_ss(page, context, path):
    """CDP 截图（Mapbox 页面必须用这个）"""
    cdp = None
    try:
        cdp = context.new_cdp_session(page)
        r = cdp.send("Page.captureScreenshot", {"format": "png"})
        with open(path, "wb") as f:
            f.write(base64.b64decode(r["data"]))
        sz = os.path.getsize(path)
        print(f"  ✅ SS: {path} ({sz/1024:.0f}K)", flush=True)
        return sz
    except Exception as e:
        print(f"  ❌ SS failed: {e}", flush=True)
        return 0
    finally:
        if cdp:
            try: cdp.detach()
            except: pass


def safe_eval(page, expr):
    """安全执行 JS，超时不卡死"""
    try:
        return page.evaluate(expr)
    except Exception as e:
        print(f"  ⚠️ eval failed: {e}", flush=True)
        return None


# ============================================================
# 登录
# ============================================================

def navigate_and_login(page):
    """导航到首页并登录"""
    print("\n🔐 Step 1: Login...", flush=True)
    try:
        page.goto(BASE_URL, timeout=60000, wait_until="domcontentloaded")
    except:
        pass
    time.sleep(8)

    # 点击登录入口
    safe_eval(page, "document.querySelector('.loginBg')?.click()")
    time.sleep(3)

    # Vue 表单必须用 native value setter
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

    # 点击登录按钮
    safe_eval(page, """() => {
        for (const b of document.querySelectorAll('button')) {
            if (b.textContent?.trim() === '登录') { b.click(); return true; }
        }
        return false;
    }""")

    # 等待 token 出现
    for i in range(20):
        time.sleep(2)
        token = safe_eval(page, "localStorage.getItem('saber-token')")
        if token:
            print(f"  ✅ Login success (token found after {(i+1)*2}s)", flush=True)
            break
    else:
        print("  ⚠️ Login timeout, continuing anyway...", flush=True)

    time.sleep(3)
    # 关闭可能的弹窗
    safe_eval(page, """() => {
        for (const b of document.querySelectorAll('button')) {
            if (b.textContent?.trim() === '取消') { b.click(); break; }
        }
    }""")
    time.sleep(2)


# ============================================================
# 城市切换
# ============================================================

def switch_city_via_localstorage(page):
    """通过修改 localStorage 切换城市到平顶山市"""
    print("\n🏙️  Step 1.5: Switch city via localStorage...", flush=True)
    
    result = safe_eval(page, """() => {
        const provinces = JSON.parse(localStorage.getItem('yesprovinces') || '[]');
        const henan = provinces.find(p => p.fullName === '河南省');
        if (!henan) return '河南省 not found in yesprovinces';
        
        const pds = henan.children?.find(c => c.fullName?.includes('平顶山'));
        if (!pds) return '平顶山 not found in 河南省';
        
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
        
        return 'switched to ' + henan.fullName + ' / ' + pds.fullName;
    }""")
    print(f"  📍 {result}", flush=True)
    
    # 刷新页面使更改生效
    print("  🔄 Refreshing page...", flush=True)
    try:
        page.goto(ONE_MAP_URL, timeout=60000, wait_until="domcontentloaded")
    except:
        pass
    time.sleep(15)
    
    # 关闭弹窗
    safe_eval(page, """() => {
        for (const b of document.querySelectorAll('button')) {
            if (b.textContent?.trim() === '取消') { b.click(); break; }
        }
    }""")
    time.sleep(2)
    for _ in range(2):
        page.keyboard.press("Escape")
        time.sleep(0.3)
    
    # 验证城市
    city = safe_eval(page, """() => {
        const spans = document.querySelectorAll('span, div');
        for (const s of spans) {
            const t = s.textContent?.trim();
            if (t === '平顶山市') return t;
        }
        return null;
    }""")
    print(f"  ✅ Current city: {city}", flush=True)


# ============================================================
# 页面导航
# ============================================================

def reset_and_navigate(page, url, wait=15):
    """重置并导航到目标页"""
    print(f"  📍 Navigating to {url}", flush=True)
    try:
        page.goto(url, timeout=60000, wait_until="domcontentloaded")
    except:
        pass
    time.sleep(wait)
    # 关闭可能的对话框
    safe_eval(page, """() => {
        for (const b of document.querySelectorAll('button')) {
            if (b.textContent?.trim() === '取消') { b.click(); break; }
        }
    }""")
    time.sleep(2)
    for _ in range(2):
        page.keyboard.press("Escape")
        time.sleep(0.3)


# ============================================================
# 地图操作（通过缩放按钮）
# ============================================================

def click_zoom_button(page, text):
    """点击右侧缩放按钮（全国/河南省/平顶山市）"""
    print(f"  🔍 Clicking zoom button: {text}", flush=True)
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
    time.sleep(15)  # 等待地图缩放和瓦片加载


def wait_for_map_tiles(page, timeout=15):
    """等待地图瓦片加载"""
    print("  ⏳ Waiting for map tiles...", flush=True)
    time.sleep(timeout)


# ============================================================
# 浓度排名页面操作
# ============================================================

def setup_daily_cumulative(page):
    """设置日累计"""
    safe_eval(page, """() => {
        const radios = document.querySelectorAll('.el-radio, .el-radio-button');
        for (const r of radios) {
            if (r.textContent?.trim() === '日累计') { r.click(); return true; }
        }
        return false;
    }""")
    time.sleep(2)

def click_query(page):
    """点击查询"""
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


def extract_table_data(page):
    """提取表格数据"""
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


# ============================================================
# 主流程
# ============================================================

if __name__ == "__main__":
    print("=" * 60, flush=True)
    print("🌤️  平顶山市 IPP-AIR 三截图 v3", flush=True)
    print(f"   时间: {time.strftime('%Y-%m-%d %H:%M:%S')}", flush=True)
    print("=" * 60, flush=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROME_PATH,
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--enable-webgl",
                "--use-gl=angle",
                "--use-angle=swiftshader",
                "--ignore-gpu-blocklist"
            ]
        )
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()
        page.set_default_timeout(60000)

        # ── Step 1: 登录 ──
        navigate_and_login(page)

        # ── Step 1.5: 切换城市到平顶山市 ──
        switch_city_via_localstorage(page)

        # ── Step 2: 截图1 - 一张图 河南省 ──
        print("\n🗺️  Step 2: Screenshot 1 - 一张图 河南省...", flush=True)
        click_zoom_button(page, "河南省")
        wait_for_map_tiles(page, timeout=10)
        ss1 = os.path.join(SCREENSHOT_DIR, f"onemap_henan_{TIMESTAMP}.png")
        cdp_ss(page, context, ss1)

        # ── Step 3: 截图2 - 一张图 平顶山市 ──
        print("\n🗺️  Step 3: Screenshot 2 - 一张图 平顶山市...", flush=True)
        click_zoom_button(page, "平顶山市")
        wait_for_map_tiles(page, timeout=10)
        ss2 = os.path.join(SCREENSHOT_DIR, f"onemap_pingdingshan_{TIMESTAMP}.png")
        cdp_ss(page, context, ss2)

        # ── Step 4: 截图3 - 浓度排名 ──
        print("\n📊 Step 4: Screenshot 3 - 浓度排名...", flush=True)
        reset_and_navigate(page, CONCENTRATION_URL, wait=20)
        setup_daily_cumulative(page)
        click_query(page)
        ss3 = os.path.join(SCREENSHOT_DIR, f"concentration_ranking_{TIMESTAMP}.png")
        cdp_ss(page, context, ss3)
        tables = extract_table_data(page)
        print(f"  📋 Tables extracted: {len(tables)}", flush=True)

        # ── 输出结果 ──
        result = {
            "timestamp": TIMESTAMP,
            "ss1_henan_map": ss1,
            "ss2_pingdingshan_map": ss2,
            "ss3_concentration_ranking": ss3,
            "tables_count": len(tables),
        }
        print("\n" + "=" * 60, flush=True)
        print("✅ RESULT:", flush=True)
        print(json.dumps(result, ensure_ascii=False, indent=2), flush=True)
        print("=" * 60, flush=True)
        print("Done!", flush=True)
        browser.close()
