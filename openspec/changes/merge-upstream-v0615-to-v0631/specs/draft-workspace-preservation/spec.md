## MODIFIED Requirements

### Requirement: Preserve draft workspace on model switch
在聊天中切换模型时，当前草稿工作区的内容 SHALL 被保留，不被清空。

#### Scenario: Switch model with draft content
- **WHEN** 用户在输入框中有草稿内容，然后切换了 LLM 模型
- **THEN** 输入框中的草稿内容 SHALL 保持不变

#### Scenario: Workspace diff preserved
- **WHEN** coding agent 正在工作区中操作，用户切换了模型
- **THEN** 工作区的变更差异 SHALL 被保留
