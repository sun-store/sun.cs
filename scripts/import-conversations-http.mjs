/**
 * Import tylko wątków z conversations-*.json przez Neon HTTP (bez paczki pg).
 *   node scripts/import-conversations-http.mjs [ścieżka-do-json]
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const DEFAULT_FILE = resolve(
  'C:/Users/martyna.kalicka/Downloads/conversations-2026-09-23.json'
)
const BOT_OWNER_IDS = new Set(['34396953', '30675564'])
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

function mapHubChannel(channelName, channelId) {
  const name = String(channelName || '').toUpperCase()
  const id = String(channelId || '')
  if (name.includes('LIVE_CHAT') || name.includes('CHAT') || id === '1000') return 'chat'
  if (name.includes('EMAIL') || name.includes('MAIL') || id === '1002') return 'email'
  if (name.includes('PHONE') || name.includes('CALL') || id === '1001') return 'phone'
  if (name.includes('WHATS')) return 'whatsapp'
  return 'chat'
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

function actorOwnerId(actorId) {
  const match = String(actorId || '').match(/^A-(\d+)$/)
  return match ? match[1] : null
}

function neonHttpUrl(connectionString) {
  const u = new URL(connectionString)
  return `https://${u.hostname}/sql`
}

async function sql(connectionString, query, params = []) {
  const res = await fetch(neonHttpUrl(connectionString), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Neon-Connection-String': connectionString
    },
    body: JSON.stringify({ query, params })
  })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`Neon HTTP ${res.status}: ${text.slice(0, 400)}`)
  }
  if (!res.ok) {
    throw new Error(data.message || data.error || JSON.stringify(data).slice(0, 400))
  }
  // neon serverless returns { rows, fields } or array depending on version
  if (Array.isArray(data)) return data
  if (Array.isArray(data.rows)) return data.rows
  return data
}

async function main() {
  const file = resolve(process.argv[2] || DEFAULT_FILE)
  if (!existsSync(file)) throw new Error(`Brak pliku: ${file}`)
  const connectionString = strip(process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || '')
  if (!connectionString) throw new Error('Brak NEON_DATABASE_URL')

  // smoke test
  const ping = await sql(connectionString, 'select 1::int as ok')
  console.log('neon ok', ping)

  const payload = JSON.parse(readFileSync(file, 'utf8'))
  const threads = payload.threads || []
  console.log(`Wątków w pliku: ${threads.length}`)

  const existing = await sql(
    connectionString,
    `select hubspot_thread_id from tickets where hubspot_thread_id is not null`
  )
  const importedThreads = new Set(existing.map(row => String(row.hubspot_thread_id)))

  const byHsTicketRows = await sql(
    connectionString,
    `select id::text as id, hubspot_ticket_id from tickets where hubspot_ticket_id is not null`
  )
  const byHsTicket = new Map(byHsTicketRows.map(row => [String(row.hubspot_ticket_id), row.id]))

  const stats = { inserted: 0, merged: 0, skipped: 0, events: 0 }

  for (const [index, thread] of threads.entries()) {
    if (importedThreads.has(String(thread.id))) {
      stats.skipped++
      continue
    }
    const channel = mapHubChannel(thread.channel_name, thread.channel_id)
    const messages = thread.messages || []
    const blob = messages.map(message => message.text || '').join('\n')
    const emails = extractEmails(blob)
    const mentionedTicketId = extractHubspotTicketId(blob)
    const firstCustomer = messages.find(message => message.speaker === 'CUSTOMER' && (message.text || '').trim())
    const created = new Date(thread.created_at)
    const closed = String(thread.status).toUpperCase() === 'CLOSED'
    const lastSpeaker = messages.at(-1)?.speaker
    const status = closed ? 'closed' : lastSpeaker === 'TEAM' ? 'waiting' : 'open'
    const subject = (firstCustomer?.text || `${channel} HubSpot #${thread.id}`).replace(/\s+/g, ' ').slice(0, 160)

    let contactId
    if (thread.contact_id) {
      const found = await sql(
        connectionString,
        'select id::text as id from contacts where hubspot_contact_id = $1',
        [String(thread.contact_id)]
      )
      if (found[0]) contactId = found[0].id
    }
    if (!contactId && emails[0]) {
      const found = await sql(
        connectionString,
        `select contact_id::text as id from contact_identifiers where type = 'email' and value = $1`,
        [emails[0]]
      )
      if (found[0]) contactId = found[0].id
    }
    if (!contactId) {
      const createdContact = await sql(
        connectionString,
        `insert into contacts (display_name, hubspot_contact_id)
         values ($1, $2)
         returning id::text as id`,
        [
          emails[0] || `HubSpot ${thread.contact_id || thread.id}`,
          thread.contact_id ? String(thread.contact_id) : null
        ]
      )
      contactId = createdContact[0].id
    }
    for (const email of emails) {
      await sql(
        connectionString,
        `insert into contact_identifiers (contact_id, type, value, source)
         values ($1::uuid, 'email', $2, 'hubspot-import')
         on conflict (type, value) do nothing`,
        [contactId, email]
      )
    }
    if (thread.contact_id) {
      await sql(
        connectionString,
        `insert into contact_identifiers (contact_id, type, value, source)
         values ($1::uuid, 'hubspot_contact', $2, 'hubspot-import')
         on conflict (type, value) do nothing`,
        [contactId, String(thread.contact_id)]
      )
    }

    let ticketId = mentionedTicketId ? byHsTicket.get(mentionedTicketId) : null
    if (ticketId) {
      await sql(
        connectionString,
        `update tickets
         set hubspot_thread_id = coalesce(hubspot_thread_id, $2),
             related_transaction_id = coalesce(related_transaction_id, $3)
         where id = $1::uuid`,
        [ticketId, String(thread.id), extractTransactionId(blob, subject)]
      )
      stats.merged++
    } else {
      const inserted = await sql(
        connectionString,
        `insert into tickets (
           contact_id, origin_channel, status, category, priority, related_transaction_id,
           subject, created_at, first_contact_at, closed_at, business_changed_at,
           hubspot_ticket_id, hubspot_thread_id
         ) values (
           $1::uuid, $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11,
           $12, $13
         )
         returning id::text as id`,
        [
          contactId,
          channel,
          status,
          closed ? 'other' : null,
          closed ? 'medium' : null,
          extractTransactionId(blob, subject),
          subject,
          created.toISOString(),
          (firstCustomer ? new Date(firstCustomer.created_at) : created).toISOString(),
          closed ? new Date(thread.latest_message_at || thread.created_at).toISOString() : null,
          new Date(thread.latest_message_at || thread.created_at).toISOString(),
          mentionedTicketId,
          String(thread.id)
        ]
      )
      ticketId = inserted[0].id
      if (mentionedTicketId) byHsTicket.set(mentionedTicketId, ticketId)
      stats.inserted++
    }

    for (const message of messages) {
      const text = (message.text || '').trim() || (message.attachment_count ? '[załącznik]' : '')
      if (!text) continue
      const hid = actorOwnerId(message.actor_id)
      const senderType = message.speaker === 'CUSTOMER'
        ? 'customer'
        : message.speaker === 'TEAM'
          ? (hid && BOT_OWNER_IDS.has(hid) ? 'bot' : 'agent')
          : 'system'
      // refine bot by email pattern when we don't have owners list
      const maybeBot = message.speaker === 'TEAM' && BOT_EMAIL_RE.test(text)
      await sql(
        connectionString,
        `insert into ticket_events (
           ticket_id, channel, direction, sender_type, body, external_thread_id, created_at
         ) values ($1::uuid, $2, 'to_customer', $3, $4, $5, $6)`,
        [
          ticketId,
          channel,
          maybeBot ? 'bot' : senderType,
          text,
          String(thread.id),
          new Date(message.created_at).toISOString()
        ]
      )
      stats.events++
    }

    // Zegar odpowiedzi — bez tego „Weź najpilniejszą” i kolejki now/reply są puste.
    if (!closed) {
      const lastCustomer = [...messages].reverse().find(message => message.speaker === 'CUSTOMER')
      const awaiting = lastSpeaker === 'TEAM' ? 'customer' : 'us'
      const replyDueAt = awaiting === 'us' && lastCustomer
        ? new Date(new Date(lastCustomer.created_at).getTime() + (channel === 'email' ? 4 * 3600_000 : 15 * 60_000))
        : null
      await sql(
        connectionString,
        `update tickets
         set awaiting = $2,
             reply_due_at = $3,
             status = $4
         where id = $1::uuid`,
        [ticketId, awaiting, replyDueAt ? replyDueAt.toISOString() : null, status]
      )
    }

    importedThreads.add(String(thread.id))
    if ((index + 1) % 10 === 0) console.log(`Wątek ${index + 1}/${threads.length}`)
  }

  console.log(JSON.stringify(stats, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
