import { describe, expect, it } from 'bun:test'
import { generateClaudeMd } from '../../src/lib/templates'

describe('templates', () => {
  it('inclui a stack no output', () => {
    expect(generateClaudeMd('react')).toContain('Stack: react')
  })

  it('inclui seção de Skills relevantes', () => {
    expect(generateClaudeMd('node')).toContain('## Skills relevantes')
  })

  it('react inclui skills de frontend', () => {
    const result = generateClaudeMd('react')
    expect(result).toContain('html-css-audit')
    expect(result).toContain('accessibility')
  })

  it('node inclui skills de backend', () => {
    const result = generateClaudeMd('node')
    expect(result).toContain('rest-api-design')
    expect(result).toContain('error-handling')
  })

  it('python inclui api-hardening', () => {
    expect(generateClaudeMd('python')).toContain('api-hardening')
  })

  it('rust inclui systematic-debugging', () => {
    expect(generateClaudeMd('rust')).toContain('systematic-debugging')
  })

  it('unknown inclui skills de auditoria', () => {
    const result = generateClaudeMd('unknown')
    expect(result).toContain('systematic-debugging')
    expect(result).toContain('code-review')
  })

  it('todas as stacks produzem string com seções obrigatórias', () => {
    for (const stack of ['react', 'node', 'python', 'rust', 'unknown'] as const) {
      const result = generateClaudeMd(stack)
      expect(result).toContain('## Comandos')
      expect(result).toContain('## Arquitetura')
      expect(result).toContain('## Skills relevantes')
      expect(result).toContain('## Convenções')
    }
  })
})
