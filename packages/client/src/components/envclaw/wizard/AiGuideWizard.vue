<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessage } from 'naive-ui'
import { usePlatformsStore } from '@/stores/envclaw/platforms'
import { useTemplatesStore } from '@/stores/envclaw/templates'
import { useJobsStore } from '@/stores/hermes/jobs'
import { usePromptAssembly } from '@/composables/envclaw/usePromptAssembly'
import type { Platform, PlatformFunction } from '@/api/envclaw/platforms'

const { t } = useI18n()
const message = useMessage()
const platformsStore = usePlatformsStore()
const templatesStore = useTemplatesStore()
const jobsStore = useJobsStore()

const props = defineProps<{
  templateId: string
}>()

const emit = defineEmits<{
  created: []
  cancel: []
}>()

// ── 对话状态 ──
type Step = 'welcome' | 'platform' | 'function' | 'schedule' | 'taskName' | 'summary' | 'done'

interface ChatMessage {
  id: number
  role: 'ai' | 'user'
  content: string
  options?: ChatOption[]
  inputType?: 'text' | 'schedule'
  timestamp: number
}

interface ChatOption {
  label: string
  value: string
  selected?: boolean
  description?: string
}

const messages = ref<ChatMessage[]>([])
const currentStep = ref<Step>('welcome')
const chatBody = ref<HTMLElement | null>(null)
let msgId = 0

// ── 用户选择的数据 ──
const selectedPlatforms = ref<Platform[]>([])
const selectedFunctions = ref<PlatformFunction[]>([])
const schedule = ref('0 8 * * *')
const taskName = ref('')
const userInput = ref('')

// ── 常用时间选项 ──
const scheduleOptions = computed<ChatOption[]>(() => [
  { label: t('envclaw.wizard.aiScheduleEveryday8'), value: '0 8 * * *' },
  { label: t('envclaw.wizard.aiScheduleEveryday9'), value: '0 9 * * *' },
  { label: t('envclaw.wizard.aiScheduleEveryday18'), value: '0 18 * * *' },
  { label: t('envclaw.wizard.aiScheduleWeekday8'), value: '0 8 * * 1-5' },
  { label: t('envclaw.wizard.aiScheduleMonday8'), value: '0 8 * * 1' },
])

// ── 提示词组装 ──
const roleBasePrompt = computed(() => {
  return templatesStore.getById(props.templateId)?.roleBasePrompt ?? ''
})

const mergedPlatformInfo = computed(() => {
  if (selectedPlatforms.value.length === 0) return null
  if (selectedPlatforms.value.length === 1) {
    const p = selectedPlatforms.value[0]
    return { name: p.name, operationPrompt: p.operationPrompt }
  }
  const names = selectedPlatforms.value.map(p => p.name).join('、')
  const prompts = selectedPlatforms.value
    .map(p => `【${p.name}】\n${p.operationPrompt}`)
    .join('\n\n')
  return { name: names, operationPrompt: prompts }
})

const selectedFunctionObjects = computed(() => selectedFunctions.value)

const { assembledPrompt } = usePromptAssembly({
  roleBasePrompt,
  selectedPlatform: mergedPlatformInfo,
  selectedFunctions: selectedFunctionObjects,
  supplement: ref(''),
})

// ── 滚动到底部 ──
function scrollToBottom() {
  nextTick(() => {
    if (chatBody.value) {
      chatBody.value.scrollTop = chatBody.value.scrollHeight
    }
  })
}

// ── 添加消息（带打字延迟） ──
async function addAiMessage(content: string, options?: ChatOption[], inputType?: 'text' | 'schedule') {
  // 模拟打字延迟
  await new Promise(resolve => setTimeout(resolve, 400 + Math.random() * 300))

  messages.value.push({
    id: ++msgId,
    role: 'ai',
    content,
    options,
    inputType,
    timestamp: Date.now(),
  })
  scrollToBottom()
}

function addUserMessage(content: string) {
  messages.value.push({
    id: ++msgId,
    role: 'user',
    content,
    timestamp: Date.now(),
  })
  scrollToBottom()
}

// ── 流程控制 ──
async function startWelcome() {
  currentStep.value = 'welcome'
  await addAiMessage(t('envclaw.wizard.aiWelcome'))
  await askPlatform()
}

async function askPlatform() {
  currentStep.value = 'platform'
  const options = platformsStore.platforms.map(p => ({
    label: p.name,
    value: p.id,
    description: p.type,
  }))

  if (options.length === 0) {
    await addAiMessage(t('envclaw.wizard.aiNoPlatform'))
    return
  }

  await addAiMessage(t('envclaw.wizard.aiAskPlatform'), options)
}

