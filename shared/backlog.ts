import { DEPARTMENTS, DEPARTMENT_LABELS, hangingSinceLabel, type Department } from './departments'
import { NOW_WINDOW_MIN } from './queues'
import { ticketTopic, TOPIC_LABELS, TOPIC_NEXT_STEP, type Topic } from './ticket-topic'

/** Jedna otwarta sprawa w postaci potrzebnej do policzenia zaległości. */
export type BacklogTicket = {
  id: string
  department: Department
  ownerId: string | null
  ownerName: string | null
  awaiting: 'us' | 'customer' | null
  replyDueAt: Date | null
  firstContactAt: Date
  sourceCategory: string | null
  subject: string | null
  firstCustomerText: string | null
  relatedTransactionId: string | null
  aiNextStep: string | null
}

export type BacklogCounts = {
  open: number
  toReply: number
  overdue: number
  dueSoon: number
  unassigned: number
  waitingCustomer: number
}

export type BacklogDepartmentRow = BacklogCounts & {
  department: Department
  label: string
  oldest: string
  nextStep: string
}

export type BacklogTopicRow = BacklogCounts & {
  topic: Topic
  label: string
  nextStep: string
  departments: string
}

export type BacklogOwnerRow = BacklogCounts & {
  ownerId: string | null
  owner: string
}

export type BacklogOldest = {
  id: string
  transactionId: string | null
  topicLabel: string
  department: string
  owner: string
  age: string
  overdue: boolean
  nextStep: string
}

export type BacklogReport = {
  totals: BacklogCounts
  actions: string[]
  byDepartment: BacklogDepartmentRow[]
  byTopic: BacklogTopicRow[]
  unassignedByTopic: Array<{ topic: Topic, label: string, count: number, nextStep: string }>
  byOwner: BacklogOwnerRow[]
  oldest: BacklogOldest[]
}

function emptyCounts(): BacklogCounts {
  return { open: 0, toReply: 0, overdue: 0, dueSoon: 0, unassigned: 0, waitingCustomer: 0 }
}

function addTo(counts: BacklogCounts, ticket: BacklogTicket, now: Date) {
  counts.open += 1
  if (!ticket.ownerId) counts.unassigned += 1
  if (ticket.awaiting === 'customer') counts.waitingCustomer += 1
  if (ticket.awaiting !== 'us') return
  counts.toReply += 1
  if (!ticket.replyDueAt) return
  const due = ticket.replyDueAt.getTime()
  if (due < now.getTime()) counts.overdue += 1
  else if (due <= now.getTime() + NOW_WINDOW_MIN * 60_000) counts.dueSoon += 1
}

function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one
  const lastTwo = n % 100
  const last = n % 10
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few
  return many
}

function spraw(n: number): string {
  return `${n} ${plural(n, 'sprawa', 'sprawy', 'spraw')}`
}

/** Następny krok dla działu: najpilniejsza rzecz z jego liczników. */
function departmentNextStep(counts: BacklogCounts, topTopic: Topic | null): string {
  if (counts.overdue > 0) {
    const topic = topTopic ? ` Najwięcej: ${TOPIC_LABELS[topTopic]} — ${TOPIC_NEXT_STEP[topTopic].charAt(0).toLowerCase()}${TOPIC_NEXT_STEP[topTopic].slice(1)}` : ''
    return `Odpowiedz na ${spraw(counts.overdue)} po terminie SLA, od najstarszej.${topic}`
  }
  if (counts.dueSoon > 0) return `Odpowiedz na ${spraw(counts.dueSoon)}, którym SLA mija w ciągu godziny.`
  if (counts.unassigned > 0) return `Przypisz ${spraw(counts.unassigned)} bez osoby prowadzącej.`
  if (counts.toReply > 0) return `Odpowiedz na ${spraw(counts.toReply)} czekające na nas.`
  if (counts.waitingCustomer > 0) return 'Czekamy na klientów — przypomnij się w sprawach starszych niż 3 dni.'
  return 'Brak zaległości.'
}

function topTopicOf(tickets: Array<{ topic: Topic, ticket: BacklogTicket }>, now: Date): Topic | null {
  const counts = new Map<Topic, number>()
  for (const { topic, ticket } of tickets) {
    const late = ticket.awaiting === 'us' && ticket.replyDueAt && ticket.replyDueAt.getTime() < now.getTime()
    if (!late) continue
    counts.set(topic, (counts.get(topic) || 0) + 1)
  }
  let best: Topic | null = null
  for (const [topic, count] of counts) {
    if (!best || count > (counts.get(best) || 0)) best = topic
  }
  return best
}

/** Priorytet sortowania: po terminie > zaraz mija > nieprzypisane > razem. */
function byUrgency(a: BacklogCounts, b: BacklogCounts): number {
  return b.overdue - a.overdue
    || b.dueSoon - a.dueSoon
    || b.unassigned - a.unassigned
    || b.open - a.open
}

