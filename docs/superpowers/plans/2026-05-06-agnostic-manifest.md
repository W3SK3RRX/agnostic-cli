# agnostic-manifest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerar `.claude/agnostic-manifest.json` ao final de `agnostic init` e `agnostic update`, expondo metadados dos agentes instalados para integração com o pixel-agents.

**Architecture:** Novo módulo puro `src/lib/manifest.ts` com as funções `generateManifest` e `writeManifest`. `init.ts` coleta os itens instalados durante o loop existente e chama `writeManifest` ao final. `update.ts` lê o estado atual de `.claude/` após reinstalar e faz o mesmo.

**Tech Stack:** Bun, TypeScript strict, bun:test, Node.js `fs` module (sem libs externas).

---

## Mapa de arquivos

| Arquivo | Ação | O que muda |
|---|---|---|
| `src/lib/manifest.ts` | Criar | Tipos, `generateManifest`, `writeManifest`, `readManifest` |
| `tests/lib/manifest.test.ts` | Criar | 8 testes unitários do módulo |
| `src/commands/init.ts` | Modificar | Coleta itens instalados + chama `writeManifest` |
| `src/commands/update.ts` | Modificar | Lê estado pós-update de `.claude/` + chama `writeManifest` |
| `tests/commands/init.test.ts` | Criar | 1 teste de integração: verifica que manifest é gravado |
| `tests/commands/update.test.ts` | Criar | 1 teste de integração: verifica que manifest é atualizado |

---

## Task 1: `src/lib/manifest.ts` (TDD)

**Files:**
- Create: `src/lib/manifest.ts`
- Create: `tests/lib/manifest.test.ts`

- [ ] **Step 1: Criar o arquivo de teste com todos os casos**

Crie `tests/lib/manifest.test.ts` com o conteúdo abaixo:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  generateManifest,
  writeManifest,
  readManifest,
  deriveRole,
  readDescription,
} from '../../src/lib/manifest'

const base = join(tmpdir(), `agnostic-manifest-test-${Date.now()}`)

beforeEach(() => mkdirSync(base, { recursive: true }))
afterEach(() => rmSync(base, { recursive: true, force: true }))

describe('deriveRole', () => {
  it('extrai prefixo de nome com hífen', () => {
    expect(deriveRole('reviewers-security-reviewer')).toBe('reviewers')
  })

  it('retorna null para nome sem hífen', () => {
    expect(deriveRole('project-onboarding')).toBe('project')
    // "project-onboarding" TEM hífen — role = "project"
    expect(deriveRole('onboarding')).toBe(null)
  })
})

describe('readDescription', () => {
  it('extrai description do frontmatter', () => {
    const filePath = join(base, 'agent.md')
    writeFileSync(filePath, '---\nname: test\ndescription: Minha descrição aqui\n---\n\n# Content')
    expect(readDescription(filePath)).toBe('Minha descrição aqui')
  })

  it('retorna string vazia se arquivo não existe', () => {
    expect(readDescription(join(base, 'nonexistent.md'))).toBe('')
  })

  it('retorna string vazia se frontmatter ausente', () => {
    const filePath = join(base, 'nofront.md')
    writeFileSync(filePath, '# Content sem frontmatter')
    expect(readDescription(filePath)).toBe('')
  })
})

describe('generateManifest', () => {
  it('gera estrutura correta com agents e skills', () => {
    const agentMd = join(base, 'security-reviewer.md')
    writeFileSync(agentMd, '---\nname: security-reviewer\ndescription: Revisa vulnerabilidades\n---\n')
    const skillMd = join(base, 'api-hardening.md')
    writeFileSync(skillMd, '---\nname: api-hardening\ndescription: Hardening de API\n---\n')

    const manifest = generateManifest(
      [{ name: 'reviewers-security-reviewer', adaptedPath: agentMd, installType: 'symlink' }],
      [{ name: 'security-api-hardening', adaptedPath: skillMd, installType: 'copy' }],
      'node',
    )

    expect(manifest.version).toBe('1')
    expect(manifest.stack).toBe('node')
    expect(manifest.agents).toHaveLength(1)
    expect(manifest.agents[0].name).toBe('reviewers-security-reviewer')
    expect(manifest.agents[0].role).toBe('reviewers')
    expect(manifest.agents[0].category).toBe(null)
    expect(manifest.agents[0].description).toBe('Revisa vulnerabilidades')
    expect(manifest.agents[0].installType).toBe('symlink')
    expect(manifest.skills).toHaveLength(1)
    expect(manifest.skills[0].name).toBe('security-api-hardening')
    expect(manifest.skills[0].role).toBe(null)
    expect(manifest.skills[0].category).toBe('security')
    expect(manifest.skills[0].installType).toBe('copy')
  })

  it('generatedAt é uma string ISO 8601 válida', () => {
    const manifest = generateManifest([], [], 'unknown')
    expect(new Date(manifest.generatedAt).toISOString()).toBe(manifest.generatedAt)
  })
})

