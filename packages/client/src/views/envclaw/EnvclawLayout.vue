<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useTheme } from '@/composables/useTheme'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { isDark } = useTheme()

const navItems = computed(() => [
  { key: 'home', label: t('envclaw.nav.home'), route: '/envclaw', icon: 'layout-dashboard' },
  { key: 'jobs', label: t('envclaw.nav.jobs'), route: '/envclaw/jobs', icon: 'clock' },
  { key: 'guard', label: t('envclaw.nav.guard'), route: '/envclaw/guard', icon: 'shield' },
  { key: 'platforms', label: t('envclaw.nav.platforms'), route: '/envclaw/platforms', icon: 'link' },
])
const resourceItems = computed(() => [
  { key: 'skills', label: t('envclaw.nav.skills'), route: '/envclaw/skills', icon: 'file-text' },
  { key: 'history', label: t('envclaw.nav.history'), route: '/envclaw/history', icon: 'layers' },
])

const activeNav = computed(() => {
  const path = route.path
  if (path === '/envclaw') return 'home'
  const match = [...navItems.value, ...resourceItems.value].find((n) => n.route === path)
  return match?.key ?? ''
})

function go(path: string) {
  router.push(path)
}

function goSmartQuery() {
  router.push('/envclaw/smart-query')
}

function goWorkstation() {
  router.push('/envclaw')
}

function openSettings() {
  // 存储来源页面，以便设置页面可以返回
  sessionStorage.setItem('settingsReturnTo', route.fullPath)
  router.push('/hermes/settings')
}

const isWorkstation = computed(() => route.path !== '/envclaw/smart-query')
</script>

<template>
  <div class="envclaw-layout" :class="{ light: !isDark }">
    <!-- 顶栏 -->
    <header class="topbar">
      <div class="topbar-left">
        <div class="brand">
          <div class="brand-mark">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
              <path d="M2 21c0-3 1.85-5.36 5.08-6" />
            </svg>
          </div>
          {{ t('envclaw.brand') }}
        </div>
        <div class="mode-switch">
          <button :class="['mode-btn', { active: isWorkstation }]" @click="goWorkstation">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" />
              <rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" />
            </svg>
            {{ t('envclaw.mode.workstation') }}
          </button>
          <button :class="['mode-btn', { active: !isWorkstation }]" @click="goSmartQuery">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M12 3l1.9 5.7L20 10l-6.1 1.3L12 17l-1.9-5.7L4 10l6.1-1.3z" />
            </svg>
            {{ t('envclaw.mode.smartQuery') }}
          </button>
        </div>
      </div>
      <div class="topbar-right">
        <!-- 通知按钮 -->
        <button class="topbar-icon-btn" :title="t('envclaw.topbar.notifications')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>
        <!-- 设置按钮 -->
        <button class="topbar-icon-btn" :title="t('envclaw.topbar.settings')" @click="openSettings">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
        <div class="avatar">{{ t('envclaw.avatarFallback') }}</div>
      </div>
    </header>

    <!-- 工作台模式: 侧栏 + 内容 -->
    <template v-if="isWorkstation">
      <div class="body">
        <nav class="railnav">
          <a
            v-for="item in navItems"
            :key="item.key"
            :class="['rail-item', { active: activeNav === item.key }]"
            @click="go(item.route)"
          >
            {{ item.label }}
          </a>
          <div class="rail-group-label">{{ t('envclaw.nav.resourceGroup') }}</div>
          <a
            v-for="item in resourceItems"
            :key="item.key"
            :class="['rail-item', { active: activeNav === item.key }]"
            @click="go(item.route)"
          >
            {{ item.label }}
          </a>
        </nav>
        <main class="content">
          <router-view />
        </main>
      </div>
    </template>

    <!-- 智能问数模式: 全屏内容 -->
    <template v-else>
      <main class="content-full">
        <router-view />
      </main>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/envclaw-theme.scss';

.envclaw-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--envclaw-bg-primary);
  color: var(--envclaw-text-primary);
  font-family: 'Inter', system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.topbar {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px;
  border-bottom: 1px solid var(--envclaw-border);
  flex-shrink: 0;
}

.topbar-left { display: flex; align-items: center; gap: 22px; }

.brand {
  display: flex; align-items: center; gap: 9px;
  font-weight: 600; font-size: 14px;
}

.brand-mark {
  width: 26px; height: 26px; border-radius: 7px;
  background: var(--envclaw-button-bg); color: var(--envclaw-button-text);
  display: flex; align-items: center; justify-content: center;
}

.mode-switch {
  display: flex; background: var(--envclaw-bg-tertiary); border: 1px solid var(--envclaw-border);
  border-radius: 8px; padding: 3px; gap: 2px;
}

.mode-btn {
  display: flex; align-items: center; gap: 6px; padding: 6px 13px;
  border-radius: 6px; font-size: 13px; font-weight: 500;
  color: var(--envclaw-text-secondary); background: transparent; border: none; cursor: pointer;
  transition: 0.15s;
  &:hover { color: var(--envclaw-text-primary); }
  &.active { background: var(--envclaw-button-bg); color: var(--envclaw-button-text); }
}

.topbar-right { display: flex; align-items: center; gap: 8px; }

.topbar-icon-btn {
  width: 32px; height: 32px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  color: var(--envclaw-text-secondary); background: transparent;
  border: none; cursor: pointer; transition: 0.15s;
  &:hover { background: var(--envclaw-bg-tertiary); color: var(--envclaw-text-primary); }
}

.avatar {
  width: 30px; height: 30px; border-radius: 50%;
  background: var(--envclaw-bg-secondary); border: 1px solid var(--envclaw-border-light);
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 600;
}

.body { flex: 1; display: flex; overflow: hidden; }

.railnav {
  width: 200px; background: var(--envclaw-bg-hover); border-right: 1px solid var(--envclaw-border);
  padding: 12px 10px; display: flex; flex-direction: column; gap: 2px;
  flex-shrink: 0;
}

.rail-group-label {
  font-size: 11px; color: var(--envclaw-text-muted); font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.6px; padding: 12px 10px 6px;
}

.rail-item {
  display: flex; align-items: center; gap: 10px; padding: 9px 10px;
  border-radius: 6px; color: var(--envclaw-text-secondary); cursor: pointer; font-size: 13px;
  transition: 0.15s; text-decoration: none;
  &:hover { background: var(--envclaw-bg-tertiary); color: var(--envclaw-text-primary); }
  &.active { background: var(--envclaw-bg-tertiary); color: var(--envclaw-text-primary); font-weight: 500; }
}

.content { flex: 1; overflow-y: auto; }
.content-full { flex: 1; overflow-y: auto; }
</style>
