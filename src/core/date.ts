import type { DateLike, WeekDay } from './types.js'

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/

export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime())
}

/**
 * Builds a local-time date. Wraps `new Date(y, m, d)` because that constructor
 * silently maps years 0–99 onto 1900–1999.
 */
export function createDate(year: number, month: number, day: number, hours = 0, minutes = 0): Date {
  const date = new Date(year, month, day, hours, minutes, 0, 0)
  if (year >= 0 && year < 100) date.setFullYear(year)
  return date
}

export function startOfDay(date: Date): Date {
  const copy = new Date(date.getTime())
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function today(): Date {
  return startOfDay(new Date())
}

/**
 * Parses user input into a local date.
 *
 * ISO strings are deliberately parsed by hand: `new Date('2026-08-13')` is
 * specified as UTC midnight, which resolves to the *previous* day everywhere
 * west of Greenwich — the single most common bug in date pickers.
 */
export function parseDate(value: DateLike): Date | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return isValidDate(value) ? new Date(value.getTime()) : null
  if (typeof value === 'number') {
    const fromStamp = new Date(value)
    return isValidDate(fromStamp) ? fromStamp : null
  }

  const match = ISO_PATTERN.exec(value.trim())
  if (!match) return null

  const [, year, month, day, hours, minutes] = match
  const parsed = createDate(Number(year), Number(month) - 1, Number(day), Number(hours ?? 0), Number(minutes ?? 0))
  // Rejects overflow like 2026-02-31, which the Date constructor would roll over.
  if (parsed.getMonth() !== Number(month) - 1 || parsed.getDate() !== Number(day)) return null
  return parsed
}

const pad = (value: number, length = 2): string => String(value).padStart(length, '0')

export function formatISODate(date: Date): string {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function formatISOTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

export function addDays(date: Date, amount: number): Date {
  const copy = new Date(date.getTime())
  copy.setDate(copy.getDate() + amount)
  return copy
}

/**
 * Whole days from `a` to `b`; negative when `b` is earlier. Zaokrouhluje se,
 * protože přechod na letní čas dělá ze dne 23 nebo 25 hodin.
 */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000)
}

/** Clamps the day so that Jan 31 + 1 month lands on Feb 28/29, not Mar 2/3. */
export function addMonths(date: Date, amount: number): Date {
  const year = date.getFullYear()
  const month = date.getMonth() + amount
  const day = Math.min(date.getDate(), daysInMonth(year, month))
  return createDate(year, month, day, date.getHours(), date.getMinutes())
}

export function isSameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** Day-granularity comparison: -1 if `a` is earlier, 0 same day, 1 later. */
export function compareDay(a: Date, b: Date): -1 | 0 | 1 {
  const left = startOfDay(a).getTime()
  const right = startOfDay(b).getTime()
  return left < right ? -1 : left > right ? 1 : 0
}

/** Inclusive on both bounds. */
export function isWithinDay(date: Date, from: Date | null, to: Date | null): boolean {
  if (!from || !to) return false
  const [start, end] = compareDay(from, to) <= 0 ? [from, to] : [to, from]
  return compareDay(date, start) >= 0 && compareDay(date, end) <= 0
}

export function clampDate(date: Date, min: Date | null, max: Date | null): Date {
  if (min && compareDay(date, min) < 0) return min
  if (max && compareDay(date, max) > 0) return max
  return date
}

export function startOfWeek(date: Date, firstDayOfWeek: WeekDay): Date {
  const shift = (date.getDay() - firstDayOfWeek + 7) % 7
  return startOfDay(addDays(date, -shift))
}

/** ISO 8601 week number — weeks start on Monday, week 1 contains the first Thursday. */
export function isoWeekNumber(date: Date): number {
  const thursday = startOfDay(date)
  thursday.setDate(thursday.getDate() + 3 - ((thursday.getDay() + 6) % 7))
  const firstThursday = createDate(thursday.getFullYear(), 0, 4)
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7))
  return 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 86_400_000))
}

/** Copies the time-of-day from `time` onto the calendar day of `date`. */
export function withTimeOf(date: Date, time: Date | null): Date {
  if (!time) return date
  return createDate(date.getFullYear(), date.getMonth(), date.getDate(), time.getHours(), time.getMinutes())
}
