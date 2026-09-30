import type { AppRole } from '../../shared/domain'
import { APP_ROLES } from '../../shared/domain'
import { isCompanyEmail } from '../../shared/company-email'
import { mergeAllowlist, type AllowlistEntry } from '../../shared/allowlist'
import { isDepartment, type Department } from '../../shared/departments'
import { neonQuery } from './neon-db'

export type { AllowlistEntry }

export type AllowlistMember = {
  email: string
  role: AppRole
  department: Department
  created_at: Date
}

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

export async function findAllowlistEntry(email: string): Promise<{
  role: AppRole
  department: Department
} | null> {
  await syncAllowlistFromEnv()
  const rows = await neonQuery<{ role: AppRole, department: Department }>(
    'select role, department from allowlist where email = $1',
    [email.trim().toLowerCase()]
  )
  return rows[0] ?? null
}

/** @deprecated Prefer findAllowlistEntry — zostaje dla kompatybilności. */
export async function findAllowlistRole(email: string): Promise<AppRole | null> {
  const entry = await findAllowlistEntry(email)
  return entry?.role ?? null
}

export async function listAllowlist() {
  await syncAllowlistFromEnv()
  return neonQuery<AllowlistMember>(
    'select email, role, department, created_at from allowlist order by role, email'
  )
}

export async function upsertAllowlist(
  email: string,
  role: AppRole,
  department: Department = 'cs'
) {
  const normalized = email.trim().toLowerCase()
  if (!isCompanyEmail(normalized)) {
    throw new Error('Tylko adres @sun.store.')
  }
  if (!APP_ROLES.includes(role)) {
    throw new Error('Nieznana rola.')
  }
  if (!isDepartment(department)) {
    throw new Error('Nieznany dział.')
  }
  const rows = await neonQuery<{ email: string, role: AppRole, department: Department }>(
    `insert into allowlist (email, role, department) values ($1, $2, $3)
     on conflict (email) do update set role = excluded.role, department = excluded.department
     returning email, role, department`,
    [normalized, role, department]
  )
  // Jeśli osoba już ma staff — zsynchronizuj dział.
  await neonQuery(
    `update staff s
     set department = $2
     from "user" u
     where u.id = s.user_id and lower(u.email) = $1`,
    [normalized, department]
  )
  return rows[0]
}
