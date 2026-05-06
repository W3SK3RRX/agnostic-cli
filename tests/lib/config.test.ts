import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { getCorePath, readProfile, writeProfile } from '../../src/lib/config'

const base = join(tmpdir(), `agnostic-config-test-${Date.now()}`)

describe('config', () => {
  beforeEach(() => mkdirSync(base, { recursive: true }))
  afterEach(() => rmSync(base, { recursive: true, force: true }))

  it('readProfile retorna null quando não existe profile', () => {
    expect(readProfile(base)).toBeNull()
  })

  it('writeProfile cria profile.json e readProfile o lê', () => {
    writeProfile({ agnosticCorePath: '/dev/core' }, base)
    expect(readProfile(base)?.agnosticCorePath).toBe('/dev/core')
  })

  it('writeProfile cria diretório se não existir', () => {
    const newBase = join(base, 'novo')
    writeProfile({ agnosticCorePath: '/x' }, newBase)
    expect(readProfile(newBase)?.agnosticCorePath).toBe('/x')
  })

  it('getCorePath retorna null quando não há profile', () => {
    expect(getCorePath(base)).toBeNull()
  })

  it('getCorePath retorna agnosticCorePath do profile', () => {
    writeProfile({ agnosticCorePath: '/dev/agnostic-core' }, base)
    expect(getCorePath(base)).toBe('/dev/agnostic-core')
  })

  it('readProfile retorna null para JSON malformado', () => {
    mkdirSync(join(base, '.config', 'agnostic'), { recursive: true })
    writeFileSync(join(base, '.config', 'agnostic', 'profile.json'), 'não é json válido')
    expect(readProfile(base)).toBeNull()
  })
})
