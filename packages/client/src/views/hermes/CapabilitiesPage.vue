<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlatformsStore } from '@/stores/envclaw/platforms'
import { fetchSkills, type SkillInfo } from '@/api/hermes/skills'
import { fetchMcpServers, type McpServerInfo } from '@/api/hermes/mcp'

// ---- Types ----
interface CapSkill {
  id: string; name: string; platform: string; desc: string; cat: string
  kind: 'config' | 'direct'; params?: { name: string; type: string; required: boolean; default?: string }[]
  outputs?: string[]; examples?: string[]; prompt?: string
}

// ---- 4 内置数智大气能力（需配置） ----
const MAPAIRS_CAPS: CapSkill[] = [
  {
    id: 'concentrationRanking', name: '浓度排名', platform: '数智大气', cat: 'mapairs', kind: 'config',
    desc: '查询城市/站点浓度排名，支持按行政区、时间类型、污染因子等维度筛选，生成排名截图与数据总结',
    params: [
      { name: '行政区', type: 'string', required: true, default: '平顶山市' },
      { name: '查询维度', type: 'select', required: true, default: '城市' },
      { name: '时间类型', type: 'select', required: true, default: '实时' },
      { name: '污染因子', type: 'multi', required: false, default: 'PM₂.₅,PM₁₀,O₃,AQI' },
      { name: '截图颜色', type: 'select', required: false, default: '浅色' },
      { name: '国标类型', type: 'select', required: false, default: '默认' },
    ],
    outputs: ['排名截图 (PNG)', '数据表格 (CSV/XLSX)', '文字总结'],
    examples: ['请查询平顶山市的实时浓度排名', '帮我生成 郑州市 今日AQI排名'],
    prompt: '查询 {{行政区}} 的浓度排名，维度 {{查询维度}}，时间 {{时间类型}}，因子 {{污染因子}}，截图颜色 {{截图颜色}}',
  },
  {
    id: 'mapPackage', name: '一张图', platform: '数智大气', cat: 'mapairs', kind: 'config',
    desc: '生成数智大气"一张图"截图，支持地图范围、时间类型、地图类型、污染因子、风场等配置',
    params: [
      { name: '地图范围', type: 'select', required: true, default: '全国' },
      { name: '时间类型', type: 'select', required: true, default: '实时' },
      { name: '地图类型', type: 'select', required: true, default: '监测图' },
      { name: '因子', type: 'select', required: false, default: '首要污染物' },
      { name: '颜色', type: 'select', required: false, default: '浅色' },
      { name: '风/海浪', type: 'bool', required: false, default: 'true' },
      { name: '左侧面板', type: 'bool', required: false, default: 'true' },
    ],
    outputs: ['一张图截图 (PNG)'],
    examples: ['帮我生成全国范围实时监测图，因子PM₂.₅', '生成河南省插值图'],
    prompt: '生成一张图：范围 {{地图范围}}，{{时间类型}} {{地图类型}}，因子 {{因子}}，{{颜色}}',
  },
  {
    id: 'hourlyBrief', name: '小时播报', platform: '数智大气', cat: 'mapairs', kind: 'config',
    desc: '生成小时数据播报截图，按行政区、乡镇、污染因子配置，可作为定时播报成果推送',
    params: [
      { name: '行政区', type: 'string', required: true, default: '平顶山市' },
      { name: '乡镇', type: 'select', required: false, default: '全部乡镇' },
      { name: '查询维度', type: 'select', required: true, default: '城市' },
      { name: '污染因子', type: 'multi', required: false, default: 'AQI,PM₂.₅,O₃' },
      { name: '截图颜色', type: 'select', required: false, default: '浅色' },
      { name: '国标类型', type: 'select', required: false, default: '默认' },
    ],
    outputs: ['小时播报截图 (PNG)'],
    examples: ['帮我生成平顶山市当前的小时播报', '播报新华区AQI和PM₂.₅'],
    prompt: '生成 {{行政区}} {{乡镇}} 小时播报，维度 {{查询维度}}，因子 {{污染因子}}',
  },
  {
    id: 'monitoringData', name: '监测数据', platform: '数智大气', cat: 'mapairs', kind: 'config',
    desc: '提取各点位小时/分钟级监测数据，覆盖PM₂.₅、PM₁₀、AQI、O₃、NO₂、SO₂、CO等因子，按站点结构化输出',
    params: [
      { name: '行政区', type: 'string', required: true, default: '平顶山市' },
      { name: '时间范围', type: 'select', required: true, default: '最近24小时' },
      { name: '数据粒度', type: 'select', required: true, default: '小时' },
      { name: '污染因子', type: 'multi', required: false, default: 'PM₂.₅,PM₁₀,AQI,O₃' },
    ],
    outputs: ['监测数据表 (CSV/XLSX)', '数据摘要'],
    examples: ['帮我查询平顶山市最近24小时的监测数据', '导出所有国控站点小时数据'],
    prompt: '查询 {{行政区}} {{数据粒度}} 监测数据，时间 {{时间范围}}，因子 {{污染因子}}',
  },
]

