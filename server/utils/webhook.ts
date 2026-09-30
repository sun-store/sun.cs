import { timingSafeEqual } from 'node:crypto'

/**
 * Guard webhooków zewnętrznych (Aircall, …). Wyjątek od requireUser — jak requireCron.
 * Porównanie timing-safe; sekret tylko z env serwera.
 */
export function requireWebhookToken(
  event: Parameters<typeof getRequestHeader>[0],
  envName: string,
  provided: string | null | undefined
): void {
  const secret = String(process.env[envName] || '').trim()
  if (!secret) {
    throw createError({ statusCode: 503, statusMessage: `Brak ${envName}.` })
  }
  const given = Buffer.from(String(provided || ''))
  const expected = Buffer.from(secret)
  if (!given.length || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw createError({ statusCode: 401, statusMessage: 'Nieprawidłowy token webhooka.' })
  }
}
