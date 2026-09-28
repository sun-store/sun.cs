import { createAgent } from '../services/tickets'
import { requireUser } from '../utils/session'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const body = await readBody(event)
  const displayName = typeof body?.displayName === 'string' ? body.displayName : ''
  const email = typeof body?.email === 'string' ? body.email : undefined
  if (!displayName.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Podaj imię agenta.' })
  }
  try {
    return await createAgent(displayName, email)
  } catch (err) {
    throw createError({
      statusCode: 400,
      statusMessage: err instanceof Error ? err.message : 'Nie udało się dodać agenta.'
    })
  }
})
