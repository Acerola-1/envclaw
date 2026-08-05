<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import yaml from 'js-yaml'
import { usePlatformsStore } from '@/stores/envclaw/platforms'
import { fetchSkills, type SkillInfo } from '@/api/hermes/skills'
import {
  fetchMcpServers, fetchMcpTools, mcpServerAdd, mcpServerRemove,
  mcpServerUpdate, mcpServerTest, mcpReload,
  type McpServerInfo, type McpServerConfig,
} from '@/api/hermes/mcp'

const router = useRouter()
const platformsStore = usePlatformsStore()

const activeTab = ref<'platforms' | 'skills' | 'mcps'>('platforms')
const realSkills = ref<SkillInfo[]>([])
const mcpServers = ref<McpServerInfo[]>([])
const loading = ref(false)

// ─── MCP state ───
const mcpSearchQuery = ref('')
const mcpShowModal = ref(false)
const mcpModalMode = ref<'add' | 'edit'>('add')
const mcpEditingName = ref('')
const mcpJsonText = ref('')
const mcpJsonError = ref('')
const mcpSaving = ref(false)
const mcpInputMode = ref<'json' | 'yaml'>('json')
const mcpReloading = ref(false)

const mcpShowToolsModal = ref(false)
const mcpToolsServer = ref<McpServerInfo | null>(null)
const mcpToolsMode = ref<'all' | 'include' | 'exclude'>('all')
const mcpSelectedTools = ref<string[]>([])
const mcpAllTools = ref<string[]>([])
const mcpFetchingTools = ref(false)

let mcpFormatTimer: ReturnType<typeof setTimeout> | null = null
let mcpPendingReload: ReturnType<typeof setTimeout> | null = null
let mcpAutoRetryCount = 0
const MCP_MAX_RETRIES = 5
const MCP_BASE_RETRY = 2000

// ---- Prototype mock data ----
interface MockPlatform { id: string; name: string; type: string; connected: boolean; builtin: boolean; sub: string; fields: Record<string, string> }
const MOCK_PLATFORMS: MockPlatform[] = [
  { id:'szdq', name:'数智大气', type:'内置底座', connected:true, builtin:true, sub:'大气环境监测底座 · 系统统一维护', fields:{ type:'大气环境', auth:'—(内置)', account:'系统账号', caps:'4 项' } },
  // { id:'zd', name:'中大平台', type:'外部', connected:true, builtin:false, sub:'环境监测综合服务 · 站点、排名、小时数据', fields:{ type:'大气/水质', auth:'OAuth 2.0', account:'zd_admin', caps:'4 项' } },
  // { id:'hnsjk', name:'省大数据', type:'外部', connected:true, builtin:false, sub:'省级综合质量排名 · 省控站点小时数据', fields:{ type:'空气质量', auth:'API Key', account:'hn_sjk_key***', caps:'3 项' } },
  // { id:'hdjk', name:'华东平台', type:'外部', connected:false, builtin:false, sub:'区域联防联控 · 跨区域传输贡献', fields:{ type:'空气质量', auth:'OAuth 2.0', account:'未配置', caps:'3 项' } },
]
interface MockSkill { id: string; platformId: string; name: string; tags: string[]; desc: string; params: { k: string; v: string }[]; outputs: string[]; examples: string[] }
const MOCK_SKILLS: MockSkill[] = [
  { id:'mapPackage', platformId:'szdq', name:'一张图', tags:['截图','地图','可视化'], desc:'生成数智大气一张图成果：地图类型、范围、因子、风场开关', params:[{k:'地图主题',v:'浅色/深色'},{k:'地图模式',v:'监测图/插值图'},{k:'范围',v:'全国/省/市'},{k:'因子',v:'AQI/PM₂.₅等'}], outputs:['一张图 PNG'], examples:['平顶山市 AQI 插值图'] },
  { id:'concentrationRanking', platformId:'szdq', name:'浓度排名', tags:['截图','排名','分析'], desc:'按区域/时间/因子查询浓度排名并截图+文字分析', params:[{k:'查询对象',v:'城市/站点'},{k:'区域',v:'行政区'},{k:'因子',v:'首要污染物/AQI等'}], outputs:['排名 PNG','文字总结'], examples:['平顶山市 PM₂.₅ 日排名'] },
  { id:'hourlyBrief', platformId:'szdq', name:'小时播报', tags:['截图','播报','小时'], desc:'按行政区查询小时播报数据并截取页面图片', params:[{k:'区域',v:'行政区'},{k:'因子',v:'AQI/PM₂.₅等'}], outputs:['小时播报 PNG'], examples:['全市小时播报截图'] },
  { id:'monitoringData', platformId:'szdq', name:'监测数据', tags:['数据','查询','小时'], desc:'提取各点位小时/分钟监测数据，结构化输出', params:[{k:'区域',v:'行政区'},{k:'时间粒度',v:'小时/日'}], outputs:['CSV/Excel'], examples:['平顶山市 7月AQI小时CSV'] },
  // { id:'zdRealtime', platformId:'zd', name:'分钟数据流读取', tags:['数据采集','分钟'], desc:'提取各点位分钟级PM₂.₅/AQI/O₃数据流', params:[{k:'区域',v:'省/市'},{k:'因子',v:'PM₂.₅/AQI等'}], outputs:['分钟CSV'], examples:['24小时分钟数据'] },
  // { id:'zdRankTable', platformId:'zd', name:'排名通报表下载', tags:['下载','Excel'], desc:'下载综合质量排名通报Excel报表', params:[{k:'时间类型',v:'日/月/年'},{k:'区域',v:'省/市'}], outputs:['排名.xlsx'], examples:['河南省AQI排名表'] },
  // { id:'zdHourExport', platformId:'zd', name:'小时监测数据导出', tags:['数据','CSV'], desc:'按时间范围导出各站点小时监测数据', params:[{k:'范围',v:'开始-结束'},{k:'区域',v:'省/市'}], outputs:['CSV/Excel'], examples:['一周小时数据'] },
  // { id:'zdMinuteScreenshot', platformId:'zd', name:'分钟数据截图', tags:['截图','分钟'], desc:'截取分钟数据展示页面当前视图', params:[{k:'区域',v:'省/市'},{k:'视图',v:'表格/折线'}], outputs:['分钟截图 PNG'] },
  // { id:'hnsjkProvinceRank', platformId:'hnsjk', name:'省级城市综合排名', tags:['排名','同比环比'], desc:'查询省级城市综合质量排名含同比环比', params:[{k:'时间类型',v:'日/月'},{k:'区域',v:'省份'}], outputs:['排名表','趋势图'], examples:['河南省城市排名'] },
  // { id:'hnsjkHourData', platformId:'hnsjk', name:'省控站点小时数据', tags:['数据','省控站'], desc:'提取省控站点小时监测数据', params:[{k:'省份',v:'河南'},{k:'因子',v:'PM₂.₅等'}], outputs:['小时CSV'] },
  // { id:'hnsjkAlert', platformId:'hnsjk', name:'预警信息汇总导出', tags:['预警','导出'], desc:'汇总当前预警信息按站点/级别组织', params:[{k:'区域',v:'省/市'},{k:'级别',v:'蓝/黄/橙/红'}], outputs:['预警汇总表'] },
  // { id:'hdjkRegional', platformId:'hdjk', name:'联防联控数据共享', tags:['跨区域','传输'], desc:'跨区域查询联防联控数据共享信息', params:[{k:'区域组',v:'多个区域'},{k:'因子',v:'PM₂.₅/O₃'}], outputs:['传输贡献矩阵'] },
  // { id:'hdjkCompare', platformId:'hdjk', name:'跨区域对比报告', tags:['报告','对比'], desc:'生成跨区域空气质量对比分析报告', params:[{k:'区域组',v:'≥2'},{k:'因子',v:'AQI等'}], outputs:['对比报告'] },
  // { id:'hdjkOverview', platformId:'hdjk', name:'区域联合日报', tags:['日报','联防'], desc:'多区域AQI优良率/首要污染物/预警热点一览', params:[{k:'区域',v:'城市群'},{k:'日期',v:'YYYY-MM-DD'}], outputs:['联合日报'] },
]

