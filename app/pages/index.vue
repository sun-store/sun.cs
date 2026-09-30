<script setup lang="ts">
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CHANNEL_LABELS,
  PRIORITY_LABELS,
  TICKET_PRIORITIES,
  type AppRole,
  type TicketStatus
} from '~~/shared/domain'
import { canBrowseAllDepartments, defaultDepartmentFilter } from '~~/shared/access'
import {
  DEPARTMENTS,
  hangingSinceLabel,
  type Department
} from '~~/shared/departments'
import {
  QUEUES,
  type QueueKey
} from '~~/shared/queues'
import {
  cleanSubjectLine,
  shortTransactionId
} from '~~/shared/reply-due-label'
import type { SlaBadge } from '~~/shared/sla-label'
import {
  defaultThreadChannel,
  groupEventsByThreadChannel,
  THREAD_CHANNELS,
  type ThreadChannel
} from '~~/shared/thread-channels'

const { t, locale, messages } = useAppLocale()

const workQueue = ref<QueueKey>('now')
const status = ref<TicketStatus | 'all'>('all')
const page = ref(1)
const searchInput = ref('')
const searchQ = ref('')
const selectedId = ref<string | null>(null)
const route = useRoute()
const router = useRouter()
const config = useRuntimeConfig()
const meAiEnabled = ref(false)
const aiEnabled = computed(() => Boolean(config.public.aiEnabled || meAiEnabled.value))

type TicketListItem = {
  id: string
  subject: string | null
  summary?: string | null
  aiSummary?: string | null
  category: string | null
  categoryLabel?: string | null
  sourceCategory?: string | null
  topicLabel?: string | null
  relatedTransactionId?: string | null
  department?: Department
  departmentLabel?: string
  ownerId?: string | null
  ownerName?: string | null
  firstContactAt: string
  awaiting?: 'us' | 'customer' | null
  replyDueAt?: string | null
  slaBadge?: SlaBadge
  [key: string]: unknown
}

type TicketsListResponse = {
  tickets: TicketListItem[]
  summary: {
    open: number
    slaEligible: number
    slaMet: number
  }
  page: number
  pageSize: number
  total: number
  totalPages: number
}

type CountsResponse = {
  counts: Record<QueueKey, number>
  queues: Array<{ id: QueueKey, label: string, count: number }>
}

const { data: me } = await useFetch<{
  role?: AppRole
  agentId?: string | null
  department?: Department
  aiEnabled?: boolean
}>('/api/me')

meAiEnabled.value = Boolean(me.value?.aiEnabled)

const department = ref<Department | 'all'>(
  me.value?.role
    ? defaultDepartmentFilter(me.value.role, me.value.department)
    : 'all'
)

watch(me, (value) => {
  if (!value?.role) return
  department.value = defaultDepartmentFilter(value.role, value.department)
  meAiEnabled.value = Boolean(value.aiEnabled)
}, { once: true })

watch(() => route.query.queue, (value) => {
  if (typeof value === 'string' && (QUEUES as readonly string[]).includes(value)) {
    workQueue.value = value as QueueKey
  }
}, { immediate: true })

watch(() => route.query.case, (value) => {
  selectedId.value = typeof value === 'string' ? value : null
}, { immediate: true })

watch(() => route.query.search, (value) => {
  if (typeof value === 'string') {
    searchInput.value = value
    searchQ.value = value
  }
}, { immediate: true })

function syncUrl() {
  const query: Record<string, string> = {
    queue: workQueue.value
  }
  if (department.value !== 'all') query.department = department.value
  if (searchQ.value) query.search = searchQ.value
  if (selectedId.value) query.case = selectedId.value
  if (page.value > 1) query.page = String(page.value)
  router.replace({ query })
}
const { data, refresh, pending, error } = await useFetch<TicketsListResponse>('/api/tickets', {
  query: computed(() => {
    const base: Record<string, string | number> = {
      department: department.value,
      page: page.value
    }
    if (searchQ.value) {
      base.q = searchQ.value
      return base
    }
    base.queue = workQueue.value
    base.status = status.value
    return base
  })
})

type TicketPanelDetail = {
  id?: string
  subject?: string | null
  contactName?: string | null
  contact?: { display_name?: string | null, customer_role?: string | null } | null
  relatedTransactionId?: string | null
  categoryLabel?: string | null
  topicLabel?: string | null
  nextStep?: string | null
  sourceCategory?: string | null
  category?: string | null
  department?: Department | null
  departmentLabel?: string | null
  awaiting?: 'us' | 'customer' | null
  replyDueAt?: string | null
  firstContactAt?: string
  channel?: string
  status?: string
  ownerId?: string | null
  ownerName?: string | null
  aiSummary?: string | null
  aiNeed?: string | null
  aiNextStep?: string | null
  slaBadge?: SlaBadge
  events?: Array<{
    id: string
    senderType: string
    direction: string
    channel: string
    body?: string | null
    createdAt: string
  }>
}

