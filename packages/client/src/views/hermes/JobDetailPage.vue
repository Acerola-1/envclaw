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
const expandedRuns = ref<Set<string>>(new Set())
const runContent = ref<Record<string, string>>({})
const runContentLoading = ref<Record<string, boolean>>({})

function runKey(run: RunEntry): string {
  if (!run) return '__undefined__'
  return `${run.jobId || '?'}/${run.fileName || '?'}`
}

async function loadRuns() {
  runsLoading.value = true
  try {
    const result = await listCronRuns(jobId.value)
    runs.value = Array.isArray(result) ? result.filter(r => r != null) : []
  } catch {
    runs.value = []
  } finally {
    runsLoading.value = false
  }
}

async function ensureRunContent(run: RunEntry): Promise<void> {
  if (!run) return
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

function toggleRunExpand(run: RunEntry) {
  if (!run) return
  const key = runKey(run)
  if (expandedRuns.value.has(key)) expandedRuns.value.delete(key)
  else { expandedRuns.value.add(key); ensureRunContent(run) }
  expandedRuns.value = new Set(expandedRuns.value)
}

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
    if (!run) continue
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
  const recent = [...runs.value].filter(r => r != null).sort((a, b) => (a.runTime < b.runTime ? 1 : -1)).slice(0, 5)
  await Promise.allSettled(recent.map(run => ensureRunContent(run)))
}

// ==================== Header / Actions ====================
const isPaused = computed(() => !!job.value && (!job.value.enabled || job.value.state === 'paused'))

function cronToHuman(cron: string): string {
  if (!cron || typeof cron !== 'string') return '—'
  const parts = cron.trim().split(/\s+/)
  if (parts.length < 5) return cron
  const [min, hour, dom, , dow] = parts
  if (min.startsWith('*/')) { const n = parseInt(min.slice(2)); return `每 ${n} 分钟` }
  if (hour.startsWith('*/')) { const n = parseInt(hour.slice(2)); return `每 ${n} 小时` }
  if (dow !== '*' && dom === '*') {
    const dayMap: Record<string, string> = { '1':'周一','2':'周二','3':'周三','4':'周四','5':'周五','6':'周六','0':'周日','7':'周日' }
    const days = dow.split(',').map(d => dayMap[d] || d).join('、')
    return `每${days} ${hour}:${min}`
  }
  if (dom !== '*') return `每月 ${dom} 日 ${hour}:${min}`
  if (dow === '*' && dom === '*') return `每天 ${hour}:${min}`
  return cron
}
const scheduleText = computed(() => {
  if (!job.value) return '—'
  try {
    const raw = scheduleToDisplayText(job.value.schedule, job.value.schedule_display || '—')
    if (/^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/.test(raw)) return cronToHuman(raw)
    return raw
  } catch { return job.value.schedule_display || '—' }
})

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
const previewImage = ref<string | null>(null)
function openPreview(url: string) { previewImage.value = url }
function closePreview() { previewImage.value = null }

const creatorName = computed<string>(() => {
  if (job.value?.origin?.chat_name) return job.value.origin.chat_name
  return '—'
})

// 成果数量
const artifactCount = computed<number>(() => outputArtifacts.value.length)

