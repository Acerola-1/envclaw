<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '@/stores/hermes/chat'

const chatStore = useChatStore()
const router = useRouter()

const sortedSessions = computed(() => {
  return [...chatStore.sessions].sort((a, b) => {
    const ta = a.updatedAt || a.createdAt || 0
    const tb = b.updatedAt || b.createdAt || 0
    return tb - ta
  })
})

function openSession(id: string) {
  router.push({ name: 'hermes.session', params: { sessionId: id } })
}

function formatTime(ts: number | string | undefined): string {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} 小时前`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="session-list-view">
    <div class="slv-header">
      <h2>全部对话</h2>
      <span class="slv-count">{{ chatStore.sessions.length }} 个会话</span>
    </div>
    <div v-if="sortedSessions.length === 0" class="slv-empty">暂无对话记录</div>
    <div class="slv-list">
      <div
        v-for="s in sortedSessions"
        :key="s.id"
        class="slv-item"
        @click="openSession(s.id)"
      >
        <div class="slv-title">{{ s.title || '新对话' }}</div>
        <div class="slv-meta">{{ formatTime(s.updatedAt || s.createdAt) }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.session-list-view {
  max-width: 800px; margin: 0 auto; padding: 24px; width: 100%;
}
.slv-header {
  display: flex; align-items: baseline; gap: 12px; margin-bottom: 16px;
  h2 { font-size: 20px; font-weight: 600; margin: 0; color: $text-primary; }
}
.slv-count { font-size: 13px; color: $text-muted; }
.slv-empty { text-align: center; padding: 48px; color: $text-muted; }
.slv-list { display: flex; flex-direction: column; gap: 2px; }
.slv-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 16px; border-radius: var(--radius-md); cursor: pointer; transition: .12s;
  &:hover { background: rgba(var(--accent-primary-rgb), .05); }
}
.slv-title { font-size: 14px; color: $text-primary; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.slv-meta { font-size: 12px; color: $text-muted; flex-shrink: 0; margin-left: 16px; }
</style>
