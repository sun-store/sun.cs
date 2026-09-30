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
- [ ] Test: sprawa w `waiting` + event klienta → wraca do `open` (dodać w `shared/` lub teście serwisowym, jeśli jeszcze nie ma).

**Kryterium:** klient pisze w sprawie „Czeka” → lista „Otwarte” / kolejka „Do odpowiedzi” znów ją pokazuje.

---

## 2. Kto co widzi (dostęp po dziale)

Obecnie `accessSql` ogranicza **agenta** do `owner_id = agentId`. Docelowo ogranicza **dział**, nie właściciela.

### 2.1 Pole działu na pracowniku

- [ ] Zmergować `cursor/staff-department` (migracja `0008`, `/team`, `department` w sesji `/api/me`), albo równoważna implementacja na `main`.
- [ ] `staff.department` i `allowlist.department`: ten sam enum co `tickets.department`, domyślnie `cs`.
- [ ] Edycja na `/team` (tylko admin): rola + dział.

### 2.2 `accessSql` (przepisać)

Actor musi mieć `department` (już w `SessionUser` na branchu staff-department).

| Kto | Zakres SQL |
| --- | --- |
| Brak aktora (import, inbound, cron) | wszystko (`true`) |
| `role = admin` | wszystko |
| `department = cs` (Support), także agent Support | wszystko |
| Inny dział | `t.department = $n` (dział osoby) |
| ~~`role = agent` → tylko `owner_id`~~ | **usuń** ten warunek |

Lead: w produkcie „admin i Support widzą wszystko”. Lead CS zwykle ma `department = cs` albo `seesAllTickets` — utrzymaj: **admin OR lead OR department = cs → wszystko**, żeby lead bez `cs` też widział pełnię (jak dziś `seesAllTickets`).

Zaktualizuj `shared/access.ts`:

- `seesAllTickets(role)` — zostaje dla admin/lead **albo** zastąp / uzupełnij o `seesAllDepartments(role, department)`.
- Testy poniżej muszą przejść niezależnie od nazwy helpera.

### 2.3 Filtr listowy vs twardy dostęp

- Query `department=` nadal zawęża widok (Support może wybrać Logistykę).
- Osoba spoza Support **nie może** obejść dostępu parametrem `department=all` (już szkic na branchu staff-department — dopiąć pod nowy `accessSql`).

### 2.4 Testy (`shared/access.test.ts` + ewentualnie serwis)

- [ ] admin → widzi wszystko.
- [ ] support-agent (`department = cs`) → widzi wszystko.
- [ ] logistyka-agent → tylko `department = logistics`.
- [ ] sprawa przeniesiona logistics → finance: znika u logistyki, pojawia się u finansów.

**Kryterium odbioru:** osoba z logistyki widzi tylko Logistykę; po przeniesieniu do Finansów przestaje ją widzieć. Admin i Support widzą wszystkie i kolumnę „Prowadzi”.

---

## 3. Czas do SLA na każdą odpowiedź

KPI pierwszej odpowiedzi (`shared/sla.ts`) **bez zmian**.  
Dodatkowo: operacyjny termin odpowiedzi na **każdą** wiadomość klienta.

### 3.1 Schema

Migracja (np. `0009_ticket_awaiting_reply.sql`):

```sql
-- awaiting: kto ma kolejny ruch
-- reply_due_at: deadline odpowiedzi agenta (null gdy czeka na klienta)
alter table tickets
  add column if not exists awaiting text,           -- 'us' | 'customer' | null
  add column if not exists reply_due_at timestamptz;

-- constraint awaiting in ('us','customer') or null
create index if not exists tickets_awaiting_due_idx
  on tickets (awaiting, reply_due_at);
```

Opcjonalnie w tej samej lub kolejnej migracji kolumny AI (pkt 6):  
`ai_summary`, `ai_need`, `ai_next_step`, `ai_summary_at` — żeby nie robić drugiej migracji zaraz potem.

### 3.2 Logika w `addEvent` / inbound

