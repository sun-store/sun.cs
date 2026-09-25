import { APP_ROLES } from '../../shared/domain'
import { upsertAllowlist } from '../services/allowlist'
import { requireAdmin } from '../utils/session'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const email = String(body?.email || '').trim()
  const role = body?.role
  if (!email || !APP_ROLES.includes(role)) {
    throw createError({ statusCode: 400, statusMessage: 'Podaj firmowy e-mail i rolę.' })
  }
  try {
    return await upsertAllowlist(email, role)
  } catch (err) {
    throw createError({
      statusCode: 400,
      statusMessage: err instanceof Error ? err.message : 'Nie udało się dopisać.'
    })
  }
})