const panelTicket = ref<TicketPanelDetail | null>(null)
const panelPending = ref(false)
const panelError = ref('')

async function refreshPanel() {
  if (!selectedId.value) {
    panelTicket.value = null
    panelError.value = ''
    return
  }
  panelPending.value = true
  panelError.value = ''
  try {
    panelTicket.value = await $fetch<TicketPanelDetail>(`/api/tickets/${selectedId.value}`)
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, statusMessage?: string }
    panelError.value = fetchErr.data?.statusMessage || fetchErr.statusMessage || 'Nie udało się wczytać sprawy.'
    panelTicket.value = null
  } finally {
    panelPending.value = false
  }
}

watch(selectedId, () => {
  refreshPanel()
})

const { data: countsData, refresh: refreshCounts } = await useFetch<CountsResponse>('/api/tickets/counts', {
  query: computed(() => ({
    department: department.value
  }))
})

let countsTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  countsTimer = setInterval(() => {
    refreshCounts()
  }, 60_000)
})
onUnmounted(() => {
  if (countsTimer) clearInterval(countsTimer)
})

watch([workQueue, department, searchQ], () => {
  if (page.value !== 1) {
    page.value = 1
    return
  }
  refresh()
})

watch(department, () => {
  refreshCounts()
})

watch(page, () => {
  refresh()
})

function applySearch() {
  searchQ.value = searchInput.value.trim()
  selectedId.value = null
  page.value = 1
}

function clearSearch() {
  searchInput.value = ''
  searchQ.value = ''
  page.value = 1
}

function selectTicket(id: string) {
  selectedId.value = id
  syncUrl()
}

function closePanel() {
  selectedId.value = null
  syncUrl()
}

const takeNextBusy = ref(false)
const takeNextMessage = ref('')

async function takeNext() {
  takeNextMessage.value = ''
  takeNextBusy.value = true
  try {
    const result = await $fetch<{ id: string | null }>('/api/tickets/next', {
      method: 'POST',
      body: { queue: 'now' }
    })
    await refresh()
    await refreshCounts()
    if (result?.id) {
      selectTicket(result.id)
      workQueue.value = 'now'
      return
    }
    takeNextMessage.value = t('inbox', 'takeNextEmpty')
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string } }
    takeNextMessage.value = fetchErr.data?.statusMessage || t('inbox', 'takeNextError')
    await refresh()
    await refreshCounts()
  } finally {
    takeNextBusy.value = false
  }
}

watch([workQueue, department, searchQ, selectedId, page], () => {
  syncUrl()
})

const panelChannel = ref<ThreadChannel>('chat')

const eventsByChannel = computed(() =>
  groupEventsByThreadChannel(panelTicket.value?.events || [])
)

const panelChannelTabs = computed(() =>
  THREAD_CHANNELS.map(channel => ({
    channel,
    label: channel === 'chat'
      ? t('inbox', 'channelChat')
      : channel === 'email'
        ? t('inbox', 'channelEmail')
        : t('inbox', 'channelPhone'),
    count: eventsByChannel.value[channel].length
  }))
)

const panelEvents = computed(() => eventsByChannel.value[panelChannel.value] || [])

watch(panelTicket, (ticket) => {
  panelChannel.value = defaultThreadChannel(ticket?.channel, eventsByChannel.value)
})

const migrateDepartment = ref<Department>('cs')
watch(() => panelTicket.value?.department, (value) => {
  if (value) migrateDepartment.value = value
}, { immediate: true })

const panelOwnerId = ref<string | 'unassigned'>('unassigned')
watch(() => panelTicket.value?.ownerId, (value) => {
  panelOwnerId.value = value || 'unassigned'
}, { immediate: true })

const { data: agentsData, refresh: refreshAgents } = await useFetch<Array<{
  id: string
  display_name: string
  department?: Department | null
}>>('/api/agents', {
  query: computed(() => ({
    department: panelTicket.value?.department || 'all'
  })),
  immediate: false
})

watch(() => panelTicket.value?.department, () => {
  if (selectedId.value) refreshAgents()
})

const ownerItems = computed(() => [
  { label: t('inbox', 'unassigned'), value: 'unassigned' as const },
  ...(agentsData.value || []).map(agent => ({
    label: agent.display_name,
    value: agent.id
  }))
])

