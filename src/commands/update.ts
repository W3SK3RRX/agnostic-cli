import chalk from 'chalk'
import { existsSync, lstatSync, readdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import { detectStack } from '../lib/detect-stack.js'
import { linkFile } from '../lib/linker.js'
import { generateManifest, writeManifest } from '../lib/manifest.js'
import { scanCore } from '../lib/scanner.js'
import { adaptCommand } from './adapt.js'

export async function updateCommand(corePath: string, projectDir: string): Promise<void> {
  console.log(chalk.blue('↻ Re-adaptando agnostic-core...'))
  await adaptCommand(corePath, {})

  if (scanCore(corePath).length === 0) {
    console.error(chalk.red('✗ corePath não tem agents/ nem skills/ com conteúdo. Update abortado.'))
    console.error(chalk.gray('  Rode `agnostic doctor` para diagnosticar.'))
    return
  }

  const claudeDir = join(projectDir, '.claude')
  if (!existsSync(claudeDir)) {
    console.log(chalk.yellow('⚠ .claude/ não encontrado neste projeto.'))
    console.log(chalk.gray('  Rode `agnostic init` antes de `agnostic update`.'))
    return
  }

  let updated = 0
  const orphans: string[] = []

  for (const type of ['agents', 'skills'] as const) {
    const installedDir = join(claudeDir, type)
    if (!existsSync(installedDir)) continue

    for (const file of readdirSync(installedDir).filter(f => f.endsWith('.md'))) {
      const dest = join(installedDir, file)
      const src = join(corePath, '.adapted', type, file)

      if (!existsSync(src)) {
        orphans.push(`${type}/${file}`)
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

  if (orphans.length > 0) {
    console.log()
    console.log(chalk.yellow(`⚠ ${orphans.length} arquivo(s) instalado(s) não existem mais no core atual:`))
    for (const o of orphans) console.log(chalk.gray(`  - ${o}`))
    console.log(chalk.gray('  Esses arquivos vieram de um core diferente ou foram removidos.'))
    console.log(chalk.gray('  Para limpar, remova-os de .claude/agents ou .claude/skills e rode `agnostic init`.'))
  }

  const installedAgents = buildInstalledList(claudeDir, 'agents', corePath)
  const installedSkills = buildInstalledList(claudeDir, 'skills', corePath)
  const stack = detectStack(projectDir)
  const manifest = generateManifest(installedAgents, installedSkills, stack)
  writeManifest(manifest, projectDir)
  console.log(chalk.gray('  manifest: .claude/agnostic-manifest.json'))

  console.log(chalk.green(`✓ Update concluído. ${updated} arquivo(s) copiado(s) atualizado(s).`))
}

function buildInstalledList(
  claudeDir: string,
  type: 'agents' | 'skills',
  corePath: string,
): Array<{ name: string; adaptedPath: string; installType: 'symlink' | 'copy' }> {
  const dir = join(claudeDir, type)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const dest = join(dir, f)
      const name = f.replace(/\.md$/, '')
      return {
        name,
        adaptedPath: join(corePath, '.adapted', type, f),
        installType: lstatSync(dest).isSymbolicLink() ? 'symlink' : 'copy',
      }
    })
}