// ---- State ----
const router = useRouter()
const platformsStore = usePlatformsStore()
const activeTab = ref<'platforms' | 'skills' | 'mcps'>('platforms')
const realSkills = ref<SkillInfo[]>([])
const mcpServers = ref<McpServerInfo[]>([])
const loading = ref(false)

// Skills tab
const skillCat = ref('all')
const skillSearch = ref('')
const detailSkill = ref<CapSkill | null>(null)

// ---- Computed ----
// Merge hardcoded mapairs caps with real skills
const allSkills = computed<CapSkill[]>(() => {
  const real: CapSkill[] = realSkills.value.map((s: any) => ({
    id: s.id || s.name,
    name: s.name || s.id,
    platform: s.source || '通用',
    cat: s.source || 'general',
    kind: 'direct' as const,
    desc: s.description || s.prompt_template?.slice(0, 100) || 'AI Agent 按上下文自动调用',
    prompt: s.prompt_template,
  }))
  return [...MAPAIRS_CAPS, ...real]
})

const filteredSkills = computed(() => {
  let list = allSkills.value
  if (skillCat.value !== 'all') list = list.filter(s => s.cat === skillCat.value)
  const kw = skillSearch.value.trim().toLowerCase()
  if (kw) list = list.filter(s => s.name.includes(kw) || s.desc.includes(kw))
  return list
})

const skillConfigCount = computed(() => allSkills.value.filter(s => s.kind === 'config').length)
const skillDirectCount = computed(() => allSkills.value.filter(s => s.kind === 'direct').length)

// Platform
const platforms = computed(() => platformsStore.platforms)
const visiblePlatforms = computed(() => platforms.value.filter((p: any) => p.name !== '数智大气' && p.id !== 'mapairs'))
const platformCount = computed(() => visiblePlatforms.value.length)
const onlineCount = computed(() => platforms.value.filter((p: any) => p.connected !== false).length)
const capTotal = computed(() => platforms.value.reduce((s: number, p: any) => s + (p.functions?.length || 0), 0))

// MCP
const mcpConnected = computed(() => mcpServers.value.filter((s: any) => s.connected).length)
const mcpTotalTools = computed(() => mcpServers.value.reduce((sum: number, s: any) => sum + (s.tools || 0), 0))

// ---- Lifecycle ----
onMounted(async () => {
  loading.value = true
  await platformsStore.fetchPlatforms()
  try { realSkills.value = await fetchSkills() } catch { /* empty */ }
  try { const res = await fetchMcpServers(); mcpServers.value = res.servers || [] } catch { /* empty */ }
  loading.value = false
})

