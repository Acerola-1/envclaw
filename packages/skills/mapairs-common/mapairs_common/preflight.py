#!/usr/bin/env python3
"""数智大气截图技能的共享运行环境预检。

在打开浏览器前给出可操作的诊断，避免网页操作到一半才发现依赖缺失。
检查项：
- Python 版本 >= 3.10
- 可导入 Python Playwright
- Chromium 浏览器可无头启动
- 已注入 MAPAIRS_USERNAME 与 MAPAIRS_PASSWORD 环境变量
- 网络可解析 Mapairs 基础 URL 主机
"""

import os
import socket
import sys
from typing import List

from .config import get_base_host

MINIMUM_PYTHON = (3, 10)


def preflight_check(require_credentials: bool = True, check_network: bool = True) -> None:
    errors: List[str] = []

    # Python 版本
    if sys.version_info < MINIMUM_PYTHON:
        errors.append(
            f"Python 版本过低：当前 {sys.version.split()[0]}，"
            f"需要 Python {MINIMUM_PYTHON[0]}.{MINIMUM_PYTHON[1]} 或更高版本"
        )

    # Playwright 模块 + Chromium 浏览器
    try:
        from playwright.sync_api import sync_playwright
    except ModuleNotFoundError:
        errors.append("未安装 Python Playwright：请执行 pip install playwright 然后执行 playwright install chromium")
        sync_playwright = None

    if sync_playwright is not None:
        try:
            with sync_playwright() as p:
                executable = p.chromium.executable_path
                if not executable or not os.path.isfile(executable):
                    errors.append(f"未安装 Playwright Chromium 浏览器：未找到 {executable}；请执行 playwright install chromium")
                else:
                    browser = p.chromium.launch(headless=True)
                    browser.close()
        except Exception as e:
            errors.append(f"Playwright Chromium 无法启动：{e}；请重新执行 playwright install chromium")

    # 凭证
    if require_credentials:
        if not os.environ.get("MAPAIRS_USERNAME") or not os.environ.get("MAPAIRS_PASSWORD"):
            errors.append("缺少数智大气凭证：Envclaw 尚未向本次任务运行环境注入 MAPAIRS_USERNAME 和 MAPAIRS_PASSWORD")

    # 网络：解析基础 URL 主机
    if check_network:
        host = get_base_host()
        if host:
            try:
                socket.getaddrinfo(host, None)
            except socket.gaierror as e:
                errors.append(f"无法解析数智大气主机 {host}：{e}")

    if errors:
        raise RuntimeError("运行环境预检失败：\n- " + "\n- ".join(errors))

    print("PREFLIGHT: OK")
