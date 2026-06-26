<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSwitch, useMessage } from 'naive-ui'
import type { SkillCategory, SkillInfo, SkillSource } from '@/api/hermes/skills'
import { toggleSkill } from '@/api/hermes/skills'

const props = defineProps<{
  categories: SkillCategory[]
  archived: SkillInfo[]
  selectedKey: string | null
  searchQuery: string
}>()

const emit = defineEmits<{
  select: [category: string, skill: string]
}>()

const { t } = useI18n()
const message = useMessage()

const collapsedCategories = ref<Set<string>>(new Set())
const togglingSkills = ref<Set<string>>(new Set())

const filteredCategories = computed(() => {
  if (!props.searchQuery) return props.categories
  const q = props.searchQuery.toLowerCase()
  return props.categories
    .map(cat => ({
      ...cat,
      skills: cat.skills.filter(
        s => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q),
      ),
    }))
    .filter(cat => cat.skills.length > 0 || cat.name.toLowerCase().includes(q))
})

function toggleCategory(name: string) {
  if (collapsedCategories.value.has(name)) {
    collapsedCategories.value.delete(name)
  } else {
    collapsedCategories.value.add(name)
  }
}

function skillKey(catName: string, skill: { name: string }): string {
  return `${catName}/${skill.name}`
}

function handleSelect(category: string, skillName: string) {
  emit('select', category, skillName)
}

function sourceDotClass(source?: SkillSource): string {
  return `dot-${source || 'local'}`
}

function sourceLabel(source?: SkillSource): string {
  const key = source || 'local'
  return t(`envclaw.skills.source.${key}`)
}

async function handleToggle(category: string, skillName: string, newEnabled: boolean) {
  if (togglingSkills.value.has(skillName)) return
  togglingSkills.value.add(skillName)
  try {
    await toggleSkill(skillName, newEnabled)
    const cat = props.categories.find(c => c.name === category)
    const skill = cat?.skills.find(s => s.name === skillName)
    if (skill) skill.enabled = newEnabled
  } catch (err: any) {
    message.error(t('envclaw.skills.toggleFailed') + `: ${err.message}`)
  } finally {
    togglingSkills.value.delete(skillName)
  }
}
</script>

<template>
  <div class="skill-list">
    <div v-if="filteredCategories.length === 0" class="skill-empty">
      {{ searchQuery ? t('envclaw.skills.noMatch') : t('envclaw.skills.noSkills') }}
    </div>

    <div v-for="cat in filteredCategories" :key="cat.name" class="skill-category">
      <button class="category-header" @click="toggleCategory(cat.name)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="category-arrow" :class="{ collapsed: collapsedCategories.has(cat.name) }">
          <polyline points="6 9 12 15 18 9" />
        </svg>
        <span class="category-name">{{ cat.name }}</span>
        <span class="category-count">{{ cat.skills.length }}</span>
      </button>
      <div v-if="!collapsedCategories.has(cat.name)" class="category-skills">
        <div
          v-for="skill in cat.skills"
          :key="skillKey(cat.name, skill)"
          :class="['skill-item', { active: selectedKey === skillKey(cat.name, skill) }]"
          @click="handleSelect(cat.name, skill.name)"
        >
          <div class="skill-info">
            <span class="skill-name">
              <span :class="['source-dot', sourceDotClass(skill.source)]" :title="sourceLabel(skill.source)" />
              {{ skill.name }}
            </span>
            <span v-if="skill.description" class="skill-desc">{{ skill.description }}</span>
          </div>
          <NSwitch
            size="small"
            :value="skill.enabled !== false"
            :loading="togglingSkills.has(skill.name)"
            @update:value="handleToggle(cat.name, skill.name, $event)"
            @click.stop
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.skill-list {
  padding: 8px;
}

.skill-empty {
  padding: 24px 16px;
  font-size: 13px;
  color: var(--envclaw-text-muted);
  text-align: center;
}

.skill-category {
  margin-bottom: 4px;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 10px;
  border: none;
  background: none;
  color: var(--envclaw-text-secondary);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  cursor: pointer;
  border-radius: 6px;

  &:hover { background: var(--envclaw-bg-tertiary); }
}

.category-arrow {
  flex-shrink: 0;
  transition: transform 0.15s;
  &.collapsed { transform: rotate(-90deg); }
}

.category-name {
  flex: 1;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-count {
  font-size: 11px;
  color: var(--envclaw-text-muted);
  background: var(--envclaw-bg-tertiary);
  padding: 1px 6px;
  border-radius: 8px;
}

.category-skills {
  padding: 2px 0 4px;
}

.skill-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px 6px 28px;
  border: none;
  background: none;
  color: var(--envclaw-text-secondary);
  font-size: 13px;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s;
  gap: 8px;

  &:hover { background: var(--envclaw-bg-tertiary); color: var(--envclaw-text-primary); }
  &.active { background: rgba(106, 159, 217, 0.1); color: var(--envclaw-text-primary); font-weight: 500; }
}

.skill-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.skill-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 6px;
}

.source-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;

  &.dot-builtin { background: #888; }
  &.dot-hub { background: #4a90d9; }
  &.dot-local { background: var(--envclaw-success); }
  &.dot-external { background: var(--envclaw-warning); }
}

.skill-desc {
  font-size: 11px;
  color: var(--envclaw-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
  padding-left: 14px;
}
</style>
