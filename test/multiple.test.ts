import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Gregory } from '../src/gregory.js'
import { formatISODate } from '../src/core/date.js'
import type { GregoryOptions } from '../src/core/types.js'

let input: HTMLInputElement
let picker: Gregory

function mount(options: GregoryOptions = {}): Gregory {
  input = document.createElement('input')
  input.type = 'text'
  document.body.append(input)
  picker = new Gregory(input, { mode: 'multiple', locale: 'cs', ...options })
  picker.openPanel()
  picker.goTo('2026-08-01')
  return picker
}

function day(iso: string): HTMLButtonElement {
  const button = picker.element.querySelector<HTMLButtonElement>(`[data-action="day"][data-value="${iso}"]`)
  if (!button) throw new Error(`day ${iso} is not rendered`)
  return button
}

const picked = (): string[] => (picker.getValue() as Date[]).map(formatISODate)
const working = (): string[] => ((picker as unknown as { selectedValue(): Date[] }).selectedValue()).map(formatISODate)

afterEach(() => {
  picker?.destroy()
  input?.remove()
  document.body.replaceChildren()
})

describe('multiple mode', () => {
  beforeEach(() => mount())

  it('collects separate days', () => {
    day('2026-08-05').click()
    day('2026-08-13').click()
    day('2026-08-20').click()

    expect(working()).toEqual(['2026-08-05', '2026-08-13', '2026-08-20'])
  })

  it('sorts them however they were clicked', () => {
    day('2026-08-20').click()
    day('2026-08-05').click()

    expect(working()).toEqual(['2026-08-05', '2026-08-20'])
  })

  it('takes a second click as unselect', () => {
    day('2026-08-13').click()
    expect(working()).toEqual(['2026-08-13'])

    day('2026-08-13').click()
    expect(working()).toEqual([])
  })

  it('paints every picked day as selected, nothing in between', () => {
    day('2026-08-05').click()
    day('2026-08-20').click()

    expect(day('2026-08-05').classList.contains('is-selected')).toBe(true)
    expect(day('2026-08-20').classList.contains('is-selected')).toBe(true)
    // Mezi nimi není rozsah — to je celý rozdíl proti range režimu.
    expect(day('2026-08-13').classList.contains('is-in-range')).toBe(false)
  })

  it('waits for Apply and can be cancelled', () => {
    day('2026-08-13').click()
    expect(picked()).toEqual([])

    picker.apply()
    expect(picked()).toEqual(['2026-08-13'])

    picker.openPanel()
    day('2026-08-20').click()
    picker.cancel()

    expect(picked()).toEqual(['2026-08-13'])
  })

  it('stays open while days are being collected', () => {
    day('2026-08-05').click()
    day('2026-08-13').click()

    expect(picker.element.hidden).toBe(false)
  })

  it('lists the days in the field and shortens a long list', () => {
    day('2026-08-05').click()
    day('2026-08-13').click()
    picker.apply()
    expect(input.value).toBe('5. 8. 2026, 13. 8. 2026')

    picker.openPanel()
    day('2026-08-20').click()
    day('2026-08-27').click()
    picker.apply()

    expect(input.value).toBe('5. 8. 2026, 13. 8. 2026, 20. 8. 2026 +1')
  })

  it('counts the days in the summary', () => {
    picker.destroy()
    mount({ summary: true })

    day('2026-08-05').click()
    day('2026-08-13').click()

    expect(picker.element.querySelector('.gr-summary')?.textContent).toBe('2 dny')
  })

  it('stops at maxSelected', () => {
    picker.destroy()
    mount({ maxSelected: 2 })

    day('2026-08-05').click()
    day('2026-08-13').click()
    day('2026-08-20').click()

    expect(working()).toEqual(['2026-08-05', '2026-08-13'])
  })

  it('still lets a picked day go when the limit is reached', () => {
    picker.destroy()
    mount({ maxSelected: 1 })

    day('2026-08-05').click()
    day('2026-08-05').click()
    day('2026-08-13').click()

    expect(working()).toEqual(['2026-08-13'])
  })

  it('takes a list as its value', () => {
    picker.destroy()
    mount({ value: ['2026-08-05', '2026-08-13'] })

    expect(picked()).toEqual(['2026-08-05', '2026-08-13'])
    expect(day('2026-08-05').classList.contains('is-selected')).toBe(true)
  })

  it('empties on clear', () => {
    day('2026-08-13').click()
    picker.apply()

    picker.clear()

    expect(picked()).toEqual([])
    expect(input.value).toBe('')
  })

  it('respects min, max and isDisabled', () => {
    picker.destroy()
    mount({ min: '2026-08-10', max: '2026-08-20' })

    expect(day('2026-08-05').disabled).toBe(true)
    day('2026-08-05').click()
    expect(working()).toEqual([])
  })

  it('reports the working list on change', () => {
    const onChange = vi.fn()
    picker.on('change', onChange)

    day('2026-08-13').click()

    const payload = onChange.mock.calls.at(-1)![0] as { value: Date[] }
    expect(payload.value.map(formatISODate)).toEqual(['2026-08-13'])
  })

  it('commits straight away with autoApply', () => {
    picker.destroy()
    mount({ autoApply: true })

    day('2026-08-13').click()

    expect(picked()).toEqual(['2026-08-13'])
    // Sbírání pokračuje, panel se nezavírá.
    expect(picker.element.hidden).toBe(false)

    day('2026-08-20').click()
    expect(picked()).toEqual(['2026-08-13', '2026-08-20'])
  })
})
