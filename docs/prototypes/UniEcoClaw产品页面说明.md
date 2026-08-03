# UniEcoClaw页面设计文档(DESIGN)

> **版本**:v0.7(2026-08-02)
> **状态**:设计中
> **目标读者**:前端开发、设计师、产品

---

## 1. Context(背景与动机)

### 1.1 核心问题

当前产品的三大短板:

1. **"换地方怎么复刻能力?"** —— 当前能力库(`CapabilityLibrary.vue`)只有 4 张静态卡片(`mapPackage`/`concentrationRanking`/`hourlyBrief`/`monitoringData`),且只服务于"数智大气"一个平台。平顶山团队换到郑州/洛阳,**所有能力配置要重新做一遍**。
2. **"新能力怎么接进来?"** —— 后端 `envclaw_platform_functions` 表里**有数据**,但 `CreateTask.vue:230-251` 的 functions 数组(14 条)却**硬编码在前端**。新增一个平台需要改源码重新发版,做不到"零代码接入"。
3. **"Skill / MCP 怎么用?"** —— 这两个能力目前**藏在"设置"菜单里**,普通用户根本发现不了。`AppSidebar.vue` L106-123 把 `Jobs` / `Kanban` 等核心入口都注释掉了。

### 1.2 改版目标

| 维度 | 改版前 | 改版后 |
|---|---|---|
| 任务模板 | `ScenarioTemplate` 前端硬编码 4 条,只有 1 条 `available=true` | 后端 `envclaw_job_templates` 表,支持克隆/分享/导入/版本管理 |
| 外部平台 | `CreateTask.vue` functions 硬编码 14 条 | 前端从 `GET /api/envclaw/platforms/:id/functions` 拉取,新平台自动出现 |
| Skill / MCP | 埋在"设置"二级菜单 | 顶级入口"能力与平台",带 onboarding 引导 |
| 入口数量 | 侧栏 12 个可见路由 | 侧栏 4 个顶级入口,高级路由降级为二级折叠 |
| 信息架构 | 没有"用户分层"概念 | 普通人/业务/开发者 3 层角色,菜单按角色权重排列 |

### 1.3 借鉴参考

- **WorkBuddy v5.3.8**:浅色,4 分类入口,任务空间分组(运行中/已暂停/已结束)
- **ChatGPT Work**:深色极简侧栏 + 居中大输入框 + 快捷建议条
- **同事草图**: `/Users/acerola/Desktop/prototype-template-config-center.html` —— **仅作功能参考,严禁作为视觉基准**(v1 曾误将其深色绿风格当成视觉基准,导致 13 个 HTML 全部作废)

三者均采用"**左 240px 导航 + 右主面板**"主流模式。本次改版**严守底座** `docs/prototypes/duty-proto.css`(黑白水墨 Pure Ink 风格),所有原型共用此底座,不另建 design-tokens.css。

---

## 2. 用户分层与信息架构

### 2.1 三层用户模型

| 角色 | 主战场(新版命名) | 核心诉求 | 典型任务 |
|---|---|---|---|
| **普通人**(业务人员/PM) | 🌱 新建任务 + ⏰ 自动化 | "快速完成重复性工作" | 配置每天 9 点空气质量播报 |
| **业务用户**(运营/分析师) | 📋 任务模板库 | "团队经验能复用" | 克隆"平顶山日报"模板,改城市=郑州、群=郑州群就上线 |
| **开发者**(平台工程师) | 🧰 能力·技能·连接器 | "新数据源能快速接入" | 接入数智大气之外的新平台,挂载 Skill/MCP |

### 2.2 侧栏顶级入口(完全固定,不随页面切换变化)

全面对标 WorkBuddy v5.3.8 侧栏骨架(只删了"助理/项目"两个我们不需要的入口),其余全部照搬位置与顺序。**左侧栏任何页面打开 100% 完全一致**,只有内容区在变。

```
┌─ 侧栏 240px · 完全固定 ────────────────────────────┐
│                                                      │
│  [Logo] UniEcoClaw                                      │
│  ──────────────────────────────────────────────      │
│  🌱 新建任务    【主按钮,点击=跳对话】               │  ← WorkBuddy 最顶部按钮
│  ──────────────────────────────────────────────      │
│  ⏰ 自动化                  普通用户·主战场           │  ← 原"值守任务"改名
│  📋 任务模板库              业务用户·克隆/分享/导入    │  ← 原"常用任务"改名,强调"配方"
│  🧰 能力·技能·连接器        开发者·广义工具箱         │  ← 原"能力与平台"
│       ├ 右侧二级tab: 平台 / 能力 / Skill / 连接器    │
│  ⋮ 更多                     (日志/用量/性能折叠)      │
│  ──────────────────────────────────────────────      │
│  最近对话 (5)                                        │  ← 全页面通用,不随切页变化
│   新对话                              11:06          │
│   平顶山值守任务·07/28运行分析        10:19          │
│   [运行结果上下文] # City…          7月27日          │
│   [运行结果上下文] # City…          7月27日          │
│   [运行结果上下文] # City…          7月23日          │
│   查看更多(2)                                      │
│  ──────────────────────────────────────────────      │
│  [A] Acerola    🔔通知   ⚙️设置                      │
└──────────────────────────────────────────────────────┘
```

