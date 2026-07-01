---
name: vercel-labs/agent-browser
description: "Vercel Labs Agent Browser 自动化操作指南。提供基于 Playwright 的浏览器自动化能力，支持页面导航、元素交互、截图、数据提取等功能。当用户需要进行网页自动化、浏览器操作、页面截图、数据抓取时，应加载此技能。"
tags: [vercel, "agent-browser", "playwright", automation, browser, screenshot, "web-automation", "data-extraction", "browser-tools", puppeteer]
related_skills: [vercel-labs/agent-browser]
---

# Vercel Labs Agent Browser

Use this skill when automating browser interactions via the `agent-browser` CLI tool — a lightweight Playwright-based browser automation wrapper maintained by Vercel Labs.

## Overview

- **Tool**: `agent-browser` (npm global package)
- **Underlying**: Playwright (Chromium)
- **Use cases**: Page navigation, element interaction, screenshots, data extraction, form filling, automated testing

## Installation

```bash
# Global install (recommended)
npm install -g agent-browser

# Verify installation
agent-browser --version
```

## Core Commands

### Navigation

```bash
# Open a URL
agent-browser open "https://example.com"

# Open with custom viewport
agent-browser open "https://example.com" --viewport 1920x1080

# Open with mobile emulation
agent-browser open "https://example.com" --device "iPhone 14"
```

### Screenshots

```bash
# Full page screenshot
agent-browser screenshot /path/to/output.png

# Element screenshot (CSS selector)
agent-browser screenshot /path/to/output.png --selector ".main-content"

# Screenshot with delay (wait for dynamic content)
agent-browser screenshot /path/to/output.png --delay 3000
```

### Element Interaction

```bash
# Click element
agent-browser click "button#submit"

# Type text into input
agent-browser type "input[name='username']" "my_username"

# Fill form (multiple fields)
agent-browser fill "form#login" '{"username":"user","password":"pass"}'

# Select dropdown option
agent-browser select "select#country" "China"

# Press key
agent-browser press "Enter"
agent-browser press "Escape"
```

### JavaScript Evaluation

```bash
# Execute JavaScript in page context
agent-browser evaluate "document.title"

# Execute complex script
agent-browser evaluate "() => { return document.querySelectorAll('.item').length; }"

# Evaluate with Vue 3 reactive inputs (value setter pattern)
agent-browser evaluate "() => {
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  const input = document.querySelector('input');
  s.call(input, 'new value');
  input.dispatchEvent(new Event('input', {bubbles: true}));
  input.dispatchEvent(new Event('change', {bubbles: true}));
  return 'done';
}()"
```

### Data Extraction

```bash
# Extract text from elements
agent-browser extract ".product-name" --format json

# Extract multiple attributes
agent-browser extract ".product" --attr "data-id,title,href" --format json

# Extract table data
agent-browser evaluate "() => {
  const rows = document.querySelectorAll('table tr');
  return Array.from(rows).map(row => {
    const cells = row.querySelectorAll('td');
    return Array.from(cells).map(c => c.textContent.trim());
  });
}()"
```

## Python Integration

```python
import subprocess
import json

def agent_browser_open(url: str, viewport: str = "1920x1080"):
    """Open a URL with agent-browser."""
    subprocess.run([
        "agent-browser", "open", url,
        "--viewport", viewport
    ], check=True)

def agent_browser_screenshot(path: str, selector: str = None, delay: int = 0):
    """Take a screenshot, optionally targeting a specific element."""
    cmd = ["agent-browser", "screenshot", path]
    if selector:
        cmd.extend(["--selector", selector])
    if delay > 0:
        cmd.extend(["--delay", str(delay)])
    subprocess.run(cmd, check=True)

def agent_browser_evaluate(js_code: str):
    """Execute JavaScript in the page context."""
    result = subprocess.run(
        ["agent-browser", "evaluate", js_code],
        capture_output=True, text=True, timeout=30
    )
    return result.stdout.strip()

def agent_browser_click(selector: str):
    """Click an element by CSS selector."""
    subprocess.run(["agent-browser", "click", selector], check=True)

def agent_browser_type(selector: str, text: str):
    """Type text into an input element."""
    subprocess.run(["agent-browser", "type", selector, text], check=True)
```

## Hermes Browser Tool Fallback

When `agent-browser` is not available, use Hermes built-in browser tools:

| agent-browser | Hermes Equivalent | Notes |
|--------------|-------------------|-------|
| `open` | `browser_navigate` | Navigate to URL |
| `click` | `browser_click` | Click by ref ID |
| `type` | `browser_type` | Type text by ref ID |
| `screenshot` | `browser_vision` | Screenshot + AI analysis |
| `evaluate` | `browser_console` | Execute JS (single-line only!) |
| `press` | `browser_press` | Simulate key press |

### ⚠️ Critical: browser_console Multi-line Trap

```javascript
// ❌ WRONG — multi-line returns null
var nodes = document.querySelectorAll('.item');
var result = [];
for (var i = 0; i < nodes.length; i++) {
    result.push(nodes[i].textContent);
}
result;

// ✅ CORRECT — single-line with semicolors
var nodes = document.querySelectorAll('.item'); var result = []; for (var i = 0; i < nodes.length; i++) { result.push(nodes[i].textContent); } result;
```

