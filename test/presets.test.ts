import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultPresets } from '../src/core/presets.js'
import { resolveLocale } from '../src/core/locale.js'
import { createDate, formatISODate, parseDate } from '../src/core/date.js'

/** Freezes the clock so "last month" and friends are deterministic. */
function freeze(date: Date): void {
  vi.useFakeTimers()
  vi.setSystemTime(date)
}

afterEach(() => {
  vi.useRealTimers()
})

function resolve(label: string, locale = resolveLocale('en')): [string, string] {
  const preset = defaultPresets(locale).find((candidate) => candidate.label === label)
  if (!preset) throw new Error(`preset "${label}" is missing`)
  const [from, to] = preset.range()
  return [formatISODate(parseDate(from)!), formatISODate(parseDate(to)!)]
}

describe('defaultPresets', () => {
  it('localises the labels', () => {
    const labelsFor = (code: string): string[] => defaultPresets(resolveLocale(code)).map((preset) => preset.label)

    expect(labelsFor('cs')).toContain('Posledních 7 dní')
    expect(labelsFor('en')).toContain('Last 7 days')
    expect(labelsFor('sk')).toContain('Posledných 7 dní')
    expect(labelsFor('de')).toContain('Letzte 7 Tage')
    expect(labelsFor('pl')).toContain('Ostatnie 7 dni')
    expect(labelsFor('es')).toContain('Últimos 7 días')
    expect(labelsFor('fr')).toContain('7 derniers jours')
    expect(labelsFor('it')).toContain('Ultimi 7 giorni')
  })

  it('counts "last 7 days" inclusively, ending today', () => {
    freeze(createDate(2026, 7, 13, 10, 0))
    expect(resolve('Last 7 days')).toEqual(['2026-08-07', '2026-08-13'])
  })

  it('counts "last 30 days" inclusively', () => {
    freeze(createDate(2026, 7, 13, 10, 0))
    expect(resolve('Last 30 days')).toEqual(['2026-07-15', '2026-08-13'])
  })

  it('returns a single day for today and yesterday', () => {
    freeze(createDate(2026, 7, 13, 10, 0))
    expect(resolve('Today')).toEqual(['2026-08-13', '2026-08-13'])
    expect(resolve('Yesterday')).toEqual(['2026-08-12', '2026-08-12'])
  })

  it('spans the whole current month', () => {
    freeze(createDate(2026, 7, 13, 10, 0))
    expect(resolve('This month')).toEqual(['2026-08-01', '2026-08-31'])
  })

  it('handles the last month across a year boundary', () => {
    freeze(createDate(2026, 0, 15, 10, 0))
    expect(resolve('Last month')).toEqual(['2025-12-01', '2025-12-31'])
  })

  it('gets February right in a leap year', () => {
    freeze(createDate(2024, 2, 31, 10, 0))
    expect(resolve('Last month')).toEqual(['2024-02-01', '2024-02-29'])
  })

  it('spans the whole year', () => {
    freeze(createDate(2026, 7, 13, 10, 0))
    expect(resolve('This year')).toEqual(['2026-01-01', '2026-12-31'])
  })

  it('resolves lazily, so a picker left open overnight stays correct', () => {
    const preset = defaultPresets(resolveLocale('en')).find((candidate) => candidate.label === 'Today')!

    freeze(createDate(2026, 7, 13, 23, 59))
    const before = formatISODate(parseDate(preset.range()[0])!)

    vi.setSystemTime(createDate(2026, 7, 14, 0, 1))
    const after = formatISODate(parseDate(preset.range()[0])!)

    expect(before).toBe('2026-08-13')
    expect(after).toBe('2026-08-14')
  })
})
