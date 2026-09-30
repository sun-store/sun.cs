# sun.support: audyt i docelowy kształt aplikacji

30 wrz 2026 · @Martyna

sun.support ma dziś solidny fundament: sprawy z pełną osią czasu, SLA, raport KPI, dashboard, import z HubSpota i gotowy kod do żywego maila. Jako narzędzie do codziennej pracy jest jednak na razie podglądem dla liderów. Agenci nie mogą się zalogować, nie ma kolejek ani przekazań między zespołami, a na produkcji jest krytyczna luka w logowaniu (poniżej, punkt 1).

Narzędziem całej firmy stanie się wtedy, gdy każdy zespół (CS, Merchant Success, logistyka, finanse) będzie miał w nim swoją kolejkę. Do tego potrzebne jest jedno miejsce z kontekstem klienta i zamówienia oraz Sun Agent, który zamyka proste sprawy sam, a trudne kieruje od razu do właściwego zespołu.

Podstawa: kod z gałęzi `fix/ci-lockfile` (commit `d1054ae`, 29.09.2026) i test na lokalnej kopii bazy. Liczby o ruchu pochodzą z importu września: ok. 926 ticketów HubSpot, ok. 1240 spraw i 3294 zdarzeń w bazie.

## Stan dziś

Najmocniejsze są dane i raportowanie. Najsłabsza jest codzienna praca agenta i współpraca między zespołami.

| Obszar | Co działa | Czego brakuje |
|---|---|---|
| Logowanie i dostęp | Google SSO @sun.store, lista zespołu, role admin / lead / agent | Rola agent jest zablokowana w kodzie („Logowanie agentów jeszcze nie jest włączone”), więc pracować mogą tylko leadzi. Luka w rejestracji na hasło (audyt, punkt 1) |
| Lista spraw | Filtr po statusie i kanale, do 1000 spraw, SLA w podsumowaniu | Brak wyszukiwarki, kolejek „moje / zespołu / nieprzypisane”, sortowania po pilności i stronicowania |
| Widok sprawy | Oś czasu, odpowiedź / wiadomość do sprzedawcy / notatka, zamknięcie z kategorią i priorytetem, konflikt kontaktu | Brak załączników, szablonów odpowiedzi, przekazania do innego zespołu, historii zmian (kto zamknął, kto zmienił właściciela) |
| Kanały | Mail z Outlooka: kod gotowy, czeka na uprawnienia. Telefon i formularz: wpis ręczny | Czat, WhatsApp i formularz na stronie istnieją tylko jako wartości na liście. Nie są podłączone |
| Kontekst klienta | Kontakt z identyfikatorami (mail, telefon, id sun.store, HubSpot) | Zamówienie to tylko link do logistics, bez statusu, dat i CMR. Brak historii transakcji i negocjacji klienta |
| Sun Agent (AI) | Typ nadawcy „bot” w bazie, AI containment liczone w KPI | Brak agenta w aplikacji: nie odpowiada, nie streszcza, nie klasyfikuje |
| Raporty | `/wyniki`: FCR, SLA, CSAT, retencja, QA, premia, agenci. `/dashboard`: kategorie, kanały, trend, obciążenie agentów | CSAT i deale tylko z importu, nie na bieżąco |
| Dane | Import HubSpot września, kategorie źródłowe HubSpot (migracja 0006) | Import jednorazowy. HubSpot pozostaje głównym systemem |

## Audyt techniczny i bezpieczeństwa

Punkt 1 trzeba poprawić dziś: dotyczy produkcji z danymi klientów. Punkty 2–4 są warunkiem, żeby wpuścić do aplikacji kogokolwiek poza liderami.

