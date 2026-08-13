/** Anything Gregory accepts where a date is expected. */
export type DateLike = Date | string | number | null | undefined

export type Mode = 'date' | 'range' | 'datetime' | 'datetime-range' | 'multiple' | 'month' | 'year'

/** Meze času pro jeden den, jak je vrací `GregoryOptions.timeWindow`. */
export interface TimeWindow {
  min?: string | number | null
  max?: string | number | null
}

/** Proč picker hodnotu odmítl. */
export type InvalidReason = 'min' | 'max' | 'disabled' | 'maxSpan' | 'minSpan' | 'unreadable'

/** How a whole week can be picked. See `GregoryOptions.weekSelection`. */
export type WeekSelection = 'off' | 'number' | 'day' | 'both'

/** Day index as used by `Date#getDay()` — 0 = Sunday … 6 = Saturday. */
export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface DateRange {
  from: Date | null
  to: Date | null
}

/** A range on the way in: both ends go through `parseDate()`. */
export interface DateRangeInput {
  from: DateLike
  to: DateLike
}

/** Everything accepted where a range value is expected. */
export type RangeValueInput = DateLike | DateRangeInput | [DateLike, DateLike]

/** Value shape depends on the mode: a single date, a range, or a list. */
export type GregoryValue = Date | DateRange | Date[] | null

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
  /**
   * Rozsah jedním dechem. `Intl` umí vytknout, co mají oba konce společné —
   * „10.–14. 8. 2026" místo dvou plných dat. S časem se konce skládají po
   * staru, aby zůstal jednotný 24hodinový zápis.
   */
  formatRange(from: Date, to: Date, withTime: boolean): string
  /**
   * Opak `formatDate` — přečte, co uživatel do pole napsal. Pořadí dne,
   * měsíce a roku se bere z `Intl`, takže „8/13/2026" projde v en-US a
   * „13. 8. 2026" v češtině. Chybějící měsíc nebo rok se doplní z `reference`,
   * jinak z dneška.
   */
  parseInput(text: string, reference?: Date): Date | null
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
    /** Buttons that drop one end of the range. */
    openStart: string
    openEnd: string
    /** Prefixes for a range that is open at one end: "od 1. 8.", "do 1. 8." */
    since: string
    until: string
    /** Shown by the summary line while nothing is picked. */
    nothingSelected: string
  }
  /** "7 dní" — plural forms differ per language, so the locale owns this. */
  formatDayCount(count: number): string
}

/**
 * A BCP 47 tag, or an override object. `labels` is partial on its own so a
 * caller can rename a single button without restating the rest.
 */
export type LocaleInput = string | (Partial<Omit<Locale, 'labels'>> & { labels?: Partial<Locale['labels']> })