// 全部执行记录（默认展示所有）
const recentRuns = computed<RunEntry[]>(() => {
  return [...runs.value]
    .filter(r => r != null)
    .sort((a, b) => (a.runTime < b.runTime ? 1 : -1))
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

// 能力标签映射
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

// ==================== Lifecycle ====================
onMounted(async () => {
  try {
    await loadJob()
    await loadRuns()
    await loadOutputs()
  } catch (e) {
    console.error('JobDetailPage init error:', e)
    loading.value = false
  }
})

watch(jobId, () => {
  void loadJob()
  void loadRuns()
  expandedRuns.value = new Set()
  runContent.value = {}
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
        <!-- ==================== Hero 卡片 ==================== -->
        <div class="detail-hero">
          <div class="detail-hero-left">
            <a class="crt-back" @click="goBack">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              返回值守任务
            </a>
            <h1 class="job-name">{{ job.name }}</h1>
            <div class="detail-meta">
              <JobStatusPill :state="job.state" :enabled="job.enabled" :last-status="job.last_status" />
              <span class="meta-item">调度：<code>{{ scheduleText }}</code></span>
              <span class="meta-item">创建于 {{ new Date(job.created_at).toLocaleDateString('zh-CN') }}</span>
              <span class="meta-item" v-if="creatorName !== '—'">由 <b>{{ creatorName }}</b> 创建</span>
            </div>
          </div>
          <div class="page-actions">
            <button class="btn btn-default" @click="handleRun">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polygon points="5 3 19 12 5 21 5 3"/></svg>立即运行
            </button>
            <button class="btn btn-default" @click="handlePauseResume">
              <svg v-if="isPaused" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
              {{ isPaused ? '恢复' : '暂停' }}
            </button>
            <button class="btn btn-default" @click="handleEdit">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>编辑
            </button>
            <NPopconfirm @positive-click="handleDelete">
              <template #trigger>
                <button class="btn btn-default">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>删除
                </button>
              </template>
              确定要删除任务「{{ job.name }}」吗？此操作不可撤销。
            </NPopconfirm>
          </div>
        </div>

        <!-- ==================== 2列 Grid ==================== -->
        <div class="detail-grid">
          <!-- ① 任务概况 -->
          <section class="detail-section">
            <div class="detail-section-head">
              <div class="detail-section-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                任务概况
              </div>
            </div>
            <div class="detail-kv">
              <div class="kv"><span class="k">关联城市</span><span class="v">{{ cityName }}</span></div>
              <div class="kv"><span class="k">调度频率</span><span class="v mono">{{ scheduleText }}</span></div>
              <div class="kv"><span class="k">下次运行</span><span class="v highlight-time">{{ formatTime(job.next_run_at) || '—' }}</span></div>
              <div class="kv"><span class="k">推送渠道</span><span class="v">{{ formatDeliver(job.deliver) }}</span></div>
              <div class="kv"><span class="k">成果数量</span><span class="v">{{ artifactCount }} 项</span></div>
              <div class="kv"><span class="k">累计运行</span><span class="v mono">{{ runs.length }} 次</span></div>
              <div class="kv"><span class="k">运行模型</span><span class="v">{{ job.model || '默认（跟随全局设置）' }}</span></div>
              <div class="kv kv-full"><span class="k">描述</span><span class="v">{{ job.prompt_preview || job.prompt || '—' }}</span></div>
            </div>
          </section>

          <!-- ② 执行记录 -->
          <section class="detail-section">
            <div class="detail-section-head">
              <div class="detail-section-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                执行记录
              </div>
              <span class="more-link">共 {{ recentRuns.length }} 条</span>
            </div>
            <div v-if="runsLoading && runs.length === 0" class="empty-hint">加载中...</div>
            <div v-else-if="recentRuns.length === 0" class="empty-hint">暂无运行记录</div>
            <div v-else class="record-list">
              <div v-for="run in recentRuns" :key="runKey(run)" class="record-row">
                <span class="status-pill" :class="job.last_status === 'error' ? 'error' : 'success'">
                  <span class="pill-dot"></span>{{ job.last_status === 'error' ? '失败' : '成功' }}
                </span>
                <span class="record-time">{{ formatTime(run.runTime) }}</span>
                <span class="record-meta">{{ run.size > 1024 ? `${(run.size / 1024).toFixed(1)}KB` : `${run.size}B` }}</span>
                <a class="record-link" @click="toggleRunExpand(run)">
                  {{ expandedRuns.has(runKey(run)) ? '收起' : '查看输出' }}
                </a>
              </div>
            </div>
            <!-- 展开的运行日志 -->
            <div v-if="expandedRuns.has(runKey(run))" class="run-expand" style="margin-top:12px;max-height:240px;overflow-y:auto">
              <NSpin v-if="runContentLoading[runKey(run)]" size="small" />
              <pre v-else class="run-content">{{ runContent[runKey(run)] || '输出为空' }}</pre>
            </div>
          </section>

          <!-- ③ 能力清单 -->
          <section class="detail-section">
            <div class="detail-section-head">
              <div class="detail-section-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                能力清单
                <span v-if="manifestOutputs.length" class="count-tag">{{ manifestOutputs.length }}</span>
              </div>
              <router-link class="more-link" :to="{ name: 'hermes.capabilities' }">管理能力 →</router-link>
            </div>
            <div v-if="manifestOutputs.length === 0" class="empty-hint">未检测到成果执行清单</div>
            <div v-else class="cap-list">
              <div v-for="(output, index) in manifestOutputs" :key="output.id || `cap-${index}`" class="cap-row">
                <div class="cap-mono">{{ index % 2 === 0 ? '≋' : '◇' }}</div>
                <div class="cap-info">
                  <div class="cap-name">{{ capLabel(output.capability) }}</div>
                  <div class="cap-desc">{{ output.skill || '' }} {{ outputConfigRows(output.config).slice(0, 3).map(r => r.label + '：' + r.value).join(' · ') }}</div>
                </div>
                <span class="status-pill success"><span class="pill-dot"></span>已启用</span>
              </div>
            </div>
          </section>

          <!-- ④ 任务操作项 -->
          <section class="detail-section">
            <div class="detail-section-head">
              <div class="detail-section-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                任务操作项
              </div>
            </div>
            <div v-if="manifestOutputs.length === 0" class="empty-hint">暂无操作项</div>
            <div v-else class="op-list">
              <div v-for="(output, index) in manifestOutputs" :key="output.id || `op-${index}`" class="op-row">
                <span class="op-index">{{ index + 1 }}</span>
                <div class="op-info">
                  <div class="op-name">{{ capLabel(output.capability) }}</div>
                  <div class="op-desc">{{ output.skill || '执行能力任务' }}</div>
                </div>
                <span class="op-status success">已完成</span>
              </div>
            </div>
          </section>
        </div>

        <!-- ==================== ⑤ 成果区（全宽） ==================== -->
        <section class="detail-section detail-outputs">
          <div class="detail-section-head">
            <div class="detail-section-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              成果文件
              <span v-if="outputArtifacts.length" class="count-tag">{{ outputArtifacts.length }}</span>
            </div>
            <a class="more-link" @click="loadOutputs" style="cursor:pointer">重新扫描</a>
          </div>
          <div v-if="outputGroups.length === 0" class="empty-hint">
            {{ Object.values(runContentLoading).some(Boolean) ? '扫描中...' : '暂未扫描到成果文件' }}
          </div>
          <div v-else class="output-groups">
            <div v-for="group in outputGroups" :key="group.runTime" class="output-group">
              <div class="date-label">{{ formatTime(group.runTime) }}</div>
              <div class="output-grid">
                <div v-for="(a, i) in group.items" :key="`${a.runKey}-${i}`" class="output-card">
                  <div v-if="a.isImage" class="output-thumb" @click="openPreview(getFileDownloadUrl(a.filePath))" style="cursor:pointer" title="点击预览">
                    <img :src="getFileDownloadUrl(a.filePath)" :alt="a.fileName" loading="lazy" />
                  </div>
                  <div v-else class="output-file-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  </div>
                  <div class="output-body">
                    <div class="output-name" :title="a.fileName">{{ a.fileName }}</div>
                    <a class="output-dl" :href="getFileDownloadUrl(a.filePath)" :download="a.fileName">下载</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </template>
    </NSpin>

    <!-- Image preview overlay -->
    <Teleport to="body">
      <div v-if="previewImage" class="img-preview-overlay" @click="closePreview">
        <img :src="previewImage" @click.stop alt="预览" />
        <button class="img-preview-close" @click="closePreview">×</button>
      </div>
    </Teleport>
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

/* ==================== 返回链接 ==================== */
.crt-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: $text-secondary;
  cursor: pointer;
  background: none;
  border: none;
  font-family: inherit;
  text-decoration: none;
  margin-bottom: 14px;
  padding: 0;

  &:hover { color: $text-primary; }
}

/* ==================== Hero ==================== */
.detail-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 22px 24px;
  background: $bg-card;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  margin: 4px 0 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, .04);
}

.detail-hero-left {
  flex: 1;
  min-width: 0;
}

.detail-hero-left .job-name {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: .2px;
  margin: 0 0 10px;
  color: $text-primary;
}

.detail-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.meta-item {
  font-size: 12.5px;
  color: $text-secondary;
  display: inline-flex;
  align-items: center;
  gap: 4px;

  code {
    font-family: $font-code;
    background: $bg-secondary;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 11.5px;
    color: $text-primary;
  }

  b { color: $text-primary; font-weight: 600; }
}

.page-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 14px;
  border-radius: $radius-md;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: .15s;
  white-space: nowrap;
  text-decoration: none;
  font-family: inherit;

  svg { width: 14px; height: 14px; }
}