| # | Problem | Skutek | Poprawka | Priorytet |
|---|---|---|---|---|
| 1 | Rejestracja na hasło bez potwierdzenia maila (`emailAndPassword`, `requireEmailVerification: false`) | Ktoś zakłada konto na cudzy adres z listy i dostaje rolę lead z wglądem we wszystkie sprawy. Potwierdzone lokalnie 30.09 | `disableSignUp: true` (1 linia, sprawdzone). Przejrzeć tabelę `account` pod kątem `providerId = 'credential'` | Krytyczny |
| 2 | Repo publiczne, a w `shared/allowlist.ts` i `.env.example` są maile zespołu z rolami | Gotowa lista celów dla punktu 1 i phishingu | Owner zmienia repo na Private. Lista zespołu tylko w bazie (strona `/team`) i w env | Wysoki |
| 3 | Każde nowe zdarzenie ustawia status „Czeka”, także wiadomość od klienta | Sprawa, w której klient właśnie odpisał, wygląda na załatwioną. Przy żywym mailu inbox nie pokaże, co wymaga odpowiedzi | Wiadomość klienta → „Otwarta”, odpowiedź agenta → „Czeka na klienta” | Wysoki |
| 4 | Rola agent zablokowana w `requireUser` | Agenci pierwszej linii nie mogą pracować w aplikacji | Odblokować po punktach 1–3. Zakres agenta (tylko własne sprawy) już jest w SQL | Wysoki |
| 5 | Brak historii zmian w sprawie (właściciel, status, kategoria) | Nie da się odtworzyć, kto co zmienił. To problem przy QA, sporach i premii liczonej z KPI | Tabela zdarzeń systemowych: kto, co, kiedy — **zrobione** (`sender_type = system` na osi) | Średni |
| 6 | Leadzi widzą wszystkie sprawy, reszta tylko własne. Nie ma pojęcia zespołu | Przy wejściu finansów i logistyki albo wszyscy widzą wszystko, albo nikt nie widzi kolejki swojego zespołu | Zespoły i kolejki, dostęp po zespole (patrz „Moduły”) | Średni |
| 7 | `main` ma niezsynchronizowany `package-lock`, a praca jest na `fix/ci-lockfile` | CI na `main` pada. Nie wiadomo, z której gałęzi wdraża Vercel | Scalić `fix/ci-lockfile` do `main` przez Pull Request po teście maila — lockfile już na `main` (`efe6a7b` / merge) | Średni |
| 8 | Nie da się zdjąć właściciela sprawy (SQL `coalesce`) | Sprawa zostaje przypisana do osoby na urlopie | Jawne „nieprzypisana” w API — **zrobione** | Niski |
| 9 | Lista spraw ucina się na 1000 bez stronicowania | Przy ok. 1000 sprawach miesięcznie już po miesiącu część znika z listy | Stronicowanie i domyślny filtr „otwarte” | Niski |
| 10 | Mail wychodzi przed zapisem w bazie | Jeśli zapis padnie, klient dostał mail, którego nie ma w sprawie | Zapis „wysyłanie” przed wysyłką, potwierdzenie po — **zrobione** | Niski |

Co jest zrobione dobrze: każdy endpoint ma strażnika (`requireUser` / `requireAdmin` / `requireCron`), zapytania SQL są parametryzowane, dane wejściowe mają limity długości, sekrety zostają na serwerze, a w historii repo nie ma haseł. Zestaw 55 testów, lint i typecheck przechodzą.

## Kto pracuje na ticketach i czego potrzebuje

Sprawa klienta sun.store rzadko kończy się w CS: wypłata to finanse, CMR to logistyka, spór to Merchant Success. Dziś takie przekazanie odbywa się poza narzędziem (Slack, mail) i z niego znika. Docelowo każdy zespół dostaje własną kolejkę w tej samej sprawie, zamiast kopii wątku.

