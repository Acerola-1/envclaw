<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/hermes/app'
import { useChatStore } from '@/stores/hermes/chat'
import { usePersistentRecord } from '@/composables/usePersistentRecord'
import { getStoredUsername, isStoredSuperAdmin } from '@/api/client'
import RouteLinkItem from '@/components/common/RouteLinkItem.vue'
import LanguageSwitch from '@/components/layout/LanguageSwitch.vue'
import ThemeSwitch from '@/components/layout/ThemeSwitch.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const chatStore = useChatStore()

const selectedKey = computed(() => route.name as string)
const currentUsername = computed(() => getStoredUsername())
const isSuperAdmin = computed(() => isStoredSuperAdmin())

// ---- Route-based sidebar mode ----
// UniEcoClaw pages → 5-section prototype sidebar
// All other pages → classic 3-group sidebar
const uniEcoRoutes = ['hermes.chat', 'hermes.session', 'hermes.duty', 'hermes.dutyDetail', 'hermes.dutyCreate', 'hermes.dutyPicker', 'hermes.templates', 'hermes.templateEditor', 'hermes.capabilities']
const isUniEco = computed(() => uniEcoRoutes.includes(route.name as string))

// ---- UniEcoClaw sidebar state ----
const { record: recentCollapsed, persist: persistRecent } = usePersistentRecord('unieco_recent_collapsed')
const showAllRecent = ref(false)
const recentSessions = computed(() => showAllRecent.value ? chatStore.sessions : chatStore.sessions.slice(0, 5))
const moreCount = computed(() => Math.max(0, chatStore.sessions.length - 5))

function toggleRecent() { recentCollapsed.value = !recentCollapsed.value; persistRecent() }

// ---- Classic sidebar state ----
const { record: collapsedGroups, persist: persistCollapsedGroups } = usePersistentRecord('hermes.sidebar.collapsedGroups')
type SidebarGroupKey = 'Agent' | 'Monitoring' | 'System'

function groupLabel(key: SidebarGroupKey) {
  return t(`sidebar.group${key}${appStore.sidebarCollapsed ? 'Short' : ''}`)
}
function toggleGroup(key: string) { collapsedGroups[key] = !collapsedGroups[key]; persistCollapsedGroups() }
function isGroupCollapsed(key: string) { return !!collapsedGroups[key] }

function handleSidebarClick(event: MouseEvent) {
  const target = event.target instanceof Element ? event.target : null
  if (!target?.closest('.route-link-item')) return
  if (window.matchMedia('(max-width: 768px)').matches) appStore.closeSidebar()
}

onMounted(async () => {
  await chatStore.loadSessions()
  // Don't keep auto-selected session on new-chat page
  if (route.name === 'hermes.chat') { chatStore.activeSessionId = null; chatStore.activeSession = null }
})

function handleLogout() {
  localStorage.clear(); sessionStorage.clear()
  sessionStorage.setItem('hermes_manual_logout', '1')
  window.location.href = '/'
}
</script>