| Zdarzenie | `awaiting` | `reply_due_at` |
| --- | --- | --- |
| Wiadomość klienta | `'us'` | czas wiadomości + próg kanału w **godzinach pracy** (`shared/workingHours.ts`, Europe/Warsaw, 9–17) |
| Agent/bot → klient | `'customer'` | `null` |
| Notatka / do sprzedawcy | bez zmiany awaiting | bez zmiany |

Progi (jak KPI kanałów): czat **30 min**, mail **2 h** (robocze). Telefon/formularz: przyjąć ten sam próg co czat albo mail — **ustalić w implementacji i opisać w PR** (propozycja: telefon = 30 min, form = 2 h).

### 3.3 Backfill

Dla otwartych spraw: ostatnie zdarzenie klient vs agent → ustaw `awaiting` / `reply_due_at` (dla `us` wylicz due od czasu ostatniej wiadomości klienta).

### 3.4 Test

- [ ] Mail w **piątek 16:30** (Warsaw) + 2 h robocze → termin **poniedziałek 10:30**.
- [ ] Jednostkowo: helper „add working duration” w `shared/workingHours.ts` (lub obok).

**Kryterium:** mail klienta 10:00 → w „Na teraz” najpóźniej do 12:00 okna SLA; po przekroczeniu `reply_due_at` → „Po terminie SLA”.

---

## 4. Kolejki (lewa kolumna) i tabela

### 4.1 API

- [ ] Parametr `queue` w `GET /api/tickets` (obok `department`, `status`, stronicowania).
- [ ] `GET /api/tickets/counts` — jedno zapytanie z `count(*) filter (where …)` dla lewej kolumny; `requireUser` + ten sam `accessSql` co lista.
- [ ] Odświeżanie liczników w UI co **60 s** (bez toastów / pushy o nowych sprawach).

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

### 4.3 UX listy

- [ ] Klik w wiersz → sprawa **obok listy** (prawa kolumna ~420 px), bez pełnej nawigacji na `/tickets/[id]`. Poniżej **1100 px** panel pod tabelą.
- [ ] „Weź następną sprawę”: pierwsza z bieżącej kolejki z `awaiting='us'`; jeśli `owner_id is null` → przypisz do mnie, potem otwórz w panelu.
- [ ] Wyszukiwarka w nagłówku: transakcja, mail, nazwa, treść (`ILIKE` na kontakcie / identyfikatorach / zdarzeniach), limit wyników.
- [ ] Bez wyskakujących powiadomień o nowych sprawach.

---

## 5. Panel sprawy (prawa kolumna)

Od góry:

1. Numer transakcji, kategoria, znacznik SLA.  
   Pod spodem: firma · kupujący/sprzedawca · kraj · kanał · od kiedy.
2. Dwa selecty:
   - **Dział** — przeniesienie + event systemowy (**jest**).
   - **Prowadzi** — osoby z działu + „nieprzypisana”; API musi pozwalać na jawne `ownerId: null` (**jest** po audycie #8 — podpiąć UI listy agentów z działu).
3. Karta Sun Agent (pkt 6): podsumowanie, „Czego potrzebuje”, „Następny krok”.
4. Skrócona oś: 3 ostatnie zdarzenia + „Pokaż całą rozmowę (n)”.
5. Propozycja odpowiedzi (pkt 6): „Wstaw do odpowiedzi”, „Krócej”.
6. Pole odpowiedzi + „Wyślij”, „Notatka”, „Zamknij sprawę” (nadal kategoria + priorytet przy zamknięciu).

Trasa `/tickets/[id]` może zostać deep linkiem / fallbackiem mobile; desktopowy workflow = split view z pkt 4.

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

- [ ] „Prowadzi” zamiast „Wisi na” / „Właściciel” w inboxie.
- [ ] „Na teraz” = odpowiedz, zanim minie czas SLA (`queue=now`).
- [ ] Kolory tylko z brandu (`docs/brand/AGENT.md`): czarny = po terminie, żółty = mało czasu, zielony = CTA.

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
