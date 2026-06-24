<script setup lang="ts">
import { ref, computed, onMounted, watch, h } from 'vue'
import { useRouter } from 'vue-router'
import { NModal, NInput, NInputNumber, NSelect, NButton, NTimePicker, NTabs, NTabPane, NDatePicker } from 'naive-ui'
import { fetchSkills } from '@/api/hermes/skills'
import type { SkillInfo } from '@/api/hermes/skills'
import { useSettingsStore } from '@/stores/hermes/settings'
import { useJobsStore } from '@/stores/hermes/jobs'
import { getJob, scheduleToEditableInput, jobRepeatToEditValue } from '@/api/hermes/jobs'
import type { Job } from '@/api/hermes/jobs'
import { useMessage } from 'naive-ui'

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
  jobId?: string | null
}>()

const emit = defineEmits<{
  close: []
  create: [task: any]
}>()

const isEdit = computed(() => !!props.jobId)
const originalJob = ref<Job | null>(null)

// 基础表单数据
const taskName = ref('')
const taskPrompt = ref('')

const router = useRouter()
const settingsStore = useSettingsStore()
const jobsStore = useJobsStore()
const message = useMessage()

// 推送平台列表（与 PlatformSettings.vue 一致）
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

// 判断平台是否已配置（与 PlatformCard.vue 逻辑一致）
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

const notifyPlatform = ref<string | null>('')
const notifyGroupId = ref('')
const repeat_times = ref<number | null>(null)
const loading = ref(false)

function goToChannels() {
  router.push({ name: 'hermes.channels' })
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

// 1.2 调度配置数据
const scheduleMode = ref<'period' | 'interval' | 'once'>('period')

// 周期模式
const periodType = ref<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily')
const periodTime = ref<number | null>(new Date().setHours(9, 0, 0, 0))
const periodWeekDays = ref<number[]>([1])  // 每周模式选择的周几，默认周一

// 间隔模式
const intervalHours = ref(2)
const intervalDays = ref<number[]>([1, 2, 3, 4, 5])  // 默认周一到周五

// 单次模式
const onceTime = ref<number | null>(new Date().setHours(9, 0, 0, 0))
const onceDate = ref<number | null>(null)

// 生效日期区间
const effectiveDateRange = ref<[number, number] | null>(null)

// 1.3 技能选项数据
const skillsLoading = ref(false)
const skillOptions = ref<Array<{ label: string; value: string }>>([])
const selectedSkills = ref<string[]>([])

// 选项配置
const periodOptions = computed(() => [
  { label: '每天', value: 'daily' },
  { label: '每周', value: 'weekly' },
  { label: '每月', value: 'monthly' },
  { label: '每年', value: 'yearly' }
])

const weekDayOptions = computed(() => [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 0 }
])

// 4.2 buildSkillOptions 函数（从 JobFormModal 复制）
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

// 4.3 loadSkillOptions 函数（从 JobFormModal 复制）
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

// 切换间隔日期选择
function toggleIntervalDay(day: number) {
  const index = intervalDays.value.indexOf(day)
  if (index === -1) {
    intervalDays.value.push(day)
  } else {
    intervalDays.value.splice(index, 1)
  }
}

