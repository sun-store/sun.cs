import { requireUser } from '../utils/session'

export default defineEventHandler(async (event) => {
  return requireUser(event)
})
