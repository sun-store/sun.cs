<script setup lang="ts">
const route = useRoute()
const colorMode = useColorMode()
const me = ref<{ name: string, email: string, role?: string } | null>(null)
const { locale, setLocale, t, locales } = useAppLocale()

async function loadMe() {
  if (route.path === '/login' || route.path.startsWith('/dev/') || route.path.startsWith('/auth/')) {
    me.value = null
    return
  }
  try {
    me.value = await $fetch('/api/me')
  } catch {
    me.value = null
  }
}

watch(() => route.path, loadMe, { immediate: true })

async function logout() {
  const auth = useAuthClient()
  await auth.signOut()
  await navigateTo('/login')
}

// Znak sun.support = słońce z ogonkiem dymka (ikona aplikacji). Lockup z kitu ma zwykłe słońce sun.store,
// więc w nagłówku używamy ikony + nazwy, żeby aplikacji nie mylić ze sklepem.
const appIconSrc = computed(() =>
  colorMode.value === 'dark'
    ? '/brand/app-icon/sunstore_app-icon_sun-support_light_v3.svg'
    : '/brand/app-icon/sunstore_app-icon_sun-support_dark_v3.svg'
)

useHead({
  htmlAttrs: { lang: locale },
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
    { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }
  ]
})

useSeoMeta({
  title: 'sun.support',
  description: 'Customer service app for sun.store.'
})

onMounted(() => {
  const saved = localStorage.getItem('sun.support.locale')
  if (saved === 'pl' || saved === 'en') setLocale(saved)
  else if ((navigator.language || '').toLowerCase().startsWith('en')) setLocale('en')
})
</script>

<template>
  <UApp>
    <UHeader
      v-if="route.path !== '/login' && !route.path.startsWith('/dev/') && !route.path.startsWith('/auth/')"
      :ui="{ container: 'max-w-none' }"
    >
      <template #left>
        <div class="flex items-center">
          <NuxtLink
            to="/"
            class="-ms-1 flex items-center gap-2 rounded-md p-1"
            aria-label="sun.support"
          >
            <img
              :src="appIconSrc"
              alt=""
              class="size-7"
              width="28"
              height="28"
            >
            <span class="font-display text-lg leading-none tracking-tight"><span class="font-bold">sun.</span>support</span>
          </NuxtLink>
          <nav class="ms-4 flex gap-1">
            <UButton
              to="/"
              :variant="route.path === '/' || route.path.startsWith('/tickets') ? 'soft' : 'ghost'"
              color="neutral"
              size="sm"
            >
              {{ t('nav', 'tickets') }}
            </UButton>
            <UButton
              to="/dashboard"
              :variant="route.path.startsWith('/dashboard') ? 'soft' : 'ghost'"
              color="neutral"
              size="sm"
            >
              {{ t('nav', 'dashboard') }}
            </UButton>
            <UButton
              to="/wyniki"
              :variant="route.path.startsWith('/wyniki') ? 'soft' : 'ghost'"
              color="neutral"
              size="sm"
            >
              {{ t('nav', 'results') }}
            </UButton>
          </nav>
        </div>
      </template>
      <template #right>
        <div
          class="flex items-center gap-0.5 rounded-md border border-default p-0.5"
          :aria-label="t('common', 'language')"
        >
          <UButton
            v-for="code in locales"
            :key="code"
            size="xs"
            :variant="locale === code ? 'solid' : 'ghost'"
            :color="locale === code ? 'primary' : 'neutral'"
            @click="setLocale(code)"
          >
            {{ code.toUpperCase() }}
          </UButton>
        </div>
        <UButton
          v-if="me?.role === 'admin'"
          to="/team"
          color="neutral"
          variant="ghost"
          size="sm"
        >
          {{ t('nav', 'team') }}
        </UButton>
        <UButton
          to="/tickets/new"
          size="sm"
        >
          {{ t('nav', 'newCase') }}
        </UButton>
        <span class="hidden text-sm text-muted sm:inline">
          {{ me?.name }}
        </span>
        <UColorModeButton />
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          @click="logout"
        >
          {{ t('nav', 'logout') }}
        </UButton>
      </template>
    </UHeader>

    <UMain>
      <!-- Pełna szerokość ekranu: praca na tabeli + panel sprawy potrzebują miejsca. -->
      <div class="px-4 sm:px-6 2xl:px-10">
        <NuxtPage />
      </div>
    </UMain>
  </UApp>
</template>
