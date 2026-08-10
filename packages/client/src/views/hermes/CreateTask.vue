<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useJobsStore } from '@/stores/hermes/jobs'
import { NCheckbox, NInputNumber, NSelect, NTreeSelect, useMessage } from 'naive-ui'
import { getJob, scheduleToEditableInput } from '@/api/hermes/jobs'
import { fetchCityRegionTree, type RegionTreeNode } from '@/api/hermes/city-tree'
import { useUserStore } from '@/stores/hermes/user'
import { useAppStore } from '@/stores/hermes/app'
import type { Job } from '@/api/hermes/jobs'
import { fetchSkills, type SkillInfo } from '@/api/hermes/skills'
import { getTemplate } from '@/data/templates'
import { getCapSkill, MAPAIRS_CAPS } from '@/data/capabilities'

const route = useRoute()
const router = useRouter()
const jobsStore = useJobsStore()
const message = useMessage()
const userStore = useUserStore()
const appStore = useAppStore()

const step = ref(1)
const taskName = ref('')
const prompt = ref('')
const schedule = ref('0 9 * * *')
const pushChannels = ref<string[]>([])
const deliver = ref('local')
const savePath = ref('')
const selectedProvider = ref('')
const selectedModel = ref('')
const selectedConnectors = ref<string[]>([])
const realSkills = ref<SkillInfo[]>([])
const isEdit = ref(false)
const editJobId = ref<string | null>(null)
const originInfo = ref<{ type: string; title: string; detail: string } | null>(null)

interface SelectedItem { id: string; name: string; kind: 'config' | 'direct' | 'mcp' }
const selectedItems = ref<SelectedItem[]>([])
const activeConfigId = ref<string | null>(null)
const skillConfig = ref<Record<string, Record<string, string>>>({})

const defaultRegion = computed(() => userStore.platformUserInfo?.region?.currentShortCode || '')

// Init config from selected items
watch(selectedItems, (items) => {
  items.filter(s => s.kind === 'config').forEach(s => {
    if (!skillConfig.value[s.id]) {
      skillConfig.value[s.id] = {}
      getCapSkill(s.id)?.params?.forEach(p => {
        skillConfig.value[s.id][p.name] = (p.name === '行政区' && defaultRegion.value) ? defaultRegion.value : (p.default || '')
      })
    }
  })
}, { deep: true, immediate: true })

// Model options
const providerOptions = computed(() => [
  { label: '默认（跟随全局设置）', value: '' },
  ...appStore.modelGroups.filter(g => g.models.length > 0).map(g => ({ label: g.label || g.provider, value: g.provider })),
])
const modelOptions = computed(() => {
  const p = selectedProvider.value
  if (!p) return [{ label: '默认模型', value: '' }]
  const group = appStore.modelGroups.find(g => g.provider === p)
  return (group?.models || []).map(m => ({ label: appStore.displayModelName(m, p), value: m }))
})

function goToChannels() { router.push({ name: 'hermes.channels' }) }
async function browseSavePath() { message.info('文件夹浏览功能暂未开放') }

// Save as template state
const satChecked = ref(false); const satExpanded = ref(false)
const satName = ref(''); const satGroup = ref('我的模板')
const satDesc = ref(''); const satTags = ref('')
function saveAsTemplate() {
  message.success('模板保存功能开发中')
}

const configItems = computed(() => selectedItems.value.filter(s => s.kind === 'config'))
const directItems = computed(() => selectedItems.value.filter(s => s.kind === 'direct'))
const configCount = computed(() => configItems.value.length)
const directCount = computed(() => directItems.value.length)

const activeConfig = computed(() => {
  const id = activeConfigId.value
  if (!id) return selectedItems.value.find(s => s.kind === 'config')
  return selectedItems.value.find(s => s.id === id && s.kind === 'config') || null
})

// City tree
const cityTree = ref<RegionTreeNode[]>([]); const treeLoading = ref(false)

// Capability configs (from task.vue)
const rankingRegion = ref<string[]>(defaultRegion.value?[defaultRegion.value]:[]); const rankingQueryTarget = ref<'city'|'site'>('city')
const rankingPeriod = ref('hourly'); const rankingFactors = ref(['PM2.5','PM10','SO2','NO2','CO','O3','AQI'])
const rankingTheme = ref<'light'|'dark'>('light'); const rankingGbKey = ref<'2'|'0'|'1'>('0')
const RANKING_FACTORS_BY_PERIOD: Record<string,string[]>={hourly:['PM2.5','PM10','SO2','NO2','CO','O3','AQI'],daily_count:['PM2.5','PM10','SO2','NO2','CO','O3_8H','AQI'],daily:['PM2.5','PM10','SO2','NO2','CO','O3_8H','AQI'],month:['PM2.5','PM10','SO2','NO2','CO','O3_8H'],year:['PM2.5','PM10','SO2','NO2','CO','O3_8H']}
const rankingFactorOpts=[{value:'PM2.5',label:'PM₂.₅'},{value:'PM10',label:'PM₁₀'},{value:'SO2',label:'SO₂'},{value:'NO2',label:'NO₂'},{value:'CO',label:'CO'},{value:'O3',label:'O₃'},{value:'O3_8H',label:'O₃-8h'},{value:'AQI',label:'AQI'}]
watch(rankingPeriod,p=>{rankingFactors.value=[...(RANKING_FACTORS_BY_PERIOD[p]||['AQI'])]})
const rankingPeriods=[{label:'实时',value:'hourly'},{label:'日累计',value:'daily_count'},{label:'日',value:'daily'},{label:'月',value:'month'},{label:'年',value:'year'}]
function factorLabel(f:string){return rankingFactorOpts.find(x=>x.value===f)?.label||f}

// Map config
const mapTheme=ref<'light'|'dark'>('light');const mapWindWaves=ref(true);const mapCategory=ref<'initial'|'starground'>('initial')
const mapMode=ref<'monitoring'|'interpolation'>('monitoring');const mapScope=ref('national');const mapTimeType=ref('hourly')
const mapMonitorFactor=ref('PM2.5');const mapMonitorLayer=ref('');const mapInterpolationLayer=ref('')
const mapZoomLevel=ref<'site'|'city'|'custom'>('city');const mapZoomCustom=ref(6)
const mapLeftPanel=ref(false);const mapLeftPanelZone=ref('city')
const mapStarFactor=ref('PM2.5');const mapStarTimeType=ref('hourly')
const mapPollutionOpts=[{value:'primaryPollutant',label:'首要污染物'},{value:'PM2.5',label:'PM₂.₅'},{value:'PM10',label:'PM₁₀'},{value:'SO2',label:'SO₂'},{value:'NO2',label:'NO₂'},{value:'CO',label:'CO'},{value:'O3',label:'O₃'}]
const mapEnvLayerOpts=[{value:'',label:'默认'},{value:'wind',label:'风'},{value:'temperature',label:'温度'},{value:'humidity',label:'相对湿度'},{value:'rainfall',label:'降雨'},{value:'radiation',label:'辐射'},{value:'pressure',label:'气压'},{value:'visibility',label:'能见度'}]
const mapInterpolationLayerOpts=computed(()=>[...mapPollutionOpts.filter(f=>f.value!=='primaryPollutant'),...mapEnvLayerOpts])
const mapZoomOpts=[{value:'site',label:'站点层级'},{value:'city',label:'城市层级'},{value:'custom',label:'自定义'}] as const
const mapLeftPanelZoneOpts=[{value:'city',label:'城市'},{value:'site',label:'站点'},{value:'pollutionSource',label:'污染源'}]
const mapScopeOpts=computed(()=>[{value:'national',label:'全国'}])

// Hourly config
const hourlyRegion=ref<string[]>(defaultRegion.value?[defaultRegion.value]:[]);const hourlyQueryTarget=ref<'city'|'site'>('city');const hourlyTownship=ref('all')
const hourlyFactors=ref(['AQI','PM₂.₅','O₃']);const hourlyTheme=ref<'light'|'dark'>('light');const hourlyGbKey=ref<'2'|'0'|'1'>('0')
const tshipOpts=[{label:'全部乡镇',value:'all'},{label:'新华区',value:'xinhua'},{label:'卫东区',value:'weidong'}]

// Monitoring config
const monitoringRegion=ref<string[]>(defaultRegion.value?[defaultRegion.value]:[]);const monitoringQueryTarget=ref<'city'|'site'>('city');const monitoringTownship=ref('all')
const monitoringPeriod=ref<'hour_avg'|'hour'|'daily'|'daily_count'|'other'>('hour')
const monitoringFactors=ref(['AQI','PM₂.₅','O₃']);const monitoringTheme=ref<'light'|'dark'>('light');const monitoringGbKey=ref<'2'|'0'|'1'>('0')
const monitoringPerOpts = [{label:'小时均值',value:'hour_avg'},{label:'小时',value:'hour'},{label:'日累计',value:'daily_count'}] as const

// Screenshot type options (common for ranking / hourly / monitoring)
const rankingScreenshotTypes=ref<string[]>(['page'])
const hourlyScreenshotTypes=ref<string[]>(['page'])
const monitoringScreenshotTypes=ref<string[]>(['page'])

onMounted(async () => {
  try { const sd = await fetchSkills(); realSkills.value = sd.categories.flatMap(c => c.skills) } catch { /* */ }
  try { const r = await fetchCityRegionTree(userStore.v5Token); cityTree.value = r.tree } catch { /* */ }
  try { appStore.loadModels() } catch { /* */ }
  try {
    const q = route.query
    const editId = q.edit as string
    if (editId) {
      isEdit.value = true
      editJobId.value = editId
      try {
        const job: Job = await getJob(editId)
        taskName.value = job.name || ''
        const cron = scheduleToEditableInput(job.schedule, job.schedule_display || '')
        schedule.value = cron
        prompt.value = job.prompt || ''
        deliver.value = job.deliver || ''

        // Restore schedule UI state from cron
        applyCronToUi(cron)

        // Restore push channels from deliver
        restorePushChannels(job.deliver || 'local')

        // Restore skill chips from job.skills or prompt parsing
        const skillIds = job.skills || []
        skillIds.forEach((sid: string) => {
          const cap = getCapSkill(sid)
          if (cap) selectedItems.value.push({ id: sid, name: cap.name, kind: 'config' })
          else selectedItems.value.push({ id: sid, name: sid, kind: 'direct' })
        })
        // Restore skillConfig from prompt manifest JSON
        hydrateConfigFromPrompt(job.prompt || '')
        originInfo.value = { type:'edit', title:'正在编辑已有任务', detail:'以下为当前任务配置，可直接修改后保存' }
      } catch { message.error('加载任务失败') }
      return
    }
    if (q.from === 'picker') {
      if (q.caps) {
        const ids = (q.caps as string).split(',').filter(Boolean)
        const names = (q.cap_names as string)?.split('|') || ids
        ids.forEach((id, i) => selectedItems.value.push({ id, name: names[i] || id, kind: 'config' }))
      }
      if (q.skills) {
        const ids = (q.skills as string).split(',').filter(Boolean)
        const names = (q.skill_names as string)?.split('|') || ids
        ids.forEach((id, i) => selectedItems.value.push({ id, name: names[i] || id, kind: 'direct' }))
      }
      if (q.mcps) selectedConnectors.value = (q.mcps as string).split(',').filter(Boolean)
      originInfo.value = { type: 'picker', title: '已按所选内容预填', detail: '来自选择器，可在下方继续调整或增删项' }
    }
    if (q.from === 'chat' && q.prompt) prompt.value = decodeURIComponent(q.prompt as string)
    if (q.from && q.from !== 'picker' && q.from !== 'chat') {
      const tpl = getTemplate(q.from as string)
      if (tpl) {
        taskName.value = tpl.name
        prompt.value = tpl.desc
        const cronMap: Record<string, string> = { '每天 09:00':'0 9 * * *','每小时':'0 * * * *','每月 1 日 10:00':'0 10 1 * *','每周一 18:00':'0 18 * * 1','工作日 07:30 / 18:00':'30 7,18 * * 1-5','每天 09:30':'30 9 * * *' }
        schedule.value = cronMap[tpl.schedule] || '0 9 * * *'
        const m: Record<string,string> = {'企业微信':'企业微信','钉钉':'钉钉','飞书':'飞书','邮件':'邮件','本地':'本地'}
        pushChannels.value = tpl.deliver.split(' + ').flatMap(d => m[d.trim()] ? [m[d.trim()]] : [])
        deliver.value = pushChannels.value[0] || 'local'
        tpl.capIds.forEach((cid, i) => selectedItems.value.push({ id: cid, name: tpl.caps[i] || cid, kind: 'config' }))
        originInfo.value = { type:'tpl', title:'已基于模板预填', detail:`模板名：${tpl.name}，共预填 ${tpl.capIds.length} 项技能` }
      }
    }
  } catch { /* */ }
  if (selectedItems.value.length) activeConfigId.value = selectedItems.value[0].id
})

