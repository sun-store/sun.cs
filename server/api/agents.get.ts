import { listAgents } from '../services/tickets'
import { requireUser } from '../utils/session'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  return listAgents()
})