const migrating = ref(false)
const migrateError = ref('')
const savingOwner = ref(false)
const ownerError = ref('')
const replyBody = ref('')
const replyError = ref('')
const sending = ref(false)
const closing = ref(false)
const closeError = ref('')
const closeForm = reactive({
  category: 'delivery' as typeof CATEGORIES[number],
  priority: 'medium' as typeof TICKET_PRIORITIES[number]
})

const closeCategoryItems = CATEGORIES.map(value => ({ label: CATEGORY_LABELS[value], value }))
const closePriorityItems = TICKET_PRIORITIES.map(value => ({ label: PRIORITY_LABELS[value], value }))

async function saveDepartment() {
  if (!selectedId.value) return
  migrateError.value = ''
  migrating.value = true
  try {
    await $fetch(`/api/tickets/${selectedId.value}`, {
      method: 'PATCH',
      body: { department: migrateDepartment.value }
    })
    await refreshPanel()
    await refresh()
    await refreshCounts()
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string } }
    migrateError.value = fetchErr.data?.statusMessage || 'Nie udało się przenieść sprawy.'
  } finally {
    migrating.value = false
  }
}

async function saveOwner() {
  if (!selectedId.value) return
  ownerError.value = ''
  savingOwner.value = true
  try {
    await $fetch(`/api/tickets/${selectedId.value}`, {
      method: 'PATCH',
      body: { ownerId: panelOwnerId.value === 'unassigned' ? null : panelOwnerId.value }
    })
    await refreshPanel()
    await refresh()
    await refreshCounts()
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string } }
    ownerError.value = fetchErr.data?.statusMessage || 'Nie udało się zmienić prowadzącego.'
  } finally {
    savingOwner.value = false
  }
}

async function sendPanelReply() {
  if (!selectedId.value || !replyBody.value.trim()) return
  replyError.value = ''
  sending.value = true
  try {
    await $fetch(`/api/tickets/${selectedId.value}/events`, {
      method: 'POST',
      body: {
        body: replyBody.value,
        direction: 'to_customer',
        channel: panelChannel.value,
        senderType: 'agent'
      }
    })
    replyBody.value = ''
    await refreshPanel()
    await refresh()
    await refreshCounts()
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string } }
    replyError.value = fetchErr.data?.statusMessage || 'Nie udało się wysłać.'
  } finally {
    sending.value = false
  }
}

async function closePanelTicket() {
  if (!selectedId.value) return
  closeError.value = ''
  closing.value = true
  try {
    await $fetch(`/api/tickets/${selectedId.value}`, {
      method: 'PATCH',
      body: {
        status: 'closed',
        category: closeForm.category,
        priority: closeForm.priority
      }
    })
    await refreshPanel()
    await refresh()
    await refreshCounts()
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string } }
    closeError.value = fetchErr.data?.statusMessage || 'Nie można zamknąć bez kategorii i priorytetu.'
  } finally {
    closing.value = false
  }
}

const draftText = ref('')
const draftNeedsReview = ref(false)
const aiBusy = ref(false)
const aiError = ref('')

async function loadSummary() {
  if (!selectedId.value || !aiEnabled.value) return
  aiBusy.value = true
  aiError.value = ''
  try {
    const result = await $fetch<{
      summary: string
      need: string
      nextStep: string
    }>(`/api/tickets/${selectedId.value}/summary`, { method: 'POST' })
    if (panelTicket.value) {
      panelTicket.value = {
        ...panelTicket.value,
        aiSummary: result.summary,
        aiNeed: result.need,
        aiNextStep: result.nextStep
      }
    }
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, statusCode?: number }
    if (fetchErr.statusCode !== 503) {
      aiError.value = fetchErr.data?.statusMessage || 'Nie udało się wygenerować podsumowania.'
    }
  } finally {
    aiBusy.value = false
  }
}

async function loadDraft(variant: 'short' | 'normal' = 'normal') {
  if (!selectedId.value || !aiEnabled.value) return
  aiBusy.value = true
  aiError.value = ''
  try {
    const result = await $fetch<{ text: string, needsReview: boolean }>(
      `/api/tickets/${selectedId.value}/draft`,
      { method: 'POST', body: { variant } }
    )
    draftText.value = result.text
    draftNeedsReview.value = result.needsReview
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string } }
    aiError.value = fetchErr.data?.statusMessage || 'Nie udało się wygenerować szkicu.'
  } finally {
    aiBusy.value = false
  }
}

function insertDraft() {
  if (draftText.value) replyBody.value = draftText.value
}

