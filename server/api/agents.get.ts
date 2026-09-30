import { listAgents } from '../services/tickets'
import { requireUser } from '../utils/session'
import { isDepartment, type Department } from '../../shared/departments'

function parseDepartment(value: unknown): Department | 'all' | undefined {
  if (value == null || value === '') return undefined
  if (value === 'all') return 'all'
  if (isDepartment(value)) return value
  throw createError({ statusCode: 400, statusMessage: 'Nieznany dział.' })
}

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const query = getQuery(event)
  const department = parseDepartment(query.department)
  return listAgents(department)
})
