<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSelect, useMessage } from 'naive-ui'
import { useTemplatesStore } from '@/stores/envclaw/templates'
import { usePlatformsStore } from '@/stores/envclaw/platforms'
import { useJobsStore } from '@/stores/hermes/jobs'
import { usePromptAssembly } from '@/composables/envclaw/usePromptAssembly'
import { useSkillList } from '@/composables/envclaw/useSkillList'
import SchedulePicker from '@/components/hermes/shared/SchedulePicker.vue'
import PromptPreview from './PromptPreview.vue'
import FunctionSelector from './FunctionSelector.vue'
import SkillSelector from './SkillSelector.vue'
import DeliverSelector from './DeliverSelector.vue'

const { t } = useI18n()
const message = useMessage()
const templatesStore = useTemplatesStore()
const platformsStore = usePlatformsStore()
const jobsStore = useJobsStore()
const { allSkills, loading: skillsLoading } = useSkillList()

// 平台选项
const platformOptions = computed(() => {
  return platformsStore.platforms.map(p => ({
    label: p.name,
    value: p.id,
  }))
})

const props = defineProps<{
  templateId: string
}>()

const emit = defineEmits<{
  created: []
  cancel: []
}>()

// ── 1. 任务名称 ──
const taskName = ref('')

// ── 2. 数据平台（多选） ──
const selectedPlatformIds = ref<string[]>([])

const selectedPlatforms = computed(() => {
  return selectedPlatformIds.value
    .map(id => platformsStore.platforms.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p)
})

// ── 3. 功能（多选） ──
const selectedFunctionIds = ref<string[]>([])

// 合并所有选中平台的功能
const platformFunctions = computed(() => {
  const functions: Array<{ id: string; name: string; prompt: string }> = []
  for (const platform of selectedPlatforms.value) {
    for (const fn of platform.functions ?? []) {
      if (!functions.some(f => f.id === fn.id)) {
        functions.push(fn)
      }
    }
  }
  return functions
})

const selectedFunctionObjects = computed(() => {
  return platformFunctions.value.filter((fn) => selectedFunctionIds.value.includes(fn.id))
})

// ── 4. 执行提示词 ──
const template = computed(() => templatesStore.getById(props.templateId))
const roleBasePrompt = computed(() => template.value?.roleBasePrompt ?? '')
const supplement = ref('')

// 合并所有选中平台的信息
const mergedPlatformInfo = computed(() => {
  if (selectedPlatforms.value.length === 0) return null
  if (selectedPlatforms.value.length === 1) {
    const p = selectedPlatforms.value[0]
    return { name: p.name, url: p.url || undefined, operationPrompt: p.operationPrompt }
  }
  // 多个平台时，合并名称、网址和操作提示词
  const names = selectedPlatforms.value.map(p => p.name).join('、')
  const urls = selectedPlatforms.value
    .filter(p => p.url)
    .map(p => p.url)
    .join('、')
  const prompts = selectedPlatforms.value
    .map(p => {
      const urlLine = p.url ? `网址: ${p.url}\n` : ''
      return `【${p.name}】\n${urlLine}${p.operationPrompt}`
    })
    .join('\n\n')
  return { name: names, url: urls || undefined, operationPrompt: prompts }
})

const { promptSegments, assembledPrompt } = usePromptAssembly({
  roleBasePrompt,
  selectedPlatform: mergedPlatformInfo,
  selectedFunctions: selectedFunctionObjects,
  supplement,
})

// ── 5. 执行频率 ──
const schedule = ref('0 8 * * *')

// ── 6. 推送平台 ──
const selectedDeliverKey = ref<string | null>(null)

// ── 7. 可选技能 ──
/** 合并所有选中平台的技能 */
const platformSkillNames = computed(() => {
  const skills: string[] = []
  for (const platform of selectedPlatforms.value) {
    for (const skill of platform.skills ?? []) {
      if (!skills.includes(skill)) {
        skills.push(skill)
      }
    }
  }
  return skills
})

/** 已选技能（单选） */
const selectedSkillName = ref<string | null>(null)

// 当平台切换时，重置功能选择和技能选择
watch(selectedPlatformIds, () => {
  selectedFunctionIds.value = []
  selectedSkillName.value = null
})

// ── 提交 ──
const submitting = ref(false)

