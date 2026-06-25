#!/usr/bin/env python3
"""Mapairs 浓度排名截图 - 使用 agent-browser CLI 版本"""
import subprocess
import os
import time
import json
import sys
import re
import datetime

# ====== 启动前检测 agent-browser 是否安装 ======
def check_agent_browser():
    """检测 agent-browser 是否已安装"""
    try:
        r = subprocess.run(["agent-browser", "--version"], capture_output=True, text=True, timeout=10)
        if r.returncode == 0:
            print(f"✅ agent-browser 已安装: {r.stdout.strip()}")
            return True
    except FileNotFoundError:
        pass
    except Exception:
        pass
    
    print("=" * 60)
    print("❌ agent-browser 未安装！")
    print("")
    print("请先安装：")
    print("  npm install -g agent-browser")
    print("")
    print("如需 Node.js，请访问：https://nodejs.org")
    print("=" * 60)
    return False

if not check_agent_browser():
    sys.exit(1)

OUTPUT_DIR = os.path.join(os.path.expanduser("~"), "Desktop", "mapairs_screenshots")
os.makedirs(OUTPUT_DIR, exist_ok=True)

def run(cmd, timeout=30):
    """运行 agent-browser 命令并返回输出"""
    print(f"  → {' '.join(cmd)}")
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        if r.returncode != 0:
            print(f"  ⚠️  stderr: {r.stderr.strip()}")
        return r.stdout.strip(), r.stderr.strip(), r.returncode
    except subprocess.TimeoutExpired:
        print(f"  ⚠️  timeout ({timeout}s)")
        return "", "timeout", -1
    except FileNotFoundError:
        print(f"  ❌ agent-browser 未找到！请先安装")
        return "", "not found", -1

def safe_eval(page_js):
    """通过 agent-browser evaluate 执行 JS"""
    out, err, code = run(["agent-browser", "evaluate", page_js], timeout=10)
    if code != 0:
        return None
    try:
        return json.loads(out) if out else None
    except:
        return out

def cdp_screenshot(path):
    """使用 agent-browser 截图"""
    print(f"\n📸 截图: {path}")
    out, err, code = run(["agent-browser", "screenshot", path], timeout=20)
    if code == 0 and os.path.exists(path):
        size = os.path.getsize(path)
        print(f"✅ 截图成功 ({size/1024:.1f} KB)")
        return size
    print(f"❌ 截图失败: {err}")
    return 0

def login():
    """登录 mapairs"""
    print("\n🔐 登录中...")
    time.sleep(3)
    
    # 用 JS 填账号密码
    js_fill = """() => {
        const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        let filled = false;
        for (const i of document.querySelectorAll('input')) {
            if (i.placeholder?.includes('账号')) {
                i.removeAttribute('readonly'); i.focus();
                s.call(i, 'X-mojl');
                i.dispatchEvent(new Event('input', {bubbles: true}));
                i.dispatchEvent(new Event('change', {bubbles: true}));
                filled = true;
            }
            if (i.placeholder?.includes('密码')) {
                i.removeAttribute('readonly'); i.focus();
                s.call(i, 'yutu@889');
                i.dispatchEvent(new Event('input', {bubbles: true}));
                i.dispatchEvent(new Event('change', {bubbles: true}));
            }
        }
        return filled;
    }"""
    safe_eval(js_fill)
    time.sleep(1)
    
    # 点登录按钮
    safe_eval("""() => {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
            if (btn.textContent?.trim() === '登录') { btn.click(); return true; }
        }
        return false;
    }""")
    time.sleep(5)
    
    # 验证 token
    token = safe_eval("localStorage.getItem('saber-token')")
    if token:
        print(f"✅ 登录成功 (token: {token[:20]}...)")
        return True
    else:
        print("❌ 登录失败")
        return False

def clear_all_selections():
    """清空级联选择器"""
    safe_eval("""() => {
        for (let i = 0; i < 5; i++) {
            const tags = document.querySelectorAll('.el-cascader .el-tag .el-tag__close');
            if (tags.length > 0) { tags[0].click(); }
        }
    }""")
    time.sleep(1)
    safe_eval("""() => {
        const checked = document.querySelectorAll('.el-cascader-node.is-checked');
        for (const node of checked) {
            const box = node.querySelector('.el-checkbox__inner');
            if (box) box.click();
        }
    }""")
    time.sleep(1)

def setup_daily_cumulative():
    """选择日累计"""
    safe_eval("""() => {
        const radios = document.querySelectorAll('.el-radio, .el-radio-button');
        for (const r of radios) {
            if (r.textContent?.trim() === '日累计') { r.click(); return true; }
        }
        return false;
    }""")
    time.sleep(1)

def click_query():
    """点击查询按钮"""
    safe_eval("""() => {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
            if (btn.textContent?.trim() === '查询') { btn.click(); return true; }
        }
        return false;
    }""")
    time.sleep(3)

def extract_table():
    """提取表格数据"""
    data = safe_eval("""() => {
        const rows = document.querySelectorAll('.el-table__body tr');
        const result = [];
        for (const row of rows) {
            const cells = row.querySelectorAll('td');
            result.push(Array.from(cells).map(c => c.textContent?.trim()));
        }
        return result;
    }""")
    time.sleep(1)
    return data

def wait_for_table(timeout=30):
    """等待表格加载"""
    start = time.time()
    while time.time() - start < timeout:
        data = extract_table()
        if data and len(data) > 0:
            print(f"✅ 表格已加载 ({len(data)} 行)")
            return data
        time.sleep(1)
    print("❌ 表格加载超时")
    return None

