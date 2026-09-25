import { APP_ROLES, type AppRole } from './domain'

export type AllowlistEntry = {
  email: string
  role: AppRole
}

/** Kogo wpuszczamy na start: Martyna + leadzi / CS z września. Env nadpisuje rolę. */
export const DEFAULT_CS_TEAM: AllowlistEntry[] = [
  { email: 'martyna.kalicka@sun.store', role: 'admin' },
  { email: 'armand.banaszkiewicz@sun.store', role: 'lead' },
  { email: 'antoni.pajestka@sun.store', role: 'lead' },
  { email: 'sebastian.dziedzic@sun.store', role: 'lead' },
  { email: 'monika.polkowska@sun.store', role: 'lead' },
  { email: 'szymon.poblocki@sun.store', role: 'lead' },
  { email: 'yuliia.bardai@sun.store', role: 'lead' },
  { email: 'paulina.wojcik@sun.store', role: 'lead' },
  { email: 'damian.mastrolia@sun.store', role: 'lead' }
]

export function parseAllowlist(raw: string): AllowlistEntry[] {
  return raw
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [email, roleRaw] = part.split(':').map(piece => piece.trim())
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
