<script setup lang="ts">
const route = useRoute()
const colorMode = useColorMode()
const me = ref<{ name: string, email: string, role?: string } | null>(null)

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

const lockupSrc = computed(() =>
  colorMode.value === 'dark'
    ? '/brand/logo/sunstore_logo_sun-support_lockup-white_v3.svg'
    : '/brand/logo/sunstore_logo_sun-support_lockup-black_v3.svg'
)

useHead({
  htmlAttrs: { lang: 'pl' },
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
</script>

<template>
  <UApp>
    <UHeader v-if="route.path !== '/login' && !route.path.startsWith('/dev/') && !route.path.startsWith('/auth/')">
      <template #left>
        <div class="flex items-center">
          <NuxtLink
            to="/"
            class="rounded-md p-1 -ms-1"
            aria-label="sun.support"
          >
            <img
              :src="lockupSrc"
              alt="sun.support"
              class="h-5 w-auto"
              height="20"
            >
          </NuxtLink>
          <nav class="ms-4 flex gap-1">
            <UButton
              to="/"
              :variant="route.path === '/' || route.path.startsWith('/tickets') ? 'soft' : 'ghost'"
              color="neutral"
              size="sm"
            >
              Tickety
            </UButton>
            <UButton
              to="/dashboard"
              :variant="route.path.startsWith('/dashboard') ? 'soft' : 'ghost'"
              color="neutral"
              size="sm"
            >
              Dashboard
            </UButton>
            <UButton
              to="/wyniki"
              :variant="route.path.startsWith('/wyniki') ? 'soft' : 'ghost'"
              color="neutral"
              size="sm"
            >
              Wyniki
            </UButton>
          </nav>
        </div>
      </template>
      <template #right>
        <UButton
          v-if="me?.role === 'admin'"
          to="/team"
          color="neutral"
          variant="ghost"
          size="sm"
        >
          Zespół
        </UButton>
        <UButton
          to="/tickets/new"
          size="sm"
        >
          Nowa sprawa
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
          Wyloguj
        </UButton>
      </template>
    </UHeader>

    <UMain>
      <UContainer>
        <NuxtPage />
      </UContainer>
    </UMain>
  </UApp>
</template>
