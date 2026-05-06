import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

export interface AgnosticProfile {
  agnosticCorePath: string
  defaultPreset?: string
}

function configDir(base = homedir()): string {
  return join(base, '.config', 'agnostic')
}

function profilePath(base = homedir()): string {
  return join(configDir(base), 'profile.json')
}

export function readProfile(base = homedir()): AgnosticProfile | null {
  const path = profilePath(base)
  if (!existsSync(path)) return null
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8'))
    if (typeof parsed?.agnosticCorePath !== 'string') return null
    return parsed as AgnosticProfile
  } catch {
    return null
  }
}

export function writeProfile(profile: AgnosticProfile, base = homedir()): void {
  const dir = configDir(base)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(profilePath(base), JSON.stringify(profile, null, 2))
}

export function getCorePath(base = homedir()): string | null {
  return readProfile(base)?.agnosticCorePath ?? null
}
