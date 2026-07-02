#!/usr/bin/env python3
"""
平顶山值守任务 - 一键3截图
严格执行：浓度排名(日累计) + 一张图(河南区域) + 一张图(平顶山区县级)
"""
import subprocess, time, json, os, datetime, sys

SESSION = "pingdingshan"
BASE = "https://www.mapairs.com"
ACCOUNT = {"username": "X-mojl", "password": "yutu@889"}
OUT = os.path.expanduser("~/Desktop/mapairs")

# Chrome for Testing path (fallback if Chrome not in standard path)
CHROME_PATH = None
_cached_chrome = os.path.expanduser("~/.pingdingshan_chrome_path")

def find_chrome():
    global CHROME_PATH
    if os.path.exists(_cached_chrome):
        with open(_cached_chrome) as f:
            p = f.read().strip()
            if os.path.exists(p):
                CHROME_PATH = p
                return
    import glob
    dirs = sorted(glob.glob(os.path.expanduser("~/Library/Caches/ms-playwright/chromium-*")), reverse=True)
    for d in dirs:
        candidate = os.path.join(d, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing")
        if os.path.exists(candidate):
            CHROME_PATH = candidate
            with open(_cached_chrome, "w") as f:
                f.write(candidate)
            return

def agent(args, timeout=30):
    """Run an agent-browser command."""
    full = ["agent-browser", "--session-name", SESSION]
    if CHROME_PATH:
        full = ["agent-browser", "--executable-path", CHROME_PATH, "--session-name", SESSION]
    full += args
    try:
        r = subprocess.run(full, capture_output=True, text=True, timeout=timeout)
        return r.stdout.strip(), r.stderr.strip(), r.returncode
    except subprocess.TimeoutExpired:
        return "", "timeout", -1
    except FileNotFoundError:
        return "", "agent-browser not found", -1

def ev(js, timeout=15):
    """Evaluate JS and return parsed result."""
    out, _, code = agent(["eval", js], timeout)
    if code != 0:
        print(f"  eval error: {out or ''} {_ or ''}")
        return None
    try:
        return json.loads(out)
    except (json.JSONDecodeError, TypeError):
        return out

def ss(path):
    """Take screenshot."""
    agent(["screenshot", path], timeout=20)
    if os.path.exists(path):
        sz = os.path.getsize(path)
        print(f"  ✓ {os.path.basename(path)} ({sz/1024:.0f} KB)")
        if sz < 200:
            print(f"  ⚠ 截图偏小，可能数据未加载")
        return True
    print(f"  ✗ 截图失败 {path}")
    return False

def nav(url, wait=15):
    """SPA navigation via location.href."""
    ev(f"location.href='{url}'")
    time.sleep(wait)

def login():
    """Login to mapairs.com."""
    print("\n登录...")
    agent(["set", "viewport", "1920", "1080"])
    time.sleep(2)
    ev("document.querySelector('.loginBg')?.click()")
    time.sleep(2)
    js = (
        "var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;"
        "var ins=document.querySelectorAll('input');"
        "for(var i=0;i<ins.length;i++){"
        "if(ins[i].placeholder?.includes('账号')||ins[i].placeholder?.includes('手机号')){"
        "ins[i].removeAttribute('readonly');ins[i].focus();"
        f"s.call(ins[i],'{ACCOUNT['username']}');"
        "ins[i].dispatchEvent(new Event('input',{bubbles:true}));"
        "ins[i].dispatchEvent(new Event('change',{bubbles:true}));"
        "}"
        "if(ins[i].placeholder?.includes('密码')){"
        "ins[i].removeAttribute('readonly');ins[i].focus();"
        f"s.call(ins[i],'{ACCOUNT['password']}');"
        "ins[i].dispatchEvent(new Event('input',{bubbles:true}));"
        "ins[i].dispatchEvent(new Event('change',{bubbles:true}));"
        "}"
        "} 'ok'"
    )
    ev(js)
    time.sleep(2)
    ev("var b=document.querySelectorAll('button');for(var i=0;i<b.length;i++){if(b[i].textContent?.trim()==='登录'){var e=new MouseEvent('click',{bubbles:true,cancelable:true});b[i].dispatchEvent(e);break}} 'ok'")
    time.sleep(6)
    url = ev("window.location.href") or ""
    if "/lock" not in url:
        print(f"  ✓ 登录成功")
        return True
    print("  ✗ 登录失败（仍在 /lock）")
    return False

def click_by_text(target_text, tag_filter="*", check_childless=True):
    """Click an element by its exact text content using MouseEvent dispatch."""
    child_cond = "&&el.children.length===0" if check_childless else ""
    if tag_filter != "*":
        tag_cond = f"&&el.tagName==='{tag_filter}'"
    else:
        tag_cond = ""
    js = (
        f"var els=document.querySelectorAll('*');"
        f"for(var i=0;i<els.length;i++){{"
        f"if(els[i].textContent?.trim()==='{target_text}'{tag_cond}{child_cond}){{"
        f"var e=new MouseEvent('click',{{bubbles:true,cancelable:true}});"
        f"els[i].dispatchEvent(e);break"
        f"}}}} 'ok'"
    )
    return ev(js)


def step1_ranking():
    """Step 1: 浓度排名 - 全省18地市日累计截图"""
    print("\n[1/3] 浓度排名（全省18地市日累计）")
    nav(f"{BASE}/overallSituation", 8)
    nav(f"{BASE}/dataStatistics/concentrationranking", 15)
    agent(["set", "viewport", "1920", "1080"])
    time.sleep(2)

    # Switch to 日累计 mode
    print("  切换到日累计...")
    ev("var els=document.querySelectorAll('*');for(var i=0;i<els.length;i++){if(els[i].textContent?.trim()==='日累计'&&els[i].tagName==='SPAN'){var label=els[i].closest('label');if(label){var e=new MouseEvent('click',{bubbles:true,cancelable:true});label.dispatchEvent(e)};break}} 'ok'")
    time.sleep(3)

    # Click 查询
    print("  点击查询...")
    ev("var els=document.querySelectorAll('*');for(var i=0;i<els.length;i++){if(els[i].textContent?.trim()==='查询'&&els[i].tagName==='BUTTON'){var e=new MouseEvent('click',{bubbles:true,cancelable:true});els[i].dispatchEvent(e);break}} 'ok'")
    time.sleep(10)

    # Screenshot
    agent(["set", "viewport", "1920", "1080"])
    time.sleep(2)
    ss(os.path.join(OUT, f"rank_18cities_{ts}.png"))

    # Extract data for primary pollutant
    data = ev("var rows=document.querySelectorAll('.el-table__body tr');var out='';for(var i=0;i<rows.length;i++){var cells=rows[i].querySelectorAll('td');for(var j=0;j<cells.length;j++){out+=cells[j].textContent?.trim();if(j<cells.length-1)out+=','};out+='\\n'};out")
    primary = "-"
    if data:
        for line in data.split("\n"):
            if "平顶山" in line:
                cols = line.split(",")
                primary = cols[-1] if cols else "-"
                print(f"  平顶山首要污染物: {primary}")
                break
    return primary


def step2_onemap_henan(primary="-"):
    """Step 2: 一张图 - 河南区域截图"""
    print("\n[2/3] 一张图-河南区域")
    nav(f"{BASE}/onemap/default", 12)

    # Switch to 监测图 mode
    print("  切换监测图模式...")
    ev("var els=document.querySelectorAll('*');for(var i=0;i<els.length;i++){if(els[i].textContent?.trim()==='插值图'&&els[i].children.length===0){var e=new MouseEvent('click',{bubbles:true,cancelable:true});els[i].dispatchEvent(e);break}} 'ok'")
    time.sleep(3)

    # Close left panel
    print("  关闭左侧面板...")
    ev("var btn=document.querySelector('button.el-button--primary');if(btn){var e=new MouseEvent('click',{bubbles:true,cancelable:true});btn.dispatchEvent(e)} 'ok'")
    time.sleep(3)

    # Switch map factor if needed
    if primary and primary != "-":
        print(f"  切换地图因子到: {primary}")
        ev(f"var items=document.querySelectorAll('*');for(var i=0;i<items.length;i++){{if(items[i].textContent?.trim()==='{primary}'&&items[i].children.length<2){{var e=new MouseEvent('click',{{bubbles:true,cancelable:true}});items[i].dispatchEvent(e);break}}}} 'ok'")
        time.sleep(3)

    # Screenshot
    agent(["set", "viewport", "1920", "1080"])
    time.sleep(2)
    ss(os.path.join(OUT, f"onemap_henan_{ts}.png"))


def step3_onemap_pingdingshan():
    """Step 3: 一张图 - 放大到平顶山区县级截图"""
    print("\n[3/3] 一张图-平顶山区县级")

    # Zoom in 2 times only!
    print("  放大2次（区县级）...")
    for i in range(2):
        ev("var a=document.querySelector('a.map-control-zoom-in,button.map-control-zoom-in,button.mapboxgl-ctrl-zoom-in');if(a){var e=new MouseEvent('click',{bubbles:true,cancelable:true});a.dispatchEvent(e)} 'ok'")
        time.sleep(2)

    agent(["set", "viewport", "1920", "1080"])
    time.sleep(2)
    ss(os.path.join(OUT, f"onemap_pingdingshan_{ts}.png"))


if __name__ == "__main__":
    print("=" * 50)
    print("  平顶山值守任务 - 3张截图")
    print("=" * 50)

    # Setup
    find_chrome()
    os.makedirs(OUT, exist_ok=True)
    ts = datetime.datetime.now().strftime("%Y%m%d")

    # Verify agent-browser
    out, _, rc = agent(["--version"])
    if rc != 0:
        print("✗ agent-browser 不可用")
        sys.exit(1)
    print(f"✓ agent-browser {out}")
    if CHROME_PATH:
        print(f"✓ Chrome: {CHROME_PATH}")

    # Open browser
    agent(["open", BASE])
    time.sleep(5)
    url = ev("window.location.href") or ""

    # Login if needed
    if "/lock" in url:
        if not login():
            print("✗ 登录失败，退出")
            sys.exit(1)
    else:
        print("✓ 已登录")

    # Execute 3 steps
    try:
        primary = step1_ranking()
        step2_onemap_henan(primary)
        step3_onemap_pingdingshan()
        print(f"\n✅ 完成！3张截图已保存至 {OUT}")
    except KeyboardInterrupt:
        print("\n⚠ 用户中断")
    except Exception as e:
        print(f"\n✗ 错误: {e}")
        import traceback
        traceback.print_exc()
