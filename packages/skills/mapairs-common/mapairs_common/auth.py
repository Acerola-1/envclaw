#!/usr/bin/env python3
"""数智大气（Mapairs）共享登录逻辑。

凭证由 Envclaw 写入的运行时凭证文件读取，自动处理共享值守账号的"设备数量上限"清退。
不在日志中输出任何凭证内容。
"""

from typing import TYPE_CHECKING

import time

from .config import get_login_url, POST_LOGIN_PATH
from .credentials import load_credentials

if TYPE_CHECKING:
    from playwright.sync_api import Page


def login(page: "Page") -> None:
    username, password = load_credentials()
    if not username or not password:
        raise RuntimeError("缺少数智大气凭证：Envclaw 尚未写入凭证文件，请在客户端重新登录平台")

    page.goto(get_login_url(), wait_until="domcontentloaded")
    page.locator(".loginBg").wait_for(state="visible", timeout=30_000)
    page.locator(".loginBg").click()

    page.get_by_role("textbox", name="请输入账号/手机号").fill(username)
    page.get_by_role("textbox", name="请输入密码").fill(password)
    page.get_by_role("button", name="登录", exact=True).click()
    page.wait_for_timeout(3_000)

    # 登录成功的唯一判据：URL 落地到 POST_LOGIN_PATH。设备上限弹窗有两种形态：
    #  (a) 停留在 /lock 阻塞登录 → 需清退一个在线设备以放行；
    #  (b) 作为落地页上的提示浮层（登录其实已成功）→ 无需纠缠。
    #
    # 血的教训：落地页是极重的 WebGL 首页，若在其上反复点击/长时间停留，无头
    # 渲染进程会崩溃（Target crashed），后续任何调用挂起数分钟。而且实测发现：
    # 登录已落地后，对浮层反复点“退出+确认”并不会减少设备数，纯属无效空转。
    # 因此：一旦 URL 已落地就立即返回（交由调用方 goto 目标页离开首页）；
    # 只有在仍停留 /lock 时才清退，且全程短超时 + 硬预算，绝不在重页上纠缠。
    deadline = time.time() + 30
    while time.time() < deadline:
        if POST_LOGIN_PATH in page.url:
            break  # 登录已成功（可能带提示浮层），不在重页上停留
        if page.get_by_text("登录设备数量已达上限").count() == 0:
            page.wait_for_timeout(500)
            continue
        # 仍被设备上限阻塞：清退一个在线设备以放行。
        # 关键：退出按钮的点击必须在 evaluate 内部完成——page.evaluate 返回的是
        # 序列化后的 JSON 值而非可操作的 DOM 句柄，无法在 Python 侧对其调用 click()。
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
        # 二次确认按钮也用 JS 直接点击：登录过程中常有全屏 el-loading-mask
        # 加载遮罩，Playwright 常规 click 会因遮罩拦截指针而重试到 30s 超时；
        # DOM 直接 .click() 绕过可操作性/拦截检查，瞬时完成。
        page.wait_for_timeout(300)
        page.evaluate(
            """() => {
                const b = [...document.querySelectorAll('button')]
                    .find(x => ['确定退出', '确认退出'].includes(x.innerText.trim()));
                if (b) b.click();
            }"""
        )
        page.wait_for_timeout(500)

    # 部分页面登录后弹出"知道了"提示，点掉后再继续。
    know_btn = page.get_by_role("button", name="知道了")
    if know_btn.count() > 0:
        know_btn.first.click()

    # 收尾：确保 URL 已落地。只等 URL(commit)，不等极重的 /overallSituation 整页 load。
    if POST_LOGIN_PATH not in page.url:
        page.wait_for_url(f"**{POST_LOGIN_PATH}", wait_until="commit", timeout=15_000)
    print(f"[info] 登录完成，当前落地页：{POST_LOGIN_PATH}")
