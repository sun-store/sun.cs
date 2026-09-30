# Aircall → sun.support

Webhook `POST /api/webhooks/aircall`. Weryfikacja: pole `token` w body = `AIRCALL_WEBHOOK_TOKEN` (timing-safe).

## Eventy

- `call.ended` — główne źródło (nagranie / voicemail po ~30 s).
- `call.voicemail_left` — to samo mapowanie, gdy Aircall wyśle osobno.

## Zachowanie

| Przypadek | Skutek |
| --- | --- |
| inbound, nieodebrane / bez `answered_at` / voicemail | nowa sprawa `phone`, status call `callback`, temat „Oddzwoń: …”, `awaiting=us` + SLA jak czat |
| inbound, odebrane | event na osi (nowa sprawa albo dołącz do jednej otwartej / wątku `aircall:{id}`) |
| outbound | event od agenta na osi |

Nagranie: **link** w treści zdarzenia (`recording` / `voicemail` / `asset`), nie kopia pliku.

## Konfiguracja Aircall

1. Integrations → Webhook → URL aplikacji.
2. Eventy: `call.ended` (zalecane).
3. Token ze zdarzenia skopiować do Vercel: `AIRCALL_WEBHOOK_TOKEN`.

Idempotencja: `external_thread_id = aircall:{call.id}` — ponowne `call.ended` dokleja się do tej samej otwartej sprawy.