async function handlePlatformSelect(option: ChatOption) {
  const platform = platformsStore.platforms.find(p => p.id === option.value)
  if (!platform) return

  // 切换选中状态
  const idx = selectedPlatforms.value.findIndex(p => p.id === option.value)
  if (idx >= 0) {
    selectedPlatforms.value.splice(idx, 1)
  } else {
    selectedPlatforms.value.push(platform)
  }

  // 更新选项的选中状态
  const msg = messages.value[messages.value.length - 1]
  if (msg.options) {
    const opt = msg.options.find(o => o.value === option.value)
    if (opt) opt.selected = !opt.selected
  }
}

async function confirmPlatform() {
  if (selectedPlatforms.value.length === 0) {
    message.warning(t('envclaw.wizard.platformRequired'))
    return
  }

  const names = selectedPlatforms.value.map(p => p.name).join('、')
  addUserMessage(t('envclaw.wizard.aiSelected', { items: names }) || `我选择：${names}`)

  // 锁定选项
  const msg = messages.value[messages.value.length - 2]
  if (msg.options) {
    msg.options.forEach(o => {
      o.selected = selectedPlatforms.value.some(p => p.id === o.value)
    })
  }

  await askFunction()
}

async function askFunction() {
  currentStep.value = 'function'

  // 合并所有选中平台的功能
  const functions: ChatOption[] = []
  for (const platform of selectedPlatforms.value) {
    for (const fn of platform.functions ?? []) {
      if (!functions.some(f => f.value === fn.id)) {
        functions.push({
          label: fn.name,
          value: fn.id,
          description: platform.name,
        })
      }
    }
  }

  if (functions.length === 0) {
    await addAiMessage(t('envclaw.wizard.aiNoFunction'))
    await askSchedule()
    return
  }

  await addAiMessage(t('envclaw.wizard.aiAskFunction'), functions)
}

async function handleFunctionSelect(option: ChatOption) {
  // 查找功能对象
  let fn: PlatformFunction | undefined
  for (const platform of selectedPlatforms.value) {
    fn = platform.functions?.find(f => f.id === option.value)
    if (fn) break
  }
  if (!fn) return

  const idx = selectedFunctions.value.findIndex(f => f.id === option.value)
  if (idx >= 0) {
    selectedFunctions.value.splice(idx, 1)
  } else {
    selectedFunctions.value.push(fn)
  }

  // 更新选项状态
  const msg = messages.value[messages.value.length - 1]
  if (msg.options) {
    const opt = msg.options.find(o => o.value === option.value)
    if (opt) opt.selected = !opt.selected
  }
}

async function confirmFunction() {
  if (selectedFunctions.value.length > 0) {
    const names = selectedFunctions.value.map(f => f.name).join('、')
    addUserMessage(t('envclaw.wizard.aiSelected', { items: names }) || `我选择：${names}`)
  } else {
    addUserMessage(t('envclaw.wizard.aiSkipFunction'))
  }

  await askSchedule()
}

async function askSchedule() {
  currentStep.value = 'schedule'
  await addAiMessage(t('envclaw.wizard.aiAskSchedule'), scheduleOptions.value)
}

async function handleScheduleSelect(option: ChatOption) {
  schedule.value = option.value
  addUserMessage(option.label)

  // 锁定选项
  const msg = messages.value[messages.value.length - 2]
  if (msg.options) {
    msg.options.forEach(o => { o.selected = o.value === option.value })
  }

  await askTaskName()
}

async function askTaskName() {
  currentStep.value = 'taskName'
  await addAiMessage(t('envclaw.wizard.aiAskTaskName'), undefined, 'text')
}

async function handleTaskNameSubmit() {
  const name = userInput.value.trim()
  if (!name) {
    message.warning(t('envclaw.wizard.nameRequired'))
    return
  }

  taskName.value = name
  userInput.value = ''
  addUserMessage(name)

  await showSummary()
}

async function showSummary() {
  currentStep.value = 'summary'

  const platformNames = selectedPlatforms.value.map(p => p.name).join('、')
  const functionNames = selectedFunctions.value.length > 0
    ? selectedFunctions.value.map(f => f.name).join('、')
    : '无'

  const scheduleLabel = scheduleOptions.value.find(o => o.value === schedule.value)?.label || schedule.value

  const summary = [
    t('envclaw.wizard.aiSummaryTitle'),
    ``,
    t('envclaw.wizard.aiSummaryName', { name: taskName.value }),
    t('envclaw.wizard.aiSummaryPlatform', { platforms: platformNames }),
    t('envclaw.wizard.aiSummaryFunction', { functions: functionNames }),
    t('envclaw.wizard.aiSummarySchedule', { schedule: scheduleLabel }),
    t('envclaw.wizard.aiSummaryPrompt', { prompt: assembledPrompt.value?.slice(0, 80) }),
    ``,
    t('envclaw.wizard.aiSummaryConfirm'),
  ].join('\n')

  await addAiMessage(summary, [
    { label: t('envclaw.wizard.aiConfirmCreate'), value: 'confirm' },
    { label: t('envclaw.wizard.aiRestart'), value: 'restart' },
  ])
}