watch(selectedId, () => {
  draftText.value = ''
  draftNeedsReview.value = false
  aiError.value = ''
  translatedBodies.value = {}
  showOriginal.value = false
})

watch(panelChannel, () => {
  translatedBodies.value = {}
  showOriginal.value = false
})

const translatedBodies = ref<Record<string, string>>({})
const showOriginal = ref(false)
const translating = ref(false)

async function translatePanel() {
  if (!aiEnabled.value || !panelEvents.value.length) {
    translatedBodies.value = {}
    return
  }
  const texts = panelEvents.value
    .map(event => event.body || '')
    .filter(Boolean)
  if (!texts.length) {
    translatedBodies.value = {}
    return
  }
  translating.value = true
  try {
    const res = await $fetch<{ results: Array<{ text: string }> }>('/api/translate', {
      method: 'POST',
      body: {
        texts,
        targetLocale: locale.value
      }
    })
    const map: Record<string, string> = {}
    panelEvents.value.forEach((event, index) => {
      if (event.body && res.results[index]?.text) {
        map[event.id] = res.results[index]!.text
      }
    })
    translatedBodies.value = map
    showOriginal.value = false
  } catch {
    translatedBodies.value = {}
  } finally {
    translating.value = false
  }
}

const departmentSelectItems = computed(() =>
  DEPARTMENTS.map(value => ({
    label: messages.value.departments[value],
    value
  }))
)

const browseAllDepartments = computed(() =>
  Boolean(me.value?.role && canBrowseAllDepartments(me.value.role, me.value.department))
)

const departmentItems = computed(() => {
  if (browseAllDepartments.value) {
    return [
      { label: t('inbox', 'allDepartments'), value: 'all' as const },
      ...DEPARTMENTS.map(value => ({ label: messages.value.departments[value], value }))
    ]
  }
  const own = me.value?.department || 'cs'
  return [{ label: messages.value.departments[own], value: own }]
})

const queueNav = computed(() =>
  QUEUES.map(id => ({
    id,
    label: messages.value.queues[id],
    count: countsData.value?.counts?.[id] ?? 0
  }))
)

function categoryText(ticket: TicketListItem) {
  // Temat z tagu HubSpot albo z treści (shared/ticket-topic.ts) — zamiast „Other” / „Inne”.
  if (typeof ticket.topicLabel === 'string' && ticket.topicLabel) return ticket.topicLabel
  if (ticket.categoryLabel && ticket.categoryLabel !== '—') {
    const first = ticket.categoryLabel.split(' · ')[0]?.trim()
    if (first) return first
  }
  if (typeof ticket.sourceCategory === 'string' && ticket.sourceCategory.trim()) {
    const first = ticket.sourceCategory.split(/[;,|]/)[0]?.trim()
    if (first) return first
  }
  if (ticket.category && ticket.category in CATEGORY_LABELS) {
    return CATEGORY_LABELS[ticket.category as keyof typeof CATEGORY_LABELS]
  }
  return ticket.category || '—'
}

function summaryText(ticket: TicketListItem) {
  if (typeof ticket.aiSummary === 'string' && ticket.aiSummary.trim()) {
    return ticket.aiSummary.trim()
  }
  if (typeof ticket.summary === 'string' && ticket.summary.trim()) {
    return ticket.summary.trim()
  }
  return cleanSubjectLine(ticket.subject)
}

function slaFor(ticket: { awaiting?: 'us' | 'customer' | null, replyDueAt?: string | null, slaBadge?: SlaBadge }) {
  if (ticket.slaBadge) return ticket.slaBadge
  return { text: '—', tone: 'muted' as const }
}

function slaClass(tone: string) {
  if (tone === 'late' || tone === 'overdue') return 'text-black font-medium'
  if (tone === 'soon' || tone === 'urgent') return 'font-medium text-[#F6D736]'
  return 'text-[#727487]'
}

function ownerLabel(ticket: TicketListItem) {
  return ticket.ownerName?.trim() || t('inbox', 'unassigned')
}

function ownerInitials(ticket: TicketListItem) {
  const name = ticket.ownerName?.trim()
  if (!name) return ''
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase()
}

const pageLabel = computed(() => {
  if (!data.value) return ''
  const { page: p, totalPages, total, pageSize } = data.value
  if (total === 0) return locale.value === 'en' ? '0 cases' : '0 spraw'
  const from = (p - 1) * pageSize + 1
  const to = Math.min(p * pageSize, total)
  return locale.value === 'en'
    ? `${from}–${to} of ${total} · page ${p}/${totalPages}`
    : `${from}–${to} z ${total} · strona ${p}/${totalPages}`
})
</script>

