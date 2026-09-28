import { createError, getRequestHeaders } from 'h3'
import type { AppRole } from '../../shared/domain'
import { getBetterAuth } from '../services/auth'
import { hasNeonConfig } from '../services/neon-db'
import { ensureStaff } from '../services/staff'

export type SessionUser = {
  id: string
  email: string
  name: string
  role: AppRole
  agentId: string | null
}

export async function requireUser(
  // Nested h3 copies disagree on H3Event; accept the runtime event object.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  event: any
): Promise<SessionUser> {
  if (!hasNeonConfig()) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Brak NEON_DATABASE_URL. Uzupełnij .env i uruchom npm run db:migrate.'
    })
  }

  const auth = getBetterAuth()
  const session = await auth.api.getSession({
    headers: new Headers(getRequestHeaders(event) as Record<string, string>)
  })
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Wymagane logowanie.' })
  }

  const staff = await ensureStaff(session.user)
  if (!staff) {
    throw createError({ statusCode: 403, statusMessage: 'Nie ma Cię na liście sun.support. Poproś admina o dopisanie.' })
  }
  if (staff.role === 'agent') {
    throw createError({ statusCode: 403, statusMessage: 'Logowanie agentów jeszcze nie jest włączone.' })
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: staff.displayName,
    role: staff.role,
    agentId: staff.agentId
  }
}

export async function requireAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  event: any
): Promise<SessionUser> {
  const user = await requireUser(event)
  if (user.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Tylko admin zarządza listą zespołu.' })
  }
  return user
}
