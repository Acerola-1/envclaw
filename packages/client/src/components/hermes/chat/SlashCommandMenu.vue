<script setup lang="ts">
import { computed, watch, ref } from 'vue'
import { useDutyStore } from '@/stores/envclaw/duty'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'select', cmd: string, prompt: string): void; (e: 'close'): void }>()

const dutyStore = useDutyStore()
const activeIdx = ref(0)
const items = computed(() => dutyStore.capabilityChips.map(c => ({ id: c.id, label: c.label, prompt: c.prompt })))

watch(() => props.visible, (v) => { if (v) activeIdx.value = 0 })

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx.value = Math.min(activeIdx.value + 1, items.value.length - 1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx.value = Math.max(activeIdx.value - 1, 0) }
  else if (e.key === 'Enter') { e.preventDefault(); const item = items.value[activeIdx.value]; if (item) emit('select', item.id, item.prompt) }
  else if (e.key === 'Escape') { emit('close') }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="slash-overlay" @click="emit('close')">
      <div class="slash-menu" :style="{ position: 'fixed', bottom: '120px', left: '280px' }" @click.stop @keydown="onKeydown">
        <div v-for="(item, idx) in items" :key="item.id"
          class="slash-item" :class="{ active: idx === activeIdx }"
          @click="emit('select', item.id, item.prompt)">
          <span class="slash-cmd">/{{ item.id }}</span>
          <span class="slash-label">{{ item.label }}</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;
.slash-overlay { position: fixed; inset: 0; z-index: 999; }
.slash-menu {
  background: $bg-card; border: 1px solid $border-color; border-radius: $radius-md;
  box-shadow: 0 8px 30px rgba(0,0,0,0.12); padding: 6px; min-width: 280px;
}
.slash-item {
  display: flex; gap: 12px; padding: 10px 12px; border-radius: $radius-sm; cursor: pointer;
  &:hover, &.active { background: rgba(var(--accent-primary-rgb), 0.06); }
  .slash-cmd { font-family: $font-code; font-size: 13px; color: $accent-primary; min-width: 80px; }
  .slash-label { font-size: 13px; color: $text-primary; }
}
</style>
