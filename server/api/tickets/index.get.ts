import { listTickets, ticketSummary, type TicketActor } from '../../services/tickets'
import { requireUser } from '../../utils/session'
import { isUuid } from '../../utils/uuid'
import { canBrowseAllDepartments } from '../../../shared/access'
import { CHANNELS, TICKET_STATUSES, type Channel, type TicketStatus } from '../../../shared/domain'
import { DEPARTMENTS, isDepartment, type Department } from '../../../shared/departments'
import { isTicketQueue, type TicketQueue } from '../../../shared/ticket-queues'
import { TICKET_LIST_PAGE_SIZE, TICKET_LIST_PAGE_SIZE_MAX } from '../../../shared/text-bounds'

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? value as T
    : null
}

function parseStatus(value: unknown, whenQueueOrSearch: boolean): TicketStatus | 'all' {
  if (value == null || value === '') return whenQueueOrSearch ? 'all' : 'open'
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

function parseOwnerId(value: unknown): string | 'all' | 'mine' | 'unassigned' {
  if (value == null || value === '' || value === 'all') return 'all'
  if (value === 'mine' || value === 'unassigned') return value
  if (typeof value === 'string' && isUuid(value)) return value
  throw createError({ statusCode: 400, statusMessage: 'Nieznany właściciel.' })
}

function parseDepartment(value: unknown): Department | 'all' {
  if (value == null || value === '' || value === 'all') return 'all'
  if (isDepartment(value)) return value
  throw createError({ statusCode: 400, statusMessage: 'Nieznany dział.' })
}

function parseQueue(value: unknown): TicketQueue | undefined {
  if (value == null || value === '') return undefined
  if (isTicketQueue(value)) return value
  throw createError({ statusCode: 400, statusMessage: 'Nieznana kolejka.' })
}

function parseQ(value: unknown): string | undefined {
  if (value == null || value === '') return undefined
  if (typeof value !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Nieprawidłowe wyszukiwanie.' })
  }
  const trimmed = value.trim()
  if (trimmed.length > 200) {
    throw createError({ statusCode: 400, statusMessage: 'Zapytanie za długie.' })
  }
  return trimmed || undefined
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const actor: TicketActor = { role: user.role, agentId: user.agentId, department: user.department }
  const query = getQuery(event)

  const q = parseQ(query.q)
  const queue = q ? undefined : parseQueue(query.queue)
  const status = parseStatus(query.status, Boolean(queue || q))
  const channel = parseChannel(query.channel)
  const page = parsePage(query.page)
  const pageSize = parsePageSize(query.pageSize)
  const ownerId = parseOwnerId(query.ownerId)
  const requestedDepartment = parseDepartment(query.department)
  const department = canBrowseAllDepartments(user.role, user.department)
    ? requestedDepartment
    : (user.department || 'cs')

  const list = await listTickets({
    status,
    channel,
    ownerId,
    department,
    queue,
    q,
    page,
    pageSize
  }, actor)
  const summary = await ticketSummary(actor)
  return { ...list, summary, departments: DEPARTMENTS }
})
