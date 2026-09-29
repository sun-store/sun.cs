import { TEXT_LIMITS } from './text-bounds'

/** Wycinek wiadomości z Microsoft Graph, tylko pola, które czytamy. */
export type GraphMessage = {
  'id': string
  'receivedDateTime'?: string | null
  'subject'?: string | null
  'conversationId'?: string | null
  'isDraft'?: boolean | null
  'from'?: { emailAddress?: { address?: string | null, name?: string | null } | null } | null
  '@removed'?: unknown
}

export type InboundMail = {
  graphMessageId: string
  fromAddress: string
  fromName: string
  subject: string | null
  receivedAt: string
  conversationId: string | null
}

export type MailSkipReason = 'removed' | 'draft' | 'no_sender' | 'own_mailbox' | 'before_start' | 'auto_reply'

const SYSTEM_SENDERS = /^(mailer-daemon|postmaster)@/i

const AUTO_REPLY_SUBJECTS = [
  'automatic reply',
  'auto reply',
  'autoreply',
  'out of office',
  'automatische antwort',
  'abwesenheitsnotiz',
  'odpowiedź automatyczna',
  'réponse automatique',
  'undeliverable',
  'delivery status notification'
]

export function normalizeAddress(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase()
}

/** Decyduje, czy wiadomość z inboxu staje się zdarzeniem w sprawie. */
export function toInboundMail(
  message: GraphMessage,
  options: { mailbox: string, since: Date }
): { mail: InboundMail } | { skip: MailSkipReason } {
  if (message['@removed']) return { skip: 'removed' }
  if (message.isDraft) return { skip: 'draft' }
  const fromAddress = normalizeAddress(message.from?.emailAddress?.address)
  if (!fromAddress) return { skip: 'no_sender' }
  if (fromAddress === normalizeAddress(options.mailbox)) return { skip: 'own_mailbox' }
  const received = new Date(message.receivedDateTime ?? '')
  if (Number.isNaN(received.getTime()) || received < options.since) return { skip: 'before_start' }
  const subject = (message.subject ?? '').trim()
  if (SYSTEM_SENDERS.test(fromAddress) || isAutoReplySubject(subject)) return { skip: 'auto_reply' }
  return {
    mail: {
      graphMessageId: message.id,
      fromAddress,
      fromName: (message.from?.emailAddress?.name ?? '').trim() || fromAddress,
      subject: subject ? subject.slice(0, TEXT_LIMITS.subject) : null,
      receivedAt: received.toISOString(),
      conversationId: message.conversationId?.trim() || null
    }
  }
}

function isAutoReplySubject(subject: string): boolean {
  const lower = subject.toLowerCase()
  return AUTO_REPLY_SUBJECTS.some(prefix => lower.startsWith(prefix))
}

/** Tekst maila do osi czasu. Graph oddaje text, gdy prosimy o `outlook.body-content-type="text"`; HTML to zapas. */
export function mailBodyText(body: { contentType?: string | null, content?: string | null } | null | undefined): string {
  const raw = String(body?.content ?? '')
  const text = String(body?.contentType ?? '').toLowerCase() === 'html' ? htmlToText(raw) : raw
  const clean = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (!clean) return '(pusta wiadomość)'
  return clean.slice(0, TEXT_LIMITS.body)
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&amp;/g, '&')
}

/** Komentarz do `/reply` jest HTML-em: escapujemy tekst agenta i zamieniamy nowe linie na <br>. */
export function replyCommentHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\r?\n/g, '<br>')
}

export function replySubject(subject: string | null | undefined): string {
  const clean = String(subject ?? '').trim()
  if (!clean) return 'sun.support'
  return /^re:/i.test(clean) ? clean : `Re: ${clean}`
}

type DeltaPage = {
  'value'?: GraphMessage[]
  '@odata.nextLink'?: string
  '@odata.deltaLink'?: string
}

/**
 * Przechodzi strony delta Graph. Kończy, gdy dostanie deltaLink (skrzynka nadrobiona)
 * albo gdy skończy się budżet stron / czasu. Zwraca kursor do zapisania: nextLink
 * (w trakcie) albo deltaLink (na bieżąco). Kursor zapisujemy dopiero po obsłudze strony,
 * więc przerwany bieg powtórzy stronę, a nie ją zgubi.
 */
export async function runDeltaPages(input: {
  startUrl: string
  fetchPage: (url: string) => Promise<DeltaPage>
  handleMessages: (messages: GraphMessage[]) => Promise<void>
  saveCursor: (cursor: string) => Promise<void>
  maxPages: number
  deadline: number
  now?: () => number
}): Promise<{ pages: number, caughtUp: boolean }> {
  const now = input.now ?? Date.now
  let url = input.startUrl
  let pages = 0
  while (pages < input.maxPages && now() < input.deadline) {
    const page = await input.fetchPage(url)
    await input.handleMessages(page.value ?? [])
    pages += 1
    const delta = page['@odata.deltaLink']
    const next = page['@odata.nextLink']
    if (delta) {
      await input.saveCursor(delta)
      return { pages, caughtUp: true }
    }
    if (!next) {
      throw new Error('Graph nie zwrócił ani nextLink, ani deltaLink.')
    }
    await input.saveCursor(next)
    url = next
  }
  return { pages, caughtUp: false }
}
