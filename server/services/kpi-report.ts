import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Channel, TicketPriority, TicketStatus } from '../../shared/domain'
import {
  buildKpiReport,
  type CsatRow,
  type KpiTicket,
  type PaidDeal
} from '../../shared/kpi-report'
import { neonQuery } from './neon-db'

const CS_JULY = resolve('C:/Users/martyna.kalicka/Downloads/cs_july_work')
const DOWNLOADS = resolve('C:/Users/martyna.kalicka/Downloads')

type TicketQueryRow = {
  id: string
  hubspot_ticket_id: string | null
  owner_name: string | null
  origin_channel: Channel
  status: TicketStatus
  category: string | null
  priority: TicketPriority | null
  subject: string | null
  related_transaction_id: string | null
  contact_emails: string | null
  customer_role: 'buyer' | 'seller' | null
  created_at: Date
  first_contact_at: Date
  first_agent_reply_at: Date | null
  closed_at: Date | null
}

function bqRowsToObjects(file: string, fallbackFields: string[]): Record<string, string | null>[] {
  const data = JSON.parse(readFileSync(file, 'utf8')) as {
    schema?: { fields: { name: string }[] }
    rows?: { f: { v: string | null }[] }[]
  }
  const fields = data.schema?.fields.map(field => field.name) || fallbackFields
  return (data.rows || []).map((row) => {
    const obj: Record<string, string | null> = {}
    row.f.forEach((cell, index) => {
      obj[fields[index] || `c${index}`] = cell.v
    })
    return obj
  })
}

function parseCompanies(raw: string | null | undefined): string[] {
  if (!raw || raw === 'null') return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function loadCompanyIdsByTicket(): Map<string, string[]> {
  const map = new Map<string, string[]>()
  const dir = resolve(CS_JULY, 'bq_raw')
  if (!existsSync(dir)) return map
  for (const name of readdirSync(dir)) {
    if (!/^tickets_delta.*\.json$/i.test(name)) continue
    for (const row of bqRowsToObjects(resolve(dir, name), [
      'id', 'owner_id', 'is_closed', 'source_type', 'create_ms', 'closed_ms', 'last_closed_ms',
      'last_activity_ms', 'category', 'priority', 'first_reply_ms', 'companies_json',
      'contact_emails', 'subject', 'native_sla_status'
    ])) {
      const id = String(row.id || '')
      if (id) map.set(id, parseCompanies(row.companies_json))
    }
  }
  return map
}

function loadDeals(): PaidDeal[] {
  const dir = resolve(CS_JULY, 'bq_raw')
  if (!existsSync(dir)) return []
  const byId = new Map<string, PaidDeal>()
  for (const name of readdirSync(dir)) {
    if (!/^deals_delta.*\.json$/i.test(name)) continue
    for (const row of bqRowsToObjects(resolve(dir, name), [
      'record_id', 'deal_name', 'companies_json', 'paid_stage_date', 'order_status', 'pad'
    ])) {
      const paid = row.paid_stage_date
      if (!paid) continue
      const recordId = String(row.record_id || row.id || '')
      byId.set(recordId, {
        recordId,
        companyIds: parseCompanies(row.companies_json),
        paidDate: new Date(`${paid}T12:00:00Z`)
      })
    }
  }
  return [...byId.values()]
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)
  if (!lines.length) return []
  const headers = splitCsvLine(lines[0]).map(header => header.replace(/^"|"$/g, ''))
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line)
    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      row[header] = (cells[index] || '').replace(/^"|"$/g, '').replace(/""/g, '"')
    })
    return row
  })
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        quoted = !quoted
      }
    } else if (char === ',' && !quoted) {
      out.push(current)
      current = ''
    } else {
      current += char
    }
  }
  out.push(current)
  return out
}

function loadCsat(): { rows: CsatRow[], through: string } {
  const files = existsSync(DOWNLOADS)
    ? readdirSync(DOWNLOADS).filter(name => /^hubspot-crm-exports-csat-.*\.csv$/i.test(name))
    : []
  const byId = new Map<string, CsatRow>()
  let through = 'brak eksportu'
  for (const name of files.sort()) {
    const survey: CsatRow['survey'] = /chat/i.test(name) ? 'chat' : 'email_phone'
    const dateMatch = name.match(/(\d{4}-\d{2}-\d{2})/)
    if (dateMatch && dateMatch[1] > through) through = dateMatch[1]
    const parsed = parseCsv(readFileSync(resolve(DOWNLOADS, name), 'utf8'))
    for (const row of parsed) {
      const recordId = row['Record ID']
      const dateRaw = row.Date
      if (!recordId || !dateRaw) continue
      const date = new Date(dateRaw.includes('T') ? dateRaw : dateRaw.replace(' ', 'T') + 'Z')
      if (Number.isNaN(date.getTime())) continue
      byId.set(recordId, {
        recordId,
        rating: Number.parseFloat(row.Rating || '0'),
        date,
        email: (row.Email || '').trim().toLowerCase() || null,
        survey,
        owner: null
      })
    }
  }
  return { rows: [...byId.values()], through }
}

