<script setup lang="ts">
import { ref, onMounted, computed, h } from 'vue'
import { useRouter } from 'vue-router'
import { NModal, NForm, NFormItem, NInput, NButton, NSelect, NInputNumber, NTimePicker, NTabs, NTabPane, NDatePicker, useMessage } from 'naive-ui'
import { useJobsStore } from '@/stores/hermes/jobs'
import { useSettingsStore } from '@/stores/hermes/settings'
import {
  buildJobUpdateRequest,
  getJob,
  jobRepeatToEditValue,
  scheduleToEditableInput,
} from '@/api/hermes/jobs'
import type { CreateJobRequest, Job } from '@/api/hermes/jobs'
import { fetchSkills } from '@/api/hermes/skills'
import type { SkillInfo } from '@/api/hermes/skills'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  jobId: string | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const jobsStore = useJobsStore()
const settingsStore = useSettingsStore()
const message = useMessage()

const showModal = ref(true)
const loading = ref(false)
const skillsLoading = ref(false)
const skillOptions = ref<Array<{ label: string; value: string }>>([])

const formData = ref({
  name: '',
  schedule: '',
  prompt: '',
  deliver: 'origin',
  skills: [] as string[],
  repeat_times: null as number | null,
})

const isEdit = computed(() => !!props.jobId)

// 执行频率调度配置
const scheduleMode = ref<'period' | 'interval' | 'once'>('period')

// 周期模式
const periodType = ref<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily')
const periodTime = ref<number | null>(new Date().setHours(9, 0, 0, 0))
const periodWeekDays = ref<number[]>([1])

// 间隔模式
const intervalHours = ref(2)
const intervalDays = ref<number[]>([1, 2, 3, 4, 5])

// 单次模式
const onceTime = ref<number | null>(new Date().setHours(9, 0, 0, 0))
const onceDate = ref<number | null>(null)

// 生效日期区间
const effectiveDateRange = ref<[number, number] | null>(null)

const periodOptions = computed(() => [
  { label: '每天', value: 'daily' },
  { label: '每周', value: 'weekly' },
  { label: '每月', value: 'monthly' },
  { label: '每年', value: 'yearly' },
])

const weekDayOptions = computed(() => [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 0 },
])

function toggleIntervalDay(day: number) {
  const index = intervalDays.value.indexOf(day)
  if (index === -1) {
    intervalDays.value.push(day)
  } else {
    intervalDays.value.splice(index, 1)
  }
}

