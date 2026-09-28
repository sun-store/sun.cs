import type { Channel, TicketPriority, TicketStatus } from './domain'
import { businessSecondsBetween, fromZonedTime, isWithinBusinessHours, zonedParts } from './workingHours'

export const KPI_TARGETS = {
  fcr: 0.5,
  sla: 0.9,
  csat: 0.8,
  retention: 0.5,
  qa: 0.9
} as const

export const FCR_MAX_HOURS = 4
export const MIN_TICKETS = 5
export const RETENTION_WINDOW_DAYS = 30
export const QA_IN_TOUCH_DAYS = 7
export const AGENTS_EXCLUDE = ['Deactivated', 'sunstore Agent', 'HubSpot Customer Agent']
export const HEADLINE_SLA_HOURS: Partial<Record<Channel, number>> = {
  chat: 0.5,
  email: 2
}

export type KpiTicket = {
  id: string
  hubspotTicketId?: string | null
  owner: string | null
  channel: Channel
  status: TicketStatus
  category: string | null
  priority: TicketPriority | null
  subject: string | null
  relatedTransactionId: string | null
  contactEmails: string[]
  companyIds: string[]
  customerRole: 'buyer' | 'seller' | null
  createdAt: Date
  firstContactAt: Date
  firstAgentReplyAt: Date | null
  closedAt: Date | null
  lastActivityAt: Date | null
}

export type CsatRow = {
  recordId: string
  rating: number
  date: Date
  email: string | null
  survey: 'email_phone' | 'chat'
  owner: string | null
}

export type PaidDeal = {
  recordId: string
  companyIds: string[]
  paidDate: Date
}

export type AgentKpiRow = {
  agent: string
  closed: number
  all: number
  fcrN: number
  fcrDen: number
  fcrR: number | null
  fcrDataInvalid: number
  slaMet: number
  slaTotal: number
  slaR: number | null
  slaExcludedOffHours: number
  slaUnreliable: number
  csatHappy: number
  csatTotal: number
  csatR: number | null
  retN: number
  retD: number
  retOpen: number
  retR: number | null
  qaPass: number
  qaTotal: number
  qaR: number | null
  bonus: number | null
}

