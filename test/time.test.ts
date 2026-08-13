import { describe, expect, it } from 'vitest'
import {
  clampTimeOfDay,
  formatTimeOfDay,
  hourOptions,
  minuteOptions,
  minutesOfDay,
  normaliseTimeOfDay,
  parseTimeOfDay,
  withTimeOfDay,
} from '../src/core/time.js'
import { createDate, formatISOTime } from '../src/core/date.js'

describe('parseTimeOfDay', () => {
  it('reads HH:MM as minutes since midnight', () => {
    expect(parseTimeOfDay('08:00')).toBe(480)
    expect(parseTimeOfDay('00:00')).toBe(0)
    expect(parseTimeOfDay('23:59')).toBe(1439)
    expect(parseTimeOfDay('8:05')).toBe(485)
  })

  it('rejects nonsense', () => {
    expect(parseTimeOfDay('24:00')).toBeNull()
    expect(parseTimeOfDay('08:60')).toBeNull()
    expect(parseTimeOfDay('osm hodin')).toBeNull()
    expect(parseTimeOfDay('')).toBeNull()
    expect(parseTimeOfDay(null)).toBeNull()
  })

  it('accepts a plain minute count', () => {
    expect(parseTimeOfDay(480)).toBe(480)
  })

  it('round-trips through formatTimeOfDay', () => {
    expect(formatTimeOfDay(parseTimeOfDay('18:30')!)).toBe('18:30')
    expect(formatTimeOfDay(0)).toBe('00:00')
  })
})

describe('minutesOfDay / withTimeOfDay', () => {
  it('reads and writes the time of a date', () => {
    expect(minutesOfDay(createDate(2026, 7, 13, 9, 45))).toBe(585)
    expect(formatISOTime(withTimeOfDay(createDate(2026, 7, 13), 585))).toBe('09:45')
  })

  it('keeps the calendar day', () => {
    const result = withTimeOfDay(createDate(2026, 7, 13), 1439)
    expect(result.getDate()).toBe(13)
    expect(result.getHours()).toBe(23)
  })
})

describe('clampTimeOfDay', () => {
  it('pulls a time into the window', () => {
    expect(clampTimeOfDay(400, 480, 1080)).toBe(480)
    expect(clampTimeOfDay(1200, 480, 1080)).toBe(1080)
    expect(clampTimeOfDay(600, 480, 1080)).toBe(600)
  })

  it('ignores missing bounds', () => {
    expect(clampTimeOfDay(400, null, null)).toBe(400)
  })
})

describe('minuteOptions', () => {
  it('steps through the hour', () => {
    expect(minuteOptions(10, 15, null, null)).toEqual([0, 15, 30, 45])
    expect(minuteOptions(10, 30, null, null)).toEqual([0, 30])
    expect(minuteOptions(10, 60, null, null)).toEqual([0])
  })

  it('trims the boundary hours', () => {
    // maxTime 18:00 → the 18th hour only offers :00
    expect(minuteOptions(18, 15, 480, 1080)).toEqual([0])
    // minTime 08:30 → the 8th hour starts at :30
    expect(minuteOptions(8, 15, 510, 1080)).toEqual([30, 45])
  })

  it('returns nothing for an hour outside the window', () => {
    expect(minuteOptions(7, 15, 480, 1080)).toEqual([])
    expect(minuteOptions(19, 15, 480, 1080)).toEqual([])
  })

  it('keeps an off-step current value visible', () => {
    expect(minuteOptions(10, 15, null, null, 10 * 60 + 7)).toEqual([0, 7, 15, 30, 45])
  })
})

describe('hourOptions', () => {
  it('lists every hour without bounds', () => {
    expect(hourOptions(15, null, null)).toHaveLength(24)
  })

  it('covers the business window inclusively', () => {
    // 08:00–18:00 means 8 through 18, because 18:00 itself is selectable.
    expect(hourOptions(15, 480, 1080)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18])
  })

  it('drops an hour that has no valid minute left', () => {
    // maxTime 17:45 with a 30-minute step: 17:00 and 17:30 fit, 18 does not.
    const hours = hourOptions(30, 480, 17 * 60 + 45)
    expect(hours).toContain(17)
    expect(hours).not.toContain(18)
  })

  it('keeps the hour of an out-of-window current value', () => {
    expect(hourOptions(15, 480, 1080, 6 * 60)).toContain(6)
  })
})

describe('normaliseTimeOfDay', () => {
  it('snaps onto the step grid', () => {
    expect(normaliseTimeOfDay(10 * 60 + 7, 15, null, null)).toBe(10 * 60)
    expect(normaliseTimeOfDay(10 * 60 + 8, 15, null, null)).toBe(10 * 60 + 15)
  })

  it('pulls a time before the window up to its start', () => {
    expect(formatTimeOfDay(normaliseTimeOfDay(6 * 60, 15, 480, 1080))).toBe('08:00')
  })

  it('pulls a time after the window down to its end', () => {
    expect(formatTimeOfDay(normaliseTimeOfDay(22 * 60, 15, 480, 1080))).toBe('18:00')
  })

  it('lands on a legal time when the hour itself is empty', () => {
    // 17:50 with a 30-minute step and maxTime 17:45 has no minute in hour 17.
    const result = normaliseTimeOfDay(17 * 60 + 50, 30, 480, 17 * 60 + 45)
    expect(minuteOptions(Math.floor(result / 60), 30, 480, 17 * 60 + 45)).toContain(result % 60)
  })
})
