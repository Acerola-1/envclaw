<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NCheckbox, NCheckboxGroup, NInput, NRadioButton, NRadioGroup, NSelect, NTag } from 'naive-ui'
import {
  captureRankingDuty,
  defaultRankingDutyDraft,
  type RankingDutyDefinition,
  type RankingDutyDraft,
} from '@/features/envclaw/ranking-duty-demo'

const router = useRouter()
const draft = ref<RankingDutyDraft>(defaultRankingDutyDraft())
const savedDefinition = ref<RankingDutyDefinition | null>(null)
const rehearsalComplete = ref(false)
const advancedOpen = ref(false)

const targetOptions = [
  { label: '城市排名', value: 'city' },
  { label: '站点排名', value: 'station' },
]
const regionOptions = [
  { label: '河南省 / 平顶山市', value: '河南省 / 平顶山市' },
  { label: '河南省 / 平顶山市 / 新华区', value: '河南省 / 平顶山市 / 新华区' },
  { label: '河南省 / 平顶山市 / 湛河区', value: '河南省 / 平顶山市 / 湛河区' },
]
const timeKinds = [
  { label: '实时', value: 'realtime' },
  { label: '日累计', value: 'dayAccumulated' },
  { label: '日', value: 'day' },
  { label: '月', value: 'month' },
  { label: '年', value: 'year' },
  { label: '时间段', value: 'range' },
]
const factorOptions = ['AQI', 'PM₂.₅', 'PM₁₀', 'SO₂', 'NO₂', 'CO', 'O₃'].map(value => ({ label: value, value }))
const observedAt = '2026-07-15 08:00（模拟平台页面数据）'

const title = computed(() => draft.value.target === 'city' ? '河南省城市空气质量排名表' : '平顶山市站点空气质量排名表')
const effectiveTime = computed(() => draft.value.timeIntent === 'latestPublished' ? '最新已发布数据' : draft.value.specifiedTime)
const timeKindLabel = computed(() => timeKinds.find(item => item.value === draft.value.timeKind)?.label ?? '')

const rows = computed(() => draft.value.target === 'city'
  ? [
      ['1', '南阳市', '27', '优'], ['2', '郑州市', '31', '优'], ['3', '开封市', '34', '优'],
      ['4', '平顶山市', '42', '优'], ['5', '洛阳市', '46', '优'], ['6', '焦作市', '52', '良'],
    ]
  : [
      ['1', '市政站', '32', '优'], ['2', '新华区站', '36', '优'], ['3', '湛河区站', '39', '优'],
      ['4', '卫东区站', '43', '优'], ['5', '高新区站', '49', '优'], ['6', '石龙区站', '55', '良'],
    ],
)

function saveOutput() {
  savedDefinition.value = captureRankingDuty(draft.value, observedAt)
  rehearsalComplete.value = false
}

function rehearse() {
  if (!savedDefinition.value) saveOutput()
  rehearsalComplete.value = true
}

function resetPreset() {
  draft.value = defaultRankingDutyDraft()
  savedDefinition.value = null
  rehearsalComplete.value = false
}
</script>

