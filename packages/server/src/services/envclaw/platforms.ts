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

  // 初始化内置平台数据
  seedBuiltinPlatforms(db)
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
