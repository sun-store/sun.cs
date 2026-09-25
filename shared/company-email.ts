/** Domeny poczty firmowej — SSO. `sunstore.company` tylko dla allowlisty (Kamil). */
export const DEFAULT_COMPANY_EMAIL_DOMAINS = ['sun.store'] as const

export const SUNSTORE_COMPANY_ALLOWLIST = ['kamil.dabrowski@sunstore.company'] as const

export function parseAllowedEmailDomains(raw?: string | null): string[] {
  const extra = String(raw || '')
    .split(',')
    .map(d => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean)
  return Array.from(new Set([...DEFAULT_COMPANY_EMAIL_DOMAINS, ...extra]))
}

export function emailDomain(email: string): string {
  const at = email.trim().toLowerCase().lastIndexOf('@')
  if (at < 1) return ''
  return email.trim().toLowerCase().slice(at + 1)
}

export function isCompanyEmail(email: string, extraDomainsRaw?: string | null): boolean {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return false
  if ((SUNSTORE_COMPANY_ALLOWLIST as readonly string[]).includes(normalized)) return true
  const domain = emailDomain(normalized)
  if (!domain || domain === 'sunstore.company') return false
  return parseAllowedEmailDomains(extraDomainsRaw).includes(domain)
}

/** Przycisk na /login — jak w logistics: wystarczy CLIENT_ID. Sekret zostaje na serwerze. */
export function isMicrosoftSsoConfigured(): boolean {
  return Boolean(String(process.env.MICROSOFT_CLIENT_ID || '').trim())
}

export function isGoogleSsoConfigured(): boolean {
  return Boolean(String(process.env.GOOGLE_CLIENT_ID || '').trim())
}
