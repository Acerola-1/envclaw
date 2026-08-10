<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useJobsStore } from '@/stores/hermes/jobs'
import { listCronRuns, type RunEntry } from '@/api/hermes/cron-history'
import type { Job } from '@/api/hermes/jobs'

const router = useRouter()
const route = useRoute()
const jobsStore = useJobsStore()

// ---- Secondary tabs ----
const activeTab = ref<'jobs' | 'runlog'>('jobs')

// ---- Real data from store ----
const jobs = computed<Job[]>(() => jobsStore.jobs)
const loading = computed(() => jobsStore.loading)

// ---- Deliver channel label map ----
const deliverLabel: Record<string, string> = { wecom:'企业微信', dingtalk:'钉钉', feishu:'飞书', local:'本地', wecom_webhook:'企业微信', dingtalk_webhook:'钉钉', feishu_webhook:'飞书', mail:'邮件', smtp:'邮件' }

// ---- Status helpers ----
function statusOf(j: Job): [string, string] {
  if (j.state === 'paused') return ['已暂停', 'paused']
  if (!j.enabled) return ['已暂停', 'paused']
  if (j.last_status === 'error') return ['异常', 'error']
  if (j.state === 'running' || j.state === 'scheduled') return ['运行中', 'running']
  return ['已调度', 'scheduled']
}
function cronToHuman(cron: string): string {
  if (!cron || typeof cron !== 'string') return '—'
  const parts = cron.trim().split(/\s+/)
  if (parts.length < 5) return cron
  const [min, hour, dom, _month, dow] = parts
  if (min.startsWith('*/')) { const n = parseInt(min.slice(2)); return n <= 1 ? '每分钟' : `每 ${n} 分钟` }
  if (hour.startsWith('*/')) { const n = parseInt(hour.slice(2)); return n <= 1 ? '每小时' : `每 ${n} 小时` }
  if (dow !== '*' && dom === '*') {
    const dayMap: Record<string, string> = { '1':'周一','2':'周二','3':'周三','4':'周四','5':'周五','6':'周六','0':'周日','7':'周日' }
    const days = dow.split(',').map((d: string) => dayMap[d] || d).join('、')
    return `每${days} ${hour}:${min}`
  }
  if (dom !== '*' && dom !== '*') return `每月 ${dom} 日 ${hour}:${min}`
  if (dow === '*' && dom === '*') return `每天 ${hour}:${min}`
  return cron
}
function humanState(s: string): string {
  const m: Record<string, string> = { running: '运行中', paused: '已暂停', scheduled: '已调度', failed: '失败' }
  return m[s] || s
}

function formatNextRun(j: Job): string {
  if (j.state === 'paused' || !j.enabled) return '—'
  if (!j.next_run_at) return '—'
  const d = new Date(j.next_run_at)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  if (diffMs < 0) return '—'
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 60) return `${diffMin} 分钟后`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} 小时后`
  return d.toLocaleDateString('zh-CN', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
}

function formatLastRun(j: Job): string {
  if (!j.last_run_at) return '—'
  const d = new Date(j.last_run_at)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} 小时前`
  return d.toLocaleDateString('zh-CN', { month:'short', day:'numeric' })
}

function lastRunLabel(j: Job): [string, string] {
  if (j.last_status === 'error') return [j.last_error?.split('\n')[0]?.slice(0, 20) || '执行失败', 'error']
  if (j.last_status === 'ok') return ['成功', 'success']
  return ['—', '']
}

function deliverName(j: Job): string {
  const d = j.deliver || 'local'
  for (const [k, v] of Object.entries(deliverLabel)) {
    if (d.includes(k)) return v
  }
  return d
}

// ---- Computed stats ----
const jobStats = computed(() => {
  const list = jobs.value
  return {
    running: list.filter(j => j.enabled && j.state !== 'paused').length,
    paused: list.filter(j => j.state === 'paused' || !j.enabled).length,
    ended: 0,
    error: list.filter(j => j.last_status === 'error').length,
  }
})

// ---- View mode (list / kanban) ----
const viewMode = ref<'list' | 'kanban'>('list')
const jobSearch = ref('')

const filteredJobs = computed(() => {
  const kw = jobSearch.value.trim().toLowerCase()
  if (!kw) return jobs.value
  return jobs.value.filter(j => j.name.toLowerCase().includes(kw))
})

const jobGroups = computed(() => {
  const list = filteredJobs.value
  return [
    { key:'running', label:'运行中', dot:'var(--success)', items: list.filter(j => j.enabled && j.state !== 'paused') },
    { key:'paused',  label:'已暂停', dot:'var(--warning)', items: list.filter(j => j.state === 'paused' || !j.enabled) },
  ].filter(g => g.items.length > 0)
})

