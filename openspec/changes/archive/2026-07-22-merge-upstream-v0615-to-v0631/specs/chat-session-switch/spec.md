## MODIFIED Requirements

### Requirement: No chat content flicker on session switch
切换会话时，聊天内容 SHALL 平滑过渡，不出现旧会话内容闪烁后消失的问题。

#### Scenario: Switch between sessions
- **WHEN** 用户从会话 A 切换到会话 B
- **THEN** 聊天内容 SHALL 直接显示会话 B 的消息，不出现会话 A 的内容闪烁

### Requirement: Persist session profile filter
会话列表的 profile 筛选状态 SHALL 持久化，切换页面后返回时 SHALL 保留之前的筛选选择。

#### Scenario: Profile filter persists across navigation
- **WHEN** 用户在会话列表中选择了某个 profile 筛选，然后导航到其他页面再返回
- **THEN** profile 筛选 SHALL 仍保持之前的选择

#### Scenario: Profile filter stored in chat store
- **WHEN** 用户选择 profile 筛选
- **THEN** chat store SHALL 记录选中的 profile，下次加载时恢复
