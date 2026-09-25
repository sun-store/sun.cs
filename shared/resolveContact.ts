import type { IdentifierType } from './domain'

export type IdentifierInput = {
  type: IdentifierType
  value: string
  source?: string
}

const EXTERNAL_ID_ORDER: IdentifierType[] = [
  'sunstore_user',
  'hubspot_contact',
  'chat_thread'
]

export function normalizeIdentifier(type: IdentifierType, value: string): string {
  const trimmed = value.trim()
  if (type === 'email') return trimmed.toLowerCase()
  if (type === 'phone' || type === 'whatsapp') {
    return trimmed.replace(/\D/g, '').replace(/^00/, '')
  }
  return trimmed
}

export function normalizeIdentifiers(inputs: IdentifierInput[]): IdentifierInput[] {
  const seen = new Set<string>()
  const result: IdentifierInput[] = []
  for (const input of inputs) {
    if (!input.value?.trim()) continue
    const value = normalizeIdentifier(input.type, input.value)
    if (!value) continue
    const key = `${input.type}:${value}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ type: input.type, value, source: input.source })
  }
  return result
}

export function lookupOrder(identifiers: IdentifierInput[]): IdentifierInput[] {
  const normalized = normalizeIdentifiers(identifiers)
  return [...normalized].sort((a, b) => rank(a.type) - rank(b.type))
}

export function detectContactConflict(contactIds: string[]): {
  contactId: string | null
  conflictIds: string[]
} {
  const unique = [...new Set(contactIds.filter(Boolean))]
  if (unique.length === 0) return { contactId: null, conflictIds: [] }
  if (unique.length === 1) return { contactId: unique[0], conflictIds: [] }
  return { contactId: unique[0], conflictIds: unique }
}

function rank(type: IdentifierType): number {
  const external = EXTERNAL_ID_ORDER.indexOf(type)
  if (external >= 0) return external
  if (type === 'email') return 10
  if (type === 'phone' || type === 'whatsapp') return 11
  return 20
}
