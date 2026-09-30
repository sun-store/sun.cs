# Wdrożenie: widok pracy na sprawach

Stan na 30.09.2026. Specyfikacja dla agenta (Cursor) i dla zespołu.  
Wzór UI: klikalny prototyp „sun.support widok pracy” (artefakt Martyny).  
Zasady: `AGENTS.md`, `.cursor/rules/` (bezpieczeństwo, lint, Socket `sfw npm`, brand).

**Cel:** każdy dział ma swój widok; Support i admin widzą wszystko i kto prowadzi sprawę; agent zawsze wie, na co odpowiedzieć teraz, żeby zdążyć przed końcem SLA; Sun Agent daje podsumowanie i szkic odpowiedzi.

**Nazwy działów w kodzie** (enum): `cs` | `logistics` | `finance` | `merchant_success` | `product`.  
W UI: Support, Logistyka, Finanse, Merchant Success, Produkt. (`cs` = Support, nie string `support`.)

---

## Co już jest (nie robić drugi raz)

| Element | Gdzie |
| --- | --- |
| `tickets.department` + migracja | `neon/migrations/0007_ticket_department.sql`, `shared/departments.ts` |
| Zmiana działu z wpisem systemowym | `updateTicket` → `Dział: X → Y` na osi |
| Stronicowanie listy | `page` / `pageSize`, UI nad tabelą |
| Filtry właściciela | `ownerId=mine\|unassigned\|all` |
| Filtr działu (query) | `department=` na `GET /api/tickets` |
| Logowanie agentów | odblokowane w `requireUser` (po allowliście) |
| Maile zespołu usunięte z kodu | `DEFAULT_CS_TEAM = []`, lista w bazie `/team` |
| Klasyfikacja kategorii | `shared/classify-ticket.ts`, skrypt `scripts/reclassify-other.mjs` |
| Lista: transakcja · kategoria HubSpot · dział · od kiedy · podsumowanie · właściciel | `app/pages/index.vue` |
| Panel „Przenieś do działu” w sprawie | `app/pages/tickets/[id].vue` |

**Częściowo / na branchu (sprawdzić merge na `main` przed dalszą robotą):**

| Element | Stan |
| --- | --- |
| `staff.department` + `/team` + domyślny filtr UI | branch `cursor/staff-department` (`0008_staff_department.sql`) — **zmergować PR przed pkt 2** |
| `emailAndPassword.disableSignUp: true` | **zrobione** w `server/services/auth.ts` (hasło). SSO ma `disableSignUp: false` przy providerze — nowe konta tylko przez SSO + allowlista |
| Status klient → `open`, agent do klienta → `waiting` | **zrobione** w `addEvent` (`tickets.ts`) — dopisać test, jeśli brakuje |

---

## Kolejność prac

**1 → 2 → 3** są warunkiem dla reszty. **4–7** można robić równolegle po 3.  
AI (pkt 6) na końcu, jeśli produkt tak ustali — ale kontrakt API i kolumny `ai_*` warto przewidzieć w migracji z pkt 3/5.

Przed oddaniem każdej części: `sfw npm run lint`, `sfw npm run typecheck`, `sfw npm test`.

---

## 1. Blokery (przed wpuszczeniem działów)

### 1.1 Rejestracja na hasło

- [x] `server/services/auth.ts`: `emailAndPassword.disableSignUp: true`.
- [ ] Potwierdzić na gałęzi, z której buduje Vercel (`main`): w logach / kodzie produkcji jest `disableSignUp: true` dla hasła.
- [ ] Opcjonalnie: przegląd tabeli `account` pod `providerId = 'credential'` (cudze konta z okresu luki).

### 1.2 Status po wiadomości

- [x] Wiadomość **od klienta** (`sender_type = customer`) → `status = open`.
- [x] Odpowiedź agenta/bota **do klienta** → `status = waiting`.
- [x] Notatka / wiadomość do sprzedawcy **nie zmienia** statusu.
- [x] Test: `shared/ticket-status.test.ts`.

**Kryterium:** klient pisze w sprawie „Czeka” → lista „Otwarte” / kolejka „Do odpowiedzi” znów ją pokazuje.

---

## 2. Kto co widzi (dostęp po dziale)

Obecnie `accessSql` ogranicza **agenta** do `owner_id = agentId`. Docelowo ogranicza **dział**, nie właściciela.

### 2.1 Pole działu na pracowniku

- [x] `staff.department` + `allowlist.department` + `/team` (branch `cursor/staff-department`, migracja `0008`).
- [ ] Zmergować na `main` / Vercel przed wpuszczeniem działów spoza Support.

### 2.2 `accessSql` (przepisać)

- [x] `resolveTicketAccess` w `shared/access.ts`: admin/lead/`cs` → wszystko; inny dział → `t.department = …`; **bez** filtra `owner_id` dla agentów.
- [x] `TicketActor.department` w handlerach API.
- [x] Testy: support-agent, logistics-agent, transfer logistics→finance.

