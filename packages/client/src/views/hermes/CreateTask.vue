<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useJobsStore } from '@/stores/hermes/jobs'
import { useMessage } from 'naive-ui'
import { getJob, scheduleToEditableInput } from '@/api/hermes/jobs'
import type { Job } from '@/api/hermes/jobs'
import { fetchSkills, type SkillInfo } from '@/api/hermes/skills'
import { getTemplate } from '@/data/templates'
import { getCapSkill, MAPAIRS_CAPS, type CapSkill } from '@/data/capabilities'

const route = useRoute()
const router = useRouter()
const jobsStore = useJobsStore()
const message = useMessage()

const step = ref(1)
const taskName = ref('')
const prompt = ref('')
const schedule = ref('0 9 * * *')
const pushChannels = ref<string[]>([])
const deliver = ref('')
const selectedConnectors = ref<string[]>([])
const realSkills = ref<SkillInfo[]>([])
const isEdit = ref(false)
const originInfo = ref<{ type: string; title: string; detail: string } | null>(null)

interface SelectedItem { id: string; name: string; kind: 'config' | 'direct' | 'mcp' }
const selectedItems = ref<SelectedItem[]>([])
const activeConfigId = ref<string | null>(null)
const skillConfig = ref<Record<string, Record<string, string>>>({})

// Init config from selected items
watch(selectedItems, (items) => {
  items.filter(s => s.kind === 'config').forEach(s => {
    if (!skillConfig.value[s.id]) {
      skillConfig.value[s.id] = {}
      getCapSkill(s.id)?.params?.forEach(p => { skillConfig.value[s.id][p.name] = p.default || '' })
    }
  })
}, { deep: true, immediate: true })

function getCapCfg(id: string) { return getCapSkill(id) }
function paramVal(sid: string, pn: string, fb: string) { return skillConfig.value[sid]?.[pn] || fb }
function setParam(sid: string, pn: string, v: string) { if (!skillConfig.value[sid]) skillConfig.value[sid] = {}; skillConfig.value[sid][pn] = v }

