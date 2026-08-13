import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Gregory } from '../src/gregory.js'
import type { DateRange, GregoryOptions } from '../src/core/types.js'

let input: HTMLInputElement
let picker: Gregory

function mount(options: GregoryOptions = {}): Gregory {
  input = document.createElement('input')
  input.type = 'text'
  document.body.append(input)
  picker = new Gregory(input, { locale: 'cs', ...options })
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

describe('single date mode', () => {
  beforeEach(() => mount({ mode: 'date' }))

  it('commits immediately and writes the input', () => {
    const onApply = vi.fn()
    picker.on('apply', onApply)

    day('2026-08-13').click()

    const value = picker.getValue() as Date
    expect(value).toBeInstanceOf(Date)
    expect(value.getDate()).toBe(13)
    expect(input.value).not.toBe('')
    expect(onApply).toHaveBeenCalledTimes(1)
  })

  it('renders a single month panel by default', () => {
    expect(picker.element.querySelectorAll('.gr-calendar')).toHaveLength(1)
  })
})

describe('range mode', () => {
  beforeEach(() => mount({ mode: 'range', presets: false }))

  it('renders two month panels and waits for Apply', () => {
    expect(picker.element.querySelectorAll('.gr-calendar')).toHaveLength(2)

    day('2026-08-10').click()
    day('2026-08-12').click()

    // Picked but not committed yet.
    expect(picker.getSelection().to?.getDate()).toBe(12)
    expect((picker.getValue() as DateRange).from).toBeNull()
    expect(input.value).toBe('')

    picker.apply()

    const value = picker.getValue() as DateRange
    expect(value.from?.getDate()).toBe(10)
    expect(value.to?.getDate()).toBe(12)
    expect(input.value).toContain('10')
  })

  it('normalises a backwards selection', () => {
    day('2026-08-20').click()
    day('2026-08-15').click()

    const selection = picker.getSelection()
    expect(selection.from?.getDate()).toBe(15)
    expect(selection.to?.getDate()).toBe(20)
  })

  it('reports an incomplete change after the first click', () => {
    const onChange = vi.fn()
    picker.on('change', onChange)

    day('2026-08-10').click()
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ complete: false }))

    day('2026-08-11').click()
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ complete: true }))
  })

  it('restores the committed value on cancel', () => {
    picker.setValue(['2026-08-01', '2026-08-05'])
    day('2026-08-20').click()
    picker.cancel()

    const value = picker.getValue() as DateRange
    expect(value.from?.getDate()).toBe(1)
    expect(value.to?.getDate()).toBe(5)
  })

  it('disables the Apply button until both bounds are picked', () => {
    const apply = () => picker.element.querySelector<HTMLButtonElement>('[data-action="apply"]')!
    expect(apply().disabled).toBe(true)

    day('2026-08-10').click()
    expect(apply().disabled).toBe(true)

    day('2026-08-11').click()
    expect(apply().disabled).toBe(false)
  })
})

describe('constraints', () => {
  it('does not select a day outside min/max', () => {
    mount({ mode: 'date', min: '2026-08-10', max: '2026-08-20' })

    expect(day('2026-08-09').disabled).toBe(true)
    day('2026-08-09').click()
    expect(picker.getValue()).toBeNull()
  })

  it('blocks a range longer than maxSpan', () => {
    mount({ mode: 'range', maxSpan: 3, presets: false })

    day('2026-08-10').click()
    expect(day('2026-08-12').disabled).toBe(false)
    expect(day('2026-08-14').disabled).toBe(true)
  })
})

describe('presets', () => {
  it('offers the built-in shortcuts in range mode and applies one', () => {
    mount({ mode: 'range', autoApply: true })

    const buttons = picker.element.querySelectorAll<HTMLButtonElement>('[data-action="preset"]')
    expect(buttons.length).toBeGreaterThan(0)

    buttons[0]!.click() // "Dnes"
    const value = picker.getValue() as DateRange
    expect(value.from).toBeInstanceOf(Date)
    expect(value.to).toBeInstanceOf(Date)
    expect(value.from?.getDate()).toBe(value.to?.getDate())
  })

  it('hides the sidebar in single date mode', () => {
    mount({ mode: 'date' })
    expect(picker.element.querySelector('.gr-presets')).toBeNull()
  })
})