**active 规则(只有 4 顶级入口里的那一项会高亮)**:
- 对话页(duty-chat / chat-create-task):4 顶级入口都不 active,因为顶部「🌱 新建任务」本身已是视觉焦点
- 自动化 3 页(duty-tasks / duty-task-detail / duty-create):⏰ 自动化 active
- 任务模板库 3 页(templates-library / template-editor / template-share):📋 任务模板库 active
- 能力·技能·连接器 2 页(duty-capabilities / platform-onboarding):🧰 能力·技能·连接器 active

### 2.3 完整路由表(对比改版前后)

| 路由名 | 改版前 | 改版后 | 变更 |
|---|---|---|---|
| `hermes.chat` | 顶级 | **顶级 · 🌱 新建任务主按钮** | 对应 WorkBuddy 最顶部那个按钮 |
| `hermes.jobs` | 注释掉 | **顶级 · ⏰ 自动化** | 解注释 + 重命名(原"任务"→"自动化") |
| `hermes.kanban` | 注释掉 | **自动化下的二级视图**(列表 / 看板切换) | 解注释 + 收纳在同一页 |
| `hermes.templates` | 不存在 | **顶级 · 📋 任务模板库** | 新增(原"常用任务"改名,强调"配方") |
| `hermes.capabilities` | 不存在 | **顶级 · 🧰 能力·技能·连接器** | 新增,一个入口装 4 个二级 tab(平台 / 能力 / Skill / 连接器) |
| `hermes.platforms` | 不存在 | **折叠到能力·技能·连接器 → 平台 Tab** | 不再独立开页,在同一个页面切换 tab |
| `hermes.channels` | 顶级 | 折叠到"⋮ 更多" | 降级 |
| `hermes.skills` | 顶级 | **折叠到能力·技能·连接器 → Skill Tab** | 不再独立开页 |
| `hermes.mcp` | 顶级 | **折叠到能力·技能·连接器 → 连接器 Tab** | 不再独立开页 |
| `hermes.plugins` | 顶级 | 折叠到"⋮ 更多" | 降级 |
| `hermes.memory` | 顶级 | 折叠到"⋮ 更多" | 降级 |
| `hermes.models` | 顶级 | 折叠到"⋮ 更多" | 降级 |
| `hermes.logs` | 顶级 | 折叠到"⋮ 更多" | 降级 |
| `hermes.usage` | 顶级 | 折叠到"⋮ 更多" | 降级 |
| `hermes.performance` | 顶级 | 折叠到"⋮ 更多" | 降级 |
| `hermes.skillsUsage` | 顶级 | 折叠到"⋮ 更多" | 降级 |
| `hermes.settings` | 顶级 | 顶级(底部图标) | 不变 |
| `hermes.history` | 顶级 | 折叠到"⋮ 更多" | 降级 |
| `hermes.globalAgent` | 顶级 | 折叠到"⋮ 更多" | 降级 |

**结果**:顶级实体入口从 12 个砍到 **1 个主按钮 + 4 个浏览入口(含 ⋮更多)**,共 5 个侧栏锚点 + 2 个底部图标(通知/设置)。

---

## 3. 原型清单(10 个 HTML)

> 所有原型共用底座 `docs/prototypes/duty-proto.css`(黑白水墨 Pure Ink)。**左侧栏完全固定**(任何页面打开 100% 一致):brand → 🌱 新建任务主按钮 → 4 顶级入口(自动化 / 任务模板库 / 能力·技能·连接器 / ⋮更多)→ 最近对话分组(5 条固定历史)→ 底部用户栏。**只有右侧内容区随页面变化**。
>
> 已删除 3 个独立页:
> - `duty-workbench.html` → 看板视图并入 `duty-tasks.html`(自动化页内的 列表/看板 切换)
> - `duty-run-report.html` → 运行记录并入 `duty-tasks.html`(自动化页顶部的 定时任务/运行记录 二级 tab)
> - `platforms-hub.html` → 平台列表并入 `duty-capabilities.html`(能力·技能·连接器页的 4 个二级 tab 之一:平台)

