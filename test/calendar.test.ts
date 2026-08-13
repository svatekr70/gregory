import { describe, expect, it } from 'vitest'
import { buildMonth, isDayDisabled, type MonthContext } from '../src/core/calendar.js'
import { createDate } from '../src/core/date.js'
import { resolveLocale } from '../src/core/locale.js'

function context(patch: Partial<MonthContext> = {}): MonthContext {
  return {
    locale: resolveLocale('cs'),
    firstDayOfWeek: 1,
    selection: { from: null, to: null },
    preview: null,
    min: null,
    max: null,
    maxSpan: null,
    reference: createDate(2026, 7, 13),
    ...patch,
  }
}

describe('buildMonth', () => {
  it('always renders six weeks of seven days', () => {
    const view = buildMonth(2026, 7, context())
    expect(view.weeks).toHaveLength(6)
    for (const week of view.weeks) expect(week.days).toHaveLength(7)
  })

  it('starts the grid on the locale first day of week', () => {
    const monday = buildMonth(2026, 7, context({ firstDayOfWeek: 1 }))
    expect(monday.weeks[0]!.days[0]!.iso).toBe('2026-07-27')

    const sunday = buildMonth(2026, 7, context({ firstDayOfWeek: 0 }))
    expect(sunday.weeks[0]!.days[0]!.iso).toBe('2026-07-26')
  })

  it('marks days outside the rendered month', () => {
    const view = buildMonth(2026, 7, context())
    expect(view.weeks[0]!.days[0]!.outside).toBe(true)
    expect(view.weeks[1]!.days[0]!.outside).toBe(false)
  })

  it('flags range bounds and the days between them', () => {
    const view = buildMonth(2026, 7, {
      ...context(),
      selection: { from: createDate(2026, 7, 10), to: createDate(2026, 7, 12) },
    })
    const days = view.weeks.flatMap((week) => week.days)
    const byIso = (iso: string) => days.find((day) => day.iso === iso)!

    expect(byIso('2026-08-10').rangeStart).toBe(true)
    expect(byIso('2026-08-11').inRange).toBe(true)
    expect(byIso('2026-08-11').selected).toBe(false)
    expect(byIso('2026-08-12').rangeEnd).toBe(true)
    expect(byIso('2026-08-13').inRange).toBe(false)
  })

  it('previews a range while only one bound is picked', () => {
    const view = buildMonth(2026, 7, {
      ...context(),
      selection: { from: createDate(2026, 7, 10), to: null },
      preview: createDate(2026, 7, 14),
    })
    const days = view.weeks.flatMap((week) => week.days)
    expect(days.find((day) => day.iso === '2026-08-12')!.inRange).toBe(true)
  })

  it('resolves the ISO week number of each row', () => {
    const view = buildMonth(2026, 7, context())
    expect(view.weeks[0]!.weekNumber).toBe(31)
  })
})

describe('isDayDisabled', () => {
  it('respects min and max', () => {
    const ctx = context({ min: createDate(2026, 7, 10), max: createDate(2026, 7, 20) })
    expect(isDayDisabled(createDate(2026, 7, 9), ctx)).toBe(true)
    expect(isDayDisabled(createDate(2026, 7, 10), ctx)).toBe(false)
    expect(isDayDisabled(createDate(2026, 7, 21), ctx)).toBe(true)
  })

  it('narrows the window to maxSpan once one bound is picked', () => {
    const ctx = context({ selection: { from: createDate(2026, 7, 10), to: null }, maxSpan: 3 })
    // from + 2 days is still a 3-day range; the next day is one too many.
    expect(isDayDisabled(createDate(2026, 7, 12), ctx)).toBe(false)
    expect(isDayDisabled(createDate(2026, 7, 13), ctx)).toBe(true)
    // The window is symmetrical — the second click may also go backwards.
    expect(isDayDisabled(createDate(2026, 7, 8), ctx)).toBe(false)
    expect(isDayDisabled(createDate(2026, 7, 7), ctx)).toBe(true)
  })

  it('defers to the isDisabled callback', () => {
    const ctx = context({ isDisabled: (date) => date.getDay() === 0 })
    expect(isDayDisabled(createDate(2026, 7, 9), ctx)).toBe(true)
    expect(isDayDisabled(createDate(2026, 7, 10), ctx)).toBe(false)
  })
})
