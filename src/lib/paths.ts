import { homedir } from 'os'
import { isAbsolute, resolve } from 'path'

export function expandPath(input: string, cwd: string = process.cwd(), home: string = homedir()): string {
  let p = input.trim()
  if (p === '~') p = home
  else if (p.startsWith('~/') || p.startsWith('~\\')) p = home + p.slice(1)
  return isAbsolute(p) ? p : resolve(cwd, p)
}
