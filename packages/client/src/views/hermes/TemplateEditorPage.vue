<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getTemplate } from '@/data/templates'
import { MAPAIRS_CAPS, getCapSkill } from '@/data/capabilities'

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

const capConfig = ref<Record<string, Record<string, string>>>({})
function paramVal(sid: string, pn: string, fb: string) { return capConfig.value[sid]?.[pn] || fb }
function setParam(sid: string, pn: string, v: string) { if (!capConfig.value[sid]) capConfig.value[sid] = {}; capConfig.value[sid][pn] = v }
function toggleMulti(sid: string, pn: string, v: string) {
  const cur = paramVal(sid, pn, '')
  const arr = cur ? cur.split(',').filter(Boolean) : []
  const idx = arr.indexOf(v); idx >= 0 ? arr.splice(idx,1) : arr.push(v)
  setParam(sid, pn, arr.join(','))
}

const route = useRoute()
const router = useRouter()

const tplName = ref('')
const tplDesc = ref('')
const tplGroup = ref('日报 / 周报')
const tplTags = ref('')
const tplSchedule = ref('每天 09:00')
const tplDeliver = ref('企业微信')
const rolePrompt = ref('')
const isEdit = ref(false)
const pageTitle = ref('新建模板')

const selectedCaps = ref<string[]>(['mapPackage', 'concentrationRanking'])
const expandedCfg = ref<Set<string>>(new Set())

onMounted(() => {
  const q = route.query
  const editId = (route.params.id as string) || (q.edit as string) || (q.clone as string)
  if (editId) {
    const tpl = getTemplate(editId)
    if (tpl) {
      tplName.value = tpl.name
      tplDesc.value = tpl.desc
      tplSchedule.value = tpl.schedule
      tplDeliver.value = tpl.deliver
      selectedCaps.value = [...tpl.capIds]
      isEdit.value = true
      pageTitle.value = q.clone ? '克隆模板' : '编辑模板'
    }
  }
  if (q.from === 'create') {
    tplName.value = (q.name as string) || ''
    if (q.caps) selectedCaps.value = (q.caps as string).split(',').filter(Boolean)
  }
})

function toggleCfg(id: string) {
  if (expandedCfg.value.has(id)) expandedCfg.value.delete(id)
  else expandedCfg.value.add(id)
  expandedCfg.value = new Set(expandedCfg.value)
}

function removeCap(id: string) { selectedCaps.value = selectedCaps.value.filter(c => c !== id) }
function addCap(id: string) { if (!selectedCaps.value.includes(id)) selectedCaps.value.push(id) }

function capName(id: string) { return MAPAIRS_CAPS.find(c => c.id === id)?.name || id }

const scheduleCat = ref('daily')
const schedHour = ref('09'); const schedMin = ref('00')
const schedInterval = ref('5'); const schedIntervalUnit = ref('分钟')
const schedMonthDay = ref('1 号')
const schedSelectedDays = ref(new Set(['周一']))
function toggleSchedDay(d: string) { if (schedSelectedDays.value.has(d)) schedSelectedDays.value.delete(d); else schedSelectedDays.value.add(d); schedSelectedDays.value = new Set(schedSelectedDays.value) }
const schedPreviewText = computed(() => {
  const c = scheduleCat.value
  if (c === 'interval') return `每 ${schedInterval.value} ${schedIntervalUnit.value} 执行一次`
  if (c === 'hourly') return `每小时第 ${schedMin.value} 分执行`
  if (c === 'daily') return `每天 ${schedHour.value}:${schedMin.value} 执行`
  if (c === 'weekly') return `每${[...schedSelectedDays.value].join('、')} ${schedHour.value}:${schedMin.value} 执行`
  if (c === 'monthly') return `每月 ${schedMonthDay.value} ${schedHour.value}:${schedMin.value} 执行`
  return `${tplSchedule.value}`
})
function handleBack() { router.push({ name: 'hermes.templates' }) }
function handleSave() { router.push({ name: 'hermes.templates' }) }
</script>

