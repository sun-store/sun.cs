<script setup lang="ts">
import {
  CATEGORY_LABELS,
  type AppRole,
  type TicketStatus
} from '~~/shared/domain'
import { seesAllTickets } from '~~/shared/access'
import {
  DEPARTMENTS,
  DEPARTMENT_LABELS,
  hangingSinceLabel,
  type Department
} from '~~/shared/departments'

type QueueFilter = 'all' | 'mine' | 'unassigned'

const status = ref<TicketStatus | 'all'>('open')
const queue = ref<QueueFilter>('all')
const department = ref<Department | 'all'>('all')
const page = ref(1)

type TicketsListResponse = {
  tickets: Array<{
    id: string
    subject: string | null
    summary?: string | null
    category: string | null
    categoryLabel?: string | null
    relatedTransactionId?: string | null
    department?: Department
    departmentLabel?: string
    ownerName?: string | null
    firstContactAt: string
    [key: string]: unknown
  }>
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

const { data: me } = await useFetch<{ role?: string, agentId?: string | null }>('/api/me')

const { data, refresh, pending, error } = await useFetch<TicketsListResponse>('/api/tickets', {
  query: computed(() => ({
    status: status.value,
    ownerId: queue.value,
    department: department.value,
    page: page.value
  }))
})

watch([status, queue, department], () => {
  if (page.value !== 1) {
    page.value = 1
    return
  }
  refresh()
})

watch(page, () => {
  refresh()
})

const statusItems = [
  { label: 'Otwarte', value: 'open' },
  { label: 'Czeka', value: 'waiting' },
  { label: 'Zamknięte', value: 'closed' },
  { label: 'Wszystkie', value: 'all' }
]

const queueItems = computed(() => {
  const items: Array<{ label: string, value: QueueFilter }> = [
    { label: 'Wszystkie kolejki', value: 'all' },
    { label: 'Moje', value: 'mine' }
  ]
  if (me.value?.role && seesAllTickets(me.value.role as AppRole)) {
    items.push({ label: 'Nieprzypisane', value: 'unassigned' })
  }
  return items
})

const departmentItems = [
  { label: 'Wszystkie działy', value: 'all' },
  ...DEPARTMENTS.map(value => ({ label: DEPARTMENT_LABELS[value], value }))
]

function categoryText(ticket: TicketsListResponse['tickets'][number]) {
  if (ticket.categoryLabel && ticket.categoryLabel !== '—') return ticket.categoryLabel
  if (typeof ticket.sourceCategory === 'string' && ticket.sourceCategory.trim()) {
    return ticket.sourceCategory
  }
  if (ticket.category && ticket.category in CATEGORY_LABELS) {
    return CATEGORY_LABELS[ticket.category as keyof typeof CATEGORY_LABELS]
  }
  return ticket.category || '—'
}

const pageLabel = computed(() => {
  if (!data.value) return ''
  const { page: p, totalPages, total, pageSize } = data.value
  if (total === 0) return '0 spraw'
  const from = (p - 1) * pageSize + 1
  const to = Math.min(p * pageSize, total)
  return `${from}–${to} z ${total} · strona ${p}/${totalPages}`
})
</script>

<template>
  <div class="py-8">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-medium tracking-tight">
          Tickety
        </h1>
        <p class="mt-1 text-sm text-muted">
          Niezamknięte {{ data?.summary.open ?? 0 }}
          · w puli SLA {{ data?.summary.slaEligible ?? 0 }}
          · spełnione {{ data?.summary.slaMet ?? 0 }}
        </p>
      </div>
      <UButton to="/tickets/new">
        Nowa sprawa
      </UButton>
    </div>

    <div class="mt-6 flex flex-wrap gap-3">
      <USelect
        v-model="department"
        :items="departmentItems"
        value-key="value"
        class="w-52"
      />
      <USelect
        v-model="queue"
        :items="queueItems"
        value-key="value"
        class="w-48"
      />
      <USelect
        v-model="status"
        :items="statusItems"
        value-key="value"
        class="w-40"
      />
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
      Ładowanie…
    </div>

    <template v-else>
      <div
        v-if="data"
        class="mt-4 flex flex-wrap items-center justify-between gap-3"
      >
        <p class="text-sm text-muted">
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
            Poprzednia
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            :disabled="page >= (data.totalPages || 1) || pending"
            @click="page += 1"
          >
            Następna
          </UButton>
        </div>
      </div>

      <UCard class="mt-3">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="text-muted">
              <tr>
                <th class="pb-3 pr-4 font-medium whitespace-nowrap">
                  Transakcja
                </th>
                <th class="pb-3 pr-4 font-medium whitespace-nowrap">
                  Kategoria
                </th>
                <th class="pb-3 pr-4 font-medium whitespace-nowrap">
                  Dział
                </th>
                <th class="pb-3 pr-4 font-medium whitespace-nowrap">
                  Od kiedy wisi
                </th>
                <th class="pb-3 pr-4 font-medium">
                  Podsumowanie
                </th>
                <th class="pb-3 font-medium whitespace-nowrap">
                  Wisi na
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="ticket in data?.tickets || []"
                :key="ticket.id"
                class="border-t border-default"
              >
                <td class="py-3 pr-4 whitespace-nowrap">
                  <NuxtLink
                    :to="`/tickets/${ticket.id}`"
                    class="font-medium hover:underline"
                  >
                    {{ ticket.relatedTransactionId || '—' }}
                  </NuxtLink>
                </td>
                <td class="pr-4 whitespace-nowrap">
                  {{ categoryText(ticket) }}
                </td>
                <td class="pr-4 whitespace-nowrap">
                  {{ ticket.departmentLabel || '—' }}
                </td>
                <td class="pr-4 whitespace-nowrap">
                  {{ hangingSinceLabel(ticket.firstContactAt) }}
                </td>
                <td class="pr-4 max-w-md truncate">
                  {{ ticket.summary || ticket.subject || '—' }}
                </td>
                <td class="whitespace-nowrap">
                  {{ ticket.ownerName || '—' }}
                </td>
              </tr>
              <tr v-if="!data?.tickets?.length">
                <td
                  colspan="6"
                  class="py-8 text-center text-muted"
                >
                  Brak spraw w tym filtrze.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </template>
  </div>
</template>
