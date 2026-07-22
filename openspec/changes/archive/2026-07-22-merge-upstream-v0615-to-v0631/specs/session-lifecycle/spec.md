## MODIFIED Requirements

### Requirement: Session ended_at and end_reason on bridge termination
当 Bridge 运行或 coding-agent 运行终止时（正常完成、用户中止、或错误），系统 SHALL 调用 `updateSession()` 写入 `ended_at` 时间戳和 `end_reason` 原因。

#### Scenario: Bridge run completes normally
- **WHEN** Bridge 运行正常完成
- **THEN** 系统 SHALL 写入 `ended_at` 为完成时间，`end_reason` 为 `'completed'`

#### Scenario: Bridge run aborted by user
- **WHEN** 用户中止 Bridge 运行
- **THEN** 系统 SHALL 写入 `ended_at` 为中止时间，`end_reason` 为 `'aborted'`

#### Scenario: Bridge run fails with error
- **WHEN** Bridge 运行因错误终止
- **THEN** 系统 SHALL 写入 `ended_at` 为失败时间，`end_reason` 为 `'error'`

#### Scenario: Coding agent run terminates
- **WHEN** Coding agent 运行终止（完成/中止/失败）
- **THEN** 系统 SHALL 同样写入 `ended_at` 和 `end_reason`

### Requirement: Coding agent memory export on completion
当 coding agent 运行完成时，系统 SHALL 自动调用 `hermes threads save` 导出 agent memory。

#### Scenario: Claude-code session memory export
- **WHEN** Claude-code agent 运行完成
- **THEN** 系统 SHALL 调用 `hermes threads save --from claude-code --session-id <native_session_id>` 导出 memory

#### Scenario: Codex session memory export
- **WHEN** Codex agent 运行完成
- **THEN** 系统 SHALL 调用 `hermes threads save --from codex --session-id <native_session_id>` 导出 memory

#### Scenario: Skip export if no native session id
- **WHEN** coding agent 运行完成但没有 native session id
- **THEN** 系统 SHALL 跳过 memory export 并记录 debug 日志
