## ADDED Requirements

### Requirement: Provider versioned editing
Provider 编辑 SHALL 支持版本化，每次编辑保存 SHALL 生成审计记录，包含修改者、时间、变更内容。

#### Scenario: Edit provider with audit trail
- **WHEN** 用户修改 Provider 配置并保存
- **THEN** 系统 SHALL 创建审计记录，记录修改者、时间戳和变更字段

#### Scenario: View provider edit history
- **WHEN** 用户查看 Provider 的编辑历史
- **THEN** 系统 SHALL 显示该 Provider 的所有历史编辑记录

### Requirement: Safe file store for provider data
Provider 配置文件 SHALL 使用安全文件存储（原子写入 + 备份），避免并发写入导致数据损坏。

#### Scenario: Concurrent provider edits
- **WHEN** 多个请求同时修改同一 Provider 配置
- **THEN** 系统 SHALL 通过文件锁或原子写入确保数据一致性

### Requirement: Provider editor modal UI
前端 SHALL 提供 ProviderEditorModal 组件，支持创建和编辑 Provider，包含版本化编辑界面。

#### Scenario: Open provider editor
- **WHEN** 用户点击 Provider 卡片的编辑按钮
- **THEN** 系统 SHALL 打开 ProviderEditorModal，显示当前配置和编辑表单
