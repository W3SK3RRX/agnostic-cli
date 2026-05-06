import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

export type Stack = 'react' | 'node' | 'python' | 'rust' | 'unknown'

export function detectStack(projectDir: string): Stack {
  const pkgPath = join(projectDir, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      if ('react' in deps) return 'react'
    } catch {
      // package.json malformado — ignora
    }
    return 'node'
  }
  if (existsSync(join(projectDir, 'pyproject.toml')) || existsSync(join(projectDir, 'requirements.txt'))) {
    return 'python'
  }
  if (existsSync(join(projectDir, 'Cargo.toml'))) {
    return 'rust'
  }
  return 'unknown'
}

export const STACK_AGENTS: Record<Stack, string[]> = {
  react: ['frontend-html-css-audit', 'frontend-accessibility', 'audit-systematic-debugging'],
  node: ['backend-rest-api-design', 'backend-error-handling', 'security-api-hardening'],
  python: ['backend-rest-api-design', 'security-owasp-checklist'],
  rust: ['security-owasp-checklist'],
  unknown: [],
}