| Zespół | Typowe sprawy | Co musi widzieć | Co robi w aplikacji |
|---|---|---|---|
| Customer Service (1. linia) | Pytania o konto, VAT, weryfikację, status zamówienia, dostawę | Kolejkę „do odpowiedzi”, historię klienta, zamówienie, szkic odpowiedzi od Sun Agent | Odpowiada, zamyka, przekazuje dalej |
| Merchant Success | Spory kupujący–sprzedawca, sprzedawca nie odpowiada, kontakt poza czatem negocjacji | Obie strony sprawy, negocjację i transakcję, regulamin (§) | Rozstrzyga, wysyła ostrzeżenie, eskaluje |
| Logistyka (DBSS) | Brak dostawy, zmiana terminu, uszkodzenie, brak CMR | Zlecenie z sun.logistics: status, daty, przewoźnik, CMR | Uzupełnia dane dostawy i odsyła sprawę do CS |
| Finanse | Wstrzymana wypłata, faktura, korekta, stawka VAT, sun.finance | Transakcję, płatność, dowód wywozu | Potwierdza wypłatę albo korektę, odsyła do CS |
| Sprzedaż / key account | Duzi kupujący i sprzedawcy, reklamacje ważnych klientów | Wszystkie otwarte sprawy „swoich” klientów | Obserwuje, dopisuje notatki, podbija priorytet |
| Leadzi CS i zarząd | SLA, obciążenie, powtarzające się problemy | Dashboard, KPI, sprawy po terminie | Przydziela, ustawia reguły, raportuje |

Wniosek dla projektu: sprawa ma jednego właściciela z CS od początku do końca. Inne zespoły dostają zadanie w tej sprawie z terminem. Klient dostaje odpowiedź z jednego miejsca, a SLA liczy się dla całej sprawy i osobno dla każdego przekazania.

## Docelowy przepływ sprawy

Sun Agent próbuje zamknąć każdą sprawę pierwszy. Jeśli nie umie, sprawa trafia do kolejki CS i ma właściciela aż do zamknięcia. Logistyka, finanse i Merchant Success dostają zadanie z terminem w tej samej sprawie i oddają je z powrotem, zamiast przejmować sprawę albo prowadzić ją na Slacku.

## Moduły docelowej aplikacji

Osiem modułów. Pierwsze cztery zastępują HubSpot w codziennej pracy CS, kolejne cztery otwierają aplikację na całą firmę.

| Moduł | Co robi | Po co |
|---|---|---|
| 1. Inbox z kolejkami | Widoki: Do odpowiedzi (klient napisał ostatni), Moje, Mój zespół, Nieprzypisane, Po terminie SLA, Czeka na klienta. Sortowanie po czasie do złamania SLA. Wyszukiwarka po nazwie, mailu, numerze zamówienia i treści | Agent otwiera aplikację i od razu wie, co robić teraz |
| 2. Widok sprawy | Po lewej oś czasu z mailami, notatkami i zdarzeniami systemowymi. Po prawej karta klienta: rola (kupujący/sprzedawca), kraj, poprzednie sprawy, otwarte zamówienia i negocjacje. Na dole pasek „Do zrobienia” i pole odpowiedzi z szablonami i załącznikami | Cały kontekst bez przeklikiwania HubSpota, logistics i panelu sun.store |
| 3. Przekazania między zespołami | „Poproś logistykę / finanse / MS” = zadanie z terminem w tej samej sprawie, z własną kolejką u odbiorcy. Po wykonaniu wraca do właściciela sprawy | Koniec gubienia spraw w Slacku, mierzalny czas każdego zespołu |
| 4. Kanały | Mail (Outlook, gotowe), czat z aplikacji sun.store (zakładka Support), WhatsApp, telefon z zapisem połączenia, formularz. Wszystko trafia do jednej sprawy klienta | Klient pisze, gdzie chce, a agent widzi jedną historię |
| 5. Sun Agent (AI) | Odpowiada klientom 24/7 w czacie i mailu z bazy wiedzy i danych zamówienia. Streszcza długie wątki, proponuje kategorię, priorytet i szkic odpowiedzi. Oddaje sprawę do właściwej kolejki, gdy nie umie jej zamknąć | Proste sprawy zamknięte bez człowieka, trudne od razu u właściwej osoby |
| 6. Integracje | sun.store (użytkownik, VAT, transakcje, negocjacje), sun.logistics (zlecenie, CMR, tracking), finanse (wypłaty, faktury), HubSpot (kontakt, deal) tylko do odczytu w okresie przejściowym | Dane w sprawie zamiast pytań do innych zespołów |
| 7. Reguły i SLA | Automatyczne przypisanie po kategorii, kraju i języku. SLA na odpowiedź i na rozwiązanie, osobne dla przekazań. Przypomnienia przed złamaniem | Mniej ręcznego rozdzielania pracy przez liderów |
| 8. Raporty i jakość | Obecne `/wyniki` i `/dashboard` + CSAT po zamknięciu na bieżąco, QA na próbce spraw, raport „top 10 powodów kontaktu” dla produktu | Wiadomo, co naprawić w produkcie, żeby spraw było mniej |

