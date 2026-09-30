import type {
  AppRole,
  CallStatus,
  Channel,
  MessageDirection,
  SenderType,
  TicketPriority,
  TicketStatus
} from '../../shared/domain'
import {
  CATEGORIES,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  splitHubspotCategories
} from '../../shared/domain'
import { resolveTicketAccess } from '../../shared/access'
import {
  DEPARTMENT_LABELS,
  isDepartment,
  resolveDepartment,
  type Department
} from '../../shared/departments'
import { evaluateSla, lockFirstAgentReply } from '../../shared/sla'
import type { QueueKey } from '../../shared/queues'
import { NOW_WINDOW_MIN } from '../../shared/queues'
import { slaBadge } from '../../shared/sla-label'
import { nextState } from '../../shared/ticket-state'
import type { IdentifierInput } from '../../shared/resolveContact'
import { boundedText, optionalText, TEXT_LIMITS, TICKET_LIST_PAGE_SIZE, TICKET_LIST_PAGE_SIZE_MAX } from '../../shared/text-bounds'
import { ticketTopic, TOPIC_LABELS, TOPIC_NEXT_STEP } from '../../shared/ticket-topic'
import { isUuid } from '../utils/uuid'
import { getNeonPool, neonQuery } from './neon-db'
import { resolveContact } from './contacts'
import { loadCustomerOrders } from './orders'

export type TicketActor = {
  role: AppRole
  agentId: string | null
  department?: Department | null
  name?: string
}

const TICKET_COLUMNS = `t.id, t.contact_id, t.origin_channel, t.status, t.category, t.priority,
            t.related_transaction_id, t.owner_id, t.subject, t.created_at, t.first_contact_at,
            t.first_agent_reply_at, t.closed_at, t.hubspot_ticket_id, t.hubspot_thread_id,
            t.source_category, t.department, t.awaiting, t.reply_due_at,
            t.last_customer_at, t.last_event_at,
            t.ai_summary, t.ai_need, t.ai_next_step, t.ai_summary_at, t.ai_summary_event_at`

/** Początek pierwszej wiadomości klienta — do tematu sprawy (shared/ticket-topic.ts). */
const FIRST_CUSTOMER_TEXT_SQL = `(select left(e.body, 600) from ticket_events e
              where e.ticket_id = t.id and e.sender_type = 'customer'
              order by e.created_at asc limit 1)`

const CALL_STATUS_SQL = `(select e.call_status from ticket_events e
              where e.ticket_id = t.id and e.call_status is not null
              order by e.created_at asc limit 1)`

