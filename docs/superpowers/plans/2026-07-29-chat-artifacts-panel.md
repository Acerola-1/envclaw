# 对话产物面板 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在对话界面底部增加"查看所有产物 (N)"入口，点击后右侧滑出产物面板按消息分组展示 MEDIA 资源。

**Architecture:** 新增 `useArtifacts` composable 从消息中解析 MEDIA 路径并按消息分组，新增 `ArtifactsPanel.vue` 组件渲染右侧面板，在 `ChatPanel.vue` 中集成两者并添加底部入口栏。

**Tech Stack:** Vue 3 + TypeScript + SCSS, Pinia store (chat), markdown-it (解析 MEDIA 正则)

## Global Constraints

- MEDIA 原文在 markdown 中保留不处理
- 仅从 `role === 'assistant'` 消息中提取
- 产物面板与大纲面板互斥（同时只开一个）
- 面板宽度 360px，与现有 ToolPanel 最小值一致
- 不在 store 中新增状态，解析逻辑用 computed

---

### Task 1: useArtifacts composable

**Files:**
- Create: `packages/client/src/composables/useArtifacts.ts`

**Interfaces:**
- Consumes: `Message` type from `@/stores/hermes/chat` (role, content, id, timestamp, isStreaming 字段)
- Produces: `useArtifacts(messages)` → `{ groups: ComputedRef<ArtifactGroup[]> }`, 以及导出的 `Artifact` 和 `ArtifactGroup` 接口

- [ ] **Step 1: 创建 composable 文件**

```ts
// packages/client/src/composables/useArtifacts.ts
import { computed, type Ref, type ComputedRef } from "vue";

export interface Artifact {
  path: string;
  name: string;
  type: "image" | "file" | "other";
  extension: string;
}

export interface ArtifactGroup {
  messageId: string;
  messageRole: string;
  messagePreview: string;
  timestamp: number;
  artifacts: Artifact[];
}

interface MinimalMessage {
  id: string;
  role: string;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

const MEDIA_RE = /MEDIA:(`[^`\n]+`|"[^"\n]+"|'[^'\n]+'|(?:[A-Za-z]:[\\/]|\/)[^\s,;)\]}:>]+\.\w+)/gi;

const IMAGE_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico",
]);

const FILE_EXTS = new Set([
  ".pdf", ".docx", ".doc", ".txt", ".md", ".xlsx", ".xls", ".csv",
  ".pptx", ".ppt", ".zip", ".tar", ".gz", ".7z", ".rar",
  ".html", ".htm", ".mp4", ".mov", ".mkv", ".webm",
  ".mp3", ".wav", ".ogg", ".opus", ".m4a", ".flac", ".epub",
]);

function getType(ext: string): "image" | "file" | "other" {
  if (IMAGE_EXTS.has(ext)) return "image";
  if (FILE_EXTS.has(ext)) return "file";
  return "other";
}

