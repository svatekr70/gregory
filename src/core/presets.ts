import { addDays, addMonths, createDate, daysInMonth, today } from './date.js'
import type { Locale, RangePreset } from './types.js'

const CZECH_PRESETS: Record<string, string> = {
  today: 'Dnes',
  yesterday: 'Včera',
  last7: 'Posledních 7 dní',
  last30: 'Posledních 30 dní',
  thisMonth: 'Tento měsíc',
  lastMonth: 'Minulý měsíc',
  thisYear: 'Letos',
}

const ENGLISH_PRESETS: Record<string, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last7: 'Last 7 days',
  last30: 'Last 30 days',
  thisMonth: 'This month',
  lastMonth: 'Last month',
  thisYear: 'This year',
}

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
  const labels = /^cs/i.test(locale.code) ? CZECH_PRESETS : ENGLISH_PRESETS

  return [
    { label: labels.today!, range: () => [today(), today()] },
    { label: labels.yesterday!, range: () => [addDays(today(), -1), addDays(today(), -1)] },
    { label: labels.last7!, range: () => [addDays(today(), -6), today()] },
    { label: labels.last30!, range: () => [addDays(today(), -29), today()] },
    { label: labels.thisMonth!, range: () => [startOfMonth(today()), endOfMonth(today())] },
    {
      label: labels.lastMonth!,
      range: () => {
        const previous = addMonths(startOfMonth(today()), -1)
        return [startOfMonth(previous), endOfMonth(previous)]
      },
    },
    {
      label: labels.thisYear!,
      range: () => [createDate(today().getFullYear(), 0, 1), createDate(today().getFullYear(), 11, 31)],
    },
  ]
}