function accessSql(actor: TicketActor | undefined, params: unknown[], alias = 't'): string {
  const access = resolveTicketAccess(actor)
  if (access.type === 'all') return 'true'
  if (access.type === 'none') return 'false'
  params.push(access.department)
  return `${alias}.department = $${params.length}`
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
  source_category?: string | null
  department?: Department | null
  awaiting?: 'us' | 'customer' | null
  reply_due_at?: Date | null
  last_customer_at?: Date | null
  last_event_at?: Date | null
  ai_summary?: string | null
  ai_need?: string | null
  ai_next_step?: string | null
  ai_summary_at?: Date | null
  ai_summary_event_at?: Date | null
  first_customer_text?: string | null
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

function applyQueueFilter(
  queue: QueueKey | undefined,
  clauses: string[],
  params: unknown[],
  actor?: TicketActor
) {
  if (!queue) return
  if (queue === 'now') {
    clauses.push(`t.awaiting = 'us'`)
    clauses.push(`t.status <> 'closed'`)
    clauses.push('t.reply_due_at is not null')
    clauses.push('t.reply_due_at >= now()')
    params.push(NOW_WINDOW_MIN)
    clauses.push(`t.reply_due_at <= now() + make_interval(mins => $${params.length}::int)`)
    return
  }
  if (queue === 'reply') {
    clauses.push(`t.awaiting = 'us'`)
    clauses.push(`t.status <> 'closed'`)
    return
  }
  if (queue === 'overdue') {
    clauses.push(`t.awaiting = 'us'`)
    clauses.push(`t.status <> 'closed'`)
    clauses.push('t.reply_due_at is not null')
    clauses.push('t.reply_due_at < now()')
    return
  }
  if (queue === 'unassigned') {
    clauses.push('t.owner_id is null')
    clauses.push(`t.status <> 'closed'`)
    return
  }
  if (queue === 'waiting') {
    clauses.push(`t.awaiting = 'customer'`)
    clauses.push(`t.status <> 'closed'`)
    return
  }
  if (queue === 'mine') {
    clauses.push(`t.status <> 'closed'`)
    if (!actor?.agentId) {
      clauses.push('false')
      return
    }
    params.push(actor.agentId)
    clauses.push(`t.owner_id = $${params.length}::uuid`)
  }
}

function orderSqlForQueue(queue: QueueKey | undefined): string {
  if (queue === 'waiting') {
    return 't.business_changed_at desc'
  }
  if (queue === 'now' || queue === 'reply' || queue === 'overdue' || queue === 'unassigned' || queue === 'mine') {
    return 't.reply_due_at asc nulls last, t.business_changed_at desc'
  }
  return 't.business_changed_at desc'
}

export async function listTickets(filters: {
  status?: TicketStatus | 'all'
  channel?: Channel | 'all'
  ownerId?: string | 'all' | 'mine' | 'unassigned'
  department?: Department | 'all'
  queue?: QueueKey
  q?: string
  page?: number
  pageSize?: number
}, actor?: TicketActor) {
  const page = Number.isInteger(filters.page) && (filters.page ?? 0) > 0 ? (filters.page as number) : 1
  const rawSize = Number.isInteger(filters.pageSize) ? (filters.pageSize as number) : TICKET_LIST_PAGE_SIZE
  const pageSize = Math.min(TICKET_LIST_PAGE_SIZE_MAX, Math.max(1, rawSize))
  const offset = (page - 1) * pageSize
  const q = filters.q?.trim() || ''

  const clauses = ['1=1']
  const params: unknown[] = []
  if (q) {
    params.push(`%${q.replace(/[%_\\]/g, '\\$&').slice(0, 200)}%`)
    const likeIdx = params.length
    clauses.push(`(
      t.related_transaction_id ilike $${likeIdx} escape '\\'
      or coalesce(t.subject, '') ilike $${likeIdx} escape '\\'
      or c.display_name ilike $${likeIdx} escape '\\'
      or exists (
        select 1 from contact_identifiers ci
        where ci.contact_id = t.contact_id and ci.value ilike $${likeIdx} escape '\\'
      )
      or exists (
        select 1 from ticket_events e
        where e.ticket_id = t.id and coalesce(e.body, '') ilike $${likeIdx} escape '\\'
      )
    )`)
  } else if (filters.queue) {
    applyQueueFilter(filters.queue, clauses, params, actor)
  } else {
    if (filters.status && filters.status !== 'all') {
      params.push(filters.status)
      clauses.push(`t.status = $${params.length}`)
    }
    if (filters.ownerId === 'unassigned') {
      clauses.push('t.owner_id is null')
    } else if (filters.ownerId === 'mine') {
      if (!actor?.agentId) {
        clauses.push('false')
      } else {
        params.push(actor.agentId)
        clauses.push(`t.owner_id = $${params.length}::uuid`)
      }
    } else if (filters.ownerId && filters.ownerId !== 'all') {
      params.push(filters.ownerId)
      clauses.push(`t.owner_id = $${params.length}::uuid`)
    }
  }
  if (filters.channel && filters.channel !== 'all') {
    params.push(filters.channel)
    clauses.push(`t.origin_channel = $${params.length}`)
  }
  if (filters.department && filters.department !== 'all') {
    params.push(filters.department)
    clauses.push(`t.department = $${params.length}`)
  }
  clauses.push(accessSql(actor, params))
  const whereSql = clauses.join(' and ')

  const countRows = await neonQuery<{ n: string }>(
    `select count(*)::text as n
     from tickets t
     join contacts c on c.id = t.contact_id
     where ${whereSql}`,
    params
  )
  const total = Number(countRows[0]?.n || 0)

  const listParams = [...params, pageSize, offset]
  const limitIdx = params.length + 1
  const offsetIdx = params.length + 2
  const orderSql = q
    ? 't.business_changed_at desc'
    : orderSqlForQueue(filters.queue)
  const rows = await neonQuery<TicketRow>(
    `select ${TICKET_COLUMNS}, c.display_name as contact_name, a.display_name as owner_name,
            ${CALL_STATUS_SQL} as call_status,
            ${FIRST_CUSTOMER_TEXT_SQL} as first_customer_text
     from tickets t
     join contacts c on c.id = t.contact_id
     left join agents a on a.id = t.owner_id
     where ${whereSql}
     order by ${orderSql}
     limit $${limitIdx} offset $${offsetIdx}`,
    listParams
  )
  const tickets = rows.map(row => serializeTicket(row))
  const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize)
  return {
    tickets,
    page,
    pageSize,
    total,
    totalPages,
    truncated: false,
    queue: q ? null : (filters.queue ?? null),
    q: q || null
  }
}

