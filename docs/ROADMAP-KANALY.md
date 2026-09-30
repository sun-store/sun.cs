# Porównanie i roadmapa kanałów — sun.support

Stan 30.09.2026. Źródło: brief CS (Jira / Redmine / HubSpot + kanały).

## Werdykt

Rdzeń (kolejki, SLA, działy, dashboard, Sun Agent) jest. Nie bierzemy portalu, workflow statusów ani konfiguratora reguł. Kanały łączymy cienkimi adapterami do `server/services/inbound.ts`.

## Kolejność wdrożenia

1. **Aircall** — webhook; nieodebrane / voicemail → sprawa „oddzwoń” w kolejce *Na teraz*.
2. Gotowe odpowiedzi (makra) + biblioteka dokumentów.
3. Eskalacja Sun Agent → ten sam inbound.
4. Reguły przy wejściu + merge duplikatów.
5. Mail: Sent Items; `Mail.Send` po wyłączeniu HubSpota.
6. WhatsApp Cloud API (po decyzji o numerze).
7. Ankieta CSAT po zamknięciu.

## Firma musi dostarczyć (Aircall)

- Admin Aircall: webhook URL `https://<host>/api/webhooks/aircall`, eventy `call.ended` (+ opcjonalnie `call.voicemail_left`).
- Token webhooka → `AIRCALL_WEBHOOK_TOKEN` w Vercel (nigdy w repo / czacie).

## Czego nie bierzemy

Portal klienta, publiczna baza wiedzy, własne workflow statusów, konfigurator reguł, ITSM (incydenty/zmiany), ewidencja czasu, karuzela auto-przydziału (zostaje „Weź najpilniejszą”).
