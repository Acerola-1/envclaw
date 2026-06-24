<script setup lang="ts">
type AppMode = 'smartQuery' | 'automation'

const props = withDefaults(defineProps<{
  appMode?: AppMode
}>(), {
  appMode: 'smartQuery'
})

const emit = defineEmits<{
  'update:app-mode': [mode: AppMode]
}>()

function switchMode(mode: AppMode) {
  if (mode !== props.appMode) {
    emit('update:app-mode', mode)
  }
}
</script>

<template>
  <div class="page-sidebar-nav">
    <!-- 品牌标识 -->
    <div class="sidebar-brand">
      <div class="logo-icon">数</div>
      <div>
        <div class="logo-text">envClaw</div>
        <div class="logo-tag">数智环保 · envClaw</div>
      </div>
    </div>

    <!-- 模块切换 Tab -->
    <div v-if="appMode" class="mode-switch-tabs" role="tablist" aria-label="模块切换">
      <button
        class="mode-tab"
        :class="{ active: appMode === 'smartQuery' }"
        type="button"
        role="tab"
        :aria-selected="appMode === 'smartQuery'"
        @click="switchMode('smartQuery')"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span>智能问数</span>
      </button>
      <button
        class="mode-tab"
        :class="{ active: appMode === 'automation' }"
        type="button"
        role="tab"
        :aria-selected="appMode === 'automation'"
        @click="switchMode('automation')"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span>自动化值守</span>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.page-sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.sidebar-brand {
  padding: 13px 10px;
  border-bottom: 1px solid #e5e5e5;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 60px;
  -webkit-app-region: drag;
}

.logo-icon {
  width: 28px;
  height: 28px;
  background: #16a34a;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: white;
  font-weight: 700;
  font-size: 13px;
  flex-shrink: 0;
}

.logo-text {
  font-family: "Inter", -apple-system, system-ui, sans-serif;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.logo-tag {
  font-size: 11px;
  color: #6b6b6b;
  font-family: ui-monospace, "JetBrains Mono", monospace;
  letter-spacing: 0.04em;
}

.mode-switch-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 10px;
  border-bottom: 1px solid #e5e5e5;
}

.mode-tab {
  flex: 1;
  min-width: 0;
  height: 36px;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: $text-secondary;
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 10px;
  cursor: pointer;
  transition:
    background-color $transition-fast,
    color $transition-fast;
  font-size: 13px;

  svg {
    flex-shrink: 0;
  }

  span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &:hover {
    background: rgba(var(--accent-primary-rgb), 0.06);
    color: $text-primary;
  }

  &.active {
    background: rgba(var(--accent-primary-rgb), 0.1);
    color: var(--accent-primary);
    font-weight: 500;
  }
}
</style>