**Kryterium odbioru:** osoba z logistyki widzi tylko Logistykę; po przeniesieniu do Finansów przestaje ją widzieć. Admin i Support widzą wszystkie i kolumnę „Prowadzi”.

---

## 3. Czas do SLA na każdą odpowiedź

KPI pierwszej odpowiedzi (`shared/sla.ts`) **bez zmian**.  
Dodatkowo: operacyjny termin odpowiedzi na **każdą** wiadomość klienta.

### 3.1 Schema

- [x] Migracja `0009_ticket_awaiting_reply.sql`: `awaiting`, `reply_due_at`, indeks, backfill otwartych.

### 3.2 Logika w `addEvent`

- [x] Klient → `awaiting=us` + `reply_due_at` (godziny pracy, `shared/reply-clock.ts` + `addBusinessMilliseconds`).
- [x] Agent/bot do klienta → `awaiting=customer`, `reply_due_at=null`.
- [x] Test: piątek 16:30 + 2 h → poniedziałek 10:30.

**Kryterium:** mail klienta 10:00 → w „Na teraz” najpóźniej do 12:00 okna SLA; po przekroczeniu `reply_due_at` → „Po terminie SLA”.

---

## 4. Kolejki (lewa kolumna) i tabela

### 4.1 API

- [x] Parametr `queue` w `GET /api/tickets` (obok `department`, `status`, stronicowania).
- [x] `GET /api/tickets/counts` — jedno zapytanie z `count(*) filter (where …)` dla lewej kolumny; `requireUser` + ten sam `accessSql` co lista.
- [x] Odświeżanie liczników w UI co **60 s** (bez toastów / pushy o nowych sprawach).

| Kolejka (`queue`) | Warunek | Sortowanie |
| --- | --- | --- |
| `now` (domyślna) | `awaiting='us'` i `now() <= reply_due_at <= now() + 60 min` | `reply_due_at` ASC |
| `todo` | `awaiting='us'`, status ≠ closed | `reply_due_at` ASC |
| `mine` | `owner_id = ja`, status ≠ closed | `reply_due_at` ASC NULLS LAST |
| `overdue` | `awaiting='us'` i `reply_due_at < now()` | `reply_due_at` ASC |
| `unassigned` | `owner_id is null`, status ≠ closed | `reply_due_at` ASC |
| `waiting_customer` | `awaiting='customer'`, status ≠ closed | `business_changed_at` DESC |

Filtr działu (osobny select / sekcja): `all` | `cs` | `logistics` | `finance` | `merchant_success` | `product` — w granicach dostępu z pkt 2. Sort jak „Do odpowiedzi”.

Zastąp / wchłoń stare `ownerId=mine|unassigned` w spójny `queue` (albo mapuj stare query na nowe dla kompatybilności przez jeden release).

### 4.2 Kolumny tabeli (kolejność)

| Kolumna | Treść |
| --- | --- |
| SLA | „zostało 25 min” / „po terminie 40 min” / „czeka na klienta”. Czarny = po terminie; żółty `#F6D736` gdy ≤ 30 min; szary body `#727487` w pozostałych |
| Transakcja | `related_transaction_id` (do 8 znaków widocznych) albo „—” |
| Kategoria | **jedna** główna etykieta (pierwsza z HubSpot); pełna lista w panelu sprawy |
| Podsumowanie · Sun Agent | `ai_summary`, maks. 2 linie; bez AI: temat bez URL i bez `Re:`/`ODP:` |
| Dział | `departmentLabel` |
| Prowadzi | awatar inicjałów + imię; nieprzypisana = kółko przerywane + „nieprzypisana” (nie „—”) |
| Od kiedy | od `first_contact_at`: „5 h”, „3 dn.” (`hangingSinceLabel`) |

- [x] Kolumny SLA · Transakcja · Kategoria · Podsumowanie · Dział · Prowadzi · Od kiedy na `app/pages/index.vue`.

### 4.3 UX listy

- [x] Klik w wiersz → sprawa **obok listy** (prawa kolumna ~420 px), bez pełnej nawigacji na `/tickets/[id]`. Poniżej **1100 px** panel pod tabelą.
- [x] „Weź następną sprawę”: pierwsza z bieżącej kolejki z `awaiting='us'`; jeśli `owner_id is null` → przypisz do mnie, potem otwórz w panelu.
- [x] Wyszukiwarka w nagłówku: transakcja, mail, nazwa, treść (`ILIKE` na kontakcie / identyfikatorach / zdarzeniach), limit wyników.
- [x] Bez wyskakujących powiadomień o nowych sprawach.

---

## 5. Panel sprawy (prawa kolumna)

Od góry:

1. Numer transakcji, kategoria, znacznik SLA.  
   Pod spodem: firma · kupujący/sprzedawca · kraj · kanał · od kiedy.
2. Dwa selecty:
   - **Dział** — przeniesienie + event systemowy (**jest**).
   - **Prowadzi** — osoby z działu + „nieprzypisana”; API musi pozwalać na jawne `ownerId: null` (**jest** w panelu listy).
