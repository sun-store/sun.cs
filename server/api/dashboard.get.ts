import { loadDashboard } from '../services/dashboard'
import { requireUser } from '../utils/session'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const query = getQuery(event)
  const year = query.year == null || query.year === '' ? 2026 : Number(query.year)
  const month = query.month == null || query.month === '' ? 9 : Number(query.month)
  if (!Number.isInteger(year) || year < 2024 || year > 2035) {
    throw createError({ statusCode: 400, statusMessage: 'Nieprawidłowy rok.' })
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw createError({ statusCode: 400, statusMessage: 'Nieprawidłowy miesiąc.' })
  }
  return loadDashboard(year, month)
})
