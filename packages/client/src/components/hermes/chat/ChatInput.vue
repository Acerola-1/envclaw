<script setup lang="ts">
import { ref, nextTick } from 'vue'

const props = withDefaults(defineProps<{
  modelValue?: string
  disabled?: boolean
  placeholder?: string
}>(), { modelValue: '', disabled: false, placeholder: '今天帮你做些什么？ @ 引用对话文件，/ 调用技能与指令' })

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'send'): void
  (e: 'slash'): void
}>()

const textarea = ref<HTMLTextAreaElement>()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    if (props.modelValue.trim()) emit('send')
  }
  if (e.key === '/' && props.modelValue === '') {
    emit('slash')
  }
}

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
}

function fill(prompt: string) {
  emit('update:modelValue', prompt)
  nextTick(() => textarea.value?.focus())
}

defineExpose({ fill })
</script>

<template>
  <textarea
    ref="textarea"
    :value="modelValue"
    :disabled="disabled"
    :placeholder="placeholder"
    rows="3"
    @input="onInput"
    @keydown="onKeydown"
  />
</template>
