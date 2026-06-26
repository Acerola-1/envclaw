<!-- packages/client/src/components/envclaw/platforms/PlatformCard.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { NButton, NTag, useDialog } from 'naive-ui'
import type { Platform } from '@/api/envclaw/platforms'

const props = defineProps<{
  platform: Platform
}>()

const emit = defineEmits<{
  config: [platform: Platform]
  addAccount: [platformId: string]
  editAccount: [platformId: string, accountId: string]
  deleteAccount: [platformId: string, accountId: string]
  deleted: [platformId: string]
}>()

const { t } = useI18n()
const dialog = useDialog()

function handleDelete() {
  dialog.warning({
    title: t('envclaw.platforms.deletePlatform'),
    content: t('envclaw.platforms.deleteConfirm', { name: props.platform.name }),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: () => emit('deleted', props.platform.id),
  })
}

function statusTag(status: string) {
  const map: Record<string, { type: 'success' | 'warning' | 'error' | 'default'; label: string }> = {
    connected: { type: 'success', label: t('envclaw.platforms.connected') },
    expired: { type: 'warning', label: t('envclaw.platforms.expired') },
    error: { type: 'error', label: t('envclaw.platforms.error') },
  }
  return map[status] || { type: 'default', label: status }
}
</script>

<template>
  <div class="pcard">
    <div class="pcard-head">
      <div class="pcard-title">
        <h3>{{ platform.name }}</h3>
        <NTag size="small" :bordered="false">{{ t(`envclaw.platforms.types.${platform.type}`) }}</NTag>
      </div>
      <div class="pcard-actions">
        <NButton size="small" quaternary @click="emit('config', platform)">{{ t('envclaw.platforms.config') }}</NButton>
        <NButton size="small" quaternary type="error" @click="handleDelete">{{ t('envclaw.platforms.deletePlatform') }}</NButton>
      </div>
    </div>

    <!-- 配置摘要 -->
    <div class="pcard-config">
      <span class="config-item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
        {{ t('envclaw.platforms.operationPrompt') }}: {{ platform.operationPrompt ? platform.operationPrompt.slice(0, 30) + '…' : '—' }}
      </span>
      <span class="config-item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" /></svg>
        {{ platform.skills.length }} {{ t('envclaw.platforms.platformSkills') }}
      </span>
      <span class="config-item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 11v2a1 1 0 0 0 1 1h3l4 4V6L7 10H4a1 1 0 0 0-1 1Z" /><path d="M16 8a5 5 0 0 1 0 8" /></svg>
        {{ platform.functions.length }} {{ t('envclaw.platforms.functions') }}
      </span>
    </div>

    <!-- 账号子行 -->
    <div class="pcard-accounts">
      <div v-for="acct in platform.accounts" :key="acct.id" class="acct-row">
        <span class="acct-name">{{ acct.name }}</span>
        <NTag :type="statusTag(acct.status).type" size="small" :bordered="false">{{ statusTag(acct.status).label }}</NTag>
        <div class="acct-actions">
          <NButton size="tiny" quaternary @click="emit('editAccount', platform.id, acct.id)">{{ t('envclaw.platforms.editAccount') }}</NButton>
          <NButton size="tiny" quaternary type="error" @click="emit('deleteAccount', platform.id, acct.id)">{{ t('envclaw.platforms.deleteAccount') }}</NButton>
        </div>
      </div>
      <div class="acct-row acct-add" @click="emit('addAccount', platform.id)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 12h14M12 5v14" /></svg>
        {{ t('envclaw.platforms.addAccount') }}
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.pcard {
  background: var(--envclaw-bg-secondary); border: 1px solid var(--envclaw-border); border-radius: 12px; padding: 18px 20px;
  margin-bottom: 12px;
}
.pcard-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.pcard-title { display: flex; align-items: center; gap: 10px; h3 { font-size: 15px; font-weight: 600; } }
.pcard-actions { display: flex; gap: 4px; }

.pcard-config { display: flex; gap: 16px; margin-bottom: 12px; flex-wrap: wrap; }
.config-item { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--envclaw-text-secondary); }

.pcard-accounts { border-top: 1px solid var(--envclaw-border); padding-top: 10px; }
.acct-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; }
.acct-name { font-size: 13px; flex: 1; }
.acct-actions { display: flex; gap: 4px; }
.acct-add {
  cursor: pointer; color: var(--envclaw-text-secondary); font-size: 12.5px;
  &:hover { color: var(--envclaw-text-primary); }
}
</style>
