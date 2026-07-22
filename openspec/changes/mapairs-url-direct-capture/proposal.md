## Why

数智大气定时截图值守需求已经结构化配置，但当前实现存在几个问题：
1. 现有浓度排名脚本使用菜单逐级点击模式，页面结构变化容易失效，而用户选完参数天然生成完整 URL 参数，直接跳转更稳定可靠
2. Mapairs 平台账号密码没有加密存储，定时任务执行时无法获取用户凭证
3. Agent 经常忘记将生成的截图推送到指定频道，只保存在本地
4. 需要开放式架构支持未来新增一张图、小时播报等更多数智大气功能，每个功能独立维护不影响现有代码

## What Changes

- 新增 Mapairs 平台账号密码加密存储：用户登录成功后自动将明文凭证 AES 加密存入 `envclaw_platform_accounts` 表
- 新增 `mapairs-common` 公共 Python 模块：抽取登录、预检、截图等通用逻辑供各 skill 复用
- 新增 `mapairs-onemap-capture` skill：支持一张图 URL 直连截图，使用用户配置参数拼接完整 URL 后直接访问截图
- 改造 `mapairs-ranking-capture`：从菜单点击模式改为 URL 直连模式，架构与一张图统一
- 在创建任务 prompt 的执行规则中**强制**增加推送指令，根治 Agent 忘记推送问题
- 技能执行时自动从加密存储取出凭证解密并作为环境变量注入，满足 Playwright 脚本读取需求

## Capabilities

### New Capabilities
- `mapairs-credential-storage`: Mapairs 用户凭证加密存储与运行时注入，供所有数智大气截图技能使用
- `mapairs-onemap-capture`: 一张图 URL 直连截图，根据结构化配置拼接 URL 并生成截图
- `mapairs-url-direct-common`: 数智大气截图公共基础模块（登录、预检、截图工具）

### Modified Capabilities
- `mapairs-ranking-capture`: 浓度排名截图从菜单点击模式改为 URL 直连模式，参数结构和调用方式不变

## Impact

- `packages/server/src/controllers/auth.ts`: 外部登录成功后增加保存凭证逻辑
- `packages/server/src/services/envclaw/platforms.ts`: 已有 infrastructure，无需大改
- `packages/server/src/services/hermes/skill-runner.ts`: 执行技能前注入凭证环境变量
- `packages/skills/`: 新增公共模块和新 skill，改造现有 skill
- `packages/client/src/views/hermes/CreateTask.vue`: 在最终 prompt 中强制增加推送规则
