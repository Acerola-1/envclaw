import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { config } from '../../config'
import { updateConfigYamlForProfile } from '../config-helpers'
import { logger } from '../logger'
import { listProfileNamesFromDisk } from './hermes-profile'

const LEGACY_SERVER_NAME = 'envclaw'
const MANAGED_SERVERS = [
    // { name: 'envclaw-api', toolset: 'api' },
    // { name: 'envclaw-devices', toolset: 'devices' },
    // { name: 'envclaw-use', toolset: 'use' },
] as const
const MANAGED_SERVER_NAMES: Set<string> = new Set(MANAGED_SERVERS.map(server => server.name))
const LEGACY_SERVER_NAMES = new Set([
  LEGACY_SERVER_NAME,
  'hermes-studio',
  'hermes-web-ui-mcp',
  'hermes-studio-mcp',
])
const MANAGED_ENV_KEY = 'HERMES_WEB_UI_MANAGED_MCP'
const LEGACY_COMMANDS = new Set([
  'hermes-lan-peer-mcp',
  'hermes-devices-mcp',
  'hermes-web-ui-mcp',
  'hermes-studio-mcp',
  'envclaw-mcp',
])

export type BundledMcpInjectionStatus = 'injected' | 'updated' | 'unchanged' | 'skipped'

export interface BundledMcpInjectionTargetResult {
  profile: string
  status: BundledMcpInjectionStatus
  reason?: string
}

export interface BundledMcpInjectionResult {
  serverNames: string[]
  command: string
  targets: BundledMcpInjectionTargetResult[]
}

function isEnabledEnv(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase())
}

function isDisabled(): boolean {
  return isEnabledEnv(process.env.HERMES_WEB_UI_DISABLE_MCP_AUTOINJECT)
}

function allowTransientAutoinject(): boolean {
  return isEnabledEnv(process.env.HERMES_WEB_UI_ALLOW_TRANSIENT_MCP_AUTOINJECT)
}

function normalizedPathPrefix(pathname: string): string {
  return pathname.replace(/\/+$/, '') + '/'
}

function isTransientAppHome(appHome: string): boolean {
  const normalized = normalizedPathPrefix(appHome)
  const transientRoots = [tmpdir(), '/tmp', '/private/tmp']
    .filter(Boolean)
    .map(root => normalizedPathPrefix(root))
  return transientRoots.some(root => normalized.startsWith(root))
}

function shouldSkipTransientAutoinject(): boolean {
  return isTransientAppHome(config.appHome) && !allowTransientAutoinject()
}

function isDesktopRuntime(): boolean {
  return String(process.env.HERMES_DESKTOP || '').trim().toLowerCase() === 'true'
}

function candidateBundledMcpScripts(): string[] {
  return [
    process.env.HERMES_WEB_UI_MCP_BIN,
    join(process.cwd(), 'bin/hermes-studio-mcp.mjs'),
    join(__dirname, '../../bin/hermes-studio-mcp.mjs'),
    join(__dirname, '../../../../../bin/hermes-studio-mcp.mjs'),
    join(process.cwd(), 'bin/hermes-web-ui-mcp.mjs'),
    join(__dirname, '../../bin/hermes-web-ui-mcp.mjs'),
    join(__dirname, '../../../../../bin/hermes-web-ui-mcp.mjs'),
  ].filter((value): value is string => !!value)
}

function bundledMcpScriptPath(): string | null {
  return candidateBundledMcpScripts().find(candidate => existsSync(candidate)) || null
}

function managedCommandConfig(toolset: string): Record<string, unknown> {
  if (isDesktopRuntime()) {
    return { command: 'envclaw-mcp', args: [toolset] }
  }

  const bundledScript = bundledMcpScriptPath()
  if (bundledScript) {
    return { command: process.execPath, args: [bundledScript, toolset] }
  }

  logger.warn({ candidates: candidateBundledMcpScripts() }, '[mcp-autoinject] bundled MCP script not found; falling back to PATH command')
  return { command: 'hermes-studio-mcp', args: [toolset] }
}

