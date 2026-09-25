import pg from 'pg'

const { Pool } = pg

function neonDatabaseUrl(): string {
  const raw = (process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || '').trim()
  if (!raw) return ''
  return raw
    .replace(/([?&])channel_binding=require&?/g, '$1')
    .replace(/[?&]$/, '')
}

let pool: pg.Pool | null = null

export function hasNeonConfig(): boolean {
  return Boolean(neonDatabaseUrl())
}

export function getNeonPool(): pg.Pool {
  if (pool) return pool
  const connectionString = neonDatabaseUrl()
  if (!connectionString) {
    throw new Error('Brak NEON_DATABASE_URL.')
  }
  const isNeon = /neon\.tech/i.test(connectionString)
  pool = new Pool({
    connectionString,
    max: 5,
    ...(isNeon ? { ssl: { rejectUnauthorized: false } } : {})
  })
  return pool
}

export async function neonQuery<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const { rows } = await getNeonPool().query<T>(sql, params)
  return rows
}
