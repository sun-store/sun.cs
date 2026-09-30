<script setup lang="ts">
import {
  CHANNEL_LABELS,
  CHANNELS,
  STATUS_LABELS,
  type AppRole,
  type Channel,
  type TicketStatus
} from '~~/shared/domain'
import { seesAllTickets } from '~~/shared/access'

type QueueFilter = 'all' | 'mine' | 'unassigned'

const status = ref<TicketStatus | 'all'>('open')
const channel = ref<Channel | 'all'>('all')
const queue = ref<QueueFilter>('all')
const page = ref(1)

type TicketsListResponse = {
  tickets: Array<{
    id: string
    subject: string | null
    status: string
    channel: string
    contactName?: string | null
    ownerName?: string | null
    sla: { eligible: boolean, met: boolean | null, exclusion: string | null }
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
    channel: channel.value,
    ownerId: queue.value,
    page: page.value
  }))
})

watch([status, channel, queue], () => {
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

const channelItems = [
  { label: 'Wszystkie kanały', value: 'all' },
  ...CHANNELS.map(value => ({ label: CHANNEL_LABELS[value], value }))
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

function slaLabel(ticket: { sla: { eligible: boolean, met: boolean | null, exclusion: string | null } }) {
  if (!ticket.sla.eligible) {
    if (ticket.sla.exclusion === 'missing_reply') return 'Czeka na odpowiedź'
    if (ticket.sla.exclusion === 'off_hours' || ticket.sla.exclusion === 'holiday') return 'Poza pulą'
    return 'Poza SLA'
  }
  return ticket.sla.met ? 'Spełnione' : 'Przekroczone'
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
      <USelect
        v-model="channel"
        :items="channelItems"
        value-key="value"
        class="w-52"
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
                <th class="pb-3 pr-4 font-medium">
                  Kontakt
                </th>
                <th class="pb-3 pr-4 font-medium whitespace-nowrap">
                  Kanał
                </th>
                <th class="pb-3 pr-4 font-medium whitespace-nowrap">
                  Status
                </th>
                <th class="pb-3 pr-4 font-medium whitespace-nowrap">
                  SLA
                </th>
                <th class="pb-3 font-medium whitespace-nowrap">
                  Właściciel
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="ticket in data?.tickets || []"
                :key="ticket.id"
                class="border-t border-default"
              >
                <td class="py-3 pr-4">
                  <NuxtLink
                    :to="`/tickets/${ticket.id}`"
                    class="font-medium hover:underline"
                  >
                    {{ ticket.contactName }}
                  </NuxtLink>
                  <p
                    v-if="ticket.subject"
                    class="text-muted"
                  >
                    {{ ticket.subject }}
                  </p>
                </td>
                <td class="pr-4 whitespace-nowrap">
                  {{ CHANNEL_LABELS[ticket.channel as Channel] }}
                </td>
                <td class="pr-4 whitespace-nowrap">
                  {{ STATUS_LABELS[ticket.status as TicketStatus] }}
                </td>
                <td class="pr-4 whitespace-nowrap">
                  {{ slaLabel(ticket) }}
                </td>
                <td class="whitespace-nowrap">
                  {{ ticket.ownerName || '—' }}
                </td>
              </tr>
              <tr v-if="!data?.tickets?.length">
                <td
                  colspan="5"
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
