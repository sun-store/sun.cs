# KPI Customer Support — co liczymy, skąd to bierzemy i czego wymagamy od nowego systemu

Stan na 24.09.2026. Podstawa: raporty za czerwiec–sierpień 2026 i cztery naprawione błędy
liczenia. Pełna metodyka: skill `cs-kpi-report`.

---

## Część 1. Co dokładnie liczymy

Pięć wskaźników z polityki premiowej (5 × 20%) plus jeden nowy cel rozwojowy.

### 1. FCR — rozwiązanie przy pierwszym kontakcie · cel ≥ 50%

Zgłoszenie liczy się jako FCR, gdy **jednocześnie**:
- zostało zamknięte w ciągu **4 godzin zegarowych** od utworzenia, **oraz**
- 8-znakowy identyfikator transakcji z nazwy zgłoszenia jest **unikalny w całej bazie**
  (czyli klient nie wrócił z tą samą sprawą). Brak ID transakcji → warunek spełniony.

Liczone na zgłoszeniach **zamkniętych w miesiącu**. Wykluczenie: rekordy z datą zamknięcia
wcześniejszą niż data utworzenia (błąd źródła).

### 2. SLA — czas pierwszej odpowiedzi · cel ≥ 90%

Czas od utworzenia zgłoszenia do pierwszej odpowiedzi agenta, liczony **wyłącznie w godzinach
pracy 9:00–17:00, pon–pt, czasu lokalnego Europe/Warsaw**.

| Kanał | Próg |
|---|---|
| Czat | 30 min |
| E-mail | 2 h |

Telefon i formularz są poza wskaźnikiem nagłówkowym (telefon ma osobną, przybliżoną zakładkę).

**Trzy wykluczenia z puli:**
1. Zgłoszenia utworzone **poza godzinami pracy** — wypadają całkowicie, nie są liczone z korektą.
2. Zgłoszenia utworzone **po 16:30** — zegar startuje od 9:00 następnego dnia roboczego,
   bo nie ma realnej szansy na 30-minutową odpowiedź.
3. **Niewiarygodne pierwsze odpowiedzi** — zgłoszenie zamknięte *zanim* system zapisał pierwszą
   odpowiedź. Agent nie domyka sprawy przed pierwszą reakcją, więc pole złapało późniejszą
   wiadomość. Dotyczy ~6% zgłoszeń.

### 3. CSAT · cel ≥ 80%

`Happy / wszystkie odpowiedzi`, skala: 0 = Unhappy, 1 = Neutral, 2 = Happy.
Liczy się **tylko ankieta „CSAT – Email & Phone"**. Ankieta czatowa jest **wyłączona z premii**
(ocenia bota albo są to testy wewnętrzne). Filtrowane po **dacie odpowiedzi na ankietę**.

⚠️ Próbka to zwykle 10–15 odpowiedzi. Jedna ocena przesuwa wynik o kilkanaście punktów
procentowych i potrafi przeważyć o premii.

### 4. Retencja · cel ≥ 50%

Firma powiązana ze zgłoszeniem ma **opłaconą transakcję w ciągu 30 dni kalendarzowych
(rolling)** od zamknięcia zgłoszenia. Liczone tylko okna **zamknięte** (zamknięcie + 30 dni
≤ dziś); okna trwające raportowane osobno jako „+N otwartych".

Zawsze **skumulowanie marzec–bieżący miesiąc**, nigdy za pojedynczy miesiąc — okno 30-dniowe
sierpnia dojrzewa dopiero we wrześniu, więc liczone za sam miesiąc dawałoby ~0%.

### 5. QA · cel ≥ 90%

`Kategoria wypełniona` **AND** `Priorytet wypełniony` **AND** (zgłoszenie zamknięte **OR**
ostatni kontakt ≤ 7 dni kalendarzowych temu). Liczone na **wszystkich** zgłoszeniach okresu.

To automatyczny **proxy** — polityka mówi o ręcznej kontroli jakości. Mierzy w praktyce
higienę danych, nie jakość merytoryczną odpowiedzi.

### 6. Udział spraw rozwiązanych przez agenta AI · nowy cel (baseline 73,5%)

Mianownik: rozmowy produkcyjne, w których klient napisał coś realnego (bez pustych sesji
i wiadomości testowych). Licznik: rozmowy, w których bot odpowiedział, **człowiek nie wszedł**
i **klient nie został bez odpowiedzi na końcu**.

Świadomie odrzucona miara alternatywna: „containment surowy" (wszystko, czego człowiek nie
dotknął) = 83,9%. Nagradza bota za to, że klient się poddał i wyszedł.

### Premia

```
realizacja = wynik / cel
< 50%      → 0 z 20 pkt
50–100%    → liniowo: (realizacja − 0,5) / 0,5
> 100%     → 100% (sufit — to ZAŁOŻENIE, polityka tego nie precyzuje)
```

### Filtry wspólne

Agenci z < 5 zgłoszeniami w okresie nie wchodzą do tabeli. Wykluczeni właściciele:
`Deactivated`, `sunstore Agent`, `HubSpot Customer Agent` (boty).

