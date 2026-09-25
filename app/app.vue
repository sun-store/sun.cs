<script setup lang="ts">
const route = useRoute()
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

useHead({
  htmlAttrs: { lang: 'pl' }
})

useSeoMeta({
  title: 'sun.cs',
  description: 'Ticketownia Customer Support sun.store.'
})
</script>

<template>
  <UApp>
    <UHeader v-if="route.path !== '/login' && !route.path.startsWith('/dev/') && !route.path.startsWith('/auth/')">
      <template #left>
        <NuxtLink
          to="/"
          class="rounded-md p-1 -ms-1 font-semibold tracking-tight"
        >
          sun.cs
        </NuxtLink>
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