.btn-default {
  background: $bg-card;
  color: $text-primary;
  border-color: $border-color;

  &:hover { border-color: $border-strong; background: $bg-secondary; }
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
  transition: .15s;
  white-space: nowrap;
  font-family: inherit;

  &:hover { background: $bg-card-hover; color: $text-primary; }
}

/* ==================== 2列 Grid ==================== */
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  max-height: calc(100 * var(--vh) - 200px);
  overflow-y: auto;
}

.detail-section {
  background: $bg-card;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  padding: 20px 22px;
  max-height: 400px;
  overflow-y: auto;
}

.detail-outputs {
  margin-top: 16px;
}

.detail-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.detail-section-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: $text-primary;

  svg { color: $text-secondary; }
}

.count-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: rgba(var(--accent-primary-rgb), .1);
  color: $accent-primary;
  font-size: 11px;
  font-weight: 600;
}

.more-link {
  font-size: 12px;
  color: $text-secondary;
  text-decoration: none;

  &:hover { color: $accent-primary; }
}

.empty-hint {
  text-align: center;
  padding: 20px;
  color: $text-muted;
  font-size: 13px;
}

/* ==================== KV 概况 ==================== */
.detail-kv {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 18px;
}

.kv {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.kv-full { grid-column: 1 / -1; }

.kv .k {
  font-size: 11.5px;
  color: $text-muted;
  font-weight: 500;
}

.kv .v {
  font-size: 13px;
  color: $text-primary;

  &.mono {
    font-family: $font-code;
    font-size: 12px;
  }

  &.highlight-time {
    color: $success;
    font-weight: 500;
  }
}

/* ==================== 执行记录 ==================== */
.record-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.record-row {
  display: grid;
  grid-template-columns: 56px 1fr auto auto;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  background: $bg-secondary;
  border-radius: $radius-sm;
  font-size: 12.5px;
}

.record-time {
  font-family: $font-code;
  color: $text-primary;
  font-size: 12px;
}

.record-meta {
  color: $text-secondary;
  font-size: 12px;
}

.record-link {
  color: $accent-primary;
  text-decoration: none;
  font-size: 12px;
  cursor: pointer;

  &:hover { text-decoration: underline; }
}

/* ==================== 能力清单 ==================== */
.cap-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cap-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: $bg-secondary;
  border-radius: $radius-md;
}