describe('keyboard', () => {
  function press(key: string, from = '2026-08-13'): void {
    const target = day(from)
    target.focus()
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  }

  it('moves focus by a day and by a week with the arrows', () => {
    mount({ mode: 'date' })
    picker.setValue('2026-08-13')

    press('ArrowDown')
    expect(document.activeElement?.getAttribute('data-value')).toBe('2026-08-20')

    press('ArrowLeft', '2026-08-20')
    expect(document.activeElement?.getAttribute('data-value')).toBe('2026-08-19')

    press('ArrowUp', '2026-08-19')
    expect(document.activeElement?.getAttribute('data-value')).toBe('2026-08-12')

    press('ArrowRight', '2026-08-12')
    expect(document.activeElement?.getAttribute('data-value')).toBe('2026-08-13')
  })

  it('pages a whole month with PageUp and PageDown', () => {
    mount({ mode: 'date' })
    picker.setValue('2026-08-13')

    press('PageDown')
    expect(document.activeElement?.getAttribute('data-value')).toBe('2026-09-13')

    press('PageUp', '2026-09-13')
    expect(document.activeElement?.getAttribute('data-value')).toBe('2026-08-13')
  })

  it('scrolls the view when focus leaves the visible months', () => {
    mount({ mode: 'date' })
    picker.setValue('2026-08-13')

    press('PageDown')

    expect(picker.element.querySelector('.gr-caption')?.textContent?.toLowerCase()).toContain('září')
  })

  it('selects the focused day with Enter', () => {
    mount({ mode: 'date' })
    picker.setValue('2026-08-13')

    press('Enter')

    expect((picker.getValue() as Date).getDate()).toBe(13)
  })

  it('never moves focus past min/max', () => {
    mount({ mode: 'date', min: '2026-08-12', max: '2026-08-14' })
    picker.setValue('2026-08-13')

    press('PageUp')
    expect(document.activeElement?.getAttribute('data-value')).toBe('2026-08-12')
  })

  it('opens the panel from the input with ArrowDown', () => {
    mount({ mode: 'date' })
    picker.close()

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))

    expect(picker.element.hidden).toBe(false)
  })
})

describe('footer actions', () => {
  const click = (action: string): void => {
    picker.element.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click()
  }

  it('commits through the Apply button', () => {
    mount({ mode: 'range', presets: false })
    day('2026-08-10').click()
    day('2026-08-12').click()

    click('apply')

    expect((picker.getValue() as DateRange).to?.getDate()).toBe(12)
    expect(picker.element.hidden).toBe(true)
  })

  it('discards through the Cancel button', () => {
    mount({ mode: 'range', presets: false })
    picker.setValue(['2026-08-01', '2026-08-05'])
    picker.openPanel()
    day('2026-08-20').click()

    click('cancel')

    expect((picker.getValue() as DateRange).from?.getDate()).toBe(1)
  })

  it('empties the value through the Clear button', () => {
    mount({ mode: 'date' })
    picker.setValue('2026-08-13')

    click('clear')

    expect(picker.getValue()).toBeNull()
    expect(input.value).toBe('')
  })

  it('jumps back to the current month through Today', () => {
    mount({ mode: 'range', presets: [{ label: 'Dnes', range: () => [new Date(), new Date()] }] })
    picker.goTo('2020-01-01')

    picker.element.querySelector<HTMLButtonElement>('[data-action="preset"]')!.click()

    // A preset without autoApply stays uncommitted but does move the selection.
    expect(picker.getSelection().from).toBeInstanceOf(Date)
    expect((picker.getValue() as DateRange).from).toBeNull()
  })
})

describe('datetime mode', () => {
  it('keeps the time when the day changes', () => {
    mount({ mode: 'datetime' })
    day('2026-08-13').click()

    const time = picker.element.querySelector<HTMLInputElement>('[data-action="time-from"]')!
    expect(time.disabled).toBe(false)
    time.value = '14:30'
    time.dispatchEvent(new Event('change', { bubbles: true }))

    expect((picker.getValue() as Date).getHours()).toBe(14)
    expect((picker.getValue() as Date).getMinutes()).toBe(30)

    picker.openPanel()
    day('2026-08-20').click()
    expect((picker.getValue() as Date).getDate()).toBe(20)
    expect((picker.getValue() as Date).getHours()).toBe(14)
  })

  it('disables the time input until a day is picked', () => {
    mount({ mode: 'datetime' })
    expect(picker.element.querySelector<HTMLInputElement>('[data-action="time-from"]')!.disabled).toBe(true)
  })

  it('offers a time input per bound in a datetime range', () => {
    mount({ mode: 'datetime-range' })
    expect(picker.element.querySelectorAll('.gr-time')).toHaveLength(2)
  })
})