function latestFileStamp(dir: string, pattern: RegExp, fallback: string): string {
  if (!existsSync(dir)) return fallback
  const names = readdirSync(dir).filter(name => pattern.test(name)).sort()
  const last = names.at(-1)
  const match = last?.match(/(\d{4}-\d{2}-\d{2}|[a-z]{3}\d{2})/i)
  return match?.[1] || fallback
}

export async function loadKpiReport(year = 2026, month = 9) {
  const rows = await neonQuery<TicketQueryRow>(
    `select t.id, t.hubspot_ticket_id, a.display_name as owner_name, t.origin_channel,
            t.status, t.category, t.priority, t.subject, t.related_transaction_id,
            t.created_at, t.first_contact_at, t.first_agent_reply_at, t.closed_at,
            c.customer_role,
            (select string_agg(ci.value, ';') from contact_identifiers ci
              where ci.contact_id = t.contact_id and ci.type = 'email') as contact_emails
     from tickets t
     join contacts c on c.id = t.contact_id
     left join agents a on a.id = t.owner_id`
  )
  const companies = loadCompanyIdsByTicket()
  const tickets: KpiTicket[] = rows.map(row => ({
    id: row.id,
    hubspotTicketId: row.hubspot_ticket_id,
    owner: row.owner_name,
    channel: row.origin_channel,
    status: row.status,
    category: row.category,
    priority: row.priority,
    subject: row.subject,
    relatedTransactionId: row.related_transaction_id,
    contactEmails: (row.contact_emails || '').split(';').map(value => value.trim().toLowerCase()).filter(Boolean),
    companyIds: row.hubspot_ticket_id ? companies.get(row.hubspot_ticket_id) || [] : [],
    customerRole: row.customer_role,
    createdAt: new Date(row.created_at),
    firstContactAt: new Date(row.first_contact_at),
    firstAgentReplyAt: row.first_agent_reply_at ? new Date(row.first_agent_reply_at) : null,
    closedAt: row.closed_at ? new Date(row.closed_at) : null,
    lastActivityAt: row.closed_at ? new Date(row.closed_at) : new Date(row.created_at)
  }))

  const csatFile = loadCsat()
  const byEmail = new Map<string, KpiTicket[]>()
  for (const ticket of tickets) {
    for (const email of ticket.contactEmails) {
      if (!byEmail.has(email)) byEmail.set(email, [])
      byEmail.get(email)!.push(ticket)
    }
  }
  const csat = csatFile.rows.map((row) => {
    if (!row.email) return row
    const candidates = byEmail.get(row.email) || []
    if (!candidates.length) return row
    const before = candidates.filter(ticket => ticket.closedAt && ticket.closedAt <= row.date)
    const best = (before.length ? before : candidates)
      .slice()
      .sort((a, b) => (b.closedAt?.getTime() || 0) - (a.closedAt?.getTime() || 0))[0]
    return { ...row, owner: best?.owner || row.owner }
  })

  const today = new Date()
  const monthStart = new Date(Date.UTC(year, month - 1, 1))
  const monthEnd = new Date(Date.UTC(year, month, 1))
  const chatEvents = await neonQuery<{
    ticket_id: string
    sender_type: string
    body: string
  }>(
    `select e.ticket_id, e.sender_type, e.body
     from ticket_events e
     join tickets t on t.id = e.ticket_id
     where t.origin_channel = 'chat'
       and t.created_at >= $1 and t.created_at < $2
     order by e.ticket_id, e.created_at`,
    [monthStart, monthEnd]
  )
  const byTicket = new Map<string, { sender_type: string, body: string }[]>()
  for (const event of chatEvents) {
    if (!byTicket.has(event.ticket_id)) byTicket.set(event.ticket_id, [])
    byTicket.get(event.ticket_id)!.push(event)
  }
  const testy = /^(ok|test|asdf|hi|hey|cześć|hej)?$/i
  let denominator = 0
  let resolved = 0
  let noHuman = 0
  for (const events of byTicket.values()) {
    const customer = events.filter(event => event.sender_type === 'customer' && event.body.trim() && !testy.test(event.body.trim()))
    if (!customer.length) continue
    denominator++
    const human = events.some(event => event.sender_type === 'agent')
    const bot = events.some(event => event.sender_type === 'bot')
    if (!human) noHuman++
    const last = [...events].reverse().find(event => event.body.trim())
    if (bot && !human && last?.sender_type !== 'customer') resolved++
  }
  const ai = {
    denominator,
    resolved,
    rate: denominator ? resolved / denominator : null,
    rawContainment: denominator ? noHuman / denominator : null
  }

  return buildKpiReport({
    year,
    month,
    today,
    tickets,
    csat,
    deals: loadDeals(),
    ai,
    coverage: {
      ticketsThrough: latestFileStamp(resolve(CS_JULY, 'bq_raw'), /^tickets_delta/, '2026-09-02'),
      chatsThrough: latestFileStamp(DOWNLOADS, /^conversations-2026-09/, '2026-09-27'),
      csatThrough: csatFile.through,
      monthInProgress: today.getUTCMonth() + 1 === month && today.getUTCFullYear() === year
    }
  })
}
