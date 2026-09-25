import { describe, expect, it } from 'vitest'
import { isCompanyEmail } from './company-email'

describe('isCompanyEmail', () => {
  it('wpuszcza @sun.store', () => {
    expect(isCompanyEmail('martyna.kalicka@sun.store')).toBe(true)
  })

  it('odrzuca Gmail', () => {
    expect(isCompanyEmail('ktoś@gmail.com')).toBe(false)
  })

  it('wpuszcza Kamila z allowlisty sunstore.company', () => {
    expect(isCompanyEmail('kamil.dabrowski@sunstore.company')).toBe(true)
  })

  it('odrzuca inne @sunstore.company', () => {
    expect(isCompanyEmail('ktoś@sunstore.company')).toBe(false)
  })
})