describe('writeManifest / readManifest', () => {
  it('writeManifest cria .claude/agnostic-manifest.json', () => {
    const manifest = generateManifest([], [], 'node')
    writeManifest(manifest, base)
    expect(existsSync(join(base, '.claude', 'agnostic-manifest.json'))).toBe(true)
  })

  it('readManifest retorna objeto parseado', () => {
    const manifest = generateManifest([], [], 'react')
    writeManifest(manifest, base)
    const read = readManifest(base)
    expect(read).not.toBeNull()
    expect(read!.stack).toBe('react')
    expect(read!.version).toBe('1')
  })

  it('readManifest retorna null quando arquivo não existe', () => {
    expect(readManifest(base)).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar os testes para confirmar falha**

```powershell
bun test tests/lib/manifest.test.ts
```

Esperado: falha com `Cannot find module '../../src/lib/manifest'`

- [ ] **Step 3: Criar `src/lib/manifest.ts`**

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { Stack } from './detect-stack.js'

export interface ManifestEntry {
  name: string
  role: string | null
  category: string | null
  description: string
  installType: 'symlink' | 'copy'
}

export interface AgnosticManifest {
  version: '1'
  generatedAt: string
  stack: Stack
  agents: ManifestEntry[]
  skills: ManifestEntry[]
}

export function deriveRole(name: string): string | null {
  const idx = name.indexOf('-')
  return idx > 0 ? name.slice(0, idx) : null
}

export function readDescription(filePath: string): string {
  if (!existsSync(filePath)) return ''
  const content = readFileSync(filePath, 'utf-8').replace(/^﻿/, '')
  const match = content.match(/^---[\r\n]([\s\S]*?)[\r\n]---/)
  if (!match) return ''
  const line = match[1].split(/\r?\n/).find(l => l.startsWith('description:'))
  if (!line) return ''
  return line.replace(/^description:\s*/, '').trim()
}

export function generateManifest(
  agents: Array<{ name: string; adaptedPath: string; installType: 'symlink' | 'copy' }>,
  skills: Array<{ name: string; adaptedPath: string; installType: 'symlink' | 'copy' }>,
  stack: Stack,
): AgnosticManifest {
  return {
    version: '1',
    generatedAt: new Date().toISOString(),
    stack,
    agents: agents.map(a => ({
      name: a.name,
      role: deriveRole(a.name),
      category: null,
      description: readDescription(a.adaptedPath),
      installType: a.installType,
    })),
    skills: skills.map(s => ({
      name: s.name,
      role: null,
      category: deriveRole(s.name),
      description: readDescription(s.adaptedPath),
      installType: s.installType,
    })),
  }
}

export function writeManifest(manifest: AgnosticManifest, projectDir: string): void {
  const dir = join(projectDir, '.claude')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'agnostic-manifest.json'), JSON.stringify(manifest, null, 2))
}

export function readManifest(projectDir: string): AgnosticManifest | null {
  const filePath = join(projectDir, '.claude', 'agnostic-manifest.json')
  if (!existsSync(filePath)) return null
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as AgnosticManifest
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

```powershell
bun test tests/lib/manifest.test.ts
```

Esperado: 8 passed

- [ ] **Step 5: Commit**

```powershell
git add src/lib/manifest.ts tests/lib/manifest.test.ts
git commit -m "feat: add manifest lib (generateManifest, writeManifest, readManifest)"
```

---

## Task 2: Integrar manifest em `init.ts`

**Files:**
- Modify: `src/commands/init.ts`
- Create: `tests/commands/init.test.ts`

- [ ] **Step 1: Escrever teste de integração**

Crie `tests/commands/init.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { initCommand } from '../../src/commands/init'

const base = join(tmpdir(), `agnostic-init-test-${Date.now()}`)
const corePath = join(base, 'agnostic-core')
const projectDir = join(base, 'my-project')

function makeAdaptedAgent(name: string, description: string) {
  const dir = join(corePath, '.adapted', 'agents')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, `${name}.md`),
    `---\nname: ${name}\ndescription: ${description}\n---\n\n# content`,
  )
}

beforeEach(() => {
  mkdirSync(projectDir, { recursive: true })
  mkdirSync(join(corePath, '.adapted', 'skills'), { recursive: true })
})

afterEach(() => rmSync(base, { recursive: true, force: true }))

describe('initCommand manifest', () => {
  it('grava .claude/agnostic-manifest.json após init --all --copy', async () => {
    makeAdaptedAgent('reviewers-security-reviewer', 'Revisa vulnerabilidades')

    await initCommand(corePath, projectDir, { all: true, copy: true })

    const manifestPath = join(projectDir, '.claude', 'agnostic-manifest.json')
    expect(existsSync(manifestPath)).toBe(true)

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    expect(manifest.version).toBe('1')
    expect(manifest.agents).toHaveLength(1)
    expect(manifest.agents[0].name).toBe('reviewers-security-reviewer')
    expect(manifest.agents[0].role).toBe('reviewers')
    expect(manifest.agents[0].description).toBe('Revisa vulnerabilidades')
    expect(manifest.agents[0].installType).toBe('copy')
  })
})
```

- [ ] **Step 2: Rodar o teste para confirmar falha**

```powershell
bun test tests/commands/init.test.ts
```

Esperado: falha — manifest não existe ainda.

- [ ] **Step 3: Modificar `src/commands/init.ts`**

Substitua o conteúdo completo por:

```ts
import { confirm } from '@inquirer/prompts'
import chalk from 'chalk'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { detectStack, STACK_AGENTS } from '../lib/detect-stack.js'
import { linkFile } from '../lib/linker.js'
import { generateManifest, writeManifest } from '../lib/manifest.js'
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

  const stack = detectStack(projectDir)

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
    const recommended = STACK_AGENTS[stack]
    agents = await selectItems(corePath, 'agents', recommended)
    skills = await selectItems(corePath, 'skills', [])
  }

  mkdirSync(join(projectDir, '.claude', 'agents'), { recursive: true })
  mkdirSync(join(projectDir, '.claude', 'skills'), { recursive: true })

  let useCopy = options.copy ?? false

  const installedAgents: Array<{ name: string; adaptedPath: string; installType: 'symlink' | 'copy' }> = []
  const installedSkills: Array<{ name: string; adaptedPath: string; installType: 'symlink' | 'copy' }> = []

  for (const [type, list, installed] of [
    ['agents', agents, installedAgents],
    ['skills', skills, installedSkills],
  ] as const) {
    for (const item of list) {
      const src = join(corePath, '.adapted', type, `${item}.md`)
      if (!existsSync(src)) {
        console.log(chalk.yellow(`⚠ skipped: ${type}/${item}.md (não encontrado em .adapted/)`))
        continue
      }
      const dest = join(projectDir, '.claude', type, `${item}.md`)
      const result = linkFile(src, dest, useCopy)
      if (result.success) {
        installed.push({ name: item, adaptedPath: src, installType: result.method })
        console.log(chalk.green(`✓ ${result.method === 'symlink' ? 'linked' : 'copied'}: ${type}/${item}.md`))
      } else if (result.error === 'EPERM') {
        console.log(chalk.yellow(`⚠ symlink falhou (sem permissão): ${type}/${item}.md`))
        const fallback = await confirm({ message: `Usar cópia como fallback para ${type}/${item}.md?` })
        if (fallback) {
          useCopy = true
          const retry = linkFile(src, dest, true)
          if (retry.success) {
            installed.push({ name: item, adaptedPath: src, installType: 'copy' })
            console.log(chalk.green(`✓ copied: ${type}/${item}.md`))
          } else {
            console.log(chalk.red(`✗ failed: ${type}/${item}.md`))
          }
        }
      } else {
        console.log(chalk.red(`✗ failed: ${type}/${item}.md — ${result.error}`))
      }
    }
  }

  const claudeMdPath = join(projectDir, 'CLAUDE.md')
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

  const manifest = generateManifest(installedAgents, installedSkills, stack)
  writeManifest(manifest, projectDir)
  console.log(chalk.gray('  manifest: .claude/agnostic-manifest.json'))
}
```

- [ ] **Step 4: Rodar os testes**

```powershell
bun test tests/commands/init.test.ts
```

Esperado: 1 passed

- [ ] **Step 5: Rodar suite completa para garantir sem regressões**

```powershell
bun test
```

Esperado: todos passando.

- [ ] **Step 6: Commit**

```powershell
git add src/commands/init.ts tests/commands/init.test.ts
git commit -m "feat: write agnostic-manifest.json on agnostic init"
```

---

## Task 3: Integrar manifest em `update.ts`

**Files:**
- Modify: `src/commands/update.ts`
- Create: `tests/commands/update.test.ts`

- [ ] **Step 1: Escrever teste de integração**

Crie `tests/commands/update.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync, symlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { updateCommand } from '../../src/commands/update'