<template>
  <div class="create-page">
    <a class="crt-back" @click="handleBack"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="15 18 9 12 15 6"/></svg>返回模板库</a>

    <div class="page-header" style="margin-bottom:20px">
      <div><h1>{{ pageTitle }}</h1><div class="page-sub">把一个高频任务封装成模板，方便复用、分享与派生</div></div>
      <div class="page-actions">
        <button class="btn btn-default" @click="handleBack">取消</button>
        <button class="btn btn-default" @click="handleSave">保存模板</button>
        <button class="btn btn-primary" @click="handleSave">保存并创建任务</button>
      </div>
    </div>

    <!-- Step 1: 模板信息 -->
    <section class="tpl-form-section">
      <div class="tpl-form-section-head"><span class="tpl-step-badge">1</span><div style="flex:1"><div class="tpl-step-title">模板信息</div><div class="tpl-step-sub">起一个易识别、好搜索的模板名称</div></div></div>
      <div class="form-group"><label class="form-label">模板名称</label><input v-model="tplName" class="n-input" placeholder="如：平顶山日报推送"></div>
      <div class="form-group"><label class="form-label">模板描述</label><textarea v-model="tplDesc" class="tpl-textarea" placeholder="一段话说明这个模板解决了什么问题、适用于什么场景"></textarea></div>
      <div style="display:flex;gap:14px">
        <div style="flex:1"><label class="form-label">所属分组</label><select v-model="tplGroup" class="n-select"><option>日报 / 周报</option><option>空气质量</option><option>水环境</option><option>考核排名</option></select></div>
        <div style="flex:1"><label class="form-label">标签</label><input v-model="tplTags" class="n-input" placeholder="多个标签用逗号分隔"></div>
      </div>
    </section>

    <!-- Step 2: 技能清单 -->
    <section class="tpl-form-section">
      <div class="tpl-form-section-head"><span class="tpl-step-badge">2</span><div style="flex:1"><div class="tpl-step-title">技能清单</div><div class="tpl-step-sub">勾选此模板要交付的技能成果，可逐项展开配置</div></div></div>

      <template v-for="(cid, idx) in selectedCaps" :key="cid">
        <div class="tpl-cap-row">
          <span class="num">{{ idx + 1 }}</span>
          <div class="name">{{ capName(cid) }}</div>
          <div class="actions"><button class="mini-btn" @click="toggleCfg(cid)">{{ expandedCfg.has(cid) ? '收起配置' : '展开配置' }}</button><button class="mini-btn danger" @click="removeCap(cid)">删除</button></div>
        </div>
        <div v-if="expandedCfg.has(cid) && getCapSkill(cid)" class="tpl-cap-config">
          <div class="config-title">配置 {{ capName(cid) }}</div>
          <div v-for="p in (getCapSkill(cid)?.params || [])" :key="p.name" class="ranking-toolbar">
            <div class="compact-field"><span>{{ p.name }}：</span>
              <input v-if="p.type === 'string'" class="n-input" style="max-width:220px" :value="paramVal(cid, p.name, p.default||'')" @input="setParam(cid, p.name, ($event.target as HTMLInputElement).value)">
              <div v-else-if="p.type === 'select'" class="segmented">
                <button v-for="o in selOptsFn(p)" :key="o" :class="{ active: paramVal(cid, p.name, p.default||'') === o }" @click="setParam(cid, p.name, o)">{{ o }}</button>
              </div>
              <div v-else-if="p.type === 'multi'" class="factor-chips">
                <span v-for="f in multiOptsFn(p)" :key="f" class="factor-chip" :class="{ active: paramVal(cid, p.name, p.default||'').includes(f) }" @click="toggleMulti(cid, p.name, f)">{{ f }}</span>
              </div>
            </div>
            <span v-if="p.required" class="latest-hint">必填</span>
          </div>
        </div>
      </template>

      <div class="output-add-bar" style="margin-top:14px">
        <span>添加技能·需配置</span>
        <button v-for="c in MAPAIRS_CAPS" :key="c.id" @click="addCap(c.id)"><b>＋</b> {{ c.name }}</button>
      </div>
    </section>

    <!-- Step 3: 交付设置 -->
    <section class="tpl-form-section">
      <div class="tpl-form-section-head"><span class="tpl-step-badge">3</span><div style="flex:1"><div class="tpl-step-title">交付设置</div><div class="tpl-step-sub">执行频率、推送时间与推送渠道（可多选）</div></div></div>
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
          <div v-show="scheduleCat === 'interval'" class="sched-cat-panel"><div class="sched-sub-label">常用间隔</div><div class="preset-chip-grid"><button v-for="l in ['5','10','15','30']" :key="l" class="preset-chip" :class="{ active: schedInterval === l && schedIntervalUnit === '分钟' }" @click="schedInterval = l; schedIntervalUnit = '分钟'">{{ l }} 分钟</button><button v-for="l in ['1','2','3','6','12','24']" :key="l" class="preset-chip" :class="{ active: schedInterval === l && schedIntervalUnit === '小时' }" @click="schedInterval = l; schedIntervalUnit = '小时'">{{ l }} 小时</button></div></div>
          <div v-show="scheduleCat === 'hourly'" class="sched-cat-panel"><div class="sched-time-row"><span class="sched-time-label">执行分钟</span><div class="sched-time-inputs"><select v-model="schedMin" class="sched-time-select"><option>00</option><option>05</option><option>10</option><option>15</option><option>30</option><option>45</option></select><span>分</span></div></div></div>
          <div v-show="scheduleCat === 'daily'" class="sched-cat-panel"><div class="sched-time-row"><span class="sched-time-label">执行时间</span><div class="sched-time-inputs"><select v-model="schedHour" class="sched-time-select"><option>00</option><option>08</option><option>09</option><option>10</option><option>18</option></select><span>:</span><select v-model="schedMin" class="sched-time-select"><option>00</option><option>15</option><option>30</option><option>45</option></select></div></div></div>
          <div v-show="scheduleCat === 'weekly'" class="sched-cat-panel"><div class="sched-sub-label">选择星期</div><div class="sched-day-chips"><button v-for="d in ['周一','周二','周三','周四','周五','周六','周日']" :key="d" class="sched-day-chip" :class="{ active: schedSelectedDays.has(d) }" @click="toggleSchedDay(d)">{{ d }}</button></div><div class="sched-time-row" style="margin-top:12px"><span class="sched-time-label">执行时间</span><div class="sched-time-inputs"><select v-model="schedHour" class="sched-time-select"><option>09</option><option>18</option></select><span>:</span><select v-model="schedMin" class="sched-time-select"><option>00</option><option>30</option></select></div></div></div>
          <div v-show="scheduleCat === 'monthly'" class="sched-cat-panel"><div class="sched-monthly-row"><span class="sched-monthly-label">每月</span><select v-model="schedMonthDay" class="sched-dom-select"><option>1 号</option><option>15 号</option><option>28 号</option></select></div><div class="sched-time-row"><span class="sched-time-label">执行时间</span><div class="sched-time-inputs"><select v-model="schedHour" class="sched-time-select"><option>09</option></select><span>:</span><select v-model="schedMin" class="sched-time-select"><option>00</option></select></div></div></div>
          <div v-show="scheduleCat === 'custom'" class="sched-cat-panel"><div class="sched-custom-row"><span class="sched-custom-label">Cron</span><input v-model="tplSchedule" class="sched-cron-input" placeholder="0 9 * * *"></div></div>
          <div class="schedule-preview"><span class="sched-dot"></span><span>{{ schedPreviewText }}</span></div>
        </div>
      </div>
      <div class="form-group" style="margin-top:18px">
        <label class="form-label">推送渠道（可多选）</label>
        <div class="channel-grid">
          <div v-for="ch in [{id:'wecom',name:'企业微信',sub:'已配置 · 推送至「环保值班」群'},{id:'dingtalk',name:'钉钉',sub:'未配置 · 点击前往设置'},{id:'feishu',name:'飞书',sub:'未配置 · 点击前往设置'},{id:'mail',name:'邮件',sub:'已配置 · 推送至值班邮箱'},{id:'local',name:'本地',sub:'保存到本地文件夹'}]" :key="ch.id" class="channel-item" :class="{ checked: tplDeliver.includes(ch.name) }" @click="tplDeliver = tplDeliver.includes(ch.name) ? tplDeliver.replace(ch.name, '').trim() : (tplDeliver + ' ' + ch.name).trim()">
            <div class="ch-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
            <div class="ch-info"><div class="ch-name">{{ ch.name }}</div><div class="ch-sub">{{ ch.sub }}</div></div>
          </div>
        </div>
      </div>
    </section>

    <!-- Step 4: 高级 -->
    <section class="tpl-form-section">
      <div class="tpl-form-section-head"><span class="tpl-step-badge">4</span><div style="flex:1"><div class="tpl-step-title">高级</div><div class="tpl-step-sub">角色基底提示词与补充说明</div></div></div>
      <div class="form-group"><label class="form-label">角色基底提示词</label><textarea v-model="rolePrompt" class="tpl-textarea" style="min-height:120px;font-family:monospace;font-size:12.5px" placeholder="你是一名环保数据值守员..."></textarea></div>
    </section>

    <div class="action-bar"><div style="font-size:12.5px;color:var(--text-muted)">保存后可在「模板库」中查看、克隆或分享</div><div class="action-right"><button class="btn btn-default" @click="handleBack">取消</button><button class="btn btn-default" @click="handleSave">保存模板</button><button class="btn btn-primary" @click="handleSave">保存并创建任务</button></div></div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.create-page { padding: 24px 28px 60px; max-width: 860px; margin: 0 auto; }
