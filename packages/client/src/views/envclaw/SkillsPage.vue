<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { NInput } from 'naive-ui'
import { fetchSkills } from '@/api/hermes/skills'
import type { SkillCategory, SkillInfo } from '@/api/hermes/skills'
import { useJobsStore } from '@/stores/hermes/jobs'
import SkillCategoryList from '@/components/envclaw/skills/SkillCategoryList.vue'
import SkillDetailPanel from '@/components/envclaw/skills/SkillDetailPanel.vue'

const { t } = useI18n()
const jobsStore = useJobsStore()

const categories = ref<SkillCategory[]>([])
const archived = ref<SkillInfo[]>([])
const loading = ref(false)
const searchQuery = ref('')
const selectedCategory = ref<string | null>(null)
const selectedSkillName = ref<string | null>(null)

const selectedSkill = computed<SkillInfo | null>(() => {
  if (!selectedCategory.value || !selectedSkillName.value) return null
  const cat = categories.value.find(c => c.name === selectedCategory.value)
  return cat?.skills.find(s => s.name === selectedSkillName.value) || null
})

const selectedKey = computed(() => {
  if (!selectedCategory.value || !selectedSkillName.value) return null
  return `${selectedCategory.value}/${selectedSkillName.value}`
})

async function loadSkills() {
  loading.value = true
  try {
    const data = await fetchSkills()
    categories.value = data.categories
    archived.value = data.archived ?? []
  } catch {
    categories.value = []
    archived.value = []
  } finally {
    loading.value = false
  }
}

function handleSelect(category: string, skillName: string) {
  selectedCategory.value = category
  selectedSkillName.value = skillName
}

onMounted(async () => {
  await loadSkills()
  if (jobsStore.jobs.length === 0) {
    await jobsStore.fetchJobs()
  }
})
</script>

<template>
  <div class="skills-page">
    <div class="page-header">
      <h1>{{ t('envclaw.skills.title') }}</h1>
      <p class="page-desc">{{ t('envclaw.skills.description') }}</p>
    </div>

    <div class="toolbar">
      <NInput
        v-model:value="searchQuery"
        :placeholder="t('envclaw.skills.searchPlaceholder')"
        size="small"
        clearable
        class="search-input"
      >
        <template #prefix>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </template>
      </NInput>
    </div>

    <div class="skills-split">
      <div class="split-left">
        <SkillCategoryList
          :categories="categories"
          :archived="archived"
          :selected-key="selectedKey"
          :search-query="searchQuery"
          @select="handleSelect"
        />
      </div>
      <div class="split-divider" />
      <div class="split-right">
        <SkillDetailPanel :category="selectedCategory" :skill="selectedSkill" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.skills-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 24px 28px;
  overflow: hidden;
}

.page-header {
  margin-bottom: 16px;
  flex-shrink: 0;
  h1 { font-size: 20px; font-weight: 600; color: var(--envclaw-text-primary); }
  .page-desc { font-size: 13px; color: var(--envclaw-text-secondary); margin-top: 4px; }
}

.toolbar {
  margin-bottom: 16px;
  flex-shrink: 0;
}

.search-input {
  width: 280px;
}

.skills-split {
  flex: 1;
  display: flex;
  min-height: 0;
  background: var(--envclaw-bg-secondary);
  border: 1px solid var(--envclaw-border);
  border-radius: 12px;
  overflow: hidden;
}

.split-left {
  width: 320px;
  flex-shrink: 0;
  overflow-y: auto;
}

.split-divider {
  width: 1px;
  background: var(--envclaw-border);
  flex-shrink: 0;
}

.split-right {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
}
</style>
