import { LOCALES, type AppLocale, type LocaleMessages, isAppLocale } from './locales'

export function messagesFor(locale: AppLocale): LocaleMessages {
  return LOCALES[locale]
}

/** Prosta detekcja języka treści (pl vs en) — heurystyka, nie model. */
export function detectTextLocale(text: string): AppLocale | 'unknown' {
  const sample = text.trim().slice(0, 800)
  if (!sample) return 'unknown'
  const plMarks = (sample.match(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g) || []).length
  const plWords = (sample.match(/\b(nie|jest|proszę|dzień|dziękuję|zamówienie|sprzedawca|kupujący)\b/gi) || []).length
  const enWords = (sample.match(/\b(the|and|please|thanks|order|seller|buyer|hello|could)\b/gi) || []).length
  if (plMarks >= 2 || plWords >= 2) return 'pl'
  if (enWords >= 2) return 'en'
  if (plMarks > 0 || plWords > 0) return 'pl'
  if (enWords > 0) return 'en'
  return 'unknown'
}

export function resolveAppLocale(value: unknown, fallback: AppLocale = 'pl'): AppLocale {
  return isAppLocale(value) ? value : fallback
}
