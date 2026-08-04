export interface ProtoTemplate {
  id: string; name: string; source: 'system' | 'mine' | 'imported'
  favorite: boolean; desc: string
  caps: string[]       // display names
  capIds: string[]     // CapSkill IDs from capabilities page
  schedule: string; deliver: string
  author: string; updated: string; used: number; version: string
  shareMeta?: string
}

export const PROTO_TEMPLATES: ProtoTemplate[] = [
  {
    id:'t1', name:'平顶山日报推送', source:'system', favorite:true,
    desc:'每日 09:00 推送城市空气质量日报，含排名、首要污染物、超标站点',
    caps:['一张图','浓度排名'], capIds:['mapPackage','concentrationRanking'],
    schedule:'每天 09:00', deliver:'企业微信',
    author:'UniEcoClaw 团队', updated:'2026-07-15', used:12, version:'1.4.0',
  },
  {
    id:'t2', name:'臭氧污染简报', source:'system', favorite:false,
    desc:'夏秋臭氧高发期每小时推送 O3 浓度、首要污染物、敏感人群提示',
    caps:['一张图','小时播报'], capIds:['mapPackage','hourlyBrief'],
    schedule:'每小时', deliver:'钉钉',
    author:'UniEcoClaw 团队', updated:'2026-06-22', used:8, version:'1.2.0',
  },
  {
    id:'t3', name:'区域月度考核', source:'system', favorite:false,
    desc:'每月 1 日生成上月区域考核排名表，含同比环比与达标率',
    caps:['浓度排名','监测数据'], capIds:['concentrationRanking','monitoringData'],
    schedule:'每月 1 日 10:00', deliver:'企业微信 + 邮件',
    author:'UniEcoClaw 团队', updated:'2026-05-30', used:4, version:'1.0.2',
  },
  {
    id:'t4', name:'周报定制（我的）', source:'mine', favorite:false,
    desc:'每周一 18:00 汇总本周所有值守任务执行情况，生成周报',
    caps:['一张图','浓度排名','小时播报'], capIds:['mapPackage','concentrationRanking','hourlyBrief'],
    schedule:'每周一 18:00', deliver:'企业微信',
    author:'我', updated:'2026-07-28', used:5, version:'0.3.1',
  },
  {
    id:'t5', name:'早晚高峰监测', source:'mine', favorite:false,
    desc:'工作日 07:30 / 18:00 监测早晚高峰 AQI 与首要污染物变化',
    caps:['一张图','小时播报'], capIds:['mapPackage','hourlyBrief'],
    schedule:'工作日 07:30 / 18:00', deliver:'飞书',
    author:'我', updated:'2026-07-20', used:2, version:'0.1.0',
  },
  {
    id:'t6', name:'省控站点日报同步', source:'imported', favorite:false,
    desc:'从华东区域环境导入的模板：每天 09:30 同步省控站点小时日报',
    caps:['监测数据'], capIds:['monitoringData'],
    schedule:'每天 09:30', deliver:'邮件 + 企业微信',
    author:'华东区域环境 · 王工', updated:'2026-07-25', used:3, version:'0.2.4',
    shareMeta:'来自华东联防联控 · 跨环境导入 07/25',
  },
]

export function getTemplate(id: string): ProtoTemplate | undefined {
  return PROTO_TEMPLATES.find(t => t.id === id)
}
