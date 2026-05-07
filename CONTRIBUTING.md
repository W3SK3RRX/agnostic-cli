# Contribuindo com o agnostic-cli

Existem dois caminhos para contribuir, com perfis bem diferentes:

- **[Perfil A](#perfil-a--melhorar-o-cli)** — você quer modificar o CLI em si (novo comando, fix de bug, melhoria de UX)
- **[Perfil B](#perfil-b--contribuir-com-agentsskills)** — você quer adicionar ou melhorar agents/skills no `agnostic-core`

---

## Perfil A — Melhorar o CLI

### Setup de desenvolvimento

```sh
git clone <este-repo> agnostic-cli
cd agnostic-cli
bun install
```

Para verificar que tudo funciona:

```sh
bun test
# lib/config.test.ts: 5 passed
# lib/linker.test.ts: 4 passed
# lib/detect-stack.test.ts: 8 passed
# lib/presets.test.ts: 5 passed
# lib/scanner.test.ts: 9 passed
# lib/templates.test.ts: 8 passed
# commands/adapt.test.ts: 7 passed
# commands/config.test.ts: 2 passed
```

Para rodar o CLI localmente sem instalar globalmente:

```sh
bun src/index.ts --help
bun src/index.ts init --all --copy
```

### Mapa de arquivos

O projeto separa responsabilidades em duas camadas:

**`src/lib/`** — módulos puros, sem I/O interativo, sem chalk. Aceitam parâmetros injetáveis (ex: `base = homedir()`) para facilitar testes.

| Arquivo | Responsabilidade |
|---|---|
| `config.ts` | Lê/escreve `~/.config/agnostic/profile.json` |
| `linker.ts` | Cria symlinks ou cópias; retorna `LinkResult` tipado |
| `detect-stack.ts` | Detecta stack pelo manifesto do projeto; exporta `STACK_AGENTS` |
| `presets.ts` | Lê/escreve presets em `~/.config/agnostic/presets/` |
| `scanner.ts` | Varre `agents/` e `skills/` do agnostic-core (recursivo 1 nível); exporta `scanCore` e `listAdapted` |
| `templates.ts` | Gera `CLAUDE.md` por stack com seções e skills relevantes pré-mapeadas |

**`src/commands/`** — orquestração: usa as libs, chama `@inquirer/prompts`, imprime com `chalk`. Não contêm lógica de negócio.

| Arquivo | Responsabilidade |
|---|---|
| `config.ts` | Subcomandos `config set/get` + helper `ensureCorePath` |
| `adapt.ts` | Fluxo `agnostic adapt` (usa `scanCore`, geração de stubs) |
| `init.ts` | Fluxo `agnostic init` (seleção, linking, CLAUDE.md) |
| `update.ts` | Fluxo `agnostic update` (re-adapt + reinstalação dos arquivos em `.claude/`) |
| `preset.ts` | Subcomandos `preset create <nome>` e `preset list` |
| `shared.ts` | `selectItems` — UI de checklist compartilhada entre `init` e `preset` |

**`src/index.ts`** — entry point, apenas registra os comandos no `commander`.

### Como adicionar um novo comando

1. Crie `src/commands/<nome>.ts` — exporte uma função `async <nome>Command(...)`.
2. Se o comando precisar de lógica reutilizável, extraia para `src/lib/<nome>.ts` com parâmetro injetável para o diretório base.
3. Escreva os testes em `tests/commands/<nome>.test.ts` (ou `tests/lib/<nome>.test.ts` para a lib).
4. Registre o comando em `src/index.ts` seguindo o padrão dos existentes.

### Convenções de código

- **TypeScript strict** — sem `any` explícito, sem `!` desnecessário
- **Funções puras em `lib/`** — sem `console.log`, sem `process.exit`, sem `chalk`; retornam valores ou lançam exceções
- **Tratamento de erro tipado** — use union types como `LinkResult` em vez de lançar exceções nas libs
- **Parâmetros injetáveis para o sistema de arquivos** — todo módulo de `lib/` aceita `base = homedir()` ou equivalente para permitir testes com diretórios temporários
- **Commits:** Conventional Commits — `feat:`, `fix:`, `chore:`, `refactor:`

### Rodando um teste específico

```sh
bun test tests/lib/config.test.ts
bun test tests/commands/adapt.test.ts
```

### Atualizar a versão

Edite `version` em `package.json` e rode `bun link` novamente para que o comando global reflita a versão nova.

---

## Perfil B — Contribuir com agents/skills

Este perfil é sobre o `agnostic-core` (repositório separado), mas o `agnostic-cli` é o runtime de validação — você vai usar `agnostic adapt` para verificar se seus arquivos estão no formato correto.

### Frontmatter válido para Claude Code

Todo arquivo `.md` em `agents/` ou `skills/` do agnostic-core precisa ter este frontmatter para ser reconhecido pelo Claude Code:

**Agent** (`agents/<nome>.md`):

```markdown
---
name: security-reviewer
description: Revisa código em busca de vulnerabilidades OWASP Top 10. Usar antes de deploy, ao adicionar endpoints de API ou ao processar input de usuário.
tools: Read, Grep, Glob, Bash
---

# System prompt do agente

Você é um especialista em segurança...
```

**Skill** (`skills/<nome>.md`):

```markdown
---
name: security-api-hardening
description: Use quando o usuário pedir hardening de API, revisão de autenticação/autorização ou configuração de rate limit.
---

# Conteúdo da skill

Quando aplicar esta skill...
```

Campos obrigatórios: `name` (kebab-case) e `description`. O campo `tools` em agents é opcional — sem ele, o agente herda todas as ferramentas disponíveis.

### Como escrever uma boa `description`

A `description` é o que o Claude Code usa para decidir quando delegar para o agente ou carregar a skill. Uma descrição ruim significa que o agente nunca é invocado.

**Padrão recomendado:** _O que faz_ + _quando usar_ (+ opcionalmente _quando não usar_)

| | Exemplo |
|---|---|
| ❌ Ruim | `"Revisa código"` — vago, sem gatilho claro |
| ❌ Ruim | `"Agente de segurança para revisar vulnerabilidades de segurança como SQL injection e XSS e outros problemas"` — redundante, sem gatilho de quando invocar |
| ✓ Bom | `"Revisa código em busca de vulnerabilidades OWASP Top 10. Usar antes de deploy, ao adicionar endpoints de API ou ao processar input de usuário."` |
| ✓ Bom | `"Depura erros e falhas no código. Ativar quando um erro tem causa não óbvia ou quando o usuário pede 'não sei por que está falhando'."` |

Regras práticas:
- Inclua pelo menos um gatilho explícito de quando usar
- Se houver um caso de não-uso importante, mencione (ex: "Não usar para revisão de performance")
- Seja específico sobre o domínio (ex: "endpoints de API" é melhor que "código")
- Máximo de 2-3 frases — descrições longas são truncadas pelo Claude Code

### Verificando com `agnostic adapt`

Depois de editar ou criar um arquivo no agnostic-core:

```sh
agnostic adapt --agent <nome-do-arquivo-sem-extensão>
```

Se aparecer `✓ already valid`, o frontmatter está correto e o arquivo será instalável via `agnostic init`.

Se aparecer `⚠ stub generated`, o frontmatter está ausente ou incompleto — o adapt gerou um stub em `.adapted/` que você pode usar como ponto de partida para preencher manualmente.

### Onde colocar os arquivos

```
agnostic-core/
├── agents/
│   └── meu-agente.md         ← um arquivo por agente
└── skills/
    └── minha-skill.md        ← um arquivo por skill
```

O `agnostic adapt` varre subdiretórios de primeiro nível dentro de `agents/` e `skills/`. Arquivos em `agents/reviewers/meu-agent.md` são instalados com o nome `reviewers-meu-agent` (prefixo `<subdir>-`). Não crie sub-subdiretórios (profundidade > 1) — eles são ignorados pelo scanner.
