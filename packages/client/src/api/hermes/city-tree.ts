import { request } from '@/api/client'

/** 级联树节点 */
export interface RegionTreeNode {
  label: string
  value: string
  provinceCodeVO?: string  // 对应 concentrationranking.vue 的 province 参数
  children?: RegionTreeNode[]
}

/** 从 envclaw 后端代理获取城市级联树（radio='no' 含全部城市） */
export async function fetchCityRegionTree(v5Token?: string): Promise<{ tree: RegionTreeNode[] }> {
  const headers: Record<string, string> = {}
  if (v5Token) headers['X-V5-Token'] = v5Token
  return request('/api/hermes/city-region-tree', {
    method: 'POST',
    headers,
    body: JSON.stringify({ radio: 'no' }),
  })
}
