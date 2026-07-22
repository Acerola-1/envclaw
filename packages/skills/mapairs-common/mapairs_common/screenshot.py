#!/usr/bin/env python3
"""数智大气截图技能的共享截图工具：命名、裁剪、输出与成果上报。"""

from datetime import datetime
from pathlib import Path
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from playwright.sync_api import Page


def get_screenshot_filename(
    capability: str,
    region_key: Optional[str],
    output_dir: Path,
) -> Path:
    """生成统一的截图文件名：{capability}_{region}_{timestamp}.png"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    region_part = f"_{region_key}" if region_key else ""
    return output_dir / f"{capability}{region_part}_{timestamp}.png"


def save_screenshot(
    page: "Page",
    output_dir: Path,
    capability: str,
    region_key: Optional[str] = None,
    clip: Optional[dict] = None,
    selector: Optional[str] = None,
) -> Path:
    """将截图保存到输出目录并返回文件路径。

    裁剪优先级：clip（显式 bounding box） > selector（元素范围） > 整页。
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = get_screenshot_filename(capability, region_key, output_dir)

    box = clip
    if box is None and selector:
        element = page.locator(selector)
        box = element.bounding_box()

    if box and box.get("width", 0) > 0 and box.get("height", 0) > 0:
        page.screenshot(path=str(output_path), clip=box)
    else:
        page.screenshot(path=str(output_path))
    return output_path


def report_artifact(path: Path) -> None:
    """按 Hermes 约定输出成果标记，供自动推送到指定频道识别。"""
    print(f"ARTIFACT:{path}")
    print(f"MEDIA:{path.as_posix()}")
