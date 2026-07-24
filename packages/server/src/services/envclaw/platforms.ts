import { getDb } from '../../db'
import { encrypt, decrypt, mask } from '../../lib/crypto'
import { logger } from '../logger'
import { randomUUID } from 'crypto'
import { writeFileSync, mkdirSync, chmodSync } from 'fs'
import { join } from 'path'
import { config } from '../../config'

/**
 * 数智大气凭证运行时文件路径。
 * 与 DB（AES）互补：DB 为持久化正本，此文件供 Playwright 技能在
 * 任务执行时即时读取明文凭证，从而无需重启 gateway 即可同步最新凭证。
 * 位于 Web UI 家目录下（与 .token 同一信任边界），Unix 下权限 0600。
 */
const MAPAIRS_CRED_FILE = join(config.appHome, '.mapairs-credentials.json')

function writeMapairsCredentialFile(username: string, password: string): void {
  try {
    mkdirSync(config.appHome, { recursive: true })
    const options: any = { encoding: 'utf-8' }
    if (process.platform !== 'win32') options.mode = 0o600
    writeFileSync(MAPAIRS_CRED_FILE, JSON.stringify({ username, password }), options)
    // writeFileSync 的 mode 仅在创建时生效；对已存在文件显式收紧权限。
    if (process.platform !== 'win32') chmodSync(MAPAIRS_CRED_FILE, 0o600)
  } catch (e) {
    logger.warn(e, '[envclaw/platforms] failed to write mapairs credential file')
  }
}

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

  // 初始化内置平台数据
  seedBuiltinPlatforms(db)

  // 启动时对齐运行时凭证文件与数据库中的当前 Mapairs 账号，
  // 修复历史脱节 / 陈旧文件（例如账号在管理页新增但文件未写、或平台 id 变化）。
  try {
    const creds = getMapairsCredentials()
    if (creds && creds.username && creds.password) {
      writeMapairsCredentialFile(creds.username, creds.password)
    }
  } catch (e) {
    logger.warn(e, '[envclaw/platforms] failed to reconcile mapairs credential file on init')
  }
}

