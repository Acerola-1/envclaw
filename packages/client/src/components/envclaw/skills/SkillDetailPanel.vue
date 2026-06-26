<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSwitch, NSpin, useMessage } from 'naive-ui'
import type { SkillInfo } from '@/api/hermes/skills'
import { fetchSkillContent, toggleSkill } from '@/api/hermes/skills'
import { useJobsStore } from '@/stores/hermes/jobs'
import MarkdownRenderer from '@/components/hermes/chat/MarkdownRenderer.vue'

const props = defineProps<{
  category: string | null
  skill: SkillInfo | null
}>()

const { t } = useI18n()
const message = useMessage()
const jobsStore = useJobsStore()

const content = ref('')
const contentLoading = ref(false)
const toggling = ref(false)

const skillEnabled = computed(() => props.skill?.enabled !== false)

const sourceLabel = computed(() => {
  const source = props.skill?.source || 'local'
  return t(`envclaw.skills.source.${source}`)
})

const sourceDotClass = computed(() => `dot-${props.skill?.source || 'local'}`)

// Find which jobs use this skill
const usedByJobs = computed(() => {
  if (!props.skill) return []
  const skillName = props.skill.name
  return jobsStore.jobs.filter(j => j.skills && j.skills.includes(skillName))
})

async function loadContent() {
  if (!props.category || !props.skill) {
    content.value = ''
    return
  }
  contentLoading.value = true
  try {
    const skillPath = `${props.category}/${props.skill.name}/SKILL.md`
    content.value = await fetchSkillContent(skillPath)
  } catch {
    content.value = t('envclaw.skills.detail.loadContentFailed')
  } finally {
    contentLoading.value = false
  }
}

async function handleToggle(newEnabled: boolean) {
  if (!props.skill || toggling.value) return
  toggling.value = true
  try {
    await toggleSkill(props.skill.name, newEnabled)
    if (props.skill) props.skill.enabled = newEnabled
  } catch (err: any) {
    message.error(t('envclaw.skills.toggleFailed') + `: ${err.message}`)
  } finally {
    toggling.value = false
  }
}

watch(() => props.skill ? `${props.category}/${props.skill.name}` : null, loadContent, { immediate: true })
</script>

<template>
  <div class="detail-panel">
    <div v-if="!skill" class="no-selection">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="empty-icon">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      <p>{{ t('envclaw.skills.detail.noSelection') }}</p>
    </div>

    <template v-else>
      <div class="detail-header">
        <div class="detail-title-row">
          <span :class="['source-dot-lg', sourceDotClass]" />
          <h2>{{ skill.name }}</h2>
          <span class="source-tag">{{ sourceLabel }}</span>
        </div>
        <NSwitch
          :value="skillEnabled"
          :loading="toggling"
          @update:value="handleToggle"
        >
          <template #checked>{{ t('envclaw.skills.enabled') }}</template>
          <template #unchecked>{{ t('envclaw.skills.disabled') }}</template>
        </NSwitch>
      </div>

      <div class="detail-body">
        <!-- Description -->
        <div v-if="skill.description" class="detail-section">
          <div class="section-label">{{ t('envclaw.skills.detail.description') }}</div>
          <p class="section-text">{{ skill.description }}</p>
        </div>

        <!-- Used by tasks -->
        <div class="detail-section">
          <div class="section-label">{{ t('envclaw.skills.detail.usedByTasks') }}</div>
          <div v-if="usedByJobs.length === 0" class="section-empty">{{ t('envclaw.skills.detail.noTasks') }}</div>
          <div v-else class="task-list">
            <span v-for="job in usedByJobs" :key="job.job_id || job.id" class="task-tag">{{ job.name }}</span>
          </div>
        </div>

        <!-- Content preview -->
        <div class="detail-section">
          <div class="section-label">{{ t('envclaw.skills.detail.contentPreview') }}</div>
          <NSpin :show="contentLoading">
            <div v-if="content" class="content-preview">
              <MarkdownRenderer :content="content" />
            </div>
          </NSpin>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.detail-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.no-selection {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--envclaw-text-muted);
  gap: 12px;

  .empty-icon { opacity: 0.3; }
  p { font-size: 13px; }
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid var(--envclaw-border);
  flex-shrink: 0;
}

.detail-title-row {
  display: flex;
  align-items: center;
  gap: 8px;

  h2 { font-size: 16px; font-weight: 600; color: var(--envclaw-text-primary); margin: 0; }
}

.source-dot-lg {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;

  &.dot-builtin { background: #888; }
  &.dot-hub { background: #4a90d9; }
  &.dot-local { background: var(--envclaw-success); }
  &.dot-external { background: var(--envclaw-warning); }
}

.source-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--envclaw-bg-tertiary);
  border: 1px solid var(--envclaw-border);
  color: var(--envclaw-text-secondary);
}

.detail-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px;
}

.detail-section {
  margin-bottom: 20px;
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--envclaw-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: 8px;
}

.section-text {
  font-size: 13px;
  color: var(--envclaw-text-secondary);
  line-height: 1.6;
  margin: 0;
}

.section-empty {
  font-size: 12px;
  color: var(--envclaw-text-muted);
}

.task-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.task-tag {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 12px;
  background: var(--envclaw-bg-tertiary);
  border: 1px solid var(--envclaw-border);
  color: var(--envclaw-text-secondary);
}

.content-preview {
  background: var(--envclaw-bg-primary);
  border: 1px solid var(--envclaw-border);
  border-radius: 8px;
  padding: 14px;
  max-height: 400px;
  overflow-y: auto;
  font-size: 13px;
  color: var(--envclaw-text-secondary);

  :deep(hr) { border: none; margin: 12px 0; }
}
</style>