// ---- Kanban columns ----
const kanbanCols = computed(() => [
  { key:'running', label:'运行中', dot:'running', items: filteredJobs.value.filter(j => j.enabled && j.state !== 'paused') },
  { key:'paused',  label:'已暂停', dot:'paused',  items: filteredJobs.value.filter(j => j.state === 'paused' || !j.enabled) },
])

// ---- Run log data (real API) ----
const allRuns = ref<RunEntry[]>([])
const runlogLoading = ref(false)

interface RunLogRun { time: string; status: string; runId: string; duration: string; error?: string }
interface RunLogTask { taskId: string; name: string; deliver: string; stats: { total: number; ok: number; fail: number }; runs: RunLogRun[] }

const runlogStats = computed(() => {
  const runs = allRuns.value
  const total = runs.length
  const ok = runs.filter(r => r.status === 'ok' || (!r.status && !r.error)).length
  const fail = runs.filter(r => r.status === 'error' || (!r.status && r.error)).length
  const known = ok + fail
  const rate = known > 0 ? ((ok / known) * 100).toFixed(1) : '0.0'
  return { total, ok, fail, rate }
})

// ---- Run log filters ----
const runlogDateFilter = ref('all')
const runlogStatusFilter = ref('all')
const runlogSearch = ref('')

const runlogDateOptions = [
  { value: 'all', label: '全部' },
  { value: 'today', label: '今日' },
  { value: 'week', label: '本周' },
  { value: '7days', label: '近 7 天' },
  { value: '30days', label: '近 30 天' },
]

const runlogStatusOptions = computed(() => {
  const statusSet = new Set<string>()
  allRuns.value.forEach(r => {
    statusSet.add(r.status || 'unknown')
  })
  const opts: { value: string; label: string }[] = [{ value: 'all', label: '全部' }]
  if (statusSet.has('ok')) opts.push({ value: 'ok', label: '成功' })
  if (statusSet.has('error')) opts.push({ value: 'error', label: '失败' })
  if (statusSet.has('unknown')) opts.push({ value: 'unknown', label: '未知' })
  return opts
})

function isDateInRange(runTime: string, filter: string): boolean {
  if (filter === 'all') return true
  const runDate = new Date(runTime)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (filter) {
    case 'today': return runDate >= today
    case 'week': {
      const day = now.getDay()
      const mondayOffset = day === 0 ? -6 : 1 - day
      const monday = new Date(today)
      monday.setDate(monday.getDate() + mondayOffset)
      return runDate >= monday
    }
    case '7days': {
      const d = new Date(today)
      d.setDate(d.getDate() - 7)
      return runDate >= d
    }
    case '30days': {
      const d = new Date(today)
      d.setDate(d.getDate() - 30)
      return runDate >= d
    }
    default: return true
  }
}

function groupRunsToTasks(runs: RunEntry[]): RunLogTask[] {
  const jobMap = new Map<string, Job>()
  jobs.value.forEach(j => jobMap.set(j.id || j.job_id || '', j))
  const groups = new Map<string, RunEntry[]>()
  runs.forEach(r => {
    const jid = r.jobId
    if (!groups.has(jid)) groups.set(jid, [])
    groups.get(jid)!.push(r)
  })
  return [...groups.entries()].map(([taskId, taskRuns]) => {
    const job = jobMap.get(taskId)
    const runs = taskRuns.map(r => ({
      time: r.runTime,
      status: r.status || (r.error ? 'failed' : 'success'),
      runId: r.fileName,
      duration: '—',
      error: r.error,
    })).sort((a, b) => b.time.localeCompare(a.time))
    const ok = runs.filter(r => r.status === 'success' || r.status === 'ok').length
    const fail = runs.filter(r => r.status === 'failed' || r.status === 'error').length
    return {
      taskId,
      name: job?.name || taskId.slice(0, 8),
      deliver: job?.deliver || '本地',
      stats: { total: runs.length, ok, fail },
      runs,
    }
  })
}

const filteredRunlogTasks = computed(() => {
  let runs = allRuns.value
  if (runlogDateFilter.value !== 'all') {
    runs = runs.filter(r => isDateInRange(r.runTime, runlogDateFilter.value))
  }

  let tasks = groupRunsToTasks(runs)

  if (runlogStatusFilter.value !== 'all') {
    tasks = tasks.map(t => {
      const filtered = t.runs.filter(r => {
        if (runlogStatusFilter.value === 'unknown') return r.status !== 'ok' && r.status !== 'error' && r.status !== 'failed' && r.status !== 'success'
        return r.status === runlogStatusFilter.value || (runlogStatusFilter.value === 'ok' && r.status === 'success') || (runlogStatusFilter.value === 'error' && r.status === 'failed')
      })
      const ok = filtered.filter(r => r.status === 'success' || r.status === 'ok').length
      const fail = filtered.filter(r => r.status === 'failed' || r.status === 'error').length
      return { ...t, runs: filtered, stats: { total: filtered.length, ok, fail } }
    }).filter(t => t.runs.length > 0)
  }

  const search = runlogSearch.value.trim().toLowerCase()
  if (search) {
    tasks = tasks.filter(t => {
      if (t.name.toLowerCase().includes(search)) return true
      return t.runs.some(r => r.error?.toLowerCase().includes(search))
    })
  }

  return tasks
})

