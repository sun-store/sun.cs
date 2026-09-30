import type { Channel, MessageDirection, SenderType, TicketStatus } from './domain'
import {
  replyClockAfterAgentToCustomer,
  replyClockAfterCustomerMessage,
  type AwaitingParty
} from './reply-clock'
import { statusAfterEvent } from './ticket-status'

export type TicketConversationState = {
  status: TicketStatus
  awaiting: AwaitingParty
  replyDueAt: Date | null
}

export type TicketStateEvent = {
  senderType: SenderType
  direction: MessageDirection
  channel: Channel
  at: Date
}

/**
 * Jedno źródło prawdy o przejściach stanu sprawy.
 * Zamknięta sprawa → throw.
 */
export function nextState(
  current: { status: TicketStatus, awaiting: AwaitingParty | null, replyDueAt: Date | null },
  event: TicketStateEvent
): TicketConversationState {
  if (current.status === 'closed') {
    throw new Error('Nie można dopisać wydarzenia do zamkniętej sprawy.')
  }

  const statusPatch = statusAfterEvent({
    senderType: event.senderType,
    direction: event.direction,
    closed: false
  })
  const status = statusPatch ?? current.status

  if (event.senderType === 'customer') {
    const clock = replyClockAfterCustomerMessage(event.channel, event.at)
    return {
      status,
      awaiting: clock.awaiting,
      replyDueAt: clock.replyDueAt
    }
  }

  if (
    (event.senderType === 'agent' || event.senderType === 'bot')
    && event.direction === 'to_customer'
  ) {
    const clock = replyClockAfterAgentToCustomer()
    return {
      status,
      awaiting: clock.awaiting,
      replyDueAt: null
    }
  }

  return {
    status,
    awaiting: current.awaiting || 'us',
    replyDueAt: current.replyDueAt
  }
}

/** Przelicza awaiting / reply_due / status z historii zdarzeń (import, backfill). */
export function conversationStateFromEvents(
  events: TicketStateEvent[],
  closed = false
): TicketConversationState {
  if (closed) {
    return { status: 'closed', awaiting: 'customer', replyDueAt: null }
  }
  let current: { status: TicketStatus, awaiting: AwaitingParty | null, replyDueAt: Date | null } = {
    status: 'open',
    awaiting: null,
    replyDueAt: null
  }
  for (const event of events) {
    if (current.status === 'closed') break
    current = nextState(current, event)
  }
  return {
    status: current.status,
    awaiting: current.awaiting || 'us',
    replyDueAt: current.replyDueAt
  }
}
