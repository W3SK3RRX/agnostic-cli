# agnostic-cli

> Bootstrap de projetos com agentes Claude Code — instala agents e skills do [agnostic-core](https://github.com/paulinett1528-dev/agnostic-core) em qualquer projeto com um comando.

**Versão:** 0.1.0 · **Runtime:** [Bun](https://bun.sh)

---

## Por que existe

Configurar um projeto para usar agentes Claude Code envolve criar `.claude/agents/`, `.claude/skills/`, ajustar frontmatter de cada arquivo markdown e escrever um `CLAUDE.md` inicial — trabalho manual que se repete a cada projeto novo.

O `agnostic-cli` automatiza esse setup: lê o `agnostic-core` (sua biblioteca central de agents/skills), detecta a stack do projeto atual e instala os arquivos certos com um único comando. Symlinks garantem que melhorias futuras no `agnostic-core` chegam a todos os projetos sem nenhuma ação extra.

---

## Pré-requisitos

- [Bun](https://bun.sh) instalado (`bun --version` deve funcionar)
- `agnostic-core` clonado localmente (ex: `~/dev/agnostic-core`)

---

## Instalação

No diretório do repositório:

```sh
bun link
```

Isso registra o comando `agnostic` globalmente. Para verificar:

```sh
agnostic --version
# 0.1.0
```

Para desinstalar: `bun unlink agnostic-cli`

---

## Primeira execução

Três passos para deixar um projeto pronto:

**1. Configurar o caminho do agnostic-core**

```sh
agnostic config set corePath ~/dev/agnostic-core
# ✓ corePath definido: /Users/você/dev/agnostic-core
```

Feito uma vez — fica salvo em `~/.config/agnostic/profile.json`.

**2. Adaptar os arquivos do agnostic-core ao formato Claude Code**

```sh
agnostic adapt
# ✓ already valid: agents/code-inspector.md
# ⚠ stub generated (needs review): agents/debug-workflow.md
# ✓ already valid: skills/security.md
# ...
```

Arquivos com frontmatter válido (`name` + `description`) são copiados diretamente para `.adapted/`. Arquivos sem frontmatter recebem um stub marcado com `TODO` — você revisa e preenche a `description` manualmente.

**3. Inicializar o projeto atual**

```sh
cd meu-projeto
agnostic init
```

O CLI detecta a stack (React, Node, Python ou Rust), exibe um checklist interativo com os agents/skills disponíveis (pré-selecionando os relevantes para a stack detectada) e cria `.claude/agents/`, `.claude/skills/` e `CLAUDE.md`.

Para projetos Windows ou quando symlinks não têm permissão:

```sh
agnostic init --copy
```

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

1. Verifica que `agnosticCorePath/.adapted/` existe
2. Detecta stack pelo `package.json`, `pyproject.toml` ou `Cargo.toml`
3. Exibe checklist (ou pula se `--all` / `--preset`)
4. Cria `.claude/agents/` e `.claude/skills/` com os arquivos selecionados
5. Se `CLAUDE.md` não existe, gera um template base com a stack detectada; se já existe, pergunta se deve sobrescrever

**Detecção de stack e pré-seleção padrão:**

| Stack detectada | Agents pré-selecionados |
|---|---|
| React (`react` em deps) | `frontend-html-css-audit`, `frontend-accessibility`, `audit-systematic-debugging` |
| Node (qualquer `package.json` sem react) | `backend-rest-api-design`, `backend-error-handling`, `security-api-hardening` |
| Python (`pyproject.toml` ou `requirements.txt`) | `backend-rest-api-design`, `security-owasp-checklist` |
| Rust (`Cargo.toml`) | `security-owasp-checklist` |
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

Rode `agnostic adapt` sempre que adicionar novos arquivos ao `agnostic-core`. É idempotente — arquivos já válidos não são tocados.

---

### `agnostic config`

Gerencia a configuração persistida em `~/.config/agnostic/profile.json`.

```
agnostic config set corePath <caminho>   # define o path do agnostic-core
agnostic config get                      # exibe a configuração atual
```

**Exemplo:**

```sh
agnostic config set corePath /Users/hclaudio/dev/agnostic-core
# ✓ corePath definido: /Users/hclaudio/dev/agnostic-core

agnostic config get
# {
#   "agnosticCorePath": "/Users/hclaudio/dev/agnostic-core"
# }
```

Se `profile.json` não existir quando `init` ou `adapt` for rodado, o CLI pergunta o `corePath` interativamente e salva automaticamente.

---

## Presets

Presets são listas salvas de agents + skills para um tipo de projeto, úteis quando você cria projetos similares com frequência.

Os presets ficam em `~/.config/agnostic/presets/<nome>.json`:

```json
{
  "agents": ["code-inspector", "security-reviewer"],
  "skills": ["backend-rest-api-design", "security-api-hardening"]
}
```

Para usar:

```sh
agnostic init --preset node-api
```

Atualmente os presets são criados e editados manualmente. A criação via CLI está no roadmap.

---

## Erros comuns

| Situação | O que o CLI faz | O que fazer |
|---|---|---|
| `profile.json` ausente | Pergunta `corePath` interativamente | Informar o caminho e confirmar |
| `agnostic-core` não encontrado no path configurado | Erro com instrução | `agnostic config set corePath <caminho-correto>` |
| `.adapted/` não existe | Erro: rode `agnostic adapt` primeiro | Rodar `agnostic adapt` |
| Symlink falha por permissão (Windows) | Aviso amarelo + pergunta se usa cópia | Confirmar `y` ou rodar com `--copy` |
| `CLAUDE.md` já existe | Pergunta: sobrescrever ou manter | Escolher interativamente |
| Agent do preset não existe em `.adapted/` | Aviso (não erro fatal) — pula o item | Rodar `agnostic adapt` para gerar o arquivo |
| Arquivo `.md` sem frontmatter em `adapt` | Gera stub marcado com `TODO` | Editar manualmente e preencher `description` |

---

## Fora de escopo (v0.1.0)

- `agnostic update` — sincronizar agents já instalados quando o agnostic-core mudar
- Criação de presets via CLI
- Publicação no npm
- Suporte a múltiplos perfis
