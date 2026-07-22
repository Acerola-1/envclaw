#!/usr/bin/env python3
"""数智大气（Mapairs）基础配置。

Base URL 支持通过环境变量 MAPAIRS_BASE_URL 覆盖，默认使用内网地址；
未来切换公网只需修改环境变量，无需改动脚本。
"""

import os
from urllib.parse import urlsplit

# 默认内网部署地址；公网部署时通过 MAPAIRS_BASE_URL 覆盖。
DEFAULT_BASE_URL = "http://192.168.4.25:8095"
# 登录页与登录后落地页路径（各功能页面统一从这里跳转）。
LOGIN_PATH = "/lock"
POST_LOGIN_PATH = "/overallSituation"


def get_base_url() -> str:
    """返回 Mapairs 基础 URL，去掉尾部斜杠。"""
    base = os.environ.get("MAPAIRS_BASE_URL", "").strip() or DEFAULT_BASE_URL
    return base.rstrip("/")


def get_login_url() -> str:
    """返回登录页完整 URL。"""
    return f"{get_base_url()}{LOGIN_PATH}"


def get_base_host() -> str:
    """返回基础 URL 的主机名，供网络连通性预检使用。"""
    return urlsplit(get_base_url()).hostname or ""


def build_url(path: str, params: dict) -> str:
    """基于 base_url 拼接目标页面 URL 与查询参数（保持参数顺序）。"""
    from urllib.parse import urlencode

    query = urlencode([(k, v) for k, v in params.items() if v is not None], safe=",")
    normalized = path if path.startswith("/") else f"/{path}"
    return f"{get_base_url()}{normalized}?{query}"
