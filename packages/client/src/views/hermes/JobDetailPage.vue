<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NSpin, NEmpty, NPopconfirm, useMessage } from 'naive-ui'
import { getJob, deleteJob, pauseJob, resumeJob, runJob, scheduleToDisplayText } from '@/api/hermes/jobs'
import type { Job } from '@/api/hermes/jobs'
import { listCronRuns, readCronRun } from '@/api/hermes/cron-history'
import type { RunEntry, RunDetail } from '@/api/hermes/cron-history'
import { getFileDownloadUrl } from '@/api/hermes/files'
import JobStatusPill from '@/components/envclaw/jobs/JobStatusPill.vue'

const route = useRoute()
const router = useRouter()
const message = useMessage()

// ==================== Job ====================
const job = ref<Job | null>(null)
const loading = ref(true)
const notFound = ref(false)

const jobId = computed(() => route.params.id as string)

async function loadJob() {
  loading.value = true
  notFound.value = false
  try {
    job.value = await getJob(jobId.value)
  } catch {
    job.value = null
    notFound.value = true
  } finally {
    loading.value = false
  }
}

// ==================== Run Log ====================
const runs = ref<RunEntry[]>([])
const runsLoading = ref(false)
const expandedRun = ref<string | null>(null)
const runContent = ref<Record<string, string>>({})
const runContentLoading = ref<Record<string, boolean>>({})

function runKey(run: RunEntry): string {
  return `${run.jobId}/${run.fileName}`
}

async function loadRuns() {
  runsLoading.value = true
  try {
    runs.value = await listCronRuns(jobId.value)
  } catch {
    runs.value = []
  } finally {
    runsLoading.value = false
  }
}

async function ensureRunContent(run: RunEntry): Promise<void> {
  const key = runKey(run)
  if (runContent.value[key] || runContentLoading.value[key]) return
  runContentLoading.value[key] = true
  try {
    const detail: RunDetail = await readCronRun(run.jobId, run.fileName)
    runContent.value[key] = detail.content
  } catch {
    runContent.value[key] = ''
  } finally {
    runContentLoading.value[key] = false
  }
}

async function toggleRunExpand(run: RunEntry) {
  const key = runKey(run)
  if (expandedRun.value === key) {
    expandedRun.value = null
    return
  }
  expandedRun.value = key
  await ensureRunContent(run)
}

// 按日期分组，最近在前
const runGrouped = computed(() => {
  const groups: Record<string, RunEntry[]> = {}
  for (const run of runs.value) {
    const date = new Date(run.runTime).toLocaleDateString()
    if (!groups[date]) groups[date] = []
    groups[date].push(run)
  }
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
})

// ==================== Outputs (成果) ====================
interface Artifact {
  runKey: string
  runTime: string
  fileName: string
  filePath: string
  isImage: boolean
}

const outputArtifacts = computed<Artifact[]>(() => {
  const artifacts: Artifact[] = []
  for (const run of runs.value) {
    const content = runContent.value[runKey(run)]
    if (!content) continue
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!/^(MEDIA:|ARTIFACT:)/i.test(trimmed)) continue
      const path = trimmed.slice(trimmed.indexOf(':') + 1).trim()
      if (!path) continue
      const fileName = path.split(/[\\/]/).pop() || path
      artifacts.push({
        runKey: runKey(run),
        runTime: run.runTime,
        fileName,
        filePath: path,
        isImage: /\.(png|jpe?g|gif|webp|bmp)$/i.test(fileName),
      })
    }
  }
  return artifacts
})

// 成果按运行时间分组（最近在前）
const outputGroups = computed(() => {
  const groups: { runTime: string; items: Artifact[] }[] = []
  for (const a of outputArtifacts.value) {
    let g = groups.find(x => x.runTime === a.runTime)
    if (!g) {
      g = { runTime: a.runTime, items: [] }
      groups.push(g)
    }
    g.items.push(a)
  }
  return groups.sort((a, b) => (a.runTime < b.runTime ? 1 : -1))
})

