import chalk from 'chalk'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { scanCore } from '../lib/scanner.js'

interface AdaptOptions {
  agent?: string
}

function hasValidFrontmatter(raw: string): boolean {
  const content = raw.replace(/^﻿/, '')
  if (!content.startsWith('---')) return false
  const end = content.indexOf('---', 3)
  if (end === -1) return false
  const block = content.slice(3, end)
  return block.includes('name:') && block.includes('description:')
}

function generateStub(name: string, original: string): string {
  return `---\nname: ${name}\ndescription: "" # TODO: descreva quando ativar este agente\ntools: Read, Grep, Glob, Bash\n---\n\n${original}`
}

export async function adaptCommand(corePath: string, options: AdaptOptions): Promise<void> {
  const adaptedDir = join(corePath, '.adapted')
  if (!existsSync(adaptedDir)) mkdirSync(adaptedDir, { recursive: true })

  const files = scanCore(corePath)
  for (const file of files) {
    if (options.agent && file.name !== options.agent) continue

    const destDir = join(adaptedDir, file.type)
    if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true })

    const content = readFileSync(file.srcPath, 'utf-8')
    const destFile = join(destDir, `${file.name}.md`)

    if (hasValidFrontmatter(content)) {
      writeFileSync(destFile, content)
      console.log(chalk.green(`✓ already valid: ${file.type}/${file.name}.md`))
    } else {
      writeFileSync(destFile, generateStub(file.name, content))
      console.log(chalk.yellow(`⚠ stub generated (needs review): ${file.type}/${file.name}.md`))
    }
  }
}