const base = join(tmpdir(), `agnostic-update-test-${Date.now()}`)
const corePath = join(base, 'agnostic-core')
const projectDir = join(base, 'my-project')

function makeAgentInCore(subdir: string, filename: string, description: string) {
  const dir = join(corePath, 'agents', subdir)
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, filename),
    `---\nname: ${subdir}-${filename.replace(/\.md$/, '')}\ndescription: ${description}\n---\n# content`,
  )
}

function makeAdaptedAgent(name: string, description: string) {
  const dir = join(corePath, '.adapted', 'agents')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, `${name}.md`),
    `---\nname: ${name}\ndescription: ${description}\n---\n# content`,
  )
}

function installCopiedAgent(name: string) {
  const src = join(corePath, '.adapted', 'agents', `${name}.md`)
  const dest = join(projectDir, '.claude', 'agents', `${name}.md`)
  mkdirSync(join(projectDir, '.claude', 'agents'), { recursive: true })
  writeFileSync(dest, readFileSync(src, 'utf-8'))
}

beforeEach(() => {
  mkdirSync(join(corePath, 'agents'), { recursive: true })
  mkdirSync(join(corePath, 'skills'), { recursive: true })
  mkdirSync(join(corePath, '.adapted', 'skills'), { recursive: true })
  mkdirSync(projectDir, { recursive: true })
})

