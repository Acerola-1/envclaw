#!/usr/bin/env node
// One-shot bootstrap for a fresh `git clone`. Runs in this order:
//   1. Verify Node version
//   2. npm install (root + packages/desktop) with China-friendly mirrors
//   3. Repair Electron binary if its install.js silently bailed out (path.txt missing)
//   4. npm run build (Web UI client + server bundle)
//   5. Fetch + install the bundled Hermes runtime into packages/desktop/resources
// After this finishes, `npm run desktop:dev` will launch the desktop app.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir, platform as osPlatform, arch as osArch } from 'node:os'
import pkg from '../package.json' with { type: 'json' }

const ENGINES = pkg.engines || {}

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const args = new Set(process.argv.slice(2))
const SKIP_RUNTIME = args.has('--skip-runtime')
const SKIP_BUILD = args.has('--skip-build')
const WITH_BROWSER = args.has('--with-browser')

const ELECTRON_MIRROR = process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/'
const NPM_REGISTRY = process.env.npm_config_registry || 'https://registry.npmmirror.com/'

function step(title) {
  console.log(`\n[36m▸ ${title}[0m`)
}

function info(msg) {
  console.log(`  ${msg}`)
}

function warn(msg) {
  console.warn(`[33m  ! ${msg}[0m`)
}

function fail(msg) {
  console.error(`[31m✗ ${msg}[0m`)
  process.exit(1)
}

function run(cmd, argv, options = {}) {
  const result = spawnSync(cmd, argv, {
    stdio: 'inherit',
    cwd: options.cwd || ROOT,
    env: { ...process.env, ...(options.env || {}) },
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) {
    fail(`Command failed (exit ${result.status}): ${cmd} ${argv.join(' ')}`)
  }
}

function checkNodeVersion() {
  step('Checking Node.js version')
  const required = String(ENGINES?.node || '').trim()
  const current = process.versions.node
  info(`current: v${current}`)
  if (!required) return
  info(`required: ${required}`)
  // Light-weight check: only enforce the major when the spec is `>=N.x.x`.
  const match = /^>=\s*(\d+)/.exec(required)
  if (!match) return
  const minMajor = Number(match[1])
  const currentMajor = Number(current.split('.')[0])
  if (currentMajor < minMajor) {
    fail(`Node ${current} is too old; this repo needs >=${minMajor}.0.0. Install a newer Node.js (try fnm/nvm).`)
  }
}

function installRootDeps() {
  step('Installing root npm dependencies')
  info(`registry = ${NPM_REGISTRY}`)
  run('npm', ['install', '--no-audit', '--no-fund', `--registry=${NPM_REGISTRY}`], {
    env: {
      npm_config_registry: NPM_REGISTRY,
      ELECTRON_MIRROR,
    },
  })
}

function installDesktopDeps() {
  step('Installing packages/desktop dependencies')
  info(`registry = ${NPM_REGISTRY}`)
  info(`ELECTRON_MIRROR = ${ELECTRON_MIRROR}`)
  run('npm', ['install', '--prefix', 'packages/desktop', '--no-audit', '--no-fund', `--registry=${NPM_REGISTRY}`], {
    env: {
      npm_config_registry: NPM_REGISTRY,
      ELECTRON_MIRROR,
    },
  })
}

// Electron's install.js sometimes returns success without writing path.txt
// when the cached zip is half-broken. Detect and repair.
function repairElectronIfBroken() {
  step('Verifying Electron binary')
  const electronDir = join(ROOT, 'packages', 'desktop', 'node_modules', 'electron')
  const pathTxt = join(electronDir, 'path.txt')
  if (existsSync(pathTxt)) {
    info('Electron OK')
    return
  }

  warn('Electron path.txt missing — re-running its install script')
  // Drop a partial dist if any so the installer re-extracts cleanly.
  const distDir = join(electronDir, 'dist')
  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true, force: true })
  }
  // If the cached zip is corrupt, remove the cache so we re-download.
  const cacheDir = join(homedir(), 'Library', 'Caches', 'electron')
  if (process.platform === 'darwin' && existsSync(cacheDir)) {
    info(`clearing ${cacheDir}`)
    rmSync(cacheDir, { recursive: true, force: true })
  }
  run('node', ['install.js'], {
    cwd: electronDir,
    env: { ELECTRON_MIRROR },
  })
  if (!existsSync(pathTxt)) {
    // Last-ditch: extract the cached zip ourselves.
    info('install.js still did not write path.txt — extracting cached zip manually')
    const cachedZip = findCachedElectronZip(electronDir)
    if (!cachedZip) fail('Could not locate cached Electron zip; please debug manually.')
    if (existsSync(distDir)) rmSync(distDir, { recursive: true, force: true })
    mkdirSync(distDir)
    run('unzip', ['-q', cachedZip, '-d', distDir])
    const platformPath = process.platform === 'darwin'
      ? 'Electron.app/Contents/MacOS/Electron'
      : process.platform === 'win32'
        ? 'electron.exe'
        : 'electron'
    writeFileSync(pathTxt, platformPath)
    info('manually wrote path.txt')
  }
}

