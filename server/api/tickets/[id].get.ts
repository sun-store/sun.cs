import { getTicket } from '../../services/tickets'
import { requireUser } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const ticket = await getTicket(getRouterParam(event, 'id') || '', {
    role: user.role,
    agentId: user.agentId
  })
  if (!ticket) {
    throw createError({ statusCode: 404, statusMessage: 'Nie ma takiej sprawy.' })
  }
  return ticket
})
