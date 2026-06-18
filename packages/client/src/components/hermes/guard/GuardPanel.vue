<script setup lang="ts">
import { ref, computed } from 'vue'

interface GuardRobot {
  id: string
  name: string
  icon: string
  description: string
  category: 'scheduled' | 'monitoring' | 'daily'
  color: string
  iconClass: string
  typeName: string
  schedule: string
}

const emit = defineEmits<{
  select: [robot: GuardRobot]
  createTask: [robot: GuardRobot]
}>()

const robots = ref<GuardRobot[]>([
  {
    id: 'digital-broadcast',
    name: '数字播报专家',
    icon: '📡',
    description: '每小时从中大/华东平台拉取小时监测数据，自动填充播报表，生成图片推送至工作群。',
    category: 'scheduled',
    color: '#059669',
    iconClass: 'icon-broadcast',
    typeName: '数据动态播报 · 定时任务',
    schedule: '每小时整点触发'
  },
  {
    id: 'screenshot',
    name: '截图采集专家',
    icon: '📸',
    description: '自动登录各平台，截取考核站点分钟数据图、乡镇站数据图、一张图等，推送至工作群。',
    category: 'scheduled',
    color: '#2563eb',
    iconClass: 'icon-screenshot',
    typeName: '分钟数据截图 · 定时任务',
    schedule: '每小时25分触发'
  },
  {
    id: 'city-ranking',
    name: '城市排名分析专家',
    icon: '📊',
    description: '从数智大气平台截取全省地市排名和市各区排名，标注异常数据和关注城市，推送至工作群。',
    category: 'scheduled',
    color: '#d97706',
    iconClass: 'icon-rank',
    typeName: '排名分析推送 · 定时任务',
    schedule: '每小时45分触发'
  },
  {
    id: 'high-value-alert',
    name: '高值提醒分析专家',
    icon: '🔴',
    description: '持续监控站点分钟数据，发现连续高值自动拉取周边及气象数据，AI生成高值分析报告并推送。',
    category: 'monitoring',
    color: '#dc2626',
    iconClass: 'icon-high-value',
    typeName: '高值分析及提醒 · 持续监控',
    schedule: '工作时段持续运行'
  },
  {
    id: 'target-calc',
    name: '达标测算专家',
    icon: '🎯',
    description: '实时监测日累计AQI，进入临界区间时自动测算各污染物控制上限，AI生成管控建议推送。',
    category: 'monitoring',
    color: '#7c3aed',
    iconClass: 'icon-target',
    typeName: '保良达标测算 · 持续监控',
    schedule: '工作时段持续运行'
  },
  {
    id: 'daily-report',
    name: '日报通报专家',
    icon: '📰',
    description: '每日从省平台下载昨日报表，自动计算排名，AI生成文字版空气质量通报，推送至工作群。',
    category: 'daily',
    color: '#16a34a',
    iconClass: 'icon-daily',
    typeName: '昨日空气质量回顾 · 每日任务',
    schedule: '每日 09:00 触发'
  }
])

const categoryFilter = ref<'all' | 'scheduled' | 'monitoring'>('all')

const filteredRobots = computed(() => {
  if (categoryFilter.value === 'all') return robots.value
  return robots.value.filter(r => r.category === categoryFilter.value)
})

function handleSelect(robot: GuardRobot) {
  emit('select', robot)
}

function handleCreateTask(robot: GuardRobot, event: Event) {
  event.stopPropagation()
  emit('createTask', robot)
}
</script>

<template>
  <div class="guard-panel">
    <div class="guard-header">
      <h2 class="guard-title">🤖 值守方案</h2>
      <p class="guard-subtitle">选择智能值守机器人，配置并创建自动化分析任务</p>
    </div>

    <div class="guard-content">
      <div class="robot-grid">
        <div
          v-for="robot in filteredRobots"
          :key="robot.id"
          class="robot-card"
          :style="{ '--robot-color': robot.color }"
          @click="handleSelect(robot)"
        >
          <div class="robot-card-header">
            <div class="robot-card-icon" :class="robot.iconClass">{{ robot.icon }}</div>
            <div class="robot-card-header-info">
              <div class="robot-card-title">{{ robot.name }}</div>
              <div class="robot-card-type">{{ robot.typeName }}</div>
            </div>
          </div>
          <div class="robot-card-desc">{{ robot.description }}</div>
          <div class="robot-card-footer">
            <div class="robot-card-schedule">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {{ robot.schedule }}
            </div>
            <button class="btn-create-task" @click="handleCreateTask(robot, $event)">创建任务</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.guard-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.guard-header {
  padding: 20px 24px;
  background: var(--bg-card, #ffffff);
  border-bottom: 1px solid var(--border-light, #f0f1f3);
  flex-shrink: 0;
}

.guard-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #1a1d26);
  margin: 0 0 4px 0;
}

.guard-subtitle {
  font-size: 12px;
  color: var(--text-muted, #9ca3b8);
  margin: 0;
}

.guard-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.guard-content::-webkit-scrollbar {
  width: 4px;
}

.guard-content::-webkit-scrollbar-thumb {
  background: var(--border-color, #e5e7eb);
  border-radius: 4px;
}

.robot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.robot-card {
  background: var(--bg-card, #ffffff);
  border: 1.5px solid var(--border-color, #e5e7eb);
  border-radius: 16px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  overflow: hidden;
}

.robot-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--robot-color, #4f6ef7), transparent);
  opacity: 0;
  transition: opacity 0.25s;
}

.robot-card:hover {
  border-color: var(--accent, #4f6ef7);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

.robot-card:hover::before {
  opacity: 1;
}

.robot-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.robot-card-header-info {
  flex: 1;
  min-width: 0;
}

.robot-card-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

/* 每个机器人的图标渐变背景 */
.icon-broadcast {
  background: linear-gradient(135deg, #ecfdf5, #d1fae5);
  color: #059669;
}

.icon-screenshot {
  background: linear-gradient(135deg, #eff6ff, #dbeafe);
  color: #2563eb;
}

.icon-rank {
  background: linear-gradient(135deg, #fef3c7, #fde68a);
  color: #d97706;
}

.icon-high-value {
  background: linear-gradient(135deg, #fee2e2, #fecaca);
  color: #dc2626;
}

.icon-target {
  background: linear-gradient(135deg, #faf5ff, #e9d5ff);
  color: #7c3aed;
}

.icon-daily {
  background: linear-gradient(135deg, #f0fdf4, #bbf7d0);
  color: #16a34a;
}

.robot-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #1a1d26);
}

.robot-card-type {
  font-size: 11px;
  color: var(--text-muted, #9ca3b8);
  margin-top: 1px;
}

.robot-card-desc {
  font-size: 12px;
  color: var(--text-secondary, #5f6577);
  line-height: 1.5;
  margin-bottom: 14px;
}

.robot-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.robot-card-schedule {
  font-size: 11px;
  color: var(--text-muted, #9ca3b8);
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-create-task {
  padding: 6px 14px;
  border: none;
  background: var(--accent, #4f6ef7);
  color: #ffffff;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-create-task:hover {
  background: var(--accent-hover, #3b5de7);
  transform: scale(1.03);
}
</style>
