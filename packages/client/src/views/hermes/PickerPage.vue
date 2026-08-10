<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PROTO_TEMPLATES } from '@/data/templates'
import { MAPAIRS_CAPS } from '@/data/capabilities'
import { fetchMcpServers, type McpServerInfo } from '@/api/hermes/mcp'
import { fetchSkills, type SkillInfo } from '@/api/hermes/skills'

const route = useRoute()
const router = useRouter()

const activeTab = ref('skills')
const mcpServers = ref<McpServerInfo[]>([])
const realSkills = ref<SkillInfo[]>([])

onMounted(async () => {
  try { const r = await fetchMcpServers(); mcpServers.value = r.servers || [] } catch { /* */ }
  try { realSkills.value = (await fetchSkills()).archived || [] } catch { /* */ }
  // Parse hash: #tab=skills&pick=mapPackage
  const raw = (route.hash || '').replace(/^#/, '')
  const params = new URLSearchParams(raw)
  const tab = params.get('tab')
  const pick = params.get('pick')
  if (tab && ['tmpl', 'skills', 'mcps'].includes(tab)) activeTab.value = tab
  if (pick) {
    selectedSkillIds.value = new Set([pick])
    selectedSkillIds.value = new Set(selectedSkillIds.value)
  }
})

// ---- Templates ----
const templates = PROTO_TEMPLATES.filter(t => t.source === 'system')
let selectedTmplId = ref<string | null>(null)
const tmplSideFilter = ref('all')
const tmplSearch = ref('')
const filteredTmpls = computed(() => {
  let list = templates
  if (tmplSideFilter.value !== 'all') list = list.filter(t => t.source === tmplSideFilter.value)
  const kw = tmplSearch.value.trim().toLowerCase()
  if (kw) list = list.filter(t => t.name.toLowerCase().includes(kw) || t.desc.toLowerCase().includes(kw))
  return list
})

// ---- Skills (合并硬编码 + 真实技能) ----
interface PickerSkill { id: string; name: string; kind: 'config' | 'direct'; source: string; desc: string; tags: string[] }
const allPickerSkills: PickerSkill[] = [
  ...MAPAIRS_CAPS.map(c => ({ id: c.id, name: c.name, kind: 'config' as const, source: 'mapairs', desc: c.desc, tags: c.params?.slice(0, 3).map(p => p.name) || [] })),
  ...realSkills.value.map((s: any) => ({ id: s.id || s.name, name: s.name || s.id, kind: 'direct' as const, source: s.source || 'general', desc: s.description || s.prompt_template?.slice(0, 80) || '', tags: [] })),
]
const skillFilter = ref('all')
const skillSearch = ref('')
const selectedSkillIds = ref<Set<string>>(new Set())
const filteredSkills = computed(() => {
  let list = allPickerSkills
  if (skillFilter.value !== 'all') list = list.filter(s => s.source === skillFilter.value)
  const kw = skillSearch.value.trim().toLowerCase()
  if (kw) list = list.filter(s => s.name.toLowerCase().includes(kw) || s.desc.toLowerCase().includes(kw))
  return list
})
function toggleSkill(id: string) {
  if (selectedSkillIds.value.has(id)) selectedSkillIds.value.delete(id)
  else selectedSkillIds.value.add(id)
  selectedSkillIds.value = new Set(selectedSkillIds.value) // trigger reactivity
}

// ---- MCP ----
const mcpFilter = ref('all')
const mcpSearch = ref('')
const selectedMcpIds = ref<Set<string>>(new Set())
const filteredMcps = computed(() => {
  let list = mcpServers.value
  if (mcpFilter.value === 'stdio') list = list.filter(m => m.transport === 'stdio')
  if (mcpFilter.value === 'http') list = list.filter(m => m.transport === 'http')
  const kw = mcpSearch.value.trim().toLowerCase()
  if (kw) list = list.filter(m => m.name.toLowerCase().includes(kw))
  return list
})
function toggleMcp(id: string) {
  if (selectedMcpIds.value.has(id)) selectedMcpIds.value.delete(id)
  else selectedMcpIds.value.add(id)
  selectedMcpIds.value = new Set(selectedMcpIds.value)
}

// ---- Bottom bar actions ----
function useTemplate() {
  const t = templates.find(x => x.id === selectedTmplId.value)
  if (!t) return
  const params = new URLSearchParams({ from: t.id })
  router.push({ name: 'hermes.dutyCreate', query: Object.fromEntries(params) })
}
function useSkills() {
  if (selectedSkillIds.value.size === 0) return
  const picked = [...selectedSkillIds.value].map(id => allPickerSkills.find(s => s.id === id)).filter(Boolean) as PickerSkill[]
  const caps = picked.filter(s => s.kind === 'config')
  const skills = picked.filter(s => s.kind === 'direct')
  const params: Record<string, string> = { from: 'picker' }
  if (caps.length) { params.caps = caps.map(s => s.id).join(','); params.cap_names = caps.map(s => s.name).join('|') }
  if (skills.length) { params.skills = skills.map(s => s.id).join(','); params.skill_names = skills.map(s => s.name).join('|') }
  router.push({ name: 'hermes.dutyCreate', query: params })
}
function useMcps() {
  if (selectedMcpIds.value.size === 0) return
  router.push({ name: 'hermes.dutyCreate', query: { from: 'picker', mcps: [...selectedMcpIds.value].join(',') } })
}

function badgeCls(s: PickerSkill) { return s.kind === 'config' ? 'config' : 'direct' }
</script>

<template>
  <div class="page picker-page">
    <div class="page-header">
      <div><a class="crumb-back" @click="router.back()">← 返回</a><h1>从模板 / 技能 / 连接器创建任务</h1><div class="page-sub">三种方式挑一种：模板一键复用、技能自由组合、MCP 连接器选择工具调用</div></div>
    </div>

    <div class="seg-switch picker-seg">
      <button class="seg-btn" :class="{ active: activeTab === 'tmpl' }" @click="activeTab = 'tmpl'">选模板 · 一键复用</button>
      <button class="seg-btn" :class="{ active: activeTab === 'skills' }" @click="activeTab = 'skills'">选 技能 · 自由组合</button>
      <button class="seg-btn" :class="{ active: activeTab === 'mcps' }" @click="activeTab = 'mcps'">选连接器 · MCP 工具</button>
    </div>

    <!-- ===== TAB: 模板 ===== -->
    <div v-show="activeTab === 'tmpl'" class="picker-layout">
      <aside class="picker-side">
        <div class="session-section"><div class="session-group-header"><span class="session-group-label">分组</span></div>
          <a class="session-item" :class="{ active: tmplSideFilter === 'all' }" @click="tmplSideFilter = 'all'"><span class="session-item-title">全部模板</span><span class="session-item-time">{{ templates.length }}</span></a>
          <a class="session-item" :class="{ active: tmplSideFilter === 'system' }" @click="tmplSideFilter = 'system'"><span class="session-item-title">系统预置</span><span class="session-item-time">{{ templates.length }}</span></a>
        </div>
      </aside>
      <main class="picker-main">
        <div class="picker-toolbar"><div class="search-input" style="width:280px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input v-model="tmplSearch" placeholder="搜索模板名称 / 标签"></div></div>
        <div class="card-grid picker-tmpl-grid">
          <div v-for="t in filteredTmpls" :key="t.id" class="tmpl-card" :class="{ 'tmpl-card-selected': selectedTmplId === t.id }" @click="selectedTmplId = selectedTmplId === t.id ? null : t.id">
            <div class="tmpl-card-source-badge system">系统</div>
            <div class="tmpl-card-head"><div class="tmpl-card-ic">{{ t.name[0] }}</div><div class="tmpl-card-title"><b>{{ t.name }}</b><small>v{{ t.version }} · 使用 {{ t.used }} 次</small></div></div>
            <p class="tmpl-card-desc">{{ t.desc }}</p>
            <div class="tmpl-card-caps"><span v-for="c in t.caps" :key="c" class="tag-pill">{{ c }}</span></div>
            <div class="tmpl-card-foot">{{ t.schedule }} · {{ t.deliver }}</div>
          </div>
        </div>
      </main>
    </div>

    <!-- ===== TAB: 技能 ===== -->
    <div v-show="activeTab === 'skills'" class="picker-layout">
      <aside class="picker-side">
        <div class="session-section"><div class="session-group-header"><span class="session-group-label">技能来源</span></div>
          <a class="session-item" :class="{ active: skillFilter === 'all' }" @click="skillFilter = 'all'"><span class="session-item-title">全部 技能</span><span class="session-item-time">{{ allPickerSkills.length }}</span></a>
          <a class="session-item" :class="{ active: skillFilter === 'mapairs' }" @click="skillFilter = 'mapairs'"><span class="plat-dot" style="background:#1886e7"></span><span class="session-item-title">数智大气</span><span class="session-item-time">{{ allPickerSkills.filter(s => s.source === 'mapairs').length }}</span></a>
        </div>
      </aside>
      <main class="picker-main">
        <div class="picker-toolbar"><div class="search-input" style="width:280px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input v-model="skillSearch" placeholder="搜索 技能 名称"></div></div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px">
          <div v-for="s in filteredSkills" :key="s.id" class="cap-card pkr-skill-card" :class="{ selected: selectedSkillIds.has(s.id) }" @click="toggleSkill(s.id)">
            <label class="cap-check pkr-check" @click.stop="toggleSkill(s.id)"><input type="checkbox" :checked="selectedSkillIds.has(s.id)"><span class="cap-check-box"></span></label>
            <div class="pkr-card-body"><div class="pkr-card-name">{{ s.name }}</div><div class="pkr-card-desc">{{ s.desc }}</div><div class="pkr-card-foot"><span class="pkr-tag" :class="badgeCls(s)">{{ s.kind === 'config' ? '需配置' : '直接用' }}</span></div></div>
          </div>
        </div>
      </main>
    </div>

    <!-- ===== TAB: 连接器 ===== -->
    <div v-show="activeTab === 'mcps'" class="picker-layout">
      <aside class="picker-side">
        <div class="session-section"><div class="session-group-header"><span class="session-group-label">连接器类型</span></div>
          <a class="session-item" :class="{ active: mcpFilter === 'all' }" @click="mcpFilter = 'all'"><span class="session-item-title">全部连接器</span><span class="session-item-time">{{ mcpServers.length }}</span></a>
          <a class="session-item" :class="{ active: mcpFilter === 'stdio' }" @click="mcpFilter = 'stdio'"><span class="session-item-title">本地 stdio</span><span class="session-item-time">{{ mcpServers.filter(m => m.transport === 'stdio').length }}</span></a>
          <a class="session-item" :class="{ active: mcpFilter === 'http' }" @click="mcpFilter = 'http'"><span class="session-item-title">远程 HTTP</span><span class="session-item-time">{{ mcpServers.filter(m => m.transport === 'http').length }}</span></a>
        </div>
      </aside>
      <main class="picker-main">
        <div class="picker-toolbar"><div class="search-input" style="width:280px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input v-model="mcpSearch" placeholder="搜索连接器名称"></div></div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px">
          <div v-for="m in filteredMcps" :key="m.name" class="cap-card pkr-mcp-card" :class="{ selected: selectedMcpIds.has(m.name) }" @click="toggleMcp(m.name)">
            <label class="cap-check pkr-check" @click.stop="toggleMcp(m.name)"><input type="checkbox" :checked="selectedMcpIds.has(m.name)"><span class="cap-check-box"></span></label>
            <div class="pkr-card-body"><div class="pkr-card-name">{{ m.name }}</div><div class="pkr-card-desc">{{ m.transport }} · {{ m.tools || 0 }} 个工具</div><span class="pkr-server-tag">{{ m.transport?.toUpperCase() }}</span></div>
          </div>
        </div>
      </main>
    </div>

    <!-- Sticky bottom bar -->
    <div class="picker-bar">
      <div v-if="activeTab === 'tmpl'" class="picker-bar-row"><div class="picker-bar-left"><span v-if="!selectedTmplId" class="bar-empty">请选择一个模板</span><span v-else class="bar-selected">已选：<b>{{ templates.find(t => t.id === selectedTmplId)?.name }}</b></span></div><div class="picker-bar-right"><button class="btn btn-primary" :disabled="!selectedTmplId" @click="useTemplate">使用该模板创建任务</button></div></div>
      <div v-if="activeTab === 'skills'" class="picker-bar-row"><div class="picker-bar-left"><span v-if="selectedSkillIds.size === 0" class="bar-empty">至少勾选 1 项技能</span><span v-else class="bar-selected">已选 <b>{{ selectedSkillIds.size }}</b> 项技能</span></div><div class="picker-bar-right"><button class="btn btn-default" @click="selectedSkillIds = new Set()">清空</button><button class="btn btn-primary" :disabled="selectedSkillIds.size === 0" @click="useSkills">使用选中的技能创建</button></div></div>
      <div v-if="activeTab === 'mcps'" class="picker-bar-row"><div class="picker-bar-left"><span v-if="selectedMcpIds.size === 0" class="bar-empty">至少勾选 1 个连接器</span><span v-else class="bar-selected">已选 <b>{{ selectedMcpIds.size }}</b> 个连接器</span></div><div class="picker-bar-right"><button class="btn btn-default" @click="selectedMcpIds = new Set()">清空</button><button class="btn btn-primary" :disabled="selectedMcpIds.size === 0" @click="useMcps">使用选中的连接器创建</button></div></div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.page { padding: 24px 28px 60px; max-width: 1100px; margin: 0 auto; }
.page-header { margin-bottom: 18px; .crumb-back { font-size: 13px; color: $text-secondary; cursor: pointer; display: inline-block; margin-bottom: 6px; &:hover { color: $accent-primary; } } h1 { font-size: 20px; font-weight: 600; } .page-sub { color: $text-secondary; font-size: 13px; margin-top: 4px; } }

// Tabs
.picker-seg { margin-bottom: 18px; }
.seg-switch { display: inline-flex; gap: 4px; background: $bg-secondary; border-radius: var(--radius-md); padding: 3px; }
.seg-btn { padding: 8px 18px; border: none; background: transparent; color: $text-secondary; border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; cursor: pointer; transition: .15s; font-family: inherit; &.active { background: $bg-card; color: $accent-primary; box-shadow: 0 1px 3px rgba(0,0,0,.06); } }

// Layout
.picker-layout { display: flex; gap: 18px; align-items: flex-start; }
.picker-side { width: 180px; flex-shrink: 0; }
.picker-main { flex: 1; min-width: 0; }

// Side sections
.session-section { margin-bottom: 12px; }
.session-group-header { padding: 6px 10px 4px; margin-bottom: 4px; }
.session-group-label { font-size: 12px; font-weight: 600; color: $text-muted; }
.session-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-radius: var(--radius-sm); cursor: pointer; font-size: 13px; color: $text-secondary; gap: 6px; &:hover { background: rgba(var(--accent-primary-rgb),.06); } &.active { background: rgba(var(--accent-primary-rgb),.12); color: $accent-primary; font-weight: 500; } }
.session-item-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.session-item-time { font-size: 11px; color: $text-muted; }
.plat-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

