<script setup lang="ts">
import { ref } from 'vue'
import RunLogItem from './RunLogItem.vue'

// Mock 数据结构，生产从 api/envclaw/jobs 拉取
interface RunLogJob {
  id: string; name: string; runs: RunLogRun[]
}
interface RunLogRun {
  id: string; time: string; duration: string; status: string; results: number; logs?: string
}

defineProps<{ jobs: RunLogJob[] }>()
const expandedL1 = ref<Set<string>>(new Set())
const expandedL2 = ref<Set<string>>(new Set())
const timeFilter = ref('7d')
const statusFilter = ref('all')

function toggleL1(id: string) {
  if (expandedL1.value.has(id)) expandedL1.value.delete(id)
  else expandedL1.value.add(id)
}
function toggleL2(_id: string) { /* similar */ }
</script>

<template>
  <div class="runlog-shell">
    <div class="runlog-filter">
      <select v-model="timeFilter"> <option value="today">今日</option><option value="7d">近 7 天</option><option value="30d">近 30 天</option><option value="custom">自定义</option></select>
      <select v-model="statusFilter"> <option value="all">全部</option><option value="success">成功</option><option value="failed">失败</option><option value="running">进行中</option></select>
      <input placeholder="搜索任务名..." />
    </div>
    <div class="runlog-list">
      <template v-for="job in jobs" :key="job.id">
        <RunLogItem :label="job.name" :sub="`${job.runs.length} 次执行`" :level="1" :expanded="expandedL1.has(job.id)" @toggle="toggleL1(job.id)" />
        <template v-if="expandedL1.has(job.id)">
          <RunLogItem v-for="run in job.runs" :key="run.id" :label="run.time" :sub="run.duration" :level="2" :expanded="expandedL2.has(run.id)" @toggle="toggleL2(run.id)" />
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
.runlog-shell { }
.runlog-filter { display: flex; gap: 8px; margin-bottom: 12px; select, input { padding: 6px 12px; border: 1px solid $border-color; border-radius: $radius-sm; } }
.runlog-list { border: 1px solid $border-color; border-radius: $radius-md; overflow: hidden; }
</style>
