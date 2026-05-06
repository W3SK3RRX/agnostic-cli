# agnostic-cli v0.2.0 — Design Spec

**Data:** 2026-05-06
**Escopo:** Corrigir bloqueador crítico (adapt não recursivo) + 4 melhorias: STACK_AGENTS, update command, CLAUDE.md templates, preset CLI.
**Abordagem escolhida:** B — Cirúrgica com extração de módulos de lib.

---

## Problema

O `agnostic-cli` v0.1.0 tem cinco problemas identificados:

1. **`adapt` não traversa subdiretórios** — `readdirSync` lê apenas o nível raiz de `agents/` e `skills/`. O agnostic-core real usa subdiretórios (`skills/security/`, `agents/reviewers/`, etc.), então `adapt` processa zero arquivos úteis.
2. **`STACK_AGENTS` referencia nomes inexistentes** — os nomes hardcoded não correspondem aos nomes que o scanner geraria com a estrutura real.
3. **Sem `agnostic update`** — arquivos instalados como cópia ficam obsoletos sem mecanismo de atualização.
4. **CLAUDE.md gerado é raso** — apenas stack + placeholder, sem skills relevantes mapeadas.
5. **Presets são criados manualmente** — nenhum subcomando CLI para criar ou listar.

---

## Arquitetura

### Novos módulos em `src/lib/`

| Módulo | Responsabilidade |
|---|---|
| `scanner.ts` | Varre recursivamente `agents/` e `skills/` do agnostic-core; retorna `ScannedFile[]` com nome prefixado e caminho original. Também exporta `listAdapted` (leitura de `.adapted/`) |
| `templates.ts` | Gera CLAUDE.md por stack com seções pré-populadas (Comandos, Arquitetura, Skills relevantes, Convenções) |

### Modificações em `src/commands/`

| Arquivo | Mudança |
|---|---|
| `adapt.ts` | Usa `scanner.ts` em vez de `readdirSync` direto |
| `init.ts` | Usa `templates.ts` em vez de `generateClaudeMd` local; usa `shared.ts` para `selectItems` |
| `update.ts` | **Novo** — re-roda adapt + reinstala arquivos presentes em `.claude/` |
| `preset.ts` | **Novo** — subcomandos `preset create <nome>` e `preset list` |
| `shared.ts` | **Novo** — `selectItems` (UI compartilhada entre init e preset) |

### `src/index.ts`

Registra `update` e `preset` seguindo o padrão dos comandos existentes.

---

## Scanner (`src/lib/scanner.ts`)

### Interface

```ts
interface ScannedFile {
  name: string      // nome prefixado, ex: "security-api-hardening"
  srcPath: string   // caminho absoluto do arquivo original
  type: 'agents' | 'skills'
}

function scanCore(corePath: string): ScannedFile[]
```

### Regra de prefixo

- Arquivo no nível raiz: `<filename>` (sem prefixo)
- Arquivo em subdiretório: `<subdir>-<filename>`

Exemplos:
```
agents/reviewers/security-reviewer.md   →  "reviewers-security-reviewer"
agents/project-onboarding.md            →  "project-onboarding"
skills/security/api-hardening.md        →  "security-api-hardening"
skills/audit/systematic-debugging.md    →  "audit-systematic-debugging"
```

Apenas subdiretórios de primeiro nível são prefixados (sem recursão profunda além disso).

### Saída de `.adapted/` (flat)

```
.adapted/
  agents/
    reviewers-security-reviewer.md
    project-onboarding.md
  skills/
    security-api-hardening.md
    audit-systematic-debugging.md
```

---

## `adapt.ts` atualizado

Substitui o loop `readdirSync` por `scanCore(corePath)`. A lógica de frontmatter (`hasValidFrontmatter`), geração de stubs e output de chalk são mantidos sem alteração. O filtro `--agent <nome>` compara com `file.name`.

---

## `detect-stack.ts` — STACK_AGENTS corrigido

Nomes atualizados para corresponder ao padrão prefixado gerado pelo scanner, mapeando contra a estrutura real do agnostic-core:

```ts
export const STACK_AGENTS: Record<Stack, string[]> = {
  react:   ['reviewers-frontend-reviewer', 'specialists-seo-specialist', 'reviewers-code-inspector'],
  node:    ['reviewers-architecture-reviewer', 'reviewers-security-reviewer', 'reviewers-code-inspector'],
  python:  ['reviewers-security-reviewer', 'reviewers-code-inspector'],
  rust:    ['reviewers-security-reviewer'],
  unknown: [],
}
```

---

## `templates.ts` (`src/lib/templates.ts`)

### Interface

```ts
function generateClaudeMd(stack: Stack): string
```

