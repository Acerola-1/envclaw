import Router from '@koa/router'
import { fetchFromV5RegionTree } from '../../services/v5/region-tree'
import { fetchV5StationList } from '../../services/v5/station-list'

export const cityTreeRoutes = new Router()

/** 获取用户关联的城市级联数据（代理 V5 后端） */
cityTreeRoutes.post('/api/hermes/city-region-tree', async (ctx: any) => {
  try {
    const v5Token = ctx.headers['x-v5-token'] as string | undefined
    const tree = await fetchFromV5RegionTree('no', v5Token)
    ctx.body = { tree }
  } catch (error: any) {
    ctx.status = 502
    ctx.body = { error: '获取城市数据失败: ' + error.message }
  }
})

/** 获取站点列表（代理 V5 后端 /air/statistics/station/list） */
cityTreeRoutes.post('/api/hermes/station-list', async (ctx: any) => {
  try {
    const { province, region, stationType } = ctx.request.body as {
      province?: string
      region?: string
      stationType?: string
    }
    if (!province || !region || !stationType) {
      ctx.status = 400
      ctx.body = { error: '缺少 province、region 或 stationType 参数' }
      return
    }
    const v5Token = ctx.headers['x-v5-token'] as string | undefined
    const stations = await fetchV5StationList(province, region, stationType, v5Token)
    ctx.body = { stations }
  } catch (error: any) {
    ctx.status = 502
    ctx.body = { error: '获取站点列表失败: ' + error.message }
  }
})