function managedConfig(profile: string, serverName: string, toolset: string): Record<string, unknown> {
  const env: Record<string, string> = {
    HERMES_WEB_UI_URL: `http://127.0.0.1:${config.port}`,
    HERMES_WEB_UI_HOME: config.appHome,
    HERMES_WEBUI_STATE_DIR: config.appHome,
    HERMES_WEB_UI_PROFILE: profile,
    HERMES_MCP_SERVER_NAME: serverName,
    HERMES_MCP_TOOLSET: toolset,
    [MANAGED_ENV_KEY]: '1',
  }

  return {
    ...managedCommandConfig(toolset),
    env,
    enabled: true,
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isManagedServer(server: unknown): boolean {
  if (!isRecord(server)) return false
  if (isRecord(server.env) && server.env[MANAGED_ENV_KEY] === '1') return true
  return typeof server.command === 'string' && LEGACY_COMMANDS.has(server.command)
}

function sameArgs(existing: Record<string, any>, desired: Record<string, unknown>): boolean {
  const desiredArgs = Array.isArray(desired.args) ? desired.args : undefined
  const existingArgs = Array.isArray(existing.args) ? existing.args : undefined
  if (!desiredArgs && !existingArgs) return true
  if (!desiredArgs || !existingArgs) return false
  return desiredArgs.length === existingArgs.length && desiredArgs.every((arg, index) => existingArgs[index] === arg)
}

function sameConfig(existing: Record<string, any>, desired: Record<string, unknown>): boolean {
  const desiredEnv = desired.env as Record<string, string>
  return existing.command === desired.command &&
    sameArgs(existing, desired) &&
    existing.enabled !== false &&
    isRecord(existing.env) &&
    existing.env.HERMES_WEB_UI_URL === desiredEnv.HERMES_WEB_UI_URL &&
    existing.env.HERMES_WEB_UI_HOME === desiredEnv.HERMES_WEB_UI_HOME &&
    existing.env.HERMES_WEBUI_STATE_DIR === desiredEnv.HERMES_WEBUI_STATE_DIR &&
    existing.env.HERMES_WEB_UI_PROFILE === desiredEnv.HERMES_WEB_UI_PROFILE &&
    existing.env.HERMES_MCP_SERVER_NAME === desiredEnv.HERMES_MCP_SERVER_NAME &&
    existing.env.HERMES_MCP_TOOLSET === desiredEnv.HERMES_MCP_TOOLSET &&
    existing.env.HERMES_WEB_UI_TOKEN === undefined &&
    existing.env[MANAGED_ENV_KEY] === desiredEnv[MANAGED_ENV_KEY]
}

async function injectIntoProfile(profile: string): Promise<BundledMcpInjectionTargetResult> {
  return await updateConfigYamlForProfile(profile, current => {
    const cfg = isRecord(current) ? current : {}
    if (!isRecord(cfg.mcp_servers)) cfg.mcp_servers = {}

    let changed = false
    let injected = false
    let hadManagedExisting = false

    for (const [name, server] of Object.entries(cfg.mcp_servers)) {
      if (MANAGED_SERVER_NAMES.has(name)) continue
      if (LEGACY_SERVER_NAMES.has(name) && !isManagedServer(server)) {
        return {
          data: cfg,
          write: false,
          result: {
            profile,
            status: 'skipped',
            reason: `existing ${name} MCP server is not managed by Envclaw`,
          } satisfies BundledMcpInjectionTargetResult,
        }
      }
      if (isManagedServer(server)) {
        delete cfg.mcp_servers[name]
        changed = true
        hadManagedExisting = true
      }
    }

    for (const server of MANAGED_SERVERS) {
      const desired = managedConfig(profile, server.name, server.toolset)
      const existing = cfg.mcp_servers[server.name]
      if (!existing) {
        cfg.mcp_servers[server.name] = desired
        changed = true
        injected = true
        continue
      }
      hadManagedExisting = true

      if (!isManagedServer(existing)) {
        return {
          data: cfg,
          write: false,
          result: {
            profile,
            status: 'skipped',
            reason: `existing ${server.name} MCP server is not managed by Envclaw`,
          } satisfies BundledMcpInjectionTargetResult,
        }
      }

      if (isRecord(existing) && existing.enabled === false) {
        return {
          data: cfg,
          write: false,
          result: {
            profile,
            status: 'skipped',
            reason: `existing ${server.name} MCP server is disabled by user`,
          } satisfies BundledMcpInjectionTargetResult,
        }
      }

      if (!sameConfig(existing, desired)) {
        cfg.mcp_servers[server.name] = desired
        changed = true
      }
    }

    if (!changed) {
      return {
        data: cfg,
        write: false,
        result: { profile, status: 'unchanged' } satisfies BundledMcpInjectionTargetResult,
      }
    }

    return { data: cfg, result: { profile, status: injected && !hadManagedExisting ? 'injected' : 'updated' } satisfies BundledMcpInjectionTargetResult }
  }) as BundledMcpInjectionTargetResult
}

export async function injectBundledMcpServer(): Promise<BundledMcpInjectionResult> {
  const commandInfo = managedConfig('default', MANAGED_SERVERS[0].name, MANAGED_SERVERS[0].toolset)
  const result: BundledMcpInjectionResult = {
    serverNames: MANAGED_SERVERS.map(server => server.name),
    command: String(commandInfo.command),
    targets: [],
  }

  if (isDisabled()) {
    logger.info('[mcp-autoinject] disabled by HERMES_WEB_UI_DISABLE_MCP_AUTOINJECT')
    return result
  }

  if (shouldSkipTransientAutoinject()) {
    logger.info({ appHome: config.appHome }, '[mcp-autoinject] skipped for transient Web UI home')
    return result
  }

  for (const profile of listProfileNamesFromDisk()) {
    result.targets.push(await injectIntoProfile(profile))
  }

  const changed = result.targets.filter(target => target.status === 'injected' || target.status === 'updated')
  if (changed.length > 0) {
    logger.info({
      serverNames: result.serverNames,
      command: commandInfo.command,
      targets: changed,
    }, '[mcp-autoinject] synced bundled MCP server')
  }

  const skipped = result.targets.filter(target => target.status === 'skipped')
  if (skipped.length > 0) {
    logger.warn({ serverNames: result.serverNames, targets: skipped }, '[mcp-autoinject] skipped unmanaged MCP server entries')
  }

  return result
}

// ─── Bundled third-party HTTP MCP servers ───
// Shipped with Envclaw and seeded into every profile's config.yaml so they are
// available out-of-the-box. sampling/elicitation are disabled because these are
// Spring AI (Java MCP SDK) servers that reject the extended client capabilities
// Hermes advertises by default (rejects Unrecognized field "tools"/"form").
const BUNDLED_HTTP_SERVERS: ReadonlyArray<{ name: string; url: string }> = [
  { name: 'datacenter-statistics', url: 'http://192.168.4.25:8090/product/datacenter/api/mcp' },
  { name: 'ipp-air-mcp-server', url: 'http://192.168.4.25:8090/product/datacenter/api2/mcp' },
]

function bundledHttpServerConfig(url: string): Record<string, unknown> {
  return {
    url,
    sampling: { enabled: false },
    elicitation: { enabled: false },
    enabled: true,
  }
}

async function injectHttpServersIntoProfile(profile: string): Promise<BundledMcpInjectionTargetResult> {
  return await updateConfigYamlForProfile(profile, current => {
    const cfg = isRecord(current) ? current : {}
    if (!isRecord(cfg.mcp_servers)) cfg.mcp_servers = {}

    let injected = false
    for (const server of BUNDLED_HTTP_SERVERS) {
      // Seed-if-absent: never overwrite the user's edits or a user-disabled entry.
      // Deleting an entry re-seeds it on next boot (expected for a bundled server);
      // disabling it (enabled: false) is the supported off switch.
      if (server.name in cfg.mcp_servers) continue
      cfg.mcp_servers[server.name] = bundledHttpServerConfig(server.url)
      injected = true
    }

    if (!injected) {
      return {
        data: cfg,
        write: false,
        result: { profile, status: 'unchanged' } satisfies BundledMcpInjectionTargetResult,
      }
    }
    return { data: cfg, result: { profile, status: 'injected' } satisfies BundledMcpInjectionTargetResult }
  }) as BundledMcpInjectionTargetResult
}

export async function injectBundledHttpMcpServers(): Promise<BundledMcpInjectionResult> {
  const result: BundledMcpInjectionResult = {
    serverNames: BUNDLED_HTTP_SERVERS.map(server => server.name),
    command: '(http)',
    targets: [],
  }

  if (isDisabled()) {
    logger.info('[mcp-autoinject] bundled HTTP MCP servers disabled by HERMES_WEB_UI_DISABLE_MCP_AUTOINJECT')
    return result
  }

  if (shouldSkipTransientAutoinject()) {
    logger.info({ appHome: config.appHome }, '[mcp-autoinject] bundled HTTP MCP servers skipped for transient Web UI home')
    return result
  }

  for (const profile of listProfileNamesFromDisk()) {
    result.targets.push(await injectHttpServersIntoProfile(profile))
  }

  const changed = result.targets.filter(target => target.status === 'injected' || target.status === 'updated')
  if (changed.length > 0) {
    logger.info({ serverNames: result.serverNames, targets: changed }, '[mcp-autoinject] synced bundled HTTP MCP servers')
  }

  return result
}