function resetRunlogFilters() {
  runlogDateFilter.value = 'all'
  runlogStatusFilter.value = 'all'
  runlogSearch.value = ''
}

async function loadRunLog() {
  if (runlogLoading.value) return
  runlogLoading.value = true
  try { allRuns.value = await listCronRuns() } catch { /* */ }
  finally { runlogLoading.value = false }
}

// ---- L1/L2 expand state ----
const expandedL1 = ref<Set<string>>(new Set())
const expandedL2 = ref<Set<string>>(new Set())
const expandedMore = ref<Set<string>>(new Set())

function toggleL1(taskId: string) {
  if (expandedL1.value.has(taskId)) expandedL1.value.delete(taskId)
  else expandedL1.value.add(taskId)
}
function toggleL2(runId: string) {
  if (expandedL2.value.has(runId)) expandedL2.value.delete(runId)
  else expandedL2.value.add(runId)
}
function toggleMore(taskId: string) {
  if (expandedMore.value.has(taskId)) expandedMore.value.delete(taskId)
  else expandedMore.value.add(taskId)
}

// ---- Actions ----
function handleRun(jobId: string) { jobsStore.runJob(jobId) }
function handlePause(jobId: string) { jobsStore.pauseJob(jobId) }
function handleResume(jobId: string) { jobsStore.resumeJob(jobId) }
function handleDelete(jobId: string) { if (confirm('确认删除？')) jobsStore.deleteJob(jobId) }

// ---- Navigation ----
function goCreate() { router.push({ name: 'hermes.dutyCreate' }) }
function goPicker() { router.push({ name: 'hermes.dutyPicker' }) }
function goDetail(id: string) { router.push({ name: 'hermes.dutyDetail', params: { id } }) }
function goEdit(id: string) { router.push({ name: 'hermes.dutyCreate', query: { edit: id } }) }

// ---- Init ----
onMounted(() => {
  jobsStore.fetchJobs()
  loadRunLog()
  if (route.hash === '#tab=runlog') activeTab.value = 'runlog'
})
</script>

