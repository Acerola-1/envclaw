## ADDED Requirements

### Requirement: Reasoning effort slider in chat input
聊天输入框 SHALL 提供推理强度滑块，允许用户在发送消息前选择推理深度。推理强度 SHALL 通过 `reasoning_effort` 参数传递给 Agent。

#### Scenario: Select reasoning effort level
- **WHEN** 用户在聊天输入框中拖动推理强度滑块选择一个级别
- **THEN** 滑块 SHALL 显示对应级别的标签（如 low/medium/high/max），并发送消息时 SHALL 将 `reasoning_effort` 参数设为所选级别

#### Scenario: Default reasoning effort
- **WHEN** 用户未调整推理强度滑块
- **THEN** 系统 SHALL 使用默认推理强度（medium）

#### Scenario: Visual feedback for effort level
- **WHEN** 用户调整推理强度滑块
- **THEN** 滑块颜色 SHALL 随级别变化（低=灰色，中=蓝色，高=绿色/黄色，max=红色），提供直观的视觉反馈
