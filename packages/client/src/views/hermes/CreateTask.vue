<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NInput, NInputNumber, NButton, NModal, NTreeSelect, NCheckbox, NCheckboxGroup, NSelect } from 'naive-ui'
import SchedulePicker from '@/components/hermes/shared/SchedulePicker.vue'
import { useJobsStore } from '@/stores/hermes/jobs'
import { useSettingsStore } from '@/stores/hermes/settings'
import { getJob, scheduleToEditableInput, jobRepeatToEditValue } from '@/api/hermes/jobs'
import type { Job } from '@/api/hermes/jobs'
import { listPlatforms } from '@/api/envclaw/platforms'
import type { Platform } from '@/api/envclaw/platforms'
import { useMessage } from 'naive-ui'

// ==================== Props / Emits ====================
const props = defineProps<{
  jobId?: string | null
}>()

const emit = defineEmits<{
  created: [job: any]
  close: []
}>()

const isEdit = computed(() => !!props.jobId)
const originalJob = ref<Job | null>(null)

// ==================== Stores ====================
const jobsStore = useJobsStore()
const settingsStore = useSettingsStore()
const router = useRouter()
const message = useMessage()

function goToChannels() {
  router.push({ name: 'hermes.channels' })
}

// 判断推送平台是否已配置（与 CreateGuardTaskModal 逻辑一致）
function isPlatformConfigured(key: string): boolean {
  if (key === 'origin' || key === 'local') return true
  const creds = (settingsStore.platforms as Record<string, any>)[key]
  if (!creds || typeof creds !== 'object') return false
  const keys = ['token', 'api_key', 'app_id', 'client_id', 'secret', 'app_secret', 'client_secret', 'access_token', 'bot_id', 'account_id', 'enabled']
  const targets = [creds, creds.extra].filter(Boolean)
  return targets.some(obj =>
    keys.some(k => {
      const val = (obj as Record<string, any>)[k]
      return val !== undefined && val !== null && val !== '' && val !== false
    })
  )
}

// ==================== Step State ====================
const currentStep = ref(1)
const totalSteps = 3
// const loading = ref(false)
const submitting = ref(false)

// ==================== Form Data (与 CreateGuardTaskModal 一致) ====================
const taskName = ref('平顶山市空气质量值守')
const taskPrompt = ref('按结构化成果清单生成空气质量值守成果，并统一推送。')
const schedule = ref('0 9 * * *')
const selectedPushChips = ref<Set<string>>(new Set(['origin']))
const notifyGroupId = ref('')
const repeat_times = ref<number | null>(null)
const selectedSkills = ref<string[]>([])
const promptSupplement = ref('') // 用户补充说明

// 推送平台 chip 定义
const pushChipList = [
  { id: 'origin', name: '原始会话' },
  { id: 'local', name: '本地' },
  { id: 'wecom', name: '企业微信' },
  { id: 'weixin', name: '微信' },
  { id: 'dingtalk', name: '钉钉' },
  { id: 'feishu', name: '飞书' },
  { id: 'qqbot', name: 'QQBot' },
]

function togglePushChip(chipId: string) {
  // 单选：选中一个时取消其他
  if (selectedPushChips.value.has(chipId)) {
    selectedPushChips.value.delete(chipId)
  } else {
    selectedPushChips.value.clear()
    selectedPushChips.value.add(chipId)
  }
}

// ==================== Platform / Function State ====================
interface PlatformDef {
  id: string
  name: string
  desc: string
  url: string | null
  badge: string
  badgeClass: string
  color: string
  builtin: boolean
  prompt?: string
  skills: string[]
}

// 从 API 加载平台列表
const platforms = ref<PlatformDef[]>([])
const platformsLoading = ref(false)

async function loadPlatforms() {
  platformsLoading.value = true
  try {
    const data = await listPlatforms()
    platforms.value = data.map((p: Platform) => ({
      id: p.id,
      name: p.name,
      desc: p.operationPrompt || '自动登录并采集数据',
      url: p.url || null,
      badge: p.type === 'mapairs' ? '内置底座' : '自定义',
      badgeClass: p.type === 'mapairs' ? 'badge-builtin' : 'badge-custom',
      color: 'purple',
      builtin: false, // 允许取消勾选
      prompt: p.operationPrompt || '',
      skills: p.skills || [],
    }))
  } catch {
    platforms.value = []
  } finally {
    platformsLoading.value = false
  }
}

interface FuncDef {
  id: string
  platformId: string
  name: string
  tags: string[]
  prompt?: string
}

const functions: FuncDef[] = [
  // 数智大气
  { id: 'szdq-trace', platformId: 'szdq', name: '小时播报', tags: ['截图', '数据采集', '数据分析'], prompt: '定位到小时播报页面，勾选行政区、污染因子，截取页面图片' },
  { id: 'szdq-rank', platformId: 'szdq', name: '浓度排名', tags: ['截图', '数据采集', '数据分析'], prompt: '定位到浓度排名页面，查询平顶山市的数据,实现推送,附带对数据的文字总结' },
  { id: 'szdq-map', platformId: 'szdq', name: '一张图', tags: ['截图', '地图'], prompt: '按任务定义生成数智大气一张图成果，设置地图类型、范围、因子、缩放等级、图层和地区标记。' },
  { id: 'szdq-review', platformId: 'szdq', name: '监测数据', tags: ['截图', '数据采集', '数据分析'], prompt: '定位到实时监测页面，提取各点位分钟级PM2.5、AQI、O3数据流，按站点结构化输出…' },
  // { id: 'szdq-trend', platformId: 'szdq', name: '站点单指标趋势对比', tags: ['数据采集', '数据分析'], prompt: '定位到实时监测页面，提取各点位分钟级PM2.5、AQI、O3数据流，按站点结构化输出…' },
  // 中大平台
  { id: 'zd-realtime', platformId: 'zd', name: '实时监测点位分钟数据流读取', tags: ['数据采集'], prompt: '定位到实时监测页面，提取各点位分钟级PM2.5、AQI、O3数据流，按站点结构化输出…' },
  { id: 'zd-rank-table', platformId: 'zd', name: '综合质量排名通报表下载', tags: ['文件下载'], prompt: '导航至综合质量排名通报页面，下载Excel格式的排名通报表…' },
  { id: 'zd-hour-export', platformId: 'zd', name: '小时监测数据导出', tags: ['数据采集', '文件下载'], prompt: '进入小时数据查询页面，按时间范围导出各站点小时监测数据…' },
  { id: 'zd-minute-screenshot', platformId: 'zd', name: '分钟数据截图截取', tags: ['截图'], prompt: '定位至分钟数据展示页面，截取当前分钟数据视图的截图…' },
  // 省大数据
  { id: 'hnsjk-province-rank', platformId: 'hnsjk', name: '省级城市综合质量排名查询', tags: ['数据采集', '数据分析'], prompt: '查询省级城市综合质量排名数据，提取各城市AQI排名及变化趋势…' },
  { id: 'hnsjk-hour-data', platformId: 'hnsjk', name: '省控站点小时数据提取', tags: ['数据采集'], prompt: '提取省控站点的小时监测数据，包含PM2.5、PM10、O3等指标…' },
  { id: 'hnsjk-alert', platformId: 'hnsjk', name: '预警信息汇总导出', tags: ['数据采集', '数据分析'], prompt: '汇总当前预警信息，包括超标站点、预警级别和持续时间…' },
  // 华东平台
  { id: 'hdjk-regional', platformId: 'hdjk', name: '区域联防联控数据共享查询', tags: ['数据采集'], prompt: '查询区域联防联控数据共享信息，提取跨区域传输贡献数据…' },
  { id: 'hdjk-compare', platformId: 'hdjk', name: '跨区域对比分析报告生成', tags: ['数据分析'], prompt: '生成跨区域对比分析报告，包含不同区域空气质量对比数据…' },
]

const selectedPlatforms = ref<Set<string>>(new Set(['szdq']))
const selectedFunctions = ref<Set<string>>(new Set(['szdq-rank']))
const selectedCapability = ref<'concentrationRanking' | 'hourlyBrief' | 'mapPackage'>('concentrationRanking')
const rankingPresetActive = ref(true)
const rankingQueryTarget = ref<'city' | 'station'>('city')
const rankingRegion = ref('pingdingshan')
const rankingPeriod = ref('dayAccumulated')
const rankingFactors = ref(['AQI', 'PM₂.₅', 'O₃'])
const rankingIncludeScreenshot = ref(true)
const rankingIncludeAnalysis = ref(false)
const rankingScreenshotScope = ref<'tableOnly' | 'withFilters'>('tableOnly')
const rankingTheme = ref<'light' | 'dark'>('light')
const mapTheme = ref<'light' | 'dark'>('light')
const mapMode = ref<'monitoring' | 'interpolation'>('interpolation')
const mapZoom = ref(8)
const mapFactor = ref('primaryPollutant')
const mapWindWaves = ref(false)
const mapScreenshotScope = ref<'mapOnly' | 'mapLegend' | 'fullPage'>('mapLegend')
const mapScope = ref<'national' | 'henan' | 'pingdingshan'>('henan')
const mapTimeType = ref<'realtime' | 'accumulated' | 'day'>('realtime')
const mapMarkAssociated = ref(true)
const mapCloseLeftPanel = ref(true)

