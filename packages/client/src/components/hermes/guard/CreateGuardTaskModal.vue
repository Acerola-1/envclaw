<script setup lang="ts">
import { ref, computed, onMounted, watch, h } from 'vue'
import { useRouter } from 'vue-router'
import { NModal, NInput, NInputNumber, NSelect, NButton } from 'naive-ui'
import { fetchSkills } from '@/api/hermes/skills'
import SchedulePicker from '@/components/hermes/shared/SchedulePicker.vue'
import type { SkillInfo } from '@/api/hermes/skills'
import { useSettingsStore } from '@/stores/hermes/settings'
import { useJobsStore } from '@/stores/hermes/jobs'
import { getJob, scheduleToEditableInput, jobRepeatToEditValue } from '@/api/hermes/jobs'
import type { Job } from '@/api/hermes/jobs'
import { getChannelContacts } from '@/api/client'
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
const channelContacts = ref<Record<string, Array<{ id: string; name: string; type: string }>>>({})
const schedule = ref('0 9 * * *')  // 默认每天 9:00

function goToChannels() {
  router.push({ name: 'hermes.channels' })
}

const platformOptions = computed(() =>
  platformList.map(p => {
    const configured = isPlatformConfigured(p.key)
    const contacts = channelContacts.value[p.key] || []
    const hasContacts = contacts.length > 0
    const deliverValue = hasContacts ? `${p.key}:${contacts[0].id}` : p.key
    return {
      label: () => h('span', { class: 'platform-option-label' }, [
        h('span', { class: 'platform-option-icon' }, p.icon),
        h('span', { class: 'platform-option-name' }, p.name),
        h('span', { class: `platform-option-status${configured ? ' configured' : ''}` }, configured ? '已配置' : '未配置'),
      ]),
      value: deliverValue,
    }
  })
)

// 1.3 技能选项数据
const skillsLoading = ref(false)
const skillOptions = ref<Array<{ label: string; value: string }>>([])
const selectedSkills = ref<string[]>([])

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

// 表单验证
const isFormValid = computed(() => {
  if (!taskName.value || !taskPrompt.value) return false
  return !!schedule.value
})

// 6.3 提交函数（创建/编辑）
async function handleCreate() {
  if (!isFormValid.value) return

  loading.value = true
  try {
    const payload = {
      name: taskName.value,
      schedule: schedule.value,
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
  schedule.value = '0 9 * * *'
  originalJob.value = null
}

// 弹窗打开时加载数据
watch(() => props.visible, async (visible) => {
  if (!visible) return

  resetForm()

  // 加载平台联系人
  try {
    channelContacts.value = await getChannelContacts()
  } catch {
    channelContacts.value = {}
  }

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
      schedule.value = scheduleToEditableInput(job.schedule, job.schedule_display || '')
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

      <!-- 执行频率 -->
      <div class="form-item">
        <label class="form-label">执行频率</label>
        <SchedulePicker v-model="schedule" />
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