### 3.1 固定侧栏规范(所有 10 页一致)

```
<aside class="session-list">
├ page-sidebar-top
│  ├ sidebar-brand     UniEcoClaw Logo + 数智环保 tag
│  ├ sidebar-primary-btn    🌱 新建任务 → duty-chat.html 【主按钮】
│  └ sidebar-primary-nav (4 项顺序固定)
│     1. ⏰ 自动化                  → duty-tasks.html
│     2. 📋 任务模板库              → templates-library.html
│     3. 🧰 能力·技能·连接器        → duty-capabilities.html
│     4. ⋮ 更多                     → placeholder(无跳转)
├ session-sections-scroll
│  └ sidebar-fixed-section  最近对话(5 条,所有页完全一致)
│        新对话 / 平顶山值守任务·07/28 / 运行上下文×3 + 查看更多(2)
└ sidebar-user          [A]头像 + Acerola + 🔔通知 + ⚙️设置
</aside>
```

**active 规则(只有 4 顶级入口里那项会高亮)**:
- `duty-chat` / `chat-create-task`:全部不带 active(主按钮「🌱 新建任务」本身就是视觉焦点)
- `duty-tasks` / `duty-task-detail` / `duty-create`:⏰ 自动化 active
- `templates-library` / `template-editor` / `template-share`:📋 任务模板库 active
- `duty-capabilities` / `platform-onboarding`:🧰 能力·技能·连接器 active

### 3.2 🌱 新建任务(对话入口,2 个)

| 文件 | 设计目标 | 关键交互 |
|---|---|---|
| `duty-chat.html` | 日常对话主页:空态 hero + 场景 tab + 能力 chips + slash 指令 | 直接提问 → AI 回答 → 末条下方显式「创建为自动化任务」按钮;或点顶部能力 chips 直接预填 |
| `chat-create-task.html` | 对话→自动化闭环演示 | 自动重放:用户提问 → AI 思考 → 草稿卡 → 确认创建 → 跳转自动化详情(带重播按钮) |

### 3.3 ⏰ 自动化(原"值守任务",3 个)

