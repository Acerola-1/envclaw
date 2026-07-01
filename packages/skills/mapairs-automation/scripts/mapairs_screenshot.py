#!/usr/bin/env python3
"""
Mapairs 截图工具
支持：一张图、小时播报、浓度排名、监测数据

核心设计：
- --session-name mapairs 持久化登录
- 检测 /lock 并自动重新登录
- 从 /overallSituation 用 location.href SPA 导航
- 截图前 set viewport 1920 1080
- eval JS 用 var + for(i=0;i<n;i++) 兼容写法

用法:
  python3 mapairs_screenshot.py --module all
  python3 mapairs_screenshot.py --module onemap
"""
import subprocess, os, time, json, sys, datetime, argparse

SESSION_NAME = "mapairs"
BASE_URL = "https://www.mapairs.com"

ACCOUNTS = {
    "pingdingshan": {
        "username": "X-mojl", "password": "yutu@889",
        "city_name": "平顶山市", "province_name": "河南省", "province_search": "河南"
    },
}

MODULES = {
    "hourly": {"name": "小时播报",
        "url": f"{BASE_URL}/dataStatistics/CityHourBroadcast", "wait": 20},
    "rank": {"name": "浓度排名",
        "url": f"{BASE_URL}/dataStatistics/concentrationranking", "wait": 20},
    "monitor": {"name": "监测数据",
        "url": f"{BASE_URL}/dataStatistics/cityMonitoringData", "wait": 20},
    "onemap": {"name": "一张图",
        "url": f"{BASE_URL}/onemap/default", "wait": 15},
}

OUTPUT_DIR = os.path.join(os.path.expanduser("~"), "Desktop", "mapairs_screenshots")

def agent(cmd, timeout=30):
    full = ["agent-browser", "--session-name", SESSION_NAME] + cmd
    try:
        r = subprocess.run(full, capture_output=True, text=True, timeout=timeout)
        return r.stdout.strip(), r.stderr.strip(), r.returncode
    except:
        return "", "error", -1

def agent_ns(cmd, timeout=30):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return r.stdout.strip(), r.stderr.strip(), r.returncode
    except:
        return "", "error", -1

def safe_eval(js, timeout=15):
    out, _, code = agent(["eval", js], timeout)
    if code != 0: return None
    try: return json.loads(out) if out else None
    except: return out

def set_vp():
    agent(["set", "viewport", "1920", "1080"], timeout=5)