export interface GregoryOptions {
  mode?: Mode
  /**
   * Extra classes for the panel root. The panel is created by the library and
   * a popover lives on `<body>`, so this is the only way to reach it — themes
   * are applied this way: `className: 'gr-theme-riso'`.
   */
  className?: string
  value?: RangeValueInput
  /** BCP 47 tag ("cs", "en-GB") or a partial locale object overriding the resolved one. */
  locale?: LocaleInput
  min?: DateLike
  max?: DateLike
  /** Overrides the locale default (cs → Monday, en-US → Sunday). */
  firstDayOfWeek?: WeekDay
  /** Month panels side by side. Defaults to 2 in range modes, 1 otherwise. */
  months?: number
  /** Page all panels together instead of giving each its own arrows. */
  linkedCalendars?: boolean
  weekNumbers?: boolean
  /**
   * Days spilling in from the neighbouring months. Turning this off leaves the
   * cells empty rather than removing them, so the grid keeps its six rows.
   */
  showOutsideDays?: boolean
  /**
   * Turns the picker into a week picker. `'number'` makes the week numbers
   * clickable (needs `weekNumbers`), `'day'` makes any day select its whole
   * week, `'both'` offers both. Range modes only.
   */
  weekSelection?: WeekSelection
  /**
   * Month and year navigation in the panel header. `true` renders native
   * `<select>`s, `'menu'` keeps the plain caption and opens a list when the
   * month or the year is clicked.
   */
  dropdowns?: boolean | 'menu'
  /**
   * Druhé pole pro konec rozsahu. Cíl konstruktoru pak drží „od", tohle „do";
   * panel otevře kterékoli z nich. Jen v range režimech.
   */
  endInput?: string | HTMLInputElement | null
  /**
   * Čtení data napsaného rukou. Pole se přečte při opuštění nebo Enteru;
   * nesrozumitelný text se vrátí na poslední platnou hodnotu.
   */
  allowTyping?: boolean
  /**
   * Vyrobí skrytá pole s ISO hodnotou, která se odešlou s formulářem — ve
   * viditelném poli je datum pro lidi, což server nepřečte. U rozsahu vzniknou
   * dvě pole; dvojice `{ from, to }` jim dá vlastní jména.
   */
  submitName?: string | { from: string; to: string } | null
  /**
   * Zamkne picker bez ohledu na pole. Panel se neotevře a klikání v něm nic
   * nevybere. Bez tohoto přepínače se stejně chová `disabled` i `readonly`
   * na samotném poli — pole, do kterého uživatel nesmí psát, ale datum si
   * vybrat má, se dělá přes `allowTyping: false`.
   */
  disabled?: boolean
  /** Render the panel in place instead of a popover attached to an input. */
  inline?: boolean
  /** Commit on the last click instead of showing Apply/Cancel. */
  autoApply?: boolean
  /** Sidebar shortcuts. `true` uses the built-in set, `false` hides the sidebar. */
  presets?: RangePreset[] | boolean
  /** Longest selectable range, in days. Ignored outside range modes. */
  maxSpan?: number | null
  /** Nejkratší vybratelný rozsah ve dnech, včetně obou konců. */
  minSpan?: number | null
  /**
   * Rozsah nesmí přeskočit den zakázaný přes `isDisabled`. Druhý klik se pak dá
   * udělat jen po nejbližší blokovaný den, což je chování rezervačních
   * kalendářů. Výchozí `false`: kdo zašedil jen víkendy, chce přes ně dovolenou
   * normálně vybrat.
   */
  stopAtDisabled?: boolean
  /**
   * Lets a range stay open at one end — `{ from, to: null }` means "from this
   * day onwards". Only meaningful in range modes.
   */
  allowOpenRange?: boolean
  /** Nejvíc dnů, které jde vybrat v režimu `multiple`. */
  maxSelected?: number | null
  /** Minutes between selectable times in `datetime*` modes. */
  timeStep?: number
  /** Time controls: two `<select>`s, a native `<input type="time">`, or sliders. */
  timeUi?: 'select' | 'input' | 'slider'
  /** Earliest selectable time of day, `'HH:MM'`. Inclusive. */
  minTime?: string | number | null
  /** Latest selectable time of day, `'HH:MM'`. Inclusive. */
  maxTime?: string | number | null
  /**
   * Časové okno pro konkrétní den — v sobotu se otevírá jindy než v úterý.
   * Co funkce neuvede (`undefined`), zůstává na `minTime`/`maxTime`; `null`
   * naopak mez pro ten den ruší. `null` místo celého okna znamená „nic
   * zvláštního".
   */
  timeWindow?: ((date: Date) => TimeWindow | null | undefined) | undefined
  /**
   * Pod touto šířkou okna se panel místo popoveru otevře přes celou obrazovku
   * i s podkladem. `null` to vypne.
   */
  fullscreenBelow?: number | null
  /** Popover alignment relative to the input. */
  opens?: 'left' | 'right' | 'center'
  drops?: 'down' | 'up' | 'auto'
  /** Return `true` to make a day unselectable. */
  isDisabled?: ((date: Date) => boolean) | undefined
  /** Extra class names for individual days, e.g. holidays. */
  dayClass?: ((date: Date) => string | null | undefined) | undefined
  /**
   * Značka pod číslem dne — tečka, počet, cokoli krátkého. Prázdný řetězec
   * vykreslí jen tečku, což se hodí na „tady něco je" bez čísla.
   */
  dayBadge?: ((date: Date) => string | null | undefined) | undefined
  /** Overrides `locale.formatDate` for the input text. */
  format?: ((value: GregoryValue, locale: Locale) => string) | undefined
  /**
   * Line inside the panel spelling out what is picked right now. `true` uses
   * the built-in wording, a function returns your own.
   */
  summary?: boolean | ((value: GregoryValue, locale: Locale) => string)
}

export interface ResolvedOptions {
  mode: Mode
  className: string
  locale: Locale
  min: Date | null
  max: Date | null
  firstDayOfWeek: WeekDay
  months: number
  linkedCalendars: boolean
  endInput: string | HTMLInputElement | null
  allowTyping: boolean
  submitName: string | { from: string; to: string } | null
  weekNumbers: boolean
  showOutsideDays: boolean
  weekSelection: WeekSelection
  dropdowns: false | 'select' | 'menu'
  disabled: boolean
  inline: boolean
  autoApply: boolean
  presets: RangePreset[]
  maxSpan: number | null
  minSpan: number | null
  stopAtDisabled: boolean
  allowOpenRange: boolean
  maxSelected: number | null
  timeStep: number
  timeUi: 'select' | 'input' | 'slider'
  /** Minutes since midnight, or null for no bound. */
  minTime: number | null
  maxTime: number | null
  timeWindow: ((date: Date) => TimeWindow | null | undefined) | undefined
  fullscreenBelow: number | null
  opens: 'left' | 'right' | 'center'
  drops: 'down' | 'up' | 'auto'
  isDisabled: ((date: Date) => boolean) | undefined
  dayClass: ((date: Date) => string | null | undefined) | undefined
  dayBadge: ((date: Date) => string | null | undefined) | undefined
  format: ((value: GregoryValue, locale: Locale) => string) | undefined
  summary: boolean | ((value: GregoryValue, locale: Locale) => string)
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
  /** Hodnota neprošla omezeními a picker ji nepřijal. */
  invalid: { value: GregoryValue; reason: InvalidReason }
  /** `index` is the panel that moved; 0 when there is only one. */
  'month-change': { year: number; month: number; index: number }
}

