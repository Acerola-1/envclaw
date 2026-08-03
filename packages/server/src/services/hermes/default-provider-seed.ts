import { tmpdir } from 'node:os'
import { config } from '../../config'
import {
  readConfigYamlForProfile,
  saveEnvValueForProfile,
  updateConfigYamlForProfile,
} from '../config-helpers'
import { logger } from '../logger'
import { listProfileNamesFromDisk } from './hermes-profile'

// ─── Bundled default model provider ───
// 随安装包预置的默认模型供应商，使新用户装完即用、无需手动配置。
// 采用「不存在才写入」(seed-if-absent)：仅当 profile 的 config.yaml 尚未设置
// model.provider 时才注入；一旦用户改过或已注入过，绝不覆盖。
//
// ⚠️ 安全提示：API key 会随安装包分发、可被持有安装包者提取。这是刻意的取舍
// （面向内部/可信试用的开箱即用）。可用环境变量 ENVCLAW_DEFAULT_OPENCODE_GO_KEY
// 覆盖此 key，或用 ENVCLAW_DISABLE_DEFAULT_PROVIDER_SEED=1 关闭整个预置。
const DEFAULT_PROVIDER = 'opencode-go'
const DEFAULT_MODEL = 'minimax-m3'
const DEFAULT_API_KEY_ENV = 'OPENCODE_GO_API_KEY'
const BUNDLED_API_KEY = 'sk-3Ly8mbV0i6vEv20Bfb1PviJJlsXHOyN6p7Y9wF1NrgvrCGHBpjOd3GiOuZOaUq1r'

function isEnabledEnv(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase())
}

function isDisabled(): boolean {
  return isEnabledEnv(process.env.ENVCLAW_DISABLE_DEFAULT_PROVIDER_SEED)
}

function bundledApiKey(): string {
  return (process.env.ENVCLAW_DEFAULT_OPENCODE_GO_KEY || '').trim() || BUNDLED_API_KEY
}

function normalizedPathPrefix(pathname: string): string {
  return pathname.replace(/\/+$/, '') + '/'
}

// 与 MCP 自动注入一致：临时目录（如 e2e/沙箱）下不落盘，避免污染。
function shouldSkipTransientHome(): boolean {
  const normalized = normalizedPathPrefix(config.appHome)
  return [tmpdir(), '/tmp', '/private/tmp']
    .filter(Boolean)
    .map(root => normalizedPathPrefix(root))
    .some(root => normalized.startsWith(root))
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function seedProfile(profile: string): Promise<'seeded' | 'unchanged'> {
  const cfg = await readConfigYamlForProfile(profile)
  const model = isRecord(cfg?.model) ? cfg.model : undefined
  const provider = typeof model?.provider === 'string' ? model.provider.trim() : ''
  // 已有 provider（用户已配置或此前已注入）→ 永不覆盖。
  if (provider) return 'unchanged'

  const apiKey = bundledApiKey()
  if (!apiKey) return 'unchanged'

  // 内置 provider：仅需写入 API key（base_url 由 hermes-agent 内置预置提供）。
  await saveEnvValueForProfile(profile, DEFAULT_API_KEY_ENV, apiKey)
  await updateConfigYamlForProfile(profile, (current) => {
    const c = isRecord(current) ? current : {}
    const existingModel = isRecord(c.model) ? c.model : {}
    c.model = { ...existingModel, provider: DEFAULT_PROVIDER, default: DEFAULT_MODEL }
    return c
  })
  return 'seeded'
}

/**
 * 首启注入默认模型 provider（opencode-go + minimax-m3）到各 profile。
 * seed-if-absent：不覆盖用户已配置的 provider；出错不影响启动。
 */
export async function seedDefaultProvider(): Promise<void> {
  if (isDisabled()) {
    logger.info('[default-provider] 预置默认 provider 已被 ENVCLAW_DISABLE_DEFAULT_PROVIDER_SEED 关闭')
    return
  }
  if (shouldSkipTransientHome()) {
    logger.info({ appHome: config.appHome }, '[default-provider] 临时 Web UI home，跳过预置默认 provider')
    return
  }
  const seeded: string[] = []
  for (const profile of listProfileNamesFromDisk()) {
    try {
      if (await seedProfile(profile) === 'seeded') seeded.push(profile)
    } catch (err) {
      logger.warn({ err, profile }, '[default-provider] 预置默认 provider 失败')
    }
  }
  if (seeded.length > 0) {
    logger.info(
      { provider: DEFAULT_PROVIDER, model: DEFAULT_MODEL, profiles: seeded },
      '[default-provider] 已预置默认 provider（首启，未配置时）',
    )
  }
}
