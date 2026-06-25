# Envclaw 项目介绍

## 项目概述

Envclaw 是基于 [Hermes Agent](https://github.com/EKKOLearnAI/hermes-studio) 构建的 AI 智能体客户端应用。我们在 Hermes 的开源 Web UI 基础上进行了深度改造，打造了一个集**智能问数**和**无人值守**于一体的专业级 AI 工作平台。

**核心定位**：面向终端用户的桌面客户端软件，而非开发者工具。用户通过图形界面即可完成所有操作，无需接触命令行或配置文件。

## 技术架构

### 客户端框架

| 组件 | 技术选型 | 说明 |
|------|----------|------|
| 桌面容器 | Electron v42 | 跨平台桌面应用框架 |
| 前端框架 | Vue 3 + TypeScript | Composition API + 类型安全 |
| 构建工具 | Vite | 快速热更新，优化构建 |
| UI 组件库 | Naive UI | 企业级 Vue 3 组件库 |
| 状态管理 | Pinia | 轻量级，支持 Setup Store |
| 国际化 | vue-i18n | 多语言支持 |

### 运行时架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron 桌面应用                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Vue 3 前端  │  │  Koa BFF     │  │  Python 运行时   │  │
│  │   (Vite)     │  │  (API 网关)   │  │  (Hermes Agent)  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                    │            │
│         └─────────────────┴────────────────────┘            │
│                           │                                  │
│                    Socket.IO 通信                             │
└──────────────────────────────────┬──────────────────────────-┘
                                   │
                            ┌──────▼──────┐
                            │  模型服务    │
                            │ (多模型支持) │
                            └─────────────┘
```

### 平台支持

| 操作系统 | 架构 | 打包格式 |
|----------|------|----------|
| macOS | ARM64 / x64 | DMG |
| Windows | x64 | NSIS 安装程序 |
| Linux | x64 / ARM64 | AppImage / DEB |

**开箱即用**：桌面版内置 Python 运行时和 Hermes Agent，用户下载安装即可使用，无需额外配置环境。

---

## 核心功能模块

### 一、智能问数

智能问数模块正在将 **IPP-AIR（数智大气）** 的空气质量数据查询与分析能力集成到平台中。

#### 功能场景

| 场景 | 描述 | 状态 |
|------|------|------|
| 浓度排名查询 | 查询省/市级空气质量浓度排名 | 🚧 开发中 |
| 站点数据采集 | 自动截取考核站点分钟数据、乡镇站数据 | 🚧 开发中 |
| 一张图生成 | 生成区域空气质量可视化"一张图" | 🚧 开发中 |
| 数据分析报告 | AI 驱动的空气质量综合分析报告 | 🚧 开发中 |

#### 技术实现

- **数据源**：mapairs.com（数智大气/IPP-AIR）空气质量监测平台
- **自动化方式**：Playwright + agent-browser 双引擎
- **可视化**：支持 Mapbox 地图页面的 CDP 截图（普通截图无法捕获）

#### 示例技能：mapairs-automation

```yaml
名称: mapairs-automation
描述: Mapairs.com (数智大气/IPP-AIR) 空气质量监测平台操作指南
标签: mapairs, 数智大气, ipp-air, 空气质量, agent-browser, playwright
脚本:
  - mapairs_dual_screenshot.py    # 浓度排名双截图（省 + 市）
  - mapairs_concentration_v4.py   # 单城市浓度截图
  - pingdingshan_screenshot.py    # 平顶山三截图工作流
  - pingshan_dual_ranking.py      # 平顶山双排名
```

---

### 二、无人值守

无人值守模块基于 Hermes Agent 的原生定时任务能力，提供了预置的任务模板和浏览器技能，实现 7×24 小时自动化工作。

#### 任务调度能力

| 调度模式 | 说明 | 示例 |
|----------|------|------|
| Cron 表达式 | 标准 cron 语法，精确到分钟 | `0 8 * * *` 每天 8:00 |
| 间隔执行 | 每隔 N 小时/分钟 | 每隔 2 小时 |
| 单次执行 | 指定日期时间执行一次 | 2025-06-25 14:30 |

#### 内置值守方案

| 专家角色 | 功能描述 |
|----------|----------|
| **城市排名分析专家** | 从数智大气平台截取全省地市排名和市各区排名，标注异常数据和关注城市，推送至工作群 |
| **数字播报专家** | 每小时从中大/华东平台拉取小时监测数据，自动填充播报表，生成图片推送至工作群 |
| **截图采集专家** | 自动登录各平台，截取考核站点分钟数据图、乡镇站数据图、一张图等，推送至工作群 |
| **高值提醒分析专家** | 持续监控站点分钟数据，发现连续高值自动拉取周边及气象数据，AI 生成高值分析报告并推送 |
| **达标测算专家** | 实时监测日累计 AQI，进入临界区间时自动测算各污染物控制上限，AI 生成管控建议推送 |
| **日报通报专家** | 每日从省平台下载昨日报表，自动计算排名，AI 生成文字版空气质量通报 |

#### 推送渠道

支持多平台消息推送：

- 微信（通过 Tencent iLink Bot API）
- Telegram
- Discord
- Slack
- 飞书
- WhatsApp

---

## 浏览器控制方案对比

Envclaw 默认使用 **agent-browser** 作为浏览器控制方案，更适合客户端场景。以下是 Hermes 生态中各种浏览器方案的对比：

### 方案概览

| 方案 | 类型 | 本地/云端 | 特点 |
|------|------|-----------|------|
| **agent-browser** ✅ | Rust CLI | 本地 | 轻量、快速、适合客户端 |
| Browser Use | Python SDK | 云端 | 功能丰富，依赖云端服务 |
| Browserbase | Python SDK | 云端 | 支持 stealth 模式、代理 |
| Firecrawl | Python SDK | 云端 | 专注网页抓取和转换 |
| Playwright | Python/Node SDK | 本地 | 功能全面，较重 |

### 详细对比

#### agent-browser（默认推荐）

```
✅ 优势：
- Rust 原生实现，启动快、内存占用低
- 基于 Chrome for Testing，使用 CDP 协议
- CLI 接口，天然适合 Agent 调用
- 内置性能 profiling 能力
- 无需外部服务依赖，离线可用
- npm / Homebrew / Cargo 多种安装方式

⚠️ 局限：
- 功能相对精简
- 不支持 stealth 模式
```

**适用场景**：客户端桌面应用、本地自动化、对启动速度和资源占用敏感的场景。

#### Browser Use

```
✅ 优势：
- 功能丰富，支持复杂交互
- 集成 Nous 工具网关
- 社区活跃

⚠️ 局限：
- 依赖云端服务
- 需要 API Key
- 网络延迟影响响应速度
```

**适用场景**：云端部署、需要高级浏览器功能的场景。

#### Browserbase

```
✅ 优势：
- 支持 stealth 模式，绕过反爬检测
- 支持代理和 keep-alive 会话
- 企业级稳定性

⚠️ 局限：
- 付费服务
- 依赖云端
- 配置复杂
```

**适用场景**：需要绕过反爬机制、企业级自动化场景。

#### Firecrawl

```
✅ 优势：
- 专注网页内容抓取和转换
- 输出结构化数据
- 支持 JavaScript 渲染

⚠️ 局限：
- 功能单一，不适合复杂交互
- 云端服务，需要 API Key
```

**适用场景**：网页数据采集、内容转换。

#### Playwright

```
✅ 优势：
- 功能最全面
- 支持多浏览器（Chrome/Firefox/Safari）
- 本地运行，无外部依赖
- 支持 CDP 协议

⚠️ 局限：
- 资源占用较高
- 启动速度较慢
- Python/Node 环境依赖
```

**适用场景**：需要跨浏览器测试、复杂页面交互的场景。

### 选型建议

| 场景 | 推荐方案 |
|------|----------|
| 桌面客户端应用 | **agent-browser** |
| 云端自动化服务 | Browser Use / Browserbase |
| 网页数据采集 | Firecrawl |
| 跨浏览器测试 | Playwright |
| 需要绕过反爬 | Browserbase |

---

## 技术栈总结

```
前端层：  Electron + Vue 3 + TypeScript + Vite + Naive UI
BFF 层：  Koa + Socket.IO + SQLite
Agent 层：Hermes Agent (Python) + agent-browser (Rust)
模型层：  多模型支持（Claude / GPT / Gemini / 本地模型）
```

## 快速开始

### 桌面应用（推荐）

1. 从 [Releases](https://github.com/EKKOLearnAI/hermes-studio/releases) 下载对应平台的安装包
2. 安装并启动应用
3. 首次启动会自动下载 Python 运行时和 Hermes Agent

### 开发环境

```bash
# 克隆仓库
git clone https://github.com/EKKOLearnAI/hermes-studio.git
cd hermes-studio

# 安装依赖
npm install

# 启动开发服务器（客户端 + BFF）
npm run dev

# 访问 http://localhost:8649
```

### 构建桌面应用

```bash
# macOS
npm run build:desktop:mac

# Windows
npm run build:desktop:win

# Linux
npm run build:desktop:linux
```

---

## 项目结构

```
envclaw/
├── packages/
│   ├── client/          # Vue 3 前端应用
│   ├── server/          # Koa BFF 服务
│   ├── desktop/         # Electron 桌面应用
│   ├── skills/          # 内置技能（含 mapairs-automation）
│   ├── souls/           # AI Agent 人格配置
│   ├── website/         # 项目官网
│   └── esp32-c3/        # IoT 设备固件
├── docs/                # 项目文档
├── tests/               # 测试用例
└── scripts/             # 构建脚本
```

---

## 相关链接

- **Hermes Agent**：https://github.com/EKKOLearnAI/hermes-studio
- **agent-browser**：https://github.com/nicholasgriffintn/agent-browser
- **项目主页**：https://hermes-studio.ai
- **许可证**：BSL-1.1
