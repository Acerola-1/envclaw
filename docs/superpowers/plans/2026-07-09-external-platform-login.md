# Mapairs 平台 OAuth2 登录接入实现规划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Hermes Studio 的登录对接 Mapairs 平台（www.mapairs.com）OAuth2 认证。用户用 Mapairs 账号登录后，Hermes 后端自动在本地 SQLite 用户系统中创建/同步该用户，然后签发 Hermes 自有 JWT 完成登录。

## 架构决策：方案 A（后端中转）

Hermes 后端作为中介，前端与 Mapairs 平台不直接通信。`client_id`/`client_secret` 等凭据完全存放在 Hermes 后端，前端只接触 Hermes 自己的 JWT。

**为什么选 A 而不是前端直调 Mapairs：**
- **安全性**：前端无法拿到 Mapairs 的 `access_token`，无法绕过 Hermes 直接调 Mapairs 的其他接口
- **数据真实性**：用户信息（`user_id`、`region` 等）由 Hermes 后端直接从 Mapairs 服务端获取，不依赖前端传递
- **凭据安全**：Mapairs 的 `client_secret` 不泄露到前端代码中

**认证流程：**

```
用户 → Hermes 登录页（输入 Mapairs 账号密码）
  ↓
前端: SM2 加密密码 → POST Hermes /api/auth/external-login
  ↓
Hermes 后端: GET Mapairs /oauth/token (query params + Basic Auth)
  ↓
Mapairs 返回: { user_id, account, nick_name, real_name,
                    detail.region, access_token, ... }
  ↓
Hermes 后端: findUserByExternalId('mapairs', user_id)
  └─ 不存在 → createUser(...) 自动注入到 Hermes 用户系统
  ↓
Hermes 后端: issueUserJwt(user) → 签发 Hermes JWT
  ↓
Hermes 后端返回给前端: { token: "Hermes JWT", userInfo: { account, nickName, realName, region, ... } }
  ↓
前端: setApiKey(token) → localStorage + 更新 UI
```

## 技术栈

- 后端: Koa 2 + Node.js（无新增 OAuth2 依赖，使用原生 fetch）
- 前端: Vue 3 + Naive UI
- 数据库: SQLite（新增 3 个用户字段）
- 密码加密: SM2（前端加密，Hermes 后端直接传密文给 Mapairs）
  - sm2crypto 源码已确认（mapairs `utils/sm2.js`）
  - 依赖: `sm-crypto`（mapairs 项目已用，Hermes 需新装）

## Mapairs 平台接口信息（已确认）

| 项目 | 值 |
|------|-----|
| 平台域名 | `https://www.mapairs.com` |
| Token 接口 | `GET /product/datacenter/api/blade-auth/product/oauth/token`（GET，参数走 query string） |
| Authorization Header | `Basic YWlyX21hbmFnZTphaXJfbWFuYWdlX3NlY3JldA==`（client_id=`air_manage`, client_secret=`air_manage_secret`） |
| Tenant-Id Header | `123456` |
| Query 参数 | `username`, `password`(SM2 密文), `grant_type=password`, `scope=all`, `type=account`, `platform=数智大气密码登录`, `origin=product`, `address`, `device_type=WEB` |
| 用户唯一标识 | `user_id`（如 `1863485419983884289`） |
| SM2 加密 | 前端用 mapairs 项目的 `sm2crypto.encrypt()` |

## Global Constraints

- 后端 JWT 自实现（HS256，`middleware/user-auth.ts`），不使用外部 JWT 库
- 现有本地密码登录保留，作为管理员兜底
- 中文注释，代码保持英文，频繁小提交

## 文件变更总览

```
packages/server/src/
├── services/external-auth.ts        # [新建] Mapairs token 获取服务
├── controllers/auth.ts              # [修改] 新增 externalLogin 控制器
├── routes/auth.ts                   # [修改] 注册 external-login 公开路由
├── middleware/user-auth.ts          # [修改] JWT payload 增加 external 标识
└── db/hermes/users-store.ts         # [修改] UserRecord 扩展 + DB 迁移

packages/client/src/
├── api/auth.ts                      # [修改] 新增外部登录 API（返回 token + userInfo）
├── utils/sm2crypto.ts               # [新建] SM2 加密工具
└── views/LoginView.vue              # [修改] 平台登录为主，本地登录为备用
```

