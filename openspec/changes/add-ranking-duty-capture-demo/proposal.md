## Why

The current task creation flows ask non-technical duty staff to configure platforms, functions, prompts, and schedules before they can see a concrete outcome. A concentration-ranking demo is needed to test a different interaction: staff configure a familiar platform view, save the intended output, explicitly choose the data-time intent, and see the resulting duty definition before any unattended automation is connected.

## What Changes

- Add a dedicated Envclaw concentration-ranking duty-capture demo route reachable from the guard workflow.
- Provide a platform-shaped, interactive concentration-ranking surface where a user can set the meaningful ranking filters and save the current result as a duty output.
- Separate the observed timestamp on the page from the user's time intent, with a clear default of "latest published data".
- Show the captured duty definition and a local simulated rehearsal state so the user can understand what Hermes would execute.
- Keep the demo client-only: it must not create a real cron job, access credentials, run Playwright, or claim that a real Mapairs browser session is embedded.

## Capabilities

### New Capabilities
- `ranking-duty-capture-demo`: Interactive concentration-ranking duty capture, time-intent confirmation, and simulated rehearsal for validating the proposed user experience.

### Modified Capabilities

- None.

## Impact

- Affected client routes and Envclaw UI only, primarily under `packages/client/src/views/envclaw` and `packages/client/src/router`.
- The demo uses local fixture data and does not add server APIs, Hermes runtime changes, credentials, or external platform dependencies.
- Follow-up production work will require a Mapairs view-state adapter, authenticated desktop browser surface, durable duty-definition persistence, and a restricted unattended execution policy.
