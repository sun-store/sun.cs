export const TICKET_QUEUES = [
  'now',
  'todo',
  'mine',
  'overdue',
  'unassigned',
  'waiting_customer'
] as const

export type TicketQueue = typeof TICKET_QUEUES[number]

export const TICKET_QUEUE_LABELS: Record<TicketQueue, string> = {
  now: 'Na teraz',
  todo: 'Do odpowiedzi',
  mine: 'Moje sprawy',
  overdue: 'Po terminie SLA',
  unassigned: 'Nieprzypisane',
  waiting_customer: 'Czeka na klienta'
}

export function isTicketQueue(value: unknown): value is TicketQueue {
  return typeof value === 'string' && (TICKET_QUEUES as readonly string[]).includes(value)
}
