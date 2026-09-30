import { APP_ROLES, type AppRole } from './domain'

export type AllowlistEntry = {
  email: string
  role: AppRole
}

/**
 * Brak hardcoded maili w repo (audyt #2). Zespół: tabela `allowlist` (/team)
 * plus opcjonalnie AUTH_ALLOWLIST w env serwera — nie w publicznym kodzie.
 */
export const DEFAULT_CS_TEAM: AllowlistEntry[] = []

export function parseAllowlist(raw: string): AllowlistEntry[] {
  return raw
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [emailPart, roleRaw] = part.split(':').map(piece => piece.trim())
      const email = emailPart ?? ''
      const role = (roleRaw || 'lead') as AppRole
      return {
        email: email.toLowerCase(),
        role: APP_ROLES.includes(role) ? role : 'lead'
      }
    })
    .filter(entry => entry.email.includes('@'))
}

export function mergeAllowlist(envRaw: string): AllowlistEntry[] {
  const roles = new Map<string, AppRole>()
  for (const entry of DEFAULT_CS_TEAM) roles.set(entry.email, entry.role)
  for (const entry of parseAllowlist(envRaw)) roles.set(entry.email, entry.role)
  return [...roles.entries()].map(([email, role]) => ({ email, role }))
}