async function handleSummaryAction(option: ChatOption) {
  addUserMessage(option.label)

  if (option.value === 'confirm') {
    await submitTask()
  } else {
    // 重置状态
    selectedPlatforms.value = []
    selectedFunctions.value = []
    schedule.value = '0 8 * * *'
    taskName.value = ''
    messages.value = []
    await startWelcome()
  }
}

const submitting = ref(false)

async function submitTask() {
  submitting.value = true
  try {
    await jobsStore.createJob({
      name: taskName.value,
      schedule: schedule.value,
      prompt: assembledPrompt.value || undefined,
    })

    currentStep.value = 'done'
    await addAiMessage(t('envclaw.wizard.aiSuccess'))
    message.success(t('envclaw.wizard.createSuccess'))
    emit('created')
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e)
    await addAiMessage(t('envclaw.wizard.aiFailed', { error: errorMsg }))
    message.error(t('envclaw.wizard.createFailed', { error: errorMsg }))
  } finally {
    submitting.value = false
  }
}

// ── 监听选项点击 ──
function handleOptionClick(_msg: ChatMessage, option: ChatOption) {
  // 根据当前步骤处理
  switch (currentStep.value) {
    case 'platform':
      handlePlatformSelect(option)
      break
    case 'function':
      handleFunctionSelect(option)
      break
    case 'schedule':
      handleScheduleSelect(option)
      break
    case 'summary':
      handleSummaryAction(option)
      break
  }
}

// ── 确认多选 ──
function handleConfirmMulti() {
  if (currentStep.value === 'platform') {
    confirmPlatform()
  } else if (currentStep.value === 'function') {
    confirmFunction()
  }
}

// ── 提交输入 ──
function handleSubmitInput() {
  if (currentStep.value === 'taskName') {
    handleTaskNameSubmit()
  }
}

// ── 重新开始 ──
function handleRestart() {
  selectedPlatforms.value = []
  selectedFunctions.value = []
  schedule.value = '0 8 * * *'
  taskName.value = ''
  userInput.value = ''
  messages.value = []
  startWelcome()
}

// ── 初始化 ──
onMounted(() => {
  platformsStore.fetchPlatforms()
  startWelcome()
})

// ── 判断是否多选步骤 ──
const isMultiSelectStep = computed(() => {
  return currentStep.value === 'platform' || currentStep.value === 'function'
})

// ── 当前消息是否有选中项 ──
const lastMessageHasSelection = computed(() => {
  const lastAiMsg = [...messages.value].reverse().find(m => m.role === 'ai' && m.options)
  return lastAiMsg?.options?.some(o => o.selected) ?? false
})
</script>

