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

const monthLabels = computed(() =>
  locale.value === 'en' ? MONTH_LABELS_EN : MONTH_LABELS_PL
)

const year = ref(2026)
const month = ref(9)
const showMonthStats = ref(false)

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

let backlogTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  backlogTimer = setInterval(() => refreshBacklog(), 120_000)
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

const {
  data,
  pending,
  error,
  refresh
} = await useFetch<DashboardResponse>('/api/dashboard', {
  query: computed(() => ({ year: year.value, month: month.value })),
  immediate: false
})

watch([year, month], () => {
  if (showMonthStats.value) refresh()
})

async function loadMonthStats() {
  showMonthStats.value = true
  await refresh()
}

function pct(share: number) {
  return `${(share * 100).toFixed(1)}%`
}

function monthTitle(y: number, m: number) {
  return `${monthLabels.value[m]} ${y}`
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

const takeUrgentBusy = ref(false)
const takeUrgentMessage = ref('')

async function takeUrgent() {
  takeUrgentMessage.value = ''
  takeUrgentBusy.value = true
  try {
    const result = await $fetch<{ id: string | null }>('/api/tickets/next', {
      method: 'POST',
      body: { queue: 'now' }
    })
    if (result?.id) {
      await navigateTo(`/?queue=now&case=${result.id}`)
      return
    }
    takeUrgentMessage.value = t('inbox', 'takeNextEmpty')
    await navigateTo('/?queue=reply')
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string } }
    takeUrgentMessage.value = fetchErr.data?.statusMessage || t('inbox', 'takeNextError')
  } finally {
    takeUrgentBusy.value = false
  }
}
</script>

