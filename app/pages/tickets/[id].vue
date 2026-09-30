<script setup lang="ts">
import {
  type MESSAGE_DIRECTIONS,
  CATEGORIES,
  CATEGORY_LABELS,
  CHANNEL_LABELS,
  PRIORITY_LABELS,
  TICKET_PRIORITIES,
  type Channel
} from '~~/shared/domain'

const route = useRoute()

type TicketDetail = {
  channel: Channel
  conflict?: boolean
  conflictIds?: string[]
  contact?: {
    id: string
    display_name?: string | null
    customer_role?: string | null
    sunstore_user_id?: string | null
    hubspot_contact_id?: string | null
    conflictIds?: string[]
    identifiers?: Array<{ type: string, value: string }>
  } | null
  contactName?: string | null
  subject?: string | null
  events?: Array<{
    id: string
    senderType: string
    direction: string
    channel: string
    body?: string | null
    createdAt: string
  }>
  status?: string
  ownerId?: string | null
  hubspotTicketId?: string | null
  orders?: Array<{
    transactionId: string
    logisticsUrl?: string | null
    status?: string | null
  }>
  category?: string | null
  priority?: string | null
  sla?: {
    eligible: boolean
    met: boolean | null
    exclusion: string | null
  }
}

const { data, refresh, error } = await useFetch<TicketDetail>(() => `/api/tickets/${route.params.id}`)

const reply = reactive({
  body: '',
  direction: 'to_customer' as typeof MESSAGE_DIRECTIONS[number],
  channel: 'email' as Channel
})
const closeForm = reactive({
  category: 'delivery' as typeof CATEGORIES[number],
  priority: 'medium' as typeof TICKET_PRIORITIES[number]
})
const replyError = ref('')
const replyInfo = ref('')
const closeError = ref('')
const sending = ref(false)
const closing = ref(false)

watch(() => data.value?.channel, (channel) => {
  if (channel) reply.channel = channel as Channel
}, { immediate: true })

const directionItems = [
  { label: 'Do klienta', value: 'to_customer' },
  { label: 'Do sprzedawcy', value: 'to_seller' },
  { label: 'Notatka wewnętrzna', value: 'internal' }
]

const categoryItems = CATEGORIES.map(value => ({ label: CATEGORY_LABELS[value], value }))
const priorityItems = TICKET_PRIORITIES.map(value => ({ label: PRIORITY_LABELS[value], value }))

function eventLabel(event: { senderType: string, direction: string, channel: string }) {
  if (event.senderType === 'system') return 'Zmiana w sprawie'
  const who = event.senderType === 'bot'
    ? 'Bot'
    : event.senderType === 'agent' ? 'Agent' : 'Klient'
  const dir = event.direction === 'to_seller'
    ? 'do sprzedawcy'
    : event.direction === 'internal' ? 'notatka' : 'do klienta'
  return `${who} · ${CHANNEL_LABELS[event.channel as Channel] || event.channel} · ${dir}`
}

function slaText() {
  const sla = data.value?.sla
  if (!sla) return '—'
  if (!sla.eligible) return sla.exclusion === 'missing_reply' ? 'Czeka na pierwszą odpowiedź do klienta' : 'Poza pulą SLA'
  return sla.met ? 'SLA spełnione' : 'SLA przekroczone'
}

async function sendReply() {
  replyError.value = ''
  replyInfo.value = ''
  sending.value = true
  try {
    const result = await $fetch<{ mailSent?: boolean }>(`/api/tickets/${route.params.id}/events`, {
      method: 'POST',
      body: {
        body: reply.body,
        direction: reply.direction,
        channel: reply.channel,
        senderType: 'agent'
      }
    })
    const isCustomerMail = reply.channel === 'email' && reply.direction === 'to_customer'
    replyInfo.value = !isCustomerMail
      ? ''
      : (result.mailSent
          ? 'Mail wysłany z Outlooka i zapisany w sprawie.'
          : 'Zapisano w sprawie. Mail nie wyszedł: Outlook nie jest jeszcze podłączony.')
    reply.body = ''
    await refresh()
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string } }
    replyError.value = fetchErr.data?.statusMessage || 'Nie udało się wysłać.'
  } finally {
    sending.value = false
  }
}

async function closeTicket() {
  closeError.value = ''
  closing.value = true
  try {
    await $fetch(`/api/tickets/${route.params.id}`, {
      method: 'PATCH',
      body: {
        status: 'closed',
        category: closeForm.category,
        priority: closeForm.priority
      }
    })
    await refresh()
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string } }
    closeError.value = fetchErr.data?.statusMessage || 'Nie można zamknąć bez kategorii i priorytetu.'
  } finally {
    closing.value = false
  }
}

const clearingOwner = ref(false)
const ownerError = ref('')

async function clearOwner() {
  ownerError.value = ''
  clearingOwner.value = true
  try {
    await $fetch(`/api/tickets/${route.params.id}`, {
      method: 'PATCH',
      body: { ownerId: null }
    })
    await refresh()
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string } }
    ownerError.value = fetchErr.data?.statusMessage || 'Nie udało się zdjąć właściciela.'
  } finally {
    clearingOwner.value = false
  }
}
</script>