.crt-back { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: $text-secondary; cursor: pointer; margin-bottom: 16px; &:hover { color: $accent-primary; } svg { width: 16px; height: 16px; } }
.page-header { display: flex; align-items: flex-end; justify-content: space-between; h1 { font-size: 20px; font-weight: 600; } .page-sub { color: $text-secondary; font-size: 13px; margin-top: 4px; } }
.page-actions { display: flex; gap: 8px; }

// Form sections
.tpl-form-section { background: $bg-card; border: 1px solid $border-color; border-radius: var(--radius-lg); padding: 22px 24px; margin-bottom: 16px; }
.tpl-form-section-head { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid $border-light; }
.tpl-step-badge { width: 28px; height: 28px; border-radius: 50%; background: $accent-primary; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0; }
.tpl-step-title { font-size: 15px; font-weight: 600; }
.tpl-step-sub { font-size: 12px; color: $text-muted; }
.form-group { margin-bottom: 14px; }
.form-label { font-size: 14px; font-weight: 600; display: block; margin-bottom: 6px; }

.n-input { width: 100%; padding: 10px 14px; border: 1px solid $border-color; border-radius: var(--radius-md); font-size: 14px; outline: none; background: $bg-input; color: $text-primary; font-family: inherit; &:focus { border-color: $accent-primary; } }
.n-select { width: 100%; padding: 10px 14px; border: 1px solid $border-color; border-radius: var(--radius-md); font-size: 14px; background: $bg-input; color: $text-primary; cursor: pointer; }
.tpl-textarea { width: 100%; min-height: 90px; padding: 9px 12px; border: 1px solid $border-color; border-radius: var(--radius-md); font-size: 13.5px; outline: none; background: $bg-input; color: $text-primary; resize: vertical; line-height: 1.6; font-family: inherit; &:focus { border-color: $accent-primary; } }