export async function ticketQueueCounts(
  actor?: TicketActor,
  department: Department | 'all' = 'all'
) {
  const params: unknown[] = []
  const deptClause = department !== 'all'
    ? (() => {
        params.push(department)
        return `and t.department = $${params.length}`
      })()
    : ''
  const access = accessSql(actor, params)
  const mineParam = actor?.agentId
    ? (() => {
        params.push(actor.agentId)
        return `$${params.length}::uuid`
      })()
    : 'null'

  const rows = await neonQuery<{
    now: string
    reply: string
    mine: string
    overdue: string
    unassigned: string
    waiting: string
  }>(
    `select
       count(*) filter (
         where t.awaiting = 'us'
           and t.status <> 'closed'
           and t.reply_due_at is not null
           and t.reply_due_at >= now()
           and t.reply_due_at <= now() + make_interval(mins => ${NOW_WINDOW_MIN})
       )::text as now,
       count(*) filter (
         where t.awaiting = 'us' and t.status <> 'closed'
       )::text as reply,
       count(*) filter (
         where t.status <> 'closed' and t.owner_id = ${mineParam}
       )::text as mine,
       count(*) filter (
         where t.awaiting = 'us'
           and t.status <> 'closed'
           and t.reply_due_at is not null
           and t.reply_due_at < now()
       )::text as overdue,
       count(*) filter (
         where t.owner_id is null and t.status <> 'closed'
       )::text as unassigned,
       count(*) filter (
         where t.awaiting = 'customer' and t.status <> 'closed'
       )::text as waiting
     from tickets t
     where ${access} ${deptClause}`,
    params
  )
  const row = rows[0]
  return {
    now: Number(row?.now || 0),
    reply: Number(row?.reply || 0),
    mine: Number(row?.mine || 0),
    overdue: Number(row?.overdue || 0),
    unassigned: Number(row?.unassigned || 0),
    waiting: Number(row?.waiting || 0)
  }
}

