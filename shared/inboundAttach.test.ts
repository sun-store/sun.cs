import { describe, expect, it } from 'vitest'
import { shouldAttachToTicket } from './inboundAttach'

describe('shouldAttachToTicket', () => {
  it('prefers an existing thread over other open tickets', () => {
    expect(shouldAttachToTicket({
      threadTicketId: 'thread-1',
      openTicketIds: ['other']
    })).toEqual({ ticketId: 'thread-1', reason: 'thread' })
  })

  it('attaches when the contact has exactly one open ticket', () => {
    expect(shouldAttachToTicket({
      threadTicketId: null,
      openTicketIds: ['only']
    })).toEqual({ ticketId: 'only', reason: 'single_open' })
  })

  it('opens a new ticket when the contact has several open cases and no thread id', () => {
    expect(shouldAttachToTicket({
      threadTicketId: null,
      openTicketIds: ['a', 'b']
    })).toEqual({ ticketId: null, reason: 'new' })
  })
})
