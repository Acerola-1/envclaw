## ADDED Requirements

### Requirement: Message reference in single chat
单聊中，用户 SHALL 能引用/回复特定消息。引用消息时，输入框 SHALL 显示引用预览，发送的消息 SHALL 包含对被引用消息的引用信息。

#### Scenario: Quote a message in single chat
- **WHEN** 用户点击某条消息的"引用"按钮
- **THEN** 聊天输入框 SHALL 显示被引用消息的预览，发送时消息 SHALL 包含 `message_reference` 字段指向被引用消息

#### Scenario: Cancel message reference
- **WHEN** 用户点击引用预览的取消按钮
- **THEN** 输入框 SHALL 清除引用预览，后续发送的消息 SHALL 不包含引用信息

#### Scenario: Highlight referenced message
- **WHEN** 用户查看包含引用的消息
- **THEN** 被引用的原始消息 SHALL 有视觉高亮标识

### Requirement: Message reference in group chat
群聊中，用户 SHALL 能引用/回复特定消息，行为与单聊一致。

#### Scenario: Quote a message in group chat
- **WHEN** 用户在群聊中点击某条消息的"引用"按钮
- **THEN** 群聊输入框 SHALL 显示被引用消息的预览，发送时消息 SHALL 包含引用信息

### Requirement: Message reference in chat store
chat store SHALL 管理 `activeMessageReference` 状态，包含被引用消息的 content 和 id。

#### Scenario: Store tracks active reference
- **WHEN** 用户选择引用某条消息
- **THEN** chat store 的 `activeMessageReference` SHALL 更新为该消息的信息

#### Scenario: Store clears reference on send
- **WHEN** 用户发送包含引用的消息
- **THEN** chat store 的 `activeMessageReference` SHALL 被清空
