# AGENTS.md — sun.support

Zasady, które agent ma stosować przy każdej zmianie, są też w `.cursor/rules/` (lint, typecheck, bezpieczeństwo, brand, Socket przy `npm`).

**Nazwa produktu w UI:** `sun.support` (zawsze małe litery, z kropką). Dawna nazwa robocza `sun.cs` jest wycofana. Brand kit: `docs/brand/AGENT.md`.

Ticketownia Customer Support. Neon (właściciel połączenia, RLS nie działa). Better Auth.

## Bezpieczeństwo

Każdy handler w `server/api/**` zaczyna się od `requireUser` albo `requireAdmin` (`server/utils/session.ts`). Wyjątki: `server/api/auth/[...all].ts` oraz `server/api/cron/**`, które zaczynają się od `requireCron` (`server/utils/cron.ts`, sekret `CRON_SECRET`).

Konto powstaje tylko dla firmowego maila, który jest na allowliście. Agenci nie wchodzą, dopóki `requireUser` ich nie wpuszcza.

Połączenie Neon omija RLS. Zakres wiersza jest w SQL, nie w polityce bazy:

- admin i lead: wszystkie sprawy (`seesAllTickets`)
- agent: `tickets.owner_id` = jego `agentId`

Fragment dokłada `accessSql` w `server/services/tickets.ts`. Wywołania wewnętrzne (import, inbound) nie podają aktora i widzą całość. Handler API zawsze podaje użytkownika z sesji.

Zapis: biała lista pól w handlerze, limity długości z `shared/text-bounds.ts`, enum z `shared/domain.ts`. Id sprawy i agenta: `isUuid` zanim trafi do SQL. Parametry `$1`, nigdy wklejony input w zapytanie. Po zapisie odczyt wiersza; brak wiersza to 404.

Sekrety (`NEON_DATABASE_URL`, `BETTER_AUTH_SECRET`, client secret SSO, `GRAPH_CLIENT_SECRET`, `CRON_SECRET`) zostają w env serwera. W `runtimeConfig.public` tylko flagi, że przycisk SSO ma się pokazać.

Nie przenoś polityk RLS z sun.logistics. Tam szeroka polityka (`auth.uid() is not null`) wygrywa z węższą przez OR. Tu filtrem jest aplikacja.

## Odczyt

Lista spraw: jawne kolumny, stronicowanie (`TICKET_LIST_PAGE_SIZE` = 50, max 100), domyślny filtr statusu `open`, kolejki `ownerId` = `all` / `mine` / `unassigned`. Podsumowanie SLA to osobny, wąski select, nie druga kopia pełnej listy.

Indeks listy: `tickets_business_changed_idx`.

## Czego nie dodawać z logistics

Impersonacja, TOTP i wirtualizacja tabeli — dopóki wejście to SSO plus allowlista, a inbox ma kilka kolumn. Hasło jest zapasem na pierwsze wejście, nie główną ścieżką.
