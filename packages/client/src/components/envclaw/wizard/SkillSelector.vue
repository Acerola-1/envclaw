<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSelect, NTag } from 'naive-ui'
import type { SkillInfo } from '@/api/hermes/skills'

const { t } = useI18n()

const props = defineProps<{
  /** 全部可选技能 */
  allSkills: SkillInfo[]
  /** 平台自带的技能列表 */
  platformSkills: string[]
  /** 已选技能 name（v-model），单选 */
  modelValue: string | null
  loading: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [name: string | null]
}>()

// 额外技能：从系统技能列表中排除平台自带的技能
const extraSkillOptions = computed(() => {
  return props.allSkills
    .filter(skill => !props.platformSkills.includes(skill.name))
    .map(skill => ({
      label: skill.name,
      value: skill.name,
    }))
})

function handleChange(value: string | null) {
  emit('update:modelValue', value)
}
</script>

<template>
  <div class="skill-selector">
    <div v-if="loading" class="skill-loading">{{ t('envclaw.wizard.loadingSkills') }}</div>
    <div v-else-if="platformSkills.length === 0 && extraSkillOptions.length === 0" class="skill-empty">{{ t('envclaw.wizard.noPlatformSkills') }}</div>
    <template v-else>
      <!-- 平台自带技能（不可删除） -->
      <div v-if="platformSkills.length > 0" class="platform-skills">
        <div class="platform-skills-label">{{ t('envclaw.wizard.platformBuiltinSkills') }}</div>
        <div class="platform-skills-list">
          <NTag
            v-for="skill in platformSkills"
            :key="skill"
            type="info"
            size="small"
            :bordered="false"
          >
            {{ skill }}
          </NTag>
        </div>
      </div>
      <!-- 额外技能选择 -->
      <div v-if="extraSkillOptions.length > 0" class="extra-skill">
        <div class="extra-skill-label">{{ t('envclaw.wizard.extraSkill') }}</div>
        <NSelect
          :value="modelValue"
          :options="extraSkillOptions"
          :placeholder="t('envclaw.wizard.selectSkillPlaceholder')"
          clearable
          @update:value="handleChange"
        />
      </div>
    </template>
    <div class="field-hint">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
        <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
      </svg>
      {{ t('envclaw.wizard.skillHint') }}
    </div>
  </div>
</template>

<style scoped lang="scss">
.skill-loading, .skill-empty {
  font-size: 12px; color: var(--envclaw-text-muted); padding: 8px 0;
}

.platform-skills {
  margin-bottom: 12px;
}

.platform-skills-label {
  font-size: 12px; color: var(--envclaw-text-secondary); margin-bottom: 6px; font-weight: 500;
}

.platform-skills-list {
  display: flex; gap: 6px; flex-wrap: wrap;
}

.extra-skill {
  margin-bottom: 8px;
}

.extra-skill-label {
  font-size: 12px; color: var(--envclaw-text-secondary); margin-bottom: 6px; font-weight: 500;
}

.field-hint {
  font-size: 11px; color: var(--envclaw-text-muted); margin-top: 6px;
  display: flex; align-items: center; gap: 5px;
}
</style>
