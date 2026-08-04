export interface CapSkillParam {
  name: string; type: string; required: boolean; default?: string
}

export interface CapSkill {
  id: string; name: string; platform: string; desc: string; cat: string
  kind: 'config' | 'direct'; params?: CapSkillParam[]
  outputs?: string[]; examples?: string[]; prompt?: string
}

export const MAPAIRS_CAPS: CapSkill[] = [
  {
    id: 'concentrationRanking', name: '浓度排名', platform: '数智大气', cat: 'mapairs', kind: 'config',
    desc: '查询城市/站点浓度排名，支持按行政区、时间类型、污染因子等维度筛选',
    params: [
      { name: '行政区', type: 'string', required: true, default: '平顶山市' },
      { name: '查询维度', type: 'select', required: true, default: '城市' },
      { name: '时间类型', type: 'select', required: true, default: '实时' },
      { name: '污染因子', type: 'multi', required: false, default: 'PM₂.₅' },
      { name: '截图颜色', type: 'select', required: false, default: '浅色' },
      { name: '国标类型', type: 'select', required: false, default: '默认' },
    ],
    outputs: ['排名截图 (PNG)', '数据表格 (CSV)', '文字总结'],
    examples: ['请查询平顶山市的实时浓度排名', '帮我生成郑州市今日AQI排名'],
  },
  {
    id: 'mapPackage', name: '一张图', platform: '数智大气', cat: 'mapairs', kind: 'config',
    desc: '生成数智大气"一张图"截图，支持地图范围、时间类型、地图类型等配置',
    params: [
      { name: '地图范围', type: 'select', required: true, default: '全国' },
      { name: '时间类型', type: 'select', required: true, default: '实时' },
      { name: '地图类型', type: 'select', required: true, default: '监测图' },
      { name: '因子', type: 'select', required: false, default: '首要污染物' },
      { name: '颜色', type: 'select', required: false, default: '浅色' },
    ],
    outputs: ['一张图截图 (PNG)'],
    examples: ['帮我生成全国范围实时监测图', '生成河南省插值图'],
  },
  {
    id: 'hourlyBrief', name: '小时播报', platform: '数智大气', cat: 'mapairs', kind: 'config',
    desc: '生成小时数据播报截图，按行政区、乡镇、污染因子配置',
    params: [
      { name: '行政区', type: 'string', required: true, default: '平顶山市' },
      { name: '查询维度', type: 'select', required: true, default: '城市' },
      { name: '污染因子', type: 'multi', required: false, default: 'AQI' },
      { name: '截图颜色', type: 'select', required: false, default: '浅色' },
      { name: '国标类型', type: 'select', required: false, default: '默认' },
    ],
    outputs: ['小时播报截图 (PNG)'],
    examples: ['帮我生成平顶山市当前的小时播报'],
  },
  {
    id: 'monitoringData', name: '监测数据', platform: '数智大气', cat: 'mapairs', kind: 'config',
    desc: '提取各点位小时/分钟级监测数据，按站点结构化输出',
    params: [
      { name: '行政区', type: 'string', required: true, default: '平顶山市' },
      { name: '时间范围', type: 'select', required: true, default: '最近24小时' },
      { name: '数据粒度', type: 'select', required: true, default: '小时' },
      { name: '污染因子', type: 'multi', required: false, default: 'PM₂.₅' },
    ],
    outputs: ['监测数据表 (CSV/XLSX)', '数据摘要'],
    examples: ['帮我查询平顶山市最近24小时的监测数据'],
  },
]

export function getCapSkill(id: string): CapSkill | undefined {
  return MAPAIRS_CAPS.find(c => c.id === id)
}
