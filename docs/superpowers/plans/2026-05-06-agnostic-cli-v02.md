# agnostic-cli v0.2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o bloqueador crítico (adapt sem recursão), alinhar STACK_AGENTS, adicionar templates de CLAUDE.md por stack, comando `update` e CLI de presets.

**Architecture:** Dois novos módulos de lib (`scanner.ts`, `templates.ts`) e um helper de UI compartilhado (`shared.ts`). Commands existentes são atualizados para usar os novos módulos. Dois novos commands (`update.ts`, `preset.ts`) são registrados no index.

**Tech Stack:** Bun, TypeScript, commander, @inquirer/prompts, chalk, bun:test

---

## Mapa de arquivos

| Ação | Arquivo |
|---|---|
| Criar | `src/lib/scanner.ts` |
| Criar | `tests/lib/scanner.test.ts` |
| Criar | `src/lib/templates.ts` |
| Criar | `tests/lib/templates.test.ts` |
| Criar | `src/commands/shared.ts` |
| Modificar | `src/commands/adapt.ts` |
| Modificar | `tests/commands/adapt.test.ts` |
| Modificar | `src/lib/detect-stack.ts` |
| Modificar | `src/commands/init.ts` |
| Criar | `src/commands/update.ts` |
| Criar | `src/commands/preset.ts` |
| Modificar | `src/index.ts` |
| Modificar | `package.json` (version bump) |

---

## Task 1: `src/lib/scanner.ts`

**Files:**
- Create: `src/lib/scanner.ts`
- Create: `tests/lib/scanner.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// tests/lib/scanner.test.ts
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
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

```sh
bun test tests/lib/scanner.test.ts
```

Esperado: FAIL — `Cannot find module '../../src/lib/scanner'`

- [ ] **Step 3: Implementar `src/lib/scanner.ts`**

```ts
import { existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

export interface ScannedFile {
  name: string
  srcPath: string
  type: 'agents' | 'skills'
}

export function scanCore(corePath: string): ScannedFile[] {
  const result: ScannedFile[] = []

  for (const type of ['agents', 'skills'] as const) {
    const dir = join(corePath, type)
    if (!existsSync(dir)) continue

    for (const entry of readdirSync(dir)) {
      const entryPath = join(dir, entry)
      const stat = statSync(entryPath)

      if (stat.isDirectory()) {
        if (!existsSync(entryPath)) continue
        for (const file of readdirSync(entryPath)) {
          if (!file.endsWith('.md')) continue
          result.push({
            name: `${entry}-${file.replace(/\.md$/, '')}`,
            srcPath: join(entryPath, file),
            type,
          })
        }
      } else if (entry.endsWith('.md')) {
        result.push({
          name: entry.replace(/\.md$/, ''),
          srcPath: entryPath,
          type,
        })
      }
    }
  }

  return result
}

export function listAdapted(corePath: string, type: 'agents' | 'skills'): string[] {
  const dir = join(corePath, '.adapted', type)
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, ''))
}
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

```sh
bun test tests/lib/scanner.test.ts
```

Esperado: todos os testes PASS

- [ ] **Step 5: Commit**

```sh
git add src/lib/scanner.ts tests/lib/scanner.test.ts
git commit -m "feat: scanner.ts — varredura recursiva com prefixo de subdiretório"
```

---

## Task 2: `src/lib/templates.ts`

**Files:**
- Create: `src/lib/templates.ts`
- Create: `tests/lib/templates.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// tests/lib/templates.test.ts
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
```

- [ ] **Step 2: Rodar para confirmar que falha**

```sh
bun test tests/lib/templates.test.ts
```

Esperado: FAIL — `Cannot find module '../../src/lib/templates'`

- [ ] **Step 3: Implementar `src/lib/templates.ts`**

```ts
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
```

- [ ] **Step 4: Rodar os testes**

```sh
bun test tests/lib/templates.test.ts
```

Esperado: todos os testes PASS

- [ ] **Step 5: Commit**

```sh
git add src/lib/templates.ts tests/lib/templates.test.ts
git commit -m "feat: templates.ts — geração de CLAUDE.md por stack com skills mapeadas"
```

