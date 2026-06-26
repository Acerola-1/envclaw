<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NButton, NSelect, NInput, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { usePlatformsStore } from '@/stores/envclaw/platforms'
import type { Platform } from '@/api/envclaw/platforms'
import PlatformCard from '@/components/envclaw/platforms/PlatformCard.vue'
import PlatformConfigDrawer from '@/components/envclaw/platforms/PlatformConfigDrawer.vue'
import AccountDrawer from '@/components/envclaw/platforms/AccountDrawer.vue'

const { t } = useI18n()
const message = useMessage()
const platformsStore = usePlatformsStore()

onMounted(() => { void platformsStore.fetchPlatforms() })

// --- 新建平台 ---
const showCreateForm = ref(false)
const newName = ref('')
const newType = ref('custom')
const typeOptions = [
  { label: t('envclaw.platforms.types.mapairs'), value: 'mapairs' },
  { label: t('envclaw.platforms.types.national_station'), value: 'national_station' },
  { label: t('envclaw.platforms.types.oa'), value: 'oa' },
  { label: t('envclaw.platforms.types.feishu'), value: 'feishu' },
  { label: t('envclaw.platforms.types.dingtalk'), value: 'dingtalk' },
  { label: t('envclaw.platforms.types.custom'), value: 'custom' },
]

async function handleCreate() {
  if (!newName.value.trim()) {
    message.warning('Name is required')
    return
  }
  try {
    await platformsStore.createPlatform({ type: newType.value as any, name: newName.value.trim() })
    newName.value = ''
    newType.value = 'custom'
    showCreateForm.value = false
    message.success(t('common.saved'))
  } catch (err: any) {
    message.error(err.message)
  }
}

// --- 配置抽屉 ---
const configDrawerShow = ref(false)
const configPlatform = ref<Platform | null>(null)

function openConfig(platform: Platform) {
  configPlatform.value = platform
  configDrawerShow.value = true
}

// --- 账号抽屉 ---
const accountDrawerShow = ref(false)
const accountPlatformId = ref<string | null>(null)
const accountAccountId = ref<string | null>(null)

function openAddAccount(platformId: string) {
  accountPlatformId.value = platformId
  accountAccountId.value = null
  accountDrawerShow.value = true
}

function openEditAccount(platformId: string, accountId: string) {
  accountPlatformId.value = platformId
  accountAccountId.value = accountId
  accountDrawerShow.value = true
}

async function handleDeleteAccount(platformId: string, accountId: string) {
  try {
    await platformsStore.deleteAccount(platformId, accountId)
    message.success(t('common.saved'))
  } catch (err: any) {
    message.error(err.message)
  }
}

async function handleDeletePlatform(platformId: string) {
  try {
    await platformsStore.deletePlatform(platformId)
    message.success(t('common.saved'))
  } catch (err: any) {
    message.error(err.message)
  }
}

async function refreshData() {
  await platformsStore.fetchPlatforms()
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>{{ t('envclaw.platforms.title') }}</h1>
        <p class="sub">{{ t('envclaw.platforms.description') }}</p>
      </div>
      <NButton type="primary" @click="showCreateForm = true">
        + {{ t('envclaw.platforms.addPlatform') }}
      </NButton>
    </div>

    <!-- 新建表单(内联) -->
    <div v-if="showCreateForm" class="create-form">
      <NSelect v-model:value="newType" :options="typeOptions" style="width: 160px" />
      <NInput v-model:value="newName" :placeholder="t('envclaw.platforms.platformName')" style="flex:1" @keyup.enter="handleCreate" />
      <NButton type="primary" @click="handleCreate">{{ t('common.confirm') }}</NButton>
      <NButton @click="showCreateForm = false">{{ t('common.cancel') }}</NButton>
    </div>

    <!-- 平台列表 -->
    <div v-if="platformsStore.platforms.length === 0 && !showCreateForm" class="empty">
      {{ t('envclaw.platforms.noPlatforms') }}
    </div>

    <PlatformCard
      v-for="p in platformsStore.platforms"
      :key="p.id"
      :platform="p"
      @config="openConfig"
      @add-account="openAddAccount"
      @edit-account="openEditAccount"
      @delete-account="handleDeleteAccount"
      @deleted="handleDeletePlatform"
    />

    <!-- 配置抽屉 -->
    <PlatformConfigDrawer
      v-model:show="configDrawerShow"
      :platform="configPlatform"
      @saved="refreshData"
    />

    <!-- 账号抽屉 -->
    <AccountDrawer
      v-model:show="accountDrawerShow"
      :platform-id="accountPlatformId"
      :account-id="accountAccountId"
      @saved="refreshData"
    />
  </div>
</template>

<style scoped lang="scss">
.page { max-width: 1080px; margin: 0 auto; padding: 28px 32px 48px; }
.page-head { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 22px; }
h1 { font-size: 20px; font-weight: 600; }
.sub { color: var(--envclaw-text-secondary); font-size: 13px; margin-top: 4px; }

.create-form {
  display: flex; gap: 10px; align-items: center;
  background: var(--envclaw-bg-secondary); border: 1px solid var(--envclaw-border); border-radius: 8px;
  padding: 12px 16px; margin-bottom: 20px;
}

.empty { color: var(--envclaw-text-muted); font-size: 13px; padding: 40px 0; text-align: center; }
</style>
