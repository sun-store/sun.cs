/**
 *   node scripts/import-hubspot-september.mjs
 *
 * Import września 2026: tickety HubSpot z delt BigQuery
 * + wątki Customer Chat 2.0 z conversations-2026-09-*.json.
 * Ponowne uruchomienie nic nie dubluje.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'

const YEAR = 2026
const MONTH = 8
const CS_JULY = resolve('C:/Users/martyna.kalicka/Downloads/cs_july_work')
const DOWNLOADS = resolve('C:/Users/martyna.kalicka/Downloads')
function listBqTicketFiles() {
  const dir = resolve(CS_JULY, 'bq_raw')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(name => /^tickets_delta.*\.json$/i.test(name))
    .sort()
    .map(name => resolve(dir, name))
}
const BOT_OWNER_IDS = new Set(['34396953', '30675564'])
// Sun Agent (sun.agent@sun.store) to bot: jego sprawy mają trafić do „Nieprzypisane”, żeby wziął je człowiek.
const BOT_EMAIL_RE = /aichatbot|customer agent|sunstore agent|sun\.agent@/i
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const TX_RE = /(?:sun\.store\/(?:[a-z]{2}\/)?transaction\/|transaction\s*#\s*)([A-Za-z0-9]{8})/i
const HS_TICKET_RE = /logged ticket\s+(\d{8,})|ticket[:\s#]+(\d{10,})/i

function loadEnvFile(name) {
  try {
    const text = readFileSync(resolve(name), 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith('\'') && value.endsWith('\''))
      ) {
        value = value.slice(1, -1)
      }
      if (process.env[key] == null) process.env[key] = value
    }
  } catch {
    // optional
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

function strip(url) {
  return String(url || '')
    .replace(/([?&])channel_binding=require&?/g, '$1')
    .replace(/[?&]$/, '')
}

function inSeptember(date) {
  return Boolean(date && date.getUTCFullYear() === YEAR && date.getUTCMonth() === MONTH)
}

function msToDate(value) {
  if (value == null || value === '') return null
  const ms = typeof value === 'string' ? Number.parseFloat(value) : value
  if (Number.isNaN(ms)) return null
  return new Date(ms)
}

function bqRowsToObjects(file) {
  const data = JSON.parse(readFileSync(file, 'utf8'))
  const fields = data.schema.fields.map(field => field.name)
  return (data.rows || []).map((row) => {
    const obj = {}
    row.f.forEach((cell, index) => {
      obj[fields[index]] = cell.v
    })
    return obj
  })
}

function mapChannel(source) {
  const value = String(source || '').toLowerCase()
  if (value === 'chat') return 'chat'
  if (value === 'email') return 'email'
  if (value === 'phone') return 'phone'
  if (value === 'form') return 'form'
  if (value === 'whats_app' || value === 'whatsapp') return 'whatsapp'
  return 'form'
}

function mapCategory(raw) {
  if (!raw) return 'other'
  const parts = String(raw).split(';').map(part => part.trim().toLowerCase())
  const table = {
    'dbss issue': 'delivery',
    'logistics issue': 'delivery',
    'claim': 'delivery',
    'sun.finance': 'payment',
    'no vat': 'payment',
    'lost on platform': 'account',
    'offer request': 'product',
    'spam': 'other',
    'other': 'other',
    'unresponsive seller': 'other'
  }
  for (const part of parts) {
    if (table[part]) return table[part]
  }
  return 'other'
}

function mapPriority(raw) {
  const value = String(raw || '').toUpperCase()
  if (value === 'LOW') return 'low'
  if (value === 'HIGH') return 'high'
  if (value === 'URGENT' || value === 'CRITICAL') return 'urgent'
  return 'medium'
}

function extractEmails(text) {
  if (!text) return []
  return [...new Set((String(text).match(EMAIL_RE) || []).map(email => email.toLowerCase()))]
}

function extractTransactionId(...texts) {
  for (const text of texts) {
    if (!text) continue
    const match = String(text).match(TX_RE)
    if (match) return match[1]
  }
  return null
}

function extractHubspotTicketId(...texts) {
  for (const text of texts) {
    if (!text) continue
    const match = String(text).match(HS_TICKET_RE)
    if (match) return match[1] || match[2]
  }
  return null
}

function ownerName(owner) {
  return [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim() || owner.email || owner.id
}

function isBotOwner(owner) {
  if (!owner) return true
  if (BOT_OWNER_IDS.has(String(owner.id))) return true
  return BOT_EMAIL_RE.test(`${owner.email || ''} ${owner.firstName || ''} ${owner.lastName || ''}`)
}

function loadOwners() {
  // Świeża lista z BigQuery (npm run db:pull-bq) wygrywa ze starym zrzutem z lipca.
  const fresh = resolve(CS_JULY, 'bq_raw/owners.json')
  const path = existsSync(fresh) ? fresh : resolve(CS_JULY, 'node/owners.json')
  const rows = JSON.parse(readFileSync(path, 'utf8'))
  return new Map(rows.map(row => [String(row.id), row]))
}

function loadSeptemberTickets() {
  const byId = new Map()
  for (const full of listBqTicketFiles()) {
    for (const row of bqRowsToObjects(full)) byId.set(String(row.id), row)
  }
  return [...byId.values()].filter((row) => {
    const created = msToDate(row.create_ms)
    const closed = msToDate(row.closed_ms) || msToDate(row.last_closed_ms)
    return inSeptember(created) || inSeptember(closed)
  })
}

function loadSeptemberThreads() {
  const files = readdirSync(DOWNLOADS)
    .filter(name => /^conversations-2026-09-.*\.json$/i.test(name))
    .map(name => resolve(DOWNLOADS, name))
  const byId = new Map()
  for (const file of files) {
    const data = JSON.parse(readFileSync(file, 'utf8'))
    for (const thread of data.threads || []) {
      if (!inSeptember(new Date(thread.created_at))) continue
      const prev = byId.get(thread.id)
      if (!prev || (thread.messages || []).length >= (prev.messages || []).length) {
        byId.set(thread.id, thread)
      }
    }
  }
  return [...byId.values()]
}

function actorOwnerId(actorId) {
  const match = String(actorId || '').match(/^A-(\d+)$/)
  return match ? match[1] : null
}

async function upsertAgents(client, owners, neededIds) {
  const cache = new Map()
  for (const id of neededIds) {
    const owner = owners.get(String(id))
    if (!owner || isBotOwner(owner)) continue
    const email = owner.email && owner.email.includes('@') ? owner.email.toLowerCase() : null
    if (!email || cache.has(email)) continue
    const { rows } = await client.query(
      `insert into agents (display_name, email)
       values ($1, $2)
       on conflict (email) do update set display_name = excluded.display_name
       returning id`,
      [ownerName(owner), email]
    )
    cache.set(String(id), rows[0].id)
    cache.set(email, rows[0].id)
  }
  return cache
}

async function resolveImportedContact(client, input) {
  const identifiers = []
  if (input.hubspotContactId) {
    identifiers.push({ type: 'hubspot_contact', value: String(input.hubspotContactId) })
  }
  for (const email of input.emails || []) {
    identifiers.push({ type: 'email', value: email })
  }
  if (!identifiers.length) {
    identifiers.push({ type: 'hubspot_contact', value: `orphan-${input.fallbackId}` })
  }

  if (input.hubspotContactId) {
    const { rows } = await client.query(
      'select id from contacts where hubspot_contact_id = $1',
      [String(input.hubspotContactId)]
    )
    if (rows[0]) {
      await attachIdentifiers(client, rows[0].id, identifiers)
      return rows[0].id
    }
  }

  for (const identifier of identifiers) {
    const { rows } = await client.query(
      'select contact_id from contact_identifiers where type = $1 and value = $2',
      [identifier.type, identifier.value]
    )
    if (rows[0]) {
      if (input.hubspotContactId) {
        await client.query(
          `update contacts
           set hubspot_contact_id = coalesce(hubspot_contact_id, $2),
               display_name = coalesce(nullif($3, ''), display_name)
           where id = $1`,
          [rows[0].contact_id, String(input.hubspotContactId), input.displayName || '']
        )
      }
      await attachIdentifiers(client, rows[0].contact_id, identifiers)
      return rows[0].contact_id
    }
  }

  const { rows } = await client.query(
    `insert into contacts (display_name, hubspot_contact_id)
     values ($1, $2)
     returning id`,
    [
      input.displayName || input.emails?.[0] || `HubSpot ${input.fallbackId}`,
      input.hubspotContactId ? String(input.hubspotContactId) : null
    ]
  )
  await attachIdentifiers(client, rows[0].id, identifiers)
  return rows[0].id
}

async function attachIdentifiers(client, contactId, identifiers) {
  for (const identifier of identifiers) {
    await client.query(
      `insert into contact_identifiers (contact_id, type, value, source)
       values ($1, $2, $3, 'hubspot-import')
       on conflict (type, value) do nothing`,
      [contactId, identifier.type, identifier.value]
    )
  }
}

async function insertEvents(client, events) {
  if (!events.length) return
  const chunkSize = 80
  for (let offset = 0; offset < events.length; offset += chunkSize) {
    const chunk = events.slice(offset, offset + chunkSize)
    const values = []
    const params = []
    chunk.forEach((event, index) => {
      const base = index * 8
      values.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8})`)
      params.push(
        event.ticketId,
        event.channel,
        event.direction,
        event.senderType,
        event.body,
        event.subject,
        event.externalThreadId,
        event.createdAt
      )
    })
    await client.query(
      `insert into ticket_events (
         ticket_id, channel, direction, sender_type, body, subject, external_thread_id, created_at
       ) values ${values.join(',')}`,
      params
    )
  }
}

async function insertTicket(client, ticket) {
  const { rows } = await client.query(
    `insert into tickets (
       contact_id, origin_channel, status, category, source_category, priority, related_transaction_id,
       owner_id, subject, created_at, first_contact_at, first_agent_reply_at, closed_at,
       business_changed_at, hubspot_ticket_id, hubspot_thread_id
     ) values (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
     )
     returning id`,
    [
      ticket.contactId,
      ticket.channel,
      ticket.status,
      ticket.category,
      ticket.sourceCategory,
      ticket.priority,
      ticket.relatedTransactionId,
      ticket.ownerId,
      ticket.subject,
      ticket.createdAt,
      ticket.firstContactAt,
      ticket.firstAgentReplyAt,
      ticket.closedAt,
      ticket.businessChangedAt,
      ticket.hubspotTicketId,
      ticket.hubspotThreadId
    ]
  )
  return rows[0].id
}

async function main() {
  const connectionString = strip(process.env.NEON_DATABASE_URL || process.env.NEON_DIRECT_URL || '')
  if (!connectionString) {
    console.error('Brak NEON_DATABASE_URL / NEON_DIRECT_URL.')
    process.exit(1)
  }

  const owners = loadOwners()
  const tickets = loadSeptemberTickets()
  const threads = loadSeptemberThreads()
  const latestTicketCreate = tickets
    .map(row => msToDate(row.create_ms))
    .filter(Boolean)
    .sort((a, b) => b - a)[0]
  const latestThread = threads
    .map(thread => new Date(thread.latest_message_at || thread.created_at))
    .sort((a, b) => b - a)[0]

  const neededOwnerIds = new Set()
  for (const row of tickets) {
    if (row.owner_id) neededOwnerIds.add(String(row.owner_id))
  }
  for (const thread of threads) {
    const assigned = actorOwnerId(thread.assigned_to)
    if (assigned) neededOwnerIds.add(assigned)
    for (const message of thread.messages || []) {
      const ownerId = actorOwnerId(message.actor_id)
      if (ownerId) neededOwnerIds.add(ownerId)
    }
  }

  const client = new pg.Client({
    connectionString,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    connectionTimeoutMillis: 60_000,
    ssl: /neon\.tech/i.test(connectionString) ? { rejectUnauthorized: false } : undefined
  })
  client.on('error', (err) => {
    console.error('pg client error:', err.message)
  })
  await client.connect()
  await client.query('select 1')

  const stats = {
    ticketsInserted: 0,
    ticketsSkipped: 0,
    ticketsUpdated: 0,
    threadsInserted: 0,
    threadsMerged: 0,
    threadsSkipped: 0,
    events: 0
  }

  try {
    const existingTickets = await client.query(
      'select id, hubspot_ticket_id, hubspot_thread_id, first_agent_reply_at from tickets'
    )
    const byHsTicket = new Map()
    const byHsThread = new Map()
    for (const row of existingTickets.rows) {
      if (row.hubspot_ticket_id) byHsTicket.set(row.hubspot_ticket_id, row)
      if (row.hubspot_thread_id) byHsThread.set(row.hubspot_thread_id, row)
    }
    const existingThreads = await client.query(
      'select distinct external_thread_id from ticket_events where external_thread_id is not null'
    )
    const importedThreads = new Set(existingThreads.rows.map(row => row.external_thread_id))

    const agentCache = await upsertAgents(client, owners, neededOwnerIds)
    console.log(`Agenci CS: ${new Set(agentCache.values()).size}. Ticketów BQ: ${tickets.length}. Wątków czatu: ${threads.length}.`)

    for (const [index, row] of tickets.entries()) {
      if (byHsTicket.has(String(row.id))) {
        // Równoległa praca: HubSpot jest źródłem prawdy. Uzupełniamy braki (właściciel, kategoria)
        // i zamykamy sprawy zamknięte w HubSpocie; nic, co ktoś ustawił w sun.support, nie jest nadpisywane.
        const existing = byHsTicket.get(String(row.id))
        const isClosedHs = row.is_closed === true || row.is_closed === 'true'
        const closedHs = msToDate(row.closed_ms) || msToDate(row.last_closed_ms)
        const ownerHs = row.owner_id ? agentCache.get(String(row.owner_id)) || null : null
        const result = await client.query(
          `update tickets set
             owner_id = coalesce(owner_id, $2::uuid),
             source_category = coalesce(source_category, $3),
             status = case when $4 and status <> 'closed' then 'closed' else status end,
             closed_at = case when $4 and status <> 'closed' then coalesce($5, now()) else closed_at end,
             business_changed_at = case
               when ($4 and status <> 'closed') or (owner_id is null and $2::uuid is not null) then now()
               else business_changed_at end
           where id = $1
             and (
               (owner_id is null and $2::uuid is not null)
               or (source_category is null and $3::text is not null)
               or ($4 and status <> 'closed')
             )`,
          [existing.id, ownerHs, row.category ? String(row.category).trim() : null, isClosedHs, closedHs]
        )
        if (result.rowCount) stats.ticketsUpdated++
        else stats.ticketsSkipped++
        continue
      }
      const created = msToDate(row.create_ms) || new Date()
      const closed = msToDate(row.closed_ms) || msToDate(row.last_closed_ms)
      const isClosed = row.is_closed === true || row.is_closed === 'true'
      const firstReply = msToDate(row.first_reply_ms)
      const validReply = firstReply && firstReply >= created && (!closed || firstReply <= closed)
        ? firstReply
        : null
      const emails = extractEmails(row.contact_emails || '')
      const subject = row.subject || `Ticket #${row.id}`
      const contactId = await resolveImportedContact(client, {
        emails,
        displayName: emails[0] || `HubSpot #${row.id}`,
        fallbackId: `ticket-${row.id}`
      })
      const ticketId = await insertTicket(client, {
        contactId,
        channel: mapChannel(row.source_type),
        status: isClosed ? 'closed' : 'open',
        category: isClosed || row.category ? mapCategory(row.category) : null,
        sourceCategory: row.category ? String(row.category).trim() : null,
        priority: isClosed || row.priority ? mapPriority(row.priority) : null,
        relatedTransactionId: extractTransactionId(row.subject),
        ownerId: row.owner_id ? agentCache.get(String(row.owner_id)) || null : null,
        subject,
        createdAt: created,
        firstContactAt: created,
        firstAgentReplyAt: validReply,
        closedAt: isClosed ? (closed || created) : null,
        businessChangedAt: closed || created,
        hubspotTicketId: String(row.id),
        hubspotThreadId: null
      })
      await insertEvents(client, [{
        ticketId,
        channel: mapChannel(row.source_type),
        direction: 'to_customer',
        senderType: 'system',
        body: [
          'Import z HubSpot (BigQuery).',
          row.category ? `Kategoria źródłowa: ${row.category}.` : null,
          row.priority ? `Priorytet źródłowy: ${row.priority}.` : null,
          'Brak treści wiadomości w zrzucie ticketów — oś czasu uzupełnią wątki czatu, jeśli są.'
        ].filter(Boolean).join(' '),
        subject,
        externalThreadId: null,
        createdAt: created
      }])
      byHsTicket.set(String(row.id), { id: ticketId, first_agent_reply_at: validReply })
      stats.ticketsInserted++
      stats.events++
      if ((index + 1) % 10 === 0) console.log(`Tickety ${index + 1}/${tickets.length}`)
    }

    for (const [index, thread] of threads.entries()) {
      if (importedThreads.has(String(thread.id)) || byHsThread.has(String(thread.id))) {
        stats.threadsSkipped++
        continue
      }
      const messages = thread.messages || []
      const blob = messages.map(message => message.text || '').join('\n')
      const emails = extractEmails(blob)
      const mentionedTicketId = extractHubspotTicketId(blob)
      const assignedOwnerId = actorOwnerId(thread.assigned_to)
      let ownerId = assignedOwnerId ? agentCache.get(assignedOwnerId) || null : null
      let firstHumanReply = null
      for (const message of messages) {
        if (message.speaker !== 'TEAM') continue
        const hid = actorOwnerId(message.actor_id)
        const owner = hid ? owners.get(hid) : null
        if (!owner || isBotOwner(owner)) continue
        firstHumanReply = new Date(message.created_at)
        if (!ownerId) ownerId = agentCache.get(hid) || null
        break
      }
      const firstCustomer = messages.find(message => message.speaker === 'CUSTOMER' && (message.text || '').trim())
      const created = new Date(thread.created_at)
      const closed = String(thread.status).toUpperCase() === 'CLOSED'
      const lastSpeaker = messages.at(-1)?.speaker
      const status = closed ? 'closed' : lastSpeaker === 'TEAM' ? 'waiting' : 'open'
      const subject = (firstCustomer?.text || `Czat HubSpot #${thread.id}`).replace(/\s+/g, ' ').slice(0, 160)
      const contactId = await resolveImportedContact(client, {
        emails,
        hubspotContactId: thread.contact_id ? String(thread.contact_id) : null,
        displayName: emails[0] || `HubSpot ${thread.contact_id || thread.id}`,
        fallbackId: `thread-${thread.id}`
      })

      const existing = mentionedTicketId ? byHsTicket.get(mentionedTicketId) : null
      let ticketId
      if (existing) {
        ticketId = existing.id
        await client.query(
          `update tickets
           set hubspot_thread_id = coalesce(hubspot_thread_id, $2),
               owner_id = coalesce(owner_id, $3),
               related_transaction_id = coalesce(related_transaction_id, $4),
               first_agent_reply_at = coalesce(first_agent_reply_at, $5)
           where id = $1`,
          [ticketId, String(thread.id), ownerId, extractTransactionId(blob, subject), firstHumanReply]
        )
        stats.threadsMerged++
      } else {
        ticketId = await insertTicket(client, {
          contactId,
          channel: 'chat',
          status,
          category: closed ? 'other' : null,
          sourceCategory: null,
          priority: closed ? 'medium' : null,
          relatedTransactionId: extractTransactionId(blob, subject),
          ownerId,
          subject,
          createdAt: created,
          firstContactAt: firstCustomer ? new Date(firstCustomer.created_at) : created,
          firstAgentReplyAt: firstHumanReply,
          closedAt: closed ? new Date(thread.latest_message_at || thread.created_at) : null,
          businessChangedAt: new Date(thread.latest_message_at || thread.created_at),
          hubspotTicketId: mentionedTicketId,
          hubspotThreadId: String(thread.id)
        })
        if (mentionedTicketId) byHsTicket.set(mentionedTicketId, { id: ticketId, first_agent_reply_at: firstHumanReply })
        stats.threadsInserted++
      }
      byHsThread.set(String(thread.id), { id: ticketId })

      const events = []
      for (const message of messages) {
        const text = (message.text || '').trim() || (message.attachment_count ? '[załącznik]' : '')
        if (!text) continue
        const hid = actorOwnerId(message.actor_id)
        const owner = hid ? owners.get(hid) : null
        const senderType = message.speaker === 'CUSTOMER'
          ? 'customer'
          : message.speaker === 'TEAM'
            ? (owner && !isBotOwner(owner) ? 'agent' : 'bot')
            : 'system'
        events.push({
          ticketId,
          channel: 'chat',
          direction: 'to_customer',
          senderType,
          body: text,
          subject: null,
          externalThreadId: String(thread.id),
          createdAt: new Date(message.created_at)
        })
      }
      await insertEvents(client, events)
      importedThreads.add(String(thread.id))
      stats.events += events.length
      if ((index + 1) % 25 === 0) console.log(`Czat ${index + 1}/${threads.length}`)
    }

    const counts = await client.query(`
      select
        (select count(*)::int from tickets) as tickets,
        (select count(*)::int from tickets where status <> 'closed') as open_tickets,
        (select count(*)::int from ticket_events) as events
    `)

    console.log(JSON.stringify({
      sourceCoverage: {
        bqTicketsInSeptember: tickets.length,
        conversationThreadsInSeptember: threads.length,
        latestBqTicketCreate: latestTicketCreate ? latestTicketCreate.toISOString() : null,
        latestConversationMessage: latestThread ? latestThread.toISOString() : null,
        note: 'Tickety BQ z wszystkich plików tickets_delta*.json. Czaty z conversations-2026-09-*.json w Pobranych.'
      },
      imported: stats,
      database: counts.rows[0]
    }, null, 2))
  } finally {
    await client.end()
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : error)
    process.exit(1)
  })
