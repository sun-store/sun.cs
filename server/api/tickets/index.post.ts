import { createTicket } from '../../services/tickets'
import { requireUser } from '../../utils/session'
import { CALL_STATUSES, CHANNELS, CUSTOMER_ROLES } from '../../../shared/domain'

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  return value
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event)
  const channel = text(body?.channel)
  const displayName = text(body?.displayName)
  const message = text(body?.body)
  if (!displayName || !channel || !message) {
    throw createError({ statusCode: 400, statusMessage: 'Wymagane: imię, kanał i treść.' })
  }
  if (!CHANNELS.includes(channel as typeof CHANNELS[number])) {
    throw createError({ statusCode: 400, statusMessage: 'Nieznany kanał.' })
  }
  const email = text(body?.email)
  const phone = text(body?.phone)
  const whatsapp = text(body?.whatsapp)
  const sunstoreUserId = text(body?.sunstoreUserId)
  if (!email && !phone && !whatsapp && !sunstoreUserId) {
    throw createError({ statusCode: 400, statusMessage: 'Podaj e-mail, telefon albo id sun.store.' })
  }
  const callStatus = text(body?.callStatus)
  if (channel === 'phone' && !callStatus) {
    throw createError({ statusCode: 400, statusMessage: 'Telefon wymaga statusu odebrania.' })
  }
  if (callStatus && !CALL_STATUSES.includes(callStatus as typeof CALL_STATUSES[number])) {
    throw createError({ statusCode: 400, statusMessage: 'Nieznany status połączenia.' })
  }
  const customerRole = text(body?.customerRole)
  if (customerRole && !CUSTOMER_ROLES.includes(customerRole as typeof CUSTOMER_ROLES[number])) {
    throw createError({ statusCode: 400, statusMessage: 'Nieznana rola klienta.' })
  }
  const ownerId = text(body?.ownerId) || user.agentId
  try {
    return await createTicket({
      displayName,
      email,
      phone,
      whatsapp,
      customerRole: customerRole as 'buyer' | 'seller' | undefined,
      sunstoreUserId,
      channel: channel as typeof CHANNELS[number],
      subject: text(body?.subject),
      body: message,
      firstContactAt: text(body?.firstContactAt),
      relatedTransactionId: text(body?.relatedTransactionId),
      ownerId,
      callStatus: callStatus as typeof CALL_STATUSES[number] | undefined
    })
  } catch (err) {
    throw createError({
      statusCode: 400,
      statusMessage: err instanceof Error ? err.message : 'Nie udało się utworzyć sprawy.'
    })
  }
})
