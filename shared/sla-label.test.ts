import { describe, expect, it } from 'vitest'
import { slaBadge } from './sla-label'

describe('slaBadge', () => {
  const now = new Date('2026-09-30T12:00:00Z')

  it('late po terminie', () => {
    expect(slaBadge(new Date('2026-09-30T11:20:00Z'), 'us', now)).toEqual({
      text: 'po terminie 40 min',
      tone: 'late'
    })
  })

  it('soon ≤ 30 min', () => {
    expect(slaBadge(new Date('2026-09-30T12:25:00Z'), 'us', now)).toEqual({
      text: 'zostało 25 min',
      tone: 'soon'
    })
  })

  it('czeka na klienta', () => {
    expect(slaBadge(null, 'customer', now)).toEqual({
      text: 'czeka na klienta',
      tone: 'muted'
    })
  })
})
