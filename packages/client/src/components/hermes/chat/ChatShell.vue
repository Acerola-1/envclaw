<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import ChatHero from './ChatHero.vue'
import ChatMessageFlow from './ChatMessageFlow.vue'
import ChatSessionList from './ChatSessionList.vue'
import ChatComposer from './ChatComposer.vue'

const route = useRoute()

type ViewMode = 'hero' | 'history' | 'chat'

const viewMode = computed<ViewMode>(() => {
  if (route.query.view === 'history') return 'history'
  if (route.name === 'hermes.session') return 'chat'
  return 'hero'
})

const composerRef = ref<InstanceType<typeof ChatComposer> | null>(null)

function handleFillPrompt(text: string) {
  composerRef.value?.fillPrompt(text)
}
</script>

<template>
  <div class="chat-shell">
    <ChatHero v-if="viewMode === 'hero'" @fill-prompt="handleFillPrompt" />
    <ChatSessionList v-else-if="viewMode === 'history'" />
    <ChatMessageFlow v-else-if="viewMode === 'chat'" />
    <ChatComposer v-if="viewMode !== 'history'" ref="composerRef" />
  </div>
</template>

<style scoped lang="scss">
.chat-shell {
  display: flex; flex-direction: column; height: calc(100 * var(--vh));
  width: 100%;
}
</style>