---

## Task 3: `src/commands/shared.ts`

**Files:**
- Create: `src/commands/shared.ts`

Não há lógica nova — apenas extração de `selectItems` de `init.ts`. Sem teste dedicado (coberto pelos testes de init/preset).

- [ ] **Step 1: Criar `src/commands/shared.ts`**

```ts
import { checkbox } from '@inquirer/prompts'
import { listAdapted } from '../lib/scanner.js'

export async function selectItems(
  corePath: string,
  type: 'agents' | 'skills',
  recommended: string[],
): Promise<string[]> {
  const items = listAdapted(corePath, type)
  if (items.length === 0) return []
  return checkbox({
    message: `Selecione os ${type} a instalar:`,
    choices: items.map(i => ({ value: i, checked: recommended.includes(i) })),
  })
}
```

- [ ] **Step 2: Rodar suite completa para garantir que nada quebrou**

```sh
bun test
```

Esperado: todos os testes existentes PASS (nenhum import mudou ainda)

- [ ] **Step 3: Commit**

```sh
git add src/commands/shared.ts
git commit -m "feat: shared.ts — selectItems extraído para reutilização entre commands"
```

---

## Task 4: Atualizar `adapt.ts` + teste de subdiretório

**Files:**
- Modify: `src/commands/adapt.ts`
- Modify: `tests/commands/adapt.test.ts`

- [ ] **Step 1: Adicionar teste de subdiretório em `adapt.test.ts`**

Adicionar ao final do `describe('adaptCommand', ...)`, antes do fechamento `})`:

```ts
  it('processa arquivo em subdiretório com nome prefixado', async () => {
    mkdirSync(join(corePath, 'agents', 'reviewers'), { recursive: true })
    const content = '---\nname: security-reviewer\ndescription: Revisa segurança\n---\n# Content'
    writeFileSync(join(corePath, 'agents', 'reviewers', 'security-reviewer.md'), content)

    await adaptCommand(corePath, {})

    const adaptedPath = join(corePath, '.adapted', 'agents', 'reviewers-security-reviewer.md')
    expect(existsSync(adaptedPath)).toBe(true)
    expect(readFileSync(adaptedPath, 'utf-8')).toBe(content)
  })
```

- [ ] **Step 2: Rodar para confirmar que o novo teste falha**

```sh
bun test tests/commands/adapt.test.ts
```

Esperado: 6 PASS, 1 FAIL (o novo teste de subdiretório)

- [ ] **Step 3: Reescrever `src/commands/adapt.ts` usando `scanCore`**

```ts
import chalk from 'chalk'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { scanCore } from '../lib/scanner.js'

interface AdaptOptions {
  agent?: string
}

function hasValidFrontmatter(raw: string): boolean {
  const content = raw.replace(/^﻿/, '')
  if (!content.startsWith('---')) return false
  const end = content.indexOf('---', 3)
  if (end === -1) return false
  const block = content.slice(3, end)
  return block.includes('name:') && block.includes('description:')
}

function generateStub(name: string, original: string): string {
  return `---\nname: ${name}\ndescription: "" # TODO: descreva quando ativar este agente\ntools: Read, Grep, Glob, Bash\n---\n\n${original}`
}