// Cap rows
.tpl-cap-row { display: flex; align-items: center; gap: 12px; background: $bg-secondary; border: 1px solid $border-color; border-radius: var(--radius-md); padding: 12px 14px; margin-bottom: 8px;
  .num { width: 22px; height: 22px; border-radius: 50%; background: $bg-card; border: 1px solid $border-color; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; color: $text-secondary; flex-shrink: 0; }
  .name { flex: 1; font-size: 13.5px; font-weight: 500; }
  .actions { display: flex; gap: 4px; }
}
.mini-btn { background: $bg-card; border: 1px solid $border-color; border-radius: 4px; padding: 3px 9px; font-size: 11.5px; color: $text-secondary; cursor: pointer; font-family: inherit; &:hover { border-color: $accent-primary; color: $accent-primary; } &.danger:hover { border-color: $error; color: $error; } }

.output-add-bar { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; span { font-size: 12px; color: $text-muted; } button { border: 1px dashed $border-color; border-radius: 999px; padding: 4px 12px; font-size: 12px; background: $bg-card; color: $text-secondary; cursor: pointer; font-family: inherit; &:hover { border-color: $accent-primary; color: $accent-primary; } b { margin-right: 2px; } } }
.tpl-cap-config { background: $bg-card; border: 1px dashed $border-color; border-radius: var(--radius-md); padding: 14px 16px; margin-bottom: 14px; margin-left: 32px; .config-title { font-size: 11px; color: $text-muted; font-family: monospace; margin-bottom: 10px; } }
.ranking-toolbar { display: flex; align-items: center; gap: 12px; padding: 4px 0; flex-wrap: wrap; }
.compact-field { display: flex; align-items: center; gap: 8px; font-size: 12.5px; span { white-space: nowrap; color: $text-muted; } }
.segmented { display: inline-flex; gap: 2px; background: $bg-secondary; border-radius: 6px; padding: 2px; button { border: none; background: transparent; color: $text-secondary; font-size: 11.5px; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-family: inherit; &.active { background: $bg-card; color: $accent-primary; font-weight: 500; box-shadow: 0 1px 2px rgba(0,0,0,.06); } } }
.factor-chips { display: flex; gap: 4px; flex-wrap: wrap; }
.factor-chip { font-size: 11px; padding: 2px 8px; border-radius: 9px; border: 1px solid $border-color; background: $bg-card; color: $text-secondary; cursor: pointer; transition: .12s; font-family: inherit; &:hover { border-color: $accent-primary; } &.active { background: rgba(var(--accent-primary-rgb),.12); border-color: $accent-primary; color: $accent-primary; } }
.latest-hint { font-size: 10.5px; color: var(--accent-orange); margin-left: 4px; }

