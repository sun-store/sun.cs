import {
  normalizeHubspotCategory,
  splitHubspotCategories,
  type Category,
  type HubspotTicketCategory
} from './domain'
import { resolveDepartment, type Department } from './departments'

export type TicketClassification = {
  sourceCategory: string
  category: Category
  department: Department
  reason: string
}

const INTERNAL_FROM_HUBSPOT: Partial<Record<HubspotTicketCategory, Category>> = {
  'DBSS Issue': 'delivery',
  'Logistics Issue': 'delivery',
  'Claim': 'other',
  'sun.finance': 'payment',
  'No VAT': 'payment',
  'Stripe Payment Issue': 'payment',
  'Lost on platform': 'product',
  'Offer request': 'product',
  'Unresponsive seller': 'other',
  'Spam': 'other',
  'Other': 'other'
}

type Rule = {
  source: HubspotTicketCategory
  category: Category
  reason: string
  test: (text: string) => boolean
}

const RULES: Rule[] = [
  {
    source: 'Unresponsive seller',
    category: 'other',
    reason: 'sprzedawca nie odpowiada / problem z sellerem',
    test: t => /unresponsive\s*seller|seller\s+not\s+resp|seller\s+nie\s+odpowiad|problem\s+(z|sa|with)\s+(seller|sprzedaw|prodav|vendit)|buyer\s+inactive|nie\s+odpowiada/i.test(t)
  },
  {
    source: 'Claim',
    category: 'other',
    reason: 'szkoda / claim / uszkodzenie',
    test: t => /\bclaim\b|uszkodzon|damaged\s+in\s+shipping|reklamac/i.test(t)
  },
  {
    source: 'Logistics Issue',
    category: 'delivery',
    reason: 'dostawa / transport / dokumenty wysyłki',
    test: t => /spedizion|shipping\s+document|transport\s+cost|dostaw|dbss|\bcmr\b|tracking|przewoz/i.test(t)
  },
  {
    source: 'Stripe Payment Issue',
    category: 'payment',
    reason: 'płatność / stripe / bank',
    test: t => /\bstripe\b|payment\s+issue|nie\s+mogę\s+zapłaci|n'arrive\s+pas\s+à\s+payer|paiement|płatno|pay\s+a\s+commande|deblocage|débloquer.*banque|sunfinanc/i.test(t)
  },
  {
    source: 'sun.finance',
    category: 'payment',
    reason: 'wypłata / faktura / finanse',
    test: t => /sun\.?\s*finance|wypłat|faktury|invoice|račun|končni\s+račun|credit\s+line/i.test(t)
  },
  {
    source: 'Offer request',
    category: 'product',
    reason: 'cena / oferta / produkt',
    test: t => /\bprecio\b|\boffer\b|cena\b|ulica\s+\d+w|buying|kupi[ćc]/i.test(t)
  },
  {
    source: 'Spam',
    category: 'other',
    reason: 'pusty / testowy kontakt',
    test: t => /^(hi|hello|hey(\s+agent)?|cześć|bonjour\s+\w+|tere[,.]?)\s*$/i.test(t.trim())
      || /\[test\]|webhooki\s*\/\s*opóźnienia/i.test(t)
  }
]

function textBlob(subject: string | null | undefined, body: string | null | undefined): string {
  return `${subject || ''}\n${body || ''}`.replace(/\s+/g, ' ').trim()
}

/** Z istniejącego source_category ( HubSpot ) wylicz kanoniczne tagi + dział + kategorię wewnętrzną. */
export function classifyFromSource(
  sourceCategory: string | null | undefined,
  fallbackCategory: Category | null | undefined = null
): TicketClassification | null {
  if (!sourceCategory?.trim()) return null
  const tags = splitHubspotCategories(sourceCategory).filter(tag => tag !== 'Bez kategorii')
  if (!tags.length) return null
  const normalized = tags.map(tag => normalizeHubspotCategory(tag))
  const primary = normalized.find((tag): tag is HubspotTicketCategory =>
    tag in INTERNAL_FROM_HUBSPOT
  )
  if (!primary && normalized.every(tag => tag === 'Other')) {
    return {
      sourceCategory: 'Other',
      category: 'other',
      department: 'cs',
      reason: 'HubSpot Other'
    }
  }
  if (!primary) return null
  return {
    sourceCategory: [...new Set(normalized)].join(';'),
    category: INTERNAL_FROM_HUBSPOT[primary] || fallbackCategory || 'other',
    department: resolveDepartment(normalized.join(';'), INTERNAL_FROM_HUBSPOT[primary] || null),
    reason: `HubSpot: ${primary}`
  }
}

/** Dopisz kategorię z tematu/treści, gdy brak sensownego tagu HubSpot. */
export function classifyFromContent(
  subject: string | null | undefined,
  body: string | null | undefined
): TicketClassification | null {
  const text = textBlob(subject, body)
  if (!text) return null
  for (const rule of RULES) {
    if (!rule.test(text)) continue
    return {
      sourceCategory: rule.source,
      category: rule.category,
      department: resolveDepartment(rule.source, rule.category),
      reason: rule.reason
    }
  }
  return null
}

export function classifyTicket(input: {
  sourceCategory?: string | null
  category?: string | null
  subject?: string | null
  body?: string | null
}): TicketClassification | null {
  const fromSource = classifyFromSource(input.sourceCategory, input.category as Category | null)
  // Treść wygrywa tylko gdy source brak / Other / nieznany.
  const sourceWeak = !input.sourceCategory?.trim()
    || /^other$/i.test(input.sourceCategory.trim())
    || splitHubspotCategories(input.sourceCategory).every(tag => tag === 'Other' || tag === 'Bez kategorii')

  if (!sourceWeak && fromSource) return fromSource

  const fromContent = classifyFromContent(input.subject, input.body)
  if (fromContent) return fromContent
  return fromSource
}
