<script setup lang="ts">
import { ref } from 'vue'
import { NModal, NForm, NFormItem, NInput, NButton, useMessage } from 'naive-ui'
import { useDataSourcePlatformsStore } from '@/stores/hermes/dataSourcePlatforms'

const emit = defineEmits<{
  close: []
}>()

const store = useDataSourcePlatformsStore()
const message = useMessage()
const showModal = ref(true)
const loading = ref(false)

const formData = ref({
  name: '',
  url: '',
  username: '',
  password: '',
  alias: '',
  prompt: '',
})

function handleSave() {
  if (!formData.value.name.trim()) {
    message.warning('请输入平台名称')
    return
  }

  loading.value = true
  try {
    const account = formData.value.username.trim() ? {
      username: formData.value.username,
      password: formData.value.password,
      alias: formData.value.alias,
      isDefault: true,
    } : undefined

    store.addPlatform({
      name: formData.value.name,
      icon: '🔗',
      level: '自定义',
      network: '互联网',
      captchaType: '无需验证码',
      url: formData.value.url,
      prompt: formData.value.prompt,
      enabled: true,
      accounts: account ? [account] : [],
    })

    emit('close')
  } catch {
    message.error('添加失败')
  } finally {
    loading.value = false
  }
}

function handleClose() {
  showModal.value = false
  setTimeout(() => emit('close'), 200)
}

function handleCancel() {
  handleClose()
}
</script>

<template>
  <NModal
    v-model:show="showModal"
    preset="card"
    title="新增数据源平台"
    :style="{ width: 'min(520px, calc(100vw - 32px))' }"
    :mask-closable="!loading"
    @after-leave="emit('close')"
  >
    <NForm label-placement="top">
      <NFormItem label="平台名称" required>
        <NInput
          v-model:value="formData.name"
          placeholder="请输入平台名称"
        />
      </NFormItem>

      <NFormItem label="URL">
        <NInput
          v-model:value="formData.url"
          placeholder="例如 https://example.com"
        />
      </NFormItem>

      <NFormItem label="账号">
        <NInput
          v-model:value="formData.username"
          placeholder="用户名（可选）"
        />
      </NFormItem>

      <NFormItem label="密码">
        <NInput
          v-model:value="formData.password"
          type="password"
          placeholder="密码（可选）"
          show-password-on="click"
        />
      </NFormItem>

      <NFormItem label="别名">
        <NInput
          v-model:value="formData.alias"
          placeholder="例如：郑州主账号（可选）"
        />
      </NFormItem>

      <NFormItem label="平台提示词">
        <NInput
          v-model:value="formData.prompt"
          type="textarea"
          :rows="4"
          placeholder="描述该平台的特性和使用注意事项（可选）"
          :maxlength="1000"
          show-count
        />
      </NFormItem>
    </NForm>

    <template #footer>
      <div class="modal-footer">
        <NButton @click="handleCancel">取消</NButton>
        <NButton type="primary" :loading="loading" @click="handleSave">
          添加
        </NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>