function formatTime(timestamp: number | null): string {
  if (!timestamp) return '09:00'
  const date = new Date(timestamp)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const isIntervalValid = computed(() => intervalHours.value >= 1 && intervalHours.value <= 24)
const isIntervalDaysValid = computed(() => intervalDays.value.length > 0)

const isOnceDateValid = computed(() => {
  if (!onceDate.value) return true
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(onceDate.value) >= today
})

const isEffectiveDateValid = computed(() => {
  if (!effectiveDateRange.value) return true
  const [start, end] = effectiveDateRange.value
  return new Date(start) <= new Date(end)
})

function generatePeriodCron(): string {
  const time = formatTime(periodTime.value)
  const [hour, minute] = time.split(':').map(Number)
  switch (periodType.value) {
    case 'daily': return `${minute} ${hour} * * *`
    case 'weekly': {
      const days = periodWeekDays.value.length > 0 ? periodWeekDays.value.sort().join(',') : '1'
      return `${minute} ${hour} * * ${days}`
    }
    case 'monthly': return `${minute} ${hour} 1 * *`
    case 'yearly': return `${minute} ${hour} 1 1 *`
    default: return `${minute} ${hour} * * *`
  }
}

function generateIntervalCron(): string {
  const days = intervalDays.value.sort().join(',')
  return `0 */${intervalHours.value} * * ${days}`
}

function generateScheduleCron(): string {
  if (scheduleMode.value === 'period') return generatePeriodCron()
  if (scheduleMode.value === 'interval') return generateIntervalCron()
  return ''
}

/** 从 cron 表达式反向解析调度 UI 状态（用于编辑模式） */
function parseScheduleFromCron(schedule: string) {
  if (!schedule) return
  const parts = schedule.trim().split(/\s+/)
  if (parts.length < 5) return

  const [minuteStr, hourStr, dom, month, dow] = parts
  const minute = parseInt(minuteStr)
  const hour = parseInt(hourStr)

  // 间隔模式: 0 */N * * days
  if (minuteStr === '0' && hourStr.startsWith('*/')) {
    scheduleMode.value = 'interval'
    intervalHours.value = parseInt(hourStr.slice(2)) || 2
    if (dow !== '*') {
      intervalDays.value = dow.split(',').map(Number).filter(n => !isNaN(n))
    }
    return
  }

  // 周期模式
  scheduleMode.value = 'period'
  periodTime.value = new Date().setHours(hour, minute, 0, 0)

  if (dom === '1' && month === '1') {
    periodType.value = 'yearly'
  } else if (dom === '1' && month === '*') {
    periodType.value = 'monthly'
  } else if (dow !== '*') {
    periodType.value = 'weekly'
    periodWeekDays.value = dow.split(',').map(Number).filter(n => !isNaN(n))
  } else {
    periodType.value = 'daily'
  }
}

// 投递目标平台列表（与 CreateGuardTaskModal 一致）
const router = useRouter()

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

function isPlatformConfigured(key: string): boolean {
  if (key === 'origin' || key === 'local') return true
  const creds = (settingsStore.platforms as Record<string, any>)[key]
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

const platformOptions = computed(() =>
  platformList.map(p => {
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

function goToChannels() {
  router.push({ name: 'hermes.channels' })
}

const originalJob = ref<Job | null>(null)

function buildSkillOptions(skills: SkillInfo[]): Array<{ label: string; value: string }> {
  const byName = new Map<string, SkillInfo>()
  for (const skill of skills) {
    if (skill.enabled === false) continue
    if (!byName.has(skill.name)) byName.set(skill.name, skill)
  }
  return [...byName.values()]
    .map(skill => ({ label: skill.name, value: skill.name }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

async function loadSkillOptions() {
  skillsLoading.value = true
  try {
    const data = await fetchSkills()
    skillOptions.value = buildSkillOptions(data.categories.flatMap(category => category.skills || []))
  } catch {
    skillOptions.value = []
  } finally {
    skillsLoading.value = false
  }
}

onMounted(async () => {
  if (Object.keys(settingsStore.platforms || {}).length === 0) {
    await settingsStore.fetchSettings()
  }
  await loadSkillOptions()

  if (props.jobId) {
    try {
      const job = await getJob(props.jobId)
      originalJob.value = job
      formData.value = {
        name: job.name,
        schedule: scheduleToEditableInput(job.schedule, job.schedule_display || ''),
        prompt: job.prompt,
        deliver: (job.deliver || 'origin').split(':')[0],
        skills: job.skills || (job.skill ? [job.skill] : []),
        repeat_times: jobRepeatToEditValue(job.repeat),
      }
      // 解析已有 cron 表达式到调度 UI
      parseScheduleFromCron(formData.value.schedule)
    } catch (e: any) {
      message.error(t('jobs.loadFailed') + ': ' + e.message)
    }
  }
})

async function handleSave() {
  if (!formData.value.name.trim()) {
    message.warning(t('jobs.nameRequired'))
    return
  }

  // 校验调度配置
  if (scheduleMode.value === 'interval') {
    if (!isIntervalValid.value) { message.warning('请输入 1-24 之间的间隔小时数'); return }
    if (!isIntervalDaysValid.value) { message.warning('请至少选择一天'); return }
  }
  if (scheduleMode.value === 'once' && !isOnceDateValid.value) {
    message.warning('请选择今天或之后的日期')
    return
  }
  if (scheduleMode.value !== 'once' && effectiveDateRange.value && !isEffectiveDateValid.value) {
    message.warning('结束日期必须晚于开始日期')
    return
  }

  const schedule = generateScheduleCron()

  loading.value = true
  try {
    if (isEdit.value) {
      if (!originalJob.value) {
        message.error(t('jobs.loadFailed'))
        return
      }
      // 将调度 cron 同步到 formData 供 buildJobUpdateRequest 对比
      formData.value.schedule = schedule
      const payload = buildJobUpdateRequest(originalJob.value, formData.value)
      if (Object.keys(payload).length === 0) {
        message.success(t('jobs.jobUpdated'))
        emit('saved')
        return
      }
      await jobsStore.updateJob(props.jobId!, payload)
      message.success(t('jobs.jobUpdated'))
    } else {
      const payload: CreateJobRequest = {
        name: formData.value.name,
        schedule,
        prompt: formData.value.prompt,
        deliver: formData.value.deliver,
        skills: formData.value.skills,
        repeat: formData.value.repeat_times ?? undefined,
      }
      await jobsStore.createJob(payload)
      message.success(t('jobs.jobCreated'))
    }
    emit('saved')
  } catch (e: any) {
    message.error(e.message)
  } finally {
    loading.value = false
  }
}

function handleClose() {
  showModal.value = false
  setTimeout(() => emit('close'), 200)
}
</script>

<template>
  <NModal
    v-model:show="showModal"
    preset="card"
    :title="isEdit ? t('jobs.editJob') : t('jobs.createJob')"
    :style="{ width: 'min(520px, calc(100vw - 32px))' }"
    :mask-closable="!loading"
    @after-leave="emit('close')"
  >
    <NForm label-placement="top">
      <NFormItem :label="t('jobs.name')" required>
        <NInput
          v-model:value="formData.name"
          :placeholder="t('jobs.namePlaceholder')"
          maxlength="200"
          show-count
        />
      </NFormItem>

      <NFormItem :label="t('jobs.prompt')" required>
        <NInput
          v-model:value="formData.prompt"
          type="textarea"
          :placeholder="t('jobs.promptPlaceholder')"
          :rows="4"
          maxlength="5000"
          show-count
        />
      </NFormItem>

      <NFormItem :label="t('jobs.schedule')" required>
        <NTabs v-model:value="scheduleMode" type="segment" animated style="width: 100%">
          <NTabPane name="period" tab="周期">
            <div class="schedule-content">
              <div class="schedule-row">
                <NSelect v-model:value="periodType" :options="periodOptions" style="width: 120px" />
                <NSelect v-if="periodType === 'weekly'" v-model:value="periodWeekDays" multiple
                  :options="weekDayOptions" placeholder="选择周几" style="width: 240px" />
                <NTimePicker v-model:value="periodTime" format="HH:mm" style="width: 120px" />
              </div>
            </div>
          </NTabPane>
          <NTabPane name="interval" tab="按间隔">
            <div class="schedule-content">
              <div class="interval-row">
                <span>每</span>
                <NInputNumber v-model:value="intervalHours" :min="1" :max="24" style="width: 80px"
                  :status="!isIntervalValid ? 'error' : undefined" />
                <span>小时</span>
              </div>
              <div v-if="!isIntervalValid" class="error-tip">请输入 1-24 之间的数字</div>
              <div class="week-days-btn-group">
                <NButton v-for="day in weekDayOptions" :key="day.value"
                  :type="intervalDays.includes(day.value) ? 'primary' : 'default'" size="small"
                  @click="toggleIntervalDay(day.value)">
                  {{ day.label }}
                </NButton>
              </div>
              <div v-if="!isIntervalDaysValid" class="error-tip">请至少选择一天</div>
            </div>
          </NTabPane>
          <NTabPane name="once" tab="单次">
            <div class="schedule-content">
              <div class="once-row">
                <NDatePicker v-model:value="onceDate" type="date" placeholder="选择日期" style="width: 200px"
                  :is-date-disabled="(timestamp: number) => timestamp < Date.now() - 86400000" />
                <NTimePicker v-model:value="onceTime" format="HH:mm" style="width: 120px" />
              </div>
              <div v-if="!isOnceDateValid" class="error-tip">请选择今天或之后的日期</div>
            </div>
          </NTabPane>
        </NTabs>
      </NFormItem>

      <!-- <NFormItem v-if="scheduleMode === 'period' || scheduleMode === 'interval'" label="生效日期区间">
        <NDatePicker v-model:value="effectiveDateRange" type="daterange" start-placeholder="开始日期" end-placeholder="结束日期"
          :is-date-disabled="(timestamp: number) => timestamp < Date.now() - 86400000"
          :status="!isEffectiveDateValid ? 'error' : undefined" style="width: 100%" />
        <div v-if="!isEffectiveDateValid" class="error-tip">结束日期必须晚于开始日期</div>
      </NFormItem> -->

      <NFormItem :label="t('jobs.skills')">
        <NSelect
          v-model:value="formData.skills"
          multiple
          filterable
          clearable
          :loading="skillsLoading"
          :options="skillOptions"
          :placeholder="t('jobs.skillsPlaceholder')"
        />
      </NFormItem>

      <NFormItem :label="t('jobs.deliverTarget')">
        <div class="platform-select-row">
          <NSelect
            v-model:value="formData.deliver"
            :options="platformOptions"
            placeholder="选择投递目标"
            clearable
            filterable
          />
          <button class="platform-edit-btn" @click="goToChannels" title="前往渠道管理编辑">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        </div>
      </NFormItem>

      <NFormItem :label="t('jobs.repeatCount')">
        <NInputNumber
          v-model:value="formData.repeat_times"
          :min="1"
          :placeholder="t('jobs.repeatPlaceholder')"
          clearable
          style="width: 100%"
        />
      </NFormItem>
    </NForm>

    <template #footer>
      <div class="modal-footer">
        <NButton @click="handleClose">{{ t('common.cancel') }}</NButton>
        <NButton type="primary" :loading="loading" @click="handleSave">
          {{ isEdit ? t('common.update') : t('common.create') }}
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

.schedule-content {
  padding: 12px 0;
}

.schedule-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.interval-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.week-days-btn-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.once-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.error-tip {
  color: $error;
  font-size: 12px;
  margin-top: 4px;
}

.platform-select-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;

  .n-select {
    flex: 1;
  }
}

.platform-edit-btn {
  width: 34px;
  height: 34px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: transparent;
  color: $text-muted;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;

  &:hover {
    border-color: var(--accent-primary);
    color: var(--accent-primary);
    background: rgba(var(--accent-primary-rgb), 0.04);
  }
}
</style>

<!-- 非 scoped：平台下拉选项样式（teleport 到 body） -->
<style lang="css">
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
