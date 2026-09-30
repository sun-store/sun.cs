import { resolveTicketAccess } from '../../shared/access'
import type { AppRole } from '../../shared/domain'
import { buildBacklog, type BacklogTicket } from '../../shared/backlog'
import { isDepartment, resolveDepartment, type Department } from '../../shared/departments'
import { needsTopicText } from '../../shared/ticket-topic'
import { loadFirstCustomerTexts } from './first-customer-text'
import { neonQuery } from './neon-db'

type BacklogRow = {
  id: string
  department: string | null
  source_category: string | null
  category: string | null
  owner_id: string | null
  owner_name: string | null
  awaiting: 'us' | 'customer' | null
  reply_due_at: Date | null
  first_contact_at: Date
  subject: string | null
  related_transaction_id: string | null
  ai_next_step: string | null
}

/** Zaległości: wszystkie niezamknięte sprawy w zakresie dostępu osoby (jak lista spraw). */
export async function loadBacklog(actor: { role: AppRole, department?: Department | null }) {
  const access = resolveTicketAccess(actor)
  if (access.type === 'none') return buildBacklog([])
  const params: unknown[] = []
  let accessClause = ''
  if (access.type === 'department') {
    params.push(access.department)
    accessClause = `and t.department = $${params.length}`
  }
  const rows = await neonQuery<BacklogRow>(
    `select t.id::text as id, t.department, t.source_category, t.category, t.owner_id::text as owner_id,
            a.display_name as owner_name, t.awaiting, t.reply_due_at, t.first_contact_at, t.subject,
            t.related_transaction_id,
            t.ai_next_step
     from tickets t
     left join agents a on a.id = t.owner_id
     where t.status <> 'closed' ${accessClause}`,
    params
  )

  const needBodyIds = rows
    .filter(row => needsTopicText(row.source_category))
    .map(row => row.id)
  const bodies = await loadFirstCustomerTexts(needBodyIds)

  const tickets: BacklogTicket[] = rows.map(row => ({
    id: row.id,
    department: row.department && isDepartment(row.department)
      ? row.department
      : resolveDepartment(row.source_category, row.category),
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    awaiting: row.awaiting,
    replyDueAt: row.reply_due_at ? new Date(row.reply_due_at) : null,
    firstContactAt: new Date(row.first_contact_at),
    sourceCategory: row.source_category,
    subject: row.subject,
    firstCustomerText: bodies.get(row.id) ?? null,
    relatedTransactionId: row.related_transaction_id,
    aiNextStep: row.ai_next_step
  }))
  return buildBacklog(tickets)
}