// ---- Computed ----
const visiblePlatforms = computed(() => MOCK_PLATFORMS.filter(p => p.id !== 'szdq'))
const allPlatforms = computed(() => MOCK_PLATFORMS)

const skillCat = ref('all'); const skillSearch = ref('')
const filteredSkills = computed(() => {
  let list = MOCK_SKILLS
  if (skillCat.value !== 'all') list = list.filter(s => s.platformId === skillCat.value)
  const kw = skillSearch.value.trim().toLowerCase()
  if (kw) list = list.filter(s => s.name.includes(kw) || s.tags.some(t => t.includes(kw)))
  return list
})
const detailSkill = ref<MockSkill | null>(null)
function openDetail(s: MockSkill) { detailSkill.value = s }
function closeDetail() { detailSkill.value = null }
function goToPicker(skillId: string) { router.push({ name: 'hermes.dutyPicker', hash: '#tab=skills&pick=' + skillId }) }

// ─── MCP computed ───
const mcpConnected = computed(() => mcpServers.value.filter(s => s.connected).length)
const mcpTotalTools = computed(() => mcpServers.value.reduce((sum, s) => sum + (s.tools || 0), 0))
const filteredMcpServers = computed(() => {
  const q = mcpSearchQuery.value.trim().toLowerCase()
  if (!q) return mcpServers.value
  return mcpServers.value.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.transport.toLowerCase().includes(q) ||
    s.tool_names.some(n => n.toLowerCase().includes(q))
  )
})

function scheduleMcpReload(delay = 3000) {
  if (mcpPendingReload) clearTimeout(mcpPendingReload)
  mcpPendingReload = setTimeout(() => { mcpPendingReload = null; loadMcpServers() }, delay)
}

async function loadMcpServers() {
  try {
    const data = await fetchMcpServers()
    mcpServers.value = data.servers ?? []
    const hasPending = mcpServers.value.some(s => s.raw_config.enabled !== false && !s.connected)
    if (hasPending && mcpAutoRetryCount < MCP_MAX_RETRIES) {
      const delay = MCP_BASE_RETRY * Math.pow(2, mcpAutoRetryCount)
      mcpAutoRetryCount++
      scheduleMcpReload(delay)
    } else {
      mcpAutoRetryCount = 0
    }
  } catch { /* */ }
}

// ─── MCP config parse/validate ───
const mcpJsonPlaceholder = '{\n  "my-server": {\n    "command": "npx",\n    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]\n  }\n}'
const mcpYamlPlaceholder = 'my-server:\n  command: npx\n  args:\n    - "-y"\n    - "@modelcontextprotocol/server-filesystem"\n    - "/path"'

function mcpParseConfig(text: string): { data: Record<string, unknown> | null; error: string } {
  if (mcpInputMode.value === 'json') {
    try {
      const obj = JSON.parse(text)
      if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return { data: null, error: '配置必须是对象格式' }
      return { data: obj, error: '' }
    } catch { return { data: null, error: 'JSON 格式无效' } }
  } else {
    try {
      const obj = yaml.load(text, { schema: yaml.JSON_SCHEMA })
      if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return { data: null, error: '配置必须是对象格式' }
      return { data: obj as Record<string, unknown>, error: '' }
    } catch (e: any) { return { data: null, error: `YAML 格式无效: ${e.message || ''}` } }
  }
}

function mcpExtractServers(data: Record<string, unknown> | null): { servers: Record<string, unknown>; error: string } {
  if (!data) return { servers: {}, error: '无效的配置' }
  if (data.mcpServers && typeof data.mcpServers === 'object' && !(data as any).command) {
    return { servers: data.mcpServers as Record<string, unknown>, error: '' }
  }
  if (data.mcp_servers && typeof data.mcp_servers === 'object' && !(data as any).command) {
    return { servers: data.mcp_servers as Record<string, unknown>, error: '' }
  }
  return { servers: data, error: '' }
}

function mcpValidateServer(name: string, config: unknown): string | null {
  if (typeof config !== 'object' || config === null) return `${name}: 配置必须是对象`
  const cfg = config as Record<string, unknown>
  if (!cfg.command && !cfg.url) return `${name}: 必须包含 command 或 url`
  return null
}

function mcpParseAndValidate(text: string): { servers: Record<string, unknown>; error: string } {
  const { data, error: parseErr } = mcpParseConfig(text)
  if (parseErr) return { servers: {}, error: parseErr }
  const { servers, error: extractErr } = mcpExtractServers(data)
  if (extractErr) return { servers: {}, error: extractErr }
  for (const [name, config] of Object.entries(servers)) {
    const err = mcpValidateServer(name, config)
    if (err) return { servers: {}, error: err }
  }
  return { servers, error: '' }
}

function handleMcpInput(text: string) {
  if (mcpFormatTimer) clearTimeout(mcpFormatTimer)
  if (!text.trim()) { mcpJsonError.value = ''; return }
  const { data, error: parseErr } = mcpParseConfig(text)
  if (parseErr) { mcpJsonError.value = parseErr; return }
  const { servers: extracted, error: extractErr } = mcpExtractServers(data)
  if (extractErr) { mcpJsonError.value = extractErr; return }
  mcpJsonError.value = ''
  mcpFormatTimer = setTimeout(() => {
    const formatted = mcpInputMode.value === 'json'
      ? JSON.stringify(extracted, null, 2)
      : yaml.dump(extracted, { indent: 2, lineWidth: -1 }).trimEnd()
    if (formatted !== text) mcpJsonText.value = formatted
  }, 1500)
}

