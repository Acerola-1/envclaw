## ADDED Requirements

### Requirement: 数据源平台配置持久化到 profile config.yaml

系统 SHALL 将数据源平台配置（平台列表、账号、提示词、启用状态）持久化到 profile 目录下的 `config.yaml` 文件中，字段名为 `dataSourcePlatforms`。

#### Scenario: 写入配置到 config.yaml
- **WHEN** 用户通过前端修改数据源平台配置（添加/编辑/删除平台或账号）
- **THEN** 系统调用 `safeFileStore.updateYaml` 将完整平台列表写入 profile `config.yaml` 的 `dataSourcePlatforms` 字段

#### Scenario: 从 config.yaml 读取配置
- **WHEN** 前端请求数据源平台配置
- **THEN** 系统从 profile `config.yaml` 读取 `dataSourcePlatforms` 字段并返回

#### Scenario: 配置不存在时返回空数组
- **WHEN** profile `config.yaml` 中不存在 `dataSourcePlatforms` 字段
- **THEN** 系统返回空数组 `[]`

### Requirement: 后端提供数据源平台 API

系统 SHALL 提供以下 API 端点：
- `GET /api/hermes/data-source-platforms` — 获取当前 profile 的数据源平台配置
- `PUT /api/hermes/data-source-platforms` — 更新当前 profile 的数据源平台配置

#### Scenario: 获取平台列表
- **WHEN** 客户端发送 `GET /api/hermes/data-source-platforms`
- **THEN** 系统返回 JSON 响应 `{ "platforms": [...] }`，包含当前 profile 的所有平台配置

#### Scenario: 更新平台列表
- **WHEN** 客户端发送 `PUT /api/hermes/data-source-platforms` 并附带 `{ "platforms": [...] }`
- **THEN** 系统将平台列表写入 profile `config.yaml` 并返回 `{ "success": true }`

#### Scenario: 更新失败返回错误
- **WHEN** 客户端发送格式错误的请求体
- **THEN** 系统返回 HTTP 400 和错误信息

### Requirement: 前端 store 通过 API 加载和保存

数据源平台 Pinia store SHALL 通过 API 加载和保存配置，而非纯内存存储。

#### Scenario: 页面加载时从 API 获取配置
- **WHEN** 前端应用初始化数据源平台 store
- **THEN** store 调用 `GET /api/hermes/data-source-platforms` 加载配置
- **AND** 加载完成前使用预置平台作为兜底数据

#### Scenario: 修改配置时自动保存到 API
- **WHEN** 用户通过前端修改平台配置（添加/编辑/删除平台或账号）
- **THEN** store 调用 `PUT /api/hermes/data-source-platforms` 保存完整平台列表

#### Scenario: API 不可用时回退内存模式
- **WHEN** API 请求失败（网络错误、服务未启动等）
- **THEN** store 回退到纯内存模式，不阻塞用户使用
- **AND** 在控制台输出警告信息

### Requirement: 支持多设备同步

同一 profile 下的数据源平台配置 SHALL 在多设备间保持一致。

#### Scenario: 多设备共享配置
- **WHEN** 用户在设备 A 上修改数据源平台配置
- **THEN** 设备 B 通过同一 profile 访问时能看到更新后的配置