| 文件 | 设计目标 | 关键交互 |
|---|---|---|
| `duty-tasks.html` | 自动化主控页,顶部 **2 个二级 tab**(定时任务 / 运行记录) | tab1:列表/看板双视图切换 + 状态筛选 + 卡片点击进详情;tab2:4 统计卡 + 工具条 + 报告行(支持展开详情+错误日志);两个 tab 均支持 `#tab=runlog` 锚点直达 |
| `duty-task-detail.html` | 单任务详情 | 立即运行/暂停/编辑/**保存为任务模板**(串起自动化→任务模板库的关键出口)/ 删除;侧栏任务树;历史报告 5 条,点击 `href="#tab=runlog"` 直达全局运行记录 |
| `duty-create.html` | 新自动化 3 步向导 | 步骤1 选能力 + 参数配置 → 步骤2 设推送+调度 → 步骤3 确认(支持从对话草稿卡 / 任务模板 两种预填入口) |

### 3.4 📋 任务模板库(原"常用任务/模板",3 个)

> 命名从「常用任务」改名「任务模板库」,强调"配方(模板)"语义——平顶山团队做一次,其他城市团队直接拿配方用。

| 文件 | 设计目标 | 关键交互 |
|---|---|---|
| `templates-library.html` | 模板卡片网格,3 Tab:全部 / 系统预置 / 我的(已删除「团队」Tab)。**左侧分组/标签已搬到右内容区** | 右区两列布局:左分组列表(分组5项+标签4项) / 右卡片网格(克隆 / 分享 / 创建自动化任务三个操作);顶部 3 统计卡 + 筛选 pill + 搜索;右上角「分享/导入」跳 template-share,「新建模板」跳 template-editor |
| `template-editor.html` | 模板配置 4 步:信息 / 能力 / 交付 / 高级 | 能力可逐项展开配置;调度预设下拉;角色基底 prompt;末尾「保存模板」回库 / 「保存并创建任务」跳到 duty-create 预填 |
| `template-share.html` | 模板跨团队流转(tar.gz 离线模式) | 导出:勾选 4 个范围(模板配置/能力定义/凭据占位/角色提示词);导入:拖拽 tar.gz + 同名冲突 3 选 1(覆盖/保留两者/跳过) |

### 3.5 🧰 能力·技能·连接器(原"能力与平台",2 个)

> 原 `duty-capabilities` + `platforms-hub` 合并为一个入口,顶部 **4 个二级 tab**(平台 / 能力 / Skill / 连接器),一个页面装完"广义工具箱"所有概念,避免用户分不清。

| 文件 | 设计目标 | 关键交互 |
|---|---|---|
| `duty-capabilities.html` | 广义工具箱主控,顶部 4 个二级 seg-btn:① 平台(count=3)② 能力(count=4)③ Skill(count=2)④ 连接器(count=1)。支持 `#tab=platforms` 等 hash 直达。 | 平台 tab:3 统计卡 + 平台列表 3 张(数智大气「内置锁定不可删」/河南省厅/国控站)+「添加平台」跳 onboarding;能力 tab:onboarding 琥珀卡片 + 4 类能力网格(数据采集/分析/预警/办公),每张卡「测试/详情/创建自动化任务」;Skill tab:onboarding 占位卡+「打开 Skill 管理器(示意)」;连接器 tab:onboarding 占位卡+「打开 MCP 管理器(示意)」 |
| `platform-onboarding.html` | 新平台 4 步接入向导 | 步骤1 基本信息(平台名/类型:系统自有/外部/自定义/政务内网)→ 步骤2 网址凭据(接口地址/操作 prompt/Web vs API 访问方式/账号密码显示·隐藏)→ 步骤3 功能 prompt(本平台独有的固定功能,动态增删 name+prompt 两条字段)→ 步骤4 技能挂载(从现有 Skill 库勾选);完成后跳 `duty-capabilities.html#tab=platforms`;侧栏 crt-back 返回链接同样指向 `#tab=platforms` |

---

## 4. Design Tokens(设计规范)

### 4.1 色板

**唯一 token 源 = 底座 `docs/prototypes/duty-proto.css` 的 `:root`**(黑白水墨 Pure Ink)。所有原型共用此底座,**严禁另建 `design-tokens.css`、严禁引入深色绿 `#3fae7a` 系变量**(v1 曾误将同事草稿 `prototype-template-config-center.html` 的深色绿 token 当视觉基准,导致 13 个 HTML 全部作废,此为本项目最大教训)。

底座真实 token(1:1 复刻 `packages/client/src/styles/variables.scss` + `theme.ts`):

```css
:root {
  /* 背景(浅色水墨,默认且唯一主题) */
  --bg-primary: #fafafa;      /* 应用底 */
  --bg-secondary: #f0f0f0;    /* 分段/工具条底 */
  --bg-sidebar: #f5f5f5;      /* 侧栏底 */
  --bg-card: #ffffff;         /* 卡片底 */
  --bg-card-hover: #fafafa;   /* 卡片悬停 */
  --bg-input: #ffffff;        /* 输入框底 */

  /* 描边(三级灰) */
  --border-color: #e0e0e0;
  --border-light: #ebebeb;
  --border-strong: #d1d5db;

  /* 强调色(单一墨黑,所有交互高亮都用) */
  --accent-primary: #333333;
  --accent-hover: #1a1a1a;
  --accent-muted: #888888;
  --accent-primary-rgb: 51, 51, 51;   /* 供 rgba() 透明叠色用 */

  /* 文字(三级) */
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --text-muted: #999999;
  --text-on-accent: #ffffff;          /* 强调色底上的文字 */

  /* 状态色(仅用于状态徽章,不作交互高亮) */
  --success: #2e7d32;  --success-rgb: 46, 125, 50;
  --error:   #c62828;  --error-rgb: 198, 40, 40;
  --warning: #f57f17;  --warning-rgb: 245, 127, 23;

  /* 圆角 */
  --radius-sm: 6px;  --radius-md: 10px;  --radius-lg: 14px;  --radius: 8px;

  /* 字体栈 */
  --font-ui: 'Inter', system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --font-code: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
}
```

> **交互高亮一律走 `--accent-primary` (墨黑)**,状态色 (`--success`/`--error`/`--warning`) 仅用于"成功/失败/警告"徽章。不存在"深色绿"主题,也不做深色模式切换。

### 4.2 字号梯度

| 用途 | 字号 | 行高 | 字重 |
|---|---|---|---|
| H1(页面标题) | 19px | 1.4 | 650 |
| H2(区块标题) | 15px | 1.4 | 650 |
| H3(卡片标题) | 13.5px | 1.4 | 600 |
| 正文 | 13px | 1.65 | 400 |
| 辅助文字 | 12.5px | 1.6 | 400 |
| 标签/小字 | 11.5px | 1.4 | 500 |
| 数字徽章 | 10.5px | 1.0 | 600 |

### 4.3 间距

| 用途 | 间距 |
|---|---|
| 卡片内边距 | 15-16px |
| 卡片间距 | 8-14px |
| 区块间距 | 22px |
| 页面内边距 | 28px(主内容)/18px(侧栏) |
| 表单字段间距 | 12-13px |

### 4.4 圆角

与底座 `duty-proto.css` 变量一致:

- 卡片:`var(--radius-lg)` (14px)
- 按钮/输入框:`var(--radius-md)` (10px) 或 `var(--radius-sm)` (6px)
- 徽章/状态 pill:11px(近似全圆)
- 头像/logo:8px / 50%(全圆)

### 4.5 容器宽度

- 侧栏:240px(可折叠到 208px @ <980px)
- 主内容:max-width 1180px
- 聊天内容:max-width 740px
- 任务列表:430px
- 任务详情:flex 1

---

## 5. 关键设计决策(5 条 + 理由)

### 决策 1:"常用任务"改名"任务模板库"

**为什么**:v1 叫"常用任务",用户以为是"我常用的待办清单",但实际功能是"团队配方(模板)的克隆/分享/导入"——语义完全错配。改成"任务模板库"后,业务用户一眼就懂:这里是别人做好的"配方仓库",我拿来改改就用,不用从零配置。同时配合 WorkBuddy 侧栏顺序,放在"自动化"之后作为第二层入口。

**对标**:WorkBuddy 侧栏 "Tasks" + ChatGPT Work "已安排" + Figma Community "模板库"

### 决策 2:对话→任务走"显式按钮"而非 AI 主动派发

**为什么**:领导在评审会上反复强调"用户必须能控制"。如果 AI 在对话中偷偷把周期性需求变成值守任务,用户会感到失控。`ChatPanel.vue` L1437 的 `JobTreeList` 部分实现已有"折叠任务组"但没有"显式创建"按钮。本次改版在聊天结束区加 CTA,用户主动点击后才进入 CreateTask 向导。

**对标**:WorkBuddy 的"Confirm before run"模式 + ChatGPT Work 的"已安排"需要用户手动确认

### 决策 3:能力库用 onboarding 卡片 + 4 分类,而非"长表格"

**为什么**:`CapabilityLibrary.vue` 当前是 4 张静态卡片(且 2 张被注释),嵌在 `GuardPanel` 内,无独立路由,无 onboarding。普通用户根本不知道"什么是 capability"。本次改版:
- 提为顶级路由 `/hermes/capabilities`
- 首屏显示 onboarding 卡片:"这是工具箱,日常用不到,想扩展能力再来看"
- 4 类能力网格:数据采集 / 数据分析 / 预警 / 办公

**对标**:ChatGPT Work 的"极简侧栏 + 大卡片"风格

### 决策 4:平台接入走"4 步向导 + 官方模板市场",而非"填表"

**为什么**:领导问"新平台怎么接进来",**填表**是工程师视角,**向导**是用户视角。复用 `TemplateWizard.vue` 的 4 步骨架(已经在值守任务中验证),步骤改为:
1. **基本信息**:平台名、类型(系统自有 / 外部 / 自定义 / 政务内网)
2. **网址与凭据**:接口地址、操作提示词、访问方式(Web / API)
3. **功能 prompt 描述**:本平台独有的功能清单(每条一个 name + prompt)
4. **可选技能挂载**:从 Skill 库勾选要挂载的技能

**对标**:WorkBuddy 的"4 步接入"流程 + ChatGPT Work 的"插件按需启用"

### 决策 5:侧栏 4 顶级入口,而非 12 入口

**为什么**:`AppSidebar.vue` 当前 12 个可见路由,信息过载,核心功能被埋。WorkBuddy 用 4 分类入口(任务/助理/项目/专家·技能·连接器/自动化),ChatGPT Work 用 3 入口(新对话/已安排/插件)。本次改版砍到 4 顶级入口,高级路由(Skill/MCP/Profile/Logs 等 8+ 个)合并到"能力与平台"下的二级折叠组。

**对标**:WorkBuddy 4 分类 + ChatGPT Work 3 入口

---

## 6. 数据模型改造(分优先级)

### 6.1 必须(M2 完成)

#### 新增表 `envclaw_job_templates`

```sql
CREATE TABLE envclaw_job_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  tags TEXT,              -- JSON array
  prompt TEXT NOT NULL,   -- 完整组装 prompt(可执行)
  platforms TEXT,         -- JSON array of platform IDs
  functions TEXT,         -- JSON array of function IDs
  schedule TEXT,          -- cron expression
  deliver TEXT,           -- 推送渠道(JSON)
  skills TEXT,            -- JSON array
  category TEXT NOT NULL DEFAULT 'private',  -- public/team/private
  author TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  parent_template_id TEXT,  -- 克隆来源(可空)
  FOREIGN KEY (parent_template_id) REFERENCES envclaw_job_templates(id)
);
```

#### 新增表 `envclaw_template_revisions`

```sql
CREATE TABLE envclaw_template_revisions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot TEXT NOT NULL,  -- 完整 JSON 快照
  author TEXT NOT NULL,
  change_note TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (template_id) REFERENCES envclaw_job_templates(id)
);
```

#### 改造 `envclaw_jobs`

```sql
ALTER TABLE envclaw_jobs ADD COLUMN template_id TEXT;
ALTER TABLE envclaw_jobs ADD COLUMN template_version INTEGER;
-- template_id 可空,标识任务来自哪个模板
-- template_version 用于模板更新时推送"升级提示"
```

### 6.2 应该(M3 完成)

#### 打通 `envclaw_platform_functions` ↔ `CreateTask.vue`

**前端改造**:
- 删 `CreateTask.vue:230-251` 硬编码 14 条 functions
- 改为 `computed(() => platforms.value.flatMap(p => p.functions.map(f => ({...}))))`
- `selectedFunctions` 初值根据 `selectedPlatform` 动态选默认

**后端端点**:
```ts
GET /api/envclaw/platforms/:id/functions
// 返回 PlatformFunction[]

