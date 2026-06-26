<script setup lang="ts">
import { ref, computed } from 'vue'
import { NCard, NButton, NSwitch, NTag, NIcon, NInput } from 'naive-ui'
import DataSourceAccountForm from '@/components/hermes/guard/DataSourceAccountForm.vue'
import DataSourcePromptEditor from '@/components/hermes/guard/DataSourcePromptEditor.vue'
import { useDataSourcePlatformsStore } from '@/stores/hermes/dataSourcePlatforms'
import type { DataSourcePlatform } from '@/stores/hermes/dataSourcePlatforms'

const props = defineProps<{
  platform: DataSourcePlatform
}>()

const store = useDataSourcePlatformsStore()
const showAccountForm = ref(false)
const editingAccount = ref<string | null>(null)
const editingUrl = ref(false)
const editingUrlValue = ref('')

// 数智大气平台使用当前登录账号，不可修改/删除
const isShuzhi = computed(() => props.platform.id === 'shuzhi')

// 计算属性
const accountCount = computed(() => props.platform.accounts.length)
const hasAccounts = computed(() => accountCount.value > 0)
const defaultAccount = computed(() => props.platform.accounts.find(a => a.isDefault))

// 方法
function handleToggleExpand() {
  store.toggleExpand(props.platform.id)
}

function handleAddAccount() {
  showAccountForm.value = true
  editingAccount.value = null
}

function handleEditAccount(accountId: string) {
  editingAccount.value = accountId
  showAccountForm.value = true
}

function handleDeleteAccount(accountId: string) {
  store.deleteAccount(props.platform.id, accountId)
}

function handleSetDefaultAccount(accountId: string) {
  store.setDefaultAccount(props.platform.id, accountId)
}

function handleAccountSaved(account: any) {
  if (editingAccount.value) {
    store.editAccount(props.platform.id, editingAccount.value, account)
  } else {
    store.addAccount(props.platform.id, account)
  }
  showAccountForm.value = false
  editingAccount.value = null
}

function handlePromptUpdated(prompt: string) {
  store.updatePrompt(props.platform.id, prompt)
}

function handleToggleEnabled() {
  store.toggleEnabled(props.platform.id)
}

function handleDeletePlatform() {
  store.deletePlatform(props.platform.id)
}

function handleStartEditUrl() {
  editingUrl.value = true
  editingUrlValue.value = props.platform.url
}

function handleSaveUrl() {
  const platform = store.getPlatform(props.platform.id)
  if (platform) {
    platform.url = editingUrlValue.value
  }
  editingUrl.value = false
}

function handleCancelEditUrl() {
  editingUrl.value = false
  editingUrlValue.value = ''
}
</script>

