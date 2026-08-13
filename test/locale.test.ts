import { describe, expect, it } from 'vitest'
import { resolveLocale } from '../src/core/locale.js'
import { createDate } from '../src/core/date.js'

describe('resolveLocale', () => {
  it('starts the week on Monday for cs and on Sunday for en-US', () => {
    expect(resolveLocale('cs').firstDayOfWeek).toBe(1)
    expect(resolveLocale('en-US').firstDayOfWeek).toBe(0)
  })

  it('rotates weekday names to the given first day', () => {
    const locale = resolveLocale('en-GB')
    expect(locale.weekdayNames(1)[0]).toMatch(/^Mon/)
    expect(locale.weekdayNames(0)[0]).toMatch(/^Sun/)
    expect(locale.weekdayNames(1)).toHaveLength(7)
  })

  it('produces twelve month names', () => {
    const names = resolveLocale('cs').monthNames()
    expect(names).toHaveLength(12)
    expect(names[0]?.toLowerCase()).toContain('led')
    expect(names[11]?.toLowerCase()).toContain('pros')
  })

  it('labels a month with its year', () => {
    const label = resolveLocale('cs').monthLabel(createDate(2026, 7, 1))
    expect(label.toLowerCase()).toContain('srpen')
    expect(label).toContain('2026')
  })

  it('appends the time only when asked', () => {
    const locale = resolveLocale('cs')
    const date = createDate(2026, 7, 13, 9, 5)
    expect(locale.formatDate(date, false)).not.toContain('09:05')
    expect(locale.formatDate(date, true)).toContain('09:05')
  })

  it('translates the built-in labels for Czech', () => {
    expect(resolveLocale('cs').labels.apply).toBe('Použít')
    expect(resolveLocale('en').labels.apply).toBe('Apply')
  })

  it('merges a partial override on top of the resolved locale', () => {
    const locale = resolveLocale({ code: 'cs', rangeSeparator: ' až ', labels: { apply: 'OK' } })
    expect(locale.rangeSeparator).toBe(' až ')
    expect(locale.labels.apply).toBe('OK')
    // Untouched labels still come from the base locale.
    expect(locale.labels.cancel).toBe('Zrušit')
    expect(locale.firstDayOfWeek).toBe(1)
  })

  it('falls back to a usable locale for an unknown tag', () => {
    const locale = resolveLocale('xx-fake-tag')
    expect(locale.weekdayNames(1)).toHaveLength(7)
    expect([0, 1]).toContain(locale.firstDayOfWeek)
  })
})
