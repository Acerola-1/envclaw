#!/usr/bin/env python3
"""
Vercel Labs Agent Browser 诊断脚本
检查 agent-browser 是否正确安装并可正常工作
"""

import subprocess
import sys
import time
import os


def check_installation():
    """检查 agent-browser 是否已安装"""
    try:
        result = subprocess.run(
            ["agent-browser", "--version"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            return True, result.stdout.strip()
        return False, f"agent-browser 返回错误: {result.stderr}"
    except FileNotFoundError:
        return False, "agent-browser 未安装"
    except Exception as e:
        return False, f"检查失败: {e}"


def test_basic_operations():
    """测试基本操作"""
    tests = []

    # 测试1: 打开页面
    try:
        result = subprocess.run(
            ["agent-browser", "open", "https://example.com"],
            capture_output=True, text=True, timeout=30
        )
        tests.append(("打开页面", result.returncode == 0, result.stderr if result.returncode != 0 else "OK"))
        time.sleep(2)  # 等待页面加载
    except Exception as e:
        tests.append(("打开页面", False, str(e)))

    # 测试2: 执行 JavaScript
    try:
        result = subprocess.run(
            ["agent-browser", "evaluate", "document.title"],
            capture_output=True, text=True, timeout=10
        )
        tests.append(("执行 JS", result.returncode == 0, result.stdout.strip() if result.returncode == 0 else result.stderr))
    except Exception as e:
        tests.append(("执行 JS", False, str(e)))

    # 测试3: 截图
    try:
        test_screenshot = "/tmp/agent_browser_test.png"
        result = subprocess.run(
            ["agent-browser", "screenshot", test_screenshot],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0 and os.path.exists(test_screenshot):
            size_kb = os.path.getsize(test_screenshot) / 1024
            tests.append(("截图", True, f"{size_kb:.1f} KB"))
            os.remove(test_screenshot)
        else:
            tests.append(("截图", False, result.stderr))
    except Exception as e:
        tests.append(("截图", False, str(e)))

    return tests


def main():
    print("=" * 60)
    print("Vercel Labs Agent Browser 诊断工具")
    print("=" * 60)

    # 检查安装
    print("\n[1/3] 检查安装...")
    installed, msg = check_installation()
    if installed:
        print(f"  ✅ agent-browser 已安装 (版本: {msg})")
    else:
        print(f"  ❌ {msg}")
        print("\n  安装命令:")
        print("    npm install -g agent-browser")
        sys.exit(1)

    # 测试基本操作
    print("\n[2/3] 测试基本操作...")
    tests = test_basic_operations()
    for name, passed, detail in tests:
        status = "✅" if passed else "❌"
        print(f"  {status} {name}: {detail}")

    # 总结
    print("\n[3/3] 诊断结果")
    all_passed = all(passed for _, passed, _ in tests)
    if all_passed:
        print("  ✅ 所有测试通过，agent-browser 工作正常")
    else:
        print("  ⚠️ 部分测试失败，请检查上述错误信息")

    print("\n" + "=" * 60)


if __name__ == "__main__":
    main()
