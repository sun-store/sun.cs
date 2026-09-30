// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    neonDatabaseUrl: '',
    betterAuthSecret: '',
    betterAuthUrl: 'http://localhost:3000',
    public: {
      siteName: 'sun.support',
      microsoftSso: Boolean(String(process.env.MICROSOFT_CLIENT_ID || '').trim()),
      googleSso: Boolean(String(process.env.GOOGLE_CLIENT_ID || '').trim()),
      aiEnabled: Boolean(String(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || '').trim())
    }
  },

  compatibilityDate: '2026-06-30',

  nitro: {
    vercel: {
      config: {
        // Żywy mail z Outlooka (docs/OUTLOOK-MAIL.md). Wymaga planu Pro i CRON_SECRET w projekcie.
        crons: [{ path: '/api/cron/mail-sync', schedule: '*/2 * * * *' }]
      }
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
