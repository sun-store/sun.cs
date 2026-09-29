<script setup lang="ts">
const MONTH_LABELS = [
  '', 'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
  'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'
]

const year = ref(2026)
const month = ref(9)

type DashboardResponse = {
  year: number
  month: number
  monthTotal: number
  byCategory: Array<{ category: string, label: string, count: number, share: number }>
  byChannel: Array<{ channel: string, label: string, count: number, share: number }>
  trend: Array<{
    year: number
    month: number
    total: number
    categories: Array<{ category: string, label: string, count: number }>
  }>
  openByAgent: Array<{
    agentId: string | null
    agent: string
    openCount: number
    waitingCount: number
    avgAgeHours: number | null
    avgAgeLabel: string
  }>
  openTotal: number
}

const { data, pending, error, refresh } = await useFetch<DashboardResponse>('/api/dashboard', {
  query: computed(() => ({ year: year.value, month: month.value }))
})

watch([year, month], () => {
  refresh()
})

function pct(share: number) {
  return `${(share * 100).toFixed(1)}%`
}

function monthTitle(y: number, m: number) {
  return `${MONTH_LABELS[m]} ${y}`
}

function barWidth(count: number, max: number) {
  if (max <= 0) return '0%'
  return `${Math.max(4, Math.round((count / max) * 100))}%`
}

const categoryMax = computed(() =>
  Math.max(0, ...(data.value?.byCategory.map(row => row.count) || [0]))
)

const channelMax = computed(() =>
  Math.max(0, ...(data.value?.byChannel.map(row => row.count) || [0]))
)

const trendMax = computed(() =>
  Math.max(0, ...(data.value?.trend.map(row => row.total) || [0]))
)

const openMax = computed(() =>
  Math.max(0, ...(data.value?.openByAgent.map(row => row.openCount + row.waitingCount) || [0]))
)

const topCategory = computed(() => data.value?.byCategory[0] ?? null)
</script>

