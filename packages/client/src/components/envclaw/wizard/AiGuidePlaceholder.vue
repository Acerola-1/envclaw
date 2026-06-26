<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="ai-placeholder">
    <div class="ai-avatar">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
        <path d="M2 21c0-3 1.85-5.36 5.08-6" />
      </svg>
    </div>
    <h3>{{ t('envclaw.wizard.aiGuideTitle') }}</h3>
    <p>{{ t('envclaw.wizard.aiGuideDesc') }}</p>
    <div class="ai-badge">{{ t('envclaw.wizard.comingSoon') }}</div>
  </div>
</template>

<style scoped lang="scss">
.ai-placeholder {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 40px 22px; text-align: center;
}

.ai-avatar {
  width: 56px; height: 56px; border-radius: 14px;
  background: rgba(106,159,217,0.14); color: var(--envclaw-info);
  display: flex; align-items: center; justify-content: center; margin-bottom: 18px;
}

h3 { font-size: 15px; font-weight: 600; margin-bottom: 8px; }
p { font-size: 13px; color: var(--envclaw-text-secondary); line-height: 1.6; max-width: 280px; }

.ai-badge {
  margin-top: 16px; padding: 4px 14px; border-radius: 12px;
  background: var(--envclaw-bg-tertiary); border: 1px dashed var(--envclaw-border-light); color: var(--envclaw-text-muted); font-size: 12px;
}
</style>