<template>
  <div class="py-8">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-medium tracking-tight">
          {{ t('inbox', 'title') }}
        </h1>
        <p class="mt-1 text-sm text-muted">
          {{ t('inbox', 'openSummary') }} {{ data?.summary.open ?? 0 }}
          · {{ t('inbox', 'slaPool') }} {{ data?.summary.slaEligible ?? 0 }}
          · {{ t('inbox', 'slaMet') }} {{ data?.summary.slaMet ?? 0 }}
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton
          color="neutral"
          variant="outline"
          :disabled="pending || takeNextBusy"
          :loading="takeNextBusy"
          :title="locale === 'en'
            ? 'Opens the case that most urgently needs a reply (closest to the SLA deadline or longest overdue) and assigns it to you if nobody owns it.'
            : 'Otwiera sprawę, na którą najpilniej trzeba odpowiedzieć (najbliżej końca SLA albo najdłużej po terminie), i przypisuje ją do Ciebie, jeśli nikt jej nie prowadzi.'"
          @click="takeNext"
        >
          {{ t('inbox', 'takeNext') }}
        </UButton>
        <UButton to="/tickets/new">
          {{ t('nav', 'newCase') }}
        </UButton>
      </div>
    </div>

    <p
      v-if="takeNextMessage"
      class="mt-3 text-sm text-muted"
    >
      {{ takeNextMessage }}
    </p>

    <div class="mt-6 flex flex-wrap items-center gap-3">
      <USelect
        v-model="department"
        :items="departmentItems"
        value-key="value"
        class="w-52"
      />
      <form
        class="flex min-w-[16rem] flex-1 flex-wrap gap-2"
        @submit.prevent="applySearch"
      >
        <UInput
          v-model="searchInput"
          :placeholder="t('inbox', 'searchPlaceholder')"
          class="min-w-[14rem] flex-1"
        />
        <UButton
          type="submit"
          color="neutral"
          variant="outline"
        >
          {{ t('inbox', 'search') }}
        </UButton>
        <UButton
          v-if="searchQ"
          type="button"
          color="neutral"
          variant="ghost"
          @click="clearSearch"
        >
          {{ t('inbox', 'clear') }}
        </UButton>
      </form>
    </div>

    <p
      v-if="error"
      class="mt-6 text-sm text-error"
    >
      {{ error.statusMessage || error.message }}
    </p>

    <div
      v-else-if="pending && !data"
      class="mt-6 text-sm text-muted"
    >
      {{ t('inbox', 'loading') }}
    </div>

    <div
      v-else
      class="mt-6 flex flex-col gap-6 min-[1100px]:flex-row"
    >
      <nav
        v-if="!searchQ"
        class="w-full shrink-0 min-[1100px]:w-56"
      >
        <p class="mb-2 px-3 text-xs font-medium text-[#727487]">
          {{ t('inbox', 'myWork') }}
        </p>
        <ul class="space-y-1">
          <li
            v-for="item in queueNav"
            :key="item.id"
          >
            <button
              type="button"
              class="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors"
              :class="workQueue === item.id
                ? 'bg-black text-white'
                : 'text-black hover:bg-[#F8F8F8]'"
              @click="workQueue = item.id; selectedId = null"
            >
              <span>{{ item.label }}</span>
              <span
                class="tabular-nums"
                :class="workQueue === item.id ? 'text-white/80' : 'text-[#727487]'"
              >
                {{ item.count }}
              </span>
            </button>
          </li>
        </ul>
      </nav>

      <div class="min-w-0 flex-1">
        <div
          v-if="data"
          class="flex flex-wrap items-center justify-between gap-3"
        >
          <p class="text-sm text-muted">
            <span v-if="searchQ">{{ t('inbox', 'resultsFor') }} „{{ searchQ }}” · </span>
            {{ pageLabel }}
          </p>
          <div class="flex gap-2">
            <UButton
              color="neutral"
              variant="outline"
              size="sm"
              :disabled="page <= 1 || pending"
              @click="page -= 1"
            >
              {{ t('inbox', 'prev') }}
            </UButton>
            <UButton
              color="neutral"
              variant="outline"
              size="sm"
              :disabled="page >= (data.totalPages || 1) || pending"
              @click="page += 1"
            >
              {{ t('inbox', 'next') }}
            </UButton>
          </div>
        </div>

        <UCard class="mt-3">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="text-muted">
                <tr>
                  <th class="pb-3 pr-4 font-medium whitespace-nowrap">
                    {{ t('columns', 'sla') }}
                  </th>
                  <th class="pb-3 pr-4 font-medium whitespace-nowrap">
                    {{ t('columns', 'transaction') }}
                  </th>
                  <th class="pb-3 pr-4 font-medium whitespace-nowrap">
                    {{ t('columns', 'category') }}
                  </th>
                  <th class="pb-3 pr-4 font-medium">
                    {{ t('columns', 'summary') }}
                  </th>
                  <th class="pb-3 pr-4 font-medium whitespace-nowrap">
                    {{ t('columns', 'department') }}
                  </th>
                  <th class="pb-3 pr-4 font-medium whitespace-nowrap">
                    {{ t('columns', 'owner') }}
                  </th>
                  <th class="pb-3 font-medium whitespace-nowrap">
                    {{ t('columns', 'since') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="ticket in data?.tickets || []"
                  :key="ticket.id"
                  class="cursor-pointer border-t border-default transition-colors hover:bg-[#F8F8F8]"
                  :class="selectedId === ticket.id ? 'bg-[#F8F8F8]' : ''"
                  @click="selectTicket(ticket.id)"
                >
                  <td
                    class="py-3 pr-4 whitespace-nowrap"
                    :class="slaClass(slaFor(ticket).tone)"
                  >
                    {{ slaFor(ticket).text }}
                  </td>
                  <td class="pr-4 whitespace-nowrap font-medium">
                    {{ shortTransactionId(ticket.relatedTransactionId) }}
                  </td>
                  <td class="pr-4">
                    {{ categoryText(ticket) }}
                  </td>
                  <td class="pr-4 min-w-[18rem]">
                    <p class="line-clamp-2">
                      {{ summaryText(ticket) }}
                    </p>
                  </td>
                  <td class="pr-4 whitespace-nowrap">
                    {{ ticket.departmentLabel || '—' }}
                  </td>
                  <td class="pr-4 whitespace-nowrap">
                    <span class="inline-flex items-center gap-2">
                      <span
                        v-if="ticket.ownerName"
                        class="inline-flex size-6 items-center justify-center rounded-full bg-white text-[10px] font-medium"
                      >
                        {{ ownerInitials(ticket) }}
                      </span>
                      <span
                        v-else
                        class="inline-block size-6 rounded-full border border-dashed border-black/40"
                      />
                      <span :class="ticket.ownerName ? '' : 'text-[#727487]'">
                        {{ ownerLabel(ticket) }}
                      </span>
                    </span>
                  </td>
                  <td class="whitespace-nowrap">
                    {{ hangingSinceLabel(ticket.firstContactAt) }}
                  </td>
                </tr>
                <tr v-if="!data?.tickets?.length">
                  <td
                    colspan="7"
                    class="py-8 text-center text-muted"
                  >
                    {{ searchQ ? t('inbox', 'emptySearch') : t('inbox', 'emptyQueue') }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>
      </div>

      <aside
        v-if="selectedId"
        class="w-full shrink-0 border-t border-default pt-4 min-[1100px]:w-[420px] min-[1100px]:border-t-0 min-[1100px]:border-l min-[1100px]:pt-0 min-[1100px]:pl-6"
      >
        <div class="flex items-start justify-between gap-2">
          <div>
            <p class="text-xs text-muted">
              {{ shortTransactionId(panelTicket?.relatedTransactionId) }}
              · {{ panelTicket?.topicLabel || panelTicket?.categoryLabel || panelTicket?.sourceCategory || panelTicket?.category || '—' }}
            </p>
            <p
              v-if="panelTicket?.categoryLabel && panelTicket.categoryLabel !== panelTicket.topicLabel"
              class="text-xs text-muted"
            >
              HubSpot: {{ panelTicket.categoryLabel }}
            </p>
            <p
              class="mt-1 text-sm"
              :class="slaClass(slaFor({ awaiting: panelTicket?.awaiting, replyDueAt: panelTicket?.replyDueAt }).tone)"
            >
              {{ slaFor({ awaiting: panelTicket?.awaiting, replyDueAt: panelTicket?.replyDueAt }).text }}
            </p>
            <p
              v-if="panelTicket?.nextStep"
              class="mt-2 text-sm"
            >
              <span class="font-medium">Następny krok:</span> {{ panelTicket.nextStep }}
            </p>
          </div>
          <div class="flex gap-1">
            <UButton
              :to="`/tickets/${selectedId}`"
              color="neutral"
              variant="ghost"
              size="sm"
            >
              {{ t('inbox', 'fullCase') }}
            </UButton>
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              @click="closePanel"
            >
              {{ t('inbox', 'close') }}
            </UButton>
          </div>
        </div>

        <p
          v-if="panelPending"
          class="mt-4 text-sm text-muted"
        >
          {{ t('inbox', 'loadingCase') }}
        </p>
        <p
          v-else-if="panelError"
          class="mt-4 text-sm text-error"
        >
          {{ panelError }}
        </p>
        <template v-else-if="panelTicket">
          <h2 class="mt-3 text-lg font-medium tracking-tight">
            {{ panelTicket.contact?.display_name || panelTicket.contactName || '—' }}
          </h2>
          <p class="mt-1 text-sm text-muted">
            {{ panelTicket.departmentLabel || '—' }}
            · {{ panelTicket.ownerName || t('inbox', 'unassigned') }}
            · {{ panelTicket.firstContactAt ? hangingSinceLabel(panelTicket.firstContactAt) : '—' }}
          </p>

          <div class="mt-4 space-y-3">
            <UFormField :label="t('inbox', 'department')">
              <div class="flex gap-2">
                <USelect
                  v-model="migrateDepartment"
                  :items="departmentSelectItems"
                  value-key="value"
                  class="flex-1"
                />
                <UButton
                  color="neutral"
                  variant="outline"
                  size="sm"
                  :loading="migrating"
                  :disabled="migrateDepartment === panelTicket.department"
                  @click="saveDepartment"
                >
                  {{ t('inbox', 'transfer') }}
                </UButton>
              </div>
            </UFormField>
            <p
              v-if="migrateError"
              class="text-sm text-error"
            >
              {{ migrateError }}
            </p>
            <UFormField :label="t('inbox', 'leads')">
              <div class="flex gap-2">
                <USelect
                  v-model="panelOwnerId"
                  :items="ownerItems"
                  value-key="value"
                  class="flex-1"
                />
                <UButton
                  color="neutral"
                  variant="outline"
                  size="sm"
                  :loading="savingOwner"
                  :disabled="panelOwnerId === (panelTicket.ownerId || 'unassigned')"
                  @click="saveOwner"
                >
                  {{ t('inbox', 'save') }}
                </UButton>
              </div>
            </UFormField>
            <p
              v-if="ownerError"
              class="text-sm text-error"
            >
              {{ ownerError }}
            </p>
          </div>

          <div class="mt-5 rounded-md bg-[#F8F8F8] p-3">
            <div class="flex items-center justify-between gap-2">
              <p class="text-xs font-medium">
                {{ t('inbox', 'sunAgent') }}
              </p>
              <UButton
                v-if="aiEnabled"
                color="neutral"
                variant="ghost"
                size="xs"
                :loading="aiBusy"
                @click="loadSummary"
              >
                {{ t('inbox', 'refresh') }}
              </UButton>
            </div>
            <p
              v-if="!aiEnabled"
              class="mt-2 text-sm text-[#727487]"
            >
              {{ t('inbox', 'noAi') }}
            </p>
            <template v-else>
              <p class="mt-2 text-sm">
                {{ panelTicket.aiSummary || t('inbox', 'noSummary') }}
              </p>
              <p
                v-if="panelTicket.aiNeed"
                class="mt-2 text-sm text-[#727487]"
              >
                {{ t('inbox', 'needs') }}: {{ panelTicket.aiNeed }}
              </p>
              <p
                v-if="panelTicket.aiNextStep"
                class="mt-1 text-sm text-[#727487]"
              >
                {{ t('inbox', 'nextStep') }}: {{ panelTicket.aiNextStep }}
              </p>
              <div
                v-if="draftText"
                class="mt-3 rounded-md border border-default bg-white p-3 text-sm"
              >
                <p class="text-xs font-medium text-muted">
                  {{ t('inbox', 'draftTitle') }}
                </p>
                <p class="mt-1 whitespace-pre-wrap">
                  {{ draftText }}
                </p>
                <p
                  v-if="draftNeedsReview"
                  class="mt-1 text-xs text-[#727487]"
                >
                  {{ t('inbox', 'reviewBeforeSend') }}
                </p>
                <div class="mt-2 flex flex-wrap gap-2">
                  <UButton
                    size="sm"
                    @click="insertDraft"
                  >
                    {{ t('inbox', 'insertDraft') }}
                  </UButton>
                  <UButton
                    color="neutral"
                    variant="outline"
                    size="sm"
                    :loading="aiBusy"
                    @click="loadDraft('short')"
                  >
                    {{ t('inbox', 'shorter') }}
                  </UButton>
                </div>
              </div>
              <UButton
                v-else
                class="mt-3"
                color="neutral"
                variant="outline"
                size="sm"
                :loading="aiBusy"
                @click="loadDraft('normal')"
              >
                {{ t('inbox', 'proposeReply') }}
              </UButton>
              <p
                v-if="aiError"
                class="mt-2 text-sm text-error"
              >
                {{ aiError }}
              </p>
            </template>
          </div>

          <div class="mt-5">
            <div class="flex items-center justify-between gap-2">
              <p class="text-xs font-medium text-muted">
                {{ t('inbox', 'recentEvents') }}
                <span
                  v-if="translating"
                  class="ms-2 text-[#727487]"
                >{{ t('translate', 'translating') }}</span>
              </p>
              <div class="flex items-center gap-1">
                <UButton
                  v-if="aiEnabled && panelEvents.length"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :loading="translating"
                  @click="translatePanel"
                >
                  {{ t('translate', 'run') }}
                </UButton>
                <UButton
                  v-if="Object.keys(translatedBodies).length"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  @click="showOriginal = !showOriginal"
                >
                  {{ showOriginal ? t('translate', 'showTranslation') : t('translate', 'showOriginal') }}
                </UButton>
              </div>
            </div>
            <div class="mt-2 flex gap-1 border-b border-default">
              <button
                v-for="tab in panelChannelTabs"
                :key="tab.channel"
                type="button"
                class="rounded-t px-2.5 py-1.5 text-xs font-medium transition-colors"
                :class="panelChannel === tab.channel
                  ? 'bg-[#F8F8F8] text-black'
                  : 'text-muted hover:text-black'"
                @click="panelChannel = tab.channel"
              >
                {{ tab.label }}
                <span class="ms-1 text-[#727487]">{{ tab.count }}</span>
              </button>
            </div>
            <ol class="mt-0 max-h-80 space-y-3 overflow-y-auto rounded-b-md bg-[#F8F8F8] p-3">
              <li
                v-for="event in panelEvents"
                :key="event.id"
                class="rounded-md border border-default/60 bg-white p-3 text-sm"
              >
                <p class="text-xs text-muted">
                  {{ event.senderType }}
                  · {{ CHANNEL_LABELS[event.channel as keyof typeof CHANNEL_LABELS] || event.channel }}
                  · {{ new Date(event.createdAt).toLocaleString(locale === 'en' ? 'en-GB' : 'pl-PL', { timeZone: 'Europe/Warsaw' }) }}
                </p>
                <p class="mt-1 whitespace-pre-wrap">
                  {{ showOriginal ? event.body : (translatedBodies[event.id] || event.body) }}
                </p>
              </li>
              <li
                v-if="!panelEvents.length"
                class="text-sm text-muted"
              >
                {{ t('inbox', 'noChannelEvents') }}
              </li>
            </ol>
            <NuxtLink
              :to="`/tickets/${selectedId}?channel=${panelChannel}`"
              class="mt-2 inline-block text-sm hover:underline"
            >
              {{ t('inbox', 'showThread') }} ({{ panelTicket.events?.length || 0 }})
            </NuxtLink>
          </div>

          <form
            v-if="panelTicket.status !== 'closed'"
            class="mt-5 space-y-2"
            @submit.prevent="sendPanelReply"
          >
            <UTextarea
              v-model="replyBody"
              :rows="4"
              :placeholder="t('inbox', 'replyPlaceholder')"
            />
            <p
              v-if="replyError"
              class="text-sm text-error"
            >
              {{ replyError }}
            </p>
            <div class="flex flex-wrap gap-2">
              <UButton
                type="submit"
                :loading="sending"
                :disabled="!replyBody.trim()"
              >
                {{ t('inbox', 'send') }}
              </UButton>
            </div>
          </form>

          <div
            v-if="panelTicket.status !== 'closed'"
            class="mt-5 space-y-2 border-t border-default pt-4"
          >
            <p class="text-xs font-medium text-muted">
              {{ t('inbox', 'closeCase') }}
            </p>
            <div class="flex flex-wrap gap-2">
              <USelect
                v-model="closeForm.category"
                :items="closeCategoryItems"
                value-key="value"
                class="w-40"
              />
              <USelect
                v-model="closeForm.priority"
                :items="closePriorityItems"
                value-key="value"
                class="w-36"
              />
              <UButton
                color="neutral"
                variant="outline"
                :loading="closing"
                @click="closePanelTicket"
              >
                {{ t('inbox', 'closeCase') }}
              </UButton>
            </div>
            <p
              v-if="closeError"
              class="text-sm text-error"
            >
              {{ closeError }}
            </p>
          </div>
        </template>
      </aside>
    </div>
  </div>
</template>