// Toolbar
.picker-toolbar { display: flex; justify-content: flex-end; margin-bottom: 14px; }

// Search
.search-input { display: flex; align-items: center; gap: 8px; padding: 7px 12px; border: 1px solid $border-color; border-radius: var(--radius-sm); background: $bg-input; svg { width: 14px; height: 14px; color: $text-muted; } input { border: none; outline: none; background: transparent; font-size: 13px; color: $text-primary; width: 100%; font-family: inherit; } }

// Template cards
.card-grid { display: grid; gap: 12px; }
.tmpl-card { background: $bg-card; border: 1px solid $border-color; border-radius: var(--radius-lg); padding: 16px 18px; cursor: pointer; transition: .15s; position: relative; &:hover { border-color: var(--border-strong); } &.tmpl-card-selected { border-color: $accent-primary; background: rgba(var(--accent-primary-rgb),.03); } }
.tmpl-card-source-badge { position: absolute; top: 12px; right: 14px; font-size: 10px; padding: 2px 8px; border-radius: 4px; background: $bg-secondary; color: $text-muted; &.system { color: $accent-primary; background: rgba(var(--accent-primary-rgb),.1); } }
.tmpl-card-head { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; .tmpl-card-ic { width: 36px; height: 36px; border-radius: 8px; background: $bg-secondary; display: flex; align-items: center; justify-content: center; font-weight: 700; color: $accent-primary; flex-shrink: 0; } b { font-size: 14px; font-weight: 600; } small { display: block; font-size: 11px; color: $text-muted; } }
.tmpl-card-desc { font-size: 12.5px; color: $text-secondary; line-height: 1.5; margin-bottom: 8px; }
.tmpl-card-caps { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 6px; .tag-pill { font-size: 10.5px; padding: 1px 6px; border-radius: 4px; background: $bg-secondary; color: $text-secondary; } }
.tmpl-card-foot { font-size: 11px; color: $text-muted; }

