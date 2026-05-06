# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
bun test                        # run all tests
bun test tests/lib/linker.test.ts  # run a single test file
bun run start                   # run the CLI directly
bun link                        # register `agnostic` globally
```

## Architecture

This is a Bun-based CLI (no compilation step — Bun runs TypeScript directly). Entry point is `src/index.ts`, which wires up three commands via `commander`.

**Command flow:**

- `agnostic init` → `ensureCorePath()` → `initCommand(corePath, cwd, options)`
- `agnostic adapt` → `ensureCorePath()` → `adaptCommand(corePath, options)`
- `agnostic config set/get` → `configSetCommand` / `configGetCommand`

`ensureCorePath()` (in `src/commands/config.ts`) is the shared prerequisite: reads `~/.config/agnostic/profile.json` and prompts interactively if missing.

**Library layer (`src/lib/`):**

| Module | Responsibility |
|---|---|
| `config.ts` | Read/write `~/.config/agnostic/profile.json` (`AgnosticProfile`) |
| `detect-stack.ts` | Infer stack from `package.json`/`pyproject.toml`/`Cargo.toml`; map stack → recommended agents (`STACK_AGENTS`) |
| `linker.ts` | `linkFile(src, dest, forceCopy)` — symlink with EPERM fallback |
| `presets.ts` | Read/write `~/.config/agnostic/presets/<name>.json` |

**Data flow for `init`:**

1. Reads `.adapted/` inside `agnosticCorePath` (populated by `adapt`)
2. Determines agent/skill list via preset, `--all`, or interactive checkbox (pré-selected by detected stack)
3. Calls `linkFile` for each item into `<projectDir>/.claude/agents/` and `.claude/skills/`
4. Generates `CLAUDE.md` in the target project if absent (or on confirmation)

**`adapt` command:** Scans `agnosticCorePath/agents/` and `agnosticCorePath/skills/` for `.md` files. Files with valid frontmatter (`name:` + `description:`) are copied to `.adapted/`; others get a stub with `# TODO`.

**Preset files** are JSON at `~/.config/agnostic/presets/<name>.json` with shape `{ agents: string[], skills: string[] }`. Created/edited manually (CLI creation is out of scope for v0.1.0).

**Tests** use `bun:test` and create isolated `tmpdir` fixtures — no mocking of the filesystem.

---

## Acervo de Referencia - agnostic-core

Submodule em `.agnostic-core/` com skills, agents e workflows reutilizaveis.
Consultar quando relevante para a tarefa em andamento.

### Skills Relevantes (detectadas para este stack)

Testes:
  Unit Testing:          .agnostic-core/skills/testing/unit-testing.md
  TDD Workflow:          .agnostic-core/skills/testing/tdd-workflow.md

Performance:
  Performance Audit:     .agnostic-core/skills/performance/performance-audit.md
  Caching Strategies:    .agnostic-core/skills/performance/caching-strategies.md

Deploy:
  Pre-Deploy Checklist:  .agnostic-core/skills/devops/pre-deploy-checklist.md

Qualidade:
  Code Review:           .agnostic-core/skills/audit/code-review.md
  Debugging:             .agnostic-core/skills/audit/systematic-debugging.md
  Commit Conventions:    .agnostic-core/skills/git/commit-conventions.md

Produtividade:
  Claude Code Tips:      .agnostic-core/skills/workflow/claude-code-productivity.md
  Context Management:    .agnostic-core/skills/workflow/context-management.md
  Model Routing:         .agnostic-core/skills/ai/model-routing.md

### Commands

  Catalogo completo:     .agnostic-core/commands/claude-code/COMMANDS.md
