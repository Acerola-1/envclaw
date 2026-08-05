# Agent Map

This file is a short map for coding agents. Keep detailed guidance in `docs/`
and keep this file small enough to fit into every task context.

## First Reads

- `DEVELOPMENT.md` - project commands, coding rules, test rules, and PR shape.
- `ARCHITECTURE.md` - package boundaries, data ownership, and runtime flow.
- `docs/harness/README.md` - how this repository is prepared for agent work.
- `docs/harness/validation.md` - which checks to run for each change type.
- `docs/harness/worktree-runbook.md` - isolated local dev and test setup.
- `docs/harness/pr-review.md` - self-review checklist before pushing.

## Common Commands

```bash
npm ci --ignore-scripts
npm run harness:check
npm run test
npm run test:e2e
npm run build
```

Use the smallest relevant check while iterating. Before a broad PR, run
`npm run harness:check`, `npm run test:coverage`, `npm run test:e2e`, and
`npm run build`.

## Mapairs 截图 Skill 部署(改 packages/skills 后生效流程)

`packages/skills/mapairs-*` 是数智大气(浓度排名/一张图/小时播报/监测数据)截图技能源码,运行时被注入到 `~/.hermes/skills`。

改动技能源码后,让桌面端生效的**正确流程**:

```bash
# 1. 清理 ~/.hermes/skills 下对应 skill + .webui-managed-skills.json 条目
# 2. 根目录 build(会构建 server 并把 packages/skills 复制到 dist/skills)
npm run build
# 3. 启动桌面端(desktop:dev 会设 HERMES_WEB_UI_DIR="$PWD",skill 从项目 packages/skills 加载)
npm run desktop:dev
```

**不要**用 `packages/desktop` 下的 `npm run build`(只 tsc 编译主进程,不打包 skills),也**不要**手改 `release/` 或 `/Applications/Envclaw.app` 里的 skill 副本——desktop:dev 走 `HERMES_WEB_UI_DIR="$PWD"` 指向项目根,改动在 `packages/skills` 源码一处即可。

## Code Ownership Map

- `packages/client/src` - Vue 3 client, stores, routes, i18n, API helpers.
- `packages/server/src` - Koa API, Socket.IO, persistence, Hermes integration.
- `packages/desktop` - Electron wrapper, bundled Python/Hermes runtime, release artifacts.
- `tests/client`, `tests/server`, `tests/shared` - Vitest coverage.
- `tests/e2e` - Playwright browser coverage with mocked backend services.
- `.github/workflows` - CI, release, Docker, and desktop packaging automation.

## Hard Rules

- Keep routes thin: put request handling in controllers and reusable behavior in services.
- Keep Web UI state under `HERMES_WEB_UI_HOME` or `HERMES_WEBUI_STATE_DIR`.
- Keep Hermes Agent state separate from Web UI state.
- Register local API routes before proxy catch-all routes.
- Use structured APIs and argument arrays instead of shell string construction.
- Add user-facing strings to every locale file.
- Do not mix unrelated refactors into a bug fix.

## When The Agent Gets Stuck

Improve the harness instead of repeating the same prompt. Add missing docs,
tests, logs, scripts, or CI checks so the next agent can see and verify the
constraint directly.
