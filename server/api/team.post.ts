import { APP_ROLES } from '../../shared/domain'
import { DEPARTMENTS, isDepartment } from '../../shared/departments'
import { upsertAllowlist } from '../services/allowlist'
import { requireAdmin } from '../utils/session'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const email = String(body?.email || '').trim()
  const role = body?.role
  const department = body?.department == null || body?.department === ''
    ? 'cs'
    : body.department
  if (!email || !APP_ROLES.includes(role)) {
    throw createError({ statusCode: 400, statusMessage: 'Podaj firmowy e-mail i rolę.' })
  }
  if (!isDepartment(department)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Nieznany dział. Dozwolone: ${DEPARTMENTS.join(', ')}.`
    })
  }
  try {
    return await upsertAllowlist(email, role, department)
  } catch (err) {
    throw createError({
      statusCode: 400,
      statusMessage: err instanceof Error ? err.message : 'Nie udało się dopisać.'
    })
  }
})
