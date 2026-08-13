import './styles/gregory.css'

export { Gregory, gregory } from './gregory.js'
export { GregoryElement, defineElement } from './element.js'
export { buildMonth } from './core/calendar.js'
export { resolveLocale } from './core/locale.js'
export { defaultPresets } from './core/presets.js'
export {
  addDays,
  addMonths,
  compareDay,
  createDate,
  formatISODate,
  formatISOTime,
  isSameDay,
  isWithinDay,
  isoWeekNumber,
  parseDate,
  startOfDay,
  startOfWeek,
  today,
} from './core/date.js'
export {
  clampTimeOfDay,
  DAY_MINUTES,
  formatTimeOfDay,
  hourOptions,
  minuteOptions,
  minutesOfDay,
  normaliseTimeOfDay,
  parseTimeOfDay,
  withTimeOfDay,
} from './core/time.js'

export type { DayCell, MonthContext, MonthView, WeekRow } from './core/calendar.js'
export type {
  DateLike,
  DateRange,
  GregoryEvents,
  GregoryOptions,
  GregoryValue,
  Locale,
  LocaleInput,
  Mode,
  RangePreset,
  ResolvedOptions,
  WeekDay,
} from './core/types.js'