Zasady dostępu: agent widzi sprawy swoje i swojego zespołu. Zespół wspierający widzi tylko sprawy ze swoim zadaniem. Leadzi i admin widzą wszystko. Każda zmiana zostaje w historii sprawy.

## Roadmapa

Kolejność jest ważniejsza niż daty: każdy etap zaczyna się dopiero po przejściu bramki nad nim. Etapy 0 i 1 są w toku. Daty dla etapów 2–4 ustalacie po teście maila.

## Mierniki sukcesu

Pięć wskaźników premiowych i cel dla AI są już ustalone w [docs/wymagania-kpi.md](wymagania-kpi.md) (stan na 24.09.2026). Aplikacja ma je poprawiać i liczyć je z własnych danych, a nie z eksportu HubSpota. Dwa ostatnie mierniki są nowe: mierzą współpracę między zespołami i ich cel jest do ustalenia.

| Miernik | Jak liczony | Cel | Po którym module |
|---|---|---|---|
| SLA pierwszej odpowiedzi | % spraw z odpowiedzią w 30 min (czat) / 2 h (mail), 9–17 | ≥ 90% | 1, 7 |
| FCR | Zamknięta w 4 h i numer transakcji nie wraca w innej sprawie | ≥ 50% | 2, 6 |
| CSAT | Ankieta „CSAT – Email & Phone”, docelowo na bieżąco w aplikacji | ≥ 80% | 8 |
| Retencja | Liczona z transakcji, nie ze spraw | ≥ 50% | 6 |
| QA | Ocena próbki spraw | ≥ 90% | 8 |
| Sprawy rozwiązane przez AI | Według definicji z wymagań KPI (bez „containment surowego”) | baseline 73,5% | 5 |
| Czas przekazania | Mediana od „poproś zespół” do odpowiedzi logistyki / finansów / MS | do ustalenia | 3 |
| Kontakty na transakcję | Sprawy / liczba transakcji w miesiącu | do ustalenia | 8 |

Ostatni miernik jest najważniejszy dla firmy: mówi, czy produkt generuje mniej problemów, a nie tylko czy CS szybciej je gasi.

## Decyzje do podjęcia

- [x] Dziś: wdrożyć poprawkę logowania (punkt 1) i sprawdzić, czy nie powstały już konta na hasło. Kto: Martyna. — `disableSignUp` na `main`; w Neon tylko konto credential Martyny (zapas).
- [ ] Zmienić repo na Private. Kto: Owner organizacji sun-store na GitHubie.
- [ ] Zakres: czy sun.support zastępuje HubSpot tylko w CS, czy staje się miejscem pracy na sprawach dla logistyki, finansów i MS (przekazania z modułu 3).
- [ ] Który zespół wchodzi pierwszy po CS. Propozycja: logistyka, bo sprawy o dostawę i CMR prawie zawsze jej wymagają. Do potwierdzenia udziałem kategorii „Dostawa” na `/dashboard`.
- [ ] Czy Sun Agent w zakładce Support aplikacji sun.store i Sun Agent w mailu to jeden agent z jedną bazą wiedzy. Rekomendacja: tak.
- [ ] Data przełączenia skrzynki CS z HubSpota i co zostaje w HubSpocie (np. kontakty i deale sprzedaży).
- [ ] Cele dla dwóch nowych mierników: czas przekazania i kontakty na transakcję.
