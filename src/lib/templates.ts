import type { Stack } from './detect-stack.js'

const STACK_SKILLS: Record<Stack, string[]> = {
  react: [
    '.agnostic-core/skills/frontend/html-css-audit.md',
    '.agnostic-core/skills/frontend/accessibility.md',
    '.agnostic-core/skills/frontend/ux-guidelines.md',
    '.agnostic-core/skills/performance/performance-audit.md',
  ],
  node: [
    '.agnostic-core/skills/backend/rest-api-design.md',
    '.agnostic-core/skills/backend/error-handling.md',
    '.agnostic-core/skills/security/api-hardening.md',
    '.agnostic-core/skills/testing/unit-testing.md',
  ],
  python: [
    '.agnostic-core/skills/backend/rest-api-design.md',
    '.agnostic-core/skills/security/api-hardening.md',
    '.agnostic-core/skills/backend/error-handling.md',
  ],
  rust: [
    '.agnostic-core/skills/security/api-hardening.md',
    '.agnostic-core/skills/audit/systematic-debugging.md',
  ],
  unknown: [
    '.agnostic-core/skills/audit/systematic-debugging.md',
    '.agnostic-core/skills/audit/code-review.md',
  ],
}

export function generateClaudeMd(stack: Stack): string {
  const skills = STACK_SKILLS[stack].map(s => `- ${s}`).join('\n')
  return `# Projeto

Stack: ${stack}

## Comandos

\`\`\`sh
# (preencha os comandos do projeto)
\`\`\`

## Arquitetura

(descreva a estrutura do projeto)

## Skills relevantes

${skills}

## Convenções

(descreva as regras e padrões do projeto)
`
}
