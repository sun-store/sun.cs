<script setup lang="ts">
const { t, locale } = useAppLocale()

const MONTH_LABELS_PL = [
  '', 'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
  'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'
]
const MONTH_LABELS_EN = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
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

type BacklogCounts = {
  open: number
  toReply: number
  overdue: number
  dueSoon: number
  unassigned: number
  waitingCustomer: number
}

type BacklogResponse = {
  totals: BacklogCounts
  actions: string[]
  byDepartment: Array<BacklogCounts & { department: string, label: string, oldest: string, nextStep: string }>
  byTopic: Array<BacklogCounts & { topic: string, label: string, nextStep: string, departments: string }>
  unassignedByTopic: Array<{ topic: string, label: string, count: number, nextStep: string }>
  byOwner: Array<BacklogCounts & { ownerId: string | null, owner: string }>
  oldest: Array<{
    id: string
    transactionId: string | null
    topicLabel: string
    department: string
    owner: string
    age: string
    overdue: boolean
    nextStep: string
  }>
}

const { data: backlog, error: backlogError, refresh: refreshBacklog } = await useFetch<BacklogResponse>('/api/dashboard/backlog')

// Zaległości zmieniają się w ciągu dnia — odświeżamy co minutę (bez powiadomień).
let backlogTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  backlogTimer = setInterval(() => refreshBacklog(), 60_000)
})
onBeforeUnmount(() => {
  if (backlogTimer) clearInterval(backlogTimer)
})

const backlogTiles = computed(() => {
  const totals = backlog.value?.totals
  if (!totals) return []
  return [
    { label: t('dashboard', 'open'), value: totals.open, to: '/?queue=reply', tone: '' },
    { label: t('dashboard', 'overdue'), value: totals.overdue, to: '/?queue=overdue', tone: totals.overdue ? 'late' : '' },
    { label: t('dashboard', 'dueSoon'), value: totals.dueSoon, to: '/?queue=now', tone: totals.dueSoon ? 'soon' : '' },
    { label: t('dashboard', 'unassigned'), value: totals.unassigned, to: '/?queue=unassigned', tone: '' },
    { label: t('dashboard', 'waitingCustomer'), value: totals.waitingCustomer, to: '/?queue=waiting', tone: '' }
  ]
})