// Schedule picker
.sched-cat-tabs { display: flex; gap: 2px; background: $bg-secondary; border-radius: var(--radius-md); padding: 3px; width: fit-content; margin-bottom: 12px; }
.sched-cat-btn { border: none; background: transparent; color: $text-secondary; font-size: 12.5px; padding: 6px 16px; border-radius: var(--radius-sm); cursor: pointer; font-family: inherit; transition: .12s; &.active { background: $bg-card; color: $accent-primary; font-weight: 500; box-shadow: 0 1px 2px rgba(0,0,0,.05); } }
.sched-cat-panel { }
.sched-sub-label { font-size: 12px; color: $text-muted; margin-bottom: 8px; }
.sched-time-row { display: flex; align-items: center; gap: 12px; }
.sched-time-label { font-size: 12px; color: $text-muted; }
.sched-time-inputs { display: flex; align-items: center; gap: 4px; }
.sched-time-select { padding: 6px 10px; border: 1px solid $border-color; border-radius: var(--radius-sm); font-size: 13px; background: $bg-input; color: $text-primary; cursor: pointer; }
.sched-day-chips { display: flex; gap: 4px; flex-wrap: wrap; }
.sched-day-chip { padding: 5px 12px; border: 1px solid $border-color; border-radius: 999px; font-size: 12px; cursor: pointer; background: $bg-card; color: $text-secondary; font-family: inherit; &.active { background: rgba(var(--accent-primary-rgb),.1); border-color: $accent-primary; color: $accent-primary; } }
.sched-monthly-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.sched-monthly-label { font-size: 12px; color: $text-muted; }
.sched-dom-select { padding: 6px 10px; border: 1px solid $border-color; border-radius: var(--radius-sm); font-size: 13px; background: $bg-input; color: $text-primary; cursor: pointer; }
.sched-custom-row { display: flex; align-items: center; gap: 8px; }
.sched-custom-label { font-size: 12px; color: $text-muted; }
.sched-cron-input { width: 220px; padding: 6px 10px; border: 1px solid $border-color; border-radius: var(--radius-sm); font-size: 13px; background: $bg-input; color: $text-primary; font-family: monospace; }
.schedule-preview { display: flex; align-items: center; gap: 8px; margin-top: 14px; padding-top: 12px; border-top: 1px solid $border-light; font-size: 13px; color: $text-primary; .sched-dot { width: 8px; height: 8px; border-radius: 50%; background: $accent-primary; flex-shrink: 0; } }

// Channel
.preset-chip-grid { display: flex; gap: 6px; flex-wrap: wrap; }
.preset-chip { padding: 6px 14px; border: 1px solid $border-color; border-radius: 999px; background: $bg-card; color: $text-secondary; font-size: 12.5px; cursor: pointer; transition: .12s; font-family: inherit; &.active { background: rgba(var(--accent-primary-rgb),.1); border-color: $accent-primary; color: $accent-primary; } &:hover { border-color: $accent-primary; } }
.sched-custom-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.sched-custom-label { font-size: 12px; color: $text-muted; }
.schedule-preview { display: flex; align-items: center; gap: 8px; margin-top: 10px; font-size: 12.5px; color: $text-secondary; svg { color: $text-muted; flex-shrink: 0; } b { color: $text-primary; } }
.channel-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.channel-item { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border: 1px solid $border-color; border-radius: var(--radius-md); background: $bg-card; cursor: pointer; transition: .15s; &:hover { border-color: var(--border-strong); } &.checked { border-color: $accent-primary; background: rgba(var(--accent-primary-rgb),.05); } }
.ch-icon { width: 36px; height: 36px; border-radius: var(--radius-sm); background: $bg-secondary; border: 1px solid $border-color; display: flex; align-items: center; justify-content: center; flex-shrink: 0; svg { width: 16px; height: 16px; color: $accent-primary; } }
.ch-info { flex: 1; }
.ch-name { font-size: 13.5px; font-weight: 600; color: $text-primary; }
.ch-sub { font-size: 11.5px; color: $text-muted; margin-top: 2px; }

// Action bar
.action-bar { display: flex; justify-content: space-between; align-items: center; margin-top: 24px; }
.action-right { display: flex; gap: 8px; margin-left: auto; }

.btn { display: inline-flex; align-items: center; gap: 7px; padding: 10px 18px; border-radius: var(--radius-md); font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid transparent; transition: .15s; text-decoration: none; font-family: inherit; }
.btn-primary { background: $accent-primary; color: #fff; border-color: $accent-primary; &:hover { background: $accent-hover; } }
.btn-default { background: $bg-card; color: $text-primary; border-color: $border-color; &:hover { border-color: var(--border-strong); } }
</style>
