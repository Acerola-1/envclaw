<script setup lang="ts">
import { ref, computed } from 'vue'

export interface AgentMoreItem {
  id: string
  name: string
  icon: string
  description: string
  prompt: string
  category: string
  color: string
  iconClass: string
}

export interface AgentGroup {
  label: string
  items: AgentMoreItem[]
}

export interface AgentSubCategory {
  key: string
  label: string
  groups: AgentGroup[]
}

export interface AgentCategory {
  key: string
  label: string
  subCategories: AgentSubCategory[]
}

const emit = defineEmits<{
  select: [agent: AgentMoreItem]
  close: []
}>()

// ── Category data with colors ──────────────────────────────────
const categories: AgentCategory[] = [
  {
    key: 'atmosphere',
    label: '大气',
    subCategories: [
      {
        key: 'analysis',
        label: '智能分析',
        groups: [
          {
            label: '数据统计',
            items: [
              { id: 'hourly-broadcast', name: '小时播报', icon: '⏰', description: '每小时自动播报空气质量监测数据，支持自定义播报时段与指标范围', prompt: '请帮我播报最近一小时的空气质量监测数据，包括各站点AQI、PM2.5、PM10、O3等主要污染物浓度及同比变化情况。', category: '数据统计', color: '#059669', iconClass: 'icon-broadcast' },
              { id: 'concentration-rank', name: '浓度排名', icon: '🏆', description: '对各监测站点污染物浓度进行实时排名，快速定位高值区域', prompt: '请对各监测站点的污染物浓度进行排名，列出AQI、PM2.5、PM10等指标的前10名和后10名站点。', category: '数据统计', color: '#2563eb', iconClass: 'icon-rank' },
              { id: 'monitor-data', name: '监测数据', icon: '📡', description: '实时查询各站点六参及特征因子监测数据，支持多维度筛选', prompt: '请查询当前各监测站点的六参监测数据（AQI、PM2.5、PM10、SO2、NO2、CO、O3），并标注超标情况。', category: '数据统计', color: '#7c3aed', iconClass: 'icon-monitor' },
            ],
          },
          {
            label: '对比分析',
            items: [
              { id: 'single-index', name: '单指标分析', icon: '📐', description: '针对单一污染物指标进行深度分析，揭示浓度变化规律与趋势', prompt: '请对PM2.5指标进行深度分析，包括近7天浓度变化趋势、日均值对比及超标天数统计。', category: '对比分析', color: '#d97706', iconClass: 'icon-single' },
              { id: 'multi-index', name: '多指标分析', icon: '📊', description: '同时对比多个污染物指标，综合评估空气质量状况', prompt: '请同时对比PM2.5、PM10、O3、NO2等主要污染物指标，综合评估当前空气质量状况及各指标间的关联性。', category: '对比分析', color: '#dc2626', iconClass: 'icon-multi' },
              { id: 'aqi-calendar', name: '空气质量日历', icon: '📅', description: '以日历形式展示每日空气质量等级，直观呈现时间分布特征', prompt: '请以日历形式展示本月每日空气质量等级分布，统计优良天数、轻度及以上污染天数。', category: '对比分析', color: '#16a34a', iconClass: 'icon-calendar' },
              { id: 'composite-ratio', name: '综指占比分析', icon: '🥧', description: '分析综合指数中各污染物贡献占比，识别主要影响因子', prompt: '请分析综合指数中各污染物的贡献占比，识别影响空气质量的主要因子及其权重。', category: '对比分析', color: '#0891b2', iconClass: 'icon-pie' },
              { id: 'primary-pollutant', name: '首污占比分析', icon: '🔬', description: '统计首要污染物出现频次及占比，明确污染特征', prompt: '请统计近期首要污染物出现频次及占比分布，分析主要污染特征和变化规律。', category: '对比分析', color: '#9333ea', iconClass: 'icon-primary' },
              { id: 'air-grade', name: '空气等级分析', icon: '🌡️', description: '统计各空气质量等级天数及占比，评估整体空气质量水平', prompt: '请统计本年度各空气质量等级（优、良、轻度、中度、重度、严重）的天数及占比，评估整体空气质量水平。', category: '对比分析', color: '#059669', iconClass: 'icon-grade' },
            ],
          },
          {
            label: '特征分析',
            items: [
              { id: 'city-boundary', name: '城市边界', icon: '🏙️', description: '基于城市边界分析区域空气质量空间分布特征与传输影响', prompt: '请基于城市边界分析区域空气质量的空间分布特征，评估区域传输对本地空气质量的影响程度。', category: '特征分析', color: '#2563eb', iconClass: 'icon-city' },
              { id: 'concentration-ratio', name: '浓度比值分析', icon: '⚖️', description: '计算特征污染物浓度比值，辅助判断污染来源与类型', prompt: '请计算PM2.5/PM10、NO2/SO2等特征污染物浓度比值，辅助判断污染来源是扬尘型、燃煤型还是机动车尾气型。', category: '特征分析', color: '#d97706', iconClass: 'icon-ratio' },
              { id: 'concentration-boxplot', name: '浓度箱线', icon: '📈', description: '以箱线图展示浓度分布特征，识别异常值与离散程度', prompt: '请以箱线图形式展示各站点PM2.5浓度分布特征，识别异常高值和数据离散程度。', category: '特征分析', color: '#7c3aed', iconClass: 'icon-boxplot' },
            ],
          },
        ],
      },
      {
        key: 'interaction',
        label: '智能交互',
        groups: [
          {
            label: '对话查询',
            items: [
              { id: 'ask-status', name: '问现状', icon: '📊', description: '通过自然语言查询当前空气质量数据指标现状', prompt: '请帮我查询当前空气质量数据指标现状，包括各监测站点的AQI、PM2.5、PM10、O3等主要污染物浓度及排名情况。', category: '对话查询', color: '#059669', iconClass: 'icon-status' },
              { id: 'ask-future', name: '问将来', icon: '🔮', description: '基于历史数据预测未来空气质量变化趋势', prompt: '请根据历史数据预测未来24-48小时的空气质量变化趋势，重点关注污染物浓度走势和可能出现的污染过程。', category: '对话查询', color: '#2563eb', iconClass: 'icon-future' },
              { id: 'ask-rootcause', name: '问根因', icon: '🔍', description: '智能分析数据异常的深层原因与影响因素', prompt: '请分析近期空气质量数据异常的深层原因，结合气象条件、排放源和区域传输等因素进行综合研判。', category: '对话查询', color: '#dc2626', iconClass: 'icon-rootcause' },
            ],
          },
        ],
      },
    ],
  },
  {
    key: 'water',
    label: '水环境',
    subCategories: [
      {
        key: 'analysis',
        label: '智能分析',
        groups: [
          {
            label: '数据统计',
            items: [
              { id: 'water-monitor', name: '水质监测', icon: '💧', description: '实时查询各断面水质监测数据，支持多参数筛选与对比', prompt: '请查询当前各水质监测断面的实时监测数据，包括pH、溶解氧、COD、氨氮等主要指标及达标情况。', category: '数据统计', color: '#0891b2', iconClass: 'icon-water' },
              { id: 'water-rank', name: '水质排名', icon: '🏅', description: '对各监测断面水质指标进行排名，快速识别超标区域', prompt: '请对各水质监测断面的主要指标进行排名，识别超标区域和重点关注断面。', category: '数据统计', color: '#d97706', iconClass: 'icon-water-rank' },
            ],
          },
          {
            label: '趋势分析',
            items: [
              { id: 'water-trend', name: '趋势分析', icon: '📉', description: '分析水质指标时间变化趋势，识别改善或恶化态势', prompt: '请分析近3个月水质主要指标的时间变化趋势，判断水质整体呈改善还是恶化态势。', category: '趋势分析', color: '#16a34a', iconClass: 'icon-trend' },
              { id: 'water-compare', name: '同期对比', icon: '🔄', description: '对比同期水质数据，评估治理措施效果', prompt: '请对比今年与去年同期的水质监测数据，评估水环境治理措施的实施效果。', category: '趋势分析', color: '#9333ea', iconClass: 'icon-compare' },
            ],
          },
        ],
      },
      {
        key: 'interaction',
        label: '智能交互',
        groups: [
          {
            label: '对话查询',
            items: [
              { id: 'water-ask', name: '问水质', icon: '🌊', description: '通过自然语言查询水质监测数据与分析结果', prompt: '请帮我查询当前水质监测数据，包括各断面的水质类别、主要污染物浓度及达标情况。', category: '对话查询', color: '#0891b2', iconClass: 'icon-water-ask' },
            ],
          },
        ],
      },
    ],
  },
  {
    key: 'enforcement',
    label: '执法',
    subCategories: [
      {
        key: 'analysis',
        label: '智能分析',
        groups: [
          {
            label: '案件管理',
            items: [
              { id: 'case-summary', name: '案件汇总', icon: '📋', description: '自动汇总执法案件数据，生成统计报表与分析报告', prompt: '请汇总本月环境执法案件数据，包括案件数量、类型分布、处罚金额及整改完成率等统计信息。', category: '案件管理', color: '#d97706', iconClass: 'icon-case' },
              { id: 'violation-detect', name: '违规检测', icon: '🚨', description: '基于数据分析自动识别潜在违规行为与异常排放', prompt: '请基于近期监测数据分析，识别潜在的环境违规行为和异常排放情况，列出重点怀疑对象。', category: '案件管理', color: '#dc2626', iconClass: 'icon-violation' },
            ],
          },
        ],
      },
      {
        key: 'interaction',
        label: '智能交互',
        groups: [
          {
            label: '对话查询',
            items: [
              { id: 'law-ask', name: '问法规', icon: '⚖️', description: '查询环境法规标准与执法依据，辅助执法决策', prompt: '请查询大气污染防治相关法规标准，包括排放限值、处罚依据和执法程序要求。', category: '对话查询', color: '#7c3aed', iconClass: 'icon-law' },
            ],
          },
        ],
      },
    ],
  },
]

