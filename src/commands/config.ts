import { input } from '@inquirer/prompts'
import chalk from 'chalk'
import { existsSync } from 'fs'
import { getCorePath, readProfile, writeProfile } from '../lib/config.js'

export async function configSetCommand(key: string, value: string): Promise<void> {
  if (key !== 'corePath') {
    console.error(chalk.red(`✗ Chave desconhecida: "${key}". Chaves válidas: corePath`))
    process.exit(1)
  }
  if (!existsSync(value)) {
    console.error(chalk.red(`✗ Path não encontrado: ${value}`))
    process.exit(1)
  }
  const profile = readProfile() ?? { agnosticCorePath: '' }
  profile.agnosticCorePath = value
  writeProfile(profile)
  console.log(chalk.green(`✓ corePath definido: ${value}`))
}

export function configGetCommand(): void {
  const profile = readProfile()
  if (!profile) {
    console.log(chalk.yellow('Nenhuma configuração encontrada. Rode: agnostic config set corePath <path>'))
    return
  }
  console.log(JSON.stringify(profile, null, 2))
}

export async function ensureCorePath(): Promise<string> {
  const corePath = getCorePath()
  if (corePath && existsSync(corePath)) return corePath

  console.log(chalk.yellow('agnostic-core não configurado.'))
  const path = await input({ message: 'Caminho para o agnostic-core:' })
  if (!existsSync(path)) {
    console.error(chalk.red(`✗ Path não encontrado: ${path}`))
    process.exit(1)
  }
  const profile = readProfile() ?? { agnosticCorePath: '' }
  profile.agnosticCorePath = path
  writeProfile(profile)
  return path
}