<template>
  <div class="page">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1>值守任务</h1>
        <div class="page-sub">无人值守的定时任务，按计划自动运行并推送结果</div>
      </div>
      <div class="page-actions">
        <a class="btn btn-default" @click="goPicker">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>从模板 / 技能添加任务
        </a>
        <a class="btn btn-primary" @click="goCreate">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>创建任务
        </a>
      </div>
    </div>

    <!-- Secondary Tabs -->
    <div class="seg-switch" style="margin-bottom:18px">
      <button class="seg-btn" :class="{ active: activeTab === 'jobs' }" @click="activeTab = 'jobs'">
        定时任务<span class="count-tag">{{ jobs.length }}</span>
      </button>
      <button class="seg-btn" :class="{ active: activeTab === 'runlog' }" @click="activeTab = 'runlog'">
        运行记录<span class="count-tag">{{ runlogStats.total }}</span>
      </button>
    </div>

    <!-- ===== TAB A: 定时任务 ===== -->
    <div v-if="loading" style="text-align:center;padding:48px;color:var(--text-muted)">加载中...</div>
    <div v-else v-show="activeTab === 'jobs'">
      <!-- Stat cards -->
      <div class="stat-row">
        <div class="stat-card">
          <div class="stat-icon running"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
          <div class="stat-body"><span class="stat-label">运行中</span><span class="stat-value">{{ jobStats.running }}</span><span class="stat-trend">实时调度</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon paused"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg></div>
          <div class="stat-body"><span class="stat-label">已暂停</span><span class="stat-value">{{ jobStats.paused }}</span><span class="stat-trend">手动暂停</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon done"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="20 6 9 17 4 12"/></svg></div>
          <div class="stat-body"><span class="stat-label">已结束</span><span class="stat-value">{{ jobStats.ended }}</span><span class="stat-trend">归档任务</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon failed"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
          <div class="stat-body"><span class="stat-label">异常</span><span class="stat-value">{{ jobStats.error }}</span><span class="stat-trend">需处理</span></div>
        </div>
      </div>

      <!-- View toggle + Search -->
      <div class="view-bar">
        <div class="seg-switch" style="margin-bottom:0">
          <button class="seg-btn" :class="{ active: viewMode === 'list' }" @click="viewMode = 'list'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>列表
          </button>
          <button class="seg-btn" :class="{ active: viewMode === 'kanban' }" @click="viewMode = 'kanban'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="11" rx="1"/></svg>看板
          </button>
        </div>
        <div class="search-input">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input v-model="jobSearch" placeholder="搜索任务名称...">
        </div>
      </div>

      <!-- LIST VIEW -->
      <div v-show="viewMode === 'list'">
        <template v-for="g in jobGroups" :key="g.key">
          <section v-if="g.items.length" class="job-group">
            <div class="job-group-head">
              <span class="job-group-title"><span class="pill-dot" :style="{ background: g.dot }"></span>{{ g.label }}</span>
              <span class="job-group-count">{{ g.items.length }} 个</span>
            </div>
            <div class="card-grid">
              <div v-for="j in g.items" :key="j.id" class="job-card" @click="goDetail(j.id)">
                <div class="card-head">
                  <div class="card-title">{{ j.name }}</div>
                  <span class="status-pill" :class="statusOf(j)[1]"><span class="pill-dot"></span>{{ statusOf(j)[0] }}</span>
                </div>
                <div class="card-body">
                  <div class="info-row"><span class="label">调度频率</span><span class="val mono">{{ cronToHuman(j.schedule_display) }}</span></div>
                  <div class="info-row"><span class="label">推送渠道</span><span class="val">{{ deliverName(j) || '—' }}</span></div>
                  <div class="info-row"><span class="label">下次运行</span><span class="val" :class="{ 'highlight-time': j.next_run_at }">{{ formatNextRun(j) }}</span></div>
                  <div v-if="j.last_run_at" class="info-row"><span class="label">上次运行</span><span class="val" :class="lastRunLabel(j)[1]">{{ formatLastRun(j) }} · {{ lastRunLabel(j)[0] }}</span></div>
                  <div class="info-row"><span class="label">状态</span><span class="val mono">{{ humanState(j.state) }}</span></div>
                </div>
                <div class="card-actions">
                  <button class="act-btn act-primary" @click.stop="handleRun(j.id)">▶ 立即运行</button>
                  <button v-if="j.state === 'paused' || !j.enabled" class="act-btn" @click.stop="handleResume(j.id)">▶ 恢复</button>
                  <button v-else class="act-btn" @click.stop="handlePause(j.id)">⏸ 暂停</button>
                  <a class="act-btn" @click.stop="goEdit(j.id)">✎ 编辑</a>
                  <button class="act-btn act-danger" @click.stop="handleDelete(j.id)">✕ 删除</button>
                </div>
              </div>
            </div>
          </section>
        </template>
        <div v-if="filteredJobs.length === 0" class="empty-state">没有匹配的任务<span class="empty-hint">试试调整搜索关键词</span></div>
      </div>

      <!-- KANBAN VIEW -->
      <div v-show="viewMode === 'kanban'" class="kanban">
        <div v-for="col in kanbanCols" :key="col.key" class="kanban-col">
          <div class="kanban-head">
            <div class="kanban-head-left"><span class="dot" :class="col.dot"></span><span>{{ col.label }}</span><span class="num">{{ col.items.length }}</span></div>
          </div>
          <div class="kanban-body">
            <div v-for="j in col.items" :key="j.id" class="tk-card" @click="goDetail(j.id)">
              <div class="tk-card-head"><div class="tk-name">{{ j.name }}</div><span class="tk-pill" :class="statusOf(j)[1]">{{ statusOf(j)[0] }}</span></div>
              <div class="tk-meta"><span class="item">🕐 {{ cronToHuman(j.schedule_display) }}</span></div>
              <div class="tk-progress"><i :style="{ width: '50%' }"></i></div>
              <div class="tk-progress-text"><span>{{ formatLastRun(j) }}</span><span class="pct">—</span></div>
              <div class="tk-foot"><div class="tk-foot-right">{{ formatNextRun(j) }}</div></div>
            </div>
            <div class="tk-add" @click="goCreate">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>添加任务
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== TAB B: 运行记录 ===== -->
    <div v-show="activeTab === 'runlog'">
      <!-- Stat cards -->
      <div class="stat-row">
        <div class="stat-card">
          <div class="stat-icon total"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
          <div class="stat-body"><span class="stat-label">总执行</span><span class="stat-value">{{ runlogStats.total }}</span><span class="stat-trend">累计 · 所有任务历史</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon success"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="20 6 9 17 4 12"/></svg></div>
          <div class="stat-body"><span class="stat-label">成功</span><span class="stat-value">{{ runlogStats.ok }}</span><span class="stat-trend up">成功执行</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon failed"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>
          <div class="stat-body"><span class="stat-label">失败</span><span class="stat-value">{{ runlogStats.fail }}</span><span class="stat-trend down">异常执行</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon rate"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div>
          <div class="stat-body"><span class="stat-label">成功率</span><span class="stat-value">{{ runlogStats.rate }}<span class="unit">%</span></span><span class="stat-trend up">实时计算</span></div>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="toolbar">
        <div class="toolbar-group">
          <span class="toolbar-label">日期</span>
          <select v-model="runlogDateFilter">
            <option v-for="opt in runlogDateOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
        <div class="toolbar-divider"></div>
        <div class="toolbar-group">
          <span class="toolbar-label">状态</span>
          <select v-model="runlogStatusFilter">
            <option v-for="opt in runlogStatusOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
        <div class="toolbar-right">
          <div class="tl-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input v-model="runlogSearch" placeholder="搜索任务名 / 错误关键词">
          </div>
          <button class="btn btn-default" @click="resetRunlogFilters">重置</button>
        </div>
      </div>

      <!-- Failure banner -->
      <!-- <div class="fail-banner">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span>本周 <b>7</b> 条失败记录，其中 <b>4</b> 条因「污染源超标异常监控」任务钉钉凭证失效集中出现，<a href="#">前往修复</a></span>
      </div> -->

      <!-- Run log 2-layer tree -->
      <div class="runlog-stack" v-if="!runlogLoading">
        <section v-for="t in filteredRunlogTasks" :key="t.taskId" class="rl-task" :class="{ open: expandedL1.has(t.taskId) }">
          <div class="rl-task-head" @click="toggleL1(t.taskId)">
            <span class="rl-chev">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </span>
            <div class="rl-task-main">
              <div class="rl-task-title">{{ t.name }}</div>
              <div class="rl-task-sub"><span class="rl-dot"></span>{{ t.deliver }}<span class="rl-dot"></span>总执行 <b>{{ t.stats.total }}</b> 次
                <span v-if="t.stats.fail" class="rl-chip failed">{{ t.stats.fail }} 失败</span>
                <span v-else class="rl-chip success">{{ t.stats.ok }} 成功</span>
              </div>
            </div>
            <div class="rl-task-right">
              <span class="rl-pill" :class="t.stats.fail ? 'failed' : 'success'"><span class="pill-dot"></span>{{ (t.stats.total > 0 && t.stats.fail === 0) ? '全部成功' : t.stats.fail + ' 次失败' }}</span>
            </div>
          </div>
          <div class="rl-task-body">
            <div v-for="r in (expandedMore.has(t.taskId) ? t.runs : t.runs.slice(0, 20))" :key="r.runId" class="rl-run" :class="{ open: expandedL2.has(r.runId) }">
              <div class="rl-run-head" @click="toggleL2(r.runId)">
                <span class="rl-chev rl-chev-sm">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                </span>
                <div class="rl-run-time"><span class="rl-time-main">{{ r.time }}</span></div>
                <span class="rl-pill" :class="r.status === 'failed' || r.status === 'error' ? 'failed' : r.status === 'running' ? 'running' : 'success'"><span class="pill-dot"></span>{{ r.status === 'failed' || r.status === 'error' ? '失败' : r.status === 'running' ? '运行中' : '成功' }}</span>
                <div class="rl-run-meta">
                  <span class="rl-meta-item" v-if="r.status === 'failed' && r.error">{{ r.error.split('\n')[0].slice(0, 40) }}</span>
                </div>
              </div>
              <div class="rl-run-body">
                <div class="rl-detail">
                  <div v-if="r.status === 'failed' && r.error" class="fail-banner" style="margin-bottom:14px">
                    <span><b>执行失败</b>：{{ r.error }}</span>
                  </div>
                  <div class="detail-section">
                    <h4>运行详情 <span class="h-tag">{{ r.runId }}</span></h4>
                    <div class="detail-grid">
                      <div class="item"><span class="k">执行时间</span><span class="v">{{ r.time }}</span></div>
                      <div class="item"><span class="k">状态</span><span class="v">{{ r.status === 'failed' ? '失败' : '成功' }}</span></div>
                      <div class="item"><span class="k">任务</span><span class="v">{{ t.name }}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="t.runs.length > 20 && !expandedMore.has(t.taskId)" class="rl-run rl-more" @click.stop="toggleMore(t.taskId)" style="padding:8px 16px;color:var(--accent-primary);font-size:12px;cursor:pointer;text-align:center">… 还有 {{ t.runs.length - 20 }} 条记录，点击展开</div>
          </div>
        </section>
        <div v-if="filteredRunlogTasks.length === 0" style="text-align:center;padding:48px;color:var(--text-muted);font-size:13px">暂无运行记录<span class="empty-hint">任务执行后将在此显示</span></div>
      </div>
      <div v-else style="text-align:center;padding:48px;color:var(--text-muted)">加载中...</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

