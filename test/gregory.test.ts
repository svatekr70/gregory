import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Gregory } from '../src/gregory.js'
import { formatISODate } from '../src/core/date.js'
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

  it('reports the working selection, not the committed value', () => {
    const onChange = vi.fn()
    picker.on('change', onChange)

    day('2026-08-10').click()

    // Nothing is committed yet, but change must still describe what was picked.
    const payload = onChange.mock.calls.at(-1)![0] as { value: DateRange }
    expect(payload.value.from?.getDate()).toBe(10)
    expect((picker.getValue() as DateRange).from).toBeNull()
  })

  it('restores the committed value on cancel', () => {
    picker.setValue(['2026-08-01', '2026-08-05'])
    day('2026-08-20').click()
    picker.cancel()

    const value = picker.getValue() as DateRange
    expect(value.from?.getDate()).toBe(1)
    expect(value.to?.getDate()).toBe(5)
  })

  it('allows Apply as soon as one day is picked', () => {
    const apply = () => picker.element.querySelector<HTMLButtonElement>('[data-action="apply"]')!
    expect(apply().disabled).toBe(true)

    day('2026-08-10').click()
    expect(apply().disabled).toBe(false)

    day('2026-08-11').click()
    expect(apply().disabled).toBe(false)
  })

  it('commits a single picked day as a one-day range', () => {
    day('2026-08-10').click()
    picker.apply()

    const value = picker.getValue() as DateRange
    expect(value.from?.getDate()).toBe(10)
    expect(value.to?.getDate()).toBe(10)
  })
})

describe('summary line', () => {
  const summary = (): string => picker.element.querySelector('.gr-summary')?.textContent ?? ''

  it('is off by default', () => {
    mount({ mode: 'range', presets: false })
    expect(picker.element.querySelector('.gr-summary')).toBeNull()
  })

  it('says so while nothing is picked', () => {
    mount({ mode: 'range', presets: false, summary: true })
    expect(summary()).toBe('Nic nevybráno')
    expect(picker.element.querySelector('.gr-summary')?.classList.contains('is-empty')).toBe(true)
  })

  it('follows the working selection, not the committed value', () => {
    mount({ mode: 'range', presets: false, summary: true })

    day('2026-08-10').click()
    expect(summary()).toContain('10')
    expect((picker.getValue() as DateRange).from).toBeNull()

    day('2026-08-16').click()
    expect(summary()).toContain('16')
  })

  it('counts the days with the right plural form', () => {
    mount({ mode: 'range', presets: false, summary: true })

    day('2026-08-10').click()
    day('2026-08-16').click()
    expect(summary()).toContain('7 dní')

    day('2026-08-10').click()
    day('2026-08-11').click()
    expect(summary()).toContain('2 dny')

    day('2026-08-10').click()
    day('2026-08-10').click()
    expect(summary()).toContain('1 den')
  })

  it('uses English plurals for an English locale', () => {
    mount({ mode: 'range', presets: false, summary: true, locale: 'en-GB' })

    day('2026-08-10').click()
    day('2026-08-11').click()
    expect(summary()).toContain('2 days')

    day('2026-08-10').click()
    day('2026-08-10').click()
    expect(summary()).toContain('1 day')
  })

  it('spells out an open range', () => {
    mount({ mode: 'range', presets: false, summary: true, allowOpenRange: true })

    day('2026-08-10').click()
    expect(summary()).toMatch(/^od /)

    picker.element.querySelector<HTMLButtonElement>('[data-action="open-start"]')!.click()
    expect(summary()).toMatch(/^do /)
  })

  it('shows a single date in date mode', () => {
    mount({ mode: 'date', summary: true })
    day('2026-08-13').click()
    picker.openPanel()

    expect(summary()).toContain('13')
    expect(summary()).not.toContain('dní')
  })

  it('accepts a custom formatter', () => {
    mount({
      mode: 'range',
      presets: false,
      summary: (value) => (value && !(value instanceof Date) && value.from ? 'něco vybráno' : 'zatím nic'),
    })

    expect(summary()).toBe('zatím nic')
    day('2026-08-10').click()
    expect(summary()).toBe('něco vybráno')
  })
})