3. Karta Sun Agent (pkt 6): podsumowanie, „Czego potrzebuje”, „Następny krok”.
4. Skrócona oś: 3 ostatnie zdarzenia + „Pokaż całą rozmowę (n)” (**jest**).
5. Propozycja odpowiedzi (pkt 6): „Wstaw do odpowiedzi”, „Krócej”.
6. Pole odpowiedzi + „Wyślij”, „Zamknij sprawę” (**jest** w panelu; notatka nadal na pełnej stronie).

Trasa `/tickets/[id]` może zostać deep linkiem / fallbackiem mobile; desktopowy workflow = split view z pkt 4.

- [x] Split panel na liście z działem, prowadzącym, osią, odpowiedzią i zamknięciem.
- [ ] Pełna karta kontaktowa (firma · rola · kraj) w panelu.
- [ ] Notatka wewnętrzna z panelu (obecnie tylko odpowiedź do klienta).


---

## 6. Sun Agent: podsumowanie i szkic odpowiedzi

Robione **na końcu**, po stabilnych kolejkach (1–5).

- [ ] `server/services/ai.ts` — wywołanie modelu **tylko z serwera**. Env: klucz (`ANTHROPIC_API_KEY` lub `OPENAI_API_KEY`) + `AI_MODEL`. Bez klucza: reszta appki działa, przyciski AI wyłączone z krótkim opisem.
- [ ] Cursor **nie** jest dostawcą modelu runtime — potrzebny firmowy klucz API.
- [ ] `POST /api/tickets/[id]/summary` (`requireUser` + dostęp pkt 2): zapisuje `ai_summary`, `ai_need`, `ai_next_step`, `ai_summary_at`. Odśwież przy otwarciu, gdy po `ai_summary_at` jest nowa wiadomość.
- [ ] `POST /api/tickets/[id]/draft`: zwraca szkic, **nie zapisuje i nie wysyła**.
- [ ] Język szkicu = język ostatniej wiadomości klienta. Placeholdery braków: `[DATA]`, `[GODZINA]`, `[IMIĘ]` — nigdy zmyślone kwoty/terminy/obietnice.
- [ ] Płatności / faktury / spory: etykieta „sprawdź przed wysłaniem”.
- [ ] Do modelu: ~ostatnie 20 zdarzeń (obcięte) + dane zamówienia; bez sekretów i danych innych klientów. Treść = dane, nie instrukcje.
- [ ] Limit: jedno podsumowanie na sprawę na nową wiadomość; szkic na żądanie.

**Kryterium:** bez klucza AI aplikacja działa; przyciski nieaktywne z wyjaśnieniem.

---

## 7. Nazewnictwo w UI

- [x] „Prowadzi” zamiast „Wisi na” / „Właściciel” w inboxie.
- [x] „Na teraz” = odpowiedz, zanim minie czas SLA (`queue=now`).
- [x] Kolory tylko z brandu (`docs/brand/AGENT.md`): czarny = po terminie, żółty = mało czasu, zielony = CTA.

---

## Dlaczego tak (badania — skrót)

- Kolejność ustala system („Weź następną”): swobodny wybór pogarsza tempo (Ibáñez i in., 2018).
- Pilność tylko przy prawdziwym SLA (Zhu, Yang, Hsee, 2018).
- Bez pushy o nowej poczcie — mniej stresu, lepsza kontrola (Mark i in., CHI 2008/2016).
- AI jako szkic, nie autopilot (Brynjolfsson i in., 2025; Dell'Acqua i in., 2023).

---

## Kryteria odbioru (checklista końcowa)

- [ ] Logistyka widzi tylko swój dział; po migracji do Finansów sprawa znika u logistyki.
- [ ] Admin i Support widzą wszystkie sprawy i kolumnę „Prowadzi”.
- [ ] Mail klienta 10:00 (mail) → „Na teraz” w oknie SLA; po `reply_due_at` → „Po terminie SLA”.
- [ ] Odpowiedź agenta → „Czeka na klienta”; odpowiedź klienta → z powrotem „Do odpowiedzi” / `awaiting=us`.
- [ ] Bez klucza AI wszystko poza AI działa; przyciski AI disabled z opisem.
- [ ] `sfw npm run lint`, `sfw npm run typecheck`, `sfw npm test` zielone.

---

## Sugerowane branchowanie

1. `cursor/work-view-access` — dokończenie pkt **2** (`accessSql` po dziale) po merge staff-department.  
2. `cursor/work-view-sla-clock` — pkt **3**.  
3. `cursor/work-view-queues` — pkt **4** + shell UI.  
4. `cursor/work-view-panel` — pkt **5**.  
5. `cursor/work-view-ai` — pkt **6** (+ nazwy pkt **7** przy okazji UI).

Każdy PR: mały, z testami z odpowiedniego punktu, opis „dlaczego” w commit message.