afterEach(() => rmSync(base, { recursive: true, force: true }))

describe('updateCommand manifest', () => {
  it('grava .claude/agnostic-manifest.json após update', async () => {
    makeAgentInCore('reviewers', 'security-reviewer.md', 'Revisa vulnerabilidades')
    makeAdaptedAgent('reviewers-security-reviewer', 'Revisa vulnerabilidades')
    installCopiedAgent('reviewers-security-reviewer')

    await updateCommand(corePath, projectDir)

    const manifestPath = join(projectDir, '.claude', 'agnostic-manifest.json')
    expect(existsSync(manifestPath)).toBe(true)

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    expect(manifest.version).toBe('1')
    expect(manifest.agents).toHaveLength(1)
    expect(manifest.agents[0].name).toBe('reviewers-security-reviewer')
    expect(manifest.agents[0].role).toBe('reviewers')
  })
})
```

- [ ] **Step 2: Rodar o teste para confirmar falha**

```powershell
bun test tests/commands/update.test.ts
```

Esperado: falha — manifest não gerado pelo update ainda.

- [ ] **Step 3: Modificar `src/commands/update.ts`**

Substitua o conteúdo completo por:

```ts
import chalk from 'chalk'
import { existsSync, lstatSync, readdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import { detectStack } from '../lib/detect-stack.js'
import { linkFile } from '../lib/linker.js'
import { generateManifest, writeManifest } from '../lib/manifest.js'
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

  const installedAgents = buildInstalledList(claudeDir, 'agents', corePath)
  const installedSkills = buildInstalledList(claudeDir, 'skills', corePath)
  const stack = detectStack(projectDir)
  const manifest = generateManifest(installedAgents, installedSkills, stack)
  writeManifest(manifest, projectDir)
  console.log(chalk.gray('  manifest: .claude/agnostic-manifest.json'))

  console.log(chalk.green(`✓ Update concluído. ${updated} arquivo(s) copiado(s) atualizado(s).`))
}

function buildInstalledList(
  claudeDir: string,
  type: 'agents' | 'skills',
  corePath: string,
): Array<{ name: string; adaptedPath: string; installType: 'symlink' | 'copy' }> {
  const dir = join(claudeDir, type)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const dest = join(dir, f)
      const name = f.replace(/\.md$/, '')
      return {
        name,
        adaptedPath: join(corePath, '.adapted', type, f),
        installType: lstatSync(dest).isSymbolicLink() ? 'symlink' : 'copy',
      }
    })
}
```

- [ ] **Step 4: Rodar os testes**

```powershell
bun test tests/commands/update.test.ts
```

Esperado: 1 passed

- [ ] **Step 5: Rodar suite completa**

```powershell
bun test
```

Esperado: todos passando.

- [ ] **Step 6: Commit**

```powershell
git add src/commands/update.ts tests/commands/update.test.ts
git commit -m "feat: write agnostic-manifest.json on agnostic update"
```

---

## Self-Review

**Spec coverage:**
- ✅ `src/lib/manifest.ts` com `generateManifest`, `writeManifest`, `readManifest`
- ✅ `ManifestEntry` com `role`, `category`, `description`, `installType`
- ✅ `deriveRole` extrai prefixo do nome
- ✅ `readDescription` lê frontmatter do arquivo `.adapted/`
- ✅ `version: '1'` e `generatedAt` ISO 8601
- ✅ Integração em `init.ts`
- ✅ Integração em `update.ts`
- ✅ 8 testes unitários em `manifest.test.ts`
- ✅ 1 teste de integração em `init.test.ts`
- ✅ 1 teste de integração em `update.test.ts`

**Placeholder scan:** Nenhum TBD, TODO, ou "similar ao Task N" encontrado.

**Type consistency:**
- `ManifestEntry` definido em Task 1 e usado sem alteração em Tasks 2 e 3
- `generateManifest` signature idêntica em todos os usos
- `buildInstalledList` introduzida em Task 3 como helper interno (não exportada)
