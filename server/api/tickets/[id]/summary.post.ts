import { AiConfigError, summarizeTicket } from '../../../services/ai-case'
import type { TicketActor } from '../../../services/tickets'
import { requireUser } from '../../../utils/session'
import { isUuid } from '../../../utils/uuid'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id || !isUuid(id)) {
    throw createError({ statusCode: 404, statusMessage: 'Nie znaleziono sprawy.' })
  }
  const actor: TicketActor = { role: user.role, agentId: user.agentId, department: user.department }
  try {
    const result = await summarizeTicket(id, actor)
    if (!result) throw createError({ statusCode: 404, statusMessage: 'Nie znaleziono sprawy.' })
    return result
  } catch (err: unknown) {
    if (err instanceof AiConfigError) {
      throw createError({ statusCode: 503, statusMessage: err.message })
    }
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    const message = err instanceof Error ? err.message : 'Nie udało się wygenerować podsumowania.'
    throw createError({ statusCode: 502, statusMessage: message })
  }
})
