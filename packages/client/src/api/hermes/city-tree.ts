import { request } from '@/api/client'

/** 级联树节点（V5 /region/tree 实际返回结构） */
export interface RegionTreeNode {
  label: string
  value: string
  fullName?: string         // 完整名称路径（如 "河南省平顶山市"）
  regionKeyVO?: string      // 区域唯一标识 key
  provinceCodeVO?: string   // 对应 province 参数
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

/** V5 返回的站点对象 */
export interface StationItem {
  [key: string]: any
  stationName?: string
  stationCode?: string
  stationType?: string
}

/** 从 envclaw 后端代理获取站点列表（代理 V5 /air/statistics/station/list） */
export async function fetchStationList(
  province: string,
  region: string,
  stationType: string,
  v5Token?: string,
): Promise<{ stations: StationItem[] }> {
  const headers: Record<string, string> = {}
  if (v5Token) headers['X-V5-Token'] = v5Token
  return request('/api/hermes/station-list', {
    method: 'POST',
    headers,
    body: JSON.stringify({ province, region, stationType }),
  })
}
