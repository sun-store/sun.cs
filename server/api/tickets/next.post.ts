import { claimNext, type TicketActor } from '../../services/tickets'
import { requireUser } from '../../utils/session'
import { normalizeQueueKey } from '../../../shared/queues'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const actor: TicketActor = { role: user.role, agentId: user.agentId, department: user.department }
  const body = await readBody<{ queue?: unknown }>(event)
  const queue = normalizeQueueKey(body?.queue) || 'now'
  try {
    // „Na teraz” bywa puste, gdy wszystko jest już po terminie — wtedy bierzemy najpilniejszą z „Do odpowiedzi”
    // (sortowanie po terminie: najpierw najbardziej spóźnione).
    const id = await claimNext(actor, queue)
      ?? (queue === 'now' ? await claimNext(actor, 'reply') : null)
    if (!id) {
      return sendNoContent(event)
    }
    return { id }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Nie udało się wziąć sprawy.'
    throw createError({ statusCode: 400, statusMessage: message })
  }
})
