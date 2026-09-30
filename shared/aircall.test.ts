import { describe, expect, it } from 'vitest'
import { parseAircallWebhook } from './aircall'

describe('parseAircallWebhook', () => {
  it('nieodebrane inbound → sprawa oddzwoń (callback)', () => {
    const result = parseAircallWebhook({
      event: 'call.ended',
      token: 'secret',
      timestamp: 1_700_000_000,
      data: {
        id: 812,
        direction: 'inbound',
        status: 'done',
        missed_call_reason: 'agents_did_not_answer',
        started_at: 1_700_000_000,
        ended_at: 1_700_000_030,
        raw_digits: '+48 500 100 200',
        voicemail: null,
        recording: null
      }
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.draft.callStatus).toBe('callback')
    expect(result.draft.subject).toMatch(/^Oddzwoń:/)
    expect(result.draft.channel).toBe('phone')
    expect(result.draft.senderType).toBe('customer')
    expect(result.draft.externalThreadId).toBe('aircall:812')
    expect(result.draft.identifiers[0]?.type).toBe('phone')
  })

  it('voicemail_left → oddzwoń + link', () => {
    const result = parseAircallWebhook({
      event: 'call.voicemail_left',
      data: {
        id: 99,
        direction: 'inbound',
        answered_at: null,
        raw_digits: '48500100200',
        voicemail: 'https://example.com/vm.mp3'
      }
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.draft.callStatus).toBe('callback')
    expect(result.draft.body).toContain('Poczta głosowa:')
  })

  it('odebrane inbound → answered', () => {
    const result = parseAircallWebhook({
      event: 'call.ended',
      data: {
        id: 1,
        direction: 'inbound',
        answered_at: 1_700_000_010,
        ended_at: 1_700_000_100,
        duration: 90,
        raw_digits: '+48111111111',
        recording: 'https://example.com/rec.mp3',
        user: { name: 'Anna' }
      }
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.draft.callStatus).toBe('answered')
    expect(result.draft.subject).toMatch(/^Rozmowa:/)
    expect(result.draft.body).toContain('Nagranie:')
  })

  it('outbound → sender agent', () => {
    const result = parseAircallWebhook({
      event: 'call.ended',
      data: {
        id: 2,
        direction: 'outbound',
        answered_at: 1,
        raw_digits: '+48222222222'
      }
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.draft.senderType).toBe('agent')
  })

  it('obce eventy ignoruje', () => {
    expect(parseAircallWebhook({ event: 'call.created', data: { id: 1, direction: 'inbound' } })).toEqual({
      ok: false,
      reason: 'ignored'
    })
  })
})