def check_abnormalities(data):
    """检查异常数据"""
    issues = []
    if not data:
        return issues
    for row in data:
        if len(row) >= 3:
            name = row[1] if len(row) > 1 else ""
            for val in row[2:]:
                try:
                    num = float(val) if val else 0
                    if num > 150:
                        issues.append(f"{name} 数据异常: {val}")
                except:
                    pass
    return issues

def main():
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # 打开浏览器并登录
    print("\n🌐 打开 mapairs.com...")
    run(["agent-browser", "open", "https://www.mapairs.com/"], timeout=30)
    time.sleep(5)
    
    if not login():
        run(["agent-browser", "close"])
        return None, None, []
    
    # ====== 截图1: 全省地市排名 ======
    print("\n📸 截图1: 河南省地市排名")
    run(["agent-browser", "open", "https://www.mapairs.com/dataStatistics/concentrationranking"], timeout=30)
    time.sleep(15)
    
    if not wait_for_table():
        run(["agent-browser", "close"])
        return None, None, []
    
    clear_all_selections()
    safe_eval("document.querySelector('.el-cascader')?.click()")
    time.sleep(2)
    
    # 选择河南省并展开
    safe_eval("""() => {
        const nodes = document.querySelectorAll('.el-cascader-node');
        for (const node of nodes) {
            if (node.textContent?.includes('河南省')) {
                const label = node.querySelector('.el-cascader-node__label');
                if (label) label.click();
                break;
            }
        }
    }""")
    time.sleep(2)
    
    # 勾选所有城市（不勾省本身）
    safe_eval("""() => {
        const nodes = document.querySelectorAll('.el-cascader-node');
        let inHenan = false;
        for (const node of nodes) {
            if (node.textContent?.trim() === '河南省') { inHenan = true; continue; }
            if (inHenan && node.level === 2) {
                const box = node.querySelector('.el-checkbox__inner');
                if (box && !node.classList.contains('is-checked')) box.click();
            }
            if (inHenan && node.level === 1) break;
        }
    }""")
    time.sleep(1)
    
    safe_eval("document.dispatchEvent(new KeyboardEvent('keydown', {'key': 'Escape'}))")
    time.sleep(1)
    
    setup_daily_cumulative()
    click_query()
    time.sleep(5)
    
    province_data = extract_table()
    province_issues = check_abnormalities(province_data)
    
    province_path = os.path.join(OUTPUT_DIR, f"rank_province_{timestamp}.png")
    cdp_screenshot(province_path)
    
    # ====== 截图2: 平顶山市各区排名 ======
    print("\n📸 截图2: 平顶山市各区排名")
    run(["agent-browser", "open", "https://www.mapairs.com/dataStatistics/concentrationranking"], timeout=30)
    time.sleep(15)
    
    if not wait_for_table():
        run(["agent-browser", "close"])
        return province_path, None, province_issues
    
    clear_all_selections()
    safe_eval("document.querySelector('.el-cascader')?.click()")
    time.sleep(2)
    
    # 河南省 > 平顶山市
    safe_eval("""() => {
        const nodes = document.querySelectorAll('.el-cascader-node');
        for (const node of nodes) {
            if (node.textContent?.includes('河南省')) {
                const label = node.querySelector('.el-cascader-node__label');
                if (label) label.click();
                break;
            }
        }
    }""")
    time.sleep(2)
    
    safe_eval("""() => {
        const nodes = document.querySelectorAll('.el-cascader-node');
        let inHenan = false;
        for (const node of nodes) {
            if (node.textContent?.trim() === '河南省') { inHenan = true; continue; }
            if (inHenan && node.textContent?.includes('平顶山')) {
                const label = node.querySelector('.el-cascader-node__label');
                if (label) label.click();
                break;
            }
        }
    }""")
    time.sleep(2)
    
    # 勾选所有区县
    safe_eval("""() => {
        const nodes = document.querySelectorAll('.el-cascader-node');
        let inPds = false;
        for (const node of nodes) {
            if (node.textContent?.includes('平顶山')) { inPds = true; continue; }
            if (inPds && node.level === 3) {
                const box = node.querySelector('.el-checkbox__inner');
                if (box && !node.classList.contains('is-checked')) box.click();
            }
            if (inPds && node.level === 2) break;
        }
    }""")
    time.sleep(1)
    
    safe_eval("document.dispatchEvent(new KeyboardEvent('keydown', {'key': 'Escape'}))")
    time.sleep(1)
    
    setup_daily_cumulative()
    click_query()
    time.sleep(5)
    
    city_data = extract_table()
    city_issues = check_abnormalities(city_data)
    
    city_path = os.path.join(OUTPUT_DIR, f"rank_city_{timestamp}.png")
    cdp_screenshot(city_path)
    
    run(["agent-browser", "close"])
    
    all_issues = province_issues + city_issues
    
    # Windows 路径转正斜杠（微信 MEDIA: 标签只支持正斜杠）
    def to_media_path(p):
        return p.replace("\\", "/") if p else p

    print(f"\n✅ 完成！")
    print(f"📁 输出目录: {OUTPUT_DIR}")
    if province_path:
        print(f"📸 全省排名: {province_path}")
    if city_path:
        print(f"📸 各区排名: {city_path}")
    
    if all_issues:
        print(f"\n⚠️ 异常数据:")
        for ab in all_issues:
            print(f"  - {ab}")
    
    if province_path:
        print(f"\nMEDIA:{to_media_path(province_path)}")
    if city_path:
        print(f"\nMEDIA:{to_media_path(city_path)}")
    
    return province_path, city_path, all_issues

if __name__ == "__main__":
    print("=" * 50)
    print("Mapairs 浓度排名截图工具 (agent-browser 版)")
    print(f"时间: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 50)
    main()
