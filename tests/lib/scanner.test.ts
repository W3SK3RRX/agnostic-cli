import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { scanCore, listAdapted } from '../../src/lib/scanner'

const base = join(tmpdir(), `agnostic-scanner-test-${Date.now()}`)
const corePath = join(base, 'agnostic-core')

describe('scanner', () => {
  beforeEach(() => {
    mkdirSync(join(corePath, 'agents'), { recursive: true })
    mkdirSync(join(corePath, 'skills'), { recursive: true })
  })
  afterEach(() => rmSync(base, { recursive: true, force: true }))

  describe('scanCore', () => {
    it('arquivo no nível raiz não recebe prefixo', () => {
      writeFileSync(join(corePath, 'agents', 'project-onboarding.md'), '# test')
      const result = scanCore(corePath)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('project-onboarding')
      expect(result[0].type).toBe('agents')
    })

    it('arquivo em subdiretório recebe prefixo <subdir>-<name>', () => {
      mkdirSync(join(corePath, 'skills', 'security'), { recursive: true })
      writeFileSync(join(corePath, 'skills', 'security', 'api-hardening.md'), '# test')
      const result = scanCore(corePath)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('security-api-hardening')
      expect(result[0].type).toBe('skills')
    })

    it('ignora arquivos não-.md', () => {
      writeFileSync(join(corePath, 'agents', 'README.txt'), 'ignore')
      const result = scanCore(corePath)
      expect(result).toHaveLength(0)
    })

    it('retorna array vazio quando diretório não existe', () => {
      rmSync(join(corePath, 'agents'), { recursive: true })
      const result = scanCore(corePath)
      expect(result).toHaveLength(0)
    })

    it('scans agents e skills retornando o tipo correto', () => {
      writeFileSync(join(corePath, 'agents', 'ag.md'), '# Agent')
      mkdirSync(join(corePath, 'skills', 'audit'), { recursive: true })
      writeFileSync(join(corePath, 'skills', 'audit', 'debug.md'), '# Skill')
      const result = scanCore(corePath)
      expect(result).toHaveLength(2)
      const names = result.map(r => r.name)
      expect(names).toContain('ag')
      expect(names).toContain('audit-debug')
    })

    it('srcPath aponta para o arquivo original', () => {
      const src = join(corePath, 'agents', 'test.md')
      writeFileSync(src, '# test')
      const result = scanCore(corePath)
      expect(result[0].srcPath).toBe(src)
    })

    it('ignora sub-subdiretórios (profundidade > 1)', () => {
      mkdirSync(join(corePath, 'skills', 'audit', 'nested'), { recursive: true })
      writeFileSync(join(corePath, 'skills', 'audit', 'nested', 'deep.md'), '# deep')
      const result = scanCore(corePath)
      expect(result).toHaveLength(0)
    })
  })

  describe('listAdapted', () => {
    it('retorna nomes sem extensão de .adapted/', () => {
      mkdirSync(join(corePath, '.adapted', 'agents'), { recursive: true })
      writeFileSync(join(corePath, '.adapted', 'agents', 'security-reviewer.md'), '# test')
      const result = listAdapted(corePath, 'agents')
      expect(result).toEqual(['security-reviewer'])
    })

    it('retorna array vazio quando .adapted/ não existe', () => {
      const result = listAdapted(corePath, 'agents')
      expect(result).toHaveLength(0)
    })
  })
})
