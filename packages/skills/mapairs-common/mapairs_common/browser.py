#!/usr/bin/env python3
"""数智大气（Mapairs）截图的浏览器启动辅助。

核心：无头 Chromium 默认用 SwiftShader **软件**渲染 WebGL，对一张图这类重度
Mapbox GL 页面（插值色面 + 风羽动画 + 瓦片）又慢又极易崩溃（Target crashed），
且后台会限流 requestAnimationFrame，导致地图迟迟画不完、截出无数字的中间帧。

通过 ANGLE 强制走各平台的硬件 GPU 后端，可让无头获得与有头一致的渲染效果。
实测（Apple M4）：默认无头 WebGL 渲染器为 SwiftShader；加下列参数后变为
"ANGLE Metal Renderer: Apple M4"，与有头浏览器完全一致。
"""
from __future__ import annotations

import sys


def gpu_launch_args() -> list[str]:
    """返回跨平台的无头 GPU 硬件加速启动参数。

    按 sys.platform 选择 ANGLE 后端，**绝不硬编码单一平台**：
    - macOS  → Metal
    - Windows → D3D11
    - 其他(Linux 等) → gl（OpenGL/EGL）
    `--use-gl=angle` 让 Chromium 统一走 ANGLE，再由 `--use-angle` 指定平台后端。

    另附一组**禁用后台限流**参数：无头/被遮挡窗口默认会限流定时器与
    requestAnimationFrame，导致等待期间地图迟迟画不完、截出中间帧。禁用后
    保证等待期间全速渲染。
    """
    if sys.platform == "darwin":
        backend = "metal"
    elif sys.platform.startswith("win"):
        backend = "d3d11"
    else:
        backend = "gl"
    return [
        "--use-gl=angle",
        f"--use-angle={backend}",
        "--enable-gpu",
        "--ignore-gpu-blocklist",
        "--disable-renderer-backgrounding",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
    ]
