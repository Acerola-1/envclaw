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
  platformUserId: string
  account: string
  nickName: string
  realName: string
  roleName: string
  avatar: string
  region: MapairsRegion
  v5Token?: string   // Mapairs V5 OAuth2 access_token
}

export interface FetchResult {
  ok: true
  platformResponse: MapairsTokenResponse
  userInfo: HermesPlatformUserInfo
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

    // Mapairs 要求 POST + query params（不是 GET）
    const res = await fetch(
      `${MAPAIRS_BASE_URL}${MAPAIRS_TOKEN_PATH}?${params.toString()}`,
      {
        method: 'POST',
        headers: {
          'Authorization': MAPAIRS_BASIC_AUTH,
          'Tenant-Id': MAPAIRS_TENANT_ID,
        },
      },
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
        provinceShortCode: '',
        provinceName: '',
        parentShortCode: '',
        parentName: '',
        currentShortCode: '',
        currentRegionName: '',
        currentRegionLevel: 0,
        latitude: 0,
        longitude: 0,
      },
      v5Token: data.access_token,
    }

    return { ok: true, platformResponse: data, userInfo }
  } catch (err: any) {
    return { ok: false, error: err.message || 'Failed to connect to Mapairs platform' }
  }
}