---

## Task 1: 创建 Mapairs 外部认证服务

**Files:** Create `packages/server/src/services/external-auth.ts`

**职责:** 封装 Hermes 后端与 Mapairs 平台之间的 HTTP 通信。Hermes 后端收到前端登录请求后，调用此服务获取 Mapairs token 和用户信息。

- [ ] **Step 1: 创建服务文件**

```typescript
/**
 * Mapairs 平台 OAuth2 token 获取服务
 * 调用 Mapairs 的 /oauth/token 接口（GET, query params）
 * 凭据（client_id/secret）只在这里使用，不泄露到前端
 */

// === Mapairs 平台配置（从代码片段确认，后续可改为环境变量注入）===
const MAPAIRS_BASE_URL = 'https://www.mapairs.com'
const MAPAIRS_TOKEN_PATH = '/product/datacenter/api/blade-auth/product/oauth/token'
const MAPAIRS_BASIC_AUTH = 'Basic YWlyX21hbmFnZTphaXJfbWFuYWdlX3NlY3JldA=='
const MAPAIRS_TENANT_ID = '123456'

// === Mapairs 平台 token 响应结构（从真实响应提取）===
export interface MapairsRegion {
  provinceShortCode: string
  provinceName: string
  parentShortCode: string
  parentName: string
  currentShortCode: string
  currentRegionName: string
  currentRegionLevel: number
  latitude: number
  longitude: number
}

export interface MapairsTokenResponse {
  tenant_id: string
  user_id: string       // 用户唯一标识
  dept_id: string
  post_id: string
  role_id: string
  account: string       // 登录账号
  user_name: string
  nick_name: string
  real_name: string
  role_name: string
  avatar: string
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  detail: {
    type: string
    regionLimit: number
    region: MapairsRegion
    index: string[]
    isTown: number
    situationId: string
    themeName: string
    is_province: number
    isShowWatermark: number
    update: string
  }
  success_code: string
}

// === Hermes 内部使用的用户信息（从 Mapairs 响应中提取必要字段）===
export interface HermesPlatformUserInfo {
  platformUserId: string       // Mapairs user_id
  account: string              // Mapairs 账号
  nickName: string             // 昵称
  realName: string             // 真实姓名
  roleName: string             // 角色名
  avatar: string               // 头像
  region: MapairsRegion        // 行政区信息
}

export interface FetchResult {
  ok: true
  platformResponse: MapairsTokenResponse
  userInfo: HermesPlatformUserInfo  // 提取好的用户信息，方便后续使用
}

export interface FetchError {
  ok: false
  error: string
}

/**
 * 调用 Mapairs 平台获取 token 和用户信息
 * @param username Mapairs 账号
 * @param encryptedPassword 前端 SM2 加密后的密码（hex 字符串）
 * @param address 行政区地址（可选）
 */
export async function fetchPlatformToken(
  username: string,
  encryptedPassword: string,
  address: string = '',
): Promise<FetchResult | FetchError> {
  try {
    const params = new URLSearchParams({
      username,
      password: encryptedPassword,
      grant_type: 'password',
      scope: 'all',
      type: 'account',
      platform: '数智大气密码登录',
      origin: 'product',
      address,
      device_type: 'WEB',
    })

    const res = await fetch(
      `${MAPAIRS_BASE_URL}${MAPAIRS_TOKEN_PATH}?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Authorization': MAPAIRS_BASIC_AUTH,
          'Tenant-Id': MAPAIRS_TENANT_ID,
        },
      }
    )

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, error: `Mapairs API error: ${res.status} ${text}` }
    }

    const data: MapairsTokenResponse = await res.json()

    // 校验关键字段
    if (!data.user_id || !data.access_token) {
      return { ok: false, error: 'Invalid response from Mapairs platform' }
    }

    // 提取 Hermes 需要的用户信息
    const userInfo: HermesPlatformUserInfo = {
      platformUserId: data.user_id,
      account: data.account,
      nickName: data.nick_name,
      realName: data.real_name,
      roleName: data.role_name,
      avatar: data.avatar,
      region: data.detail?.region || {
        provinceShortCode: '', provinceName: '', parentShortCode: '',
        parentName: '', currentShortCode: '', currentRegionName: '',
        currentRegionLevel: 0, latitude: 0, longitude: 0,
      },
    }

    return { ok: true, platformResponse: data, userInfo }
  } catch (err: any) {
    return { ok: false, error: err.message || 'Failed to connect to Mapairs platform' }
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/server/src/services/external-auth.ts
git commit -m "feat: add Mapairs platform token fetch service"
```

---

## Task 2: 扩展用户数据层 + DB 迁移

**Files:**
- Modify `packages/server/src/db/hermes/users-store.ts`
- Modify `packages/server/src/index.ts`（调用迁移）

**Interfaces:**
- 扩展 `UserRecord`: 增加 `external_platform`、`external_user_id`、`external_username`
- 新增 `findUserByExternalId(platform, externalUserId) → UserRecord | null`
- 修改 `createUser`: 支持外部用户（`password` 可选）

- [ ] **Step 1: 扩展 UserRecord 类型**

```typescript
export interface UserRecord {
  id: number
  username: string
  password_hash: string
  role: UserRole
  status: UserStatus
  created_at: number
  updated_at: number
  last_login_at: number | null
  avatar: string
  // 新增：外部平台字段
  external_platform: string | null
  external_user_id: string | null
  external_username: string | null
}
```

- [ ] **Step 2: 添加 DB 迁移函数（幂等）**

在 users-store.ts 末尾添加：

```typescript
/**
 * 给 users 表添加外部平台字段（重复调用安全）
 */
export function migrateAddExternalPlatformFields(): void {
  const columnsToAdd = [
    'external_platform TEXT',
    'external_user_id TEXT',
    'external_username TEXT',
  ]

  for (const colDef of columnsToAdd) {
    const colName = colDef.split(' ')[0]
    try {
      const result = db.prepare(
        `SELECT COUNT(*) as cnt FROM pragma_table_info('${USERS_TABLE}') WHERE name = ?`
      ).get(colName) as { cnt: number }

      if (result && result.cnt === 0) {
        db.exec(`ALTER TABLE ${USERS_TABLE} ADD COLUMN ${colDef}`)
        console.log(`[db] Migration: added column '${colName}' to ${USERS_TABLE}`)
      }
    } catch {
      // 列已存在，静默跳过
    }
  }
}
```

- [ ] **Step 3: 添加按外部 ID 查找用户**

```typescript
export function findUserByExternalId(
  platform: string,
  externalUserId: string,
): UserRecord | null {
  try {
    return db
      .prepare(
        `SELECT * FROM ${USERS_TABLE}
         WHERE external_platform = ? AND external_user_id = ?`
      )
      .get(platform, externalUserId) as UserRecord | null
  } catch {
    return null
  }
}
```

- [ ] **Step 4: 修改 createUser 支持外部用户**

```typescript
export function createUser(input: {
  username: string
  password?: string               // 改为可选
  role?: UserRole
  status?: UserStatus
  profiles?: string[]
  defaultProfile?: string | null
  // 新增
  externalPlatform?: string
  externalUserId?: string
  externalUsername?: string
}): UserRecord | null {
  const now = Date.now()
  const role = input.role || 'admin'
  const status = input.status || 'active'

  const passwordHash = input.password
    ? hashPassword(input.password)
    : ''  // 外部用户无需本地密码哈希

  db.prepare(
    `INSERT INTO ${USERS_TABLE} (
      username, password_hash, role, status, created_at, updated_at,
      external_platform, external_user_id, external_username
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.username,
    passwordHash,
    role,
    status,
    now,
    now,
    input.externalPlatform || null,
    input.externalUserId || null,
    input.externalUsername || null,
  )

  const user = findUserByUsername(input.username)
  if (user) replaceUserProfiles(user.id, input.profiles || [], input.defaultProfile)
  return user
}
```

- [ ] **Step 5: 在 server 启动时调用迁移**

读取 `packages/server/src/index.ts`，在数据库初始化完成、`registerRoutes` 之前添加：

```typescript
import { migrateAddExternalPlatformFields } from './db/hermes/users-store'

// 数据库初始化后
migrateAddExternalPlatformFields()
```

- [ ] **Step 6: 提交**

```bash
git add packages/server/src/db/hermes/users-store.ts packages/server/src/index.ts
git commit -m "feat: add external platform fields to user store with migration"
```

---

## Task 3: 新增 external-login 控制器

**Files:** Modify `packages/server/src/controllers/auth.ts`

**Interfaces:** 新增 `externalLogin(ctx)` 处理 `POST /api/auth/external-login`

**返回结构:** `{ token: string, userInfo: HermesPlatformUserInfo }` — 同时返回 Hermes JWT 和从 Mapairs 获取的用户信息。

- [ ] **Step 1: 添加 import**

```typescript
import { fetchPlatformToken, HermesPlatformUserInfo } from '../services/external-auth'
import {
  findUserByExternalId,
  createUser,
  touchUserLogin,
} from '../db/hermes/users-store'
```

- [ ] **Step 2: 实现 externalLogin 控制器**

在 auth.ts 末尾（`microcontrollerLogin` 之后）添加：

```typescript
/**
 * 外部平台（Mapairs）OAuth2 登录
 * 前端传 Mapairs 账号 + SM2 加密密码 → 后端调 Mapairs 平台 →
 * 自动创建/查找用户 → 签发 Hermes JWT + 返回用户信息
 */
export async function externalLogin(ctx: Context) {
  const { username, password, address } = ctx.request.body as {
    username?: string
    password?: string   // SM2 加密后的密文
    address?: string    // 可选：行政区地址
  }

  if (!username || !password) {
    ctx.status = 400
    ctx.body = { error: 'Username and password are required' }
    return
  }

  const ip = extractIp(ctx)

  // 1. 调 Mapairs 平台获取 token + 用户信息
  const result = await fetchPlatformToken(username, password, address)

  if (!result.ok) {
    recordPasswordFailure(ip)
    ctx.status = 401
    ctx.body = { error: 'Invalid credentials from platform' }
    return
  }

  const { userInfo, platformResponse } = result

  // 2. 在 Hermes 中查找或自动创建用户
  let hermesUser = findUserByExternalId('mapairs', userInfo.platformUserId)

  if (!hermesUser) {
    hermesUser = createUser({
      username: userInfo.nickName || userInfo.account || `user_${userInfo.platformUserId}`,
      role: 'admin',              // 新用户默认 admin
      status: 'active',
      externalPlatform: 'mapairs',
      externalUserId: userInfo.platformUserId,
      externalUsername: userInfo.account,
    })
  }

  if (!hermesUser || hermesUser.status !== 'active') {
    ctx.status = 403
    ctx.body = { error: 'User is disabled or creation failed' }
    return
  }

  // 3. 签发 Hermes JWT
  try {
    const token = await issueUserJwt(hermesUser)
    recordPasswordSuccess(ip)
    touchUserLogin(hermesUser.id)

    // 同时返回用户信息给前端（UI 展示用）
    ctx.body = {
      token,
      userInfo: {
        platformUserId: userInfo.platformUserId,
        account: userInfo.account,
        nickName: userInfo.nickName,
        realName: userInfo.realName,
        roleName: userInfo.roleName,
        avatar: userInfo.avatar,
        region: userInfo.region,
        // 本地 Hermes 用户信息
        hermesUserId: hermesUser.id,
        hermesUsername: hermesUser.username,
        hermesRole: hermesUser.role,
      },
    }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err?.message || 'Failed to issue login token' }
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add packages/server/src/controllers/auth.ts
git commit -m "feat: add externalLogin controller for Mapairs OAuth2"
```

---

## Task 4: 注册 external-login 公开路由

**Files:** Modify `packages/server/src/routes/auth.ts`

- [ ] **Step 1: 在 authPublicRoutes 中注册**

```typescript
// 公开路由（无需认证，在 auth middleware 之前注册）
export const authPublicRoutes = new Router()
authPublicRoutes.get('/api/auth/status', ctrl.authStatus)
authPublicRoutes.post('/api/auth/login', ctrl.login)
authPublicRoutes.post('/api/auth/external-login', ctrl.externalLogin)  // 新增
authPublicRoutes.post('/api/auth/mcu-login', ctrl.microcontrollerLogin)
```

- [ ] **Step 2: 提交**

```bash
git add packages/server/src/routes/auth.ts
git commit -m "feat: register external-login public route"
```

---

## Task 5: JWT Payload 增加外部平台标识

**Files:** Modify `packages/server/src/middleware/user-auth.ts`

**目的:** 前端从 JWT 中可识别当前用户是外部平台用户，便于后续权限系统和 UI 差异化。

- [ ] **Step 1: 扩展 JwtPayload 接口**

```typescript
interface JwtPayload {
  sub: string
  username: string
  role: UserRole
  type: 'access'
  aud: 'hermes-web-ui'
  iat: number
  exp: number
  // 新增
  external_platform?: string
  external_user_id?: string
}
```

- [ ] **Step 2: 修改 signUserJwt 携带外部标识**

```typescript
export function signUserJwt(
  user: Pick<UserRecord, 'id' | 'username' | 'role'> & {
    external_platform?: string | null
    external_user_id?: string | null
  },
  secret: string,
  now = Date.now(),
  expiresSeconds = DEFAULT_EXPIRES_SECONDS,
): string {
  const iat = Math.floor(now / 1000)
  const payload: JwtPayload = {
    sub: String(user.id),
    username: user.username,
    role: user.role,
    type: 'access',
    aud: JWT_AUDIENCE,
    iat,
    exp: iat + expiresSeconds,
  }

  if (user.external_platform) {
    payload.external_platform = user.external_platform
  }
  if (user.external_user_id) {
    payload.external_user_id = user.external_user_id
  }

  const header = base64UrlJson({ alg: 'HS256', typ: 'JWT' })
  const body = base64UrlJson(payload)
  const unsigned = `${header}.${body}`
  return `${unsigned}.${sign(unsigned, secret)}`
}
```

- [ ] **Step 3: 修改 issueUserJwt 传递外部字段**

```typescript
export async function issueUserJwt(
  user: Pick<UserRecord, 'id' | 'username' | 'role'> & {
    external_platform?: string | null
    external_user_id?: string | null
  },
): Promise<string> {
  const secret = await getJwtSecret()
  return signUserJwt(user, secret)
}
```

- [ ] **Step 4: 提交**

```bash
git add packages/server/src/middleware/user-auth.ts
git commit -m "feat: add external platform info to JWT payload"
```

---

## Task 6: 前端 SM2 加密工具

**Files:** Create `packages/client/src/utils/sm2crypto.ts`

**来源:** 已从 mapairs 项目 `E:\project\V5\yutu_ipp-air_web_v5\25\utils\sm2.js` 获取。

- [ ] **Step 1: 创建 sm2crypto.ts**

```typescript
import { sm2 } from 'sm-crypto'

/**
 * SM2 加密工具（用于 Mapairs 平台登录密码加密）
 * 公钥与 Mapairs 平台配对使用
 */
export default class SM2Crypto {
  // Mapairs 平台配对公钥（用于加密，前端安全）
  static publicKey =
    '04dc91c988f238c0b1ec80813654fc76abe3bccd6e054d2f99b3a3af6826b418574fb20a44097a745a80c6d60de5392a055e16d53e4b9297c6a86a247b3c47fcf0'

  /**
   * SM2 加密
   * @param data 明文密码
   * @returns hex 格式密文
   */
  static encrypt(data: string): string {
    try {
      return sm2.doEncrypt(data, this.publicKey, 0) as string
    } catch (error: any) {
      console.error('[SM2Crypto] encrypt failed:', error)
      return ''
    }
  }
}

// 便捷导出
export const sm2Encrypt = SM2Crypto.encrypt.bind(SM2Crypto)
```

**说明:**
- 只导出 `encrypt` 方法（前端只需要加密）
- 移除 `privateKey` 和 `decrypt`（前端不需要解密，私钥不应出现在前端代码中）
- 添加便捷函数 `sm2Encrypt()` 供组件直接调用

- [ ] **Step 2: 安装 SM2 依赖**

```bash
npm install sm-crypto
```

- [ ] **Step 3: 提交**

```bash
git add packages/client/src/utils/sm2crypto.ts
git commit -m "feat: add SM2 crypto utility for platform login"
```

---

## Task 7: 前端新增外部登录 API

**Files:** Modify `packages/client/src/api/auth.ts`

**Interfaces:** 新增 `loginWithExternalPlatform`，返回 `{ token, userInfo }`。

- [ ] **Step 1: 添加类型定义和 API 函数**

```typescript
// 从 Hermes 后端返回的外部登录用户信息
export interface PlatformLoginUserInfo {
  platformUserId: string
  account: string
  nickName: string
  realName: string
  roleName: string
  avatar: string
  region: {
    currentRegionName: string
    provinceName: string
    currentRegionLevel: number
    latitude: number
    longitude: number
  }
  hermesUserId: number
  hermesUsername: string
  hermesRole: string
}

export interface PlatformLoginResult {
  token: string
  userInfo: PlatformLoginUserInfo
}

/**
 * 外部平台（Mapairs）登录
 * 前端传 Mapairs 账号 + SM2 加密密码
 * 后端调 Mapairs 平台验证，返回 Hermes JWT + 用户信息
 */
export async function loginWithExternalPlatform(
  username: string,
  encryptedPassword: string,   // SM2 加密后的密文
  address?: string,            // 可选：行政区
): Promise<PlatformLoginResult> {
  const res = await fetch('/api/auth/external-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      password: encryptedPassword,
      address: address || '',
    }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const err: any = new Error(data.error || 'Platform login failed')
    err.status = res.status
    throw err
  }

  const data: PlatformLoginResult = await res.json()
  return data
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/client/src/api/auth.ts
git commit -m "feat: add external platform login API"
```

---

## Task 8: 前端 LoginView 改为 Mapairs 平台登录

**Files:** Modify `packages/client/src/views/LoginView.vue`

**改动:** 以 Mapairs 平台登录为主入口，本地登录作为备用模式（可切换）。

- [ ] **Step 1: 添加 import 和响应式状态**

```typescript
<script setup lang="ts">
import { ref } from 'vue'
import { setApiKey, hasApiKey } from '@/api/client'
import {
  fetchAuthStatus,
  loginWithPassword,
  loginWithExternalPlatform,
  PlatformLoginUserInfo,
} from '@/api/auth'
import { sm2Encrypt } from '@/utils/sm2crypto'

type LoginMode = 'platform' | 'local'
const loginMode = ref<LoginMode>('platform')   // 默认平台登录
const username = ref('')
const password = ref('')
const address = ref('')
const loading = ref(false)
const errorMsg = ref('')
</script>
```

- [ ] **Step 2: 添加平台登录处理函数**

```typescript
async function handlePlatformLogin() {
  loading.value = true
  errorMsg.value = ''

  try {
    // SM2 加密密码（前端加密）
    const encryptedPassword = sm2Encrypt(password.value)

    const result = await loginWithExternalPlatform(
      username.value.trim(),
      encryptedPassword,
      address.value.trim(),
    )

    // 存储 Hermes JWT
    setApiKey(result.token)

    // 存储用户信息供 UI 使用（可存入 Pinia store）
    // 示例: userStore.setUserInfo(result.userInfo)

    router.replace('/hermes/chat')
  } catch (err: any) {
    if (err.status === 429 || err.status === 503) {
      errorMsg.value = '登录尝试过多，请稍后再试'
    } else {
      errorMsg.value = err.message || '登录失败，请检查账号密码'
    }
  } finally {
    loading.value = false
  }
}
```

- [ ] **Step 3: 修改模板**

```html
<n-card>
  <!-- 登录模式切换 -->
  <div class="login-tabs">
    <n-button
      :type="loginMode === 'platform' ? 'primary' : 'default'"
      size="medium"
      @click="loginMode = 'platform'"
    >
      平台账号登录
    </n-button>
    <n-button
      :type="loginMode === 'local' ? 'primary' : 'default'"
      size="medium"
      @click="loginMode = 'local'"
    >
      本地账号登录
    </n-button>
  </div>

  <!-- 平台登录表单（主入口） -->
  <div v-if="loginMode === 'platform'" class="login-form">
    <n-form>
      <n-form-item label="平台账号">
        <n-input
          v-model:value="username"
          placeholder="请输入 Mapairs 平台账号"
          @keydown.enter="handlePlatformLogin"
        />
      </n-form-item>
      <n-form-item label="平台密码">
        <n-input
          v-model:value="password"
          type="password"
          showPasswordOn="click"
          placeholder="请输入平台密码"
          @keydown.enter="handlePlatformLogin"
        />
      </n-form-item>
      <n-form-item label="行政区">
        <n-input
          v-model:value="address"
          placeholder="可选，如：北京城区"
        />
      </n-form-item>
    </n-form>
    <n-alert v-if="errorMsg" type="error" style="margin-bottom: 12px;">
      {{ errorMsg }}
    </n-alert>
    <n-button type="primary" block :loading="loading" @click="handlePlatformLogin">
      登录
    </n-button>
  </div>

  <!-- 本地登录表单（备用，保留原有逻辑） -->
  <div v-else class="login-form">
    <n-form>
      <n-form-item label="用户名">
        <n-input
          v-model:value="username"
          placeholder="请输入用户名"
          @keydown.enter="handlePasswordLogin"
        />
      </n-form-item>
      <n-form-item label="密码">
        <n-input
          v-model:value="password"
          type="password"
          showPasswordOn="click"
          placeholder="请输入密码"
          @keydown.enter="handlePasswordLogin"
        />
      </n-form-item>
    </n-form>
    <n-alert v-if="errorMsg" type="error" style="margin-bottom: 12px;">
      {{ errorMsg }}
    </n-alert>
    <n-button type="primary" block :loading="loading" @click="handlePasswordLogin">
      登录
    </n-button>
  </div>
</n-card>
```

- [ ] **Step 4: 提交**

```bash
git add packages/client/src/views/LoginView.vue
git commit -m "feat: switch LoginView to Mapairs platform login with local fallback"
```

---

## 完整认证流程总结

```
用户 → Hermes 登录页（输入 Mapairs 账号密码）
  ↓
前端: sm2Encrypt(password)
  └─ POST /api/auth/external-login { username, password(密文), address }
  ↓
Hermes 后端: externalLogin()
  ├─ GET Mapairs /oauth/token (Basic Auth + query params)
  │   → { user_id, account, nick_name, real_name, detail.region, ... }
  │
  ├─ findUserByExternalId('mapairs', user_id)
  │   └─ 不存在 → createUser(...) 自动注入 Hermes 用户系统
  │
  └─ issueUserJwt(user)
  ↓
Hermes 后端返回:
{
  token: "Hermes JWT (含 external_platform='mapairs', external_user_id)",
  userInfo: { account, nickName, realName, region, hermesUserId, ... }
}
  ↓
前端: setApiKey(token) + 更新用户信息 UI + 跳转 /hermes/chat
```

---

## 自检

**Spec coverage:**
- [x] Mapairs OAuth2 对接（GET token 接口，query params，Basic Auth）→ Task 1, 3, 4
- [x] 自动注入用户（按 user_id 查找/创建）→ Task 2, 3
- [x] SM2 加密（前端加密，后端直接传密文给 Mapairs）→ Task 6（源码已确认）, Task 8
- [x] 前端登录入口（平台登录为主，本地登录为备用）→ Task 8
- [x] JWT 携带外部平台标识 → Task 5
- [x] external-login 返回用户信息给前端（nickName、realName、region 等）→ Task 3, 7
- [x] 保留本地登录兜底 → Task 8（模式切换）

**Type consistency:**
- `fetchPlatformToken` (Task 1) → `HermesPlatformUserInfo` → `externalLogin` (Task 3) → `createUser` (Task 2) — 字段对齐 ✓
- `externalLogin` 返回 `userInfo` → `loginWithExternalPlatform` (Task 7) → `LoginView` (Task 8) — 数据流对齐 ✓
- `signUserJwt` (Task 5) ↔ `issueUserJwt` — 签名兼容 ✓

**待补充项（实现时需处理）:**
- [ ] `packages/server/src/index.ts` 中 db 初始化点 → 需读取确认迁移插入位置
- [ ] `createUser` 中 username 可能重复（用 nick_name 作为 username，若重复需加 `_`+随机后缀）
