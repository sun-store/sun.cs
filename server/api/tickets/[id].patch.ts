import { updateTicket } from '../../services/tickets'
import { requireUser } from '../../utils/session'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const body = await readBody(event)
  try {
    const ticket = await updateTicket(getRouterParam(event, 'id') || '', body)
    if (!ticket) {
      throw createError({ statusCode: 404, statusMessage: 'Nie ma takiej sprawy.' })
    }
    return ticket
  } catch (err) {
    throw createError({
      statusCode: 400,
      statusMessage: err instanceof Error ? err.message : 'Nie udało się zapisać sprawy.'
    })
  }
})
