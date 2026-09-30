/**
 * Jednorazowy backfill awaiting / reply_due_at po imporcie HubSpot.
 *   node scripts/backfill-reply-clocks-http.mjs
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

async function sql(connectionString, query, params = []) {
  const u = new URL(connectionString)
  const res = await fetch(`https://${u.hostname}/sql`, {
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
  if (!res.ok) throw new Error(data.message || data.error || text.slice(0, 400))
  if (Array.isArray(data)) return data
  if (Array.isArray(data.rows)) return data.rows
  return data
}

async function main() {
  const connectionString = strip(process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || '')
  if (!connectionString) throw new Error('Brak NEON_DATABASE_URL')

  const openFixed = await sql(
    connectionString,
    `update tickets
     set awaiting = 'us',
         reply_due_at = coalesce(
           reply_due_at,
           coalesce(first_contact_at, created_at)
             + case
                 when origin_channel in ('email', 'form') then interval '4 hours'
                 else interval '15 minutes'
               end
         )
     where status = 'open'
       and awaiting is null
     returning id::text as id`
  )

  const waitingFixed = await sql(
    connectionString,
    `update tickets
     set awaiting = 'customer',
         reply_due_at = null
     where status = 'waiting'
       and awaiting is null
     returning id::text as id`
  )

  const counts = await sql(
    connectionString,
    `select
       count(*) filter (
         where t.status <> 'closed'
           and (t.awaiting = 'us' or (t.awaiting is null and t.status = 'open'))
       )::int as needs_reply,
       count(*) filter (
         where t.awaiting is null and t.status <> 'closed'
       )::int as still_null
     from tickets t`
  )

  console.log(JSON.stringify({
    openFixed: openFixed.length,
    waitingFixed: waitingFixed.length,
    counts: counts[0]
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
