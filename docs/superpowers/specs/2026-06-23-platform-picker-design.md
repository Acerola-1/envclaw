# CreateGuardTaskModal 推送平台选择器重设计

## Context

当前 CreateGuardTaskModal 的"推送平台"使用 NSelect 下拉框，仅包含 3 个选项（wechat/dingtalk/feishu）。用户希望参考 PlatformSettings.vue 中定义的全部平台，展示配置状态，并支持快速跳转编辑。

## Goals

- 展示所有 10 个平台（Telegram、Discord、Slack、WhatsApp、Matrix、Feishu、DingTalk、QQBot、Weixin、WeCom）
- 每个平台显示配置状态标签（已配置/未配置）
- hover 时右侧显示编辑按钮，点击跳转 `/hermes/channels`
- 保持单选模式

## Non-Goals

- 不在弹窗内编辑平台配置（跳转到 channels 页面）
- 不修改 PlatformSettings.vue 的平台列表定义
- 不改变提交数据格式（notifyPlatform 仍为 string）

## Design

### 数据来源

从 `useSettingsStore` 读取各平台配置状态。平台列表复用 PlatformSettings.vue 中的定义（key/name/icon）。

配置状态判断逻辑：
- `platforms[key]` 对象存在且包含有效凭证 → 已配置
- 否则 → 未配置

### UI 结构

```
推送平台
┌──────────────────────────────────────────────┐
│ ○ 📡 Telegram           [未配置]         ✏️ │
│ ○ 💬 Discord            [未配置]         ✏️ │
│ ○ 💼 Slack              [未配置]         ✏️ │
│ ○ 📱 WhatsApp           [未配置]         ✏️ │
│ ○ 🔗 Matrix             [未配置]         ✏️ │
│ ● 🐦 Feishu             [已配置] ✓       ✏️ │
│ ○ 🔷 DingTalk           [未配置]         ✏️ │
│ ○ 🐧 QQBot              [未配置]         ✏️ │
│ ○ 💚 Weixin             [未配置]         ✏️ │
│ ○ 🏢 WeCom              [未配置]         ✏️ │
└──────────────────────────────────────────────┘
```

### 交互

- 点击行选中（radio 单选）
- hover 行时右侧编辑按钮淡入显示
- 编辑按钮点击：`router.push({ name: 'hermes.channels' })`
- 已配置平台标签为绿色，未配置为灰色

### 组件方案

在 CreateGuardTaskModal.vue 内直接实现平台列表（不拆分子组件），因为：
- 仅此一处使用
- 代码量可控（~50 行模板 + ~30 行逻辑）
- 需要访问 settingsStore 和 router

### 修改文件

- `packages/client/src/components/hermes/guard/CreateGuardTaskModal.vue`
  - 导入 `useSettingsStore`、`useRouter`
  - 定义 platforms 数组（复用 PlatformSettings.vue 的 key/name/icon）
  - 替换 NSelect 为自定义平台列表
  - 添加平台列表样式
