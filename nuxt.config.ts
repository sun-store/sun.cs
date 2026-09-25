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
      siteName: 'sun.cs',
      microsoftSso: Boolean(String(process.env.MICROSOFT_CLIENT_ID || '').trim()),
      googleSso: Boolean(String(process.env.GOOGLE_CLIENT_ID || '').trim())
    }
  },

  compatibilityDate: '2026-06-30',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
