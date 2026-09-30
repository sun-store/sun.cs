import { updateTicket } from '../../services/tickets'
import { requireUser } from '../../utils/session'
import { CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from '../../../shared/domain'

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? value as T
    : null
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event)
  const patch: {
    ownerId?: string | null
    status?: typeof TICKET_STATUSES[number]
    category?: string | null
    priority?: typeof TICKET_PRIORITIES[number] | null
    relatedTransactionId?: string | null
  } = {}

  if (body && typeof body === 'object' && 'status' in body) {
    const status = oneOf(body.status, TICKET_STATUSES)
    if (!status) throw createError({ statusCode: 400, statusMessage: 'Nieznany status.' })
    patch.status = status
  }
  if (body && typeof body === 'object' && 'category' in body) {
    if (body.category == null || body.category === '') {
      patch.category = null
    } else {
      const category = oneOf(body.category, CATEGORIES)
      if (!category) throw createError({ statusCode: 400, statusMessage: 'Nieznana kategoria.' })
      patch.category = category
    }
  }
  if (body && typeof body === 'object' && 'priority' in body) {
    if (body.priority == null || body.priority === '') {
      patch.priority = null
    } else {
      const priority = oneOf(body.priority, TICKET_PRIORITIES)
      if (!priority) throw createError({ statusCode: 400, statusMessage: 'Nieznany priorytet.' })
      patch.priority = priority
    }
  }
  if (body && typeof body === 'object' && 'ownerId' in body) {
    patch.ownerId = typeof body.ownerId === 'string' ? body.ownerId : null
  }
  if (body && typeof body === 'object' && 'relatedTransactionId' in body) {
    patch.relatedTransactionId = typeof body.relatedTransactionId === 'string'
      ? body.relatedTransactionId
      : null
  }

  try {
    const ticket = await updateTicket(getRouterParam(event, 'id') || '', patch, {
      role: user.role,
      agentId: user.agentId,
      name: user.name
    })
    if (!ticket) {
      throw createError({ statusCode: 404, statusMessage: 'Nie ma takiej sprawy.' })
    }
    return ticket
  } catch (err) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    throw createError({
      statusCode: 400,
      statusMessage: err instanceof Error ? err.message : 'Nie udało się zapisać sprawy.'
    })
  }
})
