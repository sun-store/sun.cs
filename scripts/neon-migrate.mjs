/**
 *   node scripts/neon-migrate.mjs
 *   node scripts/neon-migrate.mjs --dry-run
 *
 * Wymaga NEON_DIRECT_URL (host bez -pooler).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'

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
        || (value.startsWith("'") && value.endsWith("'"))
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

const MIGRATIONS_DIR = resolve('neon/migrations')
const TRACKING_TABLE = 'neon_schema_migrations'

function versionOf(filename) {
  const match = filename.match(/^(\d+)/)
  return match ? match[1] : filename
}

function listMigrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter(name => name.endsWith('.sql'))
    .sort((a, b) => versionOf(a).localeCompare(versionOf(b), undefined, { numeric: true }) || a.localeCompare(b))
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const connectionString = strip(process.env.NEON_DIRECT_URL || '')
  if (!connectionString) {
    console.error('Brak NEON_DIRECT_URL (bezpośredni host, nie pooler).')
    process.exit(1)
  }
  if (/-pooler\./i.test(connectionString)) {
    console.error('NEON_DIRECT_URL wygląda na pooler. Migracje wymagają połączenia bezpośredniego.')
    process.exit(1)
  }

  const files = listMigrationFiles()
  const client = new pg.Client({
    connectionString,
    ssl: /neon\.tech/i.test(connectionString) ? { rejectUnauthorized: false } : undefined
  })
  await client.connect()
  try {
    await client.query(`
      create table if not exists public.${TRACKING_TABLE} (
        filename text primary key,
        applied_at timestamptz not null default now()
      )
    `)

    const { rows: appliedRows } = await client.query(
      `select filename from public.${TRACKING_TABLE}`
    )
    const applied = new Set(appliedRows.map(row => row.filename))
    const pending = files.filter(filename => !applied.has(filename))
    if (!pending.length) {
      console.log('Brak nowych migracji.')
      return
    }

    for (const filename of pending) {
      console.log(dryRun ? `dry-run ${filename}` : `apply ${filename}`)
      if (dryRun) continue
      const sql = readFileSync(resolve(MIGRATIONS_DIR, filename), 'utf8')
      await client.query('begin')
      try {
        await client.query(sql)
        await client.query(
          `insert into public.${TRACKING_TABLE} (filename) values ($1)`,
          [filename]
        )
        await client.query('commit')
      } catch (err) {
        await client.query('rollback')
        throw err
      }
    }
    console.log(dryRun ? `Do nałożenia: ${pending.length}` : `Nałożono: ${pending.length}`)
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
