## MODIFIED Requirements

### Requirement: MoA preset in chat model selection
聊天模型选择 SHALL 支持 MoA（Mixture of Agents）预设，用户可选择预设的多模型组合进行对话。

#### Scenario: Select MoA preset
- **WHEN** 用户在模型选择器中选择 MoA 预设
- **THEN** 聊天 SHALL 使用 MoA provider，消息发送时 SHALL 传递 `provider: 'moa'`

#### Scenario: MoA session indicator
- **WHEN** 当前会话使用 MoA 预设
- **THEN** 聊天界面 SHALL 显示 MoA 标识，区别于普通单模型会话

#### Scenario: Switch from MoA to single model
- **WHEN** 用户从 MoA 预设切换到普通模型
- **THEN** 聊天 SHALL 切换到单模型模式，provider SHALL 更新为对应 provider