GET /api/envclaw/platforms
// 现有端点,扩展返回包含 functions
```

### 6.3 可以(远期)

- `envclaw_job_templates_shares` 关联表:支持公开模板的"使用次数/评分/克隆次数"统计
- `envclaw_template_market` 公开模板市场(需要服务器支持)

---

## 7. UI 改造清单(分优先级)

### 7.1 必须(M1 完成)

#### AppSidebar.vue
- 解注释 L106-123(`hermes.jobs` / `hermes.kanban`)
- 重命名侧栏"任务"为"任务(运行中/历史)"
- 新增顶级入口"常用任务" `hermes.templates`
- 新增顶级入口"能力与平台" `hermes.capabilities` / `hermes.platforms`
- 高级路由降级为二级折叠组

#### ChatPanel.vue
- 删 L186 `createTaskPresets` 硬编码
- 改 `usePlatformsStore` 派生 capability chips
- 新增"创建任务"按钮(聊天结束区显式 CTA)
- 按钮点击 → 弹 CreateTask 向导并预填聊天摘要

#### 路由注册(`packages/client/src/router/index.ts`)
- 新增 `hermes.templates` → `TemplatesView.vue`
- 新增 `hermes.capabilities` → `CapabilitiesView.vue`
- 新增 `hermes.platforms` → `PlatformsView.vue`

### 7.2 应该(M2-M3 完成)

- 提级 `CapabilityLibrary.vue` 出 `GuardPanel.vue` 嵌嵌套 → 独立顶级组件
- 新增全局 `EmptyState.vue` 组件(空态占位)
- 新增全局 `Onboarding.vue` 组件(首次进入引导)

### 7.3 可以(远期)

- 全站 design token 化(色板/圆角/字号/阴影)——目前 `duty-proto.css` 不统一
- 多语言 key 补全(目前 `sidebar.jobs` 等翻译可能缺失)

---

## 8. 实施路线图(M1/M2/M3,各 2 周)

### M1 — 对话+任务闭环(无新数据模型)

**原型**:
- [ ] `dashboard-center.html`(主骨架,改写 prototype-template-config-center.html)
- [ ] `chat-create-task.html`(对话创建任务闭环)
- [ ] 重写 `duty-chat.html`

**代码改造**:
- [ ] 解注释 `AppSidebar.vue` L106-123
- [ ] `ChatPanel.vue` 加"创建任务"按钮
- [ ] 删 `ChatPanel.vue` L186 `createTaskPresets` 硬编码,改 `usePlatformsStore` 派生
- [ ] 注册新路由(占位视图即可)

**验收**:
- 侧栏 4 顶级入口可见(对话/任务/常用任务/能力与平台)
- 聊天末条消息下方出现"📌 创建为值守任务"按钮
- 点击按钮 → 弹出 CreateTask 向导(预填聊天摘要)
- 提交生成 Job(走现有 `createJob` API)

### M2 — 常用任务(模板)体系

**原型**:
- [ ] `templates-library.html`(常用任务卡片网格 + 4 Tab)
- [ ] `template-editor.html`(模板编辑器 4 步)
- [ ] `template-share.html`(分享/导入对话框)

**后端**:
- [ ] 新增 `envclaw_job_templates` 表
- [ ] 新增 `envclaw_template_revisions` 表
- [ ] `envclaw_jobs` 加 `template_id` / `template_version` 字段
- [ ] `services/envclaw/templates.ts` 模板 CRUD + 版本 + tar.gz 导出导入

**前端**:
- [ ] `TemplatesView.vue` 顶级视图
- [ ] `useTemplatesStore` 增 actions:`clone / share / import / saveAsTemplate`
- [ ] 模板导出 tar.gz 模式(复用 ProfileImportModal)

**验收**:
- Job 一键"存为常用任务"
- 克隆/分享/导入模板
- 模板更新推送"升级提示"给使用过该模板的 Job

### M3 — 能力·技能·连接器(广义工具箱)

**原型**(已合并,只保留 2 个):
- [x] `duty-capabilities.html`(顶部 4 个二级 tab:平台 / 能力 / Skill / 连接器)
- [x] `platform-onboarding.html`(新平台 4 步接入向导)

**后端**:
- [ ] `envclaw_platform_functions` 端点扩展
- [ ] `GET /api/envclaw/platforms/:id/functions`

**前端**:
- [ ] `CapabilitiesView.vue` 顶级视图
- [ ] `PlatformsView.vue` 顶级视图
- [ ] 删 `CreateTask.vue:230-251` 硬编码,改 `usePlatformsStore` 派生
- [ ] `CapabilityLibrary.vue` 独立顶级组件
- [ ] `EmptyState` / `Onboarding` 组件沉淀

**验收**:
- 首次进能力库看到 onboarding 引导卡片
- 平台 Hub 新接一个数据源后,模板编辑器能引用其功能
- `CreateTask` 向导自动出现新平台的能力列表

---

## 9. 关键文件路径(实施时直接定位)

### 必须修改
- `packages/client/src/components/layout/AppSidebar.vue` (L106-123)
- `packages/client/src/components/hermes/chat/ChatPanel.vue` (L186 + 加"创建任务"按钮)
- `packages/client/src/views/hermes/CreateTask.vue` (L230-251)
- `packages/client/src/components/hermes/guard/CapabilityLibrary.vue` (提级)
- `packages/client/src/router/index.ts` (新增 3 个路由)

### 必须新增
- `packages/client/src/views/hermes/TemplatesView.vue`
- `packages/client/src/views/hermes/CapabilitiesView.vue`
- `packages/client/src/views/hermes/PlatformsView.vue`
- `packages/client/src/components/common/EmptyState.vue`
- `packages/client/src/components/common/Onboarding.vue`
- `packages/server/src/services/envclaw/templates.ts`
- `packages/server/src/db/migrations/2026_08_02_add_job_templates.sql`

### 文档产出(10 个原型 HTML)
- `docs/prototypes/DESIGN.md`(本文档,实现蓝图)
- `docs/prototypes/PAGE-GUIDE.md`(页面说明,配合展示)
- `docs/hermes-product-overview.md`(产品总览,给领导)
- 🌱 对话(2):`duty-chat.html` / `chat-create-task.html`
- ⏰ 自动化(3):`duty-tasks.html` / `duty-task-detail.html` / `duty-create.html`
- 📋 任务模板库(3):`templates-library.html` / `template-editor.html` / `template-share.html`
- 🧰 能力·技能·连接器(2):`duty-capabilities.html` / `platform-onboarding.html`

### 现有可复用资源
- `prototype-template-config-center.html` — 主骨架 CSS 变量 + 5 视图
- `ProfileImportModal`(在 `services/hermes/hermes-profile.ts`) — tar.gz 模式参考
- `TemplateWizard.vue` — 4 步流程骨架
- `default-provider-seed.ts` — seed-if-absent 模式参考
- `seedBuiltinPlatforms`(`services/envclaw/platforms.ts:133-168`) — 内置平台种子模式

---

## 10. 验证方式

### 10.1 每个里程碑验证

```bash
# 1. 跑单元/集成测试
npm run test -- tests/client tests/server

