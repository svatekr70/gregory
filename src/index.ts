import './styles/gregory.css'

export { Gregory, gregory } from './gregory.js'
export { GregoryElement, defineElement } from './element.js'
export { buildMonth } from './core/calendar.js'
export { resolveLocale } from './core/locale.js'
export { availableTranslations, registerTranslation, translationFor } from './core/i18n.js'
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
export type { Translation } from './core/i18n.js'
export type {
  DateLike,
  DateRange,
  DateRangeInput,
  RangeValueInput,
  GregoryEvents,
  GregoryOptions,
  GregoryValue,
  InvalidReason,
  Locale,
  LocaleInput,
  Mode,
  TimeWindow,
  RangePreset,
  ResolvedOptions,
  WeekDay,
  WeekSelection,
} from './core/types.js'