// ---- Detail drawer ----
function openDetail(s: CapSkill) { detailSkill.value = s }
function closeDetail() { detailSkill.value = null }
function goToPicker(skillId: string) {
  router.push({ name: 'hermes.dutyPicker', hash: '#tab=skills&pick=' + skillId })
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1>平台·技能·连接器</h1>
        <div class="page-sub">平台接入、技能库（含需配置与直接用两种形态）、MCP 连接器一站式管理</div>
      </div>
      <div class="page-actions">
        <!-- <a v-if="activeTab === 'platforms'" class="btn btn-primary"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>添加平台</a> -->
        <!-- <a v-else-if="activeTab === 'skills'" class="btn btn-primary"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>导入技能</a> -->
        <!-- <a v-else-if="activeTab === 'mcps'" class="btn btn-primary"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>添加连接器</a> -->
      </div>
    </div>

    <div class="seg-switch" style="margin-bottom:18px">
      <button class="seg-btn" :class="{ active: activeTab === 'platforms' }" @click="activeTab = 'platforms'">平台 <span class="seg-count">{{ platformCount }}</span></button>
      <button class="seg-btn" :class="{ active: activeTab === 'skills' }" @click="activeTab = 'skills'">技能 <span class="seg-count">{{ allSkills.length }}</span></button>
      <button class="seg-btn" :class="{ active: activeTab === 'mcps' }" @click="activeTab = 'mcps'">连接器 <span class="seg-count">{{ mcpServers.length }}</span></button>
    </div>

    <div v-if="loading" class="loading-msg">加载中...</div>

    <!-- ===== TAB: 平台 ===== -->
    <div v-else-if="activeTab === 'platforms'">
      <div class="warning-banner">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span><b>数智大气为内置底座</b>，禁止修改、禁用或删除。其能力由系统统一维护，所有任务默认可用。</span>
      </div>
      <div class="plat-stats">
        <div class="plat-stat"><div class="plat-stat-label">平台总数</div><div class="plat-stat-value"><span class="plat-stat-num">{{ platformCount }}</span></div></div>
        <div class="plat-stat connected"><div class="plat-stat-label"><span class="pill-dot" style="background:var(--success)"></span>已连接</div><div class="plat-stat-value" style="color:var(--success)"><span class="plat-stat-num">{{ onlineCount }}</span></div></div>
        <div class="plat-stat disconnected"><div class="plat-stat-label"><span class="pill-dot" style="background:var(--warning)"></span>未连接</div><div class="plat-stat-value" style="color:var(--warning)"><span class="plat-stat-num">{{ platformCount - onlineCount }}</span></div></div>
        <div class="plat-stat"><div class="plat-stat-label">能力总数</div><div class="plat-stat-value"><span class="plat-stat-num">{{ capTotal }}</span><span class="plat-stat-unit"> 项</span></div></div>
      </div>
      <div class="platforms-list">
        <div v-for="p in visiblePlatforms" :key="p.id" class="platform-row">
          <div class="pr-icon">{{ (p.name || '?')[0] }}</div>
          <div class="pr-info"><div class="pr-name">{{ p.name }}<span class="pr-builtin">内置底座</span></div><div class="pr-url">{{ p.url || '—' }}</div></div>
          <span class="pr-status" :class="p.connected !== false ? 'online' : 'offline'">{{ p.connected !== false ? '已连接' : '未连接' }}</span>
          <button class="btn btn-default" @click="activeTab = 'skills'; skillCat = 'mapairs'">查看能力</button>
        </div>
      </div>
      <div v-if="platforms.length === 0" class="empty-state">暂无接入平台</div>
    </div>

    <!-- ===== TAB: 技能 ===== -->
    <div v-else-if="activeTab === 'skills'">
      <div class="onboard-card">
        <div class="onboard-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2l2.4 7.4h7.6l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"/></svg></div>
        <div class="onboard-content">
          <div class="onboard-title">技能库</div>
          <div class="onboard-desc">在创建任务时选择技能，AI Agent 会按你选定的技能组合并自动执行。部分技能需先配置参数（<b style="color:#1d4ed8">需配置</b>），另一部分由 AI 直接调用（<b style="color:#15803d">直接用</b>）。</div>
        </div>
      </div>

      <div class="plat-stats">
        <div class="plat-stat"><div class="plat-stat-label">技能总数</div><div class="plat-stat-value"><span class="plat-stat-num">{{ allSkills.length }}</span></div></div>
        <div class="plat-stat connected"><div class="plat-stat-label"><span class="pill-dot" style="background:var(--accent-primary)"></span>需配置</div><div class="plat-stat-value" style="color:var(--accent-primary)"><span class="plat-stat-num">{{ skillConfigCount }}</span></div></div>
        <div class="plat-stat connected"><div class="plat-stat-label"><span class="pill-dot" style="background:var(--success)"></span>直接用</div><div class="plat-stat-value" style="color:var(--success)"><span class="plat-stat-num">{{ skillDirectCount }}</span></div></div>
      </div>

      <div class="cap-tabs">
        <button class="cap-tab" :class="{ active: skillCat === 'all' }" @click="skillCat = 'all'">全部 <span class="cap-tab-num">{{ allSkills.length }}</span></button>
        <button class="cap-tab" :class="{ active: skillCat === 'mapairs' }" @click="skillCat = 'mapairs'">数智大气 <span class="cap-tab-num">{{ MAPAIRS_CAPS.length }}</span></button>
        <div class="cap-tabs-right">
          <div class="search-input"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input v-model="skillSearch" placeholder="搜索 技能..."></div>
        </div>
      </div>

      <div class="cap-grid">
        <div v-for="s in filteredSkills" :key="s.id" class="cap-card" @click="openDetail(s)">
          <div class="cap-card-top">
            <div class="cap-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20"><path d="M12 2l2.4 7.4h7.6l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"/></svg></div>
            <div class="cap-name-block">
              <div class="cap-name">{{ s.name }}</div>
              <div class="cap-platform">{{ s.platform }}</div>
            </div>
            <span class="cap-badge" :class="s.kind">{{ s.kind === 'config' ? '需配置' : '直接用' }}</span>
          </div>
          <div class="cap-desc">{{ s.desc }}</div>
          <div class="cap-foot">
            <button class="btn btn-default btn-sm">详情</button>
            <button v-if="s.kind === 'config'" class="btn btn-default btn-sm">测试</button>
            <button class="btn btn-primary btn-sm" @click.stop="goToPicker(s.id)">组合到任务</button>
          </div>
        </div>
      </div>
      <div v-if="filteredSkills.length === 0" class="empty-state">暂无匹配技能</div>

      <!-- Skill detail drawer -->
      <Teleport to="body">
        <div v-if="detailSkill" class="cdd-overlay" @click.self="closeDetail">
          <aside class="cdd-panel">
            <div class="cdd-head">
              <div class="cdd-head-meta">
                <div class="cdd-icon-sq"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="22" height="22"><path d="M12 2l2.4 7.4h7.6l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"/></svg></div>
                <div style="min-width:0;flex:1">
                  <h2 class="cdd-title">{{ detailSkill.name }}</h2>
                  <div class="cdd-sub">{{ detailSkill.platform }} · <span :class="detailSkill.kind === 'config' ? 'text-blue' : 'text-green'">{{ detailSkill.kind === 'config' ? '需配置' : '直接用' }}</span></div>
                </div>
              </div>
              <button class="cdd-close" @click="closeDetail"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
            <div class="cdd-scroll">
              <div class="cdd-section">
                <div class="cdd-sec-title">功能说明</div>
                <div class="cdd-sec-body">{{ detailSkill.desc }}</div>
              </div>
              <div v-if="detailSkill.kind === 'config' && detailSkill.params?.length" class="cdd-section">
                <div class="cdd-sec-title">参数配置</div>
                <table class="cdd-table">
                  <thead><tr><th>参数名</th><th>类型</th><th>必填</th><th>默认值</th></tr></thead>
                  <tbody>
                    <tr v-for="p in detailSkill.params" :key="p.name">
                      <td>{{ p.name }}</td><td>{{ p.type }}</td><td>{{ p.required ? '是' : '否' }}</td><td>{{ p.default || '—' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-if="detailSkill.outputs?.length" class="cdd-section">
                <div class="cdd-sec-title">产出物</div>
                <ul class="cdd-list"><li v-for="o in detailSkill.outputs" :key="o">{{ o }}</li></ul>
              </div>
              <div v-if="detailSkill.examples?.length" class="cdd-section">
                <div class="cdd-sec-title">调用示例</div>
                <ul class="cdd-list cdd-list-num"><li v-for="e in detailSkill.examples" :key="e">{{ e }}</li></ul>
              </div>
              <div v-if="detailSkill.prompt" class="cdd-section cdd-sec-code">
                <div class="cdd-sec-title">Prompt 模板</div>
                <pre class="cdd-pre">{{ detailSkill.prompt }}</pre>
              </div>
            </div>
            <div class="cdd-foot">
              <button class="btn btn-default" @click="closeDetail">关闭</button>
              <button class="btn btn-primary" @click="goToPicker(detailSkill!.id)">组合到任务</button>
            </div>
          </aside>
        </div>
      </Teleport>
    </div>

    <!-- ===== TAB: 连接器 ===== -->
    <div v-else-if="activeTab === 'mcps'">
      <div class="onboard-card">
        <div class="onboard-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg></div>
        <div class="onboard-content">
          <div class="onboard-title">MCP 连接器</div>
          <div class="onboard-desc">Model Context Protocol 标准服务，让 AI Agent 能调用外部工具和数据源。</div>
        </div>
      </div>
      <div class="plat-stats">
        <div class="plat-stat"><div class="plat-stat-label">连接器总数</div><div class="plat-stat-value"><span class="plat-stat-num">{{ mcpServers.length }}</span></div></div>
        <div class="plat-stat connected"><div class="plat-stat-label"><span class="pill-dot" style="background:var(--success)"></span>已连接</div><div class="plat-stat-value" style="color:var(--success)"><span class="plat-stat-num">{{ mcpConnected }}</span></div></div>
        <div class="plat-stat disconnected"><div class="plat-stat-label"><span class="pill-dot" style="background:var(--warning)"></span>未连接</div><div class="plat-stat-value" style="color:var(--warning)"><span class="plat-stat-num">{{ mcpServers.length - mcpConnected }}</span></div></div>
        <div class="plat-stat"><div class="plat-stat-label">工具总数</div><div class="plat-stat-value"><span class="plat-stat-num">{{ mcpTotalTools }}</span></div></div>
      </div>
      <div class="platforms-list">
        <div v-for="m in mcpServers" :key="m.name" class="platform-row">
          <div class="pr-icon">{{ m.name[0] }}</div>
          <div class="pr-info"><div class="pr-name">{{ m.name }}</div><div class="pr-url">{{ m.transport }} · {{ m.tools || 0 }} 个工具</div></div>
          <span class="pr-status" :class="m.connected ? 'online' : 'offline'">{{ m.connected ? '已连接' : '未连接' }}</span>
          <button class="btn btn-default">测试</button>
        </div>
      </div>
      <div v-if="mcpServers.length === 0" class="empty-state">暂无连接器</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.page { padding: 24px 28px 60px; max-width: 1180px; margin: 0 auto; }
.page-header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 18px;
  h1 { font-size: 20px; font-weight: 600; }
  .page-sub { color: $text-secondary; font-size: 13px; margin-top: 5px; }
}
.page-actions { display: flex; gap: 8px; }
.loading-msg { text-align: center; padding: 48px; color: $text-muted; }
.empty-state { text-align: center; padding: 48px; color: $text-muted; }

// ---- Buttons ----
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: var(--radius-md); font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid transparent; transition: .15s; text-decoration: none; font-family: inherit; svg { width: 14px; height: 14px; } }
.btn-primary { background: $accent-primary; color: #fff; &:hover { background: $accent-hover; } }
.btn-default { background: $bg-card; color: $text-primary; border-color: $border-color; &:hover { border-color: var(--border-strong); } }
.btn-sm { padding: 5px 10px; font-size: 11.5px; }

// ---- Tabs ----
.seg-switch { display: inline-flex; gap: 4px; background: $bg-secondary; border-radius: var(--radius-md); padding: 3px; }
.seg-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px; border: none; background: transparent; color: $text-secondary; border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; cursor: pointer; transition: .15s; &:hover { color: $text-primary; } &.active { background: $bg-card; color: $accent-primary; box-shadow: 0 1px 3px rgba(0,0,0,.06); } }
.seg-count { font-size: 11px; padding: 1px 6px; border-radius: 9px; background: $bg-secondary; color: $text-muted; }
.seg-btn.active .seg-count { background: rgba(var(--accent-primary-rgb),.12); color: $accent-primary; }

// ---- Warning banner ----
.warning-banner { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: rgba(var(--warning-rgb),.08); border: 1px solid rgba(var(--warning-rgb),.25); border-radius: var(--radius-md); margin-bottom: 18px; font-size: 12.5px; color: $text-secondary; svg { width: 16px; height: 16px; color: var(--warning); flex-shrink: 0; } b { color: $text-primary; } }

// ---- Stats ----
.plat-stats { display: flex; gap: 0; margin-bottom: 20px; background: $bg-card; border: 1px solid $border-color; border-radius: var(--radius-lg); overflow: hidden; }
.plat-stat { flex: 1; padding: 16px 18px; text-align: center; border-right: 1px solid $border-light; &:last-child { border-right: none; } }
.plat-stat-label { font-size: 12px; color: $text-muted; margin-bottom: 4px; display: flex; align-items: center; justify-content: center; gap: 5px; }
.plat-stat-value { font-size: 24px; font-weight: 700; color: $text-primary; }
.plat-stat-unit { font-size: 13px; font-weight: 500; color: $text-muted; }
.pill-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; display: inline-block; }

