import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { initCommand } from '../../src/commands/init'

const base = join(tmpdir(), `agnostic-init-test-${Date.now()}`)
const corePath = join(base, 'agnostic-core')
const projectDir = join(base, 'my-project')

function makeAdaptedAgent(name: string, description: string) {
  const dir = join(corePath, '.adapted', 'agents')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, `${name}.md`),
    `---\nname: ${name}\ndescription: ${description}\n---\n\n# content`,
  )
}

beforeEach(() => {
  mkdirSync(projectDir, { recursive: true })
  mkdirSync(join(corePath, '.adapted', 'skills'), { recursive: true })
})

afterEach(() => rmSync(base, { recursive: true, force: true }))

describe('initCommand manifest', () => {
  it('grava .claude/agnostic-manifest.json após init --all --copy', async () => {
    makeAdaptedAgent('reviewers-security-reviewer', 'Revisa vulnerabilidades')

    await initCommand(corePath, projectDir, { all: true, copy: true })

    const manifestPath = join(projectDir, '.claude', 'agnostic-manifest.json')
    expect(existsSync(manifestPath)).toBe(true)

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    expect(manifest.version).toBe('1')
    expect(manifest.agents).toHaveLength(1)
    expect(manifest.agents[0].name).toBe('reviewers-security-reviewer')
    expect(manifest.agents[0].role).toBe('reviewers')
    expect(manifest.agents[0].description).toBe('Revisa vulnerabilidades')
    expect(manifest.agents[0].installType).toBe('copy')
  })
})

describe('initCommand auto-bootstrap', () => {
  it('roda adapt automaticamente quando .adapted/ está vazio mas core tem fontes', async () => {
    rmSync(corePath, { recursive: true, force: true })
    const agentDir = join(corePath, 'agents', 'reviewers')
    mkdirSync(agentDir, { recursive: true })
    writeFileSync(
      join(agentDir, 'sec.md'),
      '---\nname: reviewers-sec\ndescription: revisa\n---\n# x',
    )

    await initCommand(corePath, projectDir, { all: true, copy: true })

    expect(existsSync(join(corePath, '.adapted', 'agents', 'reviewers-sec.md'))).toBe(true)
    expect(existsSync(join(projectDir, '.claude', 'agents', 'reviewers-sec.md'))).toBe(true)
  })
})
