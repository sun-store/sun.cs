import { describe, expect, it } from 'vitest'
import {
  businessSecondsBetween,
  easterSunday,
  fromZonedTime,
  holidayOn,
  isWithinBusinessHours,
  polishPublicHolidays
} from './workingHours'

describe('polish public holidays', () => {
  it('computes Easter Sunday for known years', () => {
    expect(easterSunday(2024).toISOString().slice(0, 10)).toBe('2024-03-31')
    expect(easterSunday(2025).toISOString().slice(0, 10)).toBe('2025-04-20')
    expect(easterSunday(2026).toISOString().slice(0, 10)).toBe('2026-04-05')
  })

  it('includes Easter Monday, Pentecost and Corpus Christi in 2026', () => {
    const dates = polishPublicHolidays(2026).map(holiday => holiday.date)
    expect(dates).toContain('2026-04-06')
    expect(dates).toContain('2026-05-24')
    expect(dates).toContain('2026-06-04')
  })
})

describe('business hours in Europe/Warsaw', () => {
  it('does not treat 15:32 UTC as in-hours when Warsaw is already 17:32', () => {
    const created = new Date('2026-08-05T15:32:00.000Z')
    expect(isWithinBusinessHours(created)).toBe(false)
  })

  it('treats 15:32 Warsaw as in-hours', () => {
    const created = fromZonedTime(2026, 8, 5, 15, 32, 0)
    expect(isWithinBusinessHours(created)).toBe(true)
  })

  it('skips weekends when counting working time', () => {
    const start = fromZonedTime(2026, 9, 25, 16, 0, 0)
    const end = fromZonedTime(2026, 9, 28, 10, 0, 0)
    expect(businessSecondsBetween(start, end)).toBe((60 + 60) * 60)
  })

  it('skips a statutory Friday holiday', () => {
    const mayDay = fromZonedTime(2026, 5, 1, 12, 0, 0)
    expect(holidayOn(mayDay)?.name).toBe('Święto Pracy')
    const start = fromZonedTime(2026, 4, 30, 16, 0, 0)
    const end = fromZonedTime(2026, 5, 4, 10, 0, 0)
    expect(businessSecondsBetween(start, end)).toBe((60 + 60) * 60)
  })
})