---

## Część 2. Skąd się to bierze dzisiaj

| Źródło | Co daje | Sposób pozyskania |
|---|---|---|
| `tickets/all-tickets.csv` | baza zgłoszeń do 29.06.2026 (3 559) | ręczny eksport HubSpot |
| `deals/all-deals.csv` | baza transakcji (22 637 opłaconych, 233 MB) | ręczny eksport HubSpot |
| BigQuery `sun-store-bq.hubspot` | przyrost od 29.06 do dziś | zapytania SQL, delty kumulowane |
| `hubspot-crm-exports-csat-*.csv` | ankiety CSAT | **ręczny eksport przy każdym odświeżeniu** |
| `all_transcripts.md` | rozmowy WhatsApp | eksport zewnętrzny |
| `conversations-*.json` | rozmowy agenta AI | eksport z Customer Chat 2.0 |
| `sun-store-bq.production.users` | podział kupujący / sprzedawca | pole `seller_status` |

Model „baza + delta": eksport CSV z 29.06 jest zamrożony, z BigQuery ciągniemy tylko to, co się
zmieniło, i nakładamy (klucz = id, nowszy rekord wygrywa). Przetwarzanie: pipeline Node.js
w `cs_july_work/node`, wynik to plik Excel.

**To jest konstrukcja zastępcza.** Powstała dlatego, że HubSpot nie dostarcza tych danych
w formie nadającej się do liczenia — i właśnie te braki są listą wymagań dla nowego systemu.

---

## Część 3. Czego brakuje w obecnych danych

To jest najważniejsza część tego dokumentu. Każdy punkt to realna luka, którą dziś obchodzimy
obejściem — i którą nowy system powinien zamknąć u źródła.

| # | Problem | Skutek dzisiaj |
|---|---|---|
| 1 | `first_contact_at` **puste w 100%** | Moment kontaktu klienta przybliżamy datą utworzenia zgłoszenia. |
| 2 | `first_agent_reply_date` łapie **późniejszą** wiadomość, gdy agent goni sprzedawcę | ~6% zgłoszeń trzeba wykluczyć z SLA. |
| 3 | Dla **czatu** pole pierwszej odpowiedzi jest zapisywane rzadko | Do puli SLA trafia 7 czatów na 150 spraw — wynik czatu jest statystycznie bezużyteczny. |
| 4 | Natywny status SLA działa dla **~4%** zgłoszeń | Liczymy SLA własną metodą od zera. |
| 5 | `hs_inbound_call_answer_status` **puste w 100%** | Nie wiadomo, czy połączenie zostało odebrane. |
| 6 | Powiązanie połączenie → zgłoszenie: **88 z 36 406** | SLA telefoniczne liczone per połączenie, tylko jako przybliżenie. |
| 7 | `engagements_emails` w BigQuery **kończy się ~lipiec 2025** | Treści maili niedostępne do analizy. |
| 8 | Eksporty CSAT **nie mają kolumny `Ticket id`** | Wiązanie z agentem po e-mailu kontaktu i nazwisku — zawodne. |
| 9 | Jedna ankieta CSAT miesza rozmowy bota i człowieka | Musieliśmy wyłączyć CSAT czatowy z premii. |
| 10 | `related_transaction_id` **puste** | ID transakcji wyciągamy **regexem z nazwy zgłoszenia**. |
| 11 | `updatedAt` zmienia się codziennie dla 89% rekordów | Bezużyteczne jako znacznik przyrostu; filtrujemy po polach biznesowych. |
| 12 | Brak roli klienta na kontakcie | ~33% zgłoszeń nie da się przypisać do kupującego / sprzedawcy. |
| 13 | Znaczniki w UTC, interfejs w czasie lokalnym | **To był realny błąd** — godziny pracy porównywaliśmy z surowym UTC. |
| 14 | Eksport CSV ma precyzję do minuty | Wszystkie różnice czasów są wielokrotnością 60 s. |

---

## Część 4. Wymagania wobec nowego systemu

Uporządkowane wg tego, ile odblokowują. Punkty 1–5 są warunkiem, żeby KPI dały się liczyć
bez obejść; 6–10 podnoszą jakość; 11–13 dotyczą dostępu do danych.

### Musi mieć