const rankingRegionOptions = [
  { label: '河南省', key: 'henan', disabled: true, children: [
    { label: '全部', key: 'all' },
    { label: '平顶山市（账号关联城市）', key: 'pingdingshan', children: [
      { label: '新华区', key: 'xinhua' }, { label: '卫东区', key: 'weidong' }, { label: '湛河区', key: 'zhanhe' },
    ] },
    { label: '郑州市', key: 'zhengzhou' }, { label: '洛阳市', key: 'luoyang' },
  ] },
]
const rankingPeriods = [
  { label: '实时', value: 'realtime' }, { label: '日累计', value: 'dayAccumulated' },
  { label: '日', value: 'day' }, { label: '月', value: 'month' }, { label: '年', value: 'year' },
]
const rankingFactorOptions = ['AQI', 'PM₂.₅', 'PM₁₀', 'SO₂', 'NO₂', 'CO', 'O₃'].map(value => ({ label: value, value }))
const mapFactorOptions = [
  { label: '首要污染物', value: 'primaryPollutant' },
  ...rankingFactorOptions,
]

function setRankingPeriod(period: string) {
  rankingPeriod.value = period
}

interface RankingOutputSnapshot {
  queryTarget: 'city' | 'station'
  region: string
  period: string
  factors: string[]
  includeScreenshot: boolean
  includeAnalysis: boolean
  screenshotScope: 'tableOnly' | 'withFilters'
  theme: 'light' | 'dark'
}

interface MapOutputSnapshot {
  theme: 'light' | 'dark'
  mode: 'monitoring' | 'interpolation'
  zoom: number
  factor: string
  windWaves: boolean
  screenshotScope: 'mapOnly' | 'mapLegend' | 'fullPage'
  scope: 'national' | 'henan' | 'pingdingshan'
  timeType: 'realtime' | 'accumulated' | 'day'
  markAssociated: boolean
  closeLeftPanel: boolean
}

type DutyOutputItem =
  | { id: string; type: 'concentrationRanking'; title: string; config: RankingOutputSnapshot }
  | { id: string; type: 'mapPackage'; title: string; config: MapOutputSnapshot }

let outputSequence = 0
const newOutputId = () => `output-${++outputSequence}`
const captureRankingConfig = (): RankingOutputSnapshot => ({
  queryTarget: rankingQueryTarget.value, region: rankingRegion.value, period: rankingPeriod.value,
  factors: [...rankingFactors.value], includeScreenshot: rankingIncludeScreenshot.value,
  includeAnalysis: rankingIncludeAnalysis.value, screenshotScope: rankingScreenshotScope.value, theme: rankingTheme.value,
})
const captureMapConfig = (): MapOutputSnapshot => ({
  theme: mapTheme.value, mode: mapMode.value, zoom: mapZoom.value, factor: mapFactor.value,
  windWaves: mapWindWaves.value, screenshotScope: mapScreenshotScope.value, scope: mapScope.value,
  timeType: mapTimeType.value, markAssociated: mapMarkAssociated.value, closeLeftPanel: mapCloseLeftPanel.value,
})

const initialOutputId = newOutputId()
const dutyOutputs = ref<DutyOutputItem[]>([{ id: initialOutputId, type: 'concentrationRanking', title: '浓度排名 1', config: captureRankingConfig() }])
const activeOutputId = ref(initialOutputId)

function syncActiveOutput() {
  const output = dutyOutputs.value.find(item => item.id === activeOutputId.value)
  if (!output) return
  if (output.type === 'concentrationRanking') output.config = captureRankingConfig()
  else output.config = captureMapConfig()
}

function loadOutput(output: DutyOutputItem) {
  activeOutputId.value = output.id
  selectedCapability.value = output.type
  if (output.type === 'concentrationRanking') {
    const c = output.config
    rankingQueryTarget.value = c.queryTarget; rankingRegion.value = c.region; rankingPeriod.value = c.period
    rankingFactors.value = [...c.factors]
    rankingIncludeScreenshot.value = c.includeScreenshot; rankingIncludeAnalysis.value = c.includeAnalysis
    rankingScreenshotScope.value = c.screenshotScope; rankingTheme.value = c.theme
  } else {
    const c = output.config
    mapTheme.value = c.theme; mapMode.value = c.mode; mapZoom.value = c.zoom; mapFactor.value = c.factor
    mapWindWaves.value = c.windWaves; mapScreenshotScope.value = c.screenshotScope; mapScope.value = c.scope
    mapTimeType.value = c.timeType; mapMarkAssociated.value = c.markAssociated; mapCloseLeftPanel.value = c.closeLeftPanel
  }
}

function selectDutyOutput(output: DutyOutputItem) {
  syncActiveOutput()
  loadOutput(output)
}

function refreshSelectedFunctions() {
  selectedFunctions.value = new Set(dutyOutputs.value.map(item => item.type === 'mapPackage' ? 'szdq-map' : 'szdq-rank'))
}

function addMapOutput() {
  syncActiveOutput()
  const id = newOutputId()
  const count = dutyOutputs.value.filter(item => item.type === 'mapPackage').length + 1
  const item: DutyOutputItem = { id, type: 'mapPackage', title: `一张图 ${count}`, config: captureMapConfig() }
  dutyOutputs.value.push(item)
  loadOutput(item)
  selectedCapability.value = 'mapPackage'
  selectedPlatforms.value = new Set(['szdq'])
  refreshSelectedFunctions()
  schedule.value = '10 * * * *'
}

function addRankingOutput() {
  syncActiveOutput()
  const id = newOutputId()
  const count = dutyOutputs.value.filter(item => item.type === 'concentrationRanking').length + 1
  const item: DutyOutputItem = { id, type: 'concentrationRanking', title: `浓度排名 ${count}`, config: captureRankingConfig() }
  dutyOutputs.value.push(item)
  loadOutput(item)
  selectedCapability.value = 'concentrationRanking'
  rankingPresetActive.value = true
  selectedPlatforms.value = new Set(['szdq'])
  refreshSelectedFunctions()
  schedule.value = '10 * * * *'
}

function duplicateOutput(output: DutyOutputItem) {
  syncActiveOutput()
  const clone = structuredClone(output) as DutyOutputItem
  clone.id = newOutputId()
  clone.title = `${output.title} 副本`
  dutyOutputs.value.push(clone)
  loadOutput(clone)
  refreshSelectedFunctions()
}

function removeOutput(output: DutyOutputItem) {
  if (dutyOutputs.value.length === 1) {
    message.warning('任务至少需要一个成果')
    return
  }
  const index = dutyOutputs.value.findIndex(item => item.id === output.id)
  dutyOutputs.value.splice(index, 1)
  if (activeOutputId.value === output.id) loadOutput(dutyOutputs.value[Math.max(0, index - 1)])
  refreshSelectedFunctions()
}

watch([
  rankingQueryTarget, rankingRegion, rankingPeriod,
  rankingFactors, rankingIncludeScreenshot, rankingIncludeAnalysis,
  rankingScreenshotScope, rankingTheme, mapTheme, mapMode, mapZoom, mapFactor, mapWindWaves,
  mapScreenshotScope, mapScope, mapTimeType, mapMarkAssociated, mapCloseLeftPanel,
], syncActiveOutput, { deep: true, flush: 'sync' })

// ==================== Step Navigation ====================
function goStep(step: number) {
  if (step < 1 || step > totalSteps) return
  currentStep.value = step
}

function nextStep() {
  // 步骤1 → 步骤2：任务名称必选
  if (currentStep.value === 1) {
    if (!taskName.value.trim()) {
      message.warning('请输入任务名称')
      return
    }
  }

  if (currentStep.value === 2) {
    if (selectedPushChips.value.size === 0) {
      message.warning('请选择推送平台')
      return
    }
  }
  if (currentStep.value >= totalSteps) {
    handleSubmit()
    return
  }
  currentStep.value++
}

function prevStep() {
  if (currentStep.value <= 1) return
  currentStep.value--
}

// ==================== Computed ====================
const isFormValid = computed(() => {
  if (!taskName.value) return false
  if (selectedPushChips.value.size === 0) return false
  return !!schedule.value
})

const pushChipNames = computed(() =>
  Array.from(selectedPushChips.value).map(id => {
    const chip = pushChipList.find(c => c.id === id)
    return chip ? chip.name : id
  })
)

// 只显示已配置的推送平台
const configuredPushChips = computed(() =>
  pushChipList.filter(chip =>
    chip.id === 'origin' || chip.id === 'local' || isPlatformConfigured(chip.id)
  )
)

// Cron 表达式转人类可读描述
const weekDayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const scheduleDescription = computed(() => {
  const cron = schedule.value
  if (!cron) return ''
  const parts = cron.trim().split(/\s+/)
  if (parts.length < 5) return cron

  const [minuteStr, hourStr, dom, , dow] = parts

  // 间隔: */N * * * *
  if (minuteStr.startsWith('*/')) return `每 ${minuteStr.slice(2)} 分钟执行一次`
  // 间隔: 0 */N * * *
  if (hourStr.startsWith('*/')) return `每 ${hourStr.slice(2)} 小时执行一次`

  const time = `${hourStr.padStart(2, '0')}:${minuteStr.padStart(2, '0')}`

  if (dow !== '*') {
    const names = dow.split(',').map(d => {
      const num = parseInt(d)
      return weekDayLabels[num] || d
    }).join('、')
    return `每周${names} ${time} 执行`
  }
  if (dom !== '*') return `每月 ${dom} 号 ${time} 执行`
  return `每天 ${time} 执行`
})