export async function adaptCommand(corePath: string, options: AdaptOptions): Promise<void> {
  const adaptedDir = join(corePath, '.adapted')
  if (!existsSync(adaptedDir)) mkdirSync(adaptedDir, { recursive: true })

  const files = scanCore(corePath)
  for (const file of files) {
    if (options.agent && file.name !== options.agent) continue

    const destDir = join(adaptedDir, file.type)
    if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true })

    const content = readFileSync(file.srcPath, 'utf-8')
    const destFile = join(destDir, `${file.name}.md`)

    if (hasValidFrontmatter(content)) {
      writeFileSync(destFile, content)
      console.log(chalk.green(`✓ already valid: ${file.type}/${file.name}.md`))
    } else {
      writeFileSync(destFile, generateStub(file.name, content))
      console.log(chalk.yellow(`⚠ stub generated (needs review): ${file.type}/${file.name}.md`))
    }
  }
}
```

- [ ] **Step 4: Rodar todos os testes de adapt**

```sh
bun test tests/commands/adapt.test.ts
```

Esperado: 7 PASS

- [ ] **Step 5: Rodar suite completa**

```sh
bun test
```

Esperado: todos PASS

- [ ] **Step 6: Commit**

```sh
git add src/commands/adapt.ts tests/commands/adapt.test.ts
git commit -m "fix: adapt usa scanCore recursivo — processa subdiretórios do agnostic-core"
```

---

## Task 5: Corrigir `STACK_AGENTS` em `detect-stack.ts`

**Files:**
- Modify: `src/lib/detect-stack.ts`

Os nomes agora devem bater com o output do scanner (formato `<subdir>-<name>`), mapeados contra a estrutura real do agnostic-core.

- [ ] **Step 1: Atualizar `STACK_AGENTS` em `src/lib/detect-stack.ts`**

Substituir o bloco `STACK_AGENTS`:

```ts
export const STACK_AGENTS: Record<Stack, string[]> = {
  react:   ['reviewers-frontend-reviewer', 'specialists-seo-specialist', 'reviewers-code-inspector'],
  node:    ['reviewers-architecture-reviewer', 'reviewers-security-reviewer', 'reviewers-code-inspector'],
  python:  ['reviewers-security-reviewer', 'reviewers-code-inspector'],
  rust:    ['reviewers-security-reviewer'],
  unknown: [],
}
```

- [ ] **Step 2: Rodar testes de detect-stack**

Os testes existentes verificam apenas que cada stack tem um array (não valores específicos), então nenhuma alteração de teste é necessária.

```sh
bun test tests/lib/detect-stack.test.ts
```

Esperado: todos PASS

- [ ] **Step 3: Rodar suite completa**

```sh
bun test
```

Esperado: todos PASS

- [ ] **Step 4: Commit**

```sh
git add src/lib/detect-stack.ts tests/lib/detect-stack.test.ts
git commit -m "fix: STACK_AGENTS alinhado com nomes prefixados do scanner"
```

---

## Task 6: Atualizar `init.ts`

**Files:**
- Modify: `src/commands/init.ts`

Remove `listAdapted`, `generateClaudeMd`, `selectItems` locais. Importa dos novos módulos.

- [ ] **Step 1: Reescrever `src/commands/init.ts`**

```ts
import { confirm } from '@inquirer/prompts'
import chalk from 'chalk'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { detectStack, STACK_AGENTS } from '../lib/detect-stack.js'
import { linkFile } from '../lib/linker.js'
import { readPreset } from '../lib/presets.js'
import { listAdapted } from '../lib/scanner.js'
import { generateClaudeMd } from '../lib/templates.js'
import { selectItems } from './shared.js'

interface InitOptions {
  preset?: string
  all?: boolean
  copy?: boolean
}