function handleMcpModeChange(mode: 'json' | 'yaml') {
  if (!mcpJsonText.value.trim()) return
  let data: Record<string, unknown> | null = null
  try {
    if (mode === 'json') data = yaml.load(mcpJsonText.value, { schema: yaml.JSON_SCHEMA }) as Record<string, unknown>
    else data = JSON.parse(mcpJsonText.value)
  } catch { return }
  if (!data || typeof data !== 'object') return
  mcpJsonText.value = mode === 'json' ? JSON.stringify(data, null, 2) : yaml.dump(data, { indent: 2, lineWidth: -1 }).trimEnd()
  mcpJsonError.value = ''
}

// ─── MCP modal actions ───
function openMcpAddModal() {
  mcpModalMode.value = 'add'
  mcpEditingName.value = ''
  mcpJsonText.value = ''
  mcpJsonError.value = ''
  mcpInputMode.value = 'json'
  mcpShowModal.value = true
}

function openMcpEditModal(server: McpServerInfo) {
  mcpModalMode.value = 'edit'
  mcpEditingName.value = server.name
  const cfg = { [server.name]: server.raw_config }
  mcpJsonText.value = mcpInputMode.value === 'yaml'
    ? yaml.dump(cfg, { indent: 2, lineWidth: -1 }).trimEnd()
    : JSON.stringify(cfg, null, 2)
  mcpJsonError.value = ''
  mcpShowModal.value = true
}

async function saveMcpServer() {
  if (mcpFormatTimer) { clearTimeout(mcpFormatTimer); mcpFormatTimer = null }
  const { servers: parsed, error: validationErr } = mcpParseAndValidate(mcpJsonText.value)
  if (validationErr) { mcpJsonError.value = validationErr; return }
  mcpJsonError.value = ''
  mcpSaving.value = true
  try {
    if (mcpModalMode.value === 'add') {
      const entries = Object.entries(parsed)
      if (entries.length === 0) { mcpJsonError.value = '无效的配置'; mcpSaving.value = false; return }
      for (const [name, config] of entries) {
        if (typeof config !== 'object' || config === null) continue
        await mcpServerAdd(name, config as McpServerConfig)
      }
      mcpShowModal.value = false
      await loadMcpServers()
      scheduleMcpReload()
    } else {
      const name = mcpEditingName.value
      const config = (parsed[name] && typeof parsed[name] === 'object')
        ? parsed[name] as Record<string, unknown>
        : parsed
      const res = await mcpServerUpdate(name, config)
      if (res.ok) {
        mcpShowModal.value = false
        await loadMcpServers()
        scheduleMcpReload()
      }
    }
  } catch { /* */ }
  finally { mcpSaving.value = false }
}

// ─── MCP card actions ───
async function handleMcpTest(server: McpServerInfo) {
  try {
    const res = await mcpServerTest(server.name)
    if (res.ok && res.tools) {
      console.log(`[MCP] ${server.name} 测试成功，${res.tools.length} 个工具`)
    }
  } catch { /* */ }
}

async function handleMcpReload(serverName?: string) {
  mcpReloading.value = true
  try {
    await mcpReload(serverName)
    scheduleMcpReload()
  } catch { /* */ }
  finally { mcpReloading.value = false }
}

async function handleMcpRemove(server: McpServerInfo) {
  if (!confirm(`确定删除连接器「${server.name}」吗？`)) return
  try {
    const res = await mcpServerRemove(server.name)
    if (res.ok) await loadMcpServers()
  } catch { /* */ }
}

async function handleMcpToggleEnabled(server: McpServerInfo) {
  const enabled = !server.raw_config.enabled
  try {
    const config = { ...server.raw_config, enabled }
    const res = await mcpServerUpdate(server.name, config)
    if (res.ok) {
      await mcpReload(server.name)
      scheduleMcpReload()
    }
  } catch { /* */ }
}

// ─── MCP tools visibility ───
function openMcpToolsModal(server: McpServerInfo) {
  mcpToolsServer.value = server
  const tools = server.raw_config.tools
  if (!tools || (!tools.include && !tools.exclude)) {
    mcpToolsMode.value = 'all'
    mcpSelectedTools.value = [...server.tool_names]
  } else if (tools.include) {
    mcpToolsMode.value = 'include'
    mcpSelectedTools.value = [...tools.include]
  } else {
    mcpToolsMode.value = 'exclude'
    mcpSelectedTools.value = [...(tools.exclude || [])]
  }
  mcpAllTools.value = [...server.tool_names]
  mcpShowToolsModal.value = true
}

async function fetchMcpToolsList() {
  if (!mcpToolsServer.value) return
  mcpFetchingTools.value = true
  try {
    const res = await fetchMcpTools(mcpToolsServer.value.name, true)
    if (res.ok && res.results?.length) {
      const sr = res.results.find((r: { server: string }) => r.server === mcpToolsServer.value!.name)
      if (sr?.tools) {
        mcpAllTools.value = sr.tools.map((t: { name: string }) => t.name)
        if (mcpToolsMode.value === 'all') mcpSelectedTools.value = [...mcpAllTools.value]
      }
    }
  } catch { /* */ }
  finally { mcpFetchingTools.value = false }
}

function handleMcpToolsModeChange(mode: 'all' | 'include' | 'exclude') {
  mcpToolsMode.value = mode
  if (mode === 'all') { mcpSelectedTools.value = [...mcpAllTools.value] }
  else {
    const server = mcpToolsServer.value
    if (server) {
      const tools = server.raw_config.tools
      if (mode === 'include' && tools?.include) mcpSelectedTools.value = [...tools.include]
      else if (mode === 'exclude' && tools?.exclude) mcpSelectedTools.value = [...tools.exclude]
      else mcpSelectedTools.value = []
    }
  }
}

function handleMcpToolCheck(tool: string, checked: boolean) {
  if (checked) {
    if (!mcpSelectedTools.value.includes(tool)) mcpSelectedTools.value.push(tool)
  } else {
    mcpSelectedTools.value = mcpSelectedTools.value.filter(t => t !== tool)
  }
}

