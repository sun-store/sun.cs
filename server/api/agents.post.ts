import { createAgent } from '../services/tickets'
import { requireUser } from '../utils/session'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const body = await readBody(event)
  if (!body?.displayName?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Podaj imię agenta.' })
  }
  return createAgent(body.displayName, body.email)
})
