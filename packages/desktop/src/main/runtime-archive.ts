import { basename } from 'node:path'
import * as tar from 'tar'

// macOS bsdtar stores extended attributes as AppleDouble `._*` companion
// entries. The Node tar library does not interpret them and would write them
// out as regular files; stray `._*.py` files then crash hermes-agent tool
// discovery with UnicodeDecodeError. Skip them on extraction.
function isAppleDoubleEntry(path: string): boolean {
  return basename(path).startsWith('._')
}

export async function extractTarGzipArchive(archive: string, targetRoot: string): Promise<void> {
  await tar.x({
    file: archive,
    cwd: targetRoot,
    preserveOwner: false,
    unlink: true,
    filter: path => !isAppleDoubleEntry(path),
  })
}
