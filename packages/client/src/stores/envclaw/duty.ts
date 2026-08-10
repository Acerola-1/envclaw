import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createJob } from '@/api/envclaw/jobs'

export interface Chip {
  id: string
  label: string
  icon: string    // SVG icon name
  prompt: string
  kind: 'query' | 'duty'
  highlighted?: boolean  // 橙色边框
}

export interface DraftParams {
  taskName: string
  capabilities: string[]
  schedule: string
  pushChannels: string[]
}

export interface PickerSelection {
  templateId?: string
  capIds: string[]
  capNames: string[]
  skillIds: string[]
  skillNames: string[]
  mcpIds: string[]
  mcpNames: string[]
}

const QUERY_CHIPS: Chip[] = [
  { id: 'onemap', label: '一张图', icon: 'map', prompt: '请用一张图展示...', kind: 'query' },
  { id: 'ranking', label: '浓度排名', icon: 'bar-chart', prompt: '请查询浓度排名...', kind: 'query' },
  { id: 'hourly', label: '小时播报', icon: 'clock', prompt: '请播报最近一小时...', kind: 'query' },
  { id: 'monitor', label: '监测数据', icon: 'database', prompt: '请查询监测数据...', kind: 'query' },
  { id: 'create-duty', label: '创建值守任务', icon: 'zap', prompt: '请帮我创建一个值守任务...', kind: 'query', highlighted: true },
]

const DUTY_CHIPS: Chip[] = [
  { id: 'duty-create', label: '创建值守任务', icon: 'zap', prompt: '帮我创建一个值守任务：每天早上 8 点，查询平顶山市的实时浓度排名，并通过邮件发送到 duty@example.com', kind: 'duty', highlighted: true },
  { id: 'duty-ranking', label: '定时浓度排名', icon: 'bar-chart', prompt: '帮我查询 平顶山市 的实时浓度排名，附带截图', kind: 'duty' },
  { id: 'duty-onemap', label: '定时一张图', icon: 'map', prompt: '帮我生成一张图截图：范围 平顶山市，实时监测图，因子 PM₂.₅，浅色主题', kind: 'duty' },
  { id: 'duty-hourly', label: '定时小时播报', icon: 'clock', prompt: '帮我生成 平顶山市 的小时播报', kind: 'duty' },
  { id: 'duty-monitor', label: '定时监测数据', icon: 'database', prompt: '查询 平顶山市 的监测数据...', kind: 'duty' },
]

export const useDutyStore = defineStore('duty', () => {
  const scene = ref<'query' | 'duty'>('query')
  const selectedModel = ref('Auto')
  const draftParams = ref<DraftParams | null>(null)
  const pickerSelection = ref<PickerSelection>({
    capIds: [], capNames: [], skillIds: [], skillNames: [], mcpIds: [], mcpNames: [],
  })
  const capabilityChips = computed<Chip[]>(() =>
    scene.value === 'query' ? QUERY_CHIPS : DUTY_CHIPS,
  )

  function setScene(s: 'query' | 'duty') { scene.value = s }
  function setDraftParams(p: DraftParams) { draftParams.value = p }

  function clearDraft() { draftParams.value = null }

  function setPickerSelection(sel: Partial<PickerSelection>) {
    Object.assign(pickerSelection.value, sel)
  }

  function clearPickerSelection() {
    pickerSelection.value = { capIds: [], capNames: [], skillIds: [], skillNames: [], mcpIds: [], mcpNames: [] }
  }

  async function createJobFromDraft() {
    if (!draftParams.value) throw new Error('No draft params')
    await createJob({
      name: draftParams.value.taskName,
      capabilities: draftParams.value.capabilities,
      schedule: draftParams.value.schedule,
      pushChannels: draftParams.value.pushChannels,
    })
    clearDraft()
  }

  return {
    scene, selectedModel, draftParams, pickerSelection, capabilityChips,
    setScene, setDraftParams, clearDraft, setPickerSelection, clearPickerSelection, createJobFromDraft,
  }
})
