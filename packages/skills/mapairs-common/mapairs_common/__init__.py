# 数智大气（Mapairs）截图技能公共模块
# 抽取预检、登录、截图、配置等通用逻辑供各 skill 复用。

from .preflight import preflight_check
from .auth import login
from .screenshot import save_screenshot, get_screenshot_filename, report_artifact
from .config import get_base_url, get_login_url, get_base_host, build_url
from .render_wait import install_map_render_hook, wait_for_map_render
from .browser import gpu_launch_args
from .session import new_context_with_session, ensure_authenticated, save_session

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
    "install_map_render_hook",
    "wait_for_map_render",
    "gpu_launch_args",
    "new_context_with_session",
    "ensure_authenticated",
    "save_session",
]
