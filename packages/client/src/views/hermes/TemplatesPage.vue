<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { PROTO_TEMPLATES } from '@/data/templates'

const router = useRouter()
const templates = ref(PROTO_TEMPLATES)

// ---- UI state ----
const activeTab = ref('all')
const activeFilter = ref('all')
const searchText = ref('')

const sourceLabel: Record<string, string> = { system:'系统', mine:'我的', imported:'外部导入' }

// ---- Computed groups ----
const allCount = computed(() => templates.value.length)
const systemCount = computed(() => templates.value.filter(t => t.source === 'system').length)
const mineCount = computed(() => templates.value.filter(t => t.source === 'mine').length)
const importedCount = computed(() => templates.value.filter(t => t.source === 'imported').length)
const favCount = computed(() => templates.value.filter(t => t.favorite).length)

const filtered = computed(() => {
  let list = templates.value
  if (activeTab.value !== 'all') list = list.filter(t => t.source === activeTab.value)
  if (activeFilter.value === 'favorite') list = list.filter(t => t.favorite)
  if (activeFilter.value === 'recent') list = list.filter(t => t.used >= 3)
  if (activeFilter.value === 'shared') list = list.filter(t => t.source !== 'mine')
  const kw = searchText.value.trim().toLowerCase()
  if (kw) list = list.filter(t => t.name.toLowerCase().includes(kw) || t.caps.some(c => c.toLowerCase().includes(kw)))
  return list
})

// ---- Navigation ----
function goCreate() { router.push({ name: 'hermes.dutyCreate' }) }
function goEdit(id: string) { router.push({ name: 'hermes.templateEditor', params: { id } }) }
function goClone(id: string) { router.push({ name: 'hermes.templateEditor', params: { id }, query: { clone: id } }) }
function viewTemplate(id: string) { router.push({ name: 'hermes.templateEditor', params: { id } }) }

// ---- Source pill class ----
function sourceCls(s: string): string {
  return s === 'system' ? 'scheduled' : s === 'mine' ? 'running' : 'done'
}
</script>