<template>
  <main class="duty-demo" :class="{ dark: draft.theme === 'dark' }">
    <header class="topbar">
      <button class="back" @click="router.push('/envclaw/guard')">← 返回值守方案</button>
      <div class="crumb"><span>数智大气</span><i>/</i><span>数据分析</span><i>/</i><b>浓度排名值守</b></div>
      <NTag round size="small" type="warning">演示原型 · 未创建真实任务</NTag>
    </header>

    <section class="hero">
      <div>
        <div class="eyebrow">MAPAIRS · DUTY TEMPLATE 01</div>
        <h1>浓度排名值守</h1>
        <p>系统已为平顶山市填好一套值守方案。你只需要确认“看什么、取哪时刻、交付什么”。</p>
      </div>
      <div class="hero-actions">
        <span class="context-dot"></span>
        当前值守城市：<strong>平顶山市</strong>
      </div>
    </section>

    <div class="workspace">
      <section class="config-panel">
        <div class="panel-title"><span>01</span><div><h2>设置值守口径</h2><p>以下选项会保存为业务配置，而非网页操作步骤。</p></div></div>

        <div class="field-block">
          <label>查询对象</label>
          <NRadioGroup v-model:value="draft.target" name="rankingTarget">
            <NRadioButton v-for="item in targetOptions" :key="item.value" :value="item.value">{{ item.label }}</NRadioButton>
          </NRadioGroup>
        </div>

        <div class="field-block"><label>行政区</label><NSelect v-model:value="draft.region" :options="regionOptions" /></div>

        <div class="field-block">
          <div class="label-line"><label>数据口径</label><span>决定排名所用数据范围</span></div>
          <div class="time-grid"><button v-for="item in timeKinds" :key="item.value" :class="{ active: draft.timeKind === item.value }" @click="draft.timeKind = item.value as RankingDutyDraft['timeKind']">{{ item.label }}</button></div>
        </div>

        <div class="field-block time-intent">
          <label>数据时间</label>
          <NRadioGroup v-model:value="draft.timeIntent" name="timeIntent">
            <NRadioButton value="latestPublished">最新已发布</NRadioButton>
            <NRadioButton value="specified">指定时间</NRadioButton>
          </NRadioGroup>
          <NInput v-if="draft.timeIntent === 'specified'" v-model:value="draft.specifiedTime" placeholder="2026-07-15 08:00" />
          <div v-else class="intent-note">不会把当前页面的 08:00 固化为未来任务时间。</div>
        </div>

        <button class="advanced-toggle" @click="advancedOpen = !advancedOpen">{{ advancedOpen ? '收起' : '展开' }} 更多筛选条件 <span>{{ advancedOpen ? '⌃' : '⌄' }}</span></button>
        <div v-if="advancedOpen" class="advanced-fields">
          <div class="field-block"><label>污染因子</label><NCheckboxGroup v-model:value="draft.factors"><div class="factor-grid"><NCheckbox v-for="item in factorOptions" :key="item.value" :value="item.value">{{ item.label }}</NCheckbox></div></NCheckboxGroup></div>
          <div class="field-block"><label>成果内容</label><div class="output-checks"><NCheckbox v-model:checked="draft.includeScreenshot">生成排名截图</NCheckbox><NCheckbox v-model:checked="draft.includeAnalysis">生成数据分析</NCheckbox></div></div>
          <template v-if="draft.includeScreenshot">
            <div class="field-block"><label>截图区域</label><NRadioGroup v-model:value="draft.screenshotScope" name="screenshotScope"><NRadioButton value="tableOnly">仅标题和表格</NRadioButton><NRadioButton value="withFilters">包含查询条件</NRadioButton></NRadioGroup></div>
            <div class="field-block"><label>截图色彩</label><NRadioGroup v-model:value="draft.theme" name="theme"><NRadioButton value="light">浅色模式</NRadioButton><NRadioButton value="dark">深色模式</NRadioButton></NRadioGroup></div>
          </template>
        </div>

        <div class="config-footer"><button class="reset" @click="resetPreset">恢复预设</button><NButton type="primary" size="large" @click="saveOutput">保存本次成果配置</NButton></div>
      </section>

      <section class="preview-panel">
        <div class="preview-head"><div><span class="live-dot"></span>成果预览</div><small>{{ observedAt }}</small></div>
        <div class="platform-window">
          <div class="platform-nav"><div class="brand-mark">数智大气</div><span>数据分析</span><span class="active-nav">浓度排名</span><span>监测数据</span></div>
          <div v-if="draft.screenshotScope === 'withFilters'" class="filter-preview"><b>{{ draft.target === 'city' ? '城市' : '站点' }}</b><span>{{ draft.region }}</span><span>{{ timeKindLabel }}</span><span>{{ effectiveTime }}</span></div>
          <div class="ranking-title">{{ effectiveTime }} {{ title }}</div>
          <table><thead><tr><th>排名</th><th>{{ draft.target === 'city' ? '城市名称' : '站点名称' }}</th><th>AQI</th><th>等级</th><th>首要污染物</th></tr></thead><tbody><tr v-for="row in rows" :key="row[0]" :class="{ focus: row[1].includes('平顶山') || row[1].includes('市政') }"><td>{{ row[0] }}</td><td>{{ row[1] }}</td><td>{{ row[2] }}</td><td>{{ row[3] }}</td><td>{{ row[2] === '42' ? 'O₃' : '—' }}</td></tr></tbody></table>
          <div class="fixture-foot">演示数据 · 截图实际输出会由数智大气平台服务生成</div>
        </div>

        <div class="preview-meta"><span>时间策略 <b>{{ effectiveTime }}</b></span><span>成果 <b>{{ draft.includeScreenshot ? '截图' : '' }}{{ draft.includeScreenshot && draft.includeAnalysis ? ' + ' : '' }}{{ draft.includeAnalysis ? '分析' : '' }}</b></span></div>
      </section>

      <aside class="contract-panel">
        <div class="panel-title"><span>02</span><div><h2>执行约定</h2><p>确认后，未来每次值守都会按这里的口径运行。</p></div></div>
        <div v-if="!savedDefinition" class="empty-contract"><div class="empty-icon">◌</div><b>尚未保存成果配置</b><p>确认左侧选项后，保存一份可预演的值守定义。</p></div>
        <template v-else>
          <div class="contract-status"><span>✓</span><div><b>浓度排名成果已捕捉</b><small>本地演示状态，尚未创建定时任务</small></div></div>
          <dl><div><dt>查询范围</dt><dd>{{ savedDefinition.region }}</dd></div><div><dt>数据口径</dt><dd>{{ timeKindLabel }} · {{ savedDefinition.timeIntent === 'latestPublished' ? '最新已发布' : '指定时间' }}</dd></div><div><dt>污染因子</dt><dd>{{ savedDefinition.factors.join('、') }}</dd></div><div><dt>交付成果</dt><dd>{{ savedDefinition.includeScreenshot ? '排名截图' : '' }}{{ savedDefinition.includeScreenshot && savedDefinition.includeAnalysis ? '、' : '' }}{{ savedDefinition.includeAnalysis ? '数据分析' : '' }}</dd></div></dl>
          <div class="run-plan"><b>预演将执行</b><ol><li>获取{{ savedDefinition.region }}的{{ effectiveTime }}{{ timeKindLabel }}数据</li><li>生成{{ savedDefinition.target === 'city' ? '城市' : '站点' }}排名结果</li><li v-if="savedDefinition.includeScreenshot">生成{{ savedDefinition.theme === 'light' ? '浅色' : '深色' }}排名截图</li><li v-if="savedDefinition.includeAnalysis">输出数据分析摘要</li></ol></div>
          <NButton block type="primary" size="large" @click="rehearse">{{ rehearsalComplete ? '预演完成 · 再次预演' : '运行一次本地预演' }}</NButton>
          <div v-if="rehearsalComplete" class="success-note"><b>预演成功</b><span>已生成模拟排名截图与分析摘要；没有访问外部平台，也没有创建真实任务。</span></div>
        </template>
      </aside>
    </div>
  </main>