export async function initCommand(corePath: string, projectDir: string, options: InitOptions): Promise<void> {
  const adaptedDir = join(corePath, '.adapted')
  if (!existsSync(adaptedDir)) {
    console.error(chalk.red('✗ .adapted/ não encontrado. Rode `agnostic adapt` primeiro.'))
    process.exit(1)
  }

  let agents: string[]
  let skills: string[]

  if (options.preset) {
    const preset = readPreset(options.preset)
    if (!preset) {
      console.error(chalk.red(`✗ Preset "${options.preset}" não encontrado.`))
      process.exit(1)
    }
    agents = preset.agents
    skills = preset.skills
  } else if (options.all) {
    agents = listAdapted(corePath, 'agents')
    skills = listAdapted(corePath, 'skills')
  } else {
    const stack = detectStack(projectDir)
    const recommended = STACK_AGENTS[stack]
    agents = await selectItems(corePath, 'agents', recommended)
    skills = await selectItems(corePath, 'skills', [])
  }

  mkdirSync(join(projectDir, '.claude', 'agents'), { recursive: true })
  mkdirSync(join(projectDir, '.claude', 'skills'), { recursive: true })

  let useCopy = options.copy ?? false

  for (const [type, list] of [['agents', agents], ['skills', skills]] as const) {
    for (const item of list) {
      const src = join(corePath, '.adapted', type, `${item}.md`)
      if (!existsSync(src)) {
        console.log(chalk.yellow(`⚠ skipped: ${type}/${item}.md (não encontrado em .adapted/)`))
        continue
      }
      const dest = join(projectDir, '.claude', type, `${item}.md`)
      const result = linkFile(src, dest, useCopy)
      if (result.success) {
        console.log(chalk.green(`✓ ${result.method === 'symlink' ? 'linked' : 'copied'}: ${type}/${item}.md`))
      } else if (result.error === 'EPERM') {
        console.log(chalk.yellow(`⚠ symlink falhou (sem permissão): ${type}/${item}.md`))
        const fallback = await confirm({ message: `Usar cópia como fallback para ${type}/${item}.md?` })
        if (fallback) {
          useCopy = true
          const retry = linkFile(src, dest, true)
          console.log(retry.success ? chalk.green(`✓ copied: ${type}/${item}.md`) : chalk.red(`✗ failed: ${type}/${item}.md`))
        }
      } else {
        console.log(chalk.red(`✗ failed: ${type}/${item}.md — ${result.error}`))
      }
    }
  }

  const claudeMdPath = join(projectDir, 'CLAUDE.md')
  const stack = detectStack(projectDir)
  if (!existsSync(claudeMdPath)) {
    writeFileSync(claudeMdPath, generateClaudeMd(stack))
    console.log(chalk.green('✓ CLAUDE.md gerado'))
  } else {
    const overwrite = await confirm({ message: 'CLAUDE.md já existe. Sobrescrever?' })
    if (overwrite) {
      writeFileSync(claudeMdPath, generateClaudeMd(stack))
      console.log(chalk.green('✓ CLAUDE.md sobrescrito'))
    } else {
      console.log(chalk.yellow('⚠ CLAUDE.md mantido sem alteração'))
    }
  }
}
```

- [ ] **Step 2: Rodar suite completa**

```sh
bun test
```

Esperado: todos PASS

- [ ] **Step 3: Commit**

```sh
git add src/commands/init.ts
git commit -m "refactor: init usa scanner, templates e shared — remove duplicatas locais"
```

---

## Task 7: `src/commands/update.ts`

**Files:**
- Create: `src/commands/update.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Criar `src/commands/update.ts`**

```ts
import chalk from 'chalk'
import { existsSync, lstatSync, readdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import { linkFile } from '../lib/linker.js'
import { adaptCommand } from './adapt.js'

export async function updateCommand(corePath: string, projectDir: string): Promise<void> {
  console.log(chalk.blue('↻ Re-adaptando agnostic-core...'))
  await adaptCommand(corePath, {})

  const claudeDir = join(projectDir, '.claude')
  if (!existsSync(claudeDir)) {
    console.log(chalk.yellow('⚠ .claude/ não encontrado — rode `agnostic init` primeiro.'))
    return
  }

  let updated = 0
  for (const type of ['agents', 'skills'] as const) {
    const installedDir = join(claudeDir, type)
    if (!existsSync(installedDir)) continue

    for (const file of readdirSync(installedDir).filter(f => f.endsWith('.md'))) {
      const dest = join(installedDir, file)
      const src = join(corePath, '.adapted', type, file)

      if (!existsSync(src)) {
        console.log(chalk.yellow(`⚠ skipped: ${type}/${file} (não encontrado em .adapted/)`))
        continue
      }

      if (lstatSync(dest).isSymbolicLink()) {
        console.log(chalk.blue(`→ symlink, já atualizado: ${type}/${file}`))
        continue
      }

      unlinkSync(dest)
      const result = linkFile(src, dest, true)
      if (result.success) {
        console.log(chalk.green(`✓ updated: ${type}/${file}`))
        updated++
      } else {
        console.log(chalk.red(`✗ failed: ${type}/${file} — ${result.error}`))
      }
    }
  }

  console.log(chalk.green(`✓ Update concluído. ${updated} arquivo(s) copiado(s) atualizado(s).`))
}
```

- [ ] **Step 2: Registrar `update` em `src/index.ts`**

