import { describe, expect, it } from 'vitest'
import { boundedText, optionalText } from './text-bounds'

describe('boundedText', () => {
  it('trims and keeps a short value', () => {
    expect(boundedText('  ala  ', 10, 'Imię')).toBe('ala')
  })

  it('rejects a value over the cap', () => {
    expect(() => boundedText('x'.repeat(11), 10, 'Imię')).toThrow(/najwyżej 10/)
  })
})

describe('optionalText', () => {
  it('turns empty into null', () => {
    expect(optionalText('  ', 10, 'Temat')).toBeNull()
    expect(optionalText(null, 10, 'Temat')).toBeNull()
  })
})
