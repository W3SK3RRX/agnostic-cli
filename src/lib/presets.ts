import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

export interface Preset {
  agents: string[]
  skills: string[]
}

function presetsDir(base = homedir()): string {
  return join(base, '.config', 'agnostic', 'presets')
}

export function listPresets(base = homedir()): string[] {
  const dir = presetsDir(base)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''))
}

export function readPreset(name: string, base = homedir()): Preset | null {
  const path = join(presetsDir(base), `${name}.json`)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as Preset
  } catch {
    return null
  }
}

export function writePreset(name: string, preset: Preset, base = homedir()): void {
  const dir = presetsDir(base)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${name}.json`), JSON.stringify(preset, null, 2))
}
