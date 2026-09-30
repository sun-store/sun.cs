import { APP_LOCALES, LOCALES, type AppLocale, type LocaleMessages, isAppLocale } from '~~/shared/locales'

const STORAGE_KEY = 'sun.support.locale'

export function useAppLocale() {
  const locale = useState<AppLocale>('app-locale', () => 'pl')

  const messages = computed(() => LOCALES[locale.value])

  function setLocale(next: AppLocale) {
    locale.value = next
    if (import.meta.client) localStorage.setItem(STORAGE_KEY, next)
  }

  function t<K1 extends keyof LocaleMessages>(
    section: K1,
    key: keyof LocaleMessages[K1]
  ): string {
    const block = messages.value[section] as Record<string, string>
    return block[key as string] || String(key)
  }

  return {
    locale,
    messages,
    setLocale,
    t,
    locales: APP_LOCALES,
    isAppLocale,
    storageKey: STORAGE_KEY
  }
}
