import { copyFileSync, existsSync, mkdirSync, symlinkSync } from 'fs'
import { dirname } from 'path'

export type LinkResult =
  | { success: true; method: 'symlink' | 'copy' }
  | { success: false; error: string }

export function linkFile(source: string, dest: string, forceCopy = false): LinkResult {
  if (!existsSync(source)) {
    return { success: false, error: `Source not found: ${source}` }
  }

  const dir = dirname(dest)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  if (forceCopy) {
    copyFileSync(source, dest)
    return { success: true, method: 'copy' }
  }

  try {
    symlinkSync(source, dest, 'file')
    return { success: true, method: 'symlink' }
  } catch (e: any) {
    if (e.code === 'EPERM' || e.code === 'EACCES') {
      return { success: false, error: 'EPERM' }
    }
    return { success: false, error: e.message as string }
  }
}
