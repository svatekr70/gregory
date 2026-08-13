import { addDays, addMonths, createDate, daysInMonth, today } from './date.js'
import { translationFor } from './i18n.js'
import type { Locale, RangePreset } from './types.js'

function startOfMonth(date: Date): Date {
  return createDate(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date): Date {
  return createDate(date.getFullYear(), date.getMonth(), daysInMonth(date.getFullYear(), date.getMonth()))
}

/**
 * The shortcut set from daterangepicker.com, resolved lazily so a picker left
 * open across midnight still reports the right "today".
 */
export function defaultPresets(locale: Locale): RangePreset[] {
  const labels = translationFor(locale.code).presets

  return [
    { label: labels.today, range: () => [today(), today()] },
    { label: labels.yesterday, range: () => [addDays(today(), -1), addDays(today(), -1)] },
    { label: labels.last7, range: () => [addDays(today(), -6), today()] },
    { label: labels.last30, range: () => [addDays(today(), -29), today()] },
    { label: labels.thisMonth, range: () => [startOfMonth(today()), endOfMonth(today())] },
    {
      label: labels.lastMonth,
      range: () => {
        const previous = addMonths(startOfMonth(today()), -1)
        return [startOfMonth(previous), endOfMonth(previous)]
      },
    },
    {
      label: labels.thisYear,
      range: () => [createDate(today().getFullYear(), 0, 1), createDate(today().getFullYear(), 11, 31)],
    },
  ]
}
