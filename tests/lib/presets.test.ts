import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { listPresets, readPreset, writePreset } from '../../src/lib/presets'

const base = join(tmpdir(), `agnostic-presets-test-${Date.now()}`)

describe('presets', () => {
  beforeEach(() => mkdirSync(base, { recursive: true }))
  afterEach(() => rmSync(base, { recursive: true, force: true }))

  it('listPresets retorna array vazio quando não há presets', () => {
    expect(listPresets(base)).toEqual([])
  })

  it('readPreset retorna null quando preset não existe', () => {
    expect(readPreset('node-api', base)).toBeNull()
  })

  it('writePreset cria arquivo e readPreset o lê', () => {
    writePreset('node-api', { agents: ['code-inspector'], skills: ['security'] }, base)
    const preset = readPreset('node-api', base)
    expect(preset?.agents).toEqual(['code-inspector'])
    expect(preset?.skills).toEqual(['security'])
  })

  it('listPresets retorna nomes sem extensão .json', () => {
    writePreset('node-api', { agents: [], skills: [] }, base)
    writePreset('react-spa', { agents: [], skills: [] }, base)
    const list = listPresets(base)
    expect(list).toContain('node-api')
    expect(list).toContain('react-spa')
  })

  it('writePreset cria diretório se não existir', () => {
    const newBase = join(base, 'novo')
    writePreset('test', { agents: ['a'], skills: [] }, newBase)
    expect(readPreset('test', newBase)?.agents).toEqual(['a'])
  })
})
