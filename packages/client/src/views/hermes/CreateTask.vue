<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NInput, NInputNumber, NButton } from 'naive-ui'
import SchedulePicker from '@/components/hermes/shared/SchedulePicker.vue'
import { useJobsStore } from '@/stores/hermes/jobs'
import { useSettingsStore } from '@/stores/hermes/settings'
import { getJob, scheduleToEditableInput, jobRepeatToEditValue } from '@/api/hermes/jobs'
import type { Job } from '@/api/hermes/jobs'
import { fetchSkills } from '@/api/hermes/skills'
import type { SkillInfo } from '@/api/hermes/skills'
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
const taskName = ref('')
const taskPrompt = ref('')
const schedule = ref('0 9 * * *')
const selectedPushChips = ref<Set<string>>(new Set(['origin']))
const notifyGroupId = ref('')
const repeat_times = ref<number | null>(null)
const selectedSkills = ref<string[]>([])
const promptSupplement = ref('') // 用户补充说明

// 推送平台 chip 定义
const pushChipList = [
  { id: 'origin', name: '原始会话', icon: '💬' },
  { id: 'local', name: '本地', icon: '🖥️' },
  { id: 'wecom', name: '企业微信', icon: '💬' },
  { id: 'dingtalk', name: '钉钉', icon: '🔷' },
  { id: 'feishu', name: '飞书', icon: '🐦' },
  { id: 'qqbot', name: 'QQBot', icon: '🐧' },
]

function togglePushChip(chipId: string) {
  if (selectedPushChips.value.has(chipId)) {
    selectedPushChips.value.delete(chipId)
  } else {
    selectedPushChips.value.add(chipId)
  }
}

// 技能行管理：平台技能（自动带入，不可移除）+ 用户技能（可移除）
// 平台技能从选中的平台动态读取
const platformSkills = computed(() => {
  const skills = new Set<string>()
  for (const pid of selectedPlatforms.value) {
    const platform = platforms.value.find(p => p.id === pid)
    if (platform && platform.skills) {
      for (const skill of platform.skills) {
        skills.add(skill)
      }
    }
  }
  return skills
})
const userSkills = ref<Set<string>>(new Set())

// 从 API 加载可用技能
const allSystemSkills = ref<SkillInfo[]>([])
const skillsLoading = ref(false)

async function loadSkills() {
  skillsLoading.value = true
  try {
    const data = await fetchSkills()
    const skills: SkillInfo[] = []
    for (const cat of data.categories) {
      for (const s of cat.skills) {
        skills.push({ ...s, source: s.source || 'local' })
      }
    }
    allSystemSkills.value = skills
  } catch {
    allSystemSkills.value = []
  } finally {
    skillsLoading.value = false
  }
}

const availableSkills = computed(() => {
  return allSystemSkills.value.map(s => ({
    name: s.name,
    desc: s.description || s.name,
    category: s.source || 'local',
  }))
})

// function getSkillDesc(name: string): string {
//   const s = availableSkills.find(s => s.name === name)
//   return s ? s.desc : ''
// }

// function isSkillAdded(name: string): boolean {
//   return platformSkills.value.has(name) || userSkills.value.has(name)
// }

// function addUserSkill(name: string) {
//   userSkills.value.add(name)
// }

function removeUserSkill(name: string) {
  userSkills.value.delete(name)
}

// 技能下拉状态
const skillDropdownOpen = ref(false)
const skillSearchQuery = ref('')

const filteredSkillOptions = computed(() => {
  const query = skillSearchQuery.value.toLowerCase()
  const skills = availableSkills.value
  return skills.filter((s: any) =>
    !query || s.name.toLowerCase().includes(query) || s.desc.toLowerCase().includes(query)
  )
})

function toggleSkillDropdown() {
  skillDropdownOpen.value = !skillDropdownOpen.value
  if (skillDropdownOpen.value) {
    skillSearchQuery.value = ''
  }
}

// function closeSkillDropdown() {
//   skillDropdownOpen.value = false
// }

function isSkillAdded(name: string): boolean {
  return platformSkills.value.has(name) || userSkills.value.has(name)
}

function handleSkillOptionClick(name: string) {
  if (platformSkills.value.has(name)) return
  if (userSkills.value.has(name)) {
    userSkills.value.delete(name)
  } else {
    userSkills.value.add(name)
  }
}

