import { ticketQueueCounts, type TicketActor } from '../../services/tickets'
import { requireUser } from '../../utils/session'
import { canBrowseAllDepartments } from '../../../shared/access'
import { isDepartment, type Department } from '../../../shared/departments'
import { TICKET_QUEUES, TICKET_QUEUE_LABELS } from '../../../shared/ticket-queues'

function parseDepartment(value: unknown): Department | 'all' {
  if (value == null || value === '' || value === 'all') return 'all'
  if (isDepartment(value)) return value
  throw createError({ statusCode: 400, statusMessage: 'Nieznany dział.' })
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const actor: TicketActor = { role: user.role, agentId: user.agentId, department: user.department }
  const query = getQuery(event)
  const requestedDepartment = parseDepartment(query.department)
  const department = canBrowseAllDepartments(user.role, user.department)
    ? requestedDepartment
    : (user.department || 'cs')

  const counts = await ticketQueueCounts(actor, department)
  return {
    counts,
    queues: TICKET_QUEUES.map(id => ({
      id,
      label: TICKET_QUEUE_LABELS[id],
      count: counts[id]
    }))
  }
})
