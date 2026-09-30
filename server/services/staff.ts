import type { AppRole } from '../../shared/domain'
import type { Department } from '../../shared/departments'
import { findAllowlistEntry } from './allowlist'
import { neonQuery } from './neon-db'

export async function ensureStaff(user: {
  id: string
  email: string
  name?: string | null
}): Promise<{
  role: AppRole
  displayName: string
  agentId: string | null
  department: Department
} | null> {
  const email = user.email.trim().toLowerCase()
  const displayName = user.name?.trim() || email
  const allowlisted = await findAllowlistEntry(email)

  const existing = await neonQuery<{
    role: AppRole
    display_name: string
    active: boolean
    department: Department
  }>(
    'select role, display_name, active, department from staff where user_id = $1',
    [user.id]
  )

  if (!existing[0]) {
    if (!allowlisted) return null
    await neonQuery(
      `insert into staff (user_id, role, display_name, department)
       values ($1, $2, $3, $4)
       on conflict (user_id) do nothing`,
      [user.id, allowlisted.role, displayName, allowlisted.department]
    )
  } else if (allowlisted) {
    await neonQuery(
      `update staff
       set role = $2,
           display_name = coalesce(nullif($3, ''), display_name),
           department = $4
       where user_id = $1`,
      [user.id, allowlisted.role, displayName, allowlisted.department]
    )
  }

  const staff = await neonQuery<{
    role: AppRole
    display_name: string
    active: boolean
    department: Department
  }>(
    'select role, display_name, active, department from staff where user_id = $1',
    [user.id]
  )
  if (!staff[0]?.active) return null

  const agentId = await linkAgent(user.id, email, staff[0].display_name || displayName)
  return {
    role: staff[0].role,
    displayName: staff[0].display_name || displayName,
    agentId,
    department: staff[0].department || 'cs'
  }
}

async function linkAgent(userId: string, email: string, displayName: string): Promise<string | null> {
  const byUser = await neonQuery<{ id: string }>(
    'select id from agents where user_id = $1',
    [userId]
  )
  if (byUser[0]) return byUser[0].id

  const byEmail = await neonQuery<{ id: string }>(
    'select id from agents where email = $1',
    [email]
  )
  if (byEmail[0]) {
    await neonQuery(
      'update agents set user_id = coalesce(user_id, $2), active = true where id = $1',
      [byEmail[0].id, userId]
    )
    return byEmail[0].id
  }

  const created = await neonQuery<{ id: string }>(
    `insert into agents (display_name, email, user_id)
     values ($1, $2, $3)
     on conflict (email) do update set user_id = coalesce(agents.user_id, excluded.user_id)
     returning id`,
    [displayName, email, userId]
  )
  return created[0]?.id ?? null
}
