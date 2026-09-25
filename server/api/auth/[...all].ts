import { getBetterAuth } from '../../services/auth'
import { hasNeonConfig } from '../../services/neon-db'

export default defineEventHandler((event) => {
  if (!hasNeonConfig()) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Brak NEON_DATABASE_URL.'
    })
  }
  return getBetterAuth().handler(toWebRequest(event))
})