function goStep(n: number) { step.value = n; window.scrollTo(0,0) }
function handleBack() { router.push({ name: 'hermes.duty' }) }
function goPicker(tab: string) { router.push({ name: 'hermes.dutyPicker', hash: '#tab=' + tab }) }
function removeItem(id: string) { selectedItems.value = selectedItems.value.filter(s => s.id !== id); if (activeConfigId.value === id) activeConfigId.value = selectedItems.value.find(s => s.kind === 'config')?.id || null }
function selectConfig(id: string) { activeConfigId.value = id }

// ---- Skill modal ----
const showSkillModal = ref(false)
const skillModalTab = ref<'all' | 'config' | 'direct'>('all')
const skillModalSearch = ref('')
const skillModalPicked = ref(new Set<string>())
interface ModalSkill { id: string; name: string; kind: 'config' | 'direct'; desc: string; color: string }
const modalSkills = computed<ModalSkill[]>(() => [
  ...MAPAIRS_CAPS.map(c => ({ id: c.id, name: c.name, kind: 'config' as const, desc: c.desc, color: '#0b65bb' })),
  ...realSkills.value.map((s: any) => ({ id: s.id || s.name, name: s.name || s.id, kind: 'direct' as const, desc: s.description || s.prompt_template?.slice(0, 80) || '', color: '#1d8c52' })),
])
const filteredModalSkills = computed(() => {
  let list = modalSkills.value
  if (skillModalTab.value === 'config') list = list.filter(s => s.kind === 'config')
  if (skillModalTab.value === 'direct') list = list.filter(s => s.kind === 'direct')
  const kw = skillModalSearch.value.trim().toLowerCase()
  if (kw) list = list.filter(s => s.name.toLowerCase().includes(kw) || s.desc.toLowerCase().includes(kw))
  return list
})
function openSkillModal() {
  skillModalPicked.value = new Set(selectedItems.value.map(s => s.kind === 'config' ? 'cap:' + s.id : 'sk:' + s.id))
  skillModalTab.value = 'all'
  skillModalSearch.value = ''
  showSkillModal.value = true
}
function closeSkillModal() { showSkillModal.value = false }
function toggleSkillPick(key: string) { if (skillModalPicked.value.has(key)) skillModalPicked.value.delete(key); else skillModalPicked.value.add(key); skillModalPicked.value = new Set(skillModalPicked.value) }
function confirmSkillModal() {
  const picked = new Set(skillModalPicked.value)
  // Remove deselected items
  selectedItems.value = selectedItems.value.filter(s => picked.has((s.kind === 'config' ? 'cap:' : 'sk:') + s.id))
  // Add newly selected items
  picked.forEach(key => {
    const [, id] = key.split(/:(.+)/)
    if (!selectedItems.value.find(s => s.id === id)) {
      const skill = modalSkills.value.find(s => s.id === id)
      if (skill) selectedItems.value.push({ id: skill.id, name: skill.name, kind: skill.kind })
    }
  })
  closeSkillModal()
  if (selectedItems.value.length && !activeConfigId.value) activeConfigId.value = selectedItems.value.find(s => s.kind === 'config')?.id || null
}

// ---- Schedule picker ----
const scheduleCat = ref('daily')
const schedHour = ref('09'); const schedMin = ref('00')
const schedDay = ref('周一'); const schedMonthDay = ref('1 号')
const schedInterval = ref('5'); const schedIntervalUnit = ref('分钟')
const schedCronInput = ref('0 9 * * *')
const schedDays = ['周一','周二','周三','周四','周五','周六','周日']
const schedSelectedDays = ref(new Set(['周一']))

function buildSchedule() {
  switch (scheduleCat.value) {
    case 'interval': return schedIntervalUnit.value === '分钟' ? `*/${schedInterval.value} * * * *` : `0 */${schedInterval.value} * * *`
    case 'hourly': return `${schedMin.value} * * * *`
    case 'daily': return `${schedMin.value} ${schedHour.value} * * *`
    case 'weekly': {
      const days = ['周一','周二','周三','周四','周五','周六','周日']
      const idx = days.findIndex(d => schedSelectedDays.value.has(d))
      return `${schedMin.value} ${schedHour.value} * * ${idx >= 0 ? idx + 1 : 1}`
    }
    case 'monthly': return `${schedMin.value} ${schedHour.value} ${parseInt(schedMonthDay.value) || 1} * *`
    case 'custom': return schedCronInput.value
    default: return '0 9 * * *'
  }
}
function toggleSchedDay(d: string) { if (schedSelectedDays.value.has(d)) schedSelectedDays.value.delete(d); else schedSelectedDays.value.add(d); schedSelectedDays.value = new Set(schedSelectedDays.value) }

const schedPreview = computed(() => {
  const c = scheduleCat.value
  if (c === 'interval') return `每 ${schedInterval.value} ${schedIntervalUnit.value} 执行一次`
  if (c === 'hourly') return `每小时第 ${schedMin.value} 分执行`
  if (c === 'daily') return `每天 ${schedHour.value}:${schedMin.value} 执行`
  if (c === 'weekly') return `每${[...schedSelectedDays.value].join('、')} ${schedHour.value}:${schedMin.value} 执行`
  if (c === 'monthly') return `每月 ${schedMonthDay.value} ${schedHour.value}:${schedMin.value} 执行`
  return `Cron: ${schedCronInput.value}`
})

watch([scheduleCat, schedHour, schedMin, schedDay, schedMonthDay, schedInterval, schedIntervalUnit, schedCronInput, schedSelectedDays], () => { schedule.value = buildSchedule() }, { deep: true })

// Restore schedule picker UI state from cron expression
function applyCronToUi(cron: string) {
  if (!cron) return
  const parts = cron.trim().split(/\s+/)
  if (parts.length < 5) { scheduleCat.value = 'custom'; schedCronInput.value = cron; return }
  const [m, h, dom, , dow] = parts
  // */N * * * * → interval
  if (m.startsWith('*/')) { scheduleCat.value = 'interval'; schedInterval.value = m.slice(2); schedIntervalUnit.value = '分钟'; return }
  // 0 */N * * * → interval hours
  if (h.startsWith('*/')) { scheduleCat.value = 'interval'; schedInterval.value = h.slice(2); schedIntervalUnit.value = '小时'; return }
  // M * * * * → hourly
  if (h === '*' && dom === '*' && dow === '*') { scheduleCat.value = 'hourly'; schedMin.value = m.padStart(2, '0'); return }
  // M H * * * → daily
  if (dom === '*' && dow === '*') { scheduleCat.value = 'daily'; schedHour.value = h.padStart(2, '0'); schedMin.value = m.padStart(2, '0'); return }
  // M H * * D → weekly
  if (dom === '*') {
    scheduleCat.value = 'weekly'
    schedHour.value = h.padStart(2, '0'); schedMin.value = m.padStart(2, '0')
    const dayMap: Record<string, string> = { '1':'周一','2':'周二','3':'周三','4':'周四','5':'周五','6':'周六','0':'周日','7':'周日' }
    schedSelectedDays.value = new Set(dow.split(',').map((d: string) => dayMap[d] || d))
    return
  }
  // M H DOM * * → monthly
  if (dow === '*') { scheduleCat.value = 'monthly'; schedMonthDay.value = `${dom} 号`; schedHour.value = h.padStart(2, '0'); schedMin.value = m.padStart(2, '0'); return }
  // fallback
  scheduleCat.value = 'custom'; schedCronInput.value = cron
}

// Restore pushChannels from deliver string
function restorePushChannels(deliver: string) {
  pushChannels.value = []
  if (!deliver || deliver === 'local') { pushChannels.value = ['local']; return }
  // Could be comma-separated or a single channel id
  const ids = deliver.split(',').map(s => s.trim()).filter(Boolean)
  ids.forEach(id => {
    // Check if it matches a known channel
    if (channelOptions.some(ch => ch.id === id)) pushChannels.value.push(id)
    else if (id === 'origin') { /* legacy, skip */ }
    else pushChannels.value.push(id) // custom value
  })
  if (!pushChannels.value.length) pushChannels.value = ['local']
}

// Hydrate skillConfig + local refs from prompt manifest JSON
function hydrateConfigFromPrompt(promptText: string) {
  if (!promptText) return
  try {
    const match = promptText.match(/【成果执行清单】\n([\s\S]*?)(?=\n\n【|$)/)
    if (!match) return
    const parsed = JSON.parse(match[1].trim())
    const outputs = Array.isArray(parsed?.outputs) ? parsed.outputs : []
    outputs.forEach((o: any) => {
      if (!o?.config) return
      const capId = Object.entries(SKILL_BY_TYPE).find(([, v]) => v === o.capability)?.[0] || o.capability
      if (capId && o.config && typeof o.config === 'object') {
        skillConfig.value[capId] = { ...o.config }
        restoreLocalRefs(capId, o.config)
      }
    })
  } catch { /* prompt JSON 解析失败，跳过 */ }
}

