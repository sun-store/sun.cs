# AGENTS.md — sun.cs

Zasady, które agent ma stosować przy każdej zmianie, są też w `.cursor/rules/` (lint, typecheck, bezpieczeństwo, Socket przy `npm`).

Ticketownia Customer Support. Neon (właściciel połączenia, RLS nie działa). Better Auth.

## Bezpieczeństwo

Każdy handler w `server/api/**` zaczyna się od `requireUser` albo `requireAdmin` (`server/utils/session.ts`). Wyjątek: `server/api/auth/[...all].ts`.

Konto powstaje tylko dla firmowego maila, który jest na allowliście. Agenci nie wchodzą, dopóki `requireUser` ich nie wpuszcza.

Połączenie Neon omija RLS. Zakres wiersza jest w SQL, nie w polityce bazy:

- admin i lead: wszystkie sprawy (`seesAllTickets`)
- agent: `tickets.owner_id` = jego `agentId`

Fragment dokłada `accessSql` w `server/services/tickets.ts`. Wywołania wewnętrzne (import, inbound) nie podają aktora i widzą całość. Handler API zawsze podaje użytkownika z sesji.

Zapis: biała lista pól w handlerze, limity długości z `shared/text-bounds.ts`, enum z `shared/domain.ts`. Id sprawy i agenta: `isUuid` zanim trafi do SQL. Parametry `$1`, nigdy wklejony input w zapytanie. Po zapisie odczyt wiersza; brak wiersza to 404.

Sekrety (`NEON_DATABASE_URL`, `BETTER_AUTH_SECRET`, client secret SSO) zostają w env serwera. W `runtimeConfig.public` tylko flagi, że przycisk SSO ma się pokazać.

Nie przenoś polityk RLS z sun.logistics. Tam szeroka polityka (`auth.uid() is not null`) wygrywa z węższą przez OR. Tu filtrem jest aplikacja.

## Odczyt

Lista spraw: jawne kolumny, limit `TICKET_LIST_LIMIT` (1000), jedno zapytanie więcej żeby wiedzieć, że lista jest ucięta (`truncated`). Podsumowanie SLA to osobny, wąski select, nie druga kopia pełnej listy.

Indeks listy: `tickets_business_changed_idx`.

## Czego nie dodawać z logistics

Impersonacja, TOTP i wirtualizacja tabeli — dopóki wejście to SSO plus allowlista, a inbox ma kilka kolumn. Hasło jest zapasem na pierwsze wejście, nie główną ścieżką.
