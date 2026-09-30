import {
  CHANNEL_LABELS,
  type Channel
} from '../../shared/domain'
import { ticketTopic, TOPIC_LABELS } from '../../shared/ticket-topic'
import { neonQuery } from './neon-db'

export type DashboardCategoryRow = {
  category: string
  label: string
  count: number
  share: number
}

export type DashboardChannelRow = {
  channel: string
  label: string
  count: number
  share: number
}

export type DashboardTrendMonth = {
  year: number
  month: number
  total: number
  categories: Array<{ category: string, label: string, count: number }>
}

export type DashboardAgentLoadRow = {
  agentId: string | null
  agent: string
  openCount: number
  waitingCount: number
  avgAgeHours: number | null
  avgAgeLabel: string
}

export type DashboardReport = {
  year: number
  month: number
  monthTotal: number
  byCategory: DashboardCategoryRow[]
  byChannel: DashboardChannelRow[]
  trend: DashboardTrendMonth[]
  openByAgent: DashboardAgentLoadRow[]
  openTotal: number
}

function channelLabel(raw: string): string {
  if (raw in CHANNEL_LABELS) return CHANNEL_LABELS[raw as Channel]
  return raw
}

function formatAgeHours(hours: number | null): string {
  if (hours == null || Number.isNaN(hours)) return '—'
  if (hours < 24) return `${hours.toFixed(1)} h`
  const days = hours / 24
  if (days < 14) return `${days.toFixed(1)} d`
  return `${(days / 7).toFixed(1)} tyg.`
}

function shiftMonth(year: number, month: number, delta: number): { year: number, month: number } {
  const index = year * 12 + (month - 1) + delta
  return {
    year: Math.floor(index / 12),
    month: (index % 12) + 1
  }
}

function withShares<T extends { count: number }>(
  rows: T[],
  total: number
): Array<T & { share: number }> {
  return rows.map(row => ({
    ...row,
    share: total > 0 ? row.count / total : 0
  }))
}

type TopicSource = {
  source_category: string | null
  subject: string | null
  first_customer_text: string | null
}

/** Jeden temat na sprawę (shared/ticket-topic.ts) — zamiast tagów HubSpot, gdzie połowa to „Other”. */
function countTopics(rows: TopicSource[]) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const label = TOPIC_LABELS[ticketTopic({
      sourceCategory: row.source_category,
      subject: row.subject,
      text: row.first_customer_text
    })]
    counts.set(label, (counts.get(label) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ category: label, label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pl'))
}

function warsawParts(date: Date): { year: number, month: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: 'numeric'
  }).formatToParts(date)
  const year = Number(parts.find(part => part.type === 'year')?.value)
  const month = Number(parts.find(part => part.type === 'month')?.value)
  return { year, month }
}

export async function loadDashboard(year: number, month: number): Promise<DashboardReport> {
  const trendStart = shiftMonth(year, month, -5)

  const [ticketRows, channelRows, agentRows] = await Promise.all([
    neonQuery<{
      id: string
      source_category: string | null
      subject: string | null
      first_customer_text: string | null
      created_at: Date
    }>(
      `select t.id::text as id,
              t.source_category,
              t.subject,
              (select left(e.body, 600) from ticket_events e
                where e.ticket_id = t.id and e.sender_type = 'customer'
                order by e.created_at asc limit 1) as first_customer_text,
              t.created_at
       from tickets t
       where (t.created_at at time zone 'Europe/Warsaw')
               >= make_timestamp($1, $2, 1, 0, 0, 0)
         and (t.created_at at time zone 'Europe/Warsaw')
               < (make_timestamp($3, $4, 1, 0, 0, 0) + interval '1 month')`,
      [trendStart.year, trendStart.month, year, month]
    ),
    neonQuery<{ channel: string, count: string }>(
      `select origin_channel::text as channel,
              count(*)::text as count
       from tickets
       where extract(year from created_at at time zone 'Europe/Warsaw') = $1
         and extract(month from created_at at time zone 'Europe/Warsaw') = $2
       group by origin_channel
       order by count(*) desc, origin_channel asc`,
      [year, month]
    ),
    neonQuery<{
      agent_id: string | null
      agent: string
      open_count: string
      waiting_count: string
      avg_age_hours: string | null
    }>(
      `select a.id::text as agent_id,
              coalesce(a.display_name, 'Bez właściciela') as agent,
              count(*) filter (where t.status = 'open')::text as open_count,
              count(*) filter (where t.status = 'waiting')::text as waiting_count,
              avg(extract(epoch from (now() - t.created_at)) / 3600.0)::text as avg_age_hours
       from tickets t
       left join agents a on a.id = t.owner_id
       where t.status in ('open', 'waiting')
       group by a.id, a.display_name
       order by count(*) desc, agent asc`
    )
  ])

  const monthTicketRows: TopicSource[] = []
  const trendMap = new Map<string, {
    year: number
    month: number
    rows: TopicSource[]
  }>()
  for (let i = 0; i < 6; i++) {
    const point = shiftMonth(trendStart.year, trendStart.month, i)
    trendMap.set(`${point.year}-${point.month}`, {
      year: point.year,
      month: point.month,
      rows: []
    })
  }

  for (const row of ticketRows) {
    const created = row.created_at instanceof Date ? row.created_at : new Date(row.created_at)
    const parts = warsawParts(created)
    const tagged: TopicSource = {
      source_category: row.source_category,
      subject: row.subject,
      first_customer_text: row.first_customer_text
    }
    const bucket = trendMap.get(`${parts.year}-${parts.month}`)
    if (bucket) bucket.rows.push(tagged)
    if (parts.year === year && parts.month === month) {
      monthTicketRows.push(tagged)
    }
  }

  const monthTotal = monthTicketRows.length
  const monthCategories = countTopics(monthTicketRows)

  const monthChannels = channelRows.map(row => ({
    channel: row.channel,
    label: channelLabel(row.channel),
    count: Number(row.count)
  }))
  const channelTotal = monthChannels.reduce((sum, row) => sum + row.count, 0)

  const trend: DashboardTrendMonth[] = [...trendMap.values()].map((bucket) => {
    const categories = countTopics(bucket.rows).filter(row => row.count > 0)
    return {
      year: bucket.year,
      month: bucket.month,
      total: bucket.rows.length,
      categories
    }
  })

  const openByAgent = agentRows.map((row) => {
    const openCount = Number(row.open_count)
    const waitingCount = Number(row.waiting_count)
    const avgAgeHours = row.avg_age_hours == null
      ? null
      : Number(row.avg_age_hours)
    return {
      agentId: row.agent_id,
      agent: row.agent,
      openCount,
      waitingCount,
      avgAgeHours: avgAgeHours == null || Number.isNaN(avgAgeHours) ? null : avgAgeHours,
      avgAgeLabel: formatAgeHours(
        avgAgeHours == null || Number.isNaN(avgAgeHours) ? null : avgAgeHours
      )
    }
  })

  return {
    year,
    month,
    monthTotal,
    byCategory: withShares(monthCategories, monthTotal),
    byChannel: withShares(monthChannels, channelTotal),
    trend,
    openByAgent,
    openTotal: openByAgent.reduce((sum, row) => sum + row.openCount + row.waitingCount, 0)
  }
}
