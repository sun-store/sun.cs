/**
 * Jednorazowa klasyfikacja otwartych spraw bez sensownej kategorii HubSpot.
 *   node scripts/reclassify-other.mjs
 *   node scripts/reclassify-other.mjs --dry-run
 */
import { readFileSync } from 'node:fs'
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

const CANON = {
  'dbss issue': 'DBSS Issue',
  'logistics issue': 'Logistics Issue',
  'claim': 'Claim',
  'sun.finance': 'sun.finance',
  'no vat': 'No VAT',
  'lost on platform': 'Lost on platform',
  'offer request': 'Offer request',
  'unresponsive seller': 'Unresponsive seller',
  'stripe payment issue': 'Stripe Payment Issue',
  'stripe': 'Stripe Payment Issue',
  'spam': 'Spam',
  'other': 'Other'
}

const DEPT = {
  'DBSS Issue': 'logistics',
  'Logistics Issue': 'logistics',
  'Claim': 'merchant_success',
  'sun.finance': 'finance',
  'No VAT': 'finance',
  'Lost on platform': 'product',
  'Offer request': 'product',
  'Unresponsive seller': 'merchant_success',
  'Stripe Payment Issue': 'finance',
  'Spam': 'cs',
  'Other': 'cs'
}

const INTERNAL = {
  'DBSS Issue': 'delivery',
  'Logistics Issue': 'delivery',
  'Claim': 'other',
  'sun.finance': 'payment',
  'No VAT': 'payment',
  'Stripe Payment Issue': 'payment',
  'Lost on platform': 'product',
  'Offer request': 'product',
  'Unresponsive seller': 'other',
  'Spam': 'other',
  'Other': 'other'
}

const PRIORITY = {
  logistics: 0,
  finance: 1,
  merchant_success: 2,
  product: 3,
  cs: 4
}

function normalizeTag(raw) {
  const key = String(raw || '').trim().toLowerCase()
  if (!key) return null
  return CANON[key] || String(raw).trim()
}

function splitTags(raw) {
  if (!raw || !String(raw).trim()) return []
  return [...new Set(String(raw).split(';').map(normalizeTag).filter(Boolean))]
}

function resolveDept(tags, category) {
  const depts = tags.map(tag => DEPT[tag]).filter(Boolean)
  if (depts.length) {
    return depts.reduce((best, next) => (PRIORITY[next] < PRIORITY[best] ? next : best))
  }
  if (category === 'delivery') return 'logistics'
  if (category === 'payment') return 'finance'
  if (category === 'product') return 'product'
  return 'cs'
}

const RULES = [
  {
    source: 'Unresponsive seller',
    category: 'other',
    reason: 'sprzedawca nie odpowiada',
    test: t => /unresponsive\s*seller|seller\s+not\s+resp|seller\s+nie\s+odpowiad|problem\s+(z|sa|with)\s+(seller|sprzedaw|prodav|vendit)|buyer\s+inactive|nie\s+odpowiada/i.test(t)
  },
  {
    source: 'Claim',
    category: 'other',
    reason: 'szkoda / uszkodzenie',
    test: t => /\bclaim\b|uszkodzon|damaged\s+in\s+shipping|reklamac/i.test(t)
  },
  {
    source: 'Logistics Issue',
    category: 'delivery',
    reason: 'dostawa / transport',
    test: t => /spedizion|shipping\s+document|transport\s+cost|dostaw|dbss|\bcmr\b|tracking|przewoz/i.test(t)
  },
  {
    source: 'Stripe Payment Issue',
    category: 'payment',
    reason: 'płatność',
    test: t => /\bstripe\b|payment\s+issue|nie\s+mogę\s+zapłaci|n'arrive\s+pas\s+à\s+payer|paiement|płatno|pay\s+a\s+commande|débloquer.*banque|sunfinanc/i.test(t)
  },
  {
    source: 'sun.finance',
    category: 'payment',
    reason: 'faktura / finanse',
    test: t => /sun\.?\s*finance|wypłat|faktury|invoice|račun|končni\s+račun|credit\s+line/i.test(t)
  },
  {
    source: 'Offer request',
    category: 'product',
    reason: 'cena / oferta',
    test: t => /\bprecio\b|\boffer\b|cena\b|ulica\s+\d+w|\bbuying\b|kupi[ćc]/i.test(t)
  },
  {
    source: 'Spam',
    category: 'other',
    reason: 'pusty / test',
    test: t => /^(hi|hello|hey(\s+agent)?|cześć|bonjour\s+\w+|tere[,.]?)\s*$/i.test(t.trim())
      || /\[test\]|webhooki\s*\/\s*opóźnienia/i.test(t)
  }
]

function classify(row) {
  const tags = splitTags(row.source_category)
  const sourceWeak = !tags.length || tags.every(tag => tag === 'Other')
  const text = `${row.subject || ''}\n${row.first_body || ''}`.replace(/\s+/g, ' ').trim()

  if (!sourceWeak && tags.length) {
    const primary = tags.find(tag => INTERNAL[tag])
    if (primary) {
      return {
        sourceCategory: tags.join(';'),
        category: INTERNAL[primary],
        department: resolveDept(tags, INTERNAL[primary]),
        reason: `HubSpot: ${primary}`
      }
    }
  }

  for (const rule of RULES) {
    if (!text || !rule.test(text)) continue
    return {
      sourceCategory: rule.source,
      category: rule.category,
      department: resolveDept([rule.source], rule.category),
      reason: rule.reason
    }
  }

  if (tags.length) {
    const primary = tags.find(tag => INTERNAL[tag]) || tags[0]
    return {
      sourceCategory: tags.join(';'),
      category: INTERNAL[primary] || 'other',
      department: resolveDept(tags, INTERNAL[primary] || 'other'),
      reason: 'normalizacja HubSpot'
    }
  }
  return null
}

const dryRun = process.argv.includes('--dry-run')
const url = process.env.NEON_DIRECT_URL || process.env.NEON_DATABASE_URL
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })

await client.connect()

const { rows } = await client.query(`
  select
    t.id,
    t.category,
    t.source_category,
    t.department,
    t.subject,
    left(coalesce((
      select e.body from ticket_events e
      where e.ticket_id = t.id and e.sender_type in ('customer','agent','bot')
      order by e.created_at asc limit 1
    ), ''), 800) as first_body
  from tickets t
  where t.status <> 'closed'
    and (
      t.category is null
      or t.category = 'other'
      or t.source_category is null
      or trim(t.source_category) = ''
      or t.source_category ilike '%Other%'
      or t.source_category ilike '%Unresponsive%'
      or t.source_category ilike '%Stripe%'
    )
`)

let updated = 0
let skipped = 0
for (const row of rows) {
  const hit = classify(row)
  if (!hit) {
    skipped += 1
    continue
  }
  const same = (row.source_category || '') === hit.sourceCategory
    && row.category === hit.category
    && row.department === hit.department
  if (same) {
    skipped += 1
    continue
  }
  console.log(`${row.id.slice(0, 8)} | ${(row.subject || '').slice(0, 50)} → ${hit.sourceCategory} / ${hit.department} (${hit.reason})`)
  if (!dryRun) {
    await client.query(
      `update tickets
       set source_category = $2,
           category = $3,
           department = $4,
           business_changed_at = now()
       where id = $1::uuid`,
      [row.id, hit.sourceCategory, hit.category, hit.department]
    )
  }
  updated += 1
}

console.log(dryRun ? `dry-run: ${updated} do zmiany, ${skipped} bez zmian` : `zaktualizowano ${updated}, bez zmian ${skipped}`)
await client.end()
