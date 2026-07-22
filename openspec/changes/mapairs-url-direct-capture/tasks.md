## 1. Backend: Credential Storage

- [ ] 1.1 In `externalLogin` (packages/server/src/controllers/auth.ts), after successful Mapairs login, decrypt SM2 password and save username+password encrypted to `envclaw_platform_accounts`

- [ ] 1.2 Add `getMapairsCredentials` function in `packages/server/src/services/envclaw/platforms.ts` to retrieve and decrypt credentials

- [ ] 1.3 Modify skill runner to inject `MAPAIRS_USERNAME` and `MAPAIRS_PASSWORD` environment variables before executing a Mapairs skill

## 2. Common Python Module

- [ ] 2.1 Create `packages/skills/mapairs-common/mapairs_common/` package structure

- [ ] 2.2 Implement `preflight.py` - shared preflight checking (Python version, playwright, chromium, credentials, network)

- [ ] 2.3 Implement `auth.py` - shared login function with device limit handling

- [ ] 2.4 Implement `screenshot.py` - shared naming, output formatting

- [ ] 2.5 Implement `config.py` - base URL configuration with environment override

## 3. New Skill: mapairs-onemap-capture

- [ ] 3.1 Create skill directory structure: `packages/skills/mapairs-onemap-capture/`

- [ ] 3.2 Write `SKILL.md` defining input/output contract

- [ ] 3.3 Implement `scripts/mapairs_onemap_capture.py` - main script that:
  - imports from `mapairs_common`
  - parses JSON config
  - builds full URL with query parameters
  - runs preflight
  - logs in
  - navigates directly to URL
  - waits for render
  - crops screenshot according to scope
  - outputs artifact in correct format

## 4. Refactor: mapairs-ranking-capture to URL direct mode

- [ ] 4.1 Refactor existing script to import shared functions from `mapairs_common`

- [ ] 4.2 Change from menu navigation to direct URL navigation with parameter building

- [ ] 4.3 Verify existing config format still works (no breaking change)

## 5. Frontend: Fix "forget to push" issue

- [ ] 5.1 In `packages/client/src/views/hermes/CreateTask.vue`, modify `finalPrompt` computed to force-add推送 instruction to execution rules

## 6. Validation

- [ ] 6.1 Verify TypeScript compiles with `npm run build`

- [ ] 6.2 Verify existing tests pass with `npm run test -- tests/server/...` relevant tests

- [ ] 6.3 Update documentation if needed
