<!-- packages/client/src/components/envclaw/platforms/AccountDrawer.vue -->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { NDrawer, NDrawerContent, NInput, NSelect, NButton, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { usePlatformsStore } from '@/stores/envclaw/platforms'

const props = defineProps<{
  show: boolean
  platformId: string | null
  accountId: string | null  // null = 新建
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  saved: []
}>()

const { t } = useI18n()
const message = useMessage()
const platformsStore = usePlatformsStore()

const accountName = ref('')
const credentialType = ref('password')
const username = ref('')
const password = ref('')

const credentialTypeOptions = [
  { label: t('envclaw.platforms.password'), value: 'password' },
  { label: 'API Key', value: 'api_key' },
  { label: 'Webhook', value: 'webhook' },
  { label: 'Cookie', value: 'cookie' },
]

watch(() => props.show, (v) => {
  if (v && props.accountId && props.platformId) {
    const platform = platformsStore.platforms.find((p) => p.id === props.platformId)
    const account = platform?.accounts.find((a) => a.id === props.accountId)
    if (account) {
      accountName.value = account.name
      credentialType.value = account.credentials.type
      // 编辑时显示已保存的凭据（明文，用于提示词）
      username.value = account.credentials.username || ''
      password.value = account.credentials.password || account.credentials.apiKey || account.credentials.webhookUrl || ''
    }
  } else if (v) {
    accountName.value = ''
    credentialType.value = 'password'
    username.value = ''
    password.value = ''
  }
})

async function handleSave() {
  if (!props.platformId) return
  if (!accountName.value) {
    message.warning(t('envclaw.platforms.accountName') + ' is required')
    return
  }

  const credentials: Record<string, any> = {}
  if (credentialType.value === 'password') {
    credentials.username = username.value
    credentials.password = password.value
  } else if (credentialType.value === 'api_key') {
    credentials.apiKey = password.value
  } else if (credentialType.value === 'webhook') {
    credentials.webhookUrl = password.value
  } else if (credentialType.value === 'cookie') {
    credentials.cookie = password.value
  }

  try {
    if (props.accountId) {
      await platformsStore.updateAccount(props.platformId, props.accountId, {
        name: accountName.value,
        credentialType: credentialType.value as any,
        credentials: Object.values(credentials).some(v => v) ? credentials : undefined,
      })
    } else {
      await platformsStore.addAccount(props.platformId, {
        name: accountName.value,
        credentialType: credentialType.value as any,
        credentials,
      })
    }
    message.success(t('common.saved'))
    emit('update:show', false)
    emit('saved')
  } catch (err: any) {
    message.error(err.message)
  }
}
</script>

<template>
  <NDrawer :show="show" :width="420" placement="right" @update:show="emit('update:show', $event)">
    <NDrawerContent :title="accountId ? t('envclaw.platforms.editAccount') : t('envclaw.platforms.addAccount')" closable>
      <div class="field">
        <label>{{ t('envclaw.platforms.accountName') }}</label>
        <NInput v-model:value="accountName" :placeholder="t('envclaw.platforms.accountName')" />
      </div>

      <div class="field">
        <label>{{ t('envclaw.platforms.credentialType') }}</label>
        <NSelect v-model:value="credentialType" :options="credentialTypeOptions" />
      </div>

      <div v-if="credentialType === 'password'" class="field">
        <label>{{ t('envclaw.platforms.username') }}</label>
        <NInput v-model:value="username" />
      </div>

      <div class="field">
        <label>{{ credentialType === 'api_key' ? 'API Key' : credentialType === 'webhook' ? t('envclaw.platforms.webhookUrl') : credentialType === 'cookie' ? 'Cookie' : t('envclaw.platforms.password') }}</label>
        <NInput v-model:value="password" :placeholder="t('envclaw.platforms.credentialHint')" />
      </div>

      <div class="field-hint">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
        </svg>
        {{ t('envclaw.platforms.credentialNote') }}
      </div>

      <template #footer>
        <NButton type="primary" @click="handleSave">{{ t('common.save') }}</NButton>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped lang="scss">
.field { margin-bottom: 18px; }
label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; }
.field-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--envclaw-text-secondary);
  background: var(--envclaw-bg-tertiary);
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 18px;
}
</style>
