<script setup lang="ts">
defineProps<{ modelValue: string[]; connectors: { id: string; name: string; type: string; tools: number }[] }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string[]): void }>()

function toggle(id: string, current: string[]) {
  emit('update:modelValue', current.includes(id) ? current.filter(x => x !== id) : [...current, id])
}
</script>

<template>
  <div class="cc-grid">
    <div v-for="mcp in connectors" :key="mcp.id" class="cc-card" :class="{ selected: modelValue.includes(mcp.id) }" @click="toggle(mcp.id, modelValue)">
      <div class="cc-icon">{{ mcp.name.charAt(0) }}</div>
      <div class="cc-info">
        <div class="cc-name">{{ mcp.name }}</div>
        <div class="cc-meta">{{ mcp.type }} · {{ mcp.tools }} 个工具</div>
      </div>
      <div class="cc-check">&#10003;</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;
.cc-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.cc-card {
  display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid $border-color; border-radius: $radius-md; cursor: pointer; background: $bg-card;
  &.selected { border-color: $accent-primary; background: rgba(var(--accent-primary-rgb), 0.04); .cc-check { opacity: 1; } }
}
.cc-icon { width: 36px; height: 36px; border-radius: 8px; background: $bg-secondary; display: flex; align-items: center; justify-content: center; font-weight: 700; color: $accent-primary; flex-shrink: 0; }
.cc-info { flex: 1; }
.cc-name { font-size: 14px; font-weight: 600; color: $text-primary; }
.cc-meta { font-size: 12px; color: $text-muted; }
.cc-check { color: $accent-primary; font-size: 16px; opacity: 0; transition: opacity 0.15s; }
</style>
