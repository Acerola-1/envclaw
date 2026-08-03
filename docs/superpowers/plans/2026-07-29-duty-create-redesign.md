# 创建值守任务页面重设计 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `docs/duty-create.html` 用"温润呼吸感"设计语言完全重写，保留 3 步向导框架。

**Architecture:** 单文件 HTML（内联 CSS + 内联 JS），全宽沉浸式布局（无侧栏），max-width 960px 居中。Step 1 左右两栏（成果列表 + 实时预览），Step 2 卡片网格，Step 3 居中确认。配置区在成果卡片下方内联展开。

**Tech Stack:** HTML5 + CSS3（CSS 变量 + Flexbox + Grid）+ 原生 JS + 内联 SVG 图标（Lucide 风格）

## Global Constraints

- 文件路径：`docs/duty-create.html`（覆盖现有 v1 文件）
- 样式内联：所有 CSS 写入 `<style>` 标签，不依赖外部文件
- 脚本内联：所有 JS 写入 `<script>` 标签，不依赖框架
- 图标：全部使用内联 SVG，线条风格（Lucide），1.7px stroke-width
- 色彩基准：底色 #f9f7f4（宣纸暖白），强调色 #1a8a5a（松石绿），文字 #3b3a38（暖灰）
- 圆角尺度：卡片 16px，按钮 12px，输入框 10px，chip 20px
- 字体：Inter / system-ui / PingFang SC / Microsoft YaHei 兜底
- 动效约束：全局 `@media (prefers-reduced-motion: reduce)` 禁用所有动画
- 业务约束：4 种成果类型不可重复添加，至少保留 1 项成果
- URL 参数支持：`?caps=a,b` 预选成果，`?edit=id` 编辑模式

---

### Task 1: 设计令牌 + CSS 基础 + HTML 骨架

**Files:**
- Overwrite: `docs/duty-create.html`

**Produces:** 完整的 CSS 变量体系、基础样式 reset、顶部导航栏、步骤条、步骤面板容器、Toast 容器。此阶段页面可见步骤条和空白面板。

- [ ] **Step 1: 写入文件骨架**

创建文件，包含完整的 CSS 变量和全局样式：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>envClaw · 创建值守任务</title>
<style>
/* ===== 设计令牌 ===== */
:root {
  --bg-page:        #f9f7f4;
  --bg-card:        #ffffff;
  --text-primary:   #3b3a38;
  --text-secondary: #6e6c69;
  --text-muted:     #9b9894;
  --border:         #e8e4df;
  --border-light:   #f0ece7;

  --accent:         #1a8a5a;
  --accent-hover:   #147a48;
  --accent-light:   #eaf5ef;
  --accent-ring:    rgba(26,138,90,.15);

  --warning:        #e8a020;
  --warning-light:  #fef9ed;
  --danger:         #c44e3e;
  --danger-light:   #fef4f2;
  --success:        #2e8b5a;
  --info:           #4a8fa8;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-chip: 20px;

  --shadow-card: 0 1px 3px rgba(59,58,56,.04), 0 4px 16px rgba(59,58,56,.03);
  --shadow-hover: 0 2px 6px rgba(59,58,56,.06), 0 8px 24px rgba(59,58,56,.04);
  --shadow-btn: 0 2px 8px rgba(26,138,90,.15);

  --font-sans: 'Inter', system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;

  --ease-out: cubic-bezier(.4,0,.2,1);
  --ease-spring: cubic-bezier(.34,1.56,.64,1);
}

/* ===== 重置 ===== */
* { margin:0; padding:0; box-sizing:border-box; }
body {
  font-family: var(--font-sans);
  background: var(--bg-page);
  color: var(--text-primary);
  height: 100vh; overflow-y: auto; overflow-x: hidden;
  font-size: 14px; line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
a { color: inherit; text-decoration: none; }

/* ===== 顶部导航 ===== */
.top-bar {
  display: flex; align-items: center; gap: 10px;
  max-width: 960px; margin: 0 auto;
  padding: 20px 0 16px;
}
.top-bar .back-link {
  display: flex; align-items: center; gap: 5px;
  font-size: 13px; color: var(--text-secondary);
  padding: 5px 8px; border-radius: var(--radius-sm);
  transition: all .15s var(--ease-out);
}
.top-bar .back-link:hover { background: rgba(0,0,0,.03); color: var(--text-primary); }
.top-bar .divider { width: 1px; height: 18px; background: var(--border); }
.top-bar .page-title { font-size: 16px; font-weight: 700; color: var(--text-primary); }

/* ===== 步骤条 ===== */
.stepper-wrap { display: flex; justify-content: center; padding: 12px 0 32px; }
.stepper { display: flex; align-items: center; gap: 0; }
.step-node {
  display: flex; align-items: center; gap: 10px;
  cursor: pointer; padding: 8px 14px; border-radius: var(--radius-xl);
  transition: all .2s var(--ease-out);
}
.step-node:hover { background: rgba(0,0,0,.02); }
.step-dot {
  width: 36px; height: 36px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700;
  background: var(--bg-card); color: var(--text-muted);
  border: 2px solid var(--border);
  box-shadow: var(--shadow-card);
  transition: all .3s var(--ease-spring);
  position: relative; z-index: 1;
}
.step-node.active .step-dot {
  background: linear-gradient(135deg, var(--accent), #2ea55f);
  border-color: transparent; color: #fff;
  box-shadow: 0 0 0 6px var(--accent-ring), var(--shadow-hover);
  transform: scale(1.06);
}
.step-node.done .step-dot {
  background: var(--accent); border-color: transparent; color: #fff;
  box-shadow: 0 0 0 4px rgba(46,139,90,.12);
}
.step-info { display: flex; flex-direction: column; }
.step-info .step-title { font-size: 13px; font-weight: 600; color: var(--text-muted); transition: color .3s; }
.step-node.active .step-title { color: var(--text-primary); }
.step-node.done .step-title { color: var(--accent); }
.step-info .step-desc { font-size: 11px; color: var(--text-muted); transition: color .3s; }
.step-line { width: 48px; height: 2px; background: var(--border); border-radius: 1px; transition: background .3s var(--ease-out); }
.step-line.done { background: var(--accent); }

/* ===== 内容区 ===== */
.content { max-width: 960px; margin: 0 auto; padding: 0 0 48px; }

/* ===== 步骤面板 ===== */
.step-panel { display: none; }
.step-panel.visible { display: block; animation: fadeSlideIn .35s var(--ease-out); }
@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }

/* ===== 底部操作栏 ===== */
.footer-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 24px 0 0; margin-top: 32px;
  border-top: 1px solid var(--border-light);
}
.footer-right { display: flex; gap: 10px; }