// Restore local UI refs from loaded config map
function restoreLocalRefs(sid: string, cfg: Record<string, string>) {
  if (sid.includes('concentrationRanking') || sid.includes('ranking')) {
    if (cfg['查询维度']) rankingQueryTarget.value = cfg['查询维度'] === '站点' ? 'site' : 'city'
    if (cfg['时间类型']) {
      const p = rankingPeriods.find(x => x.label === cfg['时间类型'])
      if (p) rankingPeriod.value = p.value
    }
    if (cfg['污染因子']) rankingFactors.value = cfg['污染因子'].split(',').filter(Boolean)
    if (cfg['截图颜色']) rankingTheme.value = cfg['截图颜色'] === '深色' ? 'dark' : 'light'
    if (cfg['国标类型']) {
      if (cfg['国标类型'] === '新') rankingGbKey.value = '2'
      else if (cfg['国标类型'] === '旧') rankingGbKey.value = '1'
      else rankingGbKey.value = '0'
    }
    if (cfg['截图类型']) rankingScreenshotTypes.value = cfg['截图类型'].split(',').filter(Boolean)
    return
  }
  if (sid.includes('mapPackage') || sid.includes('Map')) {
    if (cfg['地图模式']) mapCategory.value = cfg['地图模式'] === '星地模' ? 'starground' : 'initial'
    if (cfg['地图范围']) mapScope.value = cfg['地图范围'] === '全国' ? 'national' : cfg['地图范围']
    if (cfg['时间类型']) {
      if (cfg['时间类型'] === '累计' || cfg['时间类型'] === 'dt') mapTimeType.value = 'dt'
      else if (cfg['时间类型'] === '日') mapTimeType.value = 'daily'
      else mapTimeType.value = 'hourly'
    }
    if (cfg['地图类型']) mapMode.value = cfg['地图类型'] === '插值图' ? 'interpolation' : 'monitoring'
    if (cfg['因子']) mapMonitorFactor.value = mapPollutionOpts.find(o => o.label === cfg['因子'])?.value || 'PM2.5'
    if (cfg['颜色']) mapTheme.value = cfg['颜色'] === '深色' ? 'dark' : 'light'
    if (cfg['缩放等级']) {
      const z = mapZoomOpts.find(o => o.label === cfg['缩放等级'])
      if (z) mapZoomLevel.value = z.value
    }
    if (cfg['缩放自定义值']) mapZoomCustom.value = parseInt(cfg['缩放自定义值']) || 6
    if (cfg['插值图层']) {
      if (mapMode.value === 'interpolation') mapInterpolationLayer.value = cfg['插值图层']
      else mapMonitorLayer.value = cfg['插值图层'] || ''
    }
    if (cfg['风海浪']) mapWindWaves.value = cfg['风海浪'] === '开'
    if (cfg['左侧面板']) mapLeftPanel.value = cfg['左侧面板'] === '开'
    if (cfg['左侧面板区域']) {
      const z = mapLeftPanelZoneOpts.find(o => o.label === cfg['左侧面板区域'])
      if (z) mapLeftPanelZone.value = z.value
    }
    if (cfg['星地因子']) mapStarFactor.value = mapPollutionOpts.find(o => o.label === cfg['星地因子'])?.value || 'PM2.5'
    if (cfg['星地时间类型']) {
      if (cfg['星地时间类型'] === '日') mapStarTimeType.value = 'daily'
      else if (cfg['星地时间类型'] === '月') mapStarTimeType.value = 'month'
      else mapStarTimeType.value = 'hourly'
    }
    return
  }
  if (sid.includes('hourlyBrief') || sid.includes('hourly')) {
    if (cfg['查询维度']) hourlyQueryTarget.value = cfg['查询维度'] === '站点' ? 'site' : 'city'
    if (cfg['乡镇']) {
      const t = tshipOpts.find(x => x.label === cfg['乡镇'])
      if (t) hourlyTownship.value = t.value
    }
    if (cfg['污染因子']) hourlyFactors.value = cfg['污染因子'].split(',').filter(Boolean)
    if (cfg['截图颜色']) hourlyTheme.value = cfg['截图颜色'] === '深色' ? 'dark' : 'light'
    if (cfg['国标类型']) {
      if (cfg['国标类型'] === '新') hourlyGbKey.value = '2'
      else if (cfg['国标类型'] === '旧') hourlyGbKey.value = '1'
      else hourlyGbKey.value = '0'
    }
    if (cfg['截图类型']) hourlyScreenshotTypes.value = cfg['截图类型'].split(',').filter(Boolean)
    return
  }
  if (sid.includes('monitoringData') || sid.includes('monitoring')) {
    if (cfg['查询维度']) monitoringQueryTarget.value = cfg['查询维度'] === '站点' ? 'site' : 'city'
    if (cfg['乡镇']) {
      const t = tshipOpts.find(x => x.label === cfg['乡镇'])
      if (t) monitoringTownship.value = t.value
    }
    if (cfg['时间范围']) {
      const mp = monitoringPerOpts.find(x => x.label === cfg['时间范围'] || cfg['数据粒度'])
      if (mp) monitoringPeriod.value = mp.value
    }
    if (cfg['污染因子']) monitoringFactors.value = cfg['污染因子'].split(',').filter(Boolean)
    if (cfg['截图颜色']) monitoringTheme.value = cfg['截图颜色'] === '深色' ? 'dark' : 'light'
    if (cfg['国标类型']) {
      if (cfg['国标类型'] === '新') monitoringGbKey.value = '2'
      else if (cfg['国标类型'] === '旧') monitoringGbKey.value = '1'
      else monitoringGbKey.value = '0'
    }
    if (cfg['截图类型']) monitoringScreenshotTypes.value = cfg['截图类型'].split(',').filter(Boolean)
  }
}

// ---- Push channels ----
const channelOptions = [
  { id:'wecom', name:'企业微信', sub:'已配置 · 推送至「环保值班」群' },
  { id:'dingtalk', name:'钉钉', sub:'未配置 · 点击前往设置' },
  { id:'feishu', name:'飞书', sub:'未配置 · 点击前往设置' },
  { id:'mail', name:'邮件', sub:'已配置 · 推送至值班邮箱' },
  { id:'local', name:'本地', sub:'保存到本地文件夹' },
]
function toggleChannel(id: string) { pushChannels.value.includes(id) ? pushChannels.value = pushChannels.value.filter(x => x !== id) : pushChannels.value.push(id) }

// Build comprehensive prompt from all configs (matches task.vue pattern)
const SKILL_BY_TYPE: Record<string, string> = {
  concentrationRanking: 'mapairs-ranking-capture',
  mapPackage: 'mapairs-onemap-capture',
  hourlyBrief: 'mapairs-hourly-brief',
  monitoringData: 'mapairs-monitoring-data',
}

// Build per-capability config from local UI refs for prompt
function buildRankingConfig(): Record<string, string> {
  const periodLabel = rankingPeriods.find(p => p.value === rankingPeriod.value)?.label || '实时'
  const gbLabel = rankingGbKey.value === '2' ? '新' : rankingGbKey.value === '0' ? '默认' : '旧'
  return {
    '行政区': rankingRegion.value.join(','),
    '查询维度': rankingQueryTarget.value === 'city' ? '城市' : '站点',
    '时间类型': periodLabel,
    '污染因子': rankingFactors.value.join(','),
    '截图颜色': rankingTheme.value === 'light' ? '浅色' : '深色',
    '国标类型': gbLabel,
    '截图类型': rankingScreenshotTypes.value.join(','),
  }
}

function buildMapConfig(): Record<string, string> {
  const timeLabel = mapTimeType.value === 'hourly' ? '实时' : mapTimeType.value === 'dt' ? '累计' : '日'
  const modeLabel = mapMode.value === 'monitoring' ? '监测图' : '插值图'
  const factorLabel = mapPollutionOpts.find(o => o.value === mapMonitorFactor.value)?.label || 'PM₂.₅'
  const zoomLabel = mapZoomOpts.find(o => o.value === mapZoomLevel.value)?.label || '城市层级'
  const starTimeLabel = mapStarTimeType.value === 'hourly' ? '实时' : mapStarTimeType.value === 'daily' ? '日' : '月'
  const starFactorLabel = mapPollutionOpts.find(o => o.value === mapStarFactor.value)?.label || 'PM₂.₅'
  const categoryLabel = mapCategory.value === 'initial' ? '默认' : '星地模'
  return {
    '地图模式': categoryLabel,
    '地图范围': mapScope.value === 'national' ? '全国' : mapScope.value,
    '时间类型': timeLabel,
    '地图类型': modeLabel,
    '因子': mapMode.value === 'monitoring' ? factorLabel : (mapInterpolationLayer.value ? mapInterpolationLayerOpts.value.find(o => o.value === mapInterpolationLayer.value)?.label || '' : ''),
    '颜色': mapTheme.value === 'light' ? '浅色' : '深色',
    '缩放等级': zoomLabel,
    '缩放自定义值': String(mapZoomCustom.value),
    '插值图层': mapMode.value === 'interpolation' ? (mapInterpolationLayer.value || '') : (mapMonitorLayer.value || ''),
    '风海浪': mapWindWaves.value ? '开' : '关',
    '左侧面板': mapLeftPanel.value ? '开' : '关',
    '左侧面板区域': mapLeftPanelZoneOpts.find(o => o.value === mapLeftPanelZone.value)?.label || '城市',
    '星地因子': starFactorLabel,
    '星地时间类型': starTimeLabel,
  }
}

function buildHourlyConfig(): Record<string, string> {
  const gbLabel = hourlyGbKey.value === '2' ? '新' : hourlyGbKey.value === '0' ? '默认' : '旧'
  return {
    '行政区': hourlyRegion.value.join(','),
    '查询维度': hourlyQueryTarget.value === 'city' ? '城市' : '站点',
    '乡镇': hourlyTownship.value ? tshipOpts.find(t => t.value === hourlyTownship.value)?.label || '全部乡镇' : '全部乡镇',
    '污染因子': hourlyFactors.value.join(','),
    '截图颜色': hourlyTheme.value === 'light' ? '浅色' : '深色',
    '国标类型': gbLabel,
    '截图类型': hourlyScreenshotTypes.value.join(','),
  }
}

function buildMonitoringConfig(): Record<string, string> {
  const periodLabel = monitoringPerOpts.find(p => p.value === monitoringPeriod.value)?.label || '小时'
  const gbLabel = monitoringGbKey.value === '2' ? '新' : monitoringGbKey.value === '0' ? '默认' : '旧'
  return {
    '行政区': monitoringRegion.value.join(','),
    '查询维度': monitoringQueryTarget.value === 'city' ? '城市' : '站点',
    '乡镇': monitoringTownship.value ? tshipOpts.find(t => t.value === monitoringTownship.value)?.label || '全部乡镇' : '全部乡镇',
    '时间范围': periodLabel,
    '数据粒度': periodLabel,
    '污染因子': monitoringFactors.value.join(','),
    '截图颜色': monitoringTheme.value === 'light' ? '浅色' : '深色',
    '国标类型': gbLabel,
    '截图类型': monitoringScreenshotTypes.value.join(','),
  }
}

function buildConfigForSkill(sid: string): Record<string, string> {
  if (sid.includes('concentrationRanking') || sid.includes('ranking')) return buildRankingConfig()
  if (sid.includes('mapPackage') || sid.includes('Map')) return buildMapConfig()
  if (sid.includes('hourlyBrief') || sid.includes('hourly')) return buildHourlyConfig()
  if (sid.includes('monitoringData') || sid.includes('monitoring')) return buildMonitoringConfig()
  return skillConfig.value[sid] || {}
}

const finalPrompt = computed(() => {
  const parts: string[] = []

  // ① 成果执行清单 JSON
  const outputs = selectedItems.value
    .filter(s => s.kind === 'config')
    .map((s, i) => ({
      id: `output-${i + 1}`,
      capability: SKILL_BY_TYPE[s.id] || s.id,
      skill: SKILL_BY_TYPE[s.id] || s.id,
      config: buildConfigForSkill(s.id),
    }))
  const manifest = JSON.stringify({ version: 1, outputs }, null, 2)
  parts.push(`【成果执行清单】\n${manifest}`)

  // ② 执行规则
  parts.push('【执行规则】\n按 outputs 数组顺序逐项执行。每项成果只能读取自身 config；禁止将一个成果的主题、时间、因子、截图范围带入其他成果。带 skill 的成果必须使用该 Skill 附带的固定脚本，不得自行使用 agent-browser 或网页操作替代。')

  // ③ 成果附带规则：MEDIA 投递
  parts.push('【成果附带规则｜强制】\n所有成果生成后，你的最终回复中必须为每一个产出文件原样附上一行 `MEDIA:/绝对路径`（路径取脚本输出的 MEDIA:/ARTIFACT: 行）。Hermes 会据此自动将文件作为原生媒体投递到任务配置的推送目标。严禁自行调用任何推送工具、也不要用 delegate/派发子任务的方式去发送；只要把 MEDIA: 行写进最终回复即可。不允许只在本地生成而不在回复中用 MEDIA: 附上，不允许遗漏任何一项成果。')

  // ④ 交付验收清单
  const checklistLines = outputs.map((_, i) => `- 【成果 ${i + 1}】页面截图（截图文件，需 MEDIA:）`)
  const scCount = outputs.length
  parts.push(`【交付验收清单｜强制】\n本任务需按下表逐项交付，缺一不可：\n${checklistLines.join('\n')}\n其中截图类文件共 ${scCount} 个：你的最终回复必须包含 ${scCount} 行独立的 \`MEDIA:/绝对路径\`（每个截图一行，取脚本输出路径），行数必须等于 ${scCount}，不得合并、省略或只发其中一张。文字类成果直接写入回复正文。任一截图若未成功生成，必须明确报告失败原因，不得跳过或以其他截图替代。`)

  // ⑤ 任务说明（用户原始 prompt）
  if (prompt.value.trim()) {
    parts.push(`【任务说明】\n${prompt.value.trim()}`)
  }

  // ⑥ 成果保存位置
  if (savePath.value.trim()) {
    const taskDir = taskName.value.trim() || '任务'
    parts.push(`【成果保存位置｜强制】\n所有截图、文件等成果必须额外保存到以下路径（每次执行时自动创建时间子目录）：\n基础路径：${savePath.value}\n规则：在 "${savePath.value}" 下创建第一级文件夹 "${taskDir}"，再在该文件夹下创建第二级文件夹 "YYYY-MM-DD_HH-mm"（取当前执行时间，精确到分钟），所有成果保存到该二级目录下。若路径不存在则先创建目录。`)
  }

  return parts.join('\n\n')
})

