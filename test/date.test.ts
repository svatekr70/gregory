import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  compareDay,
  createDate,
  formatISODate,
  isWithinDay,
  isoWeekNumber,
  parseDate,
  startOfWeek,
} from '../src/core/date.js'

describe('parseDate', () => {
  it('parses ISO dates in local time, not UTC', () => {
    // `new Date('2026-08-13')` is UTC midnight and would report the 12th in CEST.
    const parsed = parseDate('2026-08-13')
    expect(parsed?.getFullYear()).toBe(2026)
    expect(parsed?.getMonth()).toBe(7)
    expect(parsed?.getDate()).toBe(13)
    expect(parsed?.getHours()).toBe(0)
  })

  it('reads an optional time part', () => {
    const parsed = parseDate('2026-08-13T14:30')
    expect(parsed?.getHours()).toBe(14)
    expect(parsed?.getMinutes()).toBe(30)
  })

  it('rejects impossible dates instead of rolling them over', () => {
    expect(parseDate('2026-02-31')).toBeNull()
    expect(parseDate('nonsense')).toBeNull()
    expect(parseDate('')).toBeNull()
    expect(parseDate(null)).toBeNull()
  })

  it('round-trips through formatISODate', () => {
    expect(formatISODate(parseDate('2026-01-05')!)).toBe('2026-01-05')
  })
})

describe('addMonths', () => {
  it('clamps to the last day of a shorter month', () => {
    expect(formatISODate(addMonths(createDate(2026, 0, 31), 1))).toBe('2026-02-28')
    expect(formatISODate(addMonths(createDate(2024, 0, 31), 1))).toBe('2024-02-29')
  })

  it('crosses year boundaries in both directions', () => {
    expect(formatISODate(addMonths(createDate(2026, 11, 15), 1))).toBe('2027-01-15')
    expect(formatISODate(addMonths(createDate(2026, 0, 15), -1))).toBe('2025-12-15')
  })

  it('keeps the time of day', () => {
    expect(addMonths(createDate(2026, 4, 10, 8, 45), 2).getHours()).toBe(8)
  })
})

describe('startOfWeek', () => {
  it('honours a Monday-first locale', () => {
    // 2026-08-13 is a Thursday.
    expect(formatISODate(startOfWeek(createDate(2026, 7, 13), 1))).toBe('2026-08-10')
  })

  it('honours a Sunday-first locale', () => {
    expect(formatISODate(startOfWeek(createDate(2026, 7, 13), 0))).toBe('2026-08-09')
  })
})

describe('isoWeekNumber', () => {
  it('matches ISO 8601 around the new year', () => {
    expect(isoWeekNumber(createDate(2026, 0, 1))).toBe(1)
    expect(isoWeekNumber(createDate(2025, 11, 29))).toBe(1)
    expect(isoWeekNumber(createDate(2026, 7, 13))).toBe(33)
  })
})

describe('range helpers', () => {
  it('compares by day, ignoring the clock', () => {
    expect(compareDay(createDate(2026, 7, 13, 23, 59), createDate(2026, 7, 13, 0, 1))).toBe(0)
    expect(compareDay(createDate(2026, 7, 12), createDate(2026, 7, 13))).toBe(-1)
  })

  it('treats both range bounds as inclusive', () => {
    const from = createDate(2026, 7, 10)
    const to = createDate(2026, 7, 12)
    expect(isWithinDay(from, from, to)).toBe(true)
    expect(isWithinDay(to, from, to)).toBe(true)
    expect(isWithinDay(addDays(to, 1), from, to)).toBe(false)
  })
})
