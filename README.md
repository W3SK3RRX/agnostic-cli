# agnostic-cli

> Bootstrap de projetos com agentes Claude Code — instala agents e skills do [agnostic-core](https://github.com/paulinett1508-dev/agnostic-core) em qualquer projeto com um comando.

**Versão:** 0.2.0 · **Runtime:** [Bun](https://bun.sh)

---

## Por que existe

Configurar um projeto para usar agentes Claude Code envolve criar `.claude/agents/`, `.claude/skills/`, ajustar frontmatter de cada arquivo markdown e escrever um `CLAUDE.md` inicial — trabalho manual que se repete a cada projeto novo.

O `agnostic-cli` automatiza esse setup: lê o `agnostic-core` (sua biblioteca central de agents/skills), detecta a stack do projeto atual e instala os arquivos certos com um único comando. Symlinks garantem que melhorias futuras no `agnostic-core` chegam a todos os projetos sem nenhuma ação extra.

---

## Pré-requisitos

- [Bun](https://bun.sh) instalado (`bun --version` deve funcionar)
- `git` no PATH (necessário para o auto-bootstrap clonar o `agnostic-core`)

> O `agnostic-core` **não precisa estar clonado previamente** — o CLI oferece clonar o repositório padrão automaticamente na primeira execução. Se preferir um core local existente, basta apontar para ele.

---

## Instalação

No diretório do repositório:

```sh
bun link
```

Isso registra o comando `agnostic` globalmente. Para verificar:

```sh
agnostic --version
# 0.2.0
```

Para desinstalar: `bun unlink agnostic-cli`

---

## Primeira execução

Para um projeto novo, **um único comando basta**:

```sh
cd meu-projeto
agnostic init
```

Na primeira execução o CLI pergunta como configurar o `agnostic-core`:

- **Clonar repositório padrão em `~/.agnostic/core`** — o CLI clona `github.com/paulinett1508-dev/agnostic-core` automaticamente
- **Informar caminho local existente** — se você já tem um `agnostic-core` clonado em outro lugar

Depois disso, o `init`:

1. Roda `adapt` automaticamente se `.adapted/` ainda não existe
2. Detecta a stack (React, Node, Python ou Rust) pelo manifesto do projeto
3. Mostra um checklist com os agents/skills disponíveis (pré-selecionando os relevantes para a stack detectada)
4. Cria `.claude/agents/`, `.claude/skills/`, `CLAUDE.md` e `.claude/agnostic-manifest.json`

Para projetos Windows ou quando symlinks não têm permissão:

```sh
agnostic init --copy
```

> Travou em algum passo? Rode `agnostic doctor` — ele diagnostica o estado atual e diz exatamente qual o próximo comando.

---

## Referência de comandos

### `agnostic init`

Instala agents e skills no projeto atual (diretório onde o comando é rodado).

```
agnostic init                      # interativo — checklist de seleção
agnostic init --all                # instala tudo, sem checklist
agnostic init --all --copy         # instala tudo como cópias (sem symlink)
agnostic init --preset <nome>      # usa um preset salvo
```

**O que acontece:**

1. Garante que existe um `corePath` configurado (oferece clone se ausente)
2. Se `.adapted/` está vazio mas o core tem `agents/`/`skills/`, roda `adapt` automaticamente
3. Detecta stack pelo `package.json`, `pyproject.toml` ou `Cargo.toml`
4. Exibe checklist (ou pula se `--all` / `--preset`)
5. Cria `.claude/agents/` e `.claude/skills/` com os arquivos selecionados
6. Se `CLAUDE.md` não existe, gera um template base com a stack detectada; se já existe, pergunta se deve sobrescrever
7. Grava `.claude/agnostic-manifest.json` com o que foi instalado

**Detecção de stack e pré-seleção padrão:**

| Stack detectada | Agents pré-selecionados |
|---|---|
| React (`react` em deps) | `reviewers-frontend-reviewer`, `specialists-seo-specialist`, `reviewers-code-inspector` |
| Node (qualquer `package.json` sem react) | `reviewers-architecture-reviewer`, `reviewers-security-reviewer`, `reviewers-code-inspector` |
| Python (`pyproject.toml` ou `requirements.txt`) | `reviewers-security-reviewer`, `reviewers-code-inspector` |
| Rust (`Cargo.toml`) | `reviewers-security-reviewer` |
| Desconhecido | nenhum pré-selecionado |

---

### `agnostic adapt`

Processa os arquivos do `agnostic-core` e gera versões compatíveis com Claude Code em `.adapted/`.

```
agnostic adapt                     # processa todos os agents e skills
agnostic adapt --agent <nome>      # processa apenas um agente específico
```

**O que acontece por arquivo:**

- Tem `name:` e `description:` no frontmatter → copiado para `.adapted/` sem modificação (`✓ already valid`)
- Não tem frontmatter ou está incompleto → recebe stub com `description: "" # TODO` (`⚠ stub generated`)

Rode `agnostic adapt` sempre que adicionar novos arquivos ao `agnostic-core`. É idempotente — arquivos já válidos não são tocados. Em geral você não precisa rodar manualmente: `init`, `update` e `preset create` invocam `adapt` automaticamente quando necessário.

Se `--agent` for usado com um nome inexistente, o CLI lista os disponíveis e aborta.

---

### `agnostic update`

Re-executa `adapt` e reinstala todos os arquivos já presentes no projeto atual.

```
agnostic update
```

**O que acontece:**

1. Re-roda `adapt` — atualiza `.adapted/` com o estado atual do agnostic-core
2. Aborta com mensagem clara se o `corePath` não tem `agents/` nem `skills/`
3. Inspeciona `.claude/agents/` e `.claude/skills/` no projeto corrente
4. Para cada arquivo instalado como cópia, sobrescreve com a versão mais recente de `.adapted/`
5. Arquivos instalados como symlinks já apontam para `.adapted/` — nenhuma ação necessária
6. Lista arquivos órfãos ao final (instalados em `.claude/` mas que não existem mais no core atual) com instruções para limpar

---

### `agnostic doctor`

Diagnostica a configuração e sugere o próximo comando a rodar.

```
agnostic doctor
```

Verifica em ordem: profile salvo → `corePath` válido → conteúdo de `agents/`/`skills/` → `.adapted/` populado → `.claude/` no projeto → consistência do manifest com `.adapted/`.

Cada verificação exibe um ícone (`✓` ok, `⚠` warn, `✗` fail) e, quando relevante, o comando exato para corrigir o problema.

```
agnostic doctor

✓ Profile encontrado
✓ corePath: /Users/voce/.agnostic/core
✓ Core tem 17 agent(s) e 93 skill(s)
✓ .adapted/ tem 17 agent(s) e 93 skill(s)
⚠ .claude/ existe mas sem agnostic-manifest.json
  → Rode `agnostic init` ou `agnostic update` para gerar o manifest.
```

---

### `agnostic preset`

Cria e lista presets de agents/skills para tipos de projeto.

```
agnostic preset create <nome>   # cria um novo preset interativamente
agnostic preset list            # lista presets salvos com contagem de itens
```

**Criar um preset:**

```sh
agnostic preset create node-api
# [checklist de agents] → selecione
# [checklist de skills] → selecione
# ✓ preset "node-api" salvo
```

Presets são salvos em `~/.config/agnostic/presets/<nome>.json`. Para usar:

```sh
agnostic init --preset node-api
```

---

### `agnostic config`

Gerencia a configuração persistida em `~/.config/agnostic/profile.json`.

```
agnostic config set corePath <caminho>   # define o path do agnostic-core
agnostic config get                      # exibe a configuração atual
```

O caminho aceita:

- Path absoluto (`/Users/voce/dev/agnostic-core`, `D:\projetos\core`)
- `~` ou `~/...` para o diretório home
- Path relativo, resolvido contra o `cwd` atual

**Exemplo:**

```sh
agnostic config set corePath ~/dev/agnostic-core
# ✓ corePath definido: /Users/voce/dev/agnostic-core

agnostic config get
# {
#   "agnosticCorePath": "/Users/voce/dev/agnostic-core"
# }
```

Se `profile.json` não existir quando `init`, `adapt` ou `update` for rodado, o CLI oferece duas opções: clonar o repositório padrão em `~/.agnostic/core` ou informar um caminho local existente.

---

## Presets

Presets são listas salvas de agents + skills para um tipo de projeto, úteis quando você cria projetos similares com frequência.

Os presets ficam em `~/.config/agnostic/presets/<nome>.json`:

```json
{
  "agents": ["reviewers-code-inspector", "reviewers-security-reviewer"],
  "skills": ["backend-rest-api-design", "security-api-hardening"]
}
```

**Criar um preset:**

```sh
agnostic preset create node-api
```

**Listar presets salvos:**

```sh
agnostic preset list
```

**Usar um preset no `init`:**

```sh
agnostic init --preset node-api
```

---

## Erros comuns

| Situação | O que o CLI faz | O que fazer |
|---|---|---|
| `profile.json` ausente | Pergunta: clonar core padrão ou informar path | Escolher uma das opções interativamente |
| `corePath` aponta para diretório inexistente | Erro com sugestão de rodar `agnostic doctor` | `agnostic config set corePath <caminho>` ou `agnostic doctor` |
| `corePath` existe mas sem `agents/`/`skills/` | Aviso e abort no `update`/`init` | Verificar submodule (`git submodule update --init`) ou apontar para outro core |
| `.adapted/` ausente | `init`/`preset create`/`update` rodam `adapt` automaticamente | Nada — segue o fluxo |
| Symlink falha por permissão (Windows) | Aviso amarelo + pergunta se usa cópia | Confirmar `y` ou rodar com `--copy` |
| `CLAUDE.md` já existe | Pergunta: sobrescrever ou manter | Escolher interativamente |
| Arquivo instalado em `.claude/` que não está mais no core | `update` lista como órfão ao final | Remover de `.claude/agents` ou `.claude/skills` e rodar `agnostic init` |
| Arquivo `.md` sem frontmatter em `adapt` | Gera stub marcado com `TODO` | Editar manualmente e preencher `description` |

> Não tem certeza do estado atual? `agnostic doctor` resume tudo em uma tela.

---

## Fora de escopo (v0.2.0)

- `agnostic preset delete` — remoção de presets via CLI
- Publicação no npm
- Suporte a múltiplos perfis
- Rastreamento multi-projeto para `agnostic update`