<template>
  <!-- ===== A. UniEcoClaw 5-section sidebar ===== -->
  <aside v-if="isUniEco" class="sidebar" :class="{ open: appStore.sidebarOpen, collapsed: appStore.sidebarCollapsed }"
    @click="handleSidebarClick">

    <div class="sidebar-brand">
      <div class="brand-logo">
        <img src="/logo.png" alt="UniEcoClaw" width="28" height="28" />
      </div>
      <div class="brand-text">
        <span class="brand-name">UniEcoClaw</span>
        <span class="brand-subtitle">数智环保·UniEcoClaw</span>
      </div>
    </div>

    <RouteLinkItem class="nav-item primary-btn" :to="{ name: 'hermes.chat' }">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      <span>新建任务</span>
    </RouteLinkItem>

    <nav class="sidebar-nav">
      <RouteLinkItem class="nav-item" :to="{ name: 'hermes.duty' }" :active="!!selectedKey?.startsWith('hermes.duty')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg><span>自动化</span>
      </RouteLinkItem>
      <RouteLinkItem class="nav-item" :to="{ name: 'hermes.templates' }"
        :active="!!selectedKey?.startsWith('hermes.templates')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg><span>任务模板库</span>
      </RouteLinkItem>
      <RouteLinkItem class="nav-item" :to="{ name: 'hermes.capabilities' }"
        :active="selectedKey === 'hermes.capabilities'">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
        </svg><span>平台·技能·连接器</span>
      </RouteLinkItem>
      <!-- <div class="nav-item nav-more"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg><span>更多</span></div> -->
    </nav>

    <div class="sidebar-recent">
      <div class="recent-header" @click="toggleRecent">
        <span>最近对话</span>
        <svg class="recent-arrow" :class="{ collapsed: recentCollapsed }" width="12" height="12" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      <div class="recent-list">
        <div v-for="s in recentSessions" :key="s.id" class="recent-item" :class="{ active: chatStore.activeSessionId === s.id }"
          @click="router.push({ name: 'hermes.session', params: { sessionId: s.id } })">{{ s.title }}</div>
        <div v-if="moreCount > 0 || showAllRecent" class="recent-more" @click="showAllRecent = !showAllRecent">{{
          showAllRecent ? '收起' : '查看更多 (' + moreCount + ')' }}</div>
      </div>
    </div>

    <div class="sidebar-user">
      <div class="user-avatar">{{ currentUsername?.charAt(0)?.toUpperCase() }}</div>
      <span class="user-name">{{ currentUsername }}</span>
      <button class="user-btn" title="通知"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="1.5">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg></button>
      <button class="user-btn" title="设置" @click="router.push({ name: 'hermes.settings' })"><svg width="16" height="16"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l-.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg></button>
    </div>
  </aside>

  <!-- ===== B. Classic 3-group sidebar (system pages) ===== -->
  <aside v-else class="sidebar" :class="{ open: appStore.sidebarOpen, collapsed: appStore.sidebarCollapsed }"
    @click="handleSidebarClick">
    <nav class="sidebar-nav-classic">
      <RouteLinkItem class="nav-item" :to="{ name: 'hermes.chat' }" style="margin-bottom:6px">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="15 18 9 12 15 6"/><line x1="9" y1="12" x2="21" y2="12"/></svg>
        <span>返回对话</span>
      </RouteLinkItem>
      <div class="nav-group">
        <div class="nav-group-label" @click="toggleGroup('Agent')">
          <span>{{ groupLabel('Agent') }}</span>
          <svg class="nav-group-arrow" :class="{ collapsed: isGroupCollapsed('Agent') }" width="12" height="12"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <div v-show="!isGroupCollapsed('Agent')" class="nav-group-items">
          <RouteLinkItem class="nav-item" :to="{ name: 'hermes.channels' }" :active="selectedKey === 'hermes.channels'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg><span>{{ t('sidebar.channels') }}</span>
          </RouteLinkItem>
          <RouteLinkItem class="nav-item" :to="{ name: 'hermes.skills' }" :active="selectedKey === 'hermes.skills'"><svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg><span>{{ t('sidebar.skills') }}</span></RouteLinkItem>
          <RouteLinkItem class="nav-item" :to="{ name: 'hermes.mcp' }" :active="selectedKey === 'hermes.mcp'"><svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M4 7V4h16v3" />
              <path d="M9 20h6" />
              <path d="M12 7v13" />
            </svg><span>{{ t('sidebar.mcp') }}</span></RouteLinkItem>
          <RouteLinkItem class="nav-item" :to="{ name: 'hermes.models' }" :active="selectedKey === 'hermes.models'"><svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v4M12 19v4M1 12h4M19 12h4" />
            </svg><span>{{ t('sidebar.models') }}</span></RouteLinkItem>
        </div>
      </div>
      <div class="nav-group">
        <div class="nav-group-label" @click="toggleGroup('Monitoring')">
          <span>{{ groupLabel('Monitoring') }}</span>
          <svg class="nav-group-arrow" :class="{ collapsed: isGroupCollapsed('Monitoring') }" width="12" height="12"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <div v-show="!isGroupCollapsed('Monitoring')" class="nav-group-items">
          <RouteLinkItem class="nav-item" :to="{ name: 'hermes.logs' }" :active="selectedKey === 'hermes.logs'"><svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            </svg><span>{{ t('sidebar.logs') }}</span></RouteLinkItem>
          <RouteLinkItem class="nav-item" :to="{ name: 'hermes.usage' }" :active="selectedKey === 'hermes.usage'"><svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="12" width="4" height="9" rx="1" />
              <rect x="10" y="7" width="4" height="14" rx="1" />
              <rect x="17" y="3" width="4" height="18" rx="1" />
            </svg><span>{{ t('sidebar.usage') }}</span></RouteLinkItem>
          <RouteLinkItem v-if="isSuperAdmin" class="nav-item" :to="{ name: 'hermes.performance' }"
            :active="selectedKey === 'hermes.performance'"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="1.5">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg><span>{{ t('sidebar.performance') }}</span></RouteLinkItem>
          <RouteLinkItem class="nav-item" :to="{ name: 'hermes.skillsUsage' }"
            :active="selectedKey === 'hermes.skillsUsage'"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="1.5">
              <path d="M21.21 15.89A10 10 0 1 1 8.11 2.79" />
              <path d="M22 12A10 10 0 0 0 12 2v10z" />
            </svg><span>{{ t('sidebar.skillsUsage') }}</span></RouteLinkItem>
        </div>
      </div>
      <div class="nav-group">
        <div class="nav-group-label" @click="toggleGroup('System')">
          <span>{{ groupLabel('System') }}</span>
          <svg class="nav-group-arrow" :class="{ collapsed: isGroupCollapsed('System') }" width="12" height="12"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <div v-show="!isGroupCollapsed('System')" class="nav-group-items">
          <RouteLinkItem class="nav-item" :to="{ name: 'hermes.settings' }" :active="selectedKey === 'hermes.settings'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="3" />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l-.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg><span>{{ t('sidebar.settings') }}</span>
          </RouteLinkItem>
        </div>
      </div>
    </nav>

    <div class="sidebar-footer">
      <div class="status-row">
        <div class="status-indicator" :class="{ connected: appStore.connected, disconnected: !appStore.connected }">
          <span class="status-dot"></span>
          <span class="status-text">{{ appStore.connected ? t('sidebar.connected') : t('sidebar.disconnected') }}</span>
        </div>
        <LanguageSwitch />
      </div>
      <div class="version-info">主题
        <ThemeSwitch />
      </div>
      <button class="nav-item logout-item" @click="handleLogout">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        <span>{{ t('sidebar.logout') }}</span>
      </button>
      <NButton v-if="appStore.updateAvailable" type="primary" size="tiny" block class="update-btn"
        :loading="appStore.updating" @click="appStore.doUpdate()">
        {{ appStore.updating ? t('sidebar.updating') : t('sidebar.updateVersion', { version: appStore.latestVersion })
        }}
      </NButton>
    </div>
  </aside>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

