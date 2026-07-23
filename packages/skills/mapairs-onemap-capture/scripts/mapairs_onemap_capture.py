#!/usr/bin/env python3
"""数智大气"一张图"截图（URL 直连模式）。

仅使用 Playwright；任务参数由 JSON 传入，登录凭证只从环境变量读取。
截图流程：登录 → 拼接 URL 直连 → 等地图渲染 → 整页截图。
公共逻辑（预检、登录、截图、配置）复用 mapairs_common。
"""
from __future__ import annotations

import argparse
import json
import os as _os
import sys
from pathlib import Path
from typing import Any

# --- 定位并加载公共模块 mapairs_common ---
_COMMON_PATH = Path(__file__).resolve().parent.parent.parent / "mapairs-common"
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

ONEMAP_PATH = "/oneMap"
THEMES = {"light": "Light", "dark": "Dark"}
MODES = {"monitoring", "interpolation"}
TIME_TYPES = {"hourly", "dt", "daily"}


def fail(message: str) -> None:
    raise RuntimeError(message)


def _bool_str(value: Any, default: bool) -> str:
    if value is None:
        value = default
    return "true" if bool(value) else "false"


def read_config(raw: str) -> dict[str, Any]:
    try:
        config = json.loads(raw)
    except json.JSONDecodeError as exc:
        fail(f"任务参数不是有效 JSON: {exc.msg}")
    if not isinstance(config, dict):
        fail("任务参数必须是 JSON 对象")
    config.setdefault("theme", "light")
    config.setdefault("mode", "monitoring")
    config.setdefault("factor", "PM2.5")
    config.setdefault("timeType", "hourly")
    if config["theme"] not in THEMES:
        fail("theme 仅支持 light 或 dark")
    if config["mode"] not in MODES:
        fail("mode 仅支持 monitoring 或 interpolation")
    if config["timeType"] not in TIME_TYPES:
        fail("timeType 仅支持 hourly、dt 或 daily")
    if not config.get("region"):
        fail("region（地图范围 regionKeyVO）为必填")
    return config


def build_onemap_url(config: dict[str, Any]) -> str:
    """按一张图页面 URL 约定拼接查询参数。"""
    params: dict[str, Any] = {
        "theme": THEMES[config["theme"]],
        "factor": config["factor"],
        "leftPanel": _bool_str(config.get("leftPanel"), False),
        "region": config["region"],
        "windWaves": _bool_str(config.get("windWaves"), True),
        "mode": config["mode"],
        "timeType": config["timeType"],
    }
    return build_url(ONEMAP_PATH, params)


def capture(config: dict[str, Any], output_dir: Path) -> Path:
    preflight_check()
    from playwright.sync_api import sync_playwright

    target_url = build_onemap_url(config)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=2)
        page = context.new_page()
        try:
            login(page)
            page.goto(target_url, wait_until="domcontentloaded")
            # 地图为异步瓦片渲染：等网络空闲后再固定等待，确保底图与图层绘制完成。
            try:
                page.wait_for_load_state("networkidle", timeout=30_000)
            except Exception:
                pass
            page.wait_for_timeout(10_000)
            path = save_screenshot(
                page,
                output_dir,
                capability="一张图",
                region_key=str(config.get("region", "")),
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
