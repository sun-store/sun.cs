import type {
  AppRole,
  CallStatus,
  Channel,
  MessageDirection,
  SenderType,
  TicketPriority,
  TicketStatus
} from '../../shared/domain'
import { CATEGORIES } from '../../shared/domain'
import { seesAllTickets } from '../../shared/access'
import { evaluateSla, lockFirstAgentReply } from '../../shared/sla'
import type { IdentifierInput } from '../../shared/resolveContact'
import { boundedText, optionalText, TEXT_LIMITS, TICKET_LIST_LIMIT } from '../../shared/text-bounds'
import { isUuid } from '../utils/uuid'
import { neonQuery } from './neon-db'
import { resolveContact } from './contacts'
import { loadCustomerOrders } from './orders'

export type TicketActor = {
  role: AppRole
  agentId: string | null
}

const TICKET_COLUMNS = `t.id, t.contact_id, t.origin_channel, t.status, t.category, t.priority,
            t.related_transaction_id, t.owner_id, t.subject, t.created_at, t.first_contact_at,
            t.first_agent_reply_at, t.closed_at, t.hubspot_ticket_id, t.hubspot_thread_id`

const CALL_STATUS_SQL = `(select e.call_status from ticket_events e
              where e.ticket_id = t.id and e.call_status is not null
              order by e.created_at asc limit 1)`

function accessSql(actor: TicketActor | undefined, params: unknown[], alias = 't'): string {
  if (!actor || seesAllTickets(actor.role)) return 'true'
  params.push(actor.agentId)
  return `${alias}.owner_id = $${params.length}::uuid`
}

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
}, actor?: TicketActor) {
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
    clauses.push(`t.owner_id = $${params.length}::uuid`)
  }
  clauses.push(accessSql(actor, params))
  params.push(TICKET_LIST_LIMIT + 1)

  const rows = await neonQuery<TicketRow>(
    `select ${TICKET_COLUMNS}, c.display_name as contact_name, a.display_name as owner_name,
            ${CALL_STATUS_SQL} as call_status
     from tickets t
     join contacts c on c.id = t.contact_id
     left join agents a on a.id = t.owner_id
     where ${clauses.join(' and ')}
     order by t.business_changed_at desc
     limit $${params.length}`,
    params
  )
  const truncated = rows.length > TICKET_LIST_LIMIT
  const tickets = (truncated ? rows.slice(0, TICKET_LIST_LIMIT) : rows).map(row => serializeTicket(row))
  return { tickets, truncated }
}

