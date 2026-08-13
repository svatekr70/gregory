import {
  addDays,
  compareDay,
  createDate,
  daysBetween,
  formatISODate,
  isSameDay,
  isWithinDay,
  isoWeekNumber,
  startOfWeek,
  today,
} from './date.js'
import type { DateRange, Locale, WeekDay } from './types.js'

export interface DayCell {
  date: Date
  iso: string
  /** Belongs to the previous or next month, shown to fill the grid. */
  outside: boolean
  isToday: boolean
  disabled: boolean
  selected: boolean
  /** Strictly between the range bounds. */
  inRange: boolean
  rangeStart: boolean
  rangeEnd: boolean
  weekend: boolean
  extraClass: string | null
}

export interface WeekRow {
  weekNumber: number
  days: DayCell[]
}

export interface MonthView {
  year: number
  month: number
  label: string
  weekdays: string[]
  weeks: WeekRow[]
}

export interface MonthContext {
  locale: Locale
  firstDayOfWeek: WeekDay
  selection: DateRange
  /** Day currently hovered or focused, used to preview an unfinished range. */
  preview: Date | null
  min: Date | null
  max: Date | null
  /** Longest selectable range in days; narrows the bounds once one end is picked. */
  maxSpan: number | null
  /** Nejkratší rozsah ve dnech; zakáže dny příliš blízko prvnímu konci. */
  minSpan?: number | null | undefined
  /**
   * Meze spočítané z nejbližšího zakázaného dne kolem rozpracovaného konce.
   * Počítá je picker, protože kalendář nezná celou osu času.
   */
  spanLimit?: DateRange | null | undefined
  /** Paints a half-picked range as running to the edge of time. */
  openEnded?: boolean | undefined
  /** Overrides the painted range, e.g. the week under the cursor. */
  previewRange?: DateRange | null | undefined
  /** Samostatně vybrané dny v režimu `multiple`, jako ISO klíče. */
  picked?: ReadonlySet<string> | undefined
  isDisabled?: ((date: Date) => boolean) | undefined
  dayClass?: ((date: Date) => string | null | undefined) | undefined
  /** Overrides "today", so tests do not depend on the clock. */
  reference?: Date | undefined
}

/** Range bounds sorted ascending; `preview` stands in for a missing second bound. */
function effectiveRange(context: MonthContext): DateRange {
  // A whole-week preview replaces the selection outright — it is what clicking
  // right now would produce.
  if (context.previewRange) return sorted(context.previewRange)
  const { from, to } = context.selection
  const end = to ?? context.preview
  if (!from || !end) return { from, to }
  return sorted({ from, to: end })
}

function sorted({ from, to }: DateRange): DateRange {
  if (!from || !to) return { from, to }
  return compareDay(from, to) <= 0 ? { from, to } : { from: to, to: from }
}

/**
 * Days strictly between the bounds. With `openEnded` a single bound reaches to
 * the edge of the calendar, which is what applying the range now would mean.
 */
function isInsideRange(date: Date, range: DateRange, openEnded: boolean): boolean {
  if (range.from && range.to) return isWithinDay(date, range.from, range.to)
  if (!openEnded) return false
  if (range.from) return compareDay(date, range.from) > 0
  if (range.to) return compareDay(date, range.to) < 0
  return false
}

export function isDayDisabled(date: Date, context: MonthContext): boolean {
  if (context.min && compareDay(date, context.min) < 0) return true
  if (context.max && compareDay(date, context.max) > 0) return true

  // While a range is half-picked, the span rules shrink the selectable window.
  const { from, to } = context.selection
  if (from && !to) {
    if (context.maxSpan) {
      const span = context.maxSpan - 1
      if (compareDay(date, addDays(from, -span)) < 0) return true
      if (compareDay(date, addDays(from, span)) > 0) return true
    }
    if (context.minSpan && context.minSpan > 1) {
      // Sám počáteční den zůstává klikatelný — je to způsob, jak výběr začít
      // jinde, ne pokus o nulový rozsah.
      const distance = Math.abs(daysBetween(from, date))
      if (distance > 0 && distance < context.minSpan - 1) return true
    }
    const limit = context.spanLimit
    if (limit?.from && compareDay(date, limit.from) < 0) return true
    if (limit?.to && compareDay(date, limit.to) > 0) return true
  }

  return context.isDisabled?.(date) ?? false
}

/**
 * Builds one month panel. Always emits 6 week rows so the popover keeps a
 * constant height while the user pages through months.
 */
export function buildMonth(year: number, month: number, context: MonthContext): MonthView {
  const firstOfMonth = createDate(year, month, 1)
  const gridStart = startOfWeek(firstOfMonth, context.firstDayOfWeek)
  const now = context.reference ?? today()
  const range = effectiveRange(context)
  const weeks: WeekRow[] = []

  for (let week = 0; week < 6; week += 1) {
    const days: DayCell[] = []
    for (let index = 0; index < 7; index += 1) {
      const date = addDays(gridStart, week * 7 + index)
      const iso = formatISODate(date)
      const weekday = date.getDay()
      // V režimu multiple není rozsah, jen seznam samostatných dnů.
      const isPicked = context.picked?.has(iso) ?? false
      const rangeStart = isPicked || isSameDay(date, range.from)
      const rangeEnd = isPicked || isSameDay(date, range.to)

      days.push({
        date,
        iso,
        outside: date.getMonth() !== month,
        isToday: isSameDay(date, now),
        disabled: isDayDisabled(date, context),
        selected: rangeStart || rangeEnd,
        inRange: isInsideRange(date, range, context.openEnded ?? false) && !rangeStart && !rangeEnd,
        rangeStart,
        rangeEnd,
        weekend: weekday === 0 || weekday === 6,
        extraClass: context.dayClass?.(date) ?? null,
      })
    }
    weeks.push({ weekNumber: isoWeekNumber(days[0]!.date), days })
  }

  return {
    year,
    month,
    label: context.locale.monthLabel(firstOfMonth),
    weekdays: context.locale.weekdayNames(context.firstDayOfWeek),
    weeks,
  }
}
