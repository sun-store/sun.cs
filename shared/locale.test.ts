import { describe, expect, it } from 'vitest'
import { detectTextLocale, resolveAppLocale } from './locale'

describe('detectTextLocale', () => {
  it('wykrywa polski', () => {
    expect(detectTextLocale('Dzień dobry, proszę o pomoc ze sprzedawcą.')).toBe('pl')
  })

  it('wykrywa angielski', () => {
    expect(detectTextLocale('Hello, the seller is not answering. Could you please help?')).toBe('en')
  })
})

describe('resolveAppLocale', () => {
  it('fallback pl', () => {
    expect(resolveAppLocale('de')).toBe('pl')
    expect(resolveAppLocale('en')).toBe('en')
  })
})
