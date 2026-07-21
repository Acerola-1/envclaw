---
date: 2026-07-16
pr: 2095
feature: Preserve draft workspace on model switch
impact: Changing the model before a new chat's first message keeps the selected workspace instead of creating the server session with the default workspace.
---

Model changes for client-only draft sessions remain local until the first run.
The first message continues to create the persisted session with the selected
model, provider, and workspace, while existing persisted sessions keep using
the server-side model update path.

## Fork adaptation note

Upstream marks these client-only sessions with an `isLocalOnly` flag. This fork
does not carry that flag, so `switchSessionModel` detects a not-yet-persisted
draft via the existing `messageCount == null || messageCount === 0` signal — the
same condition that already drives `shouldSendInitialSessionConfig` when the
first run is dispatched. For such drafts the backend `/model` call (which would
404) is skipped and the model/provider are updated locally; the workspace is
never touched, so it is preserved end to end.
