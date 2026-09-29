import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const src = resolve('C:/Users/martyna.kalicka/Downloads/job_0keWSdJTHrwtYkzKZi25mHY7c7O0.json')
const dest = resolve('C:/Users/martyna.kalicka/Downloads/cs_july_work/bq_raw/tickets_delta7_sep28.json')
const rows = JSON.parse(readFileSync(src, 'utf8'))
if (!Array.isArray(rows)) throw new Error('expected array export')

const fields = [...new Set(rows.flatMap(row => Object.keys(row)))]
const preferred = [
  'id', 'owner_id', 'is_closed', 'source_type', 'create_ms', 'closed_ms', 'last_closed_ms',
  'last_activity_ms', 'category', 'priority', 'first_reply_ms', 'companies_json',
  'contact_emails', 'subject', 'native_sla_status'
]
const ordered = [
  ...preferred.filter(name => fields.includes(name)),
  ...fields.filter(name => !preferred.includes(name))
]

const payload = {
  kind: 'bigquery#queryResponse',
  schema: { fields: ordered.map(name => ({ name, type: 'STRING' })) },
  totalRows: String(rows.length),
  rows: rows.map(row => ({
    f: ordered.map(name => ({
      v: row[name] == null ? null : String(row[name])
    }))
  }))
}

writeFileSync(dest, JSON.stringify(payload))

function inSeptember(ms) {
  const n = Number(ms)
  if (!n || Number.isNaN(n)) return false
  const d = new Date(n)
  return d.getUTCFullYear() === 2026 && d.getUTCMonth() === 8
}

const sept = rows.filter(row =>
  inSeptember(row.create_ms) || inSeptember(row.closed_ms) || inSeptember(row.last_closed_ms)
)

console.log(JSON.stringify({
  rows: rows.length,
  september: sept.length,
  fields: ordered,
  dest
}, null, 2))