/** 初始化内置平台数据（如果不存在） */
function seedBuiltinPlatforms(db: any): void {
  const builtins = [
    {
      id: 'szdq',
      type: 'mapairs',
      name: '数智大气平台',
      url: 'https://www.mapairs.com/lock',
      operation_prompt: '数智大气平台，对数据观测、污染防治提供了丰富的数据支持',
      skills: ['mapairs-automation', 'vercel-labs/agent-browser'],
      functions: [
        { name: '小时播报', prompt: '定位到小时播报页面，勾选行政区、污染因子，截取页面图片' },
        { name: '浓度排名', prompt: '定位到浓度排名页面，查询平顶山市的数据,实现推送,附带对数据的文字总结' },
        { name: '数据监测', prompt: '定位到实时监测页面，提取各点位分钟级PM2.5、AQI、O3数据流，按站点结构化输出…' },
      ],
    },
  ]

  for (const p of builtins) {
    const existing = db.prepare('SELECT id FROM envclaw_platforms WHERE id = ?').get(p.id)
    if (!existing) {
      const ts = now()
      db.prepare(
        'INSERT INTO envclaw_platforms (id, type, name, url, operation_prompt, skills, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(p.id, p.type, p.name, p.url, p.operation_prompt, JSON.stringify(p.skills), ts, ts)

      for (const fn of p.functions) {
        const fnId = randomUUID()
        db.prepare(
          'INSERT INTO envclaw_platform_functions (id, platform_id, name, prompt, created_at) VALUES (?, ?, ?, ?, ?)'
        ).run(fnId, p.id, fn.name, fn.prompt, ts)
      }

      logger.info('[envclaw/platforms] seeded builtin platform: %s', p.id)
    }
  }
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

  const rows = db.prepare('SELECT * FROM envclaw_platforms ORDER BY created_at DESC').all() as unknown as PlatformRow[]
  return rows.map((row) => {
    const functions = db.prepare('SELECT * FROM envclaw_platform_functions WHERE platform_id = ?').all(row.id) as unknown as PlatformFunctionRow[]
    const accounts = db.prepare('SELECT * FROM envclaw_platform_accounts WHERE platform_id = ?').all(row.id) as unknown as PlatformAccountRow[]
    return rowToPlatform(row, functions, accounts)
  })
}

export function getPlatform(id: string): any | null {
  initTable()
  const db = getDb()
  if (!db) return null

  const row = db.prepare('SELECT * FROM envclaw_platforms WHERE id = ?').get(id) as unknown as PlatformRow | undefined
  if (!row) return null
  const functions = db.prepare('SELECT * FROM envclaw_platform_functions WHERE platform_id = ?').all(id) as unknown as PlatformFunctionRow[]
  const accounts = db.prepare('SELECT * FROM envclaw_platform_accounts WHERE platform_id = ?').all(id) as unknown as PlatformAccountRow[]
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

  syncMapairsCredentialFile(db, platformId)
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

  syncMapairsCredentialFile(db, platformId)
  return getPlatform(platformId)
}

export function deleteAccount(platformId: string, accountId: string): any {
  initTable()
  const db = getDb()
  if (!db) throw new Error('Database not available')

  db.prepare('DELETE FROM envclaw_platform_accounts WHERE id=? AND platform_id=?').run(accountId, platformId)
  syncMapairsCredentialFile(db, platformId)
  return getPlatform(platformId)
}

/**
 * 解析真实的 Mapairs 类型平台 id。
 * 内置平台 id 为 'szdq'（type='mapairs'）；此处按 type 匹配，避免写死 id 造成脱节。
 * 兼容历史上直接以 'mapairs' 作为 platform_id 的旧数据。
 */
function resolveMapairsPlatformId(db: any): string | null {
  const byType = db.prepare(
    "SELECT id FROM envclaw_platforms WHERE type = 'mapairs' ORDER BY created_at ASC LIMIT 1"
  ).get() as { id: string } | undefined
  if (byType?.id) return byType.id
  const legacy = db.prepare(
    "SELECT platform_id AS id FROM envclaw_platform_accounts WHERE platform_id = 'mapairs' LIMIT 1"
  ).get() as { id: string } | undefined
  return legacy?.id ?? null
}

/** 若指定平台是 Mapairs 类型，则用其当前(最近更新)账号凭证刷新运行时凭证文件。 */
function syncMapairsCredentialFile(db: any, platformId: string): void {
  try {
    const p = db.prepare('SELECT type FROM envclaw_platforms WHERE id = ?').get(platformId) as { type: string } | undefined
    if (!p || p.type !== 'mapairs') return
    const creds = getMapairsCredentials()
    if (creds && creds.username && creds.password) {
      writeMapairsCredentialFile(creds.username, creds.password)
    }
  } catch (e) {
    logger.warn(e, '[envclaw/platforms] failed to sync mapairs credential file')
  }
}

/**
 * Get the current user's Mapairs credentials (decrypted)
 * @returns { username: string, password: string } | null
 */
export function getMapairsCredentials(): { username: string; password: string } | null {
  initTable()
  const db = getDb()
  if (!db) return null

  const platformId = resolveMapairsPlatformId(db)
  if (!platformId) return null

  // 取该平台下最近更新的账号（对应当前登录 / 最近维护的凭证）
  const row = db.prepare(
    'SELECT credential_data FROM envclaw_platform_accounts WHERE platform_id = ? ORDER BY updated_at DESC, created_at DESC LIMIT 1'
  ).get(platformId) as { credential_data: string } | undefined

  if (!row) return null

  try {
    const credentials = JSON.parse(decrypt(row.credential_data))
    return {
      username: credentials.username || '',
      password: credentials.password || '',
    }
  } catch (e) {
    console.error('[getMapairsCredentials] Failed to decrypt credentials', e)
    return null
  }
}

/**
 * Upsert the Mapairs credentials (AES encrypted) 到真实的 Mapairs 类型平台下。
 * 按 type='mapairs' 解析平台 id（内置为 'szdq'），再按用户名匹配已有账号：
 * 命中则更新，否则取该平台下第一条更新，都没有则新增。
 * 同时刷新运行时凭证文件，供截图技能即时读取。
 */
export function saveMapairsCredentials(username: string, password: string): void {
  initTable()
  const db = getDb()
  if (!db) throw new Error('Database not available')

  const ts = now()
  const encrypted = encrypt(JSON.stringify({ username, password }))
  const platformId = resolveMapairsPlatformId(db) || 'szdq'

  // 优先按用户名匹配同平台账号，避免覆盖他人账号或产生重复
  let existing = db.prepare(
    'SELECT id FROM envclaw_platform_accounts WHERE platform_id = ? AND name = ? ORDER BY created_at ASC LIMIT 1'
  ).get(platformId, username) as { id: string } | undefined
  if (!existing) {
    existing = db.prepare(
      'SELECT id FROM envclaw_platform_accounts WHERE platform_id = ? ORDER BY created_at ASC LIMIT 1'
    ).get(platformId) as { id: string } | undefined
  }

  if (existing) {
    db.prepare(
      'UPDATE envclaw_platform_accounts SET name=?, credential_data=?, credential_type=?, status=?, updated_at=? WHERE id=?'
    ).run(username, encrypted, 'password', 'active', ts, existing.id)
  } else {
    db.prepare(
      'INSERT INTO envclaw_platform_accounts (id, platform_id, name, credential_type, credential_data, status, auto_refresh, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(randomUUID(), platformId, username, 'password', encrypted, 'active', 0, ts, ts)
  }

  // 同步写入运行时凭证文件，供截图技能在任务执行时即时读取（无需重启 gateway）。
  writeMapairsCredentialFile(username, password)
}
