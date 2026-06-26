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
