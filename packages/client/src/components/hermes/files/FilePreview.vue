<script setup lang="ts">
import { computed, defineAsyncComponent, h, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { NAlert, NButton, NIcon, NSpin, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useFilesStore } from '@/stores/hermes/files'
import { getFileDownloadUrl } from '@/api/hermes/files'
import MarkdownRenderer from '@/components/hermes/chat/MarkdownRenderer.vue'
import { handleCodeBlockCopyClick, renderHighlightedCodeBlock } from '@/components/hermes/chat/highlight'

// Heavy renderers pull in large parsing libraries (pdfjs, docx-preview,
// pptx-renderer, read-excel-file); load them on demand so the Files view keeps
// a small initial bundle.
const HtmlFilePreview = defineAsyncComponent(async () => (await import('./HtmlFilePreview.vue')).default)
const PdfFilePreview = defineAsyncComponent(async () => (await import('./PdfFilePreview.vue')).default)
const DocxFilePreview = defineAsyncComponent(async () => (await import('./DocxFilePreview.vue')).default)
const PptxFilePreview = defineAsyncComponent(async () => (await import('./PptxFilePreview.vue')).default)
const SpreadsheetFilePreview = defineAsyncComponent(async () => (await import('./SpreadsheetFilePreview.vue')).default)

const { t } = useI18n()
const message = useMessage()
const filesStore = useFilesStore()

// Formats the store records without inline content: the preview component reads
// the raw bytes over the authenticated download endpoint on demand.
const BINARY_TYPES = new Set(['pdf', 'docx', 'presentation', 'spreadsheet'])

const loading = ref(false)
const previewError = ref('')
const previewBuffer = shallowRef<ArrayBuffer | null>(null)
let requestController: AbortController | null = null
let requestGeneration = 0

function resetLoadedBuffer(): void {
  if (requestController) {
    requestController.abort()
    requestController = null
  }
  previewBuffer.value = null
  previewError.value = ''
  loading.value = false
}

async function loadPreview(): Promise<void> {
  const previewFile = filesStore.previewFile
  requestGeneration += 1
  const generation = requestGeneration
  resetLoadedBuffer()
  if (!previewFile || !BINARY_TYPES.has(previewFile.type)) return

  loading.value = true
  const controller = new AbortController()
  requestController = controller
  try {
    const response = await fetch(getFileDownloadUrl(previewFile.path), {
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const buffer = await response.arrayBuffer()
    if (generation !== requestGeneration) return
    previewBuffer.value = buffer
  } catch (error) {
    if (generation !== requestGeneration || controller.signal.aborted) return
    previewError.value = error instanceof Error ? error.message : String(error)
  } finally {
    if (generation === requestGeneration) loading.value = false
  }
}

function handleRendererError(error: Error): void {
  previewError.value = error?.message || String(error)
}

function getImageUrl(): string {
  if (!filesStore.previewFile) return ''
  return getFileDownloadUrl(filesStore.previewFile.path)
}

const highlightedPreview = computed(() => {
  const previewFile = filesStore.previewFile
  if (!previewFile || previewFile.type !== 'text') return ''
  return renderHighlightedCodeBlock(previewFile.content || '', previewFile.language, t('common.copy'), {
    maxHighlightLength: 200_000,
  })
})

async function handlePreviewClick(event: MouseEvent) {
  const copyResult = await handleCodeBlockCopyClick(event)
  if (copyResult) {
    message.success(t('common.copied'))
  } else if (copyResult === false) {
    message.error(t('chat.copyFailed'))
  }
}

const CloseIcon = () =>
  h(
    'svg',
    { viewBox: '0 0 24 24', width: '14', height: '14', fill: 'currentColor' },
    [h('path', { d: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z' })],
  )

watch(() => filesStore.previewFile, () => { void loadPreview() }, { immediate: true })
onBeforeUnmount(() => {
  requestGeneration += 1
  resetLoadedBuffer()
})
</script>

<template>
  <div class="file-preview" v-if="filesStore.previewFile">
    <div class="preview-header">
      <span class="preview-filename">{{ filesStore.previewFile.path }}</span>
      <NButton size="small" quaternary @click="filesStore.closePreview()">
        <template #icon>
          <NIcon><CloseIcon /></NIcon>
        </template>
        {{ t('files.closePreview') }}
      </NButton>
    </div>
    <div class="preview-content">
      <NSpin v-if="loading" :description="t('files.previewLoading')" />
      <NAlert v-else-if="previewError" type="error" class="preview-error">
        <template #header>{{ t('files.previewFailed') }}</template>
        <div class="preview-error-message">{{ previewError }}</div>
      </NAlert>
      <img
        v-else-if="filesStore.previewFile.type === 'image'"
        :src="getImageUrl()"
        class="preview-image"
        :alt="filesStore.previewFile.path"
      />
      <div v-else-if="filesStore.previewFile.type === 'markdown'" class="preview-markdown">
        <MarkdownRenderer :content="filesStore.previewFile.content || ''" />
      </div>
      <div
        v-else-if="filesStore.previewFile.type === 'text'"
        class="preview-code"
        v-html="highlightedPreview"
        @click="handlePreviewClick"
      />
      <HtmlFilePreview
        v-else-if="filesStore.previewFile.type === 'html'"
        :content="filesStore.previewFile.content || ''"
      />
      <PdfFilePreview
        v-else-if="filesStore.previewFile.type === 'pdf' && previewBuffer"
        :data="previewBuffer"
        @error="handleRendererError"
      />
      <DocxFilePreview
        v-else-if="filesStore.previewFile.type === 'docx' && previewBuffer"
        :data="previewBuffer"
        @error="handleRendererError"
      />
      <PptxFilePreview
        v-else-if="filesStore.previewFile.type === 'presentation' && previewBuffer"
        :data="previewBuffer"
        @error="handleRendererError"
      />
      <SpreadsheetFilePreview
        v-else-if="filesStore.previewFile.type === 'spreadsheet' && previewBuffer"
        kind="spreadsheet"
        :data="previewBuffer"
        @error="handleRendererError"
      />
      <SpreadsheetFilePreview
        v-else-if="filesStore.previewFile.type === 'csv'"
        kind="csv"
        :source="filesStore.previewFile.content || ''"
        @error="handleRendererError"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.file-preview {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid $border-color;
}

.preview-filename {
  font-size: 13px;
  color: $text-secondary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-content {
  flex: 1;
  overflow: auto;
  padding: 16px;
  display: flex;
  justify-content: center;
  min-height: 0;
}

.preview-error {
  width: min(680px, 100%);
  align-self: flex-start;
}

.preview-error-message {
  overflow-wrap: anywhere;
}

.preview-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.preview-markdown {
  max-width: 800px;
  width: 100%;
}

.preview-code {
  width: 100%;

  :deep(.hljs-code-block) {
    margin: 0;
  }
}
</style>
