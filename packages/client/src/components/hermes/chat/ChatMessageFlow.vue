<script setup lang="ts">
import { computed } from 'vue'
import { useMessage } from 'naive-ui'
import { useChatStore } from '@/stores/hermes/chat'
import { useDutyStore, type DraftParams } from '@/stores/envclaw/duty'
import MessageItem from './MessageItem.vue'
import TaskDraftCard from './TaskDraftCard.vue'

const chatStore = useChatStore()
const dutyStore = useDutyStore()
const message = useMessage()

const messages = computed(() => chatStore.messages)

const showDraftCard = computed(() => dutyStore.draftParams !== null)
const draftParams = computed((): DraftParams => dutyStore.draftParams!)

function handleCreate() {
  if (!draftParams.value) return
  const p = encodeURIComponent(JSON.stringify(draftParams.value))
  window.location.hash = `/hermes/duty/create?from=chat&prompt=${p}`
}

async function handleConfirm() {
  try {
    await dutyStore.createJobFromDraft()
    message.success('已创建并调度')
  } catch (e: any) {
    message.error(e.message || '创建失败')
  }
}
</script>

<template>
  <div class="message-flow">
    <MessageItem v-for="msg in messages" :key="msg.id" :message="msg" />
    <TaskDraftCard v-if="showDraftCard" :params="draftParams" @create="handleCreate" @confirm="handleConfirm" />
    <div v-if="chatStore.isStreaming" class="streaming-indicator">AI 正在思考...</div>
  </div>
</template>

<style scoped lang="scss">
.message-flow { flex: 1; overflow-y: auto; padding: 20px 10%; }
.streaming-indicator { font-size: 13px; color: var(--text-muted); padding: 12px 0; }
</style>
