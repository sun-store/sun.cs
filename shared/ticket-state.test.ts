import { describe, expect, it } from 'vitest'
import { conversationStateFromEvents, nextState } from './ticket-state'

describe('nextState', () => {
  const base = {
    status: 'waiting' as const,
    awaiting: 'customer' as const,
    replyDueAt: null
  }

  it('klient w waiting → open + awaiting us', () => {
    const next = nextState(base, {
      senderType: 'customer',
      direction: 'to_customer',
      channel: 'email',
      at: new Date('2026-09-30T10:00:00+02:00')
    })
    expect(next.status).toBe('open')
    expect(next.awaiting).toBe('us')
    expect(next.replyDueAt).toBeInstanceOf(Date)
  })

  it('agent do klienta → waiting + awaiting customer', () => {
    const next = nextState({
      status: 'open',
      awaiting: 'us',
      replyDueAt: new Date()
    }, {
      senderType: 'agent',
      direction: 'to_customer',
      channel: 'email',
      at: new Date()
    })
    expect(next.status).toBe('waiting')
    expect(next.awaiting).toBe('customer')
    expect(next.replyDueAt).toBeNull()
  })

  it('notatka nie zmienia stanu', () => {
    const current = {
      status: 'open' as const,
      awaiting: 'us' as const,
      replyDueAt: new Date('2026-09-30T12:00:00Z')
    }
    const next = nextState(current, {
      senderType: 'agent',
      direction: 'internal',
      channel: 'email',
      at: new Date()
    })
    expect(next.status).toBe('open')
    expect(next.awaiting).toBe('us')
    expect(next.replyDueAt).toEqual(current.replyDueAt)
  })

  it('zamknięta → błąd', () => {
    expect(() => nextState({
      status: 'closed',
      awaiting: 'customer',
      replyDueAt: null
    }, {
      senderType: 'customer',
      direction: 'to_customer',
      channel: 'email',
      at: new Date()
    })).toThrow(/zamkniętej/)
  })
})

describe('conversationStateFromEvents', () => {
  it('ostatni klient → awaiting us + reply_due', () => {
    const state = conversationStateFromEvents([
      {
        senderType: 'customer',
        direction: 'to_customer',
        channel: 'chat',
        at: new Date('2026-09-30T10:00:00Z')
      },
      {
        senderType: 'agent',
        direction: 'to_customer',
        channel: 'chat',
        at: new Date('2026-09-30T10:05:00Z')
      },
      {
        senderType: 'customer',
        direction: 'to_customer',
        channel: 'chat',
        at: new Date('2026-09-30T10:10:00Z')
      }
    ])
    expect(state.status).toBe('open')
    expect(state.awaiting).toBe('us')
    expect(state.replyDueAt).toBeInstanceOf(Date)
  })
})
