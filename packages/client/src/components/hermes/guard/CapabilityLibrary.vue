<script setup lang="ts">
import { ref } from 'vue'

type CapabilityType = 'mapPackage' | 'concentrationRanking' | 'hourlyBrief' | 'monitoringData'

interface CapabilityDef {
  type: CapabilityType
  name: string
  desc: string
  tags: string[]
}

const emit = defineEmits<{
  // 快速创建：带单个成果进入创建向导
  quickCreate: [type: CapabilityType]
  // 去组合配置：带多个成果进入创建向导
  combine: [types: CapabilityType[]]
}>()

// 数智大气内置底座的四类成果（与 CreateTask.vue functions szdq 段一致）
const capabilities: CapabilityDef[] = [
  {
    type: 'mapPackage',
    name: '一张图',
    desc: '生成数智大气一张图成果，设置地图范围、时间类型、监测图/插值图、因子、风场与图层。',
    tags: ['截图', '地图'],
  },
  {
    type: 'concentrationRanking',
    name: '浓度排名',
    desc: '城市/站点浓度排名查询，生成可视化排名截图并附数据文字总结后推送。',
    tags: ['截图', '数据采集', '数据分析'],
  },
  // 【暂时屏蔽】小时播报、监测数据（如需恢复，取消下方注释即可）
  // {
  //   type: 'hourlyBrief',
  //   name: '小时播报',
  //   desc: '定位小时播报页面，勾选行政区与污染因子，截取页面图片。',
  //   tags: ['截图', '数据采集', '数据分析'],
  // },
  // {
  //   type: 'monitoringData',
  //   name: '监测数据',
  //   desc: '提取各点位小时/分钟监测数据，覆盖 PM₂.₅、AQI、O₃ 等，按站点结构化输出。',
  //   tags: ['截图', '数据采集', '数据分析'],
  // },
]

const nameByType = Object.fromEntries(capabilities.map(c => [c.type, c.name])) as Record<CapabilityType, string>

// 组合篮：已选成果
const combo = ref<Set<CapabilityType>>(new Set())

function inCombo(type: CapabilityType): boolean {
  return combo.value.has(type)
}

function toggleCombo(type: CapabilityType) {
  const next = new Set(combo.value)
  if (next.has(type)) next.delete(type)
  else next.add(type)
  combo.value = next
}

function clearCombo() {
  combo.value = new Set()
}

function quickCreate(type: CapabilityType) {
  emit('quickCreate', type)
}

function goCombine() {
  if (combo.value.size === 0) return
  emit('combine', Array.from(combo.value))
}
</script>

<template>
  <div class="capability-library">
    <div class="cap-source">数智大气</div>

    <div class="cap-scroll">
      <div class="cap-grid">
        <div
          v-for="cap in capabilities"
          :key="cap.type"
          class="cap-card"
          :class="{ 'in-combo': inCombo(cap.type) }"
          @click="toggleCombo(cap.type)"
        >
          <div class="cap-top">
            <div class="cap-name">{{ cap.name }}</div>
            <div
              class="cap-combo-check"
              :title="inCombo(cap.type) ? '移出组合' : '加入组合'"
              @click.stop="toggleCombo(cap.type)"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
          <div class="cap-desc">{{ cap.desc }}</div>
          <div class="cap-tags">
            <span v-for="tag in cap.tags" :key="tag" class="cap-tag">{{ tag }}</span>
          </div>
          <div class="cap-foot">
            <button class="cap-act cap-act-primary" @click.stop="quickCreate(cap.type)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              快速创建
            </button>
            <button class="cap-act" @click.stop="toggleCombo(cap.type)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {{ inCombo(cap.type) ? '已加入组合' : '加入组合' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="combo-bar" :class="{ show: combo.size > 0 }">
      <div class="combo-info"><span class="combo-num">{{ combo.size }}</span> 已选成果</div>
      <div class="combo-chips">
        <span v-for="type in Array.from(combo)" :key="type" class="combo-chip">
          {{ nameByType[type] }}
          <button @click="toggleCombo(type)" title="移除">×</button>
        </span>
      </div>
      <button class="combo-clear" @click="clearCombo">清空</button>
      <button class="combo-go" @click="goCombine">
        去组合配置
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.capability-library {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px 28px 0;
  overflow: hidden;
}

.cap-source {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.cap-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-bottom: 16px;
}

.cap-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 268px), 1fr));
  gap: 14px;
}

.cap-card {
  background: var(--bg-card);
  border: 2px solid var(--border-color);
  border-radius: $radius-lg;
  padding: 18px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  gap: 10px;

  &:hover {
    border-color: var(--border-strong, var(--border-color));
    background: var(--bg-card-hover);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  &.in-combo {
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 1px var(--accent-primary), 0 4px 20px rgba(var(--accent-primary-rgb), 0.1);
  }
}

.cap-top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cap-name {
  font-size: 14.5px;
  font-weight: 600;
  flex: 1;
  min-width: 0;
}

.cap-combo-check {
  width: 22px;
  height: 22px;
  border-radius: $radius-sm;
  border: 2px solid var(--border-strong, var(--border-color));
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  transition: 0.15s;
  flex-shrink: 0;

  svg {
    opacity: 0;
  }

  &:hover {
    border-color: var(--accent-primary);
  }
}

.cap-card.in-combo .cap-combo-check {
  background: var(--accent-primary);
  border-color: var(--accent-primary);

  svg {
    opacity: 1;
  }
}

.cap-desc {
  font-size: 12.5px;
  color: var(--text-secondary);
  line-height: 1.6;
  flex: 1;
}

.cap-tags {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.cap-tag {
  font-size: 10.5px;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-weight: 500;
}

.cap-foot {
  display: flex;
  gap: 4px;
  padding-top: 10px;
  border-top: 1px solid var(--border-light);
}

.cap-act {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: $radius-sm;
  font-size: 11.5px;
  font-weight: 500;
  background: transparent;
  border: none;
  color: var(--accent-primary);
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;

  &:hover {
    background: rgba(var(--accent-primary-rgb), 0.1);
  }

  &.cap-act-primary {
    color: var(--success);

    &:hover {
      background: rgba(var(--success-rgb), 0.12);
    }
  }
}

.combo-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 0 -28px;
  padding: 14px 28px;
  background: var(--text-primary);
  color: #fff;
  transform: translateY(100%);
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  transition: transform 0.25s ease, opacity 0.2s ease, max-height 0.25s ease;

  &.show {
    transform: translateY(0);
    max-height: 80px;
    opacity: 1;
  }
}

.combo-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}

.combo-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  border-radius: 11px;
  background: #fff;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 700;
  padding: 0 6px;
}

.combo-chips {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  flex: 1;
  min-width: 0;
}

.combo-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  background: rgba(255, 255, 255, 0.14);
  border-radius: 24px;
  padding: 4px 10px;
  white-space: nowrap;

  button {
    border: none;
    background: none;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    font-size: 13px;
    line-height: 1;
    padding: 0;

    &:hover {
      color: #fff;
    }
  }
}

.combo-clear {
  border: none;
  background: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    color: #fff;
    text-decoration: underline;
  }
}

.combo-go {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #fff;
  color: var(--text-primary);
  border: none;
  border-radius: $radius-md;
  padding: 9px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: 0.15s;
  white-space: nowrap;

  &:hover {
    background: #eaeaea;
  }
}
</style>
