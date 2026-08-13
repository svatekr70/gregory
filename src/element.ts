import { Gregory } from './gregory.js'
import { formatISODate } from './core/date.js'
import type { GregoryOptions, Mode, WeekDay } from './core/types.js'

const BOOLEAN_ATTRS = ['inline', 'week-numbers', 'dropdowns', 'auto-apply', 'presets'] as const

/**
 * `<gregory-picker>` — a thin declarative wrapper over {@link Gregory}.
 *
 * It renders an inner `<input>` (or adopts a slotted one), keeps the `value`
 * attribute in sync and re-emits picker events as DOM `CustomEvent`s.
 */
export class GregoryElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return [
      'mode',
      'value',
      'locale',
      'min',
      'max',
      'months',
      'max-span',
      'first-day-of-week',
      'placeholder',
      ...BOOLEAN_ATTRS,
    ]
  }

  private picker: Gregory | null = null
  private input: HTMLInputElement | null = null

  connectedCallback(): void {
    if (this.picker) return

    this.input = this.querySelector('input') ?? document.createElement('input')
    this.input.type = 'text'
    if (!this.input.isConnected) this.append(this.input)
    if (this.hasAttribute('placeholder')) this.input.placeholder = this.getAttribute('placeholder') ?? ''

    this.picker = new Gregory(this.input, this.readOptions())
    this.picker.on('change', (payload) => this.forward('change', payload))
    this.picker.on('apply', (payload) => {
      this.syncValueAttribute()
      this.forward('apply', payload)
    })
    this.picker.on('open', (payload) => this.forward('open', payload))
    this.picker.on('close', (payload) => this.forward('close', payload))
  }

  disconnectedCallback(): void {
    this.picker?.destroy()
    this.picker = null
  }

  attributeChangedCallback(name: string, previous: string | null, next: string | null): void {
    if (!this.picker || previous === next) return
    if (name === 'value') this.picker.setValue(next, { silent: true })
    else this.picker.setOptions(this.readOptions())
  }

  /** The current value, mirroring {@link Gregory.getValue}. */
  get value(): ReturnType<Gregory['getValue']> {
    return this.picker?.getValue() ?? null
  }

  set value(next: Parameters<Gregory['setValue']>[0]) {
    this.picker?.setValue(next)
  }

  private readOptions(): GregoryOptions {
    const number = (name: string): number | undefined => {
      const raw = this.getAttribute(name)
      return raw === null ? undefined : Number(raw)
    }

    return {
      mode: (this.getAttribute('mode') as Mode | null) ?? 'date',
      value: this.getAttribute('value'),
      locale: this.getAttribute('locale') ?? undefined,
      min: this.getAttribute('min'),
      max: this.getAttribute('max'),
      months: number('months'),
      maxSpan: number('max-span') ?? null,
      firstDayOfWeek: number('first-day-of-week') as WeekDay | undefined,
      inline: this.hasAttribute('inline'),
      weekNumbers: this.hasAttribute('week-numbers'),
      dropdowns: this.hasAttribute('dropdowns'),
      ...(this.hasAttribute('auto-apply') ? { autoApply: true } : {}),
      ...(this.hasAttribute('presets') ? { presets: this.getAttribute('presets') !== 'false' } : {}),
    }
  }

  private syncValueAttribute(): void {
    const value = this.picker?.getValue() ?? null
    if (!value) {
      this.removeAttribute('value')
      return
    }
    const serialized =
      value instanceof Date
        ? formatISODate(value)
        : [value.from, value.to].map((date) => (date ? formatISODate(date) : '')).join('/')
    this.setAttribute('value', serialized)
  }

  private forward(type: string, detail: unknown): void {
    this.dispatchEvent(new CustomEvent(`gregory:${type}`, { detail, bubbles: true, composed: true }))
  }
}

/** Registers `<gregory-picker>`. Safe to call more than once. */
export function defineElement(tagName = 'gregory-picker'): void {
  if (typeof customElements === 'undefined' || customElements.get(tagName)) return
  customElements.define(tagName, GregoryElement)
}
