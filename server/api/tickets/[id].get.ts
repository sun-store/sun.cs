import { getTicket } from '../../services/tickets'
import { requireUser } from '../../utils/session'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const ticket = await getTicket(getRouterParam(event, 'id') || '')
  if (!ticket) {
    throw createError({ statusCode: 404, statusMessage: 'Nie ma takiej sprawy.' })
  }
  return ticket
})