# 2. 跑 harness check(强制 PR 门禁)
npm run harness:check

# 3. 启 dev server,手测新路由
npm run dev:client
# 打开 http://localhost:8649 验证:
# - 侧栏 4 顶级入口可见
# - 聊天能创建任务
# - 模板 CRUD + 导入导出

# 4. 检查新原型 HTML 可在浏览器直接打开
# 打开 docs/prototypes/dashboard-center.html
```

### 10.2 端到端验证(M2 后)

- 创建 Job → 存为常用任务 → 克隆该模板 → 验证生成新 Job 字段一致
- 导出模板 tar.gz → 在新 profile 导入 → 验证功能完整
- 模板更新 → 使用过该模板的 Job 显示"升级提示"

### 10.3 文档验证

- `docs/hermes-product-overview.md` 领导审阅,确保 3 个被批评的点都有正面回答
- `docs/prototypes/DESIGN.md` 开发审阅,确保 5 条关键设计决策理由充分

---

## 附录 A:对话→任务闭环流程图

```
┌──────────────────────────────────────────────────┐
│ ChatView                                          │
│                                                   │
│  [用户] 帮我每天早上 8 点推送平顶山 PM2.5 数据    │
│                                                   │
│  [AI 响应] ✓ 已为你查询平顶山 PM2.5 数据...     │
│                                                   │
│  ╔══════════════════════════════════════════╗    │
│  ║ 📌 创建为值守任务                          ║    │
│  ║    每天 08:00 自动推送 PM2.5 到企业微信   ║    │
│  ║    [立即创建]                              ║    │
│  ╚══════════════════════════════════════════╝    │
│         │                                          │
│         ▼                                          │
│  CreateTask 向导(预填聊天摘要)                   │
│  ┌─ 步骤 1/3:选择要做什么 ─────────────────┐    │
│  │ ☑ 浓度排名(已选)                        │    │
│  │ □ 一张图                                  │    │
│  │ □ 小时播报                                │    │
│  └──────────────────────────────────────────┘    │
│         │                                          │
│         ▼                                          │
│  ┌─ 步骤 2/3:设置推送方式 ────────────────┐     │
│  │ 推送目标:企业微信(已选)                 │     │
│  │ 频率:每天 08:00(已选)                    │     │
│  └──────────────────────────────────────────┘    │
│         │                                          │
│         ▼                                          │
│  ┌─ 步骤 3/3:确认任务 ──────────────────────┐    │
│  │ 任务名:平顶山 PM2.5 日报推送              │    │
│  │ [创建]                                    │    │
│  └──────────────────────────────────────────┘    │
│         │                                          │
│         ▼                                          │
│  POST /api/hermes/jobs → 跳转到任务详情           │
└──────────────────────────────────────────────────┘
```

## 附录 B:能力库 + 平台接入信息流

```
┌──────────────────────────────────────────────────┐
│ 能力与平台(顶级入口)                              │
│                                                   │
│ ┌─ 能力库 ────────────────────────────────┐      │
│ │ 🎯 首次进入提示:这是工具箱,日常用不到   │      │
│ │                                          │      │
│ │ 📊 数据采集 (12 项能力)                  │      │
│ │   ├ 浓度排名(数智大气)                   │      │
│ │   ├ 一张图(数智大气)                     │      │
│ │   └ ...                                  │      │
│ │                                          │      │
│ │ 📈 数据分析 (5 项能力)                    │      │
│ │   └ ...                                  │      │
│ │                                          │      │
│ │ ⚠️ 预警(2 项能力)                       │      │
│ │   └ ...                                  │      │
│ │                                          │      │
│ │ 📁 办公(3 项能力)                        │      │
│ │   └ ...                                  │      │
│ └──────────────────────────────────────────┘      │
│                                                   │
│ ┌─ 数据平台 ──────────────────────────────┐      │
│ │ 数智大气(内置)[在线] 4 项能力           │      │
│ │ 河南省厅(外部) [在线] 0 项能力          │      │
│ │ 国控站(政务内网) [离线] 0 项能力        │      │
│ │                                          │      │
│ │ [+ 添加平台]                             │      │
│ └──────────────────────────────────────────┘      │
└──────────────────────────────────────────────────┘
         │
         ▼ 点击"添加平台"
┌──────────────────────────────────────────────────┐
│ PlatformOnboarding 4 步向导                       │
│                                                   │
│ 步骤 1/4:基本信息                                 │
│   平台名:国控站                                   │
│   平台类型:国家级官网(政务内网)                  │
│                                                   │
│ 步骤 2/4:网址与凭据                               │
│   接口地址:https://gov-station.example.com        │
│   操作提示词:登录后进入实时监测页面...            │
│   访问方式:◉ Web 浏览器  ◯ API 直连              │
│   账号:gov_user [**********]                     │
│                                                   │
│ 步骤 3/4:功能 prompt                              │
│   [+ 添加功能]                                    │
│   ├ 实时监测页面 [prompt 描述]                   │
│   └ 历史数据查询 [prompt 描述]                   │
│                                                   │
│ 步骤 4/4:技能挂载                                 │
│   ☑ 数据采集                                      │
│   ☐ 报告生成                                      │
│   ☐ 消息推送                                      │
│                                                   │
│ [完成]                                            │
└──────────────────────────────────────────────────┘
         │
         ▼
   平台列表新增"国控站",能力数 +2
   模板编辑器中可引用"国控站"功能
```

---

**文档结束**。如有问题或调整,提交 PR 时 @ reviewer 即可。
