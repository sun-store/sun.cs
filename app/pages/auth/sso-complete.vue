<script setup lang="ts">
definePageMeta({ layout: false, ssr: false })

onMounted(async () => {
  const auth = useAuthClient()
  try {
    await auth.getSession()
    await $fetch('/api/me')
    await navigateTo('/')
  } catch {
    await auth.signOut().catch(() => undefined)
    await navigateTo({ path: '/login', query: { error: 'sso' } })
  }
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center">
    <p class="text-sm text-muted">
      Logowanie kontem firmowym…
    </p>
  </div>
</template>
