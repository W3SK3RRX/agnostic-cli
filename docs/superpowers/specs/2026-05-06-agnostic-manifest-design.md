# agnostic-manifest — Design Spec

**Data:** 2026-05-06
**Escopo:** Gerar `.claude/agnostic-manifest.json` no `init` e `update` para servir como ponto de integração com o pixel-agents e ferramentas futuras.

---

## Problema

O pixel-agents (VS Code extension) identifica agentes por terminal Claude Code e monitora JSONL de transcrição, mas não tem acesso a metadados dos agentes instalados (nome semântico, descrição, role, tipo de instalação). Isso causa dessincronização e impossibilita mapeamento nome→personagem rico.

O `agnostic-cli` instala agentes e skills com metadados completos, mas não os expõe em nenhum contrato legível por outras ferramentas.

---

## Solução

Gerar `.claude/agnostic-manifest.json` ao final de `agnostic init` e `agnostic update`. Arquivo estático, sem dependência de runtime, legível por qualquer ferramenta.

---

## Schema — `.claude/agnostic-manifest.json`

```json
{
  "version": "1",
  "generatedAt": "2026-05-06T12:00:00.000Z",
  "stack": "node",
  "agents": [
    {
      "name": "reviewers-security-reviewer",
      "role": "reviewers",
      "description": "Revisa código em busca de vulnerabilidades OWASP Top 10...",
      "installType": "symlink"
    },
    {
      "name": "project-onboarding",
      "role": null,
      "description": "Onboarding de novos desenvolvedores no projeto...",
      "installType": "copy"
    }
  ],
  "skills": [
    {
      "name": "security-api-hardening",
      "category": "security",
      "description": "Use quando precisar de hardening de API...",
      "installType": "symlink"
    }
  ]
}
```

### Campos

| Campo | Tipo | Origem |
|---|---|---|
| `version` | `"1"` | Constante — incrementar em breaking changes |
| `generatedAt` | ISO 8601 | `new Date().toISOString()` |
| `stack` | `Stack` | Detectado em `init`; re-detectado em `update` |
| `agents[].name` | `string` | Nome prefixado gerado pelo scanner |
| `agents[].role` | `string \| null` | Prefixo do nome: `reviewers-X` → `"reviewers"`, `project-onboarding` → `null` |
| `agents[].description` | `string` | Frontmatter `description:` do arquivo `.adapted/agents/<name>.md` |
| `agents[].installType` | `"symlink" \| "copy"` | Resultado do `linkFile` |
| `skills[].name` | `string` | Idem |
| `skills[].category` | `string \| null` | Mesmo critério que `role` para agents |
| `skills[].description` | `string` | Frontmatter `description:` do arquivo `.adapted/skills/<name>.md` |
| `skills[].installType` | `"symlink" \| "copy"` | Resultado do `linkFile` |

---

## Novo módulo — `src/lib/manifest.ts`

Módulo puro (sem chalk, sem inquirer). Único arquivo de lib novo.

### Interfaces exportadas

```ts
export interface ManifestEntry {
  name: string
  role: string | null      // agents
  category: string | null  // skills (mesmo campo semântico, nome diferente por clareza)
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
```

### Funções exportadas

```ts
// Gera o objeto manifest (pura — não escreve em disco)
export function generateManifest(
  agents: Array<{ name: string; adaptedPath: string; installType: 'symlink' | 'copy' }>,
  skills: Array<{ name: string; adaptedPath: string; installType: 'symlink' | 'copy' }>,
  stack: Stack,
): AgnosticManifest

// Escreve .claude/agnostic-manifest.json no projectDir
export function writeManifest(manifest: AgnosticManifest, projectDir: string): void

// Lê manifest; retorna null se não existir
export function readManifest(projectDir: string): AgnosticManifest | null
```

### Função interna — `deriveRole(name: string): string | null`

```
"reviewers-security-reviewer" → "reviewers"
"specialists-seo-specialist"  → "specialists"
"project-onboarding"          → null  (sem hífen = nível raiz)
```

Regra: se o nome contém `-`, o prefixo até o primeiro `-` é o role. Caso contrário, `null`.

### Função interna — `readDescription(adaptedPath: string): string`

Lê o arquivo `.adapted/<type>/<name>.md`, extrai o valor de `description:` do frontmatter YAML. Retorna string vazia se ausente.

```ts
// Exemplo de parse minimalista (sem biblioteca YAML):
const match = content.match(/^---[\r\n]([\s\S]*?)[\r\n]---/)
// busca linha "description: <valor>"
```

---

## Integração em `init.ts`

Ao final do loop de instalação, `init.ts` coleta os itens instalados e chama `writeManifest`. A `LinkResult` retornada por `linkFile` já indica se foi symlink ou copy.

```ts
// Após loop de instalação:
const manifest = generateManifest(installedAgents, installedSkills, stack)
writeManifest(manifest, cwd)
console.log(chalk.gray('  manifest: .claude/agnostic-manifest.json'))
```

---

## Integração em `update.ts`

Após reinstalar todos os arquivos, re-detecta stack e chama `writeManifest`.

---

## Testes — `tests/lib/manifest.test.ts`

| Caso | O que verifica |
|---|---|
| `deriveRole` com nome prefixado | Retorna o prefixo correto |
| `deriveRole` com nome raiz | Retorna `null` |
| `generateManifest` | Estrutura correta, campos preenchidos |
| `writeManifest` | Cria `.claude/agnostic-manifest.json` com JSON válido |
| `readManifest` arquivo existente | Retorna objeto parseado |
| `readManifest` arquivo ausente | Retorna `null` |
| `readDescription` frontmatter válido | Retorna description correta |
| `readDescription` frontmatter ausente | Retorna string vazia |

---

## Fora de escopo

- Consumo do manifest pelo pixel-agents (responsabilidade deles)
- Validação de schema do manifest na leitura
- `agnostic manifest` como subcomando separado
- Merge de manifests de múltiplos projetos
