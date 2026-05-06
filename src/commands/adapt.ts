import chalk from 'chalk'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

interface AdaptOptions {
  agent?: string
}

function hasValidFrontmatter(content: string): boolean {
  if (!content.startsWith('---')) return false
  const end = content.indexOf('---', 3)
  if (end === -1) return false
  const block = content.slice(3, end)
  return block.includes('name:') && block.includes('description:')
}

function generateStub(filename: string, original: string): string {
  const name = filename.replace(/\.md$/, '')
  return `---\nname: ${name}\ndescription: "" # TODO: descreva quando ativar este agente\ntools: Read, Grep, Glob, Bash\n---\n\n${original}`
}

export async function adaptCommand(corePath: string, options: AdaptOptions): Promise<void> {
  const adaptedDir = join(corePath, '.adapted')
  if (!existsSync(adaptedDir)) mkdirSync(adaptedDir, { recursive: true })

  for (const dir of ['agents', 'skills']) {
    const srcDir = join(corePath, dir)
    if (!existsSync(srcDir)) continue

    const destDir = join(adaptedDir, dir)
    if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true })

    const files = readdirSync(srcDir).filter(f => f.endsWith('.md'))
    for (const file of files) {
      if (options.agent && file !== `${options.agent}.md`) continue

      const content = readFileSync(join(srcDir, file), 'utf-8')
      if (hasValidFrontmatter(content)) {
        writeFileSync(join(destDir, file), content)
        console.log(chalk.green(`✓ already valid: ${dir}/${file}`))
      } else {
        writeFileSync(join(destDir, file), generateStub(file, content))
        console.log(chalk.yellow(`⚠ stub generated (needs review): ${dir}/${file}`))
      }
    }
  }
}
