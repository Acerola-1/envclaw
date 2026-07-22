## ADDED Requirements

### Requirement: i18n lazy loading
语言包 SHALL 按需懒加载，不随主 bundle 一起打包，减少首屏加载体积。

#### Scenario: Initial page load
- **WHEN** 用户首次访问页面
- **THEN** 系统 SHALL 只加载当前语言包，不加载其他语言

#### Scenario: Switch language
- **WHEN** 用户切换界面语言
- **THEN** 系统 SHALL 懒加载目标语言包并切换

### Requirement: Component async loading
非首屏必需的组件 SHALL 使用 `defineAsyncComponent` 异步加载，减少首屏 JS 体积。

#### Scenario: Heavy components load on demand
- **WHEN** 用户首次访问页面
- **THEN** MarkdownRenderer、FilePreview、SkillDetail 等非首屏组件 SHALL 不包含在初始 bundle 中，按需异步加载

### Requirement: Static asset caching
服务端 SHALL 对静态资源设置合理的缓存头（Cache-Control），减少重复请求。

#### Scenario: Static assets cached by browser
- **WHEN** 浏览器请求静态资源（JS/CSS/图片）
- **THEN** 服务端 SHALL 返回 Cache-Control 头，允许浏览器缓存