// 格式化时间为 HH:mm
function formatTime(timestamp: number | null): string {
  if (!timestamp) return '09:00'
  const date = new Date(timestamp)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

// 5.1 间隔小时数验证
const isIntervalValid = computed(() => {
  return intervalHours.value >= 1 && intervalHours.value <= 24
})

// 5.2 至少选择一天验证
const isIntervalDaysValid = computed(() => {
  return intervalDays.value.length > 0
})

// 5.3 单次日期不能早于今天验证
const isOnceDateValid = computed(() => {
  if (!onceDate.value) return true
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const selected = new Date(onceDate.value)
  return selected >= today
})

// 5.4 生效日期区间验证
const isEffectiveDateValid = computed(() => {
  if (!effectiveDateRange.value) return true
  const [start, end] = effectiveDateRange.value
  return new Date(start) <= new Date(end)
})

// 6.1 周期模式 cron 表达式生成
function generatePeriodCron(): string {
  const time = formatTime(periodTime.value)
  const [hour, minute] = time.split(':').map(Number)

  switch (periodType.value) {
    case 'daily':
      return `${minute} ${hour} * * *`
    case 'weekly': {
      const days = periodWeekDays.value.length > 0
        ? periodWeekDays.value.sort().join(',')
        : '1'  // 默认周一
      return `${minute} ${hour} * * ${days}`
    }
    case 'monthly':
      return `${minute} ${hour} 1 * *`
    case 'yearly':
      return `${minute} ${hour} 1 1 *`
    default:
      return `${minute} ${hour} * * *`
  }
}

// 6.2 间隔模式 cron 表达式生成
function generateIntervalCron(): string {
  const days = intervalDays.value.sort().join(',')
  return `0 */${intervalHours.value} * * ${days}`
}

/** 从 cron 表达式反向解析调度 UI 状态（用于编辑模式） */
function parseScheduleFromCron(schedule: string) {
  if (!schedule) return
  const parts = schedule.trim().split(/\s+/)
  if (parts.length < 5) return

  const [minuteStr, hourStr, dom, month, dow] = parts
  const minute = parseInt(minuteStr)
  const hour = parseInt(hourStr)

  // 间隔模式: 0 */N * * days 或 0 * * * *（每小时）
  if (minuteStr === '0' && (hourStr.startsWith('*/') || hourStr === '*')) {
    scheduleMode.value = 'interval'
    intervalHours.value = hourStr === '*' ? 1 : (parseInt(hourStr.slice(2)) || 2)
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

// 表单验证
const isFormValid = computed(() => {
  if (!taskName.value || !taskPrompt.value) return false

  if (scheduleMode.value === 'interval') {
    return isIntervalValid.value && isIntervalDaysValid.value
  }

  if (scheduleMode.value === 'once') {
    return isOnceDateValid.value && onceDate.value !== null
  }

  return true
})

// 6.3 提交函数（创建/编辑）
async function handleCreate() {
  if (!isFormValid.value) return

  loading.value = true
  try {
    const schedule = scheduleMode.value === 'period'
      ? generatePeriodCron()
      : scheduleMode.value === 'interval'
        ? generateIntervalCron()
        : ''

    const payload = {
      name: taskName.value,
      schedule,
      prompt: taskPrompt.value,
      deliver: notifyPlatform.value || 'origin',
      skills: selectedSkills.value,
      repeat: repeat_times.value ?? undefined,
    }

    if (isEdit.value && props.jobId) {
      await jobsStore.updateJob(props.jobId, payload)
      message.success('任务更新成功')
    } else {
      await jobsStore.createJob(payload)
      message.success('任务创建成功')
    }
    emit('create', payload)
  } catch (e: any) {
    message.error((isEdit.value ? '任务更新失败' : '任务创建失败') + ': ' + (e.message || e))
  } finally {
    loading.value = false
  }
}

function handleClose() {
  emit('close')
}

// 重置表单到默认值
function resetForm() {
  taskName.value = ''
  taskPrompt.value = ''
  notifyPlatform.value = 'origin'
  notifyGroupId.value = ''
  repeat_times.value = null
  selectedSkills.value = []
  scheduleMode.value = 'period'
  periodType.value = 'daily'
  periodTime.value = new Date().setHours(9, 0, 0, 0)
  periodWeekDays.value = [1]
  intervalHours.value = 2
  intervalDays.value = [1, 2, 3, 4, 5]
  onceTime.value = new Date().setHours(9, 0, 0, 0)
  onceDate.value = null
  effectiveDateRange.value = null
  originalJob.value = null
}

// 弹窗打开时加载数据
watch(() => props.visible, async (visible) => {
  if (!visible) return

  resetForm()

  // 编辑模式：加载已有任务数据
  if (props.jobId) {
    try {
      const job = await getJob(props.jobId)
      originalJob.value = job
      taskName.value = job.name || ''
      taskPrompt.value = job.prompt || ''
      notifyPlatform.value = job.deliver || null
      selectedSkills.value = job.skills || (job.skill ? [job.skill] : [])
      repeat_times.value = jobRepeatToEditValue(job.repeat)
      parseScheduleFromCron(scheduleToEditableInput(job.schedule, job.schedule_display || ''))
    } catch (e: any) {
      message.error('加载任务失败: ' + (e.message || e))
    }
  } else if (props.robot) {
    // 新建模式：从 robot 自动填充
    taskName.value = props.robot.name || ''
    taskPrompt.value = props.robot.description || ''
  }
}, { immediate: true })

// 4.1 加载技能列表和平台配置
onMounted(() => {
  loadSkillOptions()
  settingsStore.fetchSettings()
})
</script>

<template>
  <NModal :show="visible" @update:show="(val) => !val && handleClose()" preset="card"
    :title="isEdit ? '编辑任务' : `创建 ${robot?.name || ''} 任务`" :style="{ width: '600px', maxHeight: '80vh' }" :bordered="false" :segmented="{
      content: true,
      footer: true
    }" class="create-guard-modal">
    <div class="create-form">
      <div class="form-item">
        <label class="form-label">任务名称</label>
        <NInput v-model:value="taskName" placeholder="请输入任务名称" maxlength="50" />
      </div>

      <!-- 4.5 将技能选择器嵌入提示词输入框内部下方 -->
      <div class="form-item">
        <label class="form-label">执行提示词</label>
        <div class="prompt-container">
          <NInput v-model:value="taskPrompt" type="textarea" placeholder="请输入分析提示词" :rows="4" maxlength="500"
            class="prompt-textarea" />
          <div class="skills-in-prompt">
            <NSelect v-model:value="selectedSkills" multiple filterable clearable :loading="skillsLoading"
              :options="skillOptions" placeholder="选择技能（可选）" size="small" />
          </div>
        </div>
      </div>

      <!-- 2.1 执行频率 Tab 切换 -->
      <div class="form-item">
        <label class="form-label">执行频率</label>
        <NTabs v-model:value="scheduleMode" type="segment" animated>
          <!-- 2.2 周期模式 -->
          <NTabPane name="period" tab="周期">
            <div class="schedule-content">
              <div class="schedule-row">
                <NSelect v-model:value="periodType" :options="periodOptions" style="width: 120px" />
                <!-- 每周模式：选择周几 -->
                <NSelect v-if="periodType === 'weekly'" v-model:value="periodWeekDays" multiple
                  :options="weekDayOptions" placeholder="选择周几" style="width: 240px" />
                <NTimePicker v-model:value="periodTime" format="HH:mm" style="width: 120px" />
              </div>
            </div>
          </NTabPane>

          <!-- 2.3 按间隔模式 -->
          <NTabPane name="interval" tab="按间隔">
            <div class="schedule-content">
              <div class="interval-row">
                <span>每</span>
                <NInputNumber v-model:value="intervalHours" :min="1" :max="24" style="width: 80px"
                  :status="!isIntervalValid ? 'error' : undefined" />
                <span>小时</span>
              </div>
              <div v-if="!isIntervalValid" class="error-tip">请输入 1-24 之间的数字</div>

              <!-- 按钮样式的复选 -->
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

          <!-- 2.4 单次模式 -->
          <!-- <NTabPane name="once" tab="单次">
            <div class="schedule-content">
              <div class="once-row">
                <NDatePicker v-model:value="onceDate" type="date" placeholder="选择日期" style="width: 200px"
                  :is-date-disabled="(timestamp: number) => timestamp < Date.now() - 86400000" />
                <NTimePicker v-model:value="onceTime" format="HH:mm" style="width: 120px" />
              </div>
              <div v-if="!isOnceDateValid" class="error-tip">请选择今天或之后的日期</div>
            </div>
          </NTabPane> -->
        </NTabs>
      </div>

      <!-- 3.3 生效日期区间（仅在周期和按间隔模式下显示） -->
      <!-- <div class="form-item" v-if="scheduleMode === 'period' || scheduleMode === 'interval'">
        <label class="form-label">生效日期区间</label>
        <NDatePicker v-model:value="effectiveDateRange" type="daterange" start-placeholder="开始日期" end-placeholder="结束日期"
          :is-date-disabled="(timestamp: number) => timestamp < Date.now() - 86400000"
          :status="!isEffectiveDateValid ? 'error' : undefined" />
        <div v-if="!isEffectiveDateValid" class="error-tip">结束日期必须晚于开始日期</div>
      </div> -->

      <div class="form-item">
        <label class="form-label">推送平台 <span class="form-label-optional">（可选）</span></label>
        <div class="platform-select-row">
          <NSelect
            v-model:value="notifyPlatform"
            :options="platformOptions"
            placeholder="选择推送平台"
            clearable
            filterable
          />
          <button class="platform-edit-btn" @click="goToChannels" title="前往渠道管理编辑">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        </div>
      </div>

      <div class="form-item">
        <label class="form-label">推送群ID</label>
        <NInput v-model:value="notifyGroupId" placeholder="请输入推送群ID" />
      </div>

      <div class="form-item">
        <label class="form-label">重复次数 <span class="form-label-optional">（可选）</span></label>
        <NInputNumber
          v-model:value="repeat_times"
          :min="1"
          placeholder="不限制"
          clearable
          style="width: 100%"
        />
      </div>
    </div>

    <template #footer>
      <div class="form-footer">
        <NButton @click="handleClose">取消</NButton>
        <NButton type="primary" :disabled="!isFormValid" :loading="loading" @click="handleCreate">
           {{isEdit ? '保存任务' : '创建任务'}}
        </NButton>
      </div>
    </template>
  </NModal>
</template>
<style lang="css">
.n-card-content {
  overflow-y: auto;
}

.platform-option {
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

.prompt-container {
  border: 1px solid $border-color;
  border-radius: 6px;
  overflow: hidden;

  &:focus-within {
    // border-color: $primary-color;
  }
}

.prompt-textarea {
  border: none;
  border-radius: 0;

  :deep(.n-input__border),
  :deep(.n-input__state-border) {
    display: none;
  }
}

.skills-in-prompt {
  padding: 8px 12px;
  border-top: 1px solid $border-color;
  background-color: $bg-secondary;
}

.schedule-content {
  padding: 16px 0;
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
  // color: $error-color;
  font-size: 12px;
  margin-top: 4px;
}

.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

// 推送平台选择器
.platform-select-row {
  display: flex;
  align-items: center;
  gap: 8px;

  .n-select {
    flex: 1;
  }
}

.form-label-optional {
  font-size: 12px;
  font-weight: 400;
  color: $text-muted;
}

.platform-selected {
  display: inline-flex;
  align-items: center;
  gap: 4px;
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
  transition: all $transition-fast;

  &:hover {
    border-color: var(--accent-primary);
    color: var(--accent-primary);
    background: rgba(var(--accent-primary-rgb), 0.04);
  }
}

// 弹窗内部滚动
.create-guard-modal {
  :deep(.n-card) {
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }

  :deep(.n-card__content) {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
}
</style>