## Common Patterns

### Login Flow

```python
import subprocess
import time

def auto_login(url: str, username: str, password: str):
    """Automated login via agent-browser."""
    # 1. Open login page
    subprocess.run(["agent-browser", "open", url])
    time.sleep(2)
    
    # 2. Fill username
    subprocess.run(["agent-browser", "type", "input[name='username']", username])
    
    # 3. Fill password
    subprocess.run(["agent-browser", "type", "input[name='password']", password])
    
    # 4. Click login
    subprocess.run(["agent-browser", "click", "button[type='submit']"])
    
    # 5. Verify (check for dashboard element)
    time.sleep(3)
    result = subprocess.run(
        ["agent-browser", "evaluate", "document.querySelector('.dashboard') !== null"],
        capture_output=True, text=True
    )
    return "true" in result.stdout
```

### Table Data Extraction

```python
import subprocess
import json

def extract_table_data(selector: str = "table") -> list:
    """Extract all table data as a nested list."""
    js_code = f"""() => {{
        const table = document.querySelector('{selector}');
        if (!table) return [];
        const rows = table.querySelectorAll('tr');
        return Array.from(rows).map(row => {{
            const cells = row.querySelectorAll('td, th');
            return Array.from(cells).map(c => c.textContent.trim());
        }});
    }}()"""
    
    result = subprocess.run(
        ["agent-browser", "evaluate", js_code],
        capture_output=True, text=True
    )
    return json.loads(result.stdout)
```

### Screenshot with State Verification

```python
import subprocess
import os

def safe_screenshot(path: str, min_size_kb: int = 200, max_retries: int = 3) -> bool:
    """Take screenshot with size validation."""
    for attempt in range(max_retries):
        subprocess.run(["agent-browser", "screenshot", path, "--delay", "5000"])
        
        size_kb = os.path.getsize(path) / 1024
        if size_kb > min_size_kb:
            return True
        
        # Wait longer if screenshot is too small (page not loaded)
        import time
        time.sleep(5)
    
    return False
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AGENT_BROWSER_HEADLESS` | Run in headless mode | `true` |
| `AGENT_BROWSER_SLOW_MO` | Slow down operations by ms | `0` |
| `AGENT_BROWSER_TIMEOUT` | Default timeout in ms | `30000` |
| `PLAYWRIGHT_BROWSERS_PATH` | Custom browser path | system default |

### Custom Config File

Create `~/.agent-browser/config.json`:

```json
{
  "headless": true,
  "viewport": {"width": 1920, "height": 1080},
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "extraHTTPHeaders": {
    "Accept-Language": "zh-CN,zh;q=0.9"
  }
}
```

## Error Handling

### Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `command not found: agent-browser` | Not installed globally | `npm install -g agent-browser` |
| `TimeoutError` | Page load too slow | Increase `--delay` or `--timeout` |
| `Element not found` | Selector incorrect | Use `agent-browser evaluate` to inspect DOM |
| Screenshot < 50 KB | Page not loaded | Add delay, check network |
| `browser_console` returns null | Multi-line JS | Use single-line with semicolons |

### Diagnostic Script

```python
import subprocess

def diagnose_agent_browser():
    """Check if agent-browser is properly installed and working."""
    try:
        # Check version
        result = subprocess.run(
            ["agent-browser", "--version"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode != 0:
            return False, f"agent-browser error: {result.stderr}"
        
        # Test basic open
        test_result = subprocess.run(
            ["agent-browser", "open", "https://example.com"],
            capture_output=True, text=True, timeout=30
        )
        if test_result.returncode != 0:
            return False, f"agent-browser open failed: {test_result.stderr}"
        
        return True, f"agent-browser v{result.stdout.strip()} OK"
    except FileNotFoundError:
        return False, "agent-browser not found. Run: npm install -g agent-browser"
    except Exception as e:
        return False, f"Unexpected error: {e}"
```

## Best Practices

1. **Always add delays** after navigation: `time.sleep(3-5)` for dynamic content
2. **Verify element exists** before interacting: `document.querySelector('selector') !== null`
3. **Use CSS selectors** over XPath for simplicity
4. **Handle timeouts gracefully** — network can be slow
5. **Clean up** — close browser when done (auto-handled by agent-browser)
6. **Single-line JS** for `browser_console` / `agent-browser evaluate`
7. **Screenshot size validation** — < 200 KB usually means page not loaded

## Scripts

- `scripts/diagnose.py` — Diagnostic script to verify agent-browser installation and functionality

## References

- `references/playwright-api.md` — Playwright API documentation
- `references/selector-guide.md` — CSS selector best practices
- `references/error-handling.md` — Common errors and solutions

## Pitfalls

- **agent-browser must be installed globally** — local installs won't work with subprocess calls
- **browser_console multi-line JS returns null** — always use single-line expressions with semicolons
- **Dynamic content requires waits** — don't assume page is ready immediately after navigation
- **Viewport matters** — some sites behave differently on mobile vs desktop
- **Headless detection** — some sites block headless browsers; try `--headless false` if needed
