import { existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

export interface ScannedFile {
  name: string
  srcPath: string
  type: 'agents' | 'skills'
}

export function scanCore(corePath: string): ScannedFile[] {
  const result: ScannedFile[] = []

  for (const type of ['agents', 'skills'] as const) {
    const dir = join(corePath, type)
    if (!existsSync(dir)) continue

    for (const subdir of readdirSync(dir)) {
      const entryPath = join(dir, subdir)
      let stat: ReturnType<typeof statSync>
      try {
        stat = statSync(entryPath)
      } catch {
        continue
      }

      if (stat.isDirectory()) {
        for (const file of readdirSync(entryPath)) {
          if (!file.endsWith('.md')) continue
          result.push({
            name: `${subdir}-${file.replace(/\.md$/, '')}`,
            srcPath: join(entryPath, file),
            type,
          })
        }
      } else if (subdir.endsWith('.md')) {
        result.push({
          name: subdir.replace(/\.md$/, ''),
          srcPath: entryPath,
          type,
        })
      }
    }
  }

  return result
}

export function listAdapted(corePath: string, type: 'agents' | 'skills'): string[] {
  const dir = join(corePath, '.adapted', type)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.endsWith('.md') && statSync(join(dir, f)).isFile())
    .map(f => f.replace(/\.md$/, ''))
}
