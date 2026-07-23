#!/usr/bin/env python3
"""数智大气监测数据截图（URL 直连模式）。

仅使用 Playwright；任务参数由 JSON 传入，登录凭证只从环境变量读取。
与旧版逐级点击菜单不同：本脚本用用户配置参数拼接完整 URL 后直接跳转，
截图更稳定可靠。公共逻辑（预检、登录、截图、配置）复用 mapairs_common。
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, TYPE_CHECKING

# --- 定位并加载公共模块 mapairs_common ---
# 安装后目录结构：<skills>/mapairs-monitoring-data-capture/scripts/本脚本
#                <skills>/mapairs-common/mapairs_common
_COMMON_PATH = Path(__file__).resolve().parent.parent.parent / "mapairs-common"
import os as _os
_ENV_COMMON = _os.environ.get("MAPAIRS_COMMON_PATH", "").strip()
if _ENV_COMMON:
    _COMMON_PATH = Path(_ENV_COMMON)
if str(_COMMON_PATH) not in sys.path:
    sys.path.insert(0, str(_COMMON_PATH))

from mapairs_common import (  # noqa: E402
    preflight_check,
    login,
    save_screenshot,
    report_artifact,
    build_url,
)

if TYPE_CHECKING:
    from playwright.sync_api import Page

MONITORING_PATH = "/dataStatistics/cityMonitoringData"
THEMES = {"light": "Light", "dark": "Dark"}


# 因子编码归一：URL 使用半角编码；容错处理 Unicode 下标写法。
FACTOR_NORMALIZE = {
    "PM₂.₅": "PM2.5", "PM₁₀": "PM10", "SO₂": "SO2",
    "NO₂": "NO2", "O₃": "O3",
}


def fail(message: str) -> None:
    raise RuntimeError(message)


def normalize_factors(raw: Any) -> str:
    """把因子配置归一为逗号分隔的 URL 编码（如 'PM2.5,PM10,AQI'）。"""
    if isinstance(raw, list):
        items = [str(x) for x in raw]
    else:
        items = [x.strip() for x in str(raw or "").split(",") if x.strip()]
    return ",".join(FACTOR_NORMALIZE.get(x, x) for x in items)


def read_config(raw: str) -> dict[str, Any]:
    try:
        config = json.loads(raw)
    except json.JSONDecodeError as exc:
        fail(f"任务参数不是有效 JSON: {exc.msg}")
    if not isinstance(config, dict):
        fail("任务参数必须是 JSON 对象")
    config.setdefault("zone", "city")
    config.setdefault("township", "")
    config.setdefault("type", "daily_count")
    config.setdefault("customRange", "")
    config.setdefault("theme", "light")
    config.setdefault("includeTable", True)
    config.setdefault("includeScreenshot", True)
    config.setdefault("includeAnalysis", False)
    if config["zone"] not in ("city", "site"):
        fail("zone 仅支持 city 或 site")
    if config["theme"] not in THEMES:
        fail("theme 仅支持 light 或 dark")
    if config["type"] not in ("hour_avg", "hour", "daily", "daily_count", "other"):
        fail("type 仅支持 hour_avg/hour/daily/daily_count/other")
    if not config.get("region"):
        fail("region（行政区 regionKeyVO）为必填")
    index = normalize_factors(config.get("factors"))
    if not index:
        fail("factors 至少选择一个污染因子")
    config["_index"] = index
    return config


def build_monitoring_url(config: dict[str, Any]) -> str:
    """按监测数据页面 URL 约定拼接查询参数。"""
    params: dict[str, Any] = {
        "theme": THEMES[config["theme"]],
        "zone": config["zone"],
        "province": config.get("province", ""),
        "region": config.get("region", ""),
        "type": config["type"],
        "query": config.get("query", ""),
        "index": config["_index"],
        "gbKey": config.get("gbKey", "0"),
    }
    # 站点查询附加 stationType / station（城市查询忽略）
    if config["zone"] == "site":
        params["stationType"] = config.get("stationType", "")
        params["station"] = config.get("station", "")
    return build_url(MONITORING_PATH, params)


def clip_for(page: "Page", scope: str) -> dict | None:
    """按截图范围计算裁剪区域；无法计算时返回 None（整页）。"""
    selector = ".dataStatistics-main, .monitoring-data-container"
    box = page.locator(selector).first().bounding_box()
    return box


def capture(config: dict[str, Any], output_dir: Path) -> Path:
    preflight_check()
    from playwright.sync_api import sync_playwright

    target_url = build_monitoring_url(config)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=2)
        page = context.new_page()
        try:
            login(page)
            # URL 直连：主题、行政区、因子、时间类型均通过查询参数携带。
            page.goto(target_url, wait_until="domcontentloaded")
            page.wait_for_selector(".el-table__body tbody tr", timeout=30_000)
            page.wait_for_timeout(1_500)
            path = save_screenshot(
                page,
                output_dir,
                capability="监测数据",
                region_key=str(config.get("region", "")),
                clip=clip_for(page, config.get("screenshotScope", "fullPage")),
            )
        finally:
            context.close()
            browser.close()
    report_artifact(path)
    return path


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--config-json")
    source.add_argument("--config-file")
    parser.add_argument("--output-dir", default="./artifacts")
    parser.add_argument("--preflight", action="store_true", help="仅检查运行环境（Python/Playwright/浏览器/网络/凭证）")
    args = parser.parse_args()

    if args.preflight:
        if args.config_json or args.config_file:
            parser.error("--preflight 不能与任务参数同时使用")
        preflight_check()
        raise SystemExit(0)

    if not args.config_json and not args.config_file:
        parser.error("必须提供 --config-json 或 --config-file")
    raw_config = Path(args.config_file).read_text(encoding="utf-8") if args.config_file else args.config_json
    capture(read_config(raw_config), Path(args.output_dir))