.cap-mono {
  width: 36px;
  height: 36px;
  border-radius: $radius-sm;
  background: $bg-card;
  border: 1px solid $border-color;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: $accent-primary;
  flex-shrink: 0;
}

.cap-info {
  flex: 1;
  min-width: 0;
}

.cap-name {
  font-size: 13.5px;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: 3px;
}

.cap-desc {
  font-size: 12px;
  color: $text-secondary;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ==================== 任务操作项 ==================== */
.op-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.op-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: $bg-secondary;
  border-radius: $radius-sm;
}

.op-index {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: $bg-card;
  border: 1px solid $border-color;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: $text-secondary;
  flex-shrink: 0;
}

.op-info {
  flex: 1;
  min-width: 0;
}

.op-name {
  font-size: 13px;
  font-weight: 500;
  color: $text-primary;
}

.op-desc {
  font-size: 11.5px;
  color: $text-muted;
  margin-top: 2px;
}

.op-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 9px;
  font-weight: 500;
  flex-shrink: 0;
}

.op-status.success {
  background: rgba(var(--success-rgb), .12);
  color: $success;
}

/* ==================== Image preview ==================== */
.img-preview-overlay {
  position: fixed; inset: 0; z-index: 3000; background: rgba(0,0,0,.85);
  display: flex; align-items: center; justify-content: center; cursor: zoom-out;
  img { max-width: 90vw; max-height: 90vh; object-fit: contain; border-radius: 4px; }
}
.img-preview-close {
  position: absolute; top: 20px; right: 24px; width: 40px; height: 40px;
  border: none; background: rgba(255,255,255,.15); color: #fff; font-size: 22px;
  border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;
  &:hover { background: rgba(255,255,255,.3); }
}

/* ==================== 成果区 ==================== */
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

.date-label {
  font-size: 11px;
  font-weight: 600;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: .3px;
  padding: 4px 0;
  margin-bottom: 4px;
}

.output-card {
  background: $bg-card;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  &:hover { border-color: $accent-primary; }
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

  &:hover { background: rgba(var(--accent-primary-rgb), .08); }
}

/* ==================== 运行日志展开区 ==================== */
.run-content {
  font-family: $font-code;
  font-size: 12px;
  color: $text-secondary;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 360px;
  overflow-y: auto;
  margin: 0;
  padding: 12px;
  background: $bg-primary;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
}

/* ==================== Status Pill ==================== */
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 10px;
  border-radius: 11px;
  font-size: 11.5px;
  font-weight: 500;
  white-space: nowrap;

  .pill-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }

  &.success { background: rgba(var(--success-rgb), .12); color: $success; }
  &.running { background: rgba(var(--success-rgb), .12); color: $success; }
  &.paused { background: rgba(var(--warning-rgb), .15); color: $warning; }
  &.error { background: rgba(var(--error-rgb), .12); color: $error; }
  &.scheduled { background: rgba(var(--accent-primary-rgb), .10); color: $accent-primary; }
}

/* ==================== Error banner ==================== */
.error-banner {
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: $radius-sm;
  background: rgba(var(--error-rgb), .08);
  border: 1px solid rgba(var(--error-rgb), .25);
  color: $error;
  font-size: 12px;
}

/* ==================== Responsive ==================== */
@media (max-width: 980px) {
  .detail-grid { grid-template-columns: 1fr; }
  .detail-kv { grid-template-columns: 1fr; }
  .record-row { grid-template-columns: 56px 1fr; }
  .record-meta, .record-link { grid-column: 2; }
  .detail-hero { flex-direction: column; }
}
</style>