function extractName(path: string): string {
  const cleaned = path.replace(/^[`"']|[`"']$/g, "");
  const segments = cleaned.replace(/\\/g, "/").split("/");
  return segments[segments.length - 1] || cleaned;
}

function extractExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

function extractPath(raw: string): string {
  // 去掉包围的引号/反引号
  return raw.replace(/^[`"']|[`"']$/g, "");
}

function parseArtifacts(content: string): Artifact[] {
  const seen = new Set<string>();
  const artifacts: Artifact[] = [];
  MEDIA_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = MEDIA_RE.exec(content)) !== null) {
    const fullMatch = match[0];
    // 提取 MEDIA: 后的路径部分，用捕获组或手动切掉前缀
    const raw = fullMatch.slice(6); // 切掉 "MEDIA:"
    const path = extractPath(raw);
    const name = extractName(path);
    const extension = extractExtension(name);

    if (!extension) continue;
    if (seen.has(path)) continue;
    seen.add(path);

    artifacts.push({ path, name, type: getType(extension), extension });
  }

  return artifacts;
}

function stripThinkingTags(content: string): string {
  // 摘掉 <think>...</think> 块再解析 MEDIA，避免把示例文本当产物
  return content.replace(/<think[\s\S]*?<\/think>/gi, "");
}

function makePreview(content: string, maxLen = 50): string {
  // 取正文前 maxLen 个字符，合并空白
  const body = stripThinkingTags(content)
    .replace(/MEDIA:[^\n]*/g, "") // 移除 MEDIA 标签本身
    .replace(/\s+/g, " ")
    .trim();
  return body.length > maxLen ? body.slice(0, maxLen) + "…" : body;
}

export function useArtifacts(
  messages: Ref<MinimalMessage[]>,
): { groups: ComputedRef<ArtifactGroup[]> } {
  const groups = computed<ArtifactGroup[]>(() => {
    return (messages.value ?? [])
      .filter((m) => m.role === "assistant" && !m.isStreaming)
      .map((m) => {
        const artifacts = parseArtifacts(m.content || "");
        if (artifacts.length === 0) return null;
        return {
          messageId: m.id,
          messageRole: m.role,
          messagePreview: makePreview(m.content || ""),
          timestamp: m.timestamp,
          artifacts,
        } satisfies ArtifactGroup;
      })
      .filter((g): g is ArtifactGroup => g !== null);
  });

  return { groups };
}
```

- [ ] **Step 2: 验证 composable 可被导入**

运行: `cd packages/client && npx vue-tsc --noEmit src/composables/useArtifacts.ts`

预期: 无类型错误（可能有项目级既有错误，忽略即可）。

- [ ] **Step 3: 提交**

```bash
git add packages/client/src/composables/useArtifacts.ts
git commit -m "feat: add useArtifacts composable for MEDIA extraction

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: ArtifactsPanel 组件

**Files:**
- Create: `packages/client/src/components/hermes/chat/ArtifactsPanel.vue`

**Interfaces:**
- Consumes: `ArtifactGroup`, `Artifact` from `@/composables/useArtifacts`; `downloadFile`, `getDownloadUrl` from `@/api/hermes/download`; `formatChatTimestamp` from `@/utils/chat-timestamp`
- Produces: `<ArtifactsPanel>` 组件 — Props `{ groups, visible }`, Emits `{ close, scrollToMessage }`

- [ ] **Step 1: 创建组件文件**

```vue
<!-- packages/client/src/components/hermes/chat/ArtifactsPanel.vue -->
<script setup lang="ts">
import type { Artifact, ArtifactGroup } from "@/composables/useArtifacts";
import { downloadFile, getDownloadUrl } from "@/api/hermes/download";
import { formatChatTimestamp } from "@/utils/chat-timestamp";
import { computed, ref } from "vue";
import { useMessage } from "naive-ui";

const props = defineProps<{
  groups: ArtifactGroup[];
  visible: boolean;
}>();

const emit = defineEmits<{
  close: [];
  scrollToMessage: [messageId: string];
}>();

const toast = useMessage();
const previewUrl = ref<string | null>(null);

const totalCount = computed(() =>
  props.groups.reduce((s, g) => s + g.artifacts.length, 0),
);

function getUrl(item: Artifact): string {
  return getDownloadUrl(item.path, item.name);
}

function handlePreview(item: Artifact) {
  previewUrl.value = getUrl(item);
}

function handleDownload(item: Artifact) {
  toast.info("下载中…");
  downloadFile(item.path, item.name).catch((err: Error) => {
    toast.error(err.message || "下载失败");
  });
}

function handleScrollToMessage(messageId: string) {
  emit("scrollToMessage", messageId);
}

function handleOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    previewUrl.value = null;
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") previewUrl.value = null;
}

function getIcon(item: Artifact): string {
  return item.type === "image" ? "🖼" : "📄";
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="previewUrl"
      class="artifact-preview-overlay"
      @click="handleOverlayClick"
      @keydown="handleKeydown"
    >
      <img :src="previewUrl" class="artifact-preview-img" />
    </div>
  </Teleport>

  <aside v-if="visible" class="artifacts-panel">
    <div class="artifacts-header">
      <span class="artifacts-title">产物列表 ({{ totalCount }})</span>
      <button class="artifacts-close-btn" @click="emit('close')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
    <div class="artifacts-content">
      <template v-if="groups.length > 0">
        <div
          v-for="group in groups"
          :key="group.messageId"
          class="artifact-group"
        >
          <button
            class="artifact-group-header"
            @click="handleScrollToMessage(group.messageId)"
          >
            <span class="artifact-group-icon">📋</span>
            <span class="artifact-group-label">AI 回复</span>
            <span class="artifact-group-time">{{ formatChatTimestamp(group.timestamp) }}</span>
          </button>
          <div class="artifact-items">
            <div
              v-for="item in group.artifacts"
              :key="item.path"
              class="artifact-item"
              :class="{ clickable: item.type === 'image' }"
              @click="item.type === 'image' ? handlePreview(item) : handleDownload(item)"
            >
              <span class="artifact-item-icon">{{ getIcon(item) }}</span>
              <span class="artifact-item-name">{{ item.name }}</span>
              <span class="artifact-item-ext">{{ item.extension }}</span>
            </div>
          </div>
        </div>
      </template>
      <div v-else class="artifacts-empty">暂无产物</div>
    </div>
  </aside>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.artifacts-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: $bg-card;
  border-left: 1px solid $border-color;
  width: 360px;
  flex-shrink: 0;
  overflow: hidden;

  @media (max-width: $breakpoint-mobile) {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(360px, 86vw);
    z-index: 8;
    box-shadow: -4px 0 16px rgba(0, 0, 0, 0.12);
  }
}

.artifacts-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid $border-color;
  flex-shrink: 0;
}

.artifacts-title {
  font-size: 13px;
  font-weight: 600;
  color: $text-primary;
}

.artifacts-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: $text-muted;
  cursor: pointer;
  border-radius: $radius-sm;
  padding: 0;

  &:hover {
    color: $text-secondary;
    background: rgba(0, 0, 0, 0.06);
  }
}

.artifacts-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.artifact-group {
  margin-bottom: 4px;
}

.artifact-group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 14px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  color: $text-secondary;

  &:hover {
    background: rgba(0, 0, 0, 0.03);
  }
}

.artifact-group-icon {
  flex-shrink: 0;
  font-size: 12px;
}

.artifact-group-label {
  flex-shrink: 0;
  font-weight: 500;
}

.artifact-group-time {
  color: $text-muted;
}

.artifact-items {
  // 缩进在分组下方
}

.artifact-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px 6px 32px;
  font-size: 12px;
  color: $text-primary;
  cursor: pointer;
  border-radius: 0;

  &:hover {
    background: rgba(0, 0, 0, 0.04);
  }
}

.artifact-item-icon {
  flex-shrink: 0;
  font-size: 14px;
}

.artifact-item-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artifact-item-ext {
  flex-shrink: 0;
  font-size: 10px;
  color: $text-muted;
  background: rgba(0, 0, 0, 0.04);
  padding: 1px 5px;
  border-radius: 4px;
  text-transform: uppercase;
}

.artifacts-empty {
  padding: 32px 14px;
  text-align: center;
  font-size: 13px;
  color: $text-muted;
}

.artifact-preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.artifact-preview-img {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 4px;
}
</style>
```

- [ ] **Step 2: 验证组件文件语法**

运行: `cd packages/client && npx vue-tsc --noEmit src/components/hermes/chat/ArtifactsPanel.vue`

预期: 无类型错误。

- [ ] **Step 3: 提交**

```bash
git add packages/client/src/components/hermes/chat/ArtifactsPanel.vue
git commit -m "feat: add ArtifactsPanel component for media artifact display

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: ChatPanel 集成

**Files:**
- Modify: `packages/client/src/components/hermes/chat/ChatPanel.vue`

**Interfaces:**
- Consumes: `useArtifacts` from `@/composables/useArtifacts`, `ArtifactsPanel` from `./ArtifactsPanel.vue`
- Change: 在 `chat-main-content` 内部 MessageList 与 ChatInput 之间增加入口栏，在 `chat-content-wrapper` 内增加 ArtifactsPanel，与 showOutline 互斥

- [ ] **Step 1: 在 ChatPanel.vue script 中添加 imports、状态和 computed**

找到 import 区域（约 28-36 行），在现有 import 后添加：

```ts
import { useArtifacts } from "@/composables/useArtifacts";
import ArtifactsPanel from "./ArtifactsPanel.vue";
```

找到 `showOutline` ref 声明（约 63 行），在附近添加：

```ts
const showArtifactsPanel = ref(false);
```

在 `showOutline` 声明之后，添加互斥 watch，找到 `handleOutlineNavigate` 函数附近（约 217 行），在该函数之后添加：

```ts
// 产物面板与大纲面板互斥
watch(showArtifactsPanel, (v) => {
  if (v) showOutline.value = false;
});
watch(showOutline, (v) => {
  if (v) showArtifactsPanel.value = false;
});
```

确认 `watch` 已在文件顶部 import 的 vue 解构中存在。查找 `import {` 行（约第 5 行），确认 `watch` 在列表中；若不在则追加。

找到 script 中 chatInputRef 之后或 computed 区域，添加产物数据：

```ts
const allMessages = computed(() => activeSession.value?.messages ?? []);
const { groups: artifactGroups } = useArtifacts(allMessages);
const artifactCount = computed(() =>
  artifactGroups.value.reduce((sum, g) => sum + g.artifacts.length, 0),
);
```

- [ ] **Step 2: 在模板中增加入口栏**

找到 `chat-main-content` 内的 MessageList 与 ChatInput 之间（约 1766-1767 行）：

当前：
```html
<MessageList ref="messageListRef" />
<ChatInput ref="chatInputRef" />
```

改为：
```html
<MessageList ref="messageListRef" />
<div
  v-if="artifactCount > 0 && !showArtifactsPanel"
  class="artifact-entry-bar"
  @click="showArtifactsPanel = true"
>
  <span class="artifact-entry-label">查看所有产物 ({{ artifactCount }})</span>
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="9 18 15 12 9 6" />
  </svg>
</div>
<ChatInput ref="chatInputRef" />
```

- [ ] **Step 3: 在模板中增加 ArtifactsPanel**

找到 `chat-content-wrapper` 内 OutlinePanel 和 tool panel 所在区域（约 1769-1790 行），在 `</aside>` (tool panel) 之后，`</template>` 之前添加：

```html
<ArtifactsPanel
  v-if="showArtifactsPanel"
  :groups="artifactGroups"
  @close="showArtifactsPanel = false"
  @scroll-to-message="handleArtifactScrollToMessage"
/>
```

- [ ] **Step 4: 添加滚动到消息的处理函数**

在 script 中 `handleOutlineNavigate` 函数之后添加：

```ts
function handleArtifactScrollToMessage(messageId: string) {
  const el = document.getElementById(`message-${messageId}`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  if (isMobile.value) showArtifactsPanel.value = false;
}
```

- [ ] **Step 5: 添加入口栏样式**

在 `<style scoped lang="scss">` 中，找到 `chat-main-content` 样式块附近（约 2773-2795 行），在该块之后添加：

```scss
.artifact-entry-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  margin: 0 12px 2px;
  border-radius: $radius-sm;
  background: rgba(var(--accent-primary-rgb), 0.06);
  border: 1px solid rgba(var(--accent-primary-rgb), 0.12);
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(var(--accent-primary-rgb), 0.1);
  }
}

.artifact-entry-label {
  font-size: 12px;
  color: $accent-primary;
  font-weight: 500;
}
```

- [ ] **Step 6: 编译验证**

运行: `cd packages/client && npx vue-tsc --noEmit --project tsconfig.json 2>&1 | head -40`

预期: 无新增类型错误（项目既有错误允许存在）。

- [ ] **Step 7: 浏览器验证**

启动 dev server: `cd packages/client && npm run dev`

验证步骤:
1. 打开包含 MEDIA 文本的历史会话
2. 确认底部出现"查看所有产物 (N)"入口栏
3. 点击入口栏 → 右侧滑出产物面板
4. 点击图片项 → 全屏预览
5. 点击文件项 → 触发下载
6. 点击消息摘要 → 跳转到对应消息
7. 点击关闭按钮 → 面板关闭
8. 打开大纲面板 → 产物面板自动关闭
9. 无 MEDIA 的会话 → 不显示入口栏

- [ ] **Step 8: 提交**

```bash
git add packages/client/src/components/hermes/chat/ChatPanel.vue
git commit -m "feat: integrate artifacts panel into chat view

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

