import { Context } from 'koa'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { detectHermesHome } from '../../services/hermes/hermes-path'

/**
 * GET /api/hermes/channel-contacts
 * 读取 ~/.hermes/channel_directory.json，返回各平台的联系人列表
 */
export async function getChannelContacts(ctx: Context) {
  try {
    const hermesHome = detectHermesHome()
    const directoryPath = join(hermesHome, 'channel_directory.json')

    const content = await readFile(directoryPath, 'utf-8')
    const directory = JSON.parse(content)

    const result: Record<string, Array<{ id: string; name: string; type: string }>> = {}

    for (const [platform, contacts] of Object.entries(directory.platforms || {})) {
      if (Array.isArray(contacts) && contacts.length > 0) {
        result[platform] = contacts.map((c: any) => ({
          id: c.id,
          name: c.name || c.id,
          type: c.type || 'dm',
        }))
      }
    }

    ctx.body = { platforms: result }
  } catch (err: any) {
    // 文件不存在或解析失败，返回空对象
    if (err.code === 'ENOENT') {
      ctx.body = { platforms: {} }
      return
    }
    console.error('Failed to read channel_directory.json:', err)
    ctx.status = 500
    ctx.body = { error: 'Failed to read channel contacts' }
  }
}