/* ===== 按钮 ===== */
.btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 10px 22px; border-radius: var(--radius-md);
  font-size: 13px; font-weight: 600; cursor: pointer;
  border: 1.5px solid transparent;
  transition: all .18s var(--ease-out);
  white-space: nowrap; font-family: var(--font-sans);
  text-decoration: none;
}
.btn:active { transform: scale(.97); transition: 80ms var(--ease-out); }
.btn-primary {
  background: linear-gradient(135deg, var(--accent), #2ea55f);
  color: #fff; box-shadow: var(--shadow-btn);
}
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(26,138,90,.25); }
.btn-secondary { background: var(--bg-card); color: var(--text-secondary); border-color: var(--border); }
.btn-secondary:hover { background: var(--bg-page); border-color: #d5d0c9; }
.btn-ghost { background: transparent; color: var(--text-secondary); }
.btn-ghost:hover { background: rgba(0,0,0,.03); color: var(--text-primary); }

/* ===== Toast ===== */
.toast {
  position: fixed; top: 28px; left: 50%;
  transform: translateX(-50%) translateY(-24px);
  background: var(--text-primary); color: #fff;
  padding: 12px 24px; border-radius: var(--radius-md);
  font-size: 13px; font-weight: 500; opacity: 0;
  transition: all .3s var(--ease-out);
  pointer-events: none; z-index: 1000;
  box-shadow: 0 8px 32px rgba(59,58,56,.15);
}
.toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

/* ===== Reduced Motion ===== */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
</style>
</head>
<body>

<!-- 顶部导航 -->
<div class="top-bar">
  <a class="back-link" href="duty-tasks.html">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    返回值守任务
  </a>
  <div class="divider"></div>
  <span class="page-title">创建值守任务</span>
</div>

<!-- 步骤条 -->
<div class="stepper-wrap">
  <div class="stepper">
    <div class="step-node active" data-step="1" onclick="goStep(1)">
      <div class="step-dot">1</div>
      <div class="step-info"><span class="step-title">选择成果</span><span class="step-desc">配置要交付的内容</span></div>
    </div>
    <div class="step-line" id="line1"></div>
    <div class="step-node" data-step="2" onclick="goStep(2)">
      <div class="step-dot">2</div>
      <div class="step-info"><span class="step-title">设置交付</span><span class="step-desc">运行时间与推送方式</span></div>
    </div>
    <div class="step-line" id="line2"></div>
    <div class="step-node" data-step="3" onclick="goStep(3)">
      <div class="step-dot">3</div>
      <div class="step-info"><span class="step-title">确认任务</span><span class="step-desc">检查并创建</span></div>
    </div>
  </div>
</div>

<!-- 内容区 -->
<div class="content">
  <div class="step-panel visible" id="panel1"></div>
  <div class="step-panel" id="panel2"></div>
  <div class="step-panel" id="panel3"></div>
</div>

<!-- Toast -->
<div class="toast" id="toast"><span id="toastMsg"></span></div>

<script>
let tTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  t.classList.add('show');
  clearTimeout(tTimer);
  tTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

let curStep = 1;
function goStep(s) {
  curStep = s;
  for (let i = 1; i <= 3; i++) document.getElementById('panel' + i).classList.toggle('visible', i === s);
  document.querySelectorAll('.step-node').forEach((el, idx) => {
    const st = idx + 1;
    el.classList.toggle('active', st === s);
    el.classList.toggle('done', st < s);
  });
  document.getElementById('line1').classList.toggle('done', 1 < s);
  document.getElementById('line2').classList.toggle('done', 2 < s);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
</script>
</body>
</html>
```

- [ ] **Step 2: 在浏览器中打开验证**

打开 `docs/duty-create.html`，确认：
- 顶部导航栏显示正常（返回链接 + 分隔 + 标题）
- 步骤条 3 个节点可见，第 1 步激活（松石绿渐变圆点 + 发光环）
- 点击步骤 2/3 可切换，步骤点样式变化并显示"完成"态
- Toast 可正常弹出

- [ ] **Step 3: 提交**

```bash
git add docs/duty-create.html
git commit -m "feat: duty-create 重设计 - Task 1 设计令牌 + CSS 基础 + HTML 骨架"
```

---

### Task 2: Step 1 - 左侧成果列表区

**Files:**
- Modify: `docs/duty-create.html`

**Interfaces:**
- Consumes: 现有 CSS 变量、`.content` 容器、`.step-panel` 结构
- Produces: `.step1-layout`（两栏 Grid）、`.card` 组件、`.output-card`、`.add-output-bar`、`.add-output-btn` 样式 + HTML 结构；`renderOutputs()` 函数签名

- [ ] **Step 1: 在 `<style>` 中添加 Step 1 布局和卡片样式**

在 `/* ===== 步骤面板 ===== */` 之后插入：

```css
/* ===== Step 1 布局 ===== */
.step1-layout { display: grid; grid-template-columns: 1fr 300px; gap: 24px; align-items: start; }
.step1-left { display: flex; flex-direction: column; gap: 20px; }

/* ===== 卡片 ===== */
.card {
  background: var(--bg-card); border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card); overflow: hidden;
  transition: box-shadow .2s var(--ease-out);
  border: 1px solid transparent;
}
.card:hover { box-shadow: var(--shadow-hover); }
.card-header {
  padding: 18px 24px; display: flex; align-items: center; gap: 10px;
  border-bottom: 1px solid var(--border-light);
}
.card-header .card-icon {
  width: 32px; height: 32px; border-radius: var(--radius-sm);
  background: var(--accent-light); display: grid; place-items: center;
  color: var(--accent);
}
.card-header .card-icon svg { width: 16px; height: 16px; }
.card-header .card-title { font-size: 14px; font-weight: 650; color: var(--text-primary); }
.card-body { padding: 22px 24px; }

/* ===== 输入框 ===== */
.input {
  width: 100%; padding: 10px 14px; border: 1.5px solid var(--border);
  border-radius: var(--radius-sm); font-size: 13.5px; font-family: var(--font-sans);
  outline: none; transition: all .18s var(--ease-out);
  background: var(--bg-card); color: var(--text-primary);
}
.input:hover { border-color: #d5d0c9; }
.input:focus { border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-ring); }
.input::placeholder { color: var(--text-muted); }

/* ===== 成果列表卡片 ===== */
.output-list { display: flex; flex-direction: column; gap: 8px; }
.output-card {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 18px; background: var(--bg-page);
  border-radius: var(--radius-md); cursor: pointer;
  transition: all .2s var(--ease-out);
  border: 2px solid transparent; position: relative;
}
.output-card:hover {
  background: var(--bg-card); transform: translateX(3px);
  box-shadow: var(--shadow-card);
}
.output-card.active {
  background: var(--accent-light); border-color: var(--accent);
  box-shadow: 0 0 0 5px var(--accent-ring);
}
.output-card .oc-icon {
  width: 38px; height: 38px; border-radius: var(--radius-sm);
  display: grid; place-items: center; flex-shrink: 0;
  background: linear-gradient(135deg, var(--bg-card), var(--bg-page));
  color: var(--text-secondary); border: 1px solid var(--border);
}
.output-card.active .oc-icon { background: #fff; color: var(--accent); border-color: var(--accent); }
.output-card .oc-info { flex: 1; min-width: 0; }
.output-card .oc-name { font-size: 13.5px; font-weight: 650; color: var(--text-primary); }
.output-card .oc-summary {
  font-size: 11.5px; color: var(--text-muted); margin-top: 2px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.output-card .oc-badge {
  font-size: 10px; padding: 2px 9px; border-radius: var(--radius-chip);
  background: var(--accent-light); color: var(--accent); font-weight: 600;
}
.oc-act {
  width: 30px; height: 30px; border: none; border-radius: var(--radius-sm);
  background: transparent; color: var(--text-muted); cursor: pointer;
  display: grid; place-items: center; transition: all .15s var(--ease-out);
  opacity: 0;
}
.output-card:hover .oc-act { opacity: 1; }
.oc-act:hover { background: var(--bg-page); color: var(--text-primary); }
.oc-act.danger:hover { background: var(--danger-light); color: var(--danger); }

/* ===== 添加成果 ===== */
.add-output-bar {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 14px 16px; background: var(--bg-page);
  border: 1.5px dashed var(--border); border-radius: var(--radius-md);
  transition: all .18s var(--ease-out);
}
.add-output-bar:hover { border-color: #d5d0c9; background: var(--bg-card); }
.add-output-bar > span { font-size: 12px; color: var(--text-muted); font-weight: 600; }
.add-output-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 14px; border: 1.5px solid var(--border);
  border-radius: var(--radius-chip); background: var(--bg-card);
  font-size: 12px; color: var(--text-secondary); cursor: pointer;
  font-family: var(--font-sans); font-weight: 500;
  transition: all .18s var(--ease-out);
}
.add-output-btn:hover {
  border-color: var(--accent); color: var(--accent);
  background: var(--accent-light);
}
.add-output-btn:active { transform: scale(.95); }
.add-output-btn:disabled { opacity: .45; pointer-events: none; border-color: var(--border); color: var(--text-muted); background: var(--bg-card); }
.add-output-btn .plus { font-weight: 700; color: var(--accent); font-size: 14px; }
```

- [ ] **Step 2: 在 `#panel1` 中写入 Step 1 HTML 结构**

替换 `<div class="step-panel visible" id="panel1"></div>` 为：

```html
<div class="step-panel visible" id="panel1">
  <div class="step1-layout">
    <div class="step1-left">
      <!-- 任务名称 -->
      <div class="card">
        <div class="card-header">
          <div class="card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg></div>
          <span class="card-title">任务信息</span>
        </div>
        <div class="card-body">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:6px;">任务名称</label>
          <input class="input" id="taskName" value="平顶山市空气质量值守" placeholder="为任务起个辨识度高的名称">
        </div>
      </div>

      <!-- 成果清单 -->
      <div class="card" id="outputCard">
        <div class="card-header">
          <div class="card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div>
          <span class="card-title">成果清单</span>
          <span style="margin-left:auto;font-size:11px;color:var(--text-muted);" id="outputCount">1 项成果</span>
        </div>
        <div class="card-body">
          <div class="output-list" id="outputList"></div>
          <div style="margin-top:14px;">
            <div class="add-output-bar" id="addOutputBar">
              <span>添加成果</span>
              <button class="add-output-btn" onclick="addOutput('mapPackage')"><span class="plus">+</span> 一张图</button>
              <button class="add-output-btn" onclick="addOutput('concentrationRanking')"><span class="plus">+</span> 浓度排名</button>
              <button class="add-output-btn" onclick="addOutput('hourlyBrief')"><span class="plus">+</span> 小时播报</button>
              <button class="add-output-btn" onclick="addOutput('monitoringData')"><span class="plus">+</span> 监测数据</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 配置区（内联展开） -->
      <div id="configArea"></div>
    </div>

    <!-- 右侧实时预览 -->
    <div class="step1-right" id="livePreviewCol">
      <div class="live-preview-card card">
        <div class="card-header">
          <div class="card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
          <span class="card-title">任务预览</span>
        </div>
        <div class="card-body" id="livePreviewBody"></div>
      </div>
    </div>
  </div>

  <!-- 底部操作栏 -->
  <div class="footer-bar">
    <span></span>
    <div class="footer-right">
      <a class="btn btn-secondary" href="duty-tasks.html">取消</a>
      <button class="btn btn-primary" onclick="goStep(2)">下一步 <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button>
    </div>
  </div>
</div>
```

同时在 `<style>` 中添加预览卡片样式：

```css
/* ===== 实时预览 ===== */
.step1-right { position: sticky; top: 16px; }
.live-preview-card .card-body { display: flex; flex-direction: column; gap: 12px; font-size: 13px; }
.live-preview-card .lp-item { display: flex; align-items: center; gap: 10px; }
.live-preview-card .lp-icon {
  width: 28px; height: 28px; border-radius: var(--radius-sm);
  background: var(--accent-light); display: grid; place-items: center;
  color: var(--accent); flex-shrink: 0;
}
.live-preview-card .lp-icon svg { width: 14px; height: 14px; }
.live-preview-card .lp-text { font-size: 12.5px; color: var(--text-secondary); }
.live-preview-card .mini-flow {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; color: var(--text-muted); margin-top: 6px; padding-top: 10px;
  border-top: 1px solid var(--border-light);
}
.mini-flow span { padding: 4px 10px; background: var(--bg-page); border-radius: var(--radius-sm); }
.mini-flow i { color: var(--border); }
```

- [ ] **Step 3: 在 `<script>` 中添加成果数据模型和渲染函数**

在 `showToast` / `goStep` 之后追加：

```javascript
// ===== 成果类型定义 =====
const CAPS = {
  mapPackage: {
    mono: '◇', name: '一张图',
    desc: '空气质量空间分布地图截图',
    def: '全国 · 监测图 · 首要污染物',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>'
  },
  concentrationRanking: {
    mono: '≋', name: '浓度排名',
    desc: '城市/站点污染物浓度排名榜单截图',
    def: '城市排名 · 平顶山市 · PM₂.₅/O₃/AQI',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>'
  },
  hourlyBrief: {
    mono: '◷', name: '小时播报',
    desc: '按小时自动生成空气质量通报截图',
    def: '城市 · 平顶山市 · 页面截图',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>'
  },
  monitoringData: {
    mono: '▦', name: '监测数据',
    desc: '原始监测数据报表截图',
    def: '城市 · 平顶山市 · 小时',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>'
  }
};

let outputs = [], seq = 0, activeId = null;

function initOutputs() {
  const p = new URLSearchParams(location.search);
  const caps = p.get('caps');
  if (p.get('edit')) {
    outputs = [{ id: 'o' + (++seq), type: 'concentrationRanking' }, { id: 'o' + (++seq), type: 'mapPackage' }];
    document.getElementById('taskName').value = '平阴县每日城市排名分析任务';
  } else if (caps) {
    const keys = caps.split(',').filter(k => CAPS[k]);
    outputs = (keys.length ? keys : ['concentrationRanking']).map(k => ({ id: 'o' + (++seq), type: k }));
  } else {
    outputs = [{ id: 'o' + (++seq), type: 'concentrationRanking' }];
  }
  activeId = outputs[0].id;
}

function renderOutputs() {
  document.getElementById('outputList').innerHTML = outputs.map((o, i) => {
    const c = CAPS[o.type];
    return `<div class="output-card${activeId === o.id ? ' active' : ''}" onclick="selectOutput('${o.id}')">
      <div class="oc-icon">${c.icon}</div>
      <div class="oc-info">
        <div class="oc-name">${c.name}</div>
        <div class="oc-summary">${c.def}</div>
      </div>
      ${activeId === o.id ? '<span class="oc-badge">编辑中</span>' : ''}
      <button class="oc-act" onclick="event.stopPropagation();dupOutput('${o.id}')" title="复制">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>
      <button class="oc-act danger" onclick="event.stopPropagation();delOutput('${o.id}')" title="删除">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`;
  }).join('');
  document.getElementById('outputCount').textContent = outputs.length + ' 项成果';
  updateAddButtons();
  updateLivePreview();
}

function updateAddButtons() {
  const types = outputs.map(o => o.type);
  document.querySelectorAll('.add-output-btn').forEach(btn => {
    btn.disabled = types.includes(btn.textContent.replace('+ ', '').trim().replace('一张图','mapPackage').replace('浓度排名','concentrationRanking').replace('小时播报','hourlyBrief').replace('监测数据','monitoringData'));
  });
}

function addOutput(type) {
  if (outputs.some(o => o.type === type)) return;
  outputs.push({ id: 'o' + (++seq), type });
  activeId = outputs[outputs.length - 1].id;
  renderOutputs();
}

function selectOutput(id) { activeId = id; renderOutputs(); }

function dupOutput(id) {
  const o = outputs.find(x => x.id === id);
  if (o) { outputs.push({ id: 'o' + (++seq), type: o.type }); renderOutputs(); }
}

function delOutput(id) {
  if (outputs.length <= 1) { showToast('至少保留一项成果'); return; }
  outputs = outputs.filter(x => x.id !== id);
  if (activeId === id) activeId = outputs[0].id;
  renderOutputs();
}

function updateLivePreview() {
  document.getElementById('livePreviewBody').innerHTML = outputs.map((o, i) => {
    const c = CAPS[o.type];
    return `<div class="lp-item">
      <div class="lp-icon">${c.icon}</div>
      <div class="lp-text"><b>${c.name}</b> · ${c.def}</div>
    </div>`;
  }).join('')
  + `<div class="mini-flow"><span>获取数据</span><i>→</i><span>生成 ${outputs.length} 项成果</span><i>→</i><span>统一推送</span></div>`;
}

// 启动
initOutputs();
renderOutputs();
```

同时需要修复 `updateAddButtons` 函数中的匹配逻辑，改为更可靠的方式。用 data 属性：

给每个添加按钮加 `data-cap-type` 属性，在 Step 2 的 HTML 中改为：

```html
<button class="add-output-btn" onclick="addOutput('mapPackage')" data-cap-type="mapPackage"><span class="plus">+</span> 一张图</button>
<button class="add-output-btn" onclick="addOutput('concentrationRanking')" data-cap-type="concentrationRanking"><span class="plus">+</span> 浓度排名</button>
<button class="add-output-btn" onclick="addOutput('hourlyBrief')" data-cap-type="hourlyBrief"><span class="plus">+</span> 小时播报</button>
<button class="add-output-btn" onclick="addOutput('monitoringData')" data-cap-type="monitoringData"><span class="plus">+</span> 监测数据</button>
```

然后 `updateAddButtons`：

```javascript
function updateAddButtons() {
  const types = outputs.map(o => o.type);
  document.querySelectorAll('.add-output-btn').forEach(btn => {
    btn.disabled = types.includes(btn.dataset.capType);
  });
}
```

- [ ] **Step 4: 在浏览器中验证 Step 1 左侧区域**

打开 `docs/duty-create.html`，确认：
- 任务名称输入框显示且可编辑
- 成果清单显示 1 项"浓度排名"
- 点击添加成果按钮可以添加新成果
- 选中某成果后高亮
- 复制/删除按钮在 hover 时出现
- 已添加的类型按钮变灰（disabled）
- 右侧预览卡片同步更新

- [ ] **Step 5: 提交**

```bash
git add docs/duty-create.html
git commit -m "feat: duty-create 重设计 - Task 2 Step1 左侧成果列表区"
```

---

### Task 3: Step 1 - 内联配置表单（4 种成果类型）

**Files:**
- Modify: `docs/duty-create.html`

**Interfaces:**
- Consumes: `CAPS` 对象（含 `configs` 数组）、`outputs`/`activeId`、`.config-area` 容器
- Produces: `renderConfig()` 函数、`.cfg-card`、`.segmented`、`.chips`、`.config-summary` 样式；`seg()`, `chip()`, `ck()`, `segMon()` helper 函数

- [ ] **Step 1: 在 `<style>` 中添加配置区样式**

```css
/* ===== 内联配置区 ===== */
.config-area { margin-top: 4px; }
.cfg-card {
  background: var(--bg-card); border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card); overflow: hidden;
  border: 1px solid var(--border-light);
  animation: cfgExpand .3s var(--ease-out);
}
@keyframes cfgExpand { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
.cfg-card-head {
  padding: 14px 22px; background: linear-gradient(180deg, var(--accent-light), #fff);
  border-bottom: 1px solid var(--border-light);
  font-size: 13px; font-weight: 650; color: var(--accent);
  display: flex; align-items: center; gap: 8px;
}
.cfg-card-head .cfg-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-ring);
}
.cfg-card-body { padding: 18px 22px; display: flex; flex-direction: column; gap: 14px; }

.cfg-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.cfg-row > span { font-size: 12px; color: var(--text-secondary); min-width: 60px; }
.cfg-row .hint { font-size: 11px; color: var(--text-muted); margin-left: 4px; }

/* segmented control */
.segmented {
  display: inline-flex; border: 1.5px solid var(--border);
  border-radius: var(--radius-sm); overflow: hidden; background: var(--bg-page);
}
.segmented button {
  border: none; background: transparent; padding: 6px 12px;
  font-size: 11.5px; color: var(--text-secondary); cursor: pointer;
  font-family: var(--font-sans); font-weight: 500;
  border-right: 1px solid var(--border); transition: all .15s var(--ease-out);
}
.segmented button:last-child { border-right: none; }
.segmented button:hover { background: rgba(0,0,0,.02); color: var(--text-primary); }
.segmented button.active { background: var(--accent); color: #fff; border-color: var(--accent); }

/* chips */
.chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chip-tag {
  padding: 5px 12px; border: 1.5px solid var(--border); border-radius: var(--radius-chip);
  background: var(--bg-card); font-size: 11.5px; color: var(--text-secondary); cursor: pointer;
  transition: all .15s var(--ease-out); user-select: none; font-family: var(--font-sans);
}
.chip-tag:hover { border-color: var(--accent); color: var(--accent); }
.chip-tag:active { transform: scale(.95); }
.chip-tag.active {
  border-color: var(--accent); background: var(--accent); color: #fff; font-weight: 600;
}

.config-summary {
  font-size: 12px; color: var(--text-secondary);
  background: var(--bg-page); border-radius: var(--radius-sm);
  padding: 11px 14px; line-height: 1.7;
  border: 1px solid var(--border-light);
}

/* select */
.select-n {
  padding: 8px 32px 8px 12px; border: 1.5px solid var(--border);
  border-radius: var(--radius-sm); font-size: 12.5px; font-family: var(--font-sans);
  outline: none; background: var(--bg-card); color: var(--text-primary); cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%239b9894' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 10px center;
  transition: all .18s var(--ease-out);
}
.select-n:hover { border-color: #d5d0c9; }
.select-n:focus { border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-ring); }

/* toggle/checkbox */
.toggle-row { display: flex; align-items: center; gap: 14px; }
.toggle-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary); cursor: pointer; user-select: none; }
.toggle-box {
  width: 17px; height: 17px; border-radius: 4px;
  border: 2px solid var(--border); display: grid; place-items: center;
  background: var(--bg-card); transition: all .18s var(--ease-out); flex-shrink: 0;
}
.toggle-box.on { border-color: var(--accent); background: var(--accent); }
.toggle-box svg { width: 11px; height: 11px; color: #fff; opacity: 0; transition: opacity .15s; }
.toggle-box.on svg { opacity: 1; }
```

- [ ] **Step 2: 扩展 CAPS 配置定义和 renderConfig 函数**

在 `<script>` 中为每个 CAPS 类型增加 `configs` 数组，并实现 `renderConfig()`：

```javascript
// 扩展 CAPS（在现有定义的基础上增加 configs）
CAPS.mapPackage.configs = [
  { key: 'scope', label: '地图范围', type: 'segmented', opts: ['全国', '河南省', '平顶山市'], val: '全国' },
  { key: 'timeType', label: '时间类型', type: 'segmented', opts: ['实时', '累计', '日'], val: '实时' },
  { key: 'mapType', label: '地图类型', type: 'segmented', opts: ['监测图', '插值图'], val: '监测图' },
  { key: 'factor', label: '污染因子', type: 'select', opts: ['首要污染物', 'PM₂.₅', 'PM₁₀', 'SO₂', 'NO₂', 'CO', 'O₃', 'AQI'], val: '首要污染物' },
  { key: 'color', label: '配色', type: 'segmented', opts: ['浅色', '深色'], val: '浅色' },
  { key: 'overlays', label: '叠加图层', type: 'toggles', items: [{ key: 'wind', label: '风/海浪', on: true }, { key: 'panel', label: '左侧面板', on: true }] }
];
CAPS.mapPackage.summary = function(cfg) {
  return (cfg.scope || '全国') + ' · ' + (cfg.mapType || '监测图') + ' · ' + (cfg.factor || '首要污染物') + ' · ' + (cfg.color || '浅色');
};

CAPS.concentrationRanking.configs = [
  { key: 'color', label: '截图颜色', type: 'segmented', opts: ['浅色', '深色'], val: '浅色' },
  { key: 'scope', label: '查询范围', type: 'segmented', opts: ['城市', '站点'], val: '城市' },
  { key: 'region', label: '行政区', type: 'input', val: '平顶山市', placeholder: '输入行政区名称' },
  { key: 'timeType', label: '时间类型', type: 'segmented', opts: ['实时', '日累计', '日', '月', '年', '自定义'], val: '实时' },
  { key: 'factors', label: '污染因子', type: 'chips', opts: ['PM₂.₅', 'PM₁₀', 'SO₂', 'NO₂', 'CO', 'O₃', 'AQI'], val: ['PM₂.₅', 'O₃', 'AQI'] },
  { key: 'standard', label: '国标类型', type: 'segmented', opts: ['新', '默认', '旧'], val: '默认' }
];
CAPS.concentrationRanking.summary = function(cfg) {
  return (cfg.scope || '城市') + '排名 · ' + (cfg.region || '平顶山市') + ' · ' + (cfg.timeType || '实时') + ' · ' + (cfg.factors || ['PM₂.₅', 'O₃', 'AQI']).join('、');
};

CAPS.hourlyBrief.configs = [
  { key: 'color', label: '截图颜色', type: 'segmented', opts: ['浅色', '深色'], val: '浅色' },
  { key: 'scope', label: '查询范围', type: 'segmented', opts: ['城市', '站点'], val: '城市' },
  { key: 'region', label: '行政区', type: 'input', val: '平顶山市', placeholder: '输入行政区名称' },
  { key: 'factors', label: '污染因子', type: 'chips', opts: ['AQI', 'PM₂.₅', 'O₃', 'PM₁₀', 'SO₂', 'NO₂', 'CO'], val: ['AQI', 'PM₂.₅', 'O₃'] },
  { key: 'standard', label: '国标类型', type: 'segmented', opts: ['新', '默认', '旧'], val: '默认' }
];
CAPS.hourlyBrief.summary = function(cfg) {
  return '城市 · ' + (cfg.region || '平顶山市') + ' · ' + (cfg.factors || ['AQI', 'PM₂.₅', 'O₃']).join('、');
};

CAPS.monitoringData.configs = [
  { key: 'color', label: '截图颜色', type: 'segmented', opts: ['浅色', '深色'], val: '浅色' },
  { key: 'scope', label: '查询范围', type: 'segmented', opts: ['城市', '站点'], val: '城市' },
  { key: 'region', label: '行政区', type: 'input', val: '平顶山市', placeholder: '输入行政区名称' },
  { key: 'factors', label: '污染因子', type: 'chips', opts: ['AQI', 'PM₂.₅', 'O₃', 'PM₁₀', 'SO₂', 'NO₂', 'CO'], val: ['AQI', 'PM₂.₅', 'O₃'] },
  { key: 'standard', label: '国标类型', type: 'segmented', opts: ['新', '默认', '旧'], val: '默认' },
  { key: 'timeGran', label: '时间粒度', type: 'segmented', opts: ['小时均值', '小时', '逐日累计', '日累计', '自定义'], val: '小时' }
];
CAPS.monitoringData.summary = function(cfg) {
  return '城市 · ' + (cfg.region || '平顶山市') + ' · ' + (cfg.timeGran || '小时') + ' · ' + (cfg.factors || ['AQI', 'PM₂.₅', 'O₃']).join('、');
};

// 为每个 output 维护 cfg 对象
function getCfg(o) {
  if (!o.cfg) o.cfg = {};
  return o.cfg;
}

function renderConfig() {
  const area = document.getElementById('configArea');
  const active = outputs.find(o => o.id === activeId);
  if (!active) { area.innerHTML = ''; return; }
  const cap = CAPS[active.type];
  const cfg = getCfg(active);

  // 初始化默认值
  if (cap.configs) {
    cap.configs.forEach(c => {
      if (c.key && cfg[c.key] === undefined) {
        cfg[c.key] = c.val !== undefined ? c.val : (c.opts ? c.opts[0] : undefined);
      }
      if (c.key && cfg[c.key] === undefined && c.items) {
        cfg[c.key] = {};
        c.items.forEach(it => { cfg[c.key][it.key] = it.on !== false; });
      }
      if (c.type === 'toggles' && !cfg[c.key]) {
        cfg[c.key] = {};
        c.items.forEach(it => { cfg[c.key][it.key] = it.on !== false; });
      }
    });
  }

  if (!cap.configs) { area.innerHTML = ''; return; }

  let rows = cap.configs.map((c, ci) => {
    if (c.type === 'segmented') {
      return `<div class="cfg-row"><span>${c.label}</span><div class="segmented">${c.opts.map(o =>
        `<button class="${cfg[c.key] === o ? 'active' : ''}" data-ci="${ci}" data-val="${o}">${o}</button>`
      ).join('')}</div></div>`;
    }
    if (c.type === 'select') {
      return `<div class="cfg-row"><span>${c.label}</span><select class="select-n" data-ci="${ci}" data-key="${c.key}" style="width:160px">${c.opts.map(o =>
        `<option ${cfg[c.key] === o ? 'selected' : ''}>${o}</option>`
      ).join('')}</select></div>`;
    }
    if (c.type === 'input') {
      return `<div class="cfg-row"><span>${c.label}</span><input class="input" data-ci="${ci}" data-key="${c.key}" value="${cfg[c.key] || ''}" placeholder="${c.placeholder || ''}" style="max-width:260px"></div>`;
    }
    if (c.type === 'chips') {
      const vals = cfg[c.key] || [];
      return `<div class="cfg-row"><span>${c.label}</span><div class="chips">${c.opts.map(o =>
        `<span class="chip-tag${vals.includes(o) ? ' active' : ''}" data-ci="${ci}" data-val="${o}">${o}</span>`
      ).join('')}</div></div>`;
    }
    if (c.type === 'toggles') {
      const toggles = cfg[c.key] || {};
      return `<div class="cfg-row"><span>${c.label}</span><div class="toggle-row">${c.items.map(it =>
        `<label class="toggle-item"><span class="toggle-box${toggles[it.key] ? ' on' : ''}" data-ci="${ci}" data-tkey="${it.key}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg></span>${it.label}</label>`
      ).join('')}</div></div>`;
    }
    return '';
  }).join('');

  const summary = cap.summary ? cap.summary(cfg) : cap.def;

  area.innerHTML = `<div class="cfg-card">
    <div class="cfg-card-head"><span class="cfg-dot"></span>配置${cap.name}</div>
    <div class="cfg-card-body">${rows}</div>
    <div style="padding:0 22px 16px;">
      <div class="config-summary">本次成果：${summary}</div>
    </div>
  </div>`;

  // 绑定事件
  area.querySelectorAll('.segmented button').forEach(btn => {
    btn.addEventListener('click', function() {
      const ci = parseInt(this.dataset.ci), val = this.dataset.val;
      cfg[cap.configs[ci].key] = val;
      this.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      renderConfig();
      renderOutputs();
    });
  });
  area.querySelectorAll('.select-n').forEach(sel => {
    sel.addEventListener('change', function() {
      const ci = parseInt(this.dataset.ci);
      cfg[cap.configs[ci].key] = this.value;
      renderConfig();
      renderOutputs();
    });
  });
  area.querySelectorAll('.input').forEach(inp => {
    inp.addEventListener('input', function() {
      const ci = parseInt(this.dataset.ci);
      cfg[cap.configs[ci].key] = this.value;
      renderConfig();
      renderOutputs();
    });
  });
  area.querySelectorAll('.chip-tag').forEach(chip => {
    chip.addEventListener('click', function() {
      const ci = parseInt(this.dataset.ci), val = this.dataset.val;
      const arr = cfg[cap.configs[ci].key];
      const idx = arr.indexOf(val);
      if (idx >= 0) arr.splice(idx, 1); else arr.push(val);
      this.classList.toggle('active');
      renderConfig();
      renderOutputs();
    });
  });
  area.querySelectorAll('.toggle-box').forEach(box => {
    box.addEventListener('click', function() {
      const ci = parseInt(this.dataset.ci), tkey = this.dataset.tkey;
      cfg[cap.configs[ci].key][tkey] = !cfg[cap.configs[ci].key][tkey];
      this.classList.toggle('on');
      renderConfig();
      renderOutputs();
    });
  });
}
```

- [ ] **Step 3: 更新 renderOutputs 中的摘要显示**

修改 `renderOutputs` 中摘要部分，优先使用 `summary()`：

```javascript
// 将 .oc-summary 中的 ${c.def} 改为：
${(c.summary ? c.summary(getCfg(o)) : c.def)}
```

- [ ] **Step 4: 更新 selectOutput 触发 renderConfig**

```javascript
function selectOutput(id) {
  activeId = id;
  renderOutputs();
  renderConfig();
}
```

同样，`addOutput` 也需要调用 `renderConfig()`：

```javascript
function addOutput(type) {
  if (outputs.some(o => o.type === type)) return;
  outputs.push({ id: 'o' + (++seq), type });
  activeId = outputs[outputs.length - 1].id;
  renderOutputs();
  renderConfig();
}
```

- [ ] **Step 5: 在浏览器中验证配置表单**

打开文件，确认：
- 选中浓度排名成果时，下方展开配置卡片
- 分段控件可切换，chip 可多选
- 切换配置项后摘要行实时更新
- 切换到一张图等其他成果类型时，配置表单随之变化
- 配置修改后右侧预览同步更新

- [ ] **Step 6: 提交**

```bash
git add docs/duty-create.html
git commit -m "feat: duty-create 重设计 - Task 3 Step1 内联配置表单"
```

---

### Task 4: Step 2 - 调度选择器 + 交付设置

**Files:**
- Modify: `docs/duty-create.html`

**Interfaces:**
- Consumes: 现有 CSS 变量、`#panel2` 容器、`outputs` 数据
- Produces: `.delivery-grid`、`.sched-pills`、`.sched-detail`、`.channel-pills`、`.advanced-toggle` 样式 + HTML；`schedPick()`, `pickChannel()`, `toggleAdvanced()`, `syncStep2()` 函数

- [ ] **Step 1: 添加 Step 2 样式**

```css
/* ===== Step 2 ===== */
.delivery-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }

/* 调度 Pill 选择 */
.sched-pills { display: flex; gap: 6px; flex-wrap: wrap; }
.sched-pill {
  padding: 8px 16px; border: 1.5px solid var(--border);
  border-radius: var(--radius-chip); background: var(--bg-card);
  font-size: 13px; color: var(--text-secondary); cursor: pointer;
  font-family: var(--font-sans); font-weight: 500;
  transition: all .18s var(--ease-out);
  display: flex; align-items: center; gap: 6px;
}
.sched-pill:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }
.sched-pill.active { border-color: var(--accent); background: var(--accent); color: #fff; font-weight: 600; }
.sched-pill svg { width: 14px; height: 14px; }

/* 调度详情 */
.sched-detail-card {
  background: var(--bg-page); border-radius: var(--radius-md);
  padding: 20px; margin-top: 16px;
  border: 1px solid var(--border-light);
}
.sched-time-big { font-size: 28px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; }
.sched-time-big strong { color: var(--accent); }
.sched-hint { font-size: 12px; color: var(--text-muted); }
.sched-detail-row { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
.sched-detail-row > span { font-size: 12px; color: var(--text-secondary); min-width: 56px; }
.sched-num-input { width: 72px; padding: 8px 10px; border: 1.5px solid var(--border); border-radius: var(--radius-sm); text-align: center; font-size: 13.5px; font-family: var(--font-mono); outline: none; transition: all .18s var(--ease-out); }
.sched-num-input:focus { border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-ring); }

/* 推送渠道 pill */
.channel-pills { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.channel-pill {
  padding: 8px 16px; border: 1.5px solid var(--border);
  border-radius: var(--radius-chip); background: var(--bg-card);
  font-size: 13px; color: var(--text-secondary); cursor: pointer;
  font-family: var(--font-sans); font-weight: 500;
  transition: all .18s var(--ease-out);
  display: flex; align-items: center; gap: 6px;
}
.channel-pill:hover { border-color: var(--accent); color: var(--accent); }
.channel-pill.active { border-color: var(--accent); background: var(--accent); color: #fff; font-weight: 600; }
.channel-pill svg { width: 14px; height: 14px; }
.channel-more { font-size: 12px; color: var(--accent); margin-left: auto; cursor: pointer; font-weight: 500; }
.channel-more:hover { text-decoration: underline; }

/* 高级选项折叠 */
.advanced-toggle {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 0; font-size: 12px; color: var(--text-muted); cursor: pointer;
  font-weight: 500; user-select: none; transition: color .15s;
}
.advanced-toggle:hover { color: var(--accent); }
.advanced-toggle svg { width: 13px; height: 13px; transition: transform .25s var(--ease-out); }
.advanced-toggle.open svg { transform: rotate(90deg); }
.advanced-panel { overflow: hidden; max-height: 0; transition: max-height .35s var(--ease-out), opacity .25s var(--ease-out); opacity: 0; }
.advanced-panel.open { max-height: 300px; opacity: 1; }

/* 交付摘要 */
.delivery-summary {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 18px; background: var(--bg-page);
  border-radius: var(--radius-md); font-size: 13px;
  color: var(--text-secondary);
  border: 1px solid var(--border-light);
}
.delivery-summary strong { color: var(--accent); }
.delivery-summary svg { width: 16px; height: 16px; color: var(--accent); flex-shrink: 0; }
```

- [ ] **Step 2: 在 `#panel2` 中写入 HTML**

```html
<div class="step-panel" id="panel2">
  <div class="delivery-grid">

    <!-- 运行时间 -->
    <div class="card">
      <div class="card-header">
        <div class="card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
        <span class="card-title">运行时间</span>
        <span style="font-size:11px;color:var(--danger);">*</span>
      </div>
      <div class="card-body">
        <div class="sched-pills">
          <button class="sched-pill" data-cat="interval" onclick="schedPick('interval')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>按间隔</button>
          <button class="sched-pill" data-cat="hourly" onclick="schedPick('hourly')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>每小时</button>
          <button class="sched-pill active" data-cat="daily" onclick="schedPick('daily')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>每天</button>
          <button class="sched-pill" data-cat="weekly" onclick="schedPick('weekly')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/></svg>每周</button>
          <button class="sched-pill" data-cat="monthly" onclick="schedPick('monthly')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>每月</button>
          <button class="sched-pill" data-cat="custom" onclick="schedPick('custom')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>自定义</button>
        </div>
        <div id="schedDetail"></div>
        <div class="sched-detail-card">
          <div class="sched-time-big" id="schedTimeBig">每天 <strong>09:00</strong></div>
          <div class="sched-hint" id="schedHint">北京时间 · 预计下次执行 2026-07-30 09:00</div>
        </div>
      </div>
    </div>

    <!-- 推送渠道 -->
    <div class="card">
      <div class="card-header">
        <div class="card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></div>
        <span class="card-title">成果发送到</span>
        <span style="font-size:11px;color:var(--danger);">*</span>
      </div>
      <div class="card-body">
        <div style="display:flex;align-items:center;">
          <div class="channel-pills" id="channelPills">
            <button class="channel-pill active" data-ch="local" onclick="pickChannel('local')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>本地</button>
            <button class="channel-pill" data-ch="wecom" onclick="pickChannel('wecom')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>企业微信</button>
            <button class="channel-pill" data-ch="dingtalk" onclick="pickChannel('dingtalk')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>钉钉</button>
            <button class="channel-pill" data-ch="feishu" onclick="pickChannel('feishu')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>飞书</button>
          </div>
          <a class="channel-more" onclick="showToast('前往频道配置')">需要更多渠道？前往配置 →</a>
        </div>
      </div>
    </div>

    <!-- 高级选项 -->
    <div>
      <div class="advanced-toggle" id="advToggle" onclick="toggleAdvanced()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        高级选项（保存位置、运行模型）
      </div>
      <div class="advanced-panel" id="advPanel">
        <div class="delivery-grid" style="margin-top:12px;">
          <div class="card">
            <div class="card-header">
              <div class="card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg></div>
              <span class="card-title">成果保存位置</span>
              <span style="font-size:11px;color:var(--text-muted);">可选</span>
            </div>
            <div class="card-body">
              <div style="display:flex;gap:8px;">
                <input class="input" placeholder="留空则不保存到本地文件夹" style="flex:1;">
                <button class="btn btn-secondary" onclick="showToast('选择文件夹')">浏览</button>
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-header">
              <div class="card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.5a2.5 2.5 0 0 0-4.96-.46 2.5 2.5 0 0 0-1.98 3 2.5 2.5 0 0 0-1.32 4.3 2.5 2.5 0 0 0 1.83 5.66h13.42a2.5 2.5 0 0 0 1.38-4.67 2.5 2.5 0 0 0-1.52-2.86 2.5 2.5 0 0 0-4.41-2.3A2.5 2.5 0 0 0 12 4.5Z"/></svg></div>
              <span class="card-title">运行模型</span>
              <span style="font-size:11px;color:var(--text-muted);">可选</span>
            </div>
            <div class="card-body">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <select class="select-n"><option>默认（跟随全局设置）</option><option>OpenAI</option><option>Anthropic</option></select>
                <select class="select-n"><option>默认模型</option></select>
              </div>
              <div style="margin-top:6px;font-size:11px;color:var(--text-muted);">不选则使用全局默认模型。</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 交付摘要 -->
    <div class="delivery-summary">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      本次任务将交付 <strong id="dnCount">1</strong> 项成果：<span id="dnList" style="color:var(--text-secondary);">浓度排名</span>
    </div>

  </div>

  <!-- 底部操作栏 -->
  <div class="footer-bar">
    <button class="btn btn-ghost" onclick="goStep(1)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>上一步</button>
    <div class="footer-right">
      <a class="btn btn-secondary" href="duty-tasks.html">取消</a>
      <button class="btn btn-primary" onclick="goStep(3)">下一步 <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button>
    </div>
  </div>
</div>
```

- [ ] **Step 3: 添加 schedPick 和其他交互函数**

```javascript
// ===== 调度 =====
let schedMode = 'daily';

function schedPick(cat) {
  schedMode = cat;
  document.querySelectorAll('.sched-pill').forEach(p => p.classList.toggle('active', p.dataset.cat === cat));
  renderSchedDetail();
}

function renderSchedDetail() {
  const detail = document.getElementById('schedDetail');
  const timeBig = document.getElementById('schedTimeBig');
  const hint = document.getElementById('schedHint');

  switch (schedMode) {
    case 'interval':
      detail.innerHTML = `<div class="sched-detail-row"><span>常用间隔</span><div class="chips">
        ${['5分钟','10分钟','15分钟','30分钟','1小时','2小时','3小时','6小时','12小时','24小时'].map(t =>
          `<span class="chip-tag ${t === '5分钟' ? 'active' : ''}" onclick="schedPickInterval('${t}')">${t}</span>`
        ).join('')}
      </div></div>`;
      timeBig.innerHTML = '每 <strong>5 分钟</strong> 执行一次';
      hint.textContent = '从任务启动时刻开始计时';
      break;
    case 'hourly':
      detail.innerHTML = `<div class="sched-detail-row"><span>执行分钟</span><select class="select-n" onchange="document.getElementById('schedTimeBig').innerHTML='每小时第 <strong>' + this.value + '</strong> 分执行'"><option>00</option><option>05</option><option>10</option><option>15</option><option>30</option><option>45</option></select><span style="font-size:12px;color:var(--text-muted);">分</span></div>`;
      timeBig.innerHTML = '每小时第 <strong>00</strong> 分执行';
      hint.textContent = '北京时间 · 每小时整点过后执行';
      break;
    case 'daily':
      detail.innerHTML = '';
      timeBig.innerHTML = '每天 <strong>09:00</strong>';
      hint.textContent = '北京时间 · 预计下次执行 2026-07-30 09:00';
      break;
    case 'weekly':
      detail.innerHTML = `<div style="margin-top:8px;"><span style="font-size:12px;color:var(--text-secondary);">选择星期</span></div><div class="chips" style="margin-top:6px;">${['周一','周二','周三','周四','周五','周六','周日'].map(d => `<span class="chip-tag ${d === '周一' ? 'active' : ''}" onclick="this.classList.toggle('active')">${d}</span>`).join('')}</div>`;
      timeBig.innerHTML = '每周一 <strong>09:00</strong>';
      hint.textContent = '北京时间 · 预计下次执行 2026-08-03 09:00';
      break;
    case 'monthly':
      detail.innerHTML = `<div class="sched-detail-row"><span>每月</span><select class="select-n" style="width:100px" onchange="document.getElementById('schedTimeBig').innerHTML='每月 ' + this.value + ' 号 <strong>09:00</strong>'"><option>1 号</option><option>15 号</option><option>28 号</option></select></div>`;
      timeBig.innerHTML = '每月 <strong>1 号</strong> 09:00';
      hint.textContent = '北京时间 · 预计下次执行 2026-08-01 09:00';
      break;
    case 'custom':
      detail.innerHTML = `<div class="sched-detail-row"><span>Cron 表达式</span><input class="input" value="0 9 * * *" style="max-width:200px;font-family:var(--font-mono);font-size:13px;"></div>
        <div style="margin-top:8px;font-size:11px;color:var(--text-muted);line-height:1.8;">
          <div>格式: 分 时 日 月 周</div>
          <div>每 5 分钟: <code style="background:var(--bg-page);padding:1px 6px;border-radius:3px;">*/5 * * * *</code></div>
          <div>每天 9 点: <code style="background:var(--bg-page);padding:1px 6px;border-radius:3px;">0 9 * * *</code></div>
        </div>`;
      timeBig.innerHTML = '自定义 Cron <strong>表达式</strong>';
      hint.textContent = '使用标准 5 位 cron 表达式';
      break;
  }
}

function schedPickInterval(val) {
  document.querySelectorAll('#schedDetail .chip-tag').forEach(c => c.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('schedTimeBig').innerHTML = '每 <strong>' + val + '</strong> 执行一次';
}

// ===== 推送渠道 =====
let selectedChannel = 'local';

function pickChannel(ch) {
  selectedChannel = ch;
  document.querySelectorAll('.channel-pill').forEach(p => p.classList.toggle('active', p.dataset.ch === ch));
}

// ===== 高级选项折叠 =====
function toggleAdvanced() {
  document.getElementById('advToggle').classList.toggle('open');
  document.getElementById('advPanel').classList.toggle('open');
}

// ===== Step 2 同步 =====
function syncStep2() {
  document.getElementById('dnCount').textContent = outputs.length;
  document.getElementById('dnList').innerHTML = outputs.map(o => {
    const c = CAPS[o.type];
    return c.name + (c.summary ? ' · ' + c.summary(getCfg(o)) : '');
  }).join('、');
}
```

- [ ] **Step 4: 更新 goStep 函数触发 syncStep2**

```javascript
function goStep(s) {
  curStep = s;
  for (let i = 1; i <= 3; i++) document.getElementById('panel' + i).classList.toggle('visible', i === s);
  document.querySelectorAll('.step-node').forEach((el, idx) => {
    const st = idx + 1;
    el.classList.toggle('active', st === s);
    el.classList.toggle('done', st < s);
  });
  document.getElementById('line1').classList.toggle('done', 1 < s);
  document.getElementById('line2').classList.toggle('done', 2 < s);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (s === 2) syncStep2();
  if (s === 3) syncStep3();
}
```

- [ ] **Step 5: 在浏览器中验证 Step 2**

打开文件，点击"下一步"进入 Step 2，确认：
- 6 种调度模式 pill 可切换
- 每天/每小时/间隔等各模式预览卡片正确显示
- 推送渠道 pill 可选
- 高级选项折叠/展开动画正常
- 底部交付摘要显示成果数量和名称

- [ ] **Step 6: 提交**

```bash
git add docs/duty-create.html
git commit -m "feat: duty-create 重设计 - Task 4 Step2 调度 + 交付设置"
```

---

### Task 5: Step 3 - 确认任务

**Files:**
- Modify: `docs/duty-create.html`

**Interfaces:**
- Consumes: `outputs` 数据、`taskName` 值、`schedMode`、`selectedChannel`
- Produces: `.confirm-card`、`.confirm-hero`、`.confirm-body` 样式 + HTML；`syncStep3()`, `submitCreate()` 函数

- [ ] **Step 1: 添加 Step 3 样式**

```css
/* ===== Step 3 ===== */
.confirm-wrap { max-width: 640px; margin: 0 auto; }
.confirm-card { background: var(--bg-card); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); overflow: hidden; }
.confirm-hero {
  padding: 40px 28px 28px; text-align: center;
  background: linear-gradient(180deg, var(--accent-light), #fff);
  border-bottom: 1px solid var(--border-light);
}
.confirm-hero .check-circle {
  width: 56px; height: 56px; border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), #2ea55f);
  display: inline-flex; align-items: center; justify-content: center;
  margin-bottom: 16px;
  animation: popIn .5s var(--ease-spring);
  box-shadow: 0 4px 20px rgba(26,138,90,.25);
}
@keyframes popIn { 0% { transform: scale(0); opacity: 0; } 60% { transform: scale(1.2); } 100% { transform: scale(1); opacity: 1; } }
.confirm-hero svg.check-svg { width: 26px; height: 26px; color: #fff; }
.confirm-hero h3 { font-size: 19px; font-weight: 700; color: var(--text-primary); margin-top: 6px; }
.confirm-hero p { font-size: 13px; color: var(--text-muted); margin-top: 6px; }
.confirm-body { padding: 28px 32px; display: flex; flex-direction: column; gap: 22px; }
.confirm-section h4 { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 12px; }
.confirm-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border-light); font-size: 13px; }
.confirm-row:last-child { border-bottom: none; }
.confirm-row .cr-label { color: var(--text-muted); }
.confirm-row .cr-value { font-weight: 550; color: var(--text-primary); }
.confirm-outputs { display: flex; flex-direction: column; gap: 8px; }
.co-item {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; background: var(--bg-page);
  border-radius: var(--radius-sm); border: 1px solid var(--border-light); font-size: 13px;
}
.co-num {
  width: 24px; height: 24px; border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), #2ea55f);
  color: #fff; display: grid; place-items: center;
  font-size: 11px; font-weight: 700; flex-shrink: 0;
}
.co-info { flex: 1; }
.co-info strong { color: var(--text-primary); }
.co-info small { color: var(--text-muted); display: block; margin-top: 1px; }
.flow-chart { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 12.5px; }
.flow-step { padding: 9px 14px; background: var(--bg-page); border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-weight: 500; }
.flow-arrow { color: var(--text-muted); }
```

- [ ] **Step 2: 在 `#panel3` 中写入 HTML**

```html
<div class="step-panel" id="panel3">
  <div class="confirm-wrap">
    <div class="confirm-card">
      <div class="confirm-hero">
        <div class="check-circle"><svg class="check-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
        <h3>一切就绪，确认后系统将按计划自动执行</h3>
        <p>检查以下信息无误后点击创建</p>
      </div>
      <div class="confirm-body">
        <div class="confirm-section">
          <h4>任务信息</h4>
          <div class="confirm-row"><span class="cr-label">任务名称</span><span class="cr-value" id="cfName">平顶山市空气质量值守</span></div>
        </div>
        <div class="confirm-section">
          <h4>成果清单（<span id="cfCount">1</span> 项）</h4>
          <div class="confirm-outputs" id="cfList"></div>
        </div>
        <div class="confirm-section">
          <h4>运行与交付</h4>
          <div class="confirm-row"><span class="cr-label">执行频率</span><span class="cr-value" id="cfFreq">每天 09:00</span></div>
          <div class="confirm-row"><span class="cr-label">推送渠道</span><span class="cr-value" id="cfChannel">本地</span></div>
        </div>
        <div class="confirm-section">
          <h4>执行流程</h4>
          <div class="flow-chart">
            <span class="flow-step">获取发布数据</span><span class="flow-arrow">→</span>
            <span class="flow-step">依次生成 <b id="cfPlanCount">1</b> 项成果</span><span class="flow-arrow">→</span>
            <span class="flow-step">统一发送给值守人员</span>
          </div>
        </div>
      </div>
    </div>

    <div class="footer-bar">
      <button class="btn btn-ghost" onclick="goStep(2)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><polyline points="15 18 9 12 15 6"/></svg>上一步</button>
      <div class="footer-right">
        <a class="btn btn-secondary" href="duty-tasks.html">取消</a>
        <button class="btn btn-primary" onclick="submitCreate()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>创建任务</button>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 3: 添加 syncStep3 和 submitCreate 函数**

```javascript
function syncStep3() {
  document.getElementById('cfName').textContent = document.getElementById('taskName').value || '未命名任务';
  document.getElementById('cfCount').textContent = outputs.length;
  document.getElementById('cfPlanCount').textContent = outputs.length;

  const freqPreview = document.getElementById('schedTimeBig');
  document.getElementById('cfFreq').textContent = freqPreview ? freqPreview.textContent : '每天 09:00';

  const channelNames = { local: '本地', wecom: '企业微信', dingtalk: '钉钉', feishu: '飞书' };
  document.getElementById('cfChannel').textContent = channelNames[selectedChannel] || '本地';

  document.getElementById('cfList').innerHTML = outputs.map((o, i) => {
    const c = CAPS[o.type];
    return `<div class="co-item">
      <span class="co-num">${i + 1}</span>
      <div class="co-info">
        <strong>${c.name}</strong>
        <small>${c.summary ? c.summary(getCfg(o)) : c.def}</small>
      </div>
    </div>`;
  }).join('');
}

function submitCreate() {
  showToast('值守任务创建成功（含 ' + outputs.length + ' 项成果）');
  setTimeout(() => { window.location.href = 'duty-tasks.html'; }, 1100);
}
```

- [ ] **Step 4: 初始化调度详情渲染**

在 `initOutputs()` 调用之后，添加 `renderSchedDetail()` 初始化：

```javascript
initOutputs();
renderOutputs();
renderConfig();
renderSchedDetail();
```

- [ ] **Step 5: 在浏览器中验证 Step 3**

进入 Step 3，确认：
- 确认卡片显示完整信息
- 对勾动画正常播放
- 成果清单正确显示所有成果
- 点击"创建任务"弹出 Toast 提示并跳转

- [ ] **Step 6: 提交**

```bash
git add docs/duty-create.html
git commit -m "feat: duty-create 重设计 - Task 5 Step3 确认任务"
```

---

### Task 6: 最终打磨 — 动效完善、边界情况、URL 参数、响应式

**Files:**
- Modify: `docs/duty-create.html`

**Interfaces:**
- All previous interfaces; this task polishes edge cases

- [ ] **Step 1: 添加响应式适配**

在 `</style>` 之前添加：

```css
/* ===== 响应式适配 ===== */
@media (max-width: 768px) {
  .top-bar { padding: 12px 16px; }
  .content { padding: 0 16px 32px; }
  .step1-layout { grid-template-columns: 1fr; }
  .step1-right { position: static; }
  .step-node .step-info { display: none; }
  .step-line { width: 24px; }
  .delivery-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 2: 读取 edit 模式下 taskName 初始化**

更新 `initOutputs` 中 edit 模式的 `taskName`：

```javascript
if (p.get('edit')) {
  outputs = [{ id: 'o' + (++seq), type: 'concentrationRanking' }, { id: 'o' + (++seq), type: 'mapPackage' }];
  document.getElementById('taskName').value = '平阴县每日城市排名分析任务';
}
```

- [ ] **Step 3: 确保 goStep 在第一步时重新渲染配置**

```javascript
function goStep(s) {
  curStep = s;
  for (let i = 1; i <= 3; i++) document.getElementById('panel' + i).classList.toggle('visible', i === s);
  document.querySelectorAll('.step-node').forEach((el, idx) => {
    const st = idx + 1;
    el.classList.toggle('active', st === s);
    el.classList.toggle('done', st < s);
  });
  document.getElementById('line1').classList.toggle('done', 1 < s);
  document.getElementById('line2').classList.toggle('done', 2 < s);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (s === 1) { renderOutputs(); renderConfig(); }
  if (s === 2) syncStep2();
  if (s === 3) syncStep3();
}
```

- [ ] **Step 4: 全面浏览器验证**

打开 `docs/duty-create.html`：
1. Step 1: 添加/删除/复制成果，切换类型配置表单，验证预览同步
2. Step 1→2: 点击"下一步"，确认底栏按钮和步骤条正确
3. Step 2: 切换每种调度模式，切换推送渠道，展开/折叠高级选项
4. Step 2→3: 点击"下一步"，确认摘要信息完整
5. Step 3: 点击"创建任务"，验证 Toast 和跳转
6. URL 参数测试：`?caps=mapPackage,hourlyBrief` 预选成果
7. URL 参数测试：`?edit=task-001` 编辑模式

- [ ] **Step 5: 提交**

```bash
git add docs/duty-create.html
git commit -m "feat: duty-create 重设计 - Task 6 最终打磨：响应式、边界情况、URL 参数"
```

---

## 完成标志

所有 Task 完成后，`docs/duty-create.html` 应为：
- 独立的、可双击打开的完整 HTML 文件
- 温润呼吸感视觉风格（松石绿 + 暖灰 + 大留白）
- 3 步向导完整可用（选择成果 → 设置交付 → 确认任务）
- 4 种成果类型的配置表单均可正常编辑
- 调度选择器 6 种模式都可用
- URL 参数支持 `?caps=` 和 `?edit=`
- 响应式适配移动端
- 动效优雅且尊重 reduced-motion 设置
