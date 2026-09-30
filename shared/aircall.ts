import type { CallStatus, Channel } from './domain'
import type { IdentifierInput } from './resolveContact'

/** Payload Aircall (call.ended / call.voicemail_left) — tylko używane pola. */
export type AircallWebhookBody = {
  event?: string
  resource?: string
  token?: string
  timestamp?: number
  data?: AircallCallData | null
}

export type AircallCallData = {
  id?: number | string
  direction?: string
  status?: string
  missed_call_reason?: string | null
  started_at?: number | null
  answered_at?: number | null
  ended_at?: number | null
  duration?: number | null
  raw_digits?: string | null
  recording?: string | null
  voicemail?: string | null
  asset?: string | null
  from?: { number?: string | null } | null
  to?: { number?: string | null } | null
  user?: { name?: string | null, email?: string | null } | null
  contact?: { first_name?: string | null, last_name?: string | null, phone_numbers?: Array<{ value?: string }> } | null
}

export type AircallInboundDraft = {
  displayName: string
  identifiers: IdentifierInput[]
  channel: Channel
  body: string
  subject: string
  occurredAt: string
  senderType: 'customer' | 'agent'
  callStatus: CallStatus
  externalThreadId: string
}

export type AircallParseResult
  = { ok: true, draft: AircallInboundDraft }
    | { ok: false, reason: 'ignored' | 'invalid' }

const HANDLED_EVENTS = new Set([
  'call.ended',
  'call.voicemail_left'
])

function digits(value: string | null | undefined): string | null {
  const raw = String(value || '').trim()
  if (!raw) return null
  const cleaned = raw.replace(/[^\d+]/g, '')
  return cleaned.length >= 5 ? cleaned : null
}

function contactPhone(data: AircallCallData): string | null {
  const fromContact = data.contact?.phone_numbers?.[0]?.value
  return digits(data.raw_digits)
    || digits(data.from?.number)
    || digits(data.to?.number)
    || digits(fromContact)
}

function displayName(data: AircallCallData, phone: string | null): string {
  const first = data.contact?.first_name?.trim() || ''
  const last = data.contact?.last_name?.trim() || ''
  const full = `${first} ${last}`.trim()
  if (full) return full
  return phone || 'Rozmowa Aircall'
}

function isMissed(data: AircallCallData, event: string): boolean {
  if (event === 'call.voicemail_left') return true
  if (data.voicemail) return true
  if (data.missed_call_reason) return true
  if (!data.answered_at) return true
  return false
}

function mediaLines(data: AircallCallData): string[] {
  const lines: string[] = []
  if (data.recording) lines.push(`Nagranie: ${data.recording}`)
  if (data.voicemail) lines.push(`Poczta głosowa: ${data.voicemail}`)
  if (data.asset) lines.push(`Aircall: ${data.asset}`)
  return lines
}

/**
 * Mapuje webhook Aircall → draft dla ingestInbound.
 * Odpowiedź 200 nawet przy ignore — Aircall wyłącza webhook po seriach błędów.
 */
export function parseAircallWebhook(body: AircallWebhookBody): AircallParseResult {
  const event = String(body.event || '')
  if (!HANDLED_EVENTS.has(event)) {
    return { ok: false, reason: 'ignored' }
  }
  const data = body.data
  if (!data?.id) {
    return { ok: false, reason: 'invalid' }
  }

  const direction = String(data.direction || '').toLowerCase()
  if (direction !== 'inbound' && direction !== 'outbound') {
    return { ok: false, reason: 'ignored' }
  }

  const phone = contactPhone(data)
  const callId = String(data.id)
  const missed = direction === 'inbound' && isMissed(data, event)
  const answered = Boolean(data.answered_at) && !missed
  const callStatus: CallStatus = missed
    ? 'callback'
    : answered
      ? 'answered'
      : 'no_answer'

  const whenSec = data.ended_at || data.started_at || body.timestamp
  const occurredAt = whenSec
    ? new Date(whenSec * 1000).toISOString()
    : new Date().toISOString()

  const who = direction === 'inbound' ? 'Przychodzące' : 'Wychodzące'
  const outcome = missed
    ? 'nieodebrane — oddzwoń'
    : answered
      ? 'odebrane'
      : 'bez odpowiedzi'
  const duration = data.duration != null ? `${data.duration}s` : null
  const agent = data.user?.name || data.user?.email || null

  const bodyLines = [
    `${who} · ${outcome}${duration ? ` · ${duration}` : ''}`,
    phone ? `Numer: ${phone}` : null,
    agent ? `Agent Aircall: ${agent}` : null,
    data.missed_call_reason ? `Powód: ${data.missed_call_reason}` : null,
    ...mediaLines(data)
  ].filter(Boolean)

  const subject = missed
    ? `Oddzwoń: ${phone || callId}`
    : `Rozmowa: ${phone || callId}`

  const identifiers: IdentifierInput[] = []
  if (phone) {
    identifiers.push({ type: 'phone', value: phone, source: 'aircall' })
  }

  return {
    ok: true,
    draft: {
      displayName: displayName(data, phone),
      identifiers,
      channel: 'phone',
      body: bodyLines.join('\n'),
      subject,
      occurredAt,
      senderType: direction === 'outbound' ? 'agent' : 'customer',
      callStatus,
      externalThreadId: `aircall:${callId}`
    }
  }
}