describe('outside days', () => {
  const cells = (): Element[] => [...picker.element.querySelectorAll('.gr-grid > .gr-day, .gr-grid > .gr-day-empty')]

  it('shows the neighbouring months by default', () => {
    mount({ mode: 'date' })

    expect(day('2026-07-27').classList.contains('is-outside')).toBe(true)
    expect(day('2026-09-06').classList.contains('is-outside')).toBe(true)
  })

  it('hides them without losing grid cells', () => {
    mount({ mode: 'date', showOutsideDays: false })

    expect(picker.element.querySelector('[data-value="2026-07-27"]')).toBeNull()
    expect(picker.element.querySelector('[data-value="2026-09-06"]')).toBeNull()

    // Still six rows of seven.
    expect(cells()).toHaveLength(42)
    expect(picker.element.querySelectorAll('.gr-day-empty').length).toBeGreaterThan(0)
  })

  it('keeps every day of the shown month clickable', () => {
    mount({ mode: 'date', showOutsideDays: false })

    day('2026-08-01').click()
    expect((picker.getValue() as Date).getDate()).toBe(1)

    picker.openPanel()
    day('2026-08-31').click()
    expect((picker.getValue() as Date).getDate()).toBe(31)
  })

  it('leaves the blanks out of the range painting', () => {
    mount({ mode: 'range', presets: false, showOutsideDays: false })
    day('2026-08-10').click()
    day('2026-08-14').click()

    for (const blank of picker.element.querySelectorAll('.gr-day-empty')) {
      expect(blank.classList.contains('is-in-range')).toBe(false)
    }
  })
})

describe('hover preview', () => {
  const hover = (target: HTMLElement | null): void => {
    const node = target ?? picker.element.querySelector<HTMLElement>('.gr-foot')!
    node.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
  }

  it('previews the range without rebuilding the panel', () => {
    mount({ mode: 'range', presets: false })
    day('2026-08-10').click()

    const before = day('2026-08-14')
    const applyBefore = picker.element.querySelector('[data-action="apply"]')

    hover(before)

    // Same nodes — a rebuild here would swap out whatever is under the cursor
    // and a click straddling it would be lost.
    expect(day('2026-08-14')).toBe(before)
    expect(picker.element.querySelector('[data-action="apply"]')).toBe(applyBefore)
    expect(day('2026-08-12').classList.contains('is-in-range')).toBe(true)
  })

  it('clears the preview when the pointer leaves the grid', () => {
    mount({ mode: 'range', presets: false })
    day('2026-08-10').click()

    hover(day('2026-08-14'))
    expect(day('2026-08-12').classList.contains('is-in-range')).toBe(true)

    hover(null)
    expect(day('2026-08-12').classList.contains('is-in-range')).toBe(false)
  })

  it('survives a click whose target is hovered first', () => {
    mount({ mode: 'range', presets: false })
    day('2026-08-10').click()

    const target = day('2026-08-14')
    target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    target.click()

    expect(picker.getSelection().to?.getDate()).toBe(14)
  })
})