const activeFunctions = computed(() =>
  functions.filter((f: any) => selectedFunctions.value.has(f.id))
)

const rankingPeriodLabel = computed(() => rankingPeriods.find(item => item.value === rankingPeriod.value)?.label || '日累计')
const rankingTimeLabel = '官网最新可用时间'
const rankingRegionLabel = computed(() => ({ all: '河南省 / 全部', pingdingshan: '河南省 / 平顶山市', xinhua: '河南省 / 平顶山市 / 新华区', weidong: '河南省 / 平顶山市 / 卫东区', zhanhe: '河南省 / 平顶山市 / 湛河区', zhengzhou: '河南省 / 郑州市', luoyang: '河南省 / 洛阳市' }[rankingRegion.value] || '河南省 / 平顶山市'))
const mapScopeLabel = computed(() => ({ national: '全国', henan: '河南省', pingdingshan: '平顶山市' }[mapScope.value]))
const mapMarkerLabel = computed(() => mapScope.value === 'national' ? '标记河南省' : mapScope.value === 'henan' ? '标记平顶山市' : '市级范围无需标记')
const mapModeLabel = computed(() => mapMode.value === 'monitoring' ? '监测图' : '插值图')
const mapFactorLabel = computed(() => mapFactorOptions.find(item => item.value === mapFactor.value)?.label || '首要污染物')
const mapScreenshotScopeLabel = computed(() => ({ mapOnly: '仅地图', mapLegend: '地图和图例', fullPage: '完整页面' }[mapScreenshotScope.value]))
const regionLabelFor = (value: string) => ({ all: '河南省 / 全部', pingdingshan: '河南省 / 平顶山市', xinhua: '河南省 / 平顶山市 / 新华区', weidong: '河南省 / 平顶山市 / 卫东区', zhanhe: '河南省 / 平顶山市 / 湛河区', zhengzhou: '河南省 / 郑州市', luoyang: '河南省 / 洛阳市' }[value] || '河南省 / 平顶山市')
const mapScopeLabelFor = (value: MapOutputSnapshot['scope']) => ({ national: '全国', henan: '河南省', pingdingshan: '平顶山市' }[value])
const mapFactorLabelFor = (value: string) => mapFactorOptions.find(item => item.value === value)?.label || '首要污染物'
const mapMarkerLabelFor = (scope: MapOutputSnapshot['scope']) => scope === 'national' ? '标记河南省' : scope === 'henan' ? '标记平顶山市' : '无需标记'

function outputDefinition(output: DutyOutputItem): string {
  if (output.type === 'concentrationRanking') {
    const c = output.config
    const period = rankingPeriods.find(item => item.value === c.period)?.label || '日累计'
    const outputs = [c.includeScreenshot ? `排名截图（${c.screenshotScope === 'tableOnly' ? '仅标题和表格' : '含查询条件'}、${c.theme === 'light' ? '浅色' : '深色'}）` : '', c.includeAnalysis ? '数据分析摘要' : ''].filter(Boolean).join('、')
    return `${output.title}：${c.queryTarget === 'city' ? '城市查询' : '站点查询'}；行政区：${regionLabelFor(c.region)}；数据口径：${period}；数据时间：官网最新可用时间；污染因子：${c.factors.join('、')}；成果：${outputs}`
  }
  const c = output.config
  return `${output.title}：范围：${mapScopeLabelFor(c.scope)}；地图类型：${c.mode === 'monitoring' ? '监测图' : '插值图'}；因子：${mapFactorLabelFor(c.factor)}；时间类型：${({ realtime: '实时', accumulated: '累计', day: '日' }[c.timeType])}；缩放等级：${c.zoom}；颜色：${c.theme === 'light' ? '浅色' : '深色'}；风/海浪：${c.windWaves ? '开启' : '关闭'}；左侧面板：${c.closeLeftPanel ? '关闭' : '显示'}；截图区域：${({ mapOnly: '仅地图', mapLegend: '地图和图例', fullPage: '完整页面' }[c.screenshotScope])}；地区标记：${c.scope === 'pingdingshan' ? '无需标记' : c.markAssociated ? mapMarkerLabelFor(c.scope) : '关闭'}`
}

const allOutputLabels = computed(() => dutyOutputs.value.map(outputDefinition))
const taskExecutionOutputs = computed(() => dutyOutputs.value.map(output => ({
  id: output.id,
  capability: output.type === 'concentrationRanking' ? 'mapairs-ranking-capture' : 'mapairs-map-capture',
  skill: output.type === 'concentrationRanking' && output.config.includeScreenshot ? 'mapairs-ranking-capture' : null,
  config: output.config,
})))
const taskSkills = computed(() => [...new Set([
  ...selectedSkills.value,
  ...taskExecutionOutputs.value.map(output => output.skill).filter((skill): skill is string => !!skill),
])])
const taskExecutionManifest = computed(() => JSON.stringify({
  version: 1,
  outputs: taskExecutionOutputs.value,
}, null, 2))

const finalPrompt = computed(() => {
  const parts: string[] = []

  parts.push(`【成果执行清单】\n${taskExecutionManifest.value}`)
  parts.push('【执行规则】\n按 outputs 数组顺序逐项执行。每项成果只能读取自身 config；禁止将一个成果的主题、时间、因子、截图范围带入其他成果。带 skill 的成果必须使用该 Skill 附带的固定脚本，不得自行使用 agent-browser 或网页操作替代。')

  // 用户补充说明不参与脚本参数解析。
  if (taskPrompt.value.trim()) {
    parts.push(`【任务说明】\n${taskPrompt.value.trim()}`)
  }

  // 补充说明
  const supplement = promptSupplement.value.trim()
  if (supplement) {
    parts.push(`\n【补充说明】\n${supplement}`)
  }

  return parts.join('\n\n')
})

// ==================== Submit (与 CreateGuardTaskModal 一致) ====================
async function handleSubmit() {
  if (!isFormValid.value) {
    if (!taskName.value.trim()) {
      message.warning('请输入任务名称')
      return
    }
    if (selectedPushChips.value.size === 0) {
      message.warning('请选择推送平台')
      return
    }
    if (!taskPrompt.value.trim()) {
      message.warning('请输入执行提示词')
      return
    }
    if (!schedule.value) {
      message.warning('请设置执行频率')
      return
    }
    return
  }

  // 校验任务名是否重复（编辑模式下排除自身）
  const trimmedName = taskName.value.trim()
  const existing = jobsStore.jobs.find(j => j.name === trimmedName && (!isEdit.value || (j.job_id !== props.jobId && j.id !== props.jobId)))
  if (existing) {
    message.warning('已存在同名任务，请修改任务名称')
    return
  }

  submitting.value = true
  try {
    const pushChipIds = Array.from(selectedPushChips.value)
    const payload = {
      name: taskName.value,
      schedule: schedule.value,
      prompt: finalPrompt.value,
      deliver: pushChipIds.length > 0 ? pushChipIds[0] : 'origin',
      skills: taskSkills.value,
      repeat: repeat_times.value ?? undefined,
      functions: activeFunctions.value.map(f => ({
        name: f.name,
        tags: f.tags,
      })),
    }

    if (isEdit.value && props.jobId) {
      await jobsStore.updateJob(props.jobId, payload)
      message.success('任务更新成功')
    } else {
      await jobsStore.createJob(payload)
      message.success('任务创建成功')
    }

    // 如果选择了外部推送频道，弹出激活引导
    if (!isEdit.value && shouldShowChannelGuide()) {
      channelGuideCommand.value = `请你把'${taskName.value}'任务推送频道设置为当前窗口，并立即执行一次查看效果`
      showChannelGuide.value = true
    } else {
      emit('created', payload)
    }
  } catch (e: any) {
    message.error((isEdit.value ? '任务更新失败' : '任务创建失败') + ': ' + (e.message || e))
  } finally {
    submitting.value = false
  }
}

const showChannelGuide = ref(false)
const channelGuideCommand = ref('')

function copyCommand() {
  navigator.clipboard.writeText(channelGuideCommand.value).then(() => {
    message.success('已复制到剪贴板')
  }).catch(() => {
    message.error('复制失败')
  })
}

function shouldShowChannelGuide(): boolean {
  const chipIds = Array.from(selectedPushChips.value)
  if (chipIds.length === 0) return false
  const external = chipIds.filter(id => id !== 'origin' && id !== 'local')
  return external.length > 0
}
function resetForm() {
  taskName.value = '平顶山市空气质量值守'
  taskPrompt.value = '按结构化成果清单生成空气质量值守成果，并统一推送。'
  selectedPushChips.value = new Set(['origin'])
  notifyGroupId.value = ''
  repeat_times.value = null
  selectedSkills.value = []
  schedule.value = '0 9 * * *'
  promptSupplement.value = ''
  selectedPlatforms.value = new Set(['szdq'])
  selectedFunctions.value = new Set(['szdq-rank'])
  selectedCapability.value = 'concentrationRanking'
  rankingPresetActive.value = true
  const id = newOutputId()
  dutyOutputs.value = [{ id, type: 'concentrationRanking', title: '浓度排名 1', config: captureRankingConfig() }]
  activeOutputId.value = id
  originalJob.value = null
}

