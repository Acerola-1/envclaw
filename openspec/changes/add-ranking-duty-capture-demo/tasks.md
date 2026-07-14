## 1. Route and Fixture Setup

- [ ] 1.1 Add an additive Envclaw guard child route for the concentration-ranking duty-capture demo.
- [ ] 1.2 Create typed local fixture data and a local `RankingDutyDefinition` model without calling server APIs.
- [ ] 1.3 Add all visible demo strings to every supported client locale.

## 2. Interactive Ranking Capture

- [ ] 2.1 Build the platform-shaped concentration-ranking fixture with configurable scope, period, target city, observed timestamp, and ranking output.
- [ ] 2.2 Build the duty-definition summary that reflects saved ranking choices and remains empty until a user saves an output.
- [ ] 2.3 Add the save interaction and mandatory time-intent confirmation, defaulting to latest published data rather than the observed timestamp.

## 3. Rehearsal Experience

- [ ] 3.1 Add a local rehearsal action that exposes the ordered future runner operations and a simulated successful artifact state.
- [ ] 3.2 Clearly label all platform content, saved output, and rehearsal results as demo fixtures with no real credentials, cron job, or automation execution.

## 4. Styling and Verification

- [ ] 4.1 Apply the existing Envclaw visual tokens and responsive constraints without adding a UI library or global style changes.
- [ ] 4.2 Add focused client tests for saving latest versus fixed time intent and for simulated rehearsal state.
- [ ] 4.3 Run `npm run harness:check`, the focused test suite, and `npm run build`.
