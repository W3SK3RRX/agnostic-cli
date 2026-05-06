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

    for (const entry of readdirSync(dir)) {
      const entryPath = join(dir, entry)
      const stat = statSync(entryPath)

      if (stat.isDirectory()) {
        if (!existsSync(entryPath)) continue
        for (const file of readdirSync(entryPath)) {
          if (!file.endsWith('.md')) continue
          result.push({
            name: `${entry}-${file.replace(/\.md$/, '')}`,
            srcPath: join(entryPath, file),
            type,
          })
        }
      } else if (entry.endsWith('.md')) {
        result.push({
          name: entry.replace(/\.md$/, ''),
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
  return readdirSync(dir).filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, ''))
}