<template>
  <div class="py-8">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-medium tracking-tight">
          Dashboard
        </h1>
        <p class="mt-1 text-sm text-muted">
          Co najczęściej wpływa w miesiącu, jak to się zmienia i kto ma ile otwartych spraw.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <USelect
          v-model="month"
          :items="MONTH_LABELS.slice(1).map((label, index) => ({ label, value: index + 1 }))"
          value-key="value"
          class="w-40"
        />
        <UInput
          v-model.number="year"
          type="number"
          class="w-24"
          :min="2024"
          :max="2035"
        />
      </div>
    </div>

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
      Liczę dashboard…
    </p>

    <template v-else-if="data">
      <div class="mt-6 grid gap-4 md:grid-cols-3">
        <UCard>
          <p class="text-xs text-muted">
            Utworzone w {{ monthTitle(data.year, data.month) }}
          </p>
          <p class="mt-1 text-2xl font-medium">
            {{ data.monthTotal }}
          </p>
        </UCard>
        <UCard>
          <p class="text-xs text-muted">
            Najwięcej (kategoria)
          </p>
          <p class="mt-1 text-2xl font-medium">
            {{ topCategory?.label ?? '—' }}
          </p>
          <p class="text-xs text-muted">
            <template v-if="topCategory">
              {{ topCategory.count }} · {{ pct(topCategory.share) }}
            </template>
            <template v-else>
              brak spraw w miesiącu
            </template>
          </p>
        </UCard>
        <UCard>
          <p class="text-xs text-muted">
            Otwarte teraz (open + waiting)
          </p>
          <p class="mt-1 text-2xl font-medium">
            {{ data.openTotal }}
          </p>
        </UCard>
      </div>

      <div class="mt-6 grid gap-4 lg:grid-cols-2">
        <UCard>
          <h2 class="font-medium">
            Kategorie HubSpot w miesiącu
          </h2>
          <p class="mt-1 text-sm text-muted">
            Ticket category z HubSpota (wszystkie znane + bez kategorii).
            Sprawa z kilkoma tagami liczy się w każdym.
          </p>
          <ul class="mt-4 space-y-3">
            <li
              v-for="row in data.byCategory"
              :key="row.category"
            >
              <div class="flex items-baseline justify-between gap-3 text-sm">
                <span class="font-medium">{{ row.label }}</span>
                <span class="text-muted">{{ row.count }} · {{ pct(row.share) }}</span>
              </div>
              <div class="mt-1 h-2 rounded bg-muted/30">
                <div
                  class="h-2 rounded bg-primary"
                  :style="{ width: barWidth(row.count, categoryMax) }"
                />
              </div>
            </li>
            <li
              v-if="!data.byCategory.length"
              class="py-6 text-center text-sm text-muted"
            >
              Brak spraw w wybranym miesiącu.
            </li>
          </ul>
        </UCard>

        <UCard>
          <h2 class="font-medium">
            Kanały w miesiącu
          </h2>
          <p class="mt-1 text-sm text-muted">
            Skąd przyszły sprawy w tym samym okresie.
          </p>
          <ul class="mt-4 space-y-3">
            <li
              v-for="row in data.byChannel"
              :key="row.channel"
            >
              <div class="flex items-baseline justify-between gap-3 text-sm">
                <span class="font-medium">{{ row.label }}</span>
                <span class="text-muted">{{ row.count }} · {{ pct(row.share) }}</span>
              </div>
              <div class="mt-1 h-2 rounded bg-muted/30">
                <div
                  class="h-2 rounded bg-primary"
                  :style="{ width: barWidth(row.count, channelMax) }"
                />
              </div>
            </li>
            <li
              v-if="!data.byChannel.length"
              class="py-6 text-center text-sm text-muted"
            >
              Brak spraw w wybranym miesiącu.
            </li>
          </ul>
        </UCard>
      </div>

      <UCard class="mt-6">
        <h2 class="font-medium">
          Jak to się zmienia
        </h2>
        <p class="mt-1 text-sm text-muted">
          Ostatnie 6 miesięcy do {{ monthTitle(data.year, data.month) }} — łączna liczba spraw
          i top kategoria w każdym miesiącu.
        </p>
        <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div
            v-for="point in data.trend"
            :key="`${point.year}-${point.month}`"
            class="rounded-lg border border-default p-3"
          >
            <p class="text-xs text-muted capitalize">
              {{ monthTitle(point.year, point.month) }}
            </p>
            <p class="mt-1 text-xl font-medium">
              {{ point.total }}
            </p>
            <div class="mt-2 h-2 rounded bg-muted/30">
              <div
                class="h-2 rounded bg-primary"
                :style="{ width: barWidth(point.total, trendMax) }"
              />
            </div>
            <p class="mt-2 text-xs text-muted">
              <template v-if="point.categories[0]">
                top: {{ point.categories[0].label }} ({{ point.categories[0].count }})
              </template>
              <template v-else>
                brak danych
              </template>
            </p>
          </div>
        </div>
      </UCard>

      <UCard class="mt-6">
        <h2 class="font-medium">
          Otwarte na osobach
        </h2>
        <p class="mt-1 text-sm text-muted">
          Aktualne sprawy open/waiting, średni wiek od utworzenia.
        </p>
        <table class="mt-4 w-full text-left text-sm">
          <thead class="text-muted">
            <tr>
              <th class="pb-2 font-medium">
                Agent
              </th>
              <th class="pb-2 font-medium">
                Open
              </th>
              <th class="pb-2 font-medium">
                Waiting
              </th>
              <th class="pb-2 font-medium">
                Razem
              </th>
              <th class="pb-2 font-medium">
                Śr. wiek
              </th>
              <th class="pb-2 font-medium w-1/3">
                Obciążenie
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in data.openByAgent"
              :key="row.agentId || row.agent"
              class="border-t border-default"
            >
              <td class="py-2 font-medium">
                {{ row.agent }}
              </td>
              <td>{{ row.openCount }}</td>
              <td>{{ row.waitingCount }}</td>
              <td>{{ row.openCount + row.waitingCount }}</td>
              <td>{{ row.avgAgeLabel }}</td>
              <td class="py-2">
                <div class="h-2 rounded bg-muted/30">
                  <div
                    class="h-2 rounded bg-primary"
                    :style="{ width: barWidth(row.openCount + row.waitingCount, openMax) }"
                  />
                </div>
              </td>
            </tr>
            <tr v-if="!data.openByAgent.length">
              <td
                colspan="6"
                class="py-8 text-center text-muted"
              >
                Brak otwartych spraw.
              </td>
            </tr>
          </tbody>
        </table>
      </UCard>
    </template>
  </div>
</template>
