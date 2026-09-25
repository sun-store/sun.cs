import { createAuthClient } from 'better-auth/vue'

let client: ReturnType<typeof createAuthClient> | null = null

export function useAuthClient() {
  if (client) return client
  client = createAuthClient({
    baseURL: window.location.origin
  })
  return client
}