<template>
  <div class="page">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1>常用任务 · 模板库</h1>
        <div class="page-sub">将高频任务沉淀为模板，跨用户、跨环境一键复用</div>
      </div>
      <div class="page-actions">
        <a class="btn btn-default" @click="router.push({ name: 'hermes.templateEditor' })">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>分享 / 导入
        </a>
        <a class="btn btn-primary" @click="goCreate">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>新建模板
        </a>
      </div>
    </div>

    <div style="display:flex;gap:18px;align-items:flex-start">
      <!-- Left: groups + tags -->
      <div style="width:200px;flex-shrink:0">
        <div class="session-section" style="margin:0 0 14px">
          <div class="session-group-header">
            <span class="session-group-label">分组</span>
            <span class="session-group-count">({{ allCount }})</span>
          </div>
          <a class="session-item" :class="{ active: activeTab === 'all' }" @click="activeTab = 'all'"><span class="session-item-title">全部模板</span><span class="session-item-time">{{ allCount }}</span></a>
          <a class="session-item" :class="{ active: activeTab === 'system' }" @click="activeTab = 'system'"><span class="session-item-title">系统预置</span><span class="session-item-time">{{ systemCount }}</span></a>
          <a class="session-item" :class="{ active: activeTab === 'mine' }" @click="activeTab = 'mine'"><span class="session-item-title">我的模板</span><span class="session-item-time">{{ mineCount }}</span></a>
          <a class="session-item" :class="{ active: activeTab === 'imported' }" @click="activeTab = 'imported'"><span class="session-item-title">外部导入</span><span class="session-item-time">{{ importedCount }}</span></a>
          <a class="session-item"><span class="session-item-title">已收藏</span><span class="session-item-time">{{ favCount }}</span></a>
        </div>
        <div class="session-section" style="margin:0">
          <div class="session-group-header"><span class="session-group-label">标签</span></div>
          <a class="session-item"><span class="session-item-title">日报周报</span><span class="session-item-time">2</span></a>
          <a class="session-item"><span class="session-item-title">空气质量</span><span class="session-item-time">2</span></a>
          <a class="session-item"><span class="session-item-title">水环境</span><span class="session-item-time">1</span></a>
          <a class="session-item"><span class="session-item-title">考核排名</span><span class="session-item-time">1</span></a>
        </div>
      </div>

      <!-- Right: content -->
      <div style="flex:1;min-width:0">
        <!-- 4 Tab -->
        <div class="seg-switch" style="margin-top:4px">
          <button class="seg-btn" :class="{ active: activeTab === 'all' }" @click="activeTab = 'all'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>全部 <span class="seg-count">{{ allCount }}</span>
          </button>
          <button class="seg-btn" :class="{ active: activeTab === 'system' }" @click="activeTab = 'system'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>系统 <span class="seg-count">{{ systemCount }}</span>
          </button>
          <button class="seg-btn" :class="{ active: activeTab === 'mine' }" @click="activeTab = 'mine'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>我的 <span class="seg-count">{{ mineCount }}</span>
          </button>
          <button class="seg-btn" :class="{ active: activeTab === 'imported' }" @click="activeTab = 'imported'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>外部导入 <span class="seg-count">{{ importedCount }}</span>
          </button>
        </div>

        <!-- Filter bar -->
        <div class="filter-bar">
          <div class="filter-pill" :class="{ active: activeFilter === 'all' }" @click="activeFilter = 'all'">全部 <span class="num">{{ allCount }}</span></div>
          <div class="filter-pill" :class="{ active: activeFilter === 'favorite' }" @click="activeFilter = 'favorite'"><span class="dot" style="background:var(--warning)"></span>已收藏 <span class="num">{{ favCount }}</span></div>
          <div class="filter-pill" :class="{ active: activeFilter === 'recent' }" @click="activeFilter = 'recent'"><span class="dot" style="background:var(--accent-primary)"></span>最近使用</div>
          <div class="filter-pill" :class="{ active: activeFilter === 'shared' }" @click="activeFilter = 'shared'"><span class="dot" style="background:var(--success)"></span>可分享</div>
          <div class="filter-bar-right">
            <div class="search-input">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input v-model="searchText" placeholder="搜索模板名称 / 标签...">
            </div>
          </div>
        </div>

        <!-- Card grid -->
        <div class="card-grid">
          <div v-for="t in filtered" :key="t.id" class="job-card">
            <div class="card-head">
              <div class="card-title">{{ t.name }}</div>
              <span class="status-pill" :class="sourceCls(t.source)"><span class="pill-dot"></span>{{ sourceLabel[t.source] }}</span>
            </div>
            <div class="card-body">
              <div class="info-row" style="align-items:flex-start"><span class="label" style="padding-top:2px">说明</span><span class="val" style="white-space:normal;line-height:1.5">{{ t.desc }}</span></div>
              <div class="info-row"><span class="label">技能</span><span class="val" style="display:flex;gap:4px;flex-wrap:wrap"><span v-for="c in t.caps" :key="c" class="cap-tag">{{ c }}</span></span></div>
              <div class="info-row"><span class="label">调度</span><span class="val mono">{{ t.schedule }}</span></div>
              <div class="info-row"><span class="label">推送</span><span class="val">{{ t.deliver }}</span></div>
              <div class="info-row"><span class="label">作者</span><span class="val">{{ t.author }} · v{{ t.version }}</span></div>
              <div class="info-row"><span class="label">派生</span><span class="val">已被使用 <b>{{ t.used }}</b> 次 · 更新于 {{ t.updated }}</span></div>
            </div>
            <div class="card-actions">
              <a class="act-btn" @click="viewTemplate(t.id)">👁 查看</a>
              <a class="act-btn act-primary" @click="router.push({ name: 'hermes.dutyCreate', query: { from: t.id } })">▶ 创建任务</a>
              <button class="act-btn" @click="goClone(t.id)">📋 克隆</button>
              <template v-if="t.source === 'mine'">
                <a class="act-btn" @click="goEdit(t.id)">✎ 编辑</a>
                <button class="act-btn act-danger">✕ 删除</button>
              </template>
              <template v-else>
                <button class="act-btn">🔗 分享</button>
                <button class="act-btn">⭐ 收藏</button>
              </template>
            </div>
          </div>
        </div>
        <div v-if="filtered.length === 0" class="empty-state">没有匹配的模板<div class="empty-hint">试着切换 Tab 或清空筛选条件</div></div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.page { padding: 24px 28px 60px; max-width: 1180px; margin: 0 auto; }

// ---- Header ----
.page-header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 18px;
  h1 { font-size: 20px; font-weight: 600; letter-spacing: .2px; }
  .page-sub { color: $text-secondary; font-size: 13px; margin-top: 5px; }
}
.page-actions { display: flex; gap: 8px; }

// ---- Buttons ----
.btn { display: inline-flex; align-items: center; gap: 7px; padding: 8px 14px; border-radius: var(--radius-md); font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid transparent; transition: .15s; white-space: nowrap; text-decoration: none; svg { width: 14px; height: 14px; } }
.btn-primary { background: $accent-primary; color: #fff; &:hover { background: $accent-hover; } }
.btn-default { background: $bg-card; color: $text-primary; border-color: $border-color; &:hover { border-color: var(--border-strong); background: $bg-secondary; } }

// ---- Segmented ----
.seg-switch { display: inline-flex; gap: 4px; background: $bg-secondary; border-radius: var(--radius-md); padding: 3px; }
.seg-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px; border: none; background: transparent; color: $text-secondary; border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; cursor: pointer; transition: .15s; svg { width: 14px; height: 14px; } &:hover { color: $text-primary; } &.active { background: $bg-card; color: $accent-primary; box-shadow: 0 1px 3px rgba(0,0,0,.06); } }
.seg-count { font-size: 11px; padding: 1px 6px; border-radius: 9px; background: $bg-secondary; color: $text-muted; font-weight: 500; }
.seg-btn.active .seg-count { background: rgba(var(--accent-primary-rgb), .12); color: $accent-primary; }

