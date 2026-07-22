#!/usr/bin/env python3
"""数智大气浓度排名截图。

仅使用 Playwright；任务参数由 JSON 传入，登录凭证只从环境变量读取。
每次截图前会先验证运行环境，避免在网页操作到一半才发现依赖缺失。
"""
from __future__ import annotations

import argparse
import json
import os
import socket
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from playwright.sync_api import Page

LOGIN_URL = "https://mapairs.com/lock"
RANKING_URL = "https://www.mapairs.com/dataStatistics/concentrationranking"
PERIODS = {"hourly": "实时", "daily_count": "日累计", "daily": "日", "month": "月", "year": "年", "other": "自定义"}
THEMES = {"light", "dark"}
TARGETS = {"city": "城市", "station": "站点"}
SCOPES = {"tableOnly", "withFilters"}
FACTORS = ("PM₂.₅", "PM₁₀", "SO₂", "NO₂", "CO", "O₃", "AQI")
REGIONS = {
    "all": "全部",
    "pingdingshan": "平顶山市",
    "xinhua": "新华区",
    "weidong": "卫东区",
    "zhanhe": "湛河区",
    "zhengzhou": "郑州市",
    "luoyang": "洛阳市",
}
REGION_PATHS = {
    "all": ["河南省", "全部"],
    "pingdingshan": ["河南省", "平顶山市"],
    "xinhua": ["河南省", "平顶山市", "新华区"],
    "weidong": ["河南省", "平顶山市", "卫东区"],
    "zhanhe": ["河南省", "平顶山市", "湛河区"],
    "zhengzhou": ["河南省", "郑州市"],
    "luoyang": ["河南省", "洛阳市"],
}
MINIMUM_PYTHON = (3, 10)


def fail(message: str) -> None:
    raise RuntimeError(message)


def preflight(*, require_credentials: bool = True, check_network: bool = True) -> None:
    """在进入业务页面前给出可操作的运行环境诊断。"""
    problems: list[str] = []
    if sys.version_info < MINIMUM_PYTHON:
        problems.append(
            f"Python 版本过低：当前 {sys.version.split()[0]}，需要 Python {MINIMUM_PYTHON[0]}.{MINIMUM_PYTHON[1]} 或更高版本"
        )

    try:
        from playwright.sync_api import sync_playwright
    except ModuleNotFoundError:
        problems.append("未安装 Python Playwright：请在 Hermes 运行环境安装 playwright，并执行 playwright install chromium")
        sync_playwright = None

    if sync_playwright:
        try:
            with sync_playwright() as playwright:
                executable = Path(playwright.chromium.executable_path)
                if not executable.is_file():
                    problems.append(f"未安装 Playwright Chromium 浏览器：未找到 {executable}；请执行 playwright install chromium")
                else:
                    browser = playwright.chromium.launch(headless=True)
                    browser.close()
        except Exception as exc:
            problems.append(f"Playwright Chromium 无法启动：{exc}；请重新执行 playwright install chromium")

    if require_credentials and (not os.getenv("MAPAIRS_USERNAME") or not os.getenv("MAPAIRS_PASSWORD")):
        problems.append("缺少数智大气凭证：Envclaw 尚未向本次任务运行环境注入 MAPAIRS_USERNAME 和 MAPAIRS_PASSWORD")

    if check_network:
        try:
            socket.getaddrinfo("mapairs.com", 443, type=socket.SOCK_STREAM)
        except Exception as exc:
            problems.append(f"无法解析数智大气域名 mapairs.com：{exc}")

    if problems:
        fail("运行环境预检失败：\n- " + "\n- ".join(problems))

    print("PREFLIGHT:OK")


def read_config(raw: str) -> dict[str, Any]:
    try:
        config = json.loads(raw)
    except json.JSONDecodeError as exc:
        fail(f"任务参数不是有效 JSON: {exc.msg}")
    if not isinstance(config, dict):
        fail("任务参数必须是 JSON 对象")
    config.setdefault("queryTarget", "city")
    config.setdefault("region", "pingdingshan")
    config.setdefault("period", "daily_count")
    config.setdefault("factors", ["AQI", "PM₂.₅", "O₃"])
    config.setdefault("theme", "light")
    config.setdefault("screenshotScope", "tableOnly")
    if config["queryTarget"] not in TARGETS: fail("queryTarget 仅支持 city 或 station")
    if config["region"] not in REGIONS: fail("region 不受支持")
    if config["period"] not in PERIODS: fail("period 不受支持")
    if config["theme"] not in THEMES: fail("theme 仅支持 light 或 dark")
    if config["screenshotScope"] not in SCOPES: fail("screenshotScope 不受支持")
    if not isinstance(config["factors"], list) or not config["factors"]: fail("factors 至少选择一个污染因子")
    if any(factor not in FACTORS for factor in config["factors"]):
        fail(f"factors 仅支持：{'、'.join(FACTORS)}")
    return config


