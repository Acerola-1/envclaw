## 1. Backend: Credential Storage

- [x] 1.1 In `externalLogin` (packages/server/src/controllers/auth.ts), store the plaintext password sent by the frontend (AES-encrypted) into `envclaw_platform_accounts` via `saveMapairsCredentials`. Backend cannot SM2-decrypt (private key belongs to Mapairs), so the frontend sends plaintext alongside the SM2 ciphertext.

- [x] 1.2 Add `getMapairsCredentials` (and `saveMapairsCredentials` upsert) in `packages/server/src/services/envclaw/platforms.ts` to retrieve/decrypt and store credentials

- [x] 1.3 Inject `MAPAIRS_USERNAME` and `MAPAIRS_PASSWORD` into the Hermes gateway process env (packages/server/src/services/hermes/gateway-runner.ts); externalLogin triggers a gateway restart so new credentials propagate

## 2. Common Python Module

- [x] 2.1 Create `packages/skills/mapairs-common/mapairs_common/` package structure

- [x] 2.2 Implement `preflight.py` - shared preflight checking (Python version, playwright, chromium, credentials, network)

- [x] 2.3 Implement `auth.py` - shared login function with device limit handling

- [x] 2.4 Implement `screenshot.py` - shared naming, cropping, output and artifact reporting

- [x] 2.5 Implement `config.py` - base URL configuration with environment override + URL builder

## 3. New Skill: mapairs-onemap-capture

- [x] 3.1 Create skill directory structure: `packages/skills/mapairs-onemap-capture/`

- [x] 3.2 Write `SKILL.md` (+ agents/openai.yaml) defining input/output contract

- [x] 3.3 Implement `scripts/mapairs_onemap_capture.py` - main script that:
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

- [x] 4.1 Refactor existing script to import shared functions from `mapairs_common`

- [x] 4.2 Change from menu navigation to direct URL navigation with parameter building

- [x] 4.3 Verify existing config format still works (no breaking change)

## 5. Frontend: Fix "forget to push" issue

- [x] 5.1 In `packages/client/src/views/hermes/CreateTask.vue`, modify `finalPrompt` computed to force-add 推送 instruction to execution rules

## 6. Validation

- [x] 6.1 Verify TypeScript compiles with `npm run build`

- [x] 6.2 Verify existing tests pass with `npm run test -- tests/server/...` relevant tests

- [x] 6.3 Update documentation if needed