def ss(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    out, _, code = agent(["screenshot", path], timeout=20)
    if code == 0 and os.path.exists(path):
        sz = os.path.getsize(path)
        print(f"  {os.path.basename(path)} ({sz/1024:.0f} KB)")
        if sz < 200: print("  !! 截图偏小")
        return True
    print("  !! 截图失败")
    return False

def nav(url, wait=15):
    print(f"  SPA -> {url.split('/')[-1]}")
    safe_eval(f"location.href='{url}'")
    time.sleep(wait)

def cur_url():
    return safe_eval("window.location.href") or ""

def login(account_key):
    account = ACCOUNTS[account_key]
    print(f"\n登录 ({account['username']})...")
    is_lock = '/lock' in cur_url()
    if is_lock:
        print("  检测到 /lock，token 过期")
    # 点击 loginBg
    safe_eval("document.querySelector('.loginBg')?.click()")
    time.sleep(2)
    # 填值
    uname = account['username']; pwd = account['password']
    js = ("var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;"
          " var ins=document.querySelectorAll('input');"
          " for(var i=0;i<ins.length;i++){"
          " if(ins[i].placeholder?.includes('账号')||ins[i].placeholder?.includes('手机号')){"
          " ins[i].removeAttribute('readonly');ins[i].focus();"
          f"s.call(ins[i],'{uname}');"
          " ins[i].dispatchEvent(new Event('input',{bubbles:true}));"
          " ins[i].dispatchEvent(new Event('change',{bubbles:true}));"
          " }"
          " if(ins[i].placeholder?.includes('密码')){"
          " ins[i].removeAttribute('readonly');ins[i].focus();"
          f"s.call(ins[i],'{pwd}');"
          " ins[i].dispatchEvent(new Event('input',{bubbles:true}));"
          " ins[i].dispatchEvent(new Event('change',{bubbles:true}));"
          " }"
          "}")
    safe_eval(js)
    time.sleep(1)
    safe_eval("var b=document.querySelectorAll('button'); for(var i=0;i<b.length;i++){if(b[i].textContent?.trim()==='登录'){b[i].click();break}}")
    time.sleep(5)
    url = cur_url()
    if '/lock' not in url:
        print(f"  登录成功 (当前: {url.split('/')[-1][:30]})")
        return True
    print("  登录失败 (仍为 /lock)")
    return False

# ====== 模块截图 ======

def shot_hourly():
    print(f"\n小时播报")
    nav(MODULES["hourly"]["url"], MODULES["hourly"]["wait"])
    set_vp(); time.sleep(2)
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    ss(os.path.join(OUTPUT_DIR, f"hourly_{ts}.png"))

def shot_rank():
    print(f"\n浓度排名")
    print("  == 全省排名 ==")
    nav(MODULES["rank"]["url"], MODULES["rank"]["wait"])
    set_vp(); time.sleep(2)
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    ss(os.path.join(OUTPUT_DIR, f"rank_province_{ts}.png"))
    print("  == 各区县排名 ==")
    nav(MODULES["rank"]["url"], MODULES["rank"]["wait"])
    set_vp(); time.sleep(2)
    safe_eval("var r=document.querySelectorAll('.el-radio,.el-radio-button'); for(var i=0;i<r.length;i++){if(r[i].textContent?.trim()==='站点')r[i].click()}")
    time.sleep(1)
    safe_eval("var r=document.querySelectorAll('.el-radio,.el-radio-button'); for(var i=0;i<r.length;i++){if(r[i].textContent?.trim()==='日累计')r[i].click()}")
    time.sleep(1)
    safe_eval("document.querySelector('.el-cascader')?.querySelector('input')?.click()")
    time.sleep(2)
    safe_eval("for(var i=0;i<10;i++){var t=document.querySelectorAll('.el-tag__close');if(t.length===0)break;t[0].click()}; var c=document.querySelectorAll('.el-cascader-node.is-checked'); for(var i=0;i<c.length;i++){var b=c[i].querySelector('.el-checkbox__inner');if(b)b.click()}")
    time.sleep(1)
    safe_eval("document.querySelector('.el-cascader')?.querySelector('input')?.click()")
    time.sleep(1)
    safe_eval("var m=document.querySelectorAll('.el-cascader-menu')[0]; if(m){var ns=m.querySelectorAll('.el-cascader-node'); for(var i=0;i<ns.length;i++){if(ns[i].textContent?.includes('河南')){ns[i].querySelector('.el-cascader-node__label')?.click();break}}}")
    time.sleep(2)
    safe_eval("var m=document.querySelectorAll('.el-cascader-menu')[1]; if(m){var ns=m.querySelectorAll('.el-cascader-node'); for(var i=0;i<ns.length;i++){if(ns[i].textContent?.includes('平顶山')){ns[i].querySelector('.el-cascader-node__label')?.click();break}}}")
    time.sleep(2)
    safe_eval("var menus=document.querySelectorAll('.el-cascader-menu'); if(menus.length>=3){var ns=menus[2].querySelectorAll('.el-cascader-node'); for(var i=0;i<ns.length;i++){if(ns[i].textContent?.trim()==='全部')continue; var b=ns[i].querySelector('.el-checkbox__inner'); if(b)b.click()}}")
    time.sleep(1)
    safe_eval("document.dispatchEvent(new KeyboardEvent('keydown',{'key':'Escape'}))")
    time.sleep(1)
    safe_eval("var b=document.querySelectorAll('button'); for(var i=0;i<b.length;i++){if(b[i].textContent?.trim()==='查询'){b[i].click();break}}")
    time.sleep(5)
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    ss(os.path.join(OUTPUT_DIR, f"rank_city_{ts}.png"))

def shot_monitor():
    print(f"\n监测数据")
    nav(MODULES["monitor"]["url"], MODULES["monitor"]["wait"])
    set_vp(); time.sleep(2)
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    ss(os.path.join(OUTPUT_DIR, f"monitor_{ts}.png"))

def zoom_in(times=1):
    """放大指定次数"""
    js = "var a=document.querySelector('a.map-control-zoom-in,button.map-control-zoom-in,button.mapboxgl-ctrl-zoom-in'); if(a){var evt=new MouseEvent('click',{bubbles:true,cancelable:true});a.dispatchEvent(evt)}"
    for _ in range(times):
        safe_eval(js)
        time.sleep(1.5)

def shot_onemap():
    print(f"\n一张图")
    nav(MODULES["onemap"]["url"], MODULES["onemap"]["wait"])
    set_vp(); time.sleep(2)
    # 1. 定位平顶山市
    safe_eval("var el=document.querySelectorAll('*'); for(var i=0;i<el.length;i++){if(el[i].textContent?.trim()==='平顶山市'&&el[i].children.length===0){el[i].click();break}}")
    time.sleep(5)
    # 2. 切换到监测图模式
    safe_eval("var els=document.querySelectorAll('*'); for(var i=0;i<els.length;i++){if(els[i].textContent?.trim()==='插值图'&&els[i].children.length===0){var evt=new MouseEvent('click',{bubbles:true,cancelable:true});els[i].dispatchEvent(evt);break}}")
    time.sleep(3)
    # 3. 关闭侧栏，截全景图
    safe_eval("var btn=document.querySelector('button.el-button--primary'); if(btn)btn.click()")
    time.sleep(2)
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    ss(os.path.join(OUTPUT_DIR, f"onemap_full_{ts}.png"))
    # 4. 放大到市级（2次）
    zoom_in(2)
    time.sleep(2)
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    ss(os.path.join(OUTPUT_DIR, f"onemap_city_{ts}.png"))
    # 5. 再放大到区县级（再4次，共6次）
    zoom_in(4)
    time.sleep(2)
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    ss(os.path.join(OUTPUT_DIR, f"onemap_district_{ts}.png"))

def main():
    parser = argparse.ArgumentParser(description="Mapairs 截图工具")
    parser.add_argument("--module", choices=["hourly","rank","monitor","onemap","all"], default="all")
    args = parser.parse_args()
    r = agent_ns(["agent-browser","--version"], 10)
    if r[2] != 0:
        print("!! agent-browser 未安装"); sys.exit(1)
    print(f"agent-browser ok")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"module: {args.module}")
    agent(["open", BASE_URL+"/"], timeout=30)
    time.sleep(5)
    set_vp(); time.sleep(1)
    if not login("pingdingshan"):
        agent(["close","--all"]); sys.exit(1)
    url = cur_url()
    if '/overallSituation' not in url:
        nav(BASE_URL+"/overallSituation", 8)
    if args.module in ("hourly","all"): shot_hourly()
    if args.module in ("rank","all"): shot_rank()
    if args.module in ("monitor","all"): shot_monitor()
    if args.module in ("onemap","all"): shot_onemap()
    agent(["close","--all"])
    print(f"\nDone!")

if __name__ == "__main__":
    print("Mapairs Screenshot Tool")
    print(datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    main()
