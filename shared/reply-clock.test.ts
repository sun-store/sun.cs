import { describe, expect, it } from 'vitest'
import { fromZonedTime } from './workingHours'
import { replyClockAfterAgentToCustomer, replyClockAfterCustomerMessage } from './reply-clock'

describe('replyClockAfterCustomerMessage', () => {
  it('sets mail due Monday 10:30 after Friday 16:30 Warsaw', () => {
    const friday = fromZonedTime(2026, 9, 25, 16, 30, 0)
    const clock = replyClockAfterCustomerMessage('email', friday)
    expect(clock.awaiting).toBe('us')
    expect(clock.replyDueAt?.toISOString()).toBe(
      fromZonedTime(2026, 9, 28, 10, 30, 0).toISOString()
    )
  })

  it('clears the deadline when the agent replies to the customer', () => {
    expect(replyClockAfterAgentToCustomer()).toEqual({
      awaiting: 'customer',
      replyDueAt: null
    })
  })
})
