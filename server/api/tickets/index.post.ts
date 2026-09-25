import { createTicket } from '../../services/tickets'
import { requireUser } from '../../utils/session'
import { CHANNELS } from '../../../shared/domain'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event)
  if (!body?.displayName || !body?.channel || !body?.body) {
    throw createError({ statusCode: 400, statusMessage: 'Wymagane: imię, kanał i treść.' })
  }
  if (!CHANNELS.includes(body.channel)) {
    throw createError({ statusCode: 400, statusMessage: 'Nieznany kanał.' })
  }
  if (!body.email && !body.phone && !body.whatsapp && !body.sunstoreUserId) {
    throw createError({ statusCode: 400, statusMessage: 'Podaj e-mail, telefon albo id sun.store.' })
  }
  if (body.channel === 'phone' && !body.callStatus) {
    throw createError({ statusCode: 400, statusMessage: 'Telefon wymaga statusu odebrania.' })
  }
  try {
    return await createTicket({
      ...body,
      ownerId: body.ownerId || user.agentId
    })
  } catch (err) {
    throw createError({
      statusCode: 400,
      statusMessage: err instanceof Error ? err.message : 'Nie udało się utworzyć sprawy.'
    })
  }
})
