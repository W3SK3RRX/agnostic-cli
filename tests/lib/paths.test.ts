import { describe, expect, it } from 'bun:test'
import { isAbsolute } from 'path'
import { expandPath } from '../../src/lib/paths'

describe('expandPath', () => {
  it('expande ~ para home', () => {
    expect(expandPath('~', '/cwd', '/home/user')).toBe('/home/user')
  })

  it('expande ~/sub para home/sub', () => {
    expect(expandPath('~/dev/core', '/cwd', '/home/user')).toBe('/home/user/dev/core')
  })

  it('expande ~\\sub no Windows', () => {
    expect(expandPath('~\\dev\\core', 'C:\\cwd', 'C:\\Users\\u')).toBe('C:\\Users\\u\\dev\\core')
  })

  it('mantém path absoluto inalterado', () => {
    const abs = process.platform === 'win32' ? 'C:\\foo\\bar' : '/foo/bar'
    expect(expandPath(abs)).toBe(abs)
  })

  it('resolve path relativo contra cwd', () => {
    const cwd = process.platform === 'win32' ? 'C:\\proj' : '/proj'
    const resolved = expandPath('./sub', cwd)
    expect(isAbsolute(resolved)).toBe(true)
    expect(resolved.endsWith('sub')).toBe(true)
  })

  it('faz trim de espaços', () => {
    const abs = process.platform === 'win32' ? 'C:\\foo' : '/foo'
    expect(expandPath(`  ${abs}  `)).toBe(abs)
  })
})
