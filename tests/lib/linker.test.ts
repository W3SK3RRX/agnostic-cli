import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { linkFile } from '../../src/lib/linker'

const base = join(tmpdir(), `agnostic-linker-test-${Date.now()}`)

describe('linker', () => {
  beforeEach(() => mkdirSync(base, { recursive: true }))
  afterEach(() => rmSync(base, { recursive: true, force: true }))

  it('retorna failure quando source não existe', () => {
    const result = linkFile(join(base, 'nope.md'), join(base, 'dest.md'))
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('Source not found')
  })

  it('copia arquivo quando forceCopy=true', () => {
    const src = join(base, 'src.md')
    const dest = join(base, 'sub', 'dest.md')
    writeFileSync(src, '# hello')

    const result = linkFile(src, dest, true)
    expect(result.success).toBe(true)
    if (result.success) expect(result.method).toBe('copy')
    expect(readFileSync(dest, 'utf-8')).toBe('# hello')
  })

  it('cria diretório de destino automaticamente', () => {
    const src = join(base, 'src.md')
    const dest = join(base, 'a', 'b', 'c', 'dest.md')
    writeFileSync(src, '# test')

    const result = linkFile(src, dest, true)
    expect(result.success).toBe(true)
    expect(existsSync(dest)).toBe(true)
  })

  it('não sobrescreve destino existente sem erro', () => {
    const src = join(base, 'src.md')
    const dest = join(base, 'dest.md')
    writeFileSync(src, '# novo')
    writeFileSync(dest, '# antigo')

    const result = linkFile(src, dest, true)
    expect(result.success).toBe(true)
    expect(readFileSync(dest, 'utf-8')).toBe('# novo')
  })
})
