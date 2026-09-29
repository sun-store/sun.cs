import { mailBodyText, runDeltaPages, toInboundMail, type GraphMessage } from '../../shared/graph-mail'
import { fetchDeltaPage, fetchMessageBody, hasGraphConfig, inboxDeltaUrl, outlookMailbox } from './graph'
import { ingestInbound } from './inbound'
import { neonQuery } from './neon-db'

/**
 * Budżet jednego biegu crona (mieści się w domyślnym limicie funkcji Vercel).
 * Pierwszy bieg przewija historię skrzynki; stare maile są pomijane (before_start),
 * a przewijanie kończy się w kolejnych biegach.
 */
const MAX_PAGES = 20
const TIME_BUDGET_MS = 10_000
const LEASE_SECONDS = 60

type SyncState = { cursor: string | null, since: Date }

export type MailSyncResult
  = | { configured: false }
    | { configured: true, skipped: 'locked' }
    | { configured: true, pages: number, caughtUp: boolean, imported: number, ignored: number, failed: number }

export async function syncOutlookInbox(): Promise<MailSyncResult> {
  if (!hasGraphConfig()) return { configured: false }
  const mailbox = outlookMailbox()
  const state = await acquireLease(mailbox)
  if (!state) return { configured: true, skipped: 'locked' }

  let imported = 0
  let ignored = 0
  let failed = 0
  try {
    const result = await runDeltaPages({
      startUrl: state.cursor || inboxDeltaUrl(),
      fetchPage: fetchDeltaPage,
      handleMessages: async (messages: GraphMessage[]) => {
        const errors: unknown[] = []
        for (const message of messages) {
          try {
            if (await importMessage(message, mailbox, state.since)) imported += 1
            else ignored += 1
          } catch (err) {
            errors.push(err)
          }
        }
        // Cała strona padła (np. baza leży): nie przesuwamy kursora, następny bieg powtórzy stronę.
        // Pojedynczy zły mail nie blokuje skrzynki: liczymy go w failed i idziemy dalej.
        if (errors.length && errors.length === messages.length) throw errors[0]
        failed += errors.length
      },
      saveCursor: cursor => saveCursor(mailbox, cursor),
      maxPages: MAX_PAGES,
      deadline: Date.now() + TIME_BUDGET_MS
    })
    await releaseLease(mailbox, failed ? `Pominięte przez błąd: ${failed}` : null)
    return { configured: true, ...result, imported, ignored, failed }
  } catch (err) {
    await releaseLease(mailbox, err instanceof Error ? err.message : 'Nieznany błąd.')
    throw err
  }
}

async function importMessage(message: GraphMessage, mailbox: string, since: Date): Promise<boolean> {
  const parsed = toInboundMail(message, { mailbox, since })
  if ('skip' in parsed) return false
  const mail = parsed.mail
  const known = await neonQuery<{ id: string }>(
    'select id from ticket_events where graph_message_id = $1 limit 1',
    [mail.graphMessageId]
  )
  if (known[0]) return false

  const body = mailBodyText(await fetchMessageBody(mail.graphMessageId))
  await ingestInbound({
    displayName: mail.fromName,
    identifiers: [{ type: 'email', value: mail.fromAddress, source: 'outlook' }],
    channel: 'email',
    body,
    subject: mail.subject ?? undefined,
    occurredAt: mail.receivedAt,
    senderType: 'customer',
    externalThreadId: mail.conversationId,
    graphMessageId: mail.graphMessageId
  })
  return true
}

/** Dzierżawa zamiast advisory lock: pool Neon nie trzyma jednej sesji między zapytaniami. */
async function acquireLease(mailbox: string): Promise<SyncState | null> {
  await neonQuery(
    'insert into mail_sync_state (mailbox) values ($1) on conflict (mailbox) do nothing',
    [mailbox]
  )
  const rows = await neonQuery<{ cursor: string | null, since: Date }>(
    `update mail_sync_state
     set locked_until = now() + ($2 || ' seconds')::interval,
         last_run_at = now(),
         updated_at = now()
     where mailbox = $1 and (locked_until is null or locked_until < now())
     returning cursor, since`,
    [mailbox, String(LEASE_SECONDS)]
  )
  const row = rows[0]
  return row ? { cursor: row.cursor, since: new Date(row.since) } : null
}

async function saveCursor(mailbox: string, cursor: string): Promise<void> {
  await neonQuery(
    'update mail_sync_state set cursor = $2, updated_at = now() where mailbox = $1',
    [mailbox, cursor]
  )
}

async function releaseLease(mailbox: string, error: string | null): Promise<void> {
  await neonQuery(
    `update mail_sync_state
     set locked_until = null, last_error = $2, updated_at = now()
     where mailbox = $1`,
    [mailbox, error ? error.slice(0, 500) : null]
  )
}
