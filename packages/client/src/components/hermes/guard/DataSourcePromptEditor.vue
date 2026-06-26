<script setup lang="ts">
import { ref, computed } from 'vue'
import { NInput, NButton, NTag, useMessage } from 'naive-ui'
import { useDataSourcePlatformsStore } from '@/stores/hermes/dataSourcePlatforms'
import type { DataSourcePlatform } from '@/stores/hermes/dataSourcePlatforms'

const props = defineProps<{
  platform: DataSourcePlatform
}>()

const emit = defineEmits<{
  update: [prompt: string]
}>()

const store = useDataSourcePlatformsStore()
const message = useMessage()
const isEditing = ref(false)
const editingPrompt = ref('')
const loading = ref(false)

// 计算属性
const hasPrompt = computed(() => props.platform.prompt.trim().length > 0)

// 方法
function handleStartEdit() {
  isEditing.value = true
  editingPrompt.value = props.platform.prompt
}

function handleSave() {
  if (!editingPrompt.value.trim()) {
    message.warning('提示词不能为空')
    return
  }

  loading.value = true
  try {
    emit('update', editingPrompt.value)
    isEditing.value = false
  } catch (err) {
    message.error('保存失败')
  } finally {
    loading.value = false
  }
}

function handleCancel() {
  isEditing.value = false
  editingPrompt.value = ''
}

function handleDoubleClick() {
  if (!isEditing.value) {
    handleStartEdit()
  }
}
</script>

<template>
  <div class="prompt-editor">
    <!-- 查看模式 -->
    <div v-if="!isEditing" class="prompt-view" @dblclick="handleDoubleClick">
      <div class="prompt-header">
        <span class="prompt-title">平台提示词</span>
        <NButton type="default" size="small" @click="handleStartEdit">编辑</NButton>
      </div>
      <div class="prompt-content">
        <div v-if="hasPrompt" class="prompt-text">{{ platform.prompt }}</div>
        <div v-else class="prompt-empty">暂无提示词，双击或点击编辑按钮添加</div>
      </div>
    </div>

    <!-- 编辑模式 -->
    <div v-else class="prompt-edit">
      <div class="prompt-header">
        <span class="prompt-title">平台提示词</span>
        <div class="prompt-actions">
          <NButton type="default" size="small" @click="handleCancel">取消</NButton>
          <NButton type="primary" size="small" :loading="loading" @click="handleSave">保存</NButton>
        </div>
      </div>
      <NInput
        v-model:value="editingPrompt"
        type="textarea"
        :rows="4"
        placeholder="请输入平台提示词，描述该平台的特性和使用注意事项..."
        :maxlength="1000"
        show-count
      />
      <div class="prompt-hint">
        <span class="hint-text">提示：此提示词将作为平台上下文，在创建任务选择该平台时自动填充到任务提示词中。</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.prompt-editor {
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  padding: 12px;
  background: #fafafa;
}

.prompt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.prompt-title {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.prompt-actions {
  display: flex;
  gap: 4px;
}

.prompt-content {
  padding: 8px 12px;
  background: #fff;
  border-radius: 4px;
  border: 1px solid #e8e8e8;
  min-height: 60px;
  cursor: pointer;
  transition: border-color 0.2s;

  &:hover {
    border-color: #1890ff;
  }
}

.prompt-text {
  font-size: 13px;
  line-height: 1.6;
  color: #333;
  white-space: pre-wrap;
  word-break: break-word;
}

.prompt-empty {
  font-size: 13px;
  color: #999;
  text-align: center;
  padding: 12px 0;
}

.prompt-edit {
  padding-top: 4px;
}

.prompt-hint {
  margin-top: 8px;
  padding: 8px 12px;
  background: #f6ffed;
  border-radius: 4px;
  border: 1px solid #b7eb8f;
}

.hint-text {
  font-size: 12px;
  color: #52c41a;
}
</style>