async function loadOutputs() {
  if (runs.value.length === 0 && !runsLoading.value) await loadRuns()
  const recent = [...runs.value].sort((a, b) => (a.runTime < b.runTime ? 1 : -1)).slice(0, 5)
  await Promise.allSettled(recent.map(run => ensureRunContent(run)))
}

// ==================== Header / Actions ====================
const isPaused = computed(() => !!job.value && (!job.value.enabled || job.value.state === 'paused'))

const scheduleText = computed(() =>
  job.value ? scheduleToDisplayText(job.value.schedule, job.value.schedule_display || '—') : '—',
)

// 从 prompt 中解析城市名称
const cityName = computed<string>(() => {
  if (!job.value?.prompt) return '—'
  const patterns = [
    /(平顶山市|北京市|上海市|天津市|重庆市|郑州市|武汉市|成都市|广州市|深圳市|南京市|杭州市|长沙市|合肥市|南昌市|福州市|厦门市|南宁市|贵阳市|昆明市|拉萨市|西安市|兰州市|西宁市|银川市|乌鲁木齐市|石家庄市|太原市|呼和浩特市|沈阳市|长春市|哈尔滨市|济南市|青岛市|平阴县|平顶山)/,
    /(?:城市|行政区|地区)[：:]\s*(\S+?)(?:\s|$|,|，|。)/,
  ]
  for (const re of patterns) {
    const m = job.value.prompt.match(re)
    if (m) return m[1] || m[0]
  }
  return '—'
})

// 创建者名称
const creatorName = computed<string>(() => {
  if (job.value?.origin?.chat_name) return job.value.origin.chat_name
  return '—'
})

// 成果数量
const artifactCount = computed<number>(() => outputArtifacts.value.length)

// 最近 5 条执行记录
const recentRuns = computed<RunEntry[]>(() => {
  return [...runs.value]
    .sort((a, b) => (a.runTime < b.runTime ? 1 : -1))
    .slice(0, 5)
})

async function handlePauseResume() {
  try {
    if (isPaused.value) {
      await resumeJob(jobId.value)
      message.success('任务已恢复')
    } else {
      await pauseJob(jobId.value)
      message.success('任务已暂停')
    }
    await loadJob()
  } catch (e: any) {
    message.error('操作失败: ' + (e.message || e))
  }
}

async function handleRun() {
  try {
    await runJob(jobId.value)
    message.success('已触发立即运行')
    await loadJob()
  } catch (e: any) {
    message.error('触发失败: ' + (e.message || e))
  }
}

async function handleDelete() {
  try {
    await deleteJob(jobId.value)
    message.success('任务已删除')
    router.push({ name: 'hermes.duty' })
  } catch (e: any) {
    message.error('删除失败: ' + (e.message || e))
  }
}

function handleEdit() {
  router.push({ name: 'hermes.dutyCreate', query: { edit: jobId.value } })
}

function goBack() {
  router.push({ name: 'hermes.duty' })
}

// ==================== Config helpers ====================
function platformName(key: string): string {
  const names: Record<string, string> = {
    wecom: '企业微信', dingtalk: '钉钉', feishu: '飞书', qqbot: 'QQBot',
    telegram: 'Telegram', discord: 'Discord', slack: 'Slack', whatsapp: 'WhatsApp',
    email: '邮件', webhook: 'Webhook', local: '本地', origin: '原路返回',
  }
  return names[key] || key
}

function formatDeliver(deliver: string | null | undefined): string {
  if (!deliver) return '—'
  const parts = deliver.split(':')
  const channelName = platformName(parts[0])
  if (parts.length > 1 && parts[1]) return `${channelName} · ${parts[1]}`
  return channelName
}

function repeatLabel(repeat: Job['repeat']): string {
  if (!repeat) return '无限'
  if (typeof repeat === 'string') return repeat
  if (repeat.times === null || repeat.times === undefined) return '无限'
  return `${repeat.completed || 0} / ${repeat.times}`
}

function formatTime(time: string | null | undefined): string {
  if (!time) return '—'
  const d = new Date(time)
  if (Number.isNaN(d.getTime())) return time
  return d.toLocaleString()
}

