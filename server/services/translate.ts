import { generate, hasAiConfig } from './ai'
import { detectTextLocale } from '../../shared/locale'
import type { AppLocale } from '../../shared/locales'
import { TEXT_LIMITS, boundedText } from '../../shared/text-bounds'

export class TranslateConfigError extends Error {
  constructor(message = 'Tłumaczenie wymaga klucza AI (ANTHROPIC_API_KEY lub OPENAI_API_KEY).') {
    super(message)
    this.name = 'TranslateConfigError'
  }
}

export type TranslateResult = {
  text: string
  sourceLocale: AppLocale | 'unknown'
  targetLocale: AppLocale
}

const cache = new Map<string, TranslateResult>()

function cacheKey(text: string, target: AppLocale): string {
  return `${target}:${text.slice(0, 2000)}`
}

export async function translateText(input: {
  text: string
  targetLocale: AppLocale
  sourceLocale?: AppLocale | 'unknown'
}): Promise<TranslateResult> {
  if (!hasAiConfig()) throw new TranslateConfigError()
  const text = boundedText(input.text, TEXT_LIMITS.body, 'Tekst')
  if (!text) {
    return { text: '', sourceLocale: 'unknown', targetLocale: input.targetLocale }
  }

  const sourceLocale = input.sourceLocale && input.sourceLocale !== 'unknown'
    ? input.sourceLocale
    : detectTextLocale(text)

  if (sourceLocale === input.targetLocale) {
    return { text, sourceLocale, targetLocale: input.targetLocale }
  }

  const key = cacheKey(text, input.targetLocale)
  const hit = cache.get(key)
  if (hit) return hit

  const targetName = input.targetLocale === 'pl' ? 'Polish' : 'English'
  const raw = await generate({
    system: `You are a translation engine for sun.support customer service.
Translate the user message into ${targetName}.
Return ONLY the translation, no quotes, no commentary.
Keep names, transaction IDs, URLs, emails and placeholders like [DATA] unchanged.
Do not invent facts.`,
    messages: [{ role: 'user', content: text.slice(0, 8000) }],
    maxTokens: 2000
  })

  const result: TranslateResult = {
    text: raw.trim(),
    sourceLocale,
    targetLocale: input.targetLocale
  }
  if (cache.size > 200) cache.clear()
  cache.set(key, result)
  return result
}

export async function translateMany(input: {
  texts: string[]
  targetLocale: AppLocale
}): Promise<TranslateResult[]> {
  const unique = [...new Set(input.texts.map(t => t.trim()).filter(Boolean))]
  const map = new Map<string, TranslateResult>()
  for (const text of unique.slice(0, 20)) {
    map.set(text, await translateText({ text, targetLocale: input.targetLocale }))
  }
  return input.texts.map((text) => {
    const trimmed = text.trim()
    return map.get(trimmed) || {
      text,
      sourceLocale: 'unknown' as const,
      targetLocale: input.targetLocale
    }
  })
}
