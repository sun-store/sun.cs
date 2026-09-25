# Logowanie firmowe — Better Auth + Google

Osobny projekt GCP **sun-cs**, osobny klient OAuth. Nie używamy klienta `neon` z logistics.

## Lokalnie

- Źródło JS: `http://localhost:3000`
- Przekierowanie: `http://localhost:3000/api/auth/callback/google`

## Vercel (wersja webowa)

Ten sam klient, dopisz:

- Źródło JS: `https://<projekt>.vercel.app`
- Przekierowanie: `https://<projekt>.vercel.app/api/auth/callback/google`

Na Vercel (projekt **sun.cs**, nie logistics):

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
BETTER_AUTH_URL=https://<projekt>.vercel.app
```

Przycisk na `/login` włącza się, gdy jest `GOOGLE_CLIENT_ID`. Sekret zostaje na serwerze.

Krok po kroku deploy: [VERCEL.md](./VERCEL.md).

## Przepływ

1. `/login` → `auth.signIn.social({ provider: 'google', callbackURL: '/auth/sso-complete' })`
2. `/api/auth/callback/google`
3. `/auth/sso-complete` → `/api/me` → inbox

Tylko `@sun.store` (plus Kamil) i lista zespołu. Gmail odpada.
