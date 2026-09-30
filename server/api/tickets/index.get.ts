import { listTickets, ticketSummary, type TicketActor } from '../../services/tickets'
import { requireUser } from '../../utils/session'
import { isUuid } from '../../utils/uuid'
import { CHANNELS, TICKET_STATUSES, type Channel, type TicketStatus } from '../../../shared/domain'
import { TICKET_LIST_PAGE_SIZE, TICKET_LIST_PAGE_SIZE_MAX } from '../../../shared/text-bounds'

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

function parsePage(value: unknown): number {
  if (value == null || value === '') return 1
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Nieprawidłowa strona.' })
  }
  return n
}

function parsePageSize(value: unknown): number {
  if (value == null || value === '') return TICKET_LIST_PAGE_SIZE
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1 || n > TICKET_LIST_PAGE_SIZE_MAX) {
    throw createError({ statusCode: 400, statusMessage: 'Nieprawidłowy rozmiar strony.' })
  }
  return n
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const actor: TicketActor = { role: user.role, agentId: user.agentId }
  const query = getQuery(event)

  const status = parseStatus(query.status)
  const channel = parseChannel(query.channel)
  const page = parsePage(query.page)
  const pageSize = parsePageSize(query.pageSize)

  const ownerRaw = typeof query.ownerId === 'string' ? query.ownerId : 'all'
  if (ownerRaw !== 'all' && !isUuid(ownerRaw)) {
    throw createError({ statusCode: 400, statusMessage: 'Nieznany właściciel.' })
  }

  const list = await listTickets({
    status,
    channel,
    ownerId: ownerRaw,
    page,
    pageSize
  }, actor)
  const summary = await ticketSummary(actor)
  return { ...list, summary }
})