// ==================== Lifecycle ====================
onMounted(async () => {
  resetForm()
  await loadPlatforms()

  // 编辑模式：加载已有任务数据
  if (props.jobId) {
    try {
      const job = await getJob(props.jobId)
      originalJob.value = job
      taskName.value = job.name || ''
      taskPrompt.value = job.prompt || ''
      if (job.deliver) selectedPushChips.value.add(job.deliver)
      selectedSkills.value = job.skills || (job.skill ? [job.skill] : [])
      repeat_times.value = jobRepeatToEditValue(job.repeat)
      schedule.value = scheduleToEditableInput(job.schedule, job.schedule_display || '')
    } catch (e: any) {
      message.error('加载任务失败: ' + (e.message || e))
    }
  }
})

/*
const tagTypeMap = (tag: string): 'default' | 'info' | 'success' | 'warning' => {
  const map: Record<string, any> = {
    '截图': 'warning',
    '数据采集': 'info',
    '文件下载': 'success',
    '数据分析': 'default',
  }
  return map[tag] || 'default'
}
*/
</script>

<template>
  <div class="create-task-page">
    <!-- 步骤指示条 -->
    <div class="stepper">
      <div v-for="step in totalSteps" :key="step" class="step-item"
        :class="{ active: step === currentStep, done: step < currentStep }" @click="goStep(step)">
        <div class="step-num">{{ step < currentStep ? '✓' : step }}</div>
            <div class="step-label">
              {{ ['选择要做什么', '设置推送方式', '确认任务'][step - 1] }}
            </div>
        </div>
        <div v-for="i in totalSteps - 1" :key="'conn-' + i" class="step-connector" :class="{ done: i < currentStep }" />
      </div>

      <!-- 步骤内容区 -->
      <div class="step-content">
        <!-- ====== 步骤1: 基本信息 ====== -->
        <!-- <div v-show="currentStep === 1" class="step-panel">
        <div class="form-section">
          <div class="form-group">
            <label class="form-label">任务名称</label>
            <NInput v-model:value="taskName" placeholder="请输入任务名称" maxlength="50" />
          </div>

          <div class="form-group">
            <label class="form-label">执行提示词 <span class="form-label-optional">（可选，也可在后续步骤中由平台功能自动组装）</span></label>
            <NInput v-model:value="taskPrompt" type="textarea" placeholder="请输入分析提示词" :rows="4" maxlength="500" />
          </div>
        </div>
      </div> -->

        <!-- ====== 步骤2: 数据平台选择 ====== -->
        <div v-show="currentStep === 1" class="step-panel">
          <div class="form-section">
            <div class="task-identity">
              <label>任务名称</label>
              <NInput v-model:value="taskName" maxlength="50" placeholder="请输入任务名称" />
            </div>

            <section class="capability-section">
              <div class="capability-heading">
                <div><span class="capability-kicker">01 · 组合任务成果</span><h2>这次任务需要交付什么？</h2></div>
                <span class="bound-context">关联城市：<b>平顶山市</b></span>
              </div>
              <div class="output-list">
                <article v-for="(output, index) in dutyOutputs" :key="output.id" class="output-item" :class="{ active: activeOutputId === output.id }" @click="selectDutyOutput(output)">
                  <span class="output-index">{{ index + 1 }}</span>
                  <span class="capability-icon" :class="{ map: output.type === 'mapPackage' }">{{ output.type === 'mapPackage' ? '◇' : '≋' }}</span>
                  <span class="output-item-copy"><b>{{ output.title }}</b><small>{{ outputDefinition(output) }}</small></span>
                  <span v-if="activeOutputId === output.id" class="editing-badge">正在编辑</span>
                  <button class="output-action" title="复制成果" @click.stop="duplicateOutput(output)">复制</button>
                  <button class="output-action danger" title="删除成果" @click.stop="removeOutput(output)">删除</button>
                </article>
              </div>
              <div class="output-add-bar">
                <span>添加成果</span>
                <button @click="addRankingOutput"><b>＋</b> 浓度排名</button>
                <button @click="addMapOutput"><b>＋</b> 一张图</button>
              </div>
            </section>

            <section v-if="selectedCapability === 'concentrationRanking' && rankingPresetActive" class="ranking-config">
              <div class="ranking-config-head">
                <div><span>02 · 配置浓度排名</span></div>
              </div>
              <div class="ranking-config-grid">
                <div class="ranking-toolbar">
                  <div class="compact-field"><span>查询：</span><div class="segmented query-segment"><button :class="{ active: rankingQueryTarget === 'city' }" @click="rankingQueryTarget = 'city'">城市</button><button :class="{ active: rankingQueryTarget === 'station' }" @click="rankingQueryTarget = 'station'">站点</button></div></div>
                  <div class="compact-field region-field"><span>行政区：</span><NTreeSelect v-model:value="rankingRegion" :options="rankingRegionOptions" key-field="key" default-expand-all /></div>
                </div>
                <div class="ranking-toolbar factor-toolbar">
                  <div class="compact-field factor-field"><span>污染因子：</span><NCheckboxGroup v-model:value="rankingFactors"><div class="factor-chips"><NCheckbox v-for="factor in rankingFactorOptions" :key="factor.value" :value="factor.value">{{ factor.label }}</NCheckbox></div></NCheckboxGroup></div>
                </div>
                <div class="ranking-toolbar time-toolbar">
                  <div class="compact-field"><span>时间类型：</span><div class="segmented period-segment"><button v-for="period in rankingPeriods" :key="period.value" :class="{ active: rankingPeriod === period.value }" @click="setRankingPeriod(period.value)">{{ period.label }}</button></div></div>
                  <span class="latest-hint">任务执行时自动使用官网最新可用时间</span>
                </div>
                <div class="ranking-field wide output-choice"><label>生成成果</label><div><NCheckbox v-model:checked="rankingIncludeScreenshot">排名截图</NCheckbox></div></div>
                <div v-if="rankingIncludeScreenshot" class="screenshot-options">
                  <div class="compact-field"><span>截图区域：</span><div class="segmented"><button :class="{ active: rankingScreenshotScope === 'tableOnly' }" @click="rankingScreenshotScope = 'tableOnly'">仅标题和表格</button><button :class="{ active: rankingScreenshotScope === 'withFilters' }" @click="rankingScreenshotScope = 'withFilters'">含查询条件</button></div></div>
                  <div class="compact-field"><span>截图颜色：</span><div class="segmented"><button :class="{ active: rankingTheme === 'light' }" @click="rankingTheme = 'light'">浅色</button><button :class="{ active: rankingTheme === 'dark' }" @click="rankingTheme = 'dark'">深色</button></div></div>
                </div>
              </div>
              <div class="ranking-summary">本次成果：{{ rankingQueryTarget === 'city' ? '城市排名' : '站点排名' }} · {{ rankingRegionLabel }} · {{ rankingPeriodLabel }} · {{ rankingTimeLabel }} · {{ rankingFactors.join('、') }} · {{ rankingIncludeScreenshot ? '排名截图' : '' }}</div>
              <figure v-if="rankingIncludeScreenshot" class="effect-preview">
                <figcaption>
                  <span>效果预览</span>
                  <em>示意</em>
                </figcaption>
                <div class="effect-preview-image">
                  <img src="/demos/pingdingshan-ranking-preview.png" alt="平顶山市浓度排名截图效果预览" />
                </div>
              </figure>
            </section>

            <section v-if="selectedCapability === 'mapPackage'" class="ranking-config map-config">
              <div class="ranking-config-head"><div><span>02 · 配置一张图</span></div></div>
              <div class="ranking-config-grid">
                <div class="ranking-toolbar">
                  <div class="compact-field"><span>地图范围：</span><div class="segmented"><button :class="{ active: mapScope === 'national' }" @click="mapScope = 'national'">全国</button><button :class="{ active: mapScope === 'henan' }" @click="mapScope = 'henan'">河南省</button><button :class="{ active: mapScope === 'pingdingshan' }" @click="mapScope = 'pingdingshan'">平顶山市</button></div></div>
                  <div class="compact-field"><span>时间类型：</span><div class="segmented"><button :class="{ active: mapTimeType === 'realtime' }" @click="mapTimeType = 'realtime'">实时</button><button :class="{ active: mapTimeType === 'accumulated' }" @click="mapTimeType = 'accumulated'">累计</button><button :class="{ active: mapTimeType === 'day' }" @click="mapTimeType = 'day'">日</button></div></div>
                </div>
                <div class="ranking-toolbar">
                  <div class="compact-field"><span>地图类型：</span><div class="segmented"><button :class="{ active: mapMode === 'monitoring' }" @click="mapMode = 'monitoring'">监测图</button><button :class="{ active: mapMode === 'interpolation' }" @click="mapMode = 'interpolation'">插值图</button></div></div>
                  <div class="compact-field map-factor"><span>因子：</span><NSelect v-model:value="mapFactor" :options="mapFactorOptions" /></div>
                  <div class="compact-field map-zoom"><span>缩放等级：</span><NInputNumber v-model:value="mapZoom" :min="3" :max="16" /></div>
                </div>
                <div class="ranking-toolbar">
                  <div class="compact-field"><span>颜色：</span><div class="segmented"><button :class="{ active: mapTheme === 'light' }" @click="mapTheme = 'light'">浅色</button><button :class="{ active: mapTheme === 'dark' }" @click="mapTheme = 'dark'">深色</button></div></div>
                  <div class="map-switches"><NCheckbox v-model:checked="mapWindWaves">开启风/海浪</NCheckbox><NCheckbox v-model:checked="mapCloseLeftPanel">关闭左侧面板</NCheckbox></div>
                </div>
                <div class="ranking-toolbar">
                  <div class="compact-field"><span>截图区域：</span><div class="segmented"><button :class="{ active: mapScreenshotScope === 'mapOnly' }" @click="mapScreenshotScope = 'mapOnly'">仅地图</button><button :class="{ active: mapScreenshotScope === 'mapLegend' }" @click="mapScreenshotScope = 'mapLegend'">地图和图例</button><button :class="{ active: mapScreenshotScope === 'fullPage' }" @click="mapScreenshotScope = 'fullPage'">完整页面</button></div></div>
                </div>
                <div class="map-marker-row"><NCheckbox v-if="mapScope !== 'pingdingshan'" v-model:checked="mapMarkAssociated">{{ mapMarkerLabel }}</NCheckbox><span v-else>平顶山市级展示区县，无需额外标记关联地区</span></div>
              </div>
              <div class="ranking-summary">本次一张图：{{ mapScopeLabel }} · {{ mapModeLabel }} · {{ mapFactorLabel }} · 缩放 {{ mapZoom }} · {{ mapTheme === 'light' ? '浅色' : '深色' }} · {{ mapWindWaves ? '开启风/海浪' : '关闭风/海浪' }} · {{ mapScreenshotScopeLabel }} · {{ mapCloseLeftPanel ? '关闭左侧面板' : '保留左侧面板' }} · {{ mapScope === 'pingdingshan' ? '无需标记' : mapMarkAssociated ? mapMarkerLabel : '不标记关联地区' }}</div>
            </section>
          </div>
        </div>

        <!-- ====== 步骤3: 执行设置 ====== -->
        <div v-show="currentStep === 2" class="step-panel">
          <div class="form-section">
            <section class="delivery-intro"><span>03 · 设置交付</span><h2>什么时候运行，发送给谁？</h2></section>
            <div class="form-group">
              <label class="form-label">运行时间 <span class="required-mark">*</span></label>
              <SchedulePicker v-model="schedule" />
            </div>

            <div class="form-group">
              <label class="form-label">成果发送到 <span class="required-mark">*</span></label>
              <div class="chip-group">
                <div v-for="chip in configuredPushChips" :key="chip.id" class="chip" :class="{
                  active: selectedPushChips.has(chip.id),
                }" @click="togglePushChip(chip.id)">
                  {{ chip.name }}
                </div>
              </div>
              <div v-if="configuredPushChips.length === 0" class="chip-config-hint">
                <span class="hint-text">尚未配置接收渠道，</span>
                <a class="hint-link" @click="goToChannels">前往配置 →</a>
              </div>
              <div v-else class="chip-config-hint">
                <span class="hint-text">需要更多接收渠道？</span>
                <a class="hint-link" @click="goToChannels">前往配置 →</a>
              </div>
            </div>

            <!-- <div class="form-group">
            <label class="form-label">推送群ID</label>
            <NInput v-model:value="notifyGroupId" placeholder="请输入推送群ID" />
          </div> -->

            <div class="delivery-note"><b>本次任务将交付 {{ dutyOutputs.length }} 项成果</b><span v-for="(label, index) in allOutputLabels" :key="index">{{ index + 1 }}. {{ label }}</span></div>
          </div>
        </div>

        <!-- ====== 步骤4: 确认 ====== -->
        <div v-show="currentStep === 3" class="step-panel">
          <div class="preview-box">
            <div class="confirm-hero"><span>✓</span><div><b>请确认这份值守安排</b></div></div>
            <div class="preview-section">
              <div class="preview-label">任务名称</div>
              <div class="preview-line"><strong>{{ taskName || '未命名任务' }}</strong></div>
            </div>

            <div class="preview-section">
              <div class="preview-label">成果清单（{{ dutyOutputs.length }} 项）</div>
              <div class="confirm-output-list"><div v-for="(label, index) in allOutputLabels" :key="index"><span>{{ index + 1 }}</span><strong>{{ label }}</strong></div></div>
            </div>

            <div class="preview-section">
              <div class="preview-label">运行与发送</div>
              <div class="preview-line">
                <strong>频率：</strong>{{ scheduleDescription }}
                <span v-if="pushChipNames.length > 0"> · <strong>推送至：</strong>{{ pushChipNames.join('、') }}</span>
              </div>
            </div>

            <div class="preview-section">
              <div class="preview-label">系统将自动完成</div>
              <div class="simple-run-plan"><span>获取发布数据</span><i>→</i><span>依次生成 {{ dutyOutputs.length }} 项成果</span><i>→</i><span>统一发送给值守人员</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="action-bar">
        <div class="action-left">
          <NButton v-if="currentStep > 1" @click="prevStep">
            <template #icon>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </template>
            上一步
          </NButton>
        </div>
        <div class="action-right">
          <NButton @click="emit('close')">取消</NButton>
          <NButton type="primary" :disabled="!isFormValid && currentStep === totalSteps" :loading="submitting"
            @click="nextStep">
            {{ currentStep === totalSteps ? (isEdit ? '保存任务' : '创建任务') : '下一步' }}
            <template v-if="currentStep !== totalSteps" #icon>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </template>
          </NButton>
        </div>
      </div>
      <!-- 推送频道激活引导弹窗 -->
    <NModal v-model:show="showChannelGuide" preset="card" title="激活推送频道" style="width: 520px;" :mask-closable="false">
      <div class="channel-guide">
        <p class="channel-guide-desc">建议您在对应频道发送以下文本以激活任务：</p>
        <div class="channel-guide-command-box">
          <code class="channel-guide-command">{{ channelGuideCommand }}</code>
          <button class="channel-guide-copy-btn" @click="copyCommand">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            复制
          </button>
        </div>
        <div class="channel-guide-screenshot">
          <p class="channel-guide-screenshot-label">以微信为例：</p>
          <img src="/assets/tutorials/weixin-channel-setup.png" alt="微信激活示例" class="channel-guide-img" />
        </div>
      </div>
      <template #footer>
        <NButton type="primary" @click="showChannelGuide = false; emit('created', { name: taskName })">我知道了</NButton>
      </template>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.create-task-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  // padding: 16px 24px;
  overflow-y: auto;
  max-width: 960px;
  margin: 0 auto;
  padding: 28px 32px 28px;
}

