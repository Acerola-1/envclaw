<script setup lang="ts">
const props = defineProps<{ label: string; sub: string; level: number; expanded: boolean; isLast?: boolean }>()
const emit = defineEmits<{ (e: 'toggle'): void }>()
</script>

<template>
  <div class="rli-row" :class="`rli-level-${level}`" :style="{ paddingLeft: `${(level - 1) * 20 + 12}px` }" @click="emit('toggle')">
    <svg class="rli-arrow" :class="{ expanded }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
    <span class="rli-label">{{ label }}</span>
    <span class="rli-sub">{{ sub }}</span>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
.rli-row {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  cursor: pointer; font-size: 13px; border-bottom: 1px solid $border-light;
  &:hover { background: rgba(var(--accent-primary-rgb), 0.03); }
  &.rli-level-1 { font-weight: 600; }
}
.rli-arrow { transition: transform 0.15s; flex-shrink: 0; color: $text-muted; &.expanded { transform: rotate(90deg); } }
.rli-label { flex: 1; color: $text-primary; }
.rli-sub { color: $text-muted; font-size: 12px; flex-shrink: 0; }
</style>
