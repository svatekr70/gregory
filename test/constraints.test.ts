import { afterEach, describe, expect, it, vi } from 'vitest'
import { Gregory } from '../src/gregory.js'
import { formatISODate } from '../src/core/date.js'
import type { GregoryOptions } from '../src/core/types.js'

let input: HTMLInputElement
let picker: Gregory

function mount(options: GregoryOptions = {}): Gregory {
  input = document.createElement('input')
  input.type = 'text'
  document.body.append(input)
  picker = new Gregory(input, { locale: 'cs', ...options })
  return picker
}

function open(options: GregoryOptions = {}): Gregory {
  mount(options)
  picker.openPanel()
  picker.goTo('2026-08-01')
  return picker
}

function day(iso: string): HTMLButtonElement {
  const button = picker.element.querySelector<HTMLButtonElement>(`[data-action="day"][data-value="${iso}"]`)
  if (!button) throw new Error(`day ${iso} is not rendered`)
  return button
}

afterEach(() => {
  picker?.destroy()
  input?.remove()
  document.body.replaceChildren()
})

describe('zamčené pole', () => {
  it('neotevře panel nad disabled polem', () => {
    mount({ mode: 'date' })
    input.disabled = true

    input.dispatchEvent(new Event('focus'))
    expect(picker.element.hidden).toBe(true)

    picker.openPanel()
    expect(picker.element.hidden).toBe(true)
  })

  it('neotevře panel nad readonly polem', () => {
    mount({ mode: 'date' })
    input.readOnly = true

    input.dispatchEvent(new Event('click'))
    expect(picker.element.hidden).toBe(true)
  })

  it('nečte napsané datum ze zamčeného pole', () => {
    mount({ mode: 'date', value: '2026-08-13' })
    input.readOnly = true
    input.value = '1. 1. 2020'

    input.dispatchEvent(new Event('blur'))

    expect(formatISODate(picker.getValue() as Date)).toBe('2026-08-13')
  })

  it('zamkne se i volbou disabled', () => {
    mount({ mode: 'date', disabled: true })

    input.dispatchEvent(new Event('focus'))
    expect(picker.element.hidden).toBe(true)
    expect(picker.element.hasAttribute('data-disabled')).toBe(true)
  })

  it('nechá projít programovou změnu hodnoty', () => {
    mount({ mode: 'date', disabled: true })
    picker.setValue('2026-08-13')

    expect(formatISODate(picker.getValue() as Date)).toBe('2026-08-13')
  })

  it('nevybírá dny v zamčeném inline panelu', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const inline = new Gregory(host, { mode: 'date', inline: true, locale: 'cs', disabled: true })
    inline.goTo('2026-08-01')

    host.querySelector<HTMLButtonElement>('[data-action="day"][data-value="2026-08-13"]')!.click()

    expect(inline.getValue()).toBeNull()
    inline.destroy()
    host.remove()
  })
})

