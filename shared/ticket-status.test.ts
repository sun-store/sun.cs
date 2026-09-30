import { describe, expect, it } from 'vitest'
import { statusAfterEvent } from './ticket-status'

describe('statusAfterEvent', () => {
  it('opens the ticket when the customer writes', () => {
    expect(statusAfterEvent({
      senderType: 'customer',
      direction: 'to_customer'
    })).toBe('open')
  })

  it('moves to waiting after an agent reply to the customer', () => {
    expect(statusAfterEvent({
      senderType: 'agent',
      direction: 'to_customer'
    })).toBe('waiting')
  })

  it('does not change status for notes or seller mail', () => {
    expect(statusAfterEvent({
      senderType: 'agent',
      direction: 'internal'
    })).toBeNull()
    expect(statusAfterEvent({
      senderType: 'agent',
      direction: 'to_seller'
    })).toBeNull()
  })

  it('keeps a closed ticket closed', () => {
    expect(statusAfterEvent({
      senderType: 'customer',
      direction: 'to_customer',
      closed: true
    })).toBeNull()
  })
})