// ---- Platform list ----
.platforms-list { display: flex; flex-direction: column; gap: 8px; }
.platform-row { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: $bg-card; border: 1px solid $border-color; border-radius: var(--radius-lg); transition: .15s; &:hover { border-color: var(--border-strong); } }
.pr-icon { width: 40px; height: 40px; border-radius: var(--radius-md); background: $bg-secondary; border: 1px solid $border-color; display: flex; align-items: center; justify-content: center; font-weight: 700; color: $accent-primary; flex-shrink: 0; font-size: 16px; }
.pr-info { flex: 1; min-width: 0; }
.pr-name { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
.pr-builtin { font-size: 10px; padding: 1px 6px; border-radius: 4px; background: rgba(var(--accent-primary-rgb),.1); color: $accent-primary; font-weight: 500; }
.pr-url { font-size: 12px; color: $text-muted; margin-top: 2px; }
.pr-status { font-size: 11px; padding: 2px 8px; border-radius: 9px; font-weight: 500; flex-shrink: 0;
  &.online { background: rgba(var(--success-rgb),.12); color: $success; }
  &.offline { background: rgba(var(--error-rgb),.1); color: $error; }
}

// ---- Onboard card ----
.onboard-card { display: flex; gap: 12px; padding: 14px 18px; background: rgba(var(--warning-rgb),.08); border: 1px solid rgba(var(--warning-rgb),.30); border-radius: var(--radius-lg); margin-bottom: 18px; align-items: flex-start; }
.onboard-icon { width: 36px; height: 36px; border-radius: 50%; background: rgba(var(--warning-rgb),.20); color: var(--warning); display: flex; align-items: center; justify-content: center; flex-shrink: 0; svg { width: 18px; height: 18px; } }
.onboard-content { flex: 1; }
.onboard-title { font-size: 13.5px; font-weight: 600; color: $text-primary; margin-bottom: 3px; }
.onboard-desc { font-size: 12.5px; color: $text-secondary; line-height: 1.6; }

// ---- Cap tabs ----
.cap-tabs { display: flex; gap: 4px; background: $bg-card; border: 1px solid $border-color; border-radius: var(--radius-md); padding: 4px; margin-bottom: 16px; align-items: center; }
.cap-tab { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; color: $text-secondary; background: transparent; border: none; cursor: pointer; transition: .15s; font-family: inherit; &:hover { background: $bg-secondary; } &.active { background: $accent-primary; color: #fff; } }
.cap-tab-num { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 18px; border-radius: 9px; background: $bg-secondary; color: $text-muted; font-size: 11px; font-weight: 600; padding: 0 6px; }
.cap-tab.active .cap-tab-num { background: rgba(255,255,255,.20); color: #fff; }
.cap-tabs-right { margin-left: auto; padding-right: 4px; }

// ---- Search ----
.search-input { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border: 1px solid $border-color; border-radius: var(--radius-sm); background: $bg-input; svg { width: 13px; height: 13px; color: $text-muted; } input { border: none; outline: none; background: transparent; font-size: 12.5px; color: $text-primary; width: 180px; font-family: inherit; &::placeholder { color: $text-muted; } } }

// ---- Cap grid (2 columns) ----
.cap-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
.cap-card { background: $bg-card; border: 1px solid $border-color; border-radius: var(--radius-lg); padding: 18px 20px; display: flex; flex-direction: column; gap: 12px; cursor: pointer; transition: .15s; &:hover { border-color: var(--border-strong); box-shadow: 0 2px 8px rgba(0,0,0,.04); } }
.cap-card-top { display: flex; align-items: center; gap: 12px; }
.cap-icon { width: 40px; height: 40px; border-radius: var(--radius-md); background: $bg-secondary; border: 1px solid $border-color; display: flex; align-items: center; justify-content: center; color: $accent-primary; flex-shrink: 0; svg { width: 20px; height: 20px; } }
.cap-name-block { flex: 1; min-width: 0; }
.cap-name { font-size: 14px; font-weight: 600; color: $text-primary; }
.cap-platform { font-size: 11.5px; color: $text-muted; margin-top: 2px; }
.cap-badge { font-size: 10.5px; padding: 2px 8px; border-radius: 9px; font-weight: 500; flex-shrink: 0;
  &.config { background: var(--badge-config); color: #1d4ed8; }
  &.direct { background: var(--badge-direct); color: #15803d; }
}
.cap-desc { font-size: 12.5px; color: $text-secondary; line-height: 1.6; }
.cap-foot { display: flex; gap: 8px; padding-top: 10px; border-top: 1px solid $border-light; }

// ---- Detail drawer ----
.cdd-overlay { position: fixed; inset: 0; z-index: 2000; background: rgba(0,0,0,.3); display: flex; justify-content: flex-end; }
.cdd-panel { width: 520px; max-width: 90vw; height: 100%; background: $bg-card; display: flex; flex-direction: column; box-shadow: -4px 0 24px rgba(0,0,0,.1); }
.cdd-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid $border-light; flex-shrink: 0; }
.cdd-head-meta { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; }
.cdd-icon-sq { width: 42px; height: 42px; border-radius: var(--radius-md); background: $bg-secondary; border: 1px solid $border-color; display: flex; align-items: center; justify-content: center; color: $accent-primary; flex-shrink: 0; }
.cdd-title { font-size: 16px; font-weight: 600; color: $text-primary; margin: 0; }
.cdd-sub { font-size: 12px; color: $text-muted; margin-top: 2px; .text-blue { color: #1d4ed8; } .text-green { color: #15803d; } }
.cdd-close { width: 32px; height: 32px; border: none; background: none; color: $text-muted; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; &:hover { color: $text-primary; background: $bg-secondary; } }
.cdd-scroll { flex: 1; overflow-y: auto; padding: 20px; }
.cdd-section { margin-bottom: 20px; }
.cdd-sec-title { font-size: 12.5px; font-weight: 600; color: $text-primary; margin-bottom: 8px; }
.cdd-sec-body { font-size: 13px; color: $text-secondary; line-height: 1.6; }
.cdd-table { width: 100%; border-collapse: collapse; font-size: 12.5px; th { text-align: left; padding: 6px 8px; color: $text-muted; font-weight: 500; border-bottom: 1px solid $border-light; } td { padding: 6px 8px; color: $text-secondary; border-bottom: 1px solid $border-light; } }
.cdd-list { padding-left: 16px; margin: 0; li { font-size: 13px; color: $text-secondary; padding: 3px 0; } &.cdd-list-num { list-style: decimal; } }
.cdd-pre { background: $bg-secondary; border: 1px solid $border-color; border-radius: var(--radius-sm); padding: 10px 14px; font-size: 12px; font-family: 'JetBrains Mono', monospace; color: $text-primary; line-height: 1.6; white-space: pre-wrap; margin: 0; }
.cdd-foot { display: flex; gap: 8px; padding: 14px 20px; border-top: 1px solid $border-light; justify-content: flex-end; flex-shrink: 0; }
</style>
