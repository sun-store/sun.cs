import { describe, expect, it } from 'vitest'
import { classifyFromContent, classifyTicket } from './classify-ticket'

describe('classifyFromContent', () => {
  it('detects unresponsive seller', () => {
    const hit = classifyFromContent('seller not responding', 'kupiłem kontener a seller nie odpowiada')
    expect(hit?.sourceCategory).toBe('Unresponsive seller')
    expect(hit?.department).toBe('merchant_success')
  })

  it('detects logistics and payment', () => {
    expect(classifyFromContent('shipping documents', null)?.sourceCategory).toBe('Logistics Issue')
    expect(classifyFromContent('Je n\'arrive pas à payer', null)?.sourceCategory).toBe('Stripe Payment Issue')
    expect(classifyFromContent('sunfinance payment', null)?.department).toBe('finance')
  })
})

describe('classifyTicket', () => {
  it('keeps strong HubSpot tags', () => {
    const hit = classifyTicket({
      sourceCategory: 'Unresponsive Seller',
      subject: 'hi'
    })
    expect(hit?.sourceCategory).toBe('Unresponsive seller')
    expect(hit?.department).toBe('merchant_success')
  })

  it('overrides bare Other from content', () => {
    const hit = classifyTicket({
      sourceCategory: 'Other',
      subject: 'Could you please check this transport cost?'
    })
    expect(hit?.sourceCategory).toBe('Logistics Issue')
  })
})
