import { describe, expect, it } from 'vitest'
import { isAgentClosedText, ticketTopic, topicFromText, TOPICS, TOPIC_LABELS, TOPIC_NEXT_STEP } from './ticket-topic'

describe('ticketTopic', () => {
  it('bierze konkretny tag HubSpot przed treścią', () => {
    expect(ticketTopic({ sourceCategory: 'dbSS Issue', subject: 'Invoice missing' })).toBe('delivery')
    expect(ticketTopic({ sourceCategory: 'Unresponsive Seller;Claim' })).toBe('unresponsive')
    expect(ticketTopic({ sourceCategory: 'Invoices;sun.finance' })).toBe('invoice')
    expect(ticketTopic({ sourceCategory: 'Data Change' })).toBe('account')
  })

  it('przy „Other” i braku tagu czyta temat i treść (przykłady z HubSpota, wrzesień 2026)', () => {
    const cases: Array<[string | null, string, string, string]> = [
      ['Other', 'Transaction #sr7zlK28 cancel request', 'Can you please help to cancel the following order', 'order_change'],
      [null, 'RFQ utility-scale: Trina 730W ca. 10 MW per Italia', '', 'rfq'],
      [null, 'B2C enquiry - private individual without VAT', '', 'b2c'],
      ['Other', 'Conversation from Inbox (x@y.si)', 'sprzedawca pyta o wyplate', 'payout'],
      ['Other', 'https://sun.store/pl/transaction/aJRMIvZP', 'sprzedawca prosi o kontakt z klientem', 'unresponsive'],
      ['Other', 'Conversation from Inbox (x@y.es)', 'tiket zdublowany, zamykam', 'junk'],
      ['Other', 'Suspected Impersonation / Bank Account Assignment', '[POTENTIAL_FRAUD_IMPERSONATION]', 'fraud'],
      ['Other', 'Missing Delivery by sun.store invoice - #odcCkbbV', 'delivery cost was deducted from their payout', 'payout'],
      ['Other', 'Ticket #431249472708', 'nie umie sie zarejtrowac', 'account'],
      ['Other', 'Probattery - distributor CESC', 'possibility of becoming a supplier on the SunStore platform', 'partnership']
    ]
    for (const [sourceCategory, subject, text, expected] of cases) {
      expect(ticketTopic({ sourceCategory, subject, text }), subject).toBe(expected)
    }
  })

  it('bez tekstu zwraca „Do rozpoznania”, nie zgaduje', () => {
    expect(topicFromText('Conversation from Inbox (a@b.pl)', '')).toBe('unknown')
    expect(topicFromText(null, null)).toBe('unknown')
  })

  it('każdy temat ma etykietę i następny krok', () => {
    for (const topic of TOPICS) {
      expect(TOPIC_LABELS[topic]).toBeTruthy()
      expect(TOPIC_NEXT_STEP[topic]).toBeTruthy()
    }
  })

  it('rozpoznaje sprawy zamknięte przez Sun Agenta', () => {
    expect(isAgentClosedText('✅ CASE CLOSED BY THE AGENT — the customer\'s question was answered')).toBe(true)
    expect(isAgentClosedText('Hello')).toBe(false)
  })
})
