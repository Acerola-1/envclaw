import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as tar from 'tar'
import { afterEach, describe, expect, it } from 'vitest'

describe('desktop runtime archive extraction', () => {
  let tempRoot: string | null = null

  afterEach(() => {
    if (tempRoot) rmSync(tempRoot, { recursive: true, force: true })
    tempRoot = null
  })

  it('extracts gzip tar archives through the Node tar library', async () => {
    tempRoot = mkdtempSync(join(tmpdir(), 'hermes-runtime-extract-'))
    const source = join(tempRoot, 'source')
    const target = join(tempRoot, 'target')
    const archive = join(tempRoot, 'runtime.tar.gz.download')
    mkdirSync(join(source, 'python', 'Scripts'), { recursive: true })
    writeFileSync(join(source, 'python', 'Scripts', 'hermes.exe'), 'launcher', 'utf-8')

    await tar.c({
      file: archive,
      cwd: source,
      gzip: true,
    }, ['python'])
    mkdirSync(target)

    const { extractTarGzipArchive } = await import('../../packages/desktop/src/main/runtime-archive')
    await extractTarGzipArchive(archive, target)

    expect(readFileSync(join(target, 'python', 'Scripts', 'hermes.exe'), 'utf-8')).toBe('launcher')
  })

  it('skips AppleDouble ._* entries emitted by macOS bsdtar', async () => {
    tempRoot = mkdtempSync(join(tmpdir(), 'hermes-runtime-extract-'))
    const source = join(tempRoot, 'source')
    const target = join(tempRoot, 'target')
    const archive = join(tempRoot, 'runtime.tar.gz.download')
    mkdirSync(join(source, 'python', 'tools'), { recursive: true })
    writeFileSync(join(source, 'python', 'tools', 'registry.py'), 'code', 'utf-8')
    // AppleDouble companion files: binary xattr containers, not real modules.
    writeFileSync(join(source, 'python', 'tools', '._registry.py'), Buffer.from([0x00, 0x05, 0x16, 0x07, 0xa3]))
    writeFileSync(join(source, '._python'), Buffer.from([0x00, 0x05, 0x16, 0x07, 0xa3]))

    await tar.c({
      file: archive,
      cwd: source,
      gzip: true,
    }, ['python', '._python'])
    mkdirSync(target)

    const { extractTarGzipArchive } = await import('../../packages/desktop/src/main/runtime-archive')
    await extractTarGzipArchive(archive, target)

    expect(readFileSync(join(target, 'python', 'tools', 'registry.py'), 'utf-8')).toBe('code')
    expect(existsSync(join(target, 'python', 'tools', '._registry.py'))).toBe(false)
    expect(existsSync(join(target, '._python'))).toBe(false)
  })
})
