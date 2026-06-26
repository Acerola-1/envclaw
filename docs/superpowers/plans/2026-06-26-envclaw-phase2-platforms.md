# 环保管家差异化改造 — Phase 2: 平台管理

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现平台管理模块——后端 SQLite 存储 + AES-256 凭据加密 + Koa CRUD API + 前端完整 UI,让用户配置平台的操作知识、技能、功能和账号凭据。

**Architecture:** 后端在 Koa 层新增 `/api/envclaw/platforms` 路由组,使用 Web UI 自己的 SQLite 数据库(不碰 Hermes 的数据),凭据字段用 AES-256-GCM 加密后存入。前端补全占位的 platforms store 和 PlatformsPage,实现平台卡片列表、配置抽屉、账号编辑抽屉三层 UI。

**Tech Stack:** Koa + node:sqlite(DatabaseSync) + crypto(AES-256-GCM) | Vue 3 + Pinia + Naive UI(NDrawer/NInput/NSelect/NSwitch/NButton) + vue-i18n

## Global Constraints

- Vue 组件必须用 `<script setup lang="ts">` + Composition API
- Pinia store 用 setup store 语法
- 每个新用户可见字符串加到 `packages/client/src/i18n/locales/en.ts` 和 `zh.ts`
- API 请求用 `import { request } from '@/api/client'`
- 后端用 `node:sqlite` 的 `DatabaseSync`,通过 `getDb()` 获取
- 凭据加密用 Node 内置 `crypto`(AES-256-GCM)
- 新增路由注册在 `packages/server/src/routes/index.ts` 的 `registerRoutes()` 中,auth 中间件之后
- 前端只显示凭据掩码,不回传明文
- **不要 commit** — 完成 Phase 1-4 后统一 commit

---

## File Structure

### 新建文件

| 文件 | 职责 |
|---|---|
| `packages/server/src/lib/crypto.ts` | AES-256-GCM 加密/解密/掩码工具 |
| `packages/server/src/services/envclaw/platforms.ts` | 平台 CRUD service(建表+增删改查+凭据加解密) |
| `packages/server/src/controllers/envclaw/platforms.ts` | 平台 API controller |
| `packages/server/src/routes/envclaw/platforms.ts` | 平台路由定义 |
| `packages/client/src/components/envclaw/platforms/PlatformCard.vue` | 单个平台卡片(含账号子行) |
| `packages/client/src/components/envclaw/platforms/PlatformConfigDrawer.vue` | 平台级配置抽屉(操作提示词/技能/功能) |
| `packages/client/src/components/envclaw/platforms/AccountDrawer.vue` | 账号编辑抽屉 |

### 修改文件

| 文件 | 改动 |
|---|---|
| `packages/server/src/routes/index.ts` | 注册平台路由 |
| `packages/client/src/api/envclaw/platforms.ts` | 补全 API 函数 |
| `packages/client/src/stores/envclaw/platforms.ts` | 补全 store(调 API) |
| `packages/client/src/views/envclaw/PlatformsPage.vue` | 替换占位为完整实现 |
| `packages/client/src/i18n/locales/en.ts` | 新增 envclaw.platforms 命名空间条目 |
| `packages/client/src/i18n/locales/zh.ts` | 新增 envclaw.platforms 命名空间条目 |

---

## Task 1: 后端 — 加密工具 + 建表 + Service

**Files:**
- Create: `packages/server/src/lib/crypto.ts`
- Create: `packages/server/src/services/envclaw/platforms.ts`
- Test: `tests/server/services/envclaw/platforms.test.ts`

**Interfaces:**
- Consumes: `getDb()` from `../../db`
- Produces: `PlatformService` — `initTable()`, `listPlatforms()`, `getPlatform(id)`, `createPlatform(data)`, `updatePlatform(id, data)`, `deletePlatform(id)`, `addAccount(platformId, account)`, `updateAccount(platformId, accountId, data)`, `deleteAccount(platformId, accountId)`

- [ ] **Step 1: 创建加密工具**

```ts
// packages/server/src/lib/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const SALT_LENGTH = 32

/** 从环境变量或固定种子派生加密密钥。生产环境应使用环境变量。 */
function getEncryptionKey(): Buffer {
  const seed = process.env.ENVCLAW_ENCRYPTION_KEY || 'envclaw-default-encryption-key-change-in-prod'
  const salt = 'envclaw-platform-credentials-salt'
  return scryptSync(seed, salt, 32)
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  // 格式: iv:authTag:ciphertext (base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`
}

export function decrypt(encoded: string): string {
  const key = getEncryptionKey()
  const [ivB64, authTagB64, dataB64] = encoded.split(':')
  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new Error('Invalid encrypted format')
  }
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')
  const data = Buffer.from(dataB64, 'base64')
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)
  return decipher.update(data) + decipher.final('utf8')
}

/** 返回掩码,如 "••••••••" */
export function mask(_value: string): string {
  return '••••••••'
}
```

- [ ] **Step 2: 创建平台 Service**

```ts
// packages/server/src/services/envclaw/platforms.ts
import { getDb } from '../../db'
import { encrypt, decrypt, mask } from '../../lib/crypto'
import { logger } from '../logger'
import { randomUUID } from 'crypto'

// --- 类型 ---

export interface PlatformRow {
  id: string
  type: string
  name: string
  url: string | null
  operation_prompt: string
  skills: string       // JSON string
  created_at: string
  updated_at: string
}

export interface PlatformFunctionRow {
  id: string
  platform_id: string
  name: string
  prompt: string
  created_at: string
}

export interface PlatformAccountRow {
  id: string
  platform_id: string
  name: string
  credential_type: string
  credential_data: string  // AES encrypted JSON
  status: string
  last_login: string | null
  last_error: string | null
  auto_refresh: number     // 0 or 1
  created_at: string
  updated_at: string
}

// --- 建表 ---

let tableInitialized = false

