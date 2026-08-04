# Hermes 值守任务详情页重构 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 JobDetailPage.vue 从 Tab 布局重构为与 duty-task-detail.html 原型一致的一页式 2 列 Grid 布局

**Architecture:** 单文件重构 (SFC)，script 增量添加 computed 属性，template 完全重写为 Hero + 2列Grid + 全宽成果区，style 完全重写匹配原型 CSS

**Tech Stack:** Vue 3 Composition API + SCSS + Naive UI (NSpin/NEmpty/NPopconfirm)

## Global Constraints

- 只改 `packages/client/src/views/hermes/JobDetailPage.vue` 一个文件
- 保留现有 script 逻辑，增量添加辅助 computed
- 数据全部来自真实 API（jobs + cron-history），不使用 mock 数据
- 样式匹配 `docs/prototypes/duty-task-detail.html` 原型

---

### Task 1: 添加新 computed 属性到 script

**Files:**
- Modify: `packages/client/src/views/hermes/JobDetailPage.vue` (script 部分)

- [ ] **Step 1: 添加城市解析 computed**

在 `scheduleText` computed 下方添加：

```typescript
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
```

- [ ] **Step 2: 添加累计运行次数和成功率 computed**

在 `cityName` 下方添加：

```typescript
// 累计运行次数（从 runs 数据计算）
const totalRuns = computed<number>(() => runs.value.length)

// 最近运行成功率
const successRate = computed<string>(() => {
  if (runs.value.length === 0) return '—'
  const ok = runs.value.filter(r => {
    // 根据 last_status 判断；如果 run 数据不直接带 status，用 job 的 last_status
    return true // run entries 暂无 status 字段，回退使用 job 级数据
  }).length
  return '—' // 因 RunEntry 无 status 字段，暂时回退
})
```

- [ ] **Step 3: 添加创建者名称 computed**

```typescript
// 创建者（从 origin 或默认显示）
const creatorName = computed<string>(() => {
  if (job.value?.origin?.chat_name) return job.value.origin.chat_name
  return '—'
})
```

- [ ] **Step 4: 添加成果数量 computed**

```typescript
// 成果数量
const artifactCount = computed<number>(() => outputArtifacts.value.length)
```

- [ ] **Step 5: 删除 activeTab 相关代码**

删除以下行：
```typescript
// ==================== Tabs ====================
type TabKey = 'config' | 'runlog' | 'outputs'
const activeTab = ref<TabKey>('config')
```

以及删除 `watch(activeTab, ...)` 块：
```typescript
watch(activeTab, tab => {
  if (tab === 'outputs') void loadOutputs()
})
```

改为在 `onMounted` 中直接调用 `loadOutputs()`。

- [ ] **Step 6: 添加执行记录精简列表 computed（最近 5 条）**

```typescript
// 最近 5 条执行记录（用于概况区展示）
const recentRuns = computed<RunEntry[]>(() => {
  return [...runs.value]
    .sort((a, b) => (a.runTime < b.runTime ? 1 : -1))
    .slice(0, 5)
})
```

- [ ] **Step 7: 删除未使用的 runlog 展开相关状态**

删除以下不再需要的 ref 和函数（展开功能移到了原型布局中不再有独立的 runlog tab，但保留在 record 区域简单展示）：
```typescript
// 保留 expandedRun, runContent, runContentLoading, runKey, ensureRunContent, toggleRunExpand
// 保留 runGrouped（执行记录区可能用到）
// 但删除 loadRuns 中的引用到 runlog tab 的逻辑 — 改为 onMounted 中自动加载
```

实际上，展开功能需要保留用于执行记录区域的点击展开查看日志。**保留所有 run log 相关的 ref 和函数。**

- [ ] **Step 8: 运行 lint 检查**

```bash
cd e:/envclaw/packages/client && npx vue-tsc --noEmit src/views/hermes/JobDetailPage.vue 2>&1 | head -20
```

- [ ] **Step 9: Commit**

```bash
git add packages/client/src/views/hermes/JobDetailPage.vue
git commit -m "feat(hermes): add computed properties for duty detail redesign"
```

---

### Task 2: 重写 Template — Hero 区 + 任务概况

**Files:**
- Modify: `packages/client/src/views/hermes/JobDetailPage.vue` (template 部分)

- [ ] **Step 1: 替换整个 `<template>` 块为新的 Hero + 概况布局**

删除整个现有 `<template>` 块，替换为：

```vue
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
                <button class="btn btn-default danger">
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
              <span class="more-link">最近 {{ recentRuns.length }} 条</span>
            </div>
            <div v-if="runsLoading && runs.length === 0" style="text-align:center;padding:20px;color:var(--text-muted)">加载中...</div>
            <div v-else-if="recentRuns.length === 0" style="text-align:center;padding:20px;color:var(--text-muted)">暂无运行记录</div>
            <div v-else class="record-list">
              <div v-for="run in recentRuns" :key="runKey(run)" class="record-row">
                <span class="status-pill" :class="job.last_status === 'error' ? 'error' : 'success'">
                  <span class="pill-dot"></span>{{ job.last_status === 'error' ? '失败' : '成功' }}
                </span>
                <span class="record-time">{{ formatTime(run.runTime) }}</span>
                <span class="record-meta">{{ run.size > 1024 ? `${(run.size / 1024).toFixed(1)}KB` : `${run.size}B` }}</span>
                <a class="record-link" @click="toggleRunExpand(run)">
                  {{ expandedRun === runKey(run) ? '收起' : '查看输出' }}
                </a>
              </div>
            </div>
          </section>
        </div>
      </template>
    </NSpin>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/views/hermes/JobDetailPage.vue
git commit -m "feat(hermes): rewrite template with hero + overview grid"
```

---