// Skill/MCP cards
.cap-card { background: $bg-card; border: 1px solid $border-color; border-radius: var(--radius-lg); padding: 14px 16px; cursor: pointer; transition: .15s; display: flex; gap: 10px; &:hover { border-color: var(--border-strong); } &.selected { border-color: $accent-primary; background: rgba(var(--accent-primary-rgb),.03); } }
.pkr-check { display: flex; align-items: flex-start; padding-top: 2px; flex-shrink: 0; input { display: none; } .cap-check-box { width: 18px; height: 18px; border: 2px solid $border-color; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: .12s; } input:checked + .cap-check-box { background: $accent-primary; border-color: $accent-primary; &::after { content: '✓'; color: #fff; font-size: 11px; font-weight: 700; } } }
.pkr-card-body { flex: 1; }
.pkr-card-name { font-size: 14px; font-weight: 600; margin-bottom: 4px; color: $text-primary; }
.pkr-card-desc { font-size: 12px; color: $text-secondary; line-height: 1.4; margin-bottom: 6px; }
.pkr-card-foot { display: flex; gap: 4px; }
.pkr-tag { font-size: 10.5px; padding: 1px 6px; border-radius: 4px; background: $bg-secondary; color: $text-secondary; &.config { background: var(--badge-config); color: #1d4ed8; } &.direct { background: var(--badge-direct); color: #15803d; } }
.pkr-server-tag { font-size: 10px; padding: 1px 6px; border-radius: 4px; background: rgba(109,63,240,.1); color: #6d3ff0; font-weight: 500; margin-left: auto; }

// Bottom bar
.picker-bar { position: sticky; bottom: 0; background: $bg-card; border-top: 1px solid $border-color; padding: 12px 0; margin-top: 24px; z-index: 10; }
.picker-bar-row { display: flex; align-items: center; justify-content: space-between; }
.picker-bar-left { flex: 1; }
.bar-empty { font-size: 13px; color: $text-muted; }
.bar-selected { font-size: 13px; color: $text-primary; b { color: $accent-primary; } }
.picker-bar-right { display: flex; gap: 8px; }

.btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px; border-radius: var(--radius-md); font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid transparent; transition: .15s; font-family: inherit; }
.btn-primary { background: $accent-primary; color: #fff; border-color: $accent-primary; &:hover { background: $accent-hover; } &:disabled { opacity: .4; cursor: not-allowed; } }
.btn-default { background: $bg-card; color: $text-primary; border-color: $border-color; &:hover { border-color: var(--border-strong); } }
</style>
