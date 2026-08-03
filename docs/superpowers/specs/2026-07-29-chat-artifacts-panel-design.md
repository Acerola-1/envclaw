# 对话产物面板设计

## 概述

在对话界面（ChatPanel）底部增加"查看所有产物 (N)"入口，点击后在右侧滑出产物面板，按消息分组展示当前会话中所有 `MEDIA:` 语法标注的截图/文件资源，支持预览和下载。

## 现状

- `MEDIA:C:/path/to/file.png` 语法由后端 `extract_media()` 正则提取后从正文中移除，作为平台附件投递
- Hermes Web UI 中 MEDIA 内容未在前端收集展示，markdown 中可能保留原始 MEDIA 文本
- ChatPanel 右侧已有 `toolPanel`（360-560px）和 `OutlinePanel`（280px）的切换逻辑可参考
- MessageItem 已有图片全屏预览（`previewUrl` + Teleport overlay）可复用

## 设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 产物范围 | 按会话汇总 | 用户明确要求方案B |
| 面板位置 | 右侧滑出 | 与现有 OutlinePanel 一致 |
| MEDIA 原文 | 保留不处理 | markdown 中保持原样 |
| 产物排序 | 按消息分组 | 用户明确要求方案A |
| 解析位置 | ChatPanel composable | 逻辑内聚，不膨胀 store |

## 架构

### 新增文件

```
packages/client/src/composables/useArtifacts.ts        # MEDIA 解析 composable
packages/client/src/components/hermes/chat/ArtifactsPanel.vue  # 产物面板组件
```

### 修改文件

```
packages/client/src/components/hermes/chat/ChatPanel.vue  # 集成面板 + 底部入口
```

## 模块设计

### 1. useArtifacts composable

从 session 消息中提取 MEDIA 资源，按消息分组。

**接口：**

```ts
// 单个产物文件
interface Artifact {
  path: string        // 原始路径，如 C:/Users/.../screenshot.png
  name: string        // 文件名
  type: 'image' | 'file' | 'other'  // 根据扩展名判定
  extension: string   // 后缀名，如 .png
}

// 按消息分组
interface ArtifactGroup {
  messageId: string
  messageRole: 'assistant' | 'user' | 'system'
  messagePreview: string  // 正文前 50 字
  timestamp: number
  artifacts: Artifact[]
}

function useArtifacts(messages: Ref<Message[]>): ComputedRef<ArtifactGroup[]>
```

**解析规则：**

- 正则匹配 `MEDIA:(?:`[^`]+`|"[^"]+"|'[^']+'|[^\s,;)\]}]+\.[a-zA-Z0-9]+)`，支持：
  - 反引号/引号包裹的路径 `` MEDIA:`C:/path/to/file.png` ``
  - 无包裹的路径 `MEDIA:C:/path/to/file.png`
  - Windows 绝对路径和 Unix 路径
- 仅从 `role === 'assistant'` 的消息中提取（MEDIA 由 AI 生成）
- 排除 `isStreaming === true` 的消息（内容尚未完整）
- 图片类型扩展名：`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.bmp`, `.ico`
- 文件类型扩展名：`.pdf`, `.docx`, `.txt`, `.md`, `.xlsx`, `.csv`, `.pptx`, `.zip`, `.tar`, `.7z`, `.rar`, `.html`, `.htm`, `.mp4`, `.mov`, `.mp3`, `.wav`
- 其余归为 `other`

### 2. ArtifactsPanel 组件

**Props：**

```ts
interface Props {
  groups: ArtifactGroup[]
  visible: boolean
}
```

**Emits：**

```ts
interface Emits {
  (e: 'close'): void
  (e: 'preview', artifact: Artifact): void
  (e: 'download', artifact: Artifact): void
  (e: 'scrollToMessage', messageId: string): void
}
```

**布局（~360px 宽）：**

