# Proposta: Integração com agnostic-manifest.json

## Contexto

O pixel-agents já tem um campo `agentName` em `AgentState`, populado pelo `transcriptParser.ts` quando detecta metadados de time no JSONL. Esse `agentName` é o nome do sub-agente Claude Code — por exemplo `reviewers-security-reviewer`.

O `agnostic-cli` (ferramenta de bootstrap de projetos Claude Code) agora gera um arquivo `.claude/agnostic-manifest.json` em cada projeto após `agnostic init` ou `agnostic update`, contendo metadados de todos os agents instalados.

**Problema atual:** o pixel-agents sabe que um agente chamado `reviewers-security-reviewer` está ativo, mas não tem descrição, role ou nenhuma informação semântica sobre ele — porque essa informação está nos arquivos `.md`, não nos JSONL.

---

## O que o manifest fornece

Exemplo de `.claude/agnostic-manifest.json`:

```json
{
  "version": "1",
  "generatedAt": "2026-05-06T15:30:00.000Z",
  "stack": "node",
  "agents": [
    {
      "name": "reviewers-security-reviewer",
      "role": "reviewers",
      "category": null,
      "description": "Revisa código em busca de vulnerabilidades OWASP Top 10. Usar antes de deploy ou ao adicionar endpoints de API.",
      "installType": "symlink"
    },
    {
      "name": "specialists-seo-specialist",
      "role": "specialists",
      "category": null,
      "description": "Audita SEO de páginas web. Usar ao publicar novas páginas ou modificar estrutura de URLs.",
      "installType": "copy"
    }
  ],
  "skills": [
    {
      "name": "security-api-hardening",
      "role": null,
      "category": "security",
      "description": "Use quando precisar de hardening de API ou revisão de autenticação.",
      "installType": "symlink"
    }
  ]
}
```

---

## Proposta de integração mínima

### Novo arquivo: `src/manifestReader.ts`

```typescript
import * as fs from 'fs'
import * as path from 'path'
import * as vscode from 'vscode'

interface ManifestEntry {
  name: string
  role: string | null
  category: string | null
  description: string
  installType: 'symlink' | 'copy'
}

interface AgnosticManifest {
  version: '1'
  generatedAt: string
  stack: string
  agents: ManifestEntry[]
  skills: ManifestEntry[]
}

export interface AgentMetadata {
  description: string
  role: string | null
}

export function readAgentMetadata(projectDir: string, agentName: string): AgentMetadata | null {
  const manifestPath = path.join(projectDir, '.claude', 'agnostic-manifest.json')
  if (!fs.existsSync(manifestPath)) return null

  try {
    const manifest: AgnosticManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
    const entry = manifest.agents.find(a => a.name === agentName)
    if (!entry) return null
    return { description: entry.description, role: entry.role }
  } catch {
    return null
  }
}
```

### Integração em `transcriptParser.ts`

Após a linha onde `agent.agentName` é setado (quando `teamMeta?.agentName` é detectado):

```typescript
// Após: agent.agentName = teamMeta.agentName
if (teamMeta.agentName && agent.projectDir) {
  const metadata = readAgentMetadata(agent.projectDir, teamMeta.agentName)
  if (metadata) {
    agent.agentDescription = metadata.description
    agent.agentRole = metadata.role
  }
}
```

### Campos novos em `AgentState` (types.ts)

```typescript
agentDescription?: string   // da description: do frontmatter do agent
agentRole?: string | null   // prefixo do nome: reviewers-X → 'reviewers'
```

### O que a webview ganha

Com `agentDescription` e `agentRole` disponíveis no `AgentState`:
- **Nameplate do personagem**: mostrar o role em vez de "Character N"
- **Tooltip/balão de fala**: mostrar a description quando o usuário hoveia o personagem
- **Character selection**: mapear role → tipo de personagem (reviewers = persona formal, specialists = persona técnica, etc.)

---

## Por que isso resolve o problema de dessincronização

O README menciona: *"the way agents are connected to Claude Code terminal instances is not super robust and sometimes desyncs"*

O manifest é escrito no disco antes dos agentes iniciarem (no `agnostic init`). Quando o pixel-agents detecta o `agentName` no JSONL, o manifest já existe e é uma leitura de arquivo simples — sem race condition, sem polling, sem dependência de eventos de terminal.

---

## Compatibilidade

- A leitura do manifest é opt-in: se `.claude/agnostic-manifest.json` não existe, `readAgentMetadata` retorna `null` e nada muda no comportamento atual
- Nenhuma alteração em comandos, configurações ou UI obrigatória
- Zero dependências externas (apenas `fs` e `path` do Node.js)