Adicionar após o bloco do comando `adapt` e antes do bloco `config`:

```ts
import { updateCommand } from './commands/update.js'

// ... após o bloco de adapt:

program
  .command('update')
  .description('Re-adapta o agnostic-core e reinstala arquivos no projeto atual')
  .action(async () => {
    const corePath = await ensureCorePath()
    await updateCommand(corePath, process.cwd())
  })
```

- [ ] **Step 3: Rodar suite completa**

```sh
bun test
```

Esperado: todos PASS

- [ ] **Step 4: Verificar que o comando aparece no help**

```sh
bun src/index.ts --help
```

Esperado: `update` listado entre os comandos

- [ ] **Step 5: Commit**

```sh
git add src/commands/update.ts src/index.ts
git commit -m "feat: comando update — re-adapta core e reinstala cópias no projeto atual"
```

---

## Task 8: `src/commands/preset.ts` + versão 0.2.0

**Files:**
- Create: `src/commands/preset.ts`
- Modify: `src/index.ts`
- Modify: `package.json`

- [ ] **Step 1: Criar `src/commands/preset.ts`**

```ts
import chalk from 'chalk'
import { existsSync } from 'fs'
import { join } from 'path'
import { listPresets, readPreset, writePreset } from '../lib/presets.js'
import { selectItems } from './shared.js'

export async function presetCreateCommand(name: string, corePath: string): Promise<void> {
  const adaptedDir = join(corePath, '.adapted')
  if (!existsSync(adaptedDir)) {
    console.error(chalk.red('✗ .adapted/ não encontrado. Rode `agnostic adapt` primeiro.'))
    process.exit(1)
  }

  const agents = await selectItems(corePath, 'agents', [])
  const skills = await selectItems(corePath, 'skills', [])

  writePreset(name, { agents, skills })
  console.log(chalk.green(`✓ preset "${name}" salvo`))
}

export function presetListCommand(): void {
  const presets = listPresets()
  if (presets.length === 0) {
    console.log(chalk.yellow('Nenhum preset encontrado. Crie um com: agnostic preset create <nome>'))
    return
  }
  for (const name of presets) {
    const preset = readPreset(name)
    if (!preset) continue
    console.log(
      chalk.blue(name) + ` — ${preset.agents.length} agent(s), ${preset.skills.length} skill(s)`,
    )
  }
}
```

- [ ] **Step 2: Registrar `preset` em `src/index.ts`**

Adicionar após o bloco `update` e antes do bloco `config`:

```ts
import { presetCreateCommand, presetListCommand } from './commands/preset.js'

// ... após o bloco de update:

const presetCmd = program.command('preset').description('Gerencia presets de agents e skills')

presetCmd
  .command('create <name>')
  .description('Cria um preset interativamente')
  .action(async (name: string) => {
    const corePath = await ensureCorePath()
    await presetCreateCommand(name, corePath)
  })

presetCmd
  .command('list')
  .description('Lista presets salvos')
  .action(presetListCommand)
```

- [ ] **Step 3: Atualizar versão em `package.json`**

Alterar `"version": "0.1.0"` para `"version": "0.2.0"`.

- [ ] **Step 4: Rodar suite completa**

```sh
bun test
```

Esperado: todos PASS

- [ ] **Step 5: Verificar help com todos os comandos**

```sh
bun src/index.ts --help
```

Esperado: `init`, `adapt`, `update`, `preset`, `config` listados.

```sh
bun src/index.ts --version
```

Esperado: `0.2.0`

- [ ] **Step 6: Commit**

```sh
git add src/commands/preset.ts src/index.ts package.json
git commit -m "feat: preset create/list + bump versão para 0.2.0"
```

---

## Smoke test final (manual)

Após todas as tasks, validar o fluxo completo com o agnostic-core real:

```sh
bun src/index.ts adapt
# Esperado: lista de arquivos processados com prefixos de subdiretório

bun src/index.ts --help
# Esperado: init, adapt, update, preset, config

bun src/index.ts preset list
# Esperado: "Nenhum preset encontrado..." ou lista de presets existentes

bun test
# Esperado: todos PASS
```
