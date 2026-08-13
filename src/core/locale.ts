import { createDate, formatISOTime } from './date.js'
import type { Locale, LocaleInput, WeekDay } from './types.js'

/**
 * Locales that start the week on Sunday. Used only as a fallback — modern
 * engines answer this through `Intl.Locale#getWeekInfo()`.
 */
const SUNDAY_FIRST = /^(en-US|en-CA|en-AU|ja|ko|pt-BR|he|ar|zh)/i

/** 2026-08-02 is a Sunday, so `+ n` walks a full week from day 0. */
const REFERENCE_SUNDAY = { year: 2026, month: 7, day: 2 } as const

function detectFirstDayOfWeek(code: string): WeekDay {
  try {
    const locale = new Intl.Locale(code) as Intl.Locale & { getWeekInfo?: () => { firstDay: number } }
    const info = locale.getWeekInfo?.()
    // Intl reports 1 = Monday … 7 = Sunday; Date#getDay() uses 0 = Sunday.
    if (info) return (info.firstDay % 7) as WeekDay
  } catch {
    // Unknown tag — fall through to the table below.
  }
  return SUNDAY_FIRST.test(code) ? 0 : 1
}

/**
 * `Intl` throws a RangeError on a malformed tag. A wrong `locale` option is not
 * worth taking the whole picker down, so it degrades to English instead.
 */
function supportedCode(code: string): string {
  try {
    new Intl.DateTimeFormat(code)
    return code
  } catch {
    return 'en'
  }
}

function createIntlLocale(requested: string): Locale {
  const code = supportedCode(requested)
  const monthYearFormat = new Intl.DateTimeFormat(code, { month: 'long', year: 'numeric' })
  const monthFormat = new Intl.DateTimeFormat(code, { month: 'long' })
  const weekdayFormat = new Intl.DateTimeFormat(code, { weekday: 'short' })
  const dateFormat = new Intl.DateTimeFormat(code, { day: 'numeric', month: 'numeric', year: 'numeric' })
  const czech = /^cs/i.test(code)

  return {
    code,
    firstDayOfWeek: detectFirstDayOfWeek(code),
    monthLabel: (date) => monthYearFormat.format(date),
    monthNames: () => Array.from({ length: 12 }, (_, month) => monthFormat.format(createDate(2026, month, 1))),
    weekdayNames: (firstDayOfWeek) =>
      Array.from({ length: 7 }, (_, index) => {
        const day = createDate(
          REFERENCE_SUNDAY.year,
          REFERENCE_SUNDAY.month,
          REFERENCE_SUNDAY.day + ((firstDayOfWeek + index) % 7),
        )
        return weekdayFormat.format(day).replace(/\.$/, '')
      }),
    formatDate: (date, withTime) =>
      withTime ? `${dateFormat.format(date)} ${formatISOTime(date)}` : dateFormat.format(date),
    rangeSeparator: ' – ',
    labels: czech
      ? {
          previousMonth: 'Předchozí měsíc',
          nextMonth: 'Následující měsíc',
          today: 'Dnes',
          clear: 'Vymazat',
          apply: 'Použít',
          cancel: 'Zrušit',
          customRange: 'Vlastní rozsah',
          weekNumber: 'Týden',
        }
      : {
          previousMonth: 'Previous month',
          nextMonth: 'Next month',
          today: 'Today',
          clear: 'Clear',
          apply: 'Apply',
          cancel: 'Cancel',
          customRange: 'Custom range',
          weekNumber: 'Week',
        },
  }
}

/**
 * Resolves the `locale` option. A string is expanded through `Intl`; an object
 * is merged on top of the resolved locale so callers can override a single
 * label without reimplementing the rest.
 */
export function resolveLocale(input?: LocaleInput): Locale {
  if (typeof input === 'object' && input !== null) {
    const base = createIntlLocale(input.code ?? defaultLocaleCode())
    return { ...base, ...input, labels: { ...base.labels, ...input.labels } }
  }
  return createIntlLocale(input ?? defaultLocaleCode())
}

function defaultLocaleCode(): string {
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language
  return 'en'
}
