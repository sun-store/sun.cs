import { listTickets, ticketSummary, type TicketActor } from '../../services/tickets'
import { requireUser } from '../../utils/session'
import { isUuid } from '../../utils/uuid'
import { CHANNELS, TICKET_STATUSES, type Channel, type TicketStatus } from '../../../shared/domain'

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? value as T
    : null
}

function parseStatus(value: unknown): TicketStatus | 'all' {
  if (value == null || value === '') return 'open'
  if (value === 'all') return 'all'
  const parsed = oneOf(value, TICKET_STATUSES)
  if (!parsed) throw createError({ statusCode: 400, statusMessage: 'Nieznany status.' })
  return parsed
}

function parseChannel(value: unknown): Channel | 'all' {
  if (value == null || value === '' || value === 'all') return 'all'
  const parsed = oneOf(value, CHANNELS)
  if (!parsed) throw createError({ statusCode: 400, statusMessage: 'Nieznany kanał.' })
  return parsed
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const actor: TicketActor = { role: user.role, agentId: user.agentId }
  const query = getQuery(event)

  const status = parseStatus(query.status)
  const channel = parseChannel(query.channel)

  const ownerRaw = typeof query.ownerId === 'string' ? query.ownerId : 'all'
  if (ownerRaw !== 'all' && !isUuid(ownerRaw)) {
    throw createError({ statusCode: 400, statusMessage: 'Nieznany właściciel.' })
  }

  const { tickets, truncated } = await listTickets({
    status,
    channel,
    ownerId: ownerRaw
  }, actor)
  const summary = await ticketSummary(actor)
  return { tickets, summary, truncated }
})
