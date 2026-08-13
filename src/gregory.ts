import { buildMonth, isDayDisabled, type MonthContext, type WeekRow } from './core/calendar.js'
import {
  addDays,
  addMonths,
  clampDate,
  compareDay,
  createDate,
  formatISOTime,
  isSameDay,
  parseDate,
  startOfDay,
  startOfWeek,
  today,
  withTimeOf,
} from './core/date.js'
import { Emitter } from './core/emitter.js'
import { resolveLocale } from './core/locale.js'
import { defaultPresets } from './core/presets.js'
import {
  formatTimeOfDay,
  hourOptions,
  minuteOptions,
  minutesOfDay,
  normaliseTimeOfDay,
  parseTimeOfDay,
  withTimeOfDay,
} from './core/time.js'
import type {
  DateLike,
  DateRange,
  GregoryEvents,
  GregoryOptions,
  GregoryValue,
  RangeValueInput,
  ResolvedOptions,
} from './core/types.js'

type Attrs = Record<string, string | number | boolean | null | undefined>

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue
    if (key === 'class') node.className = String(value)
    else if (value === true) node.setAttribute(key, '')
    else node.setAttribute(key, String(value))
  }
  for (const child of children) node.append(child)
  return node
}

function isRangeMode(mode: ResolvedOptions['mode']): boolean {
  return mode === 'range' || mode === 'datetime-range'
}

function hasTime(mode: ResolvedOptions['mode']): boolean {
  return mode === 'datetime' || mode === 'datetime-range'
}

/** First day of the month `date` falls in. */
function monthAnchor(date: Date): Date {
  return createDate(date.getFullYear(), date.getMonth(), 1)
}

/** Whole months from `a` to `b`; negative when `b` is earlier. */
function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
}

/** Parses the time window and tolerates the bounds being handed over swapped. */
function resolveTimeBounds(
  min: GregoryOptions['minTime'],
  max: GregoryOptions['maxTime'],
): { minTime: number | null; maxTime: number | null } {
  const minTime = parseTimeOfDay(min)
  const maxTime = parseTimeOfDay(max)
  if (minTime !== null && maxTime !== null && minTime > maxTime) return { minTime: maxTime, maxTime: minTime }
  return { minTime, maxTime }
}

export class Gregory {
  /** Root node of the panel. Always exists, even while closed. */
  readonly element: HTMLElement

  private readonly emitter = new Emitter<GregoryEvents>()
  private readonly input: HTMLInputElement | null
  /** Druhé pole s koncem rozsahu, když je picker rozdělený do dvou. */
  private readonly endField: HTMLInputElement | null
  /** Které z polí panel otevřelo — podle něj se pozicuje a vrací fokus. */
  private activeInput: HTMLInputElement | null = null
  private readonly host: HTMLElement
  private options: ResolvedOptions

  /** Working selection, not yet committed in Apply/Cancel mode. */
  private selection: DateRange = { from: null, to: null }
  /** Last committed value, restored on Cancel. */
  private committed: DateRange = { from: null, to: null }
  /** One month anchor per visible panel, always kept in ascending order. */
  private views: Date[] = [today()]
  private preview: Date | null = null
  /** Whole week under the cursor, used by the week-picking modes. */
  private previewWeek: DateRange | null = null
  /** Which caption list is unrolled, if any. */
  private openMenu: { kind: 'month' | 'year'; index: number } | null = null
  /** `panelIndex:iso` → day button, so hover can restyle without rebuilding. */
  private dayCells = new Map<string, HTMLButtonElement>()
  private focusedDay: Date = today()
  private open = false
  private destroyed = false
  /** Guards the focus → open handler while we return focus programmatically. */
  private suppressReopen = false

  constructor(target: string | HTMLElement, options: GregoryOptions = {}) {
    const element = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target
    if (!element) throw new Error(`Gregory: target "${String(target)}" was not found`)

    this.input = element instanceof HTMLInputElement ? element : null
    this.host = element
    this.options = this.resolveOptions(options)
    this.endField = this.resolveEndField()
    this.element = h('div', {})
    this.applyRootAttributes()

    // Rozdělený picker si počáteční hodnotu přečte z obou polí.
    const fromFields = this.endField
      ? ([this.input?.value || null, this.endField.value || null] as [DateLike, DateLike])
      : this.input?.value || null
    this.assign(this.toRange(options.value ?? fromFields), { commit: true, silent: true })

    if (this.options.inline) {
      this.host.append(this.element)
      this.open = true
    } else {
      this.element.hidden = true
      document.body.append(this.element)
    }

    this.bindHost()
    this.element.addEventListener('click', this.onPanelClick)
    this.element.addEventListener('change', this.onPanelChange)
    this.element.addEventListener('input', this.onPanelInput)
    this.element.addEventListener('mouseover', this.onPanelHover)
    this.element.addEventListener('keydown', this.onPanelKeydown)
    this.render()
  }

  // ---------------------------------------------------------------- options

  private resolveOptions(options: GregoryOptions): ResolvedOptions {
    const mode = options.mode ?? 'date'
    const locale = resolveLocale(options.locale)
    const presets =
      options.presets === false || (options.presets === undefined && !isRangeMode(mode))
        ? []
        : options.presets === true || options.presets === undefined
          ? defaultPresets(locale)
          : options.presets

    return {
      mode,
      className: options.className ?? '',
      locale,
      min: parseDate(options.min),
      max: parseDate(options.max),
      firstDayOfWeek: options.firstDayOfWeek ?? locale.firstDayOfWeek,
      months: options.months ?? (isRangeMode(mode) ? 2 : 1),
      linkedCalendars: options.linkedCalendars ?? false,
      endInput: options.endInput ?? null,
      weekNumbers: options.weekNumbers ?? false,
      showOutsideDays: options.showOutsideDays ?? true,
      weekSelection: options.weekSelection ?? 'off',
      dropdowns: options.dropdowns === true ? 'select' : (options.dropdowns ?? false),
      inline: options.inline ?? false,
      // Only a plain date is complete on the first click. A range still needs its
      // second bound and a datetime still needs its time, so both keep Apply.
      autoApply: options.autoApply ?? mode === 'date',
      presets,
      maxSpan: options.maxSpan ?? null,
      allowOpenRange: options.allowOpenRange ?? false,
      timeStep: options.timeStep ?? 5,
      timeUi: options.timeUi ?? 'select',
      ...resolveTimeBounds(options.minTime, options.maxTime),
      opens: options.opens ?? 'right',
      drops: options.drops ?? 'auto',
      isDisabled: options.isDisabled,
      dayClass: options.dayClass,
      format: options.format,
      summary: options.summary ?? false,
    }
  }

