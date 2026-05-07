import chalk from 'chalk'
import { existsSync, lstatSync, readdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import { linkFile } from '../lib/linker.js'
import { adaptCommand } from './adapt.js'

export async function updateCommand(corePath: string, projectDir: string): Promise<void> {
  console.log(chalk.blue('↻ Re-adaptando agnostic-core...'))
  await adaptCommand(corePath, {})

  const claudeDir = join(projectDir, '.claude')
  if (!existsSync(claudeDir)) {
    console.log(chalk.yellow('⚠ .claude/ não encontrado — rode `agnostic init` primeiro.'))
    return
  }

  let updated = 0
  for (const type of ['agents', 'skills'] as const) {
    const installedDir = join(claudeDir, type)
    if (!existsSync(installedDir)) continue

    for (const file of readdirSync(installedDir).filter(f => f.endsWith('.md'))) {
      const dest = join(installedDir, file)
      const src = join(corePath, '.adapted', type, file)

      if (!existsSync(src)) {
        console.log(chalk.yellow(`⚠ skipped: ${type}/${file} (não encontrado em .adapted/)`))
        continue
      }

      if (lstatSync(dest).isSymbolicLink()) {
        console.log(chalk.blue(`→ symlink, já atualizado: ${type}/${file}`))
        continue
      }

      unlinkSync(dest)
      const result = linkFile(src, dest, true)
      if (result.success) {
        console.log(chalk.green(`✓ updated: ${type}/${file}`))
        updated++
      } else {
        console.log(chalk.red(`✗ failed: ${type}/${file} — ${result.error}`))
      }
    }
  }

  console.log(chalk.green(`✓ Update concluído. ${updated} arquivo(s) copiado(s) atualizado(s).`))
}