// ---- Shared ----
.sidebar {
  position: relative;
  width: $sidebar-width;
  height: calc(100 * var(--vh));
  background-color: $bg-sidebar;
  border-right: 1px solid $border-color;
  display: flex;
  flex-direction: column;
  padding: 8px 12px 12px;
  flex-shrink: 0;
  transition: width $transition-normal;
}

// ===== A. UniEcoClaw sidebar styles =====
.sidebar-brand {
  padding: 13px 10px;
  border-bottom: 1px solid #e5e5e5;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 61px;

  .brand-logo {
    width: 45px;
    height: 45px;
    border-radius: 8px;
    flex-shrink: 0;
    background: #fff;
    border: 1px solid var(--border-color);
    display: grid;
    place-items: center;
    overflow: hidden;

    img {
      width: 38px;
      height: 38px;
      object-fit: contain;
    }
  }

  .brand-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .brand-name {
    font-size: 16px;
    font-weight: 700;
    color: $text-primary;
  }

  .brand-subtitle {
    font-size: 11px;
    color: $text-muted;
  }
}

.primary-btn {
  background: $accent-primary !important;
  color: #fff !important;
  border-radius: $radius-md !important;
  justify-content: center;
  margin-bottom: 8px;

  &:hover,
  &.active {
    background: $accent-hover !important;
    color: #fff;
  }

  :deep(a) {
    color: #fff !important;
  }
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
  min-height: 0;
  scrollbar-width: none;
  padding-bottom: 4px;

  &::-webkit-scrollbar {
    display: none;
  }
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: none;
  background: none;
  appearance: none;
  text-decoration: none;
  color: $text-secondary;
  font-size: 14px;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: all $transition-fast;
  width: 100%;
  text-align: left;

  &:hover {
    background-color: rgba(var(--accent-primary-rgb), .06);
    color: $text-primary;
  }

  &.active {
    background-color: rgba(var(--accent-primary-rgb), .12);
    color: $accent-primary;
  }
}

