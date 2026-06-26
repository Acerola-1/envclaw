<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ScenarioTemplate } from '@/stores/envclaw/templates'
import TemplateWizard from './TemplateWizard.vue'
import AiGuideWizard from './AiGuideWizard.vue'

const { t } = useI18n()

const props = defineProps<{
  template: ScenarioTemplate | null
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  created: []
}>()

type WizardMode = 'template' | 'ai'
const mode = ref<WizardMode>('template')

const templateName = computed(() => props.template?.name ?? '')
</script>

<template>
  <Transition name="slide">
    <div v-if="visible && template" class="task-wizard">
      <!-- 头部 -->
      <div class="wiz-head">
        <div class="wiz-head-top">
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M3 11v2a1 1 0 0 0 1 1h3l4 4V6L7 10H4a1 1 0 0 0-1 1Z" />
              <path d="M16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14" />
            </svg>
            {{ t('envclaw.wizard.newTask', { name: templateName }) }}
          </h3>
          <div class="wiz-close" @click="emit('close')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </div>
        </div>

        <!-- 模式切换 -->
        <div class="wiz-modes">
          <button
            :class="['wiz-mode', { active: mode === 'template' }]"
            @click="mode = 'template'"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            {{ t('envclaw.wizard.modeTemplate') }}
          </button>
          <button
            :class="['wiz-mode', { active: mode === 'ai' }]"
            @click="mode = 'ai'"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M12 8V4H8M4 8h16v12H4z" /><circle cx="9" cy="13" r="1" /><circle cx="15" cy="13" r="1" />
            </svg>
            {{ t('envclaw.wizard.modeAi') }}
          </button>
        </div>
      </div>

      <!-- 模板向导 -->
      <TemplateWizard
        v-if="mode === 'template'"
        :template-id="template.id"
        @created="emit('created')"
        @cancel="emit('close')"
      />

      <!-- AI 引导向导 -->
      <AiGuideWizard v-else :template-id="template.id" @created="emit('created')" @cancel="emit('close')" />
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.task-wizard {
  position: fixed;
  top: 52px;
  right: 0;
  bottom: 0;
  width: 560px;
  z-index: 100;
  background: var(--envclaw-bg-secondary);
  border-left: 1px solid var(--envclaw-border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.wiz-head { padding: 16px 22px 0; }

.wiz-head-top {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;
  h3 {
    font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px;
  }
}

.wiz-close {
  width: 28px; height: 28px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  color: var(--envclaw-text-muted); cursor: pointer;
  &:hover { background: var(--envclaw-bg-tertiary); color: var(--envclaw-text-primary); }
}

.wiz-modes {
  display: flex; background: var(--envclaw-bg-tertiary); border: 1px solid var(--envclaw-border);
  border-radius: 8px; padding: 3px; gap: 2px;
}

.wiz-mode {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 7px; border-radius: 6px; font-size: 12.5px; font-weight: 500;
  color: var(--envclaw-text-secondary); background: transparent; border: none; cursor: pointer; transition: 0.15s;
  &:hover { color: var(--envclaw-text-primary); }
  &.active { background: var(--envclaw-button-bg); color: var(--envclaw-button-text); }
}

/* 滑入动画 */
.slide-enter-active, .slide-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}
.slide-enter-from { transform: translateX(100%); opacity: 0; }
.slide-leave-to { transform: translateX(100%); opacity: 0; }
</style>
