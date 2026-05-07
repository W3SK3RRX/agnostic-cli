import { spawnSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { dirname, join } from 'path'

export const DEFAULT_CORE_REPO = 'https://github.com/paulinett1508-dev/agnostic-core.git'

export function defaultCoreDir(home: string = homedir()): string {
  return join(home, '.agnostic', 'core')
}

export function isGitAvailable(): boolean {
  const result = spawnSync('git', ['--version'], { stdio: 'ignore' })
  return result.status === 0
}

export interface CloneResult {
  ok: boolean
  error?: string
}

export function cloneCore(repo: string, destination: string): CloneResult {
  if (!isGitAvailable()) {
    return { ok: false, error: 'git não está disponível no PATH' }
  }
  if (existsSync(destination)) {
    return { ok: false, error: `destino já existe: ${destination}` }
  }
  const parent = dirname(destination)
  if (!existsSync(parent)) mkdirSync(parent, { recursive: true })

  const result = spawnSync('git', ['clone', '--recurse-submodules', repo, destination], {
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    return { ok: false, error: `git clone falhou (exit ${result.status})` }
  }
  return { ok: true }
}