<template>
  <NCard :class="{ 'platform-card': true, 'platform-card-expanded': platform.expanded }">
    <!-- 平台头部 -->
    <div class="platform-header" @click="handleToggleExpand">
      <div class="platform-info">
        <span class="platform-icon">{{ platform.icon }}</span>
        <span class="platform-name">{{ platform.name }}</span> 
        <NTag v-if="platform.enabled && platform.accounts.length > 0" type="success" size="small" class="status-tag">已配置
        </NTag>
        <NTag v-else-if="platform.enabled" type="warning" size="small" class="status-tag">未配置</NTag>
        <NTag v-else type="default" size="small" class="status-tag">已禁用</NTag>
      </div>
      <div class="platform-meta">
        <span class="meta-item">{{ platform.level }}</span>
        <span class="meta-separator">·</span>
        <span class="meta-item">{{ platform.network }}</span>
        <span class="meta-separator">·</span>
        <span class="meta-item">{{ platform.captchaType }}</span>
      </div>
      <div class="platform-actions">
        <NSwitch :value="platform.enabled" @update:value="handleToggleEnabled" />
        <NButton v-if="!platform.enabled" type="primary" size="small" @click="handleDeletePlatform">删除</NButton>
        <span class="expand-icon">{{ platform.expanded ? '▲' : '▼' }}</span>
      </div>
    </div>

    <!-- 平台内容（展开时显示） -->
    <div v-if="platform.expanded" class="platform-content">
      <!-- 平台地址 -->
      <div class="url-editor">
        <!-- 查看模式 -->
        <div v-if="!editingUrl" class="url-view" @dblclick="handleStartEditUrl">
          <div class="url-header">
            <span class="url-title">地址</span>
            <NButton type="default" size="small" @click="handleStartEditUrl">编辑</NButton>
          </div>
          <div class="url-content">
            <div v-if="platform.url" class="url-text">{{ platform.url }}</div>
            <div v-else class="url-empty">暂无地址，双击或点击编辑按钮添加</div>
          </div>
        </div>

        <!-- 编辑模式 -->
        <div v-else class="url-edit">
          <div class="url-header">
            <span class="url-title">地址</span>
            <div class="url-actions">
              <NButton type="default" size="small" @click="handleCancelEditUrl">取消</NButton>
              <NButton type="primary" size="small" @click="handleSaveUrl">保存</NButton>
            </div>
          </div>
          <NInput
            v-model:value="editingUrlValue"
            placeholder="请输入平台地址，例如 https://example.com"
            @keyup.enter="handleSaveUrl"
          />
        </div>
      </div>

      <!-- 账号列表 -->
      <div class="accounts-section">
        <div class="section-header">
          <span class="section-title">账号 ({{ accountCount }})</span>
          <NButton type="primary" size="small" @click="handleAddAccount">+ 添加账号</NButton>
        </div>

        <!-- 账号列表 -->
        <div v-if="hasAccounts" class="accounts-list">
          <div v-for="account in platform.accounts" :key="account.id" class="account-item">
            <div class="account-info">
              <span class="account-username">{{ account.username }}</span> <span class="account-alias">{{ account.alias }}</span>
              <NTag v-if="account.isDefault" type="warning" size="small">默认</NTag>
              <!-- <NTag
                :type="account.status === 'available' ? 'success' : account.status === 'pending' ? 'warning' : 'error'"
                size="small">
                {{ account.status === 'available' ? '可用' : account.status === 'pending' ? '待验证' : '异常' }}
              </NTag> -->
            </div>
            <div class="account-actions">
              <NButton v-if="!account.isDefault" type="default" size="tiny"
                @click="handleSetDefaultAccount(account.id)">设为默认</NButton>
              <NButton type="default" size="tiny" @click="handleEditAccount(account.id)">编辑</NButton>
              <NButton type="error" size="tiny" @click="handleDeleteAccount(account.id)">删除</NButton>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-else class="empty-state">
          <span>暂无账号，点击上方按钮添加</span>
        </div>
      </div>

      <!-- 平台提示词 -->
      <div class="prompt-section">
        <DataSourcePromptEditor :platform="platform" @update="handlePromptUpdated" />
      </div>
    </div>

    <!-- 账号表单（模态框） -->
    <DataSourceAccountForm v-if="showAccountForm" :platform="platform" :edit-account-id="editingAccount"
      @save="handleAccountSaved" @close="showAccountForm = false" />
  </NCard>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.platform-card {
  margin-bottom: 16px;
  border-radius: 8px;
  transition: all 0.2s;

  &.platform-card-expanded {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }
}

.platform-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgba(24, 144, 255, 0.04);
    border-radius: 4px;
  }
}

.platform-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.platform-icon {
  font-size: 18px;
}

.platform-name {
  font-size: 14px;
  font-weight: 600;
}

.status-tag {
  margin-left: 4px;
}

.platform-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #999;
}

.meta-item {
  white-space: nowrap;
}

.meta-separator {
  color: #ddd;
}

.platform-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.expand-icon {
  font-size: 12px;
  color: #999;
  margin-left: 8px;
}

.platform-content {
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
  margin-top: 12px;
}

.url-editor {
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  padding: 12px;
  background: #fafafa;
  margin-bottom: 16px;
}

.url-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.url-title {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.url-actions {
  display: flex;
  gap: 4px;
}

.url-view {
  cursor: pointer;
}

.url-content {
  padding: 8px 12px;
  background: #fff;
  border-radius: 4px;
  border: 1px solid #e8e8e8;
  min-height: 36px;
  transition: border-color 0.2s;

  &:hover {
    border-color: #1890ff;
  }
}

.url-text {
  font-size: 13px;
  line-height: 1.6;
  color: #333;
  word-break: break-all;
}

.url-empty {
  font-size: 13px;
  color: #999;
  text-align: center;
  padding: 8px 0;
}

.url-edit {
  padding-top: 4px;
}

.accounts-section {
  margin-bottom: 20px;
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

.accounts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.account-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #fafafa;
  border-radius: 4px;
  transition: background 0.2s;

  &:hover {
    background: #f0f0f0;
  }
}

.account-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.account-username {
  color: #333;
  font-size: 13px;
  font-weight: 500;
}

.account-alias {
  font-size: 12px;
  color: #999;
}
.account-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.empty-state {
  text-align: center;
  padding: 16px;
  color: #999;
  font-size: 13px;
}

.prompt-section {
  margin-top: 20px;
}
</style>