export async function getTicket(id: string, actor?: TicketActor) {
  if (!isUuid(id)) return null
  const params: unknown[] = [id]
  const access = accessSql(actor, params)
  const rows = await neonQuery<TicketRow>(
    `select ${TICKET_COLUMNS}, c.display_name as contact_name, a.display_name as owner_name,
            ${CALL_STATUS_SQL} as call_status
     from tickets t
     join contacts c on c.id = t.contact_id
     left join agents a on a.id = t.owner_id
     where t.id = $1::uuid and ${access}`,
    params
  )
  if (!rows[0]) return null
  const events = await neonQuery<EventRow>(
    `select id, ticket_id, channel, direction, sender_type, body, subject,
            email_message_id, external_thread_id, call_status, call_duration_seconds, created_at
     from ticket_events
     where ticket_id = $1
     order by created_at asc`,
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
  const displayName = boundedText(input.displayName, TEXT_LIMITS.name, 'Imię')
  if (!displayName) throw new Error('Wymagane: imię.')
  const body = boundedText(input.body, TEXT_LIMITS.body, 'Treść')
  if (!body) throw new Error('Wymagane: treść.')
  const subject = optionalText(input.subject, TEXT_LIMITS.subject, 'Temat')
  const email = optionalText(input.email, TEXT_LIMITS.email, 'E-mail')
  const phone = optionalText(input.phone, TEXT_LIMITS.phone, 'Telefon')
  const whatsapp = optionalText(input.whatsapp, TEXT_LIMITS.phone, 'WhatsApp')
  const sunstoreUserId = optionalText(input.sunstoreUserId, TEXT_LIMITS.externalId, 'Id sun.store')
  const hubspotContactId = optionalText(input.hubspotContactId, TEXT_LIMITS.externalId, 'Id HubSpot')
  const relatedTransactionId = optionalText(input.relatedTransactionId, TEXT_LIMITS.transactionId, 'Numer zlecenia')
  const externalThreadId = optionalText(input.externalThreadId, TEXT_LIMITS.externalId, 'Wątek')
  if (input.ownerId && !isUuid(input.ownerId)) {
    throw new Error('Nieznany właściciel.')
  }
  if (input.channel === 'phone' && !input.callStatus) {
    throw new Error('Telefon wymaga statusu odebrania.')
  }
  const identifiers: IdentifierInput[] = []
  if (email) identifiers.push({ type: 'email', value: email, source: 'manual' })
  if (phone) identifiers.push({ type: 'phone', value: phone, source: 'manual' })
  if (whatsapp) identifiers.push({ type: 'whatsapp', value: whatsapp, source: 'manual' })
  if (sunstoreUserId) identifiers.push({ type: 'sunstore_user', value: sunstoreUserId, source: 'manual' })
  if (hubspotContactId) identifiers.push({ type: 'hubspot_contact', value: hubspotContactId, source: 'manual' })

  const resolved = await resolveContact({
    displayName,
    customerRole: input.customerRole,
    sunstoreUserId,
    hubspotContactId,
    identifiers,
    source: 'manual'
  })

  const firstContactAt = input.firstContactAt ? new Date(input.firstContactAt) : new Date()
  if (Number.isNaN(firstContactAt.getTime())) {
    throw new Error('Nieprawidłowa data kontaktu.')
  }
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
      subject,
      relatedTransactionId,
      input.ownerId || null,
      firstContactAt,
      firstAgentReplyAt
    ]
  )

  const ticket = created[0]
  if (!ticket) {
    throw new Error('Nie udało się utworzyć sprawy.')
  }

  await neonQuery(
    `insert into ticket_events (
       ticket_id, channel, direction, sender_type, body, subject, call_status, external_thread_id, created_at
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      ticket.id,
      input.channel,
      direction,
      senderType,
      body,
      subject,
      input.callStatus || null,
      externalThreadId,
      firstContactAt
    ]
  )

  return getTicket(ticket.id)
}

export async function addEvent(ticketId: string, input: {
  channel: Channel
  direction: MessageDirection
  senderType: SenderType
  body: string
  callStatus?: CallStatus | null
  externalThreadId?: string | null
  occurredAt?: Date
}, actor?: TicketActor) {
  if (!isUuid(ticketId)) return null
  const body = boundedText(input.body, TEXT_LIMITS.body, 'Treść')
  const externalThreadId = optionalText(input.externalThreadId, TEXT_LIMITS.externalId, 'Wątek')
  const params: unknown[] = [ticketId]
  const access = accessSql(actor, params)
  const tickets = await neonQuery<{
    first_agent_reply_at: Date | null
    closed_at: Date | null
  }>(
    `select first_agent_reply_at, closed_at from tickets t where t.id = $1::uuid and ${access}`,
    params
  )
  if (!tickets[0]) return null
  if (tickets[0].closed_at) {
    throw new Error('Nie można dopisać wydarzenia do zamkniętej sprawy.')
  }

  const now = input.occurredAt || new Date()
  await neonQuery(
    `insert into ticket_events (ticket_id, channel, direction, sender_type, body, call_status, external_thread_id, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [ticketId, input.channel, input.direction, input.senderType, body, input.callStatus || null, externalThreadId, now]
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

  return getTicket(ticketId, actor)
}

export async function updateTicket(ticketId: string, input: {
  ownerId?: string | null
  status?: TicketStatus
  category?: string | null
  priority?: TicketPriority | null
  relatedTransactionId?: string | null
}, actor?: TicketActor) {
  if (!isUuid(ticketId)) return null
  if (input.ownerId && !isUuid(input.ownerId)) {
    throw new Error('Nieznany właściciel.')
  }
  const relatedTransactionId = input.relatedTransactionId === undefined
    ? undefined
    : optionalText(input.relatedTransactionId, TEXT_LIMITS.transactionId, 'Numer zlecenia')
  const params: unknown[] = [ticketId]
  const access = accessSql(actor, params)
  const current = await neonQuery<{
    status: TicketStatus
    category: string | null
    priority: TicketPriority | null
  }>(
    `select status, category, priority from tickets t where t.id = $1::uuid and ${access}`,
    params
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

  const updated = await neonQuery<{ id: string }>(
    `update tickets
     set owner_id = coalesce($2, owner_id),
         status = $3,
         category = $4,
         priority = $5,
         related_transaction_id = coalesce($6, related_transaction_id),
         closed_at = case when $3 = 'closed' then coalesce(closed_at, now()) else null end,
         business_changed_at = now()
     where id = $1
     returning id`,
    [
      ticketId,
      input.ownerId ?? null,
      nextStatus,
      nextCategory,
      nextPriority,
      relatedTransactionId ?? null
    ]
  )
  if (!updated[0]) return null
  return getTicket(ticketId, actor)
}

export async function listAgents() {
  return neonQuery<{ id: string, display_name: string, email: string | null }>(
    'select id, display_name, email from agents where active = true order by display_name'
  )
}

export async function createAgent(displayName: string, email?: string) {
  const name = boundedText(displayName, TEXT_LIMITS.name, 'Imię')
  if (!name) throw new Error('Podaj imię agenta.')
  const normalizedEmail = optionalText(email, TEXT_LIMITS.email, 'E-mail')?.toLowerCase() ?? null
  const rows = await neonQuery<{ id: string, display_name: string, email: string | null }>(
    `insert into agents (display_name, email)
     values ($1, $2)
     returning id, display_name, email`,
    [name, normalizedEmail]
  )
  return rows[0]
}

export async function ticketSummary(actor?: TicketActor) {
  const params: unknown[] = []
  const access = accessSql(actor, params)
  const rows = await neonQuery<{
    status: TicketStatus
    origin_channel: TicketRow['origin_channel']
    first_contact_at: Date
    first_agent_reply_at: Date | null
    call_status: CallStatus | null
  }>(
    `select t.status, t.origin_channel, t.first_contact_at, t.first_agent_reply_at,
            ${CALL_STATUS_SQL} as call_status
     from tickets t
     where ${access}`,
    params
  )
  let open = 0
  let slaEligible = 0
  let slaMet = 0
  for (const row of rows) {
    if (row.status !== 'closed') open += 1
    const sla = evaluateSla({
      channel: row.origin_channel,
      firstContactAt: new Date(row.first_contact_at),
      firstAgentReplyAt: row.first_agent_reply_at ? new Date(row.first_agent_reply_at) : null,
      callStatus: row.call_status
    })
    if (!sla.eligible) continue
    slaEligible += 1
    if (sla.met) slaMet += 1
  }
  return { open, slaEligible, slaMet }
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
