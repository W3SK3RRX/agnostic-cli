import { checkbox } from '@inquirer/prompts'
import { listAdapted } from '../lib/scanner.js'

export async function selectItems(
  corePath: string,
  type: 'agents' | 'skills',
  recommended: string[],
): Promise<string[]> {
  const items = listAdapted(corePath, type)
  if (items.length === 0) return []
  return checkbox({
    message: `Selecione os ${type} a instalar:`,
    choices: items.map(i => ({ value: i, checked: recommended.includes(i) })),
  })
}
