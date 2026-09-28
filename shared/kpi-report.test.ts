import { describe, expect, it } from 'vitest'
import {
  bonusPoints,
  bonusShare,
  extractTxnId,
  evaluateHeadlineSla,
  slaClockStart,
  type KpiTicket
} from './kpi-report'
import { fromZonedTime } from './workingHours'

function ticket(partial: Partial<KpiTicket>): KpiTicket {
  return {
    id: 't1',
    owner: 'Armand Banaszkiewicz',
    channel: 'email',
    status: 'closed',
    category: 'delivery',
    priority: 'medium',
    subject: 'sprawa',
    relatedTransactionId: null,
    contactEmails: [],
    companyIds: [],
    customerRole: null,
    createdAt: fromZonedTime(2026, 9, 2, 10, 0, 0),
    firstContactAt: fromZonedTime(2026, 9, 2, 10, 0, 0),
    firstAgentReplyAt: fromZonedTime(2026, 9, 2, 10, 20, 0),
    closedAt: fromZonedTime(2026, 9, 2, 12, 0, 0),
    lastActivityAt: fromZonedTime(2026, 9, 2, 12, 0, 0),
    ...partial
  }
}

describe('bonus policy', () => {
  it('is zero below 50% of target', () => {
    expect(bonusShare(0.2, 0.5)).toBe(0)
    expect(bonusPoints(0.2, 0.5)).toBe(0)
  })

  it('is linear between 50% and 100% of target', () => {
    expect(bonusShare(0.8, 0.8)).toBe(1)
    expect(bonusShare(0.6, 0.8)).toBeCloseTo(0.5)
    expect(bonusPoints(0.6, 0.8)).toBe(10)
  })

  it('caps above target', () => {
    expect(bonusShare(0.769, 0.5)).toBe(1)
    expect(bonusPoints(0.769, 0.5)).toBe(20)
  })
})

describe('FCR helpers', () => {
  it('reads 8-character transaction ids from HubSpot subjects', () => {
    expect(extractTxnId('https://sun.store/transaction/jrdlVvRD claim')).toBe('jrdlVvRD')
  })
})

describe('headline SLA', () => {
  it('excludes tickets created outside 9-17 Warsaw', () => {
    const result = evaluateHeadlineSla(ticket({
      firstContactAt: fromZonedTime(2026, 9, 2, 18, 10, 0),
      firstAgentReplyAt: fromZonedTime(2026, 9, 3, 9, 10, 0),
      closedAt: fromZonedTime(2026, 9, 3, 10, 0, 0)
    }))
    expect(result.eligible).toBe(false)
    expect(result.excludedOffHours).toBe(true)
  })

  it('starts the clock next morning after 16:30', () => {
    const start = slaClockStart(fromZonedTime(2026, 9, 2, 16, 40, 0))
    expect(start.getTime()).toBe(fromZonedTime(2026, 9, 3, 9, 0, 0).getTime())
  })

  it('drops unreliable first replies recorded after close', () => {
    const result = evaluateHeadlineSla(ticket({
      firstAgentReplyAt: fromZonedTime(2026, 9, 3, 12, 0, 0),
      closedAt: fromZonedTime(2026, 9, 2, 12, 0, 0)
    }))
    expect(result.unreliable).toBe(true)
    expect(result.eligible).toBe(false)
  })
})
