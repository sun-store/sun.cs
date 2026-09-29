# Żywy mail z Outlooka (Microsoft Graph)

Skrzynka CS na Microsoft 365 trafia do Ticketów jako kanał E-mail. Odpowiedź agenta na e-mail klienta wychodzi prawdziwym mailem z tej skrzynki.

## Jak to działa

- **Wejście:** Vercel Cron co 2 minuty woła `GET /api/cron/mail-sync`. Endpoint czyta zmiany w folderze Inbox przez Graph delta i zapisuje nowe maile jako zdarzenia w sprawach.
- **Przypięcie do sprawy:** ta sama rozmowa Outlooka (`conversationId`) → ta sama otwarta sprawa. Bez tego jedna otwarta sprawa kontaktu → dopisz do niej. W innym razie nowa sprawa.
- **Start:** pierwszy bieg zapamiętuje czas startu (`mail_sync_state.since`). Maile starsze niż start są pomijane, więc nie dublujemy importu HubSpot. Pierwsze przewinięcie historii skrzynki może zająć kilka biegów.
- **Pomijane:** maile ze skrzynki CS, szkice, autorespondery i zwrotki (mailer-daemon, postmaster, „Automatic reply”, „Out of Office” itp.).
- **Duplikaty:** `ticket_events.graph_message_id` ma unikalny indeks, a sync sprawdza go przed zapisem. Dwa biegi naraz blokuje dzierżawa w `mail_sync_state.locked_until`.
- **Błędy:** jeśli padnie cała strona (np. baza), kursor stoi i następny bieg ją powtórzy. Pojedynczy zły mail jest pomijany i liczony w `failed`; ostatni błąd jest w `mail_sync_state.last_error`.
- **Wyjście:** odpowiedź „Do klienta” w sprawie z kanałem E-mail najpierw idzie mailem, potem trafia na oś czasu. Jeśli Graph odrzuci wysyłkę, nic się nie zapisuje i agent widzi błąd.
  - Jest mail klienta w sprawie → `reply` na ostatni mail klienta (ten sam wątek, z cytatem).
  - Nie ma (np. sprawa z importu HubSpot) → nowy mail na adres e-mail kontaktu, temat `Re: <temat sprawy>`.
- Bez konfiguracji Graph wszystko działa jak dotąd: odpowiedź tylko zapisuje się w sprawie, a formularz mówi, że mail nie wyszedł.

## Konfiguracja (jednorazowo)

### 1. Aplikacja w Microsoft Entra (admin M365)

1. Entra admin center → App registrations → New registration, np. `sun.support mail`. Osobna aplikacja, nie ta od SSO.
2. Certificates & secrets → New client secret. Skopiuj wartość od razu.
3. Zapisz: Directory (tenant) ID, Application (client) ID, secret oraz Object ID z Enterprise applications (inny niż w App registrations).
4. **Nie** dodawaj Mail.Read / Mail.Send w API permissions ani admin consent. Uprawnienie nadane w Entra obejmuje wszystkie skrzynki w firmie; zakres dajemy w Exchange (krok 2).

### 2. Uprawnienia tylko do skrzynki CS (RBAC for Applications)

Microsoft zastąpił Application Access Policies mechanizmem [RBAC for Applications](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac). Admin Exchange w PowerShell:

```powershell
Connect-ExchangeOnline
New-ServicePrincipal -AppId <client-id> -ObjectId <enterprise-app-object-id> -DisplayName "sun.support mail"
New-ManagementScope -Name "sun.support CS mailbox" -RecipientRestrictionFilter "PrimarySmtpAddress -eq '<skrzynka-cs>'"
New-ManagementRoleAssignment -App <client-id> -Role "Application Mail.Read" -CustomResourceScope "sun.support CS mailbox"
# w dniu przełączenia z HubSpota, żeby odpowiedzi wychodziły mailem:
# New-ManagementRoleAssignment -App <client-id> -Role "Application Mail.Send" -CustomResourceScope "sun.support CS mailbox"
Test-ServicePrincipalAuthorization -Identity <client-id> -Resource <skrzynka-cs>
```

Na czas równoległego działania z HubSpotem: tylko `Application Mail.Read`. Bez Mail.Send sun.support nie wyśle klientowi drugiego maila; odpowiedź „Do klienta” kończy się błędem i nic się nie zapisuje.

### 3. Zmienne na Vercel (Production) i lokalnie w `.env`

| Zmienna | Wartość |
|---|---|
| `GRAPH_TENANT_ID` | Directory (tenant) ID |
| `GRAPH_CLIENT_ID` | Application (client) ID |
| `GRAPH_CLIENT_SECRET` | secret z kroku 1.2 |
| `OUTLOOK_MAILBOX` | adres wspólnej skrzynki CS |
| `CRON_SECRET` | losowy ciąg min. 32 znaki; Vercel dokleja go do wywołań crona |

Potem `sfw npm run db:migrate` (migracja `0005_outlook_mail.sql`) i Redeploy.

### 4. Sprawdzenie

- Vercel → projekt → Settings → Cron Jobs: widać `/api/cron/mail-sync` co 2 minuty.
- Ręcznie: `curl -H "Authorization: Bearer $CRON_SECRET" https://sun-cs.vercel.app/api/cron/mail-sync`
  - `{"configured":false}` → brakuje zmiennych Graph.
  - `{"configured":true,"pages":…,"caughtUp":true,"imported":…}` → działa.
- Wyślij testowego maila na skrzynkę CS; po ~2 minutach jest w Ticketach z kanałem E-mail.

## Ograniczenia na teraz

- Tylko folder Inbox. Maile przeniesione regułą do innych folderów nie wchodzą.
- Załączniki nie są pobierane (w treści zostaje tylko tekst).
- Odpowiedź agenta jest tekstem, bez podpisu HTML i bez załączników.
- Jeśli po wysłaniu maila zapis w bazie się nie uda, mail już wyszedł. Agent zobaczy błąd; wtedy dopisz notatkę ręcznie.
