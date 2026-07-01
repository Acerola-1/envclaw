# CSS 选择器最佳实践

## 基础选择器

```css
/* 元素选择器 */
div
p
span

/* ID 选择器 */
#unique-element

/* 类选择器 */
.class-name

/* 属性选择器 */
input[type="text"]
button[type="submit"]
[data-id="123"]
```

## 组合选择器

```css
/* 后代选择器 */
.parent .child

/* 子元素选择器 */
.parent > .direct-child

/* 相邻兄弟 */
.element + .next-sibling

/* 通用兄弟 */
.element ~ .all-siblings

/* 多条件 */
button.primary.large
```

## 伪类选择器

```css
/* 状态 */
:hover
:focus
:active
:disabled
:checked

/* 位置 */
:first-child
:last-child
:nth-child(2)
:nth-of-type(odd)

/* 内容 */
:empty
:not(.exclude)
:has(.child)
```

## 实用技巧

### 文本内容匹配

```javascript
// 通过文本查找（Playwright 特有）
page.locator('text=Submit')
page.locator('text=/Submit/i')  // 不区分大小写

// 部分匹配
page.locator('text=Sub')
```

### 复杂条件

```javascript
// 同时满足多个条件
page.locator('button[type="submit"].primary:visible')

// 排除特定元素
page.locator('.item:not(.disabled)')

// 包含特定子元素
page.locator('.card:has(.title)')
```

### 层级定位

```javascript
// 表格中特定行
page.locator('table tr:nth-child(3) td:first-child')

// 列表中特定项
page.locator('.list > .item:nth-child(2)')

// 表单中特定字段
page.locator('form#login input[name="password"]')
```

## 常见反模式

```css
/* ❌ 避免过于具体 */
body > div.container > div.row > div.col > button.btn

/* ✅ 使用更简洁的选择器 */
.container button.btn

/* ❌ 避免依赖 DOM 结构 */
table tr td:nth-child(3) div span

/* ✅ 使用语义化类名 */
.product-price

/* ❌ 避免使用动态生成的 ID */
#id-12345-abc

/* ✅ 使用属性或类 */
[data-product-id="12345"]
```

## 调试技巧

```javascript
// 在浏览器控制台测试选择器
document.querySelectorAll('.my-class')

// 检查元素数量
document.querySelectorAll('.item').length

// 检查元素是否存在
document.querySelector('.target') !== null

// 获取元素文本
document.querySelector('.title')?.textContent

// 获取元素属性
document.querySelector('img')?.getAttribute('src')
```

## 稳定性建议

1. **优先使用语义化类名** — 比 DOM 结构更稳定
2. **避免使用自动生成的 ID** — 每次加载可能不同
3. **使用 data-* 属性** — 专门为测试添加的标记
4. **避免依赖顺序** — `:nth-child` 在内容变化时会失效
5. **使用 `hasText` 辅助** — 结合文本内容更可靠
