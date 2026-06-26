<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useJobsStore } from '@/stores/hermes/jobs'
import { usePlatformsStore } from '@/stores/envclaw/platforms'
import type { Job } from '@/api/hermes/jobs'
import type { ScenarioTemplate } from '@/stores/envclaw/templates'
import OverviewBanner from '@/components/envclaw/workstation/OverviewBanner.vue'
import StatCards from '@/components/envclaw/workstation/StatCards.vue'
import ScenarioGrid from '@/components/envclaw/workstation/ScenarioGrid.vue'
import ActiveTasks from '@/components/envclaw/workstation/ActiveTasks.vue'
import PlatformBar from '@/components/envclaw/workstation/PlatformBar.vue'
import TaskWizard from '@/components/envclaw/wizard/TaskWizard.vue'

const jobsStore = useJobsStore()
const platformsStore = usePlatformsStore()

// 向导状态
const wizardVisible = ref(false)
const wizardTemplate = ref<ScenarioTemplate | null>(null)

function openWizard(tpl: ScenarioTemplate) {
  wizardTemplate.value = tpl
  wizardVisible.value = true
}

function closeWizard() {
  wizardVisible.value = false
  wizardTemplate.value = null
}

async function onWizardCreated() {
  closeWizard()
  // 刷新任务列表
  await jobsStore.fetchJobs()
}

function onSelectJob(_job: Job) {
  // Phase 4: 打开任务详情
}

onMounted(() => {
  void jobsStore.fetchJobs()
  void platformsStore.fetchPlatforms()
})
</script>

<template>
  <div class="workstation-home">
    <div class="main-area">
      <OverviewBanner />
      <StatCards />
      <ScenarioGrid @select="openWizard" />
      <ActiveTasks @select-job="onSelectJob" />
      <PlatformBar />
    </div>

    <!-- 右侧向导面板 -->
    <TaskWizard
      :template="wizardTemplate"
      :visible="wizardVisible"
      @close="closeWizard"
      @created="onWizardCreated"
    />
  </div>
</template>

<style scoped lang="scss">
.workstation-home {
  position: relative;
  height: 100%;
}

.main-area {
  width: 100%;
  max-width: 1080px;
  margin: 0 auto;
  padding: 28px 32px 48px;
  overflow-y: auto;
  height: 100%;
}
</style>