const TXN_RE = /(?:sun\.store\/(?:[a-z]{2}\/)?transaction\/|transaction\s*#\s*)([A-Za-z0-9]{8})/i

export function extractTxnId(subject: string | null | undefined): string | null {
  if (!subject) return null
  const match = String(subject).match(TXN_RE)
  return match ? match[1] : null
}

export function isExcludedAgent(owner: string | null): boolean {
  if (!owner) return true
  return AGENTS_EXCLUDE.some(name => owner.includes(name))
}

export function inCalendarMonth(date: Date, year: number, month: number): boolean {
  const parts = zonedParts(date)
  return parts.year === year && parts.month === month
}

export function bonusShare(rate: number | null, target: number): number | null {
  if (rate == null) return null
  const realization = rate / target
  if (realization < 0.5) return 0
  if (realization >= 1) return 1
  return (realization - 0.5) / 0.5
}

export function bonusPoints(rate: number | null, target: number, weight = 20): number | null {
  const share = bonusShare(rate, target)
  return share == null ? null : Math.round(share * weight * 10) / 10
}

function calendarDaysBetween(start: Date, end: Date): number {
  const a = zonedParts(start)
  const b = zonedParts(end)
  const da = Date.UTC(a.year, a.month - 1, a.day)
  const db = Date.UTC(b.year, b.month - 1, b.day)
  return Math.round((db - da) / 86_400_000)
}

/** 16:30 grace: next Warsaw 09:00 on a weekday. */
export function slaClockStart(createDate: Date): Date {
  const local = zonedParts(createDate)
  const minutesBeforeClose = 17 * 60 - (local.hour * 60 + local.minute)
  if (minutesBeforeClose > 30) return createDate
  for (let add = 1; add <= 7; add++) {
    const probe = new Date(createDate.getTime() + add * 86_400_000)
    const parts = zonedParts(probe)
    if (parts.weekday >= 1 && parts.weekday <= 5) {
      return fromZonedTime(parts.year, parts.month, parts.day, 9, 0, 0)
    }
  }
  return createDate
}

export function evaluateHeadlineSla(ticket: KpiTicket): {
  eligible: boolean
  met: boolean | null
  excludedOffHours: boolean
  unreliable: boolean
} {
  const threshold = HEADLINE_SLA_HOURS[ticket.channel]
  const unreliable = Boolean(
    ticket.firstAgentReplyAt && ticket.closedAt && ticket.closedAt < ticket.firstAgentReplyAt
  )
  const wouldBeEligible = Boolean(
    threshold != null
    && ticket.firstAgentReplyAt
    && ticket.firstContactAt
    && ticket.firstAgentReplyAt >= ticket.firstContactAt
    && !unreliable
  )
  const excludedOffHours = wouldBeEligible && !isWithinBusinessHours(ticket.firstContactAt)
  const eligible = wouldBeEligible && isWithinBusinessHours(ticket.firstContactAt)
  if (!eligible) {
    return { eligible: false, met: null, excludedOffHours, unreliable }
  }
  let start = slaClockStart(ticket.firstContactAt)
  if (ticket.firstAgentReplyAt! < start) start = ticket.firstContactAt
  const seconds = businessSecondsBetween(start, ticket.firstAgentReplyAt!)
  const hours = seconds == null ? null : seconds / 3600
  return {
    eligible: true,
    met: hours != null && hours <= threshold!,
    excludedOffHours: false,
    unreliable: false
  }
}

export function buildKpiReport(input: {
  year: number
  month: number
  today: Date
  tickets: KpiTicket[]
  csat: CsatRow[]
  deals: PaidDeal[]
  coverage: {
    ticketsThrough: string
    chatsThrough: string
    csatThrough: string
    monthInProgress: boolean
  }
  ai?: { denominator: number, resolved: number, rate: number | null, rawContainment: number | null }
}) {
  const { year, month, today, tickets, csat, deals } = input
  const txnCounts = new Map<string, number>()
  for (const ticket of tickets) {
    const txn = ticket.relatedTransactionId || extractTxnId(ticket.subject)
    if (txn) txnCounts.set(txn, (txnCounts.get(txn) || 0) + 1)
  }

  const period = tickets.filter(ticket =>
    !isExcludedAgent(ticket.owner) && inCalendarMonth(ticket.createdAt, year, month)
  )
  const closed = period.filter(ticket => ticket.status === 'closed' && ticket.closedAt)

  const dealLookup = new Map<string, PaidDeal[]>()
  for (const deal of deals) {
    for (const companyId of deal.companyIds) {
      if (!dealLookup.has(companyId)) dealLookup.set(companyId, [])
      dealLookup.get(companyId)!.push(deal)
    }
  }

  type Enriched = KpiTicket & {
    fcrDataInvalid: boolean
    fcr: boolean
    sla: ReturnType<typeof evaluateHeadlineSla>
    qaPass: boolean
    retained: boolean
    windowComplete: boolean
    hasCompany: boolean
  }

  function enrich(ticket: KpiTicket): Enriched {
    const hoursToClose = ticket.closedAt && ticket.createdAt
      ? (ticket.closedAt.getTime() - ticket.createdAt.getTime()) / 3_600_000
      : null
    const fcrDataInvalid = hoursToClose != null && hoursToClose < 0
    const txn = ticket.relatedTransactionId || extractTxnId(ticket.subject)
    const fcr = hoursToClose != null && !fcrDataInvalid && hoursToClose <= FCR_MAX_HOURS && (txn ? txnCounts.get(txn) === 1 : true)
    const daysSince = ticket.lastActivityAt ? calendarDaysBetween(ticket.lastActivityAt, today) : null
    const inTouch = ticket.status === 'closed' || (daysSince != null && daysSince <= QA_IN_TOUCH_DAYS)
    const qaPass = Boolean(ticket.category && ticket.priority && inTouch)
    const windowEnd = ticket.closedAt
      ? new Date(ticket.closedAt.getTime() + RETENTION_WINDOW_DAYS * 86_400_000)
      : null
    let retained = false
    if (ticket.closedAt && windowEnd) {
      outer: for (const companyId of ticket.companyIds) {
        for (const deal of dealLookup.get(companyId) || []) {
          if (deal.paidDate > ticket.closedAt && deal.paidDate <= windowEnd) {
            retained = true
            break outer
          }
        }
      }
    }
    return {
      ...ticket,
      fcrDataInvalid,
      fcr,
      sla: evaluateHeadlineSla(ticket),
      qaPass,
      retained,
      windowComplete: Boolean(windowEnd && windowEnd <= today),
      hasCompany: ticket.companyIds.length > 0
    }
  }

  const periodEnriched = period.map(enrich)
  const closedEnriched = closed.map(enrich)

  const retentionClosed = tickets.filter((ticket) => {
    if (ticket.status !== 'closed' || !ticket.closedAt || isExcludedAgent(ticket.owner)) return false
    const parts = zonedParts(ticket.closedAt)
    if (parts.year !== year) return false
    return parts.month >= 3 && parts.month <= month
  }).map(enrich)

  const periodCsat = csat.filter(row =>
    row.survey === 'email_phone' && inCalendarMonth(row.date, year, month)
  )

  function rowFor(agent: string, closedRows: Enriched[], allRows: Enriched[], csatRows: CsatRow[], retentionRows: Enriched[]): AgentKpiRow {
    const fcrBase = closedRows.filter(ticket => !ticket.fcrDataInvalid)
    const slaPool = closedRows.filter(ticket => ticket.sla.eligible)
    const withCompany = retentionRows.filter(ticket => ticket.hasCompany)
    const complete = withCompany.filter(ticket => ticket.windowComplete)
    const fcrR = fcrBase.length ? fcrBase.filter(ticket => ticket.fcr).length / fcrBase.length : null
    const slaR = slaPool.length ? slaPool.filter(ticket => ticket.sla.met).length / slaPool.length : null
    const csatHappy = csatRows.filter(row => row.rating === 2).length
    const csatR = csatRows.length ? csatHappy / csatRows.length : null
    const retR = complete.length ? complete.filter(ticket => ticket.retained).length / complete.length : null
    const qaR = allRows.length ? allRows.filter(ticket => ticket.qaPass).length / allRows.length : null
    const parts = [
      bonusPoints(fcrR, KPI_TARGETS.fcr),
      bonusPoints(slaR, KPI_TARGETS.sla),
      bonusPoints(csatR, KPI_TARGETS.csat),
      bonusPoints(retR, KPI_TARGETS.retention),
      bonusPoints(qaR, KPI_TARGETS.qa)
    ]
    const bonus = parts.every(part => part != null)
      ? Math.round(parts.reduce((sum, part) => sum + (part || 0), 0) * 10) / 10
      : parts.filter(part => part != null).length
        ? Math.round(parts.reduce((sum, part) => sum + (part || 0), 0) * 10) / 10
        : null
    return {
      agent,
      closed: closedRows.length,
      all: allRows.length,
      fcrN: fcrBase.filter(ticket => ticket.fcr).length,
      fcrDen: fcrBase.length,
      fcrR,
      fcrDataInvalid: closedRows.length - fcrBase.length,
      slaMet: slaPool.filter(ticket => ticket.sla.met).length,
      slaTotal: slaPool.length,
      slaR,
      slaExcludedOffHours: closedRows.filter(ticket => ticket.sla.excludedOffHours).length,
      slaUnreliable: closedRows.filter(ticket => ticket.sla.unreliable).length,
      csatHappy,
      csatTotal: csatRows.length,
      csatR,
      retN: complete.filter(ticket => ticket.retained).length,
      retD: complete.length,
      retOpen: withCompany.filter(ticket => !ticket.windowComplete).length,
      retR,
      qaPass: allRows.filter(ticket => ticket.qaPass).length,
      qaTotal: allRows.length,
      qaR,
      bonus
    }
  }

  const agents = [...new Set(periodEnriched.map(ticket => ticket.owner).filter(Boolean) as string[])]
  const agentRows = agents
    .map((agent) => {
      const allRows = periodEnriched.filter(ticket => ticket.owner === agent)
      if (allRows.length < MIN_TICKETS) return null
      return rowFor(
        agent,
        closedEnriched.filter(ticket => ticket.owner === agent),
        allRows,
        periodCsat.filter(row => row.owner === agent),
        retentionClosed.filter(ticket => ticket.owner === agent)
      )
    })
    .filter((row): row is AgentKpiRow => Boolean(row))
    .sort((a, b) => b.closed - a.closed)

  const team = rowFor('Zespół', closedEnriched, periodEnriched, periodCsat, retentionClosed)
  const withoutArmand = rowFor(
    'Zespół bez Armanda',
    closedEnriched.filter(ticket => !ticket.owner?.includes('Armand')),
    periodEnriched.filter(ticket => !ticket.owner?.includes('Armand')),
    periodCsat.filter(row => !row.owner?.includes('Armand')),
    retentionClosed.filter(ticket => !ticket.owner?.includes('Armand'))
  )

  return {
    year,
    month,
    generatedAt: today.toISOString(),
    coverage: input.coverage,
    targets: KPI_TARGETS,
    team,
    withoutArmand,
    agents: agentRows,
    counts: {
      period: period.length,
      closed: closed.length,
      csatEmailPhone: periodCsat.length,
      csatChatExcluded: csat.filter(row => row.survey === 'chat' && inCalendarMonth(row.date, year, month)).length
    },
    ai: input.ai
  }
}