  setOptions(patch: GregoryOptions): void {
    this.options = this.resolveOptions({ ...this.optionsAsInput(), ...patch })
    this.applyRootAttributes()
    if (patch.value !== undefined) this.assign(this.toRange(patch.value), { commit: true, silent: true })
    this.render()
  }

  /** Classes and flags on the panel root, kept in sync with the options. */
  private applyRootAttributes(): void {
    const { className, mode, inline } = this.options
    this.element.className = className ? `gr ${className}` : 'gr'
    this.element.setAttribute('data-mode', mode)
    // The constructor sets these later on first run; afterwards they must stick.
    if (inline) this.element.setAttribute('data-inline', '')
    else this.element.setAttribute('data-popover', '')
  }

  /** Druhé pole dává smysl jen u rozsahu a jen když picker visí na inputu. */
  private resolveEndField(): HTMLInputElement | null {
    const { endInput, mode, inline } = this.options
    if (!endInput || inline || !this.input || !isRangeMode(mode)) return null
    const element = typeof endInput === 'string' ? document.querySelector(endInput) : endInput
    return element instanceof HTMLInputElement ? element : null
  }

  private optionsAsInput(): GregoryOptions {
    const { locale, presets, dropdowns, ...rest } = this.options
    // `'select'` is the resolved form of the input value `true`.
    return { ...rest, locale, presets, dropdowns: dropdowns === 'select' ? true : dropdowns }
  }

  // ------------------------------------------------------------------ value

  private toRange(value: RangeValueInput): DateRange {
    if (value === null || value === undefined || value === '') return { from: null, to: null }
    if (Array.isArray(value)) return { from: parseDate(value[0]), to: parseDate(value[1]) }
    if (typeof value === 'object' && !(value instanceof Date)) {
      return { from: parseDate(value.from), to: parseDate(value.to) }
    }

    const single = typeof value === 'string' && value.includes('/') ? value.split('/') : null
    if (single && isRangeMode(this.options.mode)) {
      return { from: parseDate(single[0]), to: parseDate(single[1]) }
    }
    const parsed = parseDate(value)
    return { from: parsed, to: isRangeMode(this.options.mode) ? null : parsed }
  }

  /** Shapes a range as the public value: a `Date` in single modes. */
  private valueOf(range: DateRange): GregoryValue {
    if (isRangeMode(this.options.mode)) return { ...range }
    return range.from ? new Date(range.from.getTime()) : null
  }

  /** The committed value: a `Date` in single modes, a `DateRange` in range modes. */
  getValue(): GregoryValue {
    return this.valueOf(this.committed)
  }

  /** What `change` reports — the working selection, committed or not. */
  private selectedValue(): GregoryValue {
    return this.valueOf(this.selection)
  }

  /** The in-progress selection, which may be half-finished in range modes. */
  getSelection(): DateRange {
    return { ...this.selection }
  }

  setValue(value: RangeValueInput, { silent = false } = {}): void {
    this.assign(this.toRange(value), { commit: true, silent })
    this.render()
  }

  clear({ silent = false } = {}): void {
    this.assign({ from: null, to: null }, { commit: true, silent })
    this.render()
  }

  private assign(range: DateRange, { commit = false, silent = false } = {}): void {
    this.selection = range
    // An open range may only know its end, so fall back to whichever bound exists.
    const anchor = range.from ?? range.to
    if (anchor) {
      this.resetViews(anchor)
      this.focusedDay = anchor
    }
    if (commit) {
      this.committed = { ...range }
      this.syncInput()
    }
    if (!silent) {
      this.emitter.emit('change', { value: this.selectedValue(), complete: this.isFullyPicked() })
      if (commit) this.emitter.emit('apply', { value: this.getValue() })
    }
  }

  /**
   * Whether Apply may be pressed. One end is enough even in a range: without
   * `allowOpenRange` it commits as a single-day range, with it as an open one.
   * Demanding two clicks for a one-day range only looked like the picker was
   * refusing to work.
   */
  private isCommittable(): boolean {
    const { from, to } = this.selection
    if (!isRangeMode(this.options.mode)) return from !== null
    return from !== null || to !== null
  }

  /**
   * The selection as it would be stored. A closed range with only one end picked
   * collapses to that single day; an open range keeps the missing end null.
   */
  private normalisedSelection(): DateRange {
    const { from, to } = this.selection
    if (!isRangeMode(this.options.mode) || this.options.allowOpenRange) return { from, to }
    if (from && !to) return { from, to: new Date(from.getTime()) }
    if (!from && to) return { from: new Date(to.getTime()), to }
    return { from, to }
  }

  /** Both ends picked — the only case where autoApply may close the panel. */
  private isFullyPicked(): boolean {
    if (!isRangeMode(this.options.mode)) return this.selection.from !== null
    return this.selection.from !== null && this.selection.to !== null
  }

  formatValue(): string {
    const { locale, format, mode } = this.options
    if (format) return format(this.getValue(), locale) ?? ''

    const { from, to } = this.committed
    const time = hasTime(mode)

    if (!isRangeMode(mode)) return from ? locale.formatDate(from, time) : ''
    // A range open at one end reads as "od 1. 8." / "do 1. 8.".
    if (!from) return to ? `${locale.labels.until} ${locale.formatDate(to, time)}` : ''
    if (!to) {
      return this.options.allowOpenRange
        ? `${locale.labels.since} ${locale.formatDate(from, time)}`
        : locale.formatDate(from, time)
    }
    return `${locale.formatDate(from, time)}${locale.rangeSeparator}${locale.formatDate(to, time)}`
  }

  private syncInput(): void {
    if (!this.input) return

    if (this.endField) {
      // Rozdělený picker: každé pole dostane svůj konec, ne celý rozsah.
      const { locale, mode, format } = this.options
      const time = hasTime(mode)
      const text = (date: Date | null): string =>
        date ? (format ? (format(date, locale) ?? '') : locale.formatDate(date, time)) : ''
      this.writeField(this.input, text(this.committed.from))
      this.writeField(this.endField, text(this.committed.to))
      return
    }

    this.writeField(this.input, this.formatValue())
  }

  private writeField(field: HTMLInputElement, value: string): void {
    field.value = value
    field.dispatchEvent(new Event('input', { bubbles: true }))
    field.dispatchEvent(new Event('change', { bubbles: true }))
  }

  // ----------------------------------------------------------- open / close

  toggle(): void {
    if (this.open) this.close()
    else this.openPanel()
  }

  openPanel(): void {
    if (this.open || this.destroyed || this.options.inline) return
    this.open = true
    this.element.hidden = false
    this.selection = { ...this.committed }
    const anchor = this.committed.from ?? this.committed.to
    if (anchor) this.resetViews(anchor)
    this.render()
    this.position()
    document.addEventListener('mousedown', this.onDocumentDown, true)
    document.addEventListener('keydown', this.onDocumentKeydown, true)
    this.emitter.emit('open', { value: this.getValue() })
  }

