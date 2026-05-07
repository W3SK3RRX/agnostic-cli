import chalk from 'chalk'
import { existsSync, readdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { readProfile } from '../lib/config.js'
import { readManifest } from '../lib/manifest.js'
import { scanCore } from '../lib/scanner.js'

export interface DoctorCheck {
  name: string
  status: 'ok' | 'warn' | 'fail'
  message: string
  hint?: string
}

export interface DoctorReport {
  checks: DoctorCheck[]
  ok: boolean
}

function countAdapted(corePath: string, type: 'agents' | 'skills'): number {
  const dir = join(corePath, '.adapted', type)
  if (!existsSync(dir)) return 0
  return readdirSync(dir).filter(f => f.endsWith('.md')).length
}

export function runDoctor(projectDir: string, home: string = homedir()): DoctorReport {
  const checks: DoctorCheck[] = []

  const profile = readProfile(home)
  if (!profile) {
    checks.push({
      name: 'profile',
      status: 'fail',
      message: 'Nenhum profile encontrado em ~/.config/agnostic/profile.json',
      hint: 'Rode `agnostic config set corePath <path>` ou `agnostic init` para configurar.',
    })
    return { checks, ok: false }
  }
  checks.push({ name: 'profile', status: 'ok', message: 'Profile encontrado' })

  const corePath = profile.agnosticCorePath
  if (!corePath) {
    checks.push({
      name: 'corePath',
      status: 'fail',
      message: 'corePath vazio no profile',
      hint: 'Rode `agnostic config set corePath <path>`.',
    })
    return { checks, ok: false }
  }

  if (!existsSync(corePath)) {
    checks.push({
      name: 'corePath',
      status: 'fail',
      message: `corePath não existe: ${corePath}`,
      hint: 'Rode `agnostic config set corePath <path>` com um diretório válido.',
    })
    return { checks, ok: false }
  }
  checks.push({ name: 'corePath', status: 'ok', message: `corePath: ${corePath}` })

  const scanned = scanCore(corePath)
  const agentCount = scanned.filter(f => f.type === 'agents').length
  const skillCount = scanned.filter(f => f.type === 'skills').length
  if (agentCount === 0 && skillCount === 0) {
    checks.push({
      name: 'core-content',
      status: 'fail',
      message: 'corePath não contém agents/ nem skills/ com arquivos .md',
      hint: 'Verifique o submodule (`git submodule update --init`) ou aponte para outro core.',
    })
    return { checks, ok: false }
  }
  checks.push({
    name: 'core-content',
    status: 'ok',
    message: `Core tem ${agentCount} agent(s) e ${skillCount} skill(s)`,
  })

  const adaptedAgents = countAdapted(corePath, 'agents')
  const adaptedSkills = countAdapted(corePath, 'skills')
  if (adaptedAgents === 0 && adaptedSkills === 0) {
    checks.push({
      name: 'adapted',
      status: 'warn',
      message: '.adapted/ está vazio ou ausente',
      hint: 'Rode `agnostic adapt` para gerar .adapted/.',
    })
  } else {
    checks.push({
      name: 'adapted',
      status: 'ok',
      message: `.adapted/ tem ${adaptedAgents} agent(s) e ${adaptedSkills} skill(s)`,
    })
  }

  const claudeDir = join(projectDir, '.claude')
  if (!existsSync(claudeDir)) {
    checks.push({
      name: 'project',
      status: 'warn',
      message: 'Projeto atual não tem .claude/ — ainda não foi inicializado',
      hint: 'Rode `agnostic init` para instalar agents e skills neste projeto.',
    })
  } else {
    const manifest = readManifest(projectDir)
    if (!manifest) {
      checks.push({
        name: 'manifest',
        status: 'warn',
        message: '.claude/ existe mas sem agnostic-manifest.json',
        hint: 'Rode `agnostic init` ou `agnostic update` para gerar o manifest.',
      })
    } else {
      checks.push({
        name: 'manifest',
        status: 'ok',
        message: `Manifest v${manifest.version} com ${manifest.agents.length} agent(s) e ${manifest.skills.length} skill(s)`,
      })

      const missing: string[] = []
      for (const a of manifest.agents) {
        const path = join(corePath, '.adapted', 'agents', `${a.name}.md`)
        if (!existsSync(path)) missing.push(`agents/${a.name}.md`)
      }
      for (const s of manifest.skills) {
        const path = join(corePath, '.adapted', 'skills', `${s.name}.md`)
        if (!existsSync(path)) missing.push(`skills/${s.name}.md`)
      }
      if (missing.length > 0) {
        checks.push({
          name: 'manifest-sync',
          status: 'warn',
          message: `${missing.length} arquivo(s) do manifest não estão em .adapted/`,
          hint: 'Rode `agnostic adapt` (ou `agnostic update`) para regenerá-los.',
        })
      }
    }
  }

  const ok = checks.every(c => c.status === 'ok')
  return { checks, ok }
}

export async function doctorCommand(projectDir: string, home: string = homedir()): Promise<void> {
  console.log(chalk.bold('agnostic doctor\n'))
  const report = runDoctor(projectDir, home)

  for (const check of report.checks) {
    const icon = check.status === 'ok' ? chalk.green('✓') : check.status === 'warn' ? chalk.yellow('⚠') : chalk.red('✗')
    console.log(`${icon} ${check.message}`)
    if (check.hint) console.log(chalk.gray(`  → ${check.hint}`))
  }

  console.log()
  if (report.ok) {
    console.log(chalk.green('Tudo certo! ✨'))
  } else if (report.checks.some(c => c.status === 'fail')) {
    console.log(chalk.red('Há problemas que precisam ser corrigidos antes de continuar.'))
    process.exitCode = 1
  } else {
    console.log(chalk.yellow('Há avisos. O CLI funciona, mas alguns passos podem estar incompletos.'))
  }
}
