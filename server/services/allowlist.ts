import type { AppRole } from '../../shared/domain'
import { APP_ROLES } from '../../shared/domain'
import { isCompanyEmail } from '../../shared/company-email'
import { mergeAllowlist, type AllowlistEntry } from '../../shared/allowlist'
import { neonQuery } from './neon-db'

export type { AllowlistEntry }

export function parseAllowlistEnv(raw = process.env.AUTH_ALLOWLIST || ''): AllowlistEntry[] {
  return mergeAllowlist(raw)
}

export async function syncAllowlistFromEnv() {
  for (const entry of parseAllowlistEnv()) {
    await neonQuery(
      `insert into allowlist (email, role) values ($1, $2)
       on conflict (email) do update set role = excluded.role`,
      [entry.email, entry.role]
    )
  }
}

export async function findAllowlistRole(email: string): Promise<AppRole | null> {
  await syncAllowlistFromEnv()
  const rows = await neonQuery<{ role: AppRole }>(
    'select role from allowlist where email = $1',
    [email.trim().toLowerCase()]
  )
  return rows[0]?.role ?? null
}

export async function listAllowlist() {
  await syncAllowlistFromEnv()
  return neonQuery<{ email: string, role: AppRole, created_at: Date }>(
    'select email, role, created_at from allowlist order by role, email'
  )
}

export async function upsertAllowlist(email: string, role: AppRole) {
  const normalized = email.trim().toLowerCase()
  if (!isCompanyEmail(normalized)) {
    throw new Error('Tylko adres @sun.store.')
  }
  if (!APP_ROLES.includes(role)) {
    throw new Error('Nieznana rola.')
  }
  const rows = await neonQuery<{ email: string, role: AppRole }>(
    `insert into allowlist (email, role) values ($1, $2)
     on conflict (email) do update set role = excluded.role
     returning email, role`,
    [normalized, role]
  )
  return rows[0]
}
