import type { MessageDirection, SenderType, TicketStatus } from './domain'

/** Status po nowym zdarzeniu. Notatki / do sprzedawcy → null (bez zmiany). */
export function statusAfterEvent(input: {
  senderType: SenderType
  direction: MessageDirection
  closed?: boolean
}): TicketStatus | null {
  if (input.closed) return null
  if (input.senderType === 'customer') return 'open'
  if (
    (input.senderType === 'agent' || input.senderType === 'bot')
    && input.direction === 'to_customer'
  ) {
    return 'waiting'
  }
  return null
}