function tileClass(tone: string) {
  if (tone === 'late') return 'bg-black text-white'
  if (tone === 'soon') return 'bg-[#F6D736] text-black'
  return ''
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
  const labels = locale.value === 'en' ? MONTH_LABELS_EN : MONTH_LABELS_PL
  return `${labels[m]} ${y}`
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

const topCategory = computed(() => data.value?.byCategory[0] ?? null)
</script>

<template>
  <div class="py-8">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-medium tracking-tight">
          {{ t('dashboard', 'title') }}
        </h1>
        <p class="mt-1 text-sm text-muted">
          {{ t('dashboard', 'subtitle') }}
        </p>
      </div>
    </div>

    <p
      v-if="backlogError"
      class="mt-6 text-sm text-error"
    >
      {{ backlogError.statusMessage || backlogError.message }}
    </p>
    <section
      v-else-if="backlog"
      class="mt-6"
    >
      <div class="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <NuxtLink
          v-for="tile in backlogTiles"
          :key="tile.label"
          :to="tile.to"
          class="rounded-lg border border-default p-4 transition-colors hover:border-accented"
          :class="tileClass(tile.tone)"
        >
          <p
            class="text-sm"
            :class="tile.tone ? '' : 'text-muted'"
          >
            {{ tile.label }}
          </p>
          <p class="mt-1 text-3xl font-medium">
            {{ tile.value }}
          </p>
        </NuxtLink>
      </div>

      <UCard class="mt-4">
        <h2 class="font-medium">
          {{ t('dashboard', 'actionsNow') }}
        </h2>
        <ol class="mt-3 list-decimal space-y-1.5 ps-5 text-sm">
          <li
            v-for="action in backlog.actions"
            :key="action"
          >
            {{ action }}
          </li>
        </ol>
      </UCard>

      <UCard class="mt-4">
        <h2 class="font-medium">
          {{ t('dashboard', 'deptSection') }}
        </h2>
        <div class="mt-3 overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="text-muted">
              <tr>
                <th class="pb-2 pr-4 font-medium">
                  Dział
                </th>
                <th class="pb-2 pr-4 font-medium whitespace-nowrap">
                  Otwarte
                </th>
                <th class="pb-2 pr-4 font-medium whitespace-nowrap">
                  Do odpowiedzi
                </th>
                <th class="pb-2 pr-4 font-medium whitespace-nowrap">
                  Po terminie
                </th>
                <th class="pb-2 pr-4 font-medium whitespace-nowrap">
                  Nieprzypisane
                </th>
                <th class="pb-2 pr-4 font-medium whitespace-nowrap">
                  Czeka na klienta
                </th>
                <th class="pb-2 pr-4 font-medium whitespace-nowrap">
                  Najstarsza
                </th>
                <th class="pb-2 font-medium">
                  Następny krok
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in backlog.byDepartment"
                :key="row.department"
                class="border-t border-default align-top"
              >
                <td class="py-2 pr-4 font-medium whitespace-nowrap">
                  {{ row.label }}
                </td>
                <td class="py-2 pr-4">
                  {{ row.open }}
                </td>
                <td class="py-2 pr-4">
                  {{ row.toReply }}
                </td>
                <td
                  class="py-2 pr-4"
                  :class="row.overdue ? 'font-medium' : 'text-muted'"
                >
                  {{ row.overdue }}
                </td>
                <td class="py-2 pr-4">
                  {{ row.unassigned }}
                </td>
                <td class="py-2 pr-4">
                  {{ row.waitingCustomer }}
                </td>
                <td class="py-2 pr-4 whitespace-nowrap">
                  {{ row.oldest }}
                </td>
                <td class="py-2 min-w-[20rem]">
                  {{ row.nextStep }}
                </td>
              </tr>
              <tr v-if="!backlog.byDepartment.length">
                <td
                  colspan="8"
                  class="py-6 text-center text-muted"
                >
                  Brak otwartych spraw.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <div class="mt-4 grid gap-4 xl:grid-cols-3">
        <UCard class="xl:col-span-2">
          <h2 class="font-medium">
            Tematy spraw
          </h2>
          <p class="mt-1 text-sm text-muted">
            Temat z tagu HubSpot, a gdy go brak („Other”) — z tematu i treści wiadomości.
          </p>
          <div class="mt-3 overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="text-muted">
                <tr>
                  <th class="pb-2 pr-4 font-medium">
                    Temat
                  </th>
                  <th class="pb-2 pr-4 font-medium">
                    Otwarte
                  </th>
                  <th class="pb-2 pr-4 font-medium whitespace-nowrap">
                    Po terminie
                  </th>
                  <th class="pb-2 pr-4 font-medium whitespace-nowrap">
                    Nieprzyp.
                  </th>
                  <th class="pb-2 pr-4 font-medium">
                    Działy
                  </th>
                  <th class="pb-2 font-medium">
                    Następny krok
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in backlog.byTopic"
                  :key="row.topic"
                  class="border-t border-default align-top"
                >
                  <td class="py-2 pr-4 font-medium">
                    {{ row.label }}
                  </td>
                  <td class="py-2 pr-4">
                    {{ row.open }}
                  </td>
                  <td
                    class="py-2 pr-4"
                    :class="row.overdue ? 'font-medium' : 'text-muted'"
                  >
                    {{ row.overdue }}
                  </td>
                  <td class="py-2 pr-4">
                    {{ row.unassigned }}
                  </td>
                  <td class="py-2 pr-4 text-muted">
                    {{ row.departments }}
                  </td>
                  <td class="py-2 min-w-[16rem]">
                    {{ row.nextStep }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>

        <div class="space-y-4">
          <UCard>
            <h2 class="font-medium">
              Nieprzypisane — jakie to sprawy
            </h2>
            <ul class="mt-3 space-y-2 text-sm">
              <li
                v-for="row in backlog.unassignedByTopic"
                :key="row.topic"
                class="flex items-baseline justify-between gap-3"
              >
                <span>{{ row.label }}</span>
                <span class="font-medium">{{ row.count }}</span>
              </li>
              <li
                v-if="!backlog.unassignedByTopic.length"
                class="text-muted"
              >
                Wszystkie sprawy mają osobę prowadzącą.
              </li>
            </ul>
          </UCard>

          <UCard>
            <h2 class="font-medium">
              Na osobach
            </h2>
            <table class="mt-3 w-full text-left text-sm">
              <thead class="text-muted">
                <tr>
                  <th class="pb-2 pr-3 font-medium">
                    Prowadzi
                  </th>
                  <th class="pb-2 pr-3 font-medium">
                    Otwarte
                  </th>
                  <th class="pb-2 font-medium whitespace-nowrap">
                    Po terminie
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in backlog.byOwner"
                  :key="row.ownerId || 'none'"
                  class="border-t border-default"
                >
                  <td
                    class="py-1.5 pr-3"
                    :class="row.ownerId ? '' : 'text-muted'"
                  >
                    {{ row.owner }}
                  </td>
                  <td class="py-1.5 pr-3">
                    {{ row.open }}
                  </td>
                  <td :class="row.overdue ? 'font-medium' : 'text-muted'">
                    {{ row.overdue }}
                  </td>
                </tr>
              </tbody>
            </table>
          </UCard>
        </div>
      </div>

      <UCard class="mt-4">
        <h2 class="font-medium">
          {{ t('dashboard', 'oldestWaiting') }}
        </h2>
        <div class="mt-3 overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="text-muted">
              <tr>
                <th class="pb-2 pr-4 font-medium">
                  Transakcja
                </th>
                <th class="pb-2 pr-4 font-medium">
                  Temat
                </th>
                <th class="pb-2 pr-4 font-medium">
                  Dział
                </th>
                <th class="pb-2 pr-4 font-medium">
                  Prowadzi
                </th>
                <th class="pb-2 pr-4 font-medium whitespace-nowrap">
                  Od kiedy
                </th>
                <th class="pb-2 font-medium">
                  Następny krok
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in backlog.oldest"
                :key="row.id"
                class="border-t border-default align-top"
              >
                <td class="py-2 pr-4 font-medium whitespace-nowrap">
                  <NuxtLink
                    :to="`/?queue=reply&case=${row.id}`"
                    class="underline-offset-2 hover:underline"
                  >
                    {{ row.transactionId ? row.transactionId.slice(0, 8) : 'otwórz' }}
                  </NuxtLink>
                </td>
                <td class="py-2 pr-4">
                  {{ row.topicLabel }}
                </td>
                <td class="py-2 pr-4 whitespace-nowrap">
                  {{ row.department }}
                </td>
                <td
                  class="py-2 pr-4 whitespace-nowrap"
                  :class="row.owner === 'nieprzypisana' ? 'text-muted' : ''"
                >
                  {{ row.owner }}
                </td>
                <td class="py-2 pr-4 whitespace-nowrap">
                  <span
                    v-if="row.overdue"
                    class="me-1 rounded bg-black px-1.5 py-0.5 text-xs text-white"
                  >po terminie</span>
                  {{ row.age }}
                </td>
                <td class="py-2 min-w-[16rem]">
                  {{ row.nextStep }}
                </td>
              </tr>
              <tr v-if="!backlog.oldest.length">
                <td
                  colspan="6"
                  class="py-6 text-center text-muted"
                >
                  Nic nie czeka na naszą odpowiedź.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </section>

    <div class="mt-10 flex flex-wrap items-end justify-between gap-4 border-t border-default pt-6">
      <div>
        <h2 class="text-xl font-medium tracking-tight">
          {{ t('dashboard', 'monthSection') }}
        </h2>
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
      {{ t('dashboard', 'loading') }}
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
            {{ t('dashboard', 'topTopic') }}
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
            {{ t('dashboard', 'topicsInMonth') }}
          </h2>
          <p class="mt-1 text-sm text-muted">
            Jeden temat na sprawę: z tagu HubSpot, a przy „Other” / bez tagu — z tematu i treści wiadomości.
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
            {{ t('dashboard', 'channelsInMonth') }}
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
          {{ t('dashboard', 'trendTitle') }}
        </h2>
        <p class="mt-1 text-sm text-muted">
          Ostatnie 6 miesięcy do {{ monthTitle(data.year, data.month) }} — łączna liczba spraw
          i najczęstszy temat w każdym miesiącu.
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
    </template>
  </div>
</template>