describe('week selection', () => {
  const weeks = (): HTMLButtonElement[] => [
    ...picker.element.querySelectorAll<HTMLButtonElement>('[data-action="week"]'),
  ]

  /** The week button whose row starts on `iso`. */
  const week = (iso: string): HTMLButtonElement => {
    const button = weeks().find((candidate) => candidate.dataset.value === iso)
    if (!button) throw new Error(`week starting ${iso} is not rendered`)
    return button
  }

  it('leaves week numbers inert unless asked', () => {
    mount({ mode: 'range', presets: false, weekNumbers: true })
    expect(weeks()).toHaveLength(0)
    expect(picker.element.querySelectorAll('.gr-weeknum').length).toBeGreaterThan(0)
  })

  it('needs week numbers and a range mode', () => {
    mount({ mode: 'range', presets: false, weekSelection: 'number' })
    expect(weeks()).toHaveLength(0)

    mount({ mode: 'date', weekNumbers: true, weekSelection: 'number' })
    expect(weeks()).toHaveLength(0)
  })

  it('selects the whole week in one click', () => {
    mount({ mode: 'range', presets: false, weekNumbers: true, weekSelection: 'number' })

    week('2026-08-10').click()

    const selection = picker.getSelection()
    expect(formatISODate(selection.from!)).toBe('2026-08-10')
    expect(formatISODate(selection.to!)).toBe('2026-08-16')
  })

  it('follows firstDayOfWeek rather than the ISO week', () => {
    mount({ mode: 'range', presets: false, weekNumbers: true, weekSelection: 'number', firstDayOfWeek: 0 })

    // Sunday-first locale: the row runs Sunday to Saturday.
    week('2026-08-09').click()

    const selection = picker.getSelection()
    expect(formatISODate(selection.from!)).toBe('2026-08-09')
    expect(formatISODate(selection.to!)).toBe('2026-08-15')
  })

  it('marks the whole week as selected in the grid', () => {
    mount({ mode: 'range', presets: false, weekNumbers: true, weekSelection: 'number' })

    week('2026-08-10').click()

    expect(day('2026-08-10').classList.contains('is-start')).toBe(true)
    expect(day('2026-08-13').classList.contains('is-in-range')).toBe(true)
    expect(day('2026-08-16').classList.contains('is-end')).toBe(true)
    expect(day('2026-08-17').classList.contains('is-in-range')).toBe(false)
  })

  it('clips the week to min and max', () => {
    mount({
      mode: 'range',
      presets: false,
      weekNumbers: true,
      weekSelection: 'number',
      min: '2026-08-12',
      max: '2026-08-14',
    })

    week('2026-08-10').click()

    const selection = picker.getSelection()
    expect(formatISODate(selection.from!)).toBe('2026-08-12')
    expect(formatISODate(selection.to!)).toBe('2026-08-14')
  })

  it('ignores a week that cannot fit in maxSpan', () => {
    mount({ mode: 'range', presets: false, weekNumbers: true, weekSelection: 'number', maxSpan: 5 })

    week('2026-08-10').click()

    expect(picker.getSelection().from).toBeNull()
  })

  it('allows a week when maxSpan is exactly seven days', () => {
    mount({ mode: 'range', presets: false, weekNumbers: true, weekSelection: 'number', maxSpan: 7 })

    week('2026-08-10').click()

    expect(formatISODate(picker.getSelection().to!)).toBe('2026-08-16')
  })

  it('commits and closes when autoApply is on', () => {
    mount({ mode: 'range', presets: false, weekNumbers: true, weekSelection: 'number', autoApply: true })

    week('2026-08-10').click()

    const value = picker.getValue() as DateRange
    expect(formatISODate(value.from!)).toBe('2026-08-10')
    expect(formatISODate(value.to!)).toBe('2026-08-16')
    expect(picker.element.hidden).toBe(true)
  })

  it('waits for Apply otherwise', () => {
    mount({ mode: 'range', presets: false, weekNumbers: true, weekSelection: 'number' })
    const onChange = vi.fn()
    picker.on('change', onChange)

    week('2026-08-10').click()

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ complete: true }))
    expect((picker.getValue() as DateRange).from).toBeNull()

    picker.apply()
    expect((picker.getValue() as DateRange).from).not.toBeNull()
  })

  it('picks the whole week from any day when weekSelection is "day"', () => {
    mount({ mode: 'range', presets: false, weekSelection: 'day' })

    // A Thursday in the middle of the row.
    day('2026-08-13').click()

    const selection = picker.getSelection()
    expect(formatISODate(selection.from!)).toBe('2026-08-10')
    expect(formatISODate(selection.to!)).toBe('2026-08-16')
  })

  it('does not need week numbers for the "day" variant', () => {
    mount({ mode: 'range', presets: false, weekSelection: 'day' })
    expect(picker.element.querySelector('.gr-weeknum')).toBeNull()

    day('2026-08-13').click()
    expect(picker.getSelection().from).not.toBeNull()
  })

  it('offers both affordances with "both"', () => {
    mount({ mode: 'range', presets: false, weekNumbers: true, weekSelection: 'both' })
    expect(weeks().length).toBeGreaterThan(0)

    day('2026-08-13').click()
    expect(formatISODate(picker.getSelection().from!)).toBe('2026-08-10')

    week('2026-08-17').click()
    expect(formatISODate(picker.getSelection().from!)).toBe('2026-08-17')
  })

  it('keeps plain day picking with "number"', () => {
    mount({ mode: 'range', presets: false, weekNumbers: true, weekSelection: 'number' })

    day('2026-08-13').click()

    expect(formatISODate(picker.getSelection().from!)).toBe('2026-08-13')
    expect(picker.getSelection().to).toBeNull()
  })

  it('follows firstDayOfWeek when a day picks the week', () => {
    mount({ mode: 'range', presets: false, weekSelection: 'day', firstDayOfWeek: 0 })

    day('2026-08-13').click()

    expect(formatISODate(picker.getSelection().from!)).toBe('2026-08-09')
    expect(formatISODate(picker.getSelection().to!)).toBe('2026-08-15')
  })

  it('previews the hovered week', () => {
    mount({ mode: 'range', presets: false, weekSelection: 'day' })

    day('2026-08-13').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))

    expect(day('2026-08-10').classList.contains('is-start')).toBe(true)
    expect(day('2026-08-12').classList.contains('is-in-range')).toBe(true)
    expect(day('2026-08-16').classList.contains('is-end')).toBe(true)
    expect(day('2026-08-17').classList.contains('is-in-range')).toBe(false)

    // Leaving the grid drops the preview again.
    picker.element.querySelector<HTMLElement>('.gr-foot')!.dispatchEvent(
      new MouseEvent('mouseover', { bubbles: true }),
    )
    expect(day('2026-08-12').classList.contains('is-in-range')).toBe(false)
  })

  it('ignores whole-week picking outside range modes', () => {
    mount({ mode: 'date', weekSelection: 'day' })

    day('2026-08-13').click()

    expect((picker.getValue() as Date).getDate()).toBe(13)
  })

  it('keeps the time of day in a datetime range', () => {
    mount({
      mode: 'datetime-range',
      presets: false,
      weekNumbers: true,
      weekSelection: 'number',
      minTime: '08:00',
      maxTime: '18:00',
    })

    week('2026-08-10').click()

    expect(picker.getSelection().from?.getHours()).toBe(8)
    expect(picker.getSelection().to?.getHours()).toBe(8)
  })
})