def click_text(page: "Page", text: str, *, timeout: int = 10_000) -> None:
    item = page.get_by_text(text, exact=True).first
    item.wait_for(state="visible", timeout=timeout)
    item.click()


def login(page: "Page") -> None:
    username, password = os.getenv("MAPAIRS_USERNAME"), os.getenv("MAPAIRS_PASSWORD")
    if not username or not password:
        fail("缺少数智大气凭证：请设置 MAPAIRS_USERNAME 和 MAPAIRS_PASSWORD")
    page.goto(LOGIN_URL, wait_until="domcontentloaded")
    page.locator(".loginBg").wait_for(state="visible", timeout=30_000)
    page.locator(".loginBg").click()
    page.get_by_role("textbox", name="请输入账号/手机号").fill(username)
    page.get_by_role("textbox", name="请输入密码").fill(password)
    page.get_by_role("button", name="登录", exact=True).click()
    page.wait_for_timeout(3_000)
    # 共享值守账号可能命中设备上限；按参考脚本循环清退，不在日志中输出凭证。
    for _ in range(30):
        if page.get_by_text("登录设备数量已达上限").count() == 0:
            break
        clicked = page.evaluate("""() => { const d=document.querySelector('.device-limit-dialog'); const b=[...(d?.querySelectorAll('button')||[])].find(x=>x.innerText.trim()==='退出'); if(b){b.click();return true} return false }""")
        if not clicked: fail("检测到设备数量上限，但找不到设备退出按钮")
        page.wait_for_timeout(2_000)
        for label in ("确定退出", "确认退出"):
            button = page.get_by_role("button", name=label)
            if button.count():
                button.first.click()
                page.wait_for_timeout(3_000)
                break
    if page.get_by_text("登录设备数量已达上限").count(): fail("设备数量清退后仍无法登录")
    page.wait_for_url("**/overallSituation", timeout=20_000)


def set_theme(page: "Page", theme: str) -> None:
    switch = page.locator(".theme .el-switch").first
    switch.wait_for(state="visible", timeout=15_000)
    is_light = bool(switch.evaluate("el => el.classList.contains('is-checked')"))
    if is_light != (theme == "light"):
        page.locator(".theme .el-switch__core").first.click()
        page.wait_for_timeout(1_500)


def set_region(page: "Page", region: str) -> None:
    """按省、市、区县路径操作真实级联树，并回读最终标签。"""
    path = REGION_PATHS[region]
    cascader = page.locator("#data-statistics .el-cascader").first
    cascader.locator(".el-input__wrapper").click(force=True)
    for index, label in enumerate(path):
        node = page.locator(".el-cascader-node:visible").filter(has_text=label).last
        node.wait_for(state="visible", timeout=10_000)
        if index < len(path) - 1:
            node.locator(".el-cascader-node__label").click()
            page.wait_for_timeout(150)
            continue
        if label != "全部":
            all_node = page.locator(".el-cascader-node:visible").filter(has_text="全部").last
            if all_node.count() and all_node.locator("input[type=checkbox]").is_checked():
                all_node.locator(".el-checkbox").click()
                page.wait_for_timeout(100)
        checked = node.locator("input[type=checkbox]").is_checked()
        if not checked:
            node.locator(".el-checkbox").click()
        page.wait_for_timeout(150)
        if not node.locator("input[type=checkbox]").is_checked():
            fail(f"页面未能选中行政区：{' / '.join(path)}")
    page.keyboard.press("Escape")


