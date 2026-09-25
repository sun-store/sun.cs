export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login' || to.path.startsWith('/dev/') || to.path.startsWith('/auth/')) return
  try {
    await $fetch('/api/me')
  } catch {
    return navigateTo(`/login?next=${encodeURIComponent(to.fullPath)}`)
  }
})
