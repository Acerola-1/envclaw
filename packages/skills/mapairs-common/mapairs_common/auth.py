#!/usr/bin/env python3
"""数智大气（Mapairs）共享登录逻辑。

凭证只从环境变量读取，自动处理共享值守账号的"设备数量上限"清退。
不在日志中输出任何凭证内容。
"""

import os
from typing import TYPE_CHECKING

from .config import get_login_url, POST_LOGIN_PATH

if TYPE_CHECKING:
    from playwright.sync_api import Page


def login(page: "Page") -> None:
    username = os.environ.get("MAPAIRS_USERNAME", "")
    password = os.environ.get("MAPAIRS_PASSWORD", "")
    if not username or not password:
        raise RuntimeError("缺少数智大气凭证：请设置 MAPAIRS_USERNAME 和 MAPAIRS_PASSWORD")

    page.goto(get_login_url(), wait_until="domcontentloaded")
    page.locator(".loginBg").wait_for(state="visible", timeout=30_000)
    page.locator(".loginBg").click()

    page.get_by_role("textbox", name="请输入账号/手机号").fill(username)
    page.get_by_role("textbox", name="请输入密码").fill(password)
    page.get_by_role("button", name="登录", exact=True).click()
    page.wait_for_timeout(3_000)

    # 共享值守账号可能命中设备上限；循环清退在线设备。
    # 关键：退出按钮的点击必须在 evaluate 内部完成——page.evaluate 返回的是
    # 序列化后的 JSON 值而非可操作的 DOM 句柄，无法在 Python 侧对其调用 click()。
    for _ in range(30):
        if page.get_by_text("登录设备数量已达上限").count() == 0:
            break
        clicked = page.evaluate(
            """() => {
                const d = document.querySelector('.device-limit-dialog');
                const b = [...(d?.querySelectorAll('button') || [])]
                    .find(x => x.innerText.trim() === '退出');
                if (b) { b.click(); return true; }
                return false;
            }"""
        )
        if not clicked:
            raise RuntimeError("检测到设备数量上限，但找不到设备退出按钮")
        page.wait_for_timeout(2_000)
        for label in ("确定退出", "确认退出"):
            confirm_btn = page.get_by_role("button", name=label)
            if confirm_btn.count():
                confirm_btn.first.click()
                page.wait_for_timeout(3_000)
                break

    if page.get_by_text("登录设备数量已达上限").count() > 0:
        raise RuntimeError("登录设备数量上限，循环清退 30 次后仍然存在")

    # 部分页面登录后弹出"知道了"提示，点掉后再继续。
    know_btn = page.get_by_role("button", name="知道了")
    if know_btn.count() > 0:
        know_btn.first.click()

    page.wait_for_url(f"**{POST_LOGIN_PATH}", timeout=20_000)
    print(f"[info] 登录完成，当前落地页：{POST_LOGIN_PATH}")