export function initTable(): void {
  if (tableInitialized) return
  const db = getDb()
  if (!db) {
    logger.warn('[envclaw/platforms] SQLite not available, platform management disabled')
    return
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS envclaw_platforms (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'custom',
      name TEXT NOT NULL,
      url TEXT,
      operation_prompt TEXT NOT NULL DEFAULT '',
      skills TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS envclaw_platform_functions (
      id TEXT PRIMARY KEY,
      platform_id TEXT NOT NULL,
      name TEXT NOT NULL,
      prompt TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (platform_id) REFERENCES envclaw_platforms(id) ON DELETE CASCADE
    )
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS envclaw_platform_accounts (
      id TEXT PRIMARY KEY,
      platform_id TEXT NOT NULL,
      name TEXT NOT NULL,
      credential_type TEXT NOT NULL DEFAULT 'password',
      credential_data TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      last_login TEXT,
      last_error TEXT,
      auto_refresh INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (platform_id) REFERENCES envclaw_platforms(id) ON DELETE CASCADE
    )
  `)
  tableInitialized = true
  logger.info('[envclaw/platforms] Tables initialized')
}

// --- 辅助 ---

function now(): string {
  return new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '')
}

function rowToPlatform(row: PlatformRow, functions: PlatformFunctionRow[], accounts: PlatformAccountRow[]) {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    url: row.url,
    operationPrompt: row.operation_prompt,
    skills: JSON.parse(row.skills || '[]'),
    functions: functions.map((f) => ({ id: f.id, name: f.name, prompt: f.prompt })),
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      credentials: maskCredentials(a),
      status: a.status,
      lastLogin: a.last_login,
      lastError: a.last_error,
      autoRefresh: !!a.auto_refresh,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** 对外返回掩码凭据,不泄露明文 */
function maskCredentials(account: PlatformAccountRow) {
  try {
    const raw = JSON.parse(decrypt(account.credential_data))
    return {
      type: account.credential_type,
      username: raw.username ? mask(raw.username) : undefined,
      password: raw.password ? mask(raw.password) : undefined,
      apiKey: raw.apiKey ? mask(raw.apiKey) : undefined,
      webhookUrl: raw.webhookUrl || undefined,
      extra: raw.extra
        ? Object.fromEntries(Object.entries(raw.extra).map(([k, _v]) => [k, mask(String(_v))]))
        : undefined,
    }
  } catch {
    return { type: account.credential_type }
  }
}

// --- CRUD ---

export function listPlatforms(): any[] {
  initTable()
  const db = getDb()
  if (!db) return []

  const rows = db.prepare('SELECT * FROM envclaw_platforms ORDER BY created_at DESC').all() as PlatformRow[]
  return rows.map((row) => {
    const functions = db.prepare('SELECT * FROM envclaw_platform_functions WHERE platform_id = ?').all(row.id) as PlatformFunctionRow[]
    const accounts = db.prepare('SELECT * FROM envclaw_platform_accounts WHERE platform_id = ?').all(row.id) as PlatformAccountRow[]
    return rowToPlatform(row, functions, accounts)
  })
}

export function getPlatform(id: string): any | null {
  initTable()
  const db = getDb()
  if (!db) return null

  const row = db.prepare('SELECT * FROM envclaw_platforms WHERE id = ?').get(id) as PlatformRow | undefined
  if (!row) return null
  const functions = db.prepare('SELECT * FROM envclaw_platform_functions WHERE platform_id = ?').all(id) as PlatformFunctionRow[]
  const accounts = db.prepare('SELECT * FROM envclaw_platform_accounts WHERE platform_id = ?').all(id) as PlatformAccountRow[]
  return rowToPlatform(row, functions, accounts)
}

export function createPlatform(data: { type?: string; name: string; url?: string; operationPrompt?: string; skills?: string[]; functions?: Array<{ name: string; prompt?: string }> }): any {
  initTable()
  const db = getDb()
  if (!db) throw new Error('Database not available')

  const id = randomUUID()
  const ts = now()
  db.prepare(
    'INSERT INTO envclaw_platforms (id, type, name, url, operation_prompt, skills, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, data.type || 'custom', data.name, data.url || null, data.operationPrompt || '', JSON.stringify(data.skills || []), ts, ts)

  for (const fn of data.functions || []) {
    const fnId = randomUUID()
    db.prepare(
      'INSERT INTO envclaw_platform_functions (id, platform_id, name, prompt, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(fnId, id, fn.name, fn.prompt || '', ts)
  }

  return getPlatform(id)
}

export function updatePlatform(id: string, data: { type?: string; name?: string; url?: string; operationPrompt?: string; skills?: string[]; functions?: Array<{ id?: string; name: string; prompt?: string }> }): any {
  initTable()
  const db = getDb()
  if (!db) throw new Error('Database not available')

  const existing = getPlatform(id)
  if (!existing) throw new Error('Platform not found')

  const ts = now()
  db.prepare(
    'UPDATE envclaw_platforms SET type=?, name=?, url=?, operation_prompt=?, skills=?, updated_at=? WHERE id=?'
  ).run(
    data.type ?? existing.type,
    data.name ?? existing.name,
    data.url ?? existing.url,
    data.operationPrompt ?? existing.operationPrompt,
    JSON.stringify(data.skills ?? existing.skills),
    ts,
    id,
  )

  // 如果传了 functions,全量替换
  if (data.functions !== undefined) {
    db.prepare('DELETE FROM envclaw_platform_functions WHERE platform_id = ?').run(id)
    for (const fn of data.functions) {
      const fnId = fn.id || randomUUID()
      db.prepare(
        'INSERT INTO envclaw_platform_functions (id, platform_id, name, prompt, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(fnId, id, fn.name, fn.prompt || '', ts)
    }
  }

  return getPlatform(id)
}

export function deletePlatform(id: string): boolean {
  initTable()
  const db = getDb()
  if (!db) return false

  db.prepare('DELETE FROM envclaw_platform_accounts WHERE platform_id = ?').run(id)
  db.prepare('DELETE FROM envclaw_platform_functions WHERE platform_id = ?').run(id)
  const result = db.prepare('DELETE FROM envclaw_platforms WHERE id = ?').run(id)
  return result.changes > 0
}

// --- 账号 ---

export function addAccount(platformId: string, data: { name: string; credentialType?: string; credentials: Record<string, any>; autoRefresh?: boolean }): any {
  initTable()
  const db = getDb()
  if (!db) throw new Error('Database not available')

  const platform = getPlatform(platformId)
  if (!platform) throw new Error('Platform not found')

  const id = randomUUID()
  const ts = now()
  const encrypted = encrypt(JSON.stringify(data.credentials))

  db.prepare(
    'INSERT INTO envclaw_platform_accounts (id, platform_id, name, credential_type, credential_data, status, auto_refresh, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, platformId, data.name, data.credentialType || 'password', encrypted, 'pending', data.autoRefresh ? 1 : 0, ts, ts)

  return getPlatform(platformId)
}

export function updateAccount(platformId: string, accountId: string, data: { name?: string; credentialType?: string; credentials?: Record<string, any>; autoRefresh?: boolean }): any {
  initTable()
  const db = getDb()
  if (!db) throw new Error('Database not available')

  const ts = now()

  if (data.name !== undefined) {
    db.prepare('UPDATE envclaw_platform_accounts SET name=?, updated_at=? WHERE id=?').run(data.name, ts, accountId)
  }

  if (data.credentials !== undefined) {
    const encrypted = encrypt(JSON.stringify(data.credentials))
    db.prepare('UPDATE envclaw_platform_accounts SET credential_data=?, credential_type=?, updated_at=? WHERE id=?')
      .run(encrypted, data.credentialType || 'password', ts, accountId)
  }

  if (data.autoRefresh !== undefined) {
    db.prepare('UPDATE envclaw_platform_accounts SET auto_refresh=?, updated_at=? WHERE id=?')
      .run(data.autoRefresh ? 1 : 0, ts, accountId)
  }

  return getPlatform(platformId)
}

export function deleteAccount(platformId: string, accountId: string): any {
  initTable()
  const db = getDb()
  if (!db) throw new Error('Database not available')

  db.prepare('DELETE FROM envclaw_platform_accounts WHERE id=? AND platform_id=?').run(accountId, platformId)
  return getPlatform(platformId)
}
```

- [ ] **Step 3: 写加密工具测试**

```ts
// tests/server/lib/crypto.test.ts
import { describe, it, expect } from 'vitest'
import { encrypt, decrypt, mask } from '@/lib/crypto'

describe('crypto utils', () => {
  it('encrypt then decrypt returns original', () => {
    const original = 'my-secret-password'
    const encrypted = encrypt(original)
    expect(encrypted).not.toBe(original)
    expect(decrypt(encrypted)).toBe(original)
  })

  it('encrypted output contains colons (iv:tag:data)', () => {
    const encrypted = encrypt('test')
    const parts = encrypted.split(':')
    expect(parts).toHaveLength(3)
  })

  it('decrypt throws on invalid format', () => {
    expect(() => decrypt('invalid')).toThrow()
  })

  it('mask returns fixed string', () => {
    expect(mask('anything')).toBe('••••••••')
    expect(mask('')).toBe('••••••••')
  })

  it('different inputs produce different ciphertexts', () => {
    const a = encrypt('password-a')
    const b = encrypt('password-b')
    expect(a).not.toBe(b)
  })
})
```

- [ ] **Step 4: 运行加密测试**

Run: `npm run test -- tests/server/lib/crypto.test.ts`
Expected: PASS (5 tests)

---

## Task 2: 后端 — Controller + Route

**Files:**
- Create: `packages/server/src/controllers/envclaw/platforms.ts`
- Create: `packages/server/src/routes/envclaw/platforms.ts`
- Modify: `packages/server/src/routes/index.ts`

**Interfaces:**
- Consumes: `PlatformService` functions from Task 1
- Produces: REST API `GET/POST/PATCH/DELETE /api/envclaw/platforms` + `POST/PATCH/DELETE /api/envclaw/platforms/:id/accounts`

- [ ] **Step 1: 创建 Controller**

```ts
// packages/server/src/controllers/envclaw/platforms.ts
import type { Context } from 'koa'
import * as svc from '../../services/envclaw/platforms'

export async function list(ctx: Context) {
  try {
    ctx.body = { platforms: svc.listPlatforms() }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: { message: err.message } }
  }
}

export async function get(ctx: Context) {
  try {
    const platform = svc.getPlatform(ctx.params.id)
    if (!platform) {
      ctx.status = 404
      ctx.body = { error: { message: 'Platform not found' } }
      return
    }
    ctx.body = { platform }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: { message: err.message } }
  }
}

export async function create(ctx: Context) {
  try {
    const body = ctx.request.body as Record<string, any>
    if (!body.name) {
      ctx.status = 400
      ctx.body = { error: { message: 'name is required' } }
      return
    }
    const platform = svc.createPlatform({
      type: body.type,
      name: body.name,
      url: body.url,
      operationPrompt: body.operationPrompt,
      skills: body.skills,
      functions: body.functions,
    })
    ctx.status = 201
    ctx.body = { platform }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: { message: err.message } }
  }
}

export async function update(ctx: Context) {
  try {
    const body = ctx.request.body as Record<string, any>
    const platform = svc.updatePlatform(ctx.params.id, {
      type: body.type,
      name: body.name,
      url: body.url,
      operationPrompt: body.operationPrompt,
      skills: body.skills,
      functions: body.functions,
    })
    ctx.body = { platform }
  } catch (err: any) {
    if (err.message === 'Platform not found') {
      ctx.status = 404
    } else {
      ctx.status = 500
    }
    ctx.body = { error: { message: err.message } }
  }
}

export async function remove(ctx: Context) {
  try {
    const ok = svc.deletePlatform(ctx.params.id)
    if (!ok) {
      ctx.status = 404
      ctx.body = { error: { message: 'Platform not found' } }
      return
    }
    ctx.body = { ok: true }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: { message: err.message } }
  }
}

// --- 账号 ---

export async function addAccount(ctx: Context) {
  try {
    const body = ctx.request.body as Record<string, any>
    if (!body.name || !body.credentials) {
      ctx.status = 400
      ctx.body = { error: { message: 'name and credentials are required' } }
      return
    }
    const platform = svc.addAccount(ctx.params.id, {
      name: body.name,
      credentialType: body.credentialType,
      credentials: body.credentials,
      autoRefresh: body.autoRefresh,
    })
    ctx.status = 201
    ctx.body = { platform }
  } catch (err: any) {
    if (err.message === 'Platform not found') {
      ctx.status = 404
    } else {
      ctx.status = 500
    }
    ctx.body = { error: { message: err.message } }
  }
}

export async function updateAccount(ctx: Context) {
  try {
    const body = ctx.request.body as Record<string, any>
    const platform = svc.updateAccount(ctx.params.id, ctx.params.accountId, {
      name: body.name,
      credentialType: body.credentialType,
      credentials: body.credentials,
      autoRefresh: body.autoRefresh,
    })
    ctx.body = { platform }
  } catch (err: any) {
    if (err.message === 'Platform not found') {
      ctx.status = 404
    } else {
      ctx.status = 500
    }
    ctx.body = { error: { message: err.message } }
  }
}

export async function deleteAccount(ctx: Context) {
  try {
    const platform = svc.deleteAccount(ctx.params.id, ctx.params.accountId)
    ctx.body = { platform }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: { message: err.message } }
  }
}
```

- [ ] **Step 2: 创建路由文件**

```ts
// packages/server/src/routes/envclaw/platforms.ts
import Router from '@koa/router'
import * as ctrl from '../../controllers/envclaw/platforms'

export const platformRoutes = new Router()

platformRoutes.get('/api/envclaw/platforms', ctrl.list)
platformRoutes.get('/api/envclaw/platforms/:id', ctrl.get)
platformRoutes.post('/api/envclaw/platforms', ctrl.create)
platformRoutes.patch('/api/envclaw/platforms/:id', ctrl.update)
platformRoutes.delete('/api/envclaw/platforms/:id', ctrl.remove)
platformRoutes.post('/api/envclaw/platforms/:id/accounts', ctrl.addAccount)
platformRoutes.patch('/api/envclaw/platforms/:id/accounts/:accountId', ctrl.updateAccount)
platformRoutes.delete('/api/envclaw/platforms/:id/accounts/:accountId', ctrl.deleteAccount)
```

- [ ] **Step 3: 注册路由到 index.ts**

在 `packages/server/src/routes/index.ts` 中:

添加 import:
```ts
import { platformRoutes } from './envclaw/platforms'
```

在 `registerRoutes()` 函数中,auth 中间件之后的受保护路由区域(行 94 `app.use(jobRoutes.routes())` 附近)添加:
```ts
app.use(platformRoutes.routes())
```

- [ ] **Step 4: 运行服务端测试确认无编译错误**

Run: `npm run test -- tests/server/lib/crypto.test.ts`
Expected: PASS

---

## Task 3: 前端 — API 层 + Store 补全

**Files:**
- Modify: `packages/client/src/api/envclaw/platforms.ts`
- Modify: `packages/client/src/stores/envclaw/platforms.ts`

**Interfaces:**
- Consumes: `request` from `@/api/client`
- Produces: `usePlatformsStore()` — `platforms`, `loading`, `fetchPlatforms()`, `createPlatform()`, `updatePlatform()`, `deletePlatform()`, `addAccount()`, `updateAccount()`, `deleteAccount()`

- [ ] **Step 1: 补全 API 层**

替换 `packages/client/src/api/envclaw/platforms.ts` 的内容:

```ts
// packages/client/src/api/envclaw/platforms.ts
import { request } from '../client'

// --- 类型(与后端一致) ---

export interface PlatformFunction {
  id: string
  name: string
  prompt: string
}

export interface PlatformAccountMasked {
  id: string
  name: string
  credentials: {
    type: string
    username?: string
    password?: string
    apiKey?: string
    webhookUrl?: string
    extra?: Record<string, string>
  }
  status: 'connected' | 'expired' | 'error' | 'pending'
  lastLogin: string | null
  lastError: string | null
  autoRefresh: boolean
}

export interface Platform {
  id: string
  type: string
  name: string
  url: string | null
  operationPrompt: string
  skills: string[]
  functions: PlatformFunction[]
  accounts: PlatformAccountMasked[]
  createdAt: string
  updatedAt: string
}

export type PlatformType = 'mapairs' | 'national_station' | 'oa' | 'feishu' | 'dingtalk' | 'custom'

export interface CreatePlatformRequest {
  type?: PlatformType
  name: string
  url?: string
  operationPrompt?: string
  skills?: string[]
  functions?: Array<{ name: string; prompt?: string }>
}

export interface UpdatePlatformRequest {
  type?: PlatformType
  name?: string
  url?: string
  operationPrompt?: string
  skills?: string[]
  functions?: Array<{ id?: string; name: string; prompt?: string }>
}

export interface AddAccountRequest {
  name: string
  credentialType?: 'password' | 'api_key' | 'webhook' | 'cookie'
  credentials: Record<string, any>
  autoRefresh?: boolean
}

export interface UpdateAccountRequest {
  name?: string
  credentialType?: string
  credentials?: Record<string, any>
  autoRefresh?: boolean
}

// --- API 函数 ---

export async function listPlatforms(): Promise<Platform[]> {
  const res = await request<{ platforms: Platform[] }>('/api/envclaw/platforms')
  return res.platforms
}

export async function getPlatform(id: string): Promise<Platform> {
  const res = await request<{ platform: Platform }>(`/api/envclaw/platforms/${id}`)
  return res.platform
}

export async function createPlatform(data: CreatePlatformRequest): Promise<Platform> {
  const res = await request<{ platform: Platform }>('/api/envclaw/platforms', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return res.platform
}

export async function updatePlatform(id: string, data: UpdatePlatformRequest): Promise<Platform> {
  const res = await request<{ platform: Platform }>(`/api/envclaw/platforms/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  return res.platform
}

export async function deletePlatform(id: string): Promise<void> {
  await request(`/api/envclaw/platforms/${id}`, { method: 'DELETE' })
}

export async function addAccount(platformId: string, data: AddAccountRequest): Promise<Platform> {
  const res = await request<{ platform: Platform }>(`/api/envclaw/platforms/${platformId}/accounts`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return res.platform
}

export async function updateAccount(platformId: string, accountId: string, data: UpdateAccountRequest): Promise<Platform> {
  const res = await request<{ platform: Platform }>(`/api/envclaw/platforms/${platformId}/accounts/${accountId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  return res.platform
}

export async function deleteAccount(platformId: string, accountId: string): Promise<Platform> {
  const res = await request<{ platform: Platform }>(`/api/envclaw/platforms/${platformId}/accounts/${accountId}`, {
    method: 'DELETE',
  })
  return res.platform
}
```

- [ ] **Step 2: 补全 Store**

替换 `packages/client/src/stores/envclaw/platforms.ts` 的内容:

```ts
// packages/client/src/stores/envclaw/platforms.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as platformsApi from '@/api/envclaw/platforms'
import type { Platform, CreatePlatformRequest, UpdatePlatformRequest, AddAccountRequest, UpdateAccountRequest } from '@/api/envclaw/platforms'

// 重新导出类型供其他模块使用
export type { Platform } from '@/api/envclaw/platforms'
export type { PlatformFunction } from '@/api/envclaw/platforms'
export type { PlatformAccountMasked } from '@/api/envclaw/platforms'

export const usePlatformsStore = defineStore('envclaw-platforms', () => {
  const platforms = ref<Platform[]>([])
  const loading = ref(false)

  async function fetchPlatforms() {
    loading.value = true
    try {
      platforms.value = await platformsApi.listPlatforms()
    } catch (err) {
      console.error('Failed to fetch platforms:', err)
    } finally {
      loading.value = false
    }
  }

  async function createPlatform(data: CreatePlatformRequest): Promise<Platform> {
    const platform = await platformsApi.createPlatform(data)
    platforms.value.unshift(platform)
    return platform
  }

  async function updatePlatform(id: string, data: UpdatePlatformRequest): Promise<Platform> {
    const platform = await platformsApi.updatePlatform(id, data)
    const idx = platforms.value.findIndex((p) => p.id === id)
    if (idx !== -1) platforms.value[idx] = platform
    return platform
  }

  async function deletePlatform(id: string) {
    await platformsApi.deletePlatform(id)
    platforms.value = platforms.value.filter((p) => p.id !== id)
  }

  async function addAccount(platformId: string, data: AddAccountRequest): Promise<Platform> {
    const platform = await platformsApi.addAccount(platformId, data)
    const idx = platforms.value.findIndex((p) => p.id === platformId)
    if (idx !== -1) platforms.value[idx] = platform
    return platform
  }

  async function updateAccount(platformId: string, accountId: string, data: UpdateAccountRequest): Promise<Platform> {
    const platform = await platformsApi.updateAccount(platformId, accountId, data)
    const idx = platforms.value.findIndex((p) => p.id === platformId)
    if (idx !== -1) platforms.value[idx] = platform
    return platform
  }

  async function deleteAccount(platformId: string, accountId: string): Promise<Platform> {
    const platform = await platformsApi.deleteAccount(platformId, accountId)
    const idx = platforms.value.findIndex((p) => p.id === platformId)
    if (idx !== -1) platforms.value[idx] = platform
    return platform
  }

  return {
    platforms, loading,
    fetchPlatforms, createPlatform, updatePlatform, deletePlatform,
    addAccount, updateAccount, deleteAccount,
  }
})
```

- [ ] **Step 3: 运行客户端构建确认无编译错误**

Run: `npm run build`
Expected: 成功

---

## Task 4: 前端 — 平台管理页面 UI

**Files:**
- Create: `packages/client/src/components/envclaw/platforms/PlatformCard.vue`
- Create: `packages/client/src/components/envclaw/platforms/PlatformConfigDrawer.vue`
- Create: `packages/client/src/components/envclaw/platforms/AccountDrawer.vue`
- Modify: `packages/client/src/views/envclaw/PlatformsPage.vue`
- Modify: `packages/client/src/i18n/locales/en.ts`
- Modify: `packages/client/src/i18n/locales/zh.ts`

**Interfaces:**
- Consumes: `usePlatformsStore()`, `useI18n()`
- Produces: 完整的平台管理页面

- [ ] **Step 1: 添加 i18n 条目**

在 `zh.ts` 的 `envclaw` 对象中,替换 `platforms` 部分:

```ts
platforms: {
  title: '平台管理',
  description: '管理数据平台的凭据、操作知识、技能和功能',
  addPlatform: '添加平台',
  editPlatform: '编辑平台',
  deletePlatform: '删除平台',
  deleteConfirm: '确定要删除平台「{name}」吗？其下所有账号和功能配置将一并删除。',
  type: '平台类型',
  platformName: '平台名称',
  platformUrl: '平台地址',
  config: '配置',
  operationPrompt: '操作提示词',
  operationPromptHint: '描述如何登录和操作该平台',
  platformSkills: '平台技能',
  platformSkillsHint: '该平台的技能，创建任务时自动带上',
  functions: '功能',
  addFunction: '添加功能',
  functionName: '功能名称',
  functionPrompt: '功能提示词',
  functionPromptHint: '描述如何找到并操作此功能',
  deleteFunction: '删除功能',
  accounts: '账号',
  addAccount: '添加账号',
  editAccount: '编辑账号',
  deleteAccount: '删除账号',
  accountName: '账号名称',
  credentialType: '凭据类型',
  username: '登录账号',
  password: '登录密码',
  apiKey: 'API Key',
  webhookUrl: 'Webhook 地址',
  showPassword: '显示密码',
  hidePassword: '隐藏密码',
  autoRefresh: '自动重登',
  autoRefreshHint: '会话过期时自动用凭据重新登录',
  connected: '已连接',
  expired: '已过期',
  error: '异常',
  pending: '待验证',
  noPlatforms: '暂无平台，点击上方按钮添加',
  configNote: '这里只配置平台级信息。账号在平台卡片上添加与编辑',
  types: {
    mapairs: '数智大气',
    national_station: '国控站',
    oa: 'OA 系统',
    feishu: '飞书',
    dingtalk: '钉钉',
    custom: '自定义',
  },
},
```

在 `en.ts` 添加对应的英文翻译。

- [ ] **Step 2: 创建 PlatformCard 组件**

```vue
<!-- packages/client/src/components/envclaw/platforms/PlatformCard.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NTag, useDialog } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { Platform } from '@/api/envclaw/platforms'

const props = defineProps<{
  platform: Platform
}>()

const emit = defineEmits<{
  config: [platform: Platform]
  addAccount: [platformId: string]
  editAccount: [platformId: string, accountId: string]
  deleteAccount: [platformId: string, accountId: string]
  deleted: [platformId: string]
}>()

const { t } = useI18n()
const dialog = useDialog()

function handleDelete() {
  dialog.warning({
    title: t('envclaw.platforms.deletePlatform'),
    content: t('envclaw.platforms.deleteConfirm', { name: props.platform.name }),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: () => emit('deleted', props.platform.id),
  })
}

function statusTag(status: string) {
  const map: Record<string, { type: 'success' | 'warning' | 'error' | 'default'; label: string }> = {
    connected: { type: 'success', label: t('envclaw.platforms.connected') },
    expired: { type: 'warning', label: t('envclaw.platforms.expired') },
    error: { type: 'error', label: t('envclaw.platforms.error') },
    pending: { type: 'default', label: t('envclaw.platforms.pending') },
  }
  return map[status] || map.pending
}
</script>

<template>
  <div class="pcard">
    <div class="pcard-head">
      <div class="pcard-title">
        <h3>{{ platform.name }}</h3>
        <NTag size="small" :bordered="false">{{ t(`envclaw.platforms.types.${platform.type}`) }}</NTag>
      </div>
      <div class="pcard-actions">
        <NButton size="small" quaternary @click="emit('config', platform)">{{ t('envclaw.platforms.config') }}</NButton>
        <NButton size="small" quaternary type="error" @click="handleDelete">{{ t('envclaw.platforms.deletePlatform') }}</NButton>
      </div>
    </div>

    <!-- 配置摘要 -->
    <div class="pcard-config">
      <span class="config-item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
        {{ t('envclaw.platforms.operationPrompt') }}: {{ platform.operationPrompt ? platform.operationPrompt.slice(0, 30) + '…' : '—' }}
      </span>
      <span class="config-item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" /></svg>
        {{ platform.skills.length }} {{ t('envclaw.platforms.platformSkills') }}
      </span>
      <span class="config-item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 11v2a1 1 0 0 0 1 1h3l4 4V6L7 10H4a1 1 0 0 0-1 1Z" /><path d="M16 8a5 5 0 0 1 0 8" /></svg>
        {{ platform.functions.length }} {{ t('envclaw.platforms.functions') }}
      </span>
    </div>

    <!-- 账号子行 -->
    <div class="pcard-accounts">
      <div v-for="acct in platform.accounts" :key="acct.id" class="acct-row">
        <span class="acct-name">{{ acct.name }}</span>
        <NTag :type="statusTag(acct.status).type" size="small" :bordered="false">{{ statusTag(acct.status).label }}</NTag>
        <div class="acct-actions">
          <NButton size="tiny" quaternary @click="emit('editAccount', platform.id, acct.id)">{{ t('envclaw.platforms.editAccount') }}</NButton>
          <NButton size="tiny" quaternary type="error" @click="emit('deleteAccount', platform.id, acct.id)">{{ t('envclaw.platforms.deleteAccount') }}</NButton>
        </div>
      </div>
      <div class="acct-row acct-add" @click="emit('addAccount', platform.id)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 12h14M12 5v14" /></svg>
        {{ t('envclaw.platforms.addAccount') }}
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.pcard {
  background: #2a2a2a; border: 1px solid #3a3a3a; border-radius: 12px; padding: 18px 20px;
  margin-bottom: 12px;
}
.pcard-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.pcard-title { display: flex; align-items: center; gap: 10px; h3 { font-size: 15px; font-weight: 600; } }
.pcard-actions { display: flex; gap: 4px; }

.pcard-config { display: flex; gap: 16px; margin-bottom: 12px; flex-wrap: wrap; }
.config-item { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #a0a0a0; }

.pcard-accounts { border-top: 1px solid #3a3a3a; padding-top: 10px; }
.acct-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; }
.acct-name { font-size: 13px; flex: 1; }
.acct-actions { display: flex; gap: 4px; }
.acct-add {
  cursor: pointer; color: #a0a0a0; font-size: 12.5px;
  &:hover { color: #e0e0e0; }
}
</style>
```

- [ ] **Step 3: 创建 PlatformConfigDrawer 组件**

```vue
<!-- packages/client/src/components/envclaw/platforms/PlatformConfigDrawer.vue -->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { NDrawer, NDrawerContent, NInput, NSelect, NButton, NSwitch, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { usePlatformsStore } from '@/stores/envclaw/platforms'
import type { Platform } from '@/api/envclaw/platforms'

const props = defineProps<{
  show: boolean
  platform: Platform | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  saved: []
}>()

const { t } = useI18n()
const message = useMessage()
const platformsStore = usePlatformsStore()

const operationPrompt = ref('')
const skills = ref<string[]>([])
const functions = ref<Array<{ id?: string; name: string; prompt: string }>>([])

watch(() => props.platform, (p) => {
  if (p) {
    operationPrompt.value = p.operationPrompt
    skills.value = [...p.skills]
    functions.value = p.functions.map((f) => ({ id: f.id, name: f.name, prompt: f.prompt }))
  }
}, { immediate: true })

// 技能选项从 skills API 获取(Phase 4 技能库页会完整实现,这里先用简化版)
const skillOptions = ref<Array<{ label: string; value: string }>>([])

function addFunction() {
  functions.value.push({ name: '', prompt: '' })
}

function removeFunction(index: number) {
  functions.value.splice(index, 1)
}

async function handleSave() {
  if (!props.platform) return
  try {
    await platformsStore.updatePlatform(props.platform.id, {
      operationPrompt: operationPrompt.value,
      skills: skills.value,
      functions: functions.value,
    })
    message.success(t('common.saved'))
    emit('update:show', false)
    emit('saved')
  } catch (err: any) {
    message.error(err.message)
  }
}
</script>

<template>
  <NDrawer :show="show" :width="520" placement="right" @update:show="emit('update:show', $event)">
    <NDrawerContent :title="platform?.name || ''" closable>
      <div class="note">{{ t('envclaw.platforms.configNote') }}</div>

      <div class="field">
        <label>{{ t('envclaw.platforms.operationPrompt') }}</label>
        <NInput
          v-model:value="operationPrompt"
          type="textarea"
          :rows="4"
          :placeholder="t('envclaw.platforms.operationPromptHint')"
        />
      </div>

      <div class="field">
        <label>{{ t('envclaw.platforms.platformSkills') }}</label>
        <NSelect
          v-model:value="skills"
          multiple
          filterable
          tag
          :options="skillOptions"
          :placeholder="t('envclaw.platforms.platformSkillsHint')"
        />
      </div>

      <div class="field">
        <label>{{ t('envclaw.platforms.functions') }}</label>
        <div v-for="(fn, i) in functions" :key="i" class="fn-card">
          <NInput v-model:value="fn.name" :placeholder="t('envclaw.platforms.functionName')" size="small" />
          <NInput v-model:value="fn.prompt" type="textarea" :rows="2" :placeholder="t('envclaw.platforms.functionPromptHint')" size="small" />
          <NButton size="tiny" type="error" quaternary @click="removeFunction(i)">{{ t('envclaw.platforms.deleteFunction') }}</NButton>
        </div>
        <NButton size="small" dashed block @click="addFunction">
          + {{ t('envclaw.platforms.addFunction') }}
        </NButton>
      </div>

      <template #footer>
        <NButton type="primary" @click="handleSave">{{ t('common.save') }}</NButton>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped lang="scss">
.note { font-size: 12px; color: #a0a0a0; background: #252525; border-radius: 6px; padding: 8px 12px; margin-bottom: 16px; }
.field { margin-bottom: 18px; }
label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; }
.fn-card { background: #252525; border: 1px solid #3a3a3a; border-radius: 8px; padding: 10px; margin-bottom: 8px; display: flex; flex-direction: column; gap: 8px; }
</style>
```

- [ ] **Step 4: 创建 AccountDrawer 组件**

```vue
<!-- packages/client/src/components/envclaw/platforms/AccountDrawer.vue -->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { NDrawer, NDrawerContent, NInput, NSelect, NSwitch, NButton, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { usePlatformsStore } from '@/stores/envclaw/platforms'

const props = defineProps<{
  show: boolean
  platformId: string | null
  accountId: string | null  // null = 新建
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  saved: []
}>()

const { t } = useI18n()
const message = useMessage()
const platformsStore = usePlatformsStore()

const accountName = ref('')
const credentialType = ref('password')
const username = ref('')
const password = ref('')
const showPassword = ref(false)
const autoRefresh = ref(false)

const credentialTypeOptions = [
  { label: t('envclaw.platforms.password'), value: 'password' },
  { label: 'API Key', value: 'api_key' },
  { label: 'Webhook', value: 'webhook' },
  { label: 'Cookie', value: 'cookie' },
]

watch(() => props.show, (v) => {
  if (v && props.accountId && props.platformId) {
    const platform = platformsStore.platforms.find((p) => p.id === props.platformId)
    const account = platform?.accounts.find((a) => a.id === props.accountId)
    if (account) {
      accountName.value = account.name
      credentialType.value = account.credentials.type
      autoRefresh.value = account.autoRefresh
      // 明文不会从 API 返回,编辑时用户需要重新输入
      username.value = ''
      password.value = ''
    }
  } else if (v) {
    accountName.value = ''
    credentialType.value = 'password'
    username.value = ''
    password.value = ''
    autoRefresh.value = false
  }
})

async function handleSave() {
  if (!props.platformId) return
  if (!accountName.value) {
    message.warning(t('envclaw.platforms.accountName') + ' is required')
    return
  }

  const credentials: Record<string, any> = {}
  if (credentialType.value === 'password') {
    credentials.username = username.value
    credentials.password = password.value
  } else if (credentialType.value === 'api_key') {
    credentials.apiKey = password.value
  } else if (credentialType.value === 'webhook') {
    credentials.webhookUrl = password.value
  }

  try {
    if (props.accountId) {
      await platformsStore.updateAccount(props.platformId, props.accountId, {
        name: accountName.value,
        credentialType: credentialType.value as any,
        credentials: Object.values(credentials).some(v => v) ? credentials : undefined,
        autoRefresh: autoRefresh.value,
      })
    } else {
      await platformsStore.addAccount(props.platformId, {
        name: accountName.value,
        credentialType: credentialType.value as any,
        credentials,
        autoRefresh: autoRefresh.value,
      })
    }
    message.success(t('common.saved'))
    emit('update:show', false)
    emit('saved')
  } catch (err: any) {
    message.error(err.message)
  }
}
</script>

<template>
  <NDrawer :show="show" :width="420" placement="right" @update:show="emit('update:show', $event)">
    <NDrawerContent :title="accountId ? t('envclaw.platforms.editAccount') : t('envclaw.platforms.addAccount')" closable>
      <div class="field">
        <label>{{ t('envclaw.platforms.accountName') }}</label>
        <NInput v-model:value="accountName" :placeholder="t('envclaw.platforms.accountName')" />
      </div>

      <div class="field">
        <label>{{ t('envclaw.platforms.credentialType') }}</label>
        <NSelect v-model:value="credentialType" :options="credentialTypeOptions" />
      </div>

      <div v-if="credentialType === 'password'" class="field">
        <label>{{ t('envclaw.platforms.username') }}</label>
        <NInput v-model:value="username" />
      </div>

      <div class="field">
        <label>{{ credentialType === 'api_key' ? 'API Key' : credentialType === 'webhook' ? t('envclaw.platforms.webhookUrl') : t('envclaw.platforms.password') }}</label>
        <NInput v-model:value="password" :type="showPassword ? 'text' : 'password'" show-password-on="click" />
      </div>

      <div class="field">
        <label>{{ t('envclaw.platforms.autoRefresh') }}</label>
        <div class="switch-row">
          <NSwitch v-model:value="autoRefresh" />
          <span class="switch-hint">{{ t('envclaw.platforms.autoRefreshHint') }}</span>
        </div>
      </div>

      <template #footer>
        <NButton type="primary" @click="handleSave">{{ t('common.save') }}</NButton>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped lang="scss">
.field { margin-bottom: 18px; }
label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; }
.switch-row { display: flex; align-items: center; gap: 10px; }
.switch-hint { font-size: 11px; color: #a0a0a0; }
</style>
```

- [ ] **Step 5: 实现 PlatformsPage 完整页面**

替换 `packages/client/src/views/envclaw/PlatformsPage.vue`:

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NButton, NSelect, NInput, useMessage, useDialog } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { usePlatformsStore } from '@/stores/envclaw/platforms'
import type { Platform } from '@/api/envclaw/platforms'
import PlatformCard from '@/components/envclaw/platforms/PlatformCard.vue'
import PlatformConfigDrawer from '@/components/envclaw/platforms/PlatformConfigDrawer.vue'
import AccountDrawer from '@/components/envclaw/platforms/AccountDrawer.vue'

const { t } = useI18n()
const message = useMessage()
const dialog = useDialog()
const platformsStore = usePlatformsStore()

onMounted(() => { void platformsStore.fetchPlatforms() })

// --- 新建平台 ---
const showCreateForm = ref(false)
const newName = ref('')
const newType = ref('custom')
const typeOptions = [
  { label: t('envclaw.platforms.types.mapairs'), value: 'mapairs' },
  { label: t('envclaw.platforms.types.national_station'), value: 'national_station' },
  { label: t('envclaw.platforms.types.oa'), value: 'oa' },
  { label: t('envclaw.platforms.types.feishu'), value: 'feishu' },
  { label: t('envclaw.platforms.types.dingtalk'), value: 'dingtalk' },
  { label: t('envclaw.platforms.types.custom'), value: 'custom' },
]

async function handleCreate() {
  if (!newName.value.trim()) {
    message.warning('Name is required')
    return
  }
  try {
    await platformsStore.createPlatform({ type: newType.value as any, name: newName.value.trim() })
    newName.value = ''
    newType.value = 'custom'
    showCreateForm.value = false
    message.success(t('common.saved'))
  } catch (err: any) {
    message.error(err.message)
  }
}

// --- 配置抽屉 ---
const configDrawerShow = ref(false)
const configPlatform = ref<Platform | null>(null)

function openConfig(platform: Platform) {
  configPlatform.value = platform
  configDrawerShow.value = true
}

// --- 账号抽屉 ---
const accountDrawerShow = ref(false)
const accountPlatformId = ref<string | null>(null)
const accountAccountId = ref<string | null>(null)

function openAddAccount(platformId: string) {
  accountPlatformId.value = platformId
  accountAccountId.value = null
  accountDrawerShow.value = true
}

function openEditAccount(platformId: string, accountId: string) {
  accountPlatformId.value = platformId
  accountAccountId.value = accountId
  accountDrawerShow.value = true
}

async function handleDeleteAccount(platformId: string, accountId: string) {
  try {
    await platformsStore.deleteAccount(platformId, accountId)
    message.success(t('common.saved'))
  } catch (err: any) {
    message.error(err.message)
  }
}

async function handleDeletePlatform(platformId: string) {
  try {
    await platformsStore.deletePlatform(platformId)
    message.success(t('common.saved'))
  } catch (err: any) {
    message.error(err.message)
  }
}

async function refreshData() {
  await platformsStore.fetchPlatforms()
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>{{ t('envclaw.platforms.title') }}</h1>
        <p class="sub">{{ t('envclaw.platforms.description') }}</p>
      </div>
      <NButton type="primary" @click="showCreateForm = true">
        + {{ t('envclaw.platforms.addPlatform') }}
      </NButton>
    </div>

    <!-- 新建表单(内联) -->
    <div v-if="showCreateForm" class="create-form">
      <NSelect v-model:value="newType" :options="typeOptions" style="width: 160px" />
      <NInput v-model:value="newName" :placeholder="t('envclaw.platforms.platformName')" style="flex:1" @keyup.enter="handleCreate" />
      <NButton type="primary" @click="handleCreate">{{ t('common.confirm') }}</NButton>
      <NButton @click="showCreateForm = false">{{ t('common.cancel') }}</NButton>
    </div>

    <!-- 平台列表 -->
    <div v-if="platformsStore.platforms.length === 0 && !showCreateForm" class="empty">
      {{ t('envclaw.platforms.noPlatforms') }}
    </div>

    <PlatformCard
      v-for="p in platformsStore.platforms"
      :key="p.id"
      :platform="p"
      @config="openConfig"
      @add-account="openAddAccount"
      @edit-account="openEditAccount"
      @delete-account="handleDeleteAccount"
      @deleted="handleDeletePlatform"
    />

    <!-- 配置抽屉 -->
    <PlatformConfigDrawer
      v-model:show="configDrawerShow"
      :platform="configPlatform"
      @saved="refreshData"
    />

    <!-- 账号抽屉 -->
    <AccountDrawer
      v-model:show="accountDrawerShow"
      :platform-id="accountPlatformId"
      :account-id="accountAccountId"
      @saved="refreshData"
    />
  </div>
</template>

<style scoped lang="scss">
.page { max-width: 1080px; margin: 0 auto; padding: 28px 32px 48px; }
.page-head { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 22px; }
h1 { font-size: 20px; font-weight: 600; }
.sub { color: #a0a0a0; font-size: 13px; margin-top: 4px; }

.create-form {
  display: flex; gap: 10px; align-items: center;
  background: #2a2a2a; border: 1px solid #3a3a3a; border-radius: 8px;
  padding: 12px 16px; margin-bottom: 20px;
}

.empty { color: #666; font-size: 13px; padding: 40px 0; text-align: center; }
</style>
```

- [ ] **Step 6: 运行构建确认**

Run: `npm run build`
Expected: 成功

---

## Task 5: 集成验证

- [ ] **Step 1: 运行全部测试**

Run: `npm run test`
Expected: 加密测试通过,无回归

- [ ] **Step 2: 运行 dev 端到端验证**

Run: `npm run dev`

验证项:
1. 访问 `/#/envclaw/platforms` 显示平台管理页
2. 点击"添加平台"→ 选择类型+输入名称 → 确认 → 新平台出现在列表
3. 点击"配置"→ 右侧抽屉打开 → 填写操作提示词/添加功能 → 保存 → 卡片摘要更新
4. 点击"添加账号"→ 右侧小抽屉 → 填写账号密码 → 保存 → 卡片显示新账号
5. 点击账号"编辑"→ 抽屉打开,凭据显示掩码 → 可修改保存
6. 点击"删除平台"→ 确认弹窗 → 平台从列表消失
7. 工作台首页平台条更新(因为 store 共享)

---

## Phase 2 Self-Review

### 1. Spec Coverage

| 设计文档 §3.3 需求 | 覆盖 Task |
|---|---|
| 平台四要素(凭据/提示词/技能/功能) | Task 1 (service) + Task 4 (UI) |
| 凭据 AES-256 加密存储 | Task 1 (crypto.ts) |
| 前端只显示掩码 | Task 1 (maskCredentials) + Task 3 (API 类型 PlatformAccountMasked) |
| 多账号 | Task 1 (addAccount/updateAccount/deleteAccount) + Task 4 (AccountDrawer) |
| 账号在卡片子行,配置在抽屉(不含账号) | Task 4 (PlatformCard + PlatformConfigDrawer + AccountDrawer 职责划分) |
| 与新建任务联动(功能/技能/提示词自动带出) | Phase 3 消费 platforms store 的数据 |

### 2. Placeholder Scan

无 TBD/TODO。`skillOptions` 在 PlatformConfigDrawer 中初始化为空数组——这是因为技能列表走 `GET /api/hermes/skills` 已有 API,Phase 4 技能库页会完整实现技能选择,当前先用 NSelect tag 模式允许手动输入技能名。

### 3. Type Consistency

- 后端 `rowToPlatform()` 输出的字段名(camelCase)与前端 `Platform` 接口一致
- `PlatformFunction` 后端 `{id, name, prompt}` ↔ 前端 `{id, name, prompt}` 一致
- `PlatformAccountMasked.credentials` 的结构与后端 `maskCredentials()` 输出一致
- Phase 1 占位 store 中的 `Platform` 类型定义在此 Task 3 中被完整替换,Phase 1 的 PlatformBar 组件消费 `platformsStore.platforms` 类型不变
