import { syncOutlookInbox } from '../../services/mail-sync'
import { requireCron } from '../../utils/cron'

export default defineEventHandler(async (event) => {
  requireCron(event)
  try {
    return await syncOutlookInbox()
  } catch (err) {
    throw createError({
      statusCode: 502,
      statusMessage: err instanceof Error ? err.message : 'Synchronizacja poczty nie powiodła się.'
    })
  }
})