export function buildBacklog(tickets: BacklogTicket[], now = new Date()): BacklogReport {
  const totals = emptyCounts()
  const withTopic = tickets.map(ticket => ({
    ticket,
    topic: ticketTopic({
      sourceCategory: ticket.sourceCategory,
      subject: ticket.subject,
      text: ticket.firstCustomerText
    })
  }))

  const departments = new Map<Department, { counts: BacklogCounts, items: typeof withTopic, oldest: Date | null }>()
  const topics = new Map<Topic, { counts: BacklogCounts, departments: Map<Department, number> }>()
  const owners = new Map<string, { ownerId: string | null, owner: string, counts: BacklogCounts }>()

  for (const item of withTopic) {
    const { ticket, topic } = item
    addTo(totals, ticket, now)

    const dept = departments.get(ticket.department) ?? { counts: emptyCounts(), items: [], oldest: null }
    addTo(dept.counts, ticket, now)
    dept.items.push(item)
    if (!dept.oldest || ticket.firstContactAt < dept.oldest) dept.oldest = ticket.firstContactAt
    departments.set(ticket.department, dept)

    const topicRow = topics.get(topic) ?? { counts: emptyCounts(), departments: new Map() }
    addTo(topicRow.counts, ticket, now)
    topicRow.departments.set(ticket.department, (topicRow.departments.get(ticket.department) || 0) + 1)
    topics.set(topic, topicRow)

    const ownerKey = ticket.ownerId ?? 'none'
    const owner = owners.get(ownerKey) ?? {
      ownerId: ticket.ownerId,
      owner: ticket.ownerId ? (ticket.ownerName || 'Bez nazwy') : 'Nieprzypisane',
      counts: emptyCounts()
    }
    addTo(owner.counts, ticket, now)
    owners.set(ownerKey, owner)
  }

  const byDepartment: BacklogDepartmentRow[] = DEPARTMENTS
    .filter(department => departments.has(department))
    .map((department) => {
      const row = departments.get(department)!
      return {
        department,
        label: DEPARTMENT_LABELS[department],
        ...row.counts,
        oldest: row.oldest ? hangingSinceLabel(row.oldest, now) : '—',
        nextStep: departmentNextStep(row.counts, topTopicOf(row.items, now))
      }
    })
    .sort(byUrgency)

  const byTopic: BacklogTopicRow[] = [...topics.entries()]
    .map(([topic, row]) => ({
      topic,
      label: TOPIC_LABELS[topic],
      nextStep: TOPIC_NEXT_STEP[topic],
      departments: [...row.departments.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([department, count]) => `${DEPARTMENT_LABELS[department]} ${count}`)
        .join(' · '),
      ...row.counts
    }))
    .sort(byUrgency)

  const unassignedByTopic = byTopic
    .filter(row => row.unassigned > 0)
    .map(row => ({ topic: row.topic, label: row.label, count: row.unassigned, nextStep: row.nextStep }))
    .sort((a, b) => b.count - a.count)

  const byOwner: BacklogOwnerRow[] = [...owners.values()]
    .map(row => ({ ownerId: row.ownerId, owner: row.owner, ...row.counts }))
    .sort(byUrgency)

  const oldest: BacklogOldest[] = withTopic
    .filter(({ ticket }) => ticket.awaiting === 'us')
    .sort((a, b) => {
      const dueA = a.ticket.replyDueAt?.getTime() ?? a.ticket.firstContactAt.getTime()
      const dueB = b.ticket.replyDueAt?.getTime() ?? b.ticket.firstContactAt.getTime()
      return dueA - dueB
    })
    .slice(0, 10)
    .map(({ ticket, topic }) => ({
      id: ticket.id,
      transactionId: ticket.relatedTransactionId,
      topicLabel: TOPIC_LABELS[topic],
      department: DEPARTMENT_LABELS[ticket.department],
      owner: ticket.ownerName || 'nieprzypisana',
      age: hangingSinceLabel(ticket.firstContactAt, now),
      overdue: Boolean(ticket.replyDueAt && ticket.replyDueAt.getTime() < now.getTime()),
      nextStep: ticket.aiNextStep?.trim() || TOPIC_NEXT_STEP[topic]
    }))

  const actions: string[] = []
  if (totals.overdue > 0) {
    const worst = byDepartment.find(row => row.overdue > 0)
    actions.push(`${spraw(totals.overdue)} po terminie SLA${worst ? `, najwięcej w dziale ${worst.label} (${worst.overdue})` : ''}. Klikaj „Weź najpilniejszą” — bierze od najbardziej spóźnionej.`)
  }
  if (totals.dueSoon > 0) {
    actions.push(`${spraw(totals.dueSoon)} z SLA mijającym w ciągu godziny — kolejka „Na teraz”.`)
  }
  if (totals.unassigned > 0) {
    const top = unassignedByTopic.slice(0, 3).map(row => `${row.label} ${row.count}`).join(', ')
    actions.push(`${spraw(totals.unassigned)} bez osoby prowadzącej (${top}). Przypisz albo weź najpilniejszą.`)
  }
  const junk = topics.get('junk')?.counts.open ?? 0
  if (junk > 0) actions.push(`${spraw(junk)} to duplikaty / spam / testy — do zamknięcia bez odpowiedzi.`)
  const unknown = topics.get('unknown')?.counts.open ?? 0
  if (unknown > 0) actions.push(`${spraw(unknown)} bez rozpoznanego tematu — przeczytaj i ustaw temat.`)
  if (!actions.length) actions.push('Brak zaległości. Sprawdź „Czeka na klienta” — przypomnij się w starszych niż 3 dni.')

  return { totals, actions, byDepartment, byTopic, unassignedByTopic, byOwner, oldest }
}
