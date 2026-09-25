import { describe, expect, it } from 'vitest'
import { evaluateSla, firstAgentReplyToCustomer, lockFirstAgentReply } from './sla'
import { fromZonedTime } from './workingHours'
import type { Message } from './domain'

describe('first agent reply', () => {
  it('takes only the first message sent to the customer, not a later chase of the seller', () => {
    const contact = fromZonedTime(2026, 8, 5, 10, 0, 0)
    const toCustomer = fromZonedTime(2026, 8, 5, 10, 12, 0)
    const toSeller = fromZonedTime(2026, 8, 5, 15, 40, 0)
    const messages: Message[] = [
      {
        id: '1',
        ticketId: 't1',
        createdAt: contact,
        direction: 'to_customer',
        senderType: 'customer',
        body: 'gdzie jest przesyłka'
      },
      {
        id: '2',
        ticketId: 't1',
        createdAt: toCustomer,
        direction: 'to_customer',
        senderType: 'agent',
        body: 'sprawdzam'
      },
      {
        id: '3',
        ticketId: 't1',
        createdAt: toSeller,
        direction: 'to_seller',
        senderType: 'agent',
        body: 'proszę o odpowiedź'
      }
    ]
    expect(firstAgentReplyToCustomer(messages)?.getTime()).toBe(toCustomer.getTime())
  })

  it('never overwrites an already locked first reply', () => {
    const first = fromZonedTime(2026, 8, 5, 10, 12, 0)
    const later = fromZonedTime(2026, 8, 5, 15, 40, 0)
    expect(lockFirstAgentReply(first, later).getTime()).toBe(first.getTime())
  })
})

describe('SLA', () => {
  it('marks a same-day chat reply of 12 minutes as met', () => {
    const result = evaluateSla({
      channel: 'chat',
      firstContactAt: fromZonedTime(2026, 8, 5, 10, 0, 0),
      firstAgentReplyAt: fromZonedTime(2026, 8, 5, 10, 12, 0)
    })
    expect(result.eligible).toBe(true)
    expect(result.businessMs).toBe(12 * 60 * 1000)
    expect(result.met).toBe(true)
  })

  it('excludes contact after Warsaw close, even when UTC still looks like afternoon', () => {
    const result = evaluateSla({
      channel: 'email',
      firstContactAt: new Date('2026-08-05T15:32:00.000Z'),
      firstAgentReplyAt: new Date('2026-08-05T15:40:00.000Z')
    })
    expect(result.eligible).toBe(false)
    expect(result.exclusion).toBe('off_hours')
  })

  it('excludes contact on a statutory holiday', () => {
    const result = evaluateSla({
      channel: 'email',
      firstContactAt: fromZonedTime(2026, 5, 1, 11, 0, 0),
      firstAgentReplyAt: fromZonedTime(2026, 5, 4, 10, 0, 0)
    })
    expect(result.eligible).toBe(false)
    expect(result.exclusion).toBe('holiday')
    expect(result.holidayName).toBe('Święto Pracy')
  })

  it('keeps phone out of the headline SLA until answer status exists', () => {
    const result = evaluateSla({
      channel: 'phone',
      firstContactAt: fromZonedTime(2026, 8, 5, 10, 0, 0),
      firstAgentReplyAt: fromZonedTime(2026, 8, 5, 10, 5, 0)
    })
    expect(result.eligible).toBe(false)
    expect(result.exclusion).toBe('channel')
  })

  it('counts an answered phone call in the headline SLA', () => {
    const result = evaluateSla({
      channel: 'phone',
      callStatus: 'answered',
      firstContactAt: fromZonedTime(2026, 8, 5, 10, 0, 0),
      firstAgentReplyAt: fromZonedTime(2026, 8, 5, 10, 5, 0)
    })
    expect(result.eligible).toBe(true)
    expect(result.met).toBe(true)
  })
})
