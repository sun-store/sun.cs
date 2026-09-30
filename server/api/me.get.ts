import { requireUser } from '../utils/session'
import { hasAiConfig } from '../services/ai'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return {
    ...user,
    aiEnabled: hasAiConfig()
  }
})
