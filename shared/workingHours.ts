export const DEFAULT_TIME_ZONE = 'Europe/Warsaw'
export const DEFAULT_START_HOUR = 9
export const DEFAULT_END_HOUR = 17
export const DEFAULT_WEEKDAYS = [1, 2, 3, 4, 5] as const

export type WorkCalendar = {
  timeZone: string
  startHour: number
  endHour: number
  weekdays: readonly number[]
}

export const DEFAULT_WORK_CALENDAR: WorkCalendar = {
  timeZone: DEFAULT_TIME_ZONE,
  startHour: DEFAULT_START_HOUR,
  endHour: DEFAULT_END_HOUR,
  weekdays: DEFAULT_WEEKDAYS
}

export type Holiday = {
  date: string
  name: string
}

export type ZonedParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  weekday: number
}

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7
}

export function zonedParts(date: Date, timeZone = DEFAULT_TIME_ZONE): ZonedParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  const map = Object.fromEntries(fmt.formatToParts(date).map(part => [part.type, part.value]))
  let hour = Number(map.hour)
  if (hour === 24) hour = 0
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: WEEKDAY_INDEX[map.weekday] ?? 0
  }
}

export function dateKey(date: Date, timeZone = DEFAULT_TIME_ZONE): string {
  const parts = zonedParts(date, timeZone)
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

export function offsetMs(date: Date, timeZone = DEFAULT_TIME_ZONE): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset'
  }).formatToParts(date)
  const tz = parts.find(part => part.type === 'timeZoneName')?.value ?? 'GMT+0'
  const match = tz.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
  if (!match) return 0
  const sign = match[1] === '-' ? -1 : 1
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0)) * 60_000
}

export function fromZonedTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
  second = 0,
  timeZone = DEFAULT_TIME_ZONE
): Date {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second)
  const first = new Date(asUtc - offsetMs(new Date(asUtc), timeZone))
  const check = zonedParts(first, timeZone)
  if (
    check.year === year
    && check.month === month
    && check.day === day
    && check.hour === hour
    && check.minute === minute
    && check.second === second
  ) {
    return first
  }
  const observed = Date.UTC(check.year, check.month - 1, check.day, check.hour, check.minute, check.second)
  return new Date(first.getTime() + (asUtc - observed))
}

export function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, month - 1, day))
}

export function polishPublicHolidays(year: number): Holiday[] {
  const easter = easterSunday(year)
  const easterMonday = addUtcDays(easter, 1)
  const pentecost = addUtcDays(easter, 49)
  const corpusChristi = addUtcDays(easter, 60)
  return [
    { date: `${year}-01-01`, name: 'Nowy Rok' },
    { date: `${year}-01-06`, name: 'Święto Trzech Króli' },
    { date: utcDateKey(easter), name: 'Wielkanoc' },
    { date: utcDateKey(easterMonday), name: 'Poniedziałek Wielkanocny' },
    { date: `${year}-05-01`, name: 'Święto Pracy' },
    { date: `${year}-05-03`, name: 'Święto Konstytucji 3 Maja' },
    { date: utcDateKey(pentecost), name: 'Zielone Świątki' },
    { date: utcDateKey(corpusChristi), name: 'Boże Ciało' },
    { date: `${year}-08-15`, name: 'Wniebowzięcie NMP' },
    { date: `${year}-11-01`, name: 'Wszystkich Świętych' },
    { date: `${year}-11-11`, name: 'Narodowe Święto Niepodległości' },
    { date: `${year}-12-25`, name: 'Boże Narodzenie' },
    { date: `${year}-12-26`, name: 'Drugi dzień Świąt' }
  ]
}

export function holidaysBetween(fromYear: number, toYear: number): Holiday[] {
  const holidays: Holiday[] = []
  for (let year = fromYear; year <= toYear; year++) {
    holidays.push(...polishPublicHolidays(year))
  }
  return holidays
}

export function holidayOn(date: Date, calendar: WorkCalendar = DEFAULT_WORK_CALENDAR): Holiday | undefined {
  const key = dateKey(date, calendar.timeZone)
  const year = Number(key.slice(0, 4))
  return polishPublicHolidays(year).find(holiday => holiday.date === key)
}

export function isWorkingDay(date: Date, calendar: WorkCalendar = DEFAULT_WORK_CALENDAR): boolean {
  const parts = zonedParts(date, calendar.timeZone)
  if (!calendar.weekdays.includes(parts.weekday)) return false
  return !holidayOn(date, calendar)
}

export function isWithinBusinessHours(date: Date, calendar: WorkCalendar = DEFAULT_WORK_CALENDAR): boolean {
  if (!isWorkingDay(date, calendar)) return false
  const parts = zonedParts(date, calendar.timeZone)
  const minutes = parts.hour * 60 + parts.minute
  return minutes >= calendar.startHour * 60 && minutes < calendar.endHour * 60
}

export function businessSecondsBetween(
  start: Date,
  end: Date,
  calendar: WorkCalendar = DEFAULT_WORK_CALENDAR
): number | null {
  if (end < start) return null
  let total = 0
  let cursor = dateKey(start, calendar.timeZone)
  const last = dateKey(end, calendar.timeZone)
  while (cursor <= last) {
    const [year, month, day] = cursor.split('-').map(Number)
    const dayInstant = fromZonedTime(year, month, day, 12, 0, 0, calendar.timeZone)
    if (isWorkingDay(dayInstant, calendar)) {
      const dayStart = fromZonedTime(year, month, day, calendar.startHour, 0, 0, calendar.timeZone)
      const dayEnd = fromZonedTime(year, month, day, calendar.endHour, 0, 0, calendar.timeZone)
      const windowStart = start > dayStart ? start : dayStart
      const windowEnd = end < dayEnd ? end : dayEnd
      if (windowEnd > windowStart) total += (windowEnd.getTime() - windowStart.getTime()) / 1000
    }
    cursor = nextDateKey(cursor)
  }
  return total
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000)
}

function nextDateKey(key: string): string {
  const [year, month, day] = key.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + 1))
  return utcDateKey(next)
}
