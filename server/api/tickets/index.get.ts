import { listTickets, ticketSummary } from '../../services/tickets'
import { requireUser } from '../../utils/session'
import type { Channel, TicketStatus } from '../../../shared/domain'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const query = getQuery(event)
  const tickets = await listTickets({
    status: (query.status as TicketStatus | 'all') || 'open',
    channel: (query.channel as Channel | 'all') || 'all',
    ownerId: (query.ownerId as string) || 'all'
  })
  const summary = await ticketSummary()
  return { tickets, summary }
})