async function saveMcpToolsVisibility() {
  const server = mcpToolsServer.value
  if (!server) return
  const config: Record<string, unknown> = { ...server.raw_config }
  if (mcpToolsMode.value === 'all') {
    delete (config as any).tools
  } else if (mcpToolsMode.value === 'include') {
    (config as any).tools = { include: [...mcpSelectedTools.value] }
  } else {
    (config as any).tools = { exclude: [...mcpSelectedTools.value] }
  }
  try {
    const res = await mcpServerUpdate(server.name, config)
    if (res.ok) {
      mcpShowToolsModal.value = false
      await loadMcpServers()
      scheduleMcpReload()
    }
  } catch { /* */ }
}

onMounted(async () => {
  loading.value = true
  await platformsStore.fetchPlatforms()
  try { realSkills.value = await fetchSkills() } catch { /* */ }
  await loadMcpServers()
  loading.value = false
})

onUnmounted(() => {
  if (mcpFormatTimer) { clearTimeout(mcpFormatTimer); mcpFormatTimer = null }
  if (mcpPendingReload) { clearTimeout(mcpPendingReload); mcpPendingReload = null }
})
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div><h1>平台·技能·连接器</h1><div class="page-sub">平台接入、技能库（含需配置与直接用两种形态）、MCP 连接器一站式管理</div></div>
      <div class="page-actions">
        <a v-if="activeTab==='platforms'" class="btn btn-primary" href="/hermes/capabilities/onboarding"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>添加平台</a>
        <a v-else-if="activeTab==='skills'" class="btn btn-primary"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>导入技能</a>
        <a v-else class="btn btn-primary" @click="openMcpAddModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>添加连接器</a>
      </div>
    </div>
    <div class="seg-switch" style="margin-bottom:18px">
      <button class="seg-btn" :class="{active:activeTab==='platforms'}" @click="activeTab='platforms'">平台 <span class="seg-count">{{ allPlatforms.length }}</span></button>
      <button class="seg-btn" :class="{active:activeTab==='skills'}" @click="activeTab='skills'">技能 <span class="seg-count">{{ MOCK_SKILLS.length }}</span></button>
      <button class="seg-btn" :class="{active:activeTab==='mcps'}" @click="activeTab='mcps'">连接器 <span class="seg-count">{{ mcpServers.length }}</span></button>
    </div>
    <div v-if="loading" class="loading-msg">加载中...</div>

    <!-- ===== TAB: 平台 ===== -->
    <div v-else-if="activeTab==='platforms'">
      <div class="warning-banner"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><span><b>数智大气为内置底座</b>，禁止修改、禁用或删除。其能力由系统统一维护。</span></div>
      <div class="plat-stats">
        <div class="plat-stat"><div class="plat-stat-label">平台总数</div><div class="plat-stat-value"><span class="plat-stat-num">{{ allPlatforms.length }}</span></div></div>
        <div class="plat-stat connected"><div class="plat-stat-label"><span class="pill-dot" style="background:var(--success)"></span>已连接</div><div class="plat-stat-value" style="color:var(--success)"><span class="plat-stat-num">{{ allPlatforms.filter(p=>p.connected).length }}</span></div></div>
        <div class="plat-stat disconnected"><div class="plat-stat-label"><span class="pill-dot" style="background:var(--warning)"></span>未连接</div><div class="plat-stat-value" style="color:var(--warning)"><span class="plat-stat-num">{{ allPlatforms.filter(p=>!p.connected).length }}</span></div></div>
        <div class="plat-stat"><div class="plat-stat-label">能力总数</div><div class="plat-stat-value"><span class="plat-stat-num">{{ MOCK_SKILLS.length }}</span><span class="plat-stat-unit"> 项</span></div></div>
      </div>
      <div class="platforms">
        <div v-for="p in allPlatforms" :key="p.id" class="platform-card">
          <div class="plat-head">
            <div class="plat-icon-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="22" height="22"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/></svg></div>
            <div class="plat-info">
              <div class="plat-name-row"><span class="plat-name">{{ p.name }}</span><span v-if="p.builtin" class="plat-builtin">内置底座</span><span class="plat-status" :class="p.connected?'connected':'disconnected'"><span class="pill-dot"></span>{{ p.connected?'已连接':'未连接' }}</span></div>
              <div class="plat-sub">{{ p.sub }}</div>
            </div>
          </div>
          <div class="plat-body">
            <div class="info-row"><span class="label">类型</span><span class="val">{{ p.fields.type }}</span></div>
            <div class="info-row"><span class="label">认证</span><span class="val">{{ p.fields.auth }}</span></div>
            <div class="info-row"><span class="label">账号</span><span class="val">{{ p.fields.account }}</span></div>
            <div class="info-row"><span class="label">能力</span><span class="val">{{ p.fields.caps }}</span></div>
          </div>
          <div class="plat-foot">
            <div class="plat-foot-left"><b>{{ p.connected?'即时可用' : '未配置，无法测试' }}</b></div>
            <div class="plat-actions">
              <button class="btn btn-default btn-sm" @click="activeTab='skills';skillCat=p.id">查看能力</button>
              <button v-if="!p.builtin" class="btn btn-default btn-sm">编辑</button>
              <button v-if="!p.builtin" class="btn btn-default btn-sm">测试连接</button>
              <button v-if="!p.builtin" class="btn btn-default btn-sm danger">删除</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== TAB: 技能 ===== -->
    <div v-else-if="activeTab==='skills'">
      <div class="onboard-card">
        <div class="onboard-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2l2.4 7.4h7.6l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"/></svg></div>
        <div class="onboard-content"><div class="onboard-title">技能库</div><div class="onboard-desc">在创建任务时选择技能，AI Agent 会按你选定的技能组合并自动执行。其中部分技能需要先配置参数（带<b style="color:#0b65bb">「需配置」</b>徽章），另一部分可由 AI 直接调用（带<b style="color:#1d8c52">「直接用」</b>徽章）。</div></div>
      </div>
      <div class="plat-stats">
        <div class="plat-stat"><div class="plat-stat-label">技能总数</div><div class="plat-stat-value"><span class="plat-stat-num">{{ MOCK_SKILLS.length }}</span></div></div>
        <div class="plat-stat connected"><div class="plat-stat-label"><span class="pill-dot" style="background:var(--accent-primary)"></span>需配置</div><div class="plat-stat-value" style="color:var(--accent-primary)"><span class="plat-stat-num">{{ MOCK_SKILLS.length }}</span></div></div>
        <div class="plat-stat connected"><div class="plat-stat-label"><span class="pill-dot" style="background:var(--success)"></span>直接用</div><div class="plat-stat-value" style="color:var(--success)"><span class="plat-stat-num">0</span></div></div>
      </div>
      <div class="cap-tabs">
        <button class="cap-tab" :class="{active:skillCat==='all'}" @click="skillCat='all'">全部 <span class="cap-tab-num">{{ MOCK_SKILLS.length }}</span></button>
        <button class="cap-tab" :class="{active:skillCat==='szdq'}" @click="skillCat='szdq'">数智大气 <span class="cap-tab-num">{{ MOCK_SKILLS.filter(s=>s.platformId==='szdq').length }}</span></button>
        <!-- <button class="cap-tab" :class="{active:skillCat==='zd'}" @click="skillCat='zd'">中大平台 <span class="cap-tab-num">{{ MOCK_SKILLS.filter(s=>s.platformId==='zd').length }}</span></button>
        <button class="cap-tab" :class="{active:skillCat==='hnsjk'}" @click="skillCat='hnsjk'">省大数据 <span class="cap-tab-num">{{ MOCK_SKILLS.filter(s=>s.platformId==='hnsjk').length }}</span></button>
        <button class="cap-tab" :class="{active:skillCat==='hdjk'}" @click="skillCat='hdjk'">华东平台 <span class="cap-tab-num">{{ MOCK_SKILLS.filter(s=>s.platformId==='hdjk').length }}</span></button> -->
        <div class="cap-tabs-right"><div class="search-input"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input v-model="skillSearch" placeholder="搜索 技能..."></div></div>
      </div>
      <div class="cap-grid">
        <div v-for="s in filteredSkills" :key="s.id" class="cap-card" @click="openDetail(s)">
          <div class="cap-card-top">
            <div class="cap-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/></svg></div>
            <div class="cap-name-block"><div class="cap-name">{{ s.name }}</div><div class="cap-platform">{{ MOCK_PLATFORMS.find(p=>p.id===s.platformId)?.name || s.platformId }}</div></div>
            <span class="cap-badge config">需配置</span>
          </div>
          <div class="cap-desc">{{ s.desc }}</div>
          <div class="cap-tags"><span v-for="t in s.tags.slice(0,3)" :key="t" class="cap-tag">{{ t }}</span></div>
          <div class="cap-foot">
            <button class="btn btn-default btn-sm" @click.stop="openDetail(s)">详情</button>
            <button class="btn btn-primary btn-sm" @click.stop="goToPicker(s.id)">组合到任务</button>
          </div>
        </div>
        <div v-if="filteredSkills.length===0" class="cap-empty"><div class="cap-empty-title">没有匹配的技能</div></div>
      </div>

      <!-- Skill detail drawer -->
      <Teleport to="body">
        <div v-if="detailSkill" class="cdd-overlay" @click.self="closeDetail">
          <aside class="cdd-panel">
            <div class="cdd-head"><div class="cdd-head-meta"><div class="cdd-icon-sq"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="22" height="22"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/></svg></div><div style="min-width:0;flex:1"><h2 class="cdd-title">{{ detailSkill.name }}</h2><div class="cdd-sub">{{ MOCK_PLATFORMS.find(p=>p.id===detailSkill.platformId)?.name }} · 需配置</div></div></div><button class="cdd-close" @click="closeDetail"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
            <div class="cdd-scroll">
              <div class="cdd-section"><div class="cdd-sec-title">功能说明</div><div class="cdd-sec-body">{{ detailSkill.desc }}</div></div>
              <div class="cdd-section"><div class="cdd-sec-title">参数配置</div><table class="cdd-table"><thead><tr><th>参数名</th><th>可选值</th></tr></thead><tbody><tr v-for="p in detailSkill.params" :key="p.k"><td>{{ p.k }}</td><td>{{ p.v }}</td></tr></tbody></table></div>
              <div class="cdd-section"><div class="cdd-sec-title">产出物</div><ul class="cdd-list"><li v-for="o in detailSkill.outputs" :key="o">{{ o }}</li></ul></div>
              <div class="cdd-section"><div class="cdd-sec-title">调用示例</div><ul class="cdd-list cdd-list-num"><li v-for="e in (detailSkill.examples||[])" :key="e">{{ e }}</li></ul></div>
            </div>
            <div class="cdd-foot"><button class="btn btn-default" @click="closeDetail">关闭</button><button class="btn btn-primary" @click="goToPicker(detailSkill.id)">组合到任务</button></div>
          </aside>
        </div>
      </Teleport>
    </div>

    <!-- ===== TAB: 连接器 ===== -->
    <div v-else-if="activeTab==='mcps'">
      <div class="onboard-card">
        <div class="onboard-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg></div>
        <div class="onboard-content"><div class="onboard-title">MCP 连接器</div><div class="onboard-desc">Model Context Protocol 标准服务，让 AI Agent 能调用外部工具和数据源。系统内置多个 MCP 服务，支持测试连接、启用/禁用、编辑配置。</div></div>
      </div>
      <div class="plat-stats">
        <div class="plat-stat"><div class="plat-stat-label">连接器总数</div><div class="plat-stat-value"><span class="plat-stat-num">{{ mcpServers.length }}</span></div></div>
        <div class="plat-stat connected"><div class="plat-stat-label"><span class="pill-dot" style="background:var(--success)"></span>已连接</div><div class="plat-stat-value" style="color:var(--success)"><span class="plat-stat-num">{{ mcpConnected }}</span></div></div>
        <div class="plat-stat disconnected"><div class="plat-stat-label"><span class="pill-dot" style="background:var(--warning)"></span>未连接</div><div class="plat-stat-value" style="color:var(--warning)"><span class="plat-stat-num">{{ mcpServers.length - mcpConnected }}</span></div></div>
        <div class="plat-stat"><div class="plat-stat-label">工具总数</div><div class="plat-stat-value"><span class="plat-stat-num">{{ mcpTotalTools }}</span></div></div>
      </div>

      <!-- Toolbar -->
      <div class="mcp-toolbar">
        <div class="search-input"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input v-model="mcpSearchQuery" placeholder="搜索连接器..."></div>
        <div class="mcp-toolbar-actions">
          <button class="btn btn-default btn-sm" :disabled="mcpReloading" @click="handleMcpReload()">{{ mcpReloading ? '重载中...' : '重载全部' }}</button>
          <button class="btn btn-primary btn-sm" @click="openMcpAddModal()">添加连接器</button>
        </div>
      </div>

      <div class="platforms">
        <div v-for="m in filteredMcpServers" :key="m.name" class="platform-card">
          <div class="plat-head">
            <div class="plat-icon-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="22" height="22"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="4"/></svg></div>
            <div class="plat-info">
              <div class="plat-name-row">
                <span class="plat-name">{{ m.name }}</span>
                <span class="plat-status" :class="m.connected?'connected':'disconnected'"><span class="pill-dot"></span>{{ m.connected?'已连接':'未连接' }}</span>
                <label class="toggle-switch" @click.stop><input type="checkbox" :checked="m.raw_config.enabled !== false" @change="handleMcpToggleEnabled(m)"><span class="toggle-slider"></span></label>
              </div>
              <div class="plat-sub">{{ m.transport?.toUpperCase() }} 协议 · {{ m.tools || 0 }} 个注册工具</div>
            </div>
          </div>
          <div class="plat-body">
            <div class="info-row"><span class="label">传输方式</span><span class="val">{{ m.transport || '—' }}</span></div>
            <div class="info-row"><span class="label">工具数量</span><span class="val">{{ m.tools || 0 }} 个</span></div>
            <div class="info-row"><span class="label">已注册</span><span class="val">{{ m.tools_registered ?? '—' }}</span></div>
            <div class="info-row"><span class="label">状态</span><span class="val">{{ m.error ? '异常' : m.connected ? '正常' : '未连接' }}</span></div>
          </div>
          <div class="plat-foot">
            <div class="plat-foot-left"><b>{{ m.connected ? '已连接' : '未连接' }}</b>{{ m.error ? ' · ' + m.error : '' }}</div>
            <div class="plat-actions">
              <button class="btn btn-default btn-sm" @click="handleMcpTest(m)">测试连接</button>
              <button class="btn btn-default btn-sm" @click="openMcpToolsModal(m)">管理工具</button>
              <button class="btn btn-default btn-sm" @click="openMcpEditModal(m)">编辑</button>
              <button class="btn btn-default btn-sm" @click="handleMcpReload(m.name)">重载</button>
              <button class="btn btn-default btn-sm danger" @click="handleMcpRemove(m)">删除</button>
            </div>
          </div>
        </div>
      </div>
      <div v-if="mcpServers.length===0" class="plat-empty"><div class="plat-empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="26" height="26"><path d="M12 2v4"/><path d="M12 18v4"/><circle cx="12" cy="12" r="4"/></svg></div><div class="plat-empty-title">暂无连接器</div><div class="plat-empty-hint">请先在服务端配置 MCP 服务或重启以触发自动注入</div></div>
    </div>

    <!-- MCP Add/Edit Modal -->
    <Teleport to="body">
      <div v-if="mcpShowModal" class="cdd-overlay" @click.self="mcpShowModal = false">
        <aside class="cdd-panel">
          <div class="cdd-head"><div class="cdd-head-meta"><div class="cdd-icon-sq"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="22" height="22"><path d="M12 2v4"/><circle cx="12" cy="12" r="4"/></svg></div><div style="min-width:0;flex:1"><h2 class="cdd-title">{{ mcpModalMode === 'add' ? '添加连接器' : '编辑 ' + mcpEditingName }}</h2><div class="cdd-sub">支持 JSON 或 YAML 格式</div></div></div><button class="cdd-close" @click="mcpShowModal = false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
          <div class="cdd-scroll">
            <div class="mcp-mode-row">
              <button class="seg-btn" :class="{active:mcpInputMode==='json'}" @click="handleMcpModeChange('json')">JSON</button>
              <button class="seg-btn" :class="{active:mcpInputMode==='yaml'}" @click="handleMcpModeChange('yaml')">YAML</button>
            </div>
            <textarea
              v-model="mcpJsonText"
              class="mcp-textarea"
              :placeholder="mcpInputMode === 'json' ? mcpJsonPlaceholder : mcpYamlPlaceholder"
              rows="16"
              @input="(e: any) => handleMcpInput(e.target.value)"
            ></textarea>
            <div v-if="mcpJsonError" class="mcp-error">{{ mcpJsonError }}</div>
          </div>
          <div class="cdd-foot"><button class="btn btn-default" @click="mcpShowModal = false">取消</button><button class="btn btn-primary" :disabled="mcpSaving" @click="saveMcpServer()">{{ mcpSaving ? '保存中...' : (mcpModalMode === 'add' ? '添加' : '保存') }}</button></div>
        </aside>
      </div>
    </Teleport>

    <!-- MCP Tools Visibility Modal -->
    <Teleport to="body">
      <div v-if="mcpShowToolsModal" class="cdd-overlay" @click.self="mcpShowToolsModal = false">
        <aside class="cdd-panel">
          <div class="cdd-head"><div class="cdd-head-meta"><div class="cdd-icon-sq"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="22" height="22"><circle cx="12" cy="12" r="4"/></svg></div><div style="min-width:0;flex:1"><h2 class="cdd-title">管理工具可见性</h2><div class="cdd-sub">{{ mcpToolsServer?.name }}</div></div></div><button class="cdd-close" @click="mcpShowToolsModal = false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
          <div class="cdd-scroll">
            <div class="tools-modal-header-row"><span class="label">工具模式</span><button class="btn btn-default btn-sm" :disabled="mcpFetchingTools" @click="fetchMcpToolsList()">刷新工具列表</button></div>
            <div class="seg-switch" style="margin-bottom:14px">
              <button class="seg-btn" :class="{active:mcpToolsMode==='all'}" @click="handleMcpToolsModeChange('all')">全部</button>
              <button class="seg-btn" :class="{active:mcpToolsMode==='include'}" @click="handleMcpToolsModeChange('include')">白名单</button>
              <button class="seg-btn" :class="{active:mcpToolsMode==='exclude'}" @click="handleMcpToolsModeChange('exclude')">黑名单</button>
            </div>
            <div v-if="mcpAllTools.length" class="tools-check-grid">
              <label v-for="tool in mcpAllTools" :key="tool" class="tool-check-item" :class="{ disabled: mcpToolsMode === 'all' }">
                <input type="checkbox" :checked="mcpSelectedTools.includes(tool)" :disabled="mcpToolsMode === 'all'" @change="(e: any) => handleMcpToolCheck(tool, e.target.checked)">
                <span class="tool-check-name">{{ tool }}</span>
              </label>
            </div>
            <div v-else class="tools-empty">暂无工具数据，请点击「刷新工具列表」获取</div>
            <div v-if="mcpAllTools.length" class="tools-summary">
              <span v-if="mcpToolsMode==='all'">全部 {{ mcpAllTools.length }} 个工具可见</span>
              <span v-else-if="mcpToolsMode==='include'">已选 {{ mcpSelectedTools.length }} / {{ mcpAllTools.length }} 个工具</span>
              <span v-else>已排除 {{ mcpSelectedTools.length }} / {{ mcpAllTools.length }} 个工具</span>
            </div>
          </div>
          <div class="cdd-foot"><button class="btn btn-default" @click="mcpShowToolsModal = false">取消</button><button class="btn btn-primary" @click="saveMcpToolsVisibility()">保存</button></div>
        </aside>
      </div>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.page { padding: 24px 28px 60px; max-width: 1180px; margin: 0 auto; }
