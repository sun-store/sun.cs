import { syncAllowlistFromEnv } from '../services/allowlist'
import { hasNeonConfig } from '../services/neon-db'

export default defineNitroPlugin(async () => {
  if (!hasNeonConfig()) return
  try {
    await syncAllowlistFromEnv()
  } catch {
    // baza może nie być jeszcze zmigrowana
  }
})
