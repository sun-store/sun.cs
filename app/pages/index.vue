<script setup lang="ts">
import {
  CHANNEL_LABELS,
  CHANNELS,
  STATUS_LABELS,
  type Channel,
  type TicketStatus
} from '~~/shared/domain'

const status = ref<TicketStatus | 'all'>('all')
const channel = ref<Channel | 'all'>('all')

type TicketsListResponse = {
  tickets: Array<{
    id: string
    subject: string | null
    status: string
    channel: string
    sla: { eligible: boolean, met: boolean | null, exclusion: string | null }
    [key: string]: unknown
  }>
  summary: {
    open: number
    slaEligible: number
    slaMet: number
  }
  truncated?: boolean
}

const { data, refresh, pending, error } = await useFetch<TicketsListResponse>('/api/tickets', {
  query: computed(() => ({
    status: status.value,
    channel: channel.value
  }))
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

function slaLabel(ticket: { sla: { eligible: boolean, met: boolean | null, exclusion: string | null } }) {
  if (!ticket.sla.eligible) {
    if (ticket.sla.exclusion === 'missing_reply') return 'Czeka na odpowiedź'
    if (ticket.sla.exclusion === 'off_hours' || ticket.sla.exclusion === 'holiday') return 'Poza pulą'
    return 'Poza SLA'
  }
  return ticket.sla.met ? 'Spełnione' : 'Przekroczone'
}
</script>

<template>
  <div class="py-8">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-medium tracking-tight">
          Tickety
        </h1>
        <p class="mt-1 text-sm text-muted">
          Otwarte {{ data?.summary.open ?? 0 }}
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
        v-model="status"
        :items="statusItems"
        value-key="value"
        class="w-40"
        @update:model-value="refresh()"
      />
      <USelect
        v-model="channel"
        :items="channelItems"
        value-key="value"
        class="w-52"
        @update:model-value="refresh()"
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

    <UCard
      v-else
      class="mt-6"
    >
      <table class="w-full text-left text-sm">
        <thead class="text-muted">
          <tr>
            <th class="pb-3 font-medium">
              Kontakt
            </th>
            <th class="pb-3 font-medium">
              Kanał
            </th>
            <th class="pb-3 font-medium">
              Status
            </th>
            <th class="pb-3 font-medium">
              SLA
            </th>
            <th class="pb-3 font-medium">
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
            <td class="py-3">
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
            <td>{{ CHANNEL_LABELS[ticket.channel as Channel] }}</td>
            <td>{{ STATUS_LABELS[ticket.status as TicketStatus] }}</td>
            <td>{{ slaLabel(ticket) }}</td>
            <td>{{ ticket.ownerName || '—' }}</td>
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
      <p
        v-if="data?.truncated"
        class="mt-4 text-sm text-muted"
      >
        Lista pokazuje 1000 najnowszych spraw. Starsze są w bazie, tu ich nie ma.
      </p>
    </UCard>
  </div>
</template>
