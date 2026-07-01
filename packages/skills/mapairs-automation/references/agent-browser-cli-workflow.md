# agent-browser CLI 操作指南

## 关键命令对照

| 你想做的事 | ❌ 错误做法 | ✅ 正确做法 |
|-----------|-------------|-------------|
| 执行 JS | `agent-browser evaluate ...` | `agent-browser eval ...` |
| 持久化登录 | 不加参数 | `--session-name <name>` |
| SPA 导航 | `agent-browser open <url>` | `agent-browser eval "location.href='<url>'"` |
| 截图 | 直接截图 | 先 `set viewport 1920 1080` 再截图 |
| JS 循环 | `for...of` 或 `for...in` | `for(var i=0;i<n.length;i++)` |
| Vue 元素点击 | `.click()` | `new MouseEvent('click',{bubbles:true,cancelable:true})` 派发 |

## 完整工作流程（平顶山账号）

```bash
# 1. 打开页面（必须 --session-name）
agent-browser --session-name mapairs open https://www.mapairs.com/
sleep 5

# 2. 检测是否在 /lock 页面
agent-browser eval "window.location.href.includes('/lock')"
# → 如果在 /lock 说明 token 过期，需要重新登录

# 3. 登录（必须用 var + for(i=0;i<n;i++) 写法）
agent-browser eval "var el=document.querySelector('.loginBg'); if(el){var evt=new MouseEvent('click',{bubbles:true,cancelable:true});el.dispatchEvent(evt)}"
sleep 2
agent-browser eval "var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; var ins=document.querySelectorAll('input'); for(var i=0;i<ins.length;i++){if(ins[i].placeholder?.includes('账号')||ins[i].placeholder?.includes('手机号')){ins[i].removeAttribute('readonly');ins[i].focus();s.call(ins[i],'X-mojl');ins[i].dispatchEvent(new Event('input',{bubbles:true}));ins[i].dispatchEvent(new Event('change',{bubbles:true}));}if(ins[i].placeholder?.includes('密码')){ins[i].removeAttribute('readonly');ins[i].focus();s.call(ins[i],'yutu@889');ins[i].dispatchEvent(new Event('input',{bubbles:true}));ins[i].dispatchEvent(new Event('change',{bubbles:true}));}}"
sleep 1
agent-browser eval "var b=document.querySelectorAll('button'); for(var i=0;i<b.length;i++){if(b[i].textContent?.trim()==='登录'){b[i].click();break}}"
sleep 5

# 4. 验证登录成功
agent-browser eval "!window.location.href.includes('/lock')"
# → true 即成功

# 5. SPA 导航到目标页面
agent-browser eval "location.href='https://www.mapairs.com/dataStatistics/CityHourBroadcast'"
sleep 15

# 6. 设置 viewport 再截图
agent-browser set viewport 1920 1080
sleep 1
agent-browser screenshot ~/Desktop/screenshot.png
```

## 会话隔离陷阱

Hermes 的 `browser_navigate` / `browser_console` 等工具启动的浏览器，与 agent-browser CLI 启动的浏览器是**完全独立的两个进程**，不共享 cookies/localStorage。

**正确做法：**
- 截图全程使用 agent-browser CLI + `--session-name`
- 不要混用两者——在 Hermes 工具中登录后，agent-browser CLI 仍是未登录状态

## --session-name 原理

`--session-name` 将浏览器的 cookies 和 localStorage 保存到 `~/.agent-browser/sessions/<name>/` 目录。后续同名的命令会自动加载这些状态。

**重要：**
- `--session-name` 保存的是**上次关闭时的状态**，可能包含过期 token
- 如果登录后页面跳转到 `/lock`，说明 token 已过期，需要重新登录
- 重新登录后 `--session-name` 会自动保存新 token

## 截图文件大小诊断

| 文件大小 | 含义 | 处理方式 |
|---------|------|---------|
| < 200 KB | 页面未加载或显示地图而非数据 | 改用 `location.href` SPA 导航（不是 `agent-browser open`） |
| 200-300 KB | 页面部分加载 | 增加等待时间 |
| 300-1900 KB | 正常 | ✅ |

## agent-browser eval JS 语法限制

`agent-browser eval` 使用轻量 JS 引擎，不是标准浏览器环境：

| 语法 | 结果 | 替代写法 |
|------|------|---------|
| `const` / `let` | SyntaxError | `var` |
| `for...of` | TypeError 或静默失败 | `for(var i=0;i<n.length;i++)` |
| `()=>{}` 箭头函数 | SyntaxError | 直接用语句 |
| `console.log()` | 无输出 | 用返回值替代 |
| `.click()` on Vue 元素 | 静默失效 | `new MouseEvent('click',{bubbles:true,cancelable:true})` |
| `?.` optional chaining | ✅ 支持 | — |
