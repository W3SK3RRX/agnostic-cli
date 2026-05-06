import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { readProfile, writeProfile } from '../../src/lib/config'

const base = join(tmpdir(), `agnostic-cmd-config-test-${Date.now()}`)
const fakeCore = join(base, 'core')

describe('config command helpers', () => {
  beforeEach(() => {
    mkdirSync(fakeCore, { recursive: true })
  })
  afterEach(() => rmSync(base, { recursive: true, force: true }))

  it('readProfile após writeProfile contém corePath correto', () => {
    writeProfile({ agnosticCorePath: fakeCore }, base)
    expect(readProfile(base)?.agnosticCorePath).toBe(fakeCore)
  })

  it('profile pode ser sobrescrito', () => {
    writeProfile({ agnosticCorePath: '/primeiro' }, base)
    writeProfile({ agnosticCorePath: fakeCore }, base)
    expect(readProfile(base)?.agnosticCorePath).toBe(fakeCore)
  })
})
