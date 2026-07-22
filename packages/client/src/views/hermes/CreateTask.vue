<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NInput, NButton, NModal, NTreeSelect, NCheckbox, NCheckboxGroup, NSelect } from 'naive-ui'
import SchedulePicker from '@/components/hermes/shared/SchedulePicker.vue'
import { useJobsStore } from '@/stores/hermes/jobs'
import { useAppStore } from '@/stores/hermes/app'
import { useUserStore } from '@/stores/hermes/user'
import { getJob, scheduleToEditableInput, jobRepeatToEditValue, listJobDeliveryTargets } from '@/api/hermes/jobs'
import type { Job, JobDeliveryTarget } from '@/api/hermes/jobs'
import { listPlatforms } from '@/api/envclaw/platforms'
import type { Platform } from '@/api/envclaw/platforms'
import { fetchCityRegionTree, fetchStationList, type RegionTreeNode, type StationItem } from '@/api/hermes/city-tree'
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
const appStore = useAppStore()
const userStore = useUserStore()
const router = useRouter()
const message = useMessage()

function goToChannels() {
  router.push({ name: 'hermes.channels' })
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
const selectedDeliver = ref('local')
const repeat_times = ref<number | null>(null)
const selectedProvider = ref('')
const selectedModel = ref('')
const selectedSkills = ref<string[]>([])
const promptSupplement = ref('') // 用户补充说明

// ==================== Delivery Targets (from channel_directory.json) ====================
const deliveryTargetsLoading = ref(false)
const deliveryTargets = ref<JobDeliveryTarget[]>([])

async function loadDeliveryTargets() {
  deliveryTargetsLoading.value = true
  try {
    const data = await listJobDeliveryTargets()
    deliveryTargets.value = Array.isArray(data.targets) ? data.targets : []
  } catch {
    deliveryTargets.value = []
  } finally {
    deliveryTargetsLoading.value = false
  }
}

function formatPlatformName(platform: string): string {
  const names: Record<string, string> = {
    weixin: '微信',
    wecom: '企业微信',
    qqbot: 'QQBot',
    dingtalk: '钉钉',
    feishu: '飞书',
    telegram: 'Telegram',
    discord: 'Discord',
    slack: 'Slack',
    whatsapp: 'WhatsApp',
    matrix: 'Matrix',
  }
  return names[platform] || platform
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const deliverOptions = computed(() => {
  const options: Array<{ label: string; value: string }> = [
    { label: '本地', value: 'local' },
  ]
  // Jobs created by the Web UI have no messaging origin. Keep the legacy
  // value editable when loading an existing job, but do not offer it for new jobs.
  if (selectedDeliver.value === 'origin') {
    options.unshift({ label: '原始会话', value: 'origin' })
  }
  for (const target of deliveryTargets.value) {
    const typeSuffix = target.type ? ` (${target.type})` : ''
    options.push({
      label: `${formatPlatformName(target.platform)} · ${target.name}${typeSuffix}`,
      value: target.value,
    })
  }

  // 如果当前值不在选项中（如编辑旧任务），追加一个自定义选项
  const current = selectedDeliver.value.trim()
  if (current && !options.some(option => option.value === current)) {
    options.push({ label: current, value: current })
  }
  return options
})

// ==================== Model / Provider Selection (适配接入，主体不变) ====================
const providerOptions = computed(() => {
  const options = [
    { label: '默认（跟随全局设置）', value: '' },
    ...appStore.modelGroups
      .filter(group => group.models.length > 0)
      .map(group => ({ label: group.label || group.provider, value: group.provider })),
  ]
  if (selectedProvider.value && !options.some(option => option.value === selectedProvider.value)) {
    options.push({ label: selectedProvider.value, value: selectedProvider.value })
  }
  return options
})

const modelOptions = computed(() => {
  const provider = selectedProvider.value
  if (!provider) return [{ label: '默认模型', value: '' }]
  const group = appStore.modelGroups.find(item => item.provider === provider)
  const models = group?.models || []
  const options = models.map(model => ({
    label: appStore.displayModelName(model, provider),
    value: model,
  }))
  if (selectedModel.value && !models.includes(selectedModel.value)) {
    options.unshift({ label: appStore.displayModelName(selectedModel.value, provider), value: selectedModel.value })
  }
  return options
})

function handleProviderChange(provider: string) {
  selectedProvider.value = provider
  if (!provider) {
    selectedModel.value = ''
    return
  }
  const group = appStore.modelGroups.find(item => item.provider === provider)
  if (!group?.models.includes(selectedModel.value)) {
    selectedModel.value = group?.models[0] || ''
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
  { id: 'szdq-map', platformId: 'szdq', name: '一张图', tags: ['截图', '地图'], prompt: '按任务定义生成数智大气一张图成果，设置地图类型、范围、因子、缩放等级、图层和地区标记。' },
  { id: 'szdq-trace', platformId: 'szdq', name: '小时播报', tags: ['截图', '数据采集', '数据分析'], prompt: '定位到小时播报页面，勾选行政区、污染因子，截取页面图片' },
  { id: 'szdq-rank', platformId: 'szdq', name: '浓度排名', tags: ['截图', '数据采集', '数据分析'], prompt: '定位到浓度排名页面，查询平顶山市的数据,实现推送,附带对数据的文字总结' },
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
const selectedCapability = ref<'concentrationRanking' | 'hourlyBrief' | 'mapPackage' | 'monitoringData'>('concentrationRanking')
const rankingPresetActive = ref(true)
const rankingQueryTarget = ref<'city' | 'site'>('city')
const rankingRegion = ref<string[]>(['1320a70ee'])
const rankingProvince = ref('') // 行政区勾选对应的 provinceCodeVO
const rankingStationTypes = ref(['S-100']) // 当前选中的站点类型（多选）
const rankingStationDropdownOpen = ref(false)
const rankingSelectedStations = ref<string[]>([]) // 已选的站点 value 列表
const rankingStationListLoading = ref(false)
const rankingLastLoadedKey = ref('') // 记录上次加载站点列表时的完整参数 key，一致则不重复请求
const rankingStationList = ref<StationItem[]>([]) // 站点列表（扁平）
const rankingStationListByType: Record<string, StationItem[]> = {} // 按站点类型分组的站点列表（用于取消类型时清理已选站点）
const rankingPeriod = ref('hourly')
const rankingFactors = ref<string[]>([]) // 初始化值由后续 period watcher 设置
const rankingIncludeScreenshot = ref(true)
const rankingIncludeAnalysis = ref(false)
const rankingScreenshotScope = ref<'tableOnly' | 'withFilters'>('tableOnly')
const rankingTheme = ref<'light' | 'dark'>('light')
const rankingGbKey = ref<'2' | '0' | '1'>('0') // 国标类型，默认默
const mapTheme = ref<'light' | 'dark'>('light')
const mapMode = ref<'monitoring' | 'interpolation'>('monitoring')
const mapZoom = ref(8)
const mapFactor = ref('PM2.5')
const mapWindWaves = ref(true)
const mapScreenshotScope = ref<'mapOnly' | 'mapLegend' | 'fullPage'>('mapLegend')
// 地图范围：'national' 表示全国；其他值为用户区域 provinceShortCode / currentShortCode（动态）
const mapScope = ref<string>('national')
const mapTimeType = ref<'hourly' | 'dt' | 'daily'>('hourly')
const mapCloseLeftPanel = ref(true)
const hourlyRegion = ref(['1320a70ee'])
const hourlyQueryTarget = ref<'city' | 'site'>('city')
const hourlyStationType = ref<string>('S-100')
const hourlyStationDropdownOpen = ref(false)
const hourlySelectedStations = ref<string[]>([])
const hourlyTownship = ref('all')
const hourlyFactors = ref(['AQI', 'PM₂.₅', 'O₃'])
const hourlyIncludeScreenshot = ref(true)
const hourlyIncludeSummary = ref(true)
const hourlyScreenshotScope = ref<'contentOnly' | 'withFilters'>('contentOnly')
const hourlyTheme = ref<'light' | 'dark'>('light')
const hourlyGbKey = ref<'2' | '0' | '1'>('0') // 国标类型，默认默
const monitoringRegion = ref('1320a70ee')
const monitoringQueryTarget = ref<'city' | 'site'>('city')
const monitoringStationType = ref<string>('S-100')
const monitoringStationDropdownOpen = ref(false)
const monitoringSelectedStations = ref<string[]>([])
const monitoringTownship = ref('all')
const monitoringPeriod = ref<'hour_avg' | 'hour' | 'daily' | 'daily_count' | 'other'>('hour')
const monitoringCustomRange = ref('')
const monitoringFactors = ref(['AQI', 'PM₂.₅', 'O₃'])
const monitoringIncludeTable = ref(true)
const monitoringIncludeScreenshot = ref(false)
const monitoringIncludeAnalysis = ref(false)
const monitoringTheme = ref<'light' | 'dark'>('light')
const monitoringGbKey = ref<'2' | '0' | '1'>('0') // 国标类型，默认默

// 行政区级联树数据（动态从 API 加载，硬编码作为兜底）
const STATIC_AREA_TREE: RegionTreeNode[] = [
  {
    label: '河南省', value: 'henan', children: [
      { label: '全部', value: 'all' },
      {
        label: '平顶山市', value: 'pingdingshan', children: [
          { label: '新华区', value: 'xinhua' }, { label: '卫东区', value: 'weidong' }, { label: '湛河区', value: 'zhanhe' },
        ]
      },
      { label: '郑州市', value: 'zhengzhou' }, { label: '洛阳市', value: 'luoyang' },
    ]
  },
]
const CITY_TREE_CACHE_KEY = 'hermes_city_region_tree'

const cityRegionTree = ref<RegionTreeNode[]>(STATIC_AREA_TREE)
const cityTreeLoading = ref(false)
const cityTreeError = ref('')

// 站点类型选项
const STATION_TYPE_OPTIONS = [
  { label: '标准站', value: 'S-100' },
  { label: '国控站', value: 'S-10' },
  { label: '省控站', value: 'S-11' },
  { label: '市控站', value: 'S-12' },
  { label: '对比站', value: 'S-13' },
  { label: '乡镇站', value: 'S-14' },
  { label: '微站', value: 'S-15' },
  { label: 'TVOC站', value: 'S-16' },
  { label: '粉尘站', value: 'S-17' },
  { label: '高密度站', value: 'S-18' },
]

// 站点名称选项（按类型分组）
const STATION_NAME_OPTIONS: Record<string, { label: string; value: string }[]> = {}

function loadCityRegionTreeFromCache(): RegionTreeNode[] | null {
  try {
    const cached = localStorage.getItem(CITY_TREE_CACHE_KEY)
    if (cached) {
      const tree = JSON.parse(cached) as RegionTreeNode[]
      if (Array.isArray(tree) && tree.length > 0) return tree
    }
  } catch {
    // 缓存损坏，忽略
  }
  return null
}

async function loadCityRegionTree() {
  const cached = loadCityRegionTreeFromCache()
  if (cached) {
    cityRegionTree.value = cached
    return
  }
  cityTreeLoading.value = true
  cityTreeError.value = ''
  try {
    const { tree } = await fetchCityRegionTree(userStore.v5Token)
    cityRegionTree.value = tree
    localStorage.setItem(CITY_TREE_CACHE_KEY, JSON.stringify(tree))
  } catch (e: any) {
    cityTreeError.value = e.message || '加载失败'
    console.warn('[city-tree] 回退到硬编码数据', e)
  } finally {
    cityTreeLoading.value = false
  }
}

/** 在树中递归查找 value 对应的完整 label 路径（如 "河南省 / 平顶山市"） */
function getRegionLabel(value: string): string {
  const result: string[] = []
  function search(nodes: RegionTreeNode[]): boolean {
    for (const node of nodes) {
      if (node.regionKeyVO === value) return true
      if (node.children && search(node.children)) {
        result.unshift(node.fullName || node.label)
        return true
      }
    }
    return false
  }
  if (search(cityRegionTree.value)) {
    return result.join(' / ') || value
  }
  return value
}

/** 在树中按 fullName 查找匹配的节点，返回其 regionKeyVO（用于 NTreeSelect 默认选中） */
function findRegionKeyByFullName(fullName: string): string | null {
  function search(nodes: any[]): any | null {
    for (const node of nodes) {
      if (node.fullName === fullName) return node
      if (node.children) {
        const found = search(node.children)
        if (found) return found
      }
    }
    return null
  }
  const node = search(cityRegionTree.value as any[])
  return node?.regionKeyVO ?? null
}

/** 根据 regionKeyVO（或数组）在树中查找对应节点，收集所有匹配的 provinceCodeVO（去重）
 *  若节点自身无 provinceCodeVO，则继承父节点的 provinceCodeVO。
 */
function findProvinceCodeForRegion(regionKey: string | string[]): string {
  const keys = Array.isArray(regionKey) ? regionKey : [regionKey]
  const provinceCodes = new Set<string>()

  function findNode(nodes: any[], targetKey: string): void {
    for (const node of nodes) {
      const currentProvince = node.provinceCodeVO
      if (node.regionKeyVO === targetKey) {
        if (currentProvince) provinceCodes.add(currentProvince)
        return
      }
      if (node.children) {
        findNode(node.children, targetKey)
      }
    }
  }

  for (const key of keys) {
    if (!key) continue
    findNode(cityRegionTree.value as any[], key)
  }
  console.log('provinceCodes-',Array.from(provinceCodes).join(','))
  
  rankingProvince.value = Array.from(provinceCodes).join(',')
  return Array.from(provinceCodes).join(',')
}

const rankingPeriods = [
  { label: '实时', value: 'hourly' }, { label: '日累计', value: 'daily_count' },
  { label: '日', value: 'daily' }, { label: '月', value: 'month' }, { label: '年', value: 'year' },
  { label: '自定义', value: 'other' },
]
/** 污染因子定义（与 concentrationranking.vue pollutionList 一致） */
const rankingFactorOptions = [
  { value: 'PM2.5', label: 'PM₂.₅' },
  { value: 'PM10', label: 'PM₁₀' },
  { value: 'SO2', label: 'SO₂' },
  { value: 'NO2', label: 'NO₂' },
  { value: 'CO', label: 'CO' },
  { value: 'O3', label: 'O₃' },
  { value: 'O3_8H', label: 'O₃-8h' },
  { value: 'AQI', label: 'AQI' },
]

/** 各时间类型可勾选的污染因子（与 concentrationranking.vue 一致）
 *  实时：PM2.5、PM10、SO2、NO2、CO、O3、AQI
 *  日累计：PM2.5、PM10、SO2、NO2、CO、O3_8H、AQI
 *  日：PM2.5、PM10、SO2、NO2、CO、O3_8H、AQI
 *  月、年、自定义：PM2.5、PM10、SO2、NO2、CO、O3_8H
 */
const RANKING_FACTORS_BY_PERIOD: Record<string, string[]> = {
  hourly: ['PM2.5', 'PM10', 'SO2', 'NO2', 'CO', 'O3', 'AQI'],
  daily_count: ['PM2.5', 'PM10', 'SO2', 'NO2', 'CO', 'O3_8H', 'AQI'],
  daily: ['PM2.5', 'PM10', 'SO2', 'NO2', 'CO', 'O3_8H', 'AQI'],
  month: ['PM2.5', 'PM10', 'SO2', 'NO2', 'CO', 'O3_8H'],
  year: ['PM2.5', 'PM10', 'SO2', 'NO2', 'CO', 'O3_8H'],
  other: ['PM2.5', 'PM10', 'SO2', 'NO2', 'CO', 'O3_8H'],
  map: ['PM2.5', 'PM10', 'SO2', 'NO2', 'CO', 'O3', 'AQI'],
}

const rankingFactorOptionsComputed = computed(() =>
  rankingFactorOptions.filter(f =>
    RANKING_FACTORS_BY_PERIOD[rankingPeriod.value]?.includes(f.value)
  )
)
const townshipOptions = [
  { label: '全部乡镇', value: 'all' }, { label: '新华区', value: 'xinhua' }, { label: '卫东区', value: 'weidong' }, { label: '湛河区', value: 'zhanhe' },
]
const monitoringPeriodOptions: Array<{ value: MonitoringDataOutputSnapshot['type']; label: string }> = [
  { value: 'hour_avg', label: '小时均值' }, { value: 'hour', label: '小时' }, { value: 'daily', label: '逐日累计' }, { value: 'daily_count', label: '日累计' }, { value: 'other', label: '自定义' },
]
const mapFactorOptions =
  rankingFactorOptions.filter(f =>
    RANKING_FACTORS_BY_PERIOD['map']?.includes(f.value)
  )

function setRankingPeriod(type: string) {
  rankingPeriod.value = type
}

interface RankingOutputSnapshot {
  zone: 'city' | 'site'
  province: string    // 行政区对应的 provinceCodeVO（与 concentrationranking.vue province 参数一致）
  region: string      // 行政区勾选的 regionKeyVO（与 concentrationranking.vue region 参数一致）
  stationType?: string // 仅当 zone=site 时有效，选中的站点类型逗号分隔
  station?: string     // 仅当 zone=site 时有效，已勾选的站点 value 逗号分隔
  type: string
  factors: string     // 选中的污染因子逗号分隔
  gbKey: '2' | '0' | '1' // 国标类型：2=新, 0=默认, 1=旧
  includeScreenshot: boolean
  includeAnalysis: boolean
  screenshotScope: 'tableOnly' | 'withFilters'
  theme: 'light' | 'dark'
}

// userStore.platformUserInfo.region 运行时结构（类型定义更窄，运行时实际有更多字段）
interface RegionInfo {
  provinceShortCode?: string
  provinceName?: string
  parentShortCode?: string
  parentName?: string
  currentShortCode?: string
  currentRegionName?: string
  currentRegionLevel?: number  // 1=城市账号, 2=区县账号
}

interface MapOutputSnapshot {
  theme: 'light' | 'dark'
  mode: 'monitoring' | 'interpolation'
  zoom: number
  factor: string
  windWaves: boolean
  screenshotScope: 'mapOnly' | 'mapLegend' | 'fullPage'
  region: string  // 'national' 或用户的 provinceShortCode / currentShortCode
  timeType: 'hourly' | 'dt' | 'daily'
  leftPanel: boolean
  closeLeftPanel?: boolean
}

interface HourlyBriefOutputSnapshot {
  zone: 'city' | 'site'
  region: string
  township: string
  factors: string // 选中的污染因子逗号分隔
  gbKey: '2' | '0' | '1' // 国标类型：2=新, 0=默认, 1=旧
  includeScreenshot: boolean
  includeSummary: boolean
  screenshotScope: 'contentOnly' | 'withFilters'
  theme: 'light' | 'dark'
}

interface MonitoringDataOutputSnapshot {
  zone: 'city' | 'site'
  region: string
  township: string
  type: 'hour_avg' | 'hour' | 'daily' | 'daily_count' | 'other'
  customRange: string
  factors: string // 选中的污染因子逗号分隔
  gbKey: '2' | '0' | '1' // 国标类型：2=新, 0=默认, 1=旧
  includeTable: boolean
  includeScreenshot: boolean
  includeAnalysis: boolean
  theme: 'light' | 'dark'
}

type DutyOutputItem =
  | { id: string; type: 'concentrationRanking'; title: string; config: RankingOutputSnapshot }
  | { id: string; type: 'mapPackage'; title: string; config: MapOutputSnapshot }
  | { id: string; type: 'hourlyBrief'; title: string; config: HourlyBriefOutputSnapshot }
  | { id: string; type: 'monitoringData'; title: string; config: MonitoringDataOutputSnapshot }

let outputSequence = 0
const newOutputId = () => `output-${++outputSequence}`
const captureRankingConfig = (): RankingOutputSnapshot => {
  const isStation = rankingQueryTarget.value === 'site'
  return {
    zone: rankingQueryTarget.value, province: rankingProvince.value, region: rankingRegion.value.join(','),
    ...(isStation && { stationType: rankingStationTypes.value.join(','), station: rankingSelectedStations.value.join(',') }),
    type: rankingPeriod.value,
    factors: rankingFactors.value.join(','), gbKey: rankingGbKey.value,
    includeScreenshot: rankingIncludeScreenshot.value,
    includeAnalysis: rankingIncludeAnalysis.value, screenshotScope: rankingScreenshotScope.value, theme: rankingTheme.value,
  }
}
const captureMapConfig = (): MapOutputSnapshot => ({
  theme: mapTheme.value, mode: mapMode.value, zoom: mapZoom.value, factor: mapFactor.value,
  windWaves: mapWindWaves.value, screenshotScope: mapScreenshotScope.value, region: mapScope.value,
  timeType: mapTimeType.value, leftPanel: mapCloseLeftPanel.value,
})
const captureHourlyConfig = (): HourlyBriefOutputSnapshot => ({
  zone: hourlyQueryTarget.value, region: hourlyRegion.value.join(','), township: hourlyTownship.value, factors: hourlyFactors.value.join(','),
  gbKey: hourlyGbKey.value,
  includeScreenshot: hourlyIncludeScreenshot.value, includeSummary: hourlyIncludeSummary.value,
  screenshotScope: hourlyScreenshotScope.value, theme: hourlyTheme.value,
})
const captureMonitoringConfig = (): MonitoringDataOutputSnapshot => ({
  zone: monitoringQueryTarget.value, region: monitoringRegion.value, township: monitoringTownship.value,
  type: monitoringPeriod.value, customRange: monitoringCustomRange.value,
  factors: monitoringFactors.value.join(','), gbKey: monitoringGbKey.value,
  includeTable: monitoringIncludeTable.value,
  includeScreenshot: monitoringIncludeScreenshot.value, includeAnalysis: monitoringIncludeAnalysis.value,
  theme: monitoringTheme.value,
})

const initialOutputId = newOutputId()
const dutyOutputs = ref<DutyOutputItem[]>([{ id: initialOutputId, type: 'concentrationRanking', title: '浓度排名 1', config: captureRankingConfig() }])
const activeOutputId = ref(initialOutputId)

function syncActiveOutput() {
  const output = dutyOutputs.value.find(item => item.id === activeOutputId.value)
  if (!output) return
  if (output.type === 'concentrationRanking') output.config = captureRankingConfig()
  else if (output.type === 'mapPackage') output.config = captureMapConfig()
  else if (output.type === 'hourlyBrief') output.config = captureHourlyConfig()
  else output.config = captureMonitoringConfig()
}

function loadOutput(output: DutyOutputItem) {
  activeOutputId.value = output.id
  selectedCapability.value = output.type
  if (output.type === 'concentrationRanking') {
    const c = output.config
    rankingQueryTarget.value = c.zone; rankingRegion.value = c.region ? c.region.split(',') : []; rankingProvince.value = c.province || ''
    rankingStationTypes.value = c.stationType ? c.stationType.split(',') : []
    rankingSelectedStations.value = c.station ? c.station.split(',') : []
    rankingPeriod.value = c.type
    rankingFactors.value = c.factors ? c.factors.split(',') : []
    rankingIncludeScreenshot.value = c.includeScreenshot; rankingIncludeAnalysis.value = c.includeAnalysis
    rankingScreenshotScope.value = c.screenshotScope; rankingTheme.value = c.theme
    rankingGbKey.value = c.gbKey || '0'
  } else if (output.type === 'mapPackage') {
    const c = output.config
    mapTheme.value = c.theme; mapMode.value = c.mode; mapZoom.value = c.zoom; mapFactor.value = c.factor
    mapWindWaves.value = c.windWaves; mapScreenshotScope.value = c.screenshotScope; mapScope.value = c.region
    mapTimeType.value = c.timeType; mapCloseLeftPanel.value = c.closeLeftPanel ?? true
  } else if (output.type === 'hourlyBrief') {
    const c = output.config
    hourlyQueryTarget.value = c.zone; hourlyRegion.value = c.region ? c.region.split(',') : []; hourlyTownship.value = c.township; hourlyFactors.value = c.factors ? c.factors.split(',') : []
    hourlyIncludeScreenshot.value = c.includeScreenshot; hourlyIncludeSummary.value = c.includeSummary
    hourlyScreenshotScope.value = c.screenshotScope; hourlyTheme.value = c.theme
    hourlyGbKey.value = c.gbKey || '0'
  } else {
    const c = output.config
    monitoringQueryTarget.value = c.zone; monitoringRegion.value = c.region; monitoringTownship.value = c.township
    monitoringPeriod.value = c.type; monitoringCustomRange.value = c.customRange
    monitoringFactors.value = c.factors ? c.factors.split(',') : []; monitoringIncludeTable.value = c.includeTable
    monitoringIncludeScreenshot.value = c.includeScreenshot; monitoringIncludeAnalysis.value = c.includeAnalysis
    monitoringTheme.value = c.theme
    monitoringGbKey.value = c.gbKey || '0'
  }
}

function selectDutyOutput(output: DutyOutputItem) {
  syncActiveOutput()
  loadOutput(output)
}

// 编辑模式：从已保存任务的 prompt 中反解析【成果执行清单】JSON 与自由文本，重建 dutyOutputs 及各项配置回显。
function hydrateFromPrompt(prompt: string) {
  // 提取【任务说明】与【补充说明】自由文本（避免把整个 composed prompt 回填导致嵌套）
  const descMatch = prompt.match(/【任务说明】\n([\s\S]*?)(?=\n\n【|$)/)
  taskPrompt.value = descMatch ? descMatch[1].trim() : ''
  const supMatch = prompt.match(/【补充说明】\n([\s\S]*?)(?=\n\n【|$)/)
  promptSupplement.value = supMatch ? supMatch[1].trim() : ''

  // 提取并解析【成果执行清单】JSON
  const manifestMatch = prompt.match(/【成果执行清单】\n([\s\S]*?)(?=\n\n【|$)/)
  if (!manifestMatch) return
  let parsed: any
  try { parsed = JSON.parse(manifestMatch[1].trim()) } catch { return }
  const outputs = Array.isArray(parsed?.outputs) ? parsed.outputs : []
  if (!outputs.length) return

  const capabilityToType: Record<string, DutyOutputItem['type']> = {
    'mapairs-ranking-capture': 'concentrationRanking',
    'mapairs-onemap-capture': 'mapPackage',
    'mapairs-hourly-brief': 'hourlyBrief',
    'mapairs-monitoring-data': 'monitoringData',
  }
  const titlePrefix: Record<DutyOutputItem['type'], string> = {
    concentrationRanking: '浓度排名', mapPackage: '一张图', hourlyBrief: '小时播报', monitoringData: '监测数据',
  }
  const counters: Record<string, number> = {}
  const rebuilt: DutyOutputItem[] = []
  let maxSeq = 0
  for (const o of outputs) {
    const type = capabilityToType[o?.capability]
    if (!type || !o?.config) continue
    counters[type] = (counters[type] || 0) + 1
    const id = typeof o.id === 'string' && o.id ? o.id : newOutputId()
    const seqMatch = /output-(\d+)/.exec(id)
    if (seqMatch) maxSeq = Math.max(maxSeq, Number(seqMatch[1]))
    rebuilt.push({ id, type, title: `${titlePrefix[type]} ${counters[type]}`, config: o.config } as DutyOutputItem)
  }
  if (!rebuilt.length) return
  outputSequence = Math.max(outputSequence, maxSeq)
  dutyOutputs.value = rebuilt
  activeOutputId.value = rebuilt[0].id
  selectedPlatforms.value = new Set(['szdq'])
  loadOutput(rebuilt[0])
  refreshSelectedFunctions()
}

function refreshSelectedFunctions() {
  const functionByType = { concentrationRanking: 'szdq-rank', mapPackage: 'szdq-map', hourlyBrief: 'szdq-trace', monitoringData: 'szdq-review' }
  selectedFunctions.value = new Set(dutyOutputs.value.map(item => functionByType[item.type]))
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

function addHourlyOutput() {
  syncActiveOutput()
  const id = newOutputId()
  const count = dutyOutputs.value.filter(item => item.type === 'hourlyBrief').length + 1
  const item: DutyOutputItem = { id, type: 'hourlyBrief', title: `小时播报 ${count}`, config: captureHourlyConfig() }
  dutyOutputs.value.push(item)
  loadOutput(item)
  selectedPlatforms.value = new Set(['szdq'])
  refreshSelectedFunctions()
}

function addMonitoringOutput() {
  syncActiveOutput()
  const id = newOutputId()
  const count = dutyOutputs.value.filter(item => item.type === 'monitoringData').length + 1
  const item: DutyOutputItem = { id, type: 'monitoringData', title: `监测数据 ${count}`, config: captureMonitoringConfig() }
  dutyOutputs.value.push(item)
  loadOutput(item)
  selectedPlatforms.value = new Set(['szdq'])
  refreshSelectedFunctions()
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

// 行政区勾选变化 → 推导 province（对应 concentrationranking.vue 的 provinceCodeVO）
// 必须先于 deep watch 执行，确保 syncActiveOutput 捕获到最新的 province
watch(rankingRegion, () => {
  rankingProvince.value = findProvinceCodeForRegion(rankingRegion.value) || ''
}, { flush: 'sync' })

watch([
  rankingQueryTarget, rankingRegion, rankingPeriod,
  rankingFactors, rankingIncludeScreenshot, rankingIncludeAnalysis,
  rankingScreenshotScope, rankingTheme, rankingProvince, rankingGbKey,
  rankingStationTypes, rankingSelectedStations,
  mapTheme, mapMode, mapZoom, mapFactor, mapWindWaves,
  mapScreenshotScope, mapScope, mapTimeType, mapCloseLeftPanel,
  hourlyQueryTarget, hourlyRegion, hourlyTownship, hourlyFactors, hourlyIncludeScreenshot, hourlyIncludeSummary, hourlyScreenshotScope, hourlyTheme, hourlyGbKey,
  monitoringQueryTarget, monitoringRegion, monitoringTownship, monitoringPeriod, monitoringCustomRange, monitoringFactors, monitoringIncludeTable,
  monitoringIncludeScreenshot, monitoringIncludeAnalysis, monitoringTheme, monitoringGbKey,
], syncActiveOutput, { deep: true, flush: 'sync' })

// 时间类型变化 → 默认全选当前时间类型的所有污染因子
watch(rankingPeriod, (newPeriod) => {
  rankingFactors.value = [...(RANKING_FACTORS_BY_PERIOD[newPeriod] || [])]
})

// 站点类型/行政区变化 → 重新加载站点列表（参数完全一致则不重复请求）
async function loadStationList() {
  if (rankingStationListLoading.value) {
    console.log('[loadStationList] 跳过，加载中')
    return
  }

  // province / region / stationType 任一为空则不请求
  if (!rankingProvince.value) {
    console.log('[loadStationList] 跳过，province 为空')
    return
  }
  if (rankingRegion.value.length === 0) {
    console.log('[loadStationList] 跳过，region 为空')
    return
  }
  if (rankingStationTypes.value.length === 0) {
    console.log('[loadStationList] 跳过，stationType 为空')
    return
  }

  const currentKey = [rankingProvince.value, rankingRegion.value.join(','), rankingStationTypes.value.join(',')].join('|')
  if (currentKey === rankingLastLoadedKey.value) {
    console.log('[loadStationList] 跳过，参数未变', currentKey)
    return
  }

  rankingStationListLoading.value = true
  try {
    const { stations } = await fetchStationList(
      rankingProvince.value,
      rankingRegion.value.join(','),
      rankingStationTypes.value.join(','),
      userStore.v5Token,
    )
    // 扁平列表 + 按类型分组（分组仅用于取消类型时清理已选站点）
    rankingStationList.value = stations as StationItem[]
    const byType: Record<string, StationItem[]> = {}
    for (const s of stations) {
      const type = (s as Record<string, any>).stationType || 'S-100'
      if (!byType[type]) byType[type] = []
      byType[type].push(s)
    }
    Object.assign(rankingStationListByType, byType)
    rankingLastLoadedKey.value = currentKey
  } catch (e: any) {
    console.warn('[station-list] 加载失败', e)
  } finally {
    rankingStationListLoading.value = false
  }
}
let stationTypesLabel = ref<string[]>([])
watch([rankingQueryTarget, rankingProvince, rankingRegion, stationTypesLabel], () => {
  if (rankingQueryTarget.value !== 'site') {
    return
  }
  console.log('[WATCH 站点列表]', rankingProvince.value, rankingRegion.value, stationTypesLabel.value)
  try {
    loadStationList()
  } catch (e) {
    console.error('[WATCH] loadStationList 报错', e)
  }
}, { flush: 'sync' })
watch(rankingStationTypes, (newV) => {
  console.log('rankingStationTypes改变', newV)
})
// 切换站点类型多选
function toggleRankingStationType(type: string) {
  const idx = rankingStationTypes.value.indexOf(type)
  if (idx >= 0) {
    rankingStationTypes.value.splice(idx, 1)
    // 同时清理该类型下已选的站点
    const removedStations = rankingStationListByType[type]
    if (removedStations) {
      const toRemove = removedStations.map(s => s.shortCode)
      rankingSelectedStations.value = rankingSelectedStations.value.filter(v => !toRemove.includes(v))
    }
  } else {
    rankingStationTypes.value.push(type)
  }
  stationTypesLabel.value = [...rankingStationTypes.value]
  console.log('[toggleRankingStationType]', rankingProvince.value, rankingRegion.value, rankingStationTypes.value)
}

// 全选/取消全部站点
function toggleRankingAllStations() {
  if (rankingSelectedStations.value.length === rankingStationList.value.length) {
    rankingSelectedStations.value = []
  } else {
    rankingSelectedStations.value = rankingStationList.value.map(s => s.shortCode)
  }
}

const rankingAllStationsChecked = computed(() =>
  rankingStationList.value.length > 0 && rankingSelectedStations.value.length === rankingStationList.value.length
)

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
    if (!selectedDeliver.value) {
      message.warning('请选择推送目标')
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
  if (!selectedDeliver.value) return false
  return !!schedule.value
})

const deliverDisplayName = computed(() => {
  if (!selectedDeliver.value) return ''
  if (selectedDeliver.value === 'local') return '本地'
  if (selectedDeliver.value === 'origin') return '原始会话'
  const target = deliveryTargets.value.find(t => t.value === selectedDeliver.value)
  if (target) return `${formatPlatformName(target.platform)} · ${target.name}`
  // 兜底：解析 platform:id 格式
  const parts = selectedDeliver.value.split(':')
  if (parts.length >= 2) return `${formatPlatformName(parts[0])} · ${parts.slice(1).join(':')}`
  return selectedDeliver.value
})

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
const rankingRegionLabel = computed(() =>
  rankingRegion.value.length === 0
    ? ''
    : rankingRegion.value.map(k => getRegionLabel(k)).join('、')
)
// 站点类型名称列表（用于本次成果展示）
const rankingStationTypeLabels = computed(() =>
  rankingStationTypes.value.map(t => STATION_TYPE_OPTIONS.find(o => o.value === t)?.label || t)
)
// 已选站点名称列表（用于本次成果展示）
const rankingSelectedStationNames = computed(() =>
  rankingSelectedStations.value.map(
    code => rankingStationList.value.find(s => s.shortCode === code)?.name || code
  )
)
// 地图范围选项（根据账号层级 currentRegionLevel 动态生成）
// level 2（区县账号）→ 省份 / 城市 / 区县；level 1（城市账号）或 undefined → 全国 / 省份 / 城市
const mapScopeOptions = computed(() => {
  const opts: Array<{ value: string; label: string }> = []
  const region = userStore.platformUserInfo?.region as RegionInfo | undefined
  if (!region) {
    opts.push({ value: 'national', label: '全国' })
    return opts
  }
  const level = region.currentRegionLevel ?? 1
  if (level === 2) {
    // 区县账号：省份 / 城市 / 区县
    if (region.provinceShortCode) opts.push({ value: region.provinceShortCode, label: region.provinceName || region.provinceShortCode })
    if (region.parentShortCode && region.parentShortCode !== region.provinceShortCode) opts.push({ value: region.parentShortCode, label: region.parentName || region.parentShortCode })
    if (region.currentShortCode && region.currentShortCode !== region.parentShortCode && region.currentShortCode !== region.provinceShortCode) opts.push({ value: region.currentShortCode, label: region.currentRegionName || region.currentShortCode })
  } else {
    // 城市账号：全国 / 省份 / 城市
    opts.push({ value: 'national', label: '全国' })
    if (region.provinceShortCode) opts.push({ value: region.provinceShortCode, label: region.provinceName || region.provinceShortCode })
    if (region.currentShortCode && region.currentShortCode !== region.provinceShortCode) opts.push({ value: region.currentShortCode, label: region.currentRegionName || region.currentShortCode })
  }
  return opts
})
// 当前 region 的显示标签
const mapScopeLabel = computed(() => {
  if (mapScope.value === 'national') return '全国'
  return mapScopeOptions.value.find(o => o.value === mapScope.value)?.label || mapScope.value
})
const mapModeLabel = computed(() => mapMode.value === 'monitoring' ? '监测图' : '插值图')
const mapFactorLabel = computed(() => mapFactorOptions.find(item => item.value === mapFactor.value)?.label || '首要污染物')
const mapScreenshotScopeLabel = computed(() => ({ mapOnly: '仅地图', mapLegend: '地图和图例', fullPage: '完整页面' }[mapScreenshotScope.value]))
const regionLabelFor = (value: string) => getRegionLabel(value)
const mapScopeLabelFor = (value: MapOutputSnapshot['region']) => {
  if (value === 'national') return '全国'
  return mapScopeOptions.value.find(o => o.value === value)?.label || value
}
const mapFactorLabelFor = (value: string) => mapFactorOptions.find(item => item.value === value)?.label || '首要污染物'
const townshipLabelFor = (value: string) => townshipOptions.find(item => item.value === value)?.label || '全部乡镇'
const monitoringPeriodLabelFor = (value: MonitoringDataOutputSnapshot['type']) => monitoringPeriodOptions.find(item => item.value === value)?.label || '小时'

/** 将因子编码转为显示标签 */
const factorLabelFor = (value: string) => rankingFactorOptions.find(f => f.value === value)?.label || value

function outputDefinition(output: DutyOutputItem): string {
  if (output.type === 'concentrationRanking') {
    const c = output.config
    const type = rankingPeriods.find(item => item.value === c.type)?.label || '日累计'
    const outputs = [c.includeScreenshot ? `排名截图（${c.screenshotScope === 'tableOnly' ? '仅标题和表格' : '含查询条件'}、${c.theme === 'light' ? '浅色' : '深色'}）` : '', c.includeAnalysis ? '数据分析摘要' : ''].filter(Boolean).join('、')
    const factorsLabel = c.factors ? c.factors.split(',').map(factorLabelFor).join('、') : ''
    const parts: string[] = []
    if (c.stationType) {
      const types = c.stationType.split(',').map(t => STATION_TYPE_OPTIONS.find(o => o.value === t)?.label || t).join('、')
      parts.push(`站点类型：${types}`)
    }
    if (c.station) {
      const names = c.station.split(',').map(code => rankingStationList.value.find(s => s.shortCode === code)?.name || code).join('、')
      parts.push(`站点：${names}`)
    }
    const gbLabel = { '2': '新', '0': '默', '1': '旧' }[c.gbKey] || '默'
    return `${output.title}：${c.zone === 'city' ? '城市查询' : '站点查询'}；行政区：${regionLabelFor(c.region)}${parts.length ? '；' + parts.join('；') : ''}；国标类型：${gbLabel}；数据口径：${type}；数据时间：官网最新可用时间；污染因子：${factorsLabel}；成果：${outputs}`
  }
  if (output.type === 'mapPackage') {
    const c = output.config
    return `${output.title}：范围：${mapScopeLabelFor(c.region)}；地图类型：${c.mode === 'monitoring' ? '监测图' : '插值图'}；因子：${mapFactorLabelFor(c.factor)}；时间类型：${({ hourly: '实时', dt: '累计', daily: '日' }[c.timeType])}；缩放等级：${c.zoom}；颜色：${c.theme === 'light' ? '浅色' : '深色'}；风/海浪：${c.windWaves ? '开启' : '关闭'}；左侧面板：${c.leftPanel ? '显示' : '关闭'}；截图区域：${({ mapOnly: '仅地图', mapLegend: '地图和图例', fullPage: '完整页面' }[c.screenshotScope])}`
  }
  if (output.type === 'hourlyBrief') {
    const c = output.config
    const delivery = [c.includeScreenshot ? `播报截图（${c.screenshotScope === 'contentOnly' ? '仅播报内容' : '含查询条件'}、${c.theme === 'light' ? '浅色' : '深色'}）` : '', c.includeSummary ? '文字播报' : ''].filter(Boolean).join('、')
    const factorsLabel = c.factors ? c.factors.split(',').map(factorLabelFor).join('、') : ''
    const gbLabel = { '2': '新', '0': '默', '1': '旧' }[c.gbKey] || '默'
    return `${output.title}：${c.zone === 'city' ? '城市' : '站点'}；行政区：${regionLabelFor(c.region)}；乡镇：${townshipLabelFor(c.township)}；国标类型：${gbLabel}；数据时间：官网最新可用时间；污染因子：${factorsLabel}；成果：${delivery}`
  }
  const c = output.config
  const delivery = [c.includeTable ? '监测数据表' : '', c.includeScreenshot ? `${c.theme === 'light' ? '浅色' : '深色'}截图` : '', c.includeAnalysis ? '数据分析摘要' : ''].filter(Boolean).join('、')
  const time = c.type === 'other' ? `自定义：${c.customRange || '待设置'}` : `官网最新${monitoringPeriodLabelFor(c.type)}数据`
  const factorsLabel = c.factors ? c.factors.split(',').map(factorLabelFor).join('、') : ''
  const gbLabel = { '2': '新', '0': '默', '1': '旧' }[c.gbKey] || '默'
  return `${output.title}：${c.zone === 'city' ? '城市' : '站点'}；行政区：${regionLabelFor(c.region)}；乡镇：${townshipLabelFor(c.township)}；国标类型：${gbLabel}；时间：${time}；污染因子：${factorsLabel}；成果：${delivery}`
}

const allOutputLabels = computed(() => dutyOutputs.value.map(outputDefinition))
const taskExecutionOutputs = computed(() => dutyOutputs.value.map(output => ({
  id: output.id,
  capability: ({ concentrationRanking: 'mapairs-ranking-capture', mapPackage: 'mapairs-onemap-capture', hourlyBrief: 'mapairs-hourly-brief', monitoringData: 'mapairs-monitoring-data' }[output.type]),
  skill: output.type === 'concentrationRanking' && output.config.includeScreenshot ? 'mapairs-ranking-capture' : output.type === 'mapPackage' ? 'mapairs-onemap-capture' : null,
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

// 每个成果“应交付物”推导：仅依据用户勾选的生成成果，驱动交付验收清单。
// kind=screenshot 为需 MEDIA: 附件的截图文件；text 为写入回复正文的文字成果。
interface ExpectedDeliverable { label: string; kind: 'screenshot' | 'text' }
function outputDeliverables(output: DutyOutputItem): ExpectedDeliverable[] {
  const list: ExpectedDeliverable[] = []
  if (output.type === 'concentrationRanking') {
    if (output.config.includeScreenshot) list.push({ label: '排名截图', kind: 'screenshot' })
    if (output.config.includeAnalysis) list.push({ label: '数据分析摘要', kind: 'text' })
  } else if (output.type === 'mapPackage') {
    list.push({ label: '一张图截图', kind: 'screenshot' })
  } else if (output.type === 'hourlyBrief') {
    if (output.config.includeScreenshot) list.push({ label: '播报截图', kind: 'screenshot' })
    if (output.config.includeSummary) list.push({ label: '文字播报', kind: 'text' })
  } else {
    if (output.config.includeTable) list.push({ label: '监测数据表', kind: 'text' })
    if (output.config.includeScreenshot) list.push({ label: '数据截图', kind: 'screenshot' })
    if (output.config.includeAnalysis) list.push({ label: '数据分析摘要', kind: 'text' })
  }
  return list
}
const deliveryChecklist = computed(() => {
  const lines: string[] = []
  let screenshotCount = 0
  dutyOutputs.value.forEach((output) => {
    const items = outputDeliverables(output)
    screenshotCount += items.filter(i => i.kind === 'screenshot').length
    const desc = items.map(i => i.kind === 'screenshot' ? `${i.label}（截图文件，需 MEDIA:）` : `${i.label}（文字，写入回复正文）`).join('；')
    lines.push(`- 【${output.title}】${desc || '（未勾选任何成果）'}`)
  })
  return { lines, screenshotCount }
})

const finalPrompt = computed(() => {
  const parts: string[] = []

  parts.push(`【成果执行清单】\n${taskExecutionManifest.value}`)
  parts.push('【执行规则】\n按 outputs 数组顺序逐项执行。每项成果只能读取自身 config；禁止将一个成果的主题、时间、因子、截图范围带入其他成果。带 skill 的成果必须使用该 Skill 附带的固定脚本，不得自行使用 agent-browser 或网页操作替代。')

  // 【成果附带规则】无论用户任务说明如何，都强制追加；投递由 Hermes 系统按 deliver 配置自动完成，agent 不要自己推送或派发子任务。
  parts.push('【成果附带规则｜强制】\n所有成果生成后，你的最终回复中必须为每一个产出文件原样附上一行 `MEDIA:/绝对路径`（路径取脚本输出的 MEDIA:/ARTIFACT: 行）。Hermes 会据此自动将文件作为原生媒体投递到任务配置的推送目标。严禁自行调用任何推送工具、也不要用 delegate/派发子任务的方式去发送；只要把 MEDIA: 行写进最终回复即可。不允许只在本地生成而不在回复中用 MEDIA: 附上，不允许遗漏任何一项成果。')

  // 【交付验收清单】按每个成果勾选的生成成果逐项列出，并给出截图总数，防止多截图时只推一张。
  const { lines: checklistLines, screenshotCount } = deliveryChecklist.value
  parts.push(`【交付验收清单｜强制】\n本任务需按下表逐项交付，缺一不可：\n${checklistLines.join('\n')}\n其中截图类文件共 ${screenshotCount} 个：你的最终回复必须包含 ${screenshotCount} 行独立的 \`MEDIA:/绝对路径\`（每个截图一行，取脚本输出路径），行数必须等于 ${screenshotCount}，不得合并、省略或只发其中一张。文字类成果直接写入回复正文。任一截图若未成功生成，必须明确报告失败原因，不得跳过或以其他截图替代。`)

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
    if (!selectedDeliver.value) {
      message.warning('请选择推送目标')
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
  // prompt: '【成果执行清单】\n{\n  "version": 1,\n  "outputs": [\n    {\n      "id": "output-2",\n      "capability": "mapairs-ranking-capture",\n      "skill": "mapairs-ranking-capture",\n      "config": {\n        "zone": "city",\n        "province": "",\n        "region": "41bb1ac37",\n        "stationType": "S-100",\n        "station": [],\n        "type": "hourly",\n        "factors": [\n          "PM2.5",\n          "PM10",\n          "SO2",\n          "NO2",\n          "CO",\n          "O3",\n          "AQI"\n        ],\n        "includeScreenshot": true,\n        "includeAnalysis": false,\n        "screenshotScope": "tableOnly",\n        "theme": "light"\n      }\n    }\n  ]\n}\n\n【执行规则】\n按 outputs 数组顺序逐项执行。每项成果只能读取自身 config；禁止将一个成果的主题、时间、因子、截图范围带入其他成果。带 skill 的成果必须使用该 Skill 附带的固定脚本，不得自行使用 agent-browser 或网页操作替代。\n\n【任务说明】\n按结构化成果清单生成空气质量值守成果，并统一推送。'
  submitting.value = true
  try {
    const payload = {
      name: taskName.value,
      schedule: schedule.value,
      prompt: finalPrompt.value,
      deliver: selectedDeliver.value,
      skills: taskSkills.value,
      repeat: repeat_times.value ?? undefined,
      provider: selectedProvider.value || undefined,
      model: selectedModel.value || undefined,
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
  const deliver = selectedDeliver.value
  if (!deliver) return false
  return deliver !== 'origin' && deliver !== 'local'
}
function resetForm() {
  taskName.value = '空气质量值守'
  taskPrompt.value = '按结构化成果清单生成空气质量值守成果，并统一推送。'
  selectedDeliver.value = 'local'
  repeat_times.value = null
  selectedProvider.value = ''
  selectedModel.value = ''
  selectedSkills.value = []
  schedule.value = '0 9 * * *'
  promptSupplement.value = ''
  selectedPlatforms.value = new Set(['szdq'])
  selectedFunctions.value = new Set(['szdq-rank'])
  selectedCapability.value = 'concentrationRanking'
  rankingPresetActive.value = true
  rankingProvince.value = ''
  rankingStationTypes.value = ['S-100']
  rankingSelectedStations.value = []
  rankingStationList.value = []
  rankingLastLoadedKey.value = ''
  Object.keys(rankingStationListByType).forEach(k => delete rankingStationListByType[k])
  // 默认全选当前时间类型的因子
  rankingPeriod.value = 'hourly'
  rankingFactors.value = [...(RANKING_FACTORS_BY_PERIOD['hourly'] || [])]
  const id = newOutputId()
  dutyOutputs.value = [{ id, type: 'concentrationRanking', title: '浓度排名 1', config: captureRankingConfig() }]
  activeOutputId.value = id
  originalJob.value = null
}

// ==================== Lifecycle ====================
onMounted(async () => {
  resetForm()
  await Promise.all([loadPlatforms(), loadDeliveryTargets()])
  appStore.loadModels().catch(() => {})
  await loadCityRegionTree()

  // 设置用户默认绑定的城市（从 hermes_platform_user 中读取）
  const userRegionName = userStore.platformUserInfo?.region?.currentRegionName
  if (userRegionName) {
    const key = findRegionKeyByFullName(userRegionName)
    if (key) {
      console.log('[CreateTask] 设置默认城市为', userRegionName, '→', key)
      rankingRegion.value = [key]
      hourlyRegion.value = [key]
      monitoringRegion.value = key
    }
  }

  // 设置默认地图范围：level 2（区县）→ 区县，level 1（城市）→ 城市，fallback → 省份
  const userRegion = userStore.platformUserInfo?.region as RegionInfo | undefined
  if (userRegion?.currentShortCode) {
    mapScope.value = userRegion.currentShortCode
  } else if (userRegion?.provinceShortCode) {
    mapScope.value = userRegion.provinceShortCode
  }

  // 编辑模式：加载已有任务数据
  if (props.jobId) {
    try {
      const job = await getJob(props.jobId)
      originalJob.value = job
      taskName.value = job.name || ''
      selectedDeliver.value = job.deliver || 'local'
      selectedSkills.value = job.skills || (job.skill ? [job.skill] : [])
      repeat_times.value = jobRepeatToEditValue(job.repeat)
      selectedProvider.value = job.provider || ''
      selectedModel.value = job.model || ''
      schedule.value = scheduleToEditableInput(job.schedule, job.schedule_display || '')
      // 从 prompt 反解析成果清单与自由文本，回显各项任务配置
      hydrateFromPrompt(job.prompt || '')
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
                <div><span class="capability-kicker">01 · 组合任务成果</span>
                  <h2>这次任务需要交付什么？</h2>
                </div>
                <span class="bound-context">关联城市：<b>平顶山市</b></span>
              </div>
              <div class="output-list">
                <article v-for="(output, index) in dutyOutputs" :key="output.id" class="output-item"
                  :class="{ active: activeOutputId === output.id }" @click="selectDutyOutput(output)">
                  <span class="output-index">{{ index + 1 }}</span>
                  <span class="capability-icon" :class="output.type">
                    {{ ({
                      concentrationRanking: '≋', mapPackage: '◇', hourlyBrief: '◷', monitoringData: '▦'
                    }[output.type]) }}
                  </span>
                  <span class="output-item-copy"><b>{{ output.title }}</b><small>{{ outputDefinition(output)
                      }}</small></span>
                  <span v-if="activeOutputId === output.id" class="editing-badge">正在编辑</span>
                  <button class="output-action" title="复制成果" @click.stop="duplicateOutput(output)">复制</button>
                  <button class="output-action danger" title="删除成果" @click.stop="removeOutput(output)">删除</button>
                </article>
              </div>
              <div class="output-add-bar">
                <span>添加成果</span>
                <button @click="addMapOutput"><b>＋</b> 一张图</button>
                <button @click="addRankingOutput"><b>＋</b> 浓度排名</button>
                <button @click="addHourlyOutput"><b>＋</b> 小时播报</button>
                <button @click="addMonitoringOutput"><b>＋</b> 监测数据</button>
              </div>
            </section>

            <section v-if="selectedCapability === 'concentrationRanking' && rankingPresetActive" class="ranking-config">
              <div class="ranking-config-head">
                <div><span>02 · 配置浓度排名</span></div>
              </div>
              <div class="ranking-config-grid">
                <div class="ranking-toolbar">
                  <div class="compact-field"><span>生成成果：</span>
                    <div class="output-checks">
                      <NCheckbox v-model:checked="rankingIncludeScreenshot">排名截图</NCheckbox>
                      <NCheckbox v-model:checked="rankingIncludeAnalysis">数据分析</NCheckbox>
                    </div>
                  </div>
                </div>
                <div v-if="rankingIncludeScreenshot" class="screenshot-options">
                  <div class="compact-field"><span>截图区域：</span>
                    <div class="segmented"><button :class="{ active: rankingScreenshotScope === 'tableOnly' }"
                        @click="rankingScreenshotScope = 'tableOnly'">仅标题和表格</button><button
                        :class="{ active: rankingScreenshotScope === 'withFilters' }"
                        @click="rankingScreenshotScope = 'withFilters'">含查询条件</button></div>
                  </div>
                  <div class="compact-field"><span>截图颜色：</span>
                    <div class="segmented"><button :class="{ active: rankingTheme === 'light' }"
                        @click="rankingTheme = 'light'">浅色</button><button :class="{ active: rankingTheme === 'dark' }"
                        @click="rankingTheme = 'dark'">深色</button></div>
                  </div>
                </div>
                <div class="ranking-toolbar">
                  <div class="compact-field"><span>查询：</span>
                    <div class="segmented query-segment"><button :class="{ active: rankingQueryTarget === 'city' }"
                        @click="rankingQueryTarget = 'city'">城市</button><button
                        :class="{ active: rankingQueryTarget === 'site' }"
                        @click="rankingQueryTarget = 'site'">站点</button></div>
                  </div>
                  <div class="compact-field region-field"><span>行政区：</span>
                    <NTreeSelect v-model:value="rankingRegion" :default-value="rankingRegion" :options="cityRegionTree"
                      :loading="cityTreeLoading" label-field="fullName" key-field="regionKeyVO" multiple
                      placeholder="请选择行政区" />
                  </div>
                  <template v-if="rankingQueryTarget === 'site'">
                    <span>站点：</span>
                    <div class="station-dropdown">
                      <div class="station-dropdown-trigger"
                        @click="rankingStationDropdownOpen = !rankingStationDropdownOpen">
                        <span class="station-dropdown-label">
                          <template v-if="rankingStationTypes.length">{{rankingStationTypes.map(t =>
                            STATION_TYPE_OPTIONS.find(o => o.value === t)?.label || t).join('、')}}</template>
                          <template v-else>站点类型</template>
                        </span>
                        <span v-if="rankingSelectedStations.length" class="station-dropdown-count">{{
                          rankingSelectedStations.length }}</span>
                        <span class="station-dropdown-arrow">▾</span>
                      </div>
                      <transition name="fade">
                        <div v-if="rankingStationDropdownOpen" class="station-dropdown-panel">
                          <div class="station-dropdown-body">
                            <div class="station-dropdown-types">
                              <button v-for="type in STATION_TYPE_OPTIONS" :key="type.value"
                                :class="{ active: rankingStationTypes.includes(type.value) }"
                                @click="toggleRankingStationType(type.value)">{{
                                  type.label }}</button>
                            </div>
                            <div class="station-dropdown-items">
                              <div v-if="rankingStationListLoading" class="station-loading">加载中…</div>
                              <div v-else-if="rankingStationTypes.length === 0" class="station-hint">请先选择站点类型</div>
                              <div v-else-if="rankingStationList.length === 0" class="station-hint">当前行政区下暂无站点</div>
                              <template v-else>
                                <div class="station-all-bar">
                                  <NCheckbox :checked="rankingAllStationsChecked"
                                    @update:checked="toggleRankingAllStations">全部 ({{ rankingStationList.length }})
                                  </NCheckbox>
                                </div>
                                <NCheckboxGroup v-model:value="rankingSelectedStations">
                                  <div class="station-dropdown-list">
                                    <NCheckbox v-for="station in rankingStationList" :key="station.shortCode"
                                      :value="station.shortCode">{{ station.name }}</NCheckbox>
                                  </div>
                                </NCheckboxGroup>
                              </template>
                            </div>
                          </div>
                        </div>
                      </transition>
                    </div>
                  </template>
                </div>
                <div class="ranking-toolbar time-toolbar">
                  <div class="compact-field"><span>时间类型：</span>
                    <div class="segmented period-segment"><button v-for="type in rankingPeriods" :key="type.value"
                        :class="{ active: rankingPeriod === type.value }" @click="setRankingPeriod(type.value)">{{
                          type.label
                        }}</button></div>
                  </div>
                  <span class="latest-hint">任务执行时自动使用官网最新可用时间</span>
                </div>
                <div class="ranking-toolbar factor-toolbar">
                  <div class="compact-field factor-field"><span>污染因子：</span>
                    <NCheckboxGroup v-model:value="rankingFactors">
                      <div class="factor-chips">
                        <NCheckbox v-for="factor in rankingFactorOptionsComputed" :key="factor.value"
                          :value="factor.value">{{
                            factor.label }}</NCheckbox>
                      </div>
                    </NCheckboxGroup>
                  </div>
                </div>
                <div class="ranking-toolbar">
                  <div class="compact-field"><span>国标类型：</span>
                    <div class="segmented"><button :class="{ active: rankingGbKey === '2' }"
                        @click="rankingGbKey = '2'">新</button><button
                        :class="{ active: rankingGbKey === '0' }"
                        @click="rankingGbKey = '0'">默认</button><button
                        :class="{ active: rankingGbKey === '1' }"
                        @click="rankingGbKey = '1'">旧</button></div>
                  </div>
                </div>
              </div>
              <div class="ranking-summary">本次成果：{{ rankingQueryTarget === 'city' ? '城市排名' : '站点排名' }} · {{
                rankingRegionLabel }} · {{ rankingQueryTarget === 'site' && rankingStationTypeLabels.length ? '站点类型：'
                  +
                rankingStationTypeLabels.join('、') : '' }}{{
                  rankingQueryTarget === 'site' && rankingSelectedStationNames.length ? ' · 站点：' +
                    rankingSelectedStationNames.join('、') : '' }} · {{
                  rankingPeriodLabel }} · {{ rankingTimeLabel }} · {{ rankingFactors.map(factorLabelFor).join('、') }} · {{
                  rankingIncludeScreenshot ? '排名截图' : '' }}{{ rankingIncludeScreenshot && rankingIncludeAnalysis ? '、' : '' }}{{ rankingIncludeAnalysis ? '数据分析' : '' }} · 国标类型：{{ { '2': '新', '0': '默', '1': '旧' }[rankingGbKey] || '默' }}</div>
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
              <div class="ranking-config-head">
                <div><span>02 · 配置一张图</span></div>
              </div>
              <div class="ranking-config-grid">
                <div class="ranking-toolbar">
                  <div class="compact-field"><span>生成成果：</span>
                    <div class="output-checks">
                      <NCheckbox :checked="true" disabled>一张图截图</NCheckbox>
                    </div>
                  </div>
                </div>
                <div class="ranking-toolbar">
                  <div class="compact-field"><span>地图范围：</span>
                    <div class="segmented"><button v-for="opt in mapScopeOptions" :key="opt.value"
                        :class="{ active: mapScope === opt.value }" @click="mapScope = opt.value">{{ opt.label
                        }}</button></div>
                  </div>
                  <div class="compact-field"><span>时间类型：</span>
                    <div class="segmented"><button :class="{ active: mapTimeType === 'hourly' }"
                        @click="mapTimeType = 'hourly'">实时</button><button :class="{ active: mapTimeType === 'dt' }"
                        @click="mapTimeType = 'dt'">累计</button><button :class="{ active: mapTimeType === 'daily' }"
                        @click="mapTimeType = 'daily'">日</button></div>
                  </div>
                </div>
                <div class="ranking-toolbar">
                  <div class="compact-field"><span>地图类型：</span>
                    <div class="segmented"><button :class="{ active: mapMode === 'monitoring' }"
                        @click="mapMode = 'monitoring'">监测图</button><button
                        :class="{ active: mapMode === 'interpolation' }" @click="mapMode = 'interpolation'">插值图</button>
                    </div>
                  </div>
                  <div class="compact-field map-factor"><span>因子：</span>
                    <NSelect v-model:value="mapFactor" :options="mapFactorOptions" />
                  </div>
                  <!-- <div class="compact-field map-zoom"><span>缩放等级：</span>
                    <NInputNumber v-model:value="mapZoom" :min="3" :max="16" />
                  </div> -->
                </div>
                <div class="ranking-toolbar">
                  <div class="compact-field"><span>颜色：</span>
                    <div class="segmented"><button :class="{ active: mapTheme === 'light' }"
                        @click="mapTheme = 'light'">浅色</button><button :class="{ active: mapTheme === 'dark' }"
                        @click="mapTheme = 'dark'">深色</button></div>
                  </div>
                  <div class="map-switches">
                    <NCheckbox v-model:checked="mapWindWaves">风/海浪</NCheckbox>
                    <NCheckbox v-model:checked="mapCloseLeftPanel">左侧面板</NCheckbox>
                  </div>
                </div>
                <!-- <div class="ranking-toolbar">
                  <div class="compact-field"><span>截图区域：</span>
                    <div class="segmented"><button :class="{ active: mapScreenshotScope === 'mapOnly' }"
                        @click="mapScreenshotScope = 'mapOnly'">仅地图</button><button
                        :class="{ active: mapScreenshotScope === 'mapLegend' }"
                        @click="mapScreenshotScope = 'mapLegend'">地图和图例</button><button
                        :class="{ active: mapScreenshotScope === 'fullPage' }"
                        @click="mapScreenshotScope = 'fullPage'">完整页面</button></div>
                  </div>
                </div> -->
              </div>
              <div class="ranking-summary">本次一张图：{{ mapScopeLabel }} · {{ mapModeLabel }} · {{ mapFactorLabel }} · 缩放 {{
                mapZoom }}
                · {{ mapTheme === 'light' ? '浅色' : '深色' }} · {{ mapWindWaves ? '开启风/海浪' : '关闭风/海浪' }} · {{
                  mapScreenshotScopeLabel
                }} · {{ mapCloseLeftPanel ? '保留左侧面板' : '关闭左侧面板' }} </div>
            </section>

            <section v-if="selectedCapability === 'hourlyBrief'" class="ranking-config hourly-config">
              <div class="ranking-config-head">
                <div><span>02 · 配置小时播报</span></div>
              </div>
              <div class="ranking-config-grid">
                <div class="ranking-toolbar">
                  <div class="compact-field"><span>生成成果：</span>
                    <div class="output-checks">
                      <NCheckbox v-model:checked="hourlyIncludeScreenshot">播报截图</NCheckbox>
                      <NCheckbox v-model:checked="hourlyIncludeSummary">文字播报</NCheckbox>
                    </div>
                  </div>
                  <span class="latest-hint">任务执行时自动使用官网最新可用时点</span>
                </div>
                <div v-if="hourlyIncludeScreenshot" class="screenshot-options">
                  <div class="compact-field"><span>截图区域：</span>
                    <div class="segmented"><button :class="{ active: hourlyScreenshotScope === 'contentOnly' }"
                        @click="hourlyScreenshotScope = 'contentOnly'">仅播报内容</button><button
                        :class="{ active: hourlyScreenshotScope === 'withFilters' }"
                        @click="hourlyScreenshotScope = 'withFilters'">含查询条件</button></div>
                  </div>
                  <div class="compact-field"><span>截图颜色：</span>
                    <div class="segmented"><button :class="{ active: hourlyTheme === 'light' }"
                        @click="hourlyTheme = 'light'">浅色</button><button :class="{ active: hourlyTheme === 'dark' }"
                        @click="hourlyTheme = 'dark'">深色</button></div>
                  </div>
                </div>
                <div class="ranking-toolbar">
                  <div class="compact-field"><span>查询：</span>
                    <div class="segmented query-segment"><button :class="{ active: hourlyQueryTarget === 'city' }"
                        @click="hourlyQueryTarget = 'city'">城市</button><button
                        :class="{ active: hourlyQueryTarget === 'site' }"
                        @click="hourlyQueryTarget = 'site'">站点</button></div>
                  </div>
                  <div class="compact-field region-field"><span>行政区：</span>
                    <NTreeSelect v-model:value="hourlyRegion" :default-value="hourlyRegion" :options="cityRegionTree"
                      :loading="cityTreeLoading" label-field="fullName" key-field="regionKeyVO" multiple
                      placeholder="请选择行政区" />
                  </div>
                  <template v-if="hourlyQueryTarget === 'site'">
                    <div class="station-dropdown">
                      <div class="station-dropdown-trigger"
                        @click="hourlyStationDropdownOpen = !hourlyStationDropdownOpen">
                        <span class="station-dropdown-label">{{STATION_TYPE_OPTIONS.find(t => t.value ===
                          hourlyStationType)?.label || '站点'}}</span>
                        <span v-if="hourlySelectedStations.length" class="station-dropdown-count">{{
                          hourlySelectedStations.length }}</span>
                        <span class="station-dropdown-arrow">▾</span>
                      </div>
                      <transition name="fade">
                        <div v-if="hourlyStationDropdownOpen" class="station-dropdown-panel">
                          <div class="station-dropdown-body">
                            <div class="station-dropdown-types">
                              <button v-for="type in STATION_TYPE_OPTIONS" :key="type.value"
                                :class="{ active: hourlyStationType === type.value }"
                                @click="hourlyStationType = type.value">{{ type.label }}</button>
                            </div>
                            <div class="station-dropdown-items">
                              <NCheckboxGroup v-model:value="hourlySelectedStations">
                                <div class="station-dropdown-list">
                                  <NCheckbox
                                    v-for="station in (hourlyStationType ? STATION_NAME_OPTIONS[hourlyStationType] : [])"
                                    :key="station.value" :value="station.value">{{ station.label }}</NCheckbox>
                                </div>
                              </NCheckboxGroup>
                            </div>
                          </div>
                        </div>
                      </transition>
                    </div>
                  </template>
                  <div class="compact-field township-field"><span>乡镇：</span>
                    <NSelect v-model:value="hourlyTownship" :options="townshipOptions" />
                  </div>
                </div>
                <div class="ranking-toolbar factor-toolbar">
                  <div class="compact-field factor-field"><span>污染因子：</span>
                    <NCheckboxGroup v-model:value="hourlyFactors">
                      <div class="factor-chips">
                        <NCheckbox v-for="factor in rankingFactorOptions" :key="factor.value" :value="factor.value">{{
                          factor.label
                        }}</NCheckbox>
                      </div>
                    </NCheckboxGroup>
                  </div>
                </div>
                <div class="ranking-toolbar">
                  <div class="compact-field"><span>国标类型：</span>
                    <div class="segmented"><button :class="{ active: hourlyGbKey === '2' }"
                        @click="hourlyGbKey = '2'">新</button><button
                        :class="{ active: hourlyGbKey === '0' }"
                        @click="hourlyGbKey = '0'">默认</button><button
                        :class="{ active: hourlyGbKey === '1' }"
                        @click="hourlyGbKey = '1'">旧</button></div>
                  </div>
                </div>
              </div>
              <div class="ranking-summary">本次成果：{{ hourlyQueryTarget === 'city' ? '城市' : '站点' }} · {{
                regionLabelFor(hourlyRegion.join(',')) }} · {{ townshipLabelFor(hourlyTownship) }} · 官网最新可用时点 · {{
                  hourlyFactors.join('、') }} · {{ hourlyIncludeScreenshot ? '播报截图' : '' }}{{ hourlyIncludeScreenshot &&
                  hourlyIncludeSummary ? '、' : '' }}{{ hourlyIncludeSummary ? '文字播报' : '' }} · 国标类型：{{ { '2': '新', '0': '默', '1': '旧' }[hourlyGbKey] || '默' }}</div>
            </section>

            <section v-if="selectedCapability === 'monitoringData'" class="ranking-config monitoring-config">
              <div class="ranking-config-head">
                <div><span>02 · 配置监测数据</span></div>
              </div>
              <div class="ranking-config-grid">
                <div class="ranking-toolbar">
                  <div class="compact-field"><span>生成成果：</span>
                    <div class="output-checks">
                      <NCheckbox v-model:checked="monitoringIncludeTable">监测数据表</NCheckbox>
                      <NCheckbox v-model:checked="monitoringIncludeScreenshot">数据截图</NCheckbox>
                      <NCheckbox v-model:checked="monitoringIncludeAnalysis">数据分析</NCheckbox>
                    </div>
                  </div>
                  <div v-if="monitoringIncludeScreenshot" class="compact-field"><span>截图颜色：</span>
                    <div class="segmented"><button :class="{ active: monitoringTheme === 'light' }"
                        @click="monitoringTheme = 'light'">浅色</button><button
                        :class="{ active: monitoringTheme === 'dark' }" @click="monitoringTheme = 'dark'">深色</button>
                    </div>
                  </div>
                </div>
                <div class="ranking-toolbar">
                  <div class="compact-field"><span>查询：</span>
                    <div class="segmented query-segment"><button :class="{ active: monitoringQueryTarget === 'city' }"
                        @click="monitoringQueryTarget = 'city'">城市</button><button
                        :class="{ active: monitoringQueryTarget === 'site' }"
                        @click="monitoringQueryTarget = 'site'">站点</button></div>
                  </div>
                  <div class="compact-field region-field"><span>行政区：</span>
                    <NTreeSelect v-model:value="monitoringRegion" :default-value="monitoringRegion"
                      :options="cityRegionTree" :loading="cityTreeLoading" label-field="fullName"
                      key-field="regionKeyVO" placeholder="请选择行政区" />
                  </div>
                  <template v-if="monitoringQueryTarget === 'site'">
                    <div class="station-dropdown">
                      <div class="station-dropdown-trigger"
                        @click="monitoringStationDropdownOpen = !monitoringStationDropdownOpen">
                        <span class="station-dropdown-label">{{STATION_TYPE_OPTIONS.find(t => t.value ===
                          monitoringStationType)?.label || '站点'}}</span>
                        <span v-if="monitoringSelectedStations.length" class="station-dropdown-count">{{
                          monitoringSelectedStations.length }}</span>
                        <span class="station-dropdown-arrow">▾</span>
                      </div>
                      <transition name="fade">
                        <div v-if="monitoringStationDropdownOpen" class="station-dropdown-panel">
                          <div class="station-dropdown-body">
                            <div class="station-dropdown-types">
                              <button v-for="type in STATION_TYPE_OPTIONS" :key="type.value"
                                :class="{ active: monitoringStationType === type.value }"
                                @click="monitoringStationType = type.value">{{ type.label }}</button>
                            </div>
                            <div class="station-dropdown-items">
                              <NCheckboxGroup v-model:value="monitoringSelectedStations">
                                <div class="station-dropdown-list">
                                  <NCheckbox
                                    v-for="station in (monitoringStationType ? STATION_NAME_OPTIONS[monitoringStationType] : [])"
                                    :key="station.value" :value="station.value">{{ station.label }}</NCheckbox>
                                </div>
                              </NCheckboxGroup>
                            </div>
                          </div>
                        </div>
                      </transition>
                    </div>
                  </template>
                  <div class="compact-field township-field"><span>乡镇：</span>
                    <NSelect v-model:value="monitoringTownship" :options="townshipOptions" />
                  </div>
                </div>
                <div class="ranking-toolbar factor-toolbar">
                  <div class="compact-field factor-field"><span>污染因子：</span>
                    <NCheckboxGroup v-model:value="monitoringFactors">
                      <div class="factor-chips">
                        <NCheckbox v-for="factor in rankingFactorOptions" :key="factor.value" :value="factor.value">{{
                          factor.label
                        }}</NCheckbox>
                      </div>
                    </NCheckboxGroup>
                  </div>
                </div>
                <div class="ranking-toolbar">
                  <div class="compact-field"><span>国标类型：</span>
                    <div class="segmented"><button :class="{ active: monitoringGbKey === '2' }"
                        @click="monitoringGbKey = '2'">新</button><button
                        :class="{ active: monitoringGbKey === '0' }"
                        @click="monitoringGbKey = '0'">默认</button><button
                        :class="{ active: monitoringGbKey === '1' }"
                        @click="monitoringGbKey = '1'">旧</button></div>
                  </div>
                </div>
                <div class="ranking-toolbar">
                  <div class="compact-field"><span>时间：</span>
                    <div class="segmented period-segment"><button v-for="item in monitoringPeriodOptions"
                        :key="item.value" :class="{ active: monitoringPeriod === item.value }"
                        @click="monitoringPeriod = item.value">{{ item.label
                        }}</button></div>
                  </div>
                  <span v-if="monitoringPeriod !== 'other'" class="latest-hint">任务执行时自动使用官网最新可用时间</span>
                </div>
                <div v-if="monitoringPeriod === 'other'" class="ranking-toolbar">
                  <div class="compact-field custom-range-field"><span>时间范围：</span>
                    <NInput v-model:value="monitoringCustomRange"
                      placeholder="例如：2026-07-16 01:00 - 2026-07-16 14:00" />
                  </div>
                </div>
              </div>
              <div class="ranking-summary">本次成果：{{ monitoringQueryTarget === 'city' ? '城市' : '站点' }} · {{
                regionLabelFor(monitoringRegion) }} · {{ townshipLabelFor(monitoringTownship) }} · {{ monitoringPeriod
                  === 'other'
                  ? (monitoringCustomRange || '自定义时间范围') : `官网最新${monitoringPeriodLabelFor(monitoringPeriod)}数据` }} · {{
                  monitoringFactors.join('、') }} · {{ monitoringIncludeTable ? '监测数据表' : '' }}{{
                  monitoringIncludeScreenshot ? '、数据截图'
                    : '' }}{{ monitoringIncludeAnalysis ? '、数据分析' : '' }} · 国标类型：{{ { '2': '新', '0': '默', '1': '旧' }[monitoringGbKey] || '默' }}</div>
            </section>
          </div>
        </div>

        <!-- ====== 步骤3: 执行设置 ====== -->
        <div v-show="currentStep === 2" class="step-panel">
          <div class="form-section">
            <section class="delivery-intro"><span>03 · 设置交付</span>
              <h2>什么时候运行，发送给谁？</h2>
            </section>
            <div class="form-group">
              <label class="form-label">运行时间 <span class="required-mark">*</span></label>
              <SchedulePicker v-model="schedule" />
            </div>

            <div class="form-group">
              <label class="form-label">成果发送到 <span class="required-mark">*</span></label>
              <NSelect
                v-model:value="selectedDeliver"
                :options="deliverOptions"
                :loading="deliveryTargetsLoading"
                filterable
                placeholder="选择推送目标"
              />
              <div v-if="deliveryTargets.length === 0 && !deliveryTargetsLoading" class="chip-config-hint">
                <span class="hint-text">尚未发现可用推送目标，请先在对应平台发起一次对话，</span>
                <a class="hint-link" @click="goToChannels">前往配置 →</a>
              </div>
              <div v-else class="chip-config-hint">
                <span class="hint-text">需要更多接收渠道？</span>
                <a class="hint-link" @click="goToChannels">前往配置 →</a>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">运行模型（可选）</label>
              <div class="model-select-row">
                <NSelect
                  :value="selectedProvider"
                  :options="providerOptions"
                  placeholder="Provider（默认跟随全局）"
                  @update:value="handleProviderChange"
                />
                <NSelect
                  v-model:value="selectedModel"
                  :options="modelOptions"
                  filterable
                  placeholder="模型（默认）"
                  :disabled="!selectedProvider"
                />
              </div>
              <div class="chip-config-hint">
                <span class="hint-text">不选则使用全局默认模型。</span>
              </div>
            </div>

            <div class="delivery-note"><b>本次任务将交付 {{ dutyOutputs.length }} 项成果</b><span
                v-for="(label, index) in allOutputLabels" :key="index">{{ index + 1 }}. {{ label }}</span></div>
          </div>
        </div>

        <!-- ====== 步骤4: 确认 ====== -->
        <div v-show="currentStep === 3" class="step-panel">
          <div class="preview-box">
            <div class="confirm-hero"><span>✓</span>
              <div><b>请确认这份值守安排</b></div>
            </div>
            <div class="preview-section">
              <div class="preview-label">任务名称</div>
              <div class="preview-line"><strong>{{ taskName || '未命名任务' }}</strong></div>
            </div>

            <div class="preview-section">
              <div class="preview-label">成果清单（{{ dutyOutputs.length }} 项）</div>
              <div class="confirm-output-list">
                <div v-for="(label, index) in allOutputLabels" :key="index"><span>{{ index + 1 }}</span><strong>{{ label
                    }}</strong></div>
              </div>
            </div>

            <div class="preview-section">
              <div class="preview-label">运行与发送</div>
              <div class="preview-line">
                <strong>频率：</strong>{{ scheduleDescription }}
                <span v-if="deliverDisplayName"> · <strong>推送至：</strong>{{ deliverDisplayName }}</span>
              </div>
            </div>

            <div class="preview-section">
              <div class="preview-label">系统将自动完成</div>
              <div class="simple-run-plan"><span>获取发布数据</span><i>→</i><span>依次生成 {{ dutyOutputs.length }}
                  项成果</span><i>→</i><span>统一发送给值守人员</span></div>
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

.model-select-row {
  display: flex;
  gap: 8px;

  > * {
    flex: 1;
  }
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

.duty-preset.active {
  border-color: #2e9bed;
  box-shadow: 0 0 0 3px rgba(46, 155, 237, .12);
}

.duty-preset-icon {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 11px;
  color: #fff;
  background: linear-gradient(135deg, #1b94ec, #1768c4);
  font-size: 26px;
  font-weight: 700;
}

.duty-preset-copy {
  min-width: 0;
  flex: 1;
}

.duty-preset-title {
  color: $text-primary;
  font-size: 15px;
  font-weight: 700;
}

.duty-preset-title span {
  margin-left: 7px;
  padding: 2px 6px;
  border-radius: 4px;
  color: #1973bc;
  background: #dcefff;
  font-size: 10px;
  font-weight: 600;
}

.duty-preset-copy p {
  margin: 6px 0 8px;
  color: $text-secondary;
  font-size: 12px;
  line-height: 1.5;
}

.duty-preset-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.duty-preset-tags i {
  padding: 2px 6px;
  border: 1px solid #d7e4ee;
  border-radius: 99px;
  color: #547189;
  background: #fff;
  font-size: 10px;
  font-style: normal;
}

.capability-section {
  padding: 20px;
  border: 1px solid #dce7ef;
  border-radius: 14px;
  background: linear-gradient(135deg, #fbfdff, #f2f9ff);
}

.capability-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 15px;
}

.capability-kicker {
  color: #1985d2;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .7px;
}

.capability-heading h2 {
  margin: 3px 0 4px;
  color: $text-primary;
  font-size: 19px;
}

.capability-heading p {
  margin: 0;
  color: $text-secondary;
  font-size: 12px;
}

.bound-context {
  padding: 7px 9px;
  border: 1px solid #cfe5f6;
  border-radius: 6px;
  background: #fff;
  color: #71869a;
  font-size: 11px;
  white-space: nowrap;
}

.bound-context b {
  color: #287ab4;
}

.capability-grid {
  display: grid;
  grid-template-columns: 1.25fr 1fr 1fr;
  gap: 9px;
}

.capability-card {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 12px;
  border: 1px solid #dce6ee;
  border-radius: 9px;
  background: #fff;
  text-align: left;
  cursor: pointer;
}

.capability-card.active {
  border-color: #2b97e8;
  background: #edf8ff;
  box-shadow: 0 0 0 2px rgba(43, 151, 232, .1);
}

.capability-card:disabled {
  cursor: not-allowed;
  opacity: .58;
}

.capability-icon {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  flex: 0 0 auto;
  color: #fff;
  background: linear-gradient(135deg, #1c98eb, #176ac2);
  font-size: 18px;
  font-weight: 800;
}

.capability-icon.muted {
  background: #aebdca;
}

.capability-copy {
  min-width: 0;
  flex: 1;
}

.capability-copy b,
.capability-copy small {
  display: block;
}

.capability-copy b {
  color: $text-primary;
  font-size: 12px;
}

.capability-copy small {
  margin-top: 3px;
  color: $text-muted;
  font-size: 10px;
  line-height: 1.3;
}

.chosen,
.soon {
  font-size: 10px;
  white-space: nowrap;
}

.chosen {
  color: #1685d2;
}

.soon {
  color: $text-muted;
}

.capability-icon.mapPackage {
  background: linear-gradient(135deg, #19a878, #087b64);
}

.capability-icon.hourlyBrief {
  background: linear-gradient(135deg, #d69223, #ad6011);
}

.capability-icon.monitoringData {
  background: linear-gradient(135deg, #6277dc, #3548a5);
}

.map-config {
  border-color: #bfe3d6;
}

.map-config .ranking-config-head {
  background: #eefaf6;
  border-color: #d4eee5;
}

.map-config .ranking-config-head span {
  color: #14785d;
}

.hourly-config {
  border-color: #f0d5a6;
}

.hourly-config .ranking-config-head {
  background: #fff8e9;
  border-color: #f4e0bc;
}

.hourly-config .ranking-config-head span {
  color: #a56716;
}

.monitoring-config {
  border-color: #cbd5fa;
}

.monitoring-config .ranking-config-head {
  background: #f1f4ff;
  border-color: #dce3fb;
}

.monitoring-config .ranking-config-head span {
  color: #4b5fbb;
}

.map-factor {
  flex: 1 1 200px;
}

.map-factor :deep(.n-select) {
  width: 180px;
}

.map-zoom :deep(.n-input-number) {
  width: 92px;
}

.map-switches,
.output-checks {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.map-marker-row {
  min-height: 30px;
  display: flex;
  align-items: center;
  padding: 8px 10px;
  border-radius: 6px;
  color: #4c7869;
  background: #f1f9f6;
  font-size: 12px;
}

.output-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.output-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 10px 11px;
  border: 1px solid #dce6ee;
  border-radius: 9px;
  background: #fff;
  cursor: pointer;
  transition: .15s ease;
}

.output-item:hover {
  border-color: #a9cce7;
}

.output-item.active {
  border-color: #2b97e8;
  background: #edf8ff;
  box-shadow: 0 0 0 2px rgba(43, 151, 232, .1);
}

.output-index {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  border-radius: 50%;
  color: #668195;
  background: #edf2f6;
  font-size: 10px;
  font-weight: 700;
}

.output-item.active .output-index {
  color: #fff;
  background: #218fe0;
}

.output-item-copy {
  min-width: 0;
  flex: 1;
}

.output-item-copy b,
.output-item-copy small {
  display: block;
}

.output-item-copy b {
  color: $text-primary;
  font-size: 12px;
}

.output-item-copy small {
  margin-top: 3px;
  overflow: hidden;
  color: $text-muted;
  font-size: 10px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.editing-badge {
  flex: 0 0 auto;
  padding: 2px 6px;
  border-radius: 99px;
  color: #1879bd;
  background: #dff1ff;
  font-size: 9px;
}

.output-action {
  flex: 0 0 auto;
  padding: 4px 6px;
  border: 0;
  border-radius: 4px;
  color: #678093;
  background: transparent;
  cursor: pointer;
  font-size: 10px;
}

.output-action:hover {
  background: #e9f1f6;
}

.output-action.danger:hover {
  color: #bd4545;
  background: #fff0f0;
}

.output-add-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #d7e3ec;
}

.output-add-bar>span {
  margin-right: 3px;
  color: $text-secondary;
  font-size: 11px;
  font-weight: 650;
}

.output-add-bar button {
  height: 30px;
  padding: 0 11px;
  border: 1px solid #bdd8eb;
  border-radius: 6px;
  color: #2676ad;
  background: #fff;
  cursor: pointer;
  font-size: 11px;
}

.output-add-bar button:hover {
  border-color: #2996df;
  background: #edf8ff;
}

.output-add-bar button b {
  font-size: 14px;
}

.confirm-output-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.confirm-output-list>div {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 9px 10px;
  border: 1px solid #e0e9ef;
  border-radius: 7px;
  background: #f9fbfc;
}

.confirm-output-list span {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  border-radius: 50%;
  color: #fff;
  background: #278ed5;
  font-size: 10px;
}

.confirm-output-list strong {
  color: $text-secondary;
  font-size: 11px;
  font-weight: 550;
  line-height: 1.55;
}

.ranking-config {
  margin-top: -8px;
  border: 1px solid #c7e2f8;
  border-radius: 12px;
  overflow: hidden;
  background: #fbfdff;
}

.ranking-config-head {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 16px;
  background: #eef8ff;
  border-bottom: 1px solid #d8ebfa;
}

.ranking-config-head span,
.ranking-config-head small {
  display: block;
}

.ranking-config-head span {
  color: #1a6fad;
  font-weight: 700;
  font-size: 13px;
}

.ranking-config-head small {
  color: #6c879c;
  margin-top: 3px;
  font-size: 11px;
}

.ranking-config-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px;
}

.ranking-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex-wrap: wrap;
}

.compact-field {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 7px;
}

.compact-field>span {
  flex: 0 0 auto;
  color: $text-primary;
  font-size: 12px;
  font-weight: 650;
}

.region-field {
  flex: 1 1 250px;
  max-width: 420px;
}

.region-field :deep(.n-tree-select) {
  min-width: 220px;
  width: 100%;
}

.township-field {
  flex: 1 1 210px;
  max-width: 300px;
}

.township-field :deep(.n-select) {
  width: 100%;
}

.custom-range-field {
  flex: 1 1 480px;
}

.custom-range-field :deep(.n-input) {
  width: min(100%, 440px);
}

.factor-toolbar {
  width: 100%;
}

.factor-field {
  flex: 1 1 auto;
}

.factor-chips {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
}

.factor-chips :deep(.n-checkbox) {
  margin-right: 0;
  white-space: nowrap;
}

.segmented {
  display: flex;
  overflow: hidden;
  border: 1px solid #d6e2ea;
  border-radius: 5px;
  background: #fff;
}

.segmented button {
  min-width: 52px;
  height: 31px;
  padding: 0 10px;
  border: 0;
  border-left: 1px solid #d6e2ea;
  background: #fff;
  color: #5d7588;
  cursor: pointer;
  font-size: 12px;
}

.segmented button:first-child {
  border-left: 0;
}

.segmented button.active {
  color: #146fb5;
  background: #dff2ff;
  font-weight: 700;
}

.query-segment button {
  flex: 0 0 76px;
  width: 76px;
  padding: 0;
}

.period-segment button {
  min-width: 44px;
}

.time-toolbar {
  padding-top: 1px;
}

.latest-hint {
  color: #7b93a5;
  font-size: 11px;
}

.ranking-time-input {
  width: 210px;
}

.ranking-time-range {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #7690a3;
  font-size: 12px;
}

.ranking-time-range :deep(.n-input) {
  width: 155px;
}

.ranking-field {
  min-width: 0;
}

.ranking-field.wide {
  width: 100%;
}

.ranking-field label {
  display: block;
  color: $text-primary;
  font-size: 12px;
  font-weight: 650;
  margin-bottom: 8px;
}

.output-choice {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-top: 2px;
}

.output-choice label {
  margin: 0;
}

.output-choice>div {
  display: flex;
  gap: 20px;
}

.screenshot-options {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
  padding-top: 1px;
}

.screenshot-options .segmented button {
  min-width: auto;
}

.ranking-summary {
  margin: 0 16px 16px;
  padding: 10px 12px;
  color: #356b90;
  background: #edf7ff;
  border-left: 3px solid #2496e8;
  font-size: 12px;
  line-height: 1.55;
}

.effect-preview {
  margin: 0 16px 16px;
  overflow: hidden;
  border: 1px solid #d9e5ed;
  border-radius: 9px;
  background: #fff;
  box-shadow: 0 4px 14px rgba(31, 77, 108, .06);
}

.effect-preview figcaption {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 12px;
  border-bottom: 1px solid #e7eef3;
  color: $text-primary;
  background: #f8fafc;
  font-size: 12px;
  font-weight: 700;
}

.effect-preview figcaption em {
  padding: 2px 7px;
  border-radius: 99px;
  color: #648095;
  background: #e8eef3;
  font-size: 9px;
  font-style: normal;
  font-weight: 600;
}

.effect-preview-image {
  width: 100%;
  overflow-x: auto;
  background: #edf1f4;
}

.effect-preview-image img {
  display: block;
  width: 100%;
  height: auto;
  min-width: 620px;
}

.ranking-time-picker {
  width: 210px;
}

// ===== 站点选择器（下拉样式） =====
.station-dropdown {
  position: relative;
  flex: 1 1 auto;
  min-width: 220px;
  max-width: 420px;
}

.station-dropdown-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  height: 31px;
  padding: 0 10px;
  border: 1px solid #d6e2ea;
  border-radius: 5px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
  color: $text-primary;
  transition: all 0.15s;
}

.station-dropdown-trigger:hover {
  border-color: #bdd8eb;
}

.station-dropdown-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.station-dropdown-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 5px;
  border-radius: 8px;
  background: var(--accent-primary);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  flex-shrink: 0;
}

.station-dropdown-arrow {
  color: #9aaab5;
  font-size: 10px;
  flex-shrink: 0;
}

.station-dropdown-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  width: 360px;
  max-height: 320px;
  border: 1px solid #d6e2ea;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 4px 16px rgba(31, 77, 108, 0.1);
  z-index: 50;
  display: flex;
  overflow: hidden;
}

.station-dropdown-body {
  display: flex;
  width: 100%;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.station-dropdown-types {
  width: 84px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px;
  border-right: 1px solid #e8eef3;
  overflow-y: auto;
  background: #f8fafc;
}

.station-dropdown-types button {
  height: 26px;
  padding: 0 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #5d7588;
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  transition: all 0.15s;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.station-dropdown-types button:hover {
  background: #edf1f6;
}

.station-dropdown-types button.active {
  background: #dff2ff;
  color: #146fb5;
  font-weight: 700;
}

.station-dropdown-items {
  flex: 1;
  min-width: 0;
  padding: 6px;
  overflow-y: auto;
}

.station-dropdown-list {
  display: flex;
  flex-direction: column;
}

.station-dropdown-list :deep(.n-checkbox) {
  margin-right: 0;
  white-space: nowrap;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
}

// 站点分组
.station-group {
  margin-top: 6px;
}

.station-group-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-primary);
  padding: 0 2px 2px;
}

.station-loading,
.station-hint {
  padding: 12px;
  text-align: center;
  color: $text-muted;
  font-size: 12px;
}

// 下拉面板淡入淡出动画
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.task-identity {
  padding: 2px 2px 0;
}

.task-identity label {
  display: block;
  margin-bottom: 8px;
  color: $text-primary;
  font-size: 12px;
  font-weight: 650;
}

.delivery-intro {
  padding: 3px 0 2px;
}

.delivery-intro span {
  color: #1985d2;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .7px;
}

.delivery-intro h2 {
  margin: 4px 0;
  color: $text-primary;
  font-size: 19px;
}

.delivery-intro p {
  margin: 0;
  color: $text-secondary;
  font-size: 12px;
}

.delivery-note {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 13px;
  border: 1px solid #d6eaf9;
  border-radius: 8px;
  color: #4b7593;
  background: #f1f9ff;
  font-size: 12px;
}

.delivery-note b {
  color: #2575ae;
}

.confirm-hero {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-bottom: 16px;
  padding: 14px;
  border-radius: 9px;
  color: #226d42;
  background: #eefaf2;
  border: 1px solid #c7ebd3;
}

.confirm-hero>span {
  display: grid;
  place-items: center;
  width: 25px;
  height: 25px;
  color: #fff;
  background: #34a853;
  border-radius: 50%;
  font-weight: 800;
}

.confirm-hero b,
.confirm-hero small {
  display: block;
}

.confirm-hero b {
  font-size: 13px;
}

.confirm-hero small {
  margin-top: 3px;
  color: #5f856f;
  font-size: 11px;
}

.simple-run-plan {
  display: flex;
  align-items: center;
  gap: 9px;
  flex-wrap: wrap;
  color: #367396;
  font-size: 12px;
}

.simple-run-plan span {
  padding: 5px 8px;
  background: #eef7fc;
  border-radius: 5px;
}

.simple-run-plan i {
  color: #7da8c3;
  font-style: normal;
}

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

    .confirm-output-list>div,
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
