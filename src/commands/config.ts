import { confirm, input, select } from '@inquirer/prompts'
import chalk from 'chalk'
import { existsSync } from 'fs'
import { cloneCore, DEFAULT_CORE_REPO, defaultCoreDir, isGitAvailable } from '../lib/bootstrap.js'
import { getCorePath, readProfile, writeProfile } from '../lib/config.js'
import { expandPath } from '../lib/paths.js'

export async function configSetCommand(key: string, value: string): Promise<void> {
  if (key !== 'corePath') {
    console.error(chalk.red(`✗ Chave desconhecida: "${key}". Chaves válidas: corePath`))
    process.exit(1)
  }
  const resolved = expandPath(value)
  if (!existsSync(resolved)) {
    console.error(chalk.red(`✗ Path não encontrado: ${resolved}`))
    console.error(chalk.gray('  Dica: rode `agnostic doctor` para ver opções de bootstrap.'))
    process.exit(1)
  }
  const profile = readProfile() ?? { agnosticCorePath: '' }
  profile.agnosticCorePath = resolved
  writeProfile(profile)
  console.log(chalk.green(`✓ corePath definido: ${resolved}`))
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

  const choice = await select({
    message: 'Como deseja configurar?',
    choices: [
      { name: `Clonar repositório padrão em ${defaultCoreDir()}`, value: 'clone' },
      { name: 'Informar caminho local existente', value: 'path' },
    ],
  })

  if (choice === 'clone') {
    const target = defaultCoreDir()
    if (!isGitAvailable()) {
      console.error(chalk.red('✗ git não está disponível no PATH. Instale git ou informe um path local.'))
      process.exit(1)
    }
    if (existsSync(target)) {
      const reuse = await confirm({ message: `${target} já existe. Usar este diretório?` })
      if (!reuse) process.exit(1)
    } else {
      console.log(chalk.blue(`↻ Clonando ${DEFAULT_CORE_REPO} em ${target}...`))
      const result = cloneCore(DEFAULT_CORE_REPO, target)
      if (!result.ok) {
        console.error(chalk.red(`✗ ${result.error}`))
        process.exit(1)
      }
    }
    const profile = readProfile() ?? { agnosticCorePath: '' }
    profile.agnosticCorePath = target
    writeProfile(profile)
    console.log(chalk.green(`✓ corePath definido: ${target}`))
    return target
  }

  const path = await input({ message: 'Caminho para o agnostic-core:' })
  const resolved = expandPath(path)
  if (!existsSync(resolved)) {
    console.error(chalk.red(`✗ Path não encontrado: ${resolved}`))
    process.exit(1)
  }
  const profile = readProfile() ?? { agnosticCorePath: '' }
  profile.agnosticCorePath = resolved
  writeProfile(profile)
  console.log(chalk.green(`✓ corePath definido: ${resolved}`))
  return resolved
}
