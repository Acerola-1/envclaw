# Playwright API 参考

## 核心概念

Playwright 是一个 Node.js 库，用于自动化 Chromium、Firefox 和 WebKit 浏览器。

## 主要类

### Browser

```javascript
const { chromium } = require('playwright');

// 启动浏览器
const browser = await chromium.launch({ headless: true });

// 新建上下文（隔离的浏览器会话）
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 }
});

// 新建页面
const page = await context.newPage();
```

### Page

```javascript
// 导航
await page.goto('https://example.com');

// 等待元素
await page.waitForSelector('.loading', { state: 'hidden' });

// 点击
await page.click('button#submit');

// 输入文本
await page.fill('input[name="username"]', 'myuser');

// 获取文本
const text = await page.textContent('.title');

// 截图
await page.screenshot({ path: 'screenshot.png', fullPage: true });

// 执行 JS
const result = await page.evaluate(() => {
  return document.title;
});
```

### Locator (推荐)

```javascript
// 现代方式 — 自动等待
const button = page.locator('button#submit');
await button.click();

// 链式选择
const item = page.locator('.list').locator('.item').first();
await item.click();

// 过滤
const active = page.locator('.item').filter({ hasText: 'Active' });
```

## 常用方法

| 方法 | 描述 |
|------|------|
| `page.goto(url)` | 导航到 URL |
| `page.click(selector)` | 点击元素 |
| `page.fill(selector, value)` | 填充输入框 |
| `page.selectOption(selector, value)` | 选择下拉选项 |
| `page.press(selector, key)` | 按键 |
| `page.screenshot(options)` | 截图 |
| `page.evaluate(fn)` | 执行 JS |
| `page.waitForSelector(selector)` | 等待元素出现 |
| `page.waitForNavigation()` | 等待导航完成 |
| `page.waitForLoadState(state)` | 等待加载状态 |

## 等待策略

```javascript
// 等待元素可见
await page.waitForSelector('.item', { state: 'visible' });

// 等待元素隐藏
await page.waitForSelector('.loading', { state: 'hidden' });

// 等待网络空闲
await page.waitForLoadState('networkidle');

// 自定义超时
await page.waitForSelector('.item', { timeout: 10000 });
```

## 设备模拟

```javascript
// 使用预定义设备
const iPhone = playwright.devices['iPhone 14'];
const context = await browser.newContext(iPhone);

// 常见设备
// 'iPhone 14', 'iPhone 14 Pro Max'
// 'Pixel 7', 'Pixel 7 Pro'
// 'iPad (gen 7)', 'iPad Pro 11'
```

## 处理弹窗

```javascript
// 监听对话框
page.on('dialog', async dialog => {
  await dialog.accept();
});

// 确认对话框
page.on('dialog', dialog => dialog.accept());

// 取消对话框
page.on('dialog', dialog => dialog.dismiss());
```

## 文件下载

```javascript
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.click('a#download')
]);
await download.saveAs('/path/to/save/' + download.suggestedFilename());
```

## 性能

```javascript
// 测量页面加载时间
const start = Date.now();
await page.goto('https://example.com');
const loadTime = Date.now() - start;

// 获取性能指标
const metrics = await page.evaluate(() =>
  JSON.stringify(window.performance.timing)
);
```