// ===== 步骤指示条 =====
.stepper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  margin-bottom: 28px;
  padding: 16px 24px;
  background: $bg-primary;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: $radius;
  transition: all 0.15s;
}

.step-item:hover {
  background: $bg-secondary;
}

.step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  border: 2px solid $border-strong;
  color: $text-muted;
  transition: all 0.2s;
  flex-shrink: 0;
}

.step-label {
  font-size: 13px;
  color: $text-muted;
  font-weight: 500;
  white-space: nowrap;
  transition: all 0.2s;
}

.step-item.active .step-num {
  border-color: var(--accent-primary);
  background: var(--accent-primary);
  color: #fff;
}

.step-item.active .step-label {
  color: var(--accent-primary);
  font-weight: 600;
}

.step-item.done .step-num {
  border-color: #34A853;
  background: #34A853;
  color: #fff;
}

.step-item.done .step-label {
  color: #34A853;
}

.step-connector {
  width: 32px;
  height: 2px;
  background: $border-color;
  flex-shrink: 0;
  margin: 0 4px;
  transition: all 0.2s;
}

.step-connector.done {
  background: #34A853;
}

// ===== 步骤内容区 =====
.step-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.step-panel {
  animation: fadeSlideIn 0.25s ease;
}

@keyframes fadeSlideIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 13px;
  font-weight: 600;
  color: $text-primary;
}

.form-label-optional2 {
  font-weight: 400;
  color: #c46969;
  font-size: 12px;
  margin-left: 6px;
}

.form-label-optional {
  font-weight: 400;
  color: $text-muted;
  font-size: 12px;
  margin-left: 6px;
}

.form-hint {
  font-size: 12px;
  color: $text-muted;
  line-height: 1.5;
  margin-top: 4px;
}