// ---- 能力 / 技能 / 连接器（从 prompt 的【成果执行清单】反解析） ----
interface ManifestOutput {
  id?: string
  capability?: string
  skill?: string | null
  config?: Record<string, any>
}

const manifestOutputs = computed<ManifestOutput[]>(() => {
  if (!job.value?.prompt) return []
  const match = job.value.prompt.match(/【成果执行清单】\n([\s\S]*?)(?=\n\n【|$)/)
  if (!match) return []
  try {
    const parsed = JSON.parse(match[1].trim())
    return Array.isArray(parsed?.outputs) ? parsed.outputs : []
  } catch {
    return []
  }
})

const skillsList = computed<string[]>(() => {
  if (!job.value) return []
  const list = [...(job.value.skills || [])]
  if (job.value.skill && !list.includes(job.value.skill)) list.push(job.value.skill)
  return list
})

// Job 模型暂未提供连接器字段；保留扩展位，有数据时展示
const connectorsList = computed<string[]>(() => [])

const capabilityMeta: Record<string, { name: string; desc: string }> = {
  'mapairs-ranking-capture': { name: '浓度排名', desc: '城市/站点浓度排名查询，生成可视化排名截图并附数据文字总结后推送。' },
  'mapairs-onemap-capture': { name: '一张图', desc: '生成数智大气一张图成果，设置地图范围、时间类型、监测图/插值图、因子、风场与图层。' },
  'mapairs-hourly-brief': { name: '小时播报', desc: '定位小时播报页面，勾选行政区与污染因子，截取页面图片。' },
  'mapairs-monitoring-data': { name: '监测数据', desc: '提取各点位小时/分钟监测数据，覆盖 PM₂.₅、AQI、O₃ 等，按站点结构化输出。' },
}

function capLabel(capability?: string): string {
  if (!capability) return '未知成果'
  return capabilityMeta[capability]?.name || capability
}

const CONFIG_LABELS: Record<string, string> = {
  zone: '查询范围', region: '行政区', province: '省份', stationType: '站点类型', station: '站点',
  type: '数据口径', factors: '污染因子', includeScreenshot: '截图', theme: '颜色', gbKey: '国标类型',
  mode: '地图类型', zoom: '缩放等级', factor: '因子', windWaves: '风/海浪', timeType: '时间类型',
  leftPanel: '左侧面板', township: '乡镇', customRange: '自定义时间', includeAnalysis: '数据分析',
}

function formatConfigValue(v: any): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? '是' : '否'
  if (Array.isArray(v)) return v.length ? v.map(formatConfigValue).join('、') : '—'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

const CONFIG_VALUE_FORMATTERS: Record<string, (v: any) => string> = {
  zone: v => (v === 'site' ? '站点' : v === 'city' ? '城市' : formatConfigValue(v)),
  theme: v => (v === 'light' ? '浅色' : v === 'dark' ? '深色' : formatConfigValue(v)),
  gbKey: v => ({ '2': '新', '0': '默认', '1': '旧' })[v as string] || formatConfigValue(v),
  type: v =>
    ({ hourly: '实时', daily_count: '日累计', daily: '日', month: '月', year: '年', other: '自定义' })[v as string] ||
    formatConfigValue(v),
  timeType: v => ({ hourly: '实时', dt: '累计', daily: '日' })[v as string] || formatConfigValue(v),
  mode: v => (v === 'monitoring' ? '监测图' : v === 'interpolation' ? '插值图' : formatConfigValue(v)),
  includeScreenshot: v => (v ? '是' : '否'),
  includeAnalysis: v => (v ? '是' : '否'),
  windWaves: v => (v ? '开' : '关'),
  leftPanel: v => (v ? '显示' : '关闭'),
}

function outputConfigRows(config: Record<string, any> | undefined): { label: string; value: string }[] {
  if (!config) return []
  return Object.entries(config).map(([k, v]) => ({
    label: CONFIG_LABELS[k] || k,
    value: CONFIG_VALUE_FORMATTERS[k] ? CONFIG_VALUE_FORMATTERS[k](v) : formatConfigValue(v),
  }))
}

