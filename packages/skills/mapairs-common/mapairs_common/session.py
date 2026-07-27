#!/usr/bin/env python3
"""数智大气（Mapairs）登录会话复用（带保鲜期 TTL）。

同一站点（同 host）下 /oneMap、/dataStatistics/... 等页面共享登录会话
（cookie + localStorage）。各截图技能是独立进程，若每个都 login() 既浪费每次
6~10s，又会把共享账号的 5 台设备位不断占满、反复触发清退。

但整包持久化 storage_state 会连带存下网站写在 localStorage 里的“当前数据时刻”
缓存（如 airTime），长期复用会把数据冻结在首次登录那一刻（实测冻在 16:00）。
因此这里给会话加一个很短的**保鲜期 TTL**（默认 10 分钟、上限 30 分钟，
MAPAIRS_SESSION_TTL_MIN 可配）：
- 会话文件年龄 < TTL：视为“同一次任务内”，复用（不重复登录、不多占设备位，
  数据时刻是本次任务刚登录时取到的最新值）；
- 会话文件年龄 ≥ TTL：视为“新一轮任务”，全新登录并覆盖会话，刷新数据时刻。
TTL 取值只需 > 单次任务耗时（分钟级）、< 任务间隔（如每小时），即可做到
“每任务登录一次、任务内复用、数据始终最新”，且不依赖任何 localStorage 键名。

带会话时直接访问目标页探测是否仍登录：未登录会被路由守卫弹回 /lock，此时回退到
全新登录。探测绝不额外访问 /overallSituation 等重 WebGL 页——一个渲染进程连开两个
重 WebGL 页会导致 Page crashed（net::ERR_ABORTED / frame detached）。

用 MAPAIRS_DISABLE_SESSION_REUSE=1 可强制每次全新登录（调试用）。
"""
from __future__ import annotations

import os
import time
from typing import TYPE_CHECKING, Tuple

from .auth import login
from .config import LOGIN_PATH
from .credentials import session_file

if TYPE_CHECKING:
    from playwright.sync_api import Browser, BrowserContext, Page


def _reuse_enabled() -> bool:
    return os.environ.get("MAPAIRS_DISABLE_SESSION_REUSE", "").strip() not in ("1", "true", "True")


_DEFAULT_TTL_SEC = 600  # 会话保鲜期默认 10 分钟
_MAX_TTL_SEC = 1800  # 保鲜期硬性上限 30 分钟（再长复用会让数据时刻偏旧）


def _session_ttl_sec() -> int:
    """会话保鲜期（秒）。MAPAIRS_SESSION_TTL_MIN（分钟）可配，缺省 10 分钟，上限 30 分钟。"""
    raw = os.environ.get("MAPAIRS_SESSION_TTL_MIN", "").strip()
    if not raw:
        return _DEFAULT_TTL_SEC
    try:
        return max(0, min(_MAX_TTL_SEC, int(float(raw) * 60)))
    except ValueError:
        return _DEFAULT_TTL_SEC


def _session_fresh(sf) -> bool:
    """会话文件是否仍在保鲜期内（按文件 mtime=上次登录时刻计）。"""
    try:
        return (time.time() - sf.stat().st_mtime) < _session_ttl_sec()
    except OSError:
        return False


def new_context_with_session(browser: "Browser", **context_kwargs) -> Tuple["BrowserContext", bool]:
    """新建浏览器上下文；仅当已保存会话仍在保鲜期(TTL)内才带上 storage_state。

    返回 (context, had_session)：had_session=True 表示带入了新鲜会话（同一任务内
    复用）；过期或不存在则 False（新一轮任务，交由 ensure_authenticated 全新登录）。
    """
    sf = session_file()
    if _reuse_enabled() and sf.exists():
        if _session_fresh(sf):
            try:
                ctx = browser.new_context(storage_state=str(sf), **context_kwargs)
                return ctx, True
            except Exception as exc:  # 会话文件损坏/不兼容：回退全新登录
                print(f"[warn] 已保存会话无法加载，改为全新登录：{exc}")
        else:
            print(
                f"[info] 已保存会话超过保鲜期（{_session_ttl_sec() // 60} 分钟），"
                "视为新一轮任务，全新登录以刷新数据时刻"
            )
    return browser.new_context(**context_kwargs), False


def save_session(context: "BrowserContext") -> None:
    """原子写入 storage_state：先写临时文件再 rename，避免并发下读到半截文件。"""
    if not _reuse_enabled():
        return
    sf = session_file()
    try:
        sf.parent.mkdir(parents=True, exist_ok=True)
        tmp = sf.with_suffix(sf.suffix + ".tmp")
        context.storage_state(path=str(tmp))
        os.replace(tmp, sf)
    except Exception as exc:
        print(f"[warn] 保存会话失败（不影响本次截图）：{exc}")


def ensure_authenticated(
    context: "BrowserContext", page: "Page", had_session: bool, target_url: str
) -> None:
    """确保已登录并停在 target_url。

    带会话时直接访问目标页（不再访问 /overallSituation 等额外重页——连开两个
    重 WebGL 页会导致渲染进程崩溃）。若被路由守卫弹回 /lock 说明会话失效，则
    回退到全新登录后重新访问目标页。地图技能须在调用本函数前 install 渲染 hook
    （本函数会 goto 目标页，hook 必须先于任何 goto 注入）。
    """
    if had_session:
        try:
            page.goto(target_url, wait_until="domcontentloaded")
            bounced = False
            for _ in range(10):  # 给 SPA 路由守卫留重定向时间（约 2s）
                page.wait_for_timeout(200)
                if LOGIN_PATH in page.url:
                    bounced = True
                    break
            if not bounced and LOGIN_PATH not in page.url:
                print("[info] 复用已保存会话，跳过登录")
                return
            print("[info] 已保存会话已失效，改为全新登录")
        except Exception as exc:
            print(f"[warn] 带会话访问目标页失败，改为全新登录：{exc}")
    login(page)
    save_session(context)
    page.goto(target_url, wait_until="domcontentloaded")
