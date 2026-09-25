# Wersja webowa na Vercel — sun.cs

Osobny projekt, nie `sun-logistics`. Ta sama baza Neon co lokalnie (albo nowa, jeśli wolisz).

## 1. Kod na GitHubie

Vercel wgrywa z repo. Jeśli `sun.cs` nie ma jeszcze remote: wypchnij folder na GitHub (prywatny), potem wróć tu.

## 2. Nowy projekt Vercel

Na dashboardzie teamu (ten z kafelkami):

1. **Add New → Project**
2. Zaimportuj repo **sun.cs** (nie logistics)
3. Framework: Nuxt (wykryje sam)
4. **jeszcze nie Deploy** — najpierw Environment Variables → Production:

| Name | Skąd |
|---|---|
| `NEON_DATABASE_URL` | to samo co w lokalnym `.env` (pooler) |
| `NEON_DIRECT_URL` | host bez `-pooler` |
| `BETTER_AUTH_SECRET` | to samo co lokalnie |
| `BETTER_AUTH_URL` | `https://<nazwa>.vercel.app` — uzupełnisz po pierwszym deployu, potem Redeploy |
| `AUTH_ALLOWLIST` | jak w `.env.example` |
| `GOOGLE_CLIENT_ID` | nowy klient OAuth projektu GCP **sun-cs** |
| `GOOGLE_CLIENT_SECRET` | ten sam klient, skopiowany przy tworzeniu |
| `LOGISTICS_APP_URL` | `https://sun-logistics.vercel.app` |

5. Deploy. Dostaniesz URL, np. `https://sun-cs.vercel.app`.

## 3. Google — drugi adres (ten sam nowy klient `sun.cs`)

W GCP projekcie **sun-cs**, klient OAuth:

- Źródło JS: `http://localhost:3000` **oraz** `https://sun-cs.vercel.app`
- Przekierowanie: `http://localhost:3000/api/auth/callback/google` **oraz** `https://sun-cs.vercel.app/api/auth/callback/google`

Potem na Vercel ustaw `BETTER_AUTH_URL=https://sun-cs.vercel.app` (bez slasha) i **Redeploy**.

## 4. Wejście

`https://sun-cs.vercel.app/login` — Google albo pierwsze hasło, tylko lista zespołu.
