import { describe, expect, it } from 'vitest'
import { resolveLocale } from '../src/core/locale.js'
import { availableTranslations, registerTranslation } from '../src/core/i18n.js'
import { createDate, formatISODate } from '../src/core/date.js'

/** Místní čas, ne UTC — `new Date('2026-08-10')` je půlnoc v Greenwichi. */
function date(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return createDate(year!, month! - 1, day!)
}

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

  it('carries labels for every advertised language', () => {
    const expected: Record<string, string> = {
      cs: 'Použít',
      sk: 'Použiť',
      de: 'Übernehmen',
      pl: 'Zastosuj',
      es: 'Aplicar',
      fr: 'Appliquer',
      it: 'Applica',
      en: 'Apply',
    }

    expect(availableTranslations()).toEqual(Object.keys(expected).sort())
    for (const [code, apply] of Object.entries(expected)) {
      expect(resolveLocale(code).labels.apply).toBe(apply)
    }
  })

  it('picks the language regardless of the region subtag', () => {
    expect(resolveLocale('de-AT').labels.today).toBe('Heute')
    expect(resolveLocale('fr-CA').labels.today).toBe("Aujourd'hui")
    expect(resolveLocale('es-MX').labels.cancel).toBe('Cancelar')
  })

  it('falls back to English for a language it does not carry', () => {
    // Japonština má měsíce z Intl, ale popisky knihovna nenese.
    const ja = resolveLocale('ja')
    expect(ja.labels.apply).toBe('Apply')
    expect(ja.monthNames()[0]).not.toBe('January')
  })

  it('counts days in the right language', () => {
    expect(resolveLocale('de').formatDayCount(3)).toBe('3 Tage')
    expect(resolveLocale('de').formatDayCount(1)).toBe('1 Tag')
    expect(resolveLocale('pl').formatDayCount(1)).toBe('1 dzień')
    expect(resolveLocale('pl').formatDayCount(3)).toBe('3 dni')
    expect(resolveLocale('fr').formatDayCount(7)).toBe('7 jours')
    expect(resolveLocale('sk').formatDayCount(1)).toBe('1 deň')
  })

  it('takes a language the library does not carry', () => {
    registerTranslation('ja', {
      labels: { ...resolveLocale('en').labels, apply: '適用', today: '今日' },
      presets: {
        today: '今日',
        yesterday: '昨日',
        last7: '過去7日間',
        last30: '過去30日間',
        thisMonth: '今月',
        lastMonth: '先月',
        thisYear: '今年',
      },
      days: { other: '日' },
    })

    expect(resolveLocale('ja').labels.apply).toBe('適用')
    expect(resolveLocale('ja-JP').labels.today).toBe('今日')
    expect(resolveLocale('ja').formatDayCount(5)).toBe('5 日')
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

describe('formatRange', () => {
  it('vytkne společný měsíc a rok', () => {
    const locale = resolveLocale('cs')
    expect(locale.formatRange(date('2026-08-10'), date('2026-08-14'), false)).toBe('10.–14. 8. 2026')
  })

  it('jednodenní rozsah píše jako jedno datum', () => {
    const locale = resolveLocale('cs')
    expect(locale.formatRange(date('2026-08-10'), date('2026-08-10'), false)).toBe('10. 8. 2026')
  })

  it('přes hranici měsíce vypíše obě data', () => {
    const locale = resolveLocale('cs')
    expect(locale.formatRange(date('2026-08-30'), date('2026-09-02'), false)).toBe('30. 8. 2026 – 2. 9. 2026')
  })

  it('nezkracuje tam, kde den nestojí první', () => {
    const locale = resolveLocale('en-US')
    expect(locale.formatRange(date('2026-08-10'), date('2026-08-14'), false)).toBe('8/10/2026 – 8/14/2026')
  })

  it('s časem skládá oba konce v plné podobě', () => {
    const locale = resolveLocale('cs')
    const from = date('2026-08-10')
    const to = date('2026-08-10')
    from.setHours(8, 30)
    to.setHours(17, 0)
    expect(locale.formatRange(from, to, true)).toBe('10. 8. 2026 08:30 – 10. 8. 2026 17:00')
  })
})

describe('parseInput s referencí', () => {
  it('doplní měsíc a rok z reference', () => {
    const locale = resolveLocale('cs')
    const parsed = locale.parseInput('10.', date('2026-08-14'))
    expect(formatISODate(parsed!)).toBe('2026-08-10')
  })
})
