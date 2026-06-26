import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// 数据源平台账号接口
export interface DataSourceAccount {
  id: string
  username: string
  password: string
  alias: string
  isDefault: boolean
  status: 'available' | 'pending' | 'error'
}

// 数据源平台接口
export interface DataSourcePlatform {
  id: string
  name: string
  icon: string
  level: string  // 国家级/省级/市级
  network: string  // 内网/互联网
  captchaType: string  // 数字验证码/字母+数字验证码/无需验证码
  url: string
  prompt: string
  enabled: boolean
  accounts: DataSourceAccount[]
  expanded: boolean  // 展开/折叠状态
}

// 预置平台列表
const PRESET_PLATFORMS: DataSourcePlatform[] = [
  {
    id: 'shuzhi',
    name: '数智大气',
    icon: '☁️',
    level: '互联网',
    network: '互联网',
    captchaType: '无需验证码',
    url: 'https://shuzhi.yutu.com/',
    prompt: '这是宇图自有平台，互联网环境，无需验证码登录。数据更新及时，排名数据准确，可作为数据交叉验证的参考源。',
    enabled: true,
    accounts: [],
    expanded: false,
  },
  {
    id: 'zhongda',
    name: '中大平台',
    icon: '🏛️',
    level: '国家级',
    network: '内网(VPN)',
    captchaType: '数字验证码',
    url: 'https://www.zjghj.com.cn/',
    prompt: '这是国家级空气质量联网监测管理平台，内网环境，需要数字验证码登录。数据更新通常在每小时整点后5-10分钟，如遇延迟可等待重试。登录失败时请检查VPN连接状态。',
    enabled: true,
    accounts: [],
    expanded: true,  // 默认展开第一个
  },
  {
    id: 'huadong',
    name: '华东平台',
    icon: '🏢',
    level: '省级',
    network: '内网(VPN)',
    captchaType: '字母+数字验证码',
    url: 'https://hndata.henan.gov.cn/',
    prompt: '这是省级城市空气质量大数据综合应用系统，内网环境，需要字母+数字验证码登录。数据更新及时，报表通常在每日9:00-11:00更新完毕。',
    enabled: true,
    accounts: [],
    expanded: false,
  },
  {
    id: 'xiangzhen',
    name: '乡镇数据平台',
    icon: '🏙️',
    level: '市级',
    network: '互联网',
    captchaType: '数字验证码',
    url: '',
    prompt: '',
    enabled: false,
    accounts: [],
    expanded: false,
  },
]

export const useDataSourcePlatformsStore = defineStore('dataSourcePlatforms', () => {
  const platforms = ref<DataSourcePlatform[]>(PRESET_PLATFORMS)
  const loading = ref(false)
  const saving = ref(false)

  // 计算属性
  const enabledPlatforms = computed(() => platforms.value.filter(p => p.enabled))
  const configuredPlatforms = computed(() => platforms.value.filter(p => p.enabled && p.accounts.length > 0))

  // 获取平台
  function getPlatform(id: string): DataSourcePlatform | undefined {
    return platforms.value.find(p => p.id === id)
  }

  // 切换平台展开/折叠
  function toggleExpand(id: string) {
    const platform = getPlatform(id)
    if (platform) {
      platform.expanded = !platform.expanded
    }
  }

  // 添加账号
  function addAccount(platformId: string, account: Omit<DataSourceAccount, 'id' | 'status'>) {
    const platform = getPlatform(platformId)
    if (!platform) return
    const newAccount: DataSourceAccount = {
      ...account,
      id: `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
    }
    if (platform.accounts.length === 0) {
      newAccount.isDefault = true
    }
    platform.accounts.push(newAccount)
  }

  // 编辑账号
  function editAccount(platformId: string, accountId: string, updates: Partial<DataSourceAccount>) {
    const platform = getPlatform(platformId)
    if (!platform) return
    const account = platform.accounts.find(a => a.id === accountId)
    if (!account) return
    Object.assign(account, updates)
  }

  // 删除账号
  function deleteAccount(platformId: string, accountId: string) {
    const platform = getPlatform(platformId)
    if (!platform) return
    const account = platform.accounts.find(a => a.id === accountId)
    if (!account) return
    if (account.isDefault && platform.accounts.length > 1) {
      const firstAccount = platform.accounts.find(a => a.id !== accountId)
      if (firstAccount) {
        firstAccount.isDefault = true
      }
    }
    platform.accounts = platform.accounts.filter(a => a.id !== accountId)
  }

  // 设置默认账号
  function setDefaultAccount(platformId: string, accountId: string) {
    const platform = getPlatform(platformId)
    if (!platform) return
    platform.accounts.forEach(a => {
      a.isDefault = a.id === accountId
    })
  }

  // 更新平台提示词
  function updatePrompt(platformId: string, prompt: string) {
    const platform = getPlatform(platformId)
    if (!platform) return
    platform.prompt = prompt
  }

  // 切换平台启用状态
  function toggleEnabled(platformId: string) {
    const platform = getPlatform(platformId)
    if (!platform) return
    platform.enabled = !platform.enabled
  }

  // 添加新平台
  function addPlatform(platform: Omit<DataSourcePlatform, 'id' | 'expanded'>) {
    const newPlatform: DataSourcePlatform = {
      ...platform,
      id: `platform_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      expanded: true,
    }
    platforms.value.push(newPlatform)
  }

  // 删除平台
  function deletePlatform(platformId: string) {
    const platform = getPlatform(platformId)
    if (!platform) return
    if (PRESET_PLATFORMS.find(p => p.id === platformId)) return
    platforms.value = platforms.value.filter(p => p.id !== platformId)
  }

  // 获取平台的默认账号
  function getDefaultAccount(platformId: string): DataSourceAccount | undefined {
    const platform = getPlatform(platformId)
    return platform?.accounts.find(a => a.isDefault)
  }

  return {
    platforms,
    loading,
    saving,
    enabledPlatforms,
    configuredPlatforms,
    getPlatform,
    toggleExpand,
    addAccount,
    editAccount,
    deleteAccount,
    setDefaultAccount,
    updatePrompt,
    toggleEnabled,
    addPlatform,
    deletePlatform,
    getDefaultAccount,
  }
})