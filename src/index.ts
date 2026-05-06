#!/usr/bin/env bun
import { Command } from 'commander'
import { adaptCommand } from './commands/adapt.js'
import { configGetCommand, configSetCommand, ensureCorePath } from './commands/config.js'
import { initCommand } from './commands/init.js'

const program = new Command()
const { version } = await import('../package.json', { assert: { type: 'json' } })
program.name('agnostic').description('Bootstrap de projetos com agentes Claude Code').version(version)

program
  .command('init')
  .description('Instala agents e skills no projeto atual')
  .option('--preset <name>', 'usa preset salvo')
  .option('--all', 'instala tudo sem perguntar')
  .option('--copy', 'força cópia em vez de symlink')
  .action(async options => {
    const corePath = await ensureCorePath()
    await initCommand(corePath, process.cwd(), options)
  })

program
  .command('adapt')
  .description('Adapta arquivos do agnostic-core para o formato Claude Code')
  .option('--agent <name>', 'adapta apenas um agente específico')
  .action(async options => {
    const corePath = await ensureCorePath()
    await adaptCommand(corePath, options)
  })

const configCmd = program.command('config').description('Gerencia configuração do agnostic')

configCmd
  .command('set <key> <value>')
  .description('Define uma configuração (ex: corePath /caminho)')
  .action(configSetCommand)

configCmd
  .command('get')
  .description('Exibe a configuração atual')
  .action(configGetCommand)

program.parse()
