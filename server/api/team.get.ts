import { listAllowlist } from '../services/allowlist'
import { requireAdmin } from '../utils/session'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return { members: await listAllowlist() }
})
