import { afterEach, describe, expect, it } from 'vitest'
import { Gregory } from '../src/gregory.js'
import { resolveLocale } from '../src/core/locale.js'
import { formatISODate } from '../src/core/date.js'
import type { DateRange, GregoryOptions } from '../src/core/types.js'

let input: HTMLInputElement
let picker: Gregory

function mount(options: GregoryOptions = {}): Gregory {
  input = document.createElement('input')
  input.type = 'text'
  document.body.append(input)
  picker = new Gregory(input, { locale: 'cs', ...options })
  return picker
}

/** Napíše text do pole a opustí ho, tedy tak, jak to dělá člověk. */
function type(text: string, field: HTMLInputElement = input): void {
  field.value = text
  field.dispatchEvent(new Event('blur'))
}

afterEach(() => {
  picker?.destroy()
  input?.remove()
  document.body.replaceChildren()
})

describe('locale.parseInput', () => {
  it('reads a full date in the locale order', () => {
    expect(formatISODate(resolveLocale('cs').parseInput('13. 8. 2026')!)).toBe('2026-08-13')
    expect(formatISODate(resolveLocale('de').parseInput('13.8.2026')!)).toBe('2026-08-13')
    expect(formatISODate(resolveLocale('en-GB').parseInput('13/08/2026')!)).toBe('2026-08-13')
    // en-US má měsíc první.
    expect(formatISODate(resolveLocale('en-US').parseInput('8/13/2026')!)).toBe('2026-08-13')
  })

  it('takes an ISO date whatever the locale', () => {
    expect(formatISODate(resolveLocale('en-US').parseInput('2026-08-13')!)).toBe('2026-08-13')
  })

  it('fills in the missing year and month', () => {
    const now = new Date()
    const withoutYear = resolveLocale('cs').parseInput('13. 8.')!
    expect(withoutYear.getFullYear()).toBe(now.getFullYear())
    expect(withoutYear.getMonth()).toBe(7)

    const dayOnly = resolveLocale('cs').parseInput('13')!
    expect(dayOnly.getMonth()).toBe(now.getMonth())
    expect(dayOnly.getDate()).toBe(13)
  })

  it('expands a two-digit year', () => {
    expect(resolveLocale('cs').parseInput('13. 8. 26')?.getFullYear()).toBe(2026)
  })

  it('reads the time when it is there', () => {
    const parsed = resolveLocale('cs').parseInput('13. 8. 2026 14:30')!
    expect(parsed.getHours()).toBe(14)
    expect(parsed.getMinutes()).toBe(30)
  })

  it('refuses nonsense instead of guessing', () => {
    const cs = resolveLocale('cs')
    expect(cs.parseInput('31. 2. 2026')).toBeNull()
    expect(cs.parseInput('nesmysl')).toBeNull()
    expect(cs.parseInput('13. 8. 2026 25:00')).toBeNull()
    expect(cs.parseInput('1 2 3 4')).toBeNull()
    expect(cs.parseInput('')).toBeNull()
  })
})

describe('typing into the field', () => {
  it('takes a date written by hand', () => {
    mount({ mode: 'date' })

    type('13. 8. 2026')

    expect((picker.getValue() as Date).getDate()).toBe(13)
    // Pole se přepíše na kanonický tvar.
    expect(input.value).toBe('13. 8. 2026')
  })

  it('tidies up a sloppy but readable input', () => {
    mount({ mode: 'date' })

    type('1.9.2026')

    expect(formatISODate(picker.getValue() as Date)).toBe('2026-09-01')
    expect(input.value).toBe('1. 9. 2026')
  })

  it('puts the old value back when the text makes no sense', () => {
    mount({ mode: 'date', value: '2026-08-13' })

    type('kdovíco')

    expect(formatISODate(picker.getValue() as Date)).toBe('2026-08-13')
    expect(input.value).toBe('13. 8. 2026')
  })

  it('clears the value on an emptied field', () => {
    mount({ mode: 'date', value: '2026-08-13' })

    type('')

    expect(picker.getValue()).toBeNull()
  })

  it('reads a range from one field', () => {
    mount({ mode: 'range', presets: false })

    type('10. 8. 2026 – 14. 8. 2026')

    const value = picker.getValue() as DateRange
    expect(value.from?.getDate()).toBe(10)
    expect(value.to?.getDate()).toBe(14)
  })

  it('takes a hyphen as the range separator too', () => {
    mount({ mode: 'range', presets: false })

    type('10.8.2026 - 14.8.2026')

    expect((picker.getValue() as DateRange).to?.getDate()).toBe(14)
  })

  it('reads back a range written with a custom separator', () => {
    mount({ mode: 'range', presets: false, locale: { code: 'cs', rangeSeparator: ' — do — ' } })

    // Přesně to, co picker sám vypíše.
    type('30. 8. 2026 — do — 2. 9. 2026')

    const value = picker.getValue() as DateRange
    expect(value.from?.getDate()).toBe(30)
    expect(value.to?.getDate()).toBe(2)
    expect(value.to?.getMonth()).toBe(8)
  })

  it('treats a lone date in a range field as a single day', () => {
    mount({ mode: 'range', presets: false })

    type('10. 8. 2026')

    const value = picker.getValue() as DateRange
    expect(value.from?.getDate()).toBe(10)
    expect(value.to?.getDate()).toBe(10)
  })

  it('reads each split field on its own', () => {
    const endInput = document.createElement('input')
    document.body.append(endInput)
    mount({ mode: 'range', presets: false, endInput })

    type('10. 8. 2026')
    type('14. 8. 2026', endInput)

    const value = picker.getValue() as DateRange
    expect(value.from?.getDate()).toBe(10)
    expect(value.to?.getDate()).toBe(14)
    endInput.remove()
  })

  it('reads the time in datetime mode', () => {
    mount({ mode: 'datetime' })

    type('13. 8. 2026 9:45')

    const value = picker.getValue() as Date
    expect(value.getHours()).toBe(9)
    expect(value.getMinutes()).toBe(45)
  })

  it('reads and closes on Enter', () => {
    mount({ mode: 'date' })
    picker.openPanel()

    input.value = '13. 8. 2026'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))

    expect((picker.getValue() as Date).getDate()).toBe(13)
    expect(picker.element.hidden).toBe(true)
  })

  it('stays out of the way when switched off', () => {
    mount({ mode: 'date', allowTyping: false })

    type('13. 8. 2026')

    expect(picker.getValue()).toBeNull()
  })
})