**1. Znacznik pierwszego kontaktu klienta, osobno od utworzenia rekordu.**
Moment, w którym klient napisał lub zadzwonił — nie moment, w którym system założył sprawę.
To jest początek zegara SLA i dziś go nie mamy. *(Zamyka #1)*

**2. Pierwsza odpowiedź agenta jako znacznik niemodyfikowalny, z rozróżnieniem adresata.**
Musi zapisywać *pierwszą wiadomość wysłaną do zgłaszającego* i nie może być nadpisywana przez
późniejsze wiadomości ani przez korespondencję z osobą trzecią (np. ponaglenie sprzedawcy).
Minimum: flaga `kierunek` (do klienta / do sprzedawcy / wewnętrzna) na każdej wiadomości.
*(Zamyka #2, #3)*

**3. Kalendarz godzin pracy jako konfiguracja systemu, nie założenie w raporcie.**
Strefa `Europe/Warsaw` z obsługą czasu letniego, okno 9:00–17:00, dni robocze, **oraz dni wolne
ustawowo** (dziś ich nie uwzględniamy w ogóle). System powinien sam liczyć czas roboczy między
dwoma znacznikami. *(Zamyka #13, usuwa całą klasę błędów)*

**4. Kanał obowiązkowy na każdej rozmowie, ze spójnym słownikiem.**
Czat / e-mail / telefon / WhatsApp / formularz. Dziś część rekordów ma kanał pusty, a progi SLA
są per kanał.

**5. Kategoria i priorytet wymagane przed zamknięciem sprawy.**
To jednym ruchem załatwia wskaźnik QA — przestaje być miarą higieny danych i albo znika,
albo można go zastąpić realną kontrolą jakości merytorycznej.

### Powinien mieć

**6. Ankieta satysfakcji powiązana twardo ze zgłoszeniem i z agentem.**
Klucz obcy do zgłoszenia i do użytkownika, nie dopasowywanie po adresie e-mail.
*(Zamyka #8)*

**7. Rozdzielenie ankiet: rozmowa obsłużona przez bota vs przez człowieka.**
Bez tego nie da się postawić bezpiecznika jakościowego przy celu AI — a bez bezpiecznika cel
da się ugrać, każąc botowi przestać eskalować. *(Zamyka #9)*

**8. Atrybucja nadawcy na poziomie pojedynczej wiadomości: bot / agent / system / klient.**
Wtedy udział spraw rozwiązanych przez agenta AI liczy się natywnie, a nie z osobnych
eksportów JSON o niepełnym pokryciu dni.

**9. Połączenia telefoniczne powiązane ze zgłoszeniem, ze statusem odebrania.**
Dziś powiązanie istnieje dla 0,24% połączeń, a status jest pusty. Bez tego telefon nigdy nie
wejdzie do wskaźnika nagłówkowego, mimo że polityka premiowa go wymaga. *(Zamyka #5, #6)*

**10. Identyfikator transakcji jako pole strukturalne na zgłoszeniu.**
Dziś wyciągamy go wyrażeniem regularnym z tytułu. Pole wymagane wszędzie tam, gdzie sprawa
dotyczy transakcji. *(Zamyka #10, poprawia FCR i retencję)*

**11. Rola klienta (kupujący / sprzedawca) dostępna na kontakcie.**
Dziś ~33% zgłoszeń jest nieklasyfikowalnych, a różnica jest ogromna: retencja kupujących 30%
vs sprzedawców 71%. *(Zamyka #12)*

### Dostęp do danych

**12. API lub eksport przyrostowy ze znacznikiem, który zmienia się tylko przy zdarzeniu
biznesowym.** Nie „dotknięty dzisiaj". Bez tego każde odświeżenie wymaga ręcznego doboru
predykatów. *(Zamyka #11)*

**13. Pełna precyzja znaczników czasu (sekundy) i jawna strefa w każdym eksporcie.**
*(Zamyka #14)*

**14. Stabilny eksport ankiet i rozmów bota bez limitu okna.**
Eksporty rozmów agenta AI bywają ucięte — w sierpniu brakowało pięciu dni i trzeba było scalać
cztery pliki po ID wątku, żeby dostać wiarygodny baseline.

---

## Część 5. Co się zmieni w liczeniu, gdy te wymagania zostaną spełnione

| KPI | Dziś | Po wdrożeniu |
|---|---|---|
| FCR | ID transakcji z regexu z tytułu | pole strukturalne — mniej fałszywych trafień |
| SLA | 3 wykluczenia (poza godzinami, po 16:30, niewiarygodna odpowiedź), czat praktycznie poza pulą | zostaje 1 wykluczenie (poza godzinami); **czat realnie wchodzi do wskaźnika** |
| CSAT | wiązanie po e-mailu, czat wyłączony z premii | wiązanie po kluczu; czat **może wrócić** do premii, rozdzielony bot/człowiek |
| Retencja | bez zmian | bez zmian (liczona z transakcji, nie ze zgłoszeń) |
| QA | proxy: czy pola są wypełnione | pola wymagane systemowo → wskaźnik traci sens jako KPI, **zastąpić realną kontrolą jakości** |
| Telefon | osobna zakładka, przybliżenie per połączenie | wchodzi do wskaźnika nagłówkowego, zgodnie z polityką premiową |
| Agent AI | osobne eksporty JSON, niepełne pokrycie dni | liczone natywnie z atrybucji wiadomości |

**Uwaga do decyzji:** jeśli punkt 5 (kategoria i priorytet wymagane) zostanie wdrożony, QA jako
KPI premiowy przestaje mierzyć cokolwiek — wszyscy będą mieli 100%. Trzeba wtedy albo zastąpić
go ręczną kontrolą jakości merytorycznej (co przewiduje oryginalna polityka premiowa), albo
przesunąć wagę 20% na inny wskaźnik.
