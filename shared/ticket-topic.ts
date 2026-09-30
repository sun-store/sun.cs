/**
 * Temat sprawy: czytelna etykieta z tagu HubSpot albo z tematu/treści.
 * Zastępuje „Inne” / „Bez kategorii” na liście i w dashboardzie.
 * Liczony przy odczycie (bez kolumny w bazie), więc poprawka reguł działa od razu na starych sprawach.
 */

export const TOPICS = [
  'rfq',
  'b2c',
  'order_change',
  'payment',
  'payout',
  'invoice',
  'sun_finance',
  'delivery',
  'unresponsive',
  'complaint',
  'account',
  'listing',
  'how_to',
  'fees_vat',
  'fraud',
  'partnership',
  'bug',
  'junk',
  'unknown'
] as const
export type Topic = typeof TOPICS[number]

export const TOPIC_LABELS: Record<Topic, string> = {
  rfq: 'Zapytanie ofertowe',
  b2c: 'Poza grupą docelową (B2C, spoza UE)',
  order_change: 'Anulowanie / zmiana zamówienia',
  payment: 'Płatność kupującego',
  payout: 'Wypłata dla sprzedawcy',
  invoice: 'Faktura',
  sun_finance: 'sun.finance (finansowanie)',
  delivery: 'Dostawa / przesyłka',
  unresponsive: 'Kontakt z drugą stroną transakcji',
  complaint: 'Reklamacja / szkoda / zwrot',
  account: 'Konto i dane firmy',
  listing: 'Oferty i katalog sprzedawcy',
  how_to: 'Jak korzystać z platformy',
  fees_vat: 'Opłaty, VAT, regulamin',
  fraud: 'Bezpieczeństwo i wiarygodność',
  partnership: 'Współpraca / nowy dostawca',
  bug: 'Błąd lub sugestia',
  junk: 'Duplikat / spam / test',
  unknown: 'Do rozpoznania'
}

/** Co zrobić z taką sprawą — pokazywane w dashboardzie przy zaległościach. */
export const TOPIC_NEXT_STEP: Record<Topic, string> = {
  rfq: 'Sprawdź, czy produkt jest w ofertach; odeślij link albo przekaż zapytanie do sprzedaży.',
  b2c: 'Odpisz szablonem (tylko firmy z UE) i zamknij sprawę.',
  order_change: 'Sprawdź status transakcji; jeśli nie wysłana, uzgodnij ze sprzedawcą i potwierdź klientowi.',
  payment: 'Sprawdź płatność w Stripe / na koncie i potwierdź klientowi, co dalej.',
  payout: 'Sprawdź status wypłaty w Finansach i podaj sprzedawcy datę.',
  invoice: 'Ustal, kto wystawia fakturę (sprzedawca czy sun.store), i dośli ją albo poproś sprzedawcę.',
  sun_finance: 'Przekaż do Finansów (limit, wniosek, spłata) i daj klientowi termin odpowiedzi.',
  delivery: 'Sprawdź tracking / DBSS i podaj klientowi status z datą.',
  unresponsive: 'Zadzwoń do drugiej strony; brak odpowiedzi w 24 h → eskaluj do Merchant Success.',
  complaint: 'Zbierz zdjęcia i numer transakcji, otwórz claim u sprzedawcy lub przewoźnika.',
  account: 'Sprawdź konto w panelu admina: weryfikacja, blokada, zmiana danych.',
  listing: 'Pomóż z ofertą; brak produktu w katalogu zgłoś do Produktu.',
  how_to: 'Odpisz z instrukcją lub linkiem do pomocy.',
  fees_vat: 'Odpisz z linkiem do cennika / regulaminu; sprawy VAT do Finansów.',
  fraud: 'Przy podejrzeniu oszustwa nic nie zmieniaj, zweryfikuj tożsamość telefonicznie i zgłoś do Finansów; pytanie o wiarygodność: sprawdź historię sprzedawcy i odpisz.',
  partnership: 'Przekaż do Merchant Success i daj znać, kto się odezwie.',
  bug: 'Opisz kroki i zrzut ekranu, zgłoś do Produktu.',
  junk: 'Zamknij bez odpowiedzi (przy duplikacie podlinkuj oryginał).',
  unknown: 'Przeczytaj sprawę i ustaw temat — to jedyna sprawa, której system nie rozpoznał.'
}

/** Tag HubSpot → temat. Tagi „Other” i puste są pomijane (temat z treści). */
const HUBSPOT_TOPIC: Record<string, Topic> = {
  'dbss issue': 'delivery',
  'logistics issue': 'delivery',
  'claim': 'complaint',
  'sun.finance': 'sun_finance',
  'no vat': 'fees_vat',
  'lost on platform': 'how_to',
  'offer request': 'rfq',
  'unresponsive seller': 'unresponsive',
  'stripe payment issue': 'payment',
  'stripe': 'payment',
  'invoices': 'invoice',
  'data change': 'account',
  'bug': 'bug',
  'feature request': 'bug',
  'spam': 'junk'
}

/**
 * Kolejność ma znaczenie: pierwsze trafienie wygrywa (od najbardziej konkretnych).
 * Tekst jest wcześniej sprowadzany do ASCII (bez polskich znaków), bo notatki agentów często ich nie mają.
 */
