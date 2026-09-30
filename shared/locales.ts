export const APP_LOCALES = ['pl', 'en'] as const
export type AppLocale = typeof APP_LOCALES[number]

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (APP_LOCALES as readonly string[]).includes(value)
}

export type LocaleMessages = {
  nav: {
    tickets: string
    dashboard: string
    results: string
    team: string
    newCase: string
    logout: string
  }
  inbox: {
    title: string
    openSummary: string
    slaPool: string
    slaMet: string
    takeNext: string
    searchPlaceholder: string
    search: string
    clear: string
    loading: string
    emptyQueue: string
    emptySearch: string
    resultsFor: string
    prev: string
    next: string
    allDepartments: string
    myWork: string
    departments: string
    nowHint: string
    unassigned: string
    fullCase: string
    close: string
    transfer: string
    save: string
    leads: string
    department: string
    recentEvents: string
    showThread: string
    replyPlaceholder: string
    send: string
    closeCase: string
    noEvents: string
    sunAgent: string
    refresh: string
    noAi: string
    noSummary: string
    needs: string
    nextStep: string
    draftTitle: string
    reviewBeforeSend: string
    insertDraft: string
    shorter: string
    proposeReply: string
    loadingCase: string
  }
  columns: {
    sla: string
    transaction: string
    category: string
    summary: string
    department: string
    owner: string
    since: string
  }
  queues: {
    now: string
    reply: string
    mine: string
    overdue: string
    unassigned: string
    waiting: string
  }
  departments: {
    cs: string
    logistics: string
    finance: string
    merchant_success: string
    product: string
  }
  translate: {
    showOriginal: string
    showTranslation: string
    translating: string
    failed: string
    toPl: string
    toEn: string
  }
  common: {
    language: string
  }
  dashboard: {
    title: string
    subtitle: string
    open: string
    overdue: string
    dueSoon: string
    unassigned: string
    waitingCustomer: string
    actionsNow: string
    deptSection: string
    topicSection: string
    topicHint: string
    nextStep: string
    dept: string
    topics: string
    allOwned: string
    oldestWaiting: string
    nothingWaiting: string
    monthSection: string
    loading: string
    topTopic: string
    noMonthCases: string
    topicsInMonth: string
    topicsInMonthHint: string
    channelsInMonth: string
    channelsHint: string
    trendTitle: string
    trendHint: string
    openCase: string
  }
}

export const pl: LocaleMessages = {
  nav: {
    tickets: 'Tickety',
    dashboard: 'Dashboard',
    results: 'Wyniki',
    team: 'Zespół',
    newCase: 'Nowa sprawa',
    logout: 'Wyloguj'
  },
  inbox: {
    title: 'Tickety',
    openSummary: 'Niezamknięte',
    slaPool: 'w puli SLA',
    slaMet: 'spełnione',
    takeNext: 'Weź najpilniejszą',
    searchPlaceholder: 'Szukaj: transakcja, mail, nazwa, treść…',
    search: 'Szukaj',
    clear: 'Wyczyść',
    loading: 'Ładowanie…',
    emptyQueue: 'Brak spraw w tej kolejce.',
    emptySearch: 'Brak wyników.',
    resultsFor: 'Wyniki dla',
    prev: 'Poprzednia',
    next: 'Następna',
    allDepartments: 'Wszystkie działy',
    myWork: 'Moja praca',
    departments: 'Działy',
    nowHint: 'odpowiedz, zanim minie czas SLA',
    unassigned: 'nieprzypisana',
    fullCase: 'Pełna',
    close: 'Zamknij',
    transfer: 'Przenieś',
    save: 'Zapisz',
    leads: 'Prowadzi',
    department: 'Dział',
    recentEvents: 'Ostatnie zdarzenia',
    showThread: 'Pokaż całą rozmowę',
    replyPlaceholder: 'Odpowiedź do klienta…',
    send: 'Wyślij',
    closeCase: 'Zamknij sprawę',
    noEvents: 'Brak zdarzeń.',
    sunAgent: 'Sun Agent · Podsumowanie',
    refresh: 'Odśwież',
    noAi: 'Brak klucza AI — ustaw ANTHROPIC_API_KEY lub OPENAI_API_KEY.',
    noSummary: 'Brak podsumowania — kliknij Odśwież.',
    needs: 'Czego potrzebuje',
    nextStep: 'Następny krok',
    draftTitle: 'Propozycja odpowiedzi',
    reviewBeforeSend: 'Sprawdź przed wysłaniem (płatności / faktury / spory).',
    insertDraft: 'Wstaw do odpowiedzi',
    shorter: 'Krócej',
    proposeReply: 'Zaproponuj odpowiedź',
    loadingCase: 'Ładowanie sprawy…'
  },
  columns: {
    sla: 'SLA',
    transaction: 'Transakcja',
    category: 'Temat',
    summary: 'Podsumowanie',
    department: 'Dział',
    owner: 'Prowadzi',
    since: 'Od kiedy'
  },
  queues: {
    now: 'Na teraz',
    reply: 'Do odpowiedzi',
    mine: 'Moje sprawy',
    overdue: 'Po terminie SLA',
    unassigned: 'Nieprzypisane',
    waiting: 'Czeka na klienta'
  },
  departments: {
    cs: 'Support',
    logistics: 'Logistyka',
    finance: 'Finanse',
    merchant_success: 'Merchant Success',
    product: 'Produkt'
  },
  translate: {
    showOriginal: 'Pokaż oryginał',
    showTranslation: 'Pokaż tłumaczenie',
    translating: 'Tłumaczenie…',
    failed: 'Nie udało się przetłumaczyć.',
    toPl: 'PL',
    toEn: 'EN'
  },
  common: {
    language: 'Język'
  },
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Gdzie teraz zalegają sprawy i co z nimi zrobić. Niżej: co wpływa w miesiącu.',
    open: 'Otwarte',
    overdue: 'Po terminie SLA',
    dueSoon: 'SLA mija w ciągu 1 h',
    unassigned: 'Nieprzypisane',
    waitingCustomer: 'Czeka na klienta',
    actionsNow: 'Co trzeba zrobić teraz',
    deptSection: 'Gdzie zalega — działy',
    topicSection: 'Tematy',
    topicHint: 'Temat z tagu HubSpot, a gdy go brak („Other”) — z tematu i treści wiadomości.',
    nextStep: 'Następny krok',
    dept: 'Dział',
    topics: 'Tematy',
    allOwned: 'Wszystkie sprawy mają osobę prowadzącą.',
    oldestWaiting: 'Najdłużej czekają na odpowiedź',
    nothingWaiting: 'Nic nie czeka na naszą odpowiedź.',
    monthSection: 'Co wpływa w miesiącu',
    loading: 'Liczę dashboard…',
    topTopic: 'Najczęstszy temat',
    noMonthCases: 'brak spraw w miesiącu',
    topicsInMonth: 'Tematy w miesiącu',
    topicsInMonthHint: 'Jeden temat na sprawę: z tagu HubSpot, a przy „Other” / bez tagu — z tematu i treści wiadomości.',
    channelsInMonth: 'Kanały w miesiącu',
    channelsHint: 'Skąd przyszły sprawy w tym samym okresie.',
    trendTitle: 'Jak to się zmienia',
    trendHint: 'Ostatnie 6 miesięcy — łączna liczba spraw i najczęstszy temat.',
    openCase: 'otwórz'
  }
}

