import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { runDoctor } from '../../src/commands/doctor'
import { writeProfile } from '../../src/lib/config'

const base = join(tmpdir(), `agnostic-doctor-test-${Date.now()}`)
const corePath = join(base, 'core')
const projectDir = join(base, 'proj')
const home = join(base, 'home')

beforeEach(() => {
  mkdirSync(corePath, { recursive: true })
  mkdirSync(projectDir, { recursive: true })
  mkdirSync(home, { recursive: true })
})

afterEach(() => rmSync(base, { recursive: true, force: true }))

describe('runDoctor', () => {
  it('fail quando profile não existe', () => {
    const emptyHome = join(base, 'empty-home')
    mkdirSync(emptyHome, { recursive: true })
    const report = runDoctor(projectDir, emptyHome)
    expect(report.ok).toBe(false)
    expect(report.checks[0].status).toBe('fail')
    expect(report.checks[0].hint).toContain('agnostic config set')
  })

  it('fail quando corePath aponta para diretório inexistente', () => {
    writeProfile({ agnosticCorePath: join(base, 'nao-existe') }, home)
    const report = runDoctor(projectDir, home)
    expect(report.ok).toBe(false)
    expect(report.checks.some(c => c.status === 'fail')).toBe(true)
  })

  it('fail quando corePath existe mas não tem agents/ nem skills/', () => {
    writeProfile({ agnosticCorePath: corePath }, home)
    const report = runDoctor(projectDir, home)
    const coreContent = report.checks.find(c => c.name === 'core-content')
    expect(coreContent?.status).toBe('fail')
  })

  it('warn quando corePath existe mas .adapted/ está vazio', () => {
    mkdirSync(join(corePath, 'agents'), { recursive: true })
    writeFileSync(
      join(corePath, 'agents', 'foo.md'),
      '---\nname: foo\ndescription: bar\n---\n# x',
    )
    writeProfile({ agnosticCorePath: corePath }, home)
    const report = runDoctor(projectDir, home)
    const adaptedCheck = report.checks.find(c => c.name === 'adapted')
    expect(adaptedCheck?.status).toBe('warn')
    expect(adaptedCheck?.hint).toContain('agnostic adapt')
  })

  it('ok-ish quando tudo está presente, com warn apenas para projeto sem .claude/', () => {
    mkdirSync(join(corePath, 'agents'), { recursive: true })
    mkdirSync(join(corePath, '.adapted', 'agents'), { recursive: true })
    writeFileSync(
      join(corePath, 'agents', 'foo.md'),
      '---\nname: foo\ndescription: bar\n---\n# x',
    )
    writeFileSync(
      join(corePath, '.adapted', 'agents', 'foo.md'),
      '---\nname: foo\ndescription: bar\n---\n# x',
    )
    writeProfile({ agnosticCorePath: corePath }, home)
    const report = runDoctor(projectDir, home)
    const coreContent = report.checks.find(c => c.name === 'core-content')
    expect(coreContent?.status).toBe('ok')
    const adapted = report.checks.find(c => c.name === 'adapted')
    expect(adapted?.status).toBe('ok')
    const project = report.checks.find(c => c.name === 'project')
    expect(project?.status).toBe('warn')
  })

  it('detecta arquivos do manifest ausentes em .adapted/', () => {
    mkdirSync(join(corePath, 'agents'), { recursive: true })
    mkdirSync(join(corePath, '.adapted', 'agents'), { recursive: true })
    mkdirSync(join(projectDir, '.claude'), { recursive: true })
    writeFileSync(
      join(corePath, 'agents', 'foo.md'),
      '---\nname: foo\ndescription: bar\n---\n# x',
    )
    writeFileSync(
      join(corePath, '.adapted', 'agents', 'foo.md'),
      '---\nname: foo\ndescription: bar\n---\n# x',
    )
    writeFileSync(
      join(projectDir, '.claude', 'agnostic-manifest.json'),
      JSON.stringify({
        version: '1',
        generatedAt: new Date().toISOString(),
        stack: 'unknown',
        agents: [
          { name: 'foo', role: null, category: null, description: 'bar', installType: 'copy' },
          { name: 'orfao', role: null, category: null, description: 'sumiu', installType: 'copy' },
        ],
        skills: [],
      }),
    )
    writeProfile({ agnosticCorePath: corePath }, home)
    const report = runDoctor(projectDir, home)
    const sync = report.checks.find(c => c.name === 'manifest-sync')
    expect(sync?.status).toBe('warn')
    expect(sync?.message).toContain('1 arquivo')
  })
})