export async function claimNext(actor: TicketActor, queue: QueueKey = 'now') {
  if (!actor.agentId) {
    throw new Error('Brak profilu agenta — nie można wziąć sprawy.')
  }
  const params: unknown[] = []
  const clauses: string[] = ['1=1']
  applyQueueFilter(queue, clauses, params, actor)
  clauses.push(`t.awaiting = 'us'`)
  clauses.push(accessSql(actor, params))
  const whereSql = clauses.join(' and ')
  params.push(actor.agentId)
  const agentIdx = params.length

  const rows = await neonQuery<{ id: string }>(
    `update tickets set
       owner_id = coalesce(owner_id, $${agentIdx}::uuid),
       business_changed_at = now()
     where id = (
       select t.id from tickets t
       where ${whereSql}
       order by t.reply_due_at asc nulls last, t.business_changed_at desc
       for update skip locked
       limit 1
     )
     returning id`,
    params
  )
  return rows[0]?.id ?? null
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
  graphMessageId?: string | null
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
  const externalThreadId = optionalText(input.externalThreadId, TEXT_LIMITS.threadId, 'Wątek')
  const graphMessageId = optionalText(input.graphMessageId, TEXT_LIMITS.threadId, 'Id wiadomości')
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
       contact_id, origin_channel, subject, related_transaction_id, owner_id, department,
       first_contact_at, first_agent_reply_at, business_changed_at
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$7)
     returning id`,
    [
      resolved.contact.id,
      input.channel,
      subject,
      relatedTransactionId,
      input.ownerId || null,
      resolveDepartment(null, null),
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
       ticket_id, channel, direction, sender_type, body, subject, call_status, external_thread_id,
       graph_message_id, created_at
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      ticket.id,
      input.channel,
      direction,
      senderType,
      body,
      subject,
      input.callStatus || null,
      externalThreadId,
      graphMessageId,
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
  graphMessageId?: string | null
  occurredAt?: Date
}, actor?: TicketActor) {
  if (!isUuid(ticketId)) return null
  const body = boundedText(input.body, TEXT_LIMITS.body, 'Treść')
  const externalThreadId = optionalText(input.externalThreadId, TEXT_LIMITS.threadId, 'Wątek')
  const graphMessageId = optionalText(input.graphMessageId, TEXT_LIMITS.threadId, 'Id wiadomości')
  const params: unknown[] = [ticketId]
  const access = accessSql(actor, params)
  const tickets = await neonQuery<{
    first_agent_reply_at: Date | null
    closed_at: Date | null
    origin_channel: Channel
    status: TicketStatus
    awaiting: 'us' | 'customer' | null
    reply_due_at: Date | null
  }>(
    `select first_agent_reply_at, closed_at, origin_channel, status, awaiting, reply_due_at
     from tickets t where t.id = $1::uuid and ${access}`,
    params
  )
  if (!tickets[0]) return null

  const now = input.occurredAt || new Date()
  const state = nextState({
    status: tickets[0].status,
    awaiting: tickets[0].awaiting,
    replyDueAt: tickets[0].reply_due_at
  }, {
    senderType: input.senderType,
    direction: input.direction,
    channel: input.channel || tickets[0].origin_channel,
    at: now
  })

  let firstReply = tickets[0].first_agent_reply_at
  if (input.senderType === 'agent' && input.direction === 'to_customer') {
    firstReply = lockFirstAgentReply(firstReply, now)
  }

  const client = await getNeonPool().connect()
  try {
    await client.query('begin')
    await client.query(
      `insert into ticket_events (
         ticket_id, channel, direction, sender_type, body, call_status, external_thread_id, graph_message_id, created_at
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [ticketId, input.channel, input.direction, input.senderType, body, input.callStatus || null, externalThreadId, graphMessageId, now]
    )
    await client.query(
      `update tickets
       set first_agent_reply_at = $2,
           status = $4::ticket_status,
           awaiting = $5,
           reply_due_at = $6,
           last_event_at = $3,
           last_customer_at = case when $7::boolean then $3 else last_customer_at end,
           business_changed_at = $3
       where id = $1`,
      [
        ticketId,
        firstReply,
        now,
        state.status,
        state.awaiting,
        state.replyDueAt,
        input.senderType === 'customer'
      ]
    )
    await client.query('commit')
  } catch (err) {
    await client.query('rollback')
    throw err
  } finally {
    client.release()
  }

  return getTicket(ticketId, actor)
}