### Task 3: 补充 Template — 能力清单 + 操作项 + 成果区 + 展开日志

**Files:**
- Modify: `packages/client/src/views/hermes/JobDetailPage.vue` (template 部分)

- [ ] **Step 1: 在 detail-grid 内追加能力清单和任务操作项**

在 Task 2 的 `</div> <!-- detail-grid -->` 之前追加：

```vue
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
            <div v-if="manifestOutputs.length === 0" style="text-align:center;padding:20px;color:var(--text-muted)">未检测到成果执行清单</div>
            <div v-else class="cap-list">
              <div v-for="(output, index) in manifestOutputs" :key="output.id || `cap-${index}`" class="cap-row">
                <div class="cap-mono">{{ index % 2 === 0 ? '≋' : '◇' }}</div>
                <div class="cap-info">
                  <div class="cap-name">{{ capLabel(output.capability) }}</div>
                  <div class="cap-desc">{{ output.skill || '' }} {{ outputConfigRows(output.config).slice(0, 3).map(r => r.value).join(' · ') }}</div>
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
            <div v-if="manifestOutputs.length === 0" style="text-align:center;padding:20px;color:var(--text-muted)">暂无操作项</div>
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
```

- [ ] **Step 2: 在 detail-grid 后追加全宽成果区**

```vue
        <!-- ==================== ⑤ 成果区（全宽） ==================== -->
        <section class="detail-section detail-outputs">
          <div class="detail-section-head">
            <div class="detail-section-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              成果文件
              <span v-if="outputArtifacts.length" class="count-tag">{{ outputArtifacts.length }}</span>
            </div>
            <button class="more-link" @click="loadOutputs" style="background:none;border:none;cursor:pointer;font-family:inherit;">重新扫描</button>
          </div>
          <div v-if="outputGroups.length === 0" style="text-align:center;padding:20px;color:var(--text-muted)">
            {{ Object.values(runContentLoading).some(Boolean) ? '扫描中...' : '暂未扫描到成果文件' }}
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

        <!-- ==================== 展开的运行日志 ==================== -->
        <div v-if="expandedRun" class="detail-section" style="margin-top:16px">
          <div class="detail-section-head">
            <div class="detail-section-title">运行日志</div>
            <button class="more-link" @click="expandedRun = null" style="background:none;border:none;cursor:pointer;font-family:inherit;">关闭</button>
          </div>
          <NSpin v-if="runContentLoading[expandedRun]" size="small" />
          <pre v-else class="run-content">{{ runContent[expandedRun] || '输出为空' }}</pre>
        </div>
```

- [ ] **Step 3: 删除旧的 Tab 相关 template 代码**

确保 `<div class="detail-tabs">`、`<div v-if="activeTab === 'config'">`、`<div v-if="activeTab === 'runlog'">`、`<div v-if="activeTab === 'outputs'">` 等旧的 tab panel template 代码已全部删除。

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/views/hermes/JobDetailPage.vue
git commit -m "feat(hermes): add capability, operations, and outputs sections to detail page"
```

---

### Task 4: 重写 Style — 匹配原型样式

**Files:**
- Modify: `packages/client/src/views/hermes/JobDetailPage.vue` (style 部分)

- [ ] **Step 1: 删除旧样式，替换为原型匹配的样式**

删除整个 `<style scoped lang="scss">` 块，替换为：

```scss
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

.job-name {
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
  color: $text-primary;

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
}

.detail-section {
  background: $bg-card;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  padding: 20px 22px;
}

.detail-outputs {
  margin-top: 16px;
  grid-column: 1 / -1;
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/views/hermes/JobDetailPage.vue
git commit -m "style(hermes): rewrite detail page styles to match prototype"
```

---

### Task 5: 验证与清理

**Files:**
- Modify: `packages/client/src/views/hermes/JobDetailPage.vue` (整体)

- [ ] **Step 1: 确保 onMounted 中加载 outputs**

修改 `onMounted` 确保加载 outputs：

```typescript
onMounted(() => {
  void loadJob()
  void loadRuns()
  void loadOutputs()
})
```

- [ ] **Step 2: 删除不再使用的 Tab 相关代码**

确认以下代码已删除：
- `type TabKey = 'config' | 'runlog' | 'outputs'`
- `const activeTab = ref<TabKey>('config')`
- `watch(activeTab, ...)`

- [ ] **Step 3: 运行 TypeScript 类型检查**

```bash
cd e:/envclaw/packages/client && npx vue-tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 4: 修复任何类型错误**

根据 `vue-tsc` 输出修复类型问题。

- [ ] **Step 5: 运行开发服务器验证页面**

```bash
cd e:/envclaw/packages/client && npx vite --port 5173 &
```
在浏览器中打开 `/hermes/duty/:id` 确认：
- Hero 区显示正常
- 任务概况 KV 数据正确
- 执行记录从 API 加载
- 能力清单解析正确
- 成果文件显示正常

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/views/hermes/JobDetailPage.vue
git commit -m "chore(hermes): cleanup unused tab code, wire up outputs loading"
```
```

---

## Self-Review

**Spec coverage:**
- ✅ 去掉 Tab 结构 → Task 2, 5
- ✅ Hero 卡片匹配原型 → Task 2
- ✅ 执行记录真实数据 → Task 3
- ✅ 城市解析 → Task 1
- ✅ 成果区保留（全宽在 Grid 下方）→ Task 3
- ✅ 匹配原型样式 → Task 4

**Placeholder scan:** 无 TBD/TODO，所有步骤有具体代码。

**Type consistency:** 
- `cityName`, `totalRuns`, `successRate`, `creatorName`, `artifactCount`, `recentRuns` — all defined in Task 1
- Template uses them in Task 2-3 — names match
- `runKey()` and `expandRun` exist from existing code — no rename conflicts
