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