describe('validace hodnoty', () => {
  it('odmítne datum před min a ohlásí to', () => {
    mount({ mode: 'date', min: '2026-08-10', value: '2026-08-20' })
    const onInvalid = vi.fn()
    picker.on('invalid', onInvalid)

    picker.setValue('2026-08-01')

    expect(formatISODate(picker.getValue() as Date)).toBe('2026-08-20')
    expect(onInvalid).toHaveBeenCalledWith({ value: expect.anything(), reason: 'min' })
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })

  it('odmítne datum za max', () => {
    mount({ mode: 'date', max: '2026-08-10' })
    const onInvalid = vi.fn()
    picker.on('invalid', onInvalid)

    picker.setValue('2026-08-20')

    expect(picker.getValue()).toBeNull()
    expect(onInvalid.mock.calls[0]?.[0].reason).toBe('max')
  })

  it('odmítne den zakázaný přes isDisabled', () => {
    mount({ mode: 'date', isDisabled: (date) => date.getDay() === 0 })
    const onInvalid = vi.fn()
    picker.on('invalid', onInvalid)

    picker.setValue('2026-08-16') // neděle
    expect(onInvalid.mock.calls[0]?.[0].reason).toBe('disabled')

    picker.setValue('2026-08-17') // pondělí
    expect(formatISODate(picker.getValue() as Date)).toBe('2026-08-17')
  })

  it('hlídá maxSpan i minSpan v rozsahu', () => {
    mount({ mode: 'range', maxSpan: 5, minSpan: 3 })
    const onInvalid = vi.fn()
    picker.on('invalid', onInvalid)

    picker.setValue({ from: '2026-08-01', to: '2026-08-20' })
    expect(onInvalid.mock.calls[0]?.[0].reason).toBe('maxSpan')

    picker.setValue({ from: '2026-08-01', to: '2026-08-02' })
    expect(onInvalid.mock.calls[1]?.[0].reason).toBe('minSpan')

    picker.setValue({ from: '2026-08-01', to: '2026-08-04' })
    expect(picker.getSelection().to).not.toBeNull()
  })

  it('vrátí do pole poslední platnou hodnotu', () => {
    mount({ mode: 'date', min: '2026-08-10', value: '2026-08-20' })
    const text = input.value

    input.value = '1. 1. 2020'
    picker.setValue('2026-08-01')

    expect(input.value).toBe(text)
  })

  it('sundá aria-invalid po platné hodnotě', () => {
    mount({ mode: 'date', min: '2026-08-10' })
    picker.setValue('2026-08-01')
    expect(input.getAttribute('aria-invalid')).toBe('true')

    picker.setValue('2026-08-20')
    expect(input.hasAttribute('aria-invalid')).toBe(false)
  })

  it('zahodí neplatnou počáteční hodnotu', () => {
    mount({ mode: 'date', min: '2026-08-10', value: '2026-01-01' })

    expect(picker.getValue()).toBeNull()
  })

  it('ohlásí nesrozumitelný text jako unreadable', () => {
    mount({ mode: 'date' })
    const onInvalid = vi.fn()
    picker.on('invalid', onInvalid)

    input.value = 'zítra možná'
    input.dispatchEvent(new Event('blur'))

    expect(onInvalid.mock.calls[0]?.[0].reason).toBe('unreadable')
  })
})

describe('minSpan při výběru', () => {
  it('zakáže dny blíž než minSpan po prvním kliknutí', () => {
    open({ mode: 'range', minSpan: 4 })

    day('2026-08-10').click()

    expect(day('2026-08-11').disabled).toBe(true)
    expect(day('2026-08-12').disabled).toBe(true)
    expect(day('2026-08-13').disabled).toBe(false)
    expect(day('2026-08-07').disabled).toBe(false)
    expect(day('2026-08-08').disabled).toBe(true)
  })

  it('nechá klikatelný samotný počáteční den', () => {
    open({ mode: 'range', minSpan: 4 })

    day('2026-08-10').click()

    expect(day('2026-08-10').disabled).toBe(false)
  })
})

describe('stopAtDisabled', () => {
  const blocked = (date: Date): boolean => formatISODate(date) === '2026-08-15'

  it('nedovolí rozsah přes zakázaný den', () => {
    open({ mode: 'range', isDisabled: blocked, stopAtDisabled: true })

    day('2026-08-12').click()

    expect(day('2026-08-14').disabled).toBe(false)
    expect(day('2026-08-16').disabled).toBe(true)
    expect(day('2026-08-20').disabled).toBe(true)
  })

  it('bez přepínače se přes zakázaný den přeskočí', () => {
    open({ mode: 'range', isDisabled: blocked })

    day('2026-08-12').click()

    expect(day('2026-08-16').disabled).toBe(false)
    expect(day('2026-08-15').disabled).toBe(true)
  })

  it('omezuje i směrem dozadu', () => {
    open({ mode: 'range', isDisabled: blocked, stopAtDisabled: true })

    day('2026-08-18').click()

    expect(day('2026-08-16').disabled).toBe(false)
    expect(day('2026-08-14').disabled).toBe(true)
  })
})