```
┌─────────────────────────────┐
│ 产物列表 (3)            [✕] │  ← 头部：标题 + 总数 + 关闭
├─────────────────────────────┤
│ 📋 AI 回复 · 06-25 13:36   │  ← 消息分组
│   🖼 screenshot_1.png  png │  ← 点击可预览
│   🖼 screenshot_2.png  png │
├─────────────────────────────┤
│ 📋 AI 回复 · 06-25 13:35   │
│   📄 report.pdf       pdf  │  ← 点击可下载
└─────────────────────────────┘
```

**交互：**
- 点击图片项 → emit `preview`，由 ChatPanel 处理全屏预览
- 点击文件项 → emit `download`，调用 `downloadFile`
- 点击消息摘要 → emit `scrollToMessage`，滚动到对应消息
- 点击关闭按钮 / 遮罩 → emit `close`

### 3. 底部入口栏

位于 ChatInput 上方、消息列表下方，固定栏样式：

```
┌──────────────────────────────────────┐
│  📦 查看所有产物 (3)              ▸ │  ← 仅 artifactCount > 0 时显示
└──────────────────────────────────────┘
```

- 左对齐，背景色与消息气泡协调
- 箭头图标提示展开方向
- 点击切换 `showArtifactsPanel`

### 4. ChatPanel 集成

在 ChatPanel `<script setup>` 中：

```ts
import { useArtifacts } from '@/composables/useArtifacts'
import ArtifactsPanel from './ArtifactsPanel.vue'

const showArtifactsPanel = ref(false)
const messagesRef = computed(() => activeSession.value?.messages ?? [])
const { groups: artifactGroups } = useArtifacts(messagesRef)
const artifactCount = computed(() =>
  artifactGroups.value.reduce((sum, g) => sum + g.artifacts.length, 0)
)

// 与 outline panel 互斥
watch(showArtifactsPanel, (v) => { if (v) showOutline.value = false })
watch(showOutline, (v) => { if (v) showArtifactsPanel.value = false })
```

模板中增加：
- `<ArtifactsPanel>` 组件在 `chat-content-wrapper` 内
- 入口栏在 ChatInput 上方

### 5. 图片预览

在 ArtifactsPanel 内部自建 preview overlay（与 MessageItem 模式相同：`previewUrl` ref + `<Teleport to="body">` 全屏 overlay），不依赖 ChatPanel 中转。点击图片项时调用 `getDownloadUrl(item.path, item.name)` 获取可访问 URL，赋值给 `previewUrl` 展示全屏预览。

### 6. 消息跳转

点击消息摘要时，通过 `document.getElementById(`message-${messageId}`)` 定位 DOM 元素，调用其 `scrollIntoView({ behavior: 'smooth', block: 'center' })` 实现平滑滚动。MessageItem 模板中已有 `:id="`message-${message.id}`"` 锚点。

### 7. 下载

复用 `downloadFile` from `@/api/hermes/download`。ArtifactsPanel 内部直接调用 `downloadFile(artifact.path, artifact.name)`，下载结果通过 toast 反馈（MessageItem 已有相同模式可参考）。

## 边界与错误处理

- **空状态**：无产物时不显示入口栏，面板不渲染
- **路径失效**：下载/预览前通过 `getDownloadUrl` 转换本地路径；若文件不存在，后端返回 404，前端 toast 提示
- **超大产物列表**：面板内滚动，不做虚拟化（产物数量通常不会超过几十个）
- **流式消息**：`isStreaming` 的消息不解析 MEDIA（内容尚未完整）

## 验收标准

1. 包含 MEDIA 标签的历史会话底部出现"查看所有产物"入口
2. 点击入口右侧滑出产物面板，按消息分组展示
3. 点击图片项可全屏预览
4. 点击文件项可触发下载
5. 点击消息摘要可跳转到对应消息
6. 产物面板与大纲面板互斥
7. 无产物会话不显示入口
8. markdown 正文中 MEDIA 原文保持不变
