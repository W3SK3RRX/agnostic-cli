import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { detectStack, STACK_AGENTS } from '../../src/lib/detect-stack'

const base = join(tmpdir(), `agnostic-stack-test-${Date.now()}`)

describe('detectStack', () => {
  beforeEach(() => mkdirSync(base, { recursive: true }))
  afterEach(() => rmSync(base, { recursive: true, force: true }))

  it('retorna "react" quando react está em dependencies', () => {
    writeFileSync(join(base, 'package.json'), JSON.stringify({ dependencies: { react: '^18.0.0' } }))
    expect(detectStack(base)).toBe('react')
  })

  it('retorna "react" quando react está em devDependencies', () => {
    writeFileSync(join(base, 'package.json'), JSON.stringify({ devDependencies: { react: '^18.0.0' } }))
    expect(detectStack(base)).toBe('react')
  })

  it('retorna "node" quando package.json existe sem react', () => {
    writeFileSync(join(base, 'package.json'), JSON.stringify({ dependencies: { express: '^4.0.0' } }))
    expect(detectStack(base)).toBe('node')
  })

  it('retorna "python" quando pyproject.toml existe', () => {
    writeFileSync(join(base, 'pyproject.toml'), '[project]\nname = "test"')
    expect(detectStack(base)).toBe('python')
  })

  it('retorna "python" quando requirements.txt existe', () => {
    writeFileSync(join(base, 'requirements.txt'), 'flask==3.0.0')
    expect(detectStack(base)).toBe('python')
  })

  it('retorna "rust" quando Cargo.toml existe', () => {
    writeFileSync(join(base, 'Cargo.toml'), '[package]\nname = "test"')
    expect(detectStack(base)).toBe('rust')
  })

  it('retorna "unknown" para diretório sem manifesto', () => {
    expect(detectStack(base)).toBe('unknown')
  })

  it('STACK_AGENTS tem entrada para cada stack', () => {
    expect(STACK_AGENTS['react']).toBeArray()
    expect(STACK_AGENTS['node']).toBeArray()
    expect(STACK_AGENTS['python']).toBeArray()
    expect(STACK_AGENTS['rust']).toBeArray()
    expect(STACK_AGENTS['unknown']).toBeArray()
  })
})
