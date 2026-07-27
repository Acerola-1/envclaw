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
    save_screenshot,
    report_artifact,
    build_url,
    install_map_render_hook,
    wait_for_map_render,
    gpu_launch_args,
    new_context_with_session,
    ensure_authenticated,
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
    if config["factor"] == "primaryPollutant":
        fail("factor 不接受 primaryPollutant：请先通过 MCP 工具 mcp_city_common_get_air_quality_realtime_stat 解析出当前首要污染物（maxPollutionEn），再以具体因子（如 O3、PM2.5）传入")
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
    # MAPAIRS_HEADFUL=1 时用有头浏览器（屏幕弹出真实窗口，便于肉眼观察登录/渲染/截图），
    # 并在截图后停留片刻；未设置时保持无头，正式运行行为不变。
    headful = _os.environ.get("MAPAIRS_HEADFUL", "").strip() in ("1", "true", "True")
    with sync_playwright() as playwright:
        # 无头默认用 SwiftShader 软件渲染 WebGL，对重度 Mapbox GL 页面又慢又易崩；
        # 通过 ANGLE 强制走各平台硬件 GPU 后端(mac=Metal/win=D3D11/linux=gl)，
        # 让无头获得与有头一致的渲染，杜绝 Target crashed 与截出无数字的中间帧。
        browser = playwright.chromium.launch(headless=not headful, args=gpu_launch_args())
        # 带上已保存会话（若有）打开上下文，实现跨技能会话复用。
        context, had_session = new_context_with_session(
            browser, viewport={"width": 1920, "height": 1080}, device_scale_factor=2
        )
        page = context.new_page()
        # 必须在任何 goto 之前注入（含会话探测的 goto）：捕获 Mapbox 实例与 idle/data 时间。
        install_map_render_hook(page)
        try:
            # 会话仍有效则直接停在目标页；否则全新登录后再访问目标页（内部处理）。
            # 绝不额外访问 /overallSituation 等重页，避免连开两个重 WebGL 页导致崩溃。
            ensure_authenticated(context, page, had_session, target_url)
            # 一张图数据（城市点/站点/插值瓦片）均为 Mapbox GL 图层，networkidle 无法
            # 反映 GL 合成完成。改为：等地图 base 就绪（底图/瓦片/区域动画稳定）后，
            # 再硬等一段固定时长（默认 10s，可由 MAPAIRS_RENDER_HARD_WAIT_MS 调），兜住
            # 城市 AQI 数字等数据图层的异步回填与字形上屏，避免截出“没有数字”的图。
            wait_for_map_render(page)
            path = save_screenshot(
                page,
                output_dir,
                capability="一张图",
                region_key=str(config.get("region", "")),
            )
            if headful:
                # 有头调试：截图后停留片刻，便于肉眼确认地图与数值已渲染。
                page.wait_for_timeout(4_000)
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
