## Context

Envclaw currently offers prompt-and-form task creation. Those flows do not let a duty operator see how a familiar concentration-ranking screen becomes a concrete unattended output. The demo must live inside the existing Envclaw Vue route tree and use its restrained operational styling, while remaining honest that no external platform browser, credential, cron, or Playwright integration has yet been connected.

## Goals / Non-Goals

**Goals:**
- Demonstrate the complete user decision loop for one output: configure ranking view, save it, choose time intent, inspect the captured definition, and rehearse.
- Make "latest published data" visibly distinct from the timestamp currently observed on the platform page.
- Keep all demo state local and deterministic so it can be reviewed without credentials or a live Mapairs connection.

**Non-Goals:**
- Embedding the real Mapairs page or recording browser clicks.
- Persisting duty definitions, creating Hermes jobs, or executing Playwright.
- Supporting map outputs, delivery channels, alerts, or arbitrary platform modules.

## Decisions

### Create an isolated Envclaw route

Add a dedicated child route beneath `/envclaw/guard` instead of altering either existing job-creation flow. This keeps the experiment visible and clickable without conflating it with production scheduling. The demo is an implementation probe, not a replacement UI until its interaction model is accepted.

Alternative considered: replace `TaskWizard`. Rejected because it would combine an unvalidated interaction model with production prompt-based job creation and make rollback difficult.

### Model the captured output as local structured state

The component will store a small `RankingDutyDefinition` in Vue state: ranking mode, period, province, target city, observed page timestamp, time intent, and selected output artifacts. The definition mirrors the future persisted contract but remains local for the demo.

Alternative considered: concatenate a prompt on save. Rejected because the point of the demo is to make the execution contract visible and avoid hiding business choices in prose.

### Render a platform-shaped local fixture instead of a screenshot or webview

The right pane will use interactive controls and fixture rows styled after the supplied concentration-ranking screen. It demonstrates which state is captured and lets reviewers change it. A static screenshot cannot prove the save semantics; a real webview would require cross-origin embedding, SSO, and a capture adapter outside this demo's scope.

### Make time intent a mandatory confirmation

On save, the observed timestamp is displayed as evidence and the user must confirm one of: latest published data, most recent complete hour, or fixed observed time. The default is latest published data. Rehearsal displays the exact time behavior that Hermes would later receive.

## Risks / Trade-offs

- [Demo can be mistaken for a live integration] → Label fixture data and simulated rehearsal plainly; do not expose real save or cron buttons.
- [Styling can drift from Envclaw] → Reuse Envclaw CSS variables and route layout rather than adding a UI library or global theme.
- [Future backend contract may differ] → Keep the local definition small and name fields after stable business concepts rather than selectors or browser actions.
- [Demo scope expands into map automation] → Limit requirements to concentration ranking; map outputs become a separate follow-up capability.

## Migration Plan

Ship as an additive route with no data migration. Remove the route cleanly if the interaction is rejected. If accepted, replace local state with a persisted duty-definition API, then connect a reviewed Mapairs adapter and a restricted unattended runner in later changes.

## Open Questions

- Should the first production capture use an API exported by the Mapairs frontend or a desktop browser bridge?
- What freshness deadline and fallback policy define "latest published data" for hourly tasks?
- Which user/organization claim supplies the implicit target city in production?