// ==================== Platform / Function State ====================
interface PlatformDef {
  id: string
  name: string
  desc: string
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
  { id: 'szdq-review', platformId: 'szdq', name: '数据监测', tags: ['截图', '数据采集', '数据分析'], prompt: '定位到实时监测页面，提取各点位分钟级PM2.5、AQI、O3数据流，按站点结构化输出…' },
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
const selectedFunctions = ref<Set<string>>(new Set(['szdq-trace', 'szdq-review']))

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

// ==================== Platform / Function Toggle ====================
function togglePlatform(platformId: string) {
  // 所有平台都可以取消勾选
  if (selectedPlatforms.value.has(platformId)) {
    selectedPlatforms.value.delete(platformId)
    // 取消该平台下所有功能
    for (const fid of [...selectedFunctions.value]) {
      const f = functions.find(x => x.id === fid)
      if (f && f.platformId === platformId) selectedFunctions.value.delete(fid)
    }
  } else {
    selectedPlatforms.value.add(platformId)
  }
}

function toggleFunction(funcId: string) {
  if (selectedFunctions.value.has(funcId)) {
    selectedFunctions.value.delete(funcId)
  } else {
    selectedFunctions.value.add(funcId)
  }
}

// ==================== Computed ====================
const isFormValid = computed(() => {
  if (!taskName.value) return false
  if (selectedPushChips.value.size === 0) return false
  // 提示词可由用户输入或平台/功能自动组装
  if (!taskPrompt.value.trim() && activeFunctions.value.length === 0) return false
  return !!schedule.value
})

const pushChipNames = computed(() =>
  Array.from(selectedPushChips.value).map(id => {
    const chip = pushChipList.find(c => c.id === id)
    return chip ? chip.name : id
  })
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

const activePlatforms = computed(() =>
  platforms.value.filter((p: any) => selectedPlatforms.value.has(p.id))
)

const activeFunctions = computed(() =>
  functions.filter((f: any) => selectedFunctions.value.has(f.id))
)

const platformFunctions = computed(() =>
  functions.filter((f: any) => selectedPlatforms.value.has(f.platformId))
)

// 组装最终提示词
const assembledPrompt = computed(() => {
  const parts: string[] = []

  // 角色基底
  parts.push('你是一个环保数据值守智能体，负责从各数据平台采集、分析环境监测数据并自动推送报告。')

  // 平台信息
  for (const p of activePlatforms.value) {
    if (p.prompt) {
      parts.push(`【${p.name}】${p.prompt}`)
    } else {
      parts.push(`【${p.name}】${p.desc}`)
    }
  }

  // 功能操作提示词
  for (const f of activeFunctions.value) {
    if (f.prompt) {
      parts.push(`【${f.name}】${f.prompt}`)
    }
  }

  // 能力标签自动注入
  const tagPromptMap: Record<string, string> = {
    '截图': '需要对该功能执行后进行截图并发送给用户',
    '数据采集': '需要对该功能查询到的数据进行采集并结构化提取',
    '文件下载': '需要将该功能产出的文件进行下载并保存',
    '数据分析': '为用户分析该功能查询到的数据，形成分析报告',
  }
  const collectedTags = new Set<string>()
  for (const f of activeFunctions.value) {
    for (const tag of f.tags) {
      if (tagPromptMap[tag]) collectedTags.add(tag)
    }
  }
  if (collectedTags.size > 0) {
    parts.push('')
    parts.push('⚡ 能力标签自动注入：')
    for (const tag of collectedTags) {
      parts.push(`  - [${tag}] ${tagPromptMap[tag]}`)
    }
  }

  return parts.join('\n')
})

const finalPrompt = computed(() => {
  const parts: string[] = []

  // 用户自定义提示词（步骤1输入）
  if (taskPrompt.value.trim()) {
    parts.push(`【用户提示词】\n${taskPrompt.value.trim()}`)
  }

  // 平台/功能自动组装提示词
  parts.push(assembledPrompt.value)

  // 补充说明
  const supplement = promptSupplement.value.trim()
  if (supplement) {
    parts.push(`\n【补充说明】\n${supplement}`)
  }

  return parts.join('\n\n')
})

// 提示词分段（用于确认页面彩色标签展示）
interface PromptSegment {
  type: 'base' | 'user' | 'platform' | 'function' | 'tag' | 'supplement'
  label: string
  text: string
}

const promptSegments = computed<PromptSegment[]>(() => {
  const segments: PromptSegment[] = []

  // 1. 角色基底
  segments.push({
    type: 'base',
    label: '角色',
    text: '你是一个环保数据值守智能体，负责从各数据平台采集、分析环境监测数据并自动推送报告。',
  })

  // 2. 用户输入的提示词
  if (taskPrompt.value.trim()) {
    segments.push({
      type: 'user',
      label: '用户提示词',
      text: taskPrompt.value.trim(),
    })
  }

  // 3. 平台信息
  for (const p of activePlatforms.value) {
    if (p.prompt) {
      segments.push({
        type: 'platform',
        label: `平台 · ${p.name}`,
        text: p.prompt,
      })
    } else {
      segments.push({
        type: 'platform',
        label: `平台 · ${p.name}`,
        text: p.desc,
      })
    }
  }

  // 3. 功能操作提示词
  for (const f of activeFunctions.value) {
    if (f.prompt) {
      segments.push({
        type: 'function',
        label: `功能 · ${f.name}`,
        text: f.prompt,
      })
    }
  }

  // 4. 能力标签自动注入
  const tagPromptMap: Record<string, string> = {
    '截图': '需要对该功能执行后进行截图并发送给用户',
    '数据采集': '需要对该功能查询到的数据进行采集并结构化提取',
    '文件下载': '需要将该功能产出的文件进行下载并保存',
    '数据分析': '为用户分析该功能查询到的数据，形成分析报告',
  }
  const collectedTags = new Set<string>()
  for (const f of activeFunctions.value) {
    for (const tag of f.tags) {
      if (tagPromptMap[tag]) collectedTags.add(tag)
    }
  }
  for (const tag of collectedTags) {
    segments.push({
      type: 'tag',
      label: tag,
      text: tagPromptMap[tag],
    })
  }

  // 5. 补充说明
  const supplement = promptSupplement.value.trim()
  if (supplement) {
    segments.push({
      type: 'supplement',
      label: '补充',
      text: supplement,
    })
  }

  return segments
})

// 所有技能名称（平台 + 用户）
const allSkillNames = computed(() => {
  const names: Array<{ name: string; isPlatform: boolean }> = []
  for (const name of platformSkills.value) {
    names.push({ name, isPlatform: true })
  }
  for (const name of userSkills.value) {
    names.push({ name, isPlatform: false })
  }
  return names
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
    if (!taskPrompt.value.trim() && activeFunctions.value.length === 0) {
      message.warning('请输入执行提示词或选择数据平台功能')
      return
    }
    if (!schedule.value) {
      message.warning('请设置执行频率')
      return
    }
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
      skills: selectedSkills.value,
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
    emit('created', payload)
  } catch (e: any) {
    message.error((isEdit.value ? '任务更新失败' : '任务创建失败') + ': ' + (e.message || e))
  } finally {
    submitting.value = false
  }
}

// ==================== Reset / Load ====================
function resetForm() {
  taskName.value = ''
  taskPrompt.value = ''
  selectedPushChips.value = new Set(['origin'])
  notifyGroupId.value = ''
  repeat_times.value = null
  selectedSkills.value = []
  schedule.value = '0 9 * * *'
  promptSupplement.value = ''
  selectedPlatforms.value = new Set(['szdq'])
  selectedFunctions.value = new Set(['szdq-trace', 'szdq-review'])
  userSkills.value = new Set()
  originalJob.value = null
}

// ==================== Lifecycle ====================
onMounted(async () => {
  resetForm()
  // 加载平台列表和系统技能
  await Promise.all([loadPlatforms(), loadSkills()])

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

// ==================== Helper Functions ====================
const platformColorMap = (color: string): string => {
  const map: Record<string, string> = {
    purple: '#7F77DD',
    amber: '#FBBC04',
    blue: '#1A73E8',
    green: '#34A853',
  }
  return map[color] || '#7F77DD'
}

const functionPlatformColor = (platformId: string): string => {
  const map: Record<string, string> = {
    szdq: 'purple',
    zd: 'amber',
    hnsjk: 'blue',
    hdjk: 'green',
  }
  return map[platformId] || 'purple'
}

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

            <div class="form-group">
              <label class="form-label">任务名称<span class="form-label-optional2">（*必填）</span></label>
              <NInput v-model:value="taskName" placeholder="请输入任务名称" maxlength="50" />
            </div>

            <div class="form-group">
              <label class="form-label">选择执行平台</label>
              <div class="platform-list">
                <div v-for="platform in platforms" :key="platform.id" class="platform-check" :class="{
                  checked: selectedPlatforms.has(platform.id),
                  disabled: platform.builtin,
                  [platform.color]: selectedPlatforms.has(platform.id),
                }" @click="togglePlatform(platform.id)">
                  <div class="check-box">
                    <svg v-if="selectedPlatforms.has(platform.id)" width="14" height="14" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" stroke-width="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div class="platform-info">
                    <div class="platform-name">
                      {{ platform.name }}
                      <span v-if="platform.badge" class="platform-badge" :class="`badge-${platform.badgeClass}`">{{
                        platform.badge }}</span>
                    </div>
                    <div class="platform-desc">{{ platform.desc }}</div>
                    <div v-if="platform.builtin" class="platform-capability">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5z" />
                        <path d="M2 17l10 5 10-5" />
                        <path d="M2 12l10 5 10-5" />
                      </svg>
                      <span>支持自动登录、截图、数据推送</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 功能挂载矩阵 -->
            <div class="form-group" v-if="activePlatforms.length > 0">
              <label class="form-label">功能选择</label>
              <div class="func-matrix">
                <div v-for="platform in activePlatforms" :key="platform.id" class="func-card">
                  <div class="func-card-header">
                    <div class="func-card-title">
                      <span class="plat-dot" :style="{ background: platformColorMap(platform.color) }"></span>
                      {{ platform.name }}
                      <span v-if="platform.builtin" class="func-card-badge badge-builtin">内置</span>
                      <span v-else class="func-card-badge badge-custom">自定义</span>
                    </div>
                    <div class="func-card-count">
                      {{platformFunctions.filter(f => f.platformId === platform.id).length}}个功能可选
                    </div>
                  </div>
                  <div class="func-card-body">
                    <div v-for="func in platformFunctions.filter(f => f.platformId === platform.id)" :key="func.id"
                      class="func-check" :class="{ checked: selectedFunctions.has(func.id) }"
                      @click="toggleFunction(func.id)">
                      <div class="func-check-box">
                        <svg v-if="selectedFunctions.has(func.id)" width="12" height="12" viewBox="0 0 24 24"
                          fill="none" stroke="currentColor" stroke-width="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      <span class="func-check-name">{{ func.name }}</span>
                      <span class="func-support-text">支持:{{ func.tags.join('、') }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">附加技能 <span class="form-label-optional">可额外添加</span></label>
              <div class="skill-rows">
                <div v-for="skill in allSkillNames" :key="skill.name" class="skill-row">
                  <svg class="skill-row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                  </svg>
                  <span class="skill-name">{{ skill.name }}</span>
                  <span class="skill-badge" :class="{ user: !skill.isPlatform }">
                    {{ skill.isPlatform ? '平台' : '用户' }}
                  </span>
                  <button v-if="!skill.isPlatform" class="skill-remove" @click="removeUserSkill(skill.name)"
                    title="移除">×</button>
                </div>
                <div v-if="allSkillNames.length === 0" class="skill-empty">暂无附加技能</div>
              </div>
              <div class="skill-add-row">
                <div class="skill-multi-select">
                  <button class="skill-add-btn" @click="toggleSkillDropdown">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      stroke-width="1.6">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    添加技能
                  </button>
                  <div v-show="skillDropdownOpen" class="skill-ms-dropdown" @click.stop>
                    <div class="skill-ms-search-wrap">
                      <input class="skill-ms-search" v-model="skillSearchQuery" placeholder="搜索技能..." @click.stop />
                    </div>
                    <div class="skill-ms-list">
                      <div v-for="skill in filteredSkillOptions" :key="skill.name" class="skill-ms-option"
                        :class="{ selected: isSkillAdded(skill.name) }" @click="handleSkillOptionClick(skill.name)">
                        <span class="skill-ms-check">
                          <svg v-if="isSkillAdded(skill.name)" width="10" height="10" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                        <span class="skill-ms-option-name">{{ skill.name }}</span>
                        <span class="skill-ms-option-desc">{{ skill.desc }}</span>
                      </div>
                      <div v-if="filteredSkillOptions.length === 0" class="skill-ms-empty">无匹配技能</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ====== 步骤3: 执行设置 ====== -->
        <div v-show="currentStep === 2" class="step-panel">
          <div class="form-section">
            <div class="form-group">
              <label class="form-label">执行频率 <span class="form-label-optional2">（*必填）</span></label>
              <SchedulePicker v-model="schedule" />
            </div>

            <div class="form-group">
              <label class="form-label">推送平台 <span class="form-label-optional2">（*必填）</span></label>
              <div class="chip-group">
                <div v-for="chip in pushChipList" :key="chip.id" class="chip" :class="{
                  active: selectedPushChips.has(chip.id),
                  disabled: chip.id !== 'origin' && chip.id !== 'local' && !isPlatformConfigured(chip.id),
                }"
                  @click="chip.id === 'origin' || chip.id === 'local' || isPlatformConfigured(chip.id) ? togglePushChip(chip.id) : null">
                  <span class="chip-icon">{{ chip.icon }}</span>
                  {{ chip.name }}
                  <span v-if="chip.id !== 'origin' && chip.id !== 'local'" class="chip-status"
                    :class="{ configured: isPlatformConfigured(chip.id) }">
                    {{ isPlatformConfigured(chip.id) ? '已配置' : '未配置' }}
                  </span>
                </div>
              </div>
              <div class="chip-config-hint">
                <span class="hint-text">未配置的平台无法使用，</span>
                <a class="hint-link" @click="goToChannels">前往配置 →</a>
              </div>
            </div>

            <!-- <div class="form-group">
            <label class="form-label">推送群ID</label>
            <NInput v-model:value="notifyGroupId" placeholder="请输入推送群ID" />
          </div> -->

            <div class="form-group">
              <label class="form-label">重复次数 <span class="form-label-optional">（可选）</span></label>
              <NInputNumber v-model:value="repeat_times" :min="1" placeholder="不限制" clearable style="width: 100%" />
            </div>
          </div>
        </div>

        <!-- ====== 步骤4: 确认 ====== -->
        <div v-show="currentStep === 3" class="step-panel">
          <div class="preview-box">
            <div class="preview-section">
              <div class="preview-label">任务名称</div>
              <div class="preview-line"><strong>{{ taskName || '未命名任务' }}</strong></div>
            </div>

            <div class="preview-section">
              <div class="preview-label">执行平台</div>
              <div class="preview-items">
                <span v-for="p in activePlatforms" :key="p.id" class="preview-tag" :class="`tag-${p.color}`">
                  <span class="tag-dot" :style="{ background: platformColorMap(p.color) }"></span>
                  {{ p.name }}
                </span>
              </div>
            </div>

            <div class="preview-section">
              <div class="preview-label">挂载功能</div>
              <div class="preview-items">
                <span v-for="f in activeFunctions" :key="f.id" class="preview-tag"
                  :class="`tag-${functionPlatformColor(f.platformId)}`">
                  <span class="tag-dot"
                    :style="{ background: platformColorMap(functionPlatformColor(f.platformId)) }"></span>
                  {{ f.name }}
                </span>
                <span v-if="activeFunctions.length === 0" class="preview-empty">无</span>
              </div>
            </div>

            <div class="preview-section">
              <div class="preview-label">执行策略</div>
              <div class="preview-line">
                <strong>频率：</strong>{{ scheduleDescription }}
                <span v-if="pushChipNames.length > 0"> · <strong>推送至：</strong>{{ pushChipNames.join('、') }}</span>
              </div>
            </div>

            <div class="preview-section">
              <div class="preview-label">附加技能</div>
              <div class="preview-items">
                <span v-for="skill in allSkillNames" :key="skill.name" class="preview-tag"
                  :class="skill.isPlatform ? 'tag-purple' : 'tag-green'">
                  <span class="tag-dot" :style="{ background: skill.isPlatform ? '#7F77DD' : '#34A853' }"></span>
                  {{ skill.name }}{{ skill.isPlatform ? ' (平台)' : '' }}
                </span>
                <span v-if="allSkillNames.length === 0" class="preview-empty">无</span>
              </div>
            </div>

            <div class="preview-section">
              <div class="preview-label">执行提示词总览 <span class="prompt-readonly-tag">自动组装</span></div>
              <div class="prompt-preview-desc">
                <span>系统将自动执行以下操作：打开网站 → 登录 → 截取数据 → 推送至指定渠道</span>
              </div>
              <div class="prompt-preview-box">
                <div v-for="(seg, idx) in promptSegments" :key="idx" class="prompt-segment">
                  <span class="prompt-seg-tag" :class="`seg-${seg.type}`">{{ seg.label }}</span>
                  {{ seg.text }}
                </div>
              </div>
              <div class="prompt-supplement">
                <label class="prompt-supplement-label">补充要求 <span class="prompt-supplement-hint">（可选）</span></label>
                <NInput v-model:value="promptSupplement" type="textarea" placeholder="您还想补充或者修改什么需求，请写在这里" :rows="3" />
              </div>
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
</style>