.nav-more {
  cursor: pointer;
}

.sidebar-recent {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  border-top: 1px solid $border-color;
  padding-top: 8px;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.recent-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 600;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: .6px;
  cursor: pointer;
  user-select: none;
  border-radius: $radius-sm;
  transition: color $transition-fast;

  &:hover {
    color: $text-secondary;
  }
}

.recent-arrow {
  flex-shrink: 0;
  transition: transform $transition-fast;
  color: $text-muted;

  &.collapsed {
    transform: rotate(-90deg);
  }
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.recent-item {
  padding: 8px 10px;
  font-size: 13px;
  color: $text-secondary;
  border-radius: $radius-sm;
  cursor: pointer;
  &.active { background: rgba(var(--accent-primary-rgb), .12); color: $accent-primary; font-weight: 500; }
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &:hover {
    background-color: rgba(var(--accent-primary-rgb), .06);
    color: $text-primary;
  }
}

.recent-more {
  padding: 8px 10px;
  font-size: 12px;
  color: $accent-primary;
  border-radius: $radius-sm;
  cursor: pointer;

  &:hover {
    background-color: rgba(var(--accent-primary-rgb), .06);
  }
}

.sidebar-user {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 8px;
  border-top: 1px solid $border-color;
  flex-shrink: 0;

  .user-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: $accent-primary;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .user-name {
    flex: 1;
    font-size: 13px;
    color: $text-primary;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .user-btn {
    background: none;
    border: none;
    color: $text-muted;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      color: $text-primary;
      background-color: rgba(var(--accent-primary-rgb), .08);
    }
  }
}

// ===== B. Classic sidebar styles =====
.sidebar-nav-classic {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  min-height: 0;
  padding-top: 8px;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.nav-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-group-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-group-label {
  font-size: 10px;
  font-weight: 600;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: .8px;
  padding: 8px 12px 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
  border-radius: $radius-sm;

  &:hover {
    color: $text-secondary;
  }
}

.nav-group-arrow {
  transition: transform $transition-fast;
  flex-shrink: 0;

  &.collapsed {
    transform: rotate(-90deg);
  }
}

.sidebar-footer {
  padding-top: 10px;
  border-top: 1px solid $border-color;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 0 4px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding-left: 12px;
  font-size: 12px;
  color: $text-secondary;

  &.connected .status-dot {
    background-color: $success;
  }

  &.disconnected .status-dot {
    background-color: $error;
  }
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.version-info {
  padding: 2px 0 8px 12px;
  font-size: 12px;
  color: $text-secondary;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.logout-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border: none;
  background: none;
  color: $text-secondary;
  font-size: 14px;
  border-radius: $radius-sm;
  cursor: pointer;
  width: 100%;
  text-align: left;

  &:hover {
    background-color: rgba(var(--accent-primary-rgb), .06);
    color: $text-primary;
  }
}

.update-btn {
  margin: 4px 0 0;
  border-radius: $radius-sm;
}

// ===== Collapsed (both modes) =====
.sidebar.collapsed {
  width: $sidebar-collapsed-width;
  padding: 8px 8px 12px;
  overflow: hidden;

  .sidebar-brand .brand-text,
  .sidebar-recent {
    display: none;
  }

  .sidebar-brand {
    justify-content: center;
    padding: 12px 0 16px;
  }

  .sidebar-user {
    justify-content: center;

    .user-name,
    .user-btn {
      display: none;
    }
  }

  .nav-item {
    justify-content: center;
    padding: 10px 4px;
    gap: 0;

    span {
      display: none;
    }

    svg {
      flex-shrink: 0;
    }
  }

  .sidebar-nav-classic {
    overflow: hidden;
  }

  .nav-group-label {
    justify-content: center;
    padding: 8px 0 4px;
    letter-spacing: 0;

    span {
      max-width: 36px;
      overflow: hidden;
      text-align: center;
    }
  }

  .status-row,
  .version-info,
  .update-btn {
    display: none;
  }

  .sidebar-footer {
    align-items: center;
  }

  .logout-item {
    justify-content: center;

    span {
      display: none;
    }
  }
}

@media (max-width: $breakpoint-mobile) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    z-index: 1000;
    transform: translateX(-100%);
    transition: transform $transition-normal;

    &.open {
      transform: translateX(0);
    }
  }
}
</style>
