/** Anything Gregory accepts where a date is expected. */
export type DateLike = Date | string | number | null | undefined

export type Mode = 'date' | 'range' | 'datetime' | 'datetime-range'

/** Day index as used by `Date#getDay()` — 0 = Sunday … 6 = Saturday. */
export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface DateRange {
  from: Date | null
  to: Date | null
}

/** Value shape depends on the mode: a single date, or a range. */
export type GregoryValue = Date | DateRange | null

/** Sidebar shortcut, e.g. "Last 7 days". Resolved lazily so "today" stays fresh. */
export interface RangePreset {
  label: string
  range: () => [DateLike, DateLike]
}

export interface Locale {
  code: string
  firstDayOfWeek: WeekDay
  /** e.g. "srpen 2026" */
  monthLabel(date: Date): string
  /** Month names for the year/month dropdowns. */
  monthNames(): string[]
  /** Short weekday names, already rotated to start at `firstDayOfWeek`. */
  weekdayNames(firstDayOfWeek: WeekDay): string[]
  /** Human-facing rendering of one date, used in the input. */
  formatDate(date: Date, withTime: boolean): string
  /** Separator between range bounds in the input. */
  rangeSeparator: string
  labels: {
    previousMonth: string
    nextMonth: string
    today: string
    clear: string
    apply: string
    cancel: string
    customRange: string
    weekNumber: string
    /** Labels of the two time controls in range modes. */
    from: string
    to: string
    hours: string
    minutes: string
  }
}

/**
 * A BCP 47 tag, or an override object. `labels` is partial on its own so a
 * caller can rename a single button without restating the rest.
 */
export type LocaleInput = string | (Partial<Omit<Locale, 'labels'>> & { labels?: Partial<Locale['labels']> })

export interface GregoryOptions {
  mode?: Mode
  value?: DateLike | DateRange | [DateLike, DateLike]
  /** BCP 47 tag ("cs", "en-GB") or a partial locale object overriding the resolved one. */
  locale?: LocaleInput
  min?: DateLike
  max?: DateLike
  /** Overrides the locale default (cs → Monday, en-US → Sunday). */
  firstDayOfWeek?: WeekDay
  /** Month panels side by side. Defaults to 2 in range modes, 1 otherwise. */
  months?: number
  weekNumbers?: boolean
  /** Month/year `<select>`s in the panel header. */
  dropdowns?: boolean
  /** Render the panel in place instead of a popover attached to an input. */
  inline?: boolean
  /** Commit on the last click instead of showing Apply/Cancel. */
  autoApply?: boolean
  /** Sidebar shortcuts. `true` uses the built-in set, `false` hides the sidebar. */
  presets?: RangePreset[] | boolean
  /** Longest selectable range, in days. Ignored outside range modes. */
  maxSpan?: number | null
  /** Minutes between selectable times in `datetime*` modes. */
  timeStep?: number
  /** Time controls: two `<select>`s, or one native `<input type="time">`. */
  timeUi?: 'select' | 'input'
  /** Earliest selectable time of day, `'HH:MM'`. Inclusive. */
  minTime?: string | number | null
  /** Latest selectable time of day, `'HH:MM'`. Inclusive. */
  maxTime?: string | number | null
  /** Popover alignment relative to the input. */
  opens?: 'left' | 'right' | 'center'
  drops?: 'down' | 'up' | 'auto'
  /** Return `true` to make a day unselectable. */
  isDisabled?: ((date: Date) => boolean) | undefined
  /** Extra class names for individual days, e.g. holidays. */
  dayClass?: ((date: Date) => string | null | undefined) | undefined
  /** Overrides `locale.formatDate` for the input text. */
  format?: ((value: GregoryValue, locale: Locale) => string) | undefined
}

export interface ResolvedOptions {
  mode: Mode
  locale: Locale
  min: Date | null
  max: Date | null
  firstDayOfWeek: WeekDay
  months: number
  weekNumbers: boolean
  dropdowns: boolean
  inline: boolean
  autoApply: boolean
  presets: RangePreset[]
  maxSpan: number | null
  timeStep: number
  timeUi: 'select' | 'input'
  /** Minutes since midnight, or null for no bound. */
  minTime: number | null
  maxTime: number | null
  opens: 'left' | 'right' | 'center'
  drops: 'down' | 'up' | 'auto'
  isDisabled: ((date: Date) => boolean) | undefined
  dayClass: ((date: Date) => string | null | undefined) | undefined
  format: ((value: GregoryValue, locale: Locale) => string) | undefined
}

/**
 * Declared as a type alias, not an interface: the emitter is generic over
 * `Record<string, unknown>`, which interfaces do not satisfy structurally.
 */
export type GregoryEvents = {
  /** Fired on every pick; `complete` is false for the first click of a range. */
  change: { value: GregoryValue; complete: boolean }
  /** Fired when the value is committed (Apply, or any pick when `autoApply`). */
  apply: { value: GregoryValue }
  cancel: { value: GregoryValue }
  open: { value: GregoryValue }
  close: { value: GregoryValue }
  'month-change': { year: number; month: number }
}

