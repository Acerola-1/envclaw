<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NModal, NForm, NFormItem, NInput, NButton, useMessage } from 'naive-ui'
import { useDataSourcePlatformsStore } from '@/stores/hermes/dataSourcePlatforms'
import type { DataSourcePlatform, DataSourceAccount } from '@/stores/hermes/dataSourcePlatforms'

const props = defineProps<{
  platform: DataSourcePlatform
  editAccountId?: string | null
}>()

const emit = defineEmits<{
  save: [account: Partial<DataSourceAccount>]
  close: []
}>()

const store = useDataSourcePlatformsStore()
const message = useMessage()
const showModal = ref(true)
const loading = ref(false)

// 表单数据
const formData = ref({
  username: '',
  password: '',
  alias: '',
})

// 计算属性
const isEdit = computed(() => !!props.editAccountId)
const title = computed(() => isEdit.value ? '编辑账号' : '添加账号')

// 获取编辑的账号
const editingAccount = computed(() => {
  if (isEdit.value && props.editAccountId) {
    return props.platform.accounts.find(a => a.id === props.editAccountId)
  }
  return null
})

// 生命周期
onMounted(() => {
  if (isEdit.value && editingAccount.value) {
    formData.value = {
      username: editingAccount.value.username,
      password: '',  // 不显示密码
      alias: editingAccount.value.alias,
    }
  }
})

// 方法
function handleSave() {
  if (!formData.value.username.trim()) {
    message.warning('请输入用户名')
    return
  }
  if (!isEdit.value && !formData.value.password.trim()) {
    message.warning('请输入密码')
    return
  }

  loading.value = true
  try {
    const account = {
      username: formData.value.username,
      password: formData.value.password,
      alias: formData.value.alias,
    }
    emit('save', account)
  } catch (err) {
    message.error('保存失败')
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
    :title="title"
    :style="{ width: 'min(480px, calc(100vw - 32px))' }"
    :mask-closable="!loading"
    @after-leave="emit('close')"
  >
    <NForm label-placement="top">
      <NFormItem label="用户名" required>
        <NInput
          v-model:value="formData.username"
          placeholder="请输入用户名"
          :disabled="isEdit"
        />
      </NFormItem>

      <NFormItem :label="isEdit ? '密码（留空则不修改）' : '密码'" :required="!isEdit">
        <NInput
          v-model:value="formData.password"
          type="password"
          :placeholder="isEdit ? '留空则不修改密码' : '请输入密码'"
          show-password-on="click"
        />
      </NFormItem>

      <NFormItem label="别名">
        <NInput
          v-model:value="formData.alias"
          placeholder="例如：郑州主账号"
        />
      </NFormItem>
    </NForm>

    <template #footer>
      <div class="modal-footer">
        <NButton @click="handleCancel">取消</NButton>
        <NButton type="primary" :loading="loading" @click="handleSave">
          {{ isEdit ? '更新' : '添加' }}
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