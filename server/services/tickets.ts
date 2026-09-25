import type {
  CallStatus,
  Channel,
  MessageDirection,
  SenderType,
  TicketPriority,
  TicketStatus
} from '../../shared/domain'
import { CATEGORIES } from '../../shared/domain'
import { evaluateSla, lockFirstAgentReply } from '../../shared/sla'
import type { IdentifierInput } from '../../shared/resolveContact'
import { neonQuery } from './neon-db'
import { resolveContact } from './contacts'
import { loadCustomerOrders } from './orders'

export type TicketRow = {
  id: string
  contact_id: string
  origin_channel: Channel
  status: TicketStatus
  category: string | null
  priority: TicketPriority | null
  related_transaction_id: string | null
  owner_id: string | null
  subject: string | null
  created_at: Date
  first_contact_at: Date
  first_agent_reply_at: Date | null
  closed_at: Date | null
  contact_name: string
  owner_name: string | null
  call_status?: CallStatus | null
  hubspot_ticket_id?: string | null
  hubspot_thread_id?: string | null
}

export type EventRow = {
  id: string
  ticket_id: string
  channel: Channel
  direction: MessageDirection
  sender_type: SenderType
  body: string
  subject: string | null
  email_message_id: string | null
  external_thread_id: string | null
  call_status: CallStatus | null
  call_duration_seconds: number | null
  created_at: Date
}

export async function listTickets(filters: {
  status?: TicketStatus | 'all'
  channel?: Channel | 'all'
  ownerId?: string | 'all'
}) {
  const clauses = ['1=1']
  const params: unknown[] = []
  if (filters.status && filters.status !== 'all') {
    params.push(filters.status)
    clauses.push(`t.status = $${params.length}`)
  }
  if (filters.channel && filters.channel !== 'all') {
    params.push(filters.channel)
    clauses.push(`t.origin_channel = $${params.length}`)
  }
  if (filters.ownerId && filters.ownerId !== 'all') {
    params.push(filters.ownerId)
    clauses.push(`t.owner_id = $${params.length}`)
  }

  const rows = await neonQuery<TicketRow>(
    `select t.*, c.display_name as contact_name, a.display_name as owner_name,
            (select e.call_status from ticket_events e
              where e.ticket_id = t.id and e.call_status is not null
              order by e.created_at limit 1) as call_status
     from tickets t
     join contacts c on c.id = t.contact_id
     left join agents a on a.id = t.owner_id
     where ${clauses.join(' and ')}
     order by t.business_changed_at desc
     limit 1000`,
    params
  )
  return rows.map(row => serializeTicket(row))
}

export async function getTicket(id: string) {
  const rows = await neonQuery<TicketRow>(
    `select t.*, c.display_name as contact_name, a.display_name as owner_name,
            (select e.call_status from ticket_events e
              where e.ticket_id = t.id and e.call_status is not null
              order by e.created_at limit 1) as call_status
     from tickets t
     join contacts c on c.id = t.contact_id
     left join agents a on a.id = t.owner_id
     where t.id = $1`,
    [id]
  )
  if (!rows[0]) return null
  const events = await neonQuery<EventRow>(
    'select * from ticket_events where ticket_id = $1 order by created_at asc',
    [id]
  )
  const ticket = serializeTicket(rows[0], events)
  const { getContact } = await import('./contacts')
  const contact = await getContact(rows[0].contact_id)
  const orders = await loadCustomerOrders({
    sunstoreUserId: contact?.sunstore_user_id,
    relatedTransactionId: rows[0].related_transaction_id
  })
  const conflictIds = contact?.conflictIds ?? []
  return {
    ...ticket,
    events: events.map(serializeEvent),
    contact,
    orders,
    conflict: conflictIds.length > 0,
    conflictIds
  }
}

