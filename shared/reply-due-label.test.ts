import { describe, expect, it } from 'vitest'
import { cleanSubjectLine, replyDueLabel } from './reply-due-label'

describe('replyDueLabel', () => {
  const now = new Date('2026-09-30T12:00:00Z')

  it('czeka na klienta', () => {
    expect(replyDueLabel('customer', null, now)).toEqual({
      text: 'czeka na klienta',
      tone: 'muted'
    })
  })

  it('po terminie', () => {
    expect(replyDueLabel('us', new Date('2026-09-30T11:20:00Z'), now)).toEqual({
      text: 'po terminie 40 min',
      tone: 'overdue'
    })
  })

  it('pilne ≤ 30 min', () => {
    expect(replyDueLabel('us', new Date('2026-09-30T12:25:00Z'), now)).toEqual({
      text: 'zostało 25 min',
      tone: 'urgent'
    })
  })

  it('luźny termin', () => {
    expect(replyDueLabel('us', new Date('2026-09-30T14:00:00Z'), now)).toEqual({
      text: 'zostało 2 h',
      tone: 'muted'
    })
  })
})

describe('cleanSubjectLine', () => {
  it('usuwa Re:/ODP: i URL', () => {
    expect(cleanSubjectLine('Re: ODP: Problem https://example.com/x')).toBe('Problem')
  })
})
