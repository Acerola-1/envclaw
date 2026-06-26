<!-- packages/client/src/components/envclaw/platforms/PlatformConfigDrawer.vue -->
<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { NDrawer, NDrawerContent, NInput, NSelect, NButton, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { usePlatformsStore } from '@/stores/envclaw/platforms'
import type { Platform } from '@/api/envclaw/platforms'
import { fetchSkills } from '@/api/hermes/skills'

const props = defineProps<{
  show: boolean
  platform: Platform | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  saved: []
}>()

const { t } = useI18n()
const message = useMessage()
const platformsStore = usePlatformsStore()

const url = ref('')
const operationPrompt = ref('')
const skills = ref<string[]>([])
const functions = ref<Array<{ id?: string; name: string; prompt: string }>>([])

watch(() => props.platform, (p) => {
  if (p) {
    url.value = p.url || ''
    operationPrompt.value = p.operationPrompt
    skills.value = [...p.skills]
    functions.value = p.functions.map((f) => ({ id: f.id, name: f.name, prompt: f.prompt }))
  }
}, { immediate: true })

// 从 skills API 获取技能列表
const skillOptions = ref<Array<{ label: string; value: string }>>([])
const skillsLoading = ref(false)

async function loadSkills() {
  skillsLoading.value = true
  try {
    const data = await fetchSkills()
    const options: Array<{ label: string; value: string }> = []
    for (const cat of data.categories) {
      for (const skill of cat.skills) {
        options.push({ label: `${cat.name} / ${skill.name}`, value: skill.name })
      }
    }
    skillOptions.value = options
  } catch (err) {
    console.error('Failed to load skills:', err)
    skillOptions.value = []
  } finally {
    skillsLoading.value = false
  }
}

onMounted(() => {
  void loadSkills()
})

function addFunction() {
  functions.value.push({ name: '', prompt: '' })
}

function removeFunction(index: number) {
  functions.value.splice(index, 1)
}

async function handleSave() {
  if (!props.platform) return
  try {
    await platformsStore.updatePlatform(props.platform.id, {
      url: url.value || undefined,
      operationPrompt: operationPrompt.value,
      skills: skills.value,
      functions: functions.value,
    })
    message.success(t('common.saved'))
    emit('update:show', false)
    emit('saved')
  } catch (err: any) {
    message.error(err.message)
  }
}
</script>

<template>
  <NDrawer :show="show" :width="520" placement="right" @update:show="emit('update:show', $event)">
    <NDrawerContent :title="platform?.name || ''" closable>
      <div class="note">{{ t('envclaw.platforms.configNote') }}</div>

      <div class="field">
        <label>{{ t('envclaw.platforms.url') }}</label>
        <NInput
          v-model:value="url"
          :placeholder="t('envclaw.platforms.urlHint')"
        />
      </div>

      <div class="field">
        <label>{{ t('envclaw.platforms.operationPrompt') }}</label>
        <NInput
          v-model:value="operationPrompt"
          type="textarea"
          :rows="4"
          :placeholder="t('envclaw.platforms.operationPromptHint')"
        />
      </div>

      <div class="field">
        <label>{{ t('envclaw.platforms.platformSkills') }}</label>
        <NSelect
          v-model:value="skills"
          multiple
          filterable
          tag
          :options="skillOptions"
          :loading="skillsLoading"
          :placeholder="t('envclaw.platforms.platformSkillsHint')"
        />
      </div>

      <div class="field">
        <label>{{ t('envclaw.platforms.functions') }}</label>
        <div v-for="(fn, i) in functions" :key="i" class="fn-card">
          <NInput v-model:value="fn.name" :placeholder="t('envclaw.platforms.functionName')" size="small" />
          <NInput v-model:value="fn.prompt" type="textarea" :rows="2" :placeholder="t('envclaw.platforms.functionPromptHint')" size="small" />
          <NButton size="tiny" type="error" quaternary @click="removeFunction(i)">{{ t('envclaw.platforms.deleteFunction') }}</NButton>
        </div>
        <NButton size="small" dashed block @click="addFunction">
          + {{ t('envclaw.platforms.addFunction') }}
        </NButton>
      </div>

      <template #footer>
        <NButton type="primary" @click="handleSave">{{ t('common.save') }}</NButton>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped lang="scss">
.note { font-size: 12px; color: var(--envclaw-text-secondary); background: var(--envclaw-bg-tertiary); border-radius: 6px; padding: 8px 12px; margin-bottom: 16px; }
.field { margin-bottom: 18px; }
label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; }
.fn-card { background: var(--envclaw-bg-tertiary); border: 1px solid var(--envclaw-border); border-radius: 8px; padding: 10px; margin-bottom: 8px; display: flex; flex-direction: column; gap: 8px; }
</style>
