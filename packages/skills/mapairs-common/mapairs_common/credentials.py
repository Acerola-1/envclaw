#!/usr/bin/env python3
"""数智大气（Mapairs）凭证读取。

凭证由 Envclaw 在用户登录平台成功后，写入 Web UI 家目录下的运行时凭证文件
（.mapairs-credentials.json）。截图技能在任务执行时即时读取该文件，因此用户
重新登录后凭证会自动同步，无需重启任何进程。

不在日志中输出任何凭证内容。
"""

import json
import os
from pathlib import Path
from typing import Tuple


def _web_ui_home() -> Path:
    """解析 Web UI 家目录，与服务端 config.appHome 保持一致。"""
    home = os.environ.get("HERMES_WEB_UI_HOME") or os.environ.get("HERMES_WEBUI_STATE_DIR")
    if home and home.strip():
        return Path(home.strip()).expanduser()
    return Path.home() / ".envclaw-web-ui"


def credentials_file() -> Path:
    """返回运行时凭证文件路径，可用 MAPAIRS_CREDENTIALS_FILE 覆盖。"""
    override = os.environ.get("MAPAIRS_CREDENTIALS_FILE", "").strip()
    if override:
        return Path(override).expanduser()
    return _web_ui_home() / ".mapairs-credentials.json"


def load_credentials() -> Tuple[str, str]:
    """读取 Envclaw 写入的凭证文件，返回 (username, password)。

    文件缺失、无法解析或字段为空时返回空串，由调用方决定如何报错。
    """
    path = credentials_file()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return "", ""
    username = str(data.get("username") or "")
    password = str(data.get("password") or "")
    return username, password
