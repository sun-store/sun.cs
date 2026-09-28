/**
 * Pobiera deltę ticketów i dealów HubSpot z BigQuery (od ostatniego zrzutu).
 * Poświadczenia bierze z sun.logistics/.env (BQ_SERVICE_ACCOUNT_JSON) — nie z sun.cs.
 *
 *   node scripts/pull-hubspot-bq-delta.mjs
 *   node scripts/pull-hubspot-bq-delta.mjs --since 2026-09-02
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const LOGISTICS_ENV = resolve(ROOT, '../sun.logistics/.env')
const LOGISTICS_BQ = resolve(ROOT, '../sun.logistics/node_modules/@google-cloud/bigquery')
const OUT_DIR = resolve('C:/Users/martyna.kalicka/Downloads/cs_july_work/bq_raw')

function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] == null) process.env[key] = value
  }
}

function parseArgs(argv) {
  let since = '2026-09-02'
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--since' && argv[i + 1]) {
      since = argv[++i]
    }
  }
  return { since }
}

function stamp(date = new Date()) {
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const m = months[date.getUTCMonth()]
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${m}${d}`
}

function parseServiceAccount(raw) {
  const value = String(raw || '').trim()
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    try {
      return JSON.parse(Buffer.from(value, 'base64').toString('utf8'))
    } catch {
      return null
    }
  }
}

function toBqResult(rows, fields) {
  return {
    kind: 'bigquery#queryResponse',
    schema: { fields: fields.map(name => ({ name, type: 'STRING' })) },
    totalRows: String(rows.length),
    rows: rows.map(row => ({
      f: fields.map(name => ({
        v: row[name] == null ? null : String(row[name])
      }))
    }))
  }
}

async function queryAll(bq, sql) {
  const [job] = await bq.createQueryJob({ query: sql, location: process.env.BQ_LOCATION || 'EU' })
  const [rows] = await job.getQueryResults({ maxResults: 100000 })
  return rows
}

async function main() {
  loadEnvFile(LOGISTICS_ENV)
  const { since } = parseArgs(process.argv.slice(2))
  const creds = parseServiceAccount(process.env.BQ_SERVICE_ACCOUNT_JSON)
  if (!creds) {
    throw new Error('Brak BQ_SERVICE_ACCOUNT_JSON w sun.logistics/.env')
  }
  if (!existsSync(LOGISTICS_BQ)) {
    throw new Error(`Brak @google-cloud/bigquery w logistics: ${LOGISTICS_BQ}`)
  }

  const require = createRequire(resolve(ROOT, '../sun.logistics/package.json'))
  const { BigQuery } = require('@google-cloud/bigquery')
  const projectId = process.env.BQ_PROJECT_ID || creds.project_id || 'sun-store-bq'
  const bq = new BigQuery({
    projectId,
    credentials: creds
  })

  const ticketFields = [
    'id', 'owner_id', 'is_closed', 'source_type', 'create_ms', 'closed_ms', 'last_closed_ms',
    'last_activity_ms', 'category', 'priority', 'first_reply_ms', 'companies_json',
    'contact_emails', 'subject', 'native_sla_status'
  ]
  const dealFields = ['record_id', 'deal_name', 'companies_json', 'paid_stage_date', 'order_status']

  console.log(`BigQuery delta since ${since}…`)
  const ticketRows = await queryAll(bq, `
    SELECT CAST(id AS STRING) AS id,
      CAST(properties_hubspot_owner_id AS STRING) AS owner_id,
      IFNULL(properties_hs_is_closed, false) AS is_closed,
      CAST(properties_source_type AS STRING) AS source_type,
      UNIX_MILLIS(properties_createdate) AS create_ms,
      UNIX_MILLIS(properties_closed_date) AS closed_ms,
      UNIX_MILLIS(properties_hs_last_closed_date) AS last_closed_ms,
      UNIX_MILLIS(properties_hs_lastactivitydate) AS last_activity_ms,
      CAST(properties_hs_ticket_category AS STRING) AS category,
      CAST(properties_hs_ticket_priority AS STRING) AS priority,
      UNIX_MILLIS(properties_first_agent_reply_date) AS first_reply_ms,
      TO_JSON_STRING(companies) AS companies_json,
      CAST(properties_hs_all_associated_contact_emails AS STRING) AS contact_emails,
      CAST(properties_subject AS STRING) AS subject,
      CAST(properties_hs_time_to_first_response_sla_status AS STRING) AS native_sla_status
    FROM \`sun-store-bq.hubspot.tickets\`
    WHERE properties_createdate >= TIMESTAMP('${since}')
       OR properties_closed_date >= TIMESTAMP('${since}')
       OR (NOT IFNULL(properties_hs_is_closed, false)
           AND properties_hs_lastactivitydate >= TIMESTAMP('${since}'))
    ORDER BY id
  `)

  const dealSince = new Date(`${since}T00:00:00Z`)
  dealSince.setUTCDate(dealSince.getUTCDate() - 4)
  const dealSinceStr = dealSince.toISOString().slice(0, 10)
  const dealRows = await queryAll(bq, `
    SELECT CAST(id AS STRING) AS record_id,
      CAST(properties_dealname AS STRING) AS deal_name,
      TO_JSON_STRING(companies) AS companies_json,
      CAST(properties_paid_stage_date AS STRING) AS paid_stage_date,
      CAST(properties_order_status AS STRING) AS order_status
    FROM \`sun-store-bq.hubspot.deals\`
    WHERE properties_paid_stage_date >= '${dealSinceStr}'
    ORDER BY record_id
  `)

  mkdirSync(OUT_DIR, { recursive: true })
  const tag = stamp(new Date())
  const ticketsPath = resolve(OUT_DIR, `tickets_delta7_${tag}.json`)
  const dealsPath = resolve(OUT_DIR, `deals_delta7_${tag}.json`)
  writeFileSync(ticketsPath, JSON.stringify(toBqResult(ticketRows, ticketFields)))
  writeFileSync(dealsPath, JSON.stringify(toBqResult(dealRows, dealFields)))

  console.log(JSON.stringify({
    since,
    tickets: ticketRows.length,
    deals: dealRows.length,
    ticketsPath,
    dealsPath
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error)
  process.exit(1)
})
