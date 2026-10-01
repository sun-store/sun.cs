# Porównanie i roadmapa — sun.support

Stan 30.09.2026 · brief CS (Jira / Redmine / HubSpot + kanały).  
Kod Aircall: `POST /api/webhooks/aircall` (`docs/AIRCALL.md`).

## Werdykt

Rdzeń (kolejki, SLA, działy, dashboard, Sun Agent) jest. Brakuje z HubSpota: makr, reguł przy wejściu, ankiety CSAT.  
Nie bierzemy portalu, workflow statusów ani konfiguratora reguł.  
sun.support = kolejka i jeden widok sprawy — nie budujemy od nowa plików, zadań ani telefonii.

## Na narzędziach, które już mamy

| Potrzeba | Narzędzie | Najprościej | Nie budujemy |
| --- | --- | --- | --- |
| Czat / Sun Agent | HubSpot | webhook `conversation.newMessage` → inbound (tylko odczyt) | własnego widgetu czatu |
| WhatsApp | HubSpot (CS = numer Armanda; sprzedaż zostaje) | do wyjścia z HS zostaje w HS; potem tylko numer CS → Cloud API | przenoszenia numerów sprzedaży |
| Telefon | Aircall PL Support | drugi webhook → sun.support; nieodebrane = „oddzwoń” | własnej telefonii |
| Mail | Outlook | Graph (gotowe); Sent Items; Mail.Send po HS | — |
| Dokumenty | Google Dysk (współdzielony) | folder: linki przy sprawie + biblioteka dla Sun Agenta | własnego magazynu / edytora |
| Zadanie Produkt/Logistyka | ClickUp | przycisk w sprawie + webhook statusu | tablic w sun.support |
| Transakcja | BigQuery production | panel czyta po numerze (`orders.ts`) | kopii platformy |
| KPI | BigQuery + Airbyte | Airbyte: źródło sun.support | osobnego BI |
| Zastępstwa | kolejki sun.support | „Weź najpilniejszą” | autoresponderów |

Do potwierdzenia: historia WhatsApp przez API HubSpota; admin Dysku i ClickUp.

## Kolejność wdrożenia

1. **Aircall** — webhook; rozmowa na osi; nieodebrane / voicemail → „oddzwoń” w *Na teraz*. Firma: admin Aircall + token → `AIRCALL_WEBHOOK_TOKEN`. **(w kodzie)**
2. Gotowe odpowiedzi (10 tematów PL/EN) + folder na Dysku (pliki przy sprawie, biblioteka). Firma: CS treści; dostęp do folderu Dysku.
3. Czat / Sun Agent: webhook rozmów HubSpot → sun.support (odczyt). Firma: app HubSpot `conversations.read`.
4. Reguły przy wejściu + merge duplikatów. Firma: nic.
5. Mail: Sent Items teraz; `Mail.Send` po wyłączeniu HubSpota.
6. WhatsApp: w HS do wyjścia; potem numer CS na Cloud API.
7. Ankieta CSAT po zamknięciu (gdy HS przestanie).

## Co bierzemy (bez konfiguratora)

- Makra per temat PL/EN (`[TRANSAKCJA]`, `[IMIĘ]`)
- Dokumenty: linki na Dysku + biblioteka dla Sun Agenta
- Oddzwoń z Aircall
- Reguły: temat→dział, duplikat→propozycja zamknięcia, ten sam klient 7 dni→ta sama osoba
- Merge duplikatów jednym kliknięciem
- CSAT 1 pytanie po zamknięciu
- Eskalacja SLA na dashboardzie (już jest)

## Czego nie bierzemy

Portal / publiczna baza wiedzy · własne workflow statusów · konfigurator reguł · ITSM / ewidencja czasu · karuzela auto-przydziału.
