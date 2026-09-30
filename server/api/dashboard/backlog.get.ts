import { loadBacklog } from '../../services/backlog'
import { requireUser } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  try {
    return await loadBacklog({ role: user.role, department: user.department })
  } catch (err) {
    console.error('[backlog]', err instanceof Error ? err.message : err)
    throw createError({ statusCode: 500, statusMessage: 'Nie udało się policzyć zaległości.' })
  }
})