def set_factors(page: "Page", factors: list[Any]) -> None:
    # 因子控件不是原生 select，而是“全选 checkbox + li 列表项”。
    selector = "#data-statistics .el-select.select_input"
    trigger = page.locator(selector).first
    trigger.locator(".el-input__wrapper").click(force=True)
    popper = page.locator(".el-select__popper:visible").first
    popper.wait_for(state="visible", timeout=10_000)
    select_all = popper.locator("label.el-checkbox").first
    if select_all.locator("input[type=checkbox]").is_checked():
        select_all.click()
        page.wait_for_timeout(150)
    for factor in factors:
        item = popper.locator("li.el-select-dropdown__item", has_text=str(factor)).first
        item.wait_for(state="visible", timeout=10_000)
        if "selected" not in (item.get_attribute("class") or ""):
            item.click()
            page.wait_for_timeout(100)
    selected = popper.locator("li.el-select-dropdown__item.selected").all_inner_texts()
    missing = [factor for factor in factors if factor not in selected]
    unexpected = [factor for factor in selected if factor not in factors]
    if missing or unexpected:
        fail(f"页面未能正确设置污染因子：期望 {'、'.join(factors)}，实际 {'、'.join(selected) or '空'}")
    page.keyboard.press("Escape")


def set_controls(page: "Page", config: dict[str, Any]) -> None:
    # 登录后的直接 URL 跳转在该 Vue 应用中可能回落到默认页；按真实菜单进入。
    click_text(page, "数据分析")
    page.wait_for_timeout(1_500)
    page.locator("#data-statistics").get_by_text("浓度排名", exact=True).click()
    page.wait_for_url("**/concentrationranking", timeout=20_000)
    page.wait_for_selector(".data_list", timeout=20_000)
    target_value = "city" if config["queryTarget"] == "city" else "site"
    target_radio = page.locator(f'#data-statistics input[type="radio"][value="{target_value}"]')
    target_radio.check(force=True)
    if not target_radio.is_checked():
        fail(f"页面未能切换查询对象：{TARGETS[config['queryTarget']]}")
    set_region(page, config["region"])
    set_factors(page, config["factors"])
    # 该页面的 radio input 由 Vue 重建，原生 check() 不会触发组件状态。
    # 点击实际可见按钮，并以日期控件形态验证切换已完成。
    page.locator("#data-statistics").get_by_text(PERIODS[config["period"]], exact=True).click()
    expected_editor = "el-date-editor--datetime" if config["period"] in {"hourly", "daily_count"} else "el-date-editor--date"
    page.locator(f"#data-statistics .{expected_editor}").first.wait_for(state="visible", timeout=10_000)
    page.get_by_role("button", name="查询", exact=True).click()
    page.wait_for_selector(".el-table__body tbody tr", timeout=20_000)
    page.wait_for_timeout(1_500)


def clip_for(page: "Page", scope: str) -> dict[str, float]:
    selector = ".data_list"
    if scope == "tableOnly":
        result = page.evaluate("""() => { const a=document.querySelector('.data_list .record'); const b=document.querySelector('.data_list .table-list'); if(!a||!b)return null; const x=Math.min(a.getBoundingClientRect().x,b.getBoundingClientRect().x); const y=Math.min(a.getBoundingClientRect().y,b.getBoundingClientRect().y); const r=Math.max(a.getBoundingClientRect().right,b.getBoundingClientRect().right); return {x,y,width:r-x,height:b.getBoundingClientRect().bottom-y} }""")
    else:
        result = page.locator(selector).bounding_box()
    if not result or result["width"] <= 0 or result["height"] <= 0: fail("无法计算截图区域")
    return result


def capture(config: dict[str, Any], output_dir: Path) -> Path:
    preflight()
    from playwright.sync_api import sync_playwright

    output_dir.mkdir(parents=True, exist_ok=True)
    name = f"浓度排名_{config['region']}_{config['period']}_{datetime.now():%Y%m%d_%H%M%S}.png"
    path = output_dir / name
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=2)
        page = context.new_page()
        try:
            login(page)
            set_theme(page, config["theme"])
            set_controls(page, config)
            page.screenshot(path=str(path), clip=clip_for(page, config["screenshotScope"]))
        finally:
            context.close()
            browser.close()
    print(f"ARTIFACT:{path}")
    print(f"MEDIA:{path.as_posix()}")
    return path


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--config-json")
    source.add_argument("--config-file")
    parser.add_argument("--output-dir", default=str(Path.home() / "Desktop" / "平顶山浓度排名截图测试"))
    parser.add_argument("--preflight", action="store_true", help="仅检查 Python、Playwright、浏览器、网络和凭证注入")
    args = parser.parse_args()
    if args.preflight:
        if args.config_json or args.config_file:
            parser.error("--preflight 不能与任务参数同时使用")
        preflight()
        raise SystemExit(0)
    if not args.config_json and not args.config_file:
        parser.error("必须提供 --config-json 或 --config-file")
    raw_config = Path(args.config_file).read_text(encoding="utf-8") if args.config_file else args.config_json
    capture(read_config(raw_config), Path(args.output_dir))
