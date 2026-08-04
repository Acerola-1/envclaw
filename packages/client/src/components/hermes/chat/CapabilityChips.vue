<script setup lang="ts">
import { useDutyStore } from '@/stores/envclaw/duty'

const dutyStore = useDutyStore()
const emit = defineEmits<{ (e: 'select', cmd: string, prompt: string): void }>()

function handleChip(chip: typeof dutyStore.capabilityChips[number]) {
  emit('select', chip.id, chip.prompt)
}
</script>

<template>
  <div class="chat-cap-row">
    <button
      v-for="chip in dutyStore.capabilityChips"
      :key="chip.id"
      class="cap-chip"
      :class="{ 'chip-duty': chip.highlighted }"
      @click="handleChip(chip)"
    >
      <span class="chip-label">{{ chip.label }}</span>
    </button>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.chat-cap-row {
  display: flex; flex-wrap: wrap; gap: 10px; max-width: 800px;
  margin: 0 auto; padding: 0 24px 8px; justify-content: center; overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}
.cap-chip {
  display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px;
  border-radius: 24px; border: 1px solid $border-color; background: $bg-card;
  color: $text-primary; font-size: 13px; font-weight: 500; cursor: pointer;
  transition: .15s; font-family: inherit; white-space: nowrap; flex-shrink: 0;
  &:hover { border-color: $accent-primary; background: rgba(var(--accent-primary-rgb), .06); }
  &.chip-duty { border-color: $accent-primary; background: rgba(var(--accent-primary-rgb), .08); &:hover { background: rgba(var(--accent-primary-rgb), .14); } }
}
</style>
