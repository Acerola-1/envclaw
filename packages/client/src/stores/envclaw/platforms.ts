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
