# 数智大气（Mapairs）截图技能公共模块
# 抽取预检、登录、截图、配置等通用逻辑供各 skill 复用。

from .preflight import preflight_check
from .auth import login
from .screenshot import save_screenshot, get_screenshot_filename, report_artifact
from .config import get_base_url, get_login_url, get_base_host, build_url

__all__ = [
    "preflight_check",
    "login",
    "save_screenshot",
    "get_screenshot_filename",
    "report_artifact",
    "get_base_url",
    "get_login_url",
    "get_base_host",
    "build_url",
]