</template>

<style scoped lang="scss">
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@600;700;900&family=Source+Han+Sans+SC:wght@400;500;600;700&display=swap');

.duty-demo { --ink:#1f3145; --muted:#738296; --line:#dfe7ef; --blue:#1886e7; --blue-deep:#0965bc; --paper:#f5f8fb; --card:#fff; min-height:100%; color:var(--ink); background:radial-gradient(circle at 87% 1%, #dcefff 0, transparent 24rem), var(--paper); font-family:'Source Han Sans SC','Microsoft YaHei',sans-serif; padding:0 30px 40px; }
.duty-demo.dark { --ink:#e7f1fa; --muted:#9aabbd; --line:#2c4053; --paper:#132230; --card:#1a2b3b; background:radial-gradient(circle at 87% 1%, #164b7f 0, transparent 24rem),var(--paper); }
.topbar { height:62px; display:flex; align-items:center; gap:22px; border-bottom:1px solid var(--line); font-size:12px; }.back { color:var(--blue-deep); background:none; border:0; padding:0; cursor:pointer; font:inherit; font-weight:700; }.crumb { color:var(--muted); display:flex; gap:9px; }.crumb b { color:var(--ink); }.topbar :deep(.n-tag) { margin-left:auto; }
.hero { display:flex; justify-content:space-between; align-items:flex-end; padding:38px 0 28px; }.eyebrow { color:var(--blue); letter-spacing:1.3px; font-size:11px; font-weight:800; }.hero h1 { margin:8px 0 6px; font:900 29px/1.15 'Noto Serif SC',serif; letter-spacing:1px; }.hero p { color:var(--muted); font-size:14px; margin:0; }.hero-actions { border:1px solid var(--line); background:color-mix(in srgb, var(--card) 75%, transparent); padding:10px 14px; border-radius:8px; font-size:13px; }.context-dot,.live-dot { display:inline-block; width:7px; height:7px; border-radius:50%; background:#30c782; margin-right:7px; box-shadow:0 0 0 4px rgba(48,199,130,.12); }
.workspace { display:grid; grid-template-columns:minmax(290px,.86fr) minmax(460px,1.5fr) minmax(285px,.82fr); gap:18px; align-items:start; }.config-panel,.preview-panel,.contract-panel { background:var(--card); border:1px solid var(--line); border-radius:14px; box-shadow:0 12px 35px rgba(21,47,73,.045); }.config-panel,.contract-panel { padding:24px; }.preview-panel { overflow:hidden; }.panel-title { display:flex; gap:12px; padding-bottom:20px; border-bottom:1px solid var(--line); }.panel-title>span { color:var(--blue); font:900 18px/1 'Noto Serif SC'; }.panel-title h2 { font-size:16px; margin:0 0 4px; }.panel-title p { font-size:12px; color:var(--muted); margin:0; line-height:1.45; }
.field-block { margin-top:19px; }.field-block>label,.label-line label { display:block; font-size:13px; font-weight:700; margin-bottom:9px; }.label-line { display:flex; justify-content:space-between; }.label-line span { font-size:11px; color:var(--muted); }.time-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }.time-grid button { border:1px solid var(--line); color:var(--muted); background:transparent; height:32px; border-radius:5px; cursor:pointer; }.time-grid button.active { background:#e4f3ff; color:var(--blue-deep); border-color:#a7d7ff; font-weight:700; }.dark .time-grid button.active { background:#164a72; }.time-intent :deep(.n-radio-group),.field-block :deep(.n-radio-group) { display:flex; gap:7px; flex-wrap:wrap; }.time-intent :deep(.n-input) { margin-top:9px; }.intent-note { font-size:11px; color:var(--muted); margin-top:9px; padding-left:2px; }.advanced-toggle { margin-top:18px; color:var(--blue-deep); padding:0; border:0; background:none; cursor:pointer; font-weight:700; font-size:12px; }.advanced-toggle span { margin-left:4px; }.advanced-fields { padding:1px 0 3px; }.factor-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:9px; }.output-checks { display:grid; gap:10px; }.config-footer { border-top:1px solid var(--line); margin-top:23px; padding-top:17px; display:flex; justify-content:space-between; align-items:center; }.reset { border:0; background:none; color:var(--muted); cursor:pointer; font-size:12px; }
.preview-head { display:flex; justify-content:space-between; align-items:center; padding:18px 20px; font-size:13px; font-weight:700; }.preview-head small { font-size:11px; color:var(--muted); font-weight:400; }.platform-window { margin:0 16px; border:1px solid #d9e3ed; background:#fff; color:#263c50; box-shadow:0 8px 24px rgba(14,57,88,.08); }.platform-nav { background:linear-gradient(90deg,#0879df,#38a4f4); height:42px; display:flex; align-items:center; color:rgba(255,255,255,.85); gap:22px; padding:0 16px; font-size:11px; }.brand-mark { color:white; font-weight:900; letter-spacing:.8px; margin-right:auto; }.platform-nav .active-nav { color:white; font-weight:700; border-bottom:2px solid white; height:42px; display:flex; align-items:center; }.filter-preview { height:38px; background:#f4f7fa; border-bottom:1px solid #e3e9ef; display:flex; align-items:center; gap:11px; padding:0 12px; font-size:10px; }.filter-preview span { background:#fff; border:1px solid #dce5ed; padding:3px 6px; border-radius:2px; }.ranking-title { text-align:center; color:#eb3c32; font-weight:800; font-size:13px; padding:17px 8px 11px; }table { width:100%; border-collapse:collapse; font-size:11px; }th { background:#edf2f6; padding:7px 5px; color:#4e6273; }td { text-align:center; padding:7px 5px; border-top:1px solid #edf1f4; }tbody tr:nth-child(even) { background:#f8fafb; }tr.focus td { background:#fff7b2; font-weight:800; }.fixture-foot { font-size:10px; color:#748493; padding:10px; text-align:right; }.preview-meta { display:flex; gap:21px; padding:15px 20px; color:var(--muted); font-size:12px; }.preview-meta b { color:var(--ink); margin-left:5px; }
.empty-contract { text-align:center; padding:55px 8px 40px; }.empty-icon { font-size:35px; color:#b7c8d8; }.empty-contract b { display:block; margin-top:12px; font-size:14px; }.empty-contract p { color:var(--muted); font-size:12px; line-height:1.6; }.contract-status { display:flex; gap:9px; padding:13px; background:#effaf4; border:1px solid #bdebcf; border-radius:8px; color:#237446; }.dark .contract-status { background:#173c2b; }.contract-status>span { font-weight:bold; }.contract-status b,.contract-status small { display:block; }.contract-status b { font-size:12px; }.contract-status small { font-size:10px; margin-top:3px; opacity:.8; }dl { margin:18px 0; }dl div { display:grid; grid-template-columns:76px 1fr; gap:8px; font-size:12px; padding:10px 0; border-bottom:1px solid var(--line); }dt { color:var(--muted); }dd { margin:0; font-weight:600; }.run-plan { background:#f3f7fb; padding:14px; border-radius:8px; font-size:12px; margin-bottom:16px; }.dark .run-plan { background:#22384c; }.run-plan ol { color:var(--muted); padding-left:19px; line-height:1.85; margin:8px 0 0; }.success-note { background:#eef8ff; border-left:3px solid var(--blue); margin-top:13px; padding:10px 11px; font-size:11px; line-height:1.55; }.dark .success-note { background:#173c58; }.success-note b,.success-note span { display:block; }.success-note span { color:var(--muted); }
@media (max-width:1250px) { .workspace { grid-template-columns:minmax(290px,.9fr) minmax(420px,1.4fr); }.contract-panel { grid-column:1/-1; }.contract-panel dl { display:grid; grid-template-columns:1fr 1fr; column-gap:20px; } }
@media (max-width:780px) { .duty-demo { padding:0 16px 28px; }.hero,.topbar { align-items:flex-start; flex-direction:column; gap:11px; height:auto; padding:18px 0; }.topbar :deep(.n-tag) { margin-left:0; }.workspace { grid-template-columns:1fr; }.contract-panel { grid-column:auto; }.contract-panel dl { display:block; }.hero-actions { font-size:12px; }.platform-nav { gap:10px; }.platform-nav span:not(.active-nav) { display:none; } }
</style>
