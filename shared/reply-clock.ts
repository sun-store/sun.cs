import type { Channel } from './domain'
import { SLA_THRESHOLD_MS } from './domain'
import { addBusinessMilliseconds } from './workingHours'

export type AwaitingParty = 'us' | 'customer'

export type ReplyClock = {
  awaiting: AwaitingParty
  replyDueAt: Date | null
}

/** Próg odpowiedzi operacyjnej (ten sam wymiar co KPI kanału). */
export function replyThresholdMs(channel: Channel): number {
  if (channel === 'email' || channel === 'form') {
    return SLA_THRESHOLD_MS.email
  }
  return SLA_THRESHOLD_MS.chat
}

export function replyClockAfterCustomerMessage(channel: Channel, at: Date): ReplyClock {
  return {
    awaiting: 'us',
    replyDueAt: addBusinessMilliseconds(at, replyThresholdMs(channel))
  }
}

export function replyClockAfterAgentToCustomer(): ReplyClock {
  return { awaiting: 'customer', replyDueAt: null }
}
