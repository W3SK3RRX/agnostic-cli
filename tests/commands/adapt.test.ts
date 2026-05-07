import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { adaptCommand } from '../../src/commands/adapt'

const base = join(tmpdir(), `agnostic-adapt-test-${Date.now()}`)
const corePath = join(base, 'agnostic-core')

describe('adaptCommand', () => {
  beforeEach(() => {
    mkdirSync(join(corePath, 'agents'), { recursive: true })
    mkdirSync(join(corePath, 'skills'), { recursive: true })
  })
  afterEach(() => rmSync(base, { recursive: true, force: true }))

  it('copia arquivo que já tem frontmatter válido sem modificar', async () => {
    const content = '---\nname: test-agent\ndescription: Faz X quando Y\n---\n# Conteúdo'
    writeFileSync(join(corePath, 'agents', 'test-agent.md'), content)

    await adaptCommand(corePath, {})

    const adapted = readFileSync(join(corePath, '.adapted', 'agents', 'test-agent.md'), 'utf-8')
    expect(adapted).toBe(content)
  })

  it('gera stub para arquivo sem frontmatter', async () => {
    writeFileSync(join(corePath, 'agents', 'sem-front.md'), '# Só conteúdo')

    await adaptCommand(corePath, {})

    const adapted = readFileSync(join(corePath, '.adapted', 'agents', 'sem-front.md'), 'utf-8')
    expect(adapted).toContain('name: sem-front')
    expect(adapted).toContain('description: ""')
    expect(adapted).toContain('TODO')
    expect(adapted).toContain('# Só conteúdo')
  })

  it('gera stub para arquivo com frontmatter incompleto (sem description)', async () => {
    writeFileSync(join(corePath, 'agents', 'sem-desc.md'), '---\nname: sem-desc\n---\n# Content')

    await adaptCommand(corePath, {})

    const adapted = readFileSync(join(corePath, '.adapted', 'agents', 'sem-desc.md'), 'utf-8')
    expect(adapted).toContain('TODO')
  })

  it('filtra por --agent quando opção está presente', async () => {
    writeFileSync(join(corePath, 'agents', 'alvo.md'), '# Alvo')
    writeFileSync(join(corePath, 'agents', 'outro.md'), '# Outro')

    await adaptCommand(corePath, { agent: 'alvo' })

    expect(existsSync(join(corePath, '.adapted', 'agents', 'alvo.md'))).toBe(true)
    expect(existsSync(join(corePath, '.adapted', 'agents', 'outro.md'))).toBe(false)
  })

  it('processa agents e skills em pastas separadas', async () => {
    writeFileSync(join(corePath, 'agents', 'ag.md'), '# Agent')
    writeFileSync(join(corePath, 'skills', 'sk.md'), '# Skill')

    await adaptCommand(corePath, {})

    expect(existsSync(join(corePath, '.adapted', 'agents', 'ag.md'))).toBe(true)
    expect(existsSync(join(corePath, '.adapted', 'skills', 'sk.md'))).toBe(true)
  })

  it('não lança erro quando diretório agents ou skills não existe', async () => {
    rmSync(join(corePath, 'skills'), { recursive: true })
    writeFileSync(join(corePath, 'agents', 'ag.md'), '# Agent')

    await expect(adaptCommand(corePath, {})).resolves.toBeUndefined()
  })

  it('processa arquivo em subdiretório com nome prefixado', async () => {
    mkdirSync(join(corePath, 'agents', 'reviewers'), { recursive: true })
    const content = '---\nname: security-reviewer\ndescription: Revisa segurança\n---\n# Content'
    writeFileSync(join(corePath, 'agents', 'reviewers', 'security-reviewer.md'), content)

    await adaptCommand(corePath, {})

    const adaptedPath = join(corePath, '.adapted', 'agents', 'reviewers-security-reviewer.md')
    expect(existsSync(adaptedPath)).toBe(true)
    expect(readFileSync(adaptedPath, 'utf-8')).toBe(content)
  })

  it('avisa quando não há arquivos para adaptar (corePath vazio)', async () => {
    rmSync(join(corePath, 'agents'), { recursive: true })
    rmSync(join(corePath, 'skills'), { recursive: true })

    await adaptCommand(corePath, {})

    expect(existsSync(join(corePath, '.adapted'))).toBe(true)
    expect(existsSync(join(corePath, '.adapted', 'agents'))).toBe(false)
  })
})
