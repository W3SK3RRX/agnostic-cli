import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  deriveRole,
  generateManifest,
  readDescription,
  readManifest,
  writeManifest,
} from '../../src/lib/manifest'

const base = join(tmpdir(), `agnostic-manifest-test-${Date.now()}`)

beforeEach(() => mkdirSync(base, { recursive: true }))
afterEach(() => rmSync(base, { recursive: true, force: true }))

describe('deriveRole', () => {
  it('extrai prefixo de nome com hífen', () => {
    expect(deriveRole('reviewers-security-reviewer')).toBe('reviewers')
  })

  it('retorna null para nome sem hífen', () => {
    expect(deriveRole('onboarding')).toBe(null)
  })
})

describe('readDescription', () => {
  it('extrai description do frontmatter', () => {
    const filePath = join(base, 'agent.md')
    writeFileSync(filePath, '---\nname: test\ndescription: Minha descrição aqui\n---\n\n# Content')
    expect(readDescription(filePath)).toBe('Minha descrição aqui')
  })

  it('retorna string vazia se arquivo não existe', () => {
    expect(readDescription(join(base, 'nonexistent.md'))).toBe('')
  })

  it('retorna string vazia se frontmatter ausente', () => {
    const filePath = join(base, 'nofront.md')
    writeFileSync(filePath, '# Content sem frontmatter')
    expect(readDescription(filePath)).toBe('')
  })
})

describe('generateManifest', () => {
  it('gera estrutura correta com agents e skills', () => {
    const agentMd = join(base, 'security-reviewer.md')
    writeFileSync(agentMd, '---\nname: security-reviewer\ndescription: Revisa vulnerabilidades\n---\n')
    const skillMd = join(base, 'api-hardening.md')
    writeFileSync(skillMd, '---\nname: api-hardening\ndescription: Hardening de API\n---\n')

    const manifest = generateManifest(
      [{ name: 'reviewers-security-reviewer', adaptedPath: agentMd, installType: 'symlink' }],
      [{ name: 'security-api-hardening', adaptedPath: skillMd, installType: 'copy' }],
      'node',
    )

    expect(manifest.version).toBe('1')
    expect(manifest.stack).toBe('node')
    expect(manifest.agents).toHaveLength(1)
    expect(manifest.agents[0].name).toBe('reviewers-security-reviewer')
    expect(manifest.agents[0].role).toBe('reviewers')
    expect(manifest.agents[0].category).toBe(null)
    expect(manifest.agents[0].description).toBe('Revisa vulnerabilidades')
    expect(manifest.agents[0].installType).toBe('symlink')
    expect(manifest.skills).toHaveLength(1)
    expect(manifest.skills[0].name).toBe('security-api-hardening')
    expect(manifest.skills[0].role).toBe(null)
    expect(manifest.skills[0].category).toBe('security')
    expect(manifest.skills[0].installType).toBe('copy')
  })

  it('generatedAt é uma string ISO 8601 válida', () => {
    const manifest = generateManifest([], [], 'unknown')
    expect(new Date(manifest.generatedAt).toISOString()).toBe(manifest.generatedAt)
  })
})

describe('writeManifest / readManifest', () => {
  it('writeManifest cria .claude/agnostic-manifest.json', () => {
    const manifest = generateManifest([], [], 'node')
    writeManifest(manifest, base)
    expect(existsSync(join(base, '.claude', 'agnostic-manifest.json'))).toBe(true)
  })

  it('readManifest retorna objeto parseado', () => {
    const manifest = generateManifest([], [], 'react')
    writeManifest(manifest, base)
    const read = readManifest(base)
    expect(read).not.toBeNull()
    expect(read!.stack).toBe('react')
    expect(read!.version).toBe('1')
  })

  it('readManifest retorna null quando arquivo não existe', () => {
    expect(readManifest(base)).toBeNull()
  })
})
