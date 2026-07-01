# 常见错误与解决方案

## 安装问题

### agent-browser 命令未找到

**症状：**
```
command not found: agent-browser
```

**原因：**
- 未安装 agent-browser
- 安装位置不在 PATH 中
- 使用 nvm 但全局包安装在错误位置

**解决方案：**
```bash
# 重新安装
npm install -g agent-browser

# 检查安装位置
which agent-browser
npm root -g

# 如果使用 nvm，确保使用正确的 node 版本
nvm use 20
npm install -g agent-browser

# 手动添加到 PATH
export PATH="$PATH:$(npm root -g)/.bin"
```

### Playwright 浏览器未安装

**症状：**
```
Error: Executable doesn't exist at .../chromium
```

**解决方案：**
```bash
# 安装 Playwright 浏览器
npx playwright install chromium

# 或安装所有浏览器
npx playwright install

# 指定安装路径
PLAYWRIGHT_BROWSERS_PATH=/custom/path npx playwright install
```

## 运行时错误

### 超时错误

**症状：**
```
TimeoutError: Timeout 30000ms exceeded
```

**原因：**
- 网络慢
- 页面加载大量资源
- 动态内容未就绪

**解决方案：**
```bash
# 增加超时时间
agent-browser open "https://example.com" --timeout 60000

# 添加延迟
agent-browser screenshot output.png --delay 5000

# 在脚本中处理
time.sleep(5)  # 等待页面加载
```

### 元素未找到

**症状：**
```
Error: No element matches selector ".target"
```

**原因：**
- 选择器错误
- 元素尚未加载
- 元素在 iframe 中
- 元素被动态替换

**解决方案：**
```bash
# 1. 检查选择器
agent-browser evaluate "document.querySelectorAll('.target').length"

# 2. 等待元素出现
agent-browser evaluate "() => {
  return new Promise(resolve => {
    const check = () => {
      const el = document.querySelector('.target');
      if (el) resolve(true);
      else setTimeout(check, 500);
    };
    check();
  });
}()"

# 3. 使用更通用的选择器
agent-browser click "button:has-text('Submit')"
```

### 截图过小

**症状：**
- 截图文件 < 50 KB
- 截图全白或只有部分页面

**原因：**
- 页面未完全加载
- 懒加载内容未触发
- 截图时页面还在渲染

**解决方案：**
```python
import time
import os

def safe_screenshot(path, min_size_kb=200, retries=3):
    for i in range(retries):
        # 先等待
        time.sleep(3)
        
        # 截图
        subprocess.run(["agent-browser", "screenshot", path])
        
        # 检查大小
        size_kb = os.path.getsize(path) / 1024
        if size_kb >= min_size_kb:
            return True
        
        # 滚动触发懒加载
        subprocess.run([
            "agent-browser", "evaluate",
            "window.scrollTo(0, document.body.scrollHeight)"
        ])
        time.sleep(2)
    
    return False
```

## JavaScript 执行问题

### 多行 JS 返回 null

**症状：**
```
agent-browser evaluate 返回 null
```

**原因：**
browser_console 和某些 evaluate 实现只返回最后一行表达式的值。多行代码时最后一行可能是空值。

**解决方案：**
```javascript
// ❌ 错误 — 多行，返回 null
var items = document.querySelectorAll('.item');
var result = [];
for (var i = 0; i < items.length; i++) {
    result.push(items[i].textContent);
}
result;

// ✅ 正确 — 单行，返回结果
var items = document.querySelectorAll('.item'); var result = []; for (var i = 0; i < items.length; i++) { result.push(items[i].textContent); } result;

// ✅ 替代 — 使用 IIFE
(() => { var items = document.querySelectorAll('.item'); return Array.from(items).map(i => i.textContent); })()
```

### Vue/React 输入框值未更新

**症状：**
- 输入了文本但表单验证失败
- 值显示在界面上但提交时为空

**原因：**
现代框架使用虚拟 DOM，直接设置 `input.value` 不会触发响应式更新。

**解决方案：**
```javascript
// Vue 3 — 使用原生 value setter
const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
const input = document.querySelector('input');
s.call(input, 'new value');
input.dispatchEvent(new Event('input', { bubbles: true }));
input.dispatchEvent(new Event('change', { bubbles: true }));

// React — 使用 ReactTestUtils（需要引入）
// 或使用 agent-browser type 命令（自动处理）
agent-browser type "input" "new value"
```

## 网络问题

### SSL 证书错误

**症状：**
```
Error: net::ERR_CERT_AUTHORITY_INVALID
```

**解决方案：**
```bash
# 忽略证书错误（仅开发环境）
agent-browser open "https://self-signed.example.com" --ignore-https-errors
```

### 代理设置

**症状：**
- 公司网络下无法访问外部网站
- 连接超时

**解决方案：**
```bash
# 设置代理
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080

# 或使用 Playwright 代理选项
agent-browser open "https://example.com" --proxy "http://proxy:8080"
```

## 权限问题

### 文件写入失败

**症状：**
```
Error: EACCES: permission denied, open '/path/to/file.png'
```

**解决方案：**
```bash
# 检查目录权限
ls -la /path/to/

# 使用有权限的目录
agent-browser screenshot ~/Desktop/output.png

# 或创建目录
mkdir -p ~/screenshots
agent-browser screenshot ~/screenshots/output.png
```

## 调试技巧

### 启用详细日志

```bash
# Playwright 调试模式
DEBUG=pw:* agent-browser open "https://example.com"

# 仅浏览器日志
DEBUG=pw:browser agent-browser open "https://example.com"
```

### 保留浏览器打开

```python
import subprocess

# 启动浏览器并保持打开（用于调试）
process = subprocess.Popen([
    "agent-browser", "open", "https://example.com",
    "--headless", "false"  # 显示浏览器窗口
])

# 手动操作...
input("按回车关闭浏览器...")
process.terminate()
```

### 检查页面状态

```bash
# 获取页面信息
agent-browser evaluate "JSON.stringify({
    url: window.location.href,
    title: document.title,
    readyState: document.readyState,
    viewport: { width: window.innerWidth, height: window.innerHeight }
})"

# 检查元素
agent-browser evaluate "document.querySelectorAll('button').length"

# 获取元素信息
agent-browser evaluate "() => {
    const el = document.querySelector('.target');
    return el ? {
        tag: el.tagName,
        class: el.className,
        id: el.id,
        text: el.textContent.slice(0, 100),
        rect: el.getBoundingClientRect()
    } : null;
}()"
```