  close(): void {
    if (!this.open || this.options.inline) return
    this.open = false
    this.element.hidden = true
    this.preview = null
    this.previewWeek = null
    this.openMenu = null
    document.removeEventListener('mousedown', this.onDocumentDown, true)
    document.removeEventListener('keydown', this.onDocumentKeydown, true)
    this.emitter.emit('close', { value: this.getValue() })
  }

  apply(): void {
    this.selection = this.normalisedSelection()
    this.committed = { ...this.selection }
    this.syncInput()
    this.emitter.emit('apply', { value: this.getValue() })
    this.close()
    this.render()
  }

  cancel(): void {
    this.selection = { ...this.committed }
    this.preview = null
    this.emitter.emit('cancel', { value: this.getValue() })
    this.close()
    this.render()
  }

  /** Scrolls the panel so that `date` is the first visible month. */
  goTo(date: DateLike): void {
    const parsed = parseDate(date)
    if (!parsed) return
    this.resetViews(parsed)
    this.emitter.emit('month-change', { year: parsed.getFullYear(), month: parsed.getMonth(), index: 0 })
    this.render()
  }

  private position(): void {
    // Panel se pověsí pod to pole, kterým se otevřel.
    const anchor = this.activeInput ?? this.input
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const panel = this.element.getBoundingClientRect()
    const gap = 4

    let top = rect.bottom + window.scrollY + gap
    const dropsUp =
      this.options.drops === 'up' ||
      (this.options.drops === 'auto' && rect.bottom + panel.height + gap > window.innerHeight && rect.top > panel.height)
    if (dropsUp) top = rect.top + window.scrollY - panel.height - gap

    let left = rect.left + window.scrollX
    if (this.options.opens === 'left') left = rect.right + window.scrollX - panel.width
    else if (this.options.opens === 'center') left = rect.left + window.scrollX + (rect.width - panel.width) / 2

    this.element.style.top = `${Math.round(top)}px`
    this.element.style.left = `${Math.round(Math.max(gap, left))}px`
  }

  // ----------------------------------------------------------------- events

  on = <K extends keyof GregoryEvents>(event: K, listener: (payload: GregoryEvents[K]) => void): (() => void) =>
    this.emitter.on(event, listener)

  off = <K extends keyof GregoryEvents>(event: K, listener: (payload: GregoryEvents[K]) => void): void =>
    this.emitter.off(event, listener)

  once = <K extends keyof GregoryEvents>(event: K, listener: (payload: GregoryEvents[K]) => void): (() => void) =>
    this.emitter.once(event, listener)

  private bindHost(): void {
    if (this.options.inline || !this.input) return
    for (const field of this.fields()) {
      field.addEventListener('focus', this.onInputFocus)
      field.addEventListener('click', this.onInputFocus)
      field.addEventListener('keydown', this.onInputKeydown)
    }
  }

  /** Pole, na kterých picker visí — jedno, nebo dvojice od/do. */
  private fields(): HTMLInputElement[] {
    return [this.input, this.endField].filter((field): field is HTMLInputElement => field !== null)
  }

  private onInputFocus = (event: Event): void => {
    if (this.suppressReopen) return
    const field = event.currentTarget
    if (field instanceof HTMLInputElement) this.activeInput = field
    this.openPanel()
  }

  /**
   * Returns focus to the input after Escape or Cancel. Plain `focus()` would
   * bounce off the focus handler and re-open the panel we just closed.
   */
  private returnFocus(): void {
    const field = this.activeInput ?? this.input
    if (!field) return
    this.suppressReopen = true
    field.focus()
    this.suppressReopen = false
  }

