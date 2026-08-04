<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '@/stores/hermes/chat'
import { useDutyStore } from '@/stores/envclaw/duty'
import ChatInput from './ChatInput.vue'
import CapabilityChips from './CapabilityChips.vue'
import SlashCommandMenu from './SlashCommandMenu.vue'
import ModelSelector from '@/components/layout/ModelSelector.vue'

const router = useRouter()
const chatStore = useChatStore()
const dutyStore = useDutyStore()

const inputText = ref('')
const showSlash = ref(false)

function handleChipSelect(_cmd: string, prompt: string) { inputText.value = prompt }
async function handleSend() {
  const text = inputText.value.trim()
  if (!text) return
  inputText.value = ''
  try {
    await chatStore.sendMessage(text)
  } catch (e: any) {
    console.error('sendMessage failed:', e)
  }
  if (chatStore.activeSessionId) {
    router.push({ name: 'hermes.session', params: { sessionId: chatStore.activeSessionId } })
  }
}
function handleSlash() { showSlash.value = true }
function handleSlashSelect(_cmd: string, prompt: string) { inputText.value = prompt; showSlash.value = false }

function fillPrompt(text: string) { inputText.value = text }
defineExpose({ fillPrompt })
</script>

<template>
  <div class="composer-zone">
    <!-- Chip row above input -->
    <CapabilityChips @select="handleChipSelect" />

    <!-- Workbuddy-style: big input box with toolbar inside -->
    <div class="composer">
      <div class="composer-box wb-box">
        <ChatInput v-model="inputText" @send="handleSend" @slash="handleSlash" />
        <div class="composer-bar wb-bar">
          <div class="composer-tools-left">
            <button class="icon-btn" title="附件 / 引用文件">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>
          <div class="composer-tools">
            <ModelSelector />
            <button class="icon-btn" title="语音">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
            </button>
            <button class="send-btn" :disabled="!inputText.trim()" @click="handleSend">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom bar: workspace + permission -->
    <div class="chat-bottom-bar">
      <button class="cbb-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span class="cbb-text">默认工作空间</span>
        <svg class="cbb-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <button class="cbb-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2l7 4v6c0 5-3 9-7 10-4-1-7-5-7-10V6l7-4z"/></svg>
        <span class="cbb-text">完全访问权限</span>
        <svg class="cbb-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
    </div>

    <SlashCommandMenu :visible="showSlash" @select="handleSlashSelect" @close="showSlash = false" />
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

// ---- Composer zone (matches prototype) ----
.composer-zone { flex-shrink: 0; padding: 8px 24px 18px; background: $bg-primary; }

// ---- Input box with internal toolbar ----
.composer { max-width: 800px; margin: 0 auto; }
.composer-box.wb-box {
  background: $bg-input; border: 2px solid $border-color; border-radius: var(--radius-lg);
  transition: border-color .15s; padding: 16px 16px 4px;
  &:focus-within { border-color: $accent-primary; }
}
.composer-box.wb-box :deep(textarea) {
  width: 100%; border: none; outline: none; resize: none; font-size: 15px; line-height: 1.6;
  background: transparent; color: $text-primary; font-family: inherit; padding: 0;
  &::placeholder { color: $text-muted; }
  &:focus { outline: none; box-shadow: none; border: none; }
}
.composer-bar.wb-bar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 0 4px; gap: 8px;
}
.composer-tools-left { display: flex; align-items: center; }
.composer-tools { display: flex; align-items: center; gap: 6px; }

// ---- Icon buttons ----
.icon-btn {
  background: none; border: none; color: $text-muted; cursor: pointer;
  padding: 6px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
  &:hover { color: $text-primary; background: $bg-secondary; }
}

// ---- Send button (round, prototype style) ----
.send-btn {
  width: 32px; height: 32px; border: none; border-radius: 50%;
  background: $accent-primary; color: #fff; display: grid; place-items: center;
  cursor: pointer; transition: .15s; flex-shrink: 0;
  &:hover { background: $accent-hover; }
  &:disabled { opacity: .35; cursor: not-allowed; }
}

// ---- Bottom bar (workspace / permission) ----
.chat-bottom-bar {
  display: flex; align-items: center; justify-content: center; gap: 12px;
  padding: 10px 0 0; max-width: 800px; margin: 0 auto;
}
.cbb-item {
  display: inline-flex; align-items: center; gap: 6px; padding: 5px 8px;
  border: none; background: none; color: $text-muted; font-size: 12px;
  cursor: pointer; border-radius: 6px; font-family: inherit;
  &:hover { color: $text-primary; background: $bg-secondary; }
  svg:first-child { width: 15px; height: 15px; color: $text-muted; }
}
.cbb-text { font-weight: 500; }
.cbb-arrow { width: 10px; height: 10px; color: $text-muted; }
</style>