### Estrutura do CLAUDE.md gerado

```markdown
# Projeto

Stack: <stack>

## Comandos

(preencha os comandos do projeto)

## Arquitetura

(descreva a estrutura do projeto)

## Skills relevantes

<lista de paths do agnostic-core relevantes para a stack>

## Convenções

(descreva as regras e padrões do projeto)
```

### Mapeamento stack → skills (baseado em integration-guide.md do agnostic-core)

| Stack | Skills listadas no CLAUDE.md |
|---|---|
| `react` | `skills/frontend/html-css-audit.md`, `skills/frontend/accessibility.md`, `skills/frontend/ux-guidelines.md`, `skills/performance/performance-audit.md` |
| `node` | `skills/backend/rest-api-design.md`, `skills/backend/error-handling.md`, `skills/security/api-hardening.md`, `skills/testing/unit-testing.md` |
| `python` | `skills/backend/rest-api-design.md`, `skills/security/api-hardening.md`, `skills/backend/error-handling.md` |
| `rust` | `skills/security/api-hardening.md`, `skills/audit/systematic-debugging.md` |
| `unknown` | `skills/audit/systematic-debugging.md`, `skills/audit/code-review.md` |

---

## Compartilhamento de UI entre `init` e `preset`

`selectItems` usa `@inquirer/prompts` (I/O interativo), então não pode ir para `src/lib/`. Solução:

- `listAdapted` (função pura de leitura de diretório) migra para `src/lib/scanner.ts`
- `selectItems` vai para `src/commands/shared.ts` (helpers de UI compartilhados entre commands)

```ts
// src/commands/shared.ts
export async function selectItems(
  corePath: string,
  type: 'agents' | 'skills',
  recommended: string[],
): Promise<string[]>
```

Importada por `init.ts` e `preset.ts`.

---

## `update.ts` (`src/commands/update.ts`)

### Comportamento

`agnostic update` executa em sequência:

1. Re-roda `adaptCommand(corePath, {})` — atualiza `.adapted/` com estado atual do agnostic-core
2. Inspeciona `.claude/agents/` e `.claude/skills/` no diretório atual
3. Para cada arquivo presente em `.claude/` que exista em `.adapted/`, reinstala (sobrescreve cópia ou mantém symlink — symlinks já apontam para `.adapted/`, sem ação necessária)
4. Exibe resumo: arquivos atualizados, arquivos não encontrados em `.adapted/` (aviso)

### Escopo

- Opera apenas no projeto atual (diretório onde o comando é rodado)
- Não rastreia múltiplos projetos (fora de escopo — v0.3.0)
- Não altera seleção: reinstala exatamente o que já está em `.claude/`

---

## `preset.ts` (`src/commands/preset.ts`)

### Subcomandos

**`agnostic preset create <nome>`**
1. Verifica que `.adapted/` existe
2. Abre checklist de agents (via `selectItems`) sem pré-seleção
3. Abre checklist de skills (via `selectItems`) sem pré-seleção
4. Salva `~/.config/agnostic/presets/<nome>.json` via `writePreset`
5. Confirma com `✓ preset "<nome>" salvo`

**`agnostic preset list`**
1. Lê `listPresets()` de `src/lib/presets.ts`
2. Para cada preset, exibe nome + contagem de agents e skills
3. Se nenhum preset: exibe mensagem de orientação

---

## Testes

Cada novo módulo de lib tem arquivo de teste em `tests/lib/`:

| Arquivo de teste | O que testa |
|---|---|
| `tests/lib/scanner.test.ts` | Recursão, prefixação, arquivos no nível raiz, diretório inexistente |
| `tests/lib/templates.test.ts` | Geração por stack, presença das seções obrigatórias, skills corretas por stack |
| `tests/lib/selector.test.ts` | (se lógica não trivial) — pode ser coberto pelos testes de init |

Módulos de lib existentes (`config`, `linker`, `detect-stack`, `presets`) não são alterados nos testes.

---

## Sequência de build

1. `src/lib/scanner.ts` + testes
2. `src/lib/templates.ts` + testes
3. `src/lib/selector.ts` (extração de init.ts)
4. `adapt.ts` atualizado (usa scanner)
5. `detect-stack.ts` — STACK_AGENTS corrigido
6. `init.ts` atualizado (usa templates + selector)
7. `src/commands/update.ts` + registro em index.ts
8. `src/commands/preset.ts` + registro em index.ts
9. Smoke test manual: `agnostic adapt && agnostic init`

---

## Fora de escopo (v0.2.0)

- Manifest de rastreamento multi-projeto (`agnostic update` em todos os projetos)
- `agnostic preset delete`
- Publicação no npm
- Plugin mode (agnostic-core v2)
