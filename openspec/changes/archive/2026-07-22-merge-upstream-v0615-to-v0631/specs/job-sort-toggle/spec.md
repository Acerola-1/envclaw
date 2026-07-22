## ADDED Requirements

### Requirement: Job list sort toggle
定时任务列表 SHALL 支持按名称或创建时间排序，并支持升序/降序切换。

#### Scenario: Sort by name ascending
- **WHEN** 用户点击排序按钮选择"按名称排序"
- **THEN** 任务列表 SHALL 按名称字母序升序排列

#### Scenario: Sort by creation time descending
- **WHEN** 用户点击排序按钮选择"按创建时间排序"
- **THEN** 任务列表 SHALL 按创建时间降序排列（最新在前）

#### Scenario: Toggle sort direction
- **WHEN** 用户再次点击当前排序方式
- **THEN** 排序方向 SHALL 切换（升序↔降序）

#### Scenario: Default sort order
- **WHEN** 用户首次进入任务列表页面
- **THEN** 默认 SHALL 按名称升序排列
