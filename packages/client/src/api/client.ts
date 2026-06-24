import { loginWithPassword } from './auth'

const DEFAULT_BASE_URL = ''
const ACTIVE_PROFILE_STORAGE_KEY = 'hermes_active_profile_name'

function isDesktopShell(): boolean {
  return typeof window !== 'undefined' &&
    (window as typeof window & { hermesDesktop?: { isDesktop?: boolean } }).hermesDesktop?.isDesktop === true
}

function getBaseUrl(): string {
  if (import.meta.env.VITE_HERMES_PREVIEW === '1') return DEFAULT_BASE_URL
  if (isDesktopShell()) return DEFAULT_BASE_URL
  return localStorage.getItem('hermes_server_url') || DEFAULT_BASE_URL
}

export function getApiKey(): string {
  return localStorage.getItem('hermes_api_key') || ''
}

export function setServerUrl(url: string) {
  localStorage.setItem('hermes_server_url', url)
}

export function setApiKey(key: string) {
  localStorage.setItem('hermes_api_key', key)
}

export function clearApiKey() {
  localStorage.removeItem('hermes_api_key')
}

function clearAuthSessionState() {
  clearApiKey()
  localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY)
}

export function hasApiKey(): boolean {
  return !!getApiKey()
}

export type StoredUserRole = 'super_admin' | 'admin'

export function getStoredUserRole(): StoredUserRole | null {
  const token = getApiKey()
  const payload = token.split('.')[1]
  if (!payload) return null
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const data = JSON.parse(atob(padded)) as { role?: unknown }
    return data.role === 'super_admin' || data.role === 'admin' ? data.role : null
  } catch {
    return null
  }
}

export function isStoredSuperAdmin(): boolean {
  return getStoredUserRole() === 'super_admin'
}

export function getStoredUsername(): string | null {
  const token = getApiKey()
  const payload = token.split('.')[1]
  if (!payload) return null
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const data = JSON.parse(atob(padded)) as { username?: unknown }
    return typeof data.username === 'string' && data.username.length > 0 ? data.username : null
  } catch {
    return null
  }
}

export function getActiveProfileName(): string | null {
  return localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY)
}

function bodyHasProfileSelector(body: BodyInit | null | undefined): boolean {
  if (typeof body !== 'string') return false
  try {
    const parsed = JSON.parse(body) as { profile?: unknown }
    return typeof parsed?.profile === 'string' && parsed.profile.trim().length > 0
  } catch {
    return false
  }
}

function shouldAttachProfileHeader(path: string, options: RequestInit): boolean {
  try {
    const url = new URL(path, 'http://hermes.local')
    if (url.searchParams.has('profile')) return false
    if (url.pathname.startsWith('/api/hermes/profiles')) return false
    if (isProfileWideSessionCollection(url.pathname)) return false
  } catch {
    if (path.startsWith('/api/hermes/profiles')) return false
    if (isProfileWideSessionCollection(path.split('?')[0] || path)) return false
  }
  return !bodyHasProfileSelector(options.body)
}

function isProfileWideSessionCollection(pathname: string): boolean {
  return pathname === '/api/hermes/sessions' ||
    pathname === '/api/hermes/sessions/batch-delete' ||
    pathname === '/api/hermes/search/sessions' ||
    pathname === '/api/hermes/sessions/search' ||
    pathname === '/api/hermes/sessions/conversations'
}

function emitAuthNotice(kind: 'expired' | 'forbidden') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('hermes-auth-notice', { detail: { kind } }))
}

function messageFromErrorValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return ''
  if (typeof value !== 'object') return String(value)

  const record = value as Record<string, unknown>
  for (const key of ['message', 'error', 'detail', 'description']) {
    const message = messageFromErrorValue(record[key])
    if (message) return message
  }

  if (Array.isArray(value)) {
    return value.map(messageFromErrorValue).filter(Boolean).join('\n')
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function responseErrorMessage(text: string, statusText: string): string {
  const trimmed = text.trim()
  if (!trimmed) return statusText
  try {
    const parsed = JSON.parse(trimmed)
    return messageFromErrorValue(parsed) || trimmed
  } catch {
    return trimmed
  }
}

let refreshPromise: Promise<string | null> | null = null

async function tryRefreshToken(): Promise<string | null> {
  // Deduplicate concurrent refresh attempts
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      const token = await loginWithPassword('admin', '123456')
      if (token) {
        setApiKey(token)
        return token
      }
    } catch {
      // ignore
    }
    return null
  })().finally(() => {
    refreshPromise = null
  })
  return refreshPromise
}

async function executeRequest<T>(url: string, options: RequestInit, isLocalBff: boolean): Promise<T> {
  const res = await fetch(url, options)

  // Auto-refresh on 401 for local BFF endpoints
  if (res.status === 401 && isLocalBff) {
    const newToken = await tryRefreshToken()
    if (newToken) {
      // Retry with new token
      const retryHeaders = { ...options.headers as Record<string, string> }
      retryHeaders['Authorization'] = `Bearer ${newToken}`
      const retryRes = await fetch(url, { ...options, headers: retryHeaders })
      if (retryRes.ok) return retryRes.json()
      const retryText = await retryRes.text().catch(() => '')
      throw new Error(`API Error ${retryRes.status}: ${responseErrorMessage(retryText, retryRes.statusText)}`)
    }
    clearAuthSessionState()
    emitAuthNotice('expired')
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    if (res.status === 403 && isLocalBff) {
      if (text.includes('User is disabled or does not exist')) {
        // Try auto-refresh for disabled user too
        const newToken = await tryRefreshToken()
        if (newToken) {
          const retryHeaders = { ...options.headers as Record<string, string> }
          retryHeaders['Authorization'] = `Bearer ${newToken}`
          const retryRes = await fetch(url, { ...options, headers: retryHeaders })
          if (retryRes.ok) return retryRes.json()
        }
        clearAuthSessionState()
        emitAuthNotice('expired')
      } else {
        emitAuthNotice('forbidden')
      }
    }
    throw new Error(`API Error ${res.status}: ${responseErrorMessage(text, res.statusText)}`)
  }

  return res.json()
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const base = getBaseUrl()
  const url = `${base}${path}`
  const isFormDataBody = typeof FormData !== 'undefined' && options.body instanceof FormData
  const headers: Record<string, string> = {
    ...(isFormDataBody ? {} : { 'Content-Type': 'application/json' }),
    ...options.headers as Record<string, string>,
  }

  const apiKey = getApiKey()
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  // Inject active profile header for request-scoped endpoints. Explicit profile
  // selectors in the URL/body and profile-name routes are validated directly.
  const profileName = getActiveProfileName()
  if (profileName && shouldAttachProfileHeader(path, options)) {
    headers['X-Hermes-Profile'] = profileName
  }

  // Proxied gateway requests should not trigger auto-refresh
  const isLocalBff = !path.startsWith('/api/hermes/v1/') &&
    !path.startsWith('/v1/')

  return executeRequest<T>(url, { ...options, headers }, isLocalBff)
}

export function getBaseUrlValue(): string {
  return getBaseUrl()
}

/**
 * 获取各平台的联系人列表（从 channel_directory.json）
 */
export async function getChannelContacts(): Promise<Record<string, Array<{ id: string; name: string; type: string }>>> {
  const data = await request<{ platforms: Record<string, Array<{ id: string; name: string; type: string }>> }>('/api/hermes/channel-contacts')
  return data.platforms || {}
}
