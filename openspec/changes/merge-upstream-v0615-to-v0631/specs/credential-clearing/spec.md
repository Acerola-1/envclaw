## ADDED Requirements

### Requirement: Clear channel credentials
用户 SHALL 能一键清除已配置渠道（微信、飞书、钉钉等）的凭证信息（token、secret 等）。

#### Scenario: Clear WeChat credentials
- **WHEN** 用户在平台设置页面点击微信渠道的"清除凭证"按钮
- **THEN** 系统 SHALL 删除微信的 token 和 account_id 配置，并确认渠道已断开

#### Scenario: Clear any platform credentials
- **WHEN** 用户点击任意已配置渠道的"清除凭证"按钮
- **THEN** 系统 SHALL 清除该渠道的所有认证信息，渠道状态 SHALL 变为未配置

#### Scenario: Confirm before clearing
- **WHEN** 用户点击"清除凭证"按钮
- **THEN** 系统 SHALL 弹出确认对话框，用户确认后才执行清除

### Requirement: Credential clearing API
后端 SHALL 提供 `DELETE /api/hermes/config/channels/:platform/credentials` 端点，清除指定平台的凭证。

#### Scenario: API clears credentials
- **WHEN** 前端发送 DELETE 请求到渠道凭证端点
- **THEN** 后端 SHALL 清除该平台的凭证字段并返回成功响应