// ---- Page shell (matches prototype .page) ----
.page {
  padding: 24px 28px 60px;
  max-width: 1180px;
  margin: 0 auto;
}

// ---- Page header ----
.page-header {
  display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 18px;
  h1 { font-size: 20px; font-weight: 600; letter-spacing: .2px; }
  .page-sub { color: $text-secondary; font-size: 13px; margin-top: 5px; }
}
.page-actions { display: flex; gap: 8px; }

// ---- Buttons ----
.btn {
  display: inline-flex; align-items: center; gap: 7px; padding: 8px 14px;
  border-radius: var(--radius-md); font-size: 13px; font-weight: 500; cursor: pointer;
  border: 1px solid transparent; transition: .15s; white-space: nowrap; text-decoration: none;
  svg { width: 14px; height: 14px; }
}
.btn-primary { background: $accent-primary; color: #fff; &:hover { background: $accent-hover; } }
.btn-default { background: $bg-card; color: $text-primary; border-color: $border-color; &:hover { border-color: var(--border-strong); background: $bg-secondary; } }

// ---- Segmented tabs ----
.seg-switch { display: inline-flex; gap: 4px; background: $bg-secondary; border-radius: var(--radius-md); padding: 3px; }
.seg-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px;
  border: none; background: transparent; color: $text-secondary; border-radius: var(--radius-sm);
  font-size: 13px; font-weight: 500; cursor: pointer; transition: .15s;
  svg { width: 14px; height: 14px; }
  &:hover { color: $text-primary; }
  &.active { background: $bg-card; color: $accent-primary; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
}
.count-tag {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 22px; height: 18px; padding: 0 6px; border-radius: 9px;
  font-size: 10.5px; font-weight: 600; margin-left: 2px;
}
.seg-btn.active .count-tag { background: rgba(var(--accent-primary-rgb), .12); color: $accent-primary; }
.seg-btn:not(.active) .count-tag { background: $bg-secondary; color: $text-secondary; }

// ---- Stat cards ----
.stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
.stat-card { background: $bg-card; border: 1px solid $border-color; border-radius: var(--radius-md); padding: 16px; display: flex; gap: 14px; align-items: center; }
.stat-icon {
  width: 42px; height: 42px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  svg { width: 18px; height: 18px; }
  &.running { background: rgba(var(--success-rgb), .12); color: $success; }
  &.paused { background: rgba(var(--warning-rgb), .15); color: $warning; }
  &.done { background: rgba(var(--accent-primary-rgb), .10); color: $accent-primary; }
  &.failed { background: rgba(var(--error-rgb), .12); color: $error; }
  &.total { background: rgba(var(--accent-primary-rgb), .10); color: $accent-primary; }
  &.success { background: rgba(var(--success-rgb), .12); color: $success; }
  &.rate { background: $bg-secondary; color: $text-primary; border: 1px solid $border-color; }
}
.stat-body { display: flex; flex-direction: column; gap: 2px; }
.stat-label { font-size: 12px; color: $text-muted; }
.stat-value { font-size: 22px; font-weight: 700; color: $text-primary; .unit { font-size: 13px; font-weight: 500; } }
.stat-trend { font-size: 11px; color: $text-muted; &.up { color: $success; } &.down { color: $error; } }

// ---- View bar ----
.view-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }

