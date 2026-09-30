import { describe, expect, it } from 'vitest'
import { hangingSinceLabel, resolveDepartment } from './departments'

describe('resolveDepartment', () => {
  it('maps HubSpot logistics and finance tags', () => {
    expect(resolveDepartment('Logistics Issue', null)).toBe('logistics')
    expect(resolveDepartment('DBSS Issue', 'account')).toBe('logistics')
    expect(resolveDepartment('sun.finance', null)).toBe('finance')
    expect(resolveDepartment('No VAT', 'other')).toBe('finance')
  })

  it('maps Merchant Success and product tags', () => {
    expect(resolveDepartment('Claim', null)).toBe('merchant_success')
    expect(resolveDepartment('Unresponsive seller', null)).toBe('merchant_success')
    expect(resolveDepartment('Offer request', null)).toBe('product')
    expect(resolveDepartment('Lost on platform', null)).toBe('product')
  })

  it('picks the most specific department when several HubSpot tags are set', () => {
    expect(resolveDepartment('Other;Logistics Issue', null)).toBe('logistics')
    expect(resolveDepartment('Claim;sun.finance', null)).toBe('finance')
  })

  it('falls back to internal category then Support', () => {
    expect(resolveDepartment(null, 'delivery')).toBe('logistics')
    expect(resolveDepartment(null, 'payment')).toBe('finance')
    expect(resolveDepartment(null, 'product')).toBe('product')
    expect(resolveDepartment(null, 'account')).toBe('cs')
    expect(resolveDepartment(null, null)).toBe('cs')
  })
})

describe('hangingSinceLabel', () => {
  it('formats from first contact', () => {
    const now = new Date('2026-09-30T12:00:00Z')
    expect(hangingSinceLabel(new Date('2026-09-30T11:30:00Z'), now)).toBe('30 min')
    expect(hangingSinceLabel(new Date('2026-09-30T09:00:00Z'), now)).toBe('3 h')
    expect(hangingSinceLabel(new Date('2026-09-27T12:00:00Z'), now)).toBe('3 dn.')
  })
})
