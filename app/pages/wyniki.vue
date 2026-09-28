<script setup lang="ts">
const MONTH_LABELS = [
  '', 'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
  'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'
]

const year = ref(2026)
const month = ref(9)

const monthItems = [
  { label: 'Marzec 2026', value: 3 },
  { label: 'Kwiecień 2026', value: 4 },
  { label: 'Maj 2026', value: 5 },
  { label: 'Czerwiec 2026', value: 6 },
  { label: 'Lipiec 2026', value: 7 },
  { label: 'Sierpień 2026', value: 8 },
  { label: 'Wrzesień 2026', value: 9 }
]

const { data, pending, error, refresh } = await useFetch('/api/kpi', {
  query: computed(() => ({ year: year.value, month: month.value }))
})

watch([year, month], () => {
  refresh()
})

function pct(value: number | null | undefined) {
  if (value == null) return '—'
  return `${(value * 100).toFixed(1)}%`
}

function scoreClass(value: number | null | undefined, target: number) {
  if (value == null) return 'text-muted'
  return value >= target ? 'text-success' : 'text-error'
}

const ticketsIncomplete = computed(() => {
  const through = data.value?.coverage?.ticketsThrough
  return Boolean(through && through < '2026-09-28')
})
</script>

<template>
  <div class="py-8">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-medium tracking-tight">
          Wyniki
        </h1>
        <p class="mt-1 text-sm text-muted">
          Raport KPI zespołu CS — FCR, SLA, CSAT, retencja, QA i premia.
          Metodyka jak w raporcie, od którego ruszył ten projekt.
        </p>
      </div>
      <USelect
        v-model="month"
        :items="monthItems"
        value-key="value"
        class="w-48"
        @update:model-value="refresh()"
      />
    </div>

    <UCard
      v-if="data?.coverage"
      class="mt-6"
    >
      <p class="text-sm">
        <strong>Pokrycie danych.</strong>
        Tickety HubSpot (BQ) do {{ data.coverage.ticketsThrough }}.
        Czaty do {{ data.coverage.chatsThrough }}.
        CSAT e-mail/telefon do {{ data.coverage.csatThrough }}.
        <span v-if="data.coverage.monthInProgress">Miesiąc jeszcze trwa — retencja września nie jest dojrzała.</span>
        CSAT czatowy jest wyłączony z premii.
        <span v-if="ticketsIncomplete">
          Żeby domknąć cały wrzesień w ticketach BQ: wklej
          <code>BQ_SERVICE_ACCOUNT_JSON</code> z Vercel logistics do lokalnego
          <code>.env</code> i odpal <code>sfw npm run db:pull-bq</code>, potem
          <code>sfw npm run db:import-sep</code>. Świeży CSAT wrzuć do Pobranych.
        </span>
      </p>
    </UCard>

    <p
      v-if="error"
      class="mt-6 text-sm text-error"
    >
      {{ error.statusMessage || error.message }}
    </p>
    <p
      v-else-if="pending && !data"
      class="mt-6 text-sm text-muted"
    >
      Liczę raport…
    </p>

    <div
      v-else-if="data"
      class="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6"
    >
      <UCard>
        <p class="text-xs text-muted">
          FCR ≥ {{ pct(data.targets.fcr) }}
        </p>
        <p :class="['mt-1 text-2xl font-medium', scoreClass(data.team.fcrR, data.targets.fcr)]">
          {{ pct(data.team.fcrR) }}
        </p>
        <p class="text-xs text-muted">
          {{ data.team.fcrN }}/{{ data.team.fcrDen }} zamkniętych ≤ 4 h
        </p>
      </UCard>
      <UCard>
        <p class="text-xs text-muted">
          SLA ≥ {{ pct(data.targets.sla) }}
        </p>
        <p :class="['mt-1 text-2xl font-medium', scoreClass(data.team.slaR, data.targets.sla)]">
          {{ pct(data.team.slaR) }}
        </p>
        <p class="text-xs text-muted">
          {{ data.team.slaMet }}/{{ data.team.slaTotal }} czat+mail · poza godzinami {{ data.team.slaExcludedOffHours }}
        </p>
      </UCard>
      <UCard>
        <p class="text-xs text-muted">
          CSAT ≥ {{ pct(data.targets.csat) }}
        </p>
        <p :class="['mt-1 text-2xl font-medium', scoreClass(data.team.csatR, data.targets.csat)]">
          {{ pct(data.team.csatR) }}
        </p>
        <p class="text-xs text-muted">
          {{ data.team.csatHappy }}/{{ data.team.csatTotal }} Happy · próbka mała
        </p>
      </UCard>
      <UCard>
        <p class="text-xs text-muted">
          Retencja ≥ {{ pct(data.targets.retention) }}
        </p>
        <p :class="['mt-1 text-2xl font-medium', scoreClass(data.team.retR, data.targets.retention)]">
          {{ pct(data.team.retR) }}
        </p>
        <p class="text-xs text-muted">
          {{ data.team.retN }}/{{ data.team.retD }} okien · +{{ data.team.retOpen }} otwartych · marzec–{{ MONTH_LABELS[month] }}
        </p>
      </UCard>
      <UCard>
        <p class="text-xs text-muted">
          QA ≥ {{ pct(data.targets.qa) }}
        </p>
        <p :class="['mt-1 text-2xl font-medium', scoreClass(data.team.qaR, data.targets.qa)]">
          {{ pct(data.team.qaR) }}
        </p>
        <p class="text-xs text-muted">
          {{ data.team.qaPass }}/{{ data.team.qaTotal }} kategoria+priorytet
        </p>
      </UCard>
      <UCard>
        <p class="text-xs text-muted">
          Premia (max 100)
        </p>
        <p class="mt-1 text-2xl font-medium">
          {{ data.team.bonus ?? '—' }}
        </p>
        <p class="text-xs text-muted">
          5 × 20 pkt · sufit 100% celu
        </p>
      </UCard>
    </div>

    <UCard
      v-if="data?.ai"
      class="mt-6"
    >
      <h2 class="font-medium">
        Agent AI (cel rozwojowy)
      </h2>
      <p class="mt-2 text-sm">
        Rozwiązane przez bota bez człowieka:
        <strong>{{ data.ai.rate == null ? '—' : `${(data.ai.rate * 100).toFixed(1)}%` }}</strong>
        ({{ data.ai.resolved }}/{{ data.ai.denominator }}).
        Containment surowy:
        {{ data.ai.rawContainment == null ? '—' : `${(data.ai.rawContainment * 100).toFixed(1)}%` }}
        — nagradza bota, gdy klient wychodzi. Baseline z sierpnia: 73,5%.
      </p>
    </UCard>

    <div
      v-if="data"
      class="mt-6 grid gap-4 lg:grid-cols-2"
    >
      <UCard>
        <h2 class="font-medium">
          Zespół
        </h2>
        <p class="mt-2 text-sm text-muted">
          {{ data.counts.closed }} zamkniętych z {{ data.counts.period }} spraw utworzonych w okresie.
          CSAT e-mail/telefon: {{ data.counts.csatEmailPhone }} (czat wyłączony: {{ data.counts.csatChatExcluded }}).
        </p>
      </UCard>
      <UCard>
        <h2 class="font-medium">
          Bez Armanda
        </h2>
        <p class="mt-2 text-sm">
          FCR {{ pct(data.withoutArmand.fcrR) }}
          · SLA {{ pct(data.withoutArmand.slaR) }}
          · CSAT {{ pct(data.withoutArmand.csatR) }}
          · Retencja {{ pct(data.withoutArmand.retR) }}
          · QA {{ pct(data.withoutArmand.qaR) }}
          · premia {{ data.withoutArmand.bonus ?? '—' }}
        </p>
      </UCard>
    </div>

    <UCard
      v-if="data"
      class="mt-6"
    >
      <h2 class="font-medium">
        Agenci (≥ 5 spraw)
      </h2>
      <table class="mt-4 w-full text-left text-sm">
        <thead class="text-muted">
          <tr>
            <th class="pb-2 font-medium">
              Agent
            </th>
            <th class="pb-2 font-medium">
              Zamk.
            </th>
            <th class="pb-2 font-medium">
              FCR
            </th>
            <th class="pb-2 font-medium">
              SLA
            </th>
            <th class="pb-2 font-medium">
              CSAT
            </th>
            <th class="pb-2 font-medium">
              Retencja
            </th>
            <th class="pb-2 font-medium">
              QA
            </th>
            <th class="pb-2 font-medium">
              Premia
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in data.agents"
            :key="row.agent"
            class="border-t border-default"
          >
            <td class="py-2 font-medium">
              {{ row.agent }}
            </td>
            <td>{{ row.closed }}</td>
            <td>{{ pct(row.fcrR) }}</td>
            <td>{{ pct(row.slaR) }}</td>
            <td>{{ pct(row.csatR) }}</td>
            <td>{{ pct(row.retR) }}</td>
            <td>{{ pct(row.qaR) }}</td>
            <td>{{ row.bonus ?? '—' }}</td>
          </tr>
          <tr v-if="!data.agents.length">
            <td
              colspan="8"
              class="py-8 text-center text-muted"
            >
              Za mało spraw z właścicielem, żeby pokazać tabelę agentów.
            </td>
          </tr>
        </tbody>
      </table>
    </UCard>

    <UCard
      v-if="data"
      class="mt-6"
    >
      <h2 class="font-medium">
        Jak to liczymy
      </h2>
      <ul class="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
        <li>FCR: zamknięte ≤ 4 h zegarowych i unikalne ID transakcji (albo brak ID).</li>
        <li>SLA: pierwsza odpowiedź w 9–17 pon–pt Europe/Warsaw; czat 30 min, e-mail 2 h. Poza godzinami i po 16:30 — poza pulą / start od 9:00.</li>
        <li>CSAT: tylko ankieta Email & Phone, Happy / wszystkie. Czat wyłączony z premii.</li>
        <li>Retencja: opłacona transakcja firmy w 30 dni od zamknięcia, skumulowanie marzec–bieżący miesiąc.</li>
        <li>QA: kategoria i priorytet oraz zamknięte albo kontakt ≤ 7 dni — proxy higieny danych.</li>
        <li>Premia: 5 × 20 pkt; poniżej 50% celu = 0; powyżej celu sufit 100%.</li>
      </ul>
    </UCard>
  </div>
</template>
