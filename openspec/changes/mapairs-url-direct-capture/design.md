## Context

Envclaw 需要支持定时对 Mapairs 数智大气平台页面进行截图，并推送到指定频道。当前浓度排名已经实现，但采用逐级点击菜单的方式，稳定性不够，且无法利用用户配置天然生成的 URL 参数。同时缺少 Mapairs 账号密码的安全存储，且新增功能需要更好的模块化架构支持未来扩展。

**现有架构问题：**
1. 现有 `mapairs-ranking-capture` 使用菜单点击方式，页面结构变化容易失效
2. Mapairs 账号密码在登录后没有存储，定时任务无法获取
3. 缺少公共模块抽取，每个功能会重复写登录/预检/截图逻辑
4. Agent 容易忘记推送截图到指定频道，只保存在本地
5. 一张图功能需要新增，采用相同 URL 直跳架构更统一

**约束：**
- 凭证必须加密存储，不能明文存数据库
- 每个功能独立成 skill 便于维护
- 公共逻辑抽避免代码复制

## Goals / Non-Goals

**Goals:**
- 实现 Mapairs 平台账号凭证加密存储，定时任务运行时可解密注入环境变量
- 公共逻辑（预检、登录、截图输出）抽成 `mapairs-common` 供各技能复用
- 新增 `mapairs-onemap-capture` skill 支持一张图 URL 直连截图
- 改造 `mapairs-ranking-capture` 从菜单点击改为 URL 直连架构
- 在创建任务 prompt 中强制增加推送指令，根治忘记推送问题
- 开放式架构设计，未来新增功能只需要加新 skill 不需要改核心架构

**Non-Goals:**
- 不改变现有的权限认证模型，用户级凭证隔离已经由现有 Envclaw 用户系统处理
- 不实现数据分析/MCP 调用部分，只处理截图生成
- 不改变前端参数收集 UI，CreateTask.vue 已经支持结构化参数收集

## Decisions

### 1. 凭证存储：复用现有 envclaw_platform_accounts 表

**Decision:** 使用现有 `envclaw_platform_accounts` 表存储，不新建表。凭证 JSON 加密存储在 `credential_data` 字段。

**Rationale:**
- 表结构已经存在：`id, platform_id, name, credential_type, credential_data, ...`
- 已经支持 AES-256-GCM 加密，和系统整体加密方案一致
- 每个用户一个 Mapairs 账号，符合 "one credential per platform per user" 模型

**Schema:**
- `platform_id`: 固定为 `"mapairs"`
- `credential_data`: AES 加密后的 JSON: `{ "username": "xxx", "password": "xxx" }`

### 2. 技能架构：一个功能一个 skill + 公共模块抽离

**Decision:**
```
packages/skills/
├── mapairs-common/              # 公共模块（不做为 skill，只是 Python 包）
│   └── mapairs_common/          # Python 包，可 import
│       ├── __init__.py
│       ├── auth.py               # login() 函数
│       ├── preflight.py         # preflight_check() 函数
│       ├── screenshot.py        # 命名、输出工具
│       └── config.py            # get_base_url() 配置
│
├── mapairs-ranking-capture/     # 浓度排名（改造，使用公共模块）
│   └── scripts/
│       └── mapairs_ranking_capture.py
│
├── mapairs-onemap-capture/     # 一张图（新增，使用公共模块）
│   └── scripts/
│       └── mapairs_onemap_capture.py
```

**Rationale:**
- 每个功能独立 skill，符合项目现有组织方式
- 公共代码抽出到 Python 模块，避免复制粘贴
- 未来新增功能（小时播报/监测数据）只需要新增 skill 目录，不影响已有代码
- 符合用户需求 "每个功能绑定一个路径/skill" 的设计

**Alternative considered: single skill with multiple entry points**
  - 拒绝：一个 skill 对应多个功能在 Hermes 技能匹配会复杂化，独立更清晰

### 3. URL 参数映射：直接拼接到目标路径

**Decision:** 前端已经收集完整参数，skill 直接拼接完整 URL，不需要额外参数处理。

**Mapping:**
| 功能 | 路径 | 参数来源 |
|------|------|----------|
| 浓度排名 | `/dataStatistics/concentrationranking` | `RankingOutputSnapshot` |
| 一张图 | `/oneMap` | `MapOutputSnapshot` |

参数转换只处理：
- 布尔 → `true`/`false` 小写（URL 约定）
- 主题名称 `light` → `Light`，`dark` → `Dark`（匹配目标网站约定）
- 其他参数原样传递

**Rationale:**
- 用户选完参数，天然就能生成 URL 片段，直接跳转比点击菜单更稳定
- 跳转后页面直接就是目标，不存在"一步步点击"失败的可能
- 前端已经完成参数收集和结构化，skill 只需要拼接，不需要重新解析

### 4. 凭证注入：技能执行前从数据库取出注入为环境变量

**Decision:** 在 `skill-runner` 层，执行 Python 脚本之前：
1. 从数据库取出当前用户的 Mapairs 凭证
2. AES 解密得到明文
3. 设置环境变量 `MAPAIRS_USERNAME` and `MAPAIRS_PASSWORD`
4. 执行脚本，脚本从环境变量读取

**Rationale:**
- 现有 `mapairs-ranking-capture` 已经从环境变量读取，不需要改脚本读取逻辑
- 凭证只存在于进程环境，不会写到磁盘
- 环境变量在子进程退出后自动清除，符合安全最佳实践

### 5. 推送问题根治：prompt 强制增加推送规则

**Decision:** 在 `CreateTask.vue` 的 `finalPrompt` 计算中，**无论用户任务说明是什么**，都强制追加：

```
【推送规则】
所有成果生成完成后，必须将所有截图文件和分析结果推送到任务指定的推送目标 `${selectedDeliver}`。
不允许只保存到本地不推送。不允许遗漏任何成果。
```

**Rationale:**
- 现在问题就是用户没写推送指令，agent 就忘记推送
- 强制追加后，不管用户怎么写任务说明，规则一定存在
- 不改变现有用户输入逻辑，只是增加一条强制规则

### 6. Base URL 可配置

**Decision:** 在 `mapairs_common.config` 中，base URL 默认为内网 `http://192.168.4.25:8095`，可通过环境变量覆盖为公网 URL。

**Rationale:**
- 满足当前开发阶段内网部署
- 未来切换公网不需要改代码，只需要改环境变量

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| 目标网站 URL 参数结构变化 | 每个技能独立维护参数映射，参数变化只改对应 skill，不影响其他 |
| 凭证解密失败 | 技能启动前预检，失败立即返回明确错误，不尝试继续执行 |
| 内网地址无法从外网访问 | Base URL 可配置，切换只需要改环境变量 |
| 多个 Mapairs 账号（多用户） | 每个 Envclaw 用户存储自己的凭证，运行时注入对应用户凭证，已经支持 |

## Migration Plan

1. 数据库不需要迁移，现有表结构可用
2. 新增 Python 公共模块 `mapairs-common`，无依赖冲突
3. 改造 `mapairs-ranking-capture` 不改变 skill 对外接口，只是内部实现变化
4. 前端改动只在 `CreateTask.vue` 追加 prompt 指令，不影响其他功能

Rollback:  revert 代码提交即可，无数据库迁移需要回滚。

## Open Questions

None - all design decisions are clear from discussion.