export const en: LocaleMessages = {
  nav: {
    tickets: 'Tickets',
    dashboard: 'Dashboard',
    results: 'Results',
    team: 'Team',
    newCase: 'New case',
    logout: 'Log out'
  },
  inbox: {
    title: 'Tickets',
    openSummary: 'Open',
    slaPool: 'in SLA pool',
    slaMet: 'met',
    takeNext: 'Take most urgent',
    searchPlaceholder: 'Search: transaction, email, name, body…',
    search: 'Search',
    clear: 'Clear',
    loading: 'Loading…',
    emptyQueue: 'No cases in this queue.',
    emptySearch: 'No results.',
    resultsFor: 'Results for',
    prev: 'Previous',
    next: 'Next',
    allDepartments: 'All departments',
    myWork: 'My work',
    departments: 'Departments',
    nowHint: 'reply before the SLA clock runs out',
    unassigned: 'unassigned',
    fullCase: 'Full',
    close: 'Close',
    transfer: 'Move',
    save: 'Save',
    leads: 'Owner',
    department: 'Department',
    recentEvents: 'Recent events',
    showThread: 'Show full thread',
    replyPlaceholder: 'Reply to customer…',
    send: 'Send',
    closeCase: 'Close case',
    noEvents: 'No events.',
    sunAgent: 'Sun Agent · Summary',
    refresh: 'Refresh',
    noAi: 'No AI key — set ANTHROPIC_API_KEY or OPENAI_API_KEY.',
    noSummary: 'No summary yet — click Refresh.',
    needs: 'Needs',
    nextStep: 'Next step',
    draftTitle: 'Suggested reply',
    reviewBeforeSend: 'Review before sending (payments / invoices / disputes).',
    insertDraft: 'Insert into reply',
    shorter: 'Shorter',
    proposeReply: 'Suggest reply',
    loadingCase: 'Loading case…'
  },
  columns: {
    sla: 'SLA',
    transaction: 'Transaction',
    category: 'Topic',
    summary: 'Summary',
    department: 'Department',
    owner: 'Owner',
    since: 'Open since'
  },
  queues: {
    now: 'Due now',
    reply: 'Needs reply',
    mine: 'My cases',
    overdue: 'Past SLA',
    unassigned: 'Unassigned',
    waiting: 'Waiting on customer'
  },
  departments: {
    cs: 'Support',
    logistics: 'Logistics',
    finance: 'Finance',
    merchant_success: 'Merchant Success',
    product: 'Product'
  },
  translate: {
    showOriginal: 'Show original',
    showTranslation: 'Show translation',
    translating: 'Translating…',
    failed: 'Translation failed.',
    toPl: 'PL',
    toEn: 'EN'
  },
  common: {
    language: 'Language'
  },
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Where cases are stuck now and what to do. Below: what arrived this month.',
    open: 'Open',
    overdue: 'Past SLA',
    dueSoon: 'SLA due within 1 h',
    unassigned: 'Unassigned',
    waitingCustomer: 'Waiting on customer',
    actionsNow: 'What to do now',
    deptSection: 'Backlog by department',
    topicSection: 'Topics',
    topicHint: 'Topic from HubSpot tag; if missing (“Other”) — from subject and message body.',
    nextStep: 'Next step',
    dept: 'Department',
    topics: 'Topics',
    allOwned: 'Every case has an owner.',
    oldestWaiting: 'Longest waiting for a reply',
    nothingWaiting: 'Nothing waiting on our reply.',
    monthSection: 'What arrived this month',
    loading: 'Loading dashboard…',
    topTopic: 'Top topic',
    noMonthCases: 'no cases this month',
    topicsInMonth: 'Topics this month',
    topicsInMonthHint: 'One topic per case: from HubSpot tag, or from subject/body when “Other” / untagged.',
    channelsInMonth: 'Channels this month',
    channelsHint: 'Where cases came from in the same period.',
    trendTitle: 'How it changes',
    trendHint: 'Last 6 months — total cases and top topic.',
    openCase: 'open'
  }
}

export const LOCALES: Record<AppLocale, LocaleMessages> = { pl, en }
