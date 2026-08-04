<script setup lang="ts">
const channels = ['企业微信', '钉钉', '飞书', '邮件', '本地']
const props = defineProps<{ modelValue: string[] }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string[]): void }>()

function toggle(ch: string) {
  const next = props.modelValue.includes(ch) ? props.modelValue.filter(c => c !== ch) : [...props.modelValue, ch]
  emit('update:modelValue', next)
}
</script>

<template>
  <div class="push-select">
    <label class="ps-label">推送渠道</label>
    <div class="ps-chips">
      <button v-for="ch in channels" :key="ch" class="ps-chip" :class="{ active: modelValue.includes(ch) }" @click="toggle(ch)">{{ ch }}</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;
.ps-label { font-size: 14px; font-weight: 600; color: $text-primary; margin-bottom: 8px; display: block; }
.ps-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.ps-chip {
  padding: 6px 16px; border: 1px solid $border-color; border-radius: 999px; background: $bg-card; color: $text-secondary; font-size: 13px; cursor: pointer;
  &.active { background: rgba(var(--accent-primary-rgb), 0.1); border-color: $accent-primary; color: $accent-primary; }
}
</style>