  private onInputKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowDown' || event.key === 'Enter') {
      event.preventDefault()
      this.openPanel()
      this.focusGrid()
    }
  }

  private onDocumentDown = (event: MouseEvent): void => {
    const target = event.target as Node | null
    if (!target) return
    if (this.element.contains(target)) return
    if (this.fields().some((field) => field === target || field.contains(target))) return
    // Clicking away keeps an auto-applied value but discards an uncommitted one.
    if (this.options.autoApply) this.close()
    else this.cancel()
  }

  private onDocumentKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return
    event.stopPropagation()

    // Escape closes the caption list first, the whole panel only after that.
    if (this.openMenu) {
      this.openMenu = null
      this.render()
      return
    }
    this.cancel()
    this.returnFocus()
  }

  private onPanelClick = (event: MouseEvent): void => {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-action]')

    // Any click that is not on the open list itself puts it away again.
    if (this.openMenu && !target?.dataset.action?.startsWith('menu-')) {
      this.openMenu = null
      this.render()
      if (!target) return
    }
    if (!target) return
    event.preventDefault()

    const { action, value } = target.dataset
    const panel = Number(target.dataset.index ?? 0)
    switch (action) {
      case 'menu-month':
      case 'menu-year': {
        const kind = action === 'menu-month' ? 'month' : 'year'
        this.openMenu = this.isMenuOpen(kind, panel) ? null : { kind, index: panel }
        this.render()
        break
      }
      case 'menu-pick-month': {
        const view = this.views[panel]
        this.openMenu = null
        if (view) this.shiftMonth(panel, Number(value) - view.getMonth())
        else this.render()
        break
      }
      case 'menu-pick-year': {
        const view = this.views[panel]
        this.openMenu = null
        if (view) this.shiftMonth(panel, (Number(value) - view.getFullYear()) * 12)
        else this.render()
        break
      }
      case 'prev':
        this.shiftMonth(Number(target.dataset.index ?? 0), -1)
        break
      case 'next':
        this.shiftMonth(Number(target.dataset.index ?? 0), 1)
        break
      case 'day':
        this.pick(parseDate(value ?? null))
        break
      case 'week':
        this.pickWeek(parseDate(value ?? null))
        break
      case 'preset': {
        const preset = this.options.presets[Number(value)]
        if (!preset) break
        const [from, to] = preset.range()
        this.assign({ from: parseDate(from), to: parseDate(to) }, { commit: this.options.autoApply })
        if (this.options.autoApply) this.close()
        this.render()
        break
      }
      case 'open-start':
        this.openRange('start')
        break
      case 'open-end':
        this.openRange('end')
        break
      case 'today': {
        // Doskočí na dnešek a rovnou ho vybere — stejně, jako by se kliklo
        // na jeho buňku. Když je dnešek mimo min/max, jen se tam přesune.
        const now = today()
        this.goTo(now)
        this.pick(now)
        break
      }
      case 'clear':
        this.clear()
        this.close()
        break
      case 'apply':
        this.apply()
        break
      case 'cancel':
        this.cancel()
        break
      default:
        break
    }
  }

  /** Live handling of the time sliders while they are being dragged. */
  private onPanelInput = (event: Event): void => {
    const target = event.target as HTMLInputElement | null
    const action = target?.dataset.action
    if (!target || !action?.startsWith('slider-')) return

    const [, unit, bound] = action.split('-') as ['slider', 'hour' | 'minute', 'from' | 'to']
    const current = this.selection[bound]
    if (!current) return

    const picked = Number(target.value)
    const minutes = unit === 'hour' ? picked * 60 + current.getMinutes() : current.getHours() * 60 + picked

    this.setTimeOfDay(bound, minutes)
    this.syncTimeSliders(bound)
    this.refreshSummary()
  }

  /** Keeps the summary line current without rebuilding the panel. */
  private refreshSummary(): void {
    const line = this.element.querySelector<HTMLElement>('.gr-summary')
    if (line) line.textContent = this.summaryText()
  }

  private onPanelChange = (event: Event): void => {
    const target = event.target as HTMLSelectElement | HTMLInputElement | null
    const action = target?.dataset.action
    if (!target || !action) return

    switch (action) {
      // The dropdowns go through shiftMonth, so linking and ordering behave
      // exactly the same as when the arrows are used.
      case 'select-month': {
        const index = Number(target.dataset.index ?? 0)
        const view = this.views[index]
        if (view) this.shiftMonth(index, Number(target.value) - view.getMonth())
        break
      }
      case 'select-year': {
        const index = Number(target.dataset.index ?? 0)
        const view = this.views[index]
        if (view) this.shiftMonth(index, (Number(target.value) - view.getFullYear()) * 12)
        break
      }
      case 'time-from':
      case 'time-to': {
        const bound = action === 'time-from' ? 'from' : 'to'
        const minutes = parseTimeOfDay(target.value)
        if (minutes === null) break
        this.setTimeOfDay(bound, minutes)
        break
      }
      case 'hour-from':
      case 'hour-to':
      case 'minute-from':
      case 'minute-to': {
        const [unit, side] = action.split('-') as ['hour' | 'minute', 'from' | 'to']
        const current = this.selection[side]
        if (!current) break

        const picked = Number(target.value)
        const minutes =
          unit === 'hour' ? picked * 60 + current.getMinutes() : current.getHours() * 60 + picked

        // Re-render, because switching to a boundary hour narrows the minutes.
        this.setTimeOfDay(side, minutes, { rerender: true })
        this.element.querySelector<HTMLSelectElement>(`[data-action="${action}"]`)?.focus()
        break
      }
      default:
        break
    }
  }

  private onPanelHover = (event: MouseEvent): void => {
    if (!isRangeMode(this.options.mode)) return
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(
      '[data-action="day"], [data-action="week"]',
    )
    const hovered = target ? parseDate(target.dataset.value ?? null) : null

    // Week pickers preview the whole row, whatever is already selected.
    const asWeek = target?.dataset.action === 'week' || this.daysPickWeeks()
    if (asWeek) {
      const start = hovered ? (target?.dataset.action === 'week' ? hovered : this.weekStartOf(hovered)) : null
      const next = start ? this.weekRange(start) : null
      if (isSameDay(next?.from ?? null, this.previewWeek?.from ?? null)) return
      this.previewWeek = next
      this.refreshDayStates()
      return
    }

    if (!this.selection.from || this.selection.to) return
    if (isSameDay(hovered, this.preview)) return
    if (hovered === null && this.preview === null) return

    this.preview = hovered
    // Only restyle. A full re-render would swap out the node under the cursor,
    // and a click whose mousedown and mouseup land on different nodes is lost.
    this.refreshDayStates()
  }

  /** Re-applies the range classes to the existing day buttons. */
  private refreshDayStates(): void {
    const context = this.monthContext()
    this.views.forEach((anchor, index) => {
      const view = buildMonth(anchor.getFullYear(), anchor.getMonth(), context)
      for (const week of view.weeks) {
        for (const cellData of week.days) {
          const cell = this.dayCells.get(`${index}:${cellData.iso}`)
          if (!cell) continue
          cell.classList.toggle('is-selected', cellData.selected)
          cell.classList.toggle('is-in-range', cellData.inRange)
          cell.classList.toggle('is-start', cellData.rangeStart)
          cell.classList.toggle('is-end', cellData.rangeEnd)
          cell.disabled = cellData.disabled
          cell.setAttribute('aria-selected', String(cellData.selected))
        }
      }
    })
  }

  private onPanelKeydown = (event: KeyboardEvent): void => {
    const step = KEY_STEPS[event.key]
    if (step === undefined) {
      if (event.key === 'Enter' || event.key === ' ') {
        const day = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-action="day"]')
        if (!day) return
        event.preventDefault()
        this.pick(parseDate(day.dataset.value ?? null))
      }
      return
    }

    event.preventDefault()
    const next =
      typeof step === 'number' ? addDays(this.focusedDay, step) : addMonths(this.focusedDay, step.months)
    this.focusedDay = clampDate(next, this.options.min, this.options.max)
    this.ensureVisible(this.focusedDay)
    this.render()
    this.focusGrid()
  }

  private firstView(): Date {
    return this.views[0] ?? monthAnchor(today())
  }

  private lastView(): Date {
    return this.views[this.views.length - 1] ?? this.firstView()
  }

  /** Rebuilds every panel as consecutive months starting at `first`. */
  private resetViews(first: Date): void {
    const anchor = monthAnchor(first)
    this.views = Array.from({ length: Math.max(1, this.options.months) }, (_, index) => addMonths(anchor, index))
  }

  /** Slides all panels by the same amount, keeping any gaps between them. */
  private shiftAllViews(amount: number): void {
    if (amount === 0) return
    this.views = this.views.map((view) => addMonths(view, amount))
  }

  /** Scrolls the panels just far enough for `date` to be on screen. */
  private ensureVisible(date: Date): void {
    const anchor = monthAnchor(date)
    const before = monthsBetween(this.firstView(), anchor)
    const after = monthsBetween(this.lastView(), anchor)
    if (before < 0) this.shiftAllViews(before)
    else if (after > 0) this.shiftAllViews(after)
  }

  /**
   * Keeps the panels in ascending order after panel `index` has moved. The
   * neighbours are pushed by the smallest amount that restores the order, so a
   * pair of adjacent months moves as one while a deliberate gap survives.
   */
  private enforceViewOrder(index: number): void {
    for (let i = index + 1; i < this.views.length; i += 1) {
      const floor = addMonths(this.views[i - 1]!, 1)
      if (compareDay(this.views[i]!, floor) < 0) this.views[i] = floor
    }
    for (let i = index - 1; i >= 0; i -= 1) {
      const ceiling = addMonths(this.views[i + 1]!, -1)
      if (compareDay(this.views[i]!, ceiling) > 0) this.views[i] = ceiling
    }
  }

  private focusGrid(): void {
    const iso = this.focusedDay
    const selector = `[data-action="day"][data-value="${iso.getFullYear()}-${String(iso.getMonth() + 1).padStart(2, '0')}-${String(iso.getDate()).padStart(2, '0')}"]`
    this.element.querySelector<HTMLButtonElement>(selector)?.focus()
  }

  /**
   * Pages one panel. With `linkedCalendars` every panel moves together;
   * otherwise only this one moves and its neighbours give way as needed.
   */
  private shiftMonth(index: number, amount: number): void {
    const view = this.views[index]
    if (!view || amount === 0) return

    if (this.options.linkedCalendars) {
      this.shiftAllViews(amount)
    } else {
      this.views[index] = addMonths(view, amount)
      this.enforceViewOrder(index)
    }

    const moved = this.views[index]!
    this.emitter.emit('month-change', { year: moved.getFullYear(), month: moved.getMonth(), index })
    this.render()
  }

  /**
   * Time carried over to a freshly picked day. An existing bound keeps its own
   * time; a new one starts at the beginning of the allowed window.
   */
  private timeFor(bound: Date | null): Date | null {
    if (!hasTime(this.options.mode)) return bound
    const { timeStep, minTime, maxTime } = this.options
    const minutes = normaliseTimeOfDay(bound ? minutesOfDay(bound) : (minTime ?? 0), timeStep, minTime, maxTime)
    return withTimeOfDay(bound ?? today(), minutes)
  }

  /** Writes a time of day onto one range bound, snapped into the allowed window. */
  private setTimeOfDay(bound: 'from' | 'to', minutes: number, { rerender = false } = {}): void {
    const current = this.selection[bound]
    if (!current) return

    const { timeStep, minTime, maxTime } = this.options
    const normalised = normaliseTimeOfDay(minutes, timeStep, minTime, maxTime)
    const next: DateRange = { ...this.selection, [bound]: withTimeOfDay(current, normalised) }

    // A one-day range must not end before it starts; the untouched bound follows.
    if (next.from && next.to && next.from.getTime() > next.to.getTime()) {
      if (bound === 'from') next.to = withTimeOfDay(next.to, normalised)
      else next.from = withTimeOfDay(next.from, normalised)
    }
    this.selection = next

    if (this.options.autoApply) {
      this.committed = { ...this.selection }
      this.syncInput()
    }
    this.emitter.emit('change', { value: this.selectedValue(), complete: this.isFullyPicked() })
    if (rerender) this.render()
  }

  private pick(date: Date | null): void {
    if (!date || isDayDisabled(date, this.monthContext())) return
    if (this.daysPickWeeks()) {
      this.pickWeek(this.weekStartOf(date))
      return
    }

    if (!isRangeMode(this.options.mode)) {
      this.selection = { from: withTimeOf(date, this.timeFor(this.selection.from)), to: null }
    } else if (!this.selection.from || this.selection.to) {
      this.selection = { from: withTimeOf(date, this.timeFor(this.selection.from)), to: null }
    } else if (compareDay(date, this.selection.from) < 0) {
      this.selection = { from: withTimeOf(date, this.timeFor(this.selection.from)), to: this.selection.from }
    } else {
      this.selection = { ...this.selection, to: withTimeOf(date, this.timeFor(this.selection.to)) }
    }

    this.focusedDay = date
    this.preview = null

    // Auto-apply needs both ends. With allowOpenRange the first click already
    // counts as complete, but closing there would deny the second one.
    const settled = this.isFullyPicked() && this.options.autoApply
    if (settled) {
      this.committed = { ...this.selection }
      this.syncInput()
    }

    this.emitter.emit('change', { value: this.selectedValue(), complete: this.isFullyPicked() })
    if (settled) {
      this.emitter.emit('apply', { value: this.getValue() })
      this.render()
      this.close()
      return
    }
    this.render()
  }

  /**
   * Selects a whole week as a range. `start` is the first day of the row the
   * user clicked, so it follows `firstDayOfWeek` rather than the ISO week.
   */
  private pickWeek(start: Date | null): void {
    if (!start || !isRangeMode(this.options.mode)) return
    const week = this.weekRange(start)
    if (!week) return

    this.selection = {
      from: withTimeOf(week.from!, this.timeFor(this.selection.from)),
      to: withTimeOf(week.to!, this.timeFor(this.selection.to)),
    }
    this.focusedDay = week.from!
    this.preview = null
    this.previewWeek = null

    if (this.options.autoApply) {
      this.committed = { ...this.selection }
      this.syncInput()
    }
    this.emitter.emit('change', { value: this.selectedValue(), complete: this.isFullyPicked() })

    if (this.options.autoApply) {
      this.emitter.emit('apply', { value: this.getValue() })
      this.render()
      this.close()
      return
    }
    this.render()
  }

  /** Week numbers act as buttons. */
  private weekNumbersPickable(): boolean {
    const { weekSelection, weekNumbers, mode } = this.options
    return (weekSelection === 'number' || weekSelection === 'both') && weekNumbers && isRangeMode(mode)
  }

  /** A click on any day picks that day's whole week. */
  private daysPickWeeks(): boolean {
    const { weekSelection, mode } = this.options
    return (weekSelection === 'day' || weekSelection === 'both') && isRangeMode(mode)
  }

  /** The selectable span of the week starting at `start`, or null if unusable. */
  private weekRange(start: Date): DateRange | null {
    const { min, max, maxSpan, isDisabled } = this.options

    // A week is 7 days; a shorter maxSpan makes the whole gesture impossible.
    if (maxSpan !== null && maxSpan < 7) return null

    // Clip to min/max so a partially available week still selects its usable part.
    const first = clampDate(start, min, max)
    const last = clampDate(addDays(start, 6), min, max)
    if (compareDay(first, last) > 0) return null
    if (isDisabled?.(first) && isDisabled(last)) return null
    return { from: first, to: last }
  }

  /** First day of the row a date sits in, honouring `firstDayOfWeek`. */
  private weekStartOf(date: Date): Date {
    return startOfWeek(date, this.options.firstDayOfWeek)
  }

  /** Drops one end of the range, keeping the other one whichever side it sits on. */
  private openRange(side: 'start' | 'end'): void {
    const { from, to } = this.selection
    const known = side === 'start' ? (to ?? from) : (from ?? to)
    if (!known) return

    this.selection = side === 'start' ? { from: null, to: known } : { from: known, to: null }
    if (this.options.autoApply) {
      this.committed = { ...this.selection }
      this.syncInput()
    }
    this.emitter.emit('change', { value: this.selectedValue(), complete: this.isFullyPicked() })
    this.render()
  }

  // ----------------------------------------------------------------- render

  private monthContext(): MonthContext {
    return {
      locale: this.options.locale,
      firstDayOfWeek: this.options.firstDayOfWeek,
      selection: this.selection,
      preview: this.preview,
      min: this.options.min,
      max: this.options.max,
      maxSpan: isRangeMode(this.options.mode) ? this.options.maxSpan : null,
      openEnded: isRangeMode(this.options.mode) && this.options.allowOpenRange,
      previewRange: this.previewWeek,
      isDisabled: this.options.isDisabled,
      dayClass: this.options.dayClass,
    }
  }

  private render(): void {
    if (this.destroyed) return
    const { locale, months, presets, weekNumbers, dropdowns, linkedCalendars, showOutsideDays } = this.options
    const context = this.monthContext()

    // Panel count can change through setOptions; keep the anchors in step.
    if (this.views.length !== months) this.resetViews(this.firstView())

    this.dayCells.clear()
    const calendars = h('div', { class: 'gr-calendars' })
    for (let offset = 0; offset < months; offset += 1) {
      const anchor = this.views[offset] ?? addMonths(this.firstView(), offset)
      const view = buildMonth(anchor.getFullYear(), anchor.getMonth(), context)
      const head = h('header', { class: 'gr-head' })

      // Linked panels share one pair of arrows; independent ones get their own.
      const showPrev = linkedCalendars ? offset === 0 : true
      const showNext = linkedCalendars ? offset === months - 1 : true
      const arrow = (direction: 'prev' | 'next'): HTMLElement =>
        h(
          'button',
          {
            type: 'button',
            class: 'gr-nav',
            'data-action': direction,
            'data-index': offset,
            'aria-label': direction === 'prev' ? locale.labels.previousMonth : locale.labels.nextMonth,
          },
          [direction === 'prev' ? '‹' : '›'],
        )

      head.append(
        showPrev ? arrow('prev') : h('span', { class: 'gr-nav gr-nav-placeholder', 'aria-hidden': 'true' }),
        dropdowns === 'select'
          ? this.renderDropdowns(anchor, offset)
          : dropdowns === 'menu'
            ? this.renderCaptionButtons(anchor, offset)
            : h('div', { class: 'gr-caption' }, [view.label]),
        showNext ? arrow('next') : h('span', { class: 'gr-nav gr-nav-placeholder', 'aria-hidden': 'true' }),
      )

      const grid = h('div', { class: 'gr-grid', role: 'grid', 'data-weeknumbers': weekNumbers })
      if (weekNumbers) grid.append(h('div', { class: 'gr-weekday gr-weeknum', title: locale.labels.weekNumber }, ['#']))
      for (const name of view.weekdays) grid.append(h('div', { class: 'gr-weekday', role: 'columnheader' }, [name]))

      for (const week of view.weeks) {
        if (weekNumbers) grid.append(this.renderWeekNumber(week))
        for (const day of week.days) {
          // The cell stays, only its contents go — otherwise the grid would
          // lose rows and the panel would change height between months.
          if (day.outside && !showOutsideDays) {
            grid.append(h('div', { class: 'gr-day gr-day-empty', 'aria-hidden': 'true' }))
            continue
          }

          const classes = ['gr-day']
          if (day.outside) classes.push('is-outside')
          if (day.isToday) classes.push('is-today')
          if (day.selected) classes.push('is-selected')
          if (day.inRange) classes.push('is-in-range')
          if (day.rangeStart) classes.push('is-start')
          if (day.rangeEnd) classes.push('is-end')
          if (day.weekend) classes.push('is-weekend')
          if (day.extraClass) classes.push(day.extraClass)

          const cell = h(
            'button',
            {
              type: 'button',
              class: classes.join(' '),
              'data-action': 'day',
              'data-value': day.iso,
              disabled: day.disabled,
              'aria-selected': String(day.selected),
              tabindex: isSameDay(day.date, this.focusedDay) && !day.outside ? 0 : -1,
            },
            [String(day.date.getDate())],
          )
          this.dayCells.set(`${offset}:${day.iso}`, cell)
          grid.append(cell)
        }
      }

      const section = h('section', { class: 'gr-calendar' }, [head, grid])
      const menu = dropdowns === 'menu' ? this.renderMenu(anchor, offset) : null
      if (menu) section.append(menu)
      calendars.append(section)
    }

    const body = h('div', { class: 'gr-body' }, [calendars])
    const summary = this.renderSummary()
    if (summary) body.append(summary)
    const footer = this.renderFooter()
    if (footer) body.append(footer)

    const children: HTMLElement[] = []
    if (presets.length) {
      const aside = h('aside', { class: 'gr-presets' })
      presets.forEach((preset, index) => {
        aside.append(
          h('button', { type: 'button', class: 'gr-preset', 'data-action': 'preset', 'data-value': index }, [preset.label]),
        )
      })
      children.push(aside)
    }
    children.push(body)

    this.element.replaceChildren(...children)
    if (this.open && !this.options.inline) this.position()
    // A year list can be long; start it on the year that is showing.
    this.element.querySelector('.gr-menu-item.is-current')?.scrollIntoView({ block: 'nearest' })
  }

  private renderWeekNumber(week: WeekRow): HTMLElement {
    const label = String(week.weekNumber)
    if (!this.weekNumbersPickable()) return h('div', { class: 'gr-weeknum' }, [label])

    // The row's own first day, so the selection follows firstDayOfWeek.
    return h(
      'button',
      {
        type: 'button',
        class: 'gr-weeknum gr-weeknum-button',
        'data-action': 'week',
        'data-value': week.days[0]?.iso,
        'aria-label': `${this.options.locale.labels.weekNumber} ${label}`,
        tabindex: -1,
      },
      [label],
    )
  }

  /** Caption whose month and year open a list instead of being a `<select>`. */
  private renderCaptionButtons(anchor: Date, panelIndex: number): HTMLElement {
    const { locale } = this.options
    const caption = h('div', { class: 'gr-caption gr-caption-menu' })
    const monthName = locale.monthNames()[anchor.getMonth()] ?? ''

    const trigger = (kind: 'month' | 'year', label: string): HTMLElement =>
      h(
        'button',
        {
          type: 'button',
          class: 'gr-caption-btn',
          'data-action': kind === 'month' ? 'menu-month' : 'menu-year',
          'data-index': panelIndex,
          'aria-haspopup': 'listbox',
          'aria-expanded': this.isMenuOpen(kind, panelIndex) ? 'true' : 'false',
        },
        [label],
      )

    caption.append(trigger('month', monthName), trigger('year', String(anchor.getFullYear())))
    return caption
  }

  private isMenuOpen(kind: 'month' | 'year', panelIndex: number): boolean {
    return this.openMenu?.kind === kind && this.openMenu.index === panelIndex
  }

  /** The list that drops out of the caption. */
  private renderMenu(anchor: Date, panelIndex: number): HTMLElement | null {
    if (!this.openMenu || this.openMenu.index !== panelIndex) return null
    const { locale, min, max } = this.options
    const { kind } = this.openMenu

    const menu = h('div', { class: 'gr-menu', role: 'listbox', 'data-kind': kind })
    const item = (value: number, label: string, current: boolean): HTMLElement =>
      h(
        'button',
        {
          type: 'button',
          class: current ? 'gr-menu-item is-current' : 'gr-menu-item',
          role: 'option',
          'aria-selected': String(current),
          'data-action': kind === 'month' ? 'menu-pick-month' : 'menu-pick-year',
          'data-index': panelIndex,
          'data-value': value,
        },
        [label],
      )

    if (kind === 'month') {
      locale.monthNames().forEach((name, index) => {
        menu.append(item(index, name, index === anchor.getMonth()))
      })
    } else {
      const current = anchor.getFullYear()
      const firstYear = min ? min.getFullYear() : current - 10
      const lastYear = max ? max.getFullYear() : current + 10
      for (let year = firstYear; year <= lastYear; year += 1) {
        menu.append(item(year, String(year), year === current))
      }
    }

    return menu
  }

  private renderDropdowns(anchor: Date, panelIndex: number): HTMLElement {
    const { locale, min, max } = this.options
    const caption = h('div', { class: 'gr-caption gr-caption-select' })

    const monthSelect = h('select', { class: 'gr-select', 'data-action': 'select-month', 'data-index': panelIndex })
    locale.monthNames().forEach((name, index) => {
      monthSelect.append(h('option', { value: index, selected: index === anchor.getMonth() }, [name]))
    })

    const currentYear = anchor.getFullYear()
    const firstYear = min ? min.getFullYear() : currentYear - 10
    const lastYear = max ? max.getFullYear() : currentYear + 10
    const yearSelect = h('select', { class: 'gr-select', 'data-action': 'select-year', 'data-index': panelIndex })
    for (let year = firstYear; year <= lastYear; year += 1) {
      yearSelect.append(h('option', { value: year, selected: year === currentYear }, [String(year)]))
    }

    caption.append(monthSelect, yearSelect)
    return caption
  }

  private renderFooter(): HTMLElement | null {
    const { mode, locale, autoApply } = this.options
    const showTime = hasTime(mode)
    const showOpenButtons = isRangeMode(mode) && this.options.allowOpenRange
    if (!showTime && !showOpenButtons && autoApply && this.options.inline) return null

    const footer = h('footer', { class: 'gr-foot' })

    if (showTime) {
      const times = h('div', { class: 'gr-times' })
      times.append(this.renderTimeControls('from'))
      if (isRangeMode(mode)) times.append(this.renderTimeControls('to'))
      footer.append(times)
    }

    const actions = h('div', { class: 'gr-actions' })
    // Vlevo pomocné akce, vpravo potvrzení — jako v nativním kalendáři.
    const helpers = h('div', { class: 'gr-actions gr-actions-secondary' })

    if (isRangeMode(mode) && this.options.allowOpenRange) {
      // Toggles, not one-shot actions: both stay live from the first picked day
      // so the open side can be chosen straight away, and the active one is
      // marked. Disabled only while there is nothing to keep.
      const { from, to } = this.selection
      const nothingPicked = from === null && to === null
      const openButton = (side: 'start' | 'end'): HTMLElement =>
        h(
          'button',
          {
            type: 'button',
            class: 'gr-btn gr-btn-ghost gr-btn-open',
            'data-action': side === 'start' ? 'open-start' : 'open-end',
            disabled: nothingPicked,
            // Written as a string: `h()` drops attributes whose value is false.
            'aria-pressed': (side === 'start' ? from === null && to !== null : from !== null && to === null)
              ? 'true'
              : 'false',
          },
          [side === 'start' ? locale.labels.openStart : locale.labels.openEnd],
        )

      helpers.append(openButton('start'), openButton('end'))
    }

    const now = today()
    helpers.append(
      h(
        'button',
        {
          type: 'button',
          class: 'gr-btn gr-btn-ghost',
          'data-action': 'today',
          disabled: isDayDisabled(now, this.monthContext()),
          title: locale.labels.today,
        },
        [locale.labels.today],
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'gr-btn gr-btn-ghost',
          'data-action': 'clear',
          // Mazat prázdno by jen zbytečně vyslalo apply s null.
          disabled: !this.selection.from && !this.selection.to,
        },
        [locale.labels.clear],
      ),
    )

    if (!autoApply) {
      actions.append(
        h('button', { type: 'button', class: 'gr-btn gr-btn-ghost', 'data-action': 'cancel' }, [locale.labels.cancel]),
        h('button', { type: 'button', class: 'gr-btn gr-btn-primary', 'data-action': 'apply', disabled: !this.isCommittable() }, [
          locale.labels.apply,
        ]),
      )
    }

    footer.append(helpers)
    if (actions.childElementCount) footer.append(actions)
    return footer
  }

  /**
   * Wording of the summary line. Describes the working selection, so it keeps
   * up with clicking rather than waiting for Apply.
   */
  summaryText(): string {
    const { locale, mode, summary } = this.options
    const value = this.selectedValue()
    if (typeof summary === 'function') return summary(value, locale)

    const time = hasTime(mode)
    const { from, to } = this.selection
    if (!from && !to) return locale.labels.nothingSelected
    if (!isRangeMode(mode)) return from ? locale.formatDate(from, time) : locale.labels.nothingSelected
    if (!from) return `${locale.labels.until} ${locale.formatDate(to!, time)}`
    if (!to) {
      return this.options.allowOpenRange
        ? `${locale.labels.since} ${locale.formatDate(from, time)}`
        : locale.formatDate(from, time)
    }

    const days = Math.round((+startOfDay(to) - +startOfDay(from)) / 86_400_000) + 1
    const range = `${locale.formatDate(from, time)}${locale.rangeSeparator}${locale.formatDate(to, time)}`
    return `${range} · ${locale.formatDayCount(days)}`
  }

  private renderSummary(): HTMLElement | null {
    if (!this.options.summary) return null
    const empty = !this.selection.from && !this.selection.to
    return h(
      'div',
      { class: empty ? 'gr-summary is-empty' : 'gr-summary', role: 'status', 'aria-live': 'polite' },
      [this.summaryText()],
    )
  }

  /** One labelled time control per range bound. */
  private renderTimeControls(bound: 'from' | 'to'): HTMLElement {
    const { locale, mode } = this.options
    const group = h('div', { class: 'gr-time-group', 'data-bound': bound })

    if (isRangeMode(mode)) {
      group.append(h('span', { class: 'gr-time-label' }, [bound === 'from' ? locale.labels.from : locale.labels.to]))
    }
    if (this.options.timeUi === 'input') group.append(this.renderTimeInput(bound))
    else if (this.options.timeUi === 'slider') group.append(this.renderTimeSliders(bound))
    else group.append(this.renderTimeSelects(bound))
    return group
  }

  private renderTimeInput(bound: 'from' | 'to'): HTMLElement {
    const { timeStep, minTime, maxTime } = this.options
    const value = this.selection[bound]
    return h('input', {
      type: 'time',
      class: 'gr-time',
      'data-action': bound === 'from' ? 'time-from' : 'time-to',
      step: timeStep * 60,
      min: minTime === null ? null : formatTimeOfDay(minTime),
      max: maxTime === null ? null : formatTimeOfDay(maxTime),
      value: value ? formatISOTime(value) : '',
      disabled: !value,
    })
  }

  /**
   * Hour and minute as sliders, with the resulting time spelled out above them.
   * Dragging must not re-render the panel — swapping the node under the thumb
   * would drop the drag — so the values are patched in place instead.
   */
  private renderTimeSliders(bound: 'from' | 'to'): HTMLElement {
    const { locale, timeStep, minTime, maxTime } = this.options
    const value = this.selection[bound]
    const current = value ? minutesOfDay(value) : (minTime ?? 0)
    const hours = hourOptions(timeStep, minTime, maxTime, current)
    const activeHour = Math.floor(current / 60)
    const minutes = minuteOptions(activeHour, timeStep, minTime, maxTime, current)

    const slider = (kind: 'hour' | 'minute'): HTMLElement => {
      const isHour = kind === 'hour'
      const list = isHour ? hours : minutes
      const input = h('input', {
        type: 'range',
        class: 'gr-slider',
        'data-action': `slider-${kind}-${bound}`,
        min: list[0] ?? 0,
        max: list[list.length - 1] ?? 0,
        step: isHour ? 1 : timeStep,
        value: isHour ? activeHour : current % 60,
        disabled: !value || list.length < 2,
        'aria-label': isHour ? locale.labels.hours : locale.labels.minutes,
      })
      return h('label', { class: 'gr-slider-row' }, [
        h('span', { class: 'gr-slider-label' }, [isHour ? locale.labels.hours : locale.labels.minutes]),
        input,
      ])
    }

    return h('div', { class: 'gr-time gr-time-sliders' }, [
      h('output', { class: 'gr-time-readout', 'data-time-readout': bound }, [
        value ? formatTimeOfDay(current) : '—:—',
      ]),
      slider('hour'),
      slider('minute'),
    ])
  }

  /** Writes the current time back into the sliders without rebuilding them. */
  private syncTimeSliders(bound: 'from' | 'to'): void {
    const { timeStep, minTime, maxTime } = this.options
    const value = this.selection[bound]
    if (!value) return

    const current = minutesOfDay(value)
    const hour = Math.floor(current / 60)
    const minutes = minuteOptions(hour, timeStep, minTime, maxTime, current)

    const readout = this.element.querySelector<HTMLElement>(`[data-time-readout="${bound}"]`)
    if (readout) readout.textContent = formatTimeOfDay(current)

    const hourInput = this.element.querySelector<HTMLInputElement>(`[data-action="slider-hour-${bound}"]`)
    if (hourInput) hourInput.value = String(hour)

    // The hour may have moved to a boundary one, which narrows the minutes.
    const minuteInput = this.element.querySelector<HTMLInputElement>(`[data-action="slider-minute-${bound}"]`)
    if (minuteInput) {
      minuteInput.min = String(minutes[0] ?? 0)
      minuteInput.max = String(minutes[minutes.length - 1] ?? 0)
      minuteInput.value = String(current % 60)
      minuteInput.disabled = minutes.length < 2
    }
  }

  private renderTimeSelects(bound: 'from' | 'to'): HTMLElement {
    const { locale, timeStep, minTime, maxTime } = this.options
    const value = this.selection[bound]
    const current = value ? minutesOfDay(value) : null
    const pad = (n: number): string => String(n).padStart(2, '0')

    const hours = hourOptions(timeStep, minTime, maxTime, current)
    const hourSelect = h('select', {
      class: 'gr-time-select',
      'data-action': bound === 'from' ? 'hour-from' : 'hour-to',
      'aria-label': locale.labels.hours,
      disabled: !value,
    })
    for (const hour of hours) {
      hourSelect.append(h('option', { value: hour, selected: current !== null && Math.floor(current / 60) === hour }, [pad(hour)]))
    }

    // Minutes are listed for the selected hour only, so a boundary hour such as
    // 18:00 with maxTime 18:00 offers exactly one option.
    const activeHour = current !== null ? Math.floor(current / 60) : (hours[0] ?? 0)
    const minutes = minuteOptions(activeHour, timeStep, minTime, maxTime, current)
    const minuteSelect = h('select', {
      class: 'gr-time-select',
      'data-action': bound === 'from' ? 'minute-from' : 'minute-to',
      'aria-label': locale.labels.minutes,
      disabled: !value,
    })
    for (const minute of minutes) {
      minuteSelect.append(h('option', { value: minute, selected: current !== null && current % 60 === minute }, [pad(minute)]))
    }

    return h('div', { class: 'gr-time' }, [hourSelect, h('span', { class: 'gr-time-sep' }, [':']), minuteSelect])
  }

  // ---------------------------------------------------------------- cleanup

  destroy(): void {
    if (this.destroyed) return
    this.close()
    for (const field of this.fields()) {
      field.removeEventListener('focus', this.onInputFocus)
      field.removeEventListener('click', this.onInputFocus)
      field.removeEventListener('keydown', this.onInputKeydown)
    }
    this.element.remove()
    this.emitter.clear()
    this.destroyed = true
  }
}

const KEY_STEPS: Record<string, number | { months: number } | undefined> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
  PageUp: { months: -1 },
  PageDown: { months: 1 },
}

/** Convenience factory: `gregory('#input', { mode: 'range' })`. */
export function gregory(target: string | HTMLElement, options?: GregoryOptions): Gregory {
  return new Gregory(target, options)
}

export { startOfDay, addDays, addMonths, today, parseDate }
