import { describe, expect, it } from 'vitest'
import { parseAiDraft, parseAiSummary } from './ai-output'

describe('parseAiSummary', () => {
  it('parsuje JSON', () => {
    expect(parseAiSummary('{"summary":"A","need":"B","next_step":"C"}')).toEqual({
      summary: 'A',
      need: 'B',
      nextStep: 'C'
    })
  })
})

describe('parseAiDraft', () => {
  it('bierze plain text', () => {
    expect(parseAiDraft('Hello [IMIĘ]', true)).toEqual({
      text: 'Hello [IMIĘ]',
      language: 'unknown',
      needsReview: true
    })
  })
})
