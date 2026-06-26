<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useTemplatesStore, type ScenarioTemplate } from '@/stores/envclaw/templates'

const { t } = useI18n()
const templatesStore = useTemplatesStore()

const emit = defineEmits<{
  select: [template: ScenarioTemplate]
}>()

function handleClick(tpl: ScenarioTemplate) {
  if (!tpl.available) return
  emit('select', tpl)
}
</script>

<template>
  <div class="section">
    <div class="section-head">
      <div class="section-title">
        {{ t('envclaw.home.scenarios.title') }}
        <span class="hint">{{ t('envclaw.home.scenarios.hint') }}</span>
      </div>
    </div>
    <div class="scenario-grid">
      <div
        v-for="tpl in templatesStore.templates"
        :key="tpl.id"
        :class="['scenario-card', { disabled: !tpl.available }]"
        @click="handleClick(tpl)"
      >
        <div :class="['scenario-ic', tpl.available ? 'color-green' : 'color-mute']">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <path v-if="tpl.icon === 'volume-2'" d="M3 11v2a1 1 0 0 0 1 1h3l4 4V6L7 10H4a1 1 0 0 0-1 1ZM16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14" />
            <path v-else-if="tpl.icon === 'bar-chart-3'" d="M3 3v18h18M7 10v8M12 6v12M17 13v5" />
            <path v-else-if="tpl.icon === 'triangle-alert'" d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3ZM12 9v4M12 17h.01" />
            <path v-else d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6M9 13h6M9 17h4" />
          </svg>
        </div>
        <h3>{{ tpl.name }}</h3>
        <p>{{ tpl.description }}</p>
        <div class="scenario-foot">
          <div v-if="tpl.available" class="tag-row">
            <span v-for="tag in tpl.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
          <span v-else class="badge-wip">{{ t('envclaw.home.scenarios.comingSoon') }}</span>
          <span :class="['scenario-go', { muted: !tpl.available }]">
            {{ tpl.available ? t('envclaw.home.scenarios.start') : t('envclaw.home.scenarios.stayTuned') }}
            <svg v-if="tpl.available" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.section { margin-bottom: 30px; }
.section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.section-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; }
.hint { font-weight: 400; font-size: 12px; color: var(--envclaw-text-muted); }

.scenario-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.scenario-card {
  background: var(--envclaw-bg-secondary); border: 1px solid var(--envclaw-border); border-radius: 12px;
  padding: 18px; cursor: pointer; transition: 0.15s;
  &:hover:not(.disabled) { border-color: var(--envclaw-border-light); background: var(--envclaw-bg-hover); transform: translateY(-2px); }
  &.disabled { cursor: not-allowed; opacity: 0.5; }
}

.scenario-ic {
  width: 40px; height: 40px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center; margin-bottom: 13px;
  &.color-green { background: rgba(102,187,106,0.14); color: var(--envclaw-success); }
  &.color-mute { background: var(--envclaw-bg-tertiary); color: var(--envclaw-text-secondary); }
}

h3 { font-size: 14px; font-weight: 600; margin-bottom: 6px; }
p { font-size: 12px; color: var(--envclaw-text-secondary); line-height: 1.55; margin-bottom: 14px; min-height: 37px; }
.scenario-foot { display: flex; align-items: center; justify-content: space-between; }
.tag-row { display: flex; gap: 5px; }
.tag { padding: 2px 8px; border-radius: 10px; font-size: 10.5px; background: var(--envclaw-bg-tertiary); color: var(--envclaw-text-secondary); border: 1px solid var(--envclaw-border); }
.badge-wip { padding: 2px 8px; border-radius: 10px; font-size: 10.5px; background: var(--envclaw-bg-tertiary); color: var(--envclaw-text-muted); border: 1px dashed var(--envclaw-border-light); }
.scenario-go { display: flex; align-items: center; gap: 3px; font-size: 12px; color: var(--envclaw-text-secondary); &.muted { color: var(--envclaw-text-muted); } }
.scenario-card:hover:not(.disabled) .scenario-go { color: var(--envclaw-text-primary); }
</style>
