import { addEvent } from '../../../services/tickets'
import { requireUser } from '../../../utils/session'
import { CHANNELS, MESSAGE_DIRECTIONS, SENDER_TYPES } from '../../../../shared/domain'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const body = await readBody(event)
  if (!CHANNELS.includes(body?.channel) || !MESSAGE_DIRECTIONS.includes(body?.direction) || !SENDER_TYPES.includes(body?.senderType) || !body?.body) {
    throw createError({ statusCode: 400, statusMessage: 'Wymagane: kanał, kierunek, nadawca i treść.' })
  }
  try {
    const ticket = await addEvent(getRouterParam(event, 'id') || '', body)
    if (!ticket) {
      throw createError({ statusCode: 404, statusMessage: 'Nie ma takiej sprawy.' })
    }
    return ticket
  } catch (err) {
    throw createError({
      statusCode: 400,
      statusMessage: err instanceof Error ? err.message : 'Nie udało się dodać wydarzenia.'
    })
  }
})
