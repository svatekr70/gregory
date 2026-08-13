import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineElement, GregoryElement } from '../src/element.js'
import type { DateRange } from '../src/core/types.js'

defineElement()

function mount(attributes: Record<string, string> = {}): GregoryElement {
  const element = document.createElement('gregory-picker') as GregoryElement
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value)
  document.body.append(element)
  return element
}

function day(iso: string): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(`.gr [data-action="day"][data-value="${iso}"]`)
  if (!button) throw new Error(`day ${iso} is not rendered`)
  return button
}

afterEach(() => {
  document.body.replaceChildren()
  document.querySelectorAll('.gr').forEach((panel) => panel.remove())
})

describe('<gregory-picker>', () => {
  it('registers the tag once and tolerates a second call', () => {
    expect(customElements.get('gregory-picker')).toBe(GregoryElement)
    expect(() => defineElement()).not.toThrow()
  })

  it('creates an inner input and a panel', () => {
    const element = mount({ locale: 'cs' })
    expect(element.querySelector('input')).not.toBeNull()
    expect(document.querySelector('.gr')).not.toBeNull()
  })

  it('adopts a slotted input instead of creating a second one', () => {
    const element = document.createElement('gregory-picker') as GregoryElement
    const slotted = document.createElement('input')
    slotted.id = 'slotted'
    element.append(slotted)
    document.body.append(element)

    expect(element.querySelectorAll('input')).toHaveLength(1)
    expect(element.querySelector('input')?.id).toBe('slotted')
  })

  it('maps attributes onto picker options', () => {
    mount({ mode: 'range', locale: 'cs', months: '2', 'week-numbers': '' })
    expect(document.querySelectorAll('.gr-calendar')).toHaveLength(2)
    expect(document.querySelector('.gr-grid')?.hasAttribute('data-weeknumbers')).toBe(true)
  })

  it('reads the initial value attribute, including a range', () => {
    const element = mount({ mode: 'range', locale: 'cs', value: '2026-08-10/2026-08-14' })
    const value = element.value as DateRange
    expect(value.from?.getDate()).toBe(10)
    expect(value.to?.getDate()).toBe(14)
  })

  it('reflects a committed value back into the attribute', () => {
    const element = mount({ mode: 'date', locale: 'cs', value: '2026-08-01' })
    day('2026-08-13').click()
    expect(element.getAttribute('value')).toBe('2026-08-13')
  })

  it('emits namespaced DOM events', () => {
    const element = mount({ mode: 'date', locale: 'cs', value: '2026-08-01' })
    const onChange = vi.fn()
    const onApply = vi.fn()
    element.addEventListener('gregory:change', onChange)
    element.addEventListener('gregory:apply', onApply)

    day('2026-08-13').click()

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onApply).toHaveBeenCalledTimes(1)
    const detail = (onApply.mock.calls[0]![0] as CustomEvent<{ value: Date }>).detail
    expect(detail.value.getDate()).toBe(13)
  })

  it('bubbles its events so a host can delegate', () => {
    const element = mount({ mode: 'date', locale: 'cs', value: '2026-08-01' })
    const onApply = vi.fn()
    document.body.addEventListener('gregory:apply', onApply)

    day('2026-08-13').click()

    expect(onApply).toHaveBeenCalledTimes(1)
    document.body.removeEventListener('gregory:apply', onApply)
  })

  it('accepts a value set through the property', () => {
    const element = mount({ mode: 'date', locale: 'cs' })
    element.value = '2026-12-24'
    expect((element.value as Date).getMonth()).toBe(11)
  })

  it('applies a changed attribute to the live picker', () => {
    const element = mount({ mode: 'date', locale: 'cs', value: '2026-08-01' })
    element.setAttribute('value', '2026-09-09')
    expect((element.value as Date).getMonth()).toBe(8)
  })

  it('forwards the placeholder to the inner input', () => {
    const element = mount({ placeholder: 'Vyber datum' })
    expect(element.querySelector('input')?.placeholder).toBe('Vyber datum')
  })

  it('destroys the picker when removed from the document', () => {
    const element = mount({ locale: 'cs' })
    expect(document.querySelector('.gr')).not.toBeNull()

    element.remove()

    expect(document.querySelector('.gr')).toBeNull()
    expect(element.value).toBeNull()
  })
})
