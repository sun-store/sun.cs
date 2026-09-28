<script setup lang="ts">
import {
  type CALL_STATUSES,
  CHANNEL_LABELS,
  CHANNELS
} from '~~/shared/domain'
import { fromZonedTime } from '~~/shared/workingHours'

function nowWarsawInput() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date())
  const get = (type: string) => parts.find(part => part.type === type)?.value || '00'
  let hour = get('hour')
  if (hour === '24') hour = '00'
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`
}

const form = reactive({
  displayName: '',
  email: '',
  phone: '',
  whatsapp: '',
  customerRole: '' as '' | 'buyer' | 'seller',
  sunstoreUserId: '',
  hubspotContactId: '',
  channel: 'email' as typeof CHANNELS[number],
  subject: '',
  body: '',
  relatedTransactionId: '',
  callStatus: '' as '' | typeof CALL_STATUSES[number],
  senderType: 'customer' as 'customer' | 'agent' | 'bot',
  firstContactAt: nowWarsawInput()
})

const errorMessage = ref('')
const isSubmitting = ref(false)

const channelItems = CHANNELS.map(value => ({ label: CHANNEL_LABELS[value], value }))
const roleItems = [
  { label: 'Nieznana', value: '' },
  { label: 'Kupujący', value: 'buyer' },
  { label: 'Sprzedawca', value: 'seller' }
]
const senderItems = [
  { label: 'Klient', value: 'customer' },
  { label: 'Agent', value: 'agent' },
  { label: 'Bot / agent AI', value: 'bot' }
]
const callItems = [
  { label: 'Odebrane', value: 'answered' },
  { label: 'Nieodebrane', value: 'no_answer' },
  { label: 'Oddzwonienie', value: 'callback' }
]

function firstContactIso(value: string) {
  const [datePart, timePart] = value.split('T')
  const [year, month, day] = (datePart ?? '').split('-').map(Number)
  const [hour, minute] = (timePart ?? '').split(':').map(Number)
  return fromZonedTime(year ?? 0, month ?? 0, day ?? 0, hour ?? 0, minute ?? 0, 0).toISOString()
}

async function submit() {
  errorMessage.value = ''
  if (form.channel === 'phone' && !form.callStatus) {
    errorMessage.value = 'Telefon wymaga statusu odebrania.'
    return
  }
  isSubmitting.value = true
  try {
    const ticket = await $fetch<{ id: string }>('/api/tickets', {
      method: 'POST',
      body: {
        ...form,
        customerRole: form.customerRole || null,
        sunstoreUserId: form.sunstoreUserId || null,
        hubspotContactId: form.hubspotContactId || null,
        relatedTransactionId: form.relatedTransactionId || null,
        callStatus: form.callStatus || null,
        firstContactAt: firstContactIso(form.firstContactAt)
      }
    })
    await navigateTo(`/tickets/${ticket.id}`)
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    errorMessage.value = fetchErr.data?.statusMessage || fetchErr.message || 'Nie udało się utworzyć sprawy.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="py-8">
    <h1 class="text-2xl font-medium tracking-tight">
      Nowa sprawa
    </h1>
    <p class="mt-1 text-sm text-muted">
      Kontakt musi mieć e-mail, telefon albo id sun.store. Sprawa nie powstaje bez człowieka.
    </p>

    <form
      class="mt-6 max-w-2xl space-y-4"
      @submit.prevent="submit"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField
          label="Imię / firma"
          required
        >
          <UInput v-model="form.displayName" />
        </UFormField>
        <UFormField label="Kanał">
          <USelect
            v-model="form.channel"
            :items="channelItems"
            value-key="value"
            class="w-full"
          />
        </UFormField>
        <UFormField label="E-mail">
          <UInput
            v-model="form.email"
            type="email"
          />
        </UFormField>
        <UFormField label="Telefon">
          <UInput v-model="form.phone" />
        </UFormField>
        <UFormField label="WhatsApp">
          <UInput v-model="form.whatsapp" />
        </UFormField>
        <UFormField label="Rola">
          <USelect
            v-model="form.customerRole"
            :items="roleItems"
            value-key="value"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Id sun.store">
          <UInput v-model="form.sunstoreUserId" />
        </UFormField>
        <UFormField label="Id kontaktu HubSpot">
          <UInput v-model="form.hubspotContactId" />
        </UFormField>
        <UFormField label="Id transakcji">
          <UInput v-model="form.relatedTransactionId" />
        </UFormField>
        <UFormField label="Pierwsza wiadomość od">
          <USelect
            v-model="form.senderType"
            :items="senderItems"
            value-key="value"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Pierwszy kontakt klienta (Warszawa)"
          required
        >
          <UInput
            v-model="form.firstContactAt"
            type="datetime-local"
          />
        </UFormField>
        <UFormField
          v-if="form.channel === 'phone'"
          label="Status połączenia"
          required
        >
          <USelect
            v-model="form.callStatus"
            :items="callItems"
            value-key="value"
            class="w-full"
          />
        </UFormField>
      </div>

      <UFormField label="Temat">
        <UInput v-model="form.subject" />
      </UFormField>
      <UFormField
        label="Treść"
        required
      >
        <UTextarea
          v-model="form.body"
          :rows="6"
        />
      </UFormField>

      <p
        v-if="errorMessage"
        class="text-sm text-error"
      >
        {{ errorMessage }}
      </p>

      <div class="flex gap-3">
        <UButton
          type="submit"
          :loading="isSubmitting"
        >
          Utwórz sprawę
        </UButton>
        <UButton
          to="/"
          color="neutral"
          variant="ghost"
        >
          Anuluj
        </UButton>
      </div>
    </form>
  </div>
</template>
