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

## AI 编写行为规范（构建零报错）

每次修改 `.vue` / `.ts` 文件后，以下规则是从高频构建报错中提取的硬边界：

### 删除/注释代码时的关联清理（TS6133 最高频）

- **注释模板代码时，同步删除 script 中仅被该模板引用的变量/函数/导入。** 注释掉 `<template>` 中的组件用法不等于删除了 `import`，vue-tsc 会报 TS6133。
- **删除函数时，同步检查并删除：** (1) 该函数的 import 依赖 (2) 调用该函数的其他死代码 (3) 仅被该函数使用的 computed/ref。
- **删除 computed 时，同步检查并删除：** 仅被该 computed 使用的 store、import、函数。

### 类型修改时的同步更新（TS2322）

- **修改 `ref<T>` 的类型时，同步更新所有使用该 ref 的接口定义（interface/type）。** 例如将 `ref<string | null>` 改为 `ref<number | null>` 时，`ScheduleConfig` 接口中的对应字段也必须同步改。
- **修改函数参数类型时，搜索所有调用方确认兼容。**

### Store/API 属性名验证（TS2339）

- **使用 `store.xxx` 或 `api.xxx` 前，先搜索确认该属性/方法确实存在于源文件中。** 不要猜测属性名（如 `activeProfileKey` vs `activeProfileName`）。

### 组件 Props 传递（TS2345）

- **修改组件的 props 定义（尤其是添加必需 prop）时，搜索所有 `<ComponentName` 用法，确保每个调用方都传递了新 prop。** 如需向后兼容，使用 `withDefaults` + 可选 prop。

### 导入清理（TS6133 / TS6196）

- **删除类型使用处时，检查 import type 行，移除不再使用的类型导入。**
- **删除组件使用时，移除对应的 `import Xxx from ...`。**

### AI 自检流程

```
修改任何文件 → npm run build → 有报错则修复，无报错则完成
```

禁止在未通过 `npm run build` 的情况下声称"修复完成"。

## When The Agent Gets Stuck

Improve the harness instead of repeating the same prompt. Add missing docs,
tests, logs, scripts, or CI checks so the next agent can see and verify the
constraint directly.