async function handleCreate() {
  if (!taskName.value.trim()) { message.warning('请输入任务名称'); return }
  const payload = {
    name: taskName.value, schedule: schedule.value, prompt: finalPrompt.value,
    deliver: deliver.value || 'local',
    skills: [...selectedItems.value.filter(s => s.kind !== 'mcp').map(s => s.id), ...selectedConnectors.value],
  } as any
  try {
    if (isEdit.value && editJobId.value) {
      await jobsStore.updateJob(editJobId.value, payload)
      message.success('任务已更新')
    } else {
      await jobsStore.createJob(payload)
      message.success('任务已创建')
    }
    router.push({ name: 'hermes.duty' })
  } catch (e: any) { message.error((isEdit.value ? '更新失败: ' : '创建失败: ') + (e.message || e)) }
}
</script>

<template>
  <div class="create-page">
    <a class="crt-back" @click="handleBack"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="15 18 9 12 15 6"/></svg>返回值守任务</a>

    <!-- Stepper -->
    <div class="stepper">
      <div class="step-item" :class="{ active: step >= 1, done: step > 1 }" @click="goStep(1)"><div class="step-num">1</div><div class="step-label">选择要做什么</div></div>
      <div class="step-connector" :class="{ done: step >= 2 }"></div>
      <div class="step-item" :class="{ active: step >= 2, done: step > 2 }" @click="goStep(2)"><div class="step-num">2</div><div class="step-label">设置推送方式</div></div>
      <div class="step-connector" :class="{ done: step >= 3 }"></div>
      <div class="step-item" :class="{ active: step >= 3 }" @click="goStep(3)"><div class="step-num">3</div><div class="step-label">确认任务</div></div>
    </div>

    <!-- ===== STEP 1 ===== -->
    <div v-show="step === 1" class="step-panel">
      <!-- Origin banner -->
      <div v-if="originInfo" class="origin-banner">
        <span class="ob-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></span>
        <div class="ob-body"><b>{{ originInfo.title }}</b><small>{{ originInfo.detail }}</small></div>
        <button class="icon-btn" @click="originInfo = null"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>

      <div class="task-identity"><label>任务名称</label><input v-model="taskName" class="n-input" placeholder="例如：平顶山市空气质量值守"></div>

      <div class="create-tip-banner"><span class="ctb-tag">提示</span><span class="ctb-text">自动化任务执行时，请勿关闭电脑或退出客户端，否则任务将无法正常执行</span></div>

      <div v-if="!isEdit && selectedItems.length <= 0" class="capability-heading"><div><span class="capability-kicker">01 · 定义任务目标</span><h2>这次任务要做什么？</h2></div></div>

      <!-- 3 entry cards (hidden in edit mode) -->
      <div v-if="!isEdit && selectedItems.length <= 0" class="onboard-card-grid" :class="{ dimmed: selectedItems.length > 0 }">
        <div class="onboard-card tpl" @click="goPicker('tmpl')"><div class="obc-head"><span class="obc-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></span><span class="obc-badge">最推荐</span></div><h3>从模板添加</h3><p>系统内预置 6+ 份行业模板，一键应用到本次任务</p><span class="obc-cta">去选模板 →</span></div>
        <div class="onboard-card skill" @click="openSkillModal"><div class="obc-head"><span class="obc-ic" style="background:linear-gradient(135deg,#e8fbf2,#cff3e0);color:#1d8c52"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20"><path d="M12 2l2.4 7.4h7.6l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"/></svg></span><span class="obc-badge" style="background:#0b65bb;color:#fff">2 种形态</span></div><h3>从技能添加</h3><p>需配置（一张图/浓度排名等）和直接用（AI 脚本）两类技能</p><span class="obc-cta">去选技能 →</span></div>
        <div class="onboard-card mcp" @click="goPicker('mcps')"><div class="obc-head"><span class="obc-ic" style="background:linear-gradient(135deg,#f2ebff,#dfd4ff);color:#6d3ff0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20"><circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg></span></div><h3>从连接器添加</h3><p>选择 MCP 连接器，调用本地文件 / 飞书 IM 等工具</p><span class="obc-cta">去选连接器 →</span></div>
      </div>

      <!-- Prompt block with Workbuddy toolbar -->
      <div class="prompt-block"><div class="pb-label">提示词 <span style="color:var(--text-muted);font-weight:400;font-size:12px;margin-left:4px">描述任务目标，AI 将按目标调用下方技能、连接器与工具</span></div>
        <div class="prompt-box">
          <textarea v-model="prompt" placeholder="例如：&#10;针对平顶山市，获取今早 08:00~16:00 的小时监测数据，生成一张空气质量分布插值图，汇总浓度排名，并以日报格式推送到企业微信群"></textarea>
          <div class="prompt-toolbar">
            <div class="pt-select"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/></svg><b>Auto</b><span class="pt-arrow">▾</span></div>
            <div class="pt-select" @click="openSkillModal"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2l2.4 7.4h7.6l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"/></svg><b>技能</b><span class="seg-count" style="background:rgba(11,101,187,.12);color:#0b65bb;margin-left:4px">{{ configCount }} 需</span><span class="seg-count" style="background:rgba(29,140,82,.12);color:#1d8c52;margin-left:2px">{{ directCount }} 直</span><span class="pt-arrow">▾</span></div>
            <div class="pt-pill warning"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2l7 4v6c0 5-3 9-7 10-4-1-7-5-7-10V6l7-4z"/></svg>完全访问权限</div>
          </div>
        </div>
      </div>

      <!-- Connector section -->
      <div class="connector-head"><span>连接器</span><a @click="goPicker('mcps')">选择连接器库 →</a></div>

      <!-- Selected chips + config panels (prototype pattern) -->
      <div v-if="selectedItems.length || selectedConnectors.length" class="config-area">
        <div class="sel-chips-row">
          <span v-for="s in selectedItems" :key="s.id" class="sel-chip" :class="{ active: activeConfigId === s.id }" @click="selectConfig(s.id)">
            <span class="sc-mono" :style="{ background: s.kind === 'config' ? '#0b65bb' : '#1d8c52' }">{{ s.name[0] }}</span>
            <b>{{ s.name }}</b>
            <span class="sc-badge">{{ s.kind === 'config' ? '需配置' : '直接用' }}</span>
            <span class="sc-close" @click.stop="removeItem(s.id)">×</span>
          </span>
          <span v-for="c in selectedConnectors" :key="c" class="sel-chip t-mcp">
            <span class="sc-mono" style="background:#6d3ff0">{{ c[0] }}</span><b>{{ c }}</b><span class="sc-badge">连接器</span>
            <span class="sc-close" @click.stop="selectedConnectors = selectedConnectors.filter(x => x !== c)">×</span>
          </span>
        </div>

        <!-- Capability config panel -->
        <div v-if="activeConfig" class="cfg-panel">
          <!-- 浓度排名 -->
          <section v-if="activeConfig.id.includes('concentrationRanking') || activeConfig.id.includes('ranking')" class="ranking-config">
            <div class="ranking-config-head">02 · 配置浓度排名</div>
            <div class="ranking-config-grid">
              <div class="ranking-toolbar"><div class="compact-field"><span>查询：</span><div class="segmented"><button :class="{active:rankingQueryTarget==='city'}" @click="rankingQueryTarget='city'">城市</button><button :class="{active:rankingQueryTarget==='site'}" @click="rankingQueryTarget='site'">站点</button></div></div><div class="compact-field region-field"><span>行政区：</span><NTreeSelect v-model:value="rankingRegion" :options="cityTree" :loading="treeLoading" label-field="fullName" key-field="regionKeyVO" multiple placeholder="请选择行政区" style="width:240px" /></div></div>
              <div class="ranking-toolbar"><div class="compact-field"><span>时间类型：</span><div class="segmented period-segment"><button v-for="pt in rankingPeriods" :key="pt.value" :class="{active:rankingPeriod===pt.value}" @click="rankingPeriod=pt.value">{{pt.label}}</button></div></div><span class="latest-hint">执行时自动使用最新可用时间</span></div>
              <div class="ranking-toolbar"><div class="compact-field factor-field"><span>污染因子：</span><div class="factor-chips"><NCheckbox v-for="f in rankingFactorOpts.filter(f=>RANKING_FACTORS_BY_PERIOD[rankingPeriod]?.includes(f.value))" :key="f.value" :checked="rankingFactors.includes(f.value)" @update:checked="(v:boolean)=>{if(v)rankingFactors.push(f.value);else rankingFactors=rankingFactors.filter(x=>x!==f.value)}">{{f.label}}</NCheckbox></div></div></div>
              <div class="ranking-toolbar"><div class="compact-field"><span>截图颜色：</span><div class="segmented"><button :class="{active:rankingTheme==='light'}" @click="rankingTheme='light'">浅色</button><button :class="{active:rankingTheme==='dark'}" @click="rankingTheme='dark'">深色</button></div></div><div class="compact-field"><span>国标类型：</span><div class="segmented"><button :class="{active:rankingGbKey==='2'}" @click="rankingGbKey='2'">新</button><button :class="{active:rankingGbKey==='0'}" @click="rankingGbKey='0'">默认</button><button :class="{active:rankingGbKey==='1'}" @click="rankingGbKey='1'">旧</button></div></div></div>
              <div class="ranking-toolbar"><div class="compact-field"><span>截图类型：</span><NCheckbox :checked="rankingScreenshotTypes.includes('page')" @update:checked="(v:boolean)=>v?rankingScreenshotTypes.push('page'):rankingScreenshotTypes=rankingScreenshotTypes.filter(t=>t!=='page')">页面截图</NCheckbox><NCheckbox :checked="rankingScreenshotTypes.includes('table')" @update:checked="(v:boolean)=>v?rankingScreenshotTypes.push('table'):rankingScreenshotTypes=rankingScreenshotTypes.filter(t=>t!=='table')">表格截图</NCheckbox></div></div>
              <div class="ranking-summary">本次成果：{{rankingQueryTarget==='city'?'城市':'站点'}} · {{rankingFactors.map(factorLabel).join('、')}} · {{rankingPeriods.find(p=>p.value===rankingPeriod)?.label}} · {{rankingTheme==='light'?'浅色':'深色'}} · 截图：{{rankingScreenshotTypes.includes('page')?'页面':''}}{{rankingScreenshotTypes.includes('page')&&rankingScreenshotTypes.includes('table')?'+':''}}{{rankingScreenshotTypes.includes('table')?'表格':''}}</div>
            </div>
          </section>

          <!-- 一张图 -->
          <section v-if="activeConfig.id.includes('mapPackage') || activeConfig.id.includes('Map')" class="ranking-config map-config">
            <div class="ranking-config-head">02 · 配置一张图</div>
            <div class="ranking-config-grid">
              <!-- 地图模式 -->
              <div class="ranking-toolbar"><div class="compact-field"><span>地图模式：</span><div class="segmented"><button :class="{active:mapCategory==='initial'}" @click="mapCategory='initial'">默认</button><button :class="{active:mapCategory==='starground'}" @click="mapCategory='starground'">星地模</button></div></div></div>
              <!-- 默认地图 -->
              <template v-if="mapCategory==='initial'">
                <div class="ranking-toolbar"><div class="compact-field"><span>地图范围：</span><div class="segmented"><button v-for="o in mapScopeOpts" :key="o.value" :class="{active:mapScope===o.value}" @click="mapScope=o.value">{{o.label}}</button></div></div><div class="compact-field"><span>时间类型：</span><div class="segmented"><button :class="{active:mapTimeType==='hourly'}" @click="mapTimeType='hourly'">实时</button><button :class="{active:mapTimeType==='dt'}" @click="mapTimeType='dt'">累计</button><button :class="{active:mapTimeType==='daily'}" @click="mapTimeType='daily'">日</button></div></div></div>
                <div class="ranking-toolbar"><div class="compact-field"><span>地图类型：</span><div class="segmented"><button :class="{active:mapMode==='monitoring'}" @click="mapMode='monitoring'">监测图</button><button :class="{active:mapMode==='interpolation'}" @click="mapMode='interpolation'">插值图</button></div></div></div>
                <!-- 监测图：点位值-污染因子 + 插值图层 -->
                <template v-if="mapMode==='monitoring'">
                  <div class="ranking-toolbar"><div class="compact-field"><span>点位值-污染因子:</span><NSelect v-model:value="mapMonitorFactor" :options="mapPollutionOpts" style="width:180px" /></div></div>
                  <div class="ranking-toolbar"><div class="compact-field"><span>插值图层：</span><NSelect v-model:value="mapMonitorLayer" :options="mapEnvLayerOpts" placeholder="选择图层" clearable style="width:180px" /></div></div>
                </template>
                <!-- 插值图：地图图层 -->
                <template v-if="mapMode==='interpolation'">
                  <div class="ranking-toolbar"><div class="compact-field"><span>插值图层：</span><NSelect v-model:value="mapInterpolationLayer" :options="mapInterpolationLayerOpts" placeholder="选择图层" clearable style="width:200px" /></div></div>
                </template>
                <!-- 缩放等级 -->
                <div class="ranking-toolbar"><div class="compact-field"><span>缩放等级：</span><div class="segmented"><button v-for="o in mapZoomOpts" :key="o.value" :class="{active:mapZoomLevel===o.value}" @click="mapZoomLevel=o.value">{{o.label}}</button></div><NInputNumber v-if="mapZoomLevel==='custom'" v-model:value="mapZoomCustom" :min="3" :max="16" style="width:70px" /></div></div>
                <!-- 左侧面板 -->
                <div class="ranking-toolbar"><div class="compact-field"><span>左侧面板：</span><div class="segmented"><button :class="{active:mapLeftPanel}" @click="mapLeftPanel=true">开</button><button :class="{active:!mapLeftPanel}" @click="mapLeftPanel=false">关</button></div></div><div class="compact-field" style="margin-left:12px" v-if="mapLeftPanel"><span>展示区域：</span><div class="segmented"><button v-for="o in mapLeftPanelZoneOpts" :key="o.value" :class="{active:mapLeftPanelZone===o.value}" @click="mapLeftPanelZone=o.value">{{o.label}}</button></div></div></div>
              </template>
              <!-- 星地模 -->
              <template v-if="mapCategory==='starground'">
                <div class="ranking-toolbar"><div class="compact-field"><span>污染因子：</span><NSelect v-model:value="mapStarFactor" :options="mapPollutionOpts" style="width:180px" /></div><div class="compact-field"><span>时间类型：</span><div class="segmented"><button :class="{active:mapStarTimeType==='hourly'}" @click="mapStarTimeType='hourly'">实时</button><button :class="{active:mapStarTimeType==='daily'}" @click="mapStarTimeType='daily'">日</button><button :class="{active:mapStarTimeType==='month'}" @click="mapStarTimeType='month'">月</button></div></div></div>
              </template>
              <!-- 共同 -->
              <div class="ranking-toolbar"><div class="compact-field"><span>截图颜色：</span><div class="segmented"><button :class="{active:mapTheme==='light'}" @click="mapTheme='light'">浅色</button><button :class="{active:mapTheme==='dark'}" @click="mapTheme='dark'">深色</button></div></div><div style="margin-left:12px"><NCheckbox v-model:checked="mapWindWaves">风/海浪</NCheckbox></div></div>
            </div>
            <div class="ranking-summary">本次一张图：<template v-if="mapCategory==='starground'">星地模 · {{mapPollutionOpts.find(o=>o.value===mapStarFactor)?.label||'PM₂.₅'}} · {{mapStarTimeType==='hourly'?'实时':mapStarTimeType==='daily'?'日':'月'}} · {{mapTheme==='light'?'浅色':'深色'}} · {{mapWindWaves?'风/海浪开启':'风/海浪关闭'}}</template><template v-else>{{mapScope==='national'?'全国':mapScope}} · {{mapMode==='monitoring'?'监测图':'插值图'}} · {{mapPollutionOpts.find(o=>o.value===mapMonitorFactor)?.label||'PM₂.₅'}} · {{mapTheme==='light'?'浅色':'深色'}} · {{mapWindWaves?'风/海浪开启':'风/海浪关闭'}} · {{mapLeftPanel?'左侧面板'+(mapLeftPanelZoneOpts.find(o=>o.value===mapLeftPanelZone)?.label||'城市')+'显示':'左侧面板关闭'}}</template></div>
          </section>

          <!-- 小时播报 -->
          <section v-if="activeConfig.id.includes('hourlyBrief') || activeConfig.id.includes('hourly')" class="ranking-config">
            <div class="ranking-config-head">02 · 配置小时播报</div>
            <div class="ranking-config-grid">
              <div class="ranking-toolbar"><div class="compact-field"><span>查询：</span><div class="segmented"><button :class="{active:hourlyQueryTarget==='city'}" @click="hourlyQueryTarget='city'">城市</button><button :class="{active:hourlyQueryTarget==='site'}" @click="hourlyQueryTarget='site'">站点</button></div></div><div class="compact-field region-field"><span>行政区：</span><NTreeSelect v-model:value="hourlyRegion" :options="cityTree" :loading="treeLoading" label-field="fullName" key-field="regionKeyVO" multiple placeholder="请选择" style="width:200px" /></div><div class="compact-field"><span>乡镇：</span><NSelect v-model:value="hourlyTownship" :options="tshipOpts" style="width:130px" /></div></div>
              <div class="ranking-toolbar"><div class="compact-field factor-field"><span>污染因子：</span><div class="factor-chips"><NCheckbox v-for="f in rankingFactorOpts" :key="f.value" :checked="hourlyFactors.includes(f.value)" @update:checked="(v:boolean)=>{if(v)hourlyFactors.push(f.value);else hourlyFactors=hourlyFactors.filter(x=>x!==f.value)}">{{f.label}}</NCheckbox></div></div></div>
              <div class="ranking-toolbar"><div class="compact-field"><span>截图颜色：</span><div class="segmented"><button :class="{active:hourlyTheme==='light'}" @click="hourlyTheme='light'">浅色</button><button :class="{active:hourlyTheme==='dark'}" @click="hourlyTheme='dark'">深色</button></div></div><div class="compact-field"><span>国标类型：</span><div class="segmented"><button :class="{active:hourlyGbKey==='2'}" @click="hourlyGbKey='2'">新</button><button :class="{active:hourlyGbKey==='0'}" @click="hourlyGbKey='0'">默认</button><button :class="{active:hourlyGbKey==='1'}" @click="hourlyGbKey='1'">旧</button></div></div></div>
              <div class="ranking-toolbar"><div class="compact-field"><span>截图类型：</span><NCheckbox :checked="hourlyScreenshotTypes.includes('page')" @update:checked="(v:boolean)=>v?hourlyScreenshotTypes.push('page'):hourlyScreenshotTypes=hourlyScreenshotTypes.filter(t=>t!=='page')">页面截图</NCheckbox><NCheckbox :checked="hourlyScreenshotTypes.includes('table')" @update:checked="(v:boolean)=>v?hourlyScreenshotTypes.push('table'):hourlyScreenshotTypes=hourlyScreenshotTypes.filter(t=>t!=='table')">表格截图</NCheckbox></div></div>
              <div class="ranking-summary">本次成果：{{hourlyQueryTarget==='city'?'城市':'站点'}} · {{hourlyFactors.map(factorLabel).join('、')}} · {{hourlyTheme==='light'?'浅色':'深色'}} · 截图：{{hourlyScreenshotTypes.includes('page')?'页面':''}}{{hourlyScreenshotTypes.includes('page')&&hourlyScreenshotTypes.includes('table')?'+':''}}{{hourlyScreenshotTypes.includes('table')?'表格':''}}</div>
            </div>
          </section>

          <!-- 监测数据 -->
          <section v-if="activeConfig.id.includes('monitoringData') || activeConfig.id.includes('monitoring')" class="ranking-config">
            <div class="ranking-config-head">02 · 配置监测数据</div>
            <div class="ranking-config-grid">
              <div class="ranking-toolbar"><div class="compact-field"><span>查询：</span><div class="segmented"><button :class="{active:monitoringQueryTarget==='city'}" @click="monitoringQueryTarget='city'">城市</button><button :class="{active:monitoringQueryTarget==='site'}" @click="monitoringQueryTarget='site'">站点</button></div></div><div class="compact-field region-field"><span>行政区：</span><NTreeSelect v-model:value="monitoringRegion" :options="cityTree" :loading="treeLoading" label-field="fullName" key-field="regionKeyVO" multiple placeholder="请选择" style="width:200px" /></div><div class="compact-field"><span>乡镇：</span><NSelect v-model:value="monitoringTownship" :options="tshipOpts" style="width:130px" /></div></div>
              <div class="ranking-toolbar"><div class="compact-field"><span>时间：</span><div class="segmented"><button v-for="pt in monitoringPerOpts" :key="pt.value" :class="{active:monitoringPeriod===pt.value}" @click="monitoringPeriod=pt.value">{{pt.label}}</button></div></div><span class="latest-hint">执行时自动使用最新数据</span></div>
              <div class="ranking-toolbar"><div class="compact-field factor-field"><span>污染因子：</span><div class="factor-chips"><NCheckbox v-for="f in rankingFactorOpts" :key="f.value" :checked="monitoringFactors.includes(f.value)" @update:checked="(v:boolean)=>{if(v)monitoringFactors.push(f.value);else monitoringFactors=monitoringFactors.filter(x=>x!==f.value)}">{{f.label}}</NCheckbox></div></div></div>
              <div class="ranking-toolbar"><div class="compact-field"><span>截图颜色：</span><div class="segmented"><button :class="{active:monitoringTheme==='light'}" @click="monitoringTheme='light'">浅色</button><button :class="{active:monitoringTheme==='dark'}" @click="monitoringTheme='dark'">深色</button></div></div><div class="compact-field"><span>国标类型：</span><div class="segmented"><button :class="{active:monitoringGbKey==='2'}" @click="monitoringGbKey='2'">新</button><button :class="{active:monitoringGbKey==='0'}" @click="monitoringGbKey='0'">默认</button><button :class="{active:monitoringGbKey==='1'}" @click="monitoringGbKey='1'">旧</button></div></div></div>
              <div class="ranking-toolbar"><div class="compact-field"><span>截图类型：</span><NCheckbox :checked="monitoringScreenshotTypes.includes('page')" @update:checked="(v:boolean)=>v?monitoringScreenshotTypes.push('page'):monitoringScreenshotTypes=monitoringScreenshotTypes.filter(t=>t!=='page')">页面截图</NCheckbox><NCheckbox :checked="monitoringScreenshotTypes.includes('table')" @update:checked="(v:boolean)=>v?monitoringScreenshotTypes.push('table'):monitoringScreenshotTypes=monitoringScreenshotTypes.filter(t=>t!=='table')">表格截图</NCheckbox></div></div>
              <div class="ranking-summary">本次成果：{{monitoringQueryTarget==='city'?'城市':'站点'}} · {{monitoringFactors.map(factorLabel).join('、')}} · 截图：{{monitoringScreenshotTypes.includes('page')?'页面':''}}{{monitoringScreenshotTypes.includes('page')&&monitoringScreenshotTypes.includes('table')?'+':''}}{{monitoringScreenshotTypes.includes('table')?'表格':''}}</div>
            </div>
          </section>
        </div>
      </div>

      <div class="action-bar"><span></span><div class="action-right"><button class="btn btn-default" @click="handleBack">取消</button><button class="btn btn-primary" @click="goStep(2)">下一步</button></div></div>
    </div>

    <!-- ===== STEP 2 ===== -->
    <div v-show="step === 2" class="step-panel">
      <div class="delivery-intro"><span>03 · 设置交付</span><h2>什么时候运行，发送给谁？</h2></div>

      <div class="form-group">
        <label class="form-label">运行时间 <span class="required-mark">*</span></label>
        <div class="schedule-picker">
          <div class="sched-cat-tabs">
            <button class="sched-cat-btn" :class="{ active: scheduleCat === 'interval' }" @click="scheduleCat = 'interval'">按间隔</button>
            <button class="sched-cat-btn" :class="{ active: scheduleCat === 'hourly' }" @click="scheduleCat = 'hourly'">每小时</button>
            <button class="sched-cat-btn" :class="{ active: scheduleCat === 'daily' }" @click="scheduleCat = 'daily'">每天</button>
            <button class="sched-cat-btn" :class="{ active: scheduleCat === 'weekly' }" @click="scheduleCat = 'weekly'">每周</button>
            <button class="sched-cat-btn" :class="{ active: scheduleCat === 'monthly' }" @click="scheduleCat = 'monthly'">每月</button>
            <button class="sched-cat-btn" :class="{ active: scheduleCat === 'custom' }" @click="scheduleCat = 'custom'">自定义</button>
          </div>

          <div v-show="scheduleCat === 'interval'" class="sched-cat-panel">
            <div class="sched-sub-label">常用间隔</div>
            <div class="preset-chip-grid">
              <button v-for="l in ['5','10','15','30']" :key="l" class="preset-chip" :class="{ active: schedInterval === l && schedIntervalUnit === '分钟' }" @click="schedInterval = l; schedIntervalUnit = '分钟'">{{ l }} 分钟</button>
              <button v-for="l in ['1','2','3','6','12','24']" :key="l" class="preset-chip" :class="{ active: schedInterval === l && schedIntervalUnit === '小时' }" @click="schedInterval = l; schedIntervalUnit = '小时'">{{ l }} 小时</button>
            </div>
            <div class="sched-custom-row"><span class="sched-custom-label">自定义</span><div class="sched-custom-inputs"><span>每</span><input type="number" v-model="schedInterval" class="sched-num-input" min="1"><select v-model="schedIntervalUnit" class="sched-unit-select"><option>分钟</option><option>小时</option></select></div></div>
          </div>

          <div v-show="scheduleCat === 'hourly'" class="sched-cat-panel">
            <div class="sched-time-row"><span class="sched-time-label">执行分钟</span><div class="sched-time-inputs"><select v-model="schedMin" class="sched-time-select"><option>00</option><option>05</option><option>10</option><option>15</option><option>30</option><option>45</option></select><span>分</span></div></div>
          </div>

          <div v-show="scheduleCat === 'daily'" class="sched-cat-panel">
            <div class="sched-time-row"><span class="sched-time-label">执行时间</span><div class="sched-time-inputs"><select v-model="schedHour" class="sched-time-select"><option>00</option><option>08</option><option>09</option><option>10</option><option>18</option><option>20</option></select><span>:</span><select v-model="schedMin" class="sched-time-select"><option>00</option><option>15</option><option>30</option><option>45</option></select></div></div>
          </div>

          <div v-show="scheduleCat === 'weekly'" class="sched-cat-panel">
            <div class="sched-sub-label">选择星期</div>
            <div class="sched-day-chips"><button v-for="d in schedDays" :key="d" class="sched-day-chip" :class="{ active: schedSelectedDays.has(d) }" @click="toggleSchedDay(d)">{{ d }}</button></div>
            <div class="sched-time-row" style="margin-top:12px"><span class="sched-time-label">执行时间</span><div class="sched-time-inputs"><select v-model="schedHour" class="sched-time-select"><option>09</option><option>18</option></select><span>:</span><select v-model="schedMin" class="sched-time-select"><option>00</option><option>30</option></select></div></div>
          </div>

          <div v-show="scheduleCat === 'monthly'" class="sched-cat-panel">
            <div class="sched-monthly-row"><span class="sched-monthly-label">每月</span><select v-model="schedMonthDay" class="sched-dom-select"><option>1 号</option><option>15 号</option><option>28 号</option></select></div>
            <div class="sched-time-row"><span class="sched-time-label">执行时间</span><div class="sched-time-inputs"><select v-model="schedHour" class="sched-time-select"><option>09</option></select><span>:</span><select v-model="schedMin" class="sched-time-select"><option>00</option></select></div></div>
          </div>

          <div v-show="scheduleCat === 'custom'" class="sched-cat-panel">
            <div class="sched-custom-row"><span class="sched-custom-label">Cron 表达式</span><input v-model="schedCronInput" class="sched-cron-input" placeholder="0 9 * * *"></div>
            <div class="sched-cron-help"><div class="sched-cron-help-title">格式: 分 时 日 月 周</div><div class="sched-cron-help-examples"><div>每 5 分钟: <code>*/5 * * * *</code></div><div>每天 9 点: <code>0 9 * * *</code></div><div>每周一 9 点: <code>0 9 * * 1</code></div></div></div>
          </div>

          <div class="schedule-preview"><span class="sched-dot"></span><span>{{ schedPreview }}</span></div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">成果发送到 <span class="required-mark">*</span></label>
        <div class="channel-grid">
          <div v-for="ch in channelOptions" :key="ch.id" class="channel-item" :class="{ checked: pushChannels.includes(ch.id) }" @click="toggleChannel(ch.id)">
            <div class="ch-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
            <div class="ch-info"><div class="ch-name">{{ ch.name }}</div><div class="ch-sub">{{ ch.sub }}</div></div>
          </div>
        </div>
        <div class="chip-config-hint"><span>需要更多接收渠道？</span><a class="hint-link" @click="goToChannels">前往配置 →</a></div>
      </div>

      <div class="form-group">
        <label class="form-label">成果保存位置（可选）</label>
        <div class="save-path-row"><input class="n-input" v-model="savePath" placeholder="留空则不保存到本地文件夹" style="flex:1"><button class="btn btn-default btn-sm" @click="browseSavePath">浏览</button></div>
      </div>

      <div class="form-group">
        <label class="form-label">运行模型（可选）</label>
        <div class="model-select-row"><NSelect v-model:value="selectedProvider" :options="providerOptions" style="flex:1" /><NSelect v-model:value="selectedModel" :options="modelOptions" style="flex:1" /></div>
        <div class="chip-config-hint"><span>不选则使用全局默认模型。</span></div>
      </div>

      <div class="delivery-note"><b>本次任务将交付 {{ selectedItems.length }} 项成果</b><div class="dn-list"><span v-for="(s, i) in selectedItems" :key="s.id">{{ i + 1 }}. {{ s.name }}</span></div></div>

      <div class="action-bar"><button class="btn btn-default" @click="goStep(1)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16"><polyline points="15 18 9 12 15 6"/></svg>上一步</button><div class="action-right"><button class="btn btn-default" @click="handleBack">取消</button><button class="btn btn-primary" @click="goStep(3)">下一步 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button></div></div>
    </div>

    <!-- ===== STEP 3 ===== -->
    <div v-show="step === 3" class="step-panel">
      <div class="preview-box">
        <div class="confirm-hero"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span><div><b>请确认这份值守安排</b></div></div>
        <div class="preview-section"><div class="preview-label">任务名称</div><div class="preview-line"><strong>{{ taskName || '未填写' }}</strong></div></div>
        <div class="preview-section"><div class="preview-label">成果清单（{{ selectedItems.length }} 项）</div><div class="confirm-output-list"><div v-for="(s, i) in selectedItems" :key="s.id"><span>{{ i + 1 }}</span><strong>{{ s.name }}</strong></div></div></div>
        <div class="preview-section"><div class="preview-label">运行与发送</div><div class="preview-line"><strong>频率：</strong>{{ schedule || '未设置' }} · <strong>推送至：</strong>{{ deliver || '本地' }}</div></div>
        <div class="preview-section"><div class="preview-label">系统将自动完成</div><div class="simple-run-plan"><span>获取发布数据</span><i>→</i><span>依次生成 {{ selectedItems.length }} 项成果</span><i>→</i><span>统一发送给值守人员</span></div></div>
      </div>

      <!-- 保存为模板 -->
      <div class="save-as-template" :class="{ closed: !satExpanded && !satChecked }">
        <div class="sat-head">
          <label class="n-checkbox" :class="{ checked: satChecked }" @click="satChecked = !satChecked; if(satChecked && !satExpanded) satExpanded = true">
            <span class="box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg></span>
            <span><h3>{{ isEdit ? '修改任务时一并保存为模板' : '创建任务时一并保存为模板' }} <span class="tag-pill">推荐</span></h3><small>勾选后，本次配置的技能组合、调度方式、推送渠道会同步保存为模板，其他团队也能一键复用。</small></span>
          </label>
          <button class="sat-toggle" @click="satExpanded = !satExpanded">{{ satExpanded ? '收起填写 ↑' : '展开填写 ↓' }}</button>
        </div>
        <div class="sat-body" v-show="satExpanded">
          <div class="compact-field"><label>模板名称 <span style="color:var(--error)">*</span></label><input class="n-input" v-model="satName" placeholder="例如：平顶山日报推送 v2"></div>
          <div class="compact-field"><label>模板分组</label><NSelect v-model:value="satGroup" :options="[{label:'我的模板',value:'我的模板'},{label:'团队分享',value:'团队分享'},{label:'日报周报',value:'日报周报'},{label:'考核排名',value:'考核排名'},{label:'空气质量',value:'空气质量'}]" /></div>
          <div class="compact-field full"><label>模板简介</label><textarea class="n-input" v-model="satDesc" rows="2" placeholder="一句话说明该模板的适用场景与产出"></textarea></div>
          <div class="compact-field full"><label>标签（用空格 / 逗号分隔）</label><input class="n-input" v-model="satTags" placeholder="日报 空气质量 企业微信"></div>
          <div class="sat-hint">保存为模板后可在 <b>任务模板库</b> 中查看、编辑、分享给其他团队或环境。</div>
        </div>
      </div>

      <div class="action-bar"><button class="btn btn-default" @click="goStep(2)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16"><polyline points="15 18 9 12 15 6"/></svg>上一步</button><div class="action-right"><button class="btn btn-default" @click="handleBack">取消</button><button class="btn btn-default" @click="saveAsTemplate"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" height="14" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>仅保存为模板</button><button class="btn btn-primary" @click="handleCreate"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>{{ isEdit ? '保存修改' : '创建任务' }} <span v-if="satChecked && !isEdit" style="margin-left:4px;font-weight:500;opacity:.9">（+ 保存为模板）</span></button></div></div>
    </div>
  </div>
  <!-- Skill selection modal -->
    <Teleport to="body">
      <div v-if="showSkillModal" class="modal-mask" @click.self="closeSkillModal">
        <div class="modal" style="width:840px">
          <div class="modal-head"><div class="modal-title">选择技能</div><div class="modal-sub">技能分两类：<b style="color:#0b65bb">需配置</b>（平台能力，需逐项配置参数）&nbsp;·&nbsp;<b style="color:#1d8c52">直接用</b>（AI 脚本，Agent 按上下文填参）</div></div>
          <div class="modal-body">
            <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px">
              <div class="modal-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="15" height="15"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input v-model="skillModalSearch" placeholder="搜索技能名"></div>
              <div class="segmented">
                <button :class="{ active: skillModalTab === 'all' }" @click="skillModalTab = 'all'">全部 <span style="font-size:11px;color:var(--text-muted)">{{ modalSkills.length }}</span></button>
                <button :class="{ active: skillModalTab === 'config' }" @click="skillModalTab = 'config'">需配置 <span style="font-size:11px;color:#0b65bb">{{ modalSkills.filter(s=>s.kind==='config').length }}</span></button>
                <button :class="{ active: skillModalTab === 'direct' }" @click="skillModalTab = 'direct'">直接用 <span style="font-size:11px;color:#1d8c52">{{ modalSkills.filter(s=>s.kind==='direct').length }}</span></button>
              </div>
            </div>
            <div class="modal-grid">
              <div v-for="s in filteredModalSkills" :key="s.id" class="mc-card" :class="{ selected: skillModalPicked.has((s.kind==='config'?'cap:':'sk:')+s.id) }" @click="toggleSkillPick((s.kind==='config'?'cap:':'sk:')+s.id)">
                <div class="mc-ic" :style="{ background: s.color }">{{ s.name[0] }}</div>
                <div class="mc-body"><div class="mc-title">{{ s.name }}</div><div class="mc-sub">{{ s.desc }}</div></div>
                <span class="mc-tag" :class="s.kind==='config'?'tag-cap':'tag-sk'">{{ s.kind==='config' ? '需配置' : '直接用' }}</span>
                <span class="mc-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></span>
              </div>
            </div>
          </div>
          <div class="modal-foot">
            <span style="font-size:12.5px;color:var(--text-muted)">已选 {{ skillModalPicked.size }} 项</span>
            <div class="modal-foot-right"><button class="btn btn-default" @click="closeSkillModal">取消</button><button class="btn btn-primary" @click="confirmSkillModal">确认添加</button></div>
          </div>
        </div>
      </div>
    </Teleport>

  <!-- Skill selection modal -->
  <Teleport to="body">
    <div v-if="showSkillModal" class="modal-mask" @click.self="closeSkillModal">
      <div class="modal" style="width:840px">
        <div class="modal-head"><div class="modal-title">选择技能</div><div class="modal-sub">技能分两类：<b style="color:#0b65bb">需配置</b>（平台能力）&nbsp;·&nbsp;<b style="color:#1d8c52">直接用</b>（AI 脚本）</div></div>
        <div class="modal-body">
          <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px">
            <div class="modal-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="15" height="15"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input v-model="skillModalSearch" placeholder="搜索技能名"></div>
            <div class="segmented">
              <button :class="{ active: skillModalTab === 'all' }" @click="skillModalTab = 'all'">全部</button>
              <button :class="{ active: skillModalTab === 'config' }" @click="skillModalTab = 'config'">需配置</button>
              <button :class="{ active: skillModalTab === 'direct' }" @click="skillModalTab = 'direct'">直接用</button>
            </div>
          </div>
          <div class="modal-grid">
            <div v-for="s in filteredModalSkills" :key="s.id" class="mc-card" :class="{ selected: skillModalPicked.has((s.kind==='config'?'cap:':'sk:')+s.id) }" @click="toggleSkillPick((s.kind==='config'?'cap:':'sk:')+s.id)">
              <div class="mc-ic" :style="{ background: s.color }">{{ s.name[0] }}</div>
              <div class="mc-body"><div class="mc-title">{{ s.name }}</div><div class="mc-sub">{{ s.desc }}</div></div>
              <span class="mc-tag" :class="s.kind==='config'?'tag-cap':'tag-sk'">{{ s.kind==='config' ? '需配置' : '直接用' }}</span>
              <span class="mc-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></span>
            </div>
          </div>
        </div>
        <div class="modal-foot">
          <span style="font-size:12.5px;color:var(--text-muted)">已选 {{ skillModalPicked.size }} 项</span>
          <div class="modal-foot-right"><button class="btn btn-default" @click="closeSkillModal">取消</button><button class="btn btn-primary" @click="confirmSkillModal">确认添加</button></div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.create-page { padding: 24px 28px 60px; max-width: 860px; margin: 0 auto; }
