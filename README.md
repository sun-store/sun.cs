# sun.support

Ticketownia Customer Support sun.store: e-mail, WhatsApp, telefon i sprawy agenta AI w jednym inboxie. Kontakt jest rekordem sun.support, spiętym z userem sun.store i kontaktem HubSpot. SLA liczy się z pierwszego kontaktu i pierwszej odpowiedzi do klienta, w czasie Europe/Warsaw.

Brand kit (draft v3): [docs/brand/AGENT.md](docs/brand/AGENT.md).

Umowa produktowa: [docs/wymagania-kpi.md](docs/wymagania-kpi.md).
Audyt i docelowy kształt (30.09.2026): [docs/audyt-i-ksztalt.md](docs/audyt-i-ksztalt.md).

## Start

1. Załóż **nową** bazę Neon (nie tę z logistics).
2. Skopiuj `.env.example` do `.env` i uzupełnij `NEON_DATABASE_URL`, `NEON_DIRECT_URL`, `BETTER_AUTH_SECRET`, `AUTH_ALLOWLIST`.
3. `npm install`
4. `npm run db:migrate`
5. `npm run dev`
6. Wejdź na `/login`. Firmowe konto = Google @sun.store (jak logistics). Do tego czasu: **Pierwsze wejście — załóż hasło**.
7. Admin dopisuje ludzi na `/team`. Klucze Google: `docs/MICROSOFT-SSO.md`. Wersja webowa: `docs/VERCEL.md`.

## Skrypty

```bash
npm test
npm run db:migrate
npm run db:import-sep
npm run dev
```

`db:import-sep` wciąga wrzesień z lokalnych zrzutów HubSpot (delt BigQuery + `conversations-2026-09-*.json` w Pobranych). Ponowne uruchomienie nic nie dubluje.
