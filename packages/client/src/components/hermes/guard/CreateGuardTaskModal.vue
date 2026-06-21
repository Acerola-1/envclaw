<script setup lang="ts">
import { ref, computed } from 'vue'
import { NModal, NInput, NSelect, NButton, NSwitch } from 'naive-ui'

interface GuardRobot {
  id: string
  name: string
  icon: string
  description: string
  category: 'scheduled' | 'monitoring' | 'daily'
  color: string
}

const props = defineProps<{
  robot: GuardRobot | null
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  create: [task: any]
}>()

const taskName = ref('')
const taskPrompt = ref('')
const scheduleType = ref<'hourly' | 'daily' | 'custom'>('hourly')
const hour = ref(8)
const minute = ref(0)
const notifyPlatform = ref<'wechat' | 'dingtalk' | 'feishu'>('wechat')
const notifyGroupId = ref('')
const enabled = ref(true)

const scheduleOptions = computed(() => [
  { label: '每小时', value: 'hourly' },
  { label: '每日', value: 'daily' },
  { label: '自定义', value: 'custom' }
])

const platformOptions = computed(() => [
  { label: '企业微信', value: 'wechat' },
  { label: '钉钉', value: 'dingtalk' },
  { label: '飞书', value: 'feishu' }
])

function handleCreate() {
  if (!taskName.value || !taskPrompt.value) return

  const task = {
    robotId: props.robot?.id,
    name: taskName.value,
    prompt: taskPrompt.value,
    schedule: scheduleType.value === 'hourly'
      ? '0 * * * *'
      : scheduleType.value === 'daily'
        ? `${minute.value} ${hour.value} * * *`
        : '',
    notifyPlatform: notifyPlatform.value,
    notifyGroupId: notifyGroupId.value,
    enabled: enabled.value
  }

  emit('create', task)
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <NModal
    :show="visible"
    @update:show="(val) => !val && handleClose()"
    preset="card"
    :title="`创建 ${robot?.name || ''} 任务`"
    :style="{ width: '600px' }"
    :bordered="false"
    :segmented="{
      content: true,
      footer: true
    }"
  >
    <div class="create-form">
      <div class="form-item">
        <label class="form-label">任务名称</label>
        <NInput
          v-model:value="taskName"
          placeholder="请输入任务名称"
          maxlength="50"
        />
      </div>

      <div class="form-item">
        <label class="form-label">执行提示词</label>
        <NInput
          v-model:value="taskPrompt"
          type="textarea"
          placeholder="请输入分析提示词"
          :rows="4"
          maxlength="500"
        />
      </div>

      <div class="form-item" v-if="robot?.category === 'scheduled'">
        <label class="form-label">调度频率</label>
        <NSelect
          v-model:value="scheduleType"
          :options="scheduleOptions"
        />
      </div>

      <div class="form-item" v-if="scheduleType === 'daily'">
        <label class="form-label">执行时间</label>
        <div class="time-picker-row">
          <NSelect
            v-model:value="hour"
            :options="Array.from({ length: 24 }, (_, i) => ({ label: `${i}时`, value: i }))"
            style="width: 100px"
          />
          <span class="time-separator">:</span>
          <NSelect
            v-model:value="minute"
            :options="[0, 15, 30, 45].map(m => ({ label: `${m}分`, value: m }))"
            style="width: 100px"
          />
        </div>
      </div>

      <div class="form-item">
        <label class="form-label">推送平台</label>
        <NSelect
          v-model:value="notifyPlatform"
          :options="platformOptions"
        />
      </div>

      <div class="form-item">
        <label class="form-label">推送群ID</label>
        <NInput
          v-model:value="notifyGroupId"
          placeholder="请输入推送群ID"
        />
      </div>

      <div class="form-item">
        <label class="form-label">启用任务</label>
        <NSwitch v-model:value="enabled" />
      </div>
    </div>

    <template #footer>
      <div class="form-footer">
        <NButton @click="handleClose">取消</NButton>
        <NButton
          type="primary"
          :disabled="!taskName || !taskPrompt"
          @click="handleCreate"
        >
          创建任务
        </NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.create-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: $text-primary;
}

.time-picker-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.time-separator {
  font-size: 16px;
  color: $text-muted;
}

.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