const selectOpts: Record<string, string[]> = {
  '查询维度': ['城市','站点'], '时间类型': ['实时','日累计','日','月','年','自定义'],
  '地图范围': ['全国','河南省','平顶山市'], '地图类型': ['监测图','插值图'],
  '因子': ['首要污染物','PM₂.₅','PM₁₀','SO₂','NO₂','CO','O₃','AQI'],
  '污染因子': ['PM₂.₅','PM₁₀','SO₂','NO₂','CO','O₃','AQI'],
  '截图颜色': ['浅色','深色'], '颜色': ['浅色','深色'],
  '时间范围': ['最近24小时','最近7天','最近30天','自定义'],
  '数据粒度': ['小时','分钟','日'], '国标类型': ['默认','新','旧'],
}
function selOptsFn(p: { name: string }) { return selectOpts[p.name] || ['默认'] }
const multiOpts: Record<string, string[]> = { '污染因子': ['PM₂.₅','PM₁₀','SO₂','NO₂','CO','O₃','AQI'] }
function multiOptsFn(p: { name: string }) { return multiOpts[p.name] || selectOpts[p.name] || ['默认'] }
function toggleMulti(sid: string, pn: string, v: string) {
  const cur = paramVal(sid, pn, '')
  const arr = cur ? cur.split(',').filter(Boolean) : []
  const idx = arr.indexOf(v); idx >= 0 ? arr.splice(idx,1) : arr.push(v)
  setParam(sid, pn, arr.join(','))
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

onMounted(async () => {
  try { const sd = await fetchSkills(); realSkills.value = sd.categories.flatMap(c => c.skills) } catch { /* */ }
  try {
    const q = route.query
    const editId = q.edit as string
    if (editId) {
      isEdit.value = true
      try {
        const job: Job = await getJob(editId)
        taskName.value = job.name || ''
        schedule.value = scheduleToEditableInput(job.schedule, job.schedule_display || '')
        prompt.value = job.prompt || ''
        deliver.value = job.deliver || ''
        // Restore skill chips from job.skills or prompt parsing
        const skillIds = job.skills || []
        skillIds.forEach((sid: string) => {
          const cap = getCapSkill(sid)
          if (cap) selectedItems.value.push({ id: sid, name: cap.name, kind: 'config' })
          else selectedItems.value.push({ id: sid, name: sid, kind: 'direct' })
        })
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
    const [prefix, id] = key.split(/:(.+)/)
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

// ---- Push channels ----
const channelOptions = [
  { id:'wecom', name:'企业微信', sub:'已配置 · 推送至「环保值班」群' },
  { id:'dingtalk', name:'钉钉', sub:'未配置 · 点击前往设置' },
  { id:'feishu', name:'飞书', sub:'未配置 · 点击前往设置' },
  { id:'mail', name:'邮件', sub:'已配置 · 推送至值班邮箱' },
  { id:'local', name:'本地', sub:'保存到本地文件夹' },
]
function toggleChannel(id: string) { pushChannels.value.includes(id) ? pushChannels.value = pushChannels.value.filter(x => x !== id) : pushChannels.value.push(id) }

async function handleCreate() {
  if (!taskName.value.trim()) { message.warning('请输入任务名称'); return }
  try {
    await jobsStore.createJob({
      name: taskName.value, schedule: schedule.value, prompt: prompt.value,
      deliver: deliver.value || 'local',
      skills: [...selectedItems.value.filter(s => s.kind !== 'mcp').map(s => s.id), ...selectedConnectors.value],
    } as any)
    message.success('任务已创建')
    router.push({ name: 'hermes.duty' })
  } catch (e: any) { message.error('创建失败: ' + (e.message || e)) }
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

      <div v-if="!isEdit" class="capability-heading"><div><span class="capability-kicker">01 · 定义任务目标</span><h2>这次任务要做什么？</h2></div></div>

      <!-- 3 entry cards (hidden in edit mode) -->
      <div v-if="!isEdit" class="onboard-card-grid" :class="{ dimmed: selectedItems.length > 0 }">
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

        <!-- Active config panel -->
        <div v-if="activeConfig" class="cfg-panel">
          <div class="ranking-config">
            <div class="ranking-config-head">02 · 配置 {{ activeConfig.name }}</div>
            <div v-for="p in (getCapCfg(activeConfig.id)?.params || [])" :key="p.name" class="ranking-toolbar">
              <div class="compact-field"><span>{{ p.name }}：</span>
                <input v-if="p.type === 'string'" class="n-input" style="max-width:260px" :value="paramVal(activeConfig.id, p.name, p.default||'')" @input="setParam(activeConfig.id, p.name, ($event.target as HTMLInputElement).value)">
                <div v-else-if="p.type === 'select'" class="segmented">
                  <button v-for="o in selOptsFn(p)" :key="o" :class="{ active: paramVal(activeConfig.id, p.name, p.default||'') === o }" @click="setParam(activeConfig.id, p.name, o)">{{ o }}</button>
                </div>
                <div v-else-if="p.type === 'multi'" class="factor-chips">
                  <span v-for="f in multiOptsFn(p)" :key="f" class="factor-chip" :class="{ active: paramVal(activeConfig.id, p.name, p.default||'').includes(f) }" @click="toggleMulti(activeConfig.id, p.name, f)">{{ f }}</span>
                </div>
              </div>
              <span v-if="p.required" class="latest-hint">必填</span>
            </div>
            <div class="ranking-summary">本次成果：{{ activeConfig.name }} · {{ getCapCfg(activeConfig.id)?.params?.map(pp => paramVal(activeConfig.id, pp.name, pp.default||'')).filter(Boolean).join(' · ') }}</div>
          </div>
        </div>
      </div>

      <div class="action-bar"><span></span><div class="action-right"><button class="btn btn-default" @click="handleBack">取消</button><button class="btn btn-primary" @click="goStep(2)">下一步</button></div></div>
    </div>

    <!-- ===== STEP 2 ===== -->
    <div v-show="step === 2" class="step-panel">
      <div class="delivery-intro"><span>02 · 设置交付</span><h2>什么时候运行，发送给谁？</h2></div>

      <div class="form-group">
        <label class="form-label">运行时间</label>
        <div class="schedule-picker">
          <div class="sched-cat-tabs">
            <button class="sched-cat-btn" :class="{ active: scheduleCat === 'interval' }" @click="scheduleCat = 'interval'">按间隔</button>
            <button class="sched-cat-btn" :class="{ active: scheduleCat === 'hourly' }" @click="scheduleCat = 'hourly'">每小时</button>
            <button class="sched-cat-btn" :class="{ active: scheduleCat === 'daily' }" @click="scheduleCat = 'daily'">每天</button>
            <button class="sched-cat-btn" :class="{ active: scheduleCat === 'weekly' }" @click="scheduleCat = 'weekly'">每周</button>
            <button class="sched-cat-btn" :class="{ active: scheduleCat === 'monthly' }" @click="scheduleCat = 'monthly'">每月</button>
            <button class="sched-cat-btn" :class="{ active: scheduleCat === 'custom' }" @click="scheduleCat = 'custom'">自定义</button>
          </div>

          <!-- 按间隔 -->
          <div v-show="scheduleCat === 'interval'" class="sched-cat-panel">
            <div class="sched-sub-label">常用间隔</div>
            <div class="preset-chip-grid">
              <button v-for="l in ['5','10','15','30']" :key="l" class="preset-chip" :class="{ active: schedInterval === l && schedIntervalUnit === '分钟' }" @click="schedInterval = l; schedIntervalUnit = '分钟'">{{ l }} 分钟</button>
              <button v-for="l in ['1','2','3','6','12','24']" :key="l" class="preset-chip" :class="{ active: schedInterval === l && schedIntervalUnit === '小时' }" @click="schedInterval = l; schedIntervalUnit = '小时'">{{ l }} 小时</button>
            </div>
            <div class="sched-custom-row"><span class="sched-custom-label">自定义</span><div class="sched-custom-inputs"><span>每</span><input type="number" v-model="schedInterval" class="sched-num-input" min="1"><select v-model="schedIntervalUnit" class="sched-unit-select"><option>分钟</option><option>小时</option></select></div></div>
          </div>

          <!-- 每小时 -->
          <div v-show="scheduleCat === 'hourly'" class="sched-cat-panel">
            <div class="sched-time-row"><span class="sched-time-label">执行分钟</span><div class="sched-time-inputs"><select v-model="schedMin" class="sched-time-select"><option>00</option><option>05</option><option>10</option><option>15</option><option>30</option><option>45</option></select><span>分</span></div></div>
          </div>

          <!-- 每天 -->
          <div v-show="scheduleCat === 'daily'" class="sched-cat-panel">
            <div class="sched-time-row"><span class="sched-time-label">执行时间</span><div class="sched-time-inputs"><select v-model="schedHour" class="sched-time-select"><option>00</option><option>08</option><option>09</option><option>10</option><option>18</option><option>20</option></select><span>:</span><select v-model="schedMin" class="sched-time-select"><option>00</option><option>15</option><option>30</option><option>45</option></select></div></div>
          </div>

          <!-- 每周 -->
          <div v-show="scheduleCat === 'weekly'" class="sched-cat-panel">
            <div class="sched-sub-label">选择星期</div>
            <div class="sched-day-chips"><button v-for="d in schedDays" :key="d" class="sched-day-chip" :class="{ active: schedSelectedDays.has(d) }" @click="toggleSchedDay(d)">{{ d }}</button></div>
            <div class="sched-time-row" style="margin-top:12px"><span class="sched-time-label">执行时间</span><div class="sched-time-inputs"><select v-model="schedHour" class="sched-time-select"><option>09</option><option>18</option></select><span>:</span><select v-model="schedMin" class="sched-time-select"><option>00</option><option>30</option></select></div></div>
          </div>

          <!-- 每月 -->
          <div v-show="scheduleCat === 'monthly'" class="sched-cat-panel">
            <div class="sched-monthly-row"><span class="sched-monthly-label">每月</span><select v-model="schedMonthDay" class="sched-dom-select"><option>1 号</option><option>15 号</option><option>28 号</option></select></div>
            <div class="sched-time-row"><span class="sched-time-label">执行时间</span><div class="sched-time-inputs"><select v-model="schedHour" class="sched-time-select"><option>09</option></select><span>:</span><select v-model="schedMin" class="sched-time-select"><option>00</option></select></div></div>
          </div>

          <!-- 自定义 -->
          <div v-show="scheduleCat === 'custom'" class="sched-cat-panel">
            <div class="sched-custom-row"><span class="sched-custom-label">Cron 表达式</span><input v-model="schedCronInput" class="sched-cron-input" placeholder="0 9 * * *"></div>
            <div class="sched-cron-help"><div class="sched-cron-help-title">格式: 分 时 日 月 周</div><div class="sched-cron-help-examples"><div>每 5 分钟: <code>*/5 * * * *</code></div><div>每天 9 点: <code>0 9 * * *</code></div><div>每周一 9 点: <code>0 9 * * 1</code></div></div></div>
          </div>

          <div class="schedule-preview"><span class="sched-dot"></span><span>{{ schedPreview }}</span></div>
        </div>
      </div>

      <div class="form-group" style="margin-top:18px">
        <label class="form-label">推送渠道（可多选）</label>
        <div class="channel-grid">
          <div v-for="ch in channelOptions" :key="ch.id" class="channel-item" :class="{ checked: pushChannels.includes(ch.id) }" @click="toggleChannel(ch.id)">
            <div class="ch-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
            <div class="ch-info"><div class="ch-name">{{ ch.name }}</div><div class="ch-sub">{{ ch.sub }}</div></div>
          </div>
        </div>
      </div>

      <div class="action-bar"><button class="btn btn-default" @click="goStep(1)">上一步</button><div class="action-right"><button class="btn btn-default" @click="handleBack">取消</button><button class="btn btn-primary" @click="goStep(3)">下一步</button></div></div>
    </div>

    <!-- ===== STEP 3 ===== -->
    <div v-show="step === 3" class="step-panel">
      <div class="confirm-hero"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><div><b>请确认这份值守安排</b></div></div>
      <div class="confirm-card">
        <div class="cf-row"><span class="cf-label">任务名称</span><span class="cf-value"><strong>{{ taskName || '未填写' }}</strong></span></div>
        <div class="cf-row"><span class="cf-label">技能</span><span class="cf-value">{{ selectedItems.length ? selectedItems.map(s => s.name).join('、') : '未选择' }}</span></div>
        <div class="cf-row"><span class="cf-label">连接器</span><span class="cf-value">{{ selectedConnectors.length ? selectedConnectors.join('、') : '未选择' }}</span></div>
        <div class="cf-row"><span class="cf-label">调度</span><span class="cf-value">{{ schedule }}</span></div>
        <div class="cf-row"><span class="cf-label">推送</span><span class="cf-value">{{ pushChannels.length ? pushChannels.join('、') : '未选择' }}</span></div>
        <div class="cf-row"><span class="cf-label">提示词</span><span class="cf-value" style="white-space:pre-wrap">{{ prompt || '未填写' }}</span></div>
      </div>
      <div class="action-bar"><button class="btn btn-default" @click="goStep(2)">上一步</button><div class="action-right"><button class="btn btn-default" @click="handleBack">取消</button><button class="btn btn-primary" @click="handleCreate">创建任务</button></div></div>
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
</style>