function findCachedElectronZip(electronDir) {
  const pkg = JSON.parse(readFileSync(join(electronDir, 'package.json'), 'utf-8'))
  const version = pkg.version
  const platformLabel = process.platform === 'darwin' ? 'darwin' : process.platform === 'win32' ? 'win32' : 'linux'
  const archLabel = osArch()
  const fname = `electron-v${version}-${platformLabel}-${archLabel}.zip`
  const candidates = process.platform === 'darwin'
    ? [join(homedir(), 'Library', 'Caches', 'electron')]
    : process.platform === 'win32'
      ? [join(homedir(), 'AppData', 'Local', 'electron', 'Cache')]
      : [join(homedir(), '.cache', 'electron')]
  for (const root of candidates) {
    if (!existsSync(root)) continue
    const candidate = walkForFile(root, fname, 4)
    if (candidate) return candidate
  }
  return null
}

function walkForFile(root, name, depth) {
  if (depth < 0) return null
  const direct = join(root, name)
  if (existsSync(direct)) return direct
  let entries = []
  try { entries = readdirSync(root, { withFileTypes: true }) } catch { /* unreadable */ }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const found = walkForFile(join(root, entry.name), name, depth - 1)
    if (found) return found
  }
  return null
}

function buildWebUi() {
  step('Building Web UI (client + server bundle)')
  run('npm', ['run', 'build'])
}

function prepareDesktopRuntime() {
  step('Preparing bundled Hermes runtime (Node + Python + hermes-agent)')
  info('Mirrors: nodejs → npmmirror, python-build-standalone → ghproxy.net, pip/uv → tsinghua')
  if (!WITH_BROWSER) {
    info('Skipping bundled browser runtime (Chrome for Testing). Re-run with --with-browser if you need it.')
  }
  const env = {
    HERMES_SKIP_BROWSER_RUNTIME: WITH_BROWSER ? '0' : '1',
  }
  run('npm', ['run', 'desktop:prepare-runtime'], { env })
}

function printNextSteps() {
  console.log('\n[32m✓ Setup complete.[0m')
  console.log('\nNext steps:')
  console.log('  - launch the desktop app:    [36mnpm run desktop:dev[0m')
  console.log('  - launch the browser dev UI: [36mnpm run dev[0m  (then open http://localhost:8649)')
  console.log('  - run the test suite:        [36mnpm test[0m')
}

function main() {
  console.log(`[1mEnvclaw setup[0m — ${osPlatform()} ${osArch()}`)
  if (args.has('--help') || args.has('-h')) {
    console.log(`
Usage: node scripts/setup.mjs [options]

  --skip-build       skip "npm run build" (use when you already built dist/)
  --skip-runtime     skip downloading the desktop Hermes runtime (Python + hermes-agent)
  --with-browser     also install the bundled Chrome for Testing (needs unrestricted GitHub access)
  -h, --help         show this message

Environment overrides:
  ELECTRON_MIRROR             Electron binary mirror (default: ${ELECTRON_MIRROR})
  npm_config_registry         npm registry            (default: ${NPM_REGISTRY})
  HERMES_DESKTOP_GITHUB_PROXY GitHub proxy used for runtime downloads (default: https://ghproxy.net/)
`)
    return
  }

  checkNodeVersion()
  installRootDeps()
  installDesktopDeps()
  repairElectronIfBroken()
  if (!SKIP_BUILD) buildWebUi()
  if (!SKIP_RUNTIME) prepareDesktopRuntime()
  printNextSteps()
}

main()
