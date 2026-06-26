<script setup lang="ts">
import { computed, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSelect } from 'naive-ui'
import { useSettingsStore } from '@/stores/hermes/settings'

const { t } = useI18n()
const settingsStore = useSettingsStore()

// 推送平台列表
const platformList = [
  { key: 'origin', name: '原始会话', icon: '💬' },
  { key: 'local', name: '本地', icon: '🖥️' },
  { key: 'telegram', name: 'Telegram', icon: '✈️' },
  { key: 'discord', name: 'Discord', icon: '💬' },
  { key: 'slack', name: 'Slack', icon: '💼' },
  { key: 'whatsapp', name: 'WhatsApp', icon: '📱' },
  { key: 'matrix', name: 'Matrix', icon: '🔗' },
  { key: 'feishu', name: '飞书', icon: '🐦' },
  { key: 'dingtalk', name: '钉钉', icon: '🔷' },
  { key: 'qqbot', name: 'QQBot', icon: '🐧' },
  { key: 'weixin', name: '微信', icon: '💚' },
  { key: 'wecom', name: '企业微信', icon: '🏢' },
]

// 判断平台是否已配置
function isPlatformConfigured(key: string): boolean {
  if (key === 'origin' || key === 'local') return true
  // 从 settingsStore 中获取对应频道的配置
  const creds = (settingsStore as any)[key]
  if (!creds || typeof creds !== 'object') return false
  const keys = ['token', 'api_key', 'app_id', 'client_id', 'secret', 'app_secret', 'client_secret', 'access_token', 'bot_id', 'account_id', 'enabled']
  const targets = [creds, creds.extra].filter(Boolean)
  return targets.some(obj =>
    keys.some(k => {
      const val = (obj as Record<string, any>)[k]
      return val !== undefined && val !== null && val !== '' && val !== false
    })
  )
}

// 平台选项：已配置的排在前面
const platformOptions = computed(() =>
  [...platformList]
    .sort((a, b) => {
      const aConfigured = isPlatformConfigured(a.key) ? 0 : 1
      const bConfigured = isPlatformConfigured(b.key) ? 0 : 1
      return aConfigured - bConfigured
    })
    .map(p => {
      const configured = isPlatformConfigured(p.key)
      return {
        label: () => h('span', { class: 'platform-option-label' }, [
          h('span', { class: 'platform-option-icon' }, p.icon),
          h('span', { class: 'platform-option-name' }, p.name),
          h('span', { class: `platform-option-status${configured ? ' configured' : ''}` }, configured ? '已配置' : '未配置'),
        ]),
        value: p.key,
      }
    })
)

const props = defineProps<{
  /** 已选推送平台 key（v-model），单选 */
  modelValue: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [key: string | null]
}>()

function handleChange(value: string | null) {
  emit('update:modelValue', value)
}
</script>

<template>
  <div class="deliver-selector">
    <NSelect
      :value="modelValue"
      :options="platformOptions"
      :placeholder="t('envclaw.wizard.deliverPlaceholder')"
      clearable
      filterable
      @update:value="handleChange"
    />
    <div class="field-hint">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
        <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
      </svg>
      {{ t('envclaw.wizard.deliverHint') }}
    </div>
  </div>
</template>

<style lang="scss">
.platform-option-label {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.platform-option-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.platform-option-name {
  flex: 1;
  font-size: 13px;
}

.platform-option-status {
  font-size: 11px;
  padding: 0 6px;
  border-radius: 8px;
  color: #9ca3b8;
  background: rgba(128, 128, 128, 0.08);
  flex-shrink: 0;
  line-height: 18px;
}

.platform-option-status.configured {
  color: #2e7d32;
  background: rgba(46, 125, 50, 0.08);
}

.dark .platform-option-status.configured {
  color: #66bb6a;
  background: rgba(102, 187, 106, 0.12);
}
</style>

<style scoped lang="scss">
.field-hint {
  font-size: 11px; color: var(--envclaw-text-muted); margin-top: 6px;
  display: flex; align-items: center; gap: 5px;
}
</style>
