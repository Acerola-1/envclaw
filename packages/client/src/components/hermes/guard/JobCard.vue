<script setup lang="ts">
import { useRouter } from 'vue-router'

const props = defineProps<{
  job: { id: string; name: string; schedule: string; lastRun?: string; status: string }
}>()
const emit = defineEmits<{
  (e: 'edit', id: string): void
  (e: 'run', id: string): void
  (e: 'toggle', id: string): void
  (e: 'delete', id: string): void
}>()

const router = useRouter()

function goDetail() { router.push({ name: 'hermes.dutyDetail', params: { id: props.job.id } }) }
function statusLabel(s: string) {
  const map: Record<string, string> = { running: '运行中', paused: '已暂停', failed: '失败' }
  return map[s] ?? s
}
function statusColor(s: string) {
  const map: Record<string, string> = { running: '#22c55e', paused: '#f59e0b', failed: '#ef4444' }
  return map[s] ?? '#999'
}
</script>

<template>
  <div class="job-card" @click="goDetail">
    <div class="jc-status-bar" :style="{ background: statusColor(job.status) }" />
    <div class="jc-body">
      <h4 class="jc-name">{{ job.name }}</h4>
      <div class="jc-meta">
        <span class="jc-schedule">{{ job.schedule }}</span>
        <span v-if="job.lastRun" class="jc-last-run">{{ job.lastRun }}</span>
      </div>
      <span class="jc-status-badge" :style="{ color: statusColor(job.status) }">{{ statusLabel(job.status) }}</span>
    </div>
    <div class="jc-actions" @click.stop>
      <button class="jc-btn" @click="emit('edit', job.id)">编辑</button>
      <button class="jc-btn" @click="emit('run', job.id)">立即运行</button>
      <button class="jc-btn" @click="emit('toggle', job.id)">{{ job.status === 'running' ? '暂停' : '恢复' }}</button>
      <button class="jc-btn danger" @click="emit('delete', job.id)">删除</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;
.job-card {
  background: $bg-card; border: 1px solid $border-color; border-radius: $radius-md;
  overflow: hidden; cursor: pointer; transition: box-shadow 0.2s;
  &:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
}
.jc-status-bar { height: 3px; }
.jc-body { padding: 16px 16px 8px; }
.jc-name { font-size: 15px; font-weight: 600; margin: 0 0 6px; color: $text-primary; }
.jc-meta { display: flex; gap: 12px; font-size: 12px; color: $text-muted; margin-bottom: 6px; }
.jc-actions { display: flex; gap: 4px; padding: 8px 16px 12px; border-top: 1px solid $border-light; }
.jc-btn {
  padding: 4px 10px; border: 1px solid $border-color; border-radius: $radius-sm;
  background: $bg-card; color: $text-secondary; font-size: 12px; cursor: pointer;
  &:hover { border-color: $accent-primary; color: $accent-primary; }
  &.danger:hover { border-color: $error; color: $error; }
}
</style>