.page-header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 18px; h1 { font-size: 20px; font-weight: 600; } .page-sub { color: $text-secondary; font-size: 13px; margin-top: 5px; } }
.page-actions { display: flex; gap: 8px; }
.loading-msg { text-align: center; padding: 48px; color: $text-muted; }
.empty-state { text-align: center; padding: 48px; color: $text-muted; font-size: 13px; }

.btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: var(--radius-md); font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid transparent; transition: .15s; text-decoration: none; font-family: inherit; svg { width: 14px; height: 14px; } }
.btn-primary { background: $accent-primary; color: #fff; &:hover { background: $accent-hover; } }
.btn-default { background: $bg-card; color: $text-primary; border-color: $border-color; &:hover { border-color: var(--border-strong); } }
.btn-sm { padding: 5px 10px; font-size: 11.5px; }

.seg-switch { display: inline-flex; gap: 4px; background: $bg-secondary; border-radius: var(--radius-md); padding: 3px; }
.seg-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px; border: none; background: transparent; color: $text-secondary; border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; cursor: pointer; transition: .15s; &:hover { color: $text-primary; } &.active { background: $bg-card; color: $accent-primary; box-shadow: 0 1px 3px rgba(0,0,0,.06); } }
.seg-count { font-size: 11px; padding: 1px 6px; border-radius: 9px; background: $bg-secondary; color: $text-muted; }
.seg-btn.active .seg-count { background: rgba(var(--accent-primary-rgb),.12); color: $accent-primary; }

