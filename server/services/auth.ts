import { betterAuth } from 'better-auth'
import {
  isCompanyEmail,
  isGoogleSsoConfigured,
  isMicrosoftSsoConfigured
} from '../../shared/company-email'
import { findAllowlistRole } from './allowlist'
import { getNeonPool, neonQuery } from './neon-db'

function microsoftSocialProvider() {
  if (!isMicrosoftSsoConfigured()) return undefined
  return {
    microsoft: {
      clientId: String(process.env.MICROSOFT_CLIENT_ID || '').trim(),
      clientSecret: String(process.env.MICROSOFT_CLIENT_SECRET || '').trim(),
      tenantId: String(process.env.MICROSOFT_TENANT_ID || 'organizations').trim() || 'organizations',
      prompt: 'select_account' as const,
      disableSignUp: false,
      mapProfileToUser: () => ({ image: undefined as string | undefined })
    }
  }
}

function originFromEnv(raw?: string) {
  const value = String(raw || '').trim().replace(/\/$/, '')
  if (!value) return ''
  if (value.startsWith('http://') || value.startsWith('https://')) return value
  return `https://${value}`
}

function googleSocialProvider() {
  if (!isGoogleSsoConfigured()) return undefined
  return {
    google: {
      clientId: String(process.env.GOOGLE_CLIENT_ID || '').trim(),
      clientSecret: String(process.env.GOOGLE_CLIENT_SECRET || '').trim(),
      prompt: 'select_account' as const,
      disableSignUp: false,
      mapProfileToUser: () => ({ image: undefined as string | undefined })
    }
  }
}

export function createBetterAuth() {
  const secret = (process.env.BETTER_AUTH_SECRET || '').trim()
  if (!secret || secret.length < 32) {
    throw new Error('Brak BETTER_AUTH_SECRET (min. 32 znaki).')
  }

  const baseURL = (process.env.BETTER_AUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
  const providers = { ...microsoftSocialProvider(), ...googleSocialProvider() }
  const trustedOrigins = [...new Set([
    baseURL,
    originFromEnv(process.env.VERCEL_URL),
    originFromEnv(process.env.VERCEL_PROJECT_PRODUCTION_URL),
    'https://sun-cs.vercel.app'
  ].filter(Boolean))]

  return betterAuth({
    database: getNeonPool(),
    secret,
    baseURL,
    trustedOrigins,
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: [
          ...(isMicrosoftSsoConfigured() ? (['microsoft'] as const) : []),
          ...(isGoogleSsoConfigured() ? (['google'] as const) : [])
        ],
        requireLocalEmailVerified: false
      }
    },
    emailAndPassword: {
      enabled: true,
      // Bez potwierdzenia maila rejestracja na hasło pozwalała założyć konto na cudzy adres z listy zespołu.
      // Nowe konta powstają tylko przez SSO; istniejące hasła dalej działają przy logowaniu.
      disableSignUp: true,
      minPasswordLength: 8,
      requireEmailVerification: false
    },
    socialProviders: Object.keys(providers).length ? providers : undefined,
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (!isCompanyEmail(user.email, process.env.MICROSOFT_ALLOWED_DOMAINS)) {
              return false
            }
            const allowed = await findAllowlistRole(user.email)
            if (!allowed) {
              throw new Error('Nie ma Cię na liście sun.support. Poproś admina o dopisanie.')
            }
            return { data: user }
          },
          after: async (user) => {
            const role = await findAllowlistRole(user.email)
            if (!role) {
              throw new Error('Nie ma Cię na liście sun.support. Poproś admina o dopisanie.')
            }
            await neonQuery(
              `insert into staff (user_id, role, display_name)
               values ($1, $2, $3)
               on conflict (user_id) do nothing`,
              [user.id, role, user.name || user.email]
            )
          }
        }
      }
    }
  })
}

let authSingleton: ReturnType<typeof createBetterAuth> | null = null

export function getBetterAuth() {
  if (!authSingleton) authSingleton = createBetterAuth()
  return authSingleton
}

export { isGoogleSsoConfigured, isMicrosoftSsoConfigured }
