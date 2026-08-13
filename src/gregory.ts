import { buildMonth, isDayDisabled, type MonthContext } from './core/calendar.js'
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
  today,
  withTimeOf,
} from './core/date.js'
import { Emitter } from './core/emitter.js'
import { resolveLocale } from './core/locale.js'
import { defaultPresets } from './core/presets.js'
import type {
  DateLike,
  DateRange,
  GregoryEvents,
  GregoryOptions,
  GregoryValue,
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

export class Gregory {
  /** Root node of the panel. Always exists, even while closed. */
  readonly element: HTMLElement

  private readonly emitter = new Emitter<GregoryEvents>()
  private readonly input: HTMLInputElement | null
  private readonly host: HTMLElement
  private options: ResolvedOptions

  /** Working selection, not yet committed in Apply/Cancel mode. */
  private selection: DateRange = { from: null, to: null }
  /** Last committed value, restored on Cancel. */
  private committed: DateRange = { from: null, to: null }
  private viewDate: Date = today()
  private preview: Date | null = null
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
    this.element = h('div', { class: 'gr', 'data-mode': this.options.mode })

    const initial = options.value ?? (this.input?.value || null)
    this.assign(this.toRange(initial), { commit: true, silent: true })

    if (this.options.inline) {
      this.host.append(this.element)
      this.element.setAttribute('data-inline', '')
      this.open = true
    } else {
      this.element.setAttribute('data-popover', '')
      this.element.hidden = true
      document.body.append(this.element)
    }

    this.bindHost()
    this.element.addEventListener('click', this.onPanelClick)
    this.element.addEventListener('change', this.onPanelChange)
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
      locale,
      min: parseDate(options.min),
      max: parseDate(options.max),
      firstDayOfWeek: options.firstDayOfWeek ?? locale.firstDayOfWeek,
      months: options.months ?? (isRangeMode(mode) ? 2 : 1),
      weekNumbers: options.weekNumbers ?? false,
      dropdowns: options.dropdowns ?? false,
      inline: options.inline ?? false,
      autoApply: options.autoApply ?? !isRangeMode(mode),
      presets,
      maxSpan: options.maxSpan ?? null,
      timeStep: options.timeStep ?? 5,
      opens: options.opens ?? 'right',
      drops: options.drops ?? 'auto',
      isDisabled: options.isDisabled,
      dayClass: options.dayClass,
      format: options.format,
    }
  }

  setOptions(patch: GregoryOptions): void {
    this.options = this.resolveOptions({ ...this.optionsAsInput(), ...patch })
    if (patch.value !== undefined) this.assign(this.toRange(patch.value), { commit: true, silent: true })
    this.render()
  }

  private optionsAsInput(): GregoryOptions {
    const { locale, presets, ...rest } = this.options
    return { ...rest, locale, presets }
  }

  // ------------------------------------------------------------------ value

  private toRange(value: DateLike | DateRange | [DateLike, DateLike]): DateRange {
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

  /** The committed value: a `Date` in single modes, a `DateRange` in range modes. */
  getValue(): GregoryValue {
    if (isRangeMode(this.options.mode)) return { ...this.committed }
    return this.committed.from ? new Date(this.committed.from.getTime()) : null
  }

  /** The in-progress selection, which may be half-finished in range modes. */
  getSelection(): DateRange {
    return { ...this.selection }
  }

  setValue(value: DateLike | DateRange | [DateLike, DateLike], { silent = false } = {}): void {
    this.assign(this.toRange(value), { commit: true, silent })
    this.render()
  }

  clear({ silent = false } = {}): void {
    this.assign({ from: null, to: null }, { commit: true, silent })
    this.render()
  }

  private assign(range: DateRange, { commit = false, silent = false } = {}): void {
    this.selection = range
    if (range.from) {
      this.viewDate = createDate(range.from.getFullYear(), range.from.getMonth(), 1)
      this.focusedDay = range.from
    }
    if (commit) {
      this.committed = { ...range }
      this.syncInput()
    }
    if (!silent) {
      this.emitter.emit('change', { value: this.getValue(), complete: this.isComplete() })
      if (commit) this.emitter.emit('apply', { value: this.getValue() })
    }
  }

  private isComplete(): boolean {
    if (!this.selection.from) return false
    return isRangeMode(this.options.mode) ? this.selection.to !== null : true
  }

  formatValue(): string {
    const { locale, format, mode } = this.options
    if (format) return format(this.getValue(), locale) ?? ''

    const { from, to } = this.committed
    if (!from) return ''
    const time = hasTime(mode)
    if (!isRangeMode(mode)) return locale.formatDate(from, time)
    if (!to) return locale.formatDate(from, time)
    return `${locale.formatDate(from, time)}${locale.rangeSeparator}${locale.formatDate(to, time)}`
  }

  private syncInput(): void {
    if (!this.input) return
    this.input.value = this.formatValue()
    this.input.dispatchEvent(new Event('input', { bubbles: true }))
    this.input.dispatchEvent(new Event('change', { bubbles: true }))
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
    if (this.committed.from) this.viewDate = createDate(this.committed.from.getFullYear(), this.committed.from.getMonth(), 1)
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
    document.removeEventListener('mousedown', this.onDocumentDown, true)
    document.removeEventListener('keydown', this.onDocumentKeydown, true)
    this.emitter.emit('close', { value: this.getValue() })
  }

  apply(): void {
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
    this.viewDate = createDate(parsed.getFullYear(), parsed.getMonth(), 1)
    this.emitter.emit('month-change', { year: this.viewDate.getFullYear(), month: this.viewDate.getMonth() })
    this.render()
  }

  private position(): void {
    if (!this.input) return
    const rect = this.input.getBoundingClientRect()
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
    this.input.addEventListener('focus', this.onInputFocus)
    this.input.addEventListener('click', this.onInputFocus)
    this.input.addEventListener('keydown', this.onInputKeydown)
  }

  private onInputFocus = (): void => {
    if (this.suppressReopen) return
    this.openPanel()
  }

  /**
   * Returns focus to the input after Escape or Cancel. Plain `focus()` would
   * bounce off the focus handler and re-open the panel we just closed.
   */
  private returnFocus(): void {
    if (!this.input) return
    this.suppressReopen = true
    this.input.focus()
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
    if (this.element.contains(target) || this.input?.contains(target) || target === this.input) return
    // Clicking away keeps an auto-applied value but discards an uncommitted one.
    if (this.options.autoApply) this.close()
    else this.cancel()
  }

  private onDocumentKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      this.cancel()
      this.returnFocus()
    }
  }

  private onPanelClick = (event: MouseEvent): void => {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-action]')
    if (!target) return
    event.preventDefault()

    const { action, value } = target.dataset
    switch (action) {
      case 'prev':
        this.shiftMonths(-1)
        break
      case 'next':
        this.shiftMonths(1)
        break
      case 'day':
        this.pick(parseDate(value ?? null))
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
      case 'today':
        this.goTo(today())
        break
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

  private onPanelChange = (event: Event): void => {
    const target = event.target as HTMLSelectElement | HTMLInputElement | null
    if (!target?.dataset.action) return

    switch (target.dataset.action) {
      case 'select-month':
        this.viewDate = createDate(this.viewDate.getFullYear(), Number(target.value), 1)
        this.render()
        break
      case 'select-year':
        this.viewDate = createDate(Number(target.value), this.viewDate.getMonth(), 1)
        this.render()
        break
      case 'time-from':
      case 'time-to': {
        const bound = target.dataset.action === 'time-from' ? 'from' : 'to'
        const current = this.selection[bound]
        if (!current) break
        const [hours = 0, minutes = 0] = target.value.split(':').map(Number)
        this.selection = {
          ...this.selection,
          [bound]: createDate(current.getFullYear(), current.getMonth(), current.getDate(), hours, minutes),
        }
        if (this.options.autoApply) this.committed = { ...this.selection }
        this.emitter.emit('change', { value: this.getValue(), complete: this.isComplete() })
        break
      }
      default:
        break
    }
  }

  private onPanelHover = (event: MouseEvent): void => {
    if (!isRangeMode(this.options.mode)) return
    if (!this.selection.from || this.selection.to) return
    const day = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-action="day"]')
    const hovered = day ? parseDate(day.dataset.value ?? null) : null
    if (isSameDay(hovered, this.preview)) return
    this.preview = hovered
    this.render()
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
    if (compareDay(this.focusedDay, this.viewDate) < 0 || compareDay(this.focusedDay, this.lastVisibleDay()) > 0) {
      this.viewDate = createDate(this.focusedDay.getFullYear(), this.focusedDay.getMonth(), 1)
    }
    this.render()
    this.focusGrid()
  }

  private lastVisibleDay(): Date {
    const last = addMonths(this.viewDate, this.options.months - 1)
    return createDate(last.getFullYear(), last.getMonth() + 1, 0)
  }

  private focusGrid(): void {
    const iso = this.focusedDay
    const selector = `[data-action="day"][data-value="${iso.getFullYear()}-${String(iso.getMonth() + 1).padStart(2, '0')}-${String(iso.getDate()).padStart(2, '0')}"]`
    this.element.querySelector<HTMLButtonElement>(selector)?.focus()
  }

  private shiftMonths(amount: number): void {
    this.viewDate = addMonths(this.viewDate, amount)
    this.emitter.emit('month-change', { year: this.viewDate.getFullYear(), month: this.viewDate.getMonth() })
    this.render()
  }

  private pick(date: Date | null): void {
    if (!date || isDayDisabled(date, this.monthContext())) return

    if (!isRangeMode(this.options.mode)) {
      this.selection = { from: withTimeOf(date, this.selection.from), to: null }
    } else if (!this.selection.from || this.selection.to) {
      this.selection = { from: withTimeOf(date, this.selection.from), to: null }
    } else if (compareDay(date, this.selection.from) < 0) {
      this.selection = { from: withTimeOf(date, this.selection.from), to: this.selection.from }
    } else {
      this.selection = { ...this.selection, to: withTimeOf(date, this.selection.to) }
    }

    this.focusedDay = date
    this.preview = null
    const complete = this.isComplete()
    if (complete && this.options.autoApply) this.committed = { ...this.selection }
    if (complete && this.options.autoApply) this.syncInput()

    this.emitter.emit('change', { value: this.getValue(), complete })
    if (complete && this.options.autoApply) {
      this.emitter.emit('apply', { value: this.getValue() })
      this.render()
      this.close()
      return
    }
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
      isDisabled: this.options.isDisabled,
      dayClass: this.options.dayClass,
    }
  }

  private render(): void {
    if (this.destroyed) return
    const { locale, months, presets, weekNumbers, dropdowns } = this.options
    const context = this.monthContext()

    const calendars = h('div', { class: 'gr-calendars' })
    for (let offset = 0; offset < months; offset += 1) {
      const anchor = addMonths(this.viewDate, offset)
      const view = buildMonth(anchor.getFullYear(), anchor.getMonth(), context)
      const head = h('header', { class: 'gr-head' })

      head.append(
        offset === 0
          ? h('button', { type: 'button', class: 'gr-nav', 'data-action': 'prev', 'aria-label': locale.labels.previousMonth }, ['‹'])
          : h('span', { class: 'gr-nav gr-nav-placeholder', 'aria-hidden': 'true' }),
        dropdowns ? this.renderDropdowns(anchor) : h('div', { class: 'gr-caption' }, [view.label]),
        offset === months - 1
          ? h('button', { type: 'button', class: 'gr-nav', 'data-action': 'next', 'aria-label': locale.labels.nextMonth }, ['›'])
          : h('span', { class: 'gr-nav gr-nav-placeholder', 'aria-hidden': 'true' }),
      )

      const grid = h('div', { class: 'gr-grid', role: 'grid', 'data-weeknumbers': weekNumbers })
      if (weekNumbers) grid.append(h('div', { class: 'gr-weekday gr-weeknum', title: locale.labels.weekNumber }, ['#']))
      for (const name of view.weekdays) grid.append(h('div', { class: 'gr-weekday', role: 'columnheader' }, [name]))

      for (const week of view.weeks) {
        if (weekNumbers) grid.append(h('div', { class: 'gr-weeknum' }, [String(week.weekNumber)]))
        for (const day of week.days) {
          const classes = ['gr-day']
          if (day.outside) classes.push('is-outside')
          if (day.isToday) classes.push('is-today')
          if (day.selected) classes.push('is-selected')
          if (day.inRange) classes.push('is-in-range')
          if (day.rangeStart) classes.push('is-start')
          if (day.rangeEnd) classes.push('is-end')
          if (day.weekend) classes.push('is-weekend')
          if (day.extraClass) classes.push(day.extraClass)

          grid.append(
            h(
              'button',
              {
                type: 'button',
                class: classes.join(' '),
                'data-action': 'day',
                'data-value': day.iso,
                disabled: day.disabled,
                'aria-selected': day.selected,
                tabindex: isSameDay(day.date, this.focusedDay) && !day.outside ? 0 : -1,
              },
              [String(day.date.getDate())],
            ),
          )
        }
      }

      calendars.append(h('section', { class: 'gr-calendar' }, [head, grid]))
    }

    const body = h('div', { class: 'gr-body' }, [calendars])
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
  }

  private renderDropdowns(anchor: Date): HTMLElement {
    const { locale, min, max } = this.options
    const caption = h('div', { class: 'gr-caption gr-caption-select' })

    const monthSelect = h('select', { class: 'gr-select', 'data-action': 'select-month' })
    locale.monthNames().forEach((name, index) => {
      monthSelect.append(h('option', { value: index, selected: index === anchor.getMonth() }, [name]))
    })

    const currentYear = anchor.getFullYear()
    const firstYear = min ? min.getFullYear() : currentYear - 10
    const lastYear = max ? max.getFullYear() : currentYear + 10
    const yearSelect = h('select', { class: 'gr-select', 'data-action': 'select-year' })
    for (let year = firstYear; year <= lastYear; year += 1) {
      yearSelect.append(h('option', { value: year, selected: year === currentYear }, [String(year)]))
    }

    caption.append(monthSelect, yearSelect)
    return caption
  }

  private renderFooter(): HTMLElement | null {
    const { mode, locale, autoApply } = this.options
    const showTime = hasTime(mode)
    if (!showTime && autoApply && this.options.inline) return null

    const footer = h('footer', { class: 'gr-foot' })

    if (showTime) {
      const times = h('div', { class: 'gr-times' })
      times.append(this.renderTimeInput('from'))
      if (isRangeMode(mode)) times.append(this.renderTimeInput('to'))
      footer.append(times)
    }

    const actions = h('div', { class: 'gr-actions' })
    actions.append(h('button', { type: 'button', class: 'gr-btn gr-btn-ghost', 'data-action': 'clear' }, [locale.labels.clear]))
    if (!autoApply) {
      actions.append(
        h('button', { type: 'button', class: 'gr-btn gr-btn-ghost', 'data-action': 'cancel' }, [locale.labels.cancel]),
        h('button', { type: 'button', class: 'gr-btn gr-btn-primary', 'data-action': 'apply', disabled: !this.isComplete() }, [
          locale.labels.apply,
        ]),
      )
    }
    footer.append(actions)
    return footer
  }

  private renderTimeInput(bound: 'from' | 'to'): HTMLElement {
    const value = this.selection[bound]
    return h('input', {
      type: 'time',
      class: 'gr-time',
      'data-action': bound === 'from' ? 'time-from' : 'time-to',
      step: this.options.timeStep * 60,
      value: value ? formatISOTime(value) : '',
      disabled: !value,
    })
  }

  // ---------------------------------------------------------------- cleanup

  destroy(): void {
    if (this.destroyed) return
    this.close()
    this.input?.removeEventListener('focus', this.onInputFocus)
    this.input?.removeEventListener('click', this.onInputFocus)
    this.input?.removeEventListener('keydown', this.onInputKeydown)
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
