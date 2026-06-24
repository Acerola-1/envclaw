import { readFile, writeFile, readdir } from 'fs/promises'
import { existsSync, readdirSync } from 'fs'
import { createHash } from 'crypto'
import { join, resolve } from 'path'
import { detectHermesRootHome } from './hermes-path'
import { logger } from '../logger'

const MANIFEST_FILENAME = '.webui-managed-soul.json'
const SOUL_FILENAME = 'SOUL.md'
const MANIFEST_OWNER = 'hermes-web-ui'

interface ManagedSoulManifestEntry {
  owner?: string
  source_hash?: string
  installed_hash?: string
}

type ManagedSoulManifest = Record<string, ManagedSoulManifestEntry>

export interface SoulInjectionTargetResult {
  profile?: string
  targetDir: string
  action: 'injected' | 'updated' | 'skipped' | 'unchanged'
}

export interface SoulInjectionResult {
  sourceDir: string
  targets: SoulInjectionTargetResult[]
}

export class HermesSoulInjector {
  private readonly targetDirs: string[]

  constructor(
    private readonly sourceDir = HermesSoulInjector.resolveSourceDir(),
    targetDirOrDirs: string | string[] = HermesSoulInjector.resolveTargetDirs(),
  ) {
    const targetDirs = Array.isArray(targetDirOrDirs) ? targetDirOrDirs : [targetDirOrDirs]
    this.targetDirs = [...new Set(targetDirs.map(targetDir => resolve(targetDir)))]
  }

  static resolveSourceDir(env: NodeJS.ProcessEnv = process.env, baseDir = __dirname): string {
    const override = env.HERMES_WEB_UI_SOULS_DIR?.trim()
    if (override) return resolve(override)

    const candidates = [
      // Production bundle: dist/server/index.js with dist/souls copied by build.
      resolve(baseDir, '../souls'),
      // Development/test: packages/server/src/services/hermes -> packages/souls.
      resolve(baseDir, '../../../../souls'),
      // Running from repository root without bundling.
      resolve(process.cwd(), 'packages/souls'),
    ]

    return candidates.find(candidate => existsSync(candidate)) || candidates[0]
  }

