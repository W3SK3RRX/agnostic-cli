import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { updateCommand } from '../../src/commands/update'

const base = join(tmpdir(), `agnostic-update-test-${Date.now()}`)
const corePath = join(base, 'agnostic-core')
const projectDir = join(base, 'my-project')

function makeAgentInCore(subdir: string, filename: string, description: string) {
  const dir = join(corePath, 'agents', subdir)
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, filename),
    `---\nname: ${subdir}-${filename.replace(/\.md$/, '')}\ndescription: ${description}\n---\n# content`,
  )
}

function makeAdaptedAgent(name: string, description: string) {
  const dir = join(corePath, '.adapted', 'agents')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, `${name}.md`),
    `---\nname: ${name}\ndescription: ${description}\n---\n# content`,
  )
}

function installCopiedAgent(name: string) {
  const src = join(corePath, '.adapted', 'agents', `${name}.md`)
  const dest = join(projectDir, '.claude', 'agents', `${name}.md`)
  mkdirSync(join(projectDir, '.claude', 'agents'), { recursive: true })
  writeFileSync(dest, readFileSync(src, 'utf-8'))
}

beforeEach(() => {
  mkdirSync(join(corePath, 'agents'), { recursive: true })
  mkdirSync(join(corePath, 'skills'), { recursive: true })
  mkdirSync(join(corePath, '.adapted', 'skills'), { recursive: true })
  mkdirSync(projectDir, { recursive: true })
})

afterEach(() => rmSync(base, { recursive: true, force: true }))

describe('updateCommand manifest', () => {
  it('grava .claude/agnostic-manifest.json após update', async () => {
    makeAgentInCore('reviewers', 'security-reviewer.md', 'Revisa vulnerabilidades')
    makeAdaptedAgent('reviewers-security-reviewer', 'Revisa vulnerabilidades')
    installCopiedAgent('reviewers-security-reviewer')

    await updateCommand(corePath, projectDir)

    const manifestPath = join(projectDir, '.claude', 'agnostic-manifest.json')
    expect(existsSync(manifestPath)).toBe(true)

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    expect(manifest.version).toBe('1')
    expect(manifest.agents).toHaveLength(1)
    expect(manifest.agents[0].name).toBe('reviewers-security-reviewer')
    expect(manifest.agents[0].role).toBe('reviewers')
  })
})

describe('updateCommand orfãos', () => {
  it('lista arquivos órfãos sem abortar update', async () => {
    makeAgentInCore('reviewers', 'security-reviewer.md', 'Revisa vulnerabilidades')
    makeAdaptedAgent('reviewers-security-reviewer', 'Revisa vulnerabilidades')
    installCopiedAgent('reviewers-security-reviewer')

    mkdirSync(join(projectDir, '.claude', 'agents'), { recursive: true })
    writeFileSync(
      join(projectDir, '.claude', 'agents', 'orfao.md'),
      '---\nname: orfao\ndescription: x\n---\n# x',
    )

    await updateCommand(corePath, projectDir)

    expect(existsSync(join(projectDir, '.claude', 'agents', 'reviewers-security-reviewer.md'))).toBe(true)
    expect(existsSync(join(projectDir, '.claude', 'agents', 'orfao.md'))).toBe(true)

    const manifest = JSON.parse(readFileSync(join(projectDir, '.claude', 'agnostic-manifest.json'), 'utf-8'))
    expect(manifest.agents.map((a: { name: string }) => a.name).sort()).toEqual([
      'orfao',
      'reviewers-security-reviewer',
    ])
  })

  it('aborta com mensagem clara quando corePath não tem agents/ nem skills/', async () => {
    rmSync(corePath, { recursive: true, force: true })
    mkdirSync(corePath, { recursive: true })

    await updateCommand(corePath, projectDir)

    expect(existsSync(join(projectDir, '.claude'))).toBe(false)
  })
})
