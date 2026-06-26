## Context

数据源平台配置（平台列表、账号、提示词、启用状态等）当前存储在 Pinia store 的内存 ref 中，页面刷新即丢失。项目中频道配置（config.yaml 的 `platforms` 字段）和模型配置（config.yaml 的 `model` 字段）已有成熟的持久化方案：通过 `safeFileStore.updateYaml` 读写 profile 目录下的 `config.yaml`，前端通过 REST API 交互。

## Goals / Non-Goals

**Goals:**
- 数据源平台配置持久化到 profile `config.yaml` 的 `dataSourcePlatforms` 字段
- 新增后端 API 端点 `GET/PUT /api/hermes/data-source-platforms`
- 前端 store 改为通过 API 加载和保存，页面刷新后配置不丢失
- 支持多设备通过同一 profile 同步配置

**Non-Goals:**
- 不改变数据源平台的数据模型（`DataSourcePlatform` / `DataSourceAccount` 接口保持不变）
- 不涉及账号密码的加密存储（账号密码明文存储在 config.yaml，与现有平台凭证策略一致）
- 不做增量同步或冲突解决（后写入覆盖）

## Decisions

### 1. 存储位置：profile config.yaml
- **选择**: 将数据源平台配置存储在 profile 目录下的 `config.yaml`，字段名为 `dataSourcePlatforms`
- **理由**: 与频道配置（`platforms`）、模型配置（`model`）保持一致的存储模式，复用 `safeFileStore` 工具链，支持 profile 级别隔离
- **备选**: 独立 JSON 文件 — 拒绝，因为会增加配置管理复杂度，且与现有模式不一致

### 2. API 设计：整体验证/更新
- **选择**: `GET /api/hermes/data-source-platforms` 返回完整平台列表；`PUT /api/hermes/data-source-platforms` 接收完整列表覆盖写入
- **理由**: 数据源平台配置量小（通常 < 10 个平台），整体验证比增量更新更简单可靠，与 config API 的 `section` 模式一致
- **备选**: 每个平台独立 CRUD 端点 — 拒绝，因为会增加 API 复杂度和事务一致性风险

### 3. 前端加载策略：启动时异步加载
- **选择**: store 初始化时通过 API 加载配置，加载完成前使用预置平台作为兜底
- **理由**: 保证页面快速渲染，API 加载完成后无缝替换数据
- **备选**: 同步加载（阻塞页面）— 拒绝，因为会显著增加首屏加载时间

### 4. 向后兼容：API 不可用时回退内存
- **选择**: 当 API 请求失败时，前端回退到纯内存模式，不阻塞用户使用
- **理由**: 保证在 Hermes 服务未启动或网络异常时，前端仍可正常使用（只是配置不持久化）

## Risks / Trade-offs

- [账号密码明文存储] → 与现有平台凭证（Telegram bot token 等）存储策略一致，风险可接受
- [整体验证可能导致并发冲突] → 数据源平台配置修改频率低，冲突概率极小；后续如需可加乐观锁
- [预置平台与用户配置合并] → 加载时以服务端存储为准，预置平台仅作为初始值写入服务端