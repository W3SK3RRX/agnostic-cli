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
