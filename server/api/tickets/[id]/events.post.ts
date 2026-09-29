import { sendTicketMail } from '../../../services/mail-reply'
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
  const ticketId = getRouterParam(event, 'id') || ''
  const actor = { role: user.role, agentId: user.agentId }
  const isCustomerMail = body.channel === 'email' && body.direction === 'to_customer' && body.senderType === 'agent'
  let mailSent = false
  if (isCustomerMail) {
    let outbound
    try {
      outbound = await sendTicketMail(ticketId, body.body, actor)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      throw createError({
        statusCode: message.startsWith('Graph') ? 502 : 400,
        statusMessage: `Mail nie wyszedł, nic nie zapisano. ${message}`.trim()
      })
    }
    if (!outbound) {
      throw createError({ statusCode: 404, statusMessage: 'Nie ma takiej sprawy.' })
    }
    mailSent = outbound.sent
  }
  try {
    const ticket = await addEvent(ticketId, {
      channel: body.channel,
      direction: body.direction,
      senderType: body.senderType,
      body: body.body,
      callStatus: body.callStatus || null,
      externalThreadId: typeof body.externalThreadId === 'string' ? body.externalThreadId : null
    }, actor)
    if (!ticket) {
      throw createError({ statusCode: 404, statusMessage: 'Nie ma takiej sprawy.' })
    }
    return { ...ticket, mailSent }
  } catch (err) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    throw createError({
      statusCode: 400,
      statusMessage: err instanceof Error ? err.message : 'Nie udało się dodać wydarzenia.'
    })
  }
})
