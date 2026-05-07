import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { Stack } from './detect-stack.js'

export interface ManifestEntry {
  name: string
  role: string | null
  category: string | null
  description: string
  installType: 'symlink' | 'copy'
}

export interface AgnosticManifest {
  version: '1'
  generatedAt: string
  stack: Stack
  agents: ManifestEntry[]
  skills: ManifestEntry[]
}

export function deriveRole(name: string): string | null {
  const idx = name.indexOf('-')
  return idx > 0 ? name.slice(0, idx) : null
}

export function readDescription(filePath: string): string {
  if (!existsSync(filePath)) return ''
  const content = readFileSync(filePath, 'utf-8').replace(/^﻿/, '')
  const match = content.match(/^---[\r\n]([\s\S]*?)[\r\n]---/)
  if (!match) return ''
  const line = match[1].split(/\r?\n/).find(l => l.startsWith('description:'))
  if (!line) return ''
  return line.replace(/^description:\s*/, '').trim()
}

export function generateManifest(
  agents: Array<{ name: string; adaptedPath: string; installType: 'symlink' | 'copy' }>,
  skills: Array<{ name: string; adaptedPath: string; installType: 'symlink' | 'copy' }>,
  stack: Stack,
): AgnosticManifest {
  return {
    version: '1',
    generatedAt: new Date().toISOString(),
    stack,
    agents: agents.map(a => ({
      name: a.name,
      role: deriveRole(a.name),
      category: null,
      description: readDescription(a.adaptedPath),
      installType: a.installType,
    })),
    skills: skills.map(s => ({
      name: s.name,
      role: null,
      category: deriveRole(s.name),
      description: readDescription(s.adaptedPath),
      installType: s.installType,
    })),
  }
}

export function writeManifest(manifest: AgnosticManifest, projectDir: string): void {
  const dir = join(projectDir, '.claude')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'agnostic-manifest.json'), JSON.stringify(manifest, null, 2))
}

export function readManifest(projectDir: string): AgnosticManifest | null {
  const filePath = join(projectDir, '.claude', 'agnostic-manifest.json')
  if (!existsSync(filePath)) return null
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as AgnosticManifest
  } catch {
    return null
  }
}