describe('navigation', () => {
  it('pages months with the arrows and reports the change', () => {
    mount({ mode: 'date' })
    const onMonthChange = vi.fn()
    picker.on('month-change', onMonthChange)

    picker.element.querySelector<HTMLButtonElement>('[data-action="next"]')!.click()
    expect(onMonthChange).toHaveBeenLastCalledWith({ year: 2026, month: 8 })
    expect(picker.element.querySelector('.gr-caption')?.textContent?.toLowerCase()).toContain('září')

    picker.element.querySelector<HTMLButtonElement>('[data-action="prev"]')!.click()
    expect(onMonthChange).toHaveBeenLastCalledWith({ year: 2026, month: 7 })
  })

  it('shows only one pair of arrows across several months', () => {
    mount({ mode: 'range', presets: false })
    expect(picker.element.querySelectorAll('[data-action="prev"]')).toHaveLength(1)
    expect(picker.element.querySelectorAll('[data-action="next"]')).toHaveLength(1)
  })

  it('jumps to a month through the dropdowns', () => {
    mount({ mode: 'date', dropdowns: true })
    const select = picker.element.querySelector<HTMLSelectElement>('[data-action="select-month"]')!
    select.value = '11'
    select.dispatchEvent(new Event('change', { bubbles: true }))

    expect(picker.element.querySelector('.gr-caption')?.textContent?.toLowerCase()).toContain('prosinec')
  })

  it('limits the year dropdown to the min/max window', () => {
    mount({ mode: 'date', dropdowns: true, min: '2025-01-01', max: '2027-12-31' })
    const options = picker.element.querySelectorAll('[data-action="select-year"] option')
    expect([...options].map((option) => option.textContent)).toEqual(['2025', '2026', '2027'])
  })
})

describe('value handling', () => {
  it('accepts a slash-separated range string', () => {
    mount({ mode: 'range', presets: false })
    picker.setValue('2026-08-10/2026-08-14')

    const value = picker.getValue() as DateRange
    expect(value.from?.getDate()).toBe(10)
    expect(value.to?.getDate()).toBe(14)
  })

  it('clears the value and the input', () => {
    mount({ mode: 'date' })
    picker.setValue('2026-08-13')
    expect(input.value).not.toBe('')

    picker.clear()
    expect(picker.getValue()).toBeNull()
    expect(input.value).toBe('')
  })

  it('stays silent when asked to', () => {
    mount({ mode: 'date' })
    const onChange = vi.fn()
    picker.on('change', onChange)

    picker.setValue('2026-08-13', { silent: true })

    expect(onChange).not.toHaveBeenCalled()
    expect(picker.getValue()).not.toBeNull()
  })

  it('uses a custom format for the input text', () => {
    mount({ mode: 'date', format: (value) => (value instanceof Date ? `#${value.getDate()}` : '') })
    day('2026-08-13').click()
    expect(input.value).toBe('#13')
  })

  it('picks up a value already present in the input', () => {
    const existing = document.createElement('input')
    existing.value = '2026-08-13'
    document.body.append(existing)

    const fromInput = new Gregory(existing, { mode: 'date', locale: 'cs' })
    expect((fromInput.getValue() as Date).getDate()).toBe(13)
    fromInput.destroy()
    existing.remove()
  })

  it('re-renders after setOptions', () => {
    mount({ mode: 'range', presets: false, months: 2 })
    expect(picker.element.querySelectorAll('.gr-calendar')).toHaveLength(2)

    picker.setOptions({ months: 3 })
    expect(picker.element.querySelectorAll('.gr-calendar')).toHaveLength(3)
  })

  it('adds a caller-supplied class to matching days', () => {
    mount({ mode: 'date', dayClass: (date) => (date.getDate() === 13 ? 'is-holiday' : null) })
    expect(day('2026-08-13').classList.contains('is-holiday')).toBe(true)
    expect(day('2026-08-14').classList.contains('is-holiday')).toBe(false)
  })
})

describe('popover behaviour', () => {
  it('emits open and close', () => {
    mount({ mode: 'date' })
    const onOpen = vi.fn()
    const onClose = vi.fn()
    picker.on('open', onOpen)
    picker.on('close', onClose)

    picker.close()
    picker.openPanel()
    picker.toggle()

    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('opens on input focus', () => {
    mount({ mode: 'date' })
    picker.close()
    expect(picker.element.hidden).toBe(true)

    input.dispatchEvent(new Event('focus'))
    expect(picker.element.hidden).toBe(false)
  })

  it('cancels an uncommitted selection when clicking outside', () => {
    mount({ mode: 'range', presets: false })
    picker.setValue(['2026-08-01', '2026-08-05'])
    picker.openPanel()
    day('2026-08-20').click()

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))

    expect(picker.element.hidden).toBe(true)
    expect((picker.getValue() as DateRange).from?.getDate()).toBe(1)
  })

  it('closes on Escape', () => {
    mount({ mode: 'date' })
    // Dispatched from the input, the way a real keypress reaches the document.
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(picker.element.hidden).toBe(true)
  })

  it('keeps the panel open in inline mode', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const inline = new Gregory(host, { mode: 'date', inline: true, locale: 'cs' })

    inline.close()
    expect(inline.element.hidden).toBe(false)
    inline.destroy()
    host.remove()
  })
})

describe('lifecycle', () => {
  it('removes its panel and listeners on destroy', () => {
    mount({ mode: 'date' })
    const element = picker.element
    picker.destroy()
    expect(element.isConnected).toBe(false)
  })

  it('renders inline without a popover', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const inline = new Gregory(host, { mode: 'range', inline: true, locale: 'cs' })

    expect(host.querySelector('.gr')).not.toBeNull()
    expect(inline.element.hasAttribute('data-inline')).toBe(true)
    inline.destroy()
  })
})
