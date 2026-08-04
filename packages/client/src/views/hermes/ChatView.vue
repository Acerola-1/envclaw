<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import ChatShell from '@/components/hermes/chat/ChatShell.vue'
import { useAppStore } from '@/stores/hermes/app'
import { useChatStore } from '@/stores/hermes/chat'
import { useProfilesStore } from '@/stores/hermes/profiles'
import { useSettingsStore } from '@/stores/hermes/settings'

const appStore = useAppStore()
const chatStore = useChatStore()
const profilesStore = useProfilesStore()
const settingsStore = useSettingsStore()
const route = useRoute()

const routeSessionId = computed(() => {
  const value = route.params.sessionId
  return typeof value === 'string' && value.trim() ? value : null
})

const productTitle = 'UniEcoClaw'
const tabTitle = computed(() => {
  if (route.name !== 'hermes.session') return productTitle
  return chatStore.activeSession?.title?.trim() || productTitle
})

watch(tabTitle, (value) => {
  document.title = value
}, { immediate: true })

onUnmounted(() => {
  document.title = productTitle
})

onMounted(async () => {
  chatStore.setRuntimeMode('default')
  appStore.loadModels()
  await Promise.all([
    profilesStore.fetchProfiles(),
    settingsStore.fetchSettings(),
  ])
  chatStore.validateSessionProfileFilter(profilesStore.profiles.map(profile => profile.name))
  // Only auto-load a session if the route explicitly points to one
  if (routeSessionId.value) {
    await chatStore.loadSessions(chatStore.sessionProfileFilter, routeSessionId.value)
  }
})

// Switch session when route param changes (sidebar click)
watch(routeSessionId, async (sessionId) => {
  if (!sessionId) { chatStore.activeSessionId = null; chatStore.activeSession = null; return }
  if (!chatStore.sessionsLoaded) return
  if (chatStore.activeSessionId === sessionId) return
  const exists = chatStore.sessions.some(s => s.id === sessionId)
  if (!exists) { await chatStore.loadSessions(chatStore.sessionProfileFilter, sessionId); return }
  await chatStore.switchSession(sessionId)
})
</script>

<template>
  <div class="chat-view">
    <ChatShell />
  </div>
</template>

<style scoped lang="scss">
.chat-view {
  height: calc(100 * var(--vh));
  display: flex;
  flex-direction: column;
}
</style>
