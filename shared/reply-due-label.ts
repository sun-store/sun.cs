import type { AwaitingParty } from './reply-clock'

export type ReplyDueTone = 'overdue' | 'urgent' | 'muted'

export type ReplyDueLabel = {
  text: string
  tone: ReplyDueTone
}

const URGENT_MS = 30 * 60 * 1000

function formatRemaining(ms: number): string {
  const abs = Math.abs(ms)
  const minutes = Math.round(abs / 60_000)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} h`
  const days = Math.round(hours / 24)
  return `${days} dn.`
}

/** Etykieta kolumny SLA na liście spraw. */
export function replyDueLabel(
  awaiting: AwaitingParty | null | undefined,
  replyDueAt: Date | string | null | undefined,
  now = new Date()
): ReplyDueLabel {
  if (awaiting === 'customer') {
    return { text: 'czeka na klienta', tone: 'muted' }
  }
  if (!replyDueAt) {
    return { text: '—', tone: 'muted' }
  }
  const due = typeof replyDueAt === 'string' ? new Date(replyDueAt) : replyDueAt
  if (Number.isNaN(due.getTime())) {
    return { text: '—', tone: 'muted' }
  }
  const delta = due.getTime() - now.getTime()
  if (delta < 0) {
    return { text: `po terminie ${formatRemaining(delta)}`, tone: 'overdue' }
  }
  if (delta <= URGENT_MS) {
    return { text: `zostało ${formatRemaining(delta)}`, tone: 'urgent' }
  }
  return { text: `zostało ${formatRemaining(delta)}`, tone: 'muted' }
}

/** Temat bez Re:/ODP: i bez URL — fallback gdy brak ai_summary. */
export function cleanSubjectLine(subject: string | null | undefined): string {
  if (!subject) return '—'
  let text = subject.trim()
  text = text.replace(/\bhttps?:\/\/\S+/gi, '').trim()
  text = text.replace(/^(re|odp|fw|fwd)\s*:\s*/i, '')
  while (/^(re|odp|fw|fwd)\s*:\s*/i.test(text)) {
    text = text.replace(/^(re|odp|fw|fwd)\s*:\s*/i, '')
  }
  text = text.replace(/\s+/g, ' ').trim()
  return text || '—'
}

export function shortTransactionId(id: string | null | undefined, max = 8): string {
  if (!id) return '—'
  const trimmed = id.trim()
  if (trimmed.length <= max) return trimmed
  return trimmed.slice(0, max)
}
