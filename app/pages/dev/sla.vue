<script setup lang="ts">
import { CHANNEL_LABELS, SLA_THRESHOLD_MS, type HeadlineSlaChannel } from '~~/shared/domain'
import { evaluateSla } from '~~/shared/sla'
import { fromZonedTime } from '~~/shared/workingHours'

definePageMeta({
  layout: false
})

const channel = ref<HeadlineSlaChannel>('chat')
const firstContact = ref('2026-08-05T10:00')
const firstReply = ref('2026-08-05T10:12')

const channelItems = [
  { label: CHANNEL_LABELS.chat, value: 'chat' as const },
  { label: CHANNEL_LABELS.email, value: 'email' as const }
]

const result = computed(() => evaluateSla({
  channel: channel.value,
  firstContactAt: parseWarsaw(firstContact.value),
  firstAgentReplyAt: parseWarsaw(firstReply.value)
}))

const presets = [
  {
    label: 'Czat w godzinach — 12 min',
    channel: 'chat' as const,
    firstContact: '2026-08-05T10:00',
    firstReply: '2026-08-05T10:12'
  },
  {
    label: 'Błąd UTC (17:32 Warszawy)',
    channel: 'email' as const,
    firstContact: '2026-08-05T17:32',
    firstReply: '2026-08-05T17:40'
  },
  {
    label: '1 maja — święto',
    channel: 'email' as const,
    firstContact: '2026-05-01T11:00',
    firstReply: '2026-05-04T10:00'
  }
]

function applyPreset(preset: typeof presets[number]) {
  channel.value = preset.channel
  firstContact.value = preset.firstContact
  firstReply.value = preset.firstReply
}

function parseWarsaw(value: string): Date {
  const [datePart, timePart] = value.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute] = timePart.split(':').map(Number)
  return fromZonedTime(year, month, day, hour, minute, 0)
}

function formatMinutes(ms: number | null): string {
  if (ms === null) return '—'
  const minutes = ms / 60000
  return Number.isInteger(minutes) ? `${minutes} min` : `${minutes.toFixed(1)} min`
}

const exclusionLabel: Record<string, string> = {
  off_hours: 'Poza godzinami pracy — poza pulą SLA',
  holiday: 'Dzień ustawowo wolny — poza pulą SLA',
  channel: 'Kanał poza wskaźnikiem nagłówkowym',
  missing_reply: 'Brak pierwszej odpowiedzi do klienta',
  reply_before_contact: 'Odpowiedź wcześniejsza niż kontakt'
}

const statusLabel = computed(() => {
  const sla = result.value
  if (!sla.eligible) {
    const extra = sla.holidayName ? ` (${sla.holidayName})` : ''
    return exclusionLabel[sla.exclusion ?? ''] + extra
  }
  return sla.met ? 'SLA spełnione' : 'SLA przekroczone'
})
</script>

<template>
  <UApp>
    <UContainer class="py-10">
      <div class="max-w-2xl">
        <p class="text-sm text-muted">
          sun.support · piaskownica
        </p>
        <h1 class="mt-2 text-3xl font-medium tracking-tight">
          Zegar SLA liczy się w Warszawie, nie w UTC
        </h1>
      </div>

      <div class="mt-8 flex flex-wrap gap-2">
        <UButton
          v-for="preset in presets"
          :key="preset.label"
          color="neutral"
          variant="subtle"
          size="sm"
          @click="applyPreset(preset)"
        >
          {{ preset.label }}
        </UButton>
      </div>

      <UCard class="mt-6 max-w-2xl">
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Kanał">
            <USelect
              v-model="channel"
              :items="channelItems"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Próg">
            <UInput
              :model-value="formatMinutes(SLA_THRESHOLD_MS[channel])"
              disabled
            />
          </UFormField>
          <UFormField label="Pierwszy kontakt klienta (Warszawa)">
            <UInput
              v-model="firstContact"
              type="datetime-local"
            />
          </UFormField>
          <UFormField label="Pierwsza odpowiedź do klienta (Warszawa)">
            <UInput
              v-model="firstReply"
              type="datetime-local"
            />
          </UFormField>
        </div>

        <div class="mt-6 rounded-lg bg-muted/40 p-4">
          <p class="text-sm font-medium">
            {{ statusLabel }}
          </p>
          <p class="mt-1 text-sm text-muted">
            Czas roboczy: {{ formatMinutes(result.businessMs) }}
          </p>
        </div>
      </UCard>
    </UContainer>
  </UApp>
</template>
