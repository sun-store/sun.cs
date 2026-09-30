/** Definicje kolejek widoku pracy (warunki SQL są w serwisie). */

export const NOW_WINDOW_MIN = 60

export const QUEUES = [
  'now',
  'reply',
  'mine',
  'overdue',
  'unassigned',
  'waiting'
] as const

export type QueueKey = typeof QUEUES[number]

export const QUEUE_LABELS: Record<QueueKey, string> = {
  now: 'Na teraz',
  reply: 'Do odpowiedzi',
  mine: 'Moje sprawy',
  overdue: 'Po terminie SLA',
  unassigned: 'Nieprzypisane',
  waiting: 'Czeka na klienta'
}

const LEGACY_QUEUE_ALIASES: Record<string, QueueKey> = {
  todo: 'reply',
  waiting_customer: 'waiting'
}

export function queueLabel(key: QueueKey): string {
  return QUEUE_LABELS[key]
}

export function isQueueKey(value: unknown): value is QueueKey {
  if (typeof value !== 'string') return false
  if ((QUEUES as readonly string[]).includes(value)) return true
  return value in LEGACY_QUEUE_ALIASES
}

/** Normalizuje legacy `todo` / `waiting_customer` do kluczy z architektury. */
export function normalizeQueueKey(value: unknown): QueueKey | null {
  if (typeof value !== 'string') return null
  if ((QUEUES as readonly string[]).includes(value)) return value as QueueKey
  return LEGACY_QUEUE_ALIASES[value] ?? null
}

/** @deprecated Używaj QUEUES / QueueKey z `shared/queues.ts`. */
export const TICKET_QUEUES = QUEUES
/** @deprecated */
export type TicketQueue = QueueKey
/** @deprecated */
export const TICKET_QUEUE_LABELS = QUEUE_LABELS
/** @deprecated */
export function isTicketQueue(value: unknown): value is QueueKey {
  return isQueueKey(value)
}
