import { ingestInbound } from '../../services/inbound'
import { parseAircallWebhook, type AircallWebhookBody } from '../../../shared/aircall'
import { requireWebhookToken } from '../../utils/webhook'

/**
 * Aircall → wspólne wejście (inbound).
 * Guard: token z body = AIRCALL_WEBHOOK_TOKEN (nie requireUser — jak cron).
 * Zawsze 200 przy znanym formacie eventu (Aircall wyłącza webhook po błędach).
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<AircallWebhookBody>(event)
  requireWebhookToken(event, 'AIRCALL_WEBHOOK_TOKEN', body?.token)

  const parsed = parseAircallWebhook(body || {})
  if (!parsed.ok) {
    return { ok: true, ignored: true, reason: parsed.reason }
  }

  try {
    const draft = parsed.draft
    await ingestInbound({
      displayName: draft.displayName,
      identifiers: draft.identifiers,
      channel: draft.channel,
      body: draft.body,
      subject: draft.subject,
      occurredAt: draft.occurredAt,
      senderType: draft.senderType,
      callStatus: draft.callStatus,
      externalThreadId: draft.externalThreadId
    })
    return { ok: true, ingested: true, threadId: draft.externalThreadId }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Nie udało się zapisać rozmowy Aircall.'
    console.error('[aircall]', message)
    throw createError({ statusCode: 500, statusMessage: message })
  }
})