.crt-back { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: $text-secondary; cursor: pointer; margin-bottom: 20px; svg { width: 16px; height: 16px; } &:hover { color: $accent-primary; } }

// Stepper
.stepper { display: flex; align-items: center; justify-content: center; gap: 0; margin-bottom: 28px; }
.step-item { display: flex; align-items: center; gap: 10px; cursor: pointer; opacity: .35; transition: .2s; &.active, &.done { opacity: 1; } }
.step-num { width: 30px; height: 30px; border-radius: 50%; border: 2px solid $border-color; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; color: $text-muted; background: $bg-card; }
.step-item.active .step-num { background: $accent-primary; border-color: $accent-primary; color: #fff; }
.step-item.done .step-num { background: $success; border-color: $success; color: #fff; }
.step-label { font-size: 14px; font-weight: 500; color: $text-primary; }
.step-connector { width: 48px; height: 2px; background: $border-color; margin: 0 12px; &.done { background: $accent-primary; } }

.step-panel { animation: fadeIn .2s; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

// Origin banner
.origin-banner { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: rgba(var(--accent-primary-rgb),.06); border: 1px solid rgba(var(--accent-primary-rgb),.2); border-radius: var(--radius-md); margin-bottom: 16px; font-size: 13px;
  .ob-ic { flex-shrink: 0; color: $accent-primary; }
  .ob-body { flex: 1; b { display: block; font-size: 13px; } small { color: $text-muted; font-size: 11.5px; } }
  .icon-btn { background: none; border: none; color: $text-muted; cursor: pointer; &:hover { color: $text-primary; } }
}

// Task identity
.task-identity { margin-bottom: 12px; label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 6px; } }
.n-input { width: 100%; padding: 10px 14px; border: 1px solid $border-color; border-radius: var(--radius-md); font-size: 14px; outline: none; background: $bg-input; color: $text-primary; font-family: inherit; &:focus { border-color: $accent-primary; } }

// Tip banner
.create-tip-banner { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: rgba(var(--warning-rgb),.08); border: 1px solid rgba(var(--warning-rgb),.2); border-radius: var(--radius-md); margin-bottom: 20px; }
.ctb-tag { font-size: 11px; padding: 2px 8px; border-radius: 4px; background: var(--warning); color: #fff; font-weight: 600; }
.ctb-text { font-size: 12.5px; color: $text-secondary; flex: 1; }

// Section heading
.capability-heading { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 14px; }
.capability-kicker { font-size: 11px; color: $text-muted; text-transform: uppercase; letter-spacing: .6px; }
.capability-heading h2 { font-size: 18px; font-weight: 600; margin: 2px 0 0; color: $text-primary; }

// Onboard cards
.onboard-card-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; transition: .2s;
  &.dimmed { opacity: .55; pointer-events: none; outline: 1px dashed $border-color; outline-offset: 4px; border-radius: var(--radius-lg); }
}
.onboard-card { border: 1px solid $border-color; border-radius: var(--radius-lg); padding: 18px; cursor: pointer; transition: .15s; background: $bg-card; &:hover { border-color: $accent-primary; box-shadow: 0 4px 12px rgba(0,0,0,.06); } h3 { font-size: 14px; font-weight: 600; margin: 8px 0 6px; color: $text-primary; } p { font-size: 12px; color: $text-secondary; line-height: 1.5; margin-bottom: 8px; } }
.obc-head { display: flex; align-items: center; justify-content: space-between; }
.obc-ic { width: 36px; height: 36px; border-radius: 8px; background: $bg-secondary; display: flex; align-items: center; justify-content: center; color: $accent-primary; }
.obc-badge { font-size: 10px; padding: 2px 8px; border-radius: 999px; background: $accent-primary; color: #fff; font-weight: 600; }
.obc-cta { font-size: 12px; color: $accent-primary; font-weight: 500; }

// Prompt block
.prompt-block { margin-bottom: 16px; }
.pb-label { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
.prompt-box { border: 1px solid $border-color; border-radius: var(--radius-lg); background: $bg-card; overflow: hidden;
  textarea { width: 100%; border: none; outline: none; padding: 16px; font-size: 14px; line-height: 1.7; resize: vertical; min-height: 120px; font-family: inherit; background: transparent; color: $text-primary; &::placeholder { color: $text-muted; } }
}
.prompt-toolbar { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-top: 1px solid $border-light; flex-wrap: wrap; }
.pt-select { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border: 1px solid $border-color; border-radius: 999px; font-size: 12px; cursor: pointer; background: $bg-card; svg { width: 14px; height: 14px; } &:hover { border-color: $accent-primary; } }
.pt-arrow { font-size: 10px; color: $text-muted; }
.pt-pill { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 999px; font-size: 11px; &.warning { border: 1px solid var(--accent-orange); color: var(--accent-orange); background: rgba(245,158,11,.06); } svg { width: 12px; height: 12px; } }

// Connector head
.connector-head { display: flex; align-items: center; justify-content: space-between; padding: 6px 4px 2px; margin-top: 4px; span { font-size: 13px; font-weight: 600; color: $text-primary; } a { font-size: 12px; color: $accent-primary; cursor: pointer; } }

// Config area (prototype pattern)
.config-area { margin-top: 8px; }
.sel-chips-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 10px 12px; background: $bg-card; border: 1px solid $border-color; border-radius: var(--radius-md); min-height: 46px; margin-bottom: 10px; }
.sel-chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border: 1px solid $border-color; border-radius: 999px; cursor: pointer; transition: .12s; background: $bg-card; font-size: 12px;
  &.active { border-color: $accent-primary; background: rgba(var(--accent-primary-rgb),.06); }
  &.t-mcp { border-color: rgba(109,63,240,.3); background: rgba(109,63,240,.04); }
  .sc-mono { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 10px; font-weight: 700; flex-shrink: 0; }
  b { font-weight: 600; color: $text-primary; }
  .sc-badge { font-size: 10px; padding: 1px 6px; border-radius: 9px; background: $bg-secondary; color: $text-muted; }
  .sc-close { font-size: 14px; color: $text-muted; cursor: pointer; padding: 0 2px; &:hover { color: $error; } }
}

// Config panel
.ranking-config { background: $bg-card; border: 1px solid $border-color; border-radius: var(--radius-md); padding: 14px 16px; }
.ranking-config-head { font-size: 13px; font-weight: 600; color: $text-primary; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid $border-light; }
.ranking-toolbar { display: flex; align-items: center; gap: 12px; padding: 5px 0; flex-wrap: wrap; }
.compact-field { display: flex; align-items: center; gap: 8px; font-size: 12.5px; span { white-space: nowrap; color: $text-muted; } }
.ranking-summary { font-size: 11.5px; color: $text-muted; border-top: 1px solid $border-light; padding-top: 8px; }
.latest-hint { font-size: 10.5px; color: var(--accent-orange); margin-left: 4px; }

// Segmented buttons
.segmented { display: inline-flex; gap: 2px; background: $bg-secondary; border-radius: 6px; padding: 2px; button { border: none; background: transparent; color: $text-secondary; font-size: 11.5px; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-family: inherit; &.active { background: $bg-card; color: $accent-primary; font-weight: 500; box-shadow: 0 1px 2px rgba(0,0,0,.06); } } }

// Factor chips
.factor-chips { display: flex; gap: 4px; flex-wrap: wrap; }
.factor-chip { font-size: 11px; padding: 2px 8px; border-radius: 9px; border: 1px solid $border-color; background: $bg-card; color: $text-secondary; cursor: pointer; transition: .12s; &:hover { border-color: $accent-primary; } &.active { background: rgba(var(--accent-primary-rgb),.12); border-color: $accent-primary; color: $accent-primary; } }

// Step 2
.delivery-intro { margin-bottom: 20px; span { font-size: 11px; color: $text-muted; text-transform: uppercase; } h2 { font-size: 18px; font-weight: 600; margin: 2px 0 0; color: $text-primary; } }
.form-section { margin-bottom: 16px; }
.form-label { font-size: 14px; font-weight: 600; display: block; margin-bottom: 8px; }

// Schedule picker (prototype)
.form-group { margin-bottom: 16px; }
.sched-cat-tabs { display: flex; gap: 2px; background: $bg-secondary; border-radius: var(--radius-md); padding: 3px; width: fit-content; margin-bottom: 12px; }
.sched-cat-btn { border: none; background: transparent; color: $text-secondary; font-size: 12.5px; padding: 6px 16px; border-radius: var(--radius-sm); cursor: pointer; font-family: inherit; transition: .12s; &.active { background: $bg-card; color: $accent-primary; font-weight: 500; box-shadow: 0 1px 2px rgba(0,0,0,.05); } &:hover:not(.active) { color: $text-primary; } }
.sched-cat-panel { margin-bottom: 8px; }
.sched-sub-label { font-size: 12px; color: $text-muted; margin-bottom: 8px; }
.preset-chip-grid { display: flex; gap: 6px; flex-wrap: wrap; }
.preset-chip { padding: 6px 14px; border: 1px solid $border-color; border-radius: 999px; background: $bg-card; color: $text-secondary; font-size: 12.5px; cursor: pointer; transition: .12s; font-family: inherit; &.active { background: rgba(var(--accent-primary-rgb),.1); border-color: $accent-primary; color: $accent-primary; } &:hover { border-color: $accent-primary; } }
.sched-custom-row { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.sched-custom-label { font-size: 12px; color: $text-muted; }
.sched-custom-inputs { display: flex; align-items: center; gap: 6px; font-size: 13px; color: $text-secondary; }
.sched-num-input { width: 56px; padding: 4px 8px; border: 1px solid $border-color; border-radius: var(--radius-sm); text-align: center; font-size: 13px; background: $bg-input; color: $text-primary; }
.sched-unit-select { padding: 4px 8px; border: 1px solid $border-color; border-radius: var(--radius-sm); font-size: 13px; background: $bg-input; color: $text-primary; cursor: pointer; }
.sched-time-row { display: flex; align-items: center; gap: 12px; }
.sched-time-label { font-size: 12px; color: $text-muted; }
.sched-time-inputs { display: flex; align-items: center; gap: 4px; }
.sched-time-select { padding: 6px 10px; border: 1px solid $border-color; border-radius: var(--radius-sm); font-size: 13px; background: $bg-input; color: $text-primary; cursor: pointer; }
.sched-day-chips { display: flex; gap: 4px; flex-wrap: wrap; }
.sched-day-chip { padding: 5px 12px; border: 1px solid $border-color; border-radius: 999px; font-size: 12px; cursor: pointer; background: $bg-card; color: $text-secondary; transition: .12s; font-family: inherit; &.active { background: rgba(var(--accent-primary-rgb),.1); border-color: $accent-primary; color: $accent-primary; } &:hover { border-color: $accent-primary; } }
.sched-monthly-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.sched-monthly-label { font-size: 12px; color: $text-muted; }
.sched-dom-select { padding: 6px 10px; border: 1px solid $border-color; border-radius: var(--radius-sm); font-size: 13px; background: $bg-input; color: $text-primary; cursor: pointer; }
.sched-cron-input { width: 220px; padding: 6px 10px; border: 1px solid $border-color; border-radius: var(--radius-sm); font-size: 13px; background: $bg-input; color: $text-primary; font-family: monospace; }
.sched-cron-help { margin-top: 10px; font-size: 11.5px; color: $text-muted; .sched-cron-help-title { margin-bottom: 4px; } .sched-cron-help-examples code { font-family: monospace; background: $bg-secondary; padding: 1px 4px; border-radius: 2px; } }
.schedule-preview { display: flex; align-items: center; gap: 8px; margin-top: 14px; padding-top: 12px; border-top: 1px solid $border-light; font-size: 13px; color: $text-primary; .sched-dot { width: 8px; height: 8px; border-radius: 50%; background: $accent-primary; flex-shrink: 0; } }

// Channel grid
.channel-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.channel-item { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border: 1px solid $border-color; border-radius: var(--radius-md); background: $bg-card; cursor: pointer; transition: .15s; &:hover { border-color: var(--border-strong); } &.checked { border-color: $accent-primary; background: rgba(var(--accent-primary-rgb),.05); } }
.ch-icon { width: 36px; height: 36px; border-radius: var(--radius-sm); background: $bg-secondary; border: 1px solid $border-color; display: flex; align-items: center; justify-content: center; flex-shrink: 0; svg { width: 16px; height: 16px; color: $accent-primary; } }
.ch-info { flex: 1; }
.ch-name { font-size: 13.5px; font-weight: 600; color: $text-primary; }
.ch-sub { font-size: 11.5px; color: $text-muted; margin-top: 2px; }

// Step 3
.confirm-hero { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; svg { width: 24px; height: 24px; color: $success; } b { font-size: 16px; color: $text-primary; } }
.confirm-card { background: $bg-card; border: 1px solid $border-color; border-radius: var(--radius-lg); padding: 20px; margin-bottom: 16px; }
.cf-row { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid $border-light; &:last-child { border-bottom: none; } }
.cf-label { font-size: 13px; color: $text-muted; min-width: 72px; }
.cf-value { font-size: 13px; color: $text-primary; font-weight: 500; }

// Action bar
.action-bar { display: flex; justify-content: space-between; align-items: center; margin-top: 24px; }
.action-right { display: flex; gap: 8px; margin-left: auto; }

// Buttons
.btn { display: inline-flex; align-items: center; gap: 7px; padding: 10px 18px; border-radius: var(--radius-md); font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid transparent; transition: .15s; text-decoration: none; font-family: inherit; }
.btn-primary { background: $accent-primary; color: #fff; border-color: $accent-primary; &:hover { background: $accent-hover; } }
.btn-default { background: $bg-card; color: $text-primary; border-color: $border-color; &:hover { border-color: var(--border-strong); } }

// Modal
.modal-mask { position: fixed; inset: 0; z-index: 3000; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; }
.modal { background: $bg-card; border-radius: var(--radius-lg); box-shadow: 0 8px 40px rgba(0,0,0,.15); max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; }
.modal-head { padding: 20px 24px 12px; border-bottom: 1px solid $border-light; .modal-title { font-size: 16px; font-weight: 600; } .modal-sub { font-size: 12.5px; color: $text-muted; margin-top: 4px; } }
.modal-body { padding: 16px 24px; overflow-y: auto; flex: 1; }
.modal-foot { display: flex; align-items: center; justify-content: space-between; padding: 12px 24px; border-top: 1px solid $border-light; }
.modal-foot-right { display: flex; gap: 8px; }
.modal-search { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border: 1px solid $border-color; border-radius: var(--radius-sm); background: $bg-input; flex: 1; svg { color: $text-muted; flex-shrink: 0; } input { border: none; outline: none; background: transparent; font-size: 13px; color: $text-primary; width: 100%; font-family: inherit; } }
.modal-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.mc-card { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border: 1px solid $border-color; border-radius: var(--radius-md); cursor: pointer; transition: .12s; position: relative; &:hover { border-color: var(--border-strong); } &.selected { border-color: $accent-primary; background: rgba(var(--accent-primary-rgb),.04); .mc-check { opacity: 1; } } }
.mc-ic { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 13px; flex-shrink: 0; margin-top: 2px; }
.mc-body { flex: 1; min-width: 0; .mc-title { font-size: 13.5px; font-weight: 600; color: $text-primary; line-height: 1.3; } .mc-sub { font-size: 11.5px; color: $text-muted; margin-top: 4px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; } }
.mc-tag { font-size: 10.5px; padding: 1px 6px; border-radius: 4px; font-weight: 500; flex-shrink: 0; margin-top: 2px; white-space: nowrap; &.tag-cap { background: var(--badge-config); color: #1d4ed8; } &.tag-sk { background: var(--badge-direct); color: #15803d; } }
.mc-check { width: 20px; height: 20px; border: 2px solid $border-color; border-radius: 4px; display: flex; align-items: center; justify-content: center; opacity: .3; transition: .12s; flex-shrink: 0; margin-top: 2px; svg { width: 12px; height: 12px; color: $accent-primary; } .selected & { border-color: $accent-primary; background: $accent-primary; opacity: 1; svg { color: #fff; } } }
.mc-tag { font-size: 10.5px; padding: 1px 6px; border-radius: 4px; font-weight: 500; &.tag-cap { background: var(--badge-config); color: #1d4ed8; } &.tag-sk { background: var(--badge-direct); color: #15803d; } }
.mc-check { width: 20px; height: 20px; border: 2px solid $border-color; border-radius: 4px; display: flex; align-items: center; justify-content: center; opacity: .3; transition: .12s; flex-shrink: 0; svg { width: 12px; height: 12px; color: $accent-primary; } .selected & { border-color: $accent-primary; background: $accent-primary; opacity: 1; svg { color: #fff; } } }

// Step 2 & 3 styles (matching prototypes)
.required-mark { color: $error; font-weight: 600; }
.chip-config-hint { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 12px; color: $text-muted; .hint-link { color: $accent-primary; cursor: pointer; font-weight: 500; &:hover { text-decoration: underline; } } }
.save-path-row { display: flex; gap: 10px; align-items: center; }
.model-select-row { display: flex; gap: 12px; }
.delivery-note { margin-top: 20px; padding: 14px 18px; background: rgba(var(--accent-primary-rgb), .04); border: 1px solid rgba(var(--accent-primary-rgb), .15); border-radius: var(--radius-md); b { font-size: 13px; color: $text-primary; } .dn-list { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; span { font-size: 12px; color: $text-secondary; } } }
.btn-sm { padding: 6px 14px; font-size: 12px; }
.preview-box { background: $bg-card; border: 1px solid $border-color; border-radius: var(--radius-lg); padding: 24px; margin-bottom: 20px; }
.preview-section { padding: 14px 0; border-bottom: 1px solid $border-light; &:last-child { border-bottom: none; } .preview-label { font-size: 11.5px; color: $text-muted; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px; } .preview-line { font-size: 13.5px; color: $text-secondary; strong { color: $text-primary; } } }
.confirm-output-list { display: flex; flex-direction: column; gap: 6px; div { display: flex; align-items: center; gap: 8px; font-size: 13px; span { width: 20px; height: 20px; border-radius: 50%; background: $bg-secondary; border: 1px solid $border-color; display: flex; align-items: center; justify-content: center; font-size: 11px; color: $text-muted; flex-shrink: 0; } strong { color: $text-primary; font-weight: 500; } } }
.simple-run-plan { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; span { padding: 6px 14px; background: $bg-secondary; border: 1px solid $border-color; border-radius: 999px; font-size: 12.5px; color: $text-primary; } i { color: $text-muted; font-style: normal; font-size: 13px; } }
.save-as-template { border: 1px solid $border-color; border-radius: var(--radius-lg); overflow: hidden; margin-bottom: 20px; &.closed { opacity: .85; } .sat-head { padding: 18px 20px; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; } .n-checkbox { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; flex: 1; .box { width: 18px; height: 18px; border: 2px solid $border-color; border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; svg { width: 12px; height: 12px; opacity: 0; } } &.checked .box { background: $accent-primary; border-color: $accent-primary; svg { opacity: 1; color: #fff; } } h3 { font-size: 14px; font-weight: 600; color: $text-primary; margin: 0 0 4px; } small { font-size: 12px; color: $text-muted; line-height: 1.5; } } .sat-toggle { background: none; border: 1px solid $border-color; border-radius: var(--radius-sm); padding: 5px 14px; font-size: 12px; color: $text-secondary; cursor: pointer; font-family: inherit; white-space: nowrap; &:hover { border-color: var(--border-strong); } } }
.sat-body { padding: 0 20px 18px; display: flex; flex-direction: column; gap: 12px; .compact-field { display: flex; flex-direction: column; gap: 5px; label { font-size: 13px; font-weight: 500; color: $text-primary; } &.full { grid-column: 1 / -1; } } }
.sat-hint { font-size: 12px; color: $text-muted; padding-top: 4px; }
.tag-pill { display: inline; margin-left: 6px; padding: 1px 8px; border-radius: 999px; background: rgba(var(--accent-primary-rgb), .12); color: $accent-primary; font-size: 11px; font-weight: 500; }
</style>