// ---- Search input ----
.search-input {
  display: flex; align-items: center; gap: 8px; padding: 7px 12px;
  border: 1px solid $border-color; border-radius: var(--radius-sm); background: $bg-input; width: 220px;
  svg { width: 14px; height: 14px; color: $text-muted; flex-shrink: 0; }
  input {
    border: none; outline: none; background: transparent; font-size: 13px;
    color: $text-primary; width: 100%; font-family: inherit;
    &::placeholder { color: $text-muted; }
  }
}

// ---- Job groups & cards ----
.job-group { margin-bottom: 22px; }
.job-group-head { display: flex; align-items: center; gap: 10px; padding: 0 4px 10px; }
.job-group-title { font-size: 13px; font-weight: 600; color: $text-primary; letter-spacing: .2px; display: inline-flex; align-items: center; gap: 6px; }
.pill-dot { width: 8px; height: 8px; border-radius: 50%; }
.job-group-count { font-size: 12px; color: $text-muted; }

.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; }

.job-card {
  background: $bg-card; border: 1px solid $border-color; border-radius: var(--radius-lg); padding: 16px 18px 12px;
  cursor: pointer; transition: .15s;
  &:hover { border-color: var(--border-strong); box-shadow: 0 2px 8px rgba(0,0,0,.04); }
}
.card-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
.card-title { font-size: 14px; font-weight: 600; color: $text-primary; flex: 1; margin-right: 10px; }
.status-pill {
  display: inline-flex; align-items: center; gap: 5px; padding: 2px 10px; border-radius: 11px; font-size: 11.5px; font-weight: 500; flex-shrink: 0;
  .pill-dot { width: 6px; height: 6px; background: currentColor; }
  &.running { background: rgba(var(--success-rgb), .12); color: $success; }
  &.paused { background: rgba(var(--warning-rgb), .15); color: $warning; }
  &.done { background: $bg-secondary; color: $text-muted; }
  &.error { background: rgba(var(--error-rgb), .12); color: $error; }
}
.card-body { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
.info-row { display: flex; gap: 8px; font-size: 12.5px; .label { color: $text-muted; min-width: 60px; } .val { color: $text-primary; &.mono { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; } &.highlight-time { color: $accent-primary; font-weight: 500; } &.success { color: $success; } &.error { color: $error; } } }
.card-actions { display: flex; gap: 4px; border-top: 1px solid $border-light; padding-top: 10px; }
.act-btn {
  display: inline-flex; gap: 4px; padding: 4px 10px; border: 1px solid $border-color; border-radius: var(--radius-sm);
  background: $bg-card; color: $text-secondary; font-size: 12px; cursor: pointer; text-decoration: none;
  &:hover { border-color: $accent-primary; color: $accent-primary; }
  &.act-primary { background: var(--accent-primary); color: #fff; border-color: var(--accent-primary); }
  &.act-danger { &:hover { border-color: $error; color: $error; } }
}

// ---- Kanban ----
.kanban { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.kanban-col { background: $bg-secondary; border-radius: var(--radius-lg); padding: 14px; }
.kanban-head { margin-bottom: 12px; }
.kanban-head-left { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: $text-primary;
  .dot { width: 8px; height: 8px; border-radius: 50%; &.running { background: $success; } &.paused { background: $warning; } &.done { background: $text-muted; } }
  .num { font-size: 12px; color: $text-muted; font-weight: 500; margin-left: auto; }
}
.kanban-body { display: flex; flex-direction: column; gap: 8px; }
.tk-card { background: $bg-card; border: 1px solid $border-color; border-radius: var(--radius-md); padding: 12px; cursor: pointer; transition: .15s; &:hover { border-color: var(--border-strong); } }
.tk-card-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
.tk-name { font-size: 13px; font-weight: 600; color: $text-primary; flex: 1; }
.tk-pill { font-size: 10.5px; padding: 1px 7px; border-radius: 9px; font-weight: 500;
  &.running { background: rgba(var(--success-rgb), .12); color: $success; }
  &.paused { background: rgba(var(--warning-rgb), .15); color: $warning; }
  &.done { background: $bg-secondary; color: $text-muted; }
  &.error { background: rgba(var(--error-rgb), .12); color: $error; }
}
.tk-meta { font-size: 11px; color: $text-muted; margin-bottom: 6px; .item { display: inline-flex; align-items: center; gap: 4px; } }
.tk-progress { height: 4px; background: $bg-secondary; border-radius: 2px; margin-bottom: 6px; i { display: block; height: 100%; border-radius: 2px; background: $accent-primary; } }
.tk-progress-text { display: flex; justify-content: space-between; font-size: 11px; color: $text-muted; margin-bottom: 8px; }
.tk-foot { display: flex; justify-content: space-between; }
.tk-foot-right { font-size: 11px; color: $text-secondary; }
.tk-add { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 12px; border: 1px dashed $border-color; border-radius: var(--radius-md); color: $text-muted; font-size: 13px; cursor: pointer; &:hover { color: $accent-primary; border-color: $accent-primary; } svg { width: 14px; height: 14px; } }

// ---- Empty state ----
.empty-state { text-align: center; padding: 48px 20px; color: $text-muted; font-size: 14px; .empty-hint { display: block; font-size: 12px; margin-top: 6px; } }

// ---- Toolbar ----
.toolbar { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; background: $bg-card; border: 1px solid $border-color; border-radius: var(--radius-lg); padding: 12px 14px; }
.toolbar-group { display: flex; align-items: center; gap: 6px; }
.toolbar-label { font-size: 12px; color: $text-muted; margin-right: 4px; white-space: nowrap; }
.toolbar-divider { width: 1px; height: 20px; background: $border-color; margin: 0 4px; }
.toolbar select, .toolbar input { font-size: 12.5px; padding: 6px 10px; border: 1px solid $border-color; border-radius: var(--radius-sm); background: $bg-input; color: $text-primary; cursor: pointer; outline: none; }
.toolbar-right { margin-left: auto; display: flex; gap: 6px; align-items: center; }
.tl-search { display: flex; align-items: center; gap: 6px; padding: 6px 10px; border: 1px solid $border-color; border-radius: var(--radius-sm); background: $bg-input; svg { width: 13px; height: 13px; color: $text-muted; } input { border: none; outline: none; background: transparent; font-size: 12.5px; color: $text-primary; width: 160px; } }

// ---- Failure banner ----
.fail-banner { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: rgba(var(--error-rgb), .06); border: 1px solid rgba(var(--error-rgb), .25); border-radius: var(--radius-md); margin-bottom: 14px; font-size: 12.5px; color: $error; svg { width: 16px; height: 16px; flex-shrink: 0; } b { color: $error; } a { color: $accent-primary; font-weight: 500; text-decoration: none; } }

// ---- Run log 3-layer ----
.runlog-stack { background: $bg-card; border: 1px solid $border-color; border-radius: var(--radius-lg); overflow: hidden; }

.rl-task { border-bottom: 1px solid $border-light; &:last-child { border-bottom: none; } }
.rl-task-head {
  display: flex; align-items: center; gap: 10px; padding: 14px 18px; cursor: pointer; transition: .15s;
  &:hover { background: $bg-card-hover; }
}
.rl-chev { display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; color: $text-muted; flex-shrink: 0; svg { width: 14px; height: 14px; transition: transform .2s; } }
.rl-task.open > .rl-task-head .rl-chev svg, .rl-run.open > .rl-run-head .rl-chev svg { transform: rotate(90deg); }
.rl-task-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.rl-task-title { font-size: 14px; font-weight: 600; color: $text-primary; }
.rl-task-sub { display: flex; align-items: center; gap: 6px; font-size: 11px; color: $text-muted; flex-wrap: wrap; }
.rl-dot { width: 4px; height: 4px; border-radius: 50%; background: $border-color; flex-shrink: 0; }
.rl-chip { display: inline-flex; padding: 1px 7px; border-radius: 9px; font-size: 10.5px; font-weight: 500;
  &.success { background: rgba(var(--success-rgb), .12); color: $success; }
  &.failed { background: rgba(var(--error-rgb), .12); color: $error; }
  &.running { background: rgba(var(--warning-rgb), .15); color: $warning; }
}
.rl-task-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.rl-time-meta { font-size: 12px; color: $text-secondary; text-align: right; }
.rl-sub-time { display: block; font-size: 10.5px; color: $text-muted; }
.rl-pill {
  display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 11px; font-size: 11px; font-weight: 500;
  .pill-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  &.success { background: rgba(var(--success-rgb), .12); color: $success; }
  &.failed { background: rgba(var(--error-rgb), .12); color: $error; }
  &.running { background: rgba(var(--warning-rgb), .15); color: $warning; }
}
.rl-task-body { display: none; background: $bg-secondary; border-top: 1px solid $border-light; }
.rl-task.open > .rl-task-body { display: block; }

.rl-run { border-bottom: 1px solid $border-light; &:last-child { border-bottom: none; } }
.rl-run-head { display: flex; align-items: center; gap: 10px; padding: 10px 18px; cursor: pointer; transition: .15s; &:hover { background: rgba(var(--accent-primary-rgb), .03); } }
.rl-chev-sm { width: 14px; height: 14px; svg { width: 11px; height: 11px; } }
.rl-run-time { display: flex; flex-direction: column; min-width: 90px; }
.rl-time-main { font-size: 12.5px; color: $text-secondary; }
.rl-run-meta { display: flex; gap: 8px; margin-left: auto; }
.rl-meta-item { font-size: 11px; color: $text-muted; &.manual { color: $accent-primary; } }

.rl-run-body { display: none; }
.rl-run.open > .rl-run-body { display: block; }
.rl-detail { padding: 0 18px 16px; }

.detail-section { background: $bg-card; border: 1px solid $border-color; border-radius: var(--radius-md); padding: 14px 16px; margin-top: 12px;
  max-height: 400px;
  overflow-y: auto;
  h4 { font-size: 12.5px; font-weight: 600; color: $text-primary; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
  .h-tag { font-size: 10.5px; padding: 1px 7px; border-radius: 9px; background: $bg-secondary; color: $text-muted; border: 1px solid $border-color; font-weight: 500; }
}
.detail-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 24px; font-size: 12.5px; .item { display: flex; gap: 8px; .k { color: $text-muted; min-width: 64px; } .v { color: $text-primary; font-size: 12px; } } }
.detail-log { background: $text-primary; color: #d6d6d6; border-radius: var(--radius-sm); padding: 10px 14px; font-size: 11.5px; line-height: 1.7; max-height: 180px; overflow-y: auto; .log-ok { color: #7fc987; } .log-err { color: #f18d8d; } .log-info { color: #9eb6d8; } }
</style>