  static resolveTargetDirs(rootDir = detectHermesRootHome()): string[] {
    const root = resolve(rootDir)
    const targetDirs = [root]
    const profilesDir = join(root, 'profiles')

    try {
      const entries = readdirSync(profilesDir, { withFileTypes: true })
        .sort((a, b) => a.name.localeCompare(b.name))
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.trim() && !entry.name.startsWith('.')) {
          targetDirs.push(join(profilesDir, entry.name))
        }
      }
    } catch { /* no named profiles */ }

    return [...new Set(targetDirs.map(targetDir => resolve(targetDir)))]
  }

  private static profileForTargetDir(targetDir: string, rootDir = detectHermesRootHome()): string {
    const root = resolve(rootDir)
    const target = resolve(targetDir)
    if (target === root) return 'default'

    const profilesRoot = resolve(join(root, 'profiles'))
    if (target.startsWith(profilesRoot)) {
      const relative = target.slice(profilesRoot.length).replace(/^[/\\]+/, '')
      const profileName = relative.split(/[/\\]+/)[0]
      return profileName || 'unknown'
    }
    return 'unknown'
  }

  async injectMissingSoul(): Promise<SoulInjectionResult> {
    const result: SoulInjectionResult = {
      sourceDir: this.sourceDir,
      targets: [],
    }

    if (!existsSync(this.sourceDir)) {
      logger.debug('[soul-injector] no bundled souls directory at %s', this.sourceDir)
      return result
    }

    // Find the SOUL.md source file.
    // Supports two layouts:
    //   packages/souls/SOUL.md           (flat)
    //   packages/souls/default/SOUL.md   (subdirectory)
    const sourceSoulPath = await this.resolveSourceSoulPath()
    if (!sourceSoulPath) {
      logger.debug('[soul-injector] no SOUL.md found in %s', this.sourceDir)
      return result
    }

    const sourceContent = await readFile(sourceSoulPath, 'utf-8')
    const sourceHash = hashContent(sourceContent)

    logger.info({
      sourceDir: this.sourceDir,
      sourceSoulPath,
      targetCount: this.targetDirs.length,
    }, '[soul-injector] syncing bundled soul across profiles')

    for (const targetDir of this.targetDirs) {
      const targetResult = await this.injectIntoTarget(targetDir, sourceContent, sourceHash)
      result.targets.push(targetResult)
    }

    const injected = result.targets.filter(t => t.action === 'injected').length
    const updated = result.targets.filter(t => t.action === 'updated').length
    const skipped = result.targets.filter(t => t.action === 'skipped').length

    logger.info({
      sourceDir: this.sourceDir,
      targetCount: result.targets.length,
      injected,
      updated,
      skipped,
    }, '[soul-injector] completed bundled soul sync')

    return result
  }

  private async resolveSourceSoulPath(): Promise<string | null> {
    // Direct SOUL.md in source dir
    const direct = join(this.sourceDir, SOUL_FILENAME)
    if (existsSync(direct)) return direct

    // Look for subdirectories containing SOUL.md
    try {
      const entries = await readdir(this.sourceDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const candidate = join(this.sourceDir, entry.name, SOUL_FILENAME)
          if (existsSync(candidate)) return candidate
        }
      }
    } catch { /* ignore */ }

    return null
  }

  private async injectIntoTarget(
    targetDir: string,
    sourceContent: string,
    sourceHash: string,
  ): Promise<SoulInjectionTargetResult> {
    const profile = HermesSoulInjector.profileForTargetDir(targetDir)
    const targetSoulPath = join(targetDir, SOUL_FILENAME)
    const manifestPath = join(targetDir, MANIFEST_FILENAME)
    const manifest = await this.readManifest(manifestPath)

    if (!existsSync(targetSoulPath)) {
      // No SOUL.md exists — inject it.
      await writeFile(targetSoulPath, sourceContent, 'utf-8')
      manifest[SOUL_FILENAME] = { owner: MANIFEST_OWNER, source_hash: sourceHash, installed_hash: sourceHash }
      await this.writeManifest(manifestPath, manifest)
      logger.info({ profile }, '[soul-injector] injected bundled soul')
      return { profile, targetDir, action: 'injected' }
    }

    const existingContent = await readFile(targetSoulPath, 'utf-8')
    const existingHash = hashContent(existingContent)
    const manifestEntry = manifest[SOUL_FILENAME]
    const isManaged = manifestEntry?.owner === MANIFEST_OWNER

    // Already identical to source — skip.
    if (existingHash === sourceHash) {
      if (!manifestEntry) {
        // Pre-existing identical copy, just claim ownership.
        manifest[SOUL_FILENAME] = { owner: MANIFEST_OWNER, source_hash: sourceHash, installed_hash: existingHash }
        await this.writeManifest(manifestPath, manifest)
      }
      return { profile, targetDir, action: 'unchanged' }
    }

    if (isManaged) {
      const isUnchanged = manifestEntry?.installed_hash === existingHash
      if (isUnchanged) {
        // User hasn't modified since last injection — update to new source.
        await writeFile(targetSoulPath, sourceContent, 'utf-8')
        manifest[SOUL_FILENAME] = { owner: MANIFEST_OWNER, source_hash: sourceHash, installed_hash: sourceHash }
        await this.writeManifest(manifestPath, manifest)
        logger.info({ profile }, '[soul-injector] updated bundled soul')
        return { profile, targetDir, action: 'updated' }
      }
    }

    // User has customized the soul — do not overwrite.
    logger.info({ profile }, '[soul-injector] skipped soul injection (user-modified)')
    return { profile, targetDir, action: 'skipped' }
  }

  private async readManifest(manifestPath: string): Promise<ManagedSoulManifest> {
    try {
      const raw = await readFile(manifestPath, 'utf-8')
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as ManagedSoulManifest : {}
    } catch {
      return {}
    }
  }

  private async writeManifest(manifestPath: string, manifest: ManagedSoulManifest): Promise<void> {
    const sorted: ManagedSoulManifest = {}
    for (const key of Object.keys(manifest).sort()) {
      sorted[key] = manifest[key]
    }
    await writeFile(manifestPath, `${JSON.stringify(sorted, null, 2)}\n`, 'utf-8')
  }
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}