<template>
  <div class="py-8">
    <NuxtLink
      to="/"
      class="text-sm text-muted hover:underline"
    >
      ← Sprawy
    </NuxtLink>

    <p
      v-if="error"
      class="mt-6 text-sm text-error"
    >
      {{ error.statusMessage || error.message }}
    </p>

    <div
      v-else-if="data"
      class="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
    >
      <div>
        <div
          v-if="data.conflict"
          class="mb-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm"
        >
          Ten kontakt zderzył się z innym rekordem ({{ (data.conflictIds || data.contact?.conflictIds || []).length }}).
          Nie scalamy automatycznie — sprawdź, czy to ta sama osoba.
        </div>
        <h1 class="text-2xl font-medium tracking-tight">
          {{ data.contact?.display_name || data.contactName }}
        </h1>
        <p class="mt-1 text-sm text-muted">
          {{ CHANNEL_LABELS[data.channel as Channel] }}
          · {{ slaText() }}
          <span v-if="data.subject"> · {{ data.subject }}</span>
        </p>

        <ol class="mt-6 space-y-4">
          <li
            v-for="event in data.events"
            :key="event.id"
            class="rounded-lg border border-default p-4"
          >
            <p class="text-xs text-muted">
              {{ eventLabel(event) }}
              · {{ new Date(event.createdAt).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' }) }}
            </p>
            <p class="mt-2 whitespace-pre-wrap">
              {{ event.body }}
            </p>
          </li>
        </ol>

        <UCard
          v-if="data.status !== 'closed'"
          class="mt-6"
        >
          <form
            class="space-y-3"
            @submit.prevent="sendReply"
          >
            <UFormField label="Kierunek">
              <USelect
                v-model="reply.direction"
                :items="directionItems"
                value-key="value"
                class="w-full"
              />
            </UFormField>
            <UTextarea
              v-model="reply.body"
              :rows="5"
              placeholder="Odpowiedź do klienta nie nadpisze zegara, jeśli pierwsza już padła. Wiadomość do sprzedawcy zegara nie rusza."
            />
            <p
              v-if="replyError"
              class="text-sm text-error"
            >
              {{ replyError }}
            </p>
            <p
              v-if="replyInfo"
              class="text-sm text-muted"
            >
              {{ replyInfo }}
            </p>
            <UButton
              type="submit"
              :loading="sending"
              :disabled="!reply.body.trim()"
            >
              Dopisz na oś czasu
            </UButton>
          </form>
        </UCard>
      </div>

      <aside class="space-y-4">
        <UCard>
          <template #header>
            Kontakt
          </template>
          <p>{{ data.contact?.display_name }}</p>
          <p class="mt-1 text-sm text-muted">
            Rola:
            {{ data.contact?.customer_role === 'buyer' ? 'kupujący' : data.contact?.customer_role === 'seller' ? 'sprzedawca' : 'nieznana' }}
          </p>
          <p class="mt-1 text-sm text-muted">
            sun.store: {{ data.contact?.sunstore_user_id || '—' }}
          </p>
          <p class="text-sm text-muted">
            HubSpot kontakt: {{ data.contact?.hubspot_contact_id || '—' }}
          </p>
          <p class="text-sm text-muted">
            HubSpot sprawa: {{ data.hubspotTicketId || '—' }}
          </p>
          <ul class="mt-3 space-y-1 text-sm">
            <li
              v-for="identifier in data.contact?.identifiers || []"
              :key="`${identifier.type}:${identifier.value}`"
            >
              {{ identifier.type }}: {{ identifier.value }}
            </li>
          </ul>
        </UCard>

        <UCard>
          <template #header>
            Zlecenia
          </template>
          <p
            v-if="!data.orders?.length"
            class="text-sm text-muted"
          >
            Brak podpiętej transakcji. Dopisz id zlecenia, żeby zobaczyć postęp w logistics.
          </p>
          <ul
            v-else
            class="space-y-2 text-sm"
          >
            <li
              v-for="order in data.orders"
              :key="order.transactionId"
            >
              <a
                v-if="order.logisticsUrl"
                :href="order.logisticsUrl"
                target="_blank"
                class="font-medium hover:underline"
              >
                {{ order.transactionId }}
              </a>
              <span v-else>{{ order.transactionId }}</span>
              <p class="text-muted">
                {{ order.status || 'status z logistics jeszcze nie podłączony na żywo' }}
              </p>
            </li>
          </ul>
        </UCard>

        <UCard v-if="data.status !== 'closed' && data.ownerId">
          <template #header>
            Właściciel
          </template>
          <p class="mb-3 text-sm text-muted">
            Zdjęcie właściciela wrzuca sprawę do nieprzypisanych (urlop, zmiana dyżuru).
          </p>
          <p
            v-if="ownerError"
            class="mb-2 text-sm text-error"
          >
            {{ ownerError }}
          </p>
          <UButton
            color="neutral"
            variant="outline"
            :loading="clearingOwner"
            @click="clearOwner"
          >
            Zdejmij właściciela
          </UButton>
        </UCard>

        <UCard v-if="data.status !== 'closed'">
          <template #header>
            Zamknięcie
          </template>
          <p class="mb-3 text-sm text-muted">
            Kategoria i priorytet są wymagane. Bez nich sprawa zostaje otwarta.
          </p>
          <div class="space-y-3">
            <USelect
              v-model="closeForm.category"
              :items="categoryItems"
              value-key="value"
            />
            <USelect
              v-model="closeForm.priority"
              :items="priorityItems"
              value-key="value"
            />
            <p
              v-if="closeError"
              class="text-sm text-error"
            >
              {{ closeError }}
            </p>
            <UButton
              color="neutral"
              :loading="closing"
              @click="closeTicket"
            >
              Zamknij sprawę
            </UButton>
          </div>
        </UCard>
        <UCard v-else>
          <p class="text-sm">
            Zamknięta
            · {{ data.category }}
            · {{ data.priority }}
          </p>
        </UCard>
      </aside>
    </div>
  </div>
</template>
