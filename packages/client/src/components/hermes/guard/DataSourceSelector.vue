<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NCard, NTag, NButton, NInput, useMessage } from 'naive-ui'
import { useDataSourcePlatformsStore } from '@/stores/hermes/dataSourcePlatforms'
import type { DataSourcePlatform } from '@/stores/hermes/dataSourcePlatforms'

const props = defineProps<{
  modelValue?: string[]  // 选中的平台 ID 列表
  prompt?: string  // 当前提示词
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
  'update:prompt': [value: string]
}>()

const store = useDataSourcePlatformsStore()
const message = useMessage()
const hasManualEdit = ref(false)  // 用户是否手动编辑过提示词

// 计算属性
const selectedPlatforms = computed(() => {
  return (props.modelValue || []).map(id => store.getPlatform(id)).filter(Boolean) as DataSourcePlatform[]
})

const availablePlatforms = computed(() => {
  return store.enabledPlatforms.value
})

const generatedPrompt = computed(() => {
  return selectedPlatforms.value
    .map(p => p.prompt)
    .filter(Boolean)
    .join('\n\n')
})

// 方法
function togglePlatform(platformId: string) {
  const current = props.modelValue || []
  const isSelected = current.includes(platformId)

  if (isSelected) {
    // 取消选中
    if (hasManualEdit.value) {
      message.info('提示词已手动修改，取消选中不会自动更新')
    }
    emit('update:modelValue', current.filter(id => id !== platformId))
  } else {
    // 选中
    emit('update:modelValue', [...current, platformId])
    // 自动填充提示词（只在首次选中时）
    if (!hasManualEdit.value) {
      const newPrompt = generatedPrompt.value
      if (newPrompt && newPrompt !== props.prompt) {
        emit('update:prompt', newPrompt)
      }
    }
  }
}

function isPlatformSelected(platformId: string) {
  return (props.modelValue || []).includes(platformId)
}

// 监听提示词变化，标记是否手动编辑
watch(() => props.prompt, (newVal, oldVal) => {
  if (newVal && oldVal && newVal !== oldVal && newVal !== generatedPrompt.value) {
    hasManualEdit.value = true
  }
})
</script>

<template>
  <div class="data-source-selector">
    <!-- 平台选择 -->
    <div class="platforms-section">
      <div class="section-header">
        <span class="section-title">数据源平台（多选）</span>
        <NButton type="default" size="small" @click="$router.push({ name: 'hermes.dataSourcePlatforms' })">
          管理平台
        </NButton>
      </div>

      <div class="platforms-grid">
        <NCard
          v-for="platform in availablePlatforms"
          :key="platform.id"
          :class="{
            'platform-card': true,
            'platform-card-selected': isPlatformSelected(platform.id),
            'platform-card-disabled': !platform.enabled
          }"
          @click="togglePlatform(platform.id)"
        >
          <div class="platform-info">
            <span class="platform-icon">{{ platform.icon }}</span>
            <span class="platform-name">{{ platform.name }}</span>
          </div>
          <div class="platform-meta">
            <span class="meta-item">{{ platform.level }}</span>
            <span class="meta-separator">·</span>
            <span class="meta-item">{{ platform.network }}</span>
          </div>
          <div class="platform-status">
            <NTag v-if="platform.enabled && platform.accounts.length > 0" type="success" size="small">已配置</NTag>
            <NTag v-else-if="platform.enabled" type="warning" size="small">未配置</NTag>
            <NTag v-else type="default" size="small">已禁用</NTag>
          </div>
          <div v-if="isPlatformSelected(platform.id)" class="selected-badge">✓</div>
        </NCard>
      </div>
    </div>

    <!-- 提示词 -->
    <div class="prompt-section">
      <div class="section-header">
        <span class="section-title">提示词</span>
        <span class="section-hint">选择平台后自动填充，可手动修改</span>
      </div>
      <NInput
        :value="props.prompt || ''"
        type="textarea"
        :rows="6"
        placeholder="选择数据源平台后，提示词将自动填充..."
        :maxlength="5000"
        show-count
        @update:value="(val) => { hasManualEdit = true; emit('update:prompt', val) }"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.data-source-selector {
  margin-top: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.section-hint {
  font-size: 12px;
  color: #999;
}

.platforms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.platform-card {
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  position: relative;

  &:hover {
    border-color: #1890ff;
    box-shadow: 0 2px 8px rgba(24, 144, 255, 0.1);
  }

  &.platform-card-selected {
    border-color: #1890ff;
    background: #e6f7ff;
  }

  &.platform-card-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.platform-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.platform-icon {
  font-size: 16px;
}

.platform-name {
  font-size: 13px;
  font-weight: 600;
}

.platform-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #999;
  margin-bottom: 8px;
}

.meta-item {
  white-space: nowrap;
}

.meta-separator {
  color: #ddd;
}

.platform-status {
  display: flex;
  justify-content: flex-end;
}

.selected-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #1890ff;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
}

.prompt-section {
  margin-top: 16px;
}
</style>