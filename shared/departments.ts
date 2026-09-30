import {
  CATEGORIES,
  splitHubspotCategories,
  type Category,
  type HubspotTicketCategory
} from './domain'

/** Pięć zespołów od startu — pole `tickets.department`, da się migrować. */
export const DEPARTMENTS = [
  'cs',
  'logistics',
  'finance',
  'merchant_success',
  'product'
] as const
export type Department = typeof DEPARTMENTS[number]

export const DEPARTMENT_LABELS: Record<Department, string> = {
  cs: 'Support',
  logistics: 'Logistyka',
  finance: 'Finanse',
  merchant_success: 'Merchant Success',
  product: 'Produkt'
}

/** Przy kilku tagach HubSpot: niższy indeks = ważniejszy dział. */
const DEPARTMENT_PRIORITY: Record<Department, number> = {
  logistics: 0,
  finance: 1,
  merchant_success: 2,
  product: 3,
  cs: 4
}

const HUBSPOT_DEPARTMENT: Record<HubspotTicketCategory, Department> = {
  'DBSS Issue': 'logistics',
  'Logistics Issue': 'logistics',
  'Claim': 'merchant_success',
  'sun.finance': 'finance',
  'No VAT': 'finance',
  'Lost on platform': 'product',
  'Offer request': 'product',
  'Unresponsive seller': 'merchant_success',
  'Stripe Payment Issue': 'finance',
  'Invoices': 'finance',
  'Data Change': 'cs',
  'Bug': 'product',
  'Feature Request': 'product',
  'Spam': 'cs',
  'Other': 'cs'
}

const CATEGORY_DEPARTMENT: Record<Category, Department> = {
  delivery: 'logistics',
  payment: 'finance',
  account: 'cs',
  product: 'product',
  other: 'cs'
}

function pickDepartment(candidates: Department[]): Department {
  if (!candidates.length) return 'cs'
  return candidates.reduce((best, next) =>
    DEPARTMENT_PRIORITY[next] < DEPARTMENT_PRIORITY[best] ? next : best
  )
}

/** Domyślny dział z kategorii HubSpot albo wewnętrznej — przed ręczną migracją. */
export function resolveDepartment(
  sourceCategory: string | null | undefined,
  category: string | null | undefined
): Department {
  if (sourceCategory && sourceCategory.trim()) {
    const fromHubspot: Department[] = []
    for (const tag of splitHubspotCategories(sourceCategory)) {
      if (tag in HUBSPOT_DEPARTMENT) {
        fromHubspot.push(HUBSPOT_DEPARTMENT[tag as keyof typeof HUBSPOT_DEPARTMENT])
      }
    }
    if (fromHubspot.length) return pickDepartment(fromHubspot)
  }

  if (category && (CATEGORIES as readonly string[]).includes(category)) {
    return CATEGORY_DEPARTMENT[category as Category]
  }

  return 'cs'
}

export function isDepartment(value: unknown): value is Department {
  return typeof value === 'string' && (DEPARTMENTS as readonly string[]).includes(value)
}

/** Tekst „od kiedy wisi” liczony od first_contact_at. */
export function hangingSinceLabel(firstContactAt: Date | string, now = new Date()): string {
  const start = firstContactAt instanceof Date ? firstContactAt : new Date(firstContactAt)
  if (Number.isNaN(start.getTime())) return '—'
  const ms = Math.max(0, now.getTime() - start.getTime())
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours} h`
  const days = Math.floor(hours / 24)
  return `${days} dn.`
}
