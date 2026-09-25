import { describe, expect, it } from 'vitest'
import { detectContactConflict, normalizeIdentifier, normalizeIdentifiers } from './resolveContact'

describe('normalizeIdentifier', () => {
  it('lowercases email', () => {
    expect(normalizeIdentifier('email', '  Ada@Sun.Store ')).toBe('ada@sun.store')
  })

  it('strips phone formatting and international 00 prefix', () => {
    expect(normalizeIdentifier('phone', '+48 600 100 200')).toBe('48600100200')
    expect(normalizeIdentifier('whatsapp', '0048600100200')).toBe('48600100200')
  })
})

describe('normalizeIdentifiers', () => {
  it('drops empties and duplicates after normalize', () => {
    const result = normalizeIdentifiers([
      { type: 'email', value: 'ADA@sun.store' },
      { type: 'email', value: 'ada@sun.store' },
      { type: 'phone', value: '' }
    ])
    expect(result).toEqual([{ type: 'email', value: 'ada@sun.store' }])
  })
})

describe('detectContactConflict', () => {
  it('returns a single match without conflict', () => {
    expect(detectContactConflict(['a', 'a'])).toEqual({ contactId: 'a', conflictIds: [] })
  })

  it('flags two different people as a merge conflict', () => {
    expect(detectContactConflict(['a', 'b'])).toEqual({
      contactId: 'a',
      conflictIds: ['a', 'b']
    })
  })
})