async function handleSubmit() {
  // 校验
  if (!taskName.value.trim()) {
    message.warning(t('envclaw.wizard.nameRequired'))
    return
  }
  if (selectedPlatformIds.value.length === 0) {
    message.warning(t('envclaw.wizard.platformRequired'))
    return
  }
  if (!schedule.value) {
    message.warning(t('envclaw.wizard.scheduleRequired'))
    return
  }

  submitting.value = true
  try {
    await jobsStore.createJob({
      name: taskName.value.trim(),
      schedule: schedule.value,
      prompt: assembledPrompt.value || undefined,
      deliver: selectedDeliverKey.value || undefined,
      skills: selectedSkillName.value ? [selectedSkillName.value] : undefined,
    })

    message.success(t('envclaw.wizard.createSuccess'))
    emit('created')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    message.error(t('envclaw.wizard.createFailed', { error: msg }))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="template-wizard">
    <div class="wiz-body">
      <!-- 1 任务名称 -->
      <div class="field">
        <div class="field-label">
          <span class="field-num">1</span>
          {{ t('envclaw.wizard.taskName') }}
          <span class="req">*</span>
        </div>
        <input
          v-model="taskName"
          class="input"
          :placeholder="t('envclaw.wizard.taskNamePlaceholder')"
        />
      </div>

      <!-- 2 数据平台 -->
      <div class="field">
        <div class="field-label">
          <span class="field-num">2</span>
          {{ t('envclaw.wizard.dataPlatform') }}
          <span class="req">*</span>
          <span class="opt">{{ t('envclaw.wizard.multiSelectPlatform') }}</span>
        </div>
        <NSelect
          v-model:value="selectedPlatformIds"
          :options="platformOptions"
          multiple
          :placeholder="t('envclaw.wizard.selectPlatformPlaceholder')"
        />
        <div class="field-hint">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
          </svg>
          {{ t('envclaw.wizard.platformHint') }}
        </div>
      </div>

      <!-- 3 功能（选平台后出现） -->
      <div class="field">
        <div class="field-label">
          <span class="field-num">3</span>
          {{ t('envclaw.wizard.platformFunctions') }}
          <span class="opt">{{ t('envclaw.wizard.multiSelectFromPlatform') }}</span>
        </div>
        <FunctionSelector
          :functions="platformFunctions"
          v-model="selectedFunctionIds"
        />
      </div>

      <!-- 4 执行提示词 -->
      <div class="field">
        <div class="field-label">
          <span class="field-num">4</span>
          {{ t('envclaw.wizard.executionPrompt') }}
        </div>
        <PromptPreview
          :segments="promptSegments"
          :supplement="supplement"
          @update:supplement="supplement = $event"
        />
      </div>

      <!-- 5 执行频率 -->
      <div class="field">
        <div class="field-label">
          <span class="field-num">5</span>
          {{ t('envclaw.wizard.executionFrequency') }}
          <span class="req">*</span>
        </div>
        <SchedulePicker v-model="schedule" />
      </div>

      <!-- 6 推送平台 -->
      <div class="field">
        <div class="field-label">
          <span class="field-num">6</span>
          {{ t('envclaw.wizard.deliverPlatform') }}
          <span class="opt">{{ t('envclaw.wizard.deliverOptional') }}</span>
        </div>
        <DeliverSelector v-model="selectedDeliverKey" />
      </div>

      <!-- 7 可选技能 -->
      <div class="field">
        <div class="field-label">
          <span class="field-num">7</span>
          {{ t('envclaw.wizard.optionalSkills') }}
          <span class="opt">{{ t('envclaw.wizard.skillOptional') }}</span>
        </div>
        <SkillSelector
          v-model="selectedSkillName"
          :all-skills="allSkills"
          :platform-skills="platformSkillNames"
          :loading="skillsLoading"
        />
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div class="wiz-foot">
      <button class="btn btn-ghost" @click="emit('cancel')">
        {{ t('envclaw.wizard.cancel') }}
      </button>
      <button
        class="btn btn-primary"
        :disabled="submitting"
        @click="handleSubmit"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        {{ submitting ? t('envclaw.wizard.creating') : t('envclaw.wizard.createTask') }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.template-wizard {
  display: flex; flex-direction: column; flex: 1; overflow: hidden;
}

.wiz-body {
  flex: 1; overflow-y: auto; padding: 18px 22px;
  &::-webkit-scrollbar { width: 8px; }
  &::-webkit-scrollbar-thumb { background: var(--envclaw-border); border-radius: 6px; }
}

.field { margin-bottom: 20px; }

.field-label {
  font-size: 12.5px; color: var(--envclaw-text-secondary); margin-bottom: 8px; font-weight: 500;
  display: flex; align-items: center; gap: 6px;
}

.field-num {
  display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px; border-radius: 5px;
  background: var(--envclaw-bg-tertiary); border: 1px solid var(--envclaw-border);
  font-size: 10.5px; color: var(--envclaw-text-secondary); font-weight: 600;
}

.req { color: var(--envclaw-error); }
.opt { color: var(--envclaw-text-muted); font-weight: 400; }

.input, .select {
  width: 100%; padding: 10px 12px; background: var(--envclaw-input-bg);
  border: 1px solid var(--envclaw-input-border); border-radius: 8px;
  color: var(--envclaw-text-primary); font-size: 13px; font-family: 'Inter', system-ui, sans-serif;
  &:focus { outline: none; border-color: var(--envclaw-input-border-focus); }
}

.select {
  cursor: pointer; appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23a0a0a0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 12px center;
}

.field-hint {
  font-size: 11px; color: var(--envclaw-text-muted); margin-top: 6px;
  display: flex; align-items: center; gap: 5px;
}

.wiz-foot {
  padding: 14px 22px; border-top: 1px solid var(--envclaw-border);
  display: flex; justify-content: flex-end; gap: 10px;
}

.btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 500;
  cursor: pointer; border: 1px solid transparent; transition: 0.15s;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

.btn-primary {
  background: var(--envclaw-button-bg); color: var(--envclaw-button-text);
  &:hover:not(:disabled) { background: var(--envclaw-button-bg-hover); }
}

.btn-ghost {
  background: transparent; color: var(--envclaw-text-primary); border-color: var(--envclaw-border-light);
  &:hover { background: var(--envclaw-bg-tertiary); }
}
</style>