// Platforms
.warning-banner { display: flex; align-items: center; gap: 12px; padding: 12px 18px; background: rgba(var(--warning-rgb),.08); border: 1px solid rgba(var(--warning-rgb),.30); border-radius: var(--radius-lg); margin-bottom: 18px; font-size: 13px; color: $text-primary; line-height: 1.6; svg { width: 18px; height: 18px; color: var(--warning); flex-shrink: 0; } b { font-weight: 600; } }
.plat-stats { display: flex; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; }
.plat-stat { flex: 1; min-width: 120px; background: $bg-card; border: 1px solid $border-color; border-radius: var(--radius-lg); padding: 12px 16px; display: flex; flex-direction: column; gap: 6px; }
.plat-stat-label { font-size: 12px; color: $text-muted; font-weight: 500; display: inline-flex; align-items: center; gap: 6px; }
.pill-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.plat-stat-value { display: inline-flex; align-items: baseline; gap: 4px; font-size: 22px; font-weight: 700; color: $text-primary; }
.plat-stat-unit { font-size: 12px; color: $text-muted; font-weight: 500; }

.platforms { display: flex; flex-direction: column; gap: 12px; }
.platform-card { background: $bg-card; border: 1px solid $border-color; border-radius: var(--radius-lg); padding: 18px 22px; box-shadow: 0 1px 3px rgba(0,0,0,.04); transition: .15s; &:hover { border-color: var(--border-strong); box-shadow: 0 2px 8px rgba(0,0,0,.06); } }
.plat-head { display: flex; align-items: center; gap: 14px; padding-bottom: 14px; border-bottom: 1px solid $border-light; }
.plat-icon-wrap { width: 46px; height: 46px; border-radius: var(--radius-md); background: $bg-secondary; border: 1px solid $border-color; display: flex; align-items: center; justify-content: center; color: $accent-primary; flex-shrink: 0; }
.plat-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.plat-name-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.plat-name { font-size: 15px; font-weight: 600; color: $text-primary; }
.plat-builtin { font-size: 10px; padding: 1px 6px; border-radius: 4px; background: rgba(var(--accent-primary-rgb),.1); color: $accent-primary; font-weight: 500; }
.plat-status { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 11px; font-size: 11px; font-weight: 500; .pill-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; } &.connected { background: rgba(var(--success-rgb),.12); color: $success; } &.disconnected { background: rgba(var(--warning-rgb),.15); color: var(--warning); } }
.plat-sub { font-size: 12.5px; color: $text-secondary; }
.plat-body { display: grid; grid-template-columns: repeat(4,1fr); gap: 18px; padding: 14px 0; .info-row { display: flex; flex-direction: column; gap: 3px; .label { font-size: 11.5px; color: $text-muted; } .val { font-size: 13px; color: $text-primary; } } }
.plat-foot { display: flex; align-items: center; justify-content: space-between; padding-top: 12px; border-top: 1px solid $border-light; gap: 12px; flex-wrap: wrap; }
.plat-foot-left { font-size: 12px; color: $text-muted; b { color: $text-secondary; font-weight: 600; } }
.plat-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.danger:hover { border-color: $error !important; color: $error !important; }

