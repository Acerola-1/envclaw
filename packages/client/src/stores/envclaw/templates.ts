import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/** 场景模板定义 */
export interface ScenarioTemplate {
  /** 模板 ID,如 'data-broadcast' */
  id: string
  /** 显示名称 */
  name: string
  /** 简短描述 */
  description: string
  /** Lucide 图标名 */
  icon: string
  /** 场景分类标签 */
  tags: string[]
  /** 是否已上线(未上线=场景卡置灰) */
  available: boolean
  /** 角色基底提示词(组装公式第一段) */
  roleBasePrompt: string
}

export const TEMPLATE_LIST: ScenarioTemplate[] = [
  {
    id: 'data-broadcast',
    name: '数据播报',
    description: '定时抓取空气质量数据，自动生成播报内容并推送到指定群组',
    icon: 'volume-2',
    tags: ['定时', '多渠道'],
    available: true,
    roleBasePrompt:
      '你是数据播报助手，负责按时从指定数据平台抓取环保监测数据，生成结构化的播报文案，并推送到指定渠道。播报内容应包含：当前空气质量指数（AQI）、首要污染物、各项指标浓度及变化趋势、省内排名信息（如适用）。语言要求简洁专业，面向环保业务人员。',
  },
  {
    id: 'data-collection',
    name: '数据采集',
    description: '从 mapairs、国控站等平台自动抓取空气质量数据并生成报表',
    icon: 'bar-chart-3',
    tags: ['定时', '报表'],
    available: false,
    roleBasePrompt: '',
  },
  {
    id: 'anomaly-alert',
    name: '异常预警',
    description: '实时监控空气质量指标，超阈值自动预警并多渠道推送',
    icon: 'triangle-alert',
    tags: ['实时', '预警'],
    available: false,
    roleBasePrompt: '',
  },
  {
    id: 'report-generation',
    name: '报告生成',
    description: '自动生成日报、周报、月报，支持自定义模板与定时推送',
    icon: 'file-text',
    tags: ['定时', '报告'],
    available: false,
    roleBasePrompt: '',
  },
]

export const useTemplatesStore = defineStore('envclaw-templates', () => {
  const templates = ref<ScenarioTemplate[]>(TEMPLATE_LIST)

  const availableTemplates = computed(() =>
    templates.value.filter((t) => t.available),
  )

  const unavailableTemplates = computed(() =>
    templates.value.filter((t) => !t.available),
  )

  function getById(id: string): ScenarioTemplate | undefined {
    return templates.value.find((t) => t.id === id)
  }

  return { templates, availableTemplates, unavailableTemplates, getById }
})
