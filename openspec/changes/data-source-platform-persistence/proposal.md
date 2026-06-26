## Why

数据源平台配置（平台列表、账号、提示词等）目前完全存储在浏览器内存中（Pinia store），页面刷新后所有配置丢失。用户每次都需要重新配置，体验极差。需要像频道配置、模型配置一样，将数据持久化到 Hermes 服务端的 profile 配置文件中，支持多设备同步。

## What Changes

- 数据源平台配置从纯内存存储迁移到服务端持久化（profile `config.yaml` 的 `dataSourcePlatforms` 字段）
- 新增后端 API：`GET/PUT /api/hermes/data-source-platforms` 用于读写平台配置
- 前端 store 改为通过 API 加载和保存数据，不再依赖内存
- 支持多设备通过同一 profile 同步数据源平台配置

## Capabilities

### New Capabilities
- `data-source-platform-persistence`: 数据源平台配置的持久化存储与同步，包括后端 API、配置文件读写、前端 API 调用

### Modified Capabilities
（无 — 现有 spec 不涉及数据源平台）

## Impact

- **后端**: `packages/server/src/routes/hermes/` 新增路由，`packages/server/src/controllers/hermes/` 新增控制器
- **前端**: `packages/client/src/stores/hermes/dataSourcePlatforms.ts` 改为异步 API 驱动
- **配置**: profile `config.yaml` 新增 `dataSourcePlatforms` 字段
- **无破坏性变更**: 前端在 API 不可用时回退到内存模式，向后兼容