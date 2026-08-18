import { createDate, formatISOTime, isSameDay, parseDate as parseISO, today } from './date.js'
import { translationFor } from './i18n.js'
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

/**
 * Přečte datum tak, jak ho člověk napíše. Bere ISO tvar, plné datum podle
 * pořadí polí v locale, i zkratky „13. 8." nebo „13" (doplní se aktuální
 * měsíc a rok). Volitelný čas na konci se použije, pokud tam je.
 */
function parseWritten(text: string, order: Array<'day' | 'month' | 'year'>, reference: Date = today()): Date | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const iso = parseISO(trimmed)
  if (iso) return iso

  // Čas na konci se odloupne dřív, ať neplete číslice data.
  let rest = trimmed
  let hours = 0
  let minutes = 0
  const time = /(\d{1,2}):(\d{2})\s*$/.exec(rest)
  if (time) {
    hours = Number(time[1])
    minutes = Number(time[2])
    if (hours > 23 || minutes > 59) return null
    rest = rest.slice(0, time.index)
  }

  const numbers = rest.match(/\d+/g)?.map(Number)
  if (!numbers?.length || numbers.length > 3) return null

  let day = reference.getDate()
  let month = reference.getMonth()
  let year = reference.getFullYear()

  if (numbers.length === 3) {
    order.forEach((field, index) => {
      const value = numbers[index]!
      if (field === 'day') day = value
      else if (field === 'month') month = value - 1
      else year = value < 100 ? 2000 + value : value
    })
  } else if (numbers.length === 2) {
    // Bez roku: pořadí dne a měsíce se drží locale.
    const dayFirst = order.indexOf('day') < order.indexOf('month')
    day = dayFirst ? numbers[0]! : numbers[1]!
    month = (dayFirst ? numbers[1]! : numbers[0]!) - 1
  } else {
    day = numbers[0]!
  }

  if (month < 0 || month > 11 || day < 1 || day > 31) return null
  const date = createDate(year, month, day, hours, minutes)
  // Přetečení typu 31. 2. se nemá tiše překlopit na březen.
  return date.getMonth() === month && date.getDate() === day ? date : null
}

function createIntlLocale(requested: string, separator?: string): Locale {
  const code = supportedCode(requested)
  // Popisky jdou z tabulky překladů, zbytek řeší Intl.
  const { labels, days } = translationFor(code)
  // Čeština potřebuje tři tvary (1 den / 2 dny / 5 dní), takže se počet žene
  // přes Intl.PluralRules místo naivního n === 1.
  const plural = new Intl.PluralRules(code)
  const monthYearFormat = new Intl.DateTimeFormat(code, { month: 'long', year: 'numeric' })
  const monthFormat = new Intl.DateTimeFormat(code, { month: 'long' })
  const weekdayFormat = new Intl.DateTimeFormat(code, { weekday: 'short' })
  const dateFormat = new Intl.DateTimeFormat(code, { day: 'numeric', month: 'numeric', year: 'numeric' })
  // Vlastní oddělovač musí dorazit sem, ne až do výsledného objektu — jinak by
  // ho `formatRange` neviděl, protože si drží uzávěr nad touhle proměnnou.
  const rangeSeparator = separator ?? ' – '

  // Pořadí polí v datu: en-US má měsíc první, většina Evropy den.
  const order = dateFormat
    .formatToParts(createDate(2026, 10, 25))
    .filter((part): part is Intl.DateTimeFormatPart & { type: 'day' | 'month' | 'year' } =>
      part.type === 'day' || part.type === 'month' || part.type === 'year',
    )
    .map((part) => part.type)

  return {
    code,
    firstDayOfWeek: detectFirstDayOfWeek(code),
    parseInput: (text, reference) => parseWritten(text, order, reference),
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
    formatRange: (from, to, withTime) => {
      const plain = (): string =>
        `${dateFormat.format(from)}${withTime ? ` ${formatISOTime(from)}` : ''}${rangeSeparator}` +
        `${dateFormat.format(to)}${withTime ? ` ${formatISOTime(to)}` : ''}`

      if (withTime) return plain()
      if (isSameDay(from, to)) return dateFormat.format(from)
      // Zkracuje se ručně, ne přes Intl.formatRange: ten má pro číselné datum
      // vlastní vzor („10.08.2026 – 14.08.2026" v češtině), který by v poli
      // vypadal jinak než jedno datum. Vytknout se dá jen den, a to v locale,
      // kde stojí první — v „8/10/2026" by z toho vyšel nesmysl.
      const sameMonth = from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()
      if (!sameMonth || order[0] !== 'day' || from > to) return plain()

      const parts = dateFormat.formatToParts(from)
      const index = parts.findIndex((part) => part.type === 'day')
      const suffix = parts[index + 1]?.type === 'literal' ? parts[index + 1]!.value.trimEnd() : ''
      return `${parts[index]!.value}${suffix}${rangeSeparator}${dateFormat.format(to)}`
    },
    formatDayCount: (count) => `${count} ${days[plural.select(count)] ?? days.other ?? ''}`.trim(),
    rangeSeparator,
    // `now` přibylo později, takže překlad zaregistrovaný zvenčí ho mít nemusí.
    labels: { ...labels, now: labels.now ?? labels.today },
  }
}

// Pomlčky nejdřív ty delší, jinak by „--" snědla jednoduchá varianta.
const RANGE_SEPARATORS = ['–', '—', '--', '-', 'až', 'to']

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Splits a typed range into its two ends. Besides the usual dashes and words it
 * honours the locale's own `rangeSeparator`, so a custom one reads back the way
 * it was written out.
 */
export function splitRangeText(text: string, separator: string): string[] {
  const custom = separator.trim()
  // Oddělovač složený jen z mezer se zahodí — rozsekal by i „10. 8. 2026".
  // Vlastní stojí první, aby delší tvar („— do —") nesnědla holá pomlčka.
  const candidates = custom && !RANGE_SEPARATORS.includes(custom)
    ? [custom, ...RANGE_SEPARATORS]
    : RANGE_SEPARATORS
  const pattern = new RegExp(`\\s*(?:${candidates.map(escapeRegExp).join('|')})\\s*`, 'i')
  return text.split(pattern).filter(Boolean)
}

/**
 * Resolves the `locale` option. A string is expanded through `Intl`; an object
 * is merged on top of the resolved locale so callers can override a single
 * label without reimplementing the rest.
 */
export function resolveLocale(input?: LocaleInput): Locale {
  if (typeof input === 'object' && input !== null) {
    const base = createIntlLocale(input.code ?? defaultLocaleCode(), input.rangeSeparator)
    return { ...base, ...input, labels: { ...base.labels, ...input.labels } }
  }
  return createIntlLocale(input ?? defaultLocaleCode())
}

function defaultLocaleCode(): string {
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language
  return 'en'
}