// ── State ──────────────────────────────────────────────────────
const activeCategory = ref(categories[0].key)
const activeSubCategory = ref<string>('all')
const sortBy = ref<'latest' | 'hottest'>('latest')
const searchQuery = ref('')

const currentCategory = computed(() =>
  categories.find(c => c.key === activeCategory.value)!,
)

const subCategoryTabs = computed(() => [
  { key: 'all', label: '全部' },
  ...currentCategory.value.subCategories,
])

const filteredGroups = computed(() => {
  let subCats = currentCategory.value.subCategories

  if (activeSubCategory.value !== 'all') {
    subCats = subCats.filter(sc => sc.key === activeSubCategory.value)
  }

  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return subCats.map(sc => sc.groups).flat()

  return subCats
    .map(sc =>
      sc.groups
        .map(g => ({
          ...g,
          items: g.items.filter(
            it =>
              it.name.toLowerCase().includes(query) ||
              it.description.toLowerCase().includes(query),
          ),
        }))
        .filter(g => g.items.length > 0),
    )
    .flat()
})

function handleSelect(agent: AgentMoreItem) {
  emit('select', agent)
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <div class="agent-more-panel">
    <!-- Header -->
    <div class="amp-header">
      <div class="amp-header-info">
        <h2 class="amp-title">🤖 智能体广场</h2>
        <p class="amp-subtitle">选择智能分析助手，快速获取数据洞察与分析报告</p>
      </div>
      <button class="amp-close" type="button" @click="handleClose" title="返回">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>

    <!-- Category tabs -->
    <div class="amp-categories">
      <button
        v-for="cat in categories"
        :key="cat.key"
        :class="['amp-cat-btn', { active: activeCategory === cat.key }]"
        type="button"
        @click="activeCategory = cat.key; activeSubCategory = 'all'"
      >
        {{ cat.label }}
      </button>
    </div>

    <!-- Sub-category tabs + filter row -->
    <div class="amp-toolbar">
      <div class="amp-sub-tabs">
        <button
          v-for="tab in subCategoryTabs"
          :key="tab.key"
          :class="['amp-sub-btn', { active: activeSubCategory === tab.key }]"
          type="button"
          @click="activeSubCategory = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>
      <div class="amp-filters">
        <button
          :class="['amp-sort-btn', { active: sortBy === 'latest' }]"
          type="button"
          @click="sortBy = 'latest'"
        >
          最新
        </button>
        <button
          :class="['amp-sort-btn', { active: sortBy === 'hottest' }]"
          type="button"
          @click="sortBy = 'hottest'"
        >
          最热
        </button>
        <div class="amp-search">
          <svg class="amp-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            v-model="searchQuery"
            class="amp-search-input"
            type="text"
            placeholder="搜索智能体名称"
          />
        </div>
      </div>
    </div>

    <!-- Agent groups -->
    <div class="amp-body">
      <div v-if="filteredGroups.length === 0" class="amp-empty">
        <div class="amp-empty-icon">🔍</div>
        <div class="amp-empty-text">暂无匹配的智能体</div>
      </div>
      <template v-for="group in filteredGroups" :key="group.label">
        <div class="amp-group-label">{{ group.label }}</div>
        <div class="amp-grid">
          <button
            v-for="agent in group.items"
            :key="agent.id"
            class="amp-card"
            :style="{ '--agent-color': agent.color }"
            type="button"
            @click="handleSelect(agent)"
          >
            <div class="amp-card-header">
              <div class="amp-card-icon" :class="agent.iconClass">{{ agent.icon }}</div>
              <div class="amp-card-header-info">
                <div class="amp-card-name">{{ agent.name }}</div>
                <div class="amp-card-category">{{ agent.category }}</div>
              </div>
            </div>
            <div class="amp-card-desc">{{ agent.description }}</div>
            <div class="amp-card-footer">
              <button class="btn-use-agent" @click.stop="handleSelect(agent)">使用</button>
            </div>
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

/* ── Panel shell ──── */
.agent-more-panel {
  flex: 1;
  min-width: 0;
  height: 100%;
  background: var(--bg-card, #ffffff);
  border-left: 1px solid var(--border-color, #e5e7eb);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Header ───────────────────────────────────────── */
.amp-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-light, #f0f1f3);
  flex-shrink: 0;
}

.amp-header-info {
  flex: 1;
  min-width: 0;
}

.amp-title {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #1a1d26);
}

.amp-subtitle {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted, #9ca3b8);
}

.amp-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(var(--accent-primary-rgb, 79, 110, 247), 0.08);
  color: var(--text-secondary, #5f6577);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;

  &:hover {
    background: rgba(var(--accent-primary-rgb, 79, 110, 247), 0.15);
    color: var(--text-primary, #1a1d26);
  }
}

/* ── Category tabs ────────────────────────────────── */
.amp-categories {
  display: flex;
  gap: 0;
  padding: 0 24px;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  flex-shrink: 0;
}

.amp-cat-btn {
  padding: 12px 20px;
  border: none;
  background: transparent;
  color: var(--text-secondary, #5f6577);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  position: relative;
  transition: color 0.2s;

  &:hover {
    color: var(--text-primary, #1a1d26);
  }

  &.active {
    color: var(--accent-primary, #4f6ef7);
    font-weight: 600;

    &::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: -1px;
      height: 2px;
      background: var(--accent-primary, #4f6ef7);
      border-radius: 1px 1px 0 0;
    }
  }
}

/* ── Toolbar: sub-tabs + filters ──────────────────── */
.amp-toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--border-light, #f0f1f3);
  flex-shrink: 0;
}

.amp-sub-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.amp-sub-btn {
  padding: 6px 14px;
  border: 1px solid var(--border-color, #e5e7eb);
  background: transparent;
  color: var(--text-secondary, #5f6577);
  font-size: 12px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: rgba(var(--accent-primary-rgb, 79, 110, 247), 0.4);
    color: var(--text-primary, #1a1d26);
  }

  &.active {
    background: rgba(var(--accent-primary-rgb, 79, 110, 247), 0.1);
    border-color: var(--accent-primary, #4f6ef7);
    color: var(--accent-primary, #4f6ef7);
    font-weight: 500;
  }
}

.amp-filters {
  display: flex;
  align-items: center;
  gap: 10px;
}

.amp-sort-btn {
  padding: 4px 12px;
  border: none;
  background: transparent;
  color: var(--text-muted, #9ca3b8);
  font-size: 12px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;

  &:hover {
    color: var(--text-primary, #1a1d26);
  }

  &.active {
    color: var(--accent-primary, #4f6ef7);
    font-weight: 600;
  }
}

.amp-search {
  position: relative;
  flex: 1;
  min-width: 0;
}

.amp-search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted, #9ca3b8);
  pointer-events: none;
}

.amp-search-input {
  width: 100%;
  padding: 8px 12px 8px 32px;
  border: 1px solid var(--border-color, #e5e7eb);
  background: var(--bg-sidebar, #f9fafb);
  color: var(--text-primary, #1a1d26);
  font-size: 12px;
  border-radius: 8px;
  outline: none;
  transition: border-color 0.2s;

  &::placeholder {
    color: var(--text-muted, #9ca3b8);
  }

  &:focus {
    border-color: var(--accent-primary, #4f6ef7);
    box-shadow: 0 0 0 2px rgba(var(--accent-primary-rgb, 79, 110, 247), 0.1);
  }
}

/* ── Body ─────────────────────────────────────────── */
.amp-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  scrollbar-width: thin;
}

.amp-body::-webkit-scrollbar {
  width: 4px;
}

.amp-body::-webkit-scrollbar-thumb {
  background: var(--border-color, #e5e7eb);
  border-radius: 4px;
}

.amp-empty {
  text-align: center;
  padding: 60px 0;
}

.amp-empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.amp-empty-text {
  color: var(--text-muted, #9ca3b8);
  font-size: 14px;
}

.amp-group-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted, #9ca3b8);
  letter-spacing: 0.5px;
  text-transform: uppercase;
  padding: 8px 0 12px;

  &:first-child {
    padding-top: 0;
  }
}

/* ── Card grid ────────────────────────────────────── */
.amp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.amp-card {
  background: var(--bg-card, #ffffff);
  border: 1.5px solid var(--border-color, #e5e7eb);
  border-radius: 16px;
  padding: 18px;
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  overflow: hidden;
}

.amp-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--agent-color, #4f6ef7), transparent);
  opacity: 0;
  transition: opacity 0.25s;
}

.amp-card:hover {
  border-color: var(--accent-primary, #4f6ef7);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

.amp-card:hover::before {
  opacity: 1;
}

.amp-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.amp-card-header-info {
  flex: 1;
  min-width: 0;
}

.amp-card-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

/* 智能体图标渐变背景 */
.icon-broadcast { background: linear-gradient(135deg, #ecfdf5, #d1fae5); color: #059669; }
.icon-rank { background: linear-gradient(135deg, #eff6ff, #dbeafe); color: #2563eb; }
.icon-monitor { background: linear-gradient(135deg, #faf5ff, #e9d5ff); color: #7c3aed; }
.icon-single { background: linear-gradient(135deg, #fef3c7, #fde68a); color: #d97706; }
.icon-multi { background: linear-gradient(135deg, #fee2e2, #fecaca); color: #dc2626; }
.icon-calendar { background: linear-gradient(135deg, #f0fdf4, #bbf7d0); color: #16a34a; }
.icon-pie { background: linear-gradient(135deg, #ecfeff, #a5f3fc); color: #0891b2; }
.icon-primary { background: linear-gradient(135deg, #faf5ff, #e9d5ff); color: #9333ea; }
.icon-grade { background: linear-gradient(135deg, #ecfdf5, #d1fae5); color: #059669; }
.icon-city { background: linear-gradient(135deg, #eff6ff, #dbeafe); color: #2563eb; }
.icon-ratio { background: linear-gradient(135deg, #fef3c7, #fde68a); color: #d97706; }
.icon-boxplot { background: linear-gradient(135deg, #faf5ff, #e9d5ff); color: #7c3aed; }
.icon-status { background: linear-gradient(135deg, #ecfdf5, #d1fae5); color: #059669; }
.icon-future { background: linear-gradient(135deg, #eff6ff, #dbeafe); color: #2563eb; }
.icon-rootcause { background: linear-gradient(135deg, #fee2e2, #fecaca); color: #dc2626; }
.icon-water { background: linear-gradient(135deg, #ecfeff, #a5f3fc); color: #0891b2; }
.icon-water-rank { background: linear-gradient(135deg, #fef3c7, #fde68a); color: #d97706; }
.icon-trend { background: linear-gradient(135deg, #f0fdf4, #bbf7d0); color: #16a34a; }
.icon-compare { background: linear-gradient(135deg, #faf5ff, #e9d5ff); color: #9333ea; }
.icon-water-ask { background: linear-gradient(135deg, #ecfeff, #a5f3fc); color: #0891b2; }
.icon-case { background: linear-gradient(135deg, #fef3c7, #fde68a); color: #d97706; }
.icon-violation { background: linear-gradient(135deg, #fee2e2, #fecaca); color: #dc2626; }
.icon-law { background: linear-gradient(135deg, #faf5ff, #e9d5ff); color: #7c3aed; }

.amp-card-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #1a1d26);
  line-height: 1.3;
}

.amp-card-category {
  font-size: 11px;
  color: var(--text-muted, #9ca3b8);
  margin-top: 2px;
}

.amp-card-desc {
  font-size: 12px;
  color: var(--text-secondary, #5f6577);
  line-height: 1.5;
  margin-bottom: 14px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.amp-card-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.btn-use-agent {
  padding: 6px 16px;
  border: none;
  background: var(--accent-primary, #4f6ef7);
  color: #ffffff;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-use-agent:hover {
  background: var(--accent-hover, #3b5de7);
  transform: scale(1.03);
}
</style>
