import { timingSafeEqual } from 'node:crypto'

/**
 * Guard dla endpointów crona (wyjątek od requireUser w AGENTS.md).
 * Vercel Cron wysyła `Authorization: Bearer <CRON_SECRET>`, gdy zmienna jest ustawiona w projekcie.
 */
export function requireCron(event: Parameters<typeof getRequestHeader>[0]): void {
  const secret = String(process.env.CRON_SECRET || '').trim()
  if (!secret) {
    throw createError({ statusCode: 503, statusMessage: 'Brak CRON_SECRET.' })
  }
  const given = Buffer.from(getRequestHeader(event, 'authorization') || '')
  const expected = Buffer.from(`Bearer ${secret}`)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw createError({ statusCode: 401, statusMessage: 'Nieprawidłowy sekret crona.' })
  }
}
