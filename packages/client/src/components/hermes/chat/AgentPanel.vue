<script setup lang="ts">
export interface AgentItem {
  id: string
  name: string
  icon: string
  description: string
  category: 'preset' | 'custom'
  prompt?: string
}

const props = defineProps<{
  activeAgentId?: string | null
}>()

const emit = defineEmits<{
  select: [agent: AgentItem]
  'fill-prompt': [text: string]
  'open-more': []
}>()

const presetAgents: AgentItem[] = [
  {
    id: 'status',
    name: '问现状',
    icon: '📊',
    description: '查询当前数据指标现状',
    category: 'preset',
    prompt: '请帮我分析当前各站点的空气质量数据现状，包括AQI、PM2.5、PM10、O3等主要指标的实时数值和同比变化情况。',
  },
  {
    id: 'future',
    name: '问将来',
    icon: '🔮',
    description: '预测未来数据趋势',
    category: 'preset',
    prompt: '请根据历史数据和气象条件，预测未来24-48小时的空气质量变化趋势，重点关注是否可能出现污染过程。',
  },
  {
    id: 'rootcause',
    name: '问根因',
    icon: '🔍',
    description: '分析数据异常根因',
    category: 'preset',
    prompt: '请分析近期空气质量数据异常的根因，结合气象条件、排放源和周边区域传输等因素进行综合诊断。',
  },
]

const myAgents: AgentItem[] = [
  {
    id: 'hourly-broadcast',
    name: '小时播报',
    icon: '⏰',
    description: '每小时自动播报数据',
    category: 'custom',
    prompt: '请播报最近一小时的空气质量数据，包括各站点AQI排名、首要污染物及浓度变化情况。',
  },
  {
    id: 'ratio-analysis',
    name: '综合占比分析',
    icon: '📈',
    description: '多维度占比分析报告',
    category: 'custom',
    prompt: '请对当前空气质量数据进行综合占比分析，包括各污染物浓度占比、优良天数占比、站点达标率等维度。',
  },
]

function handleAgentClick(agent: AgentItem) {
  emit('select', agent)
}

function handleOpenMore() {
  emit('open-more')
}
</script>

<template>
  <aside class="agent-panel">
    <div class="agent-panel-header">
      <span class="agent-panel-title">问数</span>
    </div>

    <div class="agent-panel-content">
      <!-- Preset agents -->
      <div class="agent-section">
        <!-- <div class="agent-section-label">预设智能体</div> -->
        <div class="agent-list">
          <button v-for="agent in presetAgents" :key="agent.id" class="agent-item"
            :class="{ active: activeAgentId === agent.id }" type="button" @click="handleAgentClick(agent)">
            <span class="agent-icon">{{ agent.icon }}</span>
            <div class="agent-info">
              <span class="agent-name">{{ agent.name }}</span>
              <span class="agent-desc">{{ agent.description }}</span>
            </div>
          </button>
        </div>
      </div>

      <div class="agent-panel-header">
        <span class="agent-panel-title">我的智能体</span>
        <button class="agent-more-link" type="button" @click="handleOpenMore">
          <span>更多</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
      <!-- My agents -->
      <div class="agent-section">
        <div class="agent-list">
          <button v-for="agent in myAgents" :key="agent.id" class="agent-item"
            :class="{ active: activeAgentId === agent.id }" type="button" @click="handleAgentClick(agent)">
            <span class="agent-icon">{{ agent.icon }}</span>
            <div class="agent-info">
              <span class="agent-name">{{ agent.name }}</span>
              <span class="agent-desc">{{ agent.description }}</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.agent-panel {
  width: 240px;
  min-width: 240px;
  height: 100%;
  background-color: $bg-sidebar;
  border-right: 1px solid $border-color;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width $transition-normal, min-width $transition-normal;
}

.agent-panel-header {
  padding: 14px 16px 10px;
  border-bottom: 1px solid $border-light;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.agent-panel-title {
  font-size: 14px;
  font-weight: 600;
  color: $text-primary;
}

.agent-panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 10px;
  scrollbar-width: thin;
}

.agent-section {
  margin-bottom: 16px;
}

.agent-section-label {
  font-size: 10px;
  font-weight: 600;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  padding: 4px 8px 6px;
}

.agent-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.agent-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 10px;
  border: none;
  background: none;
  appearance: none;
  text-decoration: none;
  color: $text-secondary;
  border-radius: $radius-sm;
  cursor: pointer;
  width: 100%;
  text-align: left;
  transition: all $transition-fast;

  &:hover {
    background-color: rgba(var(--accent-primary-rgb), 0.06);
    color: $text-primary;
  }

  &.active {
    background-color: rgba(var(--accent-primary-rgb), 0.12);
    color: $accent-primary;

    .agent-name {
      font-weight: 600;
    }
  }
}

.agent-icon {
  font-size: 18px;
  line-height: 1;
  flex-shrink: 0;
  margin-top: 1px;
}

.agent-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.agent-name {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.3;
}

.agent-desc {
  font-size: 11px;
  color: $text-muted;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-more-link {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  border: none;
  background: none;
  appearance: none;
  color: $text-muted;
  font-size: 12px;
  cursor: pointer;
  border-radius: $radius-sm;
  transition: all $transition-fast;
  flex-shrink: 0;

  &:hover {
    color: $accent-primary;
    background-color: rgba(var(--accent-primary-rgb), 0.06);
  }

  svg {
    opacity: 0.6;
  }
}
</style>