.duty-preset {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px;
  border: 1px solid #b7d8f6;
  border-radius: 12px;
  background: linear-gradient(110deg, #edf8ff, #fafcff);
  transition: .18s ease;
}

.duty-preset.active { border-color: #2e9bed; box-shadow: 0 0 0 3px rgba(46, 155, 237, .12); }
.duty-preset-icon { width: 44px; height: 44px; display: grid; place-items: center; flex: 0 0 auto; border-radius: 11px; color: #fff; background: linear-gradient(135deg, #1b94ec, #1768c4); font-size: 26px; font-weight: 700; }
.duty-preset-copy { min-width: 0; flex: 1; }.duty-preset-title { color: $text-primary; font-size: 15px; font-weight: 700; }.duty-preset-title span { margin-left: 7px; padding: 2px 6px; border-radius: 4px; color: #1973bc; background: #dcefff; font-size: 10px; font-weight: 600; }.duty-preset-copy p { margin: 6px 0 8px; color: $text-secondary; font-size: 12px; line-height: 1.5; }.duty-preset-tags { display: flex; gap: 6px; flex-wrap: wrap; }.duty-preset-tags i { padding: 2px 6px; border: 1px solid #d7e4ee; border-radius: 99px; color: #547189; background: #fff; font-size: 10px; font-style: normal; }

.capability-section { padding: 20px; border: 1px solid #dce7ef; border-radius: 14px; background: linear-gradient(135deg, #fbfdff, #f2f9ff); }.capability-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; margin-bottom:15px; }.capability-kicker { color:#1985d2; font-size:11px; font-weight:800; letter-spacing:.7px; }.capability-heading h2 { margin:3px 0 4px; color:$text-primary; font-size:19px; }.capability-heading p { margin:0; color:$text-secondary; font-size:12px; }.bound-context { padding:7px 9px; border:1px solid #cfe5f6; border-radius:6px; background:#fff; color:#71869a; font-size:11px; white-space:nowrap; }.bound-context b { color:#287ab4; }.capability-grid { display:grid; grid-template-columns:1.25fr 1fr 1fr; gap:9px; }.capability-card { min-width:0; display:flex; align-items:center; gap:9px; padding:12px; border:1px solid #dce6ee; border-radius:9px; background:#fff; text-align:left; cursor:pointer; }.capability-card.active { border-color:#2b97e8; background:#edf8ff; box-shadow:0 0 0 2px rgba(43,151,232,.1); }.capability-card:disabled { cursor:not-allowed; opacity:.58; }.capability-icon { width:28px; height:28px; display:grid; place-items:center; border-radius:8px; flex:0 0 auto; color:#fff; background:linear-gradient(135deg,#1c98eb,#176ac2); font-size:18px; font-weight:800; }.capability-icon.muted { background:#aebdca; }.capability-copy { min-width:0; flex:1; }.capability-copy b,.capability-copy small { display:block; }.capability-copy b { color:$text-primary; font-size:12px; }.capability-copy small { margin-top:3px; color:$text-muted; font-size:10px; line-height:1.3; }.chosen,.soon { font-size:10px; white-space:nowrap; }.chosen { color:#1685d2; }.soon { color:$text-muted; }
.capability-icon.map { background:linear-gradient(135deg,#19a878,#087b64); }.map-config { border-color:#bfe3d6; }.map-config .ranking-config-head { background:#eefaf6; border-color:#d4eee5; }.map-config .ranking-config-head span { color:#14785d; }.map-factor { flex:1 1 200px; }.map-factor :deep(.n-select) { width:180px; }.map-zoom :deep(.n-input-number) { width:92px; }.map-switches { display:flex; align-items:center; gap:16px; flex-wrap:wrap; }.map-marker-row { min-height:30px; display:flex; align-items:center; padding:8px 10px; border-radius:6px; color:#4c7869; background:#f1f9f6; font-size:12px; }
.output-list { display:flex; flex-direction:column; gap:8px; }.output-item { display:flex; align-items:center; gap:10px; min-width:0; padding:10px 11px; border:1px solid #dce6ee; border-radius:9px; background:#fff; cursor:pointer; transition:.15s ease; }.output-item:hover { border-color:#a9cce7; }.output-item.active { border-color:#2b97e8; background:#edf8ff; box-shadow:0 0 0 2px rgba(43,151,232,.1); }.output-index { display:grid; place-items:center; width:20px; height:20px; flex:0 0 auto; border-radius:50%; color:#668195; background:#edf2f6; font-size:10px; font-weight:700; }.output-item.active .output-index { color:#fff; background:#218fe0; }.output-item-copy { min-width:0; flex:1; }.output-item-copy b,.output-item-copy small { display:block; }.output-item-copy b { color:$text-primary; font-size:12px; }.output-item-copy small { margin-top:3px; overflow:hidden; color:$text-muted; font-size:10px; line-height:1.35; text-overflow:ellipsis; white-space:nowrap; }.editing-badge { flex:0 0 auto; padding:2px 6px; border-radius:99px; color:#1879bd; background:#dff1ff; font-size:9px; }.output-action { flex:0 0 auto; padding:4px 6px; border:0; border-radius:4px; color:#678093; background:transparent; cursor:pointer; font-size:10px; }.output-action:hover { background:#e9f1f6; }.output-action.danger:hover { color:#bd4545; background:#fff0f0; }.output-add-bar { display:flex; align-items:center; gap:8px; margin-top:10px; padding-top:10px; border-top:1px dashed #d7e3ec; }.output-add-bar>span { margin-right:3px; color:$text-secondary; font-size:11px; font-weight:650; }.output-add-bar button { height:30px; padding:0 11px; border:1px solid #bdd8eb; border-radius:6px; color:#2676ad; background:#fff; cursor:pointer; font-size:11px; }.output-add-bar button:hover { border-color:#2996df; background:#edf8ff; }.output-add-bar button b { font-size:14px; }.confirm-output-list { display:flex; flex-direction:column; gap:8px; }.confirm-output-list>div { display:flex; align-items:flex-start; gap:9px; padding:9px 10px; border:1px solid #e0e9ef; border-radius:7px; background:#f9fbfc; }.confirm-output-list span { display:grid; place-items:center; width:20px; height:20px; flex:0 0 auto; border-radius:50%; color:#fff; background:#278ed5; font-size:10px; }.confirm-output-list strong { color:$text-secondary; font-size:11px; font-weight:550; line-height:1.55; }

.ranking-config { margin-top: -8px; border: 1px solid #c7e2f8; border-radius: 12px; overflow: hidden; background: #fbfdff; }.ranking-config-head { display:flex; justify-content:space-between; gap:14px; padding:14px 16px; background:#eef8ff; border-bottom:1px solid #d8ebfa; }.ranking-config-head span,.ranking-config-head small { display:block; }.ranking-config-head span { color:#1a6fad; font-weight:700; font-size:13px; }.ranking-config-head small { color:#6c879c; margin-top:3px; font-size:11px; }.ranking-config-grid { display:flex; flex-direction:column; gap:12px; padding:14px 16px; }.ranking-toolbar { display:flex; align-items:center; gap:12px; min-width:0; }.compact-field { display:flex; align-items:center; min-width:0; gap:7px; }.compact-field>span { flex:0 0 auto; color:$text-primary; font-size:12px; font-weight:650; }.region-field { flex:1 1 250px; max-width:420px; }.region-field :deep(.n-tree-select) { min-width:220px; width:100%; }.factor-toolbar { width:100%; }.factor-field { flex:1 1 auto; }.factor-chips { display:flex; align-items:center; gap:18px; flex-wrap:nowrap; }.factor-chips :deep(.n-checkbox) { margin-right:0; white-space:nowrap; }.segmented { display:flex; overflow:hidden; border:1px solid #d6e2ea; border-radius:5px; background:#fff; }.segmented button { min-width:52px; height:31px; padding:0 10px; border:0; border-left:1px solid #d6e2ea; background:#fff; color:#5d7588; cursor:pointer; font-size:12px; }.segmented button:first-child { border-left:0; }.segmented button.active { color:#146fb5; background:#dff2ff; font-weight:700; }.query-segment button { flex:0 0 76px; width:76px; padding:0; }.period-segment button { min-width:44px; }.time-toolbar { padding-top:1px; }.latest-hint { color:#7b93a5; font-size:11px; }.ranking-time-input { width:210px; }.ranking-time-range { display:flex; align-items:center; gap:6px; color:#7690a3; font-size:12px; }.ranking-time-range :deep(.n-input) { width:155px; }.ranking-field { min-width:0; }.ranking-field.wide { width:100%; }.ranking-field label { display:block; color:$text-primary; font-size:12px; font-weight:650; margin-bottom:8px; }.output-choice { display:flex; align-items:center; gap:14px; padding-top:2px; }.output-choice label { margin:0; }.output-choice > div { display:flex; gap:20px; }.screenshot-options { display:flex; align-items:center; gap:24px; flex-wrap:wrap; padding-top:1px; }.screenshot-options .segmented button { min-width:auto; }.ranking-summary { margin:0 16px 16px; padding:10px 12px; color:#356b90; background:#edf7ff; border-left:3px solid #2496e8; font-size:12px; line-height:1.55; }
.effect-preview { margin:0 16px 16px; overflow:hidden; border:1px solid #d9e5ed; border-radius:9px; background:#fff; box-shadow:0 4px 14px rgba(31,77,108,.06); }.effect-preview figcaption { display:flex; align-items:center; gap:8px; height:38px; padding:0 12px; border-bottom:1px solid #e7eef3; color:$text-primary; background:#f8fafc; font-size:12px; font-weight:700; }.effect-preview figcaption em { padding:2px 7px; border-radius:99px; color:#648095; background:#e8eef3; font-size:9px; font-style:normal; font-weight:600; }.effect-preview-image { width:100%; overflow-x:auto; background:#edf1f4; }.effect-preview-image img { display:block; width:100%; height:auto; min-width:620px; }
.ranking-time-picker { width: 210px; }
.task-identity { padding: 2px 2px 0; }.task-identity label { display:block; margin-bottom:8px; color:$text-primary; font-size:12px; font-weight:650; }
.delivery-intro { padding: 3px 0 2px; }.delivery-intro span { color:#1985d2; font-size:11px; font-weight:800; letter-spacing:.7px; }.delivery-intro h2 { margin:4px 0; color:$text-primary; font-size:19px; }.delivery-intro p { margin:0; color:$text-secondary; font-size:12px; }.delivery-note { display:flex; flex-direction:column; gap:5px; padding:13px; border:1px solid #d6eaf9; border-radius:8px; color:#4b7593; background:#f1f9ff; font-size:12px; }.delivery-note b { color:#2575ae; }.confirm-hero { display:flex; align-items:center; gap:11px; margin-bottom:16px; padding:14px; border-radius:9px; color:#226d42; background:#eefaf2; border:1px solid #c7ebd3; }.confirm-hero>span { display:grid; place-items:center; width:25px; height:25px; color:#fff; background:#34a853; border-radius:50%; font-weight:800; }.confirm-hero b,.confirm-hero small { display:block; }.confirm-hero b { font-size:13px; }.confirm-hero small { margin-top:3px; color:#5f856f; font-size:11px; }.simple-run-plan { display:flex; align-items:center; gap:9px; flex-wrap:wrap; color:#367396; font-size:12px; }.simple-run-plan span { padding:5px 8px; background:#eef7fc; border-radius:5px; }.simple-run-plan i { color:#7da8c3; font-style:normal; }

// ===== 平台选择 =====
.platform-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.platform-check {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  background: $bg-primary;
  border: 2px solid $border-color;
  border-radius: $radius-lg;
  cursor: pointer;
  transition: all 0.2s;
}

.platform-check:hover {
  border-color: $border-strong;
  background: $bg-secondary;
}

.platform-check.checked {
  border-color: $border-strong;
  background: $bg-secondary;
}

.platform-check.checked.purple {
  border-color: #7F77DD;
  background: rgba(127, 119, 221, 0.08);
}

.platform-check.checked.amber {
  border-color: #FBBC04;
  background: rgba(251, 188, 4, 0.12);
}

.platform-check.checked.blue {
  border-color: #1A73E8;
  background: rgba(26, 115, 232, 0.08);
}

.platform-check.checked.green {
  border-color: #34A853;
  background: rgba(52, 168, 83, 0.1);
}

.platform-check.disabled {
  cursor: default;
}

.check-box {
  width: 20px;
  height: 20px;
  border-radius: 5px;
  border: 2px solid $border-strong;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
  color: #fff;
}

.platform-check.checked .check-box {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
}

.platform-check.checked.purple .check-box {
  background: #7F77DD;
  border-color: #7F77DD;
}

.platform-check.checked.amber .check-box {
  background: #FBBC04;
  border-color: #FBBC04;
}

.platform-check.checked.blue .check-box {
  background: #1A73E8;
  border-color: #1A73E8;
}

.platform-check.checked.green .check-box {
  background: #34A853;
  border-color: #34A853;
}

.platform-info {
  flex: 1;
  min-width: 0;
}

.platform-name {
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.platform-desc {
  font-size: 12px;
  color: $text-muted;
  margin-top: 3px;
}

.platform-url {
  font-size: 11px;
  color: #1A73E8;
  margin-top: 2px;
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
}

.platform-badge {
  display: inline-block;
  font-size: 10px;
  padding: 1px 8px;
  border-radius: 9px;
  font-weight: 600;
  white-space: nowrap;
}

// Soft color badge variants (matching v2-create-task.html)
.badge-builtin {
  background: rgba(127, 119, 221, 0.12);
  color: #7F77DD;
}

.badge-ocr {
  background: rgba(251, 188, 4, 0.15);
  color: #C68A00;
}

.badge-letter {
  background: rgba(26, 115, 232, 0.10);
  color: #1A73E8;
}

.badge-custom {
  background: rgba(26, 115, 232, 0.10);
  color: #1A73E8;
}

// ===== 功能挂载矩阵 =====
.func-matrix {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 4px;
}

.func-card {
  background: $bg-primary;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  overflow: hidden;
}

.func-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  border-bottom: 1px solid $border-color;
  background: $bg-secondary;
}

.func-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  font-weight: 600;
}

.plat-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.func-card-badge {
  display: inline-block;
  font-size: 10px;
  padding: 1px 8px;
  border-radius: 9px;
  font-weight: 600;
  white-space: nowrap;
}

.func-card-count {
  font-size: 12px;
  color: $text-muted;
}

.func-card-body {
  padding: 12px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.func-check {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: $bg-primary;
  border: 1px solid $border-color;
  border-radius: $radius;
  cursor: pointer;
  transition: all 0.15s;
}

.func-check:hover {
  border-color: $border-strong;
  background: $bg-secondary;
}

.func-check.checked {
  border-color: #34A853;
  background: rgba(52, 168, 83, 0.08);
}

.func-check-box {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 2px solid $border-strong;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
  color: #fff;
}

.func-check.checked .func-check-box {
  background: #34A853;
  border-color: #34A853;
}

.func-check-name {
  font-size: 13px;
  font-weight: 500;
  color: $text-primary;
}

.func-tags-inline {
  display: inline-flex;
  gap: 4px;
  margin-left: 8px;
  vertical-align: middle;
}

.func-tag-inline {
  display: inline-block;
  font-size: 10px;
  padding: 1px 7px;
  border-radius: 9px;
  font-weight: 600;
  white-space: nowrap;
  line-height: 1.6;
}

// Soft color tag variants (matching v2-create-task.html)
.func-tag-inline.tag-warning {
  background: rgba(251, 188, 4, 0.15);
  color: #C68A00;
}

.func-tag-inline.tag-info {
  background: rgba(26, 115, 232, 0.10);
  color: #1A73E8;
}

.func-tag-inline.tag-success {
  background: rgba(52, 168, 83, 0.12);
  color: #1A8C3F;
}

.func-tag-inline.tag-default {
  background: rgba(127, 119, 221, 0.12);
  color: #7F77DD;
}

.func-support-text {
  font-size: 11px;
  color: var(--text-muted);
  margin-left: 8px;
}

.required-mark {
  color: #E53935;
  font-weight: 600;
  margin-left: 2px;
}

.platform-capability {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  font-size: 11px;
  color: #1A73E8;

  svg {
    flex-shrink: 0;
    color: #1A73E8;
  }
}

.prompt-preview-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 10px;
  padding: 8px 12px;
  background: rgba(52, 168, 83, 0.06);
  border: 1px solid rgba(52, 168, 83, 0.12);
  border-radius: 6px;
}

// ===== 确认预览 =====
.preview-box {
  background: $bg-secondary;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  padding: 24px;
}

.preview-section {
  margin-bottom: 18px;
}

.preview-section:last-child {
  margin-bottom: 0;
}

.preview-label {
  font-size: 11px;
  color: $text-muted;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin-bottom: 8px;
}

.preview-items {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.preview-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: $radius;
  font-size: 12.5px;
  font-weight: 500;
  border: 1px solid $border-color;
}

.preview-tag.tag-purple {
  background: rgba(127, 119, 221, 0.12);
  color: #7F77DD;
  border-color: transparent;
}

.preview-tag.tag-amber {
  background: rgba(251, 188, 4, 0.15);
  color: #C68A00;
  border-color: transparent;
}

.preview-tag.tag-blue {
  background: rgba(26, 115, 232, 0.10);
  color: #1A73E8;
  border-color: transparent;
}

.preview-tag.tag-green {
  background: rgba(52, 168, 83, 0.12);
  color: #1A8C3F;
  border-color: transparent;
}

.tag-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.preview-line {
  font-size: 13px;
  color: $text-secondary;
  line-height: 1.8;
}

.preview-line strong {
  color: $text-primary;
  font-weight: 600;
}

.preview-empty {
  font-size: 12.5px;
  color: $text-muted;
  opacity: 0.5;
}

.prompt-readonly-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: $bg-secondary;
  color: $text-muted;
  font-weight: 500;
  margin-left: 6px;
  text-transform: none;
  letter-spacing: 0;
}

.prompt-preview-box {
  background: $bg-primary;
  border: 1px solid $border-color;
  border-radius: $radius;
  padding: 12px 14px;
  margin-top: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.prompt-preview-text {
  font-size: 12.5px;
  line-height: 1.7;
  color: $text-secondary;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  font-family: inherit;
}

.prompt-supplement {
  margin-top: 12px;
}

.prompt-supplement-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: $text-secondary;
  margin-bottom: 6px;
}

.prompt-supplement-hint {
  color: $text-muted;
  font-weight: 400;
}

// ===== 底部操作栏 =====
.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid $border-color;
}

.action-left,
.action-right {
  display: flex;
  gap: 8px;
}

// ===== 推送平台 Chip 选择 =====
.chip-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: $bg-primary;
  border: 2px solid $border-color;
  border-radius: 24px;
  cursor: pointer;
  transition: all 0.15s;
  font-size: 13px;
  font-weight: 500;
  color: $text-secondary;
  user-select: none;
}

.chip:hover {
  border-color: $border-strong;
  color: $text-primary;
}

.chip.active {
  border-color: rgba(26, 115, 232, 0.798);
  background: rgba(26, 115, 232, 0.10);
  color: var(--accent-primary);
}

.chip.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.chip-icon {
  font-size: 14px;
}

.chip-status {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 500;
  color: $text-muted;
  background: $bg-secondary;
  line-height: 1.4;
}

.chip-status.configured {
  color: #34A853;
  background: rgba(52, 168, 83, 0.10);
}

.dark .chip-status.configured {
  color: #66bb6a;
  background: rgba(102, 187, 106, 0.12);
}

.chip-config-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 12px;
  color: $text-muted;
}

.hint-text {
  color: $text-muted;
}

.hint-link {
  color: #1A73E8;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  transition: color 0.15s;
}

.hint-link:hover {
  color: #1557b0;
  text-decoration: underline;
}

.dark .hint-link {
  color: #6ba3d6;
}

.dark .hint-link:hover {
  color: #8fc0f0;
}

// ===== 技能行展示 =====
.skill-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skill-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: $bg-primary;
  border: 1px solid $border-color;
  border-radius: $radius;
}

.skill-row-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.skill-name {
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
  font-size: 13px;
  font-weight: 500;
}

.skill-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 9px;
  background: rgba(127, 119, 221, 0.12);
  color: #7F77DD;
  font-weight: 600;
}

.skill-badge.user {
  background: rgba(26, 115, 232, 0.10);
  color: #1A73E8;
}

.skill-remove {
  margin-left: auto;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: $text-muted;
  border: none;
  background: none;
  transition: all 0.15s;
  font-size: 16px;
  line-height: 1;
}

.skill-remove:hover {
  background: rgba(234, 67, 53, 0.12);
  color: #EA4335;
}

.skill-empty {
  font-size: 12.5px;
  color: $text-muted;
  padding: 8px 0;
}

.skill-add-row {
  margin-top: 8px;
}

.skill-multi-select {
  position: relative;
  display: inline-block;
}

.skill-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: 1.5px dashed $border-strong;
  border-radius: $radius;
  font-size: 12.5px;
  color: $text-secondary;
  cursor: pointer;
  transition: all 0.15s;
  background: transparent;
}

.skill-add-btn:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  background: rgba(26, 115, 232, 0.10);
}

.skill-ms-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  width: 320px;
  background: $bg-primary;
  border: 1px solid $border-color;
  border-radius: $radius;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  z-index: 20;
  max-height: 300px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.skill-ms-search-wrap {
  padding: 8px 10px;
  border-bottom: 1px solid $border-color;
  flex-shrink: 0;
}

.skill-ms-search {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  font-size: 12px;
  font-family: inherit;
  outline: none;
  background: $bg-secondary;
  color: $text-primary;
}

.skill-ms-search:focus {
  border-color: var(--accent-primary);
}

.skill-ms-list {
  overflow-y: auto;
  flex: 1;
}

.skill-ms-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.1s;
  user-select: none;
}

.skill-ms-option:hover {
  background: $bg-secondary;
}

.skill-ms-option.selected {
  background: rgba(26, 115, 232, 0.10);
}

.skill-ms-check {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 2px solid $border-strong;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #fff;
}

.skill-ms-option.selected .skill-ms-check {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
}

.skill-ms-option-name {
  flex: 1;
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
  font-size: 12.5px;
  color: $text-primary;
}

.skill-ms-option-desc {
  font-size: 11px;
  color: $text-muted;
}

.skill-ms-empty {
  padding: 16px;
  text-align: center;
  color: $text-muted;
  font-size: 12.5px;
}

// ===== 提示词分段展示 =====
.prompt-segment {
  font-size: 12.5px;
  line-height: 1.6;
  margin-bottom: 10px;
  color: $text-secondary;
}

.prompt-seg-tag {
  display: inline-block;
  font-size: 10.5px;
  padding: 1px 7px;
  border-radius: 6px;
  font-weight: 600;
  margin-right: 6px;
  vertical-align: middle;
}

.prompt-seg-tag.seg-base {
  background: rgba(127, 119, 221, 0.12);
  color: #7F77DD;
}

.prompt-seg-tag.seg-platform {
  background: rgba(251, 188, 4, 0.15);
  color: #C68A00;
}

.prompt-seg-tag.seg-function {
  background: rgba(26, 115, 232, 0.10);
  color: #1A73E8;
}

.prompt-seg-tag.seg-tag {
  background: rgba(127, 119, 221, 0.12);
  color: #7F77DD;
}

.prompt-seg-tag.seg-supplement {
  background: rgba(251, 188, 4, 0.15);
  color: #C68A00;
}

.prompt-seg-tag.seg-user {
  background: rgba(26, 115, 232, 0.10);
  color: #1A73E8;
}

// ===== 推送频道激活引导 =====
.channel-guide {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.channel-guide-desc {
  font-size: 14px;
  color: $text-primary;
  margin: 0;
}

.channel-guide-command-box {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: $bg-secondary;
  border: 1px solid $border-color;
  border-radius: $radius;
}

.channel-guide-command {
  flex: 1;
  font-size: 13px;
  color: $text-primary;
  word-break: break-word;
  line-height: 1.5;
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
}

.channel-guide-copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: none;
  border-radius: $radius;
  background: var(--accent-primary);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
  white-space: nowrap;
}

.channel-guide-copy-btn:hover {
  opacity: 0.85;
}

.channel-guide-copy-btn:active {
  opacity: 0.7;
}

.channel-guide-screenshot {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.channel-guide-screenshot-label {
  font-size: 12px;
  color: $text-muted;
  margin: 0;
}

.channel-guide-img {
  width: 100%;
  border-radius: $radius;
  border: 1px solid $border-color;
}

// The duty flow has its own business panels, so its blue-tinted light surfaces
// need explicit dark counterparts rather than relying on the global page shell.
.create-task-page {
  :global(.dark) & {
  --duty-surface: #202b34;
  --duty-surface-raised: #26343e;
  --duty-surface-muted: #182128;
  --duty-border: #3a5363;
  --duty-border-soft: #314653;
  --duty-blue: #68b8ed;
  --duty-blue-soft: #173b52;
  --duty-blue-muted: #284d64;
  --duty-green-soft: #183d35;
  --duty-green-border: #356e5e;
  --duty-green-text: #83d5b8;
  color: $text-primary;

  .duty-preset,
  .capability-section,
  .ranking-config,
  .effect-preview,
  .delivery-note,
  .map-marker-row {
    border-color: var(--duty-border);
    background: var(--duty-surface);
  }

  .duty-preset {
    background: linear-gradient(110deg, #1a2d3b, #202b34);
  }

  .duty-preset.active,
  .capability-card.active,
  .output-item.active {
    border-color: var(--duty-blue);
    background: var(--duty-blue-soft);
    box-shadow: 0 0 0 2px rgba(104, 184, 237, 0.16);
  }

  .duty-preset-title span,
  .editing-badge,
  .segmented button.active {
    color: #9dd8fb;
    background: var(--duty-blue-soft);
  }

  .duty-preset-tags i,
  .capability-card,
  .output-item,
  .bound-context,
  .segmented,
  .segmented button,
  .effect-preview,
  .output-add-bar button {
    border-color: var(--duty-border-soft);
    background: var(--duty-surface-raised);
    color: $text-secondary;
  }

  .capability-section {
    background: linear-gradient(135deg, #1c2931, #17262f);
  }

  .capability-kicker,
  .delivery-intro span,
  .chosen,
  .output-add-bar button,
  .ranking-config-head span,
  .ranking-summary,
  .delivery-note b {
    color: var(--duty-blue);
  }

  .ranking-config-head,
  .effect-preview figcaption {
    border-color: var(--duty-border-soft);
    background: var(--duty-surface-raised);
  }

  .ranking-config-head small,
  .latest-hint,
  .ranking-time-range,
  .bound-context,
  .map-marker-row,
  .delivery-note,
  .simple-run-plan {
    color: $text-secondary;
  }

  .map-config {
    border-color: var(--duty-green-border);
  }

  .map-config .ranking-config-head,
  .map-marker-row {
    border-color: var(--duty-green-border);
    background: var(--duty-green-soft);
  }

  .map-config .ranking-config-head span,
  .map-marker-row {
    color: var(--duty-green-text);
  }

  .ranking-summary {
    border-left-color: var(--duty-blue);
    background: var(--duty-blue-soft);
  }

  .effect-preview-image {
    background: var(--duty-surface-muted);
  }

  .effect-preview figcaption em,
  .output-index {
    color: $text-secondary;
    background: var(--duty-surface-muted);
  }

  .output-action:hover {
    background: var(--duty-surface-muted);
  }

  .output-add-bar {
    border-color: var(--duty-border-soft);
  }

  .confirm-output-list > div,
  .simple-run-plan span {
    border-color: var(--duty-border-soft);
    background: var(--duty-surface-raised);
  }

  .confirm-hero {
    border-color: var(--duty-green-border);
    background: var(--duty-green-soft);
    color: #a2dfc5;
  }

  .confirm-hero small {
    color: $text-secondary;
  }

    :deep(.n-base-selection .n-base-selection-label),
    :deep(.n-input .n-input-wrapper),
    :deep(.n-input-number .n-input-wrapper) {
      background-color: var(--duty-surface-raised);
    }

    :deep(.n-base-selection .n-base-selection-input),
    :deep(.n-input .n-input__input-el),
    :deep(.n-input-number .n-input__input-el) {
      color: $text-primary;
    }
  }
}
</style>
