<script setup lang="ts">
import { ref } from 'vue'
import JobCard from './JobCard.vue'

interface Job { id: string; name: string; schedule: string; lastRun?: string; status: string }
defineProps<{ jobs: Job[] }>()
const emit = defineEmits<{
  (e: 'edit', id: string): void
  (e: 'run', id: string): void
  (e: 'toggle', id: string): void
  (e: 'delete', id: string): void
}>()

const activeFilter = ref('all')
const search = ref('')
const filters = ['all', 'running', 'paused', 'failed'] as const
const filterLabels: Record<string, string> = { all: '全部', running: '运行中', paused: '已暂停', failed: '失败' }
</script>

<template>
  <div class="job-grid-shell">
    <div class="filter-bar">
      <div class="filter-pills">
        <button v-for="f in filters" :key="f" class="filter-pill" :class="{ active: activeFilter === f }" @click="activeFilter = f">
          {{ filterLabels[f] }}
        </button>
      </div>
      <input v-model="search" class="filter-search" placeholder="搜索任务名..." />
    </div>
    <div class="card-grid">
      <JobCard v-for="job in jobs" :key="job.id" :job="job" @edit="emit('edit', $event)" @run="emit('run', $event)" @toggle="emit('toggle', $event)" @delete="emit('delete', $event)" />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;
.filter-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.filter-pills { display: flex; gap: 6px; }
.filter-pill {
  padding: 6px 14px; border: 1px solid $border-color; border-radius: 999px; background: $bg-card;
  color: $text-secondary; font-size: 13px; cursor: pointer;
  &.active { background: $accent-primary; color: #fff; border-color: $accent-primary; }
}
.filter-search {
  padding: 6px 12px; border: 1px solid $border-color; border-radius: $radius-sm;
  font-size: 13px; width: 200px; outline: none;
  &:focus { border-color: $accent-primary; }
}
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
</style>
