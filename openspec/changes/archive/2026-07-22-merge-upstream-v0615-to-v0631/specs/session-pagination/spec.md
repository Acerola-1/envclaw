## MODIFIED Requirements

### Requirement: History session pagination
历史会话列表 SHALL 支持基于游标的分页，修复大量会话时的加载和滚动问题。 SHALL 支持 `lineage` 参数查询关联会话链。

#### Scenario: Paginated session loading
- **WHEN** 用户打开历史会话页面
- **THEN** 系统 SHALL 分页加载会话列表，避免一次性加载全部会话

#### Scenario: Lineage query
- **WHEN** 用户查看某个会话的关联链
- **THEN** 系统 SHALL 支持通过 `lineage` 参数查询同一链路下的所有会话

#### Scenario: Scroll-based loading
- **WHEN** 用户滚动到会话列表底部
- **THEN** 系统 SHALL 自动加载下一页会话
