import { neonQuery } from './neon-db'

/** Pierwsza wiadomość klienta — tylko dla podanych spraw (batch, bez correlated subquery). */
export async function loadFirstCustomerTexts(ticketIds: string[]): Promise<Map<string, string>> {
  if (!ticketIds.length) return new Map()
  const rows = await neonQuery<{ ticket_id: string, body: string }>(
    `select distinct on (e.ticket_id)
            e.ticket_id::text as ticket_id,
            left(e.body, 400) as body
     from ticket_events e
     where e.ticket_id = any($1::uuid[])
       and e.sender_type = 'customer'
     order by e.ticket_id, e.created_at asc`,
    [ticketIds]
  )
  const map = new Map<string, string>()
  for (const row of rows) {
    map.set(row.ticket_id, row.body)
  }
  return map
}
