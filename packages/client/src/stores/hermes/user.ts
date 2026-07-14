import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getApiKey } from '@/api/client'

export interface PlatformUserInfo {
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

const PLATFORM_USER_KEY = 'hermes_platform_user'

function loadStoredUserInfo(): PlatformUserInfo | null {
  try {
    return JSON.parse(localStorage.getItem(PLATFORM_USER_KEY) || 'null') as PlatformUserInfo | null
  } catch {
    return null
  }
}

export const useUserStore = defineStore('user', () => {
  const token = ref(getApiKey() || '')
  const platformUserInfo = ref<PlatformUserInfo | null>(loadStoredUserInfo())
  const loading = ref(false)

  const isLoggedIn = computed(() => !!token.value)
  const userName = computed(() => platformUserInfo.value?.nickName || platformUserInfo.value?.hermesUsername || '')
  const userRole = computed(() => platformUserInfo.value?.hermesRole || '')
  const userAccount = computed(() => platformUserInfo.value?.account || '')

  function setLogin(tokenValue: string, userInfo?: PlatformUserInfo) {
    token.value = tokenValue
    if (userInfo) {
      platformUserInfo.value = userInfo
      try {
        localStorage.setItem(PLATFORM_USER_KEY, JSON.stringify(userInfo))
      } catch {
        // ignore quota errors
      }
    }
  }

  function setUserInfo(userInfo: PlatformUserInfo) {
    platformUserInfo.value = userInfo
    try {
      localStorage.setItem(PLATFORM_USER_KEY, JSON.stringify(userInfo))
    } catch {
      // ignore quota errors
    }
  }

  function logout() {
    token.value = ''
    platformUserInfo.value = null
    try {
      localStorage.removeItem(PLATFORM_USER_KEY)
    } catch {
      // ignore
    }
  }

  return {
    token,
    platformUserInfo,
    loading,
    isLoggedIn,
    userName,
    userRole,
    userAccount,
    setLogin,
    setUserInfo,
    logout,
  }
})
