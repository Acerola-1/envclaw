import type { Context } from 'koa'
import * as svc from '../../services/envclaw/platforms'

export async function list(ctx: Context) {
  try {
    ctx.body = { platforms: svc.listPlatforms() }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: { message: err.message } }
  }
}

export async function get(ctx: Context) {
  try {
    const platform = svc.getPlatform(ctx.params.id)
    if (!platform) {
      ctx.status = 404
      ctx.body = { error: { message: 'Platform not found' } }
      return
    }
    ctx.body = { platform }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: { message: err.message } }
  }
}

export async function create(ctx: Context) {
  try {
    const body = ctx.request.body as Record<string, any>
    if (!body.name) {
      ctx.status = 400
      ctx.body = { error: { message: 'name is required' } }
      return
    }
    const platform = svc.createPlatform({
      type: body.type,
      name: body.name,
      url: body.url,
      operationPrompt: body.operationPrompt,
      skills: body.skills,
      functions: body.functions,
    })
    ctx.status = 201
    ctx.body = { platform }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: { message: err.message } }
  }
}

export async function update(ctx: Context) {
  try {
    const body = ctx.request.body as Record<string, any>
    const platform = svc.updatePlatform(ctx.params.id, {
      type: body.type,
      name: body.name,
      url: body.url,
      operationPrompt: body.operationPrompt,
      skills: body.skills,
      functions: body.functions,
    })
    ctx.body = { platform }
  } catch (err: any) {
    if (err.message === 'Platform not found') {
      ctx.status = 404
    } else {
      ctx.status = 500
    }
    ctx.body = { error: { message: err.message } }
  }
}

export async function remove(ctx: Context) {
  try {
    const ok = svc.deletePlatform(ctx.params.id)
    if (!ok) {
      ctx.status = 404
      ctx.body = { error: { message: 'Platform not found' } }
      return
    }
    ctx.body = { ok: true }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: { message: err.message } }
  }
}

// --- 账号 ---

export async function addAccount(ctx: Context) {
  try {
    const body = ctx.request.body as Record<string, any>
    if (!body.name || !body.credentials) {
      ctx.status = 400
      ctx.body = { error: { message: 'name and credentials are required' } }
      return
    }
    const platform = svc.addAccount(ctx.params.id, {
      name: body.name,
      credentialType: body.credentialType,
      credentials: body.credentials,
      autoRefresh: body.autoRefresh,
    })
    ctx.status = 201
    ctx.body = { platform }
  } catch (err: any) {
    if (err.message === 'Platform not found') {
      ctx.status = 404
    } else {
      ctx.status = 500
    }
    ctx.body = { error: { message: err.message } }
  }
}

export async function updateAccount(ctx: Context) {
  try {
    const body = ctx.request.body as Record<string, any>
    const platform = svc.updateAccount(ctx.params.id, ctx.params.accountId, {
      name: body.name,
      credentialType: body.credentialType,
      credentials: body.credentials,
      autoRefresh: body.autoRefresh,
    })
    ctx.body = { platform }
  } catch (err: any) {
    if (err.message === 'Platform not found') {
      ctx.status = 404
    } else {
      ctx.status = 500
    }
    ctx.body = { error: { message: err.message } }
  }
}

export async function deleteAccount(ctx: Context) {
  try {
    const platform = svc.deleteAccount(ctx.params.id, ctx.params.accountId)
    ctx.body = { platform }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: { message: err.message } }
  }
}
