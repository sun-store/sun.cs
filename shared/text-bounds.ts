export const TICKET_LIST_PAGE_SIZE = 50
/** Górny limit pageSize z query (anty-abuse). */
export const TICKET_LIST_PAGE_SIZE_MAX = 100
/** @deprecated Używaj stronicowania (`TICKET_LIST_PAGE_SIZE`). Zostawione jako sufit jednej strony. */
export const TICKET_LIST_LIMIT = TICKET_LIST_PAGE_SIZE_MAX

export const TEXT_LIMITS = {
  body: 100_000,
  subject: 500,
  name: 200,
  email: 320,
  phone: 40,
  externalId: 120,
  /** Id wątku i wiadomości z Outlooka (Graph) bywają dłuższe niż 120 znaków. */
  threadId: 512,
  transactionId: 80
} as const

export function boundedText(value: unknown, max: number, label: string): string {
  const text = String(value ?? '').trim()
  if (text.length > max) {
    throw new Error(`${label} może mieć najwyżej ${max} znaków.`)
  }
  return text
}

export function optionalText(value: unknown, max: number, label: string): string | null {
  if (value == null || value === '') return null
  const text = boundedText(value, max, label)
  return text || null
}