const RULES: Array<[Topic, RegExp]> = [
  ['junk', /\[test\]|duplikat|zdubl|zdubow|dublowan|duplicate|off-topic|internship|greeting|inactive session|^ticket #\d+$/i],
  ['fraud', /fraud|impersonat|oszust|podejrzan|suspicious|phishing|scam|wiarygodn|rzeteln|trustworth|legit/i],
  ['b2c', /\bb2c\b|private (individual|person)|osoba (fizyczna|prywatna)|without (a )?vat( number)?|bez (nip|vat)|senza partita iva|vendita a privati|personal purchase|residential|non-eu/i],
  ['order_change', /cancel|anul|annul|stornier|abbrechen|abgebrochen|change (the )?(deliver|order)|delivery addres?s change|zmian[aey] adresu|exw pickup|oddac towar|zwrot towaru|pomylil|increase to \d+/i],
  ['payout', /payout|wyplat|pay-?out|auszahlung|transferred to (their|our) (company )?bank/i],
  ['sun_finance', /sun\.?\s*finance|credit line|limit check|\bsf\d\b/i],
  ['invoice', /invoic|faktur|rechnung|fattura|factura|racun/i],
  ['unresponsive', /unresponsive|not respond|no response|nie odpowiad|brak odpowiedzi|nie odzywa|seller refuses|sprzedawca odmawia|prosi o kontakt|kontakt z (klient|kupuj|sprzedaw)|nie potwierdzil|nie odbiera|chce dane kupujacego/i],
  ['complaint', /\bclaim\b|complaint|reklamac|damaged|uszkodz|refund|zwrot|nie dostal/i],
  ['payment', /stripe|payment|platno|zaplac|paiement|pagamento|pago\b|escrow|secure pay|how to pay|hajs dotar|bank account assignment|wplat|rachunk|rachunek bankow/i],
  ['delivery', /deliver|dostaw|dostarcz|shipping|shipment|przesylk|tracking|\bcmr\b|dbss|pickup|odbior|spedizion|transport|lieferung|label|zaladun|magazynu/i],
  ['account', /account|konto|konta|registr|rejestr|rejtr|verif|weryfik|log ?in|zugang|password|haslo|permission|blocked|zablokowan|obstruido|data change|zmiana danych|email verification|uzytkownik|adres mail/i],
  ['listing', /\boffers? (change|draft)|draft offer|save button|catalog|katalog|nomenklatur|nomenclature|matching|stock location|warehouse|api integration|nazwy kategorii|update the price|publish/i],
  ['partnership', /become (a )?(supplier|seller|partner)|distributor|chce sprzedawa|wants to sell|partnership|wspolprac|b2b sales inquiry|hold hundreds of units/i],
  ['fees_vat', /\bfees?\b|oplat|prowizj|commission|\bvat\b|regulamin|terms and conditions|\bt&c\b|incoterms/i],
  ['rfq', /\brfq\b|quote|quotation|wycen|zapytanie ofertowe|ofert|\d+ ?szt\b|price|precio|prezzo|\bcena\b|cene|consulta|product enquiry|sun\.store\/\w+\/(product|offer)\/|szuka|looking for|kupic|buying|\d\s?(mw|kw)\b|panels?|inverter|falownik|magazyn energii|battery|bateri|specifying/i],
  ['how_to', /how (to|do)|jak |where (is|can)|gdzie|navigation|faq|onboarding|grise|greyed|help with|enquiry|inquiry|zapytanie|question|pytanie|pyta /i]
]

/** Małe litery, bez znaków diakrytycznych (ł → l), pojedyncze spacje. */
function asciiFold(value: string): string {
  return value
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export type TopicInput = {
  sourceCategory?: string | null
  subject?: string | null
  text?: string | null
}

function hubspotTopic(sourceCategory: string | null | undefined): Topic | null {
  if (!sourceCategory) return null
  for (const raw of sourceCategory.split(/[;,|]/)) {
    const topic = HUBSPOT_TOPIC[raw.trim().toLowerCase()]
    if (topic) return topic
  }
  return null
}

/** True gdy brak konkretnego tagu HubSpot — wtedy temat idzie z subject/treści. */
export function needsTopicText(sourceCategory: string | null | undefined): boolean {
  return hubspotTopic(sourceCategory) == null
}

/** Temat z tekstu. Bez podglądu tekstu zwraca „unknown”. */
export function topicFromText(subject: string | null | undefined, text: string | null | undefined): Topic {
  // Temat maila HubSpota „Conversation from Inbox (x@y)” nic nie mówi — patrzymy wtedy tylko na treść.
  const cleanSubject = (subject || '').replace(/conversation from inbox \([^)]*\)/i, '').trim()
  const blob = asciiFold(`${cleanSubject}\n${text || ''}`)
  if (!blob) return 'unknown'
  for (const [topic, pattern] of RULES) {
    if (pattern.test(blob)) return topic
  }
  return 'unknown'
}

/** Tag HubSpot wygrywa, jeśli jest konkretny; inaczej temat z tematu/treści. */
export function ticketTopic(input: TopicInput): Topic {
  return hubspotTopic(input.sourceCategory) ?? topicFromText(input.subject, input.text)
}

export function topicLabel(topic: Topic): string {
  return TOPIC_LABELS[topic]
}

/** Sprawa zamknięta przez Sun Agenta na czacie (nie wymaga człowieka). */
export function isAgentClosedText(text: string | null | undefined): boolean {
  return /case closed by the agent/i.test(text || '')
}