// Onboard card
.onboard-card { display: flex; gap: 12px; padding: 14px 18px; background: rgba(var(--warning-rgb),.08); border: 1px solid rgba(var(--warning-rgb),.30); border-radius: var(--radius-lg); margin-bottom: 18px; align-items: flex-start; }
.onboard-icon { width: 36px; height: 36px; border-radius: 50%; background: rgba(var(--warning-rgb),.20); color: var(--warning); display: flex; align-items: center; justify-content: center; flex-shrink: 0; svg { width: 18px; height: 18px; } }
.onboard-content { flex: 1; .onboard-title { font-size: 13.5px; font-weight: 600; color: $text-primary; margin-bottom: 3px; } .onboard-desc { font-size: 12.5px; color: $text-secondary; line-height: 1.6; } }

// Cap tabs
.cap-tabs { display: flex; gap: 4px; background: $bg-card; border: 1px solid $border-color; border-radius: var(--radius-md); padding: 4px; margin-bottom: 16px; align-items: center; }
.cap-tab { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; color: $text-secondary; background: transparent; border: none; cursor: pointer; transition: .15s; font-family: inherit; &:hover { background: $bg-secondary; } &.active { background: $accent-primary; color: #fff; } }
.cap-tab-num { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 18px; border-radius: 9px; background: $bg-secondary; color: $text-muted; font-size: 11px; font-weight: 600; padding: 0 6px; }
.cap-tab.active .cap-tab-num { background: rgba(255,255,255,.20); color: #fff; }
.cap-tabs-right { margin-left: auto; padding-right: 4px; }
.search-input { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border: 1px solid $border-color; border-radius: var(--radius-sm); background: $bg-input; svg { width: 13px; height: 13px; color: $text-muted; } input { border: none; outline: none; background: transparent; font-size: 12.5px; color: $text-primary; width: 180px; font-family: inherit; } }

// Cap grid
.cap-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 14px; }
.cap-card { background: $bg-card; border: 1px solid $border-color; border-radius: var(--radius-lg); padding: 18px 20px; display: flex; flex-direction: column; gap: 12px; cursor: pointer; transition: .15s; &:hover { border-color: var(--border-strong); box-shadow: 0 2px 8px rgba(0,0,0,.04); } }
.cap-card-top { display: flex; align-items: center; gap: 12px; }
.cap-icon { width: 40px; height: 40px; border-radius: var(--radius-md); background: $bg-secondary; border: 1px solid $border-color; display: flex; align-items: center; justify-content: center; color: $accent-primary; flex-shrink: 0; }
.cap-name-block { flex: 1; min-width: 0; }
.cap-name { font-size: 14px; font-weight: 600; color: $text-primary; }
.cap-platform { font-size: 11.5px; color: $text-muted; margin-top: 2px; }
.cap-badge { font-size: 10.5px; padding: 2px 8px; border-radius: 9px; font-weight: 500; flex-shrink: 0; &.config { background: var(--badge-config); color: #1d4ed8; } &.direct { background: var(--badge-direct); color: #15803d; } }
.cap-desc { font-size: 12.5px; color: $text-secondary; line-height: 1.65; }
.cap-tags { display: flex; gap: 5px; flex-wrap: wrap; }
.cap-tag { font-size: 10.5px; padding: 2px 8px; border-radius: 6px; border: 1px solid $border-color; background: $bg-secondary; color: $text-secondary; }
.cap-foot { display: flex; gap: 8px; padding-top: 10px; border-top: 1px solid $border-light; .btn { flex: 1; justify-content: center; } }
.cap-empty { grid-column: 1/-1; padding: 56px 20px; text-align: center; color: $text-muted; background: $bg-card; border: 1px dashed $border-color; border-radius: var(--radius-lg); .cap-empty-title { font-size: 14px; font-weight: 600; } }

// Detail drawer
.cdd-overlay { position: fixed; inset: 0; z-index: 2000; background: rgba(0,0,0,.3); display: flex; justify-content: flex-end; }
.cdd-panel { width: 520px; max-width: 90vw; height: 100%; background: $bg-card; display: flex; flex-direction: column; box-shadow: -4px 0 24px rgba(0,0,0,.1); }
.cdd-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid $border-light; flex-shrink: 0; }
.cdd-head-meta { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; }
.cdd-icon-sq { width: 42px; height: 42px; border-radius: var(--radius-md); background: $bg-secondary; border: 1px solid $border-color; display: flex; align-items: center; justify-content: center; color: $accent-primary; flex-shrink: 0; }
.cdd-title { font-size: 16px; font-weight: 600; color: $text-primary; margin: 0; }
.cdd-sub { font-size: 12px; color: $text-muted; margin-top: 2px; }
.cdd-close { width: 32px; height: 32px; border: none; background: none; color: $text-muted; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; &:hover { color: $text-primary; background: $bg-secondary; } }
.cdd-scroll { flex: 1; overflow-y: auto; padding: 20px; }
.cdd-section { margin-bottom: 20px; }
.cdd-sec-title { font-size: 12.5px; font-weight: 600; color: $text-primary; margin-bottom: 8px; }
.cdd-sec-body { font-size: 13px; color: $text-secondary; line-height: 1.6; }
.cdd-table { width: 100%; border-collapse: collapse; font-size: 12.5px; th { text-align: left; padding: 6px 8px; color: $text-muted; font-weight: 500; border-bottom: 1px solid $border-light; } td { padding: 6px 8px; color: $text-secondary; border-bottom: 1px solid $border-light; } }
.cdd-list { padding-left: 16px; margin: 0; li { font-size: 13px; color: $text-secondary; padding: 3px 0; } &.cdd-list-num { list-style: decimal; } }
.cdd-foot { display: flex; gap: 8px; padding: 14px 20px; border-top: 1px solid $border-light; justify-content: flex-end; flex-shrink: 0; }

// Connectors empty state
.plat-empty { padding: 56px 20px; text-align: center; color: $text-muted; background: $bg-card; border: 1px dashed $border-color; border-radius: var(--radius-lg); }
.plat-empty-icon { width: 56px; height: 56px; border-radius: 50%; background: $bg-secondary; border: 1px solid $border-color; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; color: $text-muted; }
.plat-empty-title { font-size: 14px; font-weight: 600; color: $text-secondary; margin-bottom: 6px; }
.plat-empty-hint { font-size: 12.5px; color: $text-muted; }

// MCP toolbar
.mcp-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; .search-input { flex: 1; max-width: 320px; } }
.mcp-toolbar-actions { display: flex; gap: 8px; }

// Toggle switch
.toggle-switch { position: relative; display: inline-flex; align-items: center; width: 32px; height: 18px; cursor: pointer; flex-shrink: 0; margin-left: 8px;
  input { position: absolute; opacity: 0; width: 0; height: 0; }
  .toggle-slider { display: block; width: 100%; height: 100%; border-radius: 9px; background: $border-color; transition: .2s; position: relative;
    &::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: .2s; box-shadow: 0 1px 3px rgba(0,0,0,.2); }
  }
  input:checked + .toggle-slider { background: $success;
    &::after { transform: translateX(14px); }
  }
}

// MCP modal
.mcp-mode-row { display: flex; gap: 4px; margin-bottom: 12px; justify-content: center; }
.mcp-textarea { width: 100%; padding: 12px; border: 1px solid $border-color; border-radius: var(--radius-md); background: $bg-input; color: $text-primary; font-family: monospace; font-size: 12.5px; resize: vertical; outline: none; min-height: 280px;
  &:focus { border-color: $accent-primary; }
}
.mcp-error { color: $error; font-size: 12px; margin-top: 6px; padding: 6px 10px; background: rgba(var(--error-rgb),.06); border-radius: var(--radius-sm); }

// Tools modal
.tools-modal-header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; .label { font-size: 13px; font-weight: 600; color: $text-primary; } }
.tools-check-grid { display: flex; flex-direction: column; gap: 2px; max-height: 300px; overflow-y: auto; border: 1px solid $border-color; border-radius: var(--radius-md); padding: 8px 0; }
.tool-check-item { display: flex; align-items: center; gap: 10px; padding: 7px 12px; cursor: pointer; transition: .12s; font-size: 13px; color: $text-primary;
  &:hover { background: $bg-secondary; }
  &.disabled { opacity: .5; cursor: not-allowed; }
  input[type="checkbox"] { accent-color: $accent-primary; }
}
.tool-check-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tools-empty { padding: 24px 12px; text-align: center; color: $text-muted; font-size: 13px; }
.tools-summary { margin-top: 10px; font-size: 12px; color: $text-muted; text-align: center; }
</style>
