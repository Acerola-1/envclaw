<script setup lang="ts">
import { ref, onMounted, computed, h } from 'vue'
import { useRouter } from 'vue-router'
import { NModal, NForm, NFormItem, NInput, NButton, NSelect, NInputNumber, useMessage } from 'naive-ui'
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
import { getChannelContacts } from '@/api/client'
import { useI18n } from 'vue-i18n'
import SchedulePicker from '@/components/hermes/shared/SchedulePicker.vue'

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
const channelContacts = ref<Record<string, Array<{ id: string; name: string; type: string }>>>({})

const formData = ref({
  name: '',
  prompt: '',
  deliver: 'origin',
  skills: [] as string[],
  repeat_times: null as number | null,
})

const schedule = ref('0 9 * * *')  // 默认每天 9:00
const isEdit = computed(() => !!props.jobId)

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
  [...platformList]
    .sort((a, b) => {
      const aConfigured = isPlatformConfigured(a.key) ? 0 : 1
      const bConfigured = isPlatformConfigured(b.key) ? 0 : 1
      return aConfigured - bConfigured
    })
    .map(p => {
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

  // 加载平台联系人
  try {
    channelContacts.value = await getChannelContacts()
  } catch {
    channelContacts.value = {}
  }

  if (props.jobId) {
    try {
      const job = await getJob(props.jobId)
      originalJob.value = job
      formData.value = {
        name: job.name,
        prompt: job.prompt,
        deliver: job.deliver || 'origin',
        skills: job.skills || (job.skill ? [job.skill] : []),
        repeat_times: jobRepeatToEditValue(job.repeat),
      }
      schedule.value = scheduleToEditableInput(job.schedule, job.schedule_display || '')
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

  if (!schedule.value) {
    message.warning('请选择执行频率')
    return
  }

  loading.value = true
  try {
    if (isEdit.value) {
      if (!originalJob.value) {
        message.error(t('jobs.loadFailed'))
        return
      }
      const payload = buildJobUpdateRequest(originalJob.value, { ...formData.value, schedule: schedule.value })
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
        schedule: schedule.value,
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
        <SchedulePicker v-model="schedule" />
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
