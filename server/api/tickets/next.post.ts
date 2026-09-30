import { backfillMissingReplyClocks, claimNext, type TicketActor } from '../../services/tickets'
import { requireUser } from '../../utils/session'
import { normalizeQueueKey } from '../../../shared/queues'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const actor: TicketActor = { role: user.role, agentId: user.agentId, department: user.department }
  const body = await readBody<{ queue?: unknown }>(event)
  // Zawsze start od „Na teraz” — przycisk „Weź najpilniejszą” nie zależy od aktywnej zakładki.
  const requested = normalizeQueueKey(body?.queue)
  const queue = requested === 'reply' || requested === 'overdue' || requested === 'unassigned'
    ? requested
    : 'now'
  try {
    let id = await claimNext(actor, queue)
      ?? (queue === 'now' ? await claimNext(actor, 'reply') : null)
      ?? (queue === 'now' || queue === 'reply' ? await claimNext(actor, 'unassigned') : null)

    // Importy HubSpot często zostawiają awaiting null — uzupełnij zegary i spróbuj jeszcze raz.
    if (!id && (queue === 'now' || queue === 'reply')) {
      await backfillMissingReplyClocks(300)
      id = await claimNext(actor, 'now')
        ?? await claimNext(actor, 'reply')
        ?? await claimNext(actor, 'unassigned')
    }

    return { id: id ?? null }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Nie udało się wziąć sprawy.'
    throw createError({ statusCode: 400, statusMessage: message })
  }
})
