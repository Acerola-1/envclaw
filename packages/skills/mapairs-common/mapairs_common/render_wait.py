#!/usr/bin/env python3
"""数智大气（Mapairs）地图渲染完成等待工具。

一张图（/oneMap）基于 Mapbox GL JS 渲染，空气质量数据（城市点、站点、插值
瓦片）全部是 GL 图层，绘制进同一个 WebGL 画布。因此：

- `networkidle` 只能反映网络请求结束，无法反映 GL 瓦片的 GPU 合成完成；
- 页面里存在高度为 0 的 `.spinner` 残留元素，用可见性判断会误判。

判定分两步：
1. 等 base 就绪信号——地图实例自身状态
   `loaded() && isStyleLoaded() && areTilesLoaded() && !isMoving()`，
   且“最后一次 data 事件之后”至少触发过一次 `idle`（底图/瓦片/区域动画稳定）；
2. base 就绪后再硬等一段固定时长。因为城市 AQI 数字标签在 idle 后仍会异步
   回填、字形异步栅格化，`queryRenderedFeatures` 报告“有要素”会早于文字真正上
   屏，无法作为放行依据；改用固定等待兜住上屏时间（默认 10s，见 wait_for_map_render）。

用法（顺序很重要）：
    page = context.new_page()
    install_map_render_hook(page)          # 必须在任何 goto 之前
    login(page)
    page.goto(target_url, wait_until="domcontentloaded")
    wait_for_map_render(page)              # base 就绪 + 硬等，替代 networkidle
"""

from typing import TYPE_CHECKING

import os as _os

if TYPE_CHECKING:
    from playwright.sync_api import Page


# 在页面任何脚本执行前注入：轮询 window.mapboxgl，包裹 Map.prototype.fire，
# 捕获地图实例并记录 idle / data 事件时间。window.mapboxgl 在该站点全局暴露，
# 故此 hook 可靠；相较包裹构造函数，包裹 fire 能保留原型链且实现更简单。
# 注意：add_init_script 注入的是原始脚本文本，必须用 IIFE 自执行，否则一个裸的
# 箭头函数表达式只会被定义而不会被调用（区别于 evaluate 会自动调用），hook 形同虚设。
_INIT_HOOK = """
(() => {
  const install = () => {
    const mb = window.mapboxgl;
    if (!mb || !mb.Map || !mb.Map.prototype) return false;
    const proto = mb.Map.prototype;
    if (proto.__hermesHooked) return true;
    const origFire = proto.fire;
    proto.fire = function (ev) {
      try {
        window.__hermesMap = this;
        const t = (typeof ev === 'string') ? ev : (ev && ev.type);
        if (t === 'idle') window.__hermesIdleAt = performance.now();
        else if (t === 'data' || t === 'sourcedata' || t === 'styledata') {
          window.__hermesDataAt = performance.now();
        }
      } catch (e) { /* 忽略：不得影响页面自身逻辑 */ }
      return origFire.apply(this, arguments);
    };
    proto.__hermesHooked = true;
    return true;
  };
  if (!install()) {
    const iv = setInterval(() => { if (install()) clearInterval(iv); }, 50);
    setTimeout(() => clearInterval(iv), 20000);
  }
})();
"""


# base 就绪判定：地图已加载、样式与瓦片就绪、非移动中，且在最后一次 data
# 事件之后触发过一次 idle（底图/瓦片/区域切换动画都已稳定）。
#
# 注：不再以数据图层 queryRenderedFeatures>0 作为判据——实测发现它报告“有
# 要素”会早于数字字形真正上屏（符号异步栅格化），据此放行仍会截出无数字的
# 图。因此改为：base 就绪后由调用方再**硬等一段固定时长**，兜住数据图层异步回填
# 与字形上屏的时间（见 wait_for_map_render）。
_READY_PREDICATE = """
() => {
  const m = window.__hermesMap;
  if (!m) return false;
  try {
    if (!(m.loaded() && m.isStyleLoaded() && m.areTilesLoaded() && !m.isMoving())) {
      return false;
    }
    const idleAt = window.__hermesIdleAt || 0;
    const dataAt = window.__hermesDataAt || 0;
    return idleAt > 0 && idleAt >= dataAt;
  } catch (e) {
    return false;
  }
}
"""


def install_map_render_hook(page: "Page") -> None:
    """在导航前注入地图捕获 hook。必须在任何 page.goto 之前调用。"""
    page.add_init_script(_INIT_HOOK)


_DEFAULT_HARD_WAIT_MS = 10_000


def wait_for_map_render(
    page: "Page",
    timeout_ms: int = 20_000,
    hard_wait_ms: "int | None" = None,
) -> bool:
    """等地图 base 就绪后再硬等一段，返回是否命中就绪信号。

    判定「base 就绪」= 地图已加载、样式与瓦片就绪、非移动中，且最后一次 data
    事件后触发过 idle（底图/瓦片/区域切换动画都稳定）。命中后再**硬等 hard_wait_ms**，
    覆盖 AQI 数字点位等数据图层的异步回填与字形栅格化（queryRenderedFeatures 报告
    要素会早于文字上屏，故不以图层要素数为准，改用固定等待兜住上屏时间）。

    hard_wait_ms 缺省读环境变量 MAPAIRS_RENDER_HARD_WAIT_MS（毫秒），再缺省 10000。
    超时兜底：不抛异常，告警后仍硬等再返回 False，让调用方照常截图。
    """
    if hard_wait_ms is None:
        try:
            hard_wait_ms = int(
                _os.environ.get("MAPAIRS_RENDER_HARD_WAIT_MS", "") or _DEFAULT_HARD_WAIT_MS
            )
        except ValueError:
            hard_wait_ms = _DEFAULT_HARD_WAIT_MS
    ready = True
    try:
        page.wait_for_function(_READY_PREDICATE, timeout=timeout_ms)
    except Exception:
        ready = False
        print(
            "[warn] 未在超时内检测到地图 base 就绪信号，"
            "仍按固定时长等待后继续截图（可能与网络或页面结构变化有关）"
        )
    # base 就绪(或超时)后统一硬等，覆盖数据图层异步回填与字形上屏。
    if hard_wait_ms > 0:
        page.wait_for_timeout(hard_wait_ms)
    return ready
