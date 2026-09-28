import { addEvent } from '../../../services/tickets'
import { requireUser } from '../../../utils/session'
import { CALL_STATUSES, CHANNELS, MESSAGE_DIRECTIONS, SENDER_TYPES } from '../../../../shared/domain'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event)
  const channelOk = CHANNELS.includes(body?.channel)
  const directionOk = MESSAGE_DIRECTIONS.includes(body?.direction)
  const senderOk = SENDER_TYPES.includes(body?.senderType)
  const bodyOk = typeof body?.body === 'string' && body.body.trim().length > 0
  if (!channelOk || !directionOk || !senderOk || !bodyOk) {
    throw createError({ statusCode: 400, statusMessage: 'Wymagane: kanał, kierunek, nadawca i treść.' })
  }
  if (body.callStatus && !CALL_STATUSES.includes(body.callStatus)) {
    throw createError({ statusCode: 400, statusMessage: 'Nieznany status połączenia.' })
  }
  try {
    const ticket = await addEvent(getRouterParam(event, 'id') || '', {
      channel: body.channel,
      direction: body.direction,
      senderType: body.senderType,
      body: body.body,
      callStatus: body.callStatus || null,
      externalThreadId: typeof body.externalThreadId === 'string' ? body.externalThreadId : null
    }, {
      role: user.role,
      agentId: user.agentId
    })
    if (!ticket) {
      throw createError({ statusCode: 404, statusMessage: 'Nie ma takiej sprawy.' })
    }
    return ticket
  } catch (err) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    throw createError({
      statusCode: 400,
      statusMessage: err instanceof Error ? err.message : 'Nie udało się dodać wydarzenia.'
    })
  }
})