// 配置 Tab 中能力卡片是否展开参数
const expandedCap = ref<string | null>(null)

function toggleCap(id: string | undefined, index: number) {
  const key = id || `cap-${index}`
  expandedCap.value = expandedCap.value === key ? null : key
}

// ==================== Lifecycle ====================
onMounted(() => {
  void loadJob()
  void loadRuns()
  void loadOutputs()
})

watch(jobId, () => {
  void loadJob()
  void loadRuns()
  expandedRun.value = null
  runContent.value = {}
  expandedCap.value = null
})

</script>

<template>
  <div class="detail-page">
    <NSpin :show="loading">
      <!-- 未找到 -->
      <div v-if="!loading && notFound" class="not-found">
        <NEmpty description="未找到该任务" />
        <button class="back-btn" @click="goBack">返回任务列表</button>
      </div>

      <template v-else-if="job">
        <!-- ==================== 头部：任务名 / 状态 / 调度 / 操作栏 ==================== -->
        <div class="detail-header">
          <button class="back-btn" @click="goBack">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            返回
          </button>

          <div class="header-main">
            <div class="header-title-row">
              <h1 class="job-name">{{ job.name }}</h1>
              <JobStatusPill :state="job.state" :enabled="job.enabled" :last-status="job.last_status" />
            </div>
            <div class="header-schedule">
              <span class="schedule-chip">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {{ scheduleText }}
              </span>
              <span class="schedule-next">下次运行：{{ formatTime(job.next_run_at) }}</span>
            </div>
          </div>

          <div class="header-actions">
            <button class="action-btn" @click="handleEdit">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />
              </svg>
              编辑
            </button>
            <button class="action-btn" @click="handlePauseResume">
              <svg v-if="isPaused" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
              {{ isPaused ? '恢复' : '暂停' }}
            </button>
            <button class="action-btn" @click="handleRun">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              立即运行
            </button>
            <NPopconfirm @positive-click="handleDelete">
              <template #trigger>
                <button class="action-btn danger">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  删除
                </button>
              </template>
              确定要删除任务「{{ job.name }}」吗？此操作不可撤销。
            </NPopconfirm>
          </div>
        </div>

        <!-- ==================== Tab 切换 ==================== -->
        <div class="detail-tabs">
          <button class="tab-btn" :class="{ active: activeTab === 'config' }" @click="activeTab = 'config'">配置</button>
          <button class="tab-btn" :class="{ active: activeTab === 'runlog' }" @click="activeTab = 'runlog'">运行日志</button>
          <button class="tab-btn" :class="{ active: activeTab === 'outputs' }" @click="activeTab = 'outputs'">成果</button>
        </div>

        <!-- ==================== Tab 1: 配置 ==================== -->
        <div v-if="activeTab === 'config'" class="tab-panel">
          <div class="config-card">
            <div class="card-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
              </svg>
              能力清单
              <span v-if="manifestOutputs.length" class="card-count">{{ manifestOutputs.length }}</span>
            </div>
            <div v-if="manifestOutputs.length" class="cap-list">
              <div
                v-for="(output, index) in manifestOutputs"
                :key="output.id || `cap-${index}`"
                class="cap-item"
                :class="{ expanded: expandedCap === (output.id || `cap-${index}`) }"
              >
                <div class="cap-item-head" @click="toggleCap(output.id, index)">
                  <svg
                    class="expand-arrow"
                    :class="{ expanded: expandedCap === (output.id || `cap-${index}`) }"
                    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                  <span class="cap-item-name">{{ capLabel(output.capability) }}</span>
                  <span v-if="output.skill" class="cap-item-skill">{{ output.skill }}</span>
                </div>
                <div v-if="expandedCap === (output.id || `cap-${index}`)" class="cap-item-params">
                  <div v-if="outputConfigRows(output.config).length" class="params-grid">
                    <div v-for="row in outputConfigRows(output.config)" :key="row.label" class="param-row">
                      <span class="param-label">{{ row.label }}</span>
                      <span class="param-value">{{ row.value }}</span>
                    </div>
                  </div>
                  <div v-else class="param-empty">该成果无可展开参数</div>
                </div>
              </div>
            </div>
            <div v-else class="card-empty">未检测到成果执行清单</div>
          </div>

          <div class="config-row">
            <div class="config-card half">
              <div class="card-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                </svg>
                技能
              </div>
              <div v-if="skillsList.length" class="chip-wrap">
                <span v-for="skill in skillsList" :key="skill" class="chip">{{ skill }}</span>
              </div>
              <div v-else class="card-empty">无关联技能</div>
            </div>

            <div class="config-card half">
              <div class="card-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                  <rect x="2" y="7" width="20" height="14" rx="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
                连接器
              </div>
              <div v-if="connectorsList.length" class="chip-wrap">
                <span v-for="conn in connectorsList" :key="conn" class="chip">{{ conn }}</span>
              </div>
              <div v-else class="card-empty">暂无关联连接器</div>
            </div>
          </div>

          <div class="config-card">
            <div class="card-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
              </svg>
              推送渠道
            </div>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">推送渠道</span>
                <span class="info-value">{{ formatDeliver(job.deliver) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">上次推送</span>
                <span class="info-value">{{ formatTime(job.last_run_at) }}</span>
              </div>
            </div>
            <div v-if="job.last_delivery_error" class="error-banner">
              上次推送失败：{{ job.last_delivery_error }}
            </div>
          </div>

          <div class="config-card">
            <div class="card-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              调度规则
            </div>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">调度频率</span>
                <code class="info-value mono">{{ scheduleText }}</code>
              </div>
              <div class="info-item">
                <span class="info-label">启用状态</span>
                <span class="info-value">{{ job.enabled ? '已启用' : '已禁用' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">重复次数</span>
                <span class="info-value">{{ repeatLabel(job.repeat) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">下次运行</span>
                <span class="info-value">{{ formatTime(job.next_run_at) }}</span>
              </div>
            </div>
          </div>

          <div class="config-card">
            <div class="card-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                <rect x="4" y="2" width="16" height="20" rx="2" />
                <line x1="8" y1="6" x2="16" y2="6" />
                <line x1="8" y1="10" x2="16" y2="10" />
                <line x1="8" y1="14" x2="12" y2="14" />
              </svg>
              模型与执行提示词
            </div>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">使用模型</span>
                <span class="info-value">{{ job.model || '—' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Provider</span>
                <span class="info-value">{{ job.provider || '—' }}</span>
              </div>
            </div>
            <pre class="prompt-preview">{{ job.prompt_preview || job.prompt || '—' }}</pre>
          </div>
        </div>

        <!-- ==================== Tab 2: 运行日志 ==================== -->
        <div v-if="activeTab === 'runlog'" class="tab-panel">
          <div v-if="job.last_error" class="error-banner">最近一次运行失败：{{ job.last_error }}</div>
          <NSpin :show="runsLoading && runs.length === 0">
            <div v-if="!runsLoading && runs.length === 0" class="tab-empty">
              <NEmpty description="暂无运行记录" />
            </div>
            <div v-else class="run-list">
              <div v-for="[date, dateRuns] in runGrouped" :key="date" class="date-group">
                <div class="date-label">{{ date }}</div>
                <div
                  v-for="run in dateRuns"
                  :key="runKey(run)"
                  class="run-item"
                  :class="{ expanded: expandedRun === runKey(run) }"
                >
                  <div class="run-item-head" @click="toggleRunExpand(run)">
                    <svg
                      class="expand-arrow"
                      :class="{ expanded: expandedRun === runKey(run) }"
                      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                    <span class="run-time">{{ new Date(run.runTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span>
                    <span class="run-size">{{ run.size > 1024 ? `${(run.size / 1024).toFixed(1)}KB` : `${run.size}B` }}</span>
                  </div>
                  <div v-if="expandedRun === runKey(run)" class="run-item-body">
                    <NSpin v-if="runContentLoading[runKey(run)]" size="small" />
                    <div v-else-if="runContent[runKey(run)]" class="run-output">
                      <div class="run-output-label">stdout / stderr 输出</div>
                      <pre class="run-content">{{ runContent[runKey(run)] }}</pre>
                    </div>
                    <div v-else class="param-empty">输出为空或加载失败</div>
                  </div>
                </div>
              </div>
            </div>
          </NSpin>
        </div>

        <!-- ==================== Tab 3: 成果 ==================== -->
        <div v-if="activeTab === 'outputs'" class="tab-panel">
          <div class="outputs-toolbar">
            <span class="outputs-hint">成果来源：最近 5 次运行中 MEDIA:/ARTIFACT: 声明的文件</span>
            <button class="action-btn sm" @click="loadOutputs">重新扫描</button>
          </div>
          <NSpin :show="outputGroups.length === 0 && Object.values(runContentLoading).some(Boolean)">
            <div v-if="outputGroups.length === 0" class="tab-empty">
              <NEmpty description="暂未扫描到成果文件" />
            </div>
            <div v-else class="output-groups">
              <div v-for="group in outputGroups" :key="group.runTime" class="output-group">
                <div class="date-label">{{ formatTime(group.runTime) }}</div>
                <div class="output-grid">
                  <div v-for="(a, i) in group.items" :key="`${a.runKey}-${i}`" class="output-card">
                    <div v-if="a.isImage" class="output-thumb">
                      <img :src="getFileDownloadUrl(a.filePath)" :alt="a.fileName" loading="lazy" />
                    </div>
                    <div v-else class="output-file-icon">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <div class="output-body">
                      <div class="output-name" :title="a.fileName">{{ a.fileName }}</div>
                      <a class="output-dl" :href="getFileDownloadUrl(a.filePath)" :download="a.fileName">下载</a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </NSpin>
        </div>
      </template>
    </NSpin>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.detail-page {
  height: 100%;
  overflow-y: auto;
  padding: 24px 28px;
}

.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px 0;
}

/* ==================== Header ==================== */
.detail-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 18px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: $radius-sm;
  font-size: 13px;
  color: $text-secondary;
  background: transparent;
  border: 1px solid $border-color;
  cursor: pointer;
  transition: 0.15s;
  white-space: nowrap;

  &:hover {
    background: $bg-card-hover;
    color: $text-primary;
  }
}

.header-main {
  flex: 1;
  min-width: 0;
}

.header-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.job-name {
  font-size: 18px;
  font-weight: 600;
  color: $text-primary;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-schedule {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.schedule-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 999px;
  background: $bg-card;
  border: 1px solid $border-color;
  color: $text-secondary;
  font-size: 12px;
  font-family: $font-code;
}

.schedule-next {
  font-size: 12px;
  color: $text-muted;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  border-radius: $radius-sm;
  font-size: 13px;
  font-weight: 500;
  background: $bg-card;
  border: 1px solid $border-color;
  color: $text-secondary;
  cursor: pointer;
  transition: 0.15s;
  white-space: nowrap;

  &:hover {
    border-color: $accent-primary;
    color: $accent-primary;
  }

  &.danger:hover {
    border-color: $error;
    color: $error;
  }

  &.sm {
    padding: 5px 10px;
    font-size: 12px;
  }
}

/* ==================== Tabs ==================== */
.detail-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid $border-color;
  margin-bottom: 18px;
}

.tab-btn {
  padding: 9px 22px;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: $text-secondary;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: 0.15s;
  margin-bottom: -1px;

  &:hover {
    color: $text-primary;
  }

  &.active {
    color: $accent-primary;
    border-bottom-color: $accent-primary;
    font-weight: 600;
  }
}

/* ==================== Config Tab ==================== */
.config-card {
  background: $bg-card;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  padding: 16px 20px;
  margin-bottom: 14px;
}

.config-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;

  .config-card {
    margin-bottom: 0;
  }
}

.card-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: 12px;

  svg {
    color: $accent-primary;
  }
}

.card-count {
  padding: 0 7px;
  border-radius: 9px;
  background: rgba(var(--accent-primary-rgb), 0.1);
  color: $accent-primary;
  font-size: 11px;
  font-weight: 600;
}

.card-empty,
.param-empty {
  font-size: 12px;
  color: $text-muted;
  padding: 6px 0;
}

/* 能力清单 */
.cap-item {
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  margin-bottom: 8px;
  overflow: hidden;

  &.expanded {
    border-color: $accent-primary;
  }
}

.cap-item-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: $bg-card-hover;
  }
}

.expand-arrow {
  color: $text-muted;
  transition: transform 0.15s;
  flex-shrink: 0;

  &.expanded {
    transform: rotate(180deg);
  }
}

.cap-item-name {
  font-size: 13px;
  font-weight: 600;
  color: $text-primary;
}

.cap-item-skill {
  font-size: 11px;
  color: $text-muted;
  padding: 1px 7px;
  border-radius: 9px;
  background: $bg-secondary;
  margin-left: auto;
}

.cap-item-params {
  border-top: 1px solid $border-light;
  padding: 12px;
  background: $bg-primary;
}

.params-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px 18px;
}

.param-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.param-label {
  font-size: 11px;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.param-value {
  font-size: 12px;
  color: $text-secondary;
  word-break: break-all;
}

/* 技能 / 连接器 chips */
.chip-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: rgba(var(--accent-primary-rgb), 0.06);
  border: 1px solid $border-color;
  color: $text-secondary;
}

/* 推送渠道 / 调度规则 */
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px 20px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.info-label {
  font-size: 11px;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.info-value {
  font-size: 13px;
  color: $text-primary;
  word-break: break-all;

  &.mono {
    font-family: $font-code;
    font-size: 12px;
  }
}

.error-banner {
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: $radius-sm;
  background: rgba(var(--error-rgb), 0.08);
  border: 1px solid rgba(var(--error-rgb), 0.25);
  color: $error;
  font-size: 12px;
  word-break: break-all;
}

.prompt-preview {
  font-size: 12px;
  color: $text-secondary;
  background: $bg-primary;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  padding: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 220px;
  overflow-y: auto;
  font-family: $font-code;
  margin: 12px 0 0;
}

/* ==================== Run Log Tab ==================== */
.tab-panel {
  min-height: 200px;
}

.tab-empty {
  padding: 40px 0;
}

.run-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.date-group {
  margin-bottom: 4px;
}

.date-label {
  font-size: 11px;
  font-weight: 600;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  padding: 4px 0;
  margin-bottom: 4px;
}

.run-item {
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  margin-bottom: 6px;
  overflow: hidden;

  &.expanded {
    border-color: $accent-primary;
  }
}

.run-item-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: $bg-card-hover;
  }
}

.run-time {
  font-size: 12px;
  color: $text-secondary;
  flex: 1;
}

.run-size {
  font-size: 11px;
  color: $text-muted;
  font-family: $font-code;
}

.run-item-body {
  border-top: 1px solid $border-light;
  padding: 12px;
  background: $bg-primary;
}

.run-output-label {
  font-size: 11px;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: 8px;
}

.run-content {
  font-family: $font-code;
  font-size: 12px;
  color: $text-secondary;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 360px;
  overflow-y: auto;
  margin: 0;
}

/* ==================== Outputs Tab ==================== */
.outputs-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 10px;
}

.outputs-hint {
  font-size: 12px;
  color: $text-muted;
}

.output-groups {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.output-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.output-card {
  background: $bg-card;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  &:hover {
    border-color: $accent-primary;
  }
}

.output-thumb {
  aspect-ratio: 16 / 10;
  background: $bg-secondary;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}

.output-file-icon {
  aspect-ratio: 16 / 7;
  background: $bg-secondary;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $text-muted;
}

.output-body {
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.output-name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: $text-primary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.output-dl {
  flex-shrink: 0;
  font-size: 12px;
  color: $accent-primary;
  text-decoration: none;
  padding: 3px 10px;
  border: 1px solid $accent-primary;
  border-radius: $radius-sm;

  &:hover {
    background: rgba(var(--accent-primary-rgb), 0.08);
  }
}

@media (max-width: 768px) {
  .config-row {
    grid-template-columns: 1fr;
  }
}
</style>