<template>
  <div class="py-8">
    <div>
      <h1 class="text-2xl font-medium tracking-tight">
        {{ t('dashboard', 'title') }}
      </h1>
      <p class="mt-1 text-sm text-muted">
        {{ t('dashboard', 'subtitle') }}
      </p>
    </div>

    <p
      v-if="backlogError"
      class="mt-6 text-sm text-error"
    >
      {{ backlogError.statusMessage || backlogError.message }}
    </p>

    <section
      v-else-if="backlog"
      class="mt-6 space-y-4"
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

      <UCard>
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
        <div class="mt-4 flex flex-wrap items-center gap-3">
          <UButton
            color="primary"
            :loading="takeUrgentBusy"
            :disabled="takeUrgentBusy"
            @click="takeUrgent"
          >
            {{ t('inbox', 'takeNext') }}
          </UButton>
          <p
            v-if="takeUrgentMessage"
            class="text-sm text-muted"
          >
            {{ takeUrgentMessage }}
          </p>
        </div>
      </UCard>

      <UCard>
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
                  {{ t('dashboard', 'topics') }}
                </th>
                <th class="pb-2 pr-4 font-medium">
                  {{ t('dashboard', 'dept') }}
                </th>
                <th class="pb-2 pr-4 font-medium whitespace-nowrap">
                  Od kiedy
                </th>
                <th class="pb-2 font-medium">
                  {{ t('dashboard', 'nextStep') }}
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
                    {{ row.transactionId ? row.transactionId.slice(0, 8) : t('dashboard', 'openCase') }}
                  </NuxtLink>
                </td>
                <td class="py-2 pr-4">
                  {{ row.topicLabel }}
                </td>
                <td class="py-2 pr-4 whitespace-nowrap">
                  {{ row.department }}
                </td>
                <td class="py-2 pr-4 whitespace-nowrap">
                  <span
                    v-if="row.overdue"
                    class="me-1 rounded bg-black px-1.5 py-0.5 text-xs text-white"
                  >{{ t('dashboard', 'overdue') }}</span>
                  {{ row.age }}
                </td>
                <td class="py-2 min-w-[16rem]">
                  {{ row.nextStep }}
                </td>
              </tr>
              <tr v-if="!backlog.oldest.length">
                <td
                  colspan="5"
                  class="py-6 text-center text-muted"
                >
                  {{ t('dashboard', 'nothingWaiting') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <details class="rounded-lg border border-default p-4">
        <summary class="cursor-pointer font-medium">
          {{ t('dashboard', 'breakdown') }}
        </summary>
        <div class="mt-4 space-y-4">
          <div class="overflow-x-auto">
            <p class="mb-2 text-sm text-muted">
              {{ t('dashboard', 'deptSection') }}
            </p>
            <table class="w-full text-left text-sm">
              <thead class="text-muted">
                <tr>
                  <th class="pb-2 pr-4 font-medium">
                    {{ t('dashboard', 'dept') }}
                  </th>
                  <th class="pb-2 pr-4 font-medium">
                    {{ t('dashboard', 'open') }}
                  </th>
                  <th class="pb-2 pr-4 font-medium">
                    {{ t('dashboard', 'overdue') }}
                  </th>
                  <th class="pb-2 pr-4 font-medium">
                    {{ t('dashboard', 'unassigned') }}
                  </th>
                  <th class="pb-2 font-medium">
                    {{ t('dashboard', 'nextStep') }}
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
                  <td
                    class="py-2 pr-4"
                    :class="row.overdue ? 'font-medium' : 'text-muted'"
                  >
                    {{ row.overdue }}
                  </td>
                  <td class="py-2 pr-4">
                    {{ row.unassigned }}
                  </td>
                  <td class="py-2 min-w-[16rem]">
                    {{ row.nextStep }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="overflow-x-auto">
            <p class="mb-2 text-sm text-muted">
              {{ t('dashboard', 'topicSection') }}
            </p>
            <table class="w-full text-left text-sm">
              <thead class="text-muted">
                <tr>
                  <th class="pb-2 pr-4 font-medium">
                    {{ t('dashboard', 'topics') }}
                  </th>
                  <th class="pb-2 pr-4 font-medium">
                    {{ t('dashboard', 'open') }}
                  </th>
                  <th class="pb-2 pr-4 font-medium">
                    {{ t('dashboard', 'overdue') }}
                  </th>
                  <th class="pb-2 font-medium">
                    {{ t('dashboard', 'nextStep') }}
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
                  <td class="py-2 min-w-[16rem]">
                    {{ row.nextStep }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <p class="mb-2 text-sm text-muted">
                {{ t('dashboard', 'unassigned') }}
              </p>
              <ul class="space-y-2 text-sm">
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
                  {{ t('dashboard', 'allOwned') }}
                </li>
              </ul>
            </div>
            <div>
              <p class="mb-2 text-sm text-muted">
                Na osobach
              </p>
              <table class="w-full text-left text-sm">
                <thead class="text-muted">
                  <tr>
                    <th class="pb-2 pr-3 font-medium">
                      Prowadzi
                    </th>
                    <th class="pb-2 pr-3 font-medium">
                      {{ t('dashboard', 'open') }}
                    </th>
                    <th class="pb-2 font-medium">
                      {{ t('dashboard', 'overdue') }}
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
            </div>
          </div>
        </div>
      </details>
    </section>

    <div class="mt-10 border-t border-default pt-6">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <h2 class="text-xl font-medium tracking-tight">
          {{ t('dashboard', 'monthSection') }}
        </h2>
        <div
          v-if="showMonthStats"
          class="flex flex-wrap items-center gap-2"
        >
          <USelect
            v-model="month"
            :items="monthLabels.slice(1).map((label, index) => ({ label, value: index + 1 }))"
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

      <div
        v-if="!showMonthStats"
        class="mt-4"
      >
        <UButton
          color="neutral"
          variant="outline"
          @click="loadMonthStats"
        >
          {{ t('dashboard', 'loadMonth') }}
        </UButton>
      </div>

      <template v-else>
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
                {{ monthTitle(data.year, data.month) }}
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
                  {{ t('dashboard', 'noMonthCases') }}
                </template>
              </p>
            </UCard>
            <UCard>
              <p class="text-xs text-muted">
                {{ t('dashboard', 'open') }}
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
              </ul>
            </UCard>

            <UCard>
              <h2 class="font-medium">
                {{ t('dashboard', 'channelsInMonth') }}
              </h2>
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
              </ul>
            </UCard>
          </div>

          <UCard class="mt-6">
            <h2 class="font-medium">
              {{ t('dashboard', 'trendTitle') }}
            </h2>
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
                    —
                  </template>
                </p>
              </div>
            </div>
          </UCard>
        </template>
      </template>
    </div>
  </div>
</template>
