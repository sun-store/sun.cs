import { describe, expect, it } from 'vitest'
import { buildBacklog, type BacklogTicket } from './backlog'

const now = new Date('2026-09-30T12:00:00Z')

function ticket(partial: Partial<BacklogTicket>): BacklogTicket {
  return {
    id: Math.random().toString(36).slice(2),
    department: 'cs',
    ownerId: null,
    ownerName: null,
    awaiting: 'us',
    replyDueAt: null,
    firstContactAt: new Date('2026-09-29T08:00:00Z'),
    sourceCategory: null,
    subject: null,
    firstCustomerText: null,
    relatedTransactionId: null,
    aiNextStep: null,
    ...partial
  }
}

describe('buildBacklog', () => {
  it('liczy po terminie, mijające w 1 h, nieprzypisane i czekające na klienta', () => {
    const report = buildBacklog([
      ticket({ replyDueAt: new Date('2026-09-30T10:00:00Z'), department: 'logistics', sourceCategory: 'dbSS Issue', ownerId: 'a', ownerName: 'Ola' }),
      ticket({ replyDueAt: new Date('2026-09-30T12:30:00Z'), subject: 'Transaction cancel request' }),
      ticket({ awaiting: 'customer', ownerId: 'a', ownerName: 'Ola' })
    ], now)
    expect(report.totals).toEqual({ open: 3, toReply: 2, overdue: 1, dueSoon: 1, unassigned: 1, waitingCustomer: 1 })
    expect(report.byDepartment[0]?.department).toBe('logistics')
    expect(report.byDepartment[0]?.nextStep).toMatch(/po terminie SLA/)
    expect(report.unassignedByTopic).toEqual([
      expect.objectContaining({ topic: 'order_change', count: 1 })
    ])
  })

  it('najdłużej czekające: od najbardziej spóźnionej, z następnym krokiem', () => {
    const report = buildBacklog([
      ticket({ id: 'b', replyDueAt: new Date('2026-09-30T11:00:00Z') }),
      ticket({ id: 'a', replyDueAt: new Date('2026-09-29T11:00:00Z'), aiNextStep: 'Zadzwoń do sprzedawcy.' })
    ], now)
    expect(report.oldest.map(row => row.id)).toEqual(['a', 'b'])
    expect(report.oldest[0]?.nextStep).toBe('Zadzwoń do sprzedawcy.')
    expect(report.oldest[0]?.overdue).toBe(true)
  })

  it('bez spraw daje pusty raport z jedną wskazówką', () => {
    const report = buildBacklog([], now)
    expect(report.totals.open).toBe(0)
    expect(report.actions).toHaveLength(1)
  })
})