export async function updateTicket(ticketId: string, input: {
  ownerId?: string | null
  status?: TicketStatus
  category?: string | null
  priority?: TicketPriority | null
  relatedTransactionId?: string | null
  department?: Department
}, actor?: TicketActor) {
  if (!isUuid(ticketId)) return null
  if (input.ownerId && !isUuid(input.ownerId)) {
    throw new Error('Nieznany właściciel.')
  }
  if (input.department !== undefined && !isDepartment(input.department)) {
    throw new Error('Nieznany dział.')
  }
  const relatedTransactionId = input.relatedTransactionId === undefined
    ? undefined
    : optionalText(input.relatedTransactionId, TEXT_LIMITS.transactionId, 'Numer zlecenia')
  const ownerTouched = Object.hasOwn(input, 'ownerId')
  const departmentTouched = Object.hasOwn(input, 'department')
  const params: unknown[] = [ticketId]
  const access = accessSql(actor, params)
  const current = await neonQuery<{
    status: TicketStatus
    category: string | null
    priority: TicketPriority | null
    owner_id: string | null
    origin_channel: Channel
    department: Department
  }>(
    `select status, category, priority, owner_id, origin_channel, department
     from tickets t where t.id = $1::uuid and ${access}`,
    params
  )
  if (!current[0]) return null

  const nextStatus = input.status ?? current[0].status
  const nextCategory = input.category !== undefined ? input.category : current[0].category
  const nextPriority = input.priority !== undefined ? input.priority : current[0].priority
  const nextOwnerId = ownerTouched ? (input.ownerId ?? null) : current[0].owner_id
  const nextDepartment = departmentTouched
    ? (input.department as Department)
    : current[0].department

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
     set owner_id = case when $7::boolean then $2::uuid else owner_id end,
         status = $3,
         category = $4,
         priority = $5,
         related_transaction_id = coalesce($6, related_transaction_id),
         department = $8,
         closed_at = case when $3 = 'closed' then coalesce(closed_at, now()) else null end,
         business_changed_at = now()
     where id = $1
     returning id`,
    [
      ticketId,
      nextOwnerId,
      nextStatus,
      nextCategory,
      nextPriority,
      relatedTransactionId ?? null,
      ownerTouched,
      nextDepartment
    ]
  )
  if (!updated[0]) return null

  await insertSystemChangeEvents({
    ticketId,
    channel: current[0].origin_channel,
    actorName: actor?.name || 'System',
    before: {
      status: current[0].status,
      category: current[0].category,
      priority: current[0].priority,
      ownerId: current[0].owner_id,
      department: current[0].department
    },
    after: {
      status: nextStatus,
      category: nextCategory,
      priority: nextPriority,
      ownerId: nextOwnerId,
      department: nextDepartment
    }
  })

  return getTicket(ticketId, actor)
}

async function agentLabel(agentId: string | null): Promise<string> {
  if (!agentId) return 'nieprzypisana'
  const rows = await neonQuery<{ display_name: string }>(
    'select display_name from agents where id = $1',
    [agentId]
  )
  return rows[0]?.display_name || agentId
}

function fieldLabel(kind: 'status' | 'category' | 'priority', value: string | null): string {
  if (value == null || value === '') return '—'
  if (kind === 'status' && value in STATUS_LABELS) return STATUS_LABELS[value as TicketStatus]
  if (kind === 'category' && value in CATEGORY_LABELS) {
    return CATEGORY_LABELS[value as typeof CATEGORIES[number]]
  }
  if (kind === 'priority' && value in PRIORITY_LABELS) {
    return PRIORITY_LABELS[value as TicketPriority]
  }
  return value
}

async function insertSystemChangeEvents(input: {
  ticketId: string
  channel: Channel
  actorName: string
  before: {
    status: TicketStatus
    category: string | null
    priority: TicketPriority | null
    ownerId: string | null
    department: Department
  }
  after: {
    status: TicketStatus
    category: string | null
    priority: TicketPriority | null
    ownerId: string | null
    department: Department
  }
}) {
  const lines: string[] = []
  if (input.before.status !== input.after.status) {
    lines.push(
      `Status: ${fieldLabel('status', input.before.status)} → ${fieldLabel('status', input.after.status)}`
    )
  }
  if (input.before.category !== input.after.category) {
    lines.push(
      `Kategoria: ${fieldLabel('category', input.before.category)} → ${fieldLabel('category', input.after.category)}`
    )
  }
  if (input.before.priority !== input.after.priority) {
    lines.push(
      `Priorytet: ${fieldLabel('priority', input.before.priority)} → ${fieldLabel('priority', input.after.priority)}`
    )
  }
  if (input.before.department !== input.after.department) {
    lines.push(
      `Dział: ${DEPARTMENT_LABELS[input.before.department]} → ${DEPARTMENT_LABELS[input.after.department]}`
    )
  }
  if (input.before.ownerId !== input.after.ownerId) {
    const from = await agentLabel(input.before.ownerId)
    const to = await agentLabel(input.after.ownerId)
    lines.push(`Właściciel: ${from} → ${to}`)
  }
  if (!lines.length) return

  const body = boundedText(
    `${input.actorName}\n${lines.join('\n')}`,
    TEXT_LIMITS.body,
    'Historia'
  )
  await neonQuery(
    `insert into ticket_events (
       ticket_id, channel, direction, sender_type, body
     ) values ($1, $2, 'internal', 'system', $3)`,
    [input.ticketId, input.channel, body]
  )
}

export async function listAgents(department?: Department | 'all') {
  const params: unknown[] = []
  let deptSql = ''
  if (department && department !== 'all') {
    params.push(department)
    deptSql = `and s.department = $${params.length}`
  }
  return neonQuery<{
    id: string
    display_name: string
    email: string | null
    department: Department | null
  }>(
    `select a.id, a.display_name, a.email, s.department
     from agents a
     left join staff s on s.user_id = a.user_id
     where a.active = true ${deptSql}
     order by a.display_name`,
    params
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
  const department = (row.department && isDepartment(row.department))
    ? row.department
    : resolveDepartment(row.source_category, row.category)
  // Lista pokazuje tagi HubSpot (np. Unresponsive seller); wewnętrzna kategoria to fallback.
  const hubspotTags = row.source_category?.trim()
    ? splitHubspotCategories(row.source_category).filter(tag => tag !== 'Bez kategorii')
    : []
  const categoryLabel = hubspotTags.length
    ? hubspotTags.join(' · ')
    : (row.category && row.category in CATEGORY_LABELS
        ? CATEGORY_LABELS[row.category as typeof CATEGORIES[number]]
        : (row.category || '—'))
  const topic = ticketTopic({
    sourceCategory: row.source_category,
    subject: row.subject,
    text: row.first_customer_text
      ?? events.find(event => event.sender_type === 'customer')?.body
      ?? null
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
    categoryLabel,
    topic,
    topicLabel: TOPIC_LABELS[topic],
    nextStep: row.ai_next_step?.trim() || TOPIC_NEXT_STEP[topic],
    sourceCategory: row.source_category ?? null,
    department,
    departmentLabel: DEPARTMENT_LABELS[department],
    awaiting: row.awaiting ?? null,
    replyDueAt: row.reply_due_at ?? null,
    slaBadge: slaBadge(row.reply_due_at, row.awaiting),
    lastCustomerAt: row.last_customer_at ?? null,
    lastEventAt: row.last_event_at ?? null,
    aiSummary: row.ai_summary ?? null,
    aiNeed: row.ai_need ?? null,
    aiNextStep: row.ai_next_step ?? null,
    aiSummaryAt: row.ai_summary_at ?? null,
    aiSummaryEventAt: row.ai_summary_event_at ?? null,
    priority: row.priority,
    relatedTransactionId: row.related_transaction_id,
    subject: row.subject,
    summary: row.ai_summary?.trim() || row.subject,
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
