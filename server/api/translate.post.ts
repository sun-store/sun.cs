import { requireUser } from '../utils/session'
import { isAppLocale } from '../../shared/locales'
import { TEXT_LIMITS } from '../../shared/text-bounds'
import {
  TranslateConfigError,
  translateMany,
  translateText
} from '../services/translate'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const body = await readBody<{
    text?: unknown
    texts?: unknown
    targetLocale?: unknown
    sourceLocale?: unknown
  }>(event)

  if (!isAppLocale(body?.targetLocale)) {
    throw createError({ statusCode: 400, statusMessage: 'Nieznany język docelowy (pl|en).' })
  }

  const sourceLocale = body?.sourceLocale === 'pl' || body?.sourceLocale === 'en' || body?.sourceLocale === 'unknown'
    ? body.sourceLocale
    : undefined

  try {
    if (Array.isArray(body?.texts)) {
      const texts = body.texts
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.slice(0, TEXT_LIMITS.body))
        .slice(0, 20)
      const results = await translateMany({ texts, targetLocale: body.targetLocale })
      return { results }
    }

    if (typeof body?.text !== 'string') {
      throw createError({ statusCode: 400, statusMessage: 'Podaj text albo texts.' })
    }
    const result = await translateText({
      text: body.text.slice(0, TEXT_LIMITS.body),
      targetLocale: body.targetLocale,
      sourceLocale
    })
    return result
  } catch (err: unknown) {
    if (err instanceof TranslateConfigError) {
      throw createError({ statusCode: 503, statusMessage: err.message })
    }
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    const message = err instanceof Error ? err.message : 'Nie udało się przetłumaczyć.'
    throw createError({ statusCode: 502, statusMessage: message })
  }
})