describe('open ranges', () => {
  const button = (action: string): HTMLButtonElement =>
    picker.element.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!

  it('is off by default — one day closes into a one-day range instead', () => {
    mount({ mode: 'range', presets: false })
    day('2026-08-10').click()
    expect(picker.element.querySelector('[data-action="open-end"]')).toBeNull()

    picker.apply()

    const value = picker.getValue() as DateRange
    expect(value.from?.getDate()).toBe(10)
    expect(value.to?.getDate()).toBe(10)
  })

  it('lets a single bound be applied as an open range', () => {
    mount({ mode: 'range', presets: false, allowOpenRange: true })
    day('2026-08-10').click()

    expect(button('apply').disabled).toBe(false)
    picker.apply()

    const value = picker.getValue() as DateRange
    expect(value.from?.getDate()).toBe(10)
    expect(value.to).toBeNull()
  })

  it('drops the end through the button', () => {
    mount({ mode: 'range', presets: false, allowOpenRange: true })
    day('2026-08-10').click()
    day('2026-08-14').click()

    button('open-end').click()
    picker.apply()

    const value = picker.getValue() as DateRange
    expect(value.from?.getDate()).toBe(10)
    expect(value.to).toBeNull()
  })

  it('drops the start, keeping the remaining bound as the end', () => {
    mount({ mode: 'range', presets: false, allowOpenRange: true })
    day('2026-08-10').click()

    // Only "from" is picked, so dropping the start moves it over to "to".
    button('open-start').click()
    picker.apply()

    const value = picker.getValue() as DateRange
    expect(value.from).toBeNull()
    expect(value.to?.getDate()).toBe(10)
  })

  it('keeps both toggles live from the first picked day', () => {
    mount({ mode: 'range', presets: false, allowOpenRange: true })
    expect(button('open-start').disabled).toBe(true)
    expect(button('open-end').disabled).toBe(true)

    day('2026-08-10').click()

    // One day is enough to declare which side stays open.
    expect(button('open-start').disabled).toBe(false)
    expect(button('open-end').disabled).toBe(false)

    day('2026-08-14').click()
    expect(button('open-start').disabled).toBe(false)
    expect(button('open-end').disabled).toBe(false)
  })

  it('marks the side that is currently open', () => {
    mount({ mode: 'range', presets: false, allowOpenRange: true })
    day('2026-08-10').click()

    // A lone start already means "from this day onwards".
    expect(button('open-end').getAttribute('aria-pressed')).toBe('true')
    expect(button('open-start').getAttribute('aria-pressed')).toBe('false')

    button('open-start').click()
    expect(button('open-start').getAttribute('aria-pressed')).toBe('true')
    expect(button('open-end').getAttribute('aria-pressed')).toBe('false')

    // With no start, the next click starts a fresh range rather than closing
    // the open one — so the range is once again open at the end.
    day('2026-08-14').click()
    expect(picker.getSelection().from?.getDate()).toBe(14)
    expect(button('open-end').getAttribute('aria-pressed')).toBe('true')

    day('2026-08-20').click()
    expect(button('open-start').getAttribute('aria-pressed')).toBe('false')
    expect(button('open-end').getAttribute('aria-pressed')).toBe('false')
  })

  it('flips the open side back and forth on a single picked day', () => {
    mount({ mode: 'range', presets: false, allowOpenRange: true })
    day('2026-08-10').click()

    button('open-start').click()
    expect(picker.getSelection().from).toBeNull()
    expect(picker.getSelection().to?.getDate()).toBe(10)

    button('open-end').click()
    expect(picker.getSelection().from?.getDate()).toBe(10)
    expect(picker.getSelection().to).toBeNull()

    picker.apply()
    const value = picker.getValue() as DateRange
    expect(value.from?.getDate()).toBe(10)
    expect(value.to).toBeNull()
  })

  it('accepts an open range as an input value', () => {
    mount({ mode: 'range', presets: false, allowOpenRange: true })
    picker.setValue({ from: '2026-08-10', to: null })

    const value = picker.getValue() as DateRange
    expect(value.from?.getDate()).toBe(10)
    expect(value.to).toBeNull()
  })

  it('reads an open range from a slash string', () => {
    mount({ mode: 'range', presets: false, allowOpenRange: true })

    picker.setValue('2026-08-10/')
    expect((picker.getValue() as DateRange).to).toBeNull()

    picker.setValue('/2026-08-14')
    const value = picker.getValue() as DateRange
    expect(value.from).toBeNull()
    expect(value.to?.getDate()).toBe(14)
  })

  it('shows an open value in the input with a prefix', () => {
    mount({ mode: 'range', presets: false, allowOpenRange: true, locale: 'cs' })

    picker.setValue('2026-08-10/')
    expect(input.value).toMatch(/^od /)

    picker.setValue('/2026-08-14')
    expect(input.value).toMatch(/^do /)
  })

  it('paints the calendar as running past the picked bound', () => {
    mount({ mode: 'range', presets: false, allowOpenRange: true })
    day('2026-08-10').click()

    expect(day('2026-08-20').classList.contains('is-in-range')).toBe(true)
    expect(day('2026-08-05').classList.contains('is-in-range')).toBe(false)
  })

  it('does not paint an open tail when the option is off', () => {
    mount({ mode: 'range', presets: false })
    day('2026-08-10').click()

    expect(day('2026-08-20').classList.contains('is-in-range')).toBe(false)
  })

  it('still waits for both bounds before auto-applying', () => {
    mount({ mode: 'range', presets: false, allowOpenRange: true, autoApply: true })
    day('2026-08-10').click()

    // The first click completes an open range, but closing here would deny
    // the user the second bound.
    expect(picker.element.hidden).toBe(false)

    day('2026-08-14').click()
    expect(picker.element.hidden).toBe(true)
    expect((picker.getValue() as DateRange).to?.getDate()).toBe(14)
  })

  it('opens the panel on the month of whichever bound exists', () => {
    mount({ mode: 'range', presets: false, allowOpenRange: true })
    picker.setValue('/2026-12-24')
    picker.close()
    picker.openPanel()

    expect([...picker.element.querySelectorAll('.gr-caption')][0]?.textContent?.toLowerCase()).toContain('prosinec')
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
  const select = (action: string): HTMLSelectElement =>
    picker.element.querySelector<HTMLSelectElement>(`[data-action="${action}"]`)!

  const choose = (action: string, value: string): void => {
    const control = select(action)
    control.value = value
    control.dispatchEvent(new Event('change', { bubbles: true }))
  }

  it('stays open after the day is picked, so the time can still be set', () => {
    mount({ mode: 'datetime' })
    day('2026-08-13').click()

    expect(picker.element.hidden).toBe(false)
    expect(select('hour-from').disabled).toBe(false)
    expect(picker.getValue()).toBeNull()
  })

  it('keeps the time when the day changes', () => {
    mount({ mode: 'datetime' })
    day('2026-08-13').click()

    choose('hour-from', '14')
    choose('minute-from', '30')

    expect(picker.getSelection().from?.getHours()).toBe(14)
    expect(picker.getSelection().from?.getMinutes()).toBe(30)

    day('2026-08-20').click()
    expect(picker.getSelection().from?.getDate()).toBe(20)
    expect(picker.getSelection().from?.getHours()).toBe(14)
    expect(picker.getSelection().from?.getMinutes()).toBe(30)

    picker.apply()
    expect((picker.getValue() as Date).getHours()).toBe(14)
  })

  it('disables the time selects until a day is picked', () => {
    mount({ mode: 'datetime' })
    expect(select('hour-from').disabled).toBe(true)
    expect(select('minute-from').disabled).toBe(true)
  })

  it('offers a time control per bound in a datetime range', () => {
    mount({ mode: 'datetime-range' })
    expect(picker.element.querySelectorAll('.gr-time-group')).toHaveLength(2)
    expect(select('hour-to')).not.toBeNull()
    expect(select('minute-to')).not.toBeNull()
  })

  it('lists minutes by timeStep', () => {
    mount({ mode: 'datetime', timeStep: 15 })
    day('2026-08-13').click()

    expect([...select('minute-from').options].map((option) => option.value)).toEqual(['0', '15', '30', '45'])
    expect([...select('hour-from').options]).toHaveLength(24)
  })

  it('offers sliders when asked', () => {
    mount({ mode: 'datetime', timeUi: 'slider', timeStep: 15 })
    day('2026-08-13').click()

    const hour = picker.element.querySelector<HTMLInputElement>('[data-action="slider-hour-from"]')!
    const minute = picker.element.querySelector<HTMLInputElement>('[data-action="slider-minute-from"]')!

    expect(hour.type).toBe('range')
    expect(hour.min).toBe('0')
    expect(hour.max).toBe('23')
    expect(minute.step).toBe('15')
    expect(picker.element.querySelector('[data-time-readout="from"]')?.textContent).toBe('00:00')
  })

  const drag = (action: string, value: string): void => {
    const input = picker.element.querySelector<HTMLInputElement>(`[data-action="${action}"]`)!
    input.value = value
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }

  it('updates the time while a slider is dragged', () => {
    mount({ mode: 'datetime', timeUi: 'slider', timeStep: 15 })
    day('2026-08-13').click()

    drag('slider-hour-from', '14')
    expect(picker.getSelection().from?.getHours()).toBe(14)

    drag('slider-minute-from', '30')
    expect(picker.getSelection().from?.getMinutes()).toBe(30)
    expect(picker.element.querySelector('[data-time-readout="from"]')?.textContent).toBe('14:30')
  })

  it('does not rebuild the sliders mid-drag', () => {
    mount({ mode: 'datetime', timeUi: 'slider' })
    day('2026-08-13').click()

    const before = picker.element.querySelector('[data-action="slider-hour-from"]')
    drag('slider-hour-from', '9')

    // Same node — a rebuild would drop the drag the moment the thumb moves.
    expect(picker.element.querySelector('[data-action="slider-hour-from"]')).toBe(before)
  })

  it('narrows the minute slider on a boundary hour', () => {
    mount({ mode: 'datetime', timeUi: 'slider', timeStep: 15, minTime: '08:00', maxTime: '18:00' })
    day('2026-08-13').click()

    const hour = picker.element.querySelector<HTMLInputElement>('[data-action="slider-hour-from"]')!
    expect(hour.min).toBe('8')
    expect(hour.max).toBe('18')

    drag('slider-hour-from', '18')

    const minute = picker.element.querySelector<HTMLInputElement>('[data-action="slider-minute-from"]')!
    expect(minute.max).toBe('0')
    expect(minute.disabled).toBe(true)
    expect(picker.element.querySelector('[data-time-readout="from"]')?.textContent).toBe('18:00')
  })

  it('keeps the summary in step with the sliders', () => {
    mount({ mode: 'datetime', timeUi: 'slider', summary: true })
    day('2026-08-13').click()

    drag('slider-hour-from', '16')

    expect(picker.element.querySelector('.gr-summary')?.textContent).toContain('16:00')
  })

  it('falls back to a native input when asked', () => {
    mount({ mode: 'datetime', timeUi: 'input' })
    expect(picker.element.querySelector('[data-action="time-from"]')).not.toBeNull()
    expect(picker.element.querySelector('[data-action="hour-from"]')).toBeNull()
  })

  it('never lets a one-day range end before it starts', () => {
    mount({ mode: 'datetime-range', presets: false, timeStep: 60 })
    day('2026-08-10').click()
    day('2026-08-10').click()

    choose('hour-to', '9')
    choose('hour-from', '17')

    // Moving the start past the end drags the end along.
    expect(picker.getSelection().from?.getHours()).toBe(17)
    expect(picker.getSelection().to?.getHours()).toBe(17)

    choose('hour-to', '8')
    expect(picker.getSelection().from?.getHours()).toBe(8)
    expect(picker.getSelection().to?.getHours()).toBe(8)
  })

  it('leaves a multi-day range alone', () => {
    mount({ mode: 'datetime-range', presets: false, timeStep: 60 })
    day('2026-08-10').click()
    day('2026-08-12').click()

    choose('hour-from', '17')
    choose('hour-to', '9')

    // 10th 17:00 → 12th 09:00 is a perfectly good range.
    expect(picker.getSelection().from?.getHours()).toBe(17)
    expect(picker.getSelection().to?.getHours()).toBe(9)
  })

  it('sets both bounds of a datetime range independently', () => {
    mount({ mode: 'datetime-range', presets: false })
    day('2026-08-10').click()
    day('2026-08-12').click()

    choose('hour-from', '9')
    choose('hour-to', '17')
    picker.apply()

    const value = picker.getValue() as DateRange
    expect(value.from?.getHours()).toBe(9)
    expect(value.to?.getHours()).toBe(17)
  })
})

describe('time bounds', () => {
  const select = (action: string): HTMLSelectElement =>
    picker.element.querySelector<HTMLSelectElement>(`[data-action="${action}"]`)!

  const hours = (): string[] => [...select('hour-from').options].map((option) => option.value)

  it('offers only hours inside the window', () => {
    mount({ mode: 'datetime', minTime: '08:00', maxTime: '18:00', timeStep: 30 })
    day('2026-08-13').click()

    expect(hours()).toEqual(['8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18'])
  })

  it('trims the minutes of the closing hour', () => {
    mount({ mode: 'datetime', minTime: '08:00', maxTime: '18:00', timeStep: 15 })
    day('2026-08-13').click()

    select('hour-from').value = '18'
    select('hour-from').dispatchEvent(new Event('change', { bubbles: true }))

    expect([...select('minute-from').options].map((option) => option.value)).toEqual(['0'])
    expect(picker.getSelection().from?.getHours()).toBe(18)
    expect(picker.getSelection().from?.getMinutes()).toBe(0)
  })

  it('trims the minutes of the opening hour', () => {
    mount({ mode: 'datetime', minTime: '08:30', maxTime: '18:00', timeStep: 15 })
    day('2026-08-13').click()

    expect([...select('minute-from').options].map((option) => option.value)).toEqual(['30', '45'])
  })

  it('starts a fresh pick at the beginning of the window', () => {
    mount({ mode: 'datetime', minTime: '08:00', maxTime: '18:00' })
    day('2026-08-13').click()

    expect(picker.getSelection().from?.getHours()).toBe(8)
    expect(picker.getSelection().from?.getMinutes()).toBe(0)
  })

  it('pulls a value handed in from outside into the window', () => {
    mount({ mode: 'datetime', minTime: '08:00', maxTime: '18:00', timeStep: 30 })
    picker.setValue('2026-08-13T06:10')
    day('2026-08-14').click()

    expect(picker.getSelection().from?.getHours()).toBe(8)
  })

  it('accepts the bounds handed over swapped', () => {
    mount({ mode: 'datetime', minTime: '18:00', maxTime: '08:00' })
    day('2026-08-13').click()

    expect(hours()[0]).toBe('8')
    expect(hours().at(-1)).toBe('18')
  })

  it('mirrors the window onto the native input', () => {
    mount({ mode: 'datetime', timeUi: 'input', minTime: '08:00', maxTime: '18:00' })
    const input = picker.element.querySelector<HTMLInputElement>('[data-action="time-from"]')!

    expect(input.getAttribute('min')).toBe('08:00')
    expect(input.getAttribute('max')).toBe('18:00')
  })
})

/** Captions of the visible month panels, lower-cased. */
function captions(): string[] {
  return [...picker.element.querySelectorAll('.gr-caption')].map((node) => node.textContent?.toLowerCase() ?? '')
}

function arrow(direction: 'prev' | 'next', index = 0): HTMLButtonElement {
  const button = picker.element.querySelector<HTMLButtonElement>(
    `[data-action="${direction}"][data-index="${index}"]`,
  )
  if (!button) throw new Error(`${direction} arrow of panel ${index} is missing`)
  return button
}

describe('navigation', () => {
  it('pages months with the arrows and reports the change', () => {
    mount({ mode: 'date' })
    const onMonthChange = vi.fn()
    picker.on('month-change', onMonthChange)

    arrow('next').click()
    expect(onMonthChange).toHaveBeenLastCalledWith({ year: 2026, month: 8, index: 0 })
    expect(captions()[0]).toContain('září')

    arrow('prev').click()
    expect(onMonthChange).toHaveBeenLastCalledWith({ year: 2026, month: 7, index: 0 })
  })

  it('gives every panel its own pair of arrows by default', () => {
    mount({ mode: 'range', presets: false })
    expect(picker.element.querySelectorAll('[data-action="prev"]')).toHaveLength(2)
    expect(picker.element.querySelectorAll('[data-action="next"]')).toHaveLength(2)
  })

  it('shows one shared pair when the calendars are linked', () => {
    mount({ mode: 'range', presets: false, linkedCalendars: true })
    expect(picker.element.querySelectorAll('[data-action="prev"]')).toHaveLength(1)
    expect(picker.element.querySelectorAll('[data-action="next"]')).toHaveLength(1)
  })

  it('pushes the later panel forward so the months never cross', () => {
    mount({ mode: 'range', presets: false })
    expect(captions()[0]).toContain('srpen')
    expect(captions()[1]).toContain('září')

    arrow('next', 0).click()

    expect(captions()[0]).toContain('září')
    expect(captions()[1]).toContain('říjen')
  })

  it('leaves the later panel alone when the first one moves back', () => {
    mount({ mode: 'range', presets: false })

    arrow('prev', 0).click()

    expect(captions()[0]).toContain('červenec')
    expect(captions()[1]).toContain('září')
  })

  it('pushes the first panel back so the months never cross', () => {
    mount({ mode: 'range', presets: false })

    arrow('prev', 1).click()

    expect(captions()[0]).toContain('červenec')
    expect(captions()[1]).toContain('srpen')
  })

  it('leaves the first panel alone when the later one moves forward', () => {
    mount({ mode: 'range', presets: false })

    arrow('next', 1).click()

    expect(captions()[0]).toContain('srpen')
    expect(captions()[1]).toContain('říjen')
  })

  it('keeps a deliberate gap between the panels', () => {
    mount({ mode: 'range', presets: false })
    arrow('next', 1).click()
    arrow('next', 1).click()
    expect(captions()[1]).toContain('listopad')

    // The first panel still has room, so the second one must not move.
    arrow('next', 0).click()

    expect(captions()[0]).toContain('září')
    expect(captions()[1]).toContain('listopad')
  })

  it('keeps three panels in order', () => {
    mount({ mode: 'range', presets: false, months: 3 })
    expect(captions()).toHaveLength(3)

    arrow('next', 0).click()

    expect(captions()[0]).toContain('září')
    expect(captions()[1]).toContain('říjen')
    expect(captions()[2]).toContain('listopad')
  })

  it('moves both panels together when linked', () => {
    mount({ mode: 'range', presets: false, linkedCalendars: true })

    // The shared pair sits on the outer edges: prev on the first panel,
    // next on the last.
    arrow('next', 1).click()

    expect(captions()[0]).toContain('září')
    expect(captions()[1]).toContain('říjen')

    arrow('prev', 0).click()

    expect(captions()[0]).toContain('srpen')
    expect(captions()[1]).toContain('září')
  })

  it('reports which panel moved', () => {
    mount({ mode: 'range', presets: false })
    const onMonthChange = vi.fn()
    picker.on('month-change', onMonthChange)

    arrow('next', 1).click()

    expect(onMonthChange).toHaveBeenLastCalledWith({ year: 2026, month: 9, index: 1 })
  })

  it('realigns the panels on goTo', () => {
    mount({ mode: 'range', presets: false })
    arrow('next', 1).click()

    picker.goTo('2027-03-01')

    expect(captions()[0]).toContain('březen')
    expect(captions()[1]).toContain('duben')
  })

  it('jumps to a month through the dropdowns', () => {
    mount({ mode: 'date', dropdowns: true })
    const select = picker.element.querySelector<HTMLSelectElement>('[data-action="select-month"]')!
    select.value = '11'
    select.dispatchEvent(new Event('change', { bubbles: true }))

    expect(picker.element.querySelector('.gr-caption')?.textContent?.toLowerCase()).toContain('prosinec')
  })

  it('opens a month list from the caption', () => {
    mount({ mode: 'date', dropdowns: 'menu' })
    expect(picker.element.querySelector('.gr-menu')).toBeNull()

    picker.element.querySelector<HTMLButtonElement>('[data-action="menu-month"]')!.click()

    const items = picker.element.querySelectorAll('[data-action="menu-pick-month"]')
    expect(items).toHaveLength(12)
    expect(picker.element.querySelector('[data-action="menu-month"]')?.getAttribute('aria-expanded')).toBe('true')

    picker.element.querySelector<HTMLButtonElement>('[data-value="11"][data-action="menu-pick-month"]')!.click()

    expect(captions()[0]?.toLowerCase()).toContain('prosinec')
    expect(picker.element.querySelector('.gr-menu')).toBeNull()
  })

  it('opens a year list from the caption', () => {
    mount({ mode: 'date', dropdowns: 'menu', min: '2025-01-01', max: '2027-12-31' })

    picker.element.querySelector<HTMLButtonElement>('[data-action="menu-year"]')!.click()

    const years = [...picker.element.querySelectorAll('[data-action="menu-pick-year"]')].map(
      (item) => item.textContent,
    )
    expect(years).toEqual(['2025', '2026', '2027'])

    picker.element.querySelector<HTMLButtonElement>('[data-value="2027"][data-action="menu-pick-year"]')!.click()

    expect(captions()[0]).toContain('2027')
  })

  it('marks the month and year that are showing', () => {
    mount({ mode: 'date', dropdowns: 'menu' })
    picker.element.querySelector<HTMLButtonElement>('[data-action="menu-month"]')!.click()

    const current = picker.element.querySelector('.gr-menu-item.is-current')
    expect(current?.getAttribute('data-value')).toBe('7')
    expect(current?.getAttribute('aria-selected')).toBe('true')
  })

  it('closes the list on a second click, on Escape and on a click elsewhere', () => {
    const trigger = () => picker.element.querySelector<HTMLButtonElement>('[data-action="menu-month"]')!
    mount({ mode: 'date', dropdowns: 'menu' })

    trigger().click()
    trigger().click()
    expect(picker.element.querySelector('.gr-menu')).toBeNull()

    trigger().click()
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(picker.element.querySelector('.gr-menu')).toBeNull()
    // The panel itself stays open — Escape only put the list away.
    expect(picker.element.hidden).toBe(false)

    trigger().click()
    picker.element.querySelector<HTMLButtonElement>('[data-action="next"]')!.click()
    expect(picker.element.querySelector('.gr-menu')).toBeNull()
  })

  it('keeps each panel list independent', () => {
    mount({ mode: 'range', presets: false, dropdowns: 'menu' })

    picker.element.querySelector<HTMLButtonElement>('[data-action="menu-month"][data-index="1"]')!.click()

    const menus = picker.element.querySelectorAll('.gr-menu')
    expect(menus).toHaveLength(1)
    expect(menus[0]?.closest('.gr-calendar')).toBe(picker.element.querySelectorAll('.gr-calendar')[1])
  })

  it('respects linked calendars when picking from the list', () => {
    mount({ mode: 'range', presets: false, dropdowns: 'menu', linkedCalendars: true })

    picker.element.querySelector<HTMLButtonElement>('[data-action="menu-month"][data-index="0"]')!.click()
    picker.element
      .querySelector<HTMLButtonElement>('[data-action="menu-pick-month"][data-value="9"]')!
      .click()

    expect(captions()[0]?.toLowerCase()).toContain('říjen')
    expect(captions()[1]?.toLowerCase()).toContain('listopad')
  })

  it('renders native selects for dropdowns: true', () => {
    mount({ mode: 'date', dropdowns: true })
    expect(picker.element.querySelector('[data-action="select-month"]')).not.toBeNull()
    expect(picker.element.querySelector('[data-action="menu-month"]')).toBeNull()
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