// ---- Left sidebar groups ----
.session-section { }
.session-group-header { display: flex; align-items: center; gap: 4px; padding: 6px 10px 4px; margin-bottom: 4px; }
.session-group-label { font-size: 12px; font-weight: 600; color: $text-muted; letter-spacing: .5px; }
.session-group-count { font-size: 12px; color: $text-muted; }
.session-item { position: relative; display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 8px 10px; border: none; background: none; border-radius: var(--radius-sm); cursor: pointer; color: $text-secondary; margin-bottom: 2px; text-decoration: none; font-size: inherit; &:hover { background: rgba(var(--accent-primary-rgb), .06); color: $text-primary; } &.active { background: rgba(var(--accent-primary-rgb), .12); color: $accent-primary; font-weight: 500; } }
.session-item-title { flex: 1; min-width: 0; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.session-item-time { font-size: 11px; color: $text-muted; flex-shrink: 0; margin-left: 10px; }

// ---- Filter bar ----
.filter-bar { display: flex; gap: 6px; align-items: center; margin: 14px 0 16px; flex-wrap: wrap; }
.filter-pill { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border: 1px solid $border-color; border-radius: 999px; background: $bg-card; color: $text-secondary; font-size: 12px; cursor: pointer; transition: .15s; .dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; } .num { font-size: 10.5px; } &.active { background: rgba(var(--accent-primary-rgb), .1); border-color: $accent-primary; color: $accent-primary; } &:hover { border-color: $accent-primary; } }
.filter-bar-right { margin-left: auto; display: flex; gap: 6px; }

// ---- Search ----
.search-input { display: flex; align-items: center; gap: 8px; padding: 7px 12px; border: 1px solid $border-color; border-radius: var(--radius-sm); background: $bg-input; width: 220px; svg { width: 14px; height: 14px; color: $text-muted; flex-shrink: 0; } input { border: none; outline: none; background: transparent; font-size: 13px; color: $text-primary; width: 100%; font-family: inherit; &::placeholder { color: $text-muted; } } }

// ---- Card grid ----
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 14px; }

// ---- Job card ----
.job-card { background: $bg-card; border: 1px solid $border-color; border-radius: var(--radius-lg); padding: 16px 18px 12px; cursor: default; transition: .15s; &:hover { border-color: var(--border-strong); box-shadow: 0 2px 8px rgba(0,0,0,.04); } }
.card-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
.card-title { font-size: 14px; font-weight: 600; color: $text-primary; flex: 1; margin-right: 10px; }
.status-pill { display: inline-flex; align-items: center; gap: 5px; padding: 2px 10px; border-radius: 11px; font-size: 11.5px; font-weight: 500; flex-shrink: 0; .pill-dot { width: 6px; height: 6px; background: currentColor; } &.running { background: rgba(var(--accent-primary-rgb),.12); color: $accent-primary; } &.scheduled { background: $bg-secondary; color: $text-muted; border: 1px solid $border-color; } &.done { background: rgba(var(--success-rgb),.12); color: $success; } }
.card-body { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
.info-row { display: flex; gap: 8px; font-size: 12.5px; .label { color: $text-muted; min-width: 48px; flex-shrink: 0; } .val { color: $text-primary; &.mono { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; } } }
.cap-tag { display: inline-flex; padding: 1px 7px; border-radius: 9px; background: $bg-secondary; border: 1px solid $border-color; font-size: 11px; color: $text-secondary; }
.card-actions { display: flex; gap: 4px; border-top: 1px solid $border-light; padding-top: 10px; flex-wrap: wrap; }
.act-btn { display: inline-flex; gap: 4px; padding: 4px 10px; border: 1px solid $border-color; border-radius: var(--radius-sm); background: $bg-card; color: $text-secondary; font-size: 12px; cursor: pointer; text-decoration: none; &:hover { border-color: $accent-primary; color: $accent-primary; } &.act-primary { background: $accent-primary; color: #fff; border-color: $accent-primary; } &.act-danger { &:hover { border-color: $error; color: $error; } } }

// ---- Empty ----
.empty-state { text-align: center; padding: 48px 20px; color: $text-muted; font-size: 14px; .empty-hint { display: block; font-size: 12px; margin-top: 6px; } }
</style>