<template>
  <div class="ai-guide">
    <!-- 对话区域 -->
    <div ref="chatBody" class="ai-chat-body">
      <div
        v-for="msg in messages"
        :key="msg.id"
        :class="['chat-msg', msg.role]"
      >
        <!-- AI 头像 -->
        <div v-if="msg.role === 'ai'" class="msg-avatar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
            <path d="M2 21c0-3 1.85-5.36 5.08-6" />
          </svg>
        </div>

        <!-- 消息内容 -->
        <div class="msg-content">
          <!-- 文本内容（支持简单 Markdown） -->
          <div
            v-if="msg.content"
            class="msg-text"
            v-html="formatMessage(msg.content)"
          />

          <!-- 选项列表 -->
          <div v-if="msg.options && msg.role === 'ai'" class="msg-options">
            <button
              v-for="opt in msg.options"
              :key="opt.value"
              :class="['opt-btn', { selected: opt.selected }]"
              @click="handleOptionClick(msg, opt)"
            >
              <span class="opt-check">
                <svg v-if="opt.selected" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
              <span class="opt-label">{{ opt.label }}</span>
              <span v-if="opt.description" class="opt-desc">{{ opt.description }}</span>
            </button>

            <!-- 多选确认按钮 -->
            <button
              v-if="isMultiSelectStep"
              class="opt-confirm"
              :disabled="!lastMessageHasSelection"
              @click="handleConfirmMulti"
            >
              {{ t('envclaw.wizard.aiConfirmSelect') }}
            </button>
          </div>

          <!-- 输入框 -->
          <div v-if="msg.inputType === 'text' && msg.role === 'ai' && currentStep === 'taskName'" class="msg-input">
            <input
              v-model="userInput"
              class="chat-input"
              :placeholder="t('envclaw.wizard.aiInputPlaceholder')"
              @keyup.enter="handleSubmitInput"
            />
            <button
              class="input-submit"
              :disabled="!userInput.trim()"
              @click="handleSubmitInput"
            >
              {{ t('envclaw.wizard.aiSend') || '发送' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 加载指示器 -->
      <div v-if="submitting" class="chat-msg ai">
        <div class="msg-avatar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
            <path d="M2 21c0-3 1.85-5.36 5.08-6" />
          </svg>
        </div>
        <div class="msg-content">
          <div class="msg-loading">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div class="ai-foot">
      <button class="btn btn-ghost" @click="emit('cancel')">
        {{ t('envclaw.wizard.cancel') }}
      </button>
      <button
        v-if="currentStep === 'done'"
        class="btn btn-primary"
        @click="handleRestart"
      >
        {{ t('envclaw.wizard.aiCreateNew') }}
      </button>
    </div>
  </div>
</template>

<script lang="ts">
// 简单的消息格式化（加粗、换行）
function formatMessage(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
}
</script>

<style scoped lang="scss">
.ai-guide {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.ai-chat-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;

  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-thumb { background: var(--envclaw-border); border-radius: 4px; }
}

.chat-msg {
  display: flex;
  gap: 10px;
  max-width: 92%;

  &.user {
    align-self: flex-end;
    flex-direction: row-reverse;

    .msg-content {
      background: var(--envclaw-button-bg);
      color: var(--envclaw-button-text);
      border-radius: 14px 14px 4px 14px;
    }
  }

  &.ai {
    align-self: flex-start;

    .msg-content {
      background: var(--envclaw-bg-tertiary);
      border-radius: 14px 14px 14px 4px;
    }
  }
}

.msg-avatar {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: rgba(106, 159, 217, 0.14);
  color: var(--envclaw-info);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
}

.msg-content {
  padding: 10px 14px;
}

.msg-text {
  font-size: 13px;
  line-height: 1.6;
  word-break: break-word;

  :deep(strong) {
    font-weight: 600;
  }
}

.msg-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
}

.opt-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  background: var(--envclaw-bg-secondary);
  border: 1px solid var(--envclaw-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;

  &:hover {
    border-color: var(--envclaw-info);
    background: rgba(106, 159, 217, 0.06);
  }

  &.selected {
    border-color: var(--envclaw-info);
    background: rgba(106, 159, 217, 0.1);
  }
}

.opt-check {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1.5px solid var(--envclaw-border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: white;
  transition: all 0.15s;

  .selected & {
    background: var(--envclaw-info);
    border-color: var(--envclaw-info);
  }
}

.opt-label {
  font-size: 13px;
  color: var(--envclaw-text-primary);
  flex: 1;
}

.opt-desc {
  font-size: 11px;
  color: var(--envclaw-text-muted);
}

.opt-confirm {
  margin-top: 4px;
  padding: 8px 16px;
  background: var(--envclaw-button-bg);
  color: var(--envclaw-button-text);
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;

  &:hover:not(:disabled) {
    background: var(--envclaw-button-bg-hover);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.msg-input {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.chat-input {
  flex: 1;
  padding: 9px 12px;
  background: var(--envclaw-input-bg);
  border: 1px solid var(--envclaw-input-border);
  border-radius: 8px;
  color: var(--envclaw-text-primary);
  font-size: 13px;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: var(--envclaw-input-border-focus);
  }

  &::placeholder {
    color: var(--envclaw-text-muted);
  }
}

.input-submit {
  padding: 9px 14px;
  background: var(--envclaw-button-bg);
  color: var(--envclaw-button-text);
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;

  &:hover:not(:disabled) {
    background: var(--envclaw-button-bg-hover);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.msg-loading {
  display: flex;
  gap: 4px;
  padding: 4px 0;

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--envclaw-text-muted);
    animation: dotPulse 1.4s infinite ease-in-out both;

    &:nth-child(1) { animation-delay: 0s; }
    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }
}

@keyframes dotPulse {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

.ai-foot {
  padding: 14px 20px;
  border-top: 1px solid var(--envclaw-border);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: 0.15s;

  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

.btn-primary {
  background: var(--envclaw-button-bg);
  color: var(--envclaw-button-text);

  &:hover:not(:disabled) { background: var(--envclaw-button-bg-hover); }
}

.btn-ghost {
  background: transparent;
  color: var(--envclaw-text-primary);
  border-color: var(--envclaw-border-light);

  &:hover { background: var(--envclaw-bg-tertiary); }
}
</style>