export async function createTicket(input: {
  displayName: string
  email?: string
  phone?: string
  whatsapp?: string
  customerRole?: 'buyer' | 'seller' | null
  sunstoreUserId?: string | null
  hubspotContactId?: string | null
  channel: Channel
  subject?: string
  body: string
  firstContactAt?: string
  relatedTransactionId?: string | null
  ownerId?: string | null
  callStatus?: CallStatus | null
  senderType?: SenderType
  externalThreadId?: string | null
}) {
  if (input.channel === 'phone' && !input.callStatus) {
    throw new Error('Telefon wymaga statusu odebrania.')
  }
  const identifiers: IdentifierInput[] = []
  if (input.email) identifiers.push({ type: 'email', value: input.email, source: 'manual' })
  if (input.phone) identifiers.push({ type: 'phone', value: input.phone, source: 'manual' })
  if (input.whatsapp) identifiers.push({ type: 'whatsapp', value: input.whatsapp, source: 'manual' })
  if (input.sunstoreUserId) identifiers.push({ type: 'sunstore_user', value: input.sunstoreUserId, source: 'manual' })
  if (input.hubspotContactId) identifiers.push({ type: 'hubspot_contact', value: input.hubspotContactId, source: 'manual' })

  const resolved = await resolveContact({
    displayName: input.displayName,
    customerRole: input.customerRole,
    sunstoreUserId: input.sunstoreUserId,
    hubspotContactId: input.hubspotContactId,
    identifiers,
    source: 'manual'
  })

  const firstContactAt = input.firstContactAt ? new Date(input.firstContactAt) : new Date()
  const senderType = input.senderType || 'customer'
  const direction = senderType === 'agent' ? 'to_customer' : 'to_customer'
  const firstAgentReplyAt = senderType === 'agent' || input.callStatus === 'answered'
    ? firstContactAt
    : null

  const created = await neonQuery<{ id: string }>(
    `insert into tickets (
       contact_id, origin_channel, subject, related_transaction_id, owner_id,
       first_contact_at, first_agent_reply_at, business_changed_at
     ) values ($1,$2,$3,$4,$5,$6,$7,$6)
     returning id`,
    [
      resolved.contact.id,
      input.channel,
      input.subject?.trim() || null,
      input.relatedTransactionId?.trim() || null,
      input.ownerId || null,
      firstContactAt,
      firstAgentReplyAt
    ]
  )

  await neonQuery(
    `insert into ticket_events (
       ticket_id, channel, direction, sender_type, body, subject, call_status, external_thread_id, created_at
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      created[0].id,
      input.channel,
      direction,
      senderType,
      input.body,
      input.subject?.trim() || null,
      input.callStatus || null,
      input.externalThreadId || null,
      firstContactAt
    ]
  )

  return getTicket(created[0].id)
}

export async function addEvent(ticketId: string, input: {
  channel: Channel
  direction: MessageDirection
  senderType: SenderType
  body: string
  callStatus?: CallStatus | null
  externalThreadId?: string | null
  occurredAt?: Date
}) {
  const tickets = await neonQuery<{
    first_agent_reply_at: Date | null
    closed_at: Date | null
  }>(
    'select first_agent_reply_at, closed_at from tickets where id = $1',
    [ticketId]
  )
  if (!tickets[0]) return null
  if (tickets[0].closed_at) {
    throw new Error('Nie można dopisać wydarzenia do zamkniętej sprawy.')
  }

  const now = input.occurredAt || new Date()
  await neonQuery(
    `insert into ticket_events (ticket_id, channel, direction, sender_type, body, call_status, external_thread_id, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [ticketId, input.channel, input.direction, input.senderType, input.body, input.callStatus || null, input.externalThreadId || null, now]
  )

  let firstReply = tickets[0].first_agent_reply_at
  if (input.senderType === 'agent' && input.direction === 'to_customer') {
    firstReply = lockFirstAgentReply(firstReply, now)
  }

  await neonQuery(
    `update tickets
     set first_agent_reply_at = $2,
         status = case when status = 'closed' then status else 'waiting' end,
         business_changed_at = $3
     where id = $1`,
    [ticketId, firstReply, now]
  )

  return getTicket(ticketId)
}

export async function updateTicket(ticketId: string, input: {
  ownerId?: string | null
  status?: TicketStatus
  category?: string | null
  priority?: TicketPriority | null
  relatedTransactionId?: string | null
}) {
  const current = await neonQuery<{
    status: TicketStatus
    category: string | null
    priority: TicketPriority | null
  }>(
    'select status, category, priority from tickets where id = $1',
    [ticketId]
  )
  if (!current[0]) return null

  const nextStatus = input.status ?? current[0].status
  const nextCategory = input.category !== undefined ? input.category : current[0].category
  const nextPriority = input.priority !== undefined ? input.priority : current[0].priority

  if (nextStatus === 'closed') {
    if (!nextCategory || !CATEGORIES.includes(nextCategory as typeof CATEGORIES[number])) {
      throw new Error('Zamknięcie wymaga kategorii.')
    }
    if (!nextPriority) {
      throw new Error('Zamknięcie wymaga priorytetu.')
    }
  }

  await neonQuery(
    `update tickets
     set owner_id = coalesce($2, owner_id),
         status = $3,
         category = $4,
         priority = $5,
         related_transaction_id = coalesce($6, related_transaction_id),
         closed_at = case when $3 = 'closed' then coalesce(closed_at, now()) else null end,
         business_changed_at = now()
     where id = $1`,
    [
      ticketId,
      input.ownerId ?? null,
      nextStatus,
      nextCategory,
      nextPriority,
      input.relatedTransactionId ?? null
    ]
  )
  return getTicket(ticketId)
}

export async function listAgents() {
  return neonQuery<{ id: string, display_name: string, email: string | null }>(
    'select id, display_name, email from agents where active = true order by display_name'
  )
}

export async function createAgent(displayName: string, email?: string) {
  const rows = await neonQuery<{ id: string, display_name: string, email: string | null }>(
    `insert into agents (display_name, email)
     values ($1, $2)
     returning id, display_name, email`,
    [displayName.trim(), email?.trim().toLowerCase() || null]
  )
  return rows[0]
}

export async function ticketSummary() {
  const rows = await listTickets({ status: 'all' })
  const open = rows.filter(row => row.status !== 'closed')
  const slaPool = rows.filter(row => row.sla.eligible)
  const slaMet = slaPool.filter(row => row.sla.met)
  return {
    open: open.length,
    slaEligible: slaPool.length,
    slaMet: slaMet.length
  }
}

function serializeTicket(row: TicketRow, events: EventRow[] = []) {
  const callStatus = events.find(event => event.call_status)?.call_status
    ?? row.call_status
    ?? null
  const sla = evaluateSla({
    channel: row.origin_channel,
    firstContactAt: new Date(row.first_contact_at),
    firstAgentReplyAt: row.first_agent_reply_at ? new Date(row.first_agent_reply_at) : null,
    callStatus
  })
  return {
    id: row.id,
    contactId: row.contact_id,
    contactName: row.contact_name,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    channel: row.origin_channel,
    status: row.status,
    category: row.category,
    priority: row.priority,
    relatedTransactionId: row.related_transaction_id,
    subject: row.subject,
    createdAt: row.created_at,
    firstContactAt: row.first_contact_at,
    firstAgentReplyAt: row.first_agent_reply_at,
    closedAt: row.closed_at,
    hubspotTicketId: row.hubspot_ticket_id ?? null,
    hubspotThreadId: row.hubspot_thread_id ?? null,
    sla
  }
}

function serializeEvent(row: EventRow) {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    channel: row.channel,
    direction: row.direction,
    senderType: row.sender_type,
    body: row.body,
    subject: row.subject,
    callStatus: row.call_status,
    createdAt: row.created_at
